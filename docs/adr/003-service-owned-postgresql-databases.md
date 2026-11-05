# ADR 003: Give each service its own PostgreSQL database

- Status: Accepted; retrospective rationale confirmed by the project author
- Recorded: 2026-10-09
- Basis: Implementation evidence and the project author's explanation on 2026-10-09

## Context

The services persist product information, stock, orders, reservations, and message
processing state. Order creation must save both the pending order and its outgoing
reservation command. Inventory must apply an all-or-nothing reservation together
with its processing record and outgoing result. These operations require reliable
transaction boundaries, even though the services communicate asynchronously.

## Decision observed in the implementation

Each service owns a separate PostgreSQL database. The local Compose stack runs
three PostgreSQL containers with separate users and persistent volumes. Application
code connects to its service's database through Psycopg and uses explicit SQL.
References across services are identifiers rather than cross-database foreign keys.

Order and Inventory use local transactions to commit business changes together
with their transactional outbox/inbox data. Inventory locks stock rows while
checking and reserving quantities. The cross-service workflow is eventually
consistent through messaging, as described in [ADR 001](001-rabbitmq-order-inventory.md);
there is no transaction spanning Order and Inventory.

## Confirmed original rationale and alternatives

The project author chose PostgreSQL because of familiarity with Supabase and a
desire to gain more direct experience with PostgreSQL. SQLite and other databases
were possible alternatives, but no formal evaluation has been reported. This is
a familiarity and learning decision, not a claim that PostgreSQL won a benchmark.

Separate databases were deliberate: the author wanted to treat each service as
its own application, as if the three applications had been built by different
software companies. Each service therefore controls its own persistence rather
than depending on another service's tables. This describes the intended ownership
model; there are no actual separate suppliers or teams in this individual project.

PostgreSQL's transactions, constraints, row locking, and JSONB now support the
implemented reservation and messaging behavior. These are current technical
benefits, not the author's stated original reasons for selecting it.

A shared database would simplify joins and administration but weaken the intended
ownership boundary. Separate logical databases in one PostgreSQL instance could
retain ownership with fewer processes. The author confirmed database separation,
but has not established a requirement for separate production database instances.

## Consequences

- The databases need separate schema evolution, backups, and recovery planning.
  The local stack pays the resource cost of three database processes.
- There is no database constraint linking an Inventory product ID to Catalog.
  Cross-service validation and reconciliation require explicit application behavior.
- PostgreSQL-specific SQL, JSONB, migrations, and locking make replacement more
  involved than changing a connection string.
- Initial schemas and seed data use `db/init.sql`. Order and Inventory additionally
  use Alembic migrations; Catalog currently has no Alembic migration setup.

## Evidence and remaining deployment scope

See [Compose configuration](../../docker-compose.yml),
[Catalog database access](../../services/catalog/database.py),
[Order transaction](../../services/order/application.py),
[Inventory reservation transaction](../../services/inventory/reservation_handler.py),
and the [Order](../../services/order/migrations/versions/20261005_01_async_orders.py)
and [Inventory](../../services/inventory/migrations/versions/20261005_01_inventory_reservations.py)
migrations.

Three PostgreSQL containers are the current local implementation. Whether future
deployment also uses three physical database instances remains undecided by this
record; accepting service-owned databases does not decide that topology.
