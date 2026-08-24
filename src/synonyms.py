"""Expand skills via config/skill_synonyms.yaml."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[1]


def load_synonym_map() -> dict[str, list[str]]:
    path = ROOT / "config" / "skill_synonyms.yaml"
    if not path.exists():
        return {}
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    raw = data.get("synonyms") or {}
    return {str(k).lower(): [str(x).lower() for x in (v or [])] for k, v in raw.items()}


def expand_skills(skills: list[str]) -> list[str]:
    """Return unique skills plus synonym expansions (bidirectional light match)."""
    syn = load_synonym_map()
    out: list[str] = []
    seen: set[str] = set()

    def add(item: str) -> None:
        key = item.lower().strip()
        if not key or key in seen:
            return
        seen.add(key)
        out.append(item.strip())

    for skill in skills:
        add(skill)
        low = skill.lower().strip()
        for base, alts in syn.items():
            if low == base or low in alts:
                add(base)
                for a in alts:
                    add(a)
    return out
