#!/usr/bin/env bash
# הרצת ג'ארוויס במק או לינוקס.
set -e
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null; then
  echo "פייתון 3 לא מותקן. הורד מ- https://www.python.org/downloads/"
  exit 1
fi

[ -d data/demo ] || python3 data/generate_demo.py
echo
echo "פתח בדפדפן:  http://127.0.0.1:8765"
echo
exec python3 agent/main.py
