# ADR 001: Use RabbitMQ for asynchronous inventory reservation

- Status: Accepted
- Date: 2026-10-05

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
messages, publisher confirms, manual acknowledgements, inbox deduplication, and
unique reservation constraints prevent message loss and duplicate stock changes.

## Consequences

- `POST /orders` returns `202 Accepted` with a pending order; clients poll the
  order resource for the terminal outcome.
- Orders can be accepted while RabbitMQ or Inventory is temporarily unavailable.
- The system gains outbox relays, consumers, retry queues, dead-letter queues,
  migrations, and operational monitoring responsibilities.
- Cancellation, reservation expiry, and stock release are deferred. They require
  a separate compensating command rather than deleting reservation data.
