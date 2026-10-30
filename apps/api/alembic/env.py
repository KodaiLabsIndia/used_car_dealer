from alembic import context
from app.adapters.database import create_database
from app.config import Settings

config = context.config
engine = create_database(config.attributes.get("database_url") or Settings().sqlalchemy_url)
with engine.connect() as connection:
    context.configure(connection=connection, target_metadata=None)
    with context.begin_transaction():
        context.run_migrations()
engine.dispose()
