from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.contracts import (
    Actor,
    AnswerCommand,
    Car,
    Evidence,
    HelpCommand,
    ReviewCommand,
    SubmitCommand,
    TakeoverCommand,
    Task,
)
from app.domain.errors import BusinessError
from app.domain.task_policy import normalized_photo_size, plan_task_command
from app.seed import IDS, ITEMS


@pytest.fixture
def work():
    actor = Actor(id=IDS["employee"], company_id=IDS["company"], name="Ravi", role="employee")
    car = Car(
        id=IDS["seltos"],
        vehicle_id=IDS["seltos"],
        stock_number="AC-028",
        make="Kia",
        model="Seltos",
        registration="SAMPLE",
        year=2022,
        stage="inspection",
        commercial_status="available",
        service_status="none",
        location="Yard",
        next_action="Inspect",
        due_at=None,
        version=1,
        updated_at=datetime.now(UTC),
        image_key="seltos",
    )
    task = Task(
        id=IDS["employee_task"],
        company_id=actor.company_id,
        car_id=car.id,
        title="Inspection",
        assigned_to=actor.id,
        assignee_name="Ravi",
        status="assigned",
        version=1,
        help_open=False,
        due_at=None,
        car=car,
        items=ITEMS,
        answers=[],
        evidence=[],
    )
    return actor, task


def test_help_never_requires_a_photo(work):
    actor, task = work
    result = plan_task_command(
        actor,
        task,
        HelpCommand(action="help", command_id=uuid4(), expected_version=1, item_id=ITEMS[0]["id"]),
    )
    assert result.help_request is not None
    assert result.status is None
    assert task.answers == []


def test_submit_requires_every_required_photo_and_answer(work):
    actor, task = work
    with pytest.raises(BusinessError) as error:
        plan_task_command(actor, task, SubmitCommand(action="submit", command_id=uuid4(), expected_version=1))
    assert error.value.code == "INCOMPLETE"


def test_photo_must_belong_to_the_same_check(work):
    actor, task = work
    evidence = Evidence(id=uuid4(), item_id=ITEMS[1]["id"], width=1080, height=1080, bytes=100, sha256="abc")
    task.evidence = [evidence]
    with pytest.raises(BusinessError) as error:
        plan_task_command(
            actor,
            task,
            AnswerCommand(
                action="answer",
                command_id=uuid4(),
                expected_version=1,
                item_id=ITEMS[0]["id"],
                evidence_id=evidence.id,
                result="ok",
            ),
        )
    assert error.value.code == "EVIDENCE_REQUIRED"


def test_owner_can_take_over_and_self_review_is_attributed(work):
    _, task = work
    owner = Actor(id=IDS["owner"], company_id=IDS["company"], name="Owner", role="owner")
    plan = plan_task_command(
        owner, task, TakeoverCommand(action="takeover", command_id=uuid4(), expected_version=1)
    )
    assert plan.assigned_to == owner.id
    task.assigned_to, task.status = owner.id, "submitted"
    review = plan_task_command(
        owner, task, ReviewCommand(action="review", command_id=uuid4(), expected_version=1, decision="accept")
    )
    assert review.review == {"decision": "accept", "selfReview": True}


def test_owner_filters_cannot_grant_cross_company_access(work):
    _, task = work
    stranger = Actor(id=uuid4(), company_id=uuid4(), name="Other owner", role="owner")
    with pytest.raises(BusinessError) as error:
        plan_task_command(
            stranger, task, TakeoverCommand(action="takeover", command_id=uuid4(), expected_version=1)
        )
    assert error.value.status == 404


def test_staff_cannot_review_own_work(work):
    actor, task = work
    task.status = "submitted"
    with pytest.raises(BusinessError) as error:
        plan_task_command(
            actor,
            task,
            ReviewCommand(action="review", command_id=uuid4(), expected_version=1, decision="accept"),
        )
    assert error.value.status == 403


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        ((4000, 3000), (1440, 1080)),
        ((3000, 4000), (1080, 1440)),
        ((2160, 3840), (1080, 1920)),
        ((4000, 4000), (1080, 1080)),
        ((640, 480), (640, 480)),
        ((3840, 2160), (1920, 1080)),
    ],
)
def test_photo_profile_preserves_shape_without_upscaling(source, expected):
    assert normalized_photo_size(*source) == expected


def test_invalid_dimensions_are_rejected():
    with pytest.raises(ValueError):
        normalized_photo_size(0, 100)
