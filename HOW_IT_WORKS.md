# How JobHunter works

## Big picture (one sentence)

You upload a CV → the app builds a local eligibility profile → you pick a **region** → it searches portals / JobSpy → it keeps only roles that match you **and** were posted in the last **7 or 8–14 days** → you get a simple list to apply yourself.

```
CV  →  Local profile + preferences.yaml  →  Scrape (no AI)  →  Filters  →  eligible.md
              ↘ optional tiny Gemini polish (OFF by default)
```

## Flow

1. **Analyze resume** — skills, titles, years, seniority, credibility (certs / projects)
2. **Ask region** — UI select box or `--region` / `preferences.yaml`
3. **Match** — titles + skill synonyms (not keyword spam)
4. **Seniority guardrails** — juniors never get senior/executive; strong juniors may see mid and below
5. **Recency** — ≤14 days; unknown dates rejected

## What uses Antigravity AI — and what does not

| Step | Uses AI? | Why |
| --- | --- | --- |
| Read PDF / build profile | **No** (default) | Local Python + regex — free & fast |
| Optional “polish profile” | **Yes, once** | Tiny Flash call via `agy` |
| Scrape portals / JobSpy | **No** | HTTP / APIs / RSS / optional Firecrawl / JobSpy |
| Score & recency filter | **No** | Hard rules in code |

**Default path burns ~0 Antigravity tokens.** Hunt never calls Gemini.

## Preferences

Edit `aspirants/<id>/preferences.yaml` (template: `config/preferences.example.yaml`).

## Speed tips

```bash
./run.sh easy --resume cv.pdf --name "You" --region usa
./run.sh easy-hunt --id your-id
./run.sh hunt --id your-id --queries 1
```
