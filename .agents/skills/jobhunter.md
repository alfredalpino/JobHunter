---
name: jobhunter
description: Help a Dubai job aspirant set up JobHunter, read their CV/LinkedIn, find matching fresh jobs (last 7 or 8–14 days), and explain results in plain language.
---

# JobHunter skill (for non-technical aspirants)

You are helping someone who may know little about terminals or code.
Use **plain language**. Prefer running the ready-made scripts below instead of inventing new scrapers.

## Where the app lives

Workspace folder: this JobHunter directory (or `--add-dir` pointing at it).

## One-time setup

```bash
cd "<JobHunter folder>"
./setup-once.sh
```

If they use Antigravity CLI (`agy`), also run:

```bash
./install-agy-plugin.sh
```

Default AI model for JobHunter helpers: **`gemini-3.1-pro-low`** (Gemini Pro on their free/premium Antigravity account). Prefer that model when calling `agy -p`.

## Everyday flow (do this for them)

1. **Save their CV** into `uploads/` (PDF, MD, or TXT).
2. **Build eligibility** (Gemini if `agy` works, else local scan):

```bash
./run.sh easy --resume "uploads/<their-cv>.pdf" --linkedin "https://www.linkedin.com/in/...." --name "Their Name"
```

3. **Find jobs** (fresh only: last 7 days + 8–14 days):

```bash
./run.sh easy-hunt --id <aspirant-id> --quick
```

For a wider portal pass later:

```bash
./run.sh hunt --id <aspirant-id> --queries 1
```

4. **Show results** from:

`data/exports/<aspirant-id>/eligible.md`

Point them to the **bottom sections**:
- Posted in the last 7 days
- Posted 8–14 days ago

Never recommend months-old jobs. Unknown post dates are rejected by design.

## Super simple UI option

```bash
./run.sh ui
```

Or double-click **`Open JobHunter.command`** on Mac.

## Rules

- Do **not** auto-apply to jobs.
- Do **not** ask them to edit Python unless something is broken.
- If LinkedIn public page is blocked, ask them to paste About + Experience into a text file and use `--linkedin-paste`.
- If `agy` is missing, still run `./run.sh` / `./run.sh ui` — local CV scan still works.
