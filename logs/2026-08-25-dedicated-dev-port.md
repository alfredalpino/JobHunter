# Fix: JobHunter vs NFB port 3000 conflict

Date: 2026-08-25

## Problem
Both JobHunter and NFB (Frontier-Bakery at `Torpedoweb/Clients/Frontier-Bakery`) default to Next.js port 3000. Opening `http://127.0.0.1:3000` showed whichever project started last — often NFB instead of JobHunter.

## Fix
1. **JobHunter** — `npm run dev` now binds to **3010** (`package.json`, `AGENTS.md`, `README.md`).
2. **Frontier-Bakery (NFB)** — `npm run dev` now explicitly binds to **3000** so that port is always the client site.

## Use
- JobHunter: http://127.0.0.1:3010
- NFB client site: http://127.0.0.1:3000
