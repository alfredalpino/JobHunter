# JobHunter web — alfredterminal.xyz

Next.js (App Router) product site for **JobHunter** by **Alfredterminal**.

Fully operable in the browser:

1. Analyze resume (paste text or PDF/TXT) — optional AI polish
2. Confirm / edit profile + pick region
3. Preferences (date window, seniority, YAML)
4. Hunt via public job APIs + TypeScript eligibility (role families, seniority, recency)
5. **Today's 10** queue · mark applied · export markdown — **no auto-apply**

Python `./run.sh` remains for power users (JobSpy / HTML portals). Optional deep hunt: `scripts/deep_hunt_server.py`.

## Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS v4 · Fraunces + Outfit
- `unpdf` for serverless PDF text extract

## Local run

```bash
cd frontend
npm install
npm run dev -- -p 3000 -H 127.0.0.1
```

Open [http://127.0.0.1:3000/app](http://127.0.0.1:3000/app).

| Path | Purpose |
| --- | --- |
| `/` | Marketing landing |
| `/app` | Operable hunt wizard |
| `/api/health` | Health JSON |
| `/api/regions` | Region packs (`config/regions/*.yaml` when present) |
| `/api/analyze` | Resume → profile |
| `/api/hunt` | Fetch + filter jobs |
| `/api/polish` | Opt-in Gemini Flash polish |
| `/api/deep-hunt` | Proxy to local Python deep hunt |

## Optional API keys

Copy `.env.example` → `.env.local`:

| Key | Purpose |
| --- | --- |
| `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` | Country-local Adzuna listings ([developer.adzuna.com](https://developer.adzuna.com/) free tier) |
| `JOOBLE_API_KEY` | Optional Jooble aggregator ([jooble.org](https://jooble.org/api/about)) |
| `USAJOBS_USER_AGENT` + `USAJOBS_API_KEY` | USAJobs for USA regions |
| `GEMINI_API_KEY` | Opt-in profile / match polish (checkbox in UI) |
| `DEEP_HUNT_URL` | e.g. `http://127.0.0.1:8765` after starting `scripts/deep_hunt_server.py` |

Always-on web sources (no keys): Remote OK, Remotive, Arbeitnow, Jobicy, Himalayas, We Work Remotely, The Muse, NoDesk, Dynamite Jobs (+ Job Bank Canada for CA regions).

Google Jobs / Indeed / LinkedIn / Glassdoor / Bayt run via the **Python CLI** (`python-jobspy`).

## Date windows

In preferences / results: This week · Last week · 2–3 weeks · 3–4 weeks · Up to 1 month · All fresh (≤14 default). Fetch max age follows the selected window (up to 30 days).

## Deploy to Vercel (alfredterminal.xyz)

1. Import `alfredalpino/JobHunter` in Vercel.
2. Set **Root Directory** to `frontend`.
3. Framework: Next.js. Build: `npm run build`.
4. Env (optional): Adzuna, USAJobs, `GEMINI_API_KEY`. Do **not** set `DEEP_HUNT_URL` on Vercel (local only).
5. Deploy → confirm `/` and `/api/health`.
6. Attach domain `alfredterminal.xyz` / `www`.

## Tests

```bash
cd frontend && npm test
```

## Risks

- Public APIs may rate-limit or change ToS — treat as best-effort.
- Remote-board bias without Adzuna/JobSpy.
- Unknown posting dates are rejected.
- PDF scans without text need paste fallback.
