# Testing and integration guide

Use this guide when adding or changing tests, persistence, message processing,
or cross-service behavior. The TDD workflow and service-level commands are in
[the root instructions](../AGENTS.md).

## Choose the verification boundary

- Test behavior through HTTP endpoints, application interfaces, or message
  handlers. Prefer domain results and invariants over private methods, SQL text,
  or internal call counts. Derive expected results independently from requirements
  or worked examples rather than duplicating implementation logic.
- Keep unit tests deterministic and focused on business rules. Use contract tests
  for HTTP validation, status codes, response shapes, and versioned messages.
- Use real PostgreSQL integration tests for transactions, constraints, locking,
  migrations, and concurrency. Mocks cannot establish database guarantees.
- Cover relevant invalid inputs, partial failures, rollback, and recovery. Use
  bounded polling for asynchronous outcomes so failures have a clear deadline.
- Confirm a red test fails for the missing behavior; resolve import, fixture,
  and environment errors before treating its failure as evidence.

## Messaging correctness and recovery

Read [ADR 001](adr/001-rabbitmq-order-inventory.md) for the accepted reservation
flow and [the container view](c4-container.md) for process and data ownership.
Cancellation, reservation expiry, and stock release remain deferred decisions;
changes to those behaviors require an explicit architecture decision. Preserve
the accepted flow unless the task explicitly changes it. When modifying this
flow, implement and verify these guarantees:

- Business writes and outgoing messages commit atomically through transactional
  outboxes. Inbox deduplication and business-operation identity make effects
  idempotent under at-least-once delivery, including replay with a new message ID.
- Consumers acknowledge after committing effects. Publishers retain confirms;
  retry paths are bounded and exhausted or permanent failures reach dead-letter
  handling. Distinguish infrastructure errors, invalid messages, and legitimate
  business rejection.
- Inventory reserves every requested item or none. Verify competing reservations
  cannot oversell stock and failed transactions leave no partial reservation.
- Correlate results with the intended operation or reservation attempt. Verify
  late or out-of-order messages cannot overwrite a completed outcome.
- Infrastructure failures leave operations pending until a valid outcome arrives;
  a transport timeout is not a business rejection. Exercise a safe recovery path
  through replay, reconciliation, or documented operator intervention. Recovery
  must not duplicate reservations or incorrectly change a completed outcome.

## Schema and contract changes

Evolve HTTP APIs, event schemas, and database schemas with compatibility and
rollout order in mind. Add migrations for persisted databases; initialization SQL
alone does not upgrade existing data. Verify relevant existing records remain
valid, and producers and consumers remain compatible during the intended rollout.

## Before merging

Check that GitHub Actions shows a successful CI run for the current pull
request head commit. The [PR checklist](../.github/pull_request_template.md)
records this review. While the template is only on the development branch,
copy the checklist item into the PR manually.

## Integration verification

For service integration or container changes, validate the Compose configuration
from the repository root:

```powershell
docker compose config --quiet
```

Exercise the affected flow against a healthy isolated stack using
[the root README](../README.md) for startup instructions. Use disposable test
data because the checks write orders, inventory, and messages.

From the repository root:

```powershell
python scripts/e2e.py
Get-Content -Raw scripts/verify-reservation-redelivery.py |
  docker compose exec -T order-outbox-publisher python -
```

The API smoke test creates unique stock entries to verify confirmation, rejection
without partial reservations, and competing orders. The redelivery test republishes
an actual order command to RabbitMQ and checks the confirmed order and stock.

To exercise browser checkout against the same stack:

```powershell
npm --prefix frontend/catalog ci
npm --prefix frontend/catalog exec -- playwright install chromium
npm --prefix frontend/catalog run test:e2e
```

The browser test reserves one seeded Nova Phone. Set `E2E_GATEWAY_URL` or
`E2E_FRONTEND_URL` when the isolated stack is exposed on different host ports.

Add focused checks for behavior the smoke test does not cover. Report the
commands actually run, outcomes, pre-existing failures, and unavailable checks;
passing mocked tests alone is not evidence of end-to-end correctness.
