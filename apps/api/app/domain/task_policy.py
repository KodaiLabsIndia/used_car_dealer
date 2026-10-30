from dataclasses import dataclass
from uuid import UUID

from app.contracts import Actor, Answer, Task, TaskCommand
from app.domain.access import can
from app.domain.errors import BusinessError


@dataclass(frozen=True)
class TaskPlan:
    status: str | None = None
    assigned_to: UUID | None = None
    answer: Answer | None = None
    help_request: dict | None = None
    submit: bool = False
    review: dict | None = None
    recheck_items: list[str] | None = None


def plan_task_command(actor: Actor, task: Task, command: TaskCommand) -> TaskPlan:
    if actor.company_id != task.company_id or (not can(actor, "overview") and task.assigned_to != actor.id):
        raise BusinessError("NOT_FOUND", "This work is unavailable.", 404)
    if command.action in ("takeover", "assign"):
        if not can(actor, "assign_inspection"):
            raise BusinessError("FORBIDDEN", "A supervisor must assign this work.", 403)
        if task.status in ("submitted", "completed"):
            raise BusinessError("CONFLICT", "Review or return submitted work before reassigning it.", 409)
        return TaskPlan(assigned_to=actor.id if command.action == "takeover" else command.assigned_to)
    if command.action == "review":
        if not can(actor, "review_inspection"):
            raise BusinessError("FORBIDDEN", "A supervisor must review this work.", 403)
        if actor.role != "owner" and (task.submitted_by or task.assigned_to) == actor.id:
            raise BusinessError(
                "INDEPENDENT_REVIEW_REQUIRED", "Ask another supervisor to review your work.", 403
            )
        if task.status != "submitted":
            raise BusinessError("CONFLICT", "This work is not waiting for review.", 409)
        if command.recheck_item_ids and command.decision != "recheck":
            raise BusinessError("INVALID_REVIEW", "Accept the work or return checks for a recheck.")
        if len(set(command.recheck_item_ids)) != len(command.recheck_item_ids) or not set(
            command.recheck_item_ids
        ) <= {i.id for i in task.items}:
            raise BusinessError("INVALID_ITEM", "Choose checks from this inspection only.")
        if (
            command.decision == "accept"
            and task.kind == "repair_qc"
            and any(a.result == "problem" for a in task.answers)
        ):
            raise BusinessError(
                "QC_FAILED", "This repair still has a reported problem. Request a recheck.", 409
            )
        return TaskPlan(
            status="completed" if command.decision == "accept" else "recheck",
            review={
                "decision": command.decision,
                "selfReview": (task.submitted_by or task.assigned_to) == actor.id,
                **({"note": command.note.strip()} if command.note.strip() else {}),
            },
            recheck_items=(command.recheck_item_ids or [i.id for i in task.items])
            if command.decision == "recheck"
            else [],
        )
    if task.status in ("submitted", "completed"):
        raise BusinessError(
            "CONFLICT", "This check was already sent. Ask for a recheck to make changes.", 409
        )
    if task.assigned_to != actor.id:
        raise BusinessError("TAKEOVER_REQUIRED", "Take over this task before doing the check.", 409)
    if command.action == "help":
        if command.item_id and not any(i.id == command.item_id for i in task.items):
            raise BusinessError("INVALID_ITEM", "That check is not part of this task.")
        return TaskPlan(help_request={"itemId": command.item_id, "note": command.note})
    if command.action == "answer":
        if not any(i.id == command.item_id for i in task.items):
            raise BusinessError("INVALID_ITEM", "That check is not part of this task.")
        if not any(e.id == command.evidence_id and e.item_id == command.item_id for e in task.evidence):
            raise BusinessError("EVIDENCE_REQUIRED", "Send the photo for this check first.")
        item = next(i for i in task.items if i.id == command.item_id)
        if command.result in ("unable", "not_applicable") and len(command.note.strip()) < 5:
            raise BusinessError(
                "REASON_REQUIRED", "Explain why this check cannot be performed or does not apply."
            )
        if command.result == "not_applicable" and not item.configuration_pending:
            raise BusinessError(
                "INVALID_EXCEPTION", "This required check applies. Ask for help if it cannot be inspected."
            )
        if command.result in ("ok", "problem"):
            if item.configuration_pending and not command.applicability_confirmed:
                raise BusinessError(
                    "CONFIGURATION_REQUIRED",
                    "Confirm this equipment is fitted before recording its condition.",
                )
            if item.measurement_unit and command.reading is None:
                raise BusinessError("MEASUREMENT_REQUIRED", "Record the measured value and its photo.")
        if command.item_id in task.recheck_items and any(
            a.item_id == command.item_id and a.evidence_id == command.evidence_id for a in task.answers
        ):
            raise BusinessError("FRESH_EVIDENCE_REQUIRED", "Take a new photo for this recheck.")
        return TaskPlan(
            status="in_progress",
            answer=Answer.model_validate(
                command.model_dump(exclude={"action", "command_id", "expected_version"})
            ),
            recheck_items=[i for i in task.recheck_items if i != command.item_id],
        )
    complete = bool(task.items) and all(
        any(
            a.item_id == i.id
            and a.result != "unable"
            and (not i.requires_clip or a.result == "not_applicable" or i.id in task.clip_item_ids)
            and any(e.id == a.evidence_id and e.item_id == i.id for e in task.evidence)
            for a in task.answers
        )
        for i in task.items
        if i.required
    )
    if not complete or task.recheck_items:
        raise BusinessError(
            "INCOMPLETE",
            "Resolve every required check, including required photos and video clips. Unable-to-check items remain unfinished.",
        )
    return TaskPlan(status="submitted", submit=True)


def normalized_photo_size(width: int, height: int) -> tuple[int, int]:
    if width <= 0 or height <= 0:
        raise ValueError("Invalid photo dimensions")
    bounds = (1080, 1920) if height > width else (1920, 1080)
    scale = min(1, bounds[0] / width, bounds[1] / height)
    return max(1, int(width * scale)), max(1, int(height * scale))
