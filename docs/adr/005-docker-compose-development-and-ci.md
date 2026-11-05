# ADR 005: Use Docker Compose for local development and complete-stack CI

- Status: Proposed; CI intent confirmed, Compose selection and deployment scope unresolved
- Recorded: 2026-10-09
- Basis: Implementation evidence and the project author's explanation on 2026-10-09

## Context

The webshop requires four HTTP applications, three databases, RabbitMQ, and
message workers. Testing an application in isolation cannot establish that
requests through the gateway lead to a persisted order and an Inventory outcome.
The school project's documented goals include reproducible delivery and
validation of functional and non-functional behavior.

## Decision observed in the implementation

The root Docker Compose file defines the complete local stack, its service
addresses, environment configuration, persistent volumes, and startup dependencies.
Order and Inventory migrations run as separate tasks before their APIs and workers
start. APIs and messaging workers run in separate containers; workers reuse their
own service's image and database.

GitHub Actions first runs dependency synchronization, Ruff checks, formatting
checks, and pytest for each application. A subsequent job builds and starts the
root Compose stack and runs `scripts/e2e.py` through the gateway. That script
checks confirmation, insufficient-stock rejection, and competing orders for
limited stock. Each application has its own `pyproject.toml` and committed
`uv.lock`; CI installs with `uv sync --locked --dev`.

## Confirmed CI rationale and intended coverage

The project author intended CI to automate linting, unit tests, integration tests,
and end-to-end tests. Starting the services and their dependencies together
supports checking the order flow across the application. The author now identifies
dedicated integration tests as missing and considers adding them essential.

This intended coverage is broader than the current implementation. Per-application
pytest suites and a complete-stack end-to-end script exist, but a dedicated
integration suite does not. The end-to-end script exercises service integration;
it does not replace focused checks of real database transactions, rollback, locking,
or broker interaction. Adding and running those checks in CI is outstanding work,
not an implemented consequence of updating this ADR.

## Compose rationale still to establish

Reusing one stack definition locally and in CI reduces service-wiring differences.
This is a technical benefit of the current setup, not yet the author's confirmed
reason for selecting Compose. The original Compose motivation, alternatives
considered, and intended deployment scope have not been supplied.

Manual dependency setup, local Kubernetes, and cloud-hosted integration environments
remain comparison points rather than documented past evaluations. No isolated-test
failure or experiment has been reported as the trigger for complete-stack CI.

## Consequences

- Development and complete-stack CI require Docker and enough resources for the
  full stack. Local named volumes retain data; CI removes volumes on teardown.
- End-to-end checks mutate inventory and depend on initial seed data. They need a
  disposable stack; rerunning against used volumes can invalidate expectations.
- Compose verifies local integration, not multi-host scheduling, autoscaling,
  production failover, or a cloud deployment. A production target remains a
  separate decision.
- Lockfiles constrain application dependencies, but container base images and
  infrastructure images use tags, so the environment is not fully immutable.
- The desired CI verification is incomplete until dedicated integration tests
  have been implemented and added to the pipeline.

## Evidence and question to resolve

See [Compose configuration](../../docker-compose.yml),
[CI workflow](../../.github/workflows/ci.yml),
[end-to-end checks](../../scripts/e2e.py), and the
[gateway image build](../../gateway/Dockerfile).

Was Compose selected as an interim environment before cloud deployment, or as
the intended environment for the current assessment? No production deployment
target should be inferred from this local setup.
