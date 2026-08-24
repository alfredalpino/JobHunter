"""URL-keyed disk cache for polite scrape reuse within a TTL."""

from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any


class ScrapeCache:
    """Store response bodies by URL hash. Safe for multi-thread reads/writes
    to distinct keys; same-key races are last-writer-wins (acceptable for TTL cache).
    """

    def __init__(self, root: Path, *, ttl_seconds: int = 3600) -> None:
        self.root = root
        self.ttl_seconds = max(0, int(ttl_seconds))
        self.root.mkdir(parents=True, exist_ok=True)
        self.hits = 0
        self.misses = 0

    @staticmethod
    def _key(url: str) -> str:
        return hashlib.sha256(url.encode("utf-8")).hexdigest()

    def _path(self, url: str) -> Path:
        return self.root / f"{self._key(url)}.json"

    def get(self, url: str) -> tuple[int, str] | None:
        if self.ttl_seconds <= 0:
            self.misses += 1
            return None
        path = self._path(url)
        if not path.exists():
            self.misses += 1
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            ts = float(data.get("ts") or 0)
            if time.time() - ts > self.ttl_seconds:
                self.misses += 1
                return None
            status = int(data.get("status") or 0)
            body = str(data.get("body") or "")
            self.hits += 1
            return status, body
        except (OSError, ValueError, TypeError, json.JSONDecodeError):
            self.misses += 1
            return None

    def set(self, url: str, *, status: int, body: str) -> None:
        if self.ttl_seconds <= 0:
            return
        # Cap body size to avoid filling disk on huge HTML dumps
        if len(body) > 2_000_000:
            body = body[:2_000_000]
        payload: dict[str, Any] = {
            "ts": time.time(),
            "url": url[:2000],
            "status": int(status),
            "body": body,
        }
        path = self._path(url)
        tmp = path.with_suffix(".tmp")
        try:
            tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
            tmp.replace(path)
        except OSError:
            try:
                tmp.unlink(missing_ok=True)
            except OSError:
                pass

    def stats(self) -> dict[str, int]:
        return {"hits": self.hits, "misses": self.misses, "ttl_seconds": self.ttl_seconds}
