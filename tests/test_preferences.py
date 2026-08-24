from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from preferences import apply_preferences_to_profile, list_regions, load_region, preferences_to_overrides
from synonyms import expand_skills


def test_list_regions_includes_core() -> None:
    regions = list_regions()
    for name in ("dubai", "usa", "india", "bangalore", "warsaw", "remote"):
        assert name in regions


def test_region_pack_loads() -> None:
    pack = load_region("india")
    assert "India" in pack.get("locations", [])
    assert pack.get("country_indeed") == "india"


def test_preferences_override_geo() -> None:
    profile = {
        "candidate": {"name": "Test"},
        "experience": {"level": "junior_entry_associate", "max_years_required": 3},
        "exclude_title_signals": ["chef"],
        "skills_positive": ["cisco"],
        "geo": {},
        "scoring": {},
        "recency": {"max_age_days": 14},
    }
    merged = apply_preferences_to_profile(
        profile,
        {"region": "bangalore", "seniority_band": "junior", "must_have_skills": ["python"]},
    )
    assert merged["geo"]["region"] == "bangalore"
    assert "Bangalore" in merged["geo"]["default_locations"] or "Bengaluru" in merged["geo"]["default_locations"]
    skills = [s.lower() for s in merged["skills_positive"]]
    assert "python" in skills
    assert merged["experience"]["max_job_level"] in {"junior", "mid"}


def test_synonym_expansion() -> None:
    expanded = expand_skills(["cisco"])
    low = [s.lower() for s in expanded]
    assert "cisco" in low
    assert "ccna" in low or "ccnp" in low


def test_preferences_to_overrides_work_mode_remote() -> None:
    ov = preferences_to_overrides({"region": "remote", "work_mode": "remote"})
    assert "remote" in ov["geo"]["allow_signals"]
