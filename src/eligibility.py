from __future__ import annotations

import re
from typing import Any

from models import Job
from recency import apply_recency
from seniority import reject_for_seniority

JUNIOR = re.compile(
    r"\b(junior|jr\.?|entry[\s-]?level|intern|graduate|new grad|noc l1|l1)\b",
    re.I,
)
ASSOCIATE = re.compile(r"\bassociate\b", re.I)

YEAR_RANGE = re.compile(
    r"(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)",
    re.I,
)
YEAR_PLUS = re.compile(
    r"(?:at least|minimum|min\.?|over|more than)?\s*(\d+(?:\.\d+)?)\s*\+\s*(?:years?|yrs?)",
    re.I,
)
YEAR_EXP = re.compile(
    r"(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp\.?)",
    re.I,
)
YEAR_URL = re.compile(r"(\d+)\s*-to-\s*(\d+)\s*-years?", re.I)

HUB_TITLE = re.compile(
    r"(jobs in |job vacancies|\d{2,}\+?\s+\w+\s+jobs|salary guide|salaries|"
    r"what .+ jobs are|open job preview|courses? in |page \d+|top companies)",
    re.I,
)
HUB_URL = re.compile(
    r"(/salaries/|/salary-guide|/roles/|/q-[^/]+-jobs|/Job/[^/]*SRCH_|"
    r"/search\?|/jobs\?|/course/|/courses\.|/explore/)",
    re.I,
)


def _has_phrase(text: str, phrase: str) -> bool:
    phrase = phrase.lower().strip()
    if " " in phrase or len(phrase) > 4:
        return phrase in text
    return bool(re.search(rf"\b{re.escape(phrase)}\b", text))


def _max_years(text: str) -> float | None:
    t = text.lower().replace("–", "-").replace("—", "-")
    floors: list[float] = []
    for m in YEAR_RANGE.finditer(t):
        floors.append(float(m.group(1)))
    for m in YEAR_PLUS.finditer(t):
        floors.append(float(m.group(1)))
    for m in YEAR_EXP.finditer(t):
        floors.append(float(m.group(1)))
    for m in YEAR_URL.finditer(t):
        floors.append(float(m.group(1)))
    if not floors:
        return 0.0 if JUNIOR.search(t) else None
    return max(floors)


def is_hub(job: Job) -> bool:
    if HUB_TITLE.search(job.title or ""):
        return True
    url = job.url or ""
    if HUB_URL.search(url) and "viewjob" not in url and "/job/" not in url.lower():
        return True
    if re.search(r"indeed\.com/q-.+-jobs", url, re.I):
        return True
    if "glassdoor.com/Job/" in url and "SRCH_" in url:
        return True
    return False


def score_job(job: Job, profile: dict[str, Any]) -> Job:
    # Recency first — months-old / unknown dates never make the list
    rec = profile.get("recency") or {}
    job = apply_recency(
        job,
        max_age_days=int(rec.get("max_age_days") or 14),
        reject_unknown=bool(rec.get("reject_unknown_date", True)),
        week_1_days=int(rec.get("bucket_week_1_days") or 7),
    )
    if job.reject_reason.startswith("REJECT:"):
        return job

    if is_hub(job):
        job.reject_reason = "search hub / salary / course page"
        job.eligible = False
        job.score = 0
        return job

    blob = job.blob()
    title = (job.title or "").lower()
    scoring = profile.get("scoring") or {}
    max_years = float((profile.get("experience") or {}).get("max_years_required") or 3)
    min_keep = int(scoring.get("min_score_to_keep") or 35)

    exclude = [s.lower() for s in profile.get("exclude_title_signals") or []]
    must = [s.lower() for s in profile.get("title_must_match_any") or []]
    skills = [s.lower() for s in profile.get("skills_positive") or []]
    geo = profile.get("geo") or {}
    geo_allow = [s.lower() for s in geo.get("allow_signals") or geo.get("allow") or []]
    geo_reject = [s.lower() for s in geo.get("reject_signals") or geo.get("reject") or []]

    hard_exclude = [s for s in exclude if s != "associate"]
    if any(_has_phrase(title, sig) for sig in hard_exclude):
        job.reject_reason = "senior or unrelated title"
        job.eligible = False
        job.score = 0
        return job

    seniority_reason = reject_for_seniority(job.title or "", profile)
    if seniority_reason:
        job.reject_reason = seniority_reason
        job.eligible = False
        job.score = 0
        return job

    title_hit = any(_has_phrase(title, sig) for sig in must) if must else True
    if must and not title_hit:
        job.reject_reason = "title outside aspirant skill band"
        job.eligible = False
        job.score = 0
        return job

    for sig in geo_reject:
        if sig in blob:
            job.reject_reason = f"geo lock: {sig}"
            job.eligible = False
            job.score = 0
            return job

    years = _max_years(blob)
    if years is not None and years > max_years and not JUNIOR.search(title):
        job.reject_reason = f"requires {years}+ years (cap {max_years})"
        job.eligible = False
        job.score = 0
        return job

    score = 0
    targets = [t.lower() for t in profile.get("target_titles") or []]
    if any(t in title for t in targets) or title_hit:
        score += int(scoring.get("title_weight") or 30)
    score += min(int(scoring.get("skills_weight") or 25), 5 * sum(1 for s in skills if s in blob))
    if JUNIOR.search(title) or (ASSOCIATE.search(title) and title_hit):
        score += int(scoring.get("junior_boost") or 15)
    exp = profile.get("experience") or {}
    if exp.get("credibility") and exp.get("max_job_level") == "mid":
        # Strong juniors: reward solid mid titles (no senior/exec words)
        if not re.search(r"\b(senior|sr\.?|staff|principal|director|head of|chief|vp)\b", title, re.I):
            if title_hit or any(t in title for t in targets):
                score += int(scoring.get("mid_boost") or 10)
    if any(g in blob for g in geo_allow):
        score += int(scoring.get("geo_boost") or 20)

    job.score = score
    job.eligible = score >= min_keep
    if not job.eligible:
        job.reject_reason = f"score {score} below {min_keep}"
    return job
