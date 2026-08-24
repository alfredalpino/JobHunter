# JobHunter — agent instructions (Antigravity / Cursor / agy)

This folder is a **worldwide job hunt / filter tool** (resume-first, region packs, ≤14-day recency). Prefer **speed and low token use**.

## Token policy (strict)

1. **Do not call Gemini for scraping or scoring.** Run `./run.sh easy-hunt` / `./run.sh hunt` only.
2. Profile building is **local by default**. Only use `--ai` if the user explicitly asks to polish with AI.
3. When AI is needed: model **`gemini-3.5-flash-low`**, `--effort low`, one short turn. Never paste a full multi-page CV into a long chat — point the user at scripts.
4. Re-reading results: open `data/exports/<id>/eligible.md` (file), don’t re-scrape.
5. Cache: AI refinements land in `data/ai-cache/` — don’t force re-runs.

## Everyday commands

```bash
./setup-once.sh
./run.sh ui
./run.sh easy --resume "uploads/cv.pdf" --name "Name" --region dubai   # no AI
./run.sh easy-hunt --id <id>                                          # no AI
./run.sh regions
```

Optional polish (costs a little credit, once):

```bash
./run.sh easy --resume "uploads/cv.pdf" --name "Name" --region india --ai
```

Chat helper (cheap model):

```bash
agy --model gemini-3.5-flash-low --effort low --add-dir .
# /jobhunter /jobhunter-setup /jobhunter-hunt
```

## Hard product rules

- Recency max **14 days**; reject unknown dates.
- Bottom of export: last 7 days + 8–14 days sections.
- No auto-apply. Speak plainly.
- Preferences: `aspirants/<id>/preferences.yaml` + `config/regions/`.
