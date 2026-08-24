# START HERE — JobHunter (Dubai jobs)

You do **not** need to be a programmer.

## Fastest way (Mac) — no AI credits used

1. Run once: `./setup-once.sh`
2. Double-click **`Open JobHunter.command`**
3. In the browser:
   - Upload your CV
   - Click **Analyze my profile** (leave Gemini checkbox **off**)
   - Click **Find matching jobs**
   - Read results (only last **1–2 weeks**)

## Optional: Antigravity coaching (`agy`)

Only if you want Gemini to *talk you through* results — hunting itself stays local/fast.

```bash
./install-agy-plugin.sh
agy --model gemini-3.5-flash-low --effort low --add-dir "$(pwd)"
```

Type `/jobhunter` or `/jobhunter-hunt`.

Optional one-time CV polish (uses a little credit):

```bash
./run.sh easy --resume your.pdf --name "Your Name" --ai
```

## Fresh jobs only

| Posted | Shown as |
| --- | --- |
| Last 7 days | **Posted in the last 7 days** |
| 8–14 days ago | **Posted 8–14 days ago** |
| Older / no date | Hidden |

## How it works

See [`HOW_IT_WORKS.md`](HOW_IT_WORKS.md) — short diagram + what uses AI vs what doesn’t.
