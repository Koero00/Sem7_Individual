import sys
from types import ModuleType, SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient


# The test environment blocks Psycopg's native DLL. These minimal modules keep
# unit tests independent of the driver and the live PostgreSQL database.
class FakeUniqueViolation(Exception):
    pass


class FakeConnectionPool:
    def __init__(self, *args, **kwargs):
        pass

    def open(self):
        pass

    def close(self):
        pass


fake_psycopg = ModuleType("psycopg")
fake_psycopg.errors = SimpleNamespace(UniqueViolation=FakeUniqueViolation)
fake_psycopg_rows = ModuleType("psycopg.rows")
fake_psycopg_rows.dict_row = object()
fake_psycopg_pool = ModuleType("psycopg_pool")
fake_psycopg_pool.ConnectionPool = FakeConnectionPool
sys.modules["psycopg"] = fake_psycopg
sys.modules["psycopg.rows"] = fake_psycopg_rows
sys.modules["psycopg_pool"] = fake_psycopg_pool

from database import get_connection
from main import app

SAMPLE_PRODUCT = {
    "id": "product-1",
    "name": "Appel",
    "description": "Een heerlijke appel",
    "price": 100,
    "image_url": "https://example.com/apple.jpg",
}


@pytest.fixture
def database_connection():
    connection = Mock()
    app.dependency_overrides[get_connection] = lambda: connection
    yield connection
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)


def database_result(connection, *, one=None, all=None):
    cursor = connection.execute.return_value
    cursor.fetchone.return_value = one
    cursor.fetchall.return_value = all
    return cursor


def test_list_products(client, database_connection):
    database_result(database_connection, all=[SAMPLE_PRODUCT])

    response = client.get("/products")

    assert response.status_code == 200
    assert response.json() == [SAMPLE_PRODUCT]


def test_get_missing_product_returns_404(client, database_connection):
    database_result(database_connection, one=None)

    response = client.get("/products/missing")

    assert response.status_code == 404
    assert response.json() == {"detail": "Product not found"}


def test_create_product(client, database_connection):
    database_result(database_connection, one=SAMPLE_PRODUCT)

    response = client.post(
        "/products",
        json={key: value for key, value in SAMPLE_PRODUCT.items() if key != "id"},
    )

    assert response.status_code == 201
    assert response.json() == SAMPLE_PRODUCT
    database_connection.commit.assert_called_once()


def test_create_product_rejects_negative_price(client, database_connection):
    response = client.post(
        "/products",
        json={
            "name": "Appel",
            "description": "Een heerlijke appel",
            "price": -1,
        },
    )

    assert response.status_code == 422
    database_connection.execute.assert_not_called()


def test_create_product_returns_conflict_for_duplicate_id(client, database_connection):
    database_connection.execute.side_effect = FakeUniqueViolation()

    response = client.post("/products", json=SAMPLE_PRODUCT)

    assert response.status_code == 409
    assert response.json() == {"detail": "Product ID already exists"}
    database_connection.rollback.assert_called_once()


def test_update_product(client, database_connection):
    updated_product = {**SAMPLE_PRODUCT, "price": 125}
    database_result(database_connection, one=updated_product)

    response = client.put(
        "/products/product-1",
        json={key: value for key, value in updated_product.items() if key != "id"},
    )

    assert response.status_code == 200
    assert response.json() == updated_product
    database_connection.commit.assert_called_once()


def test_delete_product(client, database_connection):
    database_result(database_connection, one={"id": "product-1"})

    response = client.delete("/products/product-1")

    assert response.status_code == 204
    assert response.content == b""
    database_connection.commit.assert_called_once()


def test_delete_missing_product_returns_404(client, database_connection):
    database_result(database_connection, one=None)

    response = client.delete("/products/missing")

    assert response.status_code == 404
    assert response.json() == {"detail": "Product not found"}
