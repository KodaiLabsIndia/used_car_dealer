from uuid import UUID

from sqlalchemy import text
from sqlalchemy.engine import Connection


def refresh_car_work(conn: Connection, company_id: UUID, car_id: UUID):
    params = {"company": company_id, "car": car_id}
    counts = (
        conn.execute(
            text("""
        SELECT count(*) AS total,
        count(*) FILTER(WHERE status='waiting_parts') AS waiting,
        count(*) FILTER(WHERE status='awaiting_qc') AS qc,
        count(*) FILTER(WHERE status<>'completed') AS active
        FROM repair_jobs WHERE company_id=:company AND cycle_id=:car
    """),
            params,
        )
        .mappings()
        .one()
    )
    issues = conn.execute(
        text("""
        SELECT count(*) FROM issues WHERE company_id=:company AND cycle_id=:car AND status<>'resolved'
    """),
        params,
    ).scalar_one()
    status = (
        "waiting_parts"
        if counts["waiting"]
        else "in_service"
        if counts["active"]
        else "done"
        if counts["total"]
        else "none"
    )
    next_action = (
        "Waiting for parts"
        if counts["waiting"]
        else "Complete repair evidence and QC"
        if counts["qc"]
        else "Repair work in progress"
        if counts["active"]
        else "Assign repairs for open issues"
        if issues
        else "Review remaining inspection and purchase requirements"
    )
    conn.execute(
        text("""
        UPDATE stock_cycles SET service_status=:status,next_action=:next,version=version+1,updated_at=now(),
        stage=CASE WHEN stage='ready' AND :blocked THEN 'refurbishment' ELSE stage END
        WHERE id=:car AND company_id=:company
    """),
        params | {"status": status, "next": next_action, "blocked": bool(issues or counts["active"])},
    )
