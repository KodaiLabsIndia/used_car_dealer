from dataclasses import dataclass, replace
from uuid import UUID

from app.contracts import Actor, Answer, Task, TaskCommand
from app.domain.access import can
from app.domain.errors import BusinessError
from app.domain.inspection_allocation import authorize_scoped_command, check_for, require_check


@dataclass(frozen=True)
class TaskPlan:
    status: str | None = None
    assigned_to: UUID | None = None
    answer: Answer | None = None
    help_request: dict | None = None
    submit: bool = False
    review: dict | None = None
    recheck_items: list[str] | None = None
    check_states: dict[str, str] | None = None
    scope_submitted: list[str] | None = None
    reviewed_item_ids: list[str] | None = None


def plan_legacy_task_command(actor: Actor, task: Task, command: TaskCommand) -> TaskPlan:
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
                command.model_dump(
                    exclude={"action", "command_id", "expected_version", "allocation_version", "item_version"}
                )
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


def plan_task_command(actor: Actor, task: Task, command: TaskCommand) -> TaskPlan:
    if not task.collaborative:
        if command.action in ("submit_checks", "review_checks"):
            raise BusinessError(
                "SCOPED_WORK_REQUIRED", "Allocate this inspection before submitting portions.", 409
            )
        return plan_legacy_task_command(actor, task, command)
    authorize_scoped_command(actor, task, command)
    if task.status == "completed":
        raise BusinessError(
            "INSPECTION_CLOSED",
            "This inspection is complete. Create a follow-up inspection for new work.",
            409,
        )
    if command.action in ("answer", "help"):
        grant = require_check(actor, task, command.item_id, command.allocation_version)
        if command.action == "answer":
            if command.item_version != grant.version:
                raise BusinessError(
                    "VERSION_CONFLICT", "This check changed. Review its current result before saving.", 409
                )
            proof = next(
                (e for e in task.evidence if e.id == command.evidence_id and e.item_id == command.item_id),
                None,
            )
            if proof and (
                proof.assignment_version != grant.assignment_version or proof.uploaded_by != actor.id
            ):
                raise BusinessError(
                    "FRESH_EVIDENCE_REQUIRED", "Use a photo admitted under your current allocation.", 409
                )
        local = task.model_copy(update={"assigned_to": actor.id, "status": "in_progress"})
        plan = plan_legacy_task_command(actor, local, command)
        return replace(
            plan,
            status=None,
            check_states={command.item_id: "in_progress"} if command.action == "answer" else None,
        )
    tokens = command.checks
    if len({c.item_id for c in tokens}) != len(tokens):
        raise BusinessError("INVALID_ITEM", "Choose each check only once.", 400)
    grants = []
    for token in tokens:
        grant = check_for(task, token.item_id)
        if (token.assignment_version, token.version) != (grant.assignment_version, grant.version):
            raise BusinessError(
                "VERSION_CONFLICT", "An allocated check changed. Refresh before continuing.", 409
            )
        grants.append(grant)
    ids = [g.item_id for g in grants]
    if command.action == "submit_checks":
        for token in tokens:
            require_check(actor, task, token.item_id, token.assignment_version)
        if any(
            not any(a.item_id == item_id and a.result != "unable" for a in task.answers) for item_id in ids
        ):
            raise BusinessError(
                "INCOMPLETE",
                "Record each selected check. Ask a supervisor to omit an optional check explicitly.",
                409,
            )
        local = task.model_copy(
            update={
                "assigned_to": actor.id,
                "status": "in_progress",
                "items": [i.model_copy(update={"required": True}) for i in task.items if i.id in ids],
                "recheck_items": [i for i in task.recheck_items if i in ids],
            }
        )
        from app.contracts import SubmitCommand

        plan_legacy_task_command(
            actor,
            local,
            SubmitCommand(
                command_id=command.command_id, expected_version=command.expected_version, action="submit"
            ),
        )
        return TaskPlan(check_states=dict.fromkeys(ids, "submitted"), scope_submitted=ids)
    if command.decision in ("recheck", "waive") and len(command.note.strip()) < 5:
        raise BusinessError("REASON_REQUIRED", "Record a reason for the returned or omitted checks.", 400)
    for grant in grants:
        item = next(i for i in task.items if i.id == grant.item_id)
        answer = next((a for a in task.answers if a.item_id == grant.item_id), None)
        if command.decision == "waive":
            if item.required or (answer and answer.result not in ("unable",)):
                raise BusinessError(
                    "INVALID_EXCEPTION",
                    "Only an optional, unrecorded/unable check can be explicitly omitted.",
                    409,
                )
        elif command.decision == "accept":
            if grant.state != "submitted" or answer is None or answer.result == "unable":
                raise BusinessError(
                    "NOT_SUBMITTED",
                    "Review a submitted, recorded result or explicitly omit an optional check.",
                    409,
                )
            if actor.role != "owner" and grant.answered_by == actor.id:
                raise BusinessError(
                    "INDEPENDENT_REVIEW_REQUIRED",
                    "Ask another supervisor to review your own recorded checks.",
                    403,
                )
            if task.kind == "repair_qc" and answer.result == "problem":
                raise BusinessError(
                    "QC_FAILED", "This repair still has a reported problem. Request a recheck.", 409
                )
        elif grant.state not in ("submitted", "accepted", "waived"):
            raise BusinessError("NOT_SUBMITTED", "Return submitted or accepted checks for correction.", 409)
    state = {"accept": "accepted", "recheck": "recheck", "waive": "waived"}[command.decision]
    remaining = [i for i in task.recheck_items if i not in ids]
    return TaskPlan(
        check_states={
            g.item_id: ("unassigned" if state == "recheck" and g.assigned_to is None else state)
            for g in grants
        },
        reviewed_item_ids=ids,
        review={
            "decision": "recheck" if state == "recheck" else "accept",
            "selfReview": any(g.answered_by == actor.id for g in grants),
        },
        recheck_items=remaining + ids if state == "recheck" else remaining,
    )


def normalized_photo_size(width: int, height: int) -> tuple[int, int]:
    if width <= 0 or height <= 0:
        raise ValueError("Invalid photo dimensions")
    bounds = (1080, 1920) if height > width else (1920, 1080)
    scale = min(1, bounds[0] / width, bounds[1] / height)
    return max(1, int(width * scale)), max(1, int(height * scale))
