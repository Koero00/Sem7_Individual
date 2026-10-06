import os

import httpx
import uvicorn
from fastapi import FastAPI, Request, Response, status

app = FastAPI(
    title="Webshop API Gateway",
    description="Routes public API requests to the webshop microservices.",
)

UPSTREAM_URLS = {
    "catalog": os.getenv("CATALOG_SERVICE_URL", "http://localhost:8001"),
    "inventory": os.getenv("INVENTORY_SERVICE_URL", "http://localhost:8003"),
    "order": os.getenv("ORDER_SERVICE_URL", "http://localhost:8004"),
}

ROUTED_METHODS = ["GET", "POST", "PUT", "DELETE"]
REQUEST_HEADERS_TO_SKIP = {"content-length", "host"}
RESPONSE_HEADERS_TO_FORWARD = {"content-type", "location"}


@app.get("/")
async def root():
    return {"message": "Webshop API Gateway"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


async def forward_request(
    request: Request,
    service: str,
    upstream_path: str | None = None,
) -> Response:
    """Forward an incoming request and return the upstream response unchanged."""
    upstream_url = f"{UPSTREAM_URLS[service]}{upstream_path or request.url.path}"
    headers = {
        name: value
        for name, value in request.headers.items()
        if name.lower() not in REQUEST_HEADERS_TO_SKIP
    }

    try:
        async with httpx.AsyncClient() as client:
            upstream_response = await client.request(
                method=request.method,
                url=upstream_url,
                params=request.query_params,
                content=await request.body(),
                headers=headers,
            )
    except httpx.RequestError:
        return Response(
            content='{"detail":"Service unavailable"}',
            status_code=status.HTTP_502_BAD_GATEWAY,
            media_type="application/json",
        )

    response_headers = {
        name: value
        for name, value in upstream_response.headers.items()
        if name.lower() in RESPONSE_HEADERS_TO_FORWARD
    }
    return Response(
        content=upstream_response.content,
        status_code=upstream_response.status_code,
        headers=response_headers,
    )


@app.api_route("/catalog/products", methods=ROUTED_METHODS)
@app.api_route("/catalog/products/{path:path}", methods=ROUTED_METHODS)
async def catalog_router(request: Request, path: str = ""):
    suffix = f"/{path}" if path else ""
    return await forward_request(request, "catalog", f"/products{suffix}")


@app.api_route("/inventory", methods=ROUTED_METHODS)
@app.api_route("/inventory/{path:path}", methods=ROUTED_METHODS)
async def inventory_router(request: Request, path: str = ""):
    return await forward_request(request, "inventory")


@app.api_route("/orders", methods=["POST"])
@app.api_route("/orders/{path:path}", methods=["GET"])
async def order_router(request: Request, path: str = ""):
    return await forward_request(request, "order")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
