from typing import Any, Literal
from uuid import UUID

from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from models import MessageEnvelope


class PermanentMessageError(Exception):
    """A message that cannot become valid by retrying it."""


class ReservedPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    order_id: UUID
    items: list[dict[str, Any]]


class RejectedPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    order_id: UUID
    reason: Literal["unknown_product", "insufficient_stock"]
    items: list[dict[str, Any]] = Field(min_length=1)


def parse_result(body: bytes) -> tuple[MessageEnvelope, BaseModel]:
    try:
        envelope = MessageEnvelope.model_validate_json(body)
        if envelope.message_type == "inventory.reserved":
            payload = ReservedPayload.model_validate(envelope.payload)
        elif envelope.message_type == "inventory.rejected":
            payload = RejectedPayload.model_validate(envelope.payload)
        else:
            raise PermanentMessageError(
                f"Unsupported message type: {envelope.message_type}"
            )
        if payload.order_id != envelope.correlation_id:
            raise PermanentMessageError(
                "Payload order ID does not match correlation ID"
            )
        return envelope, payload
    except ValidationError as exc:
        raise PermanentMessageError("Invalid result message") from exc


def process_result(connection: Any, body: bytes) -> str:
    envelope, payload = parse_result(body)
    try:
        if connection.execute(
            "SELECT 1 FROM processed_messages WHERE message_id = %s",
            (envelope.message_id,),
        ).fetchone():
            connection.commit()
            return "duplicate"

        order = connection.execute(
            "SELECT status FROM orders WHERE id = %s FOR UPDATE",
            (payload.order_id,),
        ).fetchone()
        if order is None:
            raise PermanentMessageError("Result references an unknown order")

        if order["status"] == "pending":
            if envelope.message_type == "inventory.reserved":
                connection.execute(
                    """
                    UPDATE orders
                    SET status = 'confirmed', rejection_reason = NULL,
                        rejection_details = NULL, updated_at = now()
                    WHERE id = %s
                    """,
                    (payload.order_id,),
                )
            else:
                connection.execute(
                    """
                    UPDATE orders
                    SET status = 'rejected', rejection_reason = %s,
                        rejection_details = %s, updated_at = now()
                    WHERE id = %s
                    """,
                    (
                        payload.reason,
                        Jsonb({"items": payload.items}),
                        payload.order_id,
                    ),
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
    return "processed"
