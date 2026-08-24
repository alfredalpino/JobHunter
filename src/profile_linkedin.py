"""Public LinkedIn profile text via Jina Reader (no login / no private scrape)."""
from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

import httpx

from profile_cv import analyze_resume_text


def normalize_linkedin_url(url: str) -> str:
    url = url.strip()
    if not url:
        return ""
    if not url.startswith("http"):
        url = "https://" + url.lstrip("/")
    parsed = urlparse(url)
    if "linkedin.com" not in (parsed.netloc or "").lower():
        raise ValueError("URL must be a linkedin.com profile link")
    path = parsed.path.rstrip("/")
    if "/in/" not in path:
        raise ValueError("Use a public profile URL like https://www.linkedin.com/in/username")
    return f"https://www.linkedin.com{path}/"


def fetch_linkedin_public_text(url: str, *, timeout: float = 45.0) -> str:
    """Fetch readable public profile text. Falls back gracefully if blocked."""
    profile = normalize_linkedin_url(url)
    jina = f"https://r.jina.ai/{profile}"
    headers = {
        "User-Agent": "JobHunter/1.0 (aspirant eligibility; personal use)",
        "Accept": "text/plain",
    }
    with httpx.Client(timeout=timeout, follow_redirects=True, headers=headers) as client:
        resp = client.get(jina)
        if resp.status_code >= 400:
            raise RuntimeError(
                f"LinkedIn public fetch failed (HTTP {resp.status_code}). "
                "Paste profile text instead, or upload a resume."
            )
        text = resp.text.strip()
        if len(text) < 80:
            raise RuntimeError(
                "LinkedIn returned too little public text (login wall?). "
                "Paste the About + Experience sections instead."
            )
        return text


def analyze_linkedin_url(url: str) -> dict[str, Any]:
    text = fetch_linkedin_public_text(url)
    profile = analyze_resume_text(text)
    profile["source"] = "linkedin_public"
    profile["candidate"]["linkedin"] = normalize_linkedin_url(url)
    # Prefer headline as first target title
    for line in text.splitlines()[:40]:
        line = line.strip()
        if re.search(r"(?i)(engineer|analyst|developer|manager|specialist|administrator|noc)", line):
            if 4 < len(line) < 80 and line not in profile["target_titles"]:
                profile["target_titles"] = [line] + profile["target_titles"]
                break
    profile["raw_excerpt"] = text[:2500]
    return profile


def analyze_linkedin_paste(text: str, *, url: str = "") -> dict[str, Any]:
    profile = analyze_resume_text(text)
    profile["source"] = "linkedin_paste"
    if url:
        try:
            profile["candidate"]["linkedin"] = normalize_linkedin_url(url)
        except ValueError:
            profile["candidate"]["linkedin"] = url.strip()
    return profile
