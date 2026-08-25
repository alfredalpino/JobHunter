# 2026-08-25 — Portal-style search header (titles + region + Hunt)

## Goal
Unblock hunting behind “Analyze resume first.” Add a sticky **Job titles / keywords + Location/region + Hunt** bar like major job portals, with a lightweight synthetic profile when the user has not analyzed a resume yet.

## Portal research (quick)
- **Indeed**: sticky “What” (title/keywords) + “Where” (location) + primary Search; filters sit below results/search, not as the only entry point.
- **LinkedIn Jobs**: keyword field + location in the jobs search header; boolean-friendly keywords; filters refine after search.
- **Glassdoor**: “Your job search starts here” — title/what + location + Search as the hero control before secondary browsing.
- **Wellfound**: explicit **Job title** + **Location** + **Search** row on `/jobs`.
- **Remotive**: category / location / career-level filter bar at the top of the remote jobs list (search-first layout, not resume-gated).

Common pattern: **Keywords/Title + Location + primary Search** in a sticky header; filters are secondary.

## Changes
- **`src/lib/searchProfile.ts`** — `parseTitleKeywords`, `buildMinimalProfileFromTitles` (`source: "titles"`), `applyTitlesToProfile` (rebuilds `search_queries` via `buildHuntQueries`).
- **`src/components/hunt/HuntSearchHeader.tsx`** — sticky glass bar: titles input, region select, **Hunt**, **Open LinkedIn search** deeplink (no LinkedIn scrape).
- **`HuntApp.tsx`** — titles state synced with profile; Hunt builds/uses minimal profile when needed; Analyze still upgrades to a resume profile.
- **`HuntFilters.tsx`** — refine-only (Fit/Posted/Work mode/Exclude/Must-have); removed “Analyze resume first” Hunt CTA (moved to search header).
- **`ResumePanel` / `ProfileRail`** — Analyze framed as optional; Target titles labeled as synced with the search bar; single BYOK polish `<details>` kept (duplicate Expand stacks were from sticky filter CTA clutter, not multiple polish panels).

## How the user searches
1. Type titles in **Job titles / keywords** (comma-separated), e.g. `Network Engineer, NOC Engineer`.
2. Pick **Location / region**.
3. Click **Hunt** (works without Analyze — creates a lightweight profile from titles).
4. Optional: paste/upload resume → **Analyze resume** for tighter skills/seniority fit.
5. Optional: **Open LinkedIn search** opens LinkedIn’s UI with the same keywords + location (deeplink only).

## Preserved
Drip batching, export, work mode, mega index hunt, YAML advanced prefs, session restore, no auto-apply, no LinkedIn scrape.

## Tests
- Unit: `src/lib/searchProfile.test.ts` (7 cases)
- `npm test -- --run` → **107 passed** (18 files)
