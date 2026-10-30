"""Catalogue references and configuration-bound spatial inspection snapshots."""

from pathlib import Path
from alembic import op

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade():
    sql = Path(__file__).resolve().parents[2] / "db/migrations/0020_spatial_inspections.sql"
    op.get_bind().exec_driver_sql(sql.read_text())


def downgrade():
    raise RuntimeError("Inspection and catalogue history requires an explicit preservation migration")
