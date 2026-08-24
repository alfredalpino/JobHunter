#!/bin/bash
# Double-click this file on a Mac to open the simple JobHunter window.
cd "$(dirname "$0")"
osascript -e 'tell application "Terminal" to do script "cd \"'"$(pwd)"'\" && ./setup-once.sh && source .venv/bin/activate && streamlit run app.py"'
