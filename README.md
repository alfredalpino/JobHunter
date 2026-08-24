# JobHunter

<p align="center">
  <img src="docs/assets/logo.png" alt="JobHunter logo" width="120" height="120" />
</p>

<p align="center">
  <strong>Fresh jobs. Your resume. Your move.</strong><br />
  Resume-first worldwide job filter by <a href="https://alfredterminal.xyz">Alfredterminal</a>.<br />
  <em>No auto-apply. You decide what to send.</em>
</p>

---

## Primary product (this branch)

**`main` is the Next.js web app** — analyze a resume, set preferences, hunt fresh roles in the browser.

```bash
npm install
npm run dev -- -p 3000 -H 127.0.0.1
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) · operable app at [/app](http://127.0.0.1:3000/app) · API status at [/status](http://127.0.0.1:3000/status).

| Path | Purpose |
| --- | --- |
| `/` | Marketing landing |
| `/app` | Operable hunt wizard |
| `/status` | Live API readiness / uptime |
| `/api/health` | Liveness JSON |
| `/api/status` | Aggregated probe report |

## CLI / local Python tool

The original CLI (`./run.sh`, JobSpy, aspirant profiles, exports) lives on the **`cli-local`** branch:

```bash
git fetch origin
git checkout cli-local
./setup-once.sh
./run.sh ui
```

## What it does

1. Analyze resume → local eligibility profile (optional AI polish)
2. Region packs + preferences (date window, seniority, skills)
3. Fetch public job APIs + TypeScript eligibility (≤14-day freshest by default)
4. Today’s queue · mark applied · export markdown — **no auto-apply**

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Vitest

## License

See [LICENSE](LICENSE).
