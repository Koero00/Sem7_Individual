# Architecture decision records

These records explain the webshop's architectural choices and their trade-offs.
ADR 001 already existed. ADRs 002-005 were reconstructed from the current
implementation and repository documentation on 2026-10-09.

The project author supplied retrospective explanations on the same date. The
records now distinguish those confirmed motivations from current technical
benefits, comparisons suggested during review, and unresolved points.

For the retrospective records, **Proposed** means the explanation is awaiting
review; the architecture described is already implemented. Code establishes what
the system does, but does not establish the original motivation or prove that
alternatives were evaluated. Confirmed motivations are attributed to the author;
unconfirmed explanations remain identified as such. Alternatives are not a history
of experiments unless an evaluation has actually been reported.
The recorded date is the documentation date, not the original decision date.

| ADR | Decision | Status |
| --- | --- | --- |
| [001](001-rabbitmq-order-inventory.md) | RabbitMQ for asynchronous inventory reservation | Accepted |
| [002](002-catalog-inventory-order-services.md) | Separate Catalog, Inventory, and Order services | Proposed; specific boundaries unresolved |
| [003](003-service-owned-postgresql-databases.md) | Service-owned PostgreSQL databases and local transactions | Accepted; retrospective rationale confirmed |
| [004](004-http-api-gateway.md) | A thin HTTP API gateway as the client entry point | Proposed; scalability goal needs detail |
| [005](005-docker-compose-development-and-ci.md) | Docker Compose for local development and complete-stack CI | Proposed; Compose rationale and deployment scope unresolved |

## Reviewing the retrospective records

Confirm whether each inferred reason matches the actual decision. Add any known
constraints, alternatives actually evaluated, and links to experiments or feedback.
If a reason is unknown, retain that uncertainty. After reviewing the explanation,
change its status to Accepted; acceptance of the record does not claim the choice
was made on its documentation date.

When an accepted decision changes, add a new ADR and mark the previous record
superseded with a link. Continue the existing three-digit numbering. Record
decisions that meaningfully affect boundaries, contracts, consistency, or
operations; individual implementation details do not all need an ADR.

The [order management specification](../specs/order-management.md) describes
planned work, including cancellation and stock release. It is not evidence that
those features are implemented. Future decisions worth recording include the
production deployment target, authentication and authorization, and the
cancellation/compensation model when those choices are made.
