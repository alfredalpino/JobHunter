# Glassmorphism UI polish — 2026-08-25

## Summary
Rolled out a cohesive glassmorphism design system across the JobHunter web app (landing, hunt workflow, status page).

## Changes

### Design tokens & utilities (`src/app/globals.css`)
- Glass tokens: `--glass-bg`, borders, blur, shadows
- Component classes: `glass-nav`, `glass-panel`, `glass-card`, `glass-input`, button variants, stepper, chips, alerts, code blocks
- Enhanced `.atmosphere` with floating orbs and grid drift
- Added `glass-file-input` and `textarea.glass-input` helpers

### Landing page
- `Hero.tsx` — glass badge, cards, CTA buttons
- `HowItWorks.tsx` — glass cards for steps
- `PreferencesExplainer.tsx` — glass card + code panel
- `TruthStrip.tsx` — glass panel CTA strip
- `SiteFooter.tsx` — frosted footer bar
- `SiteHeader.tsx` — glass nav (prior session)

### Hunt app (`HuntApp.tsx`)
- Page intro header with glass badge
- Stepper uses `glass-step-active/done/locked`
- All panels → `glass-panel`, insets → `glass-inset`
- Inputs/selects → `glass-input` (via `FILTER_SELECT_CLASS`)
- Buttons → `glass-btn-primary/ghost/seafoam`
- Job cards → `glass-card`; buckets → `glass-panel-highlight/subtle`
- Status/error → `glass-alert-success` / `glass-alert`

### Status page (`StatusBoard.tsx`)
- Summary in `glass-panel`
- Each probe in `glass-card`
- Refresh button and footer note styled with glass utilities

## Verification
- `npx tsc --noEmit` — pass
- `npm test` — 40/41 pass (1 pre-existing failure in `resume.test.ts`, unrelated)

## Not committed
User did not request commit/push.

---

## Follow-up — skeuo-glass buttons & line removal (same day)

### Fixes
- **Invisible buttons:** Tailwind v4 preflight was resetting `button { background: transparent }`, stripping glass button fills. Moved `.glass-btn-*` styles **outside** `@layer components` with `button.glass-btn-*` selectors and explicit gradients/shadows.
- **Skeuo-glass blend:** Primary = raised copper pill (top highlight, bottom lip shadow, press state). Ghost = frosted teal glass with beveled rim. Seafoam = tinted glass with depth.
- **Hero line:** Removed `.horizon` glow line from `Hero.tsx`; removed `border-t` divider before "How it works".
- **Status page (`/status`):** Removed `.horizon`; bottom probe note is plain text (no bordered panel); footer top border removed site-wide.
