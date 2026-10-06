from datetime import UTC, datetime
from unittest.mock import Mock
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from database import get_connection
from main import app

ORDER_ID = UUID("00000000-0000-0000-0000-000000000001")
ORDER_REQUEST = {
    "customer_id": "customer-1",
    "items": [{"product_id": "product-1", "quantity": 2}],
}
STORED_ORDER = {
    "id": ORDER_ID,
    **ORDER_REQUEST,
    "status": "pending",
    "rejection_reason": None,
    "rejection_details": None,
    "created_at": datetime(2026, 10, 5, tzinfo=UTC),
    "updated_at": datetime(2026, 10, 5, tzinfo=UTC),
}


@pytest.fixture
def connection():
    fake = Mock()
    app.dependency_overrides[get_connection] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)


def test_create_order_returns_generated_order(client, connection):
    connection.execute.return_value.fetchone.return_value = STORED_ORDER

    response = client.post("/orders", json=ORDER_REQUEST)

    assert response.status_code == 202
    assert response.json()["id"] == str(ORDER_ID)
    assert response.json()["items"] == ORDER_REQUEST["items"]
    assert response.json()["status"] == "pending"
    assert response.headers["location"] == f"/orders/{ORDER_ID}"
    assert connection.execute.call_count == 2
    connection.commit.assert_called_once()


def test_create_order_requires_positive_quantity(client, connection):
    response = client.post(
        "/orders",
        json={
            "customer_id": "customer-1",
            "items": [{"product_id": "product-1", "quantity": 0}],
        },
    )

    assert response.status_code == 422
    connection.execute.assert_not_called()


def test_get_order(client, connection):
    connection.execute.return_value.fetchone.return_value = STORED_ORDER

    response = client.get(f"/orders/{ORDER_ID}")

    assert response.status_code == 200
    assert response.json()["customer_id"] == "customer-1"


def test_get_missing_order_returns_404(client, connection):
    connection.execute.return_value.fetchone.return_value = None

    response = client.get(f"/orders/{ORDER_ID}")

    assert response.status_code == 404
    assert response.json() == {"detail": "Order not found"}
