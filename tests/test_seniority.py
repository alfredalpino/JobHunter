from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from eligibility import score_job
from models import Job
from seniority import (
    apply_seniority_to_profile,
    detect_title_level,
    has_credibility,
    reject_for_seniority,
)


def _junior_profile(*, credibility: bool = False) -> dict:
    return apply_seniority_to_profile(
        {
            "experience": {
                "level": "junior_entry_associate",
                "estimated_years": 2.0 if credibility else 0.5,
                "max_years_required": 3,
                "credibility": credibility,
            },
            "certifications": ["CCNA"] if credibility else [],
            "skills_positive": ["network", "cisco", "vlan", "ospf", "python"] if credibility else ["network"],
            "exclude_title_signals": [],
            "title_must_match_any": ["network", "analyst", "engineer"],
            "target_titles": ["Network Engineer", "Network Analyst"],
            "geo": {"allow_signals": ["dubai", "remote"], "reject_signals": []},
            "scoring": {
                "min_score_to_keep": 35,
                "title_weight": 30,
                "skills_weight": 25,
                "junior_boost": 15,
                "mid_boost": 10,
                "geo_boost": 20,
            },
            "recency": {"max_age_days": 14, "reject_unknown_date": False},
        }
    )


def test_detect_executive_and_senior() -> None:
    assert detect_title_level("Chief Technology Officer") == "executive"
    assert detect_title_level("Senior Network Engineer") == "senior"
    assert detect_title_level("Network Engineer") == "mid"


def test_junior_blocks_executive() -> None:
    profile = _junior_profile(credibility=True)
    reason = reject_for_seniority("VP of Engineering", profile)
    assert reason is not None
    assert "seniority" in reason


def test_junior_blocks_senior_even_with_credibility() -> None:
    profile = _junior_profile(credibility=True)
    assert profile["experience"]["max_job_level"] == "mid"
    reason = reject_for_seniority("Senior Network Engineer", profile)
    assert reason is not None


def test_strong_junior_allows_mid_title() -> None:
    profile = _junior_profile(credibility=True)
    assert reject_for_seniority("Network Analyst", profile) is None
    job = Job(
        title="Network Analyst",
        company="Acme",
        url="https://example.com/jobs/1",
        portal="test",
        location="Dubai",
        summary="Network cisco troubleshooting remote dubai posted 2 days ago",
        posted_at="2 days ago",
    )
    scored = score_job(job, profile)
    # May still fail recency depending on parser; if eligible or only score issue is fine
    assert scored.reject_reason != "seniority: senior role above your mid band"
    assert "seniority:" not in (scored.reject_reason or "")


def test_credibility_from_certs() -> None:
    assert has_credibility({"certifications": ["CCNA"], "skills_positive": [], "experience": {}})
