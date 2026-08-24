#!/usr/bin/env bash
# One-time setup for non-technical users. Safe to run again.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo ""
echo "===================================="
echo "  JobHunter — first-time setup"
echo "===================================="
echo ""

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is missing. On a Mac: install from https://www.python.org/downloads/ then run this again."
  exit 1
fi

echo "1/3  Creating a private tools folder (.venv)…"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
echo "2/3  Installing JobHunter packages…"
pip install -q -r requirements.txt

echo "3/3  Checking Antigravity CLI (agy)…"
if command -v agy >/dev/null 2>&1; then
  echo "    Found: $(agy --version 2>/dev/null || echo agy)"
  echo "    Gemini Pro models available through your Antigravity account."
else
  echo "    agy not found yet — JobHunter still works without it."
  echo "    Optional: install Antigravity from https://antigravity.google/ then run ./install-agy-plugin.sh"
fi

mkdir -p uploads aspirants data/exports data/raw
chmod +x run.sh setup-once.sh install-agy-plugin.sh "Open JobHunter.command" 2>/dev/null || true

echo ""
echo "Setup finished."
echo ""
echo "Next (pick one):"
echo "  • Double-click:  Open JobHunter.command"
echo "  • Or terminal:   ./run.sh ui"
echo "  • Or with AI:    ./install-agy-plugin.sh   then open Antigravity and type /jobhunter"
echo ""
