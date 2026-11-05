# KEDA: scale inventory reservations from RabbitMQ

This experiment runs the existing Inventory reservation consumer as a Deployment
scaled by the `inventory.reserve.v1` queue. The Catalog CPU HPA experiment remains
in `k8s/catalog`. KEDA owns a separate HPA for the reservation consumer; do not add
another HPA targeting that Deployment.

For the real **Order API → RabbitMQ → Inventory → RabbitMQ → Order result**
flow with both consumers scaled by KEDA, use the [real-order guide](orders/README.md).
That scenario runs in namespace `keda-webshop`; the reservation-only experiment
below remains in `keda-experiment` with its original data.

## Hypothesis and acceptance criteria

A queue backlog should activate workers without waiting for CPU pressure. With
no work, the consumer should cost zero running pods. The configured target is
20 ready plus unacknowledged messages per replica, with a maximum of four
replicas. KEDA polls every five seconds, and scales to zero after 60 seconds of
inactivity. Normal Kubernetes HPA reconciliation and startup time also apply.
These are initial experiment settings, not measured production capacity.

Success means:

- The idle worker Deployment starts at zero replicas.
- Publishing a backlog activates at least one worker; sustained backlog should
  increase replicas up to the configured cap.
- The load Job reports PASS: every unique test request has a terminal reservation
  and transactional outbox result, with no ready retry or dead-letter messages.
- After processing, the worker Deployment returns to zero replicas.

Record peak replicas, queue depth, total completion time, retries, and errors.
Scaling alone does not prove improved throughput. For a fixed-one-worker
baseline, annotate the ScaledObject with
`autoscaling.keda.sh/paused-replicas="1"`, run the same load, then remove that
annotation with `kubectl annotate ... autoscaling.keda.sh/paused-replicas-`.
Always specify the context and experiment namespace as in the commands below.

## Local kind setup (PowerShell)

Requirements: Docker Desktop running Linux containers, kind, kubectl, a running
kind cluster named `cloudproject`, and a default dynamic StorageClass. Override
the cluster name with `-ClusterName`. Commands explicitly select the kind context.
The script uses KEDA 2.21.0's official release YAML, including its admission
webhook. Installation creates cluster-wide KEDA CRDs, RBAC and an external metrics
API, plus components in namespace `keda`.

From the repository root:

```powershell
./scripts/keda-experiment.ps1 -Action Deploy -InstallKeda
```

For subsequent deploys, omit `-InstallKeda`. The script builds the existing
Inventory Dockerfile as `cloudproject-inventory:keda`, loads it into kind, and
creates the isolated namespace `keda-experiment`. The namespace contains:

- RabbitMQ with its management API and persistent storage.
- A separate PostgreSQL database with persistent storage.
- Random local credentials in a Kubernetes Secret, reused across deploys.
- A setup Job that initializes the stock table, runs existing Alembic migrations,
  and declares the existing durable queues before workers can start at zero.
- The consumer Deployment, TriggerAuthentication and ScaledObject.

Neither database nor broker has a public service. These single-node dependencies
and in-cluster plaintext connections are for local experiments. The manifests
use the existing major-version database/broker image tags; they are not a fully
digest-pinned production deployment.

## Run and observe

Start a watch **before** publishing; workers can drain a short backlog quickly:

```powershell
kubectl --context kind-cloudproject -n keda-experiment get deployment inventory-reservation-consumer --watch
```

In another terminal:

```powershell
./scripts/keda-experiment.ps1 -Action Load
kubectl --context kind-cloudproject -n keda-experiment logs -f job/inventory-keda-load
kubectl --context kind-cloudproject -n keda-experiment get scaledobject,hpa,pods
kubectl --context kind-cloudproject -n keda-experiment exec rabbitmq-0 -- rabbitmqctl list_queues -p /webshop name messages_ready messages_unacknowledged consumers
```

The Job publishes 10,000 confirmed persistent messages with unique message and
order IDs and a unique nonexistent product for each run. The real consumer
processes the normal unknown-product rejection path, exercising its database
transaction, inbox and outbox without using webshop stock. The publisher waits
up to five minutes for the expected results and exits nonzero on failure. Total
Job deadline is ten minutes. Change `MESSAGE_COUNT` in `load-job.yaml` to tune load.
Each `Load` invocation replaces only the previous load Job; database rows remain.
Wait for the current run to finish before starting the next one.

This reservation-only scenario is a worker-scaling experiment: it does
not create Orders or run an outbox publisher/result consumer. Results remain in
Inventory's outbox. It does not verify the successful stock-reservation path or
end-to-end order confirmation. The existing consumer acknowledges after commit;
if terminated during work, RabbitMQ redelivers unacknowledged messages and the
existing inbox/reservation constraints protect committed effects. Termination
and database-outage recovery still need a separate resilience experiment.

## Validation and results

Verified locally on 2026-11-02 with KEDA 2.21.0 and the existing
`kind-cloudproject` cluster (Kubernetes 1.37.0):

- All YAML manifests passed `kubectl apply --dry-run=server`, including KEDA
  admission validation. PowerShell syntax and Python Ruff checks passed.
- Setup completed using the existing Inventory image and Alembic migration.
- The 10,000-message Job ran from 10:14:36 to 10:15:14 Europe/Amsterdam (38 seconds,
  including pod startup, publishing and result verification).
- The Job verified 10,000 rejection reservations and 10,000 outbox results.
  RabbitMQ reported zero ready and unacknowledged messages in the reservation,
  retry and dead-letter queues after completion.
- Replica observations every five seconds recorded **0 → 1 → 4 → 1 → 0**.
  Zero replicas were observed again at 10:16:15 Europe/Amsterdam.
- A subsequent `Deploy` completed successfully with existing credentials and
  volumes; all 10,000 reservations remained and workers stayed at zero.

This single run confirms activation, processing and scale-to-zero. No fixed-one
baseline or failure-injection experiment was run, so it does not establish a
throughput improvement or recovery guarantee. KEDA's documentation lists
Kubernetes 1.34–1.36 as its tested compatibility range for this release; this
successful local 1.37 run is narrower evidence, not an upstream support claim.

## Cleanup

To stop consumer processing while retaining experiment data, pause at zero:

```powershell
kubectl --context kind-cloudproject -n keda-experiment annotate scaledobject inventory-reservations autoscaling.keda.sh/paused-replicas="0" --overwrite
```

Remove the annotation to resume. To deliberately delete the experiment **and its
database/broker volumes**, delete namespace `keda-experiment` only when you no
longer need the data. KEDA remains installed for other experiments. Its official
release YAML can be uninstalled separately after confirming no other workloads
use KEDA. Neither cleanup step is run automatically.

## References

- [RabbitMQ scaler and HTTP queue metrics](https://keda.sh/docs/2.21/scalers/rabbitmq-queue/)
- [ScaledObject settings](https://keda.sh/docs/2.21/reference/scaledobject-spec/)
- [Official installation and compatibility](https://keda.sh/docs/2.21/deploy/)
