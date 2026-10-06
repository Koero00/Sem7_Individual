from contextlib import asynccontextmanager
from typing import Annotated, Any
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Response, status

from application import create_pending_order
from application import get_order as find_order
from database import get_connection, pool
from models import Order, OrderCreate

Connection = Annotated[Any, Depends(get_connection)]


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool.open()
    yield
    pool.close()


app = FastAPI(
    title="Order Service",
    description="Stores and retrieves webshop orders.",
    lifespan=lifespan,
)


@app.post("/orders", response_model=Order, status_code=status.HTTP_202_ACCEPTED)
def create_order(order: OrderCreate, response: Response, connection: Connection):
    created_order = create_pending_order(order, connection)
    response.headers["Location"] = f"/orders/{created_order['id']}"
    return created_order


@app.get("/orders/{order_id}", response_model=Order)
def get_order(order_id: UUID, connection: Connection):
    order = find_order(order_id, connection)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@app.get("/health", include_in_schema=False)
def health():
    return {"status": "ok"}
