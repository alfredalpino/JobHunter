# New brand logo rollout

**Date:** 2026-08-25

## Assets (from logo-master.png)
- `public/logo.png` — 512×512 full lockup
- `public/logo-icon.png` — crosshair crop for header/favicon
- `public/favicon-32.png`, `public/apple-touch-icon.png`
- `src/app/icon.png`, `src/app/apple-icon.png` — Next.js metadata icons
- `public/logo-master.png` — archived source (was Logo copy.png)

## UI
- `BrandLogo` component (`full` | `icon` variants)
- Header: icon + wordmark; Footer: full logo; Hero & About: full logo
- Removed `LogoMark.tsx` (SVG placeholder)
- `layout.tsx` icons + Open Graph updated
- `docs/assets/logo.png` synced for README
