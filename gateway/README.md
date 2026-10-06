# API gateway

The gateway is the public entry point for the webshop APIs. It forwards catalog,
inventory, and order requests to their respective services while preserving request
bodies, query parameters, response bodies, and HTTP status codes.

## Run locally

Start the catalog service on port `8001`, inventory on `8003`, and orders on
`8004`, then run:

```powershell
uv run uvicorn main:app --reload --port 8000
```

The interactive API documentation is available at `http://localhost:8000/docs`.

## Routes

| Public route | Upstream service | Supported methods |
| --- | --- | --- |
| `/catalog/products` and `/catalog/products/{path}` | Catalog | GET, POST, PUT, DELETE |
| `/inventory` and `/inventory/{path}` | Inventory | GET, POST, PUT, DELETE |
| `/orders` | Orders | POST |
| `/orders/{id}` | Orders | GET |

The default service URLs can be overridden with `CATALOG_SERVICE_URL`,
`INVENTORY_SERVICE_URL`, and `ORDER_SERVICE_URL`.

The gateway exposes its own health endpoint at `GET /health`. If an upstream
service cannot be reached, the gateway returns HTTP 502.
