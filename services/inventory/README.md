# Inventory service

A small FastAPI service that stores the available quantity for each product in
its own PostgreSQL database.

The reservation consumer also receives durable RabbitMQ commands from Order.
It locks all requested stock rows and either reserves the complete order or
rejects it without changing stock. Reservation outcomes are published through
a transactional outbox.

## Run locally

Start PostgreSQL:

```powershell
docker compose up -d
```

Install the Python dependencies and start the API:

```powershell
uv sync --dev
uv run uvicorn main:app --reload --port 8003
```

The interactive API documentation is available at `http://localhost:8003/docs`.

Set `DATABASE_URL` to use a different PostgreSQL connection. The default is
`postgresql://inventory:inventory@localhost:5433/inventory`.

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/inventory` | List all stock records |
| `GET` | `/inventory/{product_id}` | Get one stock record |
| `POST` | `/inventory` | Create a stock record |
| `PUT` | `/inventory/{product_id}` | Replace its quantity |
| `DELETE` | `/inventory/{product_id}` | Delete a stock record |

Example request body for `POST /inventory`:

```json
{
  "product_id": "4",
  "quantity": 10
}
```

Example request body for `PUT /inventory/4`:

```json
{
  "quantity": 15
}
```

Quantities must be zero or greater. Creating the same `product_id` twice
returns HTTP 409, while reading, updating, or deleting an unknown product
returns HTTP 404.

## Tests

```powershell
uv run pytest
```
