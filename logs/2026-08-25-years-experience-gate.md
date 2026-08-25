# 2026-08-25 — Reject 5yr postings for junior network seekers

## Bug

Field Technician III (Cable Bahamas / Grain Reference) marked eligible despite
"Up to a minimum of **5 years' experience**" on the live listing.

## Causes

1. Year parser missed possessive `years'` and "minimum of N years" phrasing → returned null → no year reject.
2. `applySeniorityToProfile` inflated junior+credibility `max_years_required` to **4**.
3. Scrape summaries were hard-clipped to **400 chars**, so Qualifications at the end of long postings never reached the scorer (UI snippet only showed HFC duties).

## Fixes

- `maxYearsRequiredFromText` — apostrophe, minimum-of, "years in/with".
- Junior year cap stays ≤2–3 (credibility unlocks mid *titles*, not higher year floors).
- `clipJobSummary` — keeps year-requirement windows when truncating; sources use ~1800 char scoring summaries.

## Resume check

`public/test/Ubaid Ur Rahman Network Engineer.pdf` — CCNA candidate / ISP-trained;
parsed profile with lucknow prefs rejects the 5yr Field Technician III posting.
