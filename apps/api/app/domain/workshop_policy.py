from dataclasses import dataclass
from uuid import UUID

from app.contracts import Actor
from app.domain.access import can, require
from app.domain.errors import BusinessError
from app.workflow_contracts import JobCommand, RepairJob


def require_owner(actor: Actor):
    if actor.role != "owner":
        raise BusinessError("FORBIDDEN", "Ask the owner to make this change.", 403)


@dataclass(frozen=True)
class JobPlan:
    status: str
    assigned_to: UUID | None = None
    create_part: bool = False
    receive_part: UUID | None = None
    create_qc: bool = False
    reopen: bool = False


def plan_job_command(actor: Actor, job: RepairJob, command: JobCommand) -> JobPlan:
    if actor.company_id != job.company_id:
        raise BusinessError("NOT_FOUND", "This repair is unavailable.", 404)
    if not can(actor, "overview") and job.assigned_to != actor.id:
        raise BusinessError("NOT_FOUND", "This repair is unavailable.", 404)
    if command.action == "assign":
        require(actor, "service")
        if job.status == "completed":
            raise BusinessError("CONFLICT", "Reopen the repair before assigning work.", 409)
        return JobPlan(status=job.status, assigned_to=command.assigned_to)
    if command.action == "reopen":
        require(actor, "service")
        if job.status != "completed":
            raise BusinessError("CONFLICT", "Only an accepted repair can be reopened.", 409)
        return JobPlan(status="in_progress", reopen=True)
    if job.assigned_to != actor.id:
        raise BusinessError("TAKEOVER_REQUIRED", "Take over this repair before updating it.", 409)
    if job.status == "completed":
        raise BusinessError("CONFLICT", "This repair was accepted. Ask the owner to reopen it.", 409)
    if command.action == "start":
        if job.status not in ("assigned", "in_progress", "waiting_parts"):
            raise BusinessError("CONFLICT", "Receive pending parts or complete the QC step first.", 409)
        if any(p.status == "requested" for p in job.parts):
            raise BusinessError("PARTS_PENDING", "Receive pending parts before resuming work.", 409)
        return JobPlan(status="in_progress")
    if command.action == "wait_parts":
        if job.status == "awaiting_qc":
            raise BusinessError("CONFLICT", "Ask for a recheck before changing submitted work.", 409)
        return JobPlan(status="waiting_parts", create_part=bool(command.part_name.strip()))
    if command.action == "receive_part":
        part = next((p for p in job.parts if p.id == command.part_id), None)
        if not part:
            raise BusinessError("NOT_FOUND", "That part is unavailable.", 404)
        if part.status == "received":
            raise BusinessError("CONFLICT", "This part is already marked received.", 409)
        pending = [p for p in job.parts if p.status == "requested" and p.id != part.id]
        return JobPlan(status="waiting_parts" if pending else "in_progress", receive_part=part.id)
    if job.status not in ("assigned", "in_progress"):
        raise BusinessError("CONFLICT", "Resolve the waiting state before sending the repair.", 409)
    if any(p.status == "requested" for p in job.parts):
        raise BusinessError("PARTS_PENDING", "Receive the pending parts before sending the repair.", 409)
    return JobPlan(status="awaiting_qc", create_qc=True)
