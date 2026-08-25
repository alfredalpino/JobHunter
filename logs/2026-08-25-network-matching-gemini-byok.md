# 2026-08-25 — Network matching + Gemini BYOK

## Phase A — Matching engine

- Expanded `network_ops` phrases: field technician, telecom/HFC/broadband/ISP/fiber roles, junior network engineer, NOC L1.
- Widened `buildHuntQueries()` network family queries (junior network, field technician, etc.).
- `stripTitleTierSuffix()` in seniority — Roman II/III no longer inflate seniority rank.
- Junior `max_years_required` default now **2** (resume parse + seniority apply).
- Network-focused profiles: skip `security` adjacent family; block AppSec titles and skills-bridge unless network appears in title.
- Step 2 UI hint: use 2 for <2 yr roles.

## Phase B — Gemini BYOK (no login / no DB)

- `src/lib/geminiKey.ts` — sessionStorage helpers for key + opt-in flag.
- Step 1 panel: paste Gemini key (browser-only), show/hide/clear, link to AI Studio.
- `/api/polish` accepts `geminiKey` body or `X-Gemini-Key` header; skips disk cache for BYOK.
- Rate limit on POST `/api/polish` (30/IP/hour default).
- HuntApp passes user key to profile polish + match notes when opted in.

## Tests

- `seniority.test.ts`, `eligibility.test.ts`, `huntQueries.test.ts`, `roleFamilies.test.ts`

## Work mode filter (follow-up)

- Was in `Preferences.work_mode` + YAML + hunt scoring only — **no UI**.
- Added **Work mode** dropdown on Step 3 (Preferences) and Step 4 (Results filters).
- Results filter uses location/summary text (Remote / Hybrid / On-site).
