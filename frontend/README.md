# JobHunter web — alfredterminal.xyz

Next.js (App Router) product site for **JobHunter** by **Alfredterminal**.

- Landing: brand-first hero, how it works, preferences explainer
- App shell: Analyze resume + Prefer region (API stubs)
- Does **not** replace `./run.sh` / Streamlit — Python CLI remains the hunting engine

## Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS v4
- Fonts: Fraunces (display) + Outfit (UI)
- Deploy target: Vercel (also works on Cloudflare Pages with Next adapter)

## Local run

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Path | Purpose |
| --- | --- |
| `/` | Landing |
| `/app` | App shell CTAs |
| `/api/health` | Health JSON |
| `/api/regions` | Region pack list (mirrors `config/regions/`) |
| `/api/analyze` | Stub — documents CLI bridge; does not parse CVs yet |

```bash
npm run build
npm start
```

## Logo

- `public/logo.png` — site favicon / header
- Repo copy: `../docs/assets/logo.png`

## Deploy to https://alfredterminal.xyz

No prior JobHunter-specific DNS config was found in sibling trees; AlfredTerminal historically was FastAPI. Use this checklist:

### A. Vercel (recommended)

1. Push the `frontend` branch (or monorepo root) to GitHub (`alfredalpino/JobHunter`).
2. In [Vercel](https://vercel.com): **Add New Project** → import `JobHunter`.
3. Set **Root Directory** to `frontend`.
4. Framework: Next.js (auto). Build: `npm run build`. Output: default.
5. Deploy a preview, confirm `/` and `/api/health`.
6. **Domains** → add `alfredterminal.xyz` and `www.alfredterminal.xyz`.
7. At your DNS host, add the records Vercel shows (usually `A` / `CNAME`).
8. Wait for TLS; set primary domain to apex or www.

### B. Cloudflare Pages

1. Connect the same GitHub repo.
2. Root directory: `frontend`.
3. Use Cloudflare’s Next.js support (OpenNext / `@cloudflare/next-on-pages` as required by current CF docs).
4. Attach custom domain `alfredterminal.xyz` in Cloudflare.

### DNS checklist

- [ ] Apex `alfredterminal.xyz` points at host (A/ALIAS/CNAME per provider)
- [ ] `www` CNAME to host or apex
- [ ] HTTPS certificate issued
- [ ] `/api/health` returns JSON in production
- [ ] Open Graph image loads (`/logo.png`)

### Later: connect Python hunt

Wire a secured backend (not committed secrets) that:

1. Accepts resume upload + region
2. Invokes the same logic as `./run.sh easy` / `easy-hunt` (subprocess or shared package)
3. Returns `eligible.md` / JSON

Until then, the site CTAs point people at the local CLI. **No auto-apply** in either path.

## Env

None required for the static product shell. Future API keys belong in host secrets — never in git.
