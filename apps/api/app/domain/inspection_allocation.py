"""Per-check authority and completion rules for one shared inspection."""

from app.contracts import Actor, Task
from app.domain.access import can
from app.domain.errors import BusinessError

MUTABLE = {"assigned", "in_progress", "recheck"}
TERMINAL = {"accepted", "waived"}


def check_for(task: Task, item_id: str):
    check = next((a for a in task.allocations if a.item_id == item_id), None)
    if check is None:
        raise BusinessError("INVALID_ITEM", "Choose a check from this inspection.", 400)
    return check


def require_check(actor: Actor, task: Task, item_id: str, allocation_version: int | None, mutable=True):
    if actor.company_id != task.company_id:
        raise BusinessError("NOT_FOUND", "This work is unavailable.", 404)
    if not task.collaborative:
        if task.assigned_to != actor.id:
            raise BusinessError("TAKEOVER_REQUIRED", "Take over this task before doing the check.", 409)
        if mutable and task.status in ("submitted", "completed"):
            raise BusinessError("CONFLICT", "This check was already sent.", 409)
        return None
    grant = check_for(task, item_id)
    if grant.assigned_to != actor.id:
        raise BusinessError("CHECK_NOT_ASSIGNED", "This check is allocated to someone else.", 403)
    if allocation_version != grant.assignment_version:
        raise BusinessError(
            "ALLOCATION_CHANGED",
            "This allocation changed. Refresh before continuing; your draft stays on the phone.",
            409,
        )
    if mutable and (grant.state not in MUTABLE or task.status == "completed"):
        raise BusinessError("READ_ONLY", "This check is waiting for review or is already accepted.", 409)
    return grant


def authorize_scoped_command(actor, task, command):
    if actor.company_id != task.company_id:
        raise BusinessError("NOT_FOUND", "This work is unavailable.", 404)
    if not task.collaborative:
        return
    if command.action in ("answer", "help"):
        if not command.item_id:
            raise BusinessError("CHECK_REQUIRED", "Choose one of your allocated checks.", 400)
        require_check(actor, task, command.item_id, command.allocation_version, mutable=False)
    elif command.action == "submit_checks":
        for token in command.checks:
            require_check(actor, task, token.item_id, token.assignment_version, mutable=False)
    elif command.action == "review_checks":
        if not can(actor, "review_inspection"):
            raise BusinessError("FORBIDDEN", "A supervisor must review these checks.", 403)
    else:
        raise BusinessError(
            "SCOPED_WORK_REQUIRED",
            "Use the allocation and portion review controls for this shared inspection.",
            409,
        )


def master_status(allocations):
    states = [a.state for a in allocations]
    if states and all(s in TERMINAL for s in states):
        return "completed"
    if states and all(s in TERMINAL | {"submitted"} for s in states):
        return "submitted"
    if "recheck" in states:
        return "recheck"
    if any(s in {"in_progress", "submitted", "accepted", "waived"} for s in states):
        return "in_progress"
    return "assigned"
