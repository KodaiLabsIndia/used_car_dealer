import json
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.adapters.database import create_database
from app.checklists import templates_for
from app.config import Settings

IDS = {
    "company": UUID("10000000-0000-4000-8000-000000000001"),
    "owner": UUID("10000000-0000-4000-8000-000000000002"),
    "employee": UUID("10000000-0000-4000-8000-000000000003"),
    "sonet": UUID("10000000-0000-4000-8000-000000000011"),
    "seltos": UUID("10000000-0000-4000-8000-000000000012"),
    "owner_task": UUID("10000000-0000-4000-8000-000000000021"),
    "employee_task": UUID("10000000-0000-4000-8000-000000000022"),
}
ITEMS = [
    {
        "id": "front-left-tyre",
        "title": "Front-left tyre",
        "titleHi": "आगे का बायाँ टायर",
        "instruction": "Show the whole tyre sidewall and its markings.",
        "instructionHi": "टायर का पूरा किनारा और निशान दिखाते हुए फोटो लें।",
        "order": 1,
        "required": True,
    },
    {
        "id": "front-right-tyre",
        "title": "Front-right tyre",
        "titleHi": "आगे का दायाँ टायर",
        "instruction": "Take a clear photo of the sidewall and tread.",
        "instructionHi": "टायर के किनारे और निशान की साफ़ फोटो लें।",
        "order": 2,
        "required": True,
    },
    {
        "id": "headlights",
        "title": "Front lights",
        "titleHi": "आगे की लाइट",
        "instruction": "Turn on the lights. Photograph both front lights.",
        "instructionHi": "लाइट चालू करें। दोनों आगे की लाइट की फोटो लें।",
        "order": 3,
        "required": True,
    },
]


def seed(engine: Engine, include_workshop_examples: bool = False) -> None:
    with engine.begin() as c:
        c.execute(
            text(
                "INSERT INTO companies(id,name,access_code) VALUES(:company,'Arihant Cars · training','arihant-training') ON CONFLICT DO NOTHING"
            ),
            IDS,
        )
        for template in templates_for(IDS["company"]):
            c.execute(
                text("""INSERT INTO checklist_templates(id,company_id,name,kind,version,approved,items)
                VALUES(:id,:company,:name,:kind,:version,:approved,CAST(:items AS jsonb)) ON CONFLICT DO NOTHING"""),
                {
                    "id": template.id,
                    "company": IDS["company"],
                    "name": template.name,
                    "kind": template.kind,
                    "version": template.version,
                    "approved": template.approved,
                    "items": json.dumps(
                        [item.model_dump(mode="json", by_alias=True) for item in template.items]
                    ),
                },
            )
        for name, role in [("Owner", "owner"), ("Ravi", "employee")]:
            c.execute(
                text(
                    "INSERT INTO users(id,company_id,name,role) VALUES(:id,:company,:name,:role) ON CONFLICT DO NOTHING"
                ),
                {"id": IDS[role], "company": IDS["company"], "name": name, "role": role},
            )
        for key, model, plate in [("sonet", "Sonet", "MH 46 BZ 9945"), ("seltos", "Seltos", "AC-028 SAMPLE")]:
            c.execute(
                text(
                    "INSERT INTO vehicles(id,company_id,make,model,registration,year,image_key) VALUES(:id,:company,'Kia',:model,:plate,2022,:key) ON CONFLICT DO NOTHING"
                ),
                {"id": IDS[key], "company": IDS["company"], "model": model, "plate": plate, "key": key},
            )
        c.execute(
            text("""INSERT INTO stock_cycles(id,company_id,vehicle_id,stock_number,stage,commercial_status,service_status,location,next_action,due_at)
            VALUES(:sonet,:company,:sonet,'AC-027','refurbishment','available','waiting_parts','ABC Workshop','Fit brake pads, then recheck',now()+interval '2 days'),
            (:seltos,:company,:seltos,'AC-028','inspection','available','none','Arihant yard','Complete intake inspection',now()+interval '1 day') ON CONFLICT DO NOTHING"""),
            IDS,
        )
        c.execute(
            text("""INSERT INTO tasks(id,company_id,cycle_id,title,assigned_to,items,due_at)
            VALUES(:owner_task,:company,:sonet,'Workshop recheck',:owner,CAST(:items AS jsonb),now()+interval '1 day'),
            (:employee_task,:company,:seltos,'Intake inspection',:employee,CAST(:items AS jsonb),now()+interval '1 day') ON CONFLICT DO NOTHING"""),
            IDS | {"items": json.dumps(ITEMS)},
        )
        if include_workshop_examples:
            example = IDS | {
                "workshop": UUID("10000000-0000-4000-8000-000000000041"),
                "issue": UUID("10000000-0000-4000-8000-000000000031"),
                "job": UUID("10000000-0000-4000-8000-000000000051"),
                "part": UUID("10000000-0000-4000-8000-000000000061"),
            }
            c.execute(
                text("""INSERT INTO workshops(id,company_id,name,phone)
                VALUES(:workshop,:company,'ABC Workshop · training','') ON CONFLICT DO NOTHING"""),
                example,
            )
            c.execute(
                text("""INSERT INTO issues(id,company_id,cycle_id,description,status,created_by)
                VALUES(:issue,:company,:sonet,'Fit brake pads · training','in_repair',:owner)
                ON CONFLICT DO NOTHING"""),
                example,
            )
            c.execute(
                text("""INSERT INTO repair_jobs(id,company_id,cycle_id,issue_id,title,assigned_to,workshop_id,status,blocker,due_at)
                VALUES(:job,:company,:sonet,:issue,'Fit brake pads · training',:owner,:workshop,'waiting_parts','Brake pads requested',now()+interval '2 days')
                ON CONFLICT DO NOTHING"""),
                example,
            )
            c.execute(
                text("""INSERT INTO part_requests(id,company_id,job_id,name,expected_at)
                VALUES(:part,:company,:job,'Brake pads · training',now()+interval '1 day')
                ON CONFLICT DO NOTHING"""),
                example,
            )


if __name__ == "__main__":
    config = Settings()
    config.validate_runtime()
    engine = create_database(config.sqlalchemy_url)
    try:
        seed(engine, include_workshop_examples=True)
        print(
            "Training cars, workshop, repair, part and draft checklists are ready. Arihant approval is still required."
        )
    finally:
        engine.dispose()
