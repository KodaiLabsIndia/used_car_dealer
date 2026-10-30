from test_documents import upload
from test_integration import checked, command
from test_integration import workspace as workspace
from test_service_finance import approve, new_job, quote
from test_stock import action, stock

from app.seed import IDS, ITEMS


def test_owner_queue_count_pages_and_current_quote_revision_reconcile(workspace):
    client, _, owner, employee = workspace
    assert client.get("/v1/decisions", headers=employee).status_code == 403
    checked(command(client, employee, IDS["employee_task"], "help", itemId=ITEMS[0]["id"]))
    checked(upload(client, owner, IDS["sonet"]), 201)
    job = new_job(client, owner)
    finance = checked(client.get(f"/v1/jobs/{job['id']}/finance", headers=owner))
    finance = quote(client, owner, finance)
    data = stock(client, owner, IDS["sonet"])
    checked(action(client, owner, data, "hold", kind="documents", reason="Original registration pending"))
    page = checked(client.get("/v1/decisions?limit=2", headers=owner))
    assert page["total"] == 4 and len(page["items"]) == 2
    second = checked(client.get("/v1/decisions?limit=2&offset=2", headers=owner))
    assert {v["kind"] for v in page["items"] + second["items"]} == {"help", "document", "quote", "hold"}
    dashboard = checked(client.get("/v1/dashboard", headers=owner))
    assert dashboard["decisions"] == page["total"]
    finance = quote(client, owner, finance, amount=600000)
    assert checked(client.get("/v1/decisions", headers=owner))["total"] == 4
    approve(client, owner, finance)
    assert checked(client.get("/v1/decisions", headers=owner))["total"] == 3
    assert client.get("/v1/decisions?limit=0", headers=owner).status_code == 400
