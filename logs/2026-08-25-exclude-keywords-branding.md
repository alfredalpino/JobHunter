# Exclude keywords fix + branding (logo, Alfred Alpino, alubaid.xyz)

**Date:** 2026-08-25

## Exclude keywords bug
**Cause:** `splitListInput` required tokens length ≥ 2 and applied resume-title heuristics on every keystroke. Single-character input was cleared immediately in the controlled field.

**Fix:**
- Added `splitKeywordListInput` in `src/lib/filters.ts` for user keyword fields.
- Exclude field uses draft state (`excludeInput`); commits on blur and before hunt.
- Locations and must-have skills use `splitKeywordListInput` on change.

## Branding
- New `LogoMark` component — vector mark with gradient ring in header.
- Subheading: **BY ALFRED ALPINO** (uppercase styling).
- Footer + site metadata: **alubaid.xyz** (replaces alfredterminal.xyz).
- Hero badge updated to Alfred Alpino.

## Tests
- `splitKeywordListInput` unit tests in `src/lib/filters.test.ts`.
