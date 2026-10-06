import json
import os
from typing import Any

import pika

COMMAND_EXCHANGE = "orders.commands"
EVENT_EXCHANGE = "inventory.events"
RETRY_EXCHANGE = "webshop.retry"
DEAD_LETTER_EXCHANGE = "webshop.dlx"
RESULT_QUEUE = "orders.inventory-results.v1"
RESULT_RETRY_QUEUE = "orders.inventory-results.retry.v1"
RESULT_DEAD_QUEUE = "orders.inventory-results.dlq.v1"
RESULT_RETRY_KEY = "orders.inventory-results.retry.v1"
RESULT_DEAD_KEY = "orders.inventory-results.dead.v1"
RESULT_ROUTING_KEYS = ("inventory.reserved.v1", "inventory.rejected.v1")


def open_connection() -> pika.BlockingConnection:
    parameters = pika.URLParameters(
        os.getenv(
            "RABBITMQ_URL",
            "amqp://webshop:webshop@localhost:5672/%2Fwebshop",
        )
    )
    parameters.heartbeat = 30
    parameters.blocked_connection_timeout = 30
    return pika.BlockingConnection(parameters)


def declare_topology(channel: Any) -> None:
    channel.exchange_declare(
        exchange=COMMAND_EXCHANGE, exchange_type="direct", durable=True
    )
    channel.exchange_declare(
        exchange=EVENT_EXCHANGE, exchange_type="topic", durable=True
    )
    channel.exchange_declare(
        exchange=RETRY_EXCHANGE, exchange_type="direct", durable=True
    )
    channel.exchange_declare(
        exchange=DEAD_LETTER_EXCHANGE, exchange_type="direct", durable=True
    )
    channel.queue_declare(queue=RESULT_QUEUE, durable=True)
    for routing_key in RESULT_ROUTING_KEYS:
        channel.queue_bind(
            queue=RESULT_QUEUE,
            exchange=EVENT_EXCHANGE,
            routing_key=routing_key,
        )
    for routing_key in RESULT_ROUTING_KEYS:
        retry_queue = f"{RESULT_RETRY_QUEUE}.{routing_key}"
        channel.queue_declare(
            queue=retry_queue,
            durable=True,
            arguments={
                "x-message-ttl": retry_delay_ms(),
                "x-dead-letter-exchange": EVENT_EXCHANGE,
                "x-dead-letter-routing-key": routing_key,
            },
        )
        channel.queue_bind(
            queue=retry_queue,
            exchange=RETRY_EXCHANGE,
            routing_key=f"{RESULT_RETRY_KEY}.{routing_key}",
        )
    channel.queue_declare(queue=RESULT_DEAD_QUEUE, durable=True)
    channel.queue_bind(
        queue=RESULT_DEAD_QUEUE,
        exchange=DEAD_LETTER_EXCHANGE,
        routing_key=RESULT_DEAD_KEY,
    )


def persistent_properties(
    *, message_id: str | None = None, correlation_id: str | None = None, headers=None
) -> pika.BasicProperties:
    return pika.BasicProperties(
        content_type="application/json",
        delivery_mode=2,
        message_id=message_id,
        correlation_id=correlation_id,
        headers=headers or {},
    )


def publish_json(
    channel: Any,
    *,
    exchange: str,
    routing_key: str,
    payload: dict[str, Any],
) -> None:
    confirmed = channel.basic_publish(
        exchange=exchange,
        routing_key=routing_key,
        body=json.dumps(payload, separators=(",", ":"), sort_keys=True).encode(),
        properties=persistent_properties(
            message_id=str(payload.get("message_id", "")),
            correlation_id=str(payload.get("correlation_id", "")),
        ),
        mandatory=True,
    )
    if confirmed is False:
        raise RuntimeError("RabbitMQ did not confirm the publication")


def retry_delay_ms() -> int:
    return int(os.getenv("MESSAGE_RETRY_DELAY_MS", "5000"))


def retry_limit() -> int:
    return int(os.getenv("MESSAGE_RETRY_LIMIT", "3"))
