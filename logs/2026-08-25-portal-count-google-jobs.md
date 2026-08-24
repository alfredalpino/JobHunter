# Portal inventory — Google Jobs status

Date: 2026-08-25

## Question
How many live job portals are scraped, and is Google Jobs added?

## Findings
- `config/portals.yaml`: 120 entries; **115 live** (`method != skip`); 5 skipped (`remotecool`, `wellfound_angel`, telegram/whatsapp/instagram groups).
- Methods among live: html 81, site_search 29, rss 3, remoteok_api 1, remotive_api 1.
- JobSpy adapter (`src/jobspy_adapter.py`) maps site `google` → **"Google Jobs"** and defaults include `indeed`, `linkedin`, `google`.
- All region packs list `google` under `jobspy_sites`.
- **Gap:** `pipeline.py` imports `scrape_jobspy` but never calls it. Preferences set `use_jobspy: true`, but the hunt loop does not invoke JobSpy today.
- `google_careers` in portals.yaml is Google Careers (employer ATS), not Google Jobs search.
- Frontend (`frontend/src/lib/sources.ts`): Remote OK, Remotive, Arbeitnow, Jobicy, Himalayas, We Work Remotely (+ USAJobs for USA, Adzuna if keys). No Google Jobs.
- This environment: `python-jobspy` not installed in `.venv` at check time.

