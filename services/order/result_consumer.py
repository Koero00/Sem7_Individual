import logging
import os
import time

import pika

from database import pool
from messaging import (
    DEAD_LETTER_EXCHANGE,
    RESULT_DEAD_KEY,
    RESULT_QUEUE,
    RESULT_RETRY_KEY,
    RETRY_EXCHANGE,
    declare_topology,
    open_connection,
    persistent_properties,
    retry_limit,
)
from result_handler import PermanentMessageError, process_result

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("order-result-consumer")


def republish(channel, method, properties, body, *, permanent: bool) -> None:
    headers = dict(properties.headers or {})
    attempt = int(headers.get("x-retry-count", 0))
    if permanent or attempt >= retry_limit():
        exchange = DEAD_LETTER_EXCHANGE
        routing_key = RESULT_DEAD_KEY
    else:
        exchange = RETRY_EXCHANGE
        routing_key = f"{RESULT_RETRY_KEY}.{method.routing_key}"
        headers["x-retry-count"] = attempt + 1

    channel.basic_publish(
        exchange=exchange,
        routing_key=routing_key,
        body=body,
        properties=persistent_properties(
            message_id=properties.message_id,
            correlation_id=properties.correlation_id,
            headers=headers,
        ),
        mandatory=True,
    )


def run() -> None:
    pool.open()
    while True:
        try:
            rabbit = open_connection()
            channel = rabbit.channel()
            declare_topology(channel)
            channel.confirm_delivery()
            channel.basic_qos(prefetch_count=10)

            def callback(ch, method, properties, body):
                started = time.monotonic()
                try:
                    with pool.connection() as connection:
                        outcome = process_result(connection, body)
                    ch.basic_ack(method.delivery_tag)
                    logger.info(
                        "message_processed message_id=%s correlation_id=%s outcome=%s duration_ms=%d",
                        properties.message_id,
                        properties.correlation_id,
                        outcome,
                        (time.monotonic() - started) * 1000,
                    )
                except PermanentMessageError as exc:
                    logger.error(
                        "message_dead_lettered message_id=%s reason=%s",
                        properties.message_id,
                        exc,
                    )
                    try:
                        republish(ch, method, properties, body, permanent=True)
                        ch.basic_ack(method.delivery_tag)
                    except Exception:
                        logger.exception("dead_letter_publish_failed")
                        ch.basic_nack(method.delivery_tag, requeue=True)
                except Exception:
                    logger.exception(
                        "message_failed message_id=%s correlation_id=%s",
                        properties.message_id,
                        properties.correlation_id,
                    )
                    try:
                        republish(ch, method, properties, body, permanent=False)
                        ch.basic_ack(method.delivery_tag)
                    except Exception:
                        logger.exception("retry_publish_failed")
                        ch.basic_nack(method.delivery_tag, requeue=True)

            channel.basic_consume(queue=RESULT_QUEUE, on_message_callback=callback)
            logger.info("consumer_ready queue=%s", RESULT_QUEUE)
            channel.start_consuming()
        except (pika.exceptions.AMQPError, OSError):
            logger.exception("rabbitmq_connection_failed")
            time.sleep(5)


if __name__ == "__main__":
    run()
