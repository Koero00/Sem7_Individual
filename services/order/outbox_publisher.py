import logging
import os
import time
from typing import Any
from uuid import uuid4

from database import pool
from messaging import COMMAND_EXCHANGE, declare_topology, open_connection, publish_json

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("order-outbox-publisher")


def batch_size() -> int:
    return int(os.getenv("OUTBOX_BATCH_SIZE", "100"))


def poll_interval() -> float:
    return float(os.getenv("OUTBOX_POLL_INTERVAL_SECONDS", "1"))


def claim_messages(connection: Any) -> tuple[str, list[dict[str, Any]]]:
    claim_token = str(uuid4())
    messages = connection.execute(
        """
        WITH selected AS (
            SELECT id
            FROM outbox_messages
            WHERE published_at IS NULL
              AND (claimed_at IS NULL OR claimed_at < now() - interval '5 minutes')
            ORDER BY created_at
            LIMIT %s
            FOR UPDATE SKIP LOCKED
        )
        UPDATE outbox_messages AS outbox
        SET claim_token = %s, claimed_at = now()
        FROM selected
        WHERE outbox.id = selected.id
        RETURNING outbox.id, outbox.aggregate_id, outbox.routing_key, outbox.payload
        """,
        (batch_size(), claim_token),
    ).fetchall()
    connection.commit()
    return claim_token, messages


def mark_published(connection: Any, message_id, claim_token: str) -> None:
    connection.execute(
        """
        UPDATE outbox_messages
        SET published_at = now(), claim_token = NULL, claimed_at = NULL,
            last_error = NULL
        WHERE id = %s AND claim_token = %s
        """,
        (message_id, claim_token),
    )
    connection.commit()


def release_claim(connection: Any, claim_token: str, error: str) -> None:
    connection.execute(
        """
        UPDATE outbox_messages
        SET attempts = attempts + 1, last_error = %s,
            claim_token = NULL, claimed_at = NULL
        WHERE claim_token = %s
        """,
        (error[:1000], claim_token),
    )
    connection.commit()


def run() -> None:
    pool.open()
    while True:
        try:
            rabbit = open_connection()
            channel = rabbit.channel()
            declare_topology(channel)
            channel.confirm_delivery()
            while rabbit.is_open:
                with pool.connection() as connection:
                    claim_token, messages = claim_messages(connection)
                if not messages:
                    rabbit.process_data_events(time_limit=poll_interval())
                    continue
                for message in messages:
                    try:
                        publish_json(
                            channel,
                            exchange=COMMAND_EXCHANGE,
                            routing_key=message["routing_key"],
                            payload=message["payload"],
                        )
                        with pool.connection() as connection:
                            mark_published(connection, message["id"], claim_token)
                        logger.info(
                            "outbox_published message_id=%s correlation_id=%s",
                            message["id"],
                            message["aggregate_id"],
                        )
                    except Exception as exc:
                        with pool.connection() as connection:
                            release_claim(connection, claim_token, str(exc))
                        raise
        except Exception:
            logger.exception("publisher_unavailable")
            time.sleep(5)


if __name__ == "__main__":
    run()
