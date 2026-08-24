# Fix: duplicate `targets` in eligibility.ts

Date: 2026-08-25

## Error
Console / Turbopack: `the name targets is defined multiple times` at `frontend/src/lib/eligibility.ts:135`.

## Cause
An intermediate edit declared `const targets` twice in `scoreJob` (once for the title gate, again when adding `title_weight`).

## Resolution
Current `eligibility.ts` no longer uses a local `targets` binding for scoring; title matching goes through `matchTitleToProfile` from `roleFamilies.ts`. `npx tsc --noEmit` passes. Next.js dev server restarted to clear a stuck HMR failure that kept showing the old syntax error.

## Files
- `frontend/src/lib/eligibility.ts` (already corrected on disk; no further edit required)
