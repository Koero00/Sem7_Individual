from unittest.mock import AsyncMock, Mock

import httpx
import pytest
from fastapi.testclient import TestClient

import main
from main import app

client = TestClient(app)


@pytest.fixture
def upstream(monkeypatch):
    response = httpx.Response(
        200,
        json={"ok": True},
        headers={"content-type": "application/json"},
    )
    async_client = Mock()
    async_client.request = AsyncMock(return_value=response)
    context_manager = AsyncMock()
    context_manager.__aenter__.return_value = async_client
    monkeypatch.setattr(main.httpx, "AsyncClient", Mock(return_value=context_manager))
    return async_client


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Webshop API Gateway"}


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


@pytest.mark.parametrize(
    ("method", "path", "expected_url"),
    [
        ("GET", "/catalog/products", "http://localhost:8001/products"),
        (
            "GET",
            "/catalog/products/product-1",
            "http://localhost:8001/products/product-1",
        ),
        ("POST", "/catalog/products", "http://localhost:8001/products"),
        (
            "PUT",
            "/catalog/products/product-1",
            "http://localhost:8001/products/product-1",
        ),
        (
            "DELETE",
            "/catalog/products/product-1",
            "http://localhost:8001/products/product-1",
        ),
        ("GET", "/inventory", "http://localhost:8003/inventory"),
        ("GET", "/inventory/product-1", "http://localhost:8003/inventory/product-1"),
        ("POST", "/inventory", "http://localhost:8003/inventory"),
        ("PUT", "/inventory/product-1", "http://localhost:8003/inventory/product-1"),
        ("DELETE", "/inventory/product-1", "http://localhost:8003/inventory/product-1"),
        ("POST", "/orders", "http://localhost:8004/orders"),
        (
            "GET",
            "/orders/00000000-0000-0000-0000-000000000001",
            "http://localhost:8004/orders/00000000-0000-0000-0000-000000000001",
        ),
    ],
)
def test_routes_request_to_the_correct_service(method, path, expected_url, upstream):
    response = client.request(method, path, json={"value": 1})

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    call = upstream.request.await_args.kwargs
    assert call["method"] == method
    assert call["url"] == expected_url


def test_forwards_query_parameters_and_request_body(upstream):
    response = client.post(
        "/catalog/products?featured=true",
        json={"name": "Apple"},
    )

    assert response.status_code == 200
    call = upstream.request.await_args.kwargs
    assert str(call["params"]) == "featured=true"
    assert call["content"] == b'{"name":"Apple"}'


def test_preserves_upstream_status_and_response_body(upstream):
    upstream.request.return_value = httpx.Response(
        404,
        json={"detail": "Product not found"},
        headers={"content-type": "application/json"},
    )

    response = client.get("/catalog/products/missing")

    assert response.status_code == 404
    assert response.json() == {"detail": "Product not found"}


def test_returns_502_when_service_cannot_be_reached(upstream):
    upstream.request.side_effect = httpx.ConnectError("connection failed")

    response = client.get("/inventory")

    assert response.status_code == 502
    assert response.json() == {"detail": "Service unavailable"}
