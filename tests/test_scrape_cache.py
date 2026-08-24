"""Smoke tests for scrape cache + polite client pacing helpers."""

from __future__ import annotations

import time
from pathlib import Path

from scrape_cache import ScrapeCache


def test_scrape_cache_roundtrip(tmp_path: Path) -> None:
    cache = ScrapeCache(tmp_path, ttl_seconds=60)
    assert cache.get("https://example.com/a") is None
    cache.set("https://example.com/a", status=200, body='{"ok":true}')
    hit = cache.get("https://example.com/a")
    assert hit == (200, '{"ok":true}')
    assert cache.stats()["hits"] == 1


def test_scrape_cache_ttl_expiry(tmp_path: Path) -> None:
    cache = ScrapeCache(tmp_path, ttl_seconds=1)
    cache.set("https://example.com/b", status=200, body="x")
    time.sleep(1.1)
    assert cache.get("https://example.com/b") is None
