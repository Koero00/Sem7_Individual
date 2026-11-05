[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$experimentScript = Join-Path $repositoryRoot 'scripts/keda-experiment.ps1'
$shells = @(Get-Command powershell.exe, pwsh.exe -ErrorAction SilentlyContinue)
if ($shells.Count -eq 0) { throw 'No PowerShell executable is available.' }

# Exercise the public read-only command through each shell's native argument
# handling. Requires the existing local kind cluster and Orders deployment.
$failedShells = @()
foreach ($shell in $shells) {
    $ErrorActionPreference = 'Continue'
    try {
        $output = & $shell.Source -NoProfile -NonInteractive -File $experimentScript -Scenario Orders -Action Status 2>&1
        $commandExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = 'Stop'
    }
    if ($commandExitCode -ne 0) {
        $failedShells += $shell.Name
        Write-Output "FAIL: $($shell.Name) (exit $commandExitCode)"
        Write-Output ($output | Out-String)
    } elseif (($output | Out-String) -notmatch 'inventory-reservation-consumer') {
        $failedShells += $shell.Name
        Write-Output "FAIL: $($shell.Name) did not report the Orders deployment."
    } else {
        Write-Output "PASS: $($shell.Name) ran the KEDA Orders Status command."
    }
}
if ($failedShells.Count -gt 0) {
    throw "KEDA shell compatibility failed: $($failedShells -join ', ')"
}
