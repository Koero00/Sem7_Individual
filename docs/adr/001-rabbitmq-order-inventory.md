# ADR 001: Use RabbitMQ for asynchronous inventory reservation

- Status: Accepted
- Date: 2026-10-05
- Rationale reviewed with the project author: 2026-10-09

## Context

Order confirmation depends on Inventory accepting an all-or-nothing stock
reservation. A direct REST call couples order creation to Inventory availability
and does not buffer load when Inventory is temporarily unavailable.

## Decision

The Order service stores a pending order and a `ReserveInventory` command in one
PostgreSQL transaction. An outbox publisher sends that command through RabbitMQ.
Inventory consumes it idempotently, reserves every requested item or none, and
publishes a reserved or rejected result through its own transactional outbox.
Order consumes the result and moves the order to a terminal state.

RabbitMQ delivery is at least once. Durable exchanges and queues, persistent
messages, publisher confirms, and manual acknowledgements support reliable
delivery. Inbox deduplication and unique reservation constraints protect against
duplicate stock changes. These mechanisms do not guarantee automatic completion
of every order; failed messages can require recovery.

## Confirmed original rationale

The project author introduced queueing so Order requests could wait when Inventory
was offline or overloaded, allowing Inventory to process them later. The goal was
to decouple request acceptance from Inventory's immediate ability to process it.

RabbitMQ appeared to be the easiest approach for this project's scope. The author
also briefly looked at an Apache messaging service and judged it too complex for
the simplicity of the project. The exact Apache product has not been confirmed;
this was an informal comparison, not a benchmark or a demonstrated general
advantage of RabbitMQ over that product. Direct HTTP is a useful architectural
comparison, but the author has not reported evaluating it experimentally.

The author recalls pending orders and later confirmation as somewhat intentional,
but cannot confirm when that choice was made. The asynchronous behavior above is
implemented; its original design chronology remains uncertain.

## Consequences

- `POST /orders` returns `202 Accepted` with a pending order; clients poll the
  order resource for the terminal outcome.
- Orders can be accepted while RabbitMQ or Inventory is temporarily unavailable.
- Queueing buffers work but does not increase Inventory's processing capacity.
  Sustained overload still requires capacity or admission-control decisions.
- The system gains outbox relays, consumers, retry queues, dead-letter queues,
  migrations, and operational monitoring responsibilities.
- Cancellation, reservation expiry, and stock release are deferred. They require
  a separate compensating command rather than deleting reservation data.
