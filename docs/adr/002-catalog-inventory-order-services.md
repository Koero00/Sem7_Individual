# ADR 002: Separate Catalog, Inventory, and Order services

- Status: Proposed; architecture implemented, boundary rationale partially unresolved
- Recorded: 2026-10-09
- Basis: Implementation evidence and the project author's explanation on 2026-10-09

## Context

The webshop is an individual school project intended to demonstrate cloud-native
architecture, integration, quality validation, and reproducible operations.
Its current responsibilities are product information, available stock and
reservations, and order creation and outcomes. These responsibilities could live
in one application or in separately running services.

## Decision observed in the implementation

Catalog, Inventory, and Order run as separate applications in one repository.
Catalog manages product information and prices. Inventory manages stock and
reservation outcomes. Order stores customer references, requested items, and the
order lifecycle. Each service has its own application dependencies, Docker image
build, and database connection configuration.

The gateway routes client HTTP requests to these services. Order requests stock
reservation through RabbitMQ, as documented in [ADR 001](001-rabbitmq-order-inventory.md).
Product identifiers connect the services; Order does not read Catalog's or
Inventory's database directly. The current order model does not capture product
prices or implement payment processing.

## Confirmed original rationale and alternatives

Microservices were a school suggestion, not an explicit school requirement. The
project author chose this approach to become more familiar with the practice.
The service separation is therefore primarily a learning choice; no measured
traffic or production requirement has been provided to justify it.

The author considered one application with separate internal modules. Future
Kubernetes use was also mentioned, but it is unclear whether this motivated the
current service split or the modular alternative. Kubernetes use does not itself
require microservices; the intended relationship needs clarification.

The author's explanation of database ownership in
[ADR 003](003-service-owned-postgresql-databases.md) supports treating each service
as an independent application. It does not yet explain why product information
and stock specifically needed separate service boundaries. Combining Catalog and
Inventory remains a comparison point, not an alternative the author has reported
evaluating. No formal comparison or workload experiment has been reported.

## Consequences

- Changes spanning services require compatible HTTP or message contracts and
  integration verification. Separate processes add configuration and failure modes.
- Product creation/deletion and stock creation/deletion are separate operations.
  The code does not synchronize them automatically; Catalog existence and Inventory
  availability can disagree.
- Recombining the services would affect persistence, contracts, workers, tests,
  and deployment configuration, making the boundary costly to reverse.

## Evidence and question to resolve

See [project overview](../../README.md), [Compose configuration](../../docker-compose.yml),
the [Catalog API](../../services/catalog/main.py),
[Inventory API](../../services/inventory/main.py), and
[Order application](../../services/order/application.py).

Why was Catalog separated from Inventory? Did preparing for Kubernetes motivate
separate deployable services, or the alternative of one modular application?
Independent deployment and scaling remain goals rather than demonstrated
production outcomes.
