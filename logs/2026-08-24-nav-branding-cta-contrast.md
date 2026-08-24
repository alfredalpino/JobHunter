# Action log — nav branding + CTA contrast

Date: 2026-08-24

## Changes
1. `frontend/src/components/SiteHeader.tsx`
   - Subtitle near logo: "by Alfredterminal" → "By Alfred alpino" (removed uppercase styling).
   - Get started buttons: forced dark ink text (`!text-ink`) for contrast on copper.
2. `frontend/src/app/globals.css`
   - Moved base element rules (including `a { color: inherit }`) into `@layer base` so Tailwind utilities like `text-ink` correctly override link inheritance.

## Why
Nav CTA text was inheriting light `text-sand-muted` from the parent nav because unlayered `a { color: inherit }` beat utility classes.
