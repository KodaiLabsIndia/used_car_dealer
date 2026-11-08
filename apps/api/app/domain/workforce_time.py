# Adapted from SBOSS commit 09e378b; see docs/SBOSS_IMPORT.md.
"""Attendance rules.

Pure functions, deliberately: geofence distance, lateness, business-local day
resolution and integrity flags are all logic worth testing directly, without
a database or an HTTP request in the way.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from math import asin, cos, radians, sin, sqrt
from zoneinfo import ZoneInfo

EARTH_RADIUS_M = 6_371_000.0

# A fix worse than this is too vague to judge a 150m geofence against, so the
# reading is flagged rather than treated as authoritative.
LOW_ACCURACY_THRESHOLD_M = 100.0

# Device clocks drift; this is the point where the gap stops looking like
# drift and starts looking like a changed clock.
CLOCK_SKEW_THRESHOLD = timedelta(minutes=10)

WEEKDAY_CODES = ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres.

    Haversine rather than a flat approximation: at Indian latitudes a naive
    equirectangular formula is off by enough to matter against a 50m geofence,
    which is the tightest setting an owner can choose.
    """
    p1, p2 = radians(lat1), radians(lat2)
    dp = radians(lat2 - lat1)
    dl = radians(lon2 - lon1)
    a = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * asin(sqrt(a))


def business_local_date(moment: datetime, timezone: str) -> date:
    """The local calendar date. Attendance shift dates are resolved separately."""
    return moment.astimezone(ZoneInfo(timezone)).date()


def is_working_day(work_date: date, working_days: list[str]) -> bool:
    """Whether the business operates on this date.

    Load-bearing: a false "absent" flag on the weekly off day is the fastest
    way to lose an owner's trust (plan 6.2).
    """
    return WEEKDAY_CODES[work_date.weekday()] in working_days


def is_late(checked_in_at: datetime, timezone: str, shift_start: str, grace_minutes: int) -> bool:
    local = checked_in_at.astimezone(ZoneInfo(timezone))
    hour, minute = (int(part) for part in shift_start.split(":"))
    cutoff = local.replace(hour=hour, minute=minute, second=0, microsecond=0) + timedelta(
        minutes=grace_minutes
    )
    return local > cutoff


def shift_end_at(work_date: date, timezone: str, shift_end: str) -> datetime:
    """When the day's shift ends, as an absolute moment."""
    tz = ZoneInfo(timezone)
    hour, minute = (int(part) for part in shift_end.split(":"))
    return datetime.combine(work_date, time(hour, minute), tzinfo=tz).astimezone(UTC)


@dataclass(frozen=True)
class LocationCheck:
    distance_m: float | None
    outside_geofence: bool
    low_accuracy: bool


def check_location(
    *,
    latitude: float | None,
    longitude: float | None,
    accuracy_m: float | None,
    business_latitude: float | None,
    business_longitude: float | None,
    geofence_radius_m: int,
) -> LocationCheck:
    """Evaluate a fix against the business location.

    Returns signals, never a verdict. A business with no location set yet
    cannot be outside it, and a worker with no fix at all is not presumed
    absent — either case yields no flag, because blocking a real employee is
    worse than recording an unverified check-in for the owner to see.
    """
    if latitude is None or longitude is None:
        return LocationCheck(distance_m=None, outside_geofence=False, low_accuracy=True)

    low_accuracy = accuracy_m is not None and accuracy_m > LOW_ACCURACY_THRESHOLD_M

    if business_latitude is None or business_longitude is None:
        return LocationCheck(distance_m=None, outside_geofence=False, low_accuracy=low_accuracy)

    distance = haversine_m(latitude, longitude, business_latitude, business_longitude)

    # A vague fix widens the allowance instead of failing: a 400m-accurate
    # reading 200m away is entirely consistent with standing in the shop.
    allowance = geofence_radius_m + (accuracy_m or 0.0)
    return LocationCheck(
        distance_m=distance,
        outside_geofence=distance > allowance,
        low_accuracy=low_accuracy,
    )


def has_clock_skew(client_time: datetime | None, server_time: datetime) -> bool:
    if client_time is None:
        return False
    return abs(client_time - server_time) > CLOCK_SKEW_THRESHOLD


def worked_minutes(checked_in_at: datetime, checked_out_at: datetime) -> int:
    return max(0, int((checked_out_at - checked_in_at).total_seconds() // 60))


def shift_duration_minutes(shift_start: str, shift_end: str) -> int:
    """Configured paid shift length, including shifts that cross midnight."""
    start_hour, start_minute = (int(part) for part in shift_start.split(":"))
    end_hour, end_minute = (int(part) for part in shift_end.split(":"))
    start = start_hour * 60 + start_minute
    end = end_hour * 60 + end_minute
    duration = end - start
    if duration <= 0:
        duration += 24 * 60
    return duration


@dataclass(frozen=True)
class ShiftWindow:
    starts_at: datetime
    ends_at: datetime
    cutoff_at: datetime


def attendance_shift_window(work_date: date, timezone: str, shift_start: str, shift_end: str) -> ShiftWindow:
    """Day shifts stay open to midnight. Night shifts stay open two hours after end.

    Calendar boundaries are constructed in local time, not by adding 24 UTC
    hours. This also preserves the boundary when daylight-saving time changes.
    Closing time is deliberately not an input.
    """
    if shift_start == shift_end:
        raise ValueError("Shift start and end must be different.")
    tz = ZoneInfo(timezone)
    start = datetime.combine(work_date, time.fromisoformat(shift_start), tzinfo=tz)
    overnight = shift_end < shift_start
    end_date = work_date + timedelta(days=int(overnight))
    end = datetime.combine(end_date, time.fromisoformat(shift_end), tzinfo=tz)
    midnight = datetime.combine(work_date + timedelta(days=1), time(), tzinfo=tz)
    cutoff = end.astimezone(UTC) + timedelta(hours=2) if overnight else midnight.astimezone(UTC)
    # An ambiguous schedule must not assign the same time to two shifts.
    next_start = datetime.combine(work_date + timedelta(days=1), start.time(), tzinfo=tz)
    if overnight and cutoff > next_start.astimezone(UTC):
        raise ValueError("The next shift must start at least two hours after this shift ends.")
    return ShiftWindow(start.astimezone(UTC), end.astimezone(UTC), cutoff)
