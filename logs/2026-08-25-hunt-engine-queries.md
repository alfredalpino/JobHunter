# 2026-08-25 — Hunt engine: query expansion + matching

## Problem
262 jobs scraped but 0 eligible — wrong jobs fetched (Associate Instructor, etc.) and hard title-family reject.

## Fixes
- `huntQueries.ts` — expand scrape queries per role family (network, data, security…); infer network from CCNA/skills
- `sources.ts` — rotate queries across job boards; filter RSS feeds by query
- `roleFamilies.ts` — adjacent family matching (network ↔ security ↔ IT support)
- `eligibility.ts` — skills-bridge for IT titles when 2+ skills match posting
- `resume.ts` / HuntApp — `search_queries` built via `buildHuntQueries`

## User tip
For network roles: add "Network Engineer" to target titles or CCNA/routing skills on resume.
