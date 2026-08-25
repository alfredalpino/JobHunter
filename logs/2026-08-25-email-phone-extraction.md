# 2026-08-25 — Email extraction phone glue fix

## Problem
Contact line `8303796759ubaid.in.2003@gmail.com` parsed email as full string including phone digits.

## Fix (`src/lib/resume.ts`)
- `extractEmail()` — candidate scoring + `sanitizeEmailAddress()` strips leading 7+ digit runs from local part
- `extractPhone()` — removes email tokens first, then matches phone patterns
- `isPlausibleEmail()` — rejects digit-heavy / letter-less local parts

## Test
Reproduces user case: email `ubaid.in.2003@gmail.com`, phone `8303796759` separate.
