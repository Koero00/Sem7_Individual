# CloudProject

## Project context

CloudProject is a cloud-native webshop for an individual school project. It is
built as independently running services for product catalog, inventory, and
orders, with an API gateway as the public entry point. The current application
runs locally with Docker Compose.

Development should support the project's learning outcomes: explain architecture
choices, validate functional and non-functional behavior, and make delivery and
operations reproducible. Record meaningful architectural decisions in ADRs and
support changes with relevant verification.

## Architecture and repository layout

The stack uses Python 3.13, FastAPI, PostgreSQL, RabbitMQ, Docker Compose, and
GitHub Actions. Each application has its own `pyproject.toml` and `uv.lock`;
dependencies and development tools are managed with `uv`.

| Path | Responsibility |
| --- | --- |
| `gateway/` | Public HTTP API on port 8000; forwards requests to the services. |
| `services/catalog/` | Product catalog on port 8001; prices are integer cents. |
| `services/inventory/` | Stock management on port 8003 and asynchronous stock reservation. |
| `services/order/` | Order creation and retrieval on port 8004 and asynchronous order results. |
| `docker-compose.yml` | Complete local stack, databases, broker, migrations, and workers. |
| `scripts/e2e.py` | End-to-end checks of the asynchronous order flow. |
| `.github/workflows/ci.yml` | Per-application quality checks and complete-stack verification. |
| `docs/` | Architecture documentation, ADRs, and agent configuration. |

Each service owns its PostgreSQL database. The gateway uses HTTP to reach the
services. Order and Inventory communicate asynchronously through RabbitMQ and
dedicated workers.

## Order flow and architecture constraints

Read `docs/adr/001-rabbitmq-order-inventory.md` before changing order processing,
stock reservation, or messaging.

- Creating an order stores a `pending` order and a `ReserveInventory` command
  together in one database transaction. `POST /orders` returns `202 Accepted`.
- Inventory reserves all requested items or none, then publishes its outcome
  through a transactional outbox. Order consumes the result and becomes
  `confirmed` or `rejected`.
- RabbitMQ delivers messages at least once. Preserve inbox deduplication,
  idempotent processing, transaction boundaries, and unique reservation
  constraints so duplicate delivery cannot reserve stock twice.
- Temporary infrastructure failures leave orders pending for recovery.
  Cancellation, reservation expiry, and stock release are deferred decisions;
  changes to these behaviors need an explicit architecture decision.
- The current API has no authentication or order ownership checks. Account for
  this existing limitation when planning public deployment or access changes.

## Running and verifying changes

From the repository root, start the complete stack with
`docker compose up --build --detach --wait`. The public API is available at
`http://localhost:8000`. Use `docker compose ps` to inspect container health and
`docker compose logs` to inspect failures. Stop with `docker compose down`.
Adding `--volumes` deletes persisted database and broker data.

Run the following inside each affected application directory (`gateway/`,
`services/catalog/`, `services/inventory/`, or `services/order/`), matching CI:

```powershell
uv sync --locked --dev
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

For changes to integration or messaging behavior, also verify the complete stack
with `python scripts/e2e.py` from the repository root. This script creates orders
and changes inventory; use a disposable test stack with the expected seed data.

Keep service README files, API contracts, migrations, and architecture docs
consistent with behavior changes. Start with `README.md`, the affected service's
README, `docs/c4-container.md`, and relevant ADRs for further detail.

## Agent skills

### Issue tracker

Issues and specs are tracked in GitHub Issues for `Koero00/Sem7_Individual`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Use a single-context layout: root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.
