import json
import os
from typing import Any

import pika

COMMAND_EXCHANGE = "orders.commands"
EVENT_EXCHANGE = "inventory.events"
RETRY_EXCHANGE = "webshop.retry"
DEAD_LETTER_EXCHANGE = "webshop.dlx"
RESERVE_ROUTING_KEY = "inventory.reserve.requested.v1"
RESERVE_QUEUE = "inventory.reserve.v1"
RESERVE_RETRY_QUEUE = "inventory.reserve.retry.v1"
RESERVE_DEAD_QUEUE = "inventory.reserve.dlq.v1"
RESERVE_RETRY_KEY = "inventory.reserve.retry.v1"
RESERVE_DEAD_KEY = "inventory.reserve.dead.v1"


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


def retry_delay_ms() -> int:
    return int(os.getenv("MESSAGE_RETRY_DELAY_MS", "5000"))


def retry_limit() -> int:
    return int(os.getenv("MESSAGE_RETRY_LIMIT", "3"))


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
    channel.queue_declare(queue=RESERVE_QUEUE, durable=True)
    channel.queue_bind(
        queue=RESERVE_QUEUE,
        exchange=COMMAND_EXCHANGE,
        routing_key=RESERVE_ROUTING_KEY,
    )
    channel.queue_declare(
        queue=RESERVE_RETRY_QUEUE,
        durable=True,
        arguments={
            "x-message-ttl": retry_delay_ms(),
            "x-dead-letter-exchange": COMMAND_EXCHANGE,
            "x-dead-letter-routing-key": RESERVE_ROUTING_KEY,
        },
    )
    channel.queue_bind(
        queue=RESERVE_RETRY_QUEUE,
        exchange=RETRY_EXCHANGE,
        routing_key=RESERVE_RETRY_KEY,
    )
    channel.queue_declare(queue=RESERVE_DEAD_QUEUE, durable=True)
    channel.queue_bind(
        queue=RESERVE_DEAD_QUEUE,
        exchange=DEAD_LETTER_EXCHANGE,
        routing_key=RESERVE_DEAD_KEY,
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
