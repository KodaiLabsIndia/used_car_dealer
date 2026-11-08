"""Staff routines with immutable daily snapshots and step history."""

from pathlib import Path
from alembic import op

revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None


def upgrade():
    op.get_bind().exec_driver_sql(
        (Path(__file__).resolve().parents[2] / "db/migrations/0024_staff_routines.sql").read_text()
    )


def downgrade():
    raise RuntimeError("Routine history requires a preservation migration.")
