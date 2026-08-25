# 2026-08-25 — Mega Aggregator build (P1–P4)

## Actions

Implemented shared job index + 30m cron ingest + cross-portal clusters +
hunt-from-index with live-scrape fallback + top-10 Match Loop drip UI +
BYOK AI shortlist re-rank (`mode: rerank`).

### Storage (Workstream A)
- Added `drizzle-orm`, `postgres`, `drizzle-kit`, `dotenv`
- `src/lib/db/schema.ts` — sources, clusters, jobs, ingest_runs
- `src/lib/db/client.ts` — `getDb()` returns null without `DATABASE_URL`
- `drizzle.config.ts` + `drizzle/0000_mega_aggregator.sql`
- npm scripts: `db:generate`, `db:migrate`, `db:push`

### Ingest (Workstream B)
- `src/lib/ingest/seeds.ts` — role-family × region seed queries
- `src/lib/ingest/cluster.ts` — normalize title/company, URL identity, merge
- `src/lib/ingest/runIngest.ts` — fetch → clip → upsert fingerprint → cluster
- `src/lib/sources.ts` — extracted `fetchJobsForQueries` for seed + profile
- `POST|GET /api/cron/ingest` + `POST /api/admin/ingest` (Bearer `CRON_SECRET`)
- `vercel.json` cron every 30 minutes
- `.env.example` — `DATABASE_URL`, `CRON_SECRET`

### Hunt (Workstream C)
- `src/lib/index/queryJobs.ts` — load active index jobs (recency ~45d, cap 2000)
- `src/app/api/hunt/route.ts` — prefer index; metadata `source` / `index_count`

### UI drip (Workstream D)
- `src/lib/drip.ts` — batch cursor helpers
- `HuntApp` Match Loop (10 at a time), Next batch, Show all matches toggle
- Session restores `dripCursor` / `showAllMatches` / `huntSource`

### BYOK re-rank (Workstream E)
- Polish `mode: rerank` — top ~40 only; ordered URLs + notes
- Hunt flow: optional rerank then match notes when AI enabled

## How to run ingest locally

```bash
# 1. Apply schema (Neon / local Postgres)
export DATABASE_URL="postgresql://..."
export CRON_SECRET="dev-secret"
npm run db:push   # or psql $DATABASE_URL -f drizzle/0000_mega_aggregator.sql

# 2. Trigger ingest
curl -X POST http://127.0.0.1:3000/api/admin/ingest \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"fresh":true,"maxSeeds":6}'
```

Without `DATABASE_URL`, `npm run dev` and hunt still use live scrape.

## Env vars

| Var | Required | Purpose |
|-----|----------|---------|
| `DATABASE_URL` | for index | Postgres (Neon/Vercel compatible) |
| `CRON_SECRET` | for cron/admin | Bearer auth on ingest routes |
| `GEMINI_API_KEY` | optional | server-side polish/rerank if no BYOK |
| Adzuna/Jooble/USAJobs | optional | extra source adapters |

## Tests

- `src/lib/ingest/cluster.test.ts`
- `src/lib/drip.test.ts`
- `src/lib/ingest/ingest.test.ts`
- `src/lib/hunt-index.test.ts`

Not built this pass: Greenhouse/Lever/Ashby ATS adapters (P5).
