#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RUNS="tools/ink-foundation/runs"
SYNTH="$RUNS/pri-ink-structural-v4-synthetic.pt"
DEV="$RUNS/pri-ink-structural-v4-dev.pt"
REPORT="$RUNS/pri-ink-structural-v4-dev-validation.json"

mkdir -p "$RUNS"

# Old checkpoints are intentionally incompatible after the group-aware symbol
# head was added. Remove them up front so an interrupted run can never make the
# evaluator silently read stale V4 weights/reporting.
rm -f \
  "$SYNTH" "$RUNS/pri-ink-structural-v4-synthetic.json" \
  "$DEV" "$RUNS/pri-ink-structural-v4-dev.json" \
  "$REPORT"

echo "Pri Ink V4 clean development rebuild"
echo "1/3 exact synthetic pretraining"
PYTORCH_ENABLE_MPS_FALLBACK=1 npm run ink:structure:pretrain:dev

test -f "$SYNTH"

echo
echo "2/3 same-writer P0001 fine-tuning"
PYTORCH_ENABLE_MPS_FALLBACK=1 npm run ink:structure:train:dev:pretrained

test -f "$DEV"

echo
echo "3/3 same-writer development evaluation"
PYTORCH_ENABLE_MPS_FALLBACK=1 npm run ink:structure:evaluate:dev

test -f "$REPORT"

echo
echo "V4 clean dev rebuild complete"
echo "report: $REPORT"
python3 - <<'PY'
import json
from pathlib import Path
p = Path('tools/ink-foundation/runs/pri-ink-structural-v4-dev-validation.json')
d = json.loads(p.read_text())
print(f"exact expression: {100*d.get('exactExpressionAccuracy', 0):.2f}%")
print(f"CER: {100*d.get('characterErrorRate', 0):.2f}%")
print(f"oracle-group symbol: {100*d.get('oracleGroupingGlyphSymbolAccuracy', 0):.2f}%")
print(f"coverage: {100*d.get('coverage', 0):.2f}%")
print('production ready: false')
PY
