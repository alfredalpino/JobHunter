# Branch split: main = web, cli-local = CLI

Date: 2026-08-25

## Actions
1. Created and pushed `cli-local` from pre-split commit `41744dc` (full Python CLI + `frontend/` monorepo).
2. On `main`, removed CLI surface (`run.sh`, `cli.py`, Python `src/`, etc.).
3. Hoisted Next.js app from `frontend/` to repository root.
4. Fixed `config/regions` and `data/ai-cache` paths for root cwd.
5. README / AGENTS.md now declare web as primary and point CLI users to `cli-local`.

## Checkout CLI later
```bash
git checkout cli-local
```
