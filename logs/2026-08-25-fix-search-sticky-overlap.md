# Fix: Search Jobs sticky overlap

**Date:** 2026-08-25  
**Issue:** Sticky “Search jobs” panel overlapped Matches / Export while scrolling (z-index stacking).

## Cause

`HuntSearchHeader` used `sticky top-2 z-30` on its glass panel. It sits above the two-column workspace grid, so on scroll it pinned under the viewport top and painted over the Matches column.

## Change

| File | Change |
|------|--------|
| `src/components/hunt/HuntSearchHeader.tsx` | Removed `sticky top-2 z-30` from the section; kept `glass-panel p-4 sm:p-5` so the panel scrolls with the document. |

## Checked / not changed

- **LinkedIn:** No “Open LinkedIn search” control in the search header (already gone). Filters only note that portals are public and LinkedIn is not scraped.
- **`HuntApp.tsx` left `aside`:** Still has `lg:sticky` for Resume / Profile / YAML rail. That column does **not** wrap Search jobs; leaving it avoids changing unrelated rail UX.
- **Glass CSS:** Content panels do not elevate z-index over the main column; site nav still uses `z-30`/`z-40`/`z-50` as intended.

## Layout expectation

- Desktop: search header → two columns (rail \| Matches/Export); search scrolls away.
- Mobile: same sections stacked; search scrolls away (aside sticky only from `lg:`).

## Verification

- Class edit only; no shared helpers touched — no test run.
- Manual sanity: confirm Search jobs leaves the viewport on scroll and does not cover Matches.
