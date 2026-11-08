"""Date-relative scenario definitions and small SQL insertion helpers."""

import hashlib
import json
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Literal
from uuid import NAMESPACE_URL, UUID, uuid5
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import text

from app.contracts import VehicleConfiguration, WorkRole
from app.demo_identity import IDS

IST = ZoneInfo("Asia/Kolkata")
CONFIG = Path(__file__).resolve().parents[1] / "data/demo_scenarios.json"


def uid(key: str, namespace: str = "default") -> UUID:
    return IDS.get(key) or uuid5(NAMESPACE_URL, f"arihant:demo:v1:{namespace}:{key}")


def wire(value):
    return json.dumps(
        value,
        default=lambda v: v.isoformat() if isinstance(v, (date, datetime)) else str(v),
        ensure_ascii=False,
    )


class Staff(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    key: str
    name: str
    username: str = Field(pattern=r"^[a-zA-Z0-9._-]{2,40}$")
    role: Literal["owner", "employee"]
    work_roles: list[WorkRole] = Field(alias="workRoles", min_length=1)
    pay_basis: Literal["daily", "weekly", "monthly", "hourly"] = Field(alias="payBasis")
    rate_paise: int = Field(alias="ratePaise", gt=0)


class DemoCar(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    key: str
    make: str
    model: str
    year: int
    body: str
    fuel: str
    transmission: str
    purchase_rupees: int = Field(alias="purchaseRupees", gt=0)
    resale_rupees: int = Field(alias="resaleRupees", gt=0)
    age_days: int = Field(alias="ageDays", ge=3)
    scenario: str
    next_action: str = Field(alias="nextAction")
    delivered_days_ago: int | None = Field(default=None, alias="deliveredDaysAgo", ge=1)
    warranty_months: int = Field(default=6, alias="warrantyMonths")


class DemoConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    version: int = Field(gt=0)
    company_name: str = Field(alias="companyName")
    dealer_code: str = Field(alias="dealerCode")
    staff: list[Staff]
    cars: list[DemoCar]

    @model_validator(mode="after")
    def validate_scenarios(self):
        if "demo" not in self.company_name.casefold():
            raise ValueError(
                "Keep Demo in the company name so this data cannot be mistaken for live operations."
            )
        if len(self.staff) != 6 or {p.key for p in self.staff} != {
            "owner",
            "employee",
            "supervisor",
            "service",
            "sales",
            "office",
        }:
            raise ValueError("Keep the six named demo roles so each operational scenario has its actors.")
        expected = {
            "inspection": "shared_inspection",
            "purchase_review": "purchase_submitted",
            "purchase_approved": "purchase_approved",
            "parts": "waiting_parts",
            "service": "service_quote",
            "qc": "repair_qc",
            "ready": "ready_refund",
            "booked": "booked",
            "delivered": "warranty_pending",
            "warranty_service": "warranty_repair",
            "warranty_closed": "warranty_closed",
        }
        if len(self.cars) != len(expected) or {c.key: c.scenario for c in self.cars} != expected:
            raise ValueError(
                "Keep the 11 scenario keys and workflows; customize their vehicle details, prices and relative dates."
            )
        if len({p.username.casefold() for p in self.staff}) != len(self.staff):
            raise ValueError("Demo usernames must be unique.")
        if any((p.key == "owner") != (p.role == "owner") for p in self.staff):
            raise ValueError("The owner demo account must be the single owner.")
        for car in self.cars:
            VehicleConfiguration(body_type=car.body, fuel=car.fuel, transmission=car.transmission)
            if car.scenario.startswith("warranty_") and car.delivered_days_ago is None:
                raise ValueError("Sold-car scenarios require deliveredDaysAgo.")
            if car.warranty_months not in (3, 6, 12) or (
                car.delivered_days_ago and car.age_days < car.delivered_days_ago + 10
            ):
                raise ValueError(
                    "Use a supported warranty and enough time for inspection, acquisition and delivery."
                )
        return self

    @classmethod
    def load(cls, path: Path = CONFIG):
        return cls.model_validate_json(path.read_text())

    @property
    def fingerprint(self):
        return hashlib.sha256(self.model_dump_json(by_alias=True).encode()).hexdigest()


@dataclass(frozen=True)
class DemoClock:
    as_of: date

    def day(self, offset=0):
        return self.as_of + timedelta(days=offset)

    def at(self, offset=0, hour=10, minute=0):
        return datetime.combine(self.day(offset), time(hour, minute), IST)

    @property
    def previous_month(self):
        end = self.as_of.replace(day=1) - timedelta(days=1)
        return end.replace(day=1), end


def insert(conn, table: str, **values):
    # Table/column names are internal constants, never user input.
    params = {}
    expressions = []
    for key, value in values.items():
        if isinstance(value, (dict, list)) and key != "work_roles":
            params[key] = wire(value)
            expressions.append(f"CAST(:{key} AS jsonb)")
        else:
            params[key] = value
            expressions.append(f":{key}")
    conn.execute(text(f"INSERT INTO {table} ({','.join(values)}) VALUES ({','.join(expressions)})"), params)


def audit(
    conn,
    clock: DemoClock,
    key: str,
    aggregate: UUID,
    action: str,
    summary: str,
    offset=-1,
    actor="owner",
    **details,
):
    insert(
        conn,
        "audit_events",
        id=uid("audit:" + key),
        company_id=uid("company"),
        actor_id=actor if isinstance(actor, UUID) else uid(actor),
        aggregate_id=aggregate,
        action=action,
        details={"summary": summary, "origin": "demo-seed", "demoAsOf": clock.as_of.isoformat(), **details},
        created_at=clock.at(offset, 14),
    )
