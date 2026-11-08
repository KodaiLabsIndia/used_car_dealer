from datetime import UTC, date, datetime

import pytest

from app.domain.workforce_pay import allocate_prorated_rate, calculate_salary
from app.domain.workforce_time import attendance_shift_window
from app.workforce_contracts import Schedule, WorkforceCommand


@pytest.mark.parametrize(
    "basis,rate,units,minutes,expected",
    [
        ("daily", 50_001, 1, 0, 25_001),
        ("hourly", 12_000, 0, 95, 19_000),
        ("monthly", 300_000, 21, 0, 121_154),
    ],
)
def test_integer_pay_rounding(basis, rate, units, minutes, expected):
    p = calculate_salary(
        pay_basis=basis,
        rate_paise=rate,
        payable_half_days=units,
        payable_minutes=minutes,
        scheduled_work_days=26,
        bonus_paise=0,
        advance_opening_paise=999_999,
    )
    assert p.base_pay_paise == expected and p.net_pay_paise == 0 and p.advance_recovered_paise == expected


def test_prorated_rate_conserves_paise_across_period_splits():
    assert sum(allocate_prorated_rate(1_000_001, 52, (i,)) for i in range(52)) == 1_000_001


def test_night_shift_stays_on_start_date_and_cutoff():
    w = attendance_shift_window(date(2026, 11, 2), "Asia/Kolkata", "22:00", "06:00")
    assert w.starts_at == datetime(2026, 11, 2, 16, 30, tzinfo=UTC)
    assert w.cutoff_at == datetime(2026, 11, 3, 2, 30, tzinfo=UTC)
    with pytest.raises(ValueError):
        Schedule(start="06:00", end="05:00")


@pytest.mark.parametrize("amount", [True, 1.5, -1])
def test_money_rejects_float_bool_and_negative(amount):
    with pytest.raises(ValueError):
        WorkforceCommand(
            commandId="00000000-0000-4000-8000-000000000000", action="request_advance", amountPaise=amount
        )


def test_salary_projection_rounds_hourly_time_once_for_the_pay_period():
    from app.domain.workforce_policy import days, salary_from_sources
    from app.workforce_contracts import DayReview, PayTerms, WorkforcePolicy

    policy = WorkforcePolicy()
    start = date(2026, 11, 2)
    end = date(2026, 11, 3)
    reviews = {
        d: DayReview(
            id="00000000-0000-4000-8000-000000000001",
            work_date=d,
            half_days=1,
            minutes=30,
            reason="Agreed half shift",
            reviewed_by="Owner",
            source_signature="empty",
        )
        for d in days(start, end)
    }
    p = salary_from_sources(
        user_id="00000000-0000-4000-8000-000000000001",
        start=start,
        end=end,
        today=date(2026, 11, 4),
        terms=PayTerms(effective_from=start, basis="hourly", cycle="weekly", rate_paise=1),
        policy=policy,
        policies={d: policy for d in days(start, end)},
        sessions={},
        reviews=reviews,
        requests=[],
        events=[],
        salaries=[],
        balance=0,
        plan=None,
        bonus=0,
        deduction=0,
        empty_signature="empty",
    )
    assert p.base_paise == 1 and sum(d.earnings_paise for d in p.source_days) == 1


def test_period_totals_can_exceed_a_single_entry_limit_without_losing_paise():
    from app.workforce_contracts import PayDay, PayTerms, SalaryPreview

    amount = 100_000_000_000 * 24
    p = SalaryPreview(
        user_id="00000000-0000-4000-8000-000000000001",
        start=date(2026, 11, 2),
        end=date(2026, 11, 2),
        due_on=date(2026, 11, 3),
        terms=PayTerms(
            effective_from=date(2026, 11, 2), basis="hourly", cycle="daily", rate_paise=100_000_000_000
        ),
        source_days=[
            PayDay(
                day=date(2026, 11, 2),
                source="reviewed",
                half_days=2,
                minutes=1440,
                earnings_paise=amount,
                warnings=[],
            )
        ],
        base_paise=amount,
        bonus_paise=0,
        deduction_paise=0,
        advance_balance_paise=0,
        advance_recovery_paise=0,
        net_paise=amount,
        blockers=[],
        fingerprint="reviewed",
    )
    assert p.net_paise == 2_400_000_000_000
