import csv
import io

from sqlalchemy import text

from app.domain.errors import BusinessError
from app.domain.workshop_policy import require_owner
from app.report_contracts import OperationsReport, ReportAmounts

# Invoices already post one cost ledger entry. Payments and advances stay separate.
# Reconcile per booking/job before aggregating so unrelated balances cannot net out.
QUERY = """WITH ledger AS (
 SELECT l.* FROM vehicle_ledger l WHERE l.company_id=:company
 AND NOT EXISTS(SELECT 1 FROM vehicle_ledger_reversals r WHERE r.entry_id=l.id AND r.company_id=l.company_id)
), seller AS (
 SELECT p.purchase_id,sum(p.amount_paise)::bigint AS paid FROM purchase_payments p WHERE p.company_id=:company
 AND NOT EXISTS(SELECT 1 FROM purchase_payment_reversals r WHERE r.payment_id=p.id AND r.company_id=p.company_id) GROUP BY p.purchase_id
), purchase AS (
 SELECT p.cycle_id,CASE WHEN p.status IN ('approved','acquired') AND p.approved_terms_version=p.terms_version THEN (p.terms->>'purchasePricePaise')::bigint ELSE 0 END AS committed,
 COALESCE(s.paid,0) AS paid,p.received_at FROM purchases p LEFT JOIN seller s ON s.purchase_id=p.id WHERE p.company_id=:company
), booking AS (
 SELECT b.cycle_id,b.status,b.sale_price_paise,COALESCE(sum(l.amount_paise) FILTER(WHERE l.kind='receipt'),0)::bigint AS collected,
 COALESCE(sum(l.amount_paise) FILTER(WHERE l.kind='refund'),0)::bigint AS refunded
 FROM sale_bookings b LEFT JOIN ledger l ON l.booking_id=b.id WHERE b.company_id=:company GROUP BY b.id
), buyer AS (
 SELECT cycle_id,sum(collected)::bigint AS collected,sum(refunded)::bigint AS refunded,
 sum(CASE WHEN status IN ('booked','delivered') THEN greatest(0,sale_price_paise-collected+refunded) ELSE 0 END)::bigint AS balance,
 sum(CASE WHEN status='cancelled' THEN greatest(0,collected-refunded) ELSE 0 END)::bigint AS refund_due FROM booking GROUP BY cycle_id
), invoices AS (
 SELECT i.job_id,sum(i.amount_paise)::bigint AS total FROM repair_invoices i JOIN ledger l ON l.id=i.ledger_id WHERE i.company_id=:company GROUP BY i.job_id
), vendor_paid AS (
 SELECT p.job_id,sum(p.amount_paise)::bigint AS paid FROM repair_vendor_payments p WHERE p.company_id=:company
 AND NOT EXISTS(SELECT 1 FROM repair_payment_reversals r WHERE r.payment_id=p.id AND r.company_id=p.company_id) GROUP BY p.job_id
), jobs AS (
 SELECT j.cycle_id,count(*) FILTER(WHERE j.status<>'completed')::integer AS open_jobs,
 count(*) FILTER(WHERE j.status='waiting_parts')::integer AS waiting_jobs,min(j.due_at) FILTER(WHERE j.status<>'completed') AS oldest_due_at,
 sum(COALESCE(p.paid,0))::bigint AS paid,
 sum(greatest(0,COALESCE(i.total,0)-COALESCE(p.paid,0)))::bigint AS balance,
 sum(greatest(0,COALESCE(p.paid,0)-COALESCE(i.total,0)))::bigint AS advance
 FROM repair_jobs j LEFT JOIN invoices i ON i.job_id=j.id LEFT JOIN vendor_paid p ON p.job_id=j.id WHERE j.company_id=:company GROUP BY j.cycle_id
), costs AS (
 SELECT cycle_id,COALESCE(sum(amount_paise) FILTER(WHERE kind='cost' AND category<>'warranty'),0)::bigint AS running,
 COALESCE(sum(amount_paise) FILTER(WHERE kind='cost' AND category='warranty'),0)::bigint AS warranty FROM ledger GROUP BY cycle_id
), report AS (
 SELECT s.id AS car_id,s.stock_number,v.make||' '||v.model AS car_label,v.registration,s.stage,s.commercial_status,s.location,
 CASE WHEN p.received_at IS NULL THEN NULL ELSE greatest(0,floor(extract(epoch FROM (COALESCE(d.delivered_at,:cutoff)-p.received_at))/86400))::integer END AS stock_age_days,
 COALESCE(j.open_jobs,0) AS open_jobs,COALESCE(j.waiting_jobs,0) AS waiting_jobs,j.oldest_due_at,
 COALESCE(p.committed,0) AS purchase_committed_paise,COALESCE(p.paid,0) AS seller_paid_paise,greatest(0,COALESCE(p.committed,0)-COALESCE(p.paid,0)) AS seller_balance_paise,
 COALESCE(c.running,0) AS recorded_costs_paise,COALESCE(c.warranty,0) AS warranty_costs_paise,
 COALESCE(b.collected,0) AS buyer_collected_paise,COALESCE(b.refunded,0) AS buyer_refunded_paise,COALESCE(b.balance,0) AS buyer_balance_paise,COALESCE(b.refund_due,0) AS refund_due_paise,
 COALESCE(j.paid,0) AS vendor_paid_paise,COALESCE(j.balance,0) AS vendor_balance_paise,COALESCE(j.advance,0) AS vendor_advance_paise
 FROM stock_cycles s JOIN vehicles v ON v.id=s.vehicle_id AND v.company_id=s.company_id
 LEFT JOIN purchase p ON p.cycle_id=s.id LEFT JOIN buyer b ON b.cycle_id=s.id LEFT JOIN jobs j ON j.cycle_id=s.id LEFT JOIN costs c ON c.cycle_id=s.id
 LEFT JOIN LATERAL(SELECT max(delivered_at) AS delivered_at FROM sale_deliveries WHERE cycle_id=s.id AND company_id=s.company_id) d ON true
 WHERE s.company_id=:company AND (:scope='all' OR (:scope='stock' AND s.commercial_status<>'sold') OR (:scope='sold' AND s.commercial_status='sold'))
 AND (:search='' OR concat_ws(' ',s.stock_number,v.make,v.model,v.registration) ILIKE :pattern)
) """


class ReportStore:
    def __init__(self, engine):
        self.engine = engine

    def operations(self, actor, scope="all", search="", limit=30, offset=0):
        require_owner(actor)
        with self.engine.connect().execution_options(isolation_level="REPEATABLE READ") as conn:
            with conn.begin():
                cutoff = conn.execute(text("SELECT now()")).scalar_one()
                params = {
                    "company": actor.company_id,
                    "scope": scope,
                    "search": search,
                    "pattern": "%" + search + "%",
                    "cutoff": cutoff,
                    "limit": limit,
                    "offset": offset,
                }
                aggregate = ",".join(
                    "COALESCE(sum(" + name + "),0)::bigint AS " + name for name in ReportAmounts.model_fields
                )
                summary = dict(
                    conn.execute(
                        text(QUERY + "SELECT count(*) AS total," + aggregate + " FROM report"), params
                    )
                    .mappings()
                    .one()
                )
                count = summary.pop("total")
                items = list(
                    conn.execute(
                        text(
                            QUERY
                            + "SELECT * FROM report ORDER BY stock_age_days DESC NULLS LAST,car_id LIMIT :limit OFFSET :offset"
                        ),
                        params,
                    ).mappings()
                )
                return OperationsReport(
                    cutoff=cutoff, items=items, totals=summary, total=count, limit=limit, offset=offset
                )

    def export(self, actor, scope="all", search=""):
        report = self.operations(actor, scope, search, limit=10000)
        if report.total > 10000:
            raise BusinessError("EXPORT_TOO_LARGE", "Narrow the report before exporting.")
        output = io.StringIO(newline="")
        writer = csv.writer(output)
        writer.writerow(["Report cutoff", report.cutoff.isoformat()])
        writer.writerow(
            ["Amounts are integer paise. Stock age starts at physical receipt and stops at delivery."]
        )
        columns = list(type(report.items[0]).model_fields) if report.items else ["car_id", "stock_number"]
        writer.writerow(columns)
        for row in report.items:
            data = row.model_dump(mode="json")
            values = []
            for key in columns:
                value = data[key]
                if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")):
                    value = "'" + value
                values.append(value)
            writer.writerow(values)
        return output.getvalue()
