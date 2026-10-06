from contextlib import asynccontextmanager
from typing import Annotated, Any
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Response, status
from psycopg import errors

from database import get_connection, pool
from models import Product, ProductCreate, ProductUpdate

Connection = Annotated[Any, Depends(get_connection)]
PRODUCT_COLUMNS = "id, name, description, price, image_url"


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool.open()
    yield
    pool.close()


app = FastAPI(
    title="Catalog Service",
    description="Stores and manages products for the webshop.",
    lifespan=lifespan,
)


def find_product(product_id: str, connection: Any) -> dict[str, Any]:
    product = connection.execute(
        f"SELECT {PRODUCT_COLUMNS} FROM products WHERE id = %s",
        (product_id,),
    ).fetchone()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@app.get("/products", response_model=list[Product])
def list_products(connection: Connection):
    return connection.execute(
        f"SELECT {PRODUCT_COLUMNS} FROM products ORDER BY id"
    ).fetchall()


@app.get("/products/{product_id}", response_model=Product)
def get_product(product_id: str, connection: Connection):
    return find_product(product_id, connection)


@app.post("/products", response_model=Product, status_code=status.HTTP_201_CREATED)
def create_product(product: ProductCreate, connection: Connection):
    product_id = product.id or str(uuid4())
    try:
        created_product = connection.execute(
            f"""
            INSERT INTO products (id, name, description, price, image_url)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING {PRODUCT_COLUMNS}
            """,
            (
                product_id,
                product.name,
                product.description,
                product.price,
                product.image_url,
            ),
        ).fetchone()
        connection.commit()
    except errors.UniqueViolation as exc:
        connection.rollback()
        raise HTTPException(
            status_code=409, detail="Product ID already exists"
        ) from exc
    return created_product


@app.put("/products/{product_id}", response_model=Product)
def update_product(product_id: str, product: ProductUpdate, connection: Connection):
    updated_product = connection.execute(
        f"""
        UPDATE products
        SET name = %s, description = %s, price = %s, image_url = %s
        WHERE id = %s
        RETURNING {PRODUCT_COLUMNS}
        """,
        (
            product.name,
            product.description,
            product.price,
            product.image_url,
            product_id,
        ),
    ).fetchone()
    if updated_product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    connection.commit()
    return updated_product


@app.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: str, connection: Connection):
    deleted_product = connection.execute(
        "DELETE FROM products WHERE id = %s RETURNING id",
        (product_id,),
    ).fetchone()
    if deleted_product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    connection.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Backwards-compatible read endpoints used by the current API gateway.
@app.get("/", response_model=dict[str, list[Product]], include_in_schema=False)
def legacy_list_products(connection: Connection):
    return {"Voedsel": list_products(connection)}


@app.get("/{item_id}", response_model=Product, include_in_schema=False)
def legacy_get_product(item_id: str, connection: Connection):
    return get_product(item_id, connection)
