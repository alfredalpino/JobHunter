"""Seniority detection and guardrails."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[1]

_LEVEL_ORDER = ["intern", "junior", "mid", "senior", "lead", "executive"]


def load_seniority_config() -> dict[str, Any]:
    path = ROOT / "config" / "seniority.yaml"
    if not path.exists():
        return {}
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def level_rank(level: str) -> int:
    try:
        return _LEVEL_ORDER.index((level or "mid").lower())
    except ValueError:
        return _LEVEL_ORDER.index("mid")


def detect_title_level(title: str, cfg: dict[str, Any] | None = None) -> str:
    """Highest matching seniority signal in a job title; unmarked → mid."""
    import re

    cfg = cfg or load_seniority_config()
    title_l = (title or "").lower()
    signals = cfg.get("signals") or {}
    found = -1
    matched = "mid"
    for level in _LEVEL_ORDER:
        for sig in signals.get(level) or []:
            s = str(sig).lower().strip()
            if not s:
                continue
            hit = False
            if len(s) <= 3 or s.endswith("."):
                hit = bool(re.search(rf"\b{re.escape(s.rstrip('.'))}\.?\b", title_l))
            else:
                hit = s in title_l
            # bare vp / sr / jr
            if not hit and s in {"vp", "sr", "jr", "cto", "cio", "ceo", "cfo", "coo"}:
                hit = bool(re.search(rf"\b{re.escape(s)}\b", title_l))
            if hit:
                rank = level_rank(level)
                if rank >= found:
                    found = rank
                    matched = level
    return matched if found >= 0 else "mid"


def has_credibility(profile: dict[str, Any], resume_excerpt: str = "", cfg: dict[str, Any] | None = None) -> bool:
    cfg = cfg or load_seniority_config()
    cred = cfg.get("credibility") or {}
    certs = profile.get("certifications") or []
    skills = profile.get("skills_positive") or []
    years = (profile.get("experience") or {}).get("estimated_years")
    blob = (resume_excerpt or profile.get("raw_excerpt") or "").lower()
    if len(certs) >= int(cred.get("min_certs") or 1):
        return True
    if years is not None and float(years) >= float(cred.get("min_years") or 2):
        return True
    if len(skills) >= int(cred.get("min_skills") or 5):
        return True
    for kw in cred.get("project_keywords") or []:
        if str(kw).lower() in blob:
            return True
    return bool(profile.get("experience", {}).get("credibility"))


def candidate_max_job_level(profile: dict[str, Any], cfg: dict[str, Any] | None = None) -> str:
    cfg = cfg or load_seniority_config()
    exp = profile.get("experience") or {}
    level = str(exp.get("level") or "junior_entry_associate")
    # Map preference band aliases
    band = str(exp.get("seniority_band") or "").lower()
    if band in _LEVEL_ORDER:
        if band in {"intern", "junior"}:
            level = "junior_entry_associate"
        elif band == "mid":
            level = "mid_or_unknown"
        else:
            level = band

    max_map = cfg.get("max_job_level") or {}
    max_level = str(max_map.get(level) or "junior")
    credibility = bool(exp.get("credibility")) or has_credibility(profile, cfg=cfg)

    if level == "junior_entry_associate" and credibility:
        max_level = "mid"
        profile.setdefault("experience", {})["credibility"] = True

    # Preference override: absolute cap from seniority_band
    if band in _LEVEL_ORDER:
        # juniors still cannot exceed mid via prefs
        if band in {"intern", "junior"}:
            max_level = "mid" if credibility else "junior"
        else:
            max_level = band
    return max_level


def seniority_excludes_for_profile(profile: dict[str, Any], cfg: dict[str, Any] | None = None) -> list[str]:
    """Title phrases to hard-exclude based on candidate max level."""
    cfg = cfg or load_seniority_config()
    max_level = candidate_max_job_level(profile, cfg)
    max_rank = level_rank(max_level)
    signals = cfg.get("signals") or {}
    excludes: list[str] = []
    for level in _LEVEL_ORDER:
        if level_rank(level) > max_rank:
            excludes.extend(str(s) for s in (signals.get(level) or []))
    # Juniors always block senior+ even if somehow misconfigured
    exp_level = str((profile.get("experience") or {}).get("level") or "")
    if exp_level == "junior_entry_associate" or str((profile.get("experience") or {}).get("seniority_band") or "").lower() in {
        "intern",
        "junior",
    }:
        for level in cfg.get("junior_hard_block_levels") or ["senior", "lead", "executive"]:
            excludes.extend(str(s) for s in (signals.get(level) or []))
    # de-dupe preserve order
    seen: set[str] = set()
    out: list[str] = []
    for e in excludes:
        k = e.lower()
        if k not in seen:
            seen.add(k)
            out.append(e)
    return out


def reject_for_seniority(title: str, profile: dict[str, Any], cfg: dict[str, Any] | None = None) -> str | None:
    cfg = cfg or load_seniority_config()
    job_level = detect_title_level(title, cfg)
    max_level = candidate_max_job_level(profile, cfg)
    if level_rank(job_level) > level_rank(max_level):
        return f"seniority: {job_level} role above your {max_level} band"
    return None


def apply_seniority_to_profile(profile: dict[str, Any]) -> dict[str, Any]:
    """Mutate profile with credibility flag, excludes, and max years tweak."""
    cfg = load_seniority_config()
    exp = profile.setdefault("experience", {})
    cred = has_credibility(profile, cfg=cfg)
    exp["credibility"] = cred
    max_level = candidate_max_job_level(profile, cfg)
    exp["max_job_level"] = max_level

    excludes = list(profile.get("exclude_title_signals") or [])
    for sig in seniority_excludes_for_profile(profile, cfg):
        if sig.lower() not in {e.lower() for e in excludes}:
            excludes.append(sig)
    profile["exclude_title_signals"] = excludes

    if str(exp.get("level") or "") == "junior_entry_associate":
        if cred:
            exp["max_years_required"] = max(int(exp.get("max_years_required") or 3), 4)
            exp["target_band"] = exp.get("target_band") or "0-4"
        else:
            exp["max_years_required"] = min(int(exp.get("max_years_required") or 3), 3)
    return profile
