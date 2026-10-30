from uuid import uuid4

from sqlalchemy import text
from test_integration import checked
from test_integration import workspace as workspace

from app.adapters.passwords import hash_secret, verify_secret


def create_staff(client, owner, **extra):
    return client.post(
        "/v1/team",
        headers=owner,
        json={
            "commandId": str(uuid4()),
            "name": "Meena",
            "username": "meena",
            "temporarySecret": "temporary-test-only",
            **extra,
        },
    )


def login(client, secret="temporary-test-only", username="meena"):
    return client.post(
        "/v1/auth/login", json={"dealerCode": "arihant-training", "username": username, "secret": secret}
    )


def test_salted_passwords_and_retry_safe_account_creation(workspace):
    client, engine, owner, employee = workspace
    assert client.get("/v1/team", headers=employee).status_code == 403
    assert create_staff(client, employee).status_code == 403
    key = str(uuid4())
    response = create_staff(client, owner, commandId=key)
    person = checked(response, 201)
    assert person["mustChangeSecret"] and person["role"] == "employee"
    assert checked(create_staff(client, owner, commandId=key), 201) == person
    assert (
        create_staff(client, owner, commandId=key, temporarySecret="different-test-secret").json()["error"][
            "code"
        ]
        == "IDEMPOTENCY_CONFLICT"
    )
    assert create_staff(client, owner, username="MEENA").json()["error"]["code"] == "USERNAME_EXISTS"
    with engine.connect() as conn:
        encoded = conn.execute(
            text("SELECT secret_hash FROM user_credentials WHERE user_id=:id"), {"id": person["id"]}
        ).scalar_one()
        audit = conn.execute(
            text("SELECT details::text FROM audit_events WHERE action='team.created'")
        ).scalar_one()
    assert "temporary-test-only" not in encoded and "temporary-test-only" not in audit
    assert verify_secret("temporary-test-only", encoded)
    assert encoded != hash_secret("temporary-test-only")
    assert not verify_secret("incorrect", encoded)
    assert not verify_secret("incorrect", "malformed")


def test_first_login_requires_change_and_rotates_all_sessions(workspace):
    client, _, owner, _ = workspace
    checked(create_staff(client, owner), 201)
    first = checked(login(client))
    old = {"Authorization": "Bearer " + first["token"]}
    assert first["mustChangeSecret"]
    assert client.get("/v1/tasks", headers=old).json()["error"]["code"] == "SECRET_CHANGE_REQUIRED"
    current = checked(
        client.post(
            "/v1/auth/change-secret",
            headers=old,
            json={"currentSecret": "temporary-test-only", "newSecret": "my-own-test-secret"},
        )
    )
    assert not current["mustChangeSecret"]
    assert client.get("/v1/me", headers=old).status_code == 401
    new = {"Authorization": "Bearer " + current["token"]}
    assert checked(client.get("/v1/tasks", headers=new))["items"] == []
    assert client.get("/v1/business", headers=new).status_code == 403
    assert login(client).status_code == 401
    assert checked(login(client, "my-own-test-secret"))["actor"]["id"] == current["actor"]["id"]


def test_offboarding_and_owner_password_reset_revoke_sessions(workspace):
    client, _, owner, _ = workspace
    member = checked(create_staff(client, owner), 201)
    first = checked(login(client))
    current = checked(
        client.post(
            "/v1/auth/change-secret",
            headers={"Authorization": "Bearer " + first["token"]},
            json={"currentSecret": "temporary-test-only", "newSecret": "my-own-test-secret"},
        )
    )
    staff = {"Authorization": "Bearer " + current["token"]}
    command = {
        "action": "profile",
        "commandId": str(uuid4()),
        "expectedVersion": member["version"],
        "name": "Meena",
        "active": False,
    }
    member = checked(client.post(f"/v1/team/{member['id']}/commands", headers=owner, json=command))
    assert client.get("/v1/me", headers=staff).status_code == 401
    assert login(client, "my-own-test-secret").status_code == 401
    member = checked(
        client.post(
            f"/v1/team/{member['id']}/commands",
            headers=owner,
            json=command | {"commandId": str(uuid4()), "expectedVersion": member["version"], "active": True},
        )
    )
    reset = {
        "action": "reset_secret",
        "commandId": str(uuid4()),
        "expectedVersion": member["version"],
        "temporarySecret": "reset-test-only",
    }
    member = checked(client.post(f"/v1/team/{member['id']}/commands", headers=owner, json=reset))
    assert member["mustChangeSecret"]
    assert checked(login(client, "reset-test-only"))["mustChangeSecret"]
    assert login(client, "my-own-test-secret").status_code == 401
    own = next(m for m in checked(client.get("/v1/team", headers=owner))["items"] if m["role"] == "owner")
    assert (
        client.post(
            f"/v1/team/{own['id']}/commands",
            headers=owner,
            json=reset | {"commandId": str(uuid4()), "expectedVersion": own["version"]},
        ).json()["error"]["code"]
        == "OWNER_ACCOUNT"
    )


def test_persistent_login_throttling_and_no_account_enumeration(workspace):
    client, _, owner, _ = workspace
    checked(create_staff(client, owner), 201)
    assert (
        login(client, "incorrect", "does-not-exist").json()["error"]["message"]
        == login(client, "incorrect").json()["error"]["message"]
    )
    for _ in range(7):
        assert login(client, "incorrect").status_code == 401
    assert login(client).status_code == 429


def test_owner_individual_login_keeps_company_wide_identity(workspace):
    client, _, owner, employee = workspace
    body = {"commandId": str(uuid4()), "username": "owner.login", "secret": "owner-private-test-only"}
    assert client.post("/v1/auth/setup-login", headers=employee, json=body).status_code == 403
    member = checked(client.post("/v1/auth/setup-login", headers=owner, json=body))
    session = checked(login(client, "owner-private-test-only", "OWNER.LOGIN"))
    assert session["actor"]["id"] == member["id"] and not session["mustChangeSecret"]
    access = {"Authorization": "Bearer " + session["token"]}
    assert len(checked(client.get("/v1/cars", headers=access))["items"]) == 2
    assert (
        client.post("/v1/auth/setup-login", headers=owner, json=body | {"commandId": str(uuid4())}).json()[
            "error"
        ]["code"]
        == "LOGIN_EXISTS"
    )
