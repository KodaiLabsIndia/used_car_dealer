from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from test_integration import checked
from test_integration import workspace as workspace

from app.adapters.routines import RoutineStore
from app.seed import IDS


@pytest.fixture(autouse=True)
def today(monkeypatch):
    value = [date(2026, 11, 9)]
    monkeypatch.setattr(RoutineStore, "today", lambda self, conn: value[0])
    return value


def save(client, h, id, version=0, **changes):
    definition = {
        "title": "Open the yard",
        "assignedTo": str(IDS["employee"]),
        "weekdays": list(range(7)),
        "steps": ["Check key cabinet", "Check all parked cars"],
        "active": True,
    } | changes
    return client.post(
        f"/v1/routines/{id}",
        headers=h,
        json={
            "commandId": str(uuid4()),
            "expectedVersion": version,
            "definition": definition,
            "reason": "Agreed yard routine",
        },
    )


def step(client, h, id, version=0, definition=1, day="2026-11-09", **changes):
    return client.post(
        f"/v1/routines/{id}/steps",
        headers=h,
        json={
            "commandId": str(uuid4()),
            "expectedVersion": version,
            "definitionVersion": definition,
            "workDate": day,
            "step": 0,
            "action": "done",
            **changes,
        },
    )


def test_routine_scope_ownership_and_append_only_history(workspace):
    client, engine, owner, employee = workspace
    id = uuid4()
    assert save(client, employee, id).status_code == 403
    checked(save(client, owner, id))
    assert step(client, owner, id).status_code == 403
    result = checked(step(client, employee, id))["items"][0]
    assert result["completedSteps"] == [0] and result["events"][0]["byName"] == "Ravi"
    assert step(client, employee, id).status_code == 409
    assert step(client, employee, id, 1, action="reopen").status_code == 400
    result = checked(step(client, employee, id, 1, action="reopen", note="Keys need checking again"))[
        "items"
    ][0]
    assert result["completedSteps"] == [] and len(result["events"]) == 2
    with pytest.raises(DBAPIError), engine.begin() as conn:
        conn.execute(text("DELETE FROM routine_step_events"))
    other = uuid4()
    checked(save(client, owner, other, assignedTo=str(IDS["owner"])))
    assert len(checked(client.get("/v1/routines", headers=employee))["items"]) == 1
    assert step(client, employee, other).status_code == 404


def test_started_routine_keeps_original_assignment_and_steps(workspace):
    client, _, owner, employee = workspace
    id = uuid4()
    checked(save(client, owner, id))
    checked(step(client, employee, id))
    checked(save(client, owner, id, 1, assignedTo=str(IDS["owner"]), steps=["New check"], active=False))
    item = checked(client.get("/v1/routines", headers=employee))["items"][0]
    assert item["definition"]["steps"] == ["Check key cabinet", "Check all parked cars"]
    assert item["currentDefinition"]["active"] is False and item["templateVersion"] == 2
    assert checked(step(client, employee, id, 1, step=1))["items"][0]["completedSteps"] == [0, 1]


def test_daily_reset_midnight_and_pause_preserve_history(workspace, today):
    client, _, owner, employee = workspace
    id = uuid4()
    checked(save(client, owner, id))
    checked(step(client, employee, id))
    today[0] = date(2026, 11, 10)
    item = checked(client.get("/v1/routines", headers=employee))["items"][0]
    assert not item["started"] and item["runVersion"] == 0 and item["completedSteps"] == []
    assert step(client, employee, id, 1).status_code == 409
    assert checked(client.get("/v1/routines?day=2026-11-09", headers=employee))["items"][0][
        "completedSteps"
    ] == [0]
    checked(save(client, owner, id, 1, active=False))
    assert step(client, employee, id, definition=2, day="2026-11-10").status_code == 409
    assert not checked(client.get("/v1/routines", headers=employee))["items"][0]["dueToday"]


def test_routine_commands_are_idempotent_and_stale_edits_rejected(workspace):
    client, _, owner, employee = workspace
    id = uuid4()
    checked(save(client, owner, id))
    payload = {
        "commandId": str(uuid4()),
        "expectedVersion": 0,
        "definitionVersion": 1,
        "workDate": "2026-11-09",
        "step": 0,
        "action": "done",
    }
    url = f"/v1/routines/{id}/steps"
    first = checked(client.post(url, headers=employee, json=payload))
    assert checked(client.post(url, headers=employee, json=payload)) == first
    assert client.post(url, headers=employee, json=payload | {"step": 1}).status_code == 409
    assert save(client, owner, id).status_code == 409


def test_off_day_and_unknown_step_cannot_be_marked_done(workspace):
    client, _, owner, employee = workspace
    id = uuid4()
    checked(save(client, owner, id, weekdays=[6]))
    assert step(client, employee, id).status_code == 409
    checked(save(client, owner, id, 1, weekdays=[0]))
    assert step(client, employee, id, definition=2, step=19).status_code == 400
    assert save(client, owner, uuid4(), weekdays=[0, 0]).status_code == 400
