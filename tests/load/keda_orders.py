"""Verify actual orders complete through both KEDA-scaled RabbitMQ consumers."""

import json
import os
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen
from uuid import uuid4


def request_json(url: str, payload: dict | None = None) -> dict:
    body = None if payload is None else json.dumps(payload).encode()
    request = Request(url, data=body, headers={"Content-Type": "application/json"})
    with urlopen(request, timeout=15) as response:
        expected_status = 200 if payload is None else 201
        if url.endswith("/orders") and payload is not None:
            expected_status = 202
        if response.status != expected_status:
            raise RuntimeError(f"Unexpected HTTP {response.status} for {url}")
        return json.load(response)


def main() -> None:
    count = int(os.getenv("ORDER_COUNT", "1000"))
    if not 2 <= count <= 10000:
        raise ValueError("ORDER_COUNT must be between 2 and 10000")
    order_api = os.getenv("ORDER_API_URL", "http://order-service:8004").rstrip("/")
    inventory_api = os.getenv(
        "INVENTORY_API_URL", "http://inventory-service:8003"
    ).rstrip("/")
    run_id = str(uuid4())
    product_id = f"keda-{run_id}"
    initial_stock = count // 2
    request_json(
        f"{inventory_api}/inventory",
        {"product_id": product_id, "quantity": initial_stock},
    )
    print(
        f"Run {run_id}: {count} orders competing for {initial_stock} stock.",
        flush=True,
    )

    def create_order(_: int) -> str:
        order = request_json(
            f"{order_api}/orders",
            {
                "customer_id": f"keda-{run_id}",
                "items": [{"product_id": product_id, "quantity": 1}],
            },
        )
        if order["status"] != "pending":
            raise RuntimeError(f"New order was not pending: {order['id']}")
        return order["id"]

    started = time.monotonic()
    with ThreadPoolExecutor(max_workers=10) as executor:
        order_ids = list(executor.map(create_order, range(count)))
    if len(set(order_ids)) != count:
        raise RuntimeError("Order API returned duplicate IDs")
    print(f"Accepted {count} pending orders; awaiting final results.", flush=True)
    remaining = set(order_ids)
    outcomes = Counter()
    deadline = time.monotonic() + 300
    with ThreadPoolExecutor(max_workers=10) as executor:
        while remaining and time.monotonic() < deadline:
            for order in executor.map(
                lambda order_id: request_json(f"{order_api}/orders/{order_id}"),
                list(remaining),
            ):
                if order["status"] == "pending":
                    continue
                if order["status"] not in {"confirmed", "rejected"}:
                    raise RuntimeError(f"Unexpected order state: {order['status']}")
                if (
                    order["status"] == "rejected"
                    and order["rejection_reason"] != "insufficient_stock"
                ):
                    raise RuntimeError(f"Unexpected rejection: {order}")
                outcomes[order["status"]] += 1
                remaining.remove(order["id"])
            print(f"Outcomes: {dict(outcomes)}, pending={len(remaining)}", flush=True)
            if remaining:
                time.sleep(2)
    if remaining:
        raise TimeoutError(f"{len(remaining)} orders are still pending")
    stock = request_json(f"{inventory_api}/inventory/{product_id}")["quantity"]
    expected = Counter(confirmed=initial_stock, rejected=count - initial_stock)
    if outcomes != expected or stock != 0:
        raise RuntimeError(f"Incorrect stock/result counts: {outcomes}, stock={stock}")
    print(
        f"PASS: {count} real orders; {outcomes['confirmed']} confirmed, "
        f"{outcomes['rejected']} rejected; stock=0; "
        f"elapsed={time.monotonic() - started:.1f}s.",
        flush=True,
    )


if __name__ == "__main__":
    main()
