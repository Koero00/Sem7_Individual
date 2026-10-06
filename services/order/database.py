import os
from collections.abc import Generator
from typing import Any

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://orders:orders@localhost:5434/orders",
)

pool = ConnectionPool(
    DATABASE_URL,
    kwargs={"row_factory": dict_row},
    open=False,
)


def get_connection() -> Generator[Any]:
    with pool.connection() as connection:
        yield connection
