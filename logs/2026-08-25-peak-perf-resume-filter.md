# 2026-08-25 — Peak performance: resume, filter, ingest

## Resume extraction (`src/lib/resume.ts`)
- Longest-first skill seed matching (`matchSkillSeeds`) — fewer false positives
- Professional summary + headline extraction → `plain_summary`
- GitHub / portfolio URL detection (bare or https)
- Phone normalization

## Job filtering (`src/lib/eligibility.ts`, `src/lib/seniority.ts`)
- `compileScoreContext()` — compile profile once per hunt batch
- Pre-built exclude phrase checkers + word-boundary skill matchers
- `compileSeniorityGate()` — seniority checked without re-scanning profile per job
- Must-have skills gate: if profile has 3+ skills, posting body must mention at least one (not title-only)
- Spam/hub title rejection
- `scoreAllJobsDetailed()` — score + eligible count + dedupe stats in one pass

## Ingest dedupe (`src/lib/sources.ts`)
- Fingerprint dedupe (`host|title|company`) at fetch merge, before scoring

## UI performance (`src/lib/filters.ts`, `HuntApp.tsx`)
- `applyJobFilters()` — single-pass fit + date + band + status filter
- `partitionJobsByBucket()` — one walk for age buckets
- Profile step shows extracted summary blurb

## Hunt API (`src/app/api/hunt/route.ts`)
- Uses `scoreAllJobsDetailed`; returns `deduped_count`

## Tests
47 unit tests passing (`resume`, `eligibility`, `filters`, …)
