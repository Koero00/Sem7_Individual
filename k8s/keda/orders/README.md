# KEDA with real webshop orders

This scenario runs the existing Order and Inventory services in Kubernetes and
scales their RabbitMQ consumers independently. It uses namespace `keda-webshop`
with its own broker, databases, credentials and volumes. The earlier synthetic
reservation test and its data remain in `keda-experiment`. Docker Compose and
the Catalog HPA in namespace `default` remain separate.

The complete processing path is:

```text
POST /orders → pending order + Order outbox
  → Order publisher → RabbitMQ inventory.reserve.v1
  → Inventory consumer → reservation + Inventory outbox
  → Inventory publisher → RabbitMQ orders.inventory-results.v1
  → Order result consumer → confirmed/rejected order
```

Both consumers have their own ScaledObject and KEDA-managed HPA. Each targets
20 ready plus unacknowledged messages per worker, polls for activation every
five seconds, and can run zero to four workers. The cooldown for scaling to zero
is 60 seconds, in addition to normal reconciliation timing. The HTTP APIs and
outbox publishers keep one replica each. Keeping publishers running allows
messages waiting in database outboxes to reach RabbitMQ even when consumers are
at zero. The databases and RabbitMQ also keep running.

## Deploy and verify (PowerShell)

Use the requirements from the [original experiment guide](../README.md). From
the repository root, run:

```powershell
./scripts/keda-experiment.ps1 -Scenario Orders -Action Deploy
```

If KEDA is not installed, append `-InstallKeda`. The script builds and loads both
existing service images into kind, creates dependencies, and waits for migration
Jobs to finish before starting APIs and workers. Order's bootstrap Job uses the
existing `services/order/db/init.sql` and Alembic migrations. Both queue topologies
are declared before consumers can start at zero. Credentials are generated only
when absent; deploys reuse existing Secrets and persistent volumes.

Watch deployments in a separate terminal before starting the load:

```powershell
kubectl --context kind-cloudproject -n keda-webshop get deployments --watch
```

Then run:

```powershell
./scripts/keda-experiment.ps1 -Scenario Orders -Action Load
kubectl --context kind-cloudproject -n keda-webshop logs -f job/webshop-keda-load
```

The test creates a unique stock record with 500 units through Inventory's API,
then submits 1,000 orders through Order's API. Every order requests one unit.
It checks that all requests return pending orders, then polls each order until
terminal. Success requires exactly 500 confirmations, 500 insufficient-stock
rejections, and zero remaining stock. No database is read or modified directly
by this test, and it does not consume existing product stock. Ten concurrent
clients generate load. `ORDER_COUNT` in `load-job.yaml` controls the workload;
initial stock is half that value, rounded down.

The Job exits nonzero on an HTTP error, unexpected result, timeout, or incorrect
stock count. It has no automatic retry, to keep a failed run visible. Each run
uses a fresh product/customer identifier and retains its data for inspection.
The script refuses to replace a load Job that has not finished.

The launcher explicitly binds command argument arrays for Windows PowerShell 5.1
and PowerShell 7. An earlier wrapper combined arguments in Windows PowerShell,
causing `unknown flag: --context kind-cloudproject --namespace ...` before any new
load Job started. That wrapper has been corrected. To check argument forwarding
through the public read-only Status action in each available shell, run:

```powershell
./tests/keda-shell-compatibility.ps1
```

The check requires the local cluster and this Orders scenario to be deployed.
When diagnosing a failed launch, existing Job logs can belong to an older run;
verify that the launch actually created a new Job before interpreting its PASS.

Observe both consumers activate and eventually return to zero; a short backlog
may drain before either needs all four replicas. A completed test proves the
tested flow, not a throughput improvement over a fixed worker baseline.

## Inspect the system

```powershell
./scripts/keda-experiment.ps1 -Scenario Orders -Action Status
kubectl --context kind-cloudproject -n keda-webshop get scaledobject,hpa,pods,jobs
kubectl --context kind-cloudproject -n keda-webshop describe scaledobject inventory-reservations
kubectl --context kind-cloudproject -n keda-webshop describe scaledobject order-results
kubectl --context kind-cloudproject -n keda-webshop exec rabbitmq-0 -- rabbitmqctl list_queues -p /webshop name messages_ready messages_unacknowledged consumers
kubectl --context kind-cloudproject -n keda-webshop logs deployment/order-outbox-publisher --tail=20
kubectl --context kind-cloudproject -n keda-webshop logs deployment/inventory-outbox-publisher --tail=20
```

At the end of a healthy run both main queues and the retry/dead-letter queues
should have zero ready/unacknowledged messages. Confirm both database outboxes
have published their results when diagnosing a pending order. More consumers
cannot resolve a stopped publisher or a database outage by themselves.

## Try an order manually

Run these port forwards in separate terminals:

```powershell
kubectl --context kind-cloudproject -n keda-webshop port-forward service/order-service 18004:8004
kubectl --context kind-cloudproject -n keda-webshop port-forward service/inventory-service 18003:8003
```

In another PowerShell terminal:

```powershell
$productId = 'keda-manual-' + [guid]::NewGuid().ToString('N')
$stock = @{ product_id = $productId; quantity = 5 } | ConvertTo-Json
Invoke-RestMethod http://localhost:18003/inventory -Method Post -ContentType application/json -Body $stock
$body = @{ customer_id = 'manual-demo'; items = @(@{ product_id = $productId; quantity = 1 }) } | ConvertTo-Json -Depth 4
$order = Invoke-RestMethod http://localhost:18004/orders -Method Post -ContentType application/json -Body $body
$order
Invoke-RestMethod "http://localhost:18004/orders/$($order.id)"
```

Repeat the final GET after several seconds to observe confirmation; activation
from zero adds queue-polling and pod-startup latency. The APIs are ClusterIP
services and use localhost-only port forwarding for this demonstration. This
scenario includes no frontend or gateway; it exercises the existing services
directly and does not migrate the whole webshop UI into Kubernetes.

## Validation results

Verified on 2026-11-02 with KEDA 2.21.0 on `kind-cloudproject` (Kubernetes 1.37.0):

- Server-side dry runs passed for all added manifests and the shared reservation
  ScaledObject/TriggerAuthentication, including KEDA admission validation.
- Python Ruff lint/format checks and PowerShell parsing passed.
- Load Job: 11:22:54–11:23:52 Europe/Amsterdam (58 seconds including startup).
  The script reported 54.1 seconds for submission and result verification.
- All 1,000 POSTs returned pending orders. Final results were exactly 500
  confirmed and 500 insufficient-stock rejections, with stock at zero.
- Both consumer Deployments activated from zero, reached four replicas, and
  returned to zero by 11:25:00 Europe/Amsterdam.
- Both transactional outboxes had zero unpublished messages, and Order had
  processed all 1,000 result messages. All main, retry and dead-letter queues
  had zero ready and unacknowledged messages after processing.
- Both `Orders` and `Reservations` deployment scenarios redeployed successfully.
  The earlier 10,000 reservation records remained intact and the Catalog HPA
  remained healthy.

The local Kubernetes API briefly returned TLS handshake timeouts during
observation, then recovered without a restart or configuration change. The
Docker VM was close to its memory capacity and its swap was full when inspected;
that is an observed environment limitation, not a proven root cause. The test
Job completed successfully. These timings are one local run, not a benchmark
or a comparison against fixed worker capacity.

Follow-up verification on 2026-11-05 reproduced the launcher argument-binding
failure in Windows PowerShell 5.1, while PowerShell 7 passed. After explicitly
binding argument arrays in the command wrappers, the Status regression check
passed in both shells. A fresh full Load run launched from Windows PowerShell
5.1 completed successfully: 1,000 orders, 500 confirmed, 500 rejected, stock zero
(37.3 seconds in the verification script). Both consumers reached four replicas
and returned to zero. All main, retry and dead-letter queues were empty.

## Limits and cleanup

These manifests are for the local kind experiment. The single-instance databases
and broker, image tags, in-cluster plaintext connections and unauthenticated APIs
are not a production deployment. This change reuses existing message handling;
it does not establish crash recovery or graceful consumer termination guarantees.
See the [KEDA compatibility and earlier results](../README.md#validation-and-results).

To retain data while stopping consumers, annotate **both** ScaledObjects with
`autoscaling.keda.sh/paused-replicas="0"`. Remove the annotations to resume.
Deleting namespace `keda-webshop` deliberately deletes its databases and broker
volumes; only do so when the test data is no longer needed. Nothing is deleted
automatically, and shared KEDA components remain installed.

The scaler settings follow the official
[RabbitMQ scaler](https://keda.sh/docs/2.21/scalers/rabbitmq-queue/) and
[ScaledObject specification](https://keda.sh/docs/2.21/reference/scaledobject-spec/).
