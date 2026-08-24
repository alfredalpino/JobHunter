#!/usr/bin/env python3
"""Thin local HTTP wrapper for deep JobHunter hunts (JobSpy / HTML portals).

Run from JobHunter root:
  ./.venv/bin/python scripts/deep_hunt_server.py

Then POST http://127.0.0.1:8765/deep-hunt with JSON:
  { "aspirant_id": "example", "queries": 1 }

Web UI can call this only when DEEP_HUNT_URL is set — never required for friends.
"""
from __future__ import annotations

import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

PORT = 8765


class Handler(BaseHTTPRequestHandler):
    def _json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        if self.path in ("/", "/health"):
            self._json(200, {"ok": True, "service": "jobhunter-deep-hunt", "port": PORT})
            return
        self._json(404, {"ok": False, "error": "not found"})

    def do_POST(self) -> None:
        if self.path != "/deep-hunt":
            self._json(404, {"ok": False, "error": "not found"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._json(400, {"ok": False, "error": "invalid json"})
            return

        aspirant_id = (body.get("aspirant_id") or "").strip()
        if not aspirant_id:
            self._json(400, {"ok": False, "error": "aspirant_id required"})
            return

        try:
            from src.pipeline import run_hunt

            result = run_hunt(
                aspirant_id=aspirant_id,
                query_limit=int(body.get("queries") or 1),
                quick=bool(body.get("quick", True)),
            )
            self._json(200, {"ok": True, "result": result if isinstance(result, dict) else str(result)})
        except Exception as exc:  # noqa: BLE001
            self._json(500, {"ok": False, "error": str(exc)})


def main() -> None:
    server = HTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Deep hunt server on http://127.0.0.1:{PORT}/health", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
