from pathlib import Path

from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade():
    statement = (Path(__file__).resolve().parents[2] / "db/migrations/0015_documents.sql").read_text()
    op.get_bind().exec_driver_sql(statement, execution_options={"no_parameters": True})


def downgrade():
    raise RuntimeError("Document masters and reviews require an explicit retention and recovery plan.")
