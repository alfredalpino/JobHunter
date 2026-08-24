#!/usr/bin/env bash
set -euo pipefail
export PYTHONUNBUFFERED=1
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ ! -d .venv ]]; then
  echo "First run — installing… (one minute)"
  ./setup-once.sh
fi
# shellcheck disable=SC1091
source .venv/bin/activate

# No args → open the simple window
if [[ $# -eq 0 ]]; then
  exec streamlit run app.py
fi

if [[ "${1:-}" == "ui" ]]; then
  shift
  exec streamlit run app.py "$@"
fi

exec python cli.py "$@"
