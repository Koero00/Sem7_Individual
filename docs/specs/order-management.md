# Order management specification

- Spec ID: SPEC-ORD-001
- Status: Proposed; product choices below are assumptions for review, not approved requirements.
- Date: 2026-10-07
- Implementation status: Not implemented.
- Backlog: [Order management tickets](../tickets/order-management.md)

## Goal and current behavior

Customers should be able to list their orders, prepare and edit an order before
submission, cancel a submitted order, and remove inactive orders from their view.
Cancellation must restore reserved stock exactly once.

Today, `POST /orders` saves a `pending` order and an inventory reservation command
in one transaction, returning `202 Accepted`. Inventory asynchronously reserves
all items or rejects the order; Order applies the result as `confirmed` or
`rejected`. `GET /orders/{order_id}` retrieves an individual order. Listing,
editing, cancellation, and deletion are absent. The gateway currently forwards
only order creation and individual reads. See [ADR 001](../adr/001-rabbitmq-order-inventory.md).

## Proposed product choices

1. Add an optional draft flow. Keep `POST /orders` as immediate submission for
   existing clients. New clients may create a draft, edit it, and submit it.
2. Only drafts may change customer ID or items. Once submitted, order contents are
   immutable. Changing submitted items means cancel the old order, wait for
   cancellation, then create another order with a new ID.
3. Allow cancellation of pending and confirmed orders. There is currently no
   payment or fulfillment stage restricting cancellation.
4. Interpret deletion as soft deletion of drafts, rejected orders, or cancelled
   orders. Keep records and message history for delayed-message processing.
5. Use cursor pagination and optional customer/status filters for listing.

If immediate submission without drafts is preferred, remove the draft routes and
draft-editing ticket; item changes would use cancellation and replacement only.

## Scope

In scope: order listing, draft CRUD, explicit submission, cancellation with stock
release, soft deletion, gateway routing, database migrations, message contracts,
and acceptance tests.

Out of scope: payment/refund handling, shipping, authentication and authorization,
reservation expiry, hard purge/retention policy, amendments to submitted items,
frontend screens, and idempotency keys for creating new orders.

The current API has no authentication. `customer_id` is a filter, not an ownership
check. These routes retain the existing local-development access model; a future
authorization feature must derive ownership from the authenticated caller.

## HTTP contract

All routes below are exposed through the gateway on port 8000 and directly by the
Order service on port 8004. Order IDs are UUIDs.

| Requirement | Method and route | Success | Behavior |
| --- | --- | --- | --- |
| ORD-01 | `POST /orders` | 202 | Existing behavior: create and submit a pending order. |
| ORD-02 | `GET /orders` | 200 | Return a filtered page of visible orders. |
| ORD-03 | `GET /orders/{order_id}` | 200 | Retrieve a visible order, including lifecycle status. |
| ORD-04 | `POST /orders/drafts` | 201 | Create a draft without requesting stock. |
| ORD-05 | `PUT /orders/{order_id}` | 200 | Replace the customer ID and items of a draft. |
| ORD-06 | `POST /orders/{order_id}/submit` | 202 | Submit a draft and atomically enqueue its reservation. |
| ORD-07 | `POST /orders/{order_id}/cancel` | 202 or 200 | Start asynchronous cancellation, or return an already cancelled order. |
| ORD-08 | `DELETE /orders/{order_id}` | 204 | Soft-delete an eligible inactive order. |

Create, draft creation, and draft replacement use the existing request shape:

```json
{
  "customer_id": "customer-1",
  "items": [{"product_id": "1", "quantity": 2}]
}
```

Preserve existing validation: nonempty customer ID and product IDs of at most
100 characters; at least one item; integer quantities of at least one. Drafts
must also contain a valid complete request. Repeated product IDs are aggregated
for stock calculations as they are today. Product availability is checked at
submission by Inventory, not when saving a draft.

Clients cannot write status, IDs, timestamps, deletion markers, or rejection
fields. Draft PUT accepts only the two request fields and rejects unexpected
fields with 422. It replaces the full request rather than partially patching it.
Submit and cancel require no request body; a nonempty body returns 422.

Responses retain the existing Order fields and add the `draft`, `cancelling`, and
`cancelled` status values. Soft-deletion markers remain internal. Creation and
submission/cancellation responses include `Location: /orders/{order_id}`.

### ORD-02: Listing

- Query parameters: optional `customer_id`, one optional `status`, `limit`
  (default 20, range 1-100), and optional opaque `cursor`.
- Sort by `created_at DESC, id DESC`; cursor pagination uses the last row's
  timestamp and ID. Status changes do not change sort position.
- Return `{"orders": [...], "next_cursor": "..."}`; use `null` when no next
  page exists. Empty matches return 200 with an empty list and a null cursor.
- Exclude deleted orders. A customer/status filter must apply to every page;
  cursors are bound to those filters. Invalid or mismatched cursors return 422.
- Pagination is a live view, not a database snapshot. Newly created orders appear
  when starting a fresh listing; status changes can change filtered membership.

### ORD-04 through ORD-06: Drafts and submission

- A draft does not reserve stock or create an inventory command.
- PUT is allowed only in `draft`; other visible states return 409 without changes.
- Submission locks the order, changes `draft` to `pending`, and writes the
  existing reservation command in the same transaction.
- Repeated submission of a `pending` or `confirmed` order returns its current
  resource with 202 or 200 respectively, without another command. Submission
  of `rejected`, `cancelling`, or `cancelled` orders returns 409.
- Concurrent editing/submission is serialized: submission uses the last committed
  draft contents, or the edit returns 409 after submission. Concurrent draft
  edits use last-committed-write wins; optimistic versioning is outside scope.
- Define static `/orders/drafts` before `/orders/{order_id}` to avoid UUID route
  conflicts.

### ORD-07: Cancellation

- A pending or confirmed order changes to `cancelling`, and a release command is
  stored in the same transaction. Return 202 and the current resource.
- A repeated request in `cancelling` returns 202 without another release command.
  A request in `cancelled` returns 200 without changing stock or timestamps.
- A draft can become `cancelled` immediately with 200, without messaging or stock
  changes. Cancellation of a rejected order returns 409; it can be deleted.
- Only an Inventory release acknowledgement makes a submitted order `cancelled`.
  Until then it remains `cancelling`, even if processing is unavailable or retries
  are exhausted. GET remains available for polling; no automatic timeout success.
- Existing reserve/reject results arriving after cancellation starts must not
  restore `confirmed` or `rejected`. They are acknowledged and deduplicated.

### ORD-08: Deletion and errors

- Soft deletion is allowed only in `draft`, `rejected`, or `cancelled`.
- Deleting `pending`, `confirmed`, or `cancelling` returns 409. The client must
  cancel and wait for completion first where applicable.
- Set `deleted_at` once. Return 204 with no response body. Repeated DELETE of
  that same stored record returns 204; an unknown UUID returns 404.
- Deleted orders return 404 from GET, PUT, submit, and cancel and disappear from
  listing. Message consumers may still find the retained record.
- Unknown orders return 404; malformed UUIDs and invalid inputs return 422.
  State conflicts return 409. Errors use FastAPI's `{"detail": "..."}` shape.
- State conflicts and validation failures leave stock, order data, and outboxes
  unchanged. Transaction failures roll back all writes.

## Lifecycle and stock invariants (ORD-09)

| Current state | Trigger | Next state | Stock effect |
| --- | --- | --- | --- |
| draft | Submit | pending | Reservation requested |
| pending | Inventory reserved | confirmed | Stock already deducted by Inventory |
| pending | Inventory rejected | rejected | No stock deducted |
| pending / confirmed | Cancel | cancelling | Release requested |
| cancelling | Inventory released | cancelled | Reserved stock restored, or no reservation existed |
| draft | Cancel | cancelled | None |
| draft / rejected / cancelled | Delete | Same state, hidden | None |

No client can set lifecycle state directly. A cancelled order cannot be reopened.
Rejected and cancelled orders may be replaced by creating a new order.

1. A successful reservation deducts each aggregated item quantity once.
2. A release restores the original reserved quantities once, never caller-supplied
   quantities. Releasing a rejected reservation has no stock effect.
3. Release arriving before reservation creates a durable released tombstone for
   that order. A later reserve command cannot deduct stock.
4. Concurrent first reserve/release commands must serialize on the order ID even
   when no reservation row exists. Inbox deduplication alone is insufficient.
5. Multi-item reserve/release updates, reservation state, inbox entry, and result
   outbox writes are atomic. Lock inventory rows in consistent product-ID order.
6. Do not physically delete inventory rows with active reserved quantities;
   Inventory DELETE must return 409 for such rows. Coordinate this check with
   reserve/release locking so concurrent deletion cannot bypass it.
7. Inventory PUT continues to set available quantity. Releasing an order adds its
   reserved quantity to the current available stock; it never restores an old
   absolute snapshot. Missing rows for legacy reservations fail processing and
   require recovery; do not silently acknowledge or recreate unknown stock.

## Messaging and storage (ORD-10)

Reuse the existing envelope, transactional outbox, processed-message inbox,
durable RabbitMQ delivery, publisher confirms, retries, and dead-letter handling.

| Message type | Routing key | Payload | Producer -> Consumer |
| --- | --- | --- | --- |
| `inventory.reserve.requested` | `inventory.reserve.requested.v1` | Existing order ID and items | Order -> Inventory |
| `inventory.release.requested` | `inventory.release.requested.v1` | `{"order_id": "<uuid>"}` | Order -> Inventory |
| `inventory.released` | `inventory.released.v1` | `{"order_id": "<uuid>"}` | Inventory -> Order |

All use schema version 1 and correlation ID equal to order ID. Inventory derives
release quantities from its stored reservation. Release of an unknown reservation
creates a tombstone with no request items; a later reserve validates its envelope
but emits a release acknowledgement without reserving. A rejected reservation
can become released without changing stock. Replayed reserve requests for a
released order must never re-emit a reserved/rejected result as its current outcome.

Duplicate message IDs cause no repeated business effects. New message IDs for a
previously released order may re-emit `inventory.released` through the outbox for
recovery, but never increase stock twice. Late reserved/rejected events cannot
overwrite cancelling/cancelled states. Release events affect only cancelling
orders; duplicates against cancelled orders are harmless, while impossible state
combinations follow permanent-error/dead-letter handling.

Order migrations add statuses and nullable `deleted_at`; Inventory migrations
add `released`, support tombstones without request items, and preserve reservation
history. Historical orders/reservations remain valid. Consumers retain access to
soft-deleted records, without making them visible through HTTP.

## Acceptance scenarios

| Scenario | Given / When | Expected result |
| --- | --- | --- |
| AC-01 Compatibility | Existing client calls POST /orders | 202, pending, one reservation command; existing GET contract preserved. |
| AC-02 Listing | Matching orders exceed page limit | Correct filters and descending stable order; no overlapping pages for unchanged data. |
| AC-03 Draft editing | Create draft, PUT new quantities, submit | No stock effect before submission; one command containing updated items. |
| AC-04 Conflicts | Edit submitted order; delete active order | 409; no writes or stock changes. |
| AC-05 Confirmed cancellation | Reserve 2 units, cancel, process release | cancelling then cancelled; stock increases by exactly 2. |
| AC-06 Pending cancellation | Release processed before reserve | Cancelled; late reserve never deducts stock. |
| AC-07 Reserve-first race | Reserve commits; cancellation and reserved event race | Eventually cancelled; exactly one release; late result never confirms it. |
| AC-08 Redelivery | Repeat HTTP cancel and replay release with same/new message IDs | No duplicate release command from HTTP; no duplicate stock increase. |
| AC-09 No stock held | Cancel draft or pending order whose reservation was rejected | Cancelled without increasing stock. Rejected order's cancel API returns 409. |
| AC-10 Soft deletion | Delete eligible order, repeat DELETE, then GET/list | 204, 204, then 404/excluded; retained messages still process safely. |
| AC-11 Failure recovery | Broker/database fails during cancellation; restart/replay | No partial writes; order stays cancelling until release acknowledgement; eventual recovery. |
| AC-12 Concurrent stock changes | Reserve/release, stock PUT, and stock DELETE compete | No overselling or duplicate release; active reservations block deletion. |
| AC-13 Invalid input | Invalid UUID, empty items, zero quantity, invalid cursor | 422; no persisted changes. |
| AC-14 Submission race | PUT/submit or two submits execute concurrently | One reservation with a consistent item snapshot; late PUT gets 409. |
| AC-15 Terminal submission | Submit confirmed/rejected/cancelling/cancelled orders | Confirmed returns 200 without command; remaining states return 409. |

Verification must include gateway HTTP checks, real PostgreSQL transaction and
concurrency tests, deterministic worker tests for both message orders and replay,
and Docker Compose end-to-end cancellation. Existing creation/reservation tests
must continue to pass. The tickets map these scenarios to implementation work.
