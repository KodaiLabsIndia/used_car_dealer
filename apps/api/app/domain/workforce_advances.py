# Adapted from SBOSS commit 09e378b; see docs/SBOSS_IMPORT.md.
"""Salary-advance limits. Money stays in integer paise."""

from datetime import date


def deduction_limit(
    *,
    mode: str,
    balance: int,
    covered_remaining: int,
    portion: int,
    period_start: date,
    plan_start: date,
    deduction_start: date,
) -> int:
    if min(balance, covered_remaining, portion) < 0:
        raise ValueError("Advance amounts must not be negative.")
    covered = min(balance, covered_remaining)
    if period_start < deduction_start:
        return 0
    if mode == "partial" and period_start == plan_start:
        return min(covered, portion)
    if mode == "split":
        return min(covered, portion)
    if mode not in {"full", "skip", "partial"}:
        raise ValueError("Unknown advance plan.")
    return covered
