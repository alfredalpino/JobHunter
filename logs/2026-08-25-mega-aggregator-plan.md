# 2026-08-25 — Mega job aggregator system design

User requested deep plan for global job aggregator: 30m cron, cross-portal
dedupe, BYOK AI top-10 drip, credibility/fact-check.

Delivered: architecture + product plan canvas
`canvases/mega-job-aggregator-plan.canvas.tsx`

Key decision: federated index (APIs/ATS/polite crawl) — not blind whole-web
scrape. Next ship candidate: P1 shared Postgres index + 30m cron on existing
sources.
