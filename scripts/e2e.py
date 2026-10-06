import json
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

BASE_URL = "http://localhost:8000"


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


def create_order(quantity: int, product_id: str = "1"):
    status, headers, order = request(
        "POST",
        "/orders",
        {
            "customer_id": "ci-customer",
            "items": [{"product_id": product_id, "quantity": quantity}],
        },
    )
    assert status == 202, order
    assert order["status"] == "pending", order
    assert headers["location"] == f"/orders/{order['id']}"
    return order["id"]


def wait_for_status(order_id: str, expected: str, timeout: float = 60):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        status, _, order = request("GET", f"/orders/{order_id}")
        assert status == 200, order
        if order["status"] == expected:
            return order
        time.sleep(0.5)
    raise TimeoutError(f"Order {order_id} did not become {expected}")


def wait_for_terminal(order_id: str, timeout: float = 60):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        status, _, order = request("GET", f"/orders/{order_id}")
        assert status == 200, order
        if order["status"] in {"confirmed", "rejected"}:
            return order
        time.sleep(0.5)
    raise TimeoutError(f"Order {order_id} did not reach a terminal state")


confirmed = wait_for_status(create_order(2), "confirmed")
rejected = wait_for_status(create_order(100_000), "rejected")
assert rejected["rejection_reason"] == "insufficient_stock", rejected

# Two orders compete for the final 20 units of product 3. Exactly one may win.
competing_order_ids = [create_order(15, "3"), create_order(15, "3")]
competing_orders = [wait_for_terminal(order_id) for order_id in competing_order_ids]
assert sorted(order["status"] for order in competing_orders) == [
    "confirmed",
    "rejected",
]
print(
    json.dumps(
        {
            "confirmed_order": confirmed["id"],
            "rejected_order": rejected["id"],
            "competing_orders": [order["id"] for order in competing_orders],
        }
    )
)
