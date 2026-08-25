# JobHunter — agent instructions (web primary)

This repository’s **`main` branch is the Next.js web app** (resume-first hunt in the browser).

## Token policy

1. Do **not** call Gemini for scraping or scoring in the web app.
2. Optional polish only when the user opts in (`GEMINI_API_KEY`).
3. Prefer reading `/status` and `/api/status` for uptime — don’t re-scrape to “check health”.

## Everyday commands (main)

```bash
npm install
npm run dev
npm test
```

Dev server: **http://127.0.0.1:3000**. Do not auto-forward or run NFB/Frontier-Bakery on this machine — a remote Cursor SSH session to `frontier` was hijacking port 3000.

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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
