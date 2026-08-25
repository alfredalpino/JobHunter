# Fix: Get started opened on stage 2

Date: 2026-08-25

## Cause
`HuntApp` restored a prior localStorage profile and called `setStep(2)` (or 4 with results), skipping resume upload.

## Fix
On mount, always reset to stage 1: clear hunt session, empty profile/name/resume, `unlockedMax=1`. Keep applied-status map only.
