from uuid import uuid4

from sqlalchemy import text
from test_integration import checked, command, create_car, fill_inspection
from test_integration import workspace as workspace

from app.seed import IDS


def roles(engine, values):
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE users SET work_roles=:roles WHERE id=:id"), {"roles": values, "id": IDS["employee"]}
        )


def test_manager_sees_operations_and_can_intake_but_not_finances_or_accounts(workspace):
    client, engine, owner, employee = workspace
    roles(engine, ["manager"])
    assert checked(client.get("/v1/me", headers=employee))["workRoles"] == ["manager"]
    assert len(checked(client.get("/v1/cars", headers=employee))["items"]) == 2
    assert client.get("/v1/people", headers=employee).status_code == 200
    assert client.get("/v1/team", headers=employee).status_code == 403
    assert client.get("/v1/purchases", headers=employee).status_code == 403
    assert client.get("/v1/business", headers=employee).status_code == 403
    result, _ = create_car(client, employee, registration="ROLE1234")
    car = checked(result, 201)["car"]
    assert client.get(f"/v1/cars/{car['id']}/business", headers=employee).status_code == 403
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO audit_events(id,company_id,actor_id,aggregate_id,action,details) VALUES(:id,:company,:actor,:car,'purchase.payment',CAST(:details AS jsonb))"
            ),
            {
                "id": uuid4(),
                "company": IDS["company"],
                "actor": IDS["owner"],
                "car": car["id"],
                "details": '{"summary":"Private financial reference"}',
            },
        )
    history = checked(client.get(f"/v1/cars/{car['id']}/history", headers=employee))["items"]
    assert not any(x["action"].startswith("purchase.") for x in history)
    own_history = checked(client.get(f"/v1/cars/{car['id']}/history", headers=owner))["items"]
    assert any(x["action"] == "purchase.payment" for x in own_history)


def test_supervisor_review_and_staff_independent_review_requirement(workspace):
    client, engine, owner, employee = workspace
    roles(engine, ["supervisor"])
    result, _ = create_car(client, owner, assigned=IDS["owner"], registration="ROLE5678")
    task = checked(result, 201)["task"]
    task = fill_inspection(client, owner, task)
    task = checked(command(client, employee, task["id"], "review", task["version"], decision="accept"))
    assert task["status"] == "completed"
    result, _ = create_car(client, owner, registration="ROLE9876")
    task = fill_inspection(client, employee, checked(result, 201)["task"])
    denied = command(client, employee, task["id"], "review", task["version"], decision="accept")
    assert denied.status_code == 403 and denied.json()["error"]["code"] == "INDEPENDENT_REVIEW_REQUIRED"
    assert command(client, owner, task["id"], "review", task["version"], decision="accept").status_code == 200


def test_coordinator_cannot_review_or_intake_and_combined_roles_work(workspace):
    client, engine, owner, employee = workspace
    roles(engine, ["coordinator"])
    assert client.get("/v1/workshops", headers=employee).status_code == 200
    assert create_car(client, employee, registration="ROLE2468")[0].status_code == 403
    task = checked(client.get(f"/v1/tasks/{IDS['employee_task']}", headers=employee))
    assert (
        command(client, employee, task["id"], "review", task["version"], decision="accept").status_code == 403
    )
    roles(engine, ["inspector", "supervisor"])
    task = checked(command(client, employee, IDS["owner_task"], "takeover"))
    assert task["assignedTo"] == str(IDS["employee"])
    assert client.get(f"/v1/cars/{uuid4()}", headers=employee).status_code == 404
