"""Selected inspection rechecks and retained review explanations."""

from pathlib import Path
from alembic import op

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade():
    sql = Path(__file__).resolve().parents[2] / "db/migrations/0018_selected_recheck.sql"
    op.get_bind().exec_driver_sql(sql.read_text())


def downgrade():
    raise RuntimeError("Inspection review history must not be discarded automatically")
