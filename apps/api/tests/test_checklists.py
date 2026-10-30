from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from test_integration import (
    checked,
    create_car,
)
from test_integration import workspace as workspace


def revision(client, owner, **extra):
    body = {
        "commandId": str(uuid4()),
        "name": "Workshop checks",
        "kind": "intake",
        "basedOnId": None,
        "reason": "Owner-authored training example",
        "items": [
            {
                "id": "brakes",
                "title": "Brake condition",
                "titleHi": "ब्रेक की हालत",
                "instruction": "Show both front brake assemblies.",
                "instructionHi": "दोनों आगे के ब्रेक दिखाएँ।",
                "order": 1,
                "required": True,
            }
        ],
    } | extra
    return client.post("/v1/checklists/revisions", headers=owner, json=body), body


def test_checklist_revision_approval_snapshot_scope_and_immutable_history(workspace):
    client, engine, owner, employee = workspace
    assert client.get("/v1/checklists/manage", headers=employee).status_code == 403
    first, body = revision(client, owner)
    first = checked(first, 201)
    id = first["template"]["id"]
    assert first["template"]["version"] == 1 and not first["template"]["approved"]
    assert checked(client.post("/v1/checklists/revisions", headers=owner, json=body), 201) == first
    assert client.post("/v1/checklists/revisions", headers=employee, json=body).status_code == 403
    approve = {
        "commandId": str(uuid4()),
        "expectedVersion": 1,
        "reason": "Reviewed the wording and each required photo.",
        "instructionsReviewed": False,
    }
    assert client.post(f"/v1/checklists/{id}/approve", headers=owner, json=approve).status_code == 400
    approve["instructionsReviewed"] = True
    accepted = checked(client.post(f"/v1/checklists/{id}/approve", headers=owner, json=approve))
    assert accepted["template"]["approved"] and accepted["approval"]["reviewerName"] == "Owner"
    assert checked(client.post(f"/v1/checklists/{id}/approve", headers=owner, json=approve)) == accepted
    created, carbody = create_car(client, owner, registration="MH02QA1919")
    created = checked(created, 201)
    task = checked(
        client.post(
            f"/v1/cars/{created['car']['id']}/inspections",
            headers=owner,
            json={"commandId": str(uuid4()), "templateId": id, "assignedTo": created["task"]["assignedTo"]},
        ),
        201,
    )
    modified = [dict(body["items"][0], title="Brake and hose condition")]
    second, _ = revision(client, owner, basedOnId=id, items=modified)
    second = checked(second, 201)
    assert second["template"]["version"] == 2 and not second["template"]["approved"]
    prior = checked(client.get(f"/v1/tasks/{task['id']}", headers=owner))
    assert prior["items"][0]["title"] == "Brake condition" and prior["templateApproved"]
    assert prior["templateVersion"] == 1
    assert revision(client, owner, basedOnId=id)[0].status_code == 409
    assert (
        revision(client, owner, basedOnId=second["template"]["id"], kind="pre_purchase")[0].status_code == 400
    )
    with pytest.raises(DBAPIError), engine.begin() as conn:
        conn.execute(text("UPDATE checklist_templates SET items='[]'::jsonb WHERE id=:id"), {"id": id})
    with pytest.raises(DBAPIError), engine.begin() as conn:
        conn.execute(
            text("UPDATE checklist_approvals SET reason='changed' WHERE template_id=:id"), {"id": id}
        )
    with engine.connect() as conn:
        audits = (
            conn.execute(
                text(
                    "SELECT details FROM audit_events WHERE aggregate_id=:id AND action='checklist.approved'"
                ),
                {"id": id},
            )
            .scalars()
            .all()
        )
    assert audits[0]["selfReview"] is True


def test_checklist_latest_revision_race_validation_and_foreign_base(workspace):
    client, engine, owner, _ = workspace
    first, body = revision(client, owner)
    first = checked(first, 201)
    base = first["template"]["id"]
    assert revision(client, owner, name=" ")[0].status_code == 400
    assert revision(client, owner, items=body["items"] * 2)[0].status_code == 400
    assert revision(client, owner, items=[dict(body["items"][0], required=False)])[0].status_code == 400
    assert revision(client, owner, basedOnId=str(uuid4()))[0].status_code == 404

    def race(_):
        return revision(client, owner, basedOnId=base)[0].status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(race, range(2))) == [201, 409]
    assert (
        client.post(
            f"/v1/checklists/{base}/approve",
            headers=owner,
            json={
                "commandId": str(uuid4()),
                "expectedVersion": 1,
                "reason": "Obsolete version",
                "instructionsReviewed": True,
            },
        ).status_code
        == 409
    )
