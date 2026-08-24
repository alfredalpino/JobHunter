"""Build and persist aspirant eligibility profiles."""
from __future__ import annotations

import re
from datetime import date
from pathlib import Path
from typing import Any

import yaml

from profile_cv import analyze_resume_text, load_resume_text
from profile_linkedin import analyze_linkedin_paste, analyze_linkedin_url
from preferences import apply_preferences_to_profile, load_preferences, save_preferences
from synonyms import expand_skills

try:
    from ai_gemini import refine_profile_with_gemini
except ImportError:  # pragma: no cover
    refine_profile_with_gemini = None  # type: ignore[misc, assignment]

ROOT = Path(__file__).resolve().parents[1]
ASPIRANTS = ROOT / "aspirants"


def _slug(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (name or "aspirant").lower()).strip("-")
    return s or "aspirant"


def load_defaults() -> dict[str, Any]:
    path = ROOT / "config" / "defaults.yaml"
    with path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def merge_analyses(*parts: dict[str, Any]) -> dict[str, Any]:
    defaults = load_defaults()
    base: dict[str, Any] = {
        "candidate": {
            "name": "Aspirant",
            "email": "",
            "phone": "",
            "linkedin": "",
            "location": "",
            "work_auth": "Open to roles with visa sponsorship where applicable",
        },
        "experience": {
            "estimated_years": None,
            "max_years_required": 3,
            "level": "junior_entry_associate",
            "target_band": "0-3",
        },
        "target_titles": [],
        "exclude_title_signals": [
            "senior",
            "sr.",
            "staff",
            "principal",
            "director",
            "head of",
            "chef",
            "waiter",
            "nurse",
            "driver",
            "accountant",
            "sales executive",
        ],
        "title_must_match_any": [],
        "skills_positive": [],
        "certifications": [],
        "geo": defaults.get("geo") or {},
        "scoring": defaults.get("scoring") or {},
        "recency": defaults.get("recency") or {},
        "sources": [],
        "built_at": date.today().isoformat(),
    }

    for part in parts:
        if not part:
            continue
        base["sources"].append(part.get("source") or "unknown")
        cand = part.get("candidate") or {}
        for k, v in cand.items():
            if v and (not base["candidate"].get(k) or k == "linkedin"):
                base["candidate"][k] = v
        exp = part.get("experience") or {}
        if exp.get("estimated_years") is not None:
            base["experience"]["estimated_years"] = exp["estimated_years"]
        if exp.get("max_years_required"):
            base["experience"]["max_years_required"] = exp["max_years_required"]
        if exp.get("level"):
            base["experience"]["level"] = exp["level"]
        if exp.get("target_band"):
            base["experience"]["target_band"] = exp["target_band"]
        base["target_titles"] = _uniq(base["target_titles"] + list(part.get("target_titles") or []))
        base["skills_positive"] = _uniq(
            base["skills_positive"] + list(part.get("skills_positive") or [])
        )
        base["certifications"] = _uniq(
            base["certifications"] + list(part.get("certifications") or [])
        )
        base["title_must_match_any"] = _uniq(
            base["title_must_match_any"] + list(part.get("title_must_match_any") or [])
        )
        if part.get("search_queries"):
            base.setdefault("_search_seeds", [])
            base["_search_seeds"] = _uniq(
                list(base.get("_search_seeds") or []) + list(part.get("search_queries") or [])
            )

    if not base["title_must_match_any"]:
        base["title_must_match_any"] = ["network", "noc", "it support", "engineer", "analyst"]
    if not base["target_titles"]:
        base["target_titles"] = ["Network Engineer", "NOC Engineer", "IT Support Engineer"]

    # Search queries derived from open-to / skill-aligned titles
    seeds = list(base.pop("_search_seeds", []) or [])
    base["search_queries"] = (seeds or [
        t for t in base["target_titles"]
        if re.search(r"network|noc|support|infra|admin|security|engineer|analyst", t, re.I)
    ] or base["target_titles"])[:4]
    return base


def build_profile(
    *,
    resume_path: Path | None = None,
    linkedin_url: str = "",
    linkedin_paste: str = "",
    manual_overrides: dict[str, Any] | None = None,
    use_ai: bool = False,
    ai_model: str = "gemini-3.5-flash-low",
) -> dict[str, Any]:
    parts: list[dict[str, Any]] = []
    if resume_path and resume_path.exists():
        text = load_resume_text(resume_path)
        parts.append(analyze_resume_text(text))
    if linkedin_paste.strip():
        parts.append(analyze_linkedin_paste(linkedin_paste, url=linkedin_url))
    elif linkedin_url.strip():
        try:
            parts.append(analyze_linkedin_url(linkedin_url))
        except Exception as exc:  # noqa: BLE001
            parts.append(
                {
                    "source": "linkedin_error",
                    "candidate": {"linkedin": linkedin_url.strip()},
                    "target_titles": [],
                    "skills_positive": [],
                    "certifications": [],
                    "title_must_match_any": [],
                    "experience": {},
                    "notes": str(exc),
                }
            )
    if not parts:
        raise ValueError("Provide a resume PDF/MD, a LinkedIn URL, or pasted LinkedIn text")

    profile = merge_analyses(*parts)
    if manual_overrides:
        profile = _deep_merge(profile, manual_overrides)

    if use_ai and refine_profile_with_gemini is not None:
        resume_blob = ""
        if resume_path and resume_path.exists():
            try:
                resume_blob = load_resume_text(resume_path)
            except Exception:  # noqa: BLE001
                resume_blob = ""
        ai = refine_profile_with_gemini(
            resume_blob or str(parts[0].get("raw_excerpt") or ""),
            linkedin_text=linkedin_paste.strip(),
            draft=profile,
            model=ai_model,
        )
        if ai:
            profile = _deep_merge(profile, ai)
            profile.setdefault("sources", [])
            src = ai.get("source")
            if src and src not in profile["sources"]:
                profile["sources"].append(src)
            if ai.get("plain_summary"):
                profile["plain_summary"] = ai["plain_summary"]

    profile["skills_positive"] = expand_skills(list(profile.get("skills_positive") or []))

    # Apply preferences / region if present on disk for this aspirant id later;
    # callers can also pass region via manual_overrides["geo"]["region"].
    return profile


def finalize_profile(
    profile: dict[str, Any],
    *,
    aspirant_id: str | None = None,
    region: str | None = None,
    prefs: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Merge preferences.yaml + region pack + seniority guardrails."""
    loaded_prefs = prefs
    if loaded_prefs is None and aspirant_id:
        loaded_prefs = load_preferences(aspirant_id)
    loaded_prefs = loaded_prefs or {}
    region_key = region or (profile.get("geo") or {}).get("region") or loaded_prefs.get("region")
    return apply_preferences_to_profile(profile, loaded_prefs, region=region_key)


def save_aspirant(
    profile: dict[str, Any],
    *,
    aspirant_id: str | None = None,
    preferences: dict[str, Any] | None = None,
    region: str | None = None,
) -> Path:
    ASPIRANTS.mkdir(parents=True, exist_ok=True)
    aid = aspirant_id or _slug(profile.get("candidate", {}).get("name") or "aspirant")
    folder = ASPIRANTS / aid
    folder.mkdir(parents=True, exist_ok=True)

    # Seed preferences.yaml for non-programmers if absent
    prefs_path = folder / "preferences.yaml"
    if preferences is not None:
        save_preferences(aid, preferences)
    elif not prefs_path.exists():
        geo = profile.get("geo") or {}
        seed = {
            "region": region or geo.get("region") or "",
            "locations": list(geo.get("default_locations") or []),
            "seniority_band": (profile.get("experience") or {}).get("seniority_band")
            or (
                "junior"
                if (profile.get("experience") or {}).get("level") == "junior_entry_associate"
                else "mid"
            ),
            "work_auth": (profile.get("candidate") or {}).get("work_auth") or "",
            "work_mode": geo.get("work_mode") or "any",
            "use_jobspy": True,
            "jobspy_sites": list((profile.get("hunt") or {}).get("jobspy_sites") or ["indeed", "linkedin", "google"]),
            "country_indeed": geo.get("country_indeed") or "",
            "recency_max_days": int((profile.get("recency") or {}).get("max_age_days") or 14),
        }
        # Copy comments-free seed; users can consult config/preferences.example.yaml
        save_preferences(aid, seed)

    profile = finalize_profile(profile, aspirant_id=aid, region=region, prefs=preferences)
    path = folder / "profile.yaml"
    with path.open("w", encoding="utf-8") as fh:
        yaml.safe_dump(profile, fh, sort_keys=False, allow_unicode=True)
    return path


def load_aspirant(aspirant_id: str) -> dict[str, Any]:
    path = ASPIRANTS / aspirant_id / "profile.yaml"
    if not path.exists():
        raise FileNotFoundError(f"No aspirant profile at {path}")
    with path.open(encoding="utf-8") as fh:
        profile = yaml.safe_load(fh) or {}
    return finalize_profile(profile, aspirant_id=aspirant_id)


def list_aspirants() -> list[str]:
    if not ASPIRANTS.exists():
        return []
    return sorted(p.name for p in ASPIRANTS.iterdir() if (p / "profile.yaml").exists())


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


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        elif v is not None and v != "":
            out[k] = v
    return out
