"""Build and validate one connected demo inside its ingestion transaction."""

from functools import partial

from app.adapters.commercial import CommercialStore
from app.adapters.operations import OperationsStore
from app.adapters.passwords import hash_secret
from app.adapters.purchases import PurchaseStore
from app.adapters.service_finance import ServiceFinanceStore
from app.adapters.workflows import WorkflowStore
from app.checklists import templates_for
from app.contracts import Actor
from app.demo.assistant_sample import assistant_sample
from app.demo.core import audit, insert, uid
from app.demo.corrections import corrections
from app.demo.customer_work import customer_work
from app.demo.fleet import fleet
from app.demo.workforce import DemoPayrollReader, workforce


class DemoBuilder:
    def __init__(self, conn, engine, config, clock, media, password, generation):
        self.uid = partial(uid, namespace=generation)
        self.conn, self.engine, self.config, self.clock, self.media, self.password = (
            conn,
            engine,
            config,
            clock,
            media,
            password,
        )
        self.ops = OperationsStore(engine)
        self.workflows = WorkflowStore(self.ops)
        self.purchases = PurchaseStore(self.workflows)
        self.commercial = CommercialStore(self.purchases)
        self.owner = Actor(
            id=self.uid("owner"),
            company_id=self.uid("company"),
            name=next(p.name for p in config.staff if p.key == "owner"),
            role="owner",
            work_roles=["supervisor"],
        )
        self.templates = templates_for(self.uid("company"))
        self.tasks = {}
        self.purchase_ids = {}
        self.jobs = {}
        self.bookings = {}
        self.odometers = {}

    def build(self):
        insert(
            self.conn,
            "companies",
            id=self.uid("company"),
            name=self.config.company_name,
            access_code=self.config.dealer_code,
        )
        for person in self.config.staff:
            insert(
                self.conn,
                "users",
                id=self.uid(person.key),
                company_id=self.uid("company"),
                name=person.name,
                role=person.role,
                work_roles=person.work_roles,
            )
            insert(
                self.conn,
                "user_credentials",
                user_id=self.uid(person.key),
                company_id=self.uid("company"),
                login_name=person.username,
                secret_hash=hash_secret(self.password),
                must_change_secret=False,
                updated_at=self.clock.at(),
            )
        for t in self.templates:
            insert(
                self.conn,
                "checklist_templates",
                id=t.id,
                company_id=self.uid("company"),
                name=t.name,
                kind=t.kind,
                version=t.version,
                approved=False,
                items=[i.model_dump(mode="json", by_alias=True) for i in t.items],
                created_by=self.uid("owner"),
                created_at=self.clock.at(-180),
                revision_reason="Demo starter only. Actual checklist approval remains an owner decision.",
            )
        fleet(self)
        corrections(self)
        workforce(self)
        customer_work(self)
        self.ai_sample_id = assistant_sample(self)
        audit(
            self.conn,
            self.clock,
            "demo-ingested",
            self.uid("company"),
            "demo.ingested",
            "Reusable demo loaded",
            offset=0,
        )
        return self.validate()

    def validate(self):
        from app.adapters.company import CompanyStore
        from app.adapters.operations import rows

        result = []
        for index, car in enumerate(self.config.cars, 1):
            car_id = self.uid("car:" + car.key)
            business = self.commercial.get(self.owner, car_id, self.conn)
            for task in [t for (key, _), t in self.tasks.items() if key == car.key]:
                loaded = self.ops.task(self.owner, task.id, self.conn)
                if len(loaded.allocations) != len(loaded.items):
                    raise RuntimeError("Incomplete demo check allocations")
            if car.key in self.jobs:
                ServiceFinanceStore(self.workflows).get(self.owner, self.jobs[car.key], self.conn)
            if car.key in self.purchase_ids:
                purchase = self.purchases.get(self.owner, self.purchase_ids[car.key], self.conn)
                if purchase.status in {"approved", "acquired"} and not purchase.approval_valid:
                    raise RuntimeError("Demo purchase approval became stale: " + car.key)
            CompanyStore(self.workflows).requirements(self.owner, car_id, self.conn)
            if car.scenario in {"ready_refund", "booked"} and not all(v.clear for v in business.readiness):
                raise RuntimeError(
                    f"Demo ready car {car.key} has blockers: {[v.id for v in business.readiness if not v.clear]}"
                )
            if car.scenario in {"warranty_pending", "warranty_repair", "warranty_closed"} and (
                not business.bookings[0].delivery or not business.claims
            ):
                raise RuntimeError("Demo sold-car sources are missing")
            result.append(
                {
                    "key": car.key,
                    "registration": f"DEMO{index:02}",
                    "carId": str(car_id),
                    "make": car.make,
                    "model": car.model,
                    "scenario": car.scenario,
                    "stage": business.car.stage,
                    "nextAction": car.next_action,
                    "taskIds": {kind: str(t.id) for (key, kind), t in self.tasks.items() if key == car.key},
                    "purchaseId": str(self.purchase_ids[car.key]) if car.key in self.purchase_ids else None,
                    "jobId": str(self.jobs[car.key]) if car.key in self.jobs else None,
                }
            )
        payroll = DemoPayrollReader(self)
        for person in self.config.staff:
            payroll.view(self.owner, self.uid(person.key), self.clock.as_of, self.conn)
        counts = {
            r["name"]: r["count"]
            for r in rows(
                self.conn,
                "SELECT 'cars' name,count(*) count FROM stock_cycles UNION ALL SELECT 'tasks',count(*) FROM tasks UNION ALL SELECT 'answers',count(*) FROM inspection_answers UNION ALL SELECT 'photos',count(*) FROM evidence UNION ALL SELECT 'clips',count(*) FROM video_clips UNION ALL SELECT 'staff',count(*) FROM users UNION ALL SELECT 'attendance',count(*) FROM attendance_sessions UNION ALL SELECT 'salaryStatements',count(*) FROM salary_statements UNION ALL SELECT 'documents',count(*) FROM documents",
            )
        }
        return {"cars": result, "counts": counts, "assistantSampleId": str(self.ai_sample_id)}
