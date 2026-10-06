# Order management implementation tickets

- Epic: ORD-EPIC — Complete order lifecycle and CRUD support
- Status: Draft backlog; no external tracker issues have been created.
- Source: [SPEC-ORD-001](../specs/order-management.md)
- Product assumptions: optional editable drafts, submitted contents immutable,
  cancellation restores stock asynchronously, deletion is soft deletion.
- All tickets: Open; unassigned; implementation has not started.

The ORD identifiers below are local ticket IDs. Acceptance criteria refer to the
source spec's requirement and scenario IDs, which define the detailed contract.
Product review of the proposed choices should precede implementation.

| Ticket | Title | Priority | Depends on |
| --- | --- | --- | --- |
| ORD-101 | Extend lifecycle models and migrate storage | High | Product review |
| ORD-102 | List orders with filtering and cursor pagination | Medium | ORD-101 |
| ORD-103 | Create, edit, and submit draft orders | High | ORD-101 |
| ORD-104 | Release inventory safely and prevent stock deletion races | High | ORD-101 |
| ORD-105 | Cancel orders and apply release acknowledgements | High | ORD-104 |
| ORD-106 | Soft-delete inactive orders | Medium | ORD-101, ORD-105 |
| ORD-107 | Expose order-management routes through the gateway | High | ORD-102, ORD-103, ORD-105, ORD-106 |
| ORD-108 | Verify lifecycle end to end and document recovery | High | ORD-107 |

## ORD-101 — Extend lifecycle models and migrate storage

**Outcome:** Order and Inventory can persist the new lifecycle without breaking
existing pending, confirmed, rejected, or reserved records.

**Scope:** Order/Inventory models and Alembic migrations. Add Order statuses
`draft`, `cancelling`, `cancelled` and internal nullable `deleted_at`. Add Inventory
reservation state `released` and support release-before-reserve tombstones.
Keep existing response fields and enforce database state constraints.

**Acceptance criteria:**

- Fresh and populated databases upgrade successfully; historical data and
  existing create/read responses remain valid (ORD-01, ORD-03, ORD-10, AC-01).
- New statuses are valid in Pydantic/OpenAPI and PostgreSQL; invalid states fail.
- A released tombstone without prior request items can be stored without deleting
  reservation, inbox, or outbox history.
- Document rollback limitations when records use new lifecycle states.

**Verification:** Migration tests against real PostgreSQL for empty and populated
databases; response-model checks for new and existing statuses.

## ORD-102 — List orders with filtering and cursor pagination

**Outcome:** Clients can browse orders instead of knowing every order ID.

**Scope:** `GET /orders`; implement the exact list response, customer/status
filters, bounded limit, stable sort, and filter-bound cursors from ORD-02. Exclude
soft-deleted orders. Add query indexes where justified by the access pattern.

**Acceptance criteria:**

- Default limit 20; explicit limits 1-100; descending `created_at, id` ordering.
- Customer and status filters combine correctly and remain applied across pages.
- Empty results use an empty orders array and null next cursor.
- Equal creation timestamps paginate correctly; unchanged data has no page overlap.
- Invalid/mismatched cursors, status values, and limits return 422 (AC-02, AC-13).

**Verification:** HTTP contract tests and PostgreSQL pagination tests with equal
timestamps, multiple customers/states, and deleted records.

## ORD-103 — Create, edit, and submit draft orders

**Outcome:** Customers can change items before committing a stock reservation.

**Scope:** `POST /orders/drafts`, `PUT /orders/{order_id}`, and
`POST /orders/{order_id}/submit`. Reuse validated creation fields; atomically lock,
submit, and enqueue the existing reservation command. Preserve immediate
submission through `POST /orders`.

**Acceptance criteria:**

- Creating/editing drafts changes no stock and writes no reservation command.
- PUT replaces draft contents only; unexpected/server-managed fields are rejected.
- Submitted-order edits return 409; invalid requests return 422 without writes.
- Submission returns 202 and Location; retries create no duplicate commands.
- Concurrent edit/submit and submit/submit produce one consistent item snapshot.
- Missing/deleted orders return 404; terminal submission follows ORD-06.
- Meets ORD-04 through ORD-06 and AC-01, AC-03, AC-04, AC-13 through AC-15.

**Verification:** API tests and real PostgreSQL transaction/concurrency tests.

## ORD-104 — Release inventory safely and prevent stock deletion races

**Outcome:** Cancellation returns reserved stock once, even with delayed,
duplicated, reordered, or concurrent commands.

**Scope:** Add `inventory.release.requested` consumer/topology and
`inventory.released` result publication, including durable retry/dead-letter
queues and Compose worker configuration. Extend reservation processing for
released tombstones and replay. Protect Inventory DELETE while stock is reserved.

**Acceptance criteria:**

- Reserved quantities are restored atomically with reservation state, inbox, and
  result outbox; release of rejected/absent reservations adds no stock.
- Release-before-reserve creates a tombstone; a later reserve cannot deduct stock.
- Per-order serialization protects concurrent first commands with no existing row.
- Same/new message-ID replays never increase stock twice; acknowledgement can be
  re-emitted for an already released order.
- Released orders never re-emit reserved/rejected as the current replay outcome.
- Stock DELETE returns 409 for active reservations, including concurrent races.
  Release adds to current available stock; missing legacy stock rows fail visibly.
- Meets ORD-09/ORD-10 and AC-05 through AC-09, AC-11, AC-12.

**Verification:** Real PostgreSQL reserve/release/delete concurrency tests, worker
replay and rollback tests, and RabbitMQ topology/retry checks.

## ORD-105 — Cancel orders and apply release acknowledgements

**Outcome:** Customers can cancel pending or confirmed orders and poll until stock
release completes.

**Scope:** `POST /orders/{order_id}/cancel`; atomically store `cancelling` and a
release outbox command; consume `inventory.released`. Extend result parsing,
queue bindings, retry routing, and state transition handling.

**Acceptance criteria:**

- Pending/confirmed cancellation returns 202 with Location and one release command.
- Repeated cancelling requests return 202 without additional commands; cancelled
  returns 200 without changes; draft cancellation is synchronous and sends no message.
- Rejected orders return 409; missing/deleted orders 404; nonempty body 422.
- Release acknowledgement transitions cancelling to cancelled; reserved/rejected
  results cannot overwrite cancellation. Duplicate terminal results are harmless.
- Outage or exhausted retries leave the order cancelling, with recoverable messages.
- Meets ORD-07, ORD-09/ORD-10 and AC-05 through AC-09, AC-11.

**Verification:** HTTP state-matrix tests, deterministic result-order/replay tests,
and PostgreSQL cancellation/result transaction races and rollback tests.

## ORD-106 — Soft-delete inactive orders

**Outcome:** Clients can remove inactive orders without losing stock or message
processing history.

**Scope:** `DELETE /orders/{order_id}`; lock/check lifecycle and set `deleted_at`.
Apply visibility checks consistently to listing, retrieval, edits, submission,
and cancellation while retaining worker access to stored records.

**Acceptance criteria:**

- Draft, rejected, and cancelled orders can be deleted; active orders return 409.
- Success/repeated deletion returns an empty 204; unknown UUID returns 404.
- Deleted orders are hidden from every public read/mutation route.
- Deletion creates no stock messages and does not purge inbox/outbox/reservations.
- Concurrent submission/cancellation/deletion respects eligibility atomically.
- Meets ORD-03, ORD-08 and AC-04, AC-10.

**Verification:** API visibility/state tests, PostgreSQL races, and delayed-message
processing against retained records.

## ORD-107 — Expose order-management routes through the gateway

**Outcome:** Every specified order endpoint works through the public entry point.

**Scope:** Add collection GET, order PUT/DELETE, draft POST, submit POST, and
cancel POST routing. Prefer explicit method/path contracts. Preserve request
bodies, query parameters, upstream status/body, content type, and Location.

**Acceptance criteria:**

- All routes in SPEC-ORD-001 reach the expected Order endpoint unchanged.
- Draft route precedence does not conflict with UUID retrieval.
- 201/202/204, 404/409/422 and Location survive proxying; 204 has no body.
- Existing Catalog/Inventory routing remains valid; unavailable upstream is 502.
- Tests cover filtered/cursor GET and each newly supported mutation.

**Verification:** Extend gateway routing/forwarding tests and smoke-check the
public routes against the Compose stack.

## ORD-108 — Verify lifecycle end to end and document recovery

**Outcome:** The full stack demonstrably completes order CRUD and cancellation,
and stalled cancellations have a documented recovery procedure.

**Scope:** Extend `scripts/e2e.py` or add isolated acceptance tests with dedicated
stock/order fixtures. Update root and service READMEs with route examples,
lifecycle polling, deletion semantics, message topology, and recovery steps.

**Acceptance criteria:**

- All AC-01 through AC-15 have traceable verification; existing reservation
  success/rejection/competing-order behavior remains covered.
- Through port 8000: create/edit/submit draft, list/filter/page, cancel confirmed
  and pending orders, observe exact stock restoration, and soft-delete.
- Exercise both reserve/release arrival orders and replay with same/new message IDs.
- Inject broker/worker outage and recover; distinguish accepted cancellation from
  completed cancellation. Exhausted retries remain cancelling, not falsely successful.
- Recovery documentation explains locating correlated DLQ/outbox messages,
  fixing the underlying cause, and replaying without directly forcing order state
  or manually incrementing stock. Include the legacy missing-stock-row case.
- Fixtures do not depend on mutable seeded inventory or repeated-run assumptions.

**Verification:** Run the existing service/gateway suites, migration/concurrency
tests, worker tests, and Compose acceptance flow. Record commands and results.
