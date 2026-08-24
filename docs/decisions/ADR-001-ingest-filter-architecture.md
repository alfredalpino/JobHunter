# ADR-001: Ingest and filter architecture

## Status

Accepted

## Date

2026-08-25

## Context

JobHunter pulls jobs from many public sources, filters by aspirant preferences, and shows a short list. Constraints:

- No Gemini for scrape or score
- Recency product rule: ≤14 days; unknown dates rejected on the authoritative CLI path
- Two runtimes exist today: Python CLI (deep) and Next.js (friends / Vercel)
- Full rewrite risk is high relative to current traffic and team size

We need an architecture that improves wall-clock hunt time and keeps filter semantics correct without forcing a single deployable tomorrow.

## Options Considered

### Option A: Single ingest microservice + shared scorer + job DB

- Pros: One truth, progressive UI, easy horizontal scale
- Cons: Large rewrite, new ops surface, overkill for personal / small-friend usage; blocks near-term speed wins

### Option B: Incremental dual-runtime with shared contract

- Pros: Ships Phase 1 speed (concurrency, cache, compiled match) immediately; golden tests lock filter parity; preserves Vercel constraints (no heavy HTML crawl on serverless)
- Cons: Temporary dual adapters; discipline required to avoid drift

### Option C: Frontend-only optimization

- Pros: Fast UI wins
- Cons: Leaves multi-minute CLI hunts and deep UAE coverage unfixed

## Decision

We choose **Option B**.

1. Keep two *ingest* surfaces (CLI deep vs web public APIs) for deploy reality.  
2. Treat **filter/score semantics** as a shared product contract, verified by fixtures (Phase 2).  
3. Optimize the Python scrape core first: per-host polite concurrency, TTL cache, retries.  
4. Optimize the TS score path: compile matcher once, fingerprint dedupe, single-pass buckets.  
5. Defer a job warehouse / single service to Phase 3 unless scale demands it.

## Consequences

- `docs/architecture/data-pipeline.md` is the source of truth for stages and SLOs.  
- Changes to eligibility must update both runtimes or add a fixture that fails CI.  
- Default scrape concurrency stays modest to remain polite to boards.  
- Web may still return older jobs in the pool, but the default UI window should match ≤14d (Phase 2).  
- Firecrawl / JobSpy remain low-concurrency because of external quotas.
