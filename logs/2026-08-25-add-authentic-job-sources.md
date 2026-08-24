# Added authentic job sources (Google Jobs + more)

Date: 2026-08-25

## Changes
1. **Wired JobSpy into `src/pipeline.py`** — hunts now scrape Indeed / LinkedIn / Google Jobs / Glassdoor / Bayt / Naukri (per region `jobspy_sites`) when `use_jobspy: true`.
2. **Country alias fix** in `src/jobspy_adapter.py` — maps `uae` → `united arab emirates` (JobSpy requirement). Google gets a secondary simpler query retry.
3. **New Python API adapters** in `src/adapters.py`: Arbeitnow, Jobicy, Himalayas, The Muse, USAJobs.
4. **`config/portals.yaml`** — Himalayas switched to API; added Arbeitnow, Jobicy, The Muse, USAJobs, Dice, Reed, Totaljobs, CWJobs, SEEK; tagged more remote boards with `regions`.
5. **Frontend `sources.ts`** — The Muse, NoDesk RSS, Dynamite Jobs, Job Bank Canada (CA), optional Jooble key.
6. **Region packs** — added `glassdoor` to JobSpy site lists; `python-jobspy` installed / listed in `requirements.txt`.

## Verify
- Indeed via JobSpy: OK (Dubai sample returned listings).
- Arbeitnow / The Muse APIs: OK.
- Google Jobs: wired; results can be empty depending on Google cursor/query (JobSpy limitation) — Indeed/LinkedIn still fill the gap.
