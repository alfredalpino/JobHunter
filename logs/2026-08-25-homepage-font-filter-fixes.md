# Homepage font −25% + stage 2–4 filter fixes

Date: 2026-08-25

## Homepage
- Reduced hero/section typography ~25% from prior enlarged sizes (back near original scale).
- Removed `.home-page` base font bump.

## Filters (stages 2–4)
- Added `src/lib/filters.ts`: list parsing, job window filter, profile↔prefs merge.
- Stage 2: titles as textarea, live sync to prefs, work mode, styled selects, junk title filtering.
- Stage 3: default date filter `all_fresh`, must-have skills, clearer labels.
- Stage 4: proper filter panel, reset button, preserves stage 3 date choice after hunt.
- Resume parse: drops sentence-like junk from target titles.
- Default preferences: `date_window: all_fresh`, `recency_max_days: 14`.
