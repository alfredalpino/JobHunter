---
name: jobhunter-hunt
description: Run a JobHunter scrape for an existing aspirant and summarize only fresh (≤14 day) eligible Dubai/UAE jobs.
---

# JobHunter hunt

1. Ask which aspirant id to use, or run `./run.sh list`.
2. Prefer a quick hunt first:

```bash
./run.sh easy-hunt --id ASPIRANT_ID --quick
```

3. Read `data/exports/ASPIRANT_ID/eligible.md`.
4. Summarize for the user:
   - How many matches
   - Top 5 with title, company, age (days), apply link
   - Separate **last 7 days** vs **8–14 days**
5. Remind them: older than 2 weeks were dropped on purpose; they should apply to the newest ones first.

If no matches, say so calmly and offer a full portal pass:

```bash
./run.sh hunt --id ASPIRANT_ID --queries 1
```
