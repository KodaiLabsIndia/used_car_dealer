from calendar import monthrange
from datetime import datetime

from app.commercial_contracts import WarrantyConfiguration, WarrantyTerms
from app.domain.errors import BusinessError


def add_months(value: datetime, months: int) -> datetime:
    month_index = value.year * 12 + value.month - 1 + months
    year, zero_month = divmod(month_index, 12)
    month = zero_month + 1
    return value.replace(year=year, month=month, day=min(value.day, monthrange(year, month)[1]))


def validate_configuration(value: WarrantyConfiguration):
    components = [c.strip() for c in value.covered_components]
    if (
        any(not c or len(c) > 120 for c in components)
        or len({c.casefold() for c in components}) != len(components)
        or not all(v.strip() for v in [value.terms, value.provider, value.policy_reference])
    ):
        raise BusinessError(
            "WARRANTY_TERMS_REQUIRED",
            "Record unique covered components, provider, reference and written terms.",
        )


def issue_warranty(value: WarrantyConfiguration, delivered_at: datetime) -> WarrantyTerms:
    validate_configuration(value)
    return WarrantyTerms(**value.model_dump(), until=add_months(delivered_at, value.duration_months))
