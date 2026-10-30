from sqlalchemy import create_engine
from sqlalchemy.engine import Engine


def create_database(url: str) -> Engine:
    return create_engine(
        url.replace("postgresql://", "postgresql+psycopg://", 1),
        pool_size=5,
        max_overflow=5,
        pool_pre_ping=True,
        connect_args={"connect_timeout": 5, "options": "-c statement_timeout=15000"},
    )
