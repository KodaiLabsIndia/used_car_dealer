from pathlib import Path

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade():
    statement = (Path(__file__).resolve().parents[2] / "db/migrations/0012_custody_holds.sql").read_text()
    op.get_bind().exec_driver_sql(statement, execution_options={"no_parameters": True})


def downgrade():
    raise RuntimeError("Custody and safety history require an explicit recovery plan.")
