from pathlib import Path

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade():
    statement = (Path(__file__).resolve().parents[2] / "db/migrations/0011_enquiries.sql").read_text()
    op.get_bind().exec_driver_sql(statement, execution_options={"no_parameters": True})


def downgrade():
    raise RuntimeError("Enquiry history requires an explicit retention and recovery plan.")
