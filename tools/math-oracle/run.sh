#!/usr/bin/env bash
# Pri Learning · SymPy differential oracle — one reproducible run.
#   tools/math-oracle/run.sh [draws] [outdir]
# Writes docs/evidence/sympy-oracle-<date>.{md,json} unless outdir is given.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
DRAWS="${1:-2}"; DATE="$(date +%Y-%m-%d)"
OUT="${2:-$ROOT/docs/evidence}"; WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
PY="$HERE/.venv/bin/python"
if [ ! -x "$PY" ]; then python3 -m venv "$HERE/.venv"; "$HERE/.venv/bin/pip" install -q --require-hashes -r "$HERE/requirements.txt"; fi
node "$HERE/driver.mjs" dump --draws="$DRAWS" --out="$WORK/questions.jsonl"
"$PY" "$HERE/oracle.py" candidates "$WORK/questions.jsonl" --out="$WORK/candidates.jsonl"
node "$HERE/driver.mjs" mark --in="$WORK/candidates.jsonl" --out="$WORK/verdicts.jsonl"
"$PY" - "$WORK" "$DRAWS" "$DATE" <<'PY'
import json, sys, platform, subprocess, sympy
w, draws, date = sys.argv[1:4]
commit = subprocess.run(['git', 'rev-parse', '--short=9', 'HEAD'], capture_output=True, text=True).stdout.strip()
dirty = subprocess.run(['git', 'status', '--porcelain', '--', 'client/src/engine'], capture_output=True, text=True).stdout.strip()
json.dump({'date': date, 'commit': commit + ('+engine-dirty' if dirty else ''), 'sympy': sympy.__version__, 'python': platform.python_version(),
           'draws': int(draws), 'skipped': json.load(open(f'{w}/questions.skipped.json'))}, open(f'{w}/meta.json', 'w'))
PY
"$PY" "$HERE/oracle.py" judge "$WORK/questions.jsonl" "$WORK/candidates.jsonl" "$WORK/verdicts.jsonl" \
  --meta="$WORK/meta.json" --json="$OUT/sympy-oracle-$DATE.json" --md="$OUT/sympy-oracle-$DATE.md" ${ORACLE_STRICT:+--strict}
