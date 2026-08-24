# JobHunter — Dubai jobs for everyone

**Not a programmer?** Open [`START_HERE.md`](START_HERE.md) · [`HOW_IT_WORKS.md`](HOW_IT_WORKS.md)

## 3-step setup (fast, almost no AI)

```bash
./setup-once.sh
./run.sh          # simple website — CV scan is local
```

Or double-click **`Open JobHunter.command`**.

## Token policy

- **Default = 0 Antigravity tokens** for analyze + hunt  
- Gemini is **opt-in** (`--ai` or UI checkbox), uses **Flash low** + cache  
- Job scraping **never** calls Gemini  
- Portal list: **~78 active boards** (Bayt, GulfTalent, Naukrigulf, LinkedIn, Dubizzle, Indeed, Hays, Michael Page, Emirates/ADNOC careers, remote APIs, …) in `config/portals.yaml`

## Antigravity chat (optional coaching)

```bash
./install-agy-plugin.sh
agy --model gemini-3.5-flash-low --effort low --add-dir "$(pwd)"
```

Slash commands: `/jobhunter` · `/jobhunter-setup` · `/jobhunter-hunt`

## Commands

| Goal | Command | AI? |
| --- | --- | --- |
| Open UI | `./run.sh` | No |
| Save CV profile | `./run.sh easy --resume cv.pdf --name "You"` | No |
| Polish profile once | add `--ai` | Tiny Flash call |
| Find jobs (fast) | `./run.sh easy-hunt --id your-name` | No |
| Full portal scan | `./run.sh hunt --id your-name --queries 1` | No |

## Fresh jobs only

`data/exports/<id>/eligible.md` — bottom sections for **last 7 days** and **8–14 days**. Older ads dropped.
