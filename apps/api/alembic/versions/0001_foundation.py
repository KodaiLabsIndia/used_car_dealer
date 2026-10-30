from pathlib import Path

from alembic import op

revision = "0001"
down_revision = None


def upgrade():
    statement = (Path(__file__).resolve().parents[2] / "db/migrations/0001_foundation.sql").read_text()
    # The migration is reviewed SQL, including PostgreSQL constraints and immutable audit triggers.
    op.get_bind().exec_driver_sql(statement, execution_options={"no_parameters": True})


def downgrade():
    raise RuntimeError(
        "Initial operational schema requires a reviewed restore plan; automatic destructive downgrade disabled."
    )
