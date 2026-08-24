"""Hard recency rules: only jobs posted in the last 7 or 8–14 days."""
from __future__ import annotations

import re
from datetime import date
from typing import Any

from models import Job

MAX_AGE_DAYS = 14
WEEK_1_DAYS = 7

_MONTHS = {
    "january": 1,
    "jan": 1,
    "february": 2,
    "feb": 2,
    "march": 3,
    "mar": 3,
    "april": 4,
    "apr": 4,
    "may": 5,
    "june": 6,
    "jun": 6,
    "july": 7,
    "jul": 7,
    "august": 8,
    "aug": 8,
    "september": 9,
    "sep": 9,
    "sept": 9,
    "october": 10,
    "oct": 10,
    "november": 11,
    "nov": 11,
    "december": 12,
    "dec": 12,
}


def parse_posted_age_days(text: str, *, today: date | None = None) -> tuple[int | None, str]:
    """Return (age_in_days, evidence) if a posting date/relative age is found."""
    today = today or date.today()
    t = (text or "").lower().replace("–", "-").replace("—", "-")

    for m in re.finditer(r"\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b", t):
        try:
            d = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            return (today - d).days, m.group(0)
        except ValueError:
            pass

    for m in re.finditer(
        r"\b(?:posted\s+(?:on\s+)?)?(january|february|march|april|may|june|july|august|"
        r"september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)"
        r"\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(20\d{2}))?\b",
        t,
    ):
        mon = _MONTHS.get(m.group(1)) or _MONTHS.get(m.group(1)[:3])
        if not mon:
            continue
        day_n = int(m.group(2))
        year = int(m.group(3)) if m.group(3) else today.year
        try:
            d = date(year, mon, day_n)
        except ValueError:
            continue
        if not m.group(3) and d > today:
            try:
                d = date(year - 1, mon, day_n)
            except ValueError:
                continue
        return (today - d).days, m.group(0)

    for m in re.finditer(
        r"\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|"
        r"september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)"
        r"(?:,?\s*(20\d{2}))?\b",
        t,
    ):
        mon = _MONTHS.get(m.group(2)) or _MONTHS.get(m.group(2)[:3])
        if not mon:
            continue
        day_n = int(m.group(1))
        year = int(m.group(3)) if m.group(3) else today.year
        try:
            d = date(year, mon, day_n)
        except ValueError:
            continue
        if not m.group(3) and d > today:
            try:
                d = date(year - 1, mon, day_n)
            except ValueError:
                continue
        return (today - d).days, m.group(0)

    # API epoch seconds / millis in posted_at alone
    if re.fullmatch(r"\d{10}", text.strip()):
        try:
            from datetime import datetime, timezone

            d = datetime.fromtimestamp(int(text.strip()), tz=timezone.utc).date()
            return (today - d).days, f"epoch:{text.strip()}"
        except (ValueError, OSError):
            pass
    if re.fullmatch(r"\d{13}", text.strip()):
        try:
            from datetime import datetime, timezone

            d = datetime.fromtimestamp(int(text.strip()) / 1000, tz=timezone.utc).date()
            return (today - d).days, f"epoch_ms:{text.strip()}"
        except (ValueError, OSError):
            pass

    if re.search(r"\b(just posted|posted today|today|hours?\s+ago|minutes?\s+ago)\b", t):
        return 0, "today/hours-ago"
    if re.search(r"\byesterday\b", t):
        return 1, "yesterday"
    m = re.search(r"\b(\d+)\s*hours?\s+ago\b", t)
    if m:
        return 0, m.group(0)
    m = re.search(r"\b(\d+)\s*days?\s+ago\b", t)
    if m:
        return int(m.group(1)), m.group(0)
    m = re.search(r"\b(\d+)\s*weeks?\s+ago\b", t)
    if m:
        return int(m.group(1)) * 7, m.group(0)
    m = re.search(r"\b(\d+)\s*months?\s+ago\b", t)
    if m:
        return int(m.group(1)) * 30, m.group(0)
    m = re.search(r"\b(\d+)\s*years?\s+ago\b", t)
    if m:
        return int(m.group(1)) * 365, m.group(0)
    if re.search(r"\ba\s+year\s+ago\b", t):
        return 365, "a year ago"
    if re.search(r"\blast\s+month\b", t):
        return 30, "last month"
    if re.search(r"\bthis\s+week\b", t):
        return 3, "this week"
    if re.search(r"\blast\s+week\b", t):
        return 7, "last week"

    return None, ""


def check_recency(
    job: Job | dict[str, Any],
    *,
    max_age_days: int = MAX_AGE_DAYS,
    reject_unknown: bool = True,
    week_1_days: int = WEEK_1_DAYS,
    today: date | None = None,
) -> tuple[bool, str, int | None, str]:
    """Return (ok, reason, age_days, bucket)."""
    if isinstance(job, Job):
        blob = " ".join(
            [
                job.posted_at or "",
                job.title or "",
                job.summary or "",
                job.location or "",
            ]
        )
        if job.posted_at and job.posted_at.isdigit():
            age, evidence = parse_posted_age_days(job.posted_at, today=today)
            if age is None:
                age, evidence = parse_posted_age_days(blob, today=today)
        else:
            age, evidence = parse_posted_age_days(blob, today=today)
    else:
        blob = " ".join(
            str(job.get(k) or "")
            for k in ("posted_at", "date", "published", "title", "summary", "location")
        )
        age, evidence = parse_posted_age_days(blob, today=today)

    if age is None:
        if reject_unknown:
            return False, "REJECT: no posting date (unknown/missing)", None, "unknown"
        return True, "posted_at:unknown (allowed)", None, "unknown"
    if age < 0:
        return False, f"REJECT: invalid/future posting date ({evidence})", age, "unknown"
    if age > max_age_days:
        return (
            False,
            f"REJECT: older than {max_age_days}d ({evidence}, ~{age}d)",
            age,
            "stale",
        )
    bucket = "last_7_days" if age <= week_1_days else "days_8_to_14"
    return True, f"fresh:~{age}d ({evidence})", age, bucket


def apply_recency(
    job: Job,
    *,
    max_age_days: int = MAX_AGE_DAYS,
    reject_unknown: bool = True,
    week_1_days: int = WEEK_1_DAYS,
) -> Job:
    ok, reason, age, bucket = check_recency(
        job,
        max_age_days=max_age_days,
        reject_unknown=reject_unknown,
        week_1_days=week_1_days,
    )
    job.posted_age_days = age
    job.recency_bucket = bucket
    if not ok:
        job.eligible = False
        job.score = 0
        job.reject_reason = reason
    return job
