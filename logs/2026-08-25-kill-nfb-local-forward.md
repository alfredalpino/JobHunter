# Kill NFB local port hijack; JobHunter owns 3000

Date: 2026-08-25

## Root cause
User never started NFB locally. **Cursor SSH remote** to host `frontier` (201.7.16.121) was auto-forwarding the remote NFB dev server onto **localhost:3000**.

Evidence: `ssh -T -D 60062 frontier` PIDs 71112/71114 from `cursor_remote_install_*.sh`.

## Actions
1. Killed frontier SSH port-forward session (71112, 71114).
2. JobHunter `npm run dev` restored to **port 3000**.
3. Frontier-Bakery local dev moved to **3100** (not deployed locally by default).
4. Cursor user + JobHunter workspace settings: `remote.autoForwardPorts: false`, port 3000 `onAutoForward: ignore`.

## Local dev
- JobHunter only: http://127.0.0.1:3000
- Close any Cursor window connected to SSH host `frontier` if NFB reappears on 3000.
