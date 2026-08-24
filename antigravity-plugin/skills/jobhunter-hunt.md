---
name: jobhunter-hunt
description: Run JobHunter scrape (no Gemini) and summarize fresh ≤14-day eligible jobs.
---

# JobHunter hunt

1. `./run.sh list` if id unknown
2. `./run.sh easy-hunt --id ASPIRANT_ID`  (no AI)
3. Read `data/exports/ASPIRANT_ID/eligible.md`
4. Summarize top matches + **last 7 days** vs **8–14 days**
5. If empty, offer `./run.sh hunt --id ASPIRANT_ID --queries 1` (still no Gemini)

Do not re-analyze the CV with Gemini during a hunt.
