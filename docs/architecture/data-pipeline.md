# JobHunter — Data Pipeline Architecture

**Status:** Active design (Phase 1 shipping)  
**Date:** 2026-08-25  
**Owners:** JobHunter core  
**Related:** [ADR-001](../decisions/ADR-001-ingest-filter-architecture.md)

## 1. Problem

JobHunter must pull listings from many public sources, normalize them, filter to the aspirant’s preferences (region, title family, seniority, skills, ≤14-day recency), and present a short actionable queue — without Gemini on the scrape/score path, and without auto-apply.

Today there are **two ingestion stacks** that drift:

| Path | Entry | Sources | Filter | Output |
|------|-------|---------|--------|--------|
| CLI / deep-hunt | `run_hunt` (`src/pipeline.py`) | ~120 portals + optional JobSpy | Hard ≤14d + score | `data/raw`, `eligible.md` / CSV |
| Web (Vercel) | `POST /api/hunt` | Public APIs in parallel | Score all; UI owns dates | JSON only |

Friends on Vercel see remote-board-heavy results; local CLI sees UAE HTML + JobSpy. That is intentional for deploy constraints, but the **filter contract** must stay identical.

## 2. Target architecture (logical)

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Profile +  │────▶│  Source adapters │────▶│  Normalize +    │
│  Preferences│     │  (tiered fetch)  │     │  canonical ID   │
└─────────────┘     └──────────────────┘     └────────┬────────┘
                                                      │
                      ┌───────────────────────────────▼────────┐
                      │  Compiled matcher (once per hunt)      │
                      │  cascade: hub → exclude → seniority →  │
                      │  title → geo → years → soft score      │
                      └───────────────────────────────┬────────┘
                                                      │
                      ┌───────────────────────────────▼────────┐
                      │  Projection: buckets, Today’s 10, MD   │
                      └────────────────────────────────────────┘
```

### Tiers (ingest)

| Tier | Methods | Concurrency | Cache | Notes |
|------|---------|-------------|-------|-------|
| **Fast** | `*_api`, `rss` | Higher (default 6) | TTL disk | Cheap public JSON/RSS |
| **Slow** | `html`, `site_search` | Lower (default 3) | TTL disk | Polite per-host delay |
| **Heavy** | JobSpy, Firecrawl quotas | Serial / low | Short TTL | External rate limits |

### Filter cascade (product rules)

1. **Hub / non-job page** → reject  
2. **Hard title excludes** → reject  
3. **Seniority band** → reject  
4. **Role / title family** → reject  
5. **Geo reject signals** → reject  
6. **Years-required cap** → reject  
7. **Recency** — CLI: hard ≤14d + reject unknown; Web UI: annotate + default window last 14d (product-aligned)  
8. **Soft score** vs `min_score_to_keep` → eligible / band A|B|C  

Recency and title matching must not silently diverge between Python and TypeScript (golden tests in Phase 2).

## 3. As-is bottlenecks

1. **Sequential portal loop** — global ~1.8s delay across *all* hosts → multi-minute CLI hunts.  
2. **No scrape cache / retries** — flaky boards fail once; every hunt re-hits the network.  
3. **Dual scorers** — Python hard-rejects age; TS annotates age; role families exist only in TS.  
4. **Matcher recompile** — `detectProfileFamilies` ran once *per job*.  
5. **Weak web dedupe** — URL-only misses cross-portal duplicates.  
6. **Unused adapters** — Arbeitnow/Jobicy/etc. wired in Python `_dispatch` but missing from `portals.yaml`.

## 4. Efficiency principles (FAANG-style)

1. **Compile once, match many** — profile → compiled matcher; O(jobs × phrases) with shared prep, not O(jobs × families × profile scan).  
2. **Cheap → expensive cascade** — early reject before soft score.  
3. **Bounded parallelism + per-host politeness** — concurrency across hosts; delay *per host*, not global.  
4. **TTL cache at the HTTP boundary** — identical URL within TTL returns disk body.  
5. **Canonical fingerprint** — `host|normalized_title|normalized_company` (+ URL set).  
6. **Single-pass projections** — one walk into age buckets / band partitions.  
7. **Shared contract before shared runtime** — golden fixtures beat a premature rewrite into one service.

## 5. Phased delivery

### Phase 1 — Core path (this iteration)

- [x] Architecture + ADR  
- [x] Disk scrape cache + HTTP retries + per-host pacing  
- [x] Tiered bounded concurrency in `run_hunt`  
- [x] Compiled title matcher + single-pass buckets (frontend)  
- [x] Stronger URL+fingerprint dedupe on web score path  

### Phase 2 — Contract lock

- Golden JSON fixtures: same jobs + profile → same eligible / reject_reason classes in Py + TS  
- Port unused API adapters into `portals.yaml` for non-UAE regions  
- Align default web date window with ≤14d product rule (UI default, still overridable)

### Phase 3 — Optional warehouse

- Persist scored jobs by `(fingerprint, aspirant)` with short TTL for “reopen results” without re-scrape  
- Stream score-as-sources-return for progressive UI  
- Keep Gemini off the ingest/score path forever

## 6. SLOs / budgets (local CLI)

| Metric | Target |
|--------|--------|
| Quick hunt (API/RSS only) | &lt; 30s wall |
| Full UAE HTML hunt | &lt; 40% of prior sequential wall (same portal set) |
| Cache hit re-hunt (same day) | &lt; 15s for unchanged URLs |
| Score 1k jobs | &lt; 50ms after compile (TS) |
| Scrape/score AI calls | **0** |

## 7. Non-goals

- Auto-apply  
- Gemini scraping or scoring  
- Replacing region YAML packs  
- Big-bang rewrite into a single microservice before Phase 2 contracts

## 8. Key code map

| Concern | Python | TypeScript |
|---------|--------|------------|
| Orchestration | `src/pipeline.py` | `frontend/src/app/api/hunt/route.ts` |
| Adapters | `src/adapters.py`, `jobspy_adapter.py` | `frontend/src/lib/sources.ts` |
| HTTP | `src/http_client.py`, `scrape_cache.py` | `fetch` in sources |
| Score | `src/eligibility.py` | `frontend/src/lib/eligibility.ts` |
| Prefs / regions | `src/preferences.py`, `config/regions/` | `preferences.ts`, `config.ts` |
| UI | Streamlit `app.py` | `HuntApp.tsx` |
