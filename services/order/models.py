from datetime import datetime
from enum import StrEnum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OrderStatus(StrEnum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class OrderItem(BaseModel):
    product_id: str = Field(min_length=1, max_length=100)
    quantity: int = Field(ge=1)


class OrderCreate(BaseModel):
    customer_id: str = Field(min_length=1, max_length=100)
    items: list[OrderItem] = Field(min_length=1)


class Order(OrderCreate):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: OrderStatus
    rejection_reason: str | None = None
    rejection_details: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime


class MessageEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message_id: UUID
    message_type: str
    schema_version: Literal[1]
    occurred_at: datetime
    correlation_id: UUID
    payload: dict[str, Any]
