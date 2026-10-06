from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class InventoryItemCreate(BaseModel):
    product_id: str = Field(min_length=1, max_length=100)
    quantity: int = Field(ge=0)


class InventoryItemUpdate(BaseModel):
    quantity: int = Field(ge=0)


class InventoryItem(InventoryItemCreate):
    model_config = ConfigDict(from_attributes=True)


class MessageEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message_id: UUID
    message_type: str
    schema_version: Literal[1]
    occurred_at: datetime
    correlation_id: UUID
    payload: dict[str, Any]
