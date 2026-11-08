"""Frozen checklist snapshots, real sample media and attributed per-check states."""

from collections import defaultdict

from sqlalchemy import text

from app.contracts import VehicleConfiguration
from app.demo.core import audit, insert, wire
from app.domain.inspection import resolve_checks
from app.domain.inspection_allocation import master_status

PERSON_FOR_ZONE = {
    "identity": "office",
    "wheels": "service",
    "powertrain": "service",
    "underbody": "service",
    "safety": "supervisor",
    "road_test": "owner",
}


def inspection(builder, car, kind="pre_purchase", profile="complete", offset=-2):
    uid = builder.uid
    c, clock = builder.conn, builder.clock
    company, car_id = uid("company"), uid("car:" + car.key)
    templates = [t for t in builder.templates if t.kind == kind]
    template = max(templates, key=lambda t: len(t.items))
    config = VehicleConfiguration(body_type=car.body, fuel=car.fuel, transmission=car.transmission)
    items = resolve_checks(template.items, config)
    id = uid(f"task:{car.key}:{kind}")
    insert(
        c,
        "tasks",
        id=id,
        company_id=company,
        cycle_id=car_id,
        title=template.name.replace(" · draft", ""),
        assigned_to=uid("supervisor"),
        items=[i.model_dump(mode="json", by_alias=True) for i in items],
        due_at=clock.at(1, 18),
        kind=kind,
        template_id=template.id,
        template_name=template.name,
        template_version=template.version,
        template_approved=False,
        vehicle_configuration=config.model_dump(mode="json", by_alias=True),
        collaborative=True,
        created_by=uid("owner"),
        updated_at=clock.at(offset),
    )
    counts = defaultdict(int)
    owners = {}
    states = {}
    problem = None
    for item in items:
        index = counts[item.zone]
        counts[item.zone] += 1
        person = PERSON_FOR_ZONE.get(item.zone, "employee")
        state = "accepted"
        if profile == "mixed":
            if item.zone == "identity":
                person = "employee"
                state = "accepted"
            elif item.zone == "wheels":
                state = "submitted" if index < 6 else "recheck" if index < 8 else "assigned"
                person = "service"
            elif item.zone == "powertrain":
                person = "employee"
                state = "in_progress" if index < 4 else "assigned"
            elif item.zone == "cabin":
                person = "employee"
                state = "assigned"
            elif item.zone == "electrical":
                person = "supervisor"
                state = "assigned"
            else:
                person = None
                state = "unassigned"
            if item.zone == "wheels" and index == 1:
                problem = item.id
        elif profile == "submitted":
            state = "submitted"
            person = "employee" if index % 2 == 0 else "service"
        elif profile == "assigned":
            state = "assigned"
            person = "employee"
        owners[item.id] = person
        states[item.id] = state
        if person:
            c.execute(
                text(
                    "INSERT INTO inspection_work_assignments(company_id,task_id,user_id,created_by,origin,created_at) VALUES(:company,:task,:user,:actor,'allocation',:time) ON CONFLICT(task_id,user_id) DO NOTHING"
                ),
                {
                    "company": company,
                    "task": id,
                    "user": uid(person),
                    "actor": uid("owner"),
                    "time": clock.at(offset),
                },
            )
        if state in {"accepted", "submitted", "recheck", "in_progress"}:
            evidence = uid(f"photo:{id}:{item.id}")
            insert(
                c,
                "evidence",
                id=evidence,
                company_id=company,
                task_id=id,
                item_id=item.id,
                uploaded_by=uid(person),
                assignment_version=2,
                profile="photo-fhd-v1",
                created_at=clock.at(offset, 10),
                **builder.media.save(evidence),
            )
            result = "problem" if item.id == problem else "ok"
            reading = {
                "mm": 4.5,
                "psi": 32.0,
                "V": 12.6,
                "km": float(builder.odometers[car.key]) if "odometer" in item.id else 3.0,
            }.get(item.measurement_unit)
            insert(
                c,
                "inspection_answers",
                company_id=company,
                task_id=id,
                item_id=item.id,
                result=result,
                note="Demo: tyre wear reported; review before driving."
                if result == "problem"
                else "Demo sample result; synthetic proof.",
                evidence_id=evidence,
                recorded_by=uid(person),
                reading=reading,
                applicability_confirmed=item.configuration_pending,
                updated_at=clock.at(offset, 10),
            )
            if item.requires_clip:
                clip = uid(f"clip:{id}:{item.id}")
                insert(
                    c,
                    "video_clips",
                    id=clip,
                    company_id=company,
                    task_id=id,
                    item_id=item.id,
                    recorded_by=uid(person),
                    assignment_version=2,
                    profile="video-720-v1",
                    created_at=clock.at(offset, 10),
                    **builder.media.save(clip, True),
                )
        version = {"accepted": 3, "submitted": 2, "recheck": 3, "in_progress": 1}.get(state, 0)
        reviewed = state in {"accepted", "recheck"}
        c.execute(
            text(
                "UPDATE inspection_check_allocations SET assigned_to=:user,assignment_version=2,version=:version,state=:state,reviewed_by=:reviewer,reviewed_at=:time,review_note=:note WHERE task_id=:task AND item_id=:item"
            ),
            {
                "user": uid(person) if person else None,
                "version": version,
                "state": state,
                "reviewer": uid("owner") if reviewed else None,
                "time": clock.at(offset, 12) if reviewed else None,
                "note": "Demo: retake the photo with the reading visible."
                if state == "recheck"
                else "Demo sample review."
                if reviewed
                else "",
                "task": id,
                "item": item.id,
            },
        )
    rechecks = [key for key, state in states.items() if state == "recheck"]
    records = builder.ops.task(builder.owner, id, c).allocations
    status = master_status(records)
    c.execute(
        text(
            "UPDATE tasks SET status=:status,version=4,recheck_items=CAST(:items AS jsonb),recheck_note=:note,updated_at=:time WHERE id=:id"
        ),
        {
            "status": status,
            "items": wire(rechecks),
            "note": "Demo: retake the returned tyre proofs." if rechecks else "",
            "time": clock.at(offset, 13),
            "id": id,
        },
    )
    task = builder.ops.task(builder.owner, id, c)
    for a in task.allocations:
        if a.state in {"accepted", "submitted", "recheck"}:
            after = a.model_dump(mode="json", by_alias=True)
            before = {
                **after,
                "state": "submitted" if a.state in {"accepted", "recheck"} else "in_progress",
                "version": a.version - 1,
                "reviewedBy": None,
                "reviewedAt": None,
                "reviewNote": "",
            }
            insert(
                c,
                "inspection_check_events",
                id=uid(f"check-event:{id}:{a.item_id}"),
                company_id=company,
                task_id=id,
                item_id=a.item_id,
                action="review_checks" if a.state != "submitted" else "submit_checks",
                before_state=before,
                after_state=after,
                reason=a.review_note or "Demo sample submission",
                recorded_by=uid("owner") if a.state != "submitted" else a.assigned_to,
                created_at=clock.at(offset, 12),
            )
    for person in set(p for p in owners.values() if p):
        selected = [
            i for i, p in owners.items() if p == person and states[i] in {"accepted", "submitted", "recheck"}
        ]
        if selected:
            snapshot = {
                "origin": "demo-seed",
                "items": [i.model_dump(mode="json", by_alias=True) for i in task.items if i.id in selected],
                "allocations": [
                    {
                        **a.model_dump(mode="json", by_alias=True),
                        "state": "submitted",
                        "version": 2,
                        "reviewedBy": None,
                        "reviewedAt": None,
                        "reviewNote": "",
                    }
                    for a in task.allocations
                    if a.item_id in selected
                ],
                "answers": [
                    a.model_dump(mode="json", by_alias=True) for a in task.answers if a.item_id in selected
                ],
                "evidence": [
                    e.model_dump(mode="json", by_alias=True) for e in task.evidence if e.item_id in selected
                ],
                "videoClips": [
                    dict(v)
                    for v in c.execute(
                        text(
                            "SELECT id,item_id,sha256,profile,recorded_by,assignment_version,created_at FROM video_clips WHERE task_id=:task AND item_id=ANY(CAST(:items AS text[]))"
                        ),
                        {"task": id, "items": selected},
                    ).mappings()
                ],
            }
            insert(
                c,
                "inspection_portion_submissions",
                id=uid(f"portion:{id}:{person}"),
                company_id=company,
                task_id=id,
                submitted_by=uid(person),
                snapshot=snapshot,
                created_at=clock.at(offset, 11),
            )
    if problem:
        evidence = next(a.evidence_id for a in task.answers if a.item_id == problem)
        insert(
            c,
            "issues",
            id=uid("issue:" + car.key),
            company_id=company,
            cycle_id=car_id,
            task_id=id,
            item_id=problem,
            description="Demo: inspect and confirm the reported tyre wear",
            status="open",
            severity="urgent",
            created_by=uid("service"),
            evidence_id=evidence,
            created_at=clock.at(offset, 11),
        )
        insert(
            c,
            "help_requests",
            id=uid("help:" + car.key),
            company_id=company,
            task_id=id,
            item_id=rechecks[0],
            requested_by=uid("service"),
            note="Demo: please confirm the correct tread measurement point.",
            created_at=clock.at(-1, 14),
        )
    audit(
        c,
        clock,
        "inspection:" + str(id),
        car_id,
        "inspection.allocated",
        f"Demo {kind.replace('_', ' ')}: {len(items)} checks, {status}",
        offset=offset,
        taskId=str(id),
    )
    builder.tasks[(car.key, kind)] = task
    return task
