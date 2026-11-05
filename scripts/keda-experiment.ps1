[CmdletBinding()]
param(
    [ValidateSet('Deploy', 'Load', 'Status')]
    [string]$Action = 'Status',
    [ValidateSet('Reservations', 'Orders')]
    [string]$Scenario = 'Reservations',
    [string]$ClusterName = 'cloudproject',
    [switch]$InstallKeda
)

$ErrorActionPreference = 'Stop'
$experimentRoot = Split-Path -Parent $PSScriptRoot
$context = "kind-$ClusterName"
$namespace = 'keda-experiment'
if ($Scenario -eq 'Orders') { $namespace = 'keda-webshop' }
$manifests = Join-Path $experimentRoot 'k8s/keda'
$orderManifests = Join-Path $manifests 'orders'
$kedaRelease = 'https://github.com/kedacore/keda/releases/download/v2.21.0/keda-2.21.0.yaml'

function Invoke-Native {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Program failed (exit $LASTEXITCODE)."
    }
}

function Invoke-Kube {
    param([string[]]$Arguments)
    # Bind the array explicitly: Windows PowerShell 5.1 otherwise converts the
    # nested positional array into one space-joined native command argument.
    Invoke-Native -Program 'kubectl' -Arguments (@('--context', $context, '--namespace', $namespace) + $Arguments)
}

# Every Kubernetes command names the local kind context explicitly.
Invoke-Kube -Arguments @('get', 'nodes', '--request-timeout=10s')

if ($Action -eq 'Deploy') {
    if ($InstallKeda) {
        Invoke-Native -Program 'kubectl' -Arguments @('--context', $context, 'apply', '--server-side', '-f', $kedaRelease)
        Invoke-Kube -Arguments @('wait', '--for=condition=Established', 'crd/scaledobjects.keda.sh', '--timeout=60s')
        foreach ($deployment in @('keda-operator', 'keda-metrics-apiserver', 'keda-admission')) {
            Invoke-Native -Program 'kubectl' -Arguments @('--context', $context, '-n', 'keda', 'rollout', 'status', "deployment/$deployment", '--timeout=180s')
        }
    }
    Invoke-Kube -Arguments @('get', 'crd/scaledobjects.keda.sh')
    Invoke-Native -Program 'docker' -Arguments @('build', '-t', 'cloudproject-inventory:keda', (Join-Path $experimentRoot 'services/inventory'))
    Invoke-Native -Program 'kind' -Arguments @('load', 'docker-image', 'cloudproject-inventory:keda', '--name', $ClusterName)
    if ($Scenario -eq 'Orders') {
        Invoke-Native -Program 'docker' -Arguments @('build', '-t', 'cloudproject-order:keda', (Join-Path $experimentRoot 'services/order'))
        Invoke-Native -Program 'kind' -Arguments @('load', 'docker-image', 'cloudproject-order:keda', '--name', $ClusterName)
        Invoke-Kube -Arguments @('apply', '-f', (Join-Path $orderManifests 'namespace.yaml'))
    } else {
        Invoke-Kube -Arguments @('apply', '-f', (Join-Path $manifests 'namespace.yaml'))
    }

    $existingSecret = & kubectl --context $context -n $namespace get secret experiment-credentials --ignore-not-found -o name
    if ($LASTEXITCODE -ne 0) { throw 'Could not check experiment credentials.' }
    if (-not $existingSecret) {
        # Keep credentials stable across deploys because the database and broker persist.
        $rabbitPassword = [guid]::NewGuid().ToString('N')
        $postgresPassword = [guid]::NewGuid().ToString('N')
        $orderPostgresPassword = [guid]::NewGuid().ToString('N')
        $secret = @{
            apiVersion = 'v1'
            kind = 'Secret'
            metadata = @{ name = 'experiment-credentials'; namespace = $namespace }
            type = 'Opaque'
            stringData = @{
                'rabbitmq-username' = 'experiment'
                'rabbitmq-password' = $rabbitPassword
                'postgres-password' = $postgresPassword
                'order-postgres-password' = $orderPostgresPassword
                ORDER_DATABASE_URL = "postgresql://orders:${orderPostgresPassword}@order-database:5432/orders"
                DATABASE_URL = "postgresql://inventory:${postgresPassword}@inventory-database:5432/inventory"
                RABBITMQ_URL = "amqp://experiment:${rabbitPassword}@rabbitmq:5672/%2Fwebshop"
            }
        }
        $secret | ConvertTo-Json -Depth 5 -Compress | & kubectl --context $context -n $namespace create -f -
        if ($LASTEXITCODE -ne 0) { throw 'Could not create experiment credentials.' }
    }

    # KEDA resolves broker DNS from its own namespace. Keep the endpoint alongside
    # the credentials so both scenarios use the same ScaledObject manifest.
    $endpointPatch = @{ stringData = @{ 'rabbitmq-host' = "http://rabbitmq.${namespace}.svc.cluster.local:15672/" } } | ConvertTo-Json -Compress
    Invoke-Kube -Arguments @('patch', 'secret', 'experiment-credentials', '--type=merge', '--patch', $endpointPatch)

    & kubectl --context $context -n $namespace create configmap reservation-backlog-script `
        --from-file="$(Join-Path $experimentRoot 'tests/load/reservation_backlog.py')" `
        --dry-run=client -o yaml | & kubectl --context $context -n $namespace apply -f -
    if ($LASTEXITCODE -ne 0) { throw 'Could not apply the experiment script ConfigMap.' }
    Invoke-Kube -Arguments @('apply', '-f', (Join-Path $manifests 'dependencies.yaml'))
    foreach ($statefulSet in @('rabbitmq', 'inventory-database')) {
        Invoke-Kube -Arguments @('rollout', 'status', "statefulset/$statefulSet", '--timeout=240s')
    }
    Invoke-Kube -Arguments @('apply', '-f', (Join-Path $manifests 'setup-job.yaml'))
    Invoke-Kube -Arguments @('wait', '--for=condition=complete', 'job/inventory-keda-setup', '--timeout=180s')
    Invoke-Kube -Arguments @('logs', 'job/inventory-keda-setup')
    if ($Scenario -eq 'Orders') {
        & kubectl --context $context -n $namespace create configmap order-bootstrap-schema `
            --from-file="$(Join-Path $experimentRoot 'services/order/db/init.sql')" `
            --dry-run=client -o yaml | & kubectl --context $context -n $namespace apply -f -
        if ($LASTEXITCODE -ne 0) { throw 'Could not apply the Order bootstrap schema ConfigMap.' }
        Invoke-Kube -Arguments @('apply', '-f', (Join-Path $orderManifests 'database.yaml'))
        Invoke-Kube -Arguments @('rollout', 'status', 'statefulset/order-database', '--timeout=240s')
        Invoke-Kube -Arguments @('apply', '-f', (Join-Path $orderManifests 'setup-job.yaml'))
        Invoke-Kube -Arguments @('wait', '--for=condition=complete', 'job/order-keda-setup', '--timeout=180s')
        Invoke-Kube -Arguments @('logs', 'job/order-keda-setup')
        Invoke-Kube -Arguments @('apply', '-f', (Join-Path $orderManifests 'workloads.yaml'))
        foreach ($deployment in @('order-service', 'inventory-service', 'order-outbox-publisher', 'inventory-outbox-publisher')) {
            Invoke-Kube -Arguments @('rollout', 'status', "deployment/$deployment", '--timeout=120s')
        }
        & kubectl --context $context -n $namespace create configmap keda-orders-script `
            --from-file="$(Join-Path $experimentRoot 'tests/load/keda_orders.py')" `
            --dry-run=client -o yaml | & kubectl --context $context -n $namespace apply -f -
        if ($LASTEXITCODE -ne 0) { throw 'Could not apply the real-order load script ConfigMap.' }
    }
    Invoke-Kube -Arguments @('apply', '-f', (Join-Path $manifests 'worker.yaml'))
    Invoke-Kube -Arguments @('apply', '-f', (Join-Path $manifests 'scaledobject.yaml'))
    Invoke-Kube -Arguments @('wait', '--for=condition=Ready', 'scaledobject/inventory-reservations', '--timeout=90s')
    if ($Scenario -eq 'Orders') {
        Invoke-Kube -Arguments @('apply', '-f', (Join-Path $orderManifests 'scaledobject.yaml'))
        Invoke-Kube -Arguments @('wait', '--for=condition=Ready', 'scaledobject/order-results', '--timeout=90s')
    }
}

if ($Action -eq 'Load') {
    Invoke-Kube -Arguments @('wait', '--for=condition=Ready', 'scaledobject/inventory-reservations', '--timeout=30s')
    $loadJob = 'inventory-keda-load'
    $loadManifest = Join-Path $manifests 'load-job.yaml'
    if ($Scenario -eq 'Orders') {
        Invoke-Kube -Arguments @('wait', '--for=condition=Ready', 'scaledobject/order-results', '--timeout=30s')
        $loadJob = 'webshop-keda-load'
        $loadManifest = Join-Path $orderManifests 'load-job.yaml'
    }
    $jobState = & kubectl --context $context -n $namespace get job $loadJob --ignore-not-found -o json
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect previous load Job.' }
    if ($jobState) {
        $previousJob = $jobState | ConvertFrom-Json
        $finished = @($previousJob.status.conditions | Where-Object {
            $_.status -eq 'True' -and $_.type -in @('Complete', 'Failed')
        }).Count -gt 0
        if (-not $finished) { throw 'The previous load Job has not finished.' }
    }
    Invoke-Kube -Arguments @('delete', 'job', $loadJob, '--ignore-not-found', '--wait=true')
    Invoke-Kube -Arguments @('apply', '-f', $loadManifest)
    Write-Host 'Load started. Watch replicas in another terminal; inspect job logs for PASS.'
}

Invoke-Kube -Arguments @('get', 'scaledobject,hpa,deployment,pods,jobs')
