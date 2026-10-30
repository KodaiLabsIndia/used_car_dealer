from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI, Query

from app.adapters.workflows import WorkflowStore
from app.application.workshops import WorkshopService
from app.contracts import Actor, Task
from app.workflow_contracts import (
    CarCreated,
    CreateCar,
    CreateInspection,
    CreateIssue,
    CreateJob,
    CreateWorkshop,
    HistoryPage,
    Issue,
    IssuesPage,
    JobCommand,
    JobsPage,
    PeoplePage,
    RepairJob,
    TemplatePage,
    Workshop,
    WorkshopsPage,
)


def mount_workflows(app: FastAPI, authenticated, store: WorkflowStore, service: WorkshopService):
    User = Annotated[Actor, Depends(authenticated)]

    @app.get("/v1/people", response_model=PeoplePage)
    def people(actor: User):
        return PeoplePage(items=store.people(actor))

    @app.get("/v1/checklists", response_model=TemplatePage)
    def templates(actor: User):
        return TemplatePage(items=store.templates(actor))

    @app.post("/v1/cars", response_model=CarCreated, status_code=201)
    def create_car(body: CreateCar, actor: User):
        return store.create_car(actor, body)

    @app.post("/v1/cars/{car_id}/inspections", response_model=Task, status_code=201)
    def create_inspection(car_id: UUID, body: CreateInspection, actor: User):
        return store.create_inspection(actor, car_id, body)

    @app.get("/v1/cars/{car_id}/issues", response_model=IssuesPage)
    def issues(car_id: UUID, actor: User):
        return IssuesPage(items=store.issues(actor, car_id))

    @app.post("/v1/cars/{car_id}/issues", response_model=Issue, status_code=201)
    def create_issue(car_id: UUID, body: CreateIssue, actor: User):
        return store.create_issue(actor, car_id, body)

    @app.get("/v1/workshops", response_model=WorkshopsPage)
    def workshops(actor: User):
        return WorkshopsPage(items=store.workshops(actor))

    @app.post("/v1/workshops", response_model=Workshop, status_code=201)
    def create_workshop(body: CreateWorkshop, actor: User):
        return store.create_workshop(actor, body)

    @app.post("/v1/issues/{issue_id}/repairs", response_model=RepairJob, status_code=201)
    def create_job(issue_id: UUID, body: CreateJob, actor: User):
        return store.create_job(actor, issue_id, body)

    @app.get("/v1/jobs", response_model=JobsPage)
    def jobs(actor: User, car_id: UUID | None = Query(default=None, alias="carId")):
        return JobsPage(items=store.jobs(actor, car_id))

    @app.get("/v1/jobs/{job_id}", response_model=RepairJob)
    def job(job_id: UUID, actor: User):
        return store.job(actor, job_id)

    @app.post("/v1/jobs/{job_id}/commands", response_model=RepairJob)
    def job_command(job_id: UUID, body: JobCommand, actor: User):
        return service.run(actor, job_id, body)

    @app.get("/v1/cars/{car_id}/history", response_model=HistoryPage)
    def history(car_id: UUID, actor: User):
        return HistoryPage(items=store.history(actor, car_id))
