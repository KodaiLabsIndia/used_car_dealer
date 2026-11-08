"""One master inspection, allocated checks and preserved worker history."""

from pathlib import Path
from alembic import op

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade():
    op.get_bind().exec_driver_sql(
        (Path(__file__).resolve().parents[2] / "db/migrations/0025_shared_inspections.sql").read_text()
    )


def downgrade():
    raise RuntimeError("Shared inspection facts require a preservation migration.")
