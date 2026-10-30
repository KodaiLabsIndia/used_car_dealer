from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from test_commercial import acquired, business, change, delivered
from test_documents import upload
from test_integration import checked, repair_command
from test_integration import workspace as workspace
from test_purchases import DOCUMENTS, prepare, purchase_command
from test_purchases import approve as approve_purchase
from test_roles import roles
from test_service_finance import finance_command, new_job, quote

from app.domain.warranty import add_months
from app.seed import IDS


def publish(client, headers, version=0, rules=None):
    if rules is None:
        rules = [
            {
                "id": "rc",
                "stage": "purchase",
                "title": "Registration",
                "titleHi": "पंजीकरण",
                "titleMr": "नोंदणी",
                "required": True,
                "applicability": "Compare to original",
            }
        ]
    body = {
        "commandId": str(uuid4()),
        "expectedVersion": version,
        "rules": rules,
        "reason": "Owner reviewed company requirements",
    }
    return client.post("/v1/company/document-policy", headers=headers, json=body), body


def review(client, headers, document, decision="accepted"):
    return client.post(
        f"/v1/documents/{document['id']}/review",
        headers=headers,
        json={
            "commandId": str(uuid4()),
            "expectedVersion": 1,
            "decision": decision,
            "reason": "Compared against original",
            "originalChecked": True,
        },
    )


def test_staff_progress_quote_request_and_one_supervisor_financial_approval(workspace):
    client, engine, owner, employee = workspace
    job = new_job(client, owner)
    path = f"/v1/jobs/{job['id']}/finance"
    data = checked(client.get(path, headers=employee))
    data = quote(client, employee, data)
    assert data["quotes"][0]["recordedByName"] == "Ravi"
    blocked = repair_command(client, employee, data["job"], "start", commitsSpend=True)
    assert blocked.status_code == 409 and blocked.json()["error"]["code"] == "QUOTE_APPROVAL_REQUIRED"
    checked(repair_command(client, employee, data["job"], "start"))
    data = checked(client.get(path, headers=employee))
    assert data["quotes"][0]["decision"] == "pending"
    decision = {
        "quoteId": data["quotes"][0]["id"],
        "decision": "approved",
        "reason": "Exact quote reviewed by supervisor",
    }
    assert finance_command(client, employee, data, "decide_quote", **decision).status_code == 403
    roles(engine, ["supervisor"])
    assert any(v["kind"] == "quote" for v in checked(client.get("/v1/decisions", headers=employee))["items"])
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(
            pool.map(
                lambda h: finance_command(client, h, data, "decide_quote", **decision), [employee, owner]
            )
        )
    assert sorted(r.status_code for r in responses) == [200, 409]
    approved = checked(client.get(path, headers=owner))
    with engine.connect() as conn:
        assert (
            conn.execute(
                text("SELECT count(*) FROM repair_quote_approvals WHERE job_id=:job"), {"job": job["id"]}
            ).scalar_one()
            == 1
        )
    assert approved["quotes"][0]["approvedByName"] in ("Owner", "Ravi")
    checked(repair_command(client, employee, approved["job"], "start", commitsSpend=True))
    assert client.get("/v1/checklists/manage", headers=employee).status_code == 403
    assert client.get("/v1/team", headers=employee).status_code == 403
    assert publish(client, employee)[0].status_code == 403
    roles(engine, ["inspector"])
    fresh = checked(client.get(path, headers=employee))
    assert (
        finance_command(
            client,
            employee,
            fresh,
            "vendor_payment",
            quoteId=fresh["quotes"][0]["id"],
            amountPaise=100,
            reference="NO",
            occurredAt=datetime.now(UTC).isoformat(),
            advanceAcknowledged=True,
        ).status_code
        == 403
    )


def test_document_policy_versions_actual_reviews_scope_and_immutable_assignments(workspace):
    client, engine, owner, employee = workspace
    starter = checked(client.get("/v1/company/document-policy", headers=owner))
    assert starter["version"] == 0 and {r["stage"] for r in starter["rules"]} == {
        "purchase",
        "intake",
        "sale",
        "delivery",
    }
    published, body = publish(client, owner)
    published = checked(published)
    assert checked(client.post("/v1/company/document-policy", headers=owner, json=body)) == published
    car_id = IDS["seltos"]
    assign = {"commandId": str(uuid4()), "stage": "purchase"}
    path = f"/v1/cars/{car_id}/document-requirements"
    assigned = checked(client.post(path, headers=employee, json=assign))
    target = assigned["sets"][0]
    assert target["policyVersion"] == 1 and target["enforced"] and not target["clear"]
    document = checked(upload(client, employee, car_id), 201)
    link_body = {"commandId": str(uuid4()), "requirementId": "rc", "documentId": document["id"]}
    link_path = f"{path}/{target['id']}/links"
    pending = checked(client.post(link_path, headers=employee, json=link_body))
    assert pending["sets"][0]["items"][0]["status"] == "pending" and not pending["sets"][0]["clear"]
    assert review(client, employee, document).status_code == 403
    checked(review(client, owner, document, "rejected"))
    rejected = checked(client.get(path, headers=owner))
    assert rejected["sets"][0]["items"][0]["status"] == "rejected"
    replacement = checked(upload(client, employee, car_id, supersedesId=document["id"]), 201)
    checked(review(client, owner, replacement))
    accepted = checked(
        client.post(
            link_path,
            headers=employee,
            json=link_body | {"commandId": str(uuid4()), "documentId": replacement["id"]},
        )
    )
    assert accepted["sets"][0]["clear"]
    foreign = checked(upload(client, owner, IDS["sonet"]), 201)
    assert (
        client.post(
            link_path,
            headers=employee,
            json=link_body | {"commandId": str(uuid4()), "documentId": foreign["id"]},
        ).status_code
        == 404
    )
    changed_rules = [dict(body["rules"][0], title="New registration rule", required=False)]
    checked(publish(client, owner, version=1, rules=changed_rules)[0])
    retained = checked(client.get(path, headers=employee))["sets"][0]
    assert retained["policyVersion"] == 1 and retained["items"][0]["rule"]["title"] == "Registration"
    assert checked(client.post(path, headers=employee, json=assign)) == assigned
    with pytest.raises(DBAPIError), engine.begin() as conn:
        conn.execute(text("UPDATE document_policies SET reason='rewritten'"))
    with pytest.raises(DBAPIError), engine.begin() as conn:
        conn.execute(text("DELETE FROM document_requirement_links"))
    # A previously valid request cannot replay private data after access is removed.
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE tasks SET assigned_to=:owner WHERE assigned_to=:employee"),
            {"owner": IDS["owner"], "employee": IDS["employee"]},
        )
    assert client.post(link_path, headers=employee, json=link_body).status_code == 404


def test_published_required_documents_block_commitment_until_actual_acceptance(workspace):
    client, _, owner, _ = workspace
    checked(publish(client, owner)[0])
    purchase, _ = prepare(client, owner)
    purchase = approve_purchase(client, owner, purchase)
    purchase = checked(purchase_command(client, owner, purchase, "documents", documents=DOCUMENTS))
    result = purchase_command(client, owner, purchase, "acquire", agreementReference="TEST-SIGNED")
    assert result.status_code == 409 and result.json()["error"]["code"] == "DOCUMENT_REQUIREMENTS_PENDING"
    car_id = purchase["carId"]
    required = checked(client.get(f"/v1/cars/{car_id}/document-requirements", headers=owner))
    target = next(s for s in required["sets"] if s["stage"] == "purchase")
    document = checked(upload(client, owner, car_id), 201)
    checked(
        client.post(
            f"/v1/cars/{car_id}/document-requirements/{target['id']}/links",
            headers=owner,
            json={"commandId": str(uuid4()), "requirementId": "rc", "documentId": document["id"]},
        )
    )
    assert (
        purchase_command(client, owner, purchase, "acquire", agreementReference="TEST-SIGNED").status_code
        == 409
    )
    checked(review(client, owner, document))
    purchase = checked(client.get(f"/v1/purchases/{purchase['id']}", headers=owner))
    checked(purchase_command(client, owner, purchase, "acquire", agreementReference="TEST-SIGNED"))


def test_configured_car_warranty_issues_calendar_terms_and_cannot_rewrite_delivery(workspace):
    client, _, owner, employee = workspace
    config = {
        "durationMonths": 6,
        "coveredComponents": ["Engine", "Cooling system"],
        "exclusions": "Accident damage",
        "terms": "Actual configured written coverage",
        "provider": "Arihant training",
        "policyReference": "CAR-POLICY-1",
        "odometerLimitKm": None,
    }
    current = delivered(client, owner, acquired(client, owner), configuration=config)
    booking = current["bookings"][0]
    warranty = booking["delivery"]["warranty"]
    assert warranty["durationMonths"] == 6 and warranty["coveredComponents"] == config["coveredComponents"]
    delivered_at = datetime.fromisoformat(booking["delivery"]["deliveredAt"])
    assert datetime.fromisoformat(warranty["until"]) == add_months(delivered_at, 6)
    assert (
        change(
            client,
            owner,
            current,
            "configure_warranty",
            bookingId=booking["id"],
            warranty=config | {"durationMonths": 12},
        ).status_code
        == 409
    )
    assert (
        change(
            client, employee, current, "configure_warranty", bookingId=booking["id"], warranty=config
        ).status_code
        == 403
    )
    assert business(client, owner, current["car"]["id"])["bookings"][0]["delivery"]["warranty"] == warranty


@pytest.mark.parametrize(
    ("start", "months", "expected"),
    [("2026-08-31", 6, "2027-02-28"), ("2023-11-30", 3, "2024-02-29"), ("2024-02-29", 12, "2025-02-28")],
)
def test_warranty_duration_uses_calendar_months(start, months, expected):
    assert (
        add_months(datetime.fromisoformat(start).replace(tzinfo=UTC), months).date().isoformat() == expected
    )


def test_catalogue_visibility_does_not_grant_private_work_records(workspace):
    client, engine, owner, employee = workspace
    roles(engine, ["sales"])
    car_id = IDS["sonet"]
    assert client.get(f"/v1/cars/{car_id}", headers=employee).status_code == 200
    assert upload(client, employee, car_id).status_code == 404
    assert client.get(f"/v1/cars/{car_id}/purchase", headers=employee).status_code == 404
    assert client.get(f"/v1/cars/{car_id}/document-requirements", headers=employee).status_code == 404
    document = checked(upload(client, owner, car_id), 201)
    assert client.get(f"/v1/documents/{document['id']}/file", headers=employee).status_code == 404
