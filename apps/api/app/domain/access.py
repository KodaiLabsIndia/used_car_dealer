from app.contracts import Actor
from app.domain.errors import BusinessError

RULES = {
    "leads": {"sales", "manager"},
    "lead_admin": {"manager"},
    "overview": {"coordinator", "supervisor", "manager"},
    "intake": {"manager"},
    "assign_inspection": {"supervisor", "manager"},
    "review_inspection": {"supervisor", "manager"},
    "service": {"coordinator", "supervisor", "manager"},
}


def can(actor: Actor, capability: str) -> bool:
    return actor.role == "owner" or bool(set(actor.work_roles) & RULES[capability])


def require(actor: Actor, capability: str):
    if not can(actor, capability):
        raise BusinessError("FORBIDDEN", "Ask a person responsible for this work.", 403)
