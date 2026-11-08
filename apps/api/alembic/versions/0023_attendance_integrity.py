"""Protect punch evidence and finalized attendance."""

from pathlib import Path
from alembic import op

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade():
    op.get_bind().exec_driver_sql(
        (Path(__file__).resolve().parents[2] / "db/migrations/0023_attendance_integrity.sql").read_text()
    )


def downgrade():
    raise RuntimeError("Attendance evidence protections require a preservation migration.")
