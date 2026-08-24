---
name: jobhunter-setup
description: First-time JobHunter setup for a Dubai job aspirant (Python venv, optional agy plugin, smoke test).
---

# JobHunter setup

Speak in short steps. Assume the user is not technical.

1. Confirm Antigravity / `agy` is installed (`agy --version`). If missing, tell them to install Antigravity from https://antigravity.google/ and open a terminal once so `agy` is on PATH.
2. From the JobHunter folder run:

```bash
./setup-once.sh
./install-agy-plugin.sh
```

3. Ask for their **CV file** and optional **LinkedIn URL**.
4. Run:

```bash
./run.sh easy --resume "PATH_TO_CV" --name "THEIR NAME"
```

5. Tell them their aspirant id from the output, then:

```bash
./run.sh easy-hunt --id THAT_ID --quick
```

6. Open `data/exports/THAT_ID/eligible.md` and summarize matching jobs in plain English, grouped by last 7 days vs 8–14 days.

Use model `gemini-3.1-pro-low` when you need Gemini Pro reasoning via `agy -p`.
