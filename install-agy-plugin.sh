#!/usr/bin/env bash
# Install JobHunter as an Antigravity (agy) plugin → slash commands /jobhunter etc.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PLUGIN="$ROOT/antigravity-plugin"

if ! command -v agy >/dev/null 2>&1; then
  echo "Antigravity CLI (agy) was not found."
  echo "1) Install Antigravity from https://antigravity.google/"
  echo "2) Open Terminal and check: agy --version"
  echo "3) Run this script again."
  exit 1
fi

echo "Installing JobHunter plugin into Antigravity…"
agy plugin install "$PLUGIN"
echo ""
echo "Done. In any folder, start Antigravity CLI:"
echo "  agy --add-dir \"$ROOT\""
echo ""
echo "Then type one of these slash commands:"
echo "  /jobhunter"
echo "  /jobhunter-setup"
echo "  /jobhunter-hunt"
echo ""
echo "Tip: use Gemini Pro for smarter CV reading:"
echo "  agy --model gemini-3.1-pro-low --add-dir \"$ROOT\""
echo ""
