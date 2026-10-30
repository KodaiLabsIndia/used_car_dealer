from pathlib import Path

from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade():
    statement = (Path(__file__).resolve().parents[2] / "db/migrations/0014_notifications.sql").read_text()
    op.get_bind().exec_driver_sql(statement, execution_options={"no_parameters": True})


def downgrade():
    raise RuntimeError("Notification delivery receipts and system events need an audited recovery plan.")
