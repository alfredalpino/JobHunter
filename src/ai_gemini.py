"""Optional tiny Antigravity (agy) refine — OFF by default to save tokens/speed.

Design goals:
- Hunt/scrape never calls AI
- Profile build is local (PDF/regex) by default
- If user opts into --ai: one short Flash call, cached by content hash
"""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

# Cheapest/fastest useful model on Antigravity for this task
DEFAULT_MODEL = "gemini-3.5-flash-low"
CACHE_DIR_NAME = "ai-cache"

# Hard caps — keep prompts tiny
MAX_RESUME_CHARS = 1800
MAX_LINKEDIN_CHARS = 600
MAX_DRAFT_CHARS = 900

PROFILE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "target_titles": {"type": "array", "items": {"type": "string"}},
        "search_queries": {"type": "array", "items": {"type": "string"}},
        "skills_positive": {"type": "array", "items": {"type": "string"}},
        "title_must_match_any": {"type": "array", "items": {"type": "string"}},
        "experience": {
            "type": "object",
            "properties": {
                "max_years_required": {"type": "number"},
                "target_band": {"type": "string"},
                "level": {"type": "string"},
            },
        },
        "plain_summary": {"type": "string"},
    },
    "required": ["target_titles", "search_queries", "skills_positive"],
}


def agy_available() -> bool:
    return shutil.which("agy") is not None


def _squash(text: str, limit: int) -> str:
    t = " ".join((text or "").split())
    return t[:limit]


def _slim_draft(draft: dict[str, Any] | None) -> dict[str, Any]:
    d = draft or {}
    return {
        "name": (d.get("candidate") or {}).get("name"),
        "titles": (d.get("target_titles") or [])[:6],
        "queries": (d.get("search_queries") or [])[:4],
        "skills": (d.get("skills_positive") or [])[:12],
        "certs": (d.get("certifications") or [])[:6],
        "years_cap": (d.get("experience") or {}).get("max_years_required"),
    }


def _cache_path(root: Path, key: str) -> Path:
    folder = root / "data" / CACHE_DIR_NAME
    folder.mkdir(parents=True, exist_ok=True)
    return folder / f"{key}.json"


def _cache_key(resume: str, linkedin: str, draft: dict[str, Any], model: str) -> str:
    blob = json.dumps(
        {"r": resume, "l": linkedin, "d": draft, "m": model},
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:24]


def refine_profile_with_gemini(
    resume_text: str,
    *,
    linkedin_text: str = "",
    draft: dict[str, Any] | None = None,
    model: str = DEFAULT_MODEL,
    timeout_s: int = 90,
    root: Path | None = None,
    force: bool = False,
) -> dict[str, Any] | None:
    """One cheap Flash refine. Returns None if agy missing or call fails.

    Never used during portal scraping.
    """
    if not agy_available():
        return None

    resume = _squash(resume_text, MAX_RESUME_CHARS)
    linkedin = _squash(linkedin_text, MAX_LINKEDIN_CHARS)
    slim = _slim_draft(draft)
    draft_json = _squash(json.dumps(slim, ensure_ascii=False), MAX_DRAFT_CHARS)

    project_root = root or Path(__file__).resolve().parents[1]
    key = _cache_key(resume, linkedin, slim, model)
    cached = _cache_path(project_root, key)
    if cached.exists() and not force:
        try:
            data = json.loads(cached.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                data["source"] = f"agy-cache:{model}"
                return data
        except json.JSONDecodeError:
            pass

    # Ultra-short system-style prompt (~token thrifty)
    prompt = (
        "Dubai job eligibility. Return JSON only.\n"
        "Improve titles (2-5), search_queries (2-4 short phrases), "
        "skills_positive (lowercase), title_must_match_any, "
        "experience.max_years_required (usually 3), plain_summary (1 sentence).\n"
        f"CV:{resume}\n"
        f"LI:{linkedin}\n"
        f"DRAFT:{draft_json}"
    )

    with tempfile.TemporaryDirectory() as tmp:
        schema_path = Path(tmp) / "schema.json"
        schema_path.write_text(json.dumps(PROFILE_SCHEMA), encoding="utf-8")
        cmd = [
            "agy",
            "-p",
            prompt,
            "--model",
            model,
            "--effort",
            "low",
            "--output-format",
            "json",
            "--json-schema",
            str(schema_path),
            "--disable-slash-commands",
        ]
        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout_s,
                check=False,
            )
        except (subprocess.TimeoutExpired, OSError):
            return None
        if proc.returncode != 0:
            return None
        raw = (proc.stdout or "").strip()
        if not raw:
            return None
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            start, end = raw.find("{"), raw.rfind("}")
            if start < 0 or end < 0:
                return None
            try:
                data = json.loads(raw[start : end + 1])
            except json.JSONDecodeError:
                return None
        if not isinstance(data, dict):
            return None
        data["source"] = f"agy:{model}"
        try:
            cached.write_text(json.dumps(data, indent=2), encoding="utf-8")
        except OSError:
            pass
        return data
