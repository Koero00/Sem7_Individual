# Infrastructure and cloud experiments

Use this guide when changing containers, deployment configuration, Kubernetes or
cloud workloads, or running scalability and resilience experiments. Docker
Compose is the current local runtime; Kubernetes and cloud hosting remain goals.

## Containers and deployments

- Keep services independently buildable and deployable with reproducible images,
  externalized state, configurable endpoints, and graceful shutdown. Workers must
  handle interruption without losing messages or committing partial effects.
- When adding Kubernetes support, define resource requests and limits,
  configuration, secrets, and persistent storage or managed data services.
- Choose startup, readiness, and liveness probes for their distinct purposes.
  Readiness controls traffic; liveness detects a stuck process. Dependency outages
  should not cause restart loops in otherwise healthy processes.
- Evolve schemas and contracts with rollout order in mind. Coordinate migrations
  before dependent workloads become ready. For migration or message-processing
  changes, also follow [the testing guide](testing.md).

## Workload selection

| Workload | Typical Kubernetes resource |
| --- | --- |
| HTTP API | Deployment |
| Continuous RabbitMQ consumer or outbox publisher | Deployment |
| Finite migration or batch task | Job |
| Scheduled finite task | CronJob |

Make finite tasks safe to retry, with explicit completion criteria, failures,
deadlines, and exit codes. Use the same distinction between continuous services
and finite tasks when choosing a cloud hosting model.

## Public cloud exposure

The current APIs lack authentication. Before exposing customer orders publicly,
add authentication, ownership checks, TLS, and appropriate network restrictions.
A caller-supplied `customer_id` is not proof of ownership. Use the configuration
and secret-management rules in [the root instructions](../AGENTS.md).

## Experiments and verification

- Define a hypothesis, workload, baseline, success criteria, and observable
  metrics before scalability or resilience experiments. Compare measured results
  rather than assuming additional replicas improve performance.
- Support diagnosis with structured logs, correlation IDs, and relevant health
  and processing metrics. Observe pending operations, retries, and recovery during
  dependency failures where relevant.
- Validate configuration and runtime behavior using the tools appropriate to the
  deployment target. Exercise startup, readiness, shutdown, and retry behavior
  affected by the change; application-level failing tests are unnecessary when
  configuration or runtime checks provide the relevant evidence.
- For Compose changes, use [the integration verification procedure](testing.md#integration-verification).
- Document reproduction steps, results, limitations, resource cleanup, and cloud
  cost implications. Separate proposed capabilities from verified deployments.
