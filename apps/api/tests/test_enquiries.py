from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import text
from test_integration import checked
from test_integration import workspace as workspace

from app.seed import IDS


def create(client, headers, assigned=None, key=None, **extra):
    return client.post(
        "/v1/enquiries",
        headers=headers,
        json={
            "commandId": str(key or uuid4()),
            "kind": "buyer",
            "name": "Training buyer",
            "phone": "9999900000",
            "interest": "Automatic hatchback",
            "assignedTo": str(assigned or IDS["owner"]),
            "nextFollowUpAt": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
            **extra,
        },
    )


def action(client, headers, data, action, **extra):
    e = data["enquiry"]
    return client.post(
        f"/v1/enquiries/{e['id']}/commands",
        headers=headers,
        json={"commandId": str(uuid4()), "expectedVersion": e["version"], "action": action, **extra},
    )


def test_sales_scope_followup_contacts_and_financial_boundary(workspace):
    client, engine, owner, employee = workspace
    assert create(client, employee).status_code == 403
    with engine.begin() as conn:
        conn.execute(text("UPDATE users SET work_roles=ARRAY['sales'] WHERE id=:id"), {"id": IDS["employee"]})
    assert create(client, employee).status_code == 403
    mine = checked(create(client, employee, assigned=IDS["employee"]), 201)
    other = checked(create(client, owner), 201)
    assert client.get(f"/v1/enquiries/{other['enquiry']['id']}", headers=employee).status_code == 404
    assert len(checked(client.get("/v1/enquiries?scope=all", headers=employee))["items"]) == 1
    assert client.get("/v1/business", headers=employee).status_code == 403
    mine = checked(
        action(
            client,
            employee,
            mine,
            "contact",
            channel="call",
            note="Asked for a viewing",
            nextFollowUpAt=(datetime.now(UTC) + timedelta(days=2)).isoformat(),
        )
    )
    assert mine["enquiry"]["lastContactAt"] and mine["events"][0]["note"] == "call: Asked for a viewing"
    mine = checked(action(client, employee, mine, "link_car", carId=str(IDS["sonet"])))
    assert mine["enquiry"]["carId"] == str(IDS["sonet"])
    assert client.get(f"/v1/tasks/{IDS['owner_task']}", headers=employee).status_code == 404
    assert (
        action(
            client, employee, mine, "assign", assignedTo=str(IDS["owner"]), reason="New handler"
        ).status_code
        == 403
    )


def test_visits_license_checks_future_completion_and_immutable_outcomes(workspace):
    client, engine, owner, _ = workspace
    data = checked(create(client, owner, carId=str(IDS["sonet"])), 201)
    future = (datetime.now(UTC) + timedelta(hours=1)).isoformat()
    assert (
        action(client, owner, data, "appointment", kind="test_drive", scheduledAt=future).json()["error"][
            "code"
        ]
        == "DRIVER_CHECK_REQUIRED"
    )
    data = checked(
        action(
            client,
            owner,
            data,
            "appointment",
            kind="test_drive",
            scheduledAt=future,
            driverName="Training buyer",
            licenseChecked=True,
        )
    )
    appointment = data["appointments"][0]
    assert (
        action(
            client,
            owner,
            data,
            "finish_appointment",
            appointmentId=appointment["id"],
            status="completed",
            outcome="Good drive",
        ).json()["error"]["code"]
        == "APPOINTMENT_NOT_STARTED"
    )
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE enquiry_appointments SET scheduled_at=now()-interval '1 hour' WHERE id=:id"),
            {"id": appointment["id"]},
        )
    data = checked(
        action(
            client,
            owner,
            data,
            "finish_appointment",
            appointmentId=appointment["id"],
            status="completed",
            outcome="Preferred automatic; financing pending",
        )
    )
    assert data["appointments"][0]["status"] == "completed"
    assert (
        action(
            client,
            owner,
            data,
            "finish_appointment",
            appointmentId=appointment["id"],
            status="cancelled",
            outcome="Changed mind",
        ).status_code
        == 409
    )
    data = checked(action(client, owner, data, "status", status="lost", reason="Purchased another car"))
    assert action(client, owner, data, "appointment", kind="viewing", scheduledAt=future).status_code == 409
    data = checked(action(client, owner, data, "status", status="open", reason="Interested again"))
    assert data["enquiry"]["nextFollowUpAt"] is not None


def test_enquiry_retry_conflict_and_ineligible_assignee(workspace):
    client, _, owner, employee = workspace
    # Employees now share one working tier and can own assigned enquiries.
    checked(create(client, owner, assigned=IDS["employee"]), 201)
    key = uuid4()
    due = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    a = checked(create(client, owner, key=key, nextFollowUpAt=due), 201)
    assert checked(create(client, owner, key=key, nextFollowUpAt=due), 201) == a
    assert (
        create(client, owner, key=key, nextFollowUpAt=due, name="Changed contact").json()["error"]["code"]
        == "IDEMPOTENCY_CONFLICT"
    )
    assert (
        action(
            client,
            owner,
            a,
            "contact",
            channel="call",
            note="Too early",
            nextFollowUpAt=(datetime.now(UTC) - timedelta(days=1)).isoformat(),
        ).status_code
        == 400
    )
