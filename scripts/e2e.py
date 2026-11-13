import json
import os
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

BASE_URL = os.getenv("E2E_GATEWAY_URL", "http://localhost:8000")


def request(method: str, path: str, payload=None):
    body = json.dumps(payload).encode() if payload is not None else None
    req = Request(
        f"{BASE_URL}{path}",
        data=body,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urlopen(req, timeout=10) as response:
            return (
                response.status,
                {key.lower(): value for key, value in response.headers.items()},
                json.load(response),
            )
    except HTTPError as exc:
        raise RuntimeError(f"{method} {path} failed with {exc.code}") from exc


def create_order(items):
    status, headers, order = request(
        "POST",
        "/orders",
        {
            "customer_id": "ci-customer",
            "items": items,
        },
    )
    assert status == 202, order
    assert order["status"] == "pending", order
    assert headers["location"] == f"/orders/{order['id']}"
    return order["id"]


def wait_for_terminal(order_id: str, timeout: float = 60):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        status, _, order = request("GET", f"/orders/{order_id}")
        assert status == 200, order
        if order["status"] in {"confirmed", "rejected"}:
            return order
        time.sleep(0.5)
    raise TimeoutError(f"Order {order_id} did not reach a terminal state")


def order_item(product_id: str, quantity: int):
    return {"product_id": product_id, "quantity": quantity}


def seed_stock(product_id: str, quantity: int):
    status, _, stock = request("POST", "/inventory", order_item(product_id, quantity))
    assert status == 201, stock
    return product_id


def stock_quantity(product_id: str):
    status, _, stock = request("GET", f"/inventory/{product_id}")
    assert status == 200, stock
    return stock["quantity"]


def main():
    run_id = uuid4()
    stocked = seed_stock(f"ci-{run_id}-a", 10)
    limited = seed_stock(f"ci-{run_id}-b", 1)
    competing = seed_stock(f"ci-{run_id}-c", 20)

    confirmed = wait_for_terminal(create_order([order_item(stocked, 2)]))
    assert confirmed["status"] == "confirmed", confirmed
    assert stock_quantity(stocked) == 8

    rejected = wait_for_terminal(
        create_order([order_item(stocked, 3), order_item(limited, 2)])
    )
    assert rejected["status"] == "rejected", rejected
    assert rejected["rejection_reason"] == "insufficient_stock", rejected
    assert stock_quantity(stocked) == 8
    assert stock_quantity(limited) == 1

    competing_ids = [create_order([order_item(competing, 15)]) for _ in range(2)]
    competing_orders = [wait_for_terminal(order_id) for order_id in competing_ids]
    assert sorted(order["status"] for order in competing_orders) == [
        "confirmed",
        "rejected",
    ]
    assert stock_quantity(competing) == 5
    print("Order confirmation, all-or-nothing reservation and stock competition passed")


if __name__ == "__main__":
    main()
