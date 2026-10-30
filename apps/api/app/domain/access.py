from app.contracts import Actor
from app.domain.errors import BusinessError

# Legacy manager records retain their previous oversight authority. New accounts
# are configured as Employee or Supervisor; task responsibilities are not tiers.
SUPERVISORS = {"supervisor", "manager"}
RULES = {
    "stock_catalog": {"sales", *SUPERVISORS},
    "leads": {"inspector", "sales", "coordinator", *SUPERVISORS},
    "lead_admin": SUPERVISORS,
    "overview": SUPERVISORS,
    "intake": SUPERVISORS,
    "assign_inspection": SUPERVISORS,
    "review_inspection": SUPERVISORS,
    "service": SUPERVISORS,
    "finance": SUPERVISORS,
}


def can(actor: Actor, capability: str) -> bool:
    return actor.role == "owner" or bool(set(actor.work_roles) & RULES[capability])


def require(actor: Actor, capability: str):
    if not can(actor, capability):
        raise BusinessError("FORBIDDEN", "Ask the owner or a supervisor to make this change.", 403)
