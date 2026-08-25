# Fix homepage header cropping

**Date:** 2026-08-25

## Problem
Navbar (logo, links, "Get started") was clipped at the top of the viewport on the homepage.

## Root cause
`SiteHeader` lived inside `.atmosphere`, which used `overflow: hidden`. That container clipped content at its top edge.

## Changes
1. **`src/app/page.tsx`** — Moved `SiteHeader` outside `.atmosphere`; outer wrapper uses `min-h-svh`.
2. **`src/app/app/page.tsx`**, **`src/app/status/page.tsx`** — Same layout pattern for consistency.
3. **`src/app/globals.css`** — `.atmosphere`: `overflow-x: clip; overflow-y: visible` instead of `overflow: hidden`. Body uses `min-height: 100svh`.
4. **`src/components/SiteHeader.tsx`** — Safe-area top padding, solid backdrop (`bg-ink/95`), higher z-index.

## Verification
- Dev server at http://127.0.0.1:3000 — header renders fully above atmosphere gradient.
