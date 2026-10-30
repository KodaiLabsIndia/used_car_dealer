import json
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.adapters.operations import rows
from app.adapters.workflows import WorkflowStore
from app.contracts import Actor
from app.domain.access import require
from app.domain.errors import BusinessError
from app.domain.service_finance import validate_service_finance
from app.service_finance_contracts import ServiceFinance, ServiceFinanceCommand


class ServiceFinanceStore:
    def __init__(self, workflows: WorkflowStore):
        self.workflows = workflows
        self.engine = workflows.engine

    def get(self, actor: Actor, job_id: UUID, conn=None) -> ServiceFinance:
        if conn is None:
            with self.engine.connect() as connection:
                return self.get(actor, job_id, connection)
        job = self.workflows.job(actor, job_id, conn)
        params = {"company": actor.company_id, "job": job_id}
        quotes = rows(
            conn,
            """SELECT q.id,q.revision,q.lines,q.charges_paise,q.total_paise,q.note,
            COALESCE(a.decision,'pending') AS decision,COALESCE(a.reason,'') AS reason,
            u.name AS recorded_by_name,r.name AS approved_by_name,q.created_at
            FROM repair_quotes q JOIN users u ON u.id=q.recorded_by AND u.company_id=q.company_id
            LEFT JOIN repair_quote_approvals a ON a.quote_id=q.id AND a.company_id=q.company_id
            LEFT JOIN users r ON r.id=a.recorded_by AND r.company_id=a.company_id
            WHERE q.company_id=:company AND q.job_id=:job ORDER BY q.revision DESC""",
            params,
        )
        invoices = rows(
            conn,
            """SELECT i.id,i.reference,i.amount_paise,i.occurred_at,i.quote_id,u.name AS recorded_by_name,
            EXISTS(SELECT 1 FROM vehicle_ledger_reversals r WHERE r.entry_id=i.ledger_id AND r.company_id=i.company_id) AS reversed
            FROM repair_invoices i JOIN users u ON u.id=i.recorded_by AND u.company_id=i.company_id
            WHERE i.company_id=:company AND i.job_id=:job ORDER BY i.created_at DESC""",
            params,
        )
        payments = rows(
            conn,
            """SELECT p.id,p.reference,p.amount_paise,p.note,p.occurred_at,u.name AS recorded_by_name,
            EXISTS(SELECT 1 FROM repair_payment_reversals r WHERE r.payment_id=p.id AND r.company_id=p.company_id) AS reversed
            FROM repair_vendor_payments p JOIN users u ON u.id=p.recorded_by AND u.company_id=p.company_id
            WHERE p.company_id=:company AND p.job_id=:job ORDER BY p.created_at DESC""",
            params,
        )
        total = sum(i["amount_paise"] for i in invoices if not i["reversed"])
        paid = sum(p["amount_paise"] for p in payments if not p["reversed"])
        return ServiceFinance(
            job=job,
            quotes=quotes,
            invoices=invoices,
            payments=payments,
            invoice_total_paise=total,
            paid_paise=paid,
            balance_paise=max(0, total - paid),
            advance_paise=max(0, paid - total),
        )

    def run(self, actor: Actor, job_id: UUID, command: ServiceFinanceCommand):
        if command.action != "quote":
            require(actor, "finance")

        def authorize(conn):
            job = self.workflows.job(actor, job_id, conn)
            self.workflows.lock_car(conn, actor, job.car_id)
            conn.execute(
                text("SELECT id FROM repair_jobs WHERE id=:job AND company_id=:company FOR UPDATE"),
                {"job": job_id, "company": actor.company_id},
            )

        def execute(conn):
            current = self.get(actor, job_id, conn)
            validate_service_finance(current, command)
            p = {
                "company": actor.company_id,
                "job": job_id,
                "actor": actor.id,
                "car": current.job.car_id,
                "id": uuid4(),
            }
            if command.action == "correct_vendor_payment":
                conn.execute(
                    text(
                        "INSERT INTO repair_payment_reversals(payment_id,company_id,reason,recorded_by) VALUES(:payment,:company,:reason,:actor)"
                    ),
                    p | {"payment": command.payment_id, "reason": command.reason.strip()},
                )
            elif command.action == "quote":
                conn.execute(
                    text("""INSERT INTO repair_quotes(id,company_id,job_id,revision,lines,charges_paise,total_paise,note,recorded_by)
                    VALUES(:id,:company,:job,:revision,CAST(:lines AS jsonb),:charges,:total,:note,:actor)"""),
                    p
                    | {
                        "revision": current.quotes[0].revision + 1 if current.quotes else 1,
                        "lines": json.dumps(
                            [x.model_dump(mode="json", by_alias=True) for x in command.lines]
                        ),
                        "charges": command.charges_paise,
                        "total": sum(x.quantity * x.unit_paise for x in command.lines)
                        + command.charges_paise,
                        "note": command.note.strip(),
                    },
                )
            elif command.action == "decide_quote":
                conn.execute(
                    text("""INSERT INTO repair_quote_approvals(quote_id,company_id,job_id,decision,reason,recorded_by)
                    VALUES(:quote,:company,:job,:decision,:reason,:actor)"""),
                    p
                    | {
                        "quote": command.quote_id,
                        "decision": command.decision,
                        "reason": command.reason.strip(),
                    },
                )
            else:
                p |= {
                    "quote": command.quote_id,
                    "amount": command.amount_paise,
                    "reference": command.reference.strip(),
                    "key": command.reference.strip().casefold(),
                    "occurred": command.occurred_at,
                }
                if command.action == "invoice":
                    claim = rows(
                        conn,
                        "SELECT id,approved_limit_paise FROM warranty_claims WHERE company_id=:company AND issue_id=:issue AND status='approved'",
                        p | {"issue": current.job.issue_id},
                    )
                    claim_id = claim[0]["id"] if claim else None
                    if claim:
                        used = conn.execute(
                            text(
                                "SELECT COALESCE(sum(l.amount_paise),0) FROM vehicle_ledger l WHERE l.company_id=:company AND l.claim_id=:claim AND NOT EXISTS(SELECT 1 FROM vehicle_ledger_reversals r WHERE r.entry_id=l.id AND r.company_id=l.company_id)"
                            ),
                            p | {"claim": claim_id},
                        ).scalar_one()
                        if used + command.amount_paise > claim[0]["approved_limit_paise"]:
                            raise BusinessError(
                                "CLAIM_BUDGET",
                                "This invoice exceeds the approved warranty claim budget.",
                                409,
                            )
                    ledger = uuid4()
                    conn.execute(
                        text("""INSERT INTO vehicle_ledger(id,company_id,cycle_id,kind,category,amount_paise,reference,reference_key,note,claim_id,recorded_by,occurred_at)
                        VALUES(:ledger,:company,:car,'cost',:category,:amount,:reference,:ledger_key,:note,:claim,:actor,:occurred)"""),
                        p
                        | {
                            "ledger": ledger,
                            "category": "warranty" if claim else "repair",
                            "ledger_key": "job-invoice:" + str(p["id"]),
                            "note": "Workshop invoice · " + current.job.title,
                            "claim": claim_id,
                        },
                    )
                    conn.execute(
                        text("""INSERT INTO repair_invoices(id,company_id,cycle_id,job_id,quote_id,reference,reference_key,vendor_key,amount_paise,ledger_id,recorded_by,occurred_at)
                        VALUES(:id,:company,:car,:job,:quote,:reference,:key,:vendor,:amount,:ledger,:actor,:occurred)"""),
                        p
                        | {
                            "ledger": ledger,
                            "vendor": str(current.job.workshop_id) if current.job.workshop_id else "internal",
                        },
                    )
                else:
                    conn.execute(
                        text("""INSERT INTO repair_vendor_payments(id,company_id,job_id,quote_id,reference,reference_key,amount_paise,note,recorded_by,occurred_at)
                        VALUES(:id,:company,:job,:quote,:reference,:key,:amount,:note,:actor,:occurred)"""),
                        p | {"note": command.note.strip()},
                    )
            conn.execute(
                text(
                    "UPDATE repair_jobs SET version=version+1,updated_at=now() WHERE id=:job AND company_id=:company"
                ),
                p,
            )
            conn.execute(
                text(
                    "UPDATE stock_cycles SET version=version+1,updated_at=now() WHERE id=:car AND company_id=:company"
                ),
                p,
            )
            self.workflows.event(
                conn,
                actor,
                current.job.car_id,
                "service_finance." + command.action,
                {
                    "quote": "Repair quote revision recorded",
                    "decide_quote": "Repair quote reviewed",
                    "invoice": "Workshop invoice recorded",
                    "vendor_payment": "Vendor payment recorded",
                    "correct_vendor_payment": "Vendor payment entry corrected",
                }[command.action],
                jobId=str(job_id),
                **command.model_dump(mode="json", exclude={"command_id", "expected_version", "action"}),
            )
            return self.get(actor, job_id, conn)

        try:
            return self.workflows.commands.run(
                actor,
                command.command_id,
                f"job:{job_id}:finance",
                command,
                ServiceFinance,
                execute,
                authorize,
            )
        except IntegrityError as error:
            raise BusinessError(
                "DUPLICATE_REFERENCE", "This invoice or payment reference is already recorded.", 409
            ) from error
