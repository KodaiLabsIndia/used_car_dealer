"""Source-linked AI example. No provider request and no invented model usage."""

from contextlib import contextmanager

from app.adapters.assistant_context import AssistantContext
from app.adapters.commercial import CommercialStore
from app.adapters.documents import DocumentStore
from app.adapters.operations import OperationsStore
from app.adapters.purchases import PurchaseStore
from app.adapters.workflows import WorkflowStore
from app.assistant_contracts import AIContent, AssistantInput
from app.demo.core import insert


class TransactionReader:
    """Read the seed transaction without committing it or opening a second snapshot."""

    def __init__(self, conn):
        self.conn = conn

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execution_options(self, **options):
        return self

    @contextmanager
    def begin(self):
        yield self

    def execute(self, statement, *args, **kwargs):
        if not str(statement).lstrip().upper().startswith("SELECT"):
            raise RuntimeError("Demo source snapshots are read-only")
        return self.conn.execute(statement, *args, **kwargs)


class TransactionSource:
    def __init__(self, conn):
        self.conn = conn

    def connect(self):
        return TransactionReader(self.conn)


def assistant_sample(b):
    uid = b.uid
    workflows = WorkflowStore(OperationsStore(TransactionSource(b.conn)))
    context = AssistantContext(
        workflows,
        CommercialStore(PurchaseStore(workflows)),
        DocumentStore(workflows, b.media.root),
        b.media.root,
    )
    body = AssistantInput(
        command_id=uid("assistant-command"),
        capability="owner_brief",
        language="en",
        car_id=uid("car:inspection"),
        task_id=uid("task:inspection:pre_purchase"),
        item_id=b.tasks[("inspection", "pre_purchase")].recheck_items[0],
        text="Demo sample only: explain the recorded work. No live model request.",
    )
    bundle = context.build(b.owner, body)
    source_ids = [s.id for s in bundle.sources][:6]
    car = next(car for car in b.config.cars if car.key == "inspection")
    content = AIContent(
        summary=f"Demo sample (no live model call): the {car.make} {car.model} inspection is in recheck. Required inspection and stock-hold clearance remain incomplete. Review the source records before any purchase decision.",
        fields=[],
        unknowns=["Synthetic fixture media does not establish the condition of a real vehicle."],
        checks=[
            "Review the returned tyre proofs.",
            "Allocate the remaining checks.",
            "Review completed records before committing money.",
        ],
        source_ids=source_ids,
    )
    id = uid("assistant-sample")
    insert(
        b.conn,
        "ai_runs",
        id=id,
        company_id=uid("company"),
        actor_id=uid("owner"),
        command_id=body.command_id,
        fingerprint="demo-sample",
        request=body.model_dump(mode="json", by_alias=True),
        status="completed",
        source_hash=bundle.source_hash,
        sources=[s.model_dump(mode="json", by_alias=True) for s in bundle.sources],
        cutoff=bundle.cutoff,
        prompt_version="demo-fixture-v1",
        model="demo-fixture-no-model-call",
        response=content.model_dump(mode="json", by_alias=True),
        input_tokens=0,
        output_tokens=0,
        created_at=bundle.cutoff,
        completed_at=bundle.cutoff,
    )
    return id
