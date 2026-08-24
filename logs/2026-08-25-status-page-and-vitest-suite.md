# Status page + Vitest suite

Date: 2026-08-25

## Delivered

### Health / uptime page
- `/status` — live readiness UI (auto-refresh 30s)
- `/api/status` — aggregated JSON probe report (`overall`: operational | degraded | down)
- Safe GET readiness on `/api/analyze`, `/api/hunt`, `/api/polish` (no scrapes / no Gemini)
- Probe engine: `frontend/src/lib/status.ts`
- Nav: Status link in header + footer
- `/api/health` now lists `/api/status` and `status_page: "/status"`

### Unit tests (Vitest)
- Existing: `eligibility.test.ts`
- New: `status`, `recency`, `seniority`, `preferences`, `synonyms`
- Run: `cd frontend && npm test` (or `npm run test:watch`)
- Result: 30 tests passing

## Safe probe policy
Critical: health, regions, analyze, hunt  
Optional: polish (GEMINI_API_KEY), deep-hunt (DEEP_HUNT_URL)  
Never POSTs hunt/analyze/polish/deep-hunt from the status page.
