"""Load easy preference files + region packs."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from seniority import apply_seniority_to_profile
from synonyms import expand_skills

ROOT = Path(__file__).resolve().parents[1]
ASPIRANTS = ROOT / "aspirants"
REGIONS = ROOT / "config" / "regions"

BAND_TO_LEVEL = {
    "intern": "junior_entry_associate",
    "junior": "junior_entry_associate",
    "mid": "mid_or_unknown",
    "senior": "senior",
    "lead": "lead",
    "executive": "executive",
}


def list_regions() -> list[str]:
    if not REGIONS.exists():
        return []
    return sorted(p.stem for p in REGIONS.glob("*.yaml"))


def load_region(name: str) -> dict[str, Any]:
    if not name:
        return {}
    path = REGIONS / f"{name.strip().lower()}.yaml"
    if not path.exists():
        raise FileNotFoundError(
            f"Unknown region '{name}'. Available: {', '.join(list_regions())}"
        )
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def load_preferences(aspirant_id: str) -> dict[str, Any]:
    path = ASPIRANTS / aspirant_id / "preferences.yaml"
    if not path.exists():
        return {}
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def save_preferences(aspirant_id: str, prefs: dict[str, Any]) -> Path:
    folder = ASPIRANTS / aspirant_id
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / "preferences.yaml"
    path.write_text(
        yaml.safe_dump(prefs, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )
    return path


def preferences_to_overrides(prefs: dict[str, Any], *, region_name: str | None = None) -> dict[str, Any]:
    """Convert human preferences (+ optional region pack) into profile overrides."""
    prefs = dict(prefs or {})
    region_key = (region_name or prefs.get("region") or "").strip().lower()
    region = load_region(region_key) if region_key else {}

    locations = list(prefs.get("locations") or region.get("locations") or [])
    allow = list(region.get("allow_signals") or [])
    reject = list(region.get("reject_signals") or [])
    # Always keep remote-friendly allow unless work_mode is onsite-only
    work_mode = str(prefs.get("work_mode") or "any").lower()
    if work_mode == "remote":
        for sig in ("remote", "worldwide", "work from home", "wfh"):
            if sig not in allow:
                allow.append(sig)
    if work_mode == "onsite":
        reject = list(dict.fromkeys(reject + ["fully remote only", "remote-only", "100% remote"]))

    overrides: dict[str, Any] = {
        "geo": {
            "region": region_key or None,
            "default_locations": locations,
            "allow_signals": allow,
            "reject_signals": reject,
            "country_indeed": prefs.get("country_indeed") or region.get("country_indeed") or "",
            "work_mode": work_mode,
        },
        "hunt": {
            "use_jobspy": bool(prefs.get("use_jobspy", True)),
            "jobspy_sites": list(
                prefs.get("jobspy_sites") or region.get("jobspy_sites") or ["indeed", "linkedin", "google"]
            ),
        },
    }

    if prefs.get("work_auth"):
        overrides.setdefault("candidate", {})["work_auth"] = prefs["work_auth"]
    if locations:
        label = region.get("label") or ", ".join(locations[:2])
        overrides.setdefault("candidate", {})["location"] = f"{label} (target)"

    if prefs.get("target_titles"):
        overrides["target_titles"] = list(prefs["target_titles"])
        overrides["search_queries"] = list(prefs["target_titles"])[:4]

    if prefs.get("must_have_skills"):
        overrides["skills_positive"] = expand_skills(list(prefs["must_have_skills"]))

    if prefs.get("exclude_titles"):
        overrides["exclude_title_signals"] = list(prefs["exclude_titles"])

    band = str(prefs.get("seniority_band") or "").lower().strip()
    if band:
        overrides["experience"] = {
            "seniority_band": band,
            "level": BAND_TO_LEVEL.get(band, "junior_entry_associate"),
        }

    max_days = prefs.get("recency_max_days")
    if max_days:
        overrides["recency"] = {"max_age_days": int(max_days)}

    return overrides


def apply_preferences_to_profile(
    profile: dict[str, Any],
    prefs: dict[str, Any] | None = None,
    *,
    region: str | None = None,
) -> dict[str, Any]:
    """Deep-merge preferences/region into profile, expand synonyms, apply seniority."""
    from profile_builder import _deep_merge  # local to avoid cycles at import time

    prefs = prefs or {}
    overrides = preferences_to_overrides(prefs, region_name=region)
    # If exclude_titles provided, append rather than replace defaults
    excl = overrides.pop("exclude_title_signals", None)
    skills_extra = overrides.pop("skills_positive", None)

    merged = _deep_merge(profile, overrides)
    if excl:
        merged["exclude_title_signals"] = _uniq(
            list(merged.get("exclude_title_signals") or []) + list(excl)
        )
    if skills_extra:
        merged["skills_positive"] = _uniq(
            list(merged.get("skills_positive") or []) + list(skills_extra)
        )
    else:
        merged["skills_positive"] = expand_skills(list(merged.get("skills_positive") or []))

    return apply_seniority_to_profile(merged)


def _uniq(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        key = str(item).lower().strip()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(str(item).strip())
    return out
