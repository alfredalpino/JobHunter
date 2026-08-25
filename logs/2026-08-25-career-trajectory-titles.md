# 2026-08-25 — Career trajectory title filtering

## Problem
Resume parser collected every historical job title into `target_titles` and `search_queries`. A career pivot (e.g. janitor → software engineer) caused hunts for old unrelated roles.

## Fix (`src/lib/resume.ts`)
- `extractExperienceEntries()` — dated experience blocks, sorted most-recent-first
- `selectCareerRelevantTitles()` — anchor on latest professional role; keep only same career track (role family)
- `NON_PROFESSIONAL_TITLE` blocklist — janitor, retail, warehouse, etc.
- `search_queries` — max 2–3 from Open to, else latest 1–2 roles only (not full history)
- `normalizeSearchQuery()` — "Software Engineer II" → "Software Engineer"
- Skip noisy inline title scan when structured experience exists
- `filters.ts` — `sanitizeTargetTitles()` drops non-professional titles

## Tests
- Career pivot CV: no janitor/sales in targets or search queries
- Level suffix normalization
