# Job portals & scrape tech inventory

Date: 2026-08-25

## Action
Answered user question: list of scraped job portals and scraping technologies. Read `src/lib/sources.ts`, `scrape-cache.ts`, `linkedinSearch.ts`, `package.json`. No code changes.

## Findings
- Always-on adapters: Remote OK, Remotive, Arbeitnow, Jobicy, Himalayas, We Work Remotely, The Muse, NoDesk, Dynamite Jobs
- Conditional: USAJobs, Job Bank Canada, Adzuna, Jooble
- LinkedIn: deeplink only (not scraped)
- Tech: native `fetch`, JSON APIs, RSS regex parse, HTML regex list scrape; no browser automation libs
