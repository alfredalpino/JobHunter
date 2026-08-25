# Scraper hardening — no LinkedIn scrape

Date: 2026-08-25

## Policy (hard rule)

**JobHunter does not scrape LinkedIn.** LinkedIn’s ToS forbid automated crawling;
guest/HTML scrapers and third-party LinkedIn wrappers are blocked or unreliable and
would put the product at legal/ToS risk. We never add LinkedIn HTML crawl, guest APIs,
RapidAPI LinkedIn wrappers, cookie/session scrapers, or Selenium against linkedin.com.

Resume contact fields may still *extract* a candidate’s public LinkedIn profile URL
from pasted CV text for the user’s own record — that is not job ingest.

## Removed

- **Open LinkedIn search** CTA from `HuntSearchHeader` (deeplink button +
  `buildLinkedInJobsSearchUrl` usage).
- Deleted `src/lib/linkedinSearch.ts` and `src/lib/linkedinSearch.test.ts`.
- Marketing / filter copy updated to public-source language (no LinkedIn CTA promise).

## Hardened / fixed

- Shared pure parsers in `src/lib/sourceParse.ts` (RSS, Job Bank HTML, date normalize,
  Jobicy tag / Muse category helpers) with unit tests in `sourceParse.test.ts`.
- **NoDesk**: fixed feed URLs (`/remote-jobs/index.xml`, engineering category) — old
  `/remote-jobs/feed.xml` 404’d.
- **Dynamite Jobs** HTML list scrape removed (SPA shell → always 0 jobs).
- Retries + longer timeouts on fetch wrappers; empty JSON/body throws so `wrap`
  reports `ok: false`.
- Himalayas / RemoteOK / Adzuna / Jooble dates via `normalizePostedAt` (unix epochs).
- Job Bank Canada: article parser + jsessionid strip.

## Expanded (legal inventory)

Always-on: Remote OK, Remotive (+ RSS), Arbeitnow, Jobicy (+ RSS), Himalayas,
We Work Remotely RSS, The Muse, NoDesk RSS, **Greenhouse public board JSON**
(seeded tokens: gitlab, stripe, airbnb, cloudflare, hashicorp, datadog, discord, notion).

Region-gated: USAJobs (USA), Job Bank Canada (Canada / Alberta).

Keyed (env): Adzuna (`ADZUNA_APP_ID`/`ADZUNA_APP_KEY`, optional `ADZUNA_COUNTRIES`),
Jooble (`JOOBLE_API_KEY`), Findwork (`FINDWORK_API_KEY`).

Inventory exposed on `GET /api/health` → `job_sources`. Per-hunt portal
ok/fail/counts in `POST /api/hunt` → `sources[]` and Hunt results badges.

## Verify

```bash
npm test -- --run
# Live: open /app, Hunt with titles; confirm multi-portal badges (Remote OK, Remotive, …)
# curl -s http://127.0.0.1:3000/api/health | jq .job_sources
```
