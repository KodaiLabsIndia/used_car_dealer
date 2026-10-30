from uuid import uuid4

from test_integration import checked, command, create_car, jpeg, upload
from test_integration import workspace as workspace
from test_video import clips as clips

from app.adapters.catalogue import import_catalogue
from app.checklists import templates_for
from app.contracts import VehicleConfiguration
from app.domain.inspection import resolve_checks
from app.seed import IDS


def test_complete_library_resolves_by_configuration_and_retains_unknown_equipment():
    library = templates_for(IDS["company"])[-1]
    assert not library.approved and len(library.items) > 200
    assert len({i.id for i in library.items}) == len(library.items)
    diesel = resolve_checks(
        library.items,
        VehicleConfiguration(fuel="diesel", transmission="automatic", features={"sunroof": False}),
    )
    electric = resolve_checks(library.items, VehicleConfiguration(fuel="electric", transmission="automatic"))
    unknown = resolve_checks(library.items, VehicleConfiguration())
    assert "oil-level" in {i.id for i in diesel} and "ev-soc" not in {i.id for i in diesel}
    assert "oil-level" not in {i.id for i in electric} and "ev-soc" in {i.id for i in electric}
    assert "sunroof-operation" not in {i.id for i in diesel}
    assert next(i for i in unknown if i.id == "sunroof-operation").configuration_pending
    assert next(i for i in unknown if i.id == "oil-level").configuration_pending
    assert [i.order for i in diesel] == list(range(1, len(diesel) + 1))
    assert {i.zone for i in library.items} >= {"identity", "wheels", "underbody", "safety", "road_test"}


def test_full_snapshot_over_200_and_existing_training_history_stays_intact(workspace):
    client, engine, owner, _ = workspace
    prior = checked(client.get(f"/v1/tasks/{IDS['owner_task']}", headers=owner))
    assert len(prior["items"]) == 3
    created = checked(create_car(client, owner, registration="QA3DFULL")[0], 201)
    library = next(
        t
        for t in checked(client.get("/v1/checklists", headers=owner))["items"]
        if "comprehensive" in t["name"]
    )
    body = {
        "commandId": str(uuid4()),
        "templateId": library["id"],
        "assignedTo": str(IDS["owner"]),
        "configuration": {"bodyType": "suv", "fuel": "diesel", "transmission": "automatic"},
    }
    task = checked(client.post(f"/v1/cars/{created['car']['id']}/inspections", headers=owner, json=body), 201)
    assert len(task["items"]) > 200 and not task["templateApproved"]
    assert task["vehicleConfiguration"]["fuel"] == "diesel"
    assert "ev-soc" not in {i["id"] for i in task["items"]}
    assert (
        checked(client.post(f"/v1/cars/{created['car']['id']}/inspections", headers=owner, json=body), 201)
        == task
    )
    assert checked(client.get(f"/v1/tasks/{IDS['owner_task']}", headers=owner)) == prior


def test_conditional_proof_confirmation_measurement_exceptions_and_unable_gate(workspace):
    client, _, owner, _ = workspace
    car = checked(create_car(client, owner, registration="QA3DPROOF")[0], 201)
    item = {
        "id": "spare-tread",
        "title": "Spare tyre measured tread",
        "titleHi": "अतिरिक्त टायर की गहराई",
        "instruction": "Show the tyre and gauge.",
        "instructionHi": "टायर और मापक दिखाएँ।",
        "required": True,
        "order": 1,
        "zone": "wheels",
        "componentId": "body.tailgate",
        "measurementUnit": "mm",
        "applicability": {"feature": "spare_wheel"},
    }
    template = checked(
        client.post(
            "/v1/checklists/revisions",
            headers=owner,
            json={
                "commandId": str(uuid4()),
                "name": "Conditional proof QA",
                "kind": "intake",
                "basedOnId": None,
                "reason": "Synthetic contract verification",
                "items": [item],
            },
        ),
        201,
    )["template"]
    task = checked(
        client.post(
            f"/v1/cars/{car['car']['id']}/inspections",
            headers=owner,
            json={"commandId": str(uuid4()), "templateId": template["id"], "assignedTo": str(IDS["owner"])},
        ),
        201,
    )
    proof = checked(upload(client, owner, task["id"], item["id"], jpeg()), 201)
    args = {"itemId": item["id"], "evidenceId": proof["id"], "result": "ok"}
    assert (
        command(client, owner, task["id"], "answer", **args).json()["error"]["code"]
        == "CONFIGURATION_REQUIRED"
    )
    assert (
        command(client, owner, task["id"], "answer", **args, applicabilityConfirmed=True).json()["error"][
            "code"
        ]
        == "MEASUREMENT_REQUIRED"
    )
    task = checked(
        command(client, owner, task["id"], "answer", **args, applicabilityConfirmed=True, reading=4.2)
    )
    assert task["answers"][0]["reading"] == 4.2
    unable = args | {"result": "unable", "note": "Instrument became unavailable"}
    task = checked(command(client, owner, task["id"], "answer", version=task["version"], **unable))
    assert (
        command(client, owner, task["id"], "submit", version=task["version"]).json()["error"]["code"]
        == "INCOMPLETE"
    )
    na = args | {
        "result": "not_applicable",
        "note": "This vehicle has no spare wheel; empty well photographed",
    }
    task = checked(command(client, owner, task["id"], "answer", version=task["version"], **na))
    task = checked(command(client, owner, task["id"], "submit", version=task["version"]))
    assert task["status"] == "submitted" and task["answers"][0]["result"] == "not_applicable"


def test_required_clip_blocks_submission_and_common_checks_cannot_be_skipped(workspace, clips):
    client, _, owner, _ = workspace
    car = checked(create_car(client, owner, registration="QA3DVIDEO")[0], 201)
    item = {
        "id": "indicator-proof",
        "title": "Indicator operation",
        "titleHi": "इंडिकेटर की चाल",
        "instruction": "Show operation.",
        "instructionHi": "चलाकर दिखाएँ।",
        "required": True,
        "order": 1,
        "requiresClip": True,
        "critical": True,
    }
    template = checked(
        client.post(
            "/v1/checklists/revisions",
            headers=owner,
            json={
                "commandId": str(uuid4()),
                "name": "Required clip QA",
                "kind": "intake",
                "basedOnId": None,
                "reason": "Synthetic proof requirements",
                "items": [item],
            },
        ),
        201,
    )["template"]
    task = checked(
        client.post(
            f"/v1/cars/{car['car']['id']}/inspections",
            headers=owner,
            json={"commandId": str(uuid4()), "templateId": template["id"], "assignedTo": str(IDS["owner"])},
        ),
        201,
    )
    proof = checked(upload(client, owner, task["id"], item["id"], jpeg()), 201)
    args = {
        "itemId": item["id"],
        "evidenceId": proof["id"],
        "result": "not_applicable",
        "note": "Attempt to skip a universal check",
    }
    assert command(client, owner, task["id"], "answer", **args).json()["error"]["code"] == "INVALID_EXCEPTION"
    task = checked(command(client, owner, task["id"], "answer", **(args | {"result": "ok"})))
    assert (
        command(client, owner, task["id"], "submit", version=task["version"]).json()["error"]["code"]
        == "INCOMPLETE"
    )

    def video():
        return checked(
            client.post(
                f"/v1/tasks/{task['id']}/items/{item['id']}/clips/{uuid4()}",
                headers=owner,
                files={"file": ("clip.mp4", clips["valid"], "video/mp4")},
            ),
            201,
        )

    video()
    task = checked(command(client, owner, task["id"], "submit", version=task["version"]))
    task = checked(
        command(
            client,
            owner,
            task["id"],
            "review",
            version=task["version"],
            decision="recheck",
            recheckItemIds=[item["id"]],
        )
    )
    fresh = checked(upload(client, owner, task["id"], item["id"], jpeg()), 201)
    task = checked(
        command(
            client,
            owner,
            task["id"],
            "answer",
            version=task["version"],
            **(args | {"result": "ok", "evidenceId": fresh["id"]}),
        )
    )
    assert not task["clipItemIds"]
    assert (
        command(client, owner, task["id"], "submit", version=task["version"]).json()["error"]["code"]
        == "INCOMPLETE"
    )
    video()
    task = checked(
        command(
            client,
            owner,
            task["id"],
            "answer",
            version=task["version"],
            **(args | {"result": "problem", "note": "Indicator operation failed"}),
        )
    )
    assert (
        checked(command(client, owner, task["id"], "submit", version=task["version"]))["status"]
        == "submitted"
    )
    issues = checked(client.get(f"/v1/cars/{car['car']['id']}/issues", headers=owner))["items"]
    assert len(issues) == 1 and issues[0]["severity"] == "urgent"
    assert issues[0]["sourceTaskId"] == task["id"] and issues[0]["sourceItemId"] == item["id"]


def test_catalogue_is_attributed_searchable_idempotent_and_reports_real_coverage(workspace):
    client, engine, owner, employee = workspace
    assert client.get("/v1/catalogue/vehicles").status_code == 401
    import_catalogue(engine)
    before = checked(client.get("/v1/catalogue/coverage", headers=owner))
    assert before["models"] > 1800 and before["indiaReferences"] == 32
    assert not before["complete"] and before["variantsVerified"] == 0
    import_catalogue(engine)
    assert checked(client.get("/v1/catalogue/coverage", headers=employee)) == before
    result = checked(client.get("/v1/catalogue/vehicles?query=Kia%20Sonet", headers=employee))
    assert result["total"] == 1 and result["items"][0]["marketStatus"] == "india_reference"
    assert result["items"][0]["bodyType"] == "suv" and result["items"][0]["sourceUrl"].startswith("https://")
    assert checked(client.get("/v1/catalogue/vehicles?query=%25", headers=owner))["total"] == 0
