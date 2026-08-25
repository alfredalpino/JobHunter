# Production copy cleanup — app UI

**Date:** 2026-08-25

## Problem
Dev-style labels (e.g. "Operable app", numbered stage headings, uppercase eyebrows) made `/app` feel unfinished, especially visible above results.

## Changes
- **`src/app/app/page.tsx`** — Removed page intro block; HuntApp is the sole content.
- **`src/components/HuntApp.tsx`** — Production titles, cleaner stepper, simplified results copy, filters heading, job tags, source summary.
- **`src/components/HowItWorks.tsx`** — Removed "fully operable" wording.

## Verification
- `/app` no longer renders "Operable app" or "Hunt from the browser".
- Results stage title is "Your matches".
