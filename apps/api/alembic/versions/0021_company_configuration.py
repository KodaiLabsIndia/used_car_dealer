"""Company document rules and per-sale warranty configuration."""

from pathlib import Path
from alembic import op

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade():
    path = Path(__file__).resolve().parents[2] / "db/migrations/0021_company_configuration.sql"
    op.get_bind().exec_driver_sql(path.read_text())


def downgrade():
    raise RuntimeError("Company policy history requires an explicit preservation migration")
