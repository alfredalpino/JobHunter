---
name: jobhunter
description: Help a Dubai job aspirant use JobHunter with minimal Antigravity tokens. Prefer local scripts; never use Gemini for scraping.
---

# JobHunter (token-thrifty)

Speak plainly. Prefer scripts over long AI analysis.

## Token rules

- **Never** call Gemini to scrape or score jobs. Run `./run.sh easy-hunt` / `./run.sh hunt`.
- Profile: local by default (`./run.sh easy --resume …`). Add `--ai` only if the user asks.
- Chat model if needed: `gemini-3.5-flash-low` + `--effort low`.
- Read results from `data/exports/<id>/eligible.md` — don’t re-hunt unless asked.

## Setup (once)

```bash
./setup-once.sh
./install-agy-plugin.sh   # optional
```

## Everyday

```bash
./run.sh easy --resume "uploads/cv.pdf" --name "Name"
./run.sh easy-hunt --id <aspirant-id>
```

Summarize the **last 7 days** and **8–14 days** sections at the bottom of the export. Older jobs are intentionally excluded.
