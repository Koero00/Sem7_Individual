from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from models import MessageEnvelope


class PermanentMessageError(Exception):
    """A message that cannot become valid by retrying it."""


class DuplicateOrderMismatch(PermanentMessageError):
    pass


class ReservationItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: str = Field(min_length=1, max_length=100)
    quantity: int = Field(ge=1)


class ReservationPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    order_id: UUID
    items: list[ReservationItem] = Field(min_length=1)


def parse_request(body: bytes) -> tuple[MessageEnvelope, ReservationPayload]:
    try:
        envelope = MessageEnvelope.model_validate_json(body)
        if envelope.message_type != "inventory.reserve.requested":
            raise PermanentMessageError(
                f"Unsupported message type: {envelope.message_type}"
            )
        payload = ReservationPayload.model_validate(envelope.payload)
        if payload.order_id != envelope.correlation_id:
            raise PermanentMessageError(
                "Payload order ID does not match correlation ID"
            )
        return envelope, payload
    except ValidationError as exc:
        raise PermanentMessageError("Invalid reservation message") from exc


def normalize_items(items: list[ReservationItem]) -> list[dict[str, Any]]:
    quantities: dict[str, int] = {}
    for item in items:
        quantities[item.product_id] = quantities.get(item.product_id, 0) + item.quantity
    return [
        {"product_id": product_id, "quantity": quantities[product_id]}
        for product_id in sorted(quantities)
    ]


def enqueue_result(
    connection: Any,
    *,
    order_id: UUID,
    message_type: str,
    result_payload: dict[str, Any],
) -> None:
    message_id = uuid4()
    envelope = MessageEnvelope(
        message_id=message_id,
        message_type=message_type,
        schema_version=1,
        occurred_at=datetime.now(UTC),
        correlation_id=order_id,
        payload=result_payload,
    ).model_dump(mode="json")
    connection.execute(
        """
        INSERT INTO outbox_messages
            (id, aggregate_id, message_type, routing_key, payload)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (
            message_id,
            order_id,
            message_type,
            f"{message_type}.v1",
            Jsonb(envelope),
        ),
    )


def process_reservation(connection: Any, body: bytes) -> str:
    envelope, payload = parse_request(body)
    items = normalize_items(payload.items)
    try:
        if connection.execute(
            "SELECT 1 FROM processed_messages WHERE message_id = %s",
            (envelope.message_id,),
        ).fetchone():
            connection.commit()
            return "duplicate_message"

        previous = connection.execute(
            """
            SELECT request_items, result_type, result_payload
            FROM reservations
            WHERE order_id = %s
            FOR UPDATE
            """,
            (payload.order_id,),
        ).fetchone()
        if previous is not None:
            if previous["request_items"] != items:
                raise DuplicateOrderMismatch(
                    "The order ID was previously used with different items"
                )
            enqueue_result(
                connection,
                order_id=payload.order_id,
                message_type=previous["result_type"],
                result_payload=previous["result_payload"],
            )
            connection.execute(
                """
                INSERT INTO processed_messages (message_id, message_type)
                VALUES (%s, %s)
                """,
                (envelope.message_id, envelope.message_type),
            )
            connection.commit()
            return "duplicate_order"

        product_ids = [item["product_id"] for item in items]
        stock_rows = connection.execute(
            """
            SELECT product_id, quantity
            FROM inventory
            WHERE product_id = ANY(%s)
            ORDER BY product_id
            FOR UPDATE
            """,
            (product_ids,),
        ).fetchall()
        stock = {row["product_id"]: row["quantity"] for row in stock_rows}
        missing = [
            {
                "product_id": item["product_id"],
                "requested_quantity": item["quantity"],
                "available_quantity": None,
            }
            for item in items
            if item["product_id"] not in stock
        ]
        shortages = [
            {
                "product_id": item["product_id"],
                "requested_quantity": item["quantity"],
                "available_quantity": stock[item["product_id"]],
            }
            for item in items
            if item["product_id"] in stock
            and stock[item["product_id"]] < item["quantity"]
        ]

        if missing or shortages:
            reason = "unknown_product" if missing else "insufficient_stock"
            result_type = "inventory.rejected"
            result_payload = {
                "order_id": str(payload.order_id),
                "reason": reason,
                "items": missing or shortages,
            }
            status = "rejected"
        else:
            for item in items:
                connection.execute(
                    """
                    UPDATE inventory
                    SET quantity = quantity - %s
                    WHERE product_id = %s
                    """,
                    (item["quantity"], item["product_id"]),
                )
            result_type = "inventory.reserved"
            result_payload = {"order_id": str(payload.order_id), "items": items}
            status = "reserved"

        connection.execute(
            """
            INSERT INTO reservations
                (order_id, request_items, status, result_type, result_payload)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                payload.order_id,
                Jsonb(items),
                status,
                result_type,
                Jsonb(result_payload),
            ),
        )
        enqueue_result(
            connection,
            order_id=payload.order_id,
            message_type=result_type,
            result_payload=result_payload,
        )
        connection.execute(
            """
            INSERT INTO processed_messages (message_id, message_type)
            VALUES (%s, %s)
            """,
            (envelope.message_id, envelope.message_type),
        )
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    return status
