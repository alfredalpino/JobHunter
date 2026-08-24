# JobHunter

<p align="center">
  <img src="docs/assets/logo.png" alt="JobHunter logo" width="120" height="120" />
</p>

<p align="center">
  <strong>Fresh jobs. Your resume. Your move.</strong><br />
  Resume-first worldwide job filter by <a href="https://alfredterminal.xyz">Alfredterminal</a>.<br />
  <em>No auto-apply. You decide what to send.</em>
</p>

<p align="center">
  <a href="START_HERE.md">START HERE (non-technical)</a> ·
  <a href="HOW_IT_WORKS.md">How it works</a> ·
  <a href="frontend/">Product website</a> ·
  <a href="https://github.com/alfredalpino/JobHunter">GitHub</a>
</p>

---

## Mission

Job hunting should not mean drowning in stale listings or letting a bot spam employers for you.

**JobHunter** helps anyone — not only engineers — turn a CV into a short, fresh list of roles that actually fit. You pick a region, tune a plain preferences file, and apply yourself.

It is an open, well-intentioned tool: local-first, transparent filters, and careful with AI credits.

## What it does

| Step | What happens |
| --- | --- |
| 1. Analyze resume | Builds a local eligibility profile (skills, titles, seniority). AI polish is **optional** and **off by default**. |
| 2. Prefer region | Loads a region pack (`dubai`, `usa`, `india`, `bangalore`, `lucknow`, `alberta`, `washington`, `warsaw`, `remote`, `worldwide`, …). |
| 3. Match | Titles + skill synonyms + seniority guardrails (juniors never get executive spam). |
| 4. Filter freshness | Keeps ads posted in the **last 14 days**. Unknown dates are dropped. |
| 5. Export | Readable shortlist in `data/exports/<id>/eligible.md` — **last 7 days** and **8–14 days** sections. |

## What it does **not** do

- **No auto-apply** — never fills applications or messages employers for you.
- **No Gemini for hunting** — scrapes and scoring stay local. Scraping never calls Gemini.
- **Not a magic placement agency** — it filters and ranks; you still read and apply.

## Who it’s for

- **Non-technical users** — follow [`START_HERE.md`](START_HERE.md): setup once, open the simple UI, upload a CV, pick a region.
- **Developers** — CLI + YAML config + optional Streamlit UI; product landing lives in [`frontend/`](frontend/) for [alfredterminal.xyz](https://alfredterminal.xyz).

## Preferences (easy YAML)

After analyze, edit:

`aspirants/<your-id>/preferences.yaml`

| File | Purpose |
| --- | --- |
| [`config/preferences.example.yaml`](config/preferences.example.yaml) | Commented template — copy and edit |
| `aspirants/<id>/preferences.yaml` | Your region, cities, seniority, remote/onsite, boards, excludes |
| [`config/regions/`](config/regions/) | Region packs used by hunt |

Example snippet:

```yaml
region: dubai
locations:
  - Dubai
  - UAE
seniority_band: junior
work_mode: any
use_jobspy: true
recency_max_days: 14
```

## Quick start (almost no AI)

```bash
./setup-once.sh
./.venv/bin/pip install python-jobspy   # optional; recommended for worldwide boards
./run.sh                               # Streamlit UI — CV scan is local
```

Or on Mac: double-click **`Open JobHunter.command`**.

| Goal | Command | AI? |
| --- | --- | --- |
| Open UI | `./run.sh` | No |
| Save CV profile | `./run.sh easy --resume cv.pdf --name "You" --region bangalore` | No |
| List regions | `./run.sh regions` | No |
| Polish profile once | add `--ai` | Tiny Flash call |
| Find jobs (fast) | `./run.sh easy-hunt --id your-name` | No |
| Full portal scan | `./run.sh hunt --id your-name --queries 1` | No |

Optional coaching chat (cheap model only if you want it):

```bash
agy --model gemini-3.5-flash-low --effort low --add-dir .
# /jobhunter /jobhunter-setup /jobhunter-hunt
```

## Product website (alfredterminal.xyz)

The [`frontend/`](frontend/) folder is a **Next.js** landing + app shell for the public product face. It does **not** replace the Python CLI.

```bash
cd frontend
npm install
npm run dev
# http://localhost:3000
```

Logo: [`docs/assets/logo.png`](docs/assets/logo.png) (also `frontend/public/logo.png`).

Deploy checklist for **https://alfredterminal.xyz** is in [`frontend/README.md`](frontend/README.md) (Vercel or Cloudflare Pages + DNS).

> Hosting clue: Alfredterminal historically was a separate FastAPI project; this JobHunter site targets a modern Next.js deploy (Vercel-friendly). Point the domain’s DNS at your host when ready.

## Scraper stack (by design)

- **Primary:** polite HTTP + BeautifulSoup + RSS + optional Firecrawl (existing adapters)
- **Worldwide boards:** optional [JobSpy](https://github.com/speedyapply/JobSpy) (`python-jobspy`)
- **UAE HTML boards:** still configured in `config/portals.yaml`
- **Not bundled:** Camoufox / DrissionPage (anti-bot / license constraints)

## Token policy

- **Default ≈ 0 Antigravity tokens** for analyze + hunt
- Gemini is **opt-in** (`--ai` or UI checkbox), Flash low + cache
- Re-read results from `data/exports/<id>/eligible.md` — don’t re-scrape to “check again”

## Project layout

```
JobHunter/
  aspirants/          # per-person profile + preferences
  config/regions/     # region packs
  src/                # Python pipeline, adapters, filters
  frontend/           # Next.js product site
  docs/assets/        # logo and docs media
  app.py              # Streamlit UI
  cli.py / run.sh     # CLI entrypoints
```

## License

See [`LICENSE`](LICENSE).

---

Built for real people hunting real jobs — from Dubai to Bangalore to remote — with clear limits and no dark patterns.
