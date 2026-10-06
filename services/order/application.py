from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from psycopg.types.json import Jsonb

from models import MessageEnvelope, OrderCreate

ORDER_COLUMNS = (
    "id, customer_id, items, status, rejection_reason, rejection_details, "
    "created_at, updated_at"
)


def create_pending_order(order: OrderCreate, connection: Any) -> dict[str, Any]:
    order_id = uuid4()
    message_id = uuid4()
    now = datetime.now(UTC)
    items = [item.model_dump() for item in order.items]
    envelope = MessageEnvelope(
        message_id=message_id,
        message_type="inventory.reserve.requested",
        schema_version=1,
        occurred_at=now,
        correlation_id=order_id,
        payload={"order_id": str(order_id), "items": items},
    ).model_dump(mode="json")

    try:
        created_order = connection.execute(
            f"""
            INSERT INTO orders (id, customer_id, items, status, updated_at)
            VALUES (%s, %s, %s, 'pending', %s)
            RETURNING {ORDER_COLUMNS}
            """,
            (order_id, order.customer_id, Jsonb(items), now),
        ).fetchone()
        connection.execute(
            """
            INSERT INTO outbox_messages
                (id, aggregate_id, message_type, routing_key, payload)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                message_id,
                order_id,
                "inventory.reserve.requested",
                "inventory.reserve.requested.v1",
                Jsonb(envelope),
            ),
        )
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    return created_order


def get_order(order_id: UUID, connection: Any) -> dict[str, Any] | None:
    return connection.execute(
        f"SELECT {ORDER_COLUMNS} FROM orders WHERE id = %s",
        (order_id,),
    ).fetchone()
