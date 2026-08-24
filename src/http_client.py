from __future__ import annotations

import time
from typing import Any

import httpx


class PoliteClient:
    def __init__(self, *, user_agent: str, timeout: float, delay: float) -> None:
        self.delay = delay
        self._last = 0.0
        self.client = httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            headers={
                "User-Agent": user_agent,
                "Accept": "text/html,application/xhtml+xml,application/json,application/rss+xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-AE,en;q=0.9",
            },
        )

    def _pace(self) -> None:
        wait = self.delay - (time.monotonic() - self._last)
        if wait > 0:
            time.sleep(wait)

    def get(self, url: str, **kwargs: Any) -> httpx.Response:
        self._pace()
        try:
            resp = self.client.get(url, **kwargs)
            return resp
        finally:
            self._last = time.monotonic()

    def get_text(self, url: str) -> tuple[int, str]:
        resp = self.get(url)
        return resp.status_code, resp.text

    def get_json(self, url: str) -> tuple[int, Any]:
        resp = self.get(url)
        try:
            return resp.status_code, resp.json()
        except Exception:
            return resp.status_code, None

    def close(self) -> None:
        self.client.close()
