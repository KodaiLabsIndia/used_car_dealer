from sqlalchemy import text

from app.contracts import Actor
from app.decision_contracts import Decisions
from app.domain.access import can, require

# One query defines both count and pages, keeping the owner badge reconcilable.
QUERY = """WITH pending AS (
 SELECT t.id,CASE WHEN t.status='submitted' THEN 'inspection' ELSE 'help' END AS kind,t.cycle_id,
 t.title,'task' AS target_type,t.id AS target_id,t.updated_at AS created_at
 FROM tasks t WHERE t.company_id=:company AND :review AND
 (t.status='submitted' OR EXISTS(SELECT 1 FROM help_requests h WHERE h.task_id=t.id AND h.company_id=t.company_id AND h.status='open'))
 UNION ALL
 SELECT p.id,'purchase',p.cycle_id,'Purchase approval','purchase',p.cycle_id,p.updated_at FROM purchases p WHERE p.company_id=:company AND :owner AND p.status='submitted'
 UNION ALL
 SELECT q.id,'quote',j.cycle_id,'Repair quote approval','service_finance',q.job_id,q.created_at FROM repair_quotes q
 JOIN repair_jobs j ON j.id=q.job_id AND j.company_id=q.company_id
 WHERE q.company_id=:company AND :owner AND NOT EXISTS(SELECT 1 FROM repair_quote_approvals a WHERE a.quote_id=q.id)
 AND NOT EXISTS(SELECT 1 FROM repair_quotes newer WHERE newer.company_id=q.company_id AND newer.job_id=q.job_id AND newer.revision>q.revision)
 UNION ALL
 SELECT d.id,'document',d.cycle_id,'Document page review','documents',d.cycle_id,d.created_at FROM documents d WHERE d.company_id=:company AND :owner
 AND NOT EXISTS(SELECT 1 FROM document_reviews r WHERE r.document_id=d.id)
 UNION ALL
 SELECT w.id,'claim',w.cycle_id,'Warranty complaint review','business',w.cycle_id,w.reported_at FROM warranty_claims w WHERE w.company_id=:company AND :owner AND w.status='open'
 UNION ALL
 SELECT h.id,'hold',h.cycle_id,'Car hold needs resolution','stock',h.cycle_id,h.created_at FROM stock_holds h WHERE h.company_id=:company AND :service AND h.resolved_at IS NULL
 ) SELECT p.id,p.kind,p.cycle_id AS car_id,v.make||' '||v.model||' · '||v.registration AS car_label,
 p.title,p.target_type,p.target_id,p.created_at FROM pending p JOIN stock_cycles s ON s.id=p.cycle_id AND s.company_id=:company
 JOIN vehicles v ON v.id=s.vehicle_id AND v.company_id=s.company_id
"""


def params(actor: Actor):
    return {
        "company": actor.company_id,
        "owner": can(actor, "finance"),
        "review": can(actor, "review_inspection"),
        "service": can(actor, "service"),
    }


def decision_count(conn, actor: Actor):
    if not can(actor, "overview"):
        return 0
    return conn.execute(text("SELECT count(*) FROM (" + QUERY + ") all_pending"), params(actor)).scalar_one()


class DecisionStore:
    def __init__(self, engine):
        self.engine = engine

    def list(self, actor: Actor, limit=30, offset=0):
        require(actor, "overview")
        with self.engine.connect().execution_options(isolation_level="REPEATABLE READ") as conn:
            with conn.begin():
                items = list(
                    conn.execute(
                        text(QUERY + " ORDER BY created_at,id LIMIT :limit OFFSET :offset"),
                        params(actor) | {"limit": limit, "offset": offset},
                    ).mappings()
                )
                return Decisions(items=items, total=decision_count(conn, actor), limit=limit, offset=offset)
