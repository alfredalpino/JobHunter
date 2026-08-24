# 2026-08-25 — System design + Phase 1 pipeline optimization

## Goal

Design how JobHunter pulls, filters, and shows jobs; then optimize the core
ingest/score path (FAANG-style: compile once, polite concurrency, TTL cache).

## Actions

1. Documented as-is dual stacks (Python CLI vs Next `/api/hunt`) and target
   tiered pipeline in `docs/architecture/data-pipeline.md`.
2. Accepted ADR-001 (incremental dual-runtime + shared filter contract).
3. Canvas: `jobhunter-data-pipeline.canvas.tsx` (open beside chat).
4. Python Phase 1a:
   - `src/scrape_cache.py` — URL TTL disk cache under `data/cache/scrapes`
   - `src/http_client.py` — per-host pacing, retries, cache wiring
   - `src/pipeline.py` — tiered ThreadPoolExecutor (fast/slow); JobSpy serial
   - `config/defaults.yaml` — concurrency / cache / retry knobs
   - `.gitignore` — `data/cache/`
5. TypeScript Phase 1a:
   - `roleFamilies.ts` — `compileTitleMatcher` / `matchTitleCompiled`
   - `eligibility.ts` — compile once per hunt; fingerprint dedupe
   - `hunt/route.ts` — single-pass age buckets
6. Added `tests/test_scrape_cache.py`.

## Next (Phase 2)

- Golden Py/TS eligibility fixtures
- Default UI date window = last 14 days
- Wire unused API portals into `portals.yaml`
