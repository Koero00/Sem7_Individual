"""Verify RabbitMQ redelivery from the Order publisher in an isolated stack."""

import json
import os
import time
from urllib.request import Request, urlopen
from uuid import uuid4

import psycopg
from messaging import (
    COMMAND_EXCHANGE,
    DEAD_LETTER_EXCHANGE,
    EVENT_EXCHANGE,
    open_connection,
    publish_json,
)

GATEWAY_URL = os.getenv("E2E_GATEWAY_URL", "http://api-gateway:8000")


def request(path, payload=None):
    body = json.dumps(payload).encode() if payload is not None else None
    headers = {"Content-Type": "application/json"} if body is not None else {}
    with urlopen(
        Request(f"{GATEWAY_URL}{path}", body, headers), timeout=10
    ) as response:
        return json.load(response)


def wait_for_confirmation(order_id):
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        order = request(f"/orders/{order_id}")
        if order["status"] == "confirmed":
            return
        assert order["status"] == "pending", order
        time.sleep(0.25)
    raise TimeoutError(f"Order {order_id} did not confirm")


def wait_for_replayed_result(channel, queue, order_id):
    deadline = time.monotonic() + 30
    for method, _, body in channel.consume(queue, auto_ack=True, inactivity_timeout=1):
        if body is not None and json.loads(body)["correlation_id"] == order_id:
            assert method.exchange == EVENT_EXCHANGE, "Reservation was dead-lettered"
            return
        if time.monotonic() >= deadline:
            break
    raise TimeoutError(
        f"Inventory did not replay the reservation result for {order_id}"
    )


def main():
    product_id = f"ci-{uuid4()}"
    request("/inventory", {"product_id": product_id, "quantity": 10})
    order = request(
        "/orders",
        {
            "customer_id": "ci-redelivery",
            "items": [{"product_id": product_id, "quantity": 2}],
        },
    )
    order_id = order["id"]
    wait_for_confirmation(order_id)
    assert request(f"/inventory/{product_id}")["quantity"] == 8

    with psycopg.connect(
        os.environ["DATABASE_URL"], options="-c default_transaction_read_only=on"
    ) as connection:
        routing_key, reservation = connection.execute(
            "SELECT routing_key, payload FROM outbox_messages WHERE aggregate_id = %s",
            (order_id,),
        ).fetchone()

    with open_connection() as rabbit:
        channel = rabbit.channel()
        channel.confirm_delivery()
        queue = channel.queue_declare(queue="", exclusive=True).method.queue
        channel.queue_bind(queue, EVENT_EXCHANGE, "inventory.reserved.v1")
        channel.queue_bind(queue, DEAD_LETTER_EXCHANGE, "inventory.reserve.dead.v1")

        publish_json(
            channel,
            exchange=COMMAND_EXCHANGE,
            routing_key=routing_key,
            payload=reservation,
        )
        # A fresh message ID for the same order follows the original on the same
        # queue. Its replayed result proves the single worker reached both messages.
        publish_json(
            channel,
            exchange=COMMAND_EXCHANGE,
            routing_key=routing_key,
            payload={**reservation, "message_id": str(uuid4())},
        )
        wait_for_replayed_result(channel, queue, order_id)

    assert request(f"/inventory/{product_id}")["quantity"] == 8
    assert request(f"/orders/{order_id}")["status"] == "confirmed"
    print("RabbitMQ redelivery left the confirmed order and stock unchanged")


if __name__ == "__main__":
    main()
