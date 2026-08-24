from __future__ import annotations

import json
import threading
import time
from typing import Any
from urllib.parse import urlparse

import httpx

from scrape_cache import ScrapeCache

RETRYABLE_STATUS = {429, 500, 502, 503, 504}


class PoliteClient:
    """Thread-safe HTTP client with per-host pacing, retries, and optional TTL cache.

    Delay is applied per hostname so concurrent workers across different hosts
    do not serialize on a single global sleep.
    """

    def __init__(
        self,
        *,
        user_agent: str,
        timeout: float,
        delay: float,
        retries: int = 2,
        retry_backoff: float = 0.75,
        cache: ScrapeCache | None = None,
    ) -> None:
        self.delay = max(0.0, float(delay))
        self.retries = max(0, int(retries))
        self.retry_backoff = max(0.1, float(retry_backoff))
        self.cache = cache
        self._host_last: dict[str, float] = {}
        self._pace_lock = threading.Lock()
        self.client = httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            headers={
                "User-Agent": user_agent,
                "Accept": "text/html,application/xhtml+xml,application/json,application/rss+xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-AE,en;q=0.9",
            },
        )

    def _host(self, url: str) -> str:
        return urlparse(url).netloc.lower() or "unknown"

    def _pace(self, url: str) -> None:
        if self.delay <= 0:
            return
        host = self._host(url)
        wait = 0.0
        with self._pace_lock:
            now = time.monotonic()
            last = self._host_last.get(host, 0.0)
            wait = self.delay - (now - last)
            if wait > 0:
                # Reserve the next slot so other threads for this host queue behind us
                self._host_last[host] = last + self.delay
            else:
                self._host_last[host] = now
                wait = 0.0
        if wait > 0:
            time.sleep(wait)

    def get(self, url: str, **kwargs: Any) -> httpx.Response:
        last_exc: Exception | None = None
        for attempt in range(self.retries + 1):
            self._pace(url)
            try:
                resp = self.client.get(url, **kwargs)
                if resp.status_code in RETRYABLE_STATUS and attempt < self.retries:
                    time.sleep(self.retry_backoff * (2**attempt))
                    continue
                return resp
            except (httpx.TransportError, httpx.TimeoutException) as exc:
                last_exc = exc
                if attempt >= self.retries:
                    raise
                time.sleep(self.retry_backoff * (2**attempt))
        if last_exc:
            raise last_exc
        raise RuntimeError(f"GET failed for {url}")

    def get_text(self, url: str) -> tuple[int, str]:
        if self.cache is not None:
            cached = self.cache.get(url)
            if cached is not None:
                return cached
        resp = self.get(url)
        body = resp.text
        if self.cache is not None and resp.status_code < 500:
            self.cache.set(url, status=resp.status_code, body=body)
        return resp.status_code, body

    def get_json(self, url: str) -> tuple[int, Any]:
        if self.cache is not None:
            cached = self.cache.get(url)
            if cached is not None:
                status, body = cached
                try:
                    return status, json.loads(body)
                except json.JSONDecodeError:
                    return status, None
        resp = self.get(url)
        try:
            data = resp.json()
            body = resp.text
        except Exception:
            data = None
            body = resp.text
        if self.cache is not None and resp.status_code < 500 and body:
            self.cache.set(url, status=resp.status_code, body=body)
        return resp.status_code, data

    def close(self) -> None:
        self.client.close()
