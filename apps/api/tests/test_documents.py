import json
from uuid import uuid4

from test_integration import checked, create_car, jpeg
from test_integration import workspace as workspace

from app.seed import IDS


def upload(client, headers, car_id, id=None, data=None, **metadata):
    return client.post(
        f"/v1/cars/{car_id}/documents/{id or uuid4()}",
        headers=headers,
        data={"metadata": json.dumps({"category": "registration", "title": "Registration page", **metadata})},
        files={"file": ("page.jpg", data or jpeg(1080, 1920), "image/jpeg")},
    )


def test_document_admission_private_access_and_retry_safety(workspace):
    client, _, owner, employee = workspace
    car_id = IDS["sonet"]
    id = uuid4()
    assert upload(client, employee, car_id).status_code == 404
    assert upload(client, owner, car_id, data=jpeg(4000, 3000)).json()["error"]["code"] == "INVALID_MEDIA"
    document = checked(upload(client, owner, car_id, id), 201)
    assert document["width"] == 1080 and document["height"] == 1920 and document["status"] == "uploaded"
    assert checked(upload(client, owner, car_id, id), 201) == document
    assert (
        upload(client, owner, car_id, id, title="Changed metadata").json()["error"]["code"]
        == "IDEMPOTENCY_CONFLICT"
    )
    assert client.get(f"/v1/documents/{id}/file", headers=employee).status_code == 404
    response = client.get(f"/v1/documents/{id}/file", headers=owner)
    assert response.status_code == 200 and response.headers["cache-control"] == "private, no-store"
    assert response.content == jpeg(1080, 1920)
    assert client.get(f"/v1/documents/{uuid4()}/file", headers=owner).status_code == 404


def test_review_requires_original_check_preserves_actor_and_replacement(workspace):
    client, _, owner, _ = workspace
    document = checked(upload(client, owner, IDS["sonet"]), 201)
    body = {
        "commandId": str(uuid4()),
        "expectedVersion": 1,
        "decision": "accepted",
        "reason": "Checked page against original registration",
        "originalChecked": False,
    }
    path = f"/v1/documents/{document['id']}/review"
    assert client.post(path, headers=owner, json=body).json()["error"]["code"] == "ORIGINAL_CHECK_REQUIRED"
    body["originalChecked"] = True
    reviewed = checked(client.post(path, headers=owner, json=body))
    assert (
        reviewed["status"] == "accepted"
        and reviewed["selfReview"]
        and reviewed["recordedById"] == str(IDS["owner"])
    )
    assert checked(client.post(path, headers=owner, json=body)) == reviewed
    assert client.post(path, headers=owner, json=body | {"commandId": str(uuid4())}).status_code == 409
    replacement = checked(
        upload(client, owner, IDS["sonet"], title="Registration corrected page", supersedesId=document["id"]),
        201,
    )
    assert replacement["supersedesId"] == document["id"] and replacement["status"] == "uploaded"
    assert client.get(path.replace("/review", "/file"), headers=owner).status_code == 200


def test_document_links_cannot_cross_stock_cycles(workspace):
    client, _, owner, _ = workspace
    first = checked(upload(client, owner, IDS["sonet"]), 201)
    car = checked(create_car(client, owner, registration="DOC1234")[0], 201)["car"]
    assert upload(client, owner, car["id"], supersedesId=first["id"]).status_code == 404
    assert upload(client, owner, car["id"], jobId=str(uuid4())).status_code == 404
