"""Attendance and payroll adapted from SBOSS business rules."""

from pathlib import Path
from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade():
    op.get_bind().exec_driver_sql(
        (Path(__file__).resolve().parents[2] / "db/migrations/0022_workforce.sql").read_text()
    )


def downgrade():
    raise RuntimeError("Attendance and salary history requires a preservation migration.")
