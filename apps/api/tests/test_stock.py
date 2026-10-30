from uuid import uuid4

from test_commercial import acquired, business, change
from test_integration import checked
from test_integration import workspace as workspace

from app.seed import IDS


def stock(client, headers, car_id):
    return checked(client.get(f"/v1/cars/{car_id}/stock", headers=headers))


def action(client, headers, data, action, key=None, **extra):
    return client.post(
        f"/v1/cars/{data['car']['id']}/stock/commands",
        headers=headers,
        json={
            "commandId": str(key or uuid4()),
            "expectedVersion": data["car"]["version"],
            "action": action,
            **extra,
        },
    )


def test_hold_invalidates_ready_and_requires_supervisor_release(workspace):
    client, _, owner, employee = workspace
    current = acquired(client, owner)
    current = checked(change(client, owner, current, "mark_ready", acknowledgeDraftChecklist=True))
    data = stock(client, owner, current["car"]["id"])
    data = checked(action(client, owner, data, "hold", kind="safety", reason="Brake warning appeared"))
    assert data["car"]["stage"] == "refurbishment"
    current = business(client, owner, current["car"]["id"])
    assert not next(c for c in current["readiness"] if c["id"] == "holds")["clear"]
    assert (
        change(client, owner, current, "mark_ready", acknowledgeDraftChecklist=True).json()["error"]["code"]
        == "READINESS_BLOCKED"
    )
    hold = data["holds"][0]
    assert (
        action(
            client, employee, data, "release_hold", holdId=hold["id"], resolution="No permission"
        ).status_code
        == 403
    )
    data = checked(
        action(
            client,
            owner,
            data,
            "release_hold",
            holdId=hold["id"],
            resolution="Workshop repaired and owner checked",
        )
    )
    assert data["holds"][0]["resolvedByName"] == "Owner"
    assert data["car"]["stage"] == "refurbishment"
    assert next(c for c in business(client, owner, data["car"]["id"])["readiness"] if c["id"] == "holds")[
        "clear"
    ]
    assert (
        action(
            client, owner, data, "release_hold", holdId=hold["id"], resolution="Duplicate release"
        ).status_code
        == 409
    )


def test_custody_acknowledgement_meter_and_retry(workspace):
    client, _, owner, employee = workspace
    data = stock(client, owner, IDS["sonet"])
    common = {
        "toKind": "yard",
        "toLocation": "Main yard bay 3",
        "custodianId": str(IDS["employee"]),
        "receiverName": "Employee",
        "receiverAcknowledged": True,
        "odometerKm": 45000,
        "keysCount": 2,
        "fuelPercent": 50,
    }
    assert action(client, employee, data, "move", **common).status_code == 403
    assert (
        action(client, owner, data, "move", **(common | {"receiverAcknowledged": False})).json()["error"][
            "code"
        ]
        == "HANDOVER_REQUIRED"
    )
    assert (
        action(client, owner, data, "move", **(common | {"toKind": "customer"})).json()["error"]["code"]
        == "DELIVERY_REQUIRED"
    )
    key = uuid4()
    before = data
    data = checked(action(client, owner, data, "move", key, **common))
    assert checked(action(client, owner, before, "move", key, **common)) == data
    assert data["car"]["location"] == "Main yard bay 3" and data["custodianName"] == "Ravi"
    assert data["car"]["odometerKm"] == 45000 and len(data["movements"]) == 1
    assert (
        action(client, owner, data, "move", **(common | {"odometerKm": 44000})).json()["error"]["code"]
        == "ODOMETER_REVERSED"
    )
    assert (
        action(client, owner, data, "move", **(common | {"toKind": "test_drive"})).json()["error"]["code"]
        == "TEST_DRIVE_REQUIRED"
    )
    assert client.get(f"/v1/cars/{uuid4()}/stock", headers=employee).status_code == 404
