# 2026-08-25 — Export hub + Vercel performance guardrails

## Export & share (client-side)
- New `src/lib/export/` module: CSV, MD, JSON, plain text, WhatsApp chunker, clipboard, compressed share links (lz-string, ≤20 jobs)
- `ExportPanel` on Step 4: scope picker, format, download/copy/WhatsApp/email/native share/share link
- Bulk job selection via checkboxes + select all / clear
- `/share` read-only page decodes `#j=` hash payloads
- Preferences YAML download button in Step 3
- Session restore on refresh (<24h) + beforeunload hint when results loaded

## Performance (Vercel scale)
- Anonymous scrape cache (`src/lib/scrape-cache.ts`) — 15 min TTL per source+query+region
- One retry per source on non-429 failures
- Hunt response payload trim: shorter summaries for ineligible jobs; omit ai_* from API response
- IP rate limit middleware on `POST /api/hunt` (default 10/hour, `HUNT_RATE_LIMIT=0` to disable)
- `cached_sources` count in hunt API response

## Tests
- `src/lib/export/export.test.ts` — CSV injection, WhatsApp chunker, share link roundtrip
