"""Exercise the real reservation consumer in the isolated KEDA namespace."""

import argparse
import json
import os
import subprocess
import time
from datetime import UTC, datetime
from uuid import uuid4

import psycopg

from messaging import (
    COMMAND_EXCHANGE,
    RESERVE_DEAD_QUEUE,
    RESERVE_QUEUE,
    RESERVE_RETRY_QUEUE,
    RESERVE_ROUTING_KEY,
    declare_topology,
    open_connection,
    publish_json,
)


def setup() -> None:
    with psycopg.connect(os.environ["DATABASE_URL"]) as connection:
        connection.execute(
            """CREATE TABLE IF NOT EXISTS inventory (
                product_id TEXT PRIMARY KEY,
                quantity INTEGER NOT NULL CHECK (quantity >= 0)
            )"""
        )
    subprocess.run(["alembic", "upgrade", "head"], check=True)
    with open_connection() as rabbit:
        declare_topology(rabbit.channel())
    print("Schema migrated and durable reservation topology declared.", flush=True)


def publish() -> None:
    count = int(os.getenv("MESSAGE_COUNT", "10000"))
    if not 1 <= count <= 100000:
        raise ValueError("MESSAGE_COUNT must be between 1 and 100000")
    # The unique missing product identifies this run without consuming stock.
    product_id = f"keda-experiment-{uuid4()}"
    expected = {"product_id": product_id, "expected": count}
    print(json.dumps(expected), flush=True)
    with open_connection() as rabbit:
        channel = rabbit.channel()
        declare_topology(channel)
        channel.confirm_delivery()
        for index in range(count):
            order_id = uuid4()
            publish_json(
                channel,
                exchange=COMMAND_EXCHANGE,
                routing_key=RESERVE_ROUTING_KEY,
                payload={
                    "message_id": str(uuid4()),
                    "message_type": "inventory.reserve.requested",
                    "schema_version": 1,
                    "occurred_at": datetime.now(UTC).isoformat(),
                    "correlation_id": str(order_id),
                    "payload": {
                        "order_id": str(order_id),
                        "items": [{"product_id": product_id, "quantity": 1}],
                    },
                },
            )
            if (index + 1) % 1000 == 0:
                print(f"Published {index + 1}/{count}", flush=True)
    print("All messages confirmed by RabbitMQ; waiting for processing.", flush=True)
    verify(product_id, count)


def verify(product_id: str, expected: int) -> None:
    deadline = time.monotonic() + 300
    while time.monotonic() < deadline:
        with psycopg.connect(os.environ["DATABASE_URL"]) as connection:
            actual, results, inbox = connection.execute(
                """SELECT count(*),
                    (SELECT count(*) FROM outbox_messages o
                     JOIN reservations r ON r.order_id = o.aggregate_id
                     WHERE r.request_items @> %s::jsonb),
                    (SELECT count(*) FROM processed_messages p
                     WHERE p.message_type = 'inventory.reserve.requested')
                FROM reservations
                WHERE request_items @> %s::jsonb
                  AND status = 'rejected'
                  AND result_payload->>'reason' = 'unknown_product'""",
                (json.dumps([{"product_id": product_id}]),) * 2,
            ).fetchone()
        if actual == expected and results == expected and inbox >= expected:
            with open_connection() as rabbit:
                channel = rabbit.channel()
                for queue in (RESERVE_QUEUE, RESERVE_RETRY_QUEUE, RESERVE_DEAD_QUEUE):
                    remaining = channel.queue_declare(queue=queue, passive=True)
                    if remaining.method.message_count:
                        raise RuntimeError(f"Messages remain in {queue}")
            print(
                f"PASS: {actual} reservations, {results} outbox results; "
                "reservation/retry/dead-letter queues empty.",
                flush=True,
            )
            return
        time.sleep(2)
    raise TimeoutError(f"Expected {expected} results, got {actual}; outbox={results}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["setup", "publish"])
    args = parser.parse_args()
    if args.action == "setup":
        setup()
    else:
        publish()
