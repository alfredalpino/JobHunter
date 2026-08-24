# How JobHunter works

## Big picture (one sentence)

You upload a CV → the app builds a local eligibility profile → it scrapes UAE job portals → it keeps only roles that match you **and** were posted in the last **7 or 8–14 days** → you get a simple list to apply yourself.

```
CV / LinkedIn  →  Local profile  →  Portal scrape  →  Filters  →  eligible.md
                     (fast)           (no AI)        (rules)
                          ↘ optional tiny Gemini polish (OFF by default)
```

## What uses Antigravity AI — and what does not

| Step | Uses AI? | Why |
| --- | --- | --- |
| Read PDF / build profile | **No** (default) | Local Python + regex — free & fast |
| Optional “polish profile” | **Yes, once** | Tiny Flash call via `agy` (~short CV snippet) |
| Scrape 40+ portals | **No** | HTTP / APIs / RSS / optional Firecrawl |
| Score & recency filter | **No** | Hard rules in code |
| Explain results in `/jobhunter` chat | Only if **you** chat with agy | You control that; scripts themselves don’t |

**Default path burns ~0 Antigravity tokens.**  
Hunt never calls Gemini.

## Token-saving rules (built in)

1. AI is **opt-in** (`--ai` or UI checkbox). Off by default.
2. When AI runs: model **`gemini-3.5-flash-low`**, `--effort low`, prompt capped (~2.4k chars total).
3. Same CV+draft → **disk cache** (`data/ai-cache/`) so re-runs don’t spend tokens again.
4. Slash skills tell the agent: run scripts, don’t re-paste whole CVs into long chats.

## Pipeline detail

1. **Profile** (`profile_cv` / LinkedIn public text)  
   Extracts name, titles, skills, certs, year band → `aspirants/<id>/profile.yaml`

2. **Hunt** (`pipeline` + portal adapters)  
   For each portal in `config/portals.yaml` (~75+ entries: Bayt, GulfTalent, Naukrigulf, LinkedIn, Dubizzle, Indeed UAE, major recruiters, remote boards, UAE employer careers…): API, RSS, HTML, or Firecrawl fallback → raw job list

3. **Filters**  
   - Hub/salary/course pages out  
   - Title/skills vs your profile  
   - Years cap (e.g. 0–3)  
   - Geo (UAE/GCC/remote; drop US-only)  
   - **Recency: ≤14 days; unknown dates rejected**

4. **Export**  
   `data/exports/<id>/eligible.md` with:
   - Eligible roles  
   - **Posted in the last 7 days** (bottom)  
   - **Posted 8–14 days ago** (bottom)

## Speed tips

```bash
./run.sh easy --resume cv.pdf --name "You"     # local only — seconds
./run.sh easy-hunt --id your-id                # quick APIs/RSS — ~10–30s
./run.sh hunt --id your-id --queries 1         # full portals — a few minutes
./run.sh easy --resume cv.pdf --ai             # optional Flash polish — once
```

## Antigravity chat (optional coaching)

```bash
agy --model gemini-3.5-flash-low --effort low --add-dir "$(pwd)"
# then /jobhunter-hunt
```

Prefer **Flash + low effort** for chat help. Use Pro only if you specifically want deeper advice — not for every hunt.
