# CloudProject

The webshop runs as a Docker Compose stack. Each application and database has
its own container:

- `api-gateway` exposes the public API on port `8000`.
- `catalog-service` runs on port `8001` and uses `catalog-database`.
- `inventory-service` runs on port `8003` and uses `inventory-database`.
- `order-service` runs on port `8004` and uses `order-database`.
- `rabbitmq` transports durable reservation commands and inventory result events.
- Dedicated Order and Inventory workers publish transactional outboxes and consume messages.

The gateway reaches the services over Compose's private network by service
name. PostgreSQL data is stored in the `catalog-data`, `inventory-data`, and `order-data`
volumes.

## Catalog frontend prototypes

Three local ordering designs are available in `frontend/catalog-prototype`:
an illustrated storefront, a quick-order list, and a guided basket builder.
Option B is the preferred direction, now themed as an electronics store
with fictional phone, laptop, and mouse products.
From this checkout, run:

```powershell
node frontend/catalog-prototype/server.mjs
```

Open `http://localhost:5173/prototype/catalog?variant=B` and use the bottom
switcher to compare the three designs. They share an in-memory basket and
simulate checkout without sending real orders. See the
[prototype notes](frontend/catalog-prototype/README.md) for details.

## Start the complete stack

From this directory, run:

```powershell
docker compose up --build -d
```

Wait until every container is healthy:

```powershell
docker compose ps
```

The frontend should use `http://localhost:8000` as its API base URL. The public
routes include:

```text
GET http://localhost:8000/catalog/products
GET http://localhost:8000/inventory
POST http://localhost:8000/orders
GET http://localhost:8000/orders/{order_id}
```

For example, place an order with:

```json
{"customer_id":"customer-1","items":[{"product_id":"1","quantity":2}]}
```

The response includes an order ID to use in the GET route. This first iteration
returns `202 Accepted` with status `pending`. Inventory processes the reservation
asynchronously and the order eventually becomes `confirmed` or `rejected`. The
API has no authentication yet; see the [order service notes](services/order/README.md)
before exposing it publicly.

RabbitMQ's management interface is available at `http://localhost:15672` using
the local development credentials `webshop` / `webshop`. Production deployments
must supply credentials through their secret-management system.

The message flow and rationale are documented in the
[C4 container view](docs/c4-container.md) and
[ADR 001](docs/adr/001-rabbitmq-order-inventory.md).

Proposed order listing, draft editing, cancellation, and soft deletion are
specified in the [order management spec](docs/specs/order-management.md), with
an [implementation backlog](docs/tickets/order-management.md). These features
are planned and are not implemented yet.

The service ports remain published for local debugging:

```text
Catalog:   http://localhost:8001
Inventory: http://localhost:8003
Orders:    http://localhost:8004
Gateway:   http://localhost:8000
```

## Logs and shutdown

Follow all container logs:

```powershell
docker compose logs -f
```

Stop the stack without deleting database data:

```powershell
docker compose down
```

To deliberately delete the databases and recreate their seed data on the next
start, run `docker compose down --volumes`.
