# Adapted from SBOSS commit 09e378b; see docs/SBOSS_IMPORT.md.
"""Pure, integer-paise salary calculations."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SalaryAmounts:
    base_pay_paise: int
    advance_recovered_paise: int
    advance_closing_paise: int
    net_pay_paise: int


def calculate_salary(
    *,
    pay_basis: str,
    rate_paise: int,
    payable_half_days: int,
    scheduled_work_days: int,
    bonus_paise: int,
    advance_opening_paise: int,
    advance_deduction_limit_paise: int | None = None,
    payable_minutes: int = 0,
    weekly_units: tuple[tuple[int, int], ...] = (),
    monthly_units: tuple[tuple[int, int], ...] = (),
    prorated_unit_earnings: tuple[int, ...] = (),
) -> SalaryAmounts:
    """Calculate without floats and never turn salary into employee debt."""
    if pay_basis not in {"daily", "weekly", "hourly", "monthly"}:
        raise ValueError("pay_basis must be daily, weekly, hourly or monthly")
    if (
        min(
            rate_paise,
            scheduled_work_days,
            payable_half_days,
            payable_minutes,
            bonus_paise,
            advance_opening_paise,
        )
        < 0
        or scheduled_work_days == 0
    ):
        raise ValueError("salary inputs must be non-negative and scheduled days positive")
    if any(payable < 0 or scheduled <= 0 or payable > scheduled for payable, scheduled in weekly_units):
        raise ValueError("weekly units must contain valid payable and scheduled half-days")
    if any(payable < 0 or scheduled <= 0 or payable > scheduled for payable, scheduled in monthly_units):
        raise ValueError("monthly units must contain valid payable and scheduled half-days")
    if any(amount < 0 for amount in prorated_unit_earnings):
        raise ValueError("prorated unit earnings must be non-negative")

    if pay_basis == "daily":
        base = _rounded_ratio(rate_paise * payable_half_days, 2)
    elif pay_basis == "hourly":
        base = _rounded_ratio(rate_paise * payable_minutes, 60)
    elif pay_basis in {"weekly", "monthly"} and prorated_unit_earnings:
        base = sum(prorated_unit_earnings)
    elif pay_basis == "weekly" and weekly_units:
        base = sum(_rounded_ratio(rate_paise * payable, scheduled) for payable, scheduled in weekly_units)
    elif pay_basis == "monthly" and monthly_units:
        base = sum(_rounded_ratio(rate_paise * payable, scheduled) for payable, scheduled in monthly_units)
    else:
        base = _rounded_ratio(rate_paise * payable_half_days, scheduled_work_days * 2)
    gross = base + bonus_paise
    if advance_deduction_limit_paise is not None and advance_deduction_limit_paise < 0:
        raise ValueError("Advance deduction limit must not be negative.")
    recovered = min(
        gross,
        advance_opening_paise,
        advance_opening_paise if advance_deduction_limit_paise is None else advance_deduction_limit_paise,
    )
    return SalaryAmounts(base, recovered, advance_opening_paise - recovered, gross - recovered)


def _rounded_ratio(numerator: int, denominator: int) -> int:
    """Round non-negative integer money ratios half-up, never through float."""
    return (numerator + denominator // 2) // denominator


def allocate_prorated_rate(
    rate_paise: int,
    scheduled_units: int,
    payable_unit_indexes: tuple[int, ...],
) -> int:
    """Allocate one agreed rate across fixed ordered units without a rounding leak.

    Each scheduled half-day owns the difference between two cumulative rounded
    totals. Therefore every unit has a deterministic paise value and all units
    together always equal ``rate_paise``, even when a week or month is split
    across several statements.
    """
    if rate_paise < 0 or scheduled_units <= 0:
        raise ValueError("rate and scheduled units must be valid")
    if len(set(payable_unit_indexes)) != len(payable_unit_indexes) or any(
        index < 0 or index >= scheduled_units for index in payable_unit_indexes
    ):
        raise ValueError("payable unit indexes must be unique scheduled units")
    return sum(
        _rounded_ratio(rate_paise * (index + 1), scheduled_units)
        - _rounded_ratio(rate_paise * index, scheduled_units)
        for index in payable_unit_indexes
    )
