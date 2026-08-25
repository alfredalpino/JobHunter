# Mobile responsive pass — 2026-08-25

## Summary
Improved phone/tablet UX across landing, hunt app, status, header, and footer.

## Changes

### SiteHeader
- Hamburger menu on `< md` with glass overlay panel (all nav links + Get started)
- Body scroll lock + Escape to close; closes on route change
- Smaller logo on mobile; 44px min tap targets for menu + CTA
- Tighter horizontal padding on small screens

### HuntApp (`/app`)
- Stepper horizontal scroll on narrow screens
- Panels use `p-4 sm:p-6`
- Step actions full-width stacked buttons on mobile
- Job cards: content stacks above 2×2 action grid; word-break on titles
- Wrong-fit controls are proper ghost buttons with 44px targets
- Results stats split across lines on mobile
- Filter checkbox enlarged hit area

### Landing + shell
- Hero: full-width CTAs on mobile, tighter padding
- Section padding `px-4` on mobile across HowItWorks, About, Preferences, TruthStrip
- App main: `px-4 py-6` on mobile
- `overflow-x: clip` on html/body; `-webkit-tap-highlight-color: transparent`
- `.touch-target` utility (44px min-height)

### StatusBoard + Footer
- Status paths use `break-all`; larger Refresh button
- Footer: 2-column link grid on mobile; landing anchor links when not in app

## Verify
- Resize browser to 375px or use device mode
- Test hamburger → links → close
- Run hunt flow on `/app` and scroll job results
