from pathlib import Path

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade():
    statement = (Path(__file__).resolve().parents[2] / "db/migrations/0007_identity_defaults.sql").read_text()
    op.get_bind().exec_driver_sql(statement, execution_options={"no_parameters": True})


def downgrade():
    op.execute("ALTER TABLE companies ALTER COLUMN access_code DROP DEFAULT")
