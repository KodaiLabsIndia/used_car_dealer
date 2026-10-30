from pathlib import Path

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade():
    statement = (
        Path(__file__).resolve().parents[2] / "db/migrations/0010_finance_corrections.sql"
    ).read_text()
    op.get_bind().exec_driver_sql(statement, execution_options={"no_parameters": True})


def downgrade():
    raise RuntimeError("Financial corrections require an audited recovery plan.")
