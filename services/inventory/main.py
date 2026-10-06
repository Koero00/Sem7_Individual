from contextlib import asynccontextmanager
from typing import Annotated, Any

from fastapi import Depends, FastAPI, HTTPException, Response, status
from psycopg import errors

from database import get_connection, pool
from models import InventoryItem, InventoryItemCreate, InventoryItemUpdate

Connection = Annotated[Any, Depends(get_connection)]
INVENTORY_COLUMNS = "product_id, quantity"


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool.open()
    yield
    pool.close()


app = FastAPI(
    title="Inventory Service",
    description="Stores and manages product stock for the webshop.",
    lifespan=lifespan,
)


def find_inventory_item(product_id: str, connection: Any) -> dict[str, Any]:
    item = connection.execute(
        f"SELECT {INVENTORY_COLUMNS} FROM inventory WHERE product_id = %s",
        (product_id,),
    ).fetchone()
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return item


@app.get("/inventory", response_model=list[InventoryItem])
def list_inventory(connection: Connection):
    return connection.execute(
        f"SELECT {INVENTORY_COLUMNS} FROM inventory ORDER BY product_id"
    ).fetchall()


@app.get("/inventory/{product_id}", response_model=InventoryItem)
def get_inventory_item(product_id: str, connection: Connection):
    return find_inventory_item(product_id, connection)


@app.post(
    "/inventory", response_model=InventoryItem, status_code=status.HTTP_201_CREATED
)
def create_inventory_item(item: InventoryItemCreate, connection: Connection):
    try:
        created_item = connection.execute(
            f"""
            INSERT INTO inventory (product_id, quantity)
            VALUES (%s, %s)
            RETURNING {INVENTORY_COLUMNS}
            """,
            (item.product_id, item.quantity),
        ).fetchone()
        connection.commit()
    except errors.UniqueViolation as exc:
        connection.rollback()
        raise HTTPException(
            status_code=409,
            detail="Inventory item already exists",
        ) from exc
    return created_item


@app.put("/inventory/{product_id}", response_model=InventoryItem)
def update_inventory_item(
    product_id: str,
    item: InventoryItemUpdate,
    connection: Connection,
):
    updated_item = connection.execute(
        f"""
        UPDATE inventory
        SET quantity = %s
        WHERE product_id = %s
        RETURNING {INVENTORY_COLUMNS}
        """,
        (item.quantity, product_id),
    ).fetchone()
    if updated_item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    connection.commit()
    return updated_item


@app.delete("/inventory/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_inventory_item(product_id: str, connection: Connection):
    deleted_item = connection.execute(
        "DELETE FROM inventory WHERE product_id = %s RETURNING product_id",
        (product_id,),
    ).fetchone()
    if deleted_item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    connection.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/health", include_in_schema=False)
def health():
    return {"status": "ok"}
