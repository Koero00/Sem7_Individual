# CloudProject

The webshop runs as a Docker Compose stack. Each application and database has
its own container:

- `api-gateway` exposes the public API on port `8000`.
- `catalog-frontend` serves the Next.js storefront on port `3000`.
- `catalog-service` runs on port `8001` and uses `catalog-database`.
- `inventory-service` runs on port `8003` and uses `inventory-database`.
- `order-service` runs on port `8004` and uses `order-database`.
- `rabbitmq` transports durable reservation commands and inventory result events.
- Dedicated Order and Inventory workers publish transactional outboxes and consume messages.

The gateway reaches the services over Compose's private network by service
name. PostgreSQL data is stored in the `catalog-data`, `inventory-data`, and `order-data`
volumes.

## Catalog frontend

The selected Cobalt quick-order design is implemented in
`frontend/catalog` using Next.js App Router, React, and TypeScript. It loads
products and availability through the existing gateway and submits real
orders, including pending, confirmed, and rejected reservation states.

Start the complete stack below and open `http://localhost:3000`. For frontend
development with the backend already running:

If the Compose frontend is already using port 3000, first run
`docker compose stop catalog-frontend` from this directory.

```powershell
cd frontend/catalog
npm ci
npm run dev
```

New databases start with 15 fictional electronics and matching stock. To replace
the original fruit samples and add the electronics in an existing development
database, run `npm run seed:electronics` from `frontend/catalog`. Customized
products and existing stock are preserved. See the [frontend guide](frontend/catalog/README.md)
for configuration, checks, and current limitations.

The earlier layout and color experiments remain in `frontend/catalog-prototype`
as design references. They use hardcoded data and simulated orders; they are not
the Next.js application.

## Start the complete stack

For the isolated Kubernetes experiment that scales Inventory reservation workers
from RabbitMQ queue depth, see the [KEDA experiment guide](k8s/keda/README.md).
The [real-order KEDA scenario](k8s/keda/orders/README.md) runs both APIs,
transactional outbox publishers, and KEDA-scaled reservation/result consumers.

From this directory, run:

```powershell
docker compose up --build -d
```

Wait until every container is healthy:

```powershell
docker compose ps
```

The Next.js server uses `http://localhost:8000` locally and
`http://api-gateway:8000` in Compose as its API base URL. Browser requests go
through the frontend's same-origin `/api` routes. The gateway's public routes include:

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

The [architecture decision index](docs/adr/README.md) also contains retrospective
drafts explaining the service boundaries, database ownership, API gateway, and
local development/CI environment. These records include the project author's
explanations and identify remaining review questions and verification gaps.

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
