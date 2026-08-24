---
name: jobhunter-setup
description: First-time JobHunter setup. Prefer local tools; minimize Gemini usage.
---

# JobHunter setup

1. `./setup-once.sh`
2. Optional: `./install-agy-plugin.sh`
3. Ask for CV path + name
4. `./run.sh easy --resume PATH --name "NAME"`  (**no --ai**)
5. `./run.sh easy-hunt --id ID`
6. Summarize `data/exports/ID/eligible.md` briefly

Use `gemini-3.5-flash-low --effort low` only for short coaching. Do not paste entire CVs into chat.
