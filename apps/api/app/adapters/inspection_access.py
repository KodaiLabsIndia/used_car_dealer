"""Shared SQL predicates and allocation loading; no UI-only authorization."""

from sqlalchemy import text

from app.contracts import CheckAllocation

TASK_OWN = """((NOT t.collaborative AND t.assigned_to=:actor) OR (t.collaborative AND EXISTS(
 SELECT 1 FROM inspection_check_allocations own_check WHERE own_check.task_id=t.id AND own_check.company_id=t.company_id AND own_check.assigned_to=:actor)))"""
TASK_VISIBLE = f"(:owner OR {TASK_OWN})"


def allocations(conn, company, task):
    result = conn.execute(
        text("""SELECT c.item_id,c.assigned_to,u.name assignee_name,c.assignment_version,c.version,c.state,
    a.recorded_by answered_by,w.name answered_by_name,c.reviewed_by,c.reviewed_at,c.review_note
    FROM inspection_check_allocations c LEFT JOIN users u ON u.id=c.assigned_to AND u.company_id=c.company_id
    LEFT JOIN inspection_answers a ON a.task_id=c.task_id AND a.company_id=c.company_id AND a.item_id=c.item_id
    LEFT JOIN users w ON w.id=a.recorded_by AND w.company_id=a.company_id
    WHERE c.task_id=:task AND c.company_id=:company ORDER BY c.item_id"""),
        {"task": task, "company": company},
    ).mappings()
    return [CheckAllocation.model_validate(dict(r)) for r in result]
