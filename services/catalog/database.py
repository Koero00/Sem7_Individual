import os
from collections.abc import Generator
from typing import Any

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://catalog:catalog@localhost:5432/catalog",
)

pool = ConnectionPool(
    DATABASE_URL,
    kwargs={"row_factory": dict_row},
    open=False,
)


def get_connection() -> Generator[Any]:
    """Provide one database connection for the duration of a request."""
    with pool.connection() as connection:
        yield connection
