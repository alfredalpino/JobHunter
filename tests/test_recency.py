from __future__ import annotations

import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from models import Job
from recency import apply_recency, check_recency, parse_posted_age_days


def test_week_buckets() -> None:
    today = date(2026, 8, 24)
    age3, _ = parse_posted_age_days("3 days ago", today=today)
    age10, _ = parse_posted_age_days("10 days ago", today=today)
    age30, _ = parse_posted_age_days("2 months ago", today=today)
    assert age3 == 3
    assert age10 == 10
    assert age30 == 60

    j1 = Job("NOC Engineer", "X", "https://ex.com/1", "t", summary="posted 2 days ago")
    apply_recency(j1)
    # age from summary relative to real today — just ensure bucket logic via check_recency
    ok, _, age, bucket = check_recency(
        Job("NOC", "X", "https://ex.com/2", "t", summary="5 days ago"),
        today=today,
    )
    assert ok and age == 5 and bucket == "last_7_days"
    ok2, _, age2, bucket2 = check_recency(
        Job("NOC", "X", "https://ex.com/3", "t", summary="10 days ago"),
        today=today,
    )
    assert ok2 and age2 == 10 and bucket2 == "days_8_to_14"
    ok3, reason, _, bucket3 = check_recency(
        Job("NOC", "X", "https://ex.com/4", "t", summary="2 months ago"),
        today=today,
    )
    assert not ok3 and bucket3 == "stale" and "older" in reason.lower()


def test_reject_unknown_date() -> None:
    ok, reason, age, bucket = check_recency(
        Job("Network Engineer", "X", "https://ex.com/5", "t", summary="Great role in Dubai"),
        reject_unknown=True,
    )
    assert not ok and age is None and bucket == "unknown"
    assert "no posting date" in reason.lower()


def test_iso_date_within_two_weeks() -> None:
    today = date(2026, 8, 24)
    d = (today - timedelta(days=4)).isoformat()
    ok, _, age, bucket = check_recency(
        Job("Network Engineer", "X", "https://ex.com/6", "t", posted_at=d),
        today=today,
    )
    assert ok and age == 4 and bucket == "last_7_days"
