# 2026-08-25 — Resume analysis + preferences improvements

## Changes

### Resume extraction (`src/lib/resume.ts`)
- Section-aware parsing for Experience titles and Skills blocks
- Infers `max_job_level` and `seniority_band` from years + title signals
- Smarter fallback titles from detected role family (not generic software defaults)
- Work authorization detection (sponsorship, visa, authorized)
- Expanded skills/certs/locations; `guessRegionFromLocation()` for prefs seeding
- Added unit tests in `src/lib/resume.test.ts`

### Preferences merge (`src/lib/filters.ts`)
- `mergeProfileIntoPrefs` auto-selects region from resume location
- Seeds work_auth, work_mode, seniority excludes for junior profiles
- Bidirectional helpers: `seniorityBandToJobLevel`

### Preferences apply (`src/lib/preferences.ts`)
- Hybrid work mode geo signals
- Work auth boosts visa/sponsor allow signals
- Seniority band syncs `max_job_level` on merged profile

### UI (`src/components/HuntApp.tsx`)
- Step 2: extracted contact card (name, email, phone, LinkedIn, location)
- Shows years, certifications, hunt queries
- Step 3: work authorization select; seniority syncs with max job level
- Removed duplicate work mode from preferences step (kept on profile step)

### Tests
- `src/lib/filters.test.ts`, fixed `preferences.test.ts` date_window expectation
