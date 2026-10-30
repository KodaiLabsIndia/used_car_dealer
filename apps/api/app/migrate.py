import hashlib
from pathlib import Path

from alembic.config import Config
from sqlalchemy import inspect, text

from alembic import command
from app.adapters.database import create_database
from app.config import Settings


def migrate():
    settings = Settings()
    settings.validate_runtime()
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    engine = create_database(settings.sqlalchemy_url)
    # Adopt only the byte-identical foundation already applied during local setup.
    with engine.connect() as connection:
        tables = inspect(connection).get_table_names()
        if "schema_migrations" in tables and "alembic_version" not in tables:
            checksum = connection.execute(
                text("SELECT checksum FROM schema_migrations WHERE name='0001_foundation.sql'")
            ).scalar_one()
            source = Path(__file__).resolve().parents[1] / "db/migrations/0001_foundation.sql"
            if checksum != hashlib.sha256(source.read_bytes()).hexdigest():
                raise RuntimeError("Existing foundation differs; migration review required.")
            command.stamp(config, "0001")
    engine.dispose()
    command.upgrade(config, "head")
    print("PostgreSQL migrations applied with Alembic.")


if __name__ == "__main__":
    migrate()
