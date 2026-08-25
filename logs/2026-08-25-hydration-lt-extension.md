# 2026-08-25 — Fix hydration mismatch on `<html>`

## Cause

Console hydration warning on `/app` showed extra attributes on `<html>`:

- `data-lt-installed="true"` — injected by the **LanguageTool** browser extension
- mismatch vs React’s expected client tree

Not an app logic bug (no `Date.now()` / `window` branch in root layout).

## Fix

Added `suppressHydrationWarning` to `<html>` and `<body>` in `src/app/layout.tsx` so React ignores attribute drift from extensions on those nodes (standard Next.js / React guidance).
