# 2026-08-25 — Unified hunt UI (replace 4-step wizard)

## Goal
Replace the sequential Step 1–4 wizard in `HuntApp` with one filter-rich workspace: resume + profile + filters + results on `/app`. LinkedIn = deeplink helper only (no scrape).

## Changes
- **Removed** `Step` / `unlockedMax` / `goForward` / `goBack` / stepper UI.
- **Split** into `src/components/hunt/`:
  - `ResumePanel.tsx` — upload/paste, analyze, collapsed BYOK Gemini
  - `ProfileRail.tsx` — inline name/titles/skills/years/seniority/region/locations/work auth
  - `HuntFilters.tsx` — sticky dense filters + Hunt CTA + **Open LinkedIn search** + index/live badge; mobile collapsible fields
  - `HuntResults.tsx` — drip match loop, show-all buckets, export, job actions including **Skip**
- **Orchestrator** `HuntApp.tsx` keeps analyze/hunt/session/drip/export/BYOK logic; same view after analyze and after hunt.
- **LinkedIn** `src/lib/linkedinSearch.ts` + tests — builds `linkedin.com/jobs/search/?keywords=…&location=…&f_TPR=r…` only. UI note: listings aren’t ingested.
- **Copy** — HowItWorks + `/app` metadata updated off “four steps”; polish error no longer says “Step 1”.
- **Layout** — `/app` main widened to `max-w-7xl`.

## Preserved
Index vs live hunt, top-10 drip, Band C, work mode, exclude keywords, YAML advanced prefs, session restore (&lt;24h), start over, no auto-apply messaging. Live scrape fallback without `DATABASE_URL` unchanged.

## Tests
`npm test -- --run` → **100 passed** (incl. `linkedinSearch.test.ts`).

## How to try
1. `npm run dev` → http://127.0.0.1:3000/app
2. Analyze a resume (left rail).
3. Tune sticky filters; **Hunt / refresh matches**.
4. **Open LinkedIn search** opens a new tab (no LinkedIn data in results).
5. Use drip / mark applied / skip / export as before.
