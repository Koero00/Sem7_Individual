# Catalog service

The catalog service is a FastAPI application backed by PostgreSQL 17. Prices are
stored as integer cents. By default, the application connects to the local
database from `docker-compose.yml`; set `DATABASE_URL` to use another database.

## Run locally

Start PostgreSQL:

```powershell
docker compose up -d
```

Start the API on the port expected by the gateway:

```powershell
uv run uvicorn main:app --reload --port 8001
```

Interactive API documentation is available at `http://localhost:8001/docs`.

## Product API

| Method | URL | Purpose |
| --- | --- | --- |
| `POST` | `/products` | Create a product |
| `GET` | `/products` | List all products |
| `GET` | `/products/{id}` | Retrieve one product |
| `PUT` | `/products/{id}` | Replace one product |
| `DELETE` | `/products/{id}` | Delete one product |

Example request body:

```json
{
  "name": "Appel",
  "description": "Een heerlijke appel",
  "price": 100,
  "image_url": "https://example.com/apple.jpg"
}
```

The `id` field is optional when creating a product. The service generates a UUID
when it is omitted.
