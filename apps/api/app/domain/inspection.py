"""Deterministic applicability. Unknown configuration retains work for explicit review."""

from app.contracts import ChecklistItem, VehicleConfiguration


def resolve_checks(items: list[ChecklistItem], configuration: VehicleConfiguration) -> list[ChecklistItem]:
    result = []
    for item in items:
        rule = item.applicability
        unknown = []
        excluded = False
        for field, allowed in [("fuel", rule.fuels), ("transmission", rule.transmissions)]:
            if not allowed:
                continue
            value = getattr(configuration, field)
            if value == "unknown":
                unknown.append(field)
            elif value not in allowed:
                excluded = True
        if rule.feature:
            fitted = configuration.features.get(rule.feature)
            if fitted is False:
                excluded = True
            elif fitted is None:
                unknown.append(rule.feature)
        if not excluded:
            result.append(
                item.model_copy(
                    update={
                        "order": len(result) + 1,
                        "configuration_pending": bool(unknown),
                        "applicability_reason": "Confirm fitted configuration: " + ", ".join(unknown)
                        if unknown
                        else "",
                    }
                )
            )
    return result
