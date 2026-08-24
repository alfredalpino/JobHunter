from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


def load_firecrawl_key(root: Path) -> str:
    key = (os.environ.get("FIRECRAWL_API_KEY") or "").strip()
    if key:
        return key
    for path in (
        root / ".env",
        root.parent / "uae-job-scraper" / ".env",
        root.parent.parent / "UBAID-Engineer" / "job-search" / ".env",
    ):
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("FIRECRAWL_API_KEY=") and "=" in line:
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def firecrawl_search(
    query: str,
    *,
    api_key: str,
    limit: int = 8,
    include_domains: list[str] | None = None,
) -> list[dict[str, Any]]:
    body: dict[str, Any] = {"query": query, "limit": limit}
    if include_domains:
        body["includeDomains"] = include_domains
    req = urllib.request.Request(
        "https://api.firecrawl.dev/v2/search",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "UbaidJobScout/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:300]
        raise RuntimeError(f"Firecrawl HTTP {e.code}: {detail}") from e
    data = payload.get("data")
    if isinstance(data, dict):
        web = data.get("web") or []
    elif isinstance(data, list):
        web = data
    else:
        web = []
    return [r for r in web if isinstance(r, dict)]


def firecrawl_scrape_markdown(url: str, *, api_key: str) -> str:
    body = {"url": url, "formats": ["markdown"], "onlyMainContent": True}
    req = urllib.request.Request(
        "https://api.firecrawl.dev/v2/scrape",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "UbaidJobScout/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    data = payload.get("data") or payload
    if isinstance(data, dict):
        return str(data.get("markdown") or "")
    return ""


def polite_pause(seconds: float) -> None:
    if seconds > 0:
        time.sleep(seconds)
