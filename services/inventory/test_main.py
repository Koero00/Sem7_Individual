from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient


class FakeUniqueViolation(Exception):
    pass


import main
from database import get_connection
from main import app

main.errors.UniqueViolation = FakeUniqueViolation


SAMPLE_ITEM = {"product_id": "product-1", "quantity": 12}


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


def test_list_inventory(client, database_connection):
    database_result(database_connection, all=[SAMPLE_ITEM])
    response = client.get("/inventory")
    assert response.status_code == 200
    assert response.json() == [SAMPLE_ITEM]


def test_get_inventory_item(client, database_connection):
    database_result(database_connection, one=SAMPLE_ITEM)
    response = client.get("/inventory/product-1")
    assert response.status_code == 200
    assert response.json() == SAMPLE_ITEM


def test_get_missing_inventory_item_returns_404(client, database_connection):
    database_result(database_connection, one=None)
    response = client.get("/inventory/missing")
    assert response.status_code == 404
    assert response.json() == {"detail": "Inventory item not found"}


def test_create_inventory_item(client, database_connection):
    database_result(database_connection, one=SAMPLE_ITEM)
    response = client.post("/inventory", json=SAMPLE_ITEM)
    assert response.status_code == 201
    assert response.json() == SAMPLE_ITEM
    database_connection.commit.assert_called_once()


def test_create_inventory_item_rejects_negative_quantity(client, database_connection):
    response = client.post(
        "/inventory",
        json={"product_id": "product-1", "quantity": -1},
    )
    assert response.status_code == 422
    database_connection.execute.assert_not_called()


def test_create_inventory_item_returns_conflict_for_duplicate(
    client,
    database_connection,
):
    database_connection.execute.side_effect = FakeUniqueViolation()
    response = client.post("/inventory", json=SAMPLE_ITEM)
    assert response.status_code == 409
    assert response.json() == {"detail": "Inventory item already exists"}
    database_connection.rollback.assert_called_once()


def test_update_inventory_item(client, database_connection):
    updated_item = {**SAMPLE_ITEM, "quantity": 20}
    database_result(database_connection, one=updated_item)
    response = client.put("/inventory/product-1", json={"quantity": 20})
    assert response.status_code == 200
    assert response.json() == updated_item
    database_connection.commit.assert_called_once()


def test_update_missing_inventory_item_returns_404(client, database_connection):
    database_result(database_connection, one=None)
    response = client.put("/inventory/missing", json={"quantity": 20})
    assert response.status_code == 404
    assert response.json() == {"detail": "Inventory item not found"}


def test_delete_inventory_item(client, database_connection):
    database_result(database_connection, one={"product_id": "product-1"})
    response = client.delete("/inventory/product-1")
    assert response.status_code == 204
    assert response.content == b""
    database_connection.commit.assert_called_once()


def test_delete_missing_inventory_item_returns_404(client, database_connection):
    database_result(database_connection, one=None)
    response = client.delete("/inventory/missing")
    assert response.status_code == 404
    assert response.json() == {"detail": "Inventory item not found"}


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
