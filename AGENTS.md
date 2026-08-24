# JobHunter — agent instructions (web primary)

This repository’s **`main` branch is the Next.js web app** (resume-first hunt in the browser).

## Token policy

1. Do **not** call Gemini for scraping or scoring in the web app.
2. Optional polish only when the user opts in (`GEMINI_API_KEY`).
3. Prefer reading `/status` and `/api/status` for uptime — don’t re-scrape to “check health”.

## Everyday commands (main)

```bash
npm install
npm run dev -- -p 3000 -H 127.0.0.1
npm test
```

## CLI / local Python

Checkout **`cli-local`** for `./run.sh`, region packs workflows, and Python deep hunt:

```bash
git checkout cli-local
./setup-once.sh
./run.sh easy-hunt --id <id>
```

## Hard product rules

- Recency max **14 days** by default product policy; UI date windows can widen display.
- No auto-apply. Speak plainly.
