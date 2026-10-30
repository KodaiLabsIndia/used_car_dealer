"""Immutable owner-authored checklist revisions and approval."""

from pathlib import Path
from alembic import op

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade():
    sql = Path(__file__).resolve().parents[2] / "db/migrations/0019_checklist_administration.sql"
    op.get_bind().exec_driver_sql(sql.read_text())


def downgrade():
    raise RuntimeError("Checklist history must not be discarded automatically")
