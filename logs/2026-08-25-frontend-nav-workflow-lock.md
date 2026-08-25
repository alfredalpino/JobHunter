# Frontend: nav, hero scale, locked workflow

Date: 2026-08-25

## Changes
1. **SiteHeader** — Removed "Open app" nav link. "Get started" is the only app entry CTA; on `/app` it is replaced with an "In app" badge (desktop + mobile).
2. **SiteFooter** — "Open app" → "Get started"; hidden while already in the app.
3. **Hero** — Removed "Analyze resume". Larger homepage brand/headline/body/CTA. Home-only scale via `.home-page` + section typography bumps (How it works, Preferences, Truth strip). `/app` font sizes unchanged.
4. **HuntApp workflow** — Stepper is display-only (locked/completed/current). Navigation only via stage CTAs (`goForward` / `goBack` / hunt completion). Cannot jump ahead by clicking steps.

## Verify
- Home HTML: Get started present; no Open app / Analyze resume.
- App HTML: In app present; no Get started; locked step labels present.
