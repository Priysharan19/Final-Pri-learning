#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RUNS="${PRI_INK_V4_RUNS:-tools/ink-foundation/runs}"
CORPUS="${PRI_INK_V4_REAL_CORPUS:-client/test/ink-corpus-structural}"
DEV_BASE="${PRI_INK_V4_DEV_CHECKPOINT:-$RUNS/pri-ink-structural-v4-dev.pt}"
DEV_VALIDITY="${PRI_INK_V4_DEV_VALIDITY:-$RUNS/pri-ink-v4-component-validity-dev.pt}"
DEV_REL="${PRI_INK_V4_DEV_GROUP_RELATIONS:-$RUNS/pri-ink-v4-group-relations-dev.pt}"
NO_VALIDITY_REPORT="${PRI_INK_V4_FACTORIAL_NO_VALIDITY:-$RUNS/pri-ink-v4-dev-factorial-no-validity.json}"
WITH_VALIDITY_REPORT="${PRI_INK_V4_FACTORIAL_WITH_VALIDITY:-$RUNS/pri-ink-v4-dev-factorial-with-validity.json}"
FACTORIAL_REPORT="${PRI_INK_V4_FACTORIAL_REPORT:-$RUNS/pri-ink-v4-dev-factorial.json}"
DECODER="${PRI_INK_V4_CANDIDATE_DECODER:-joint-auto}"

# The prerequisite runners train/fine-tune only on their frozen DEV TRAIN split.
# They never unlock the final holdout and preserve raw handwriting locally.
bash scripts/ink-structural-component-validity-dev.sh
bash scripts/ink-structural-group-relations-dev.sh

for path in "$DEV_BASE" "$DEV_VALIDITY" "$DEV_REL"; do
  if [[ ! -f "$path" ]]; then
    echo "missing candidate asset after prerequisite runner: $path" >&2
    exit 2
  fi
done

rm -f "$NO_VALIDITY_REPORT" "$WITH_VALIDITY_REPORT" "$FACTORIAL_REPORT"

echo
echo "Pri Ink V4 combined candidate — PRIVATE FROZEN DEV FACTORIAL"
echo "same-writer development only · NEVER production evidence"

echo "1/3 Baseline vs pooled relations, component validity OFF"
PYTORCH_ENABLE_MPS_FALLBACK=1 python3 tools/ink-foundation/evaluate_group_relations.py \
  "$DEV_BASE" "$DEV_REL" --corpus "$CORPUS" --mode same-writer-dev \
  --decoder "$DECODER" --out "$NO_VALIDITY_REPORT"

echo
echo "2/3 Validity-only vs combined validity + pooled relations"
PYTORCH_ENABLE_MPS_FALLBACK=1 python3 tools/ink-foundation/evaluate_group_relations.py \
  "$DEV_BASE" "$DEV_REL" --corpus "$CORPUS" --mode same-writer-dev \
  --decoder "$DECODER" --component-validity "$DEV_VALIDITY" \
  --out "$WITH_VALIDITY_REPORT"

echo
echo "3/3 Exact-same-base 2x2 evidence comparison"
python3 tools/ink-foundation/compare_structural_factorial.py \
  "$NO_VALIDITY_REPORT" "$WITH_VALIDITY_REPORT" --out "$FACTORIAL_REPORT"

python3 - "$FACTORIAL_REPORT" <<'PY'
import json, sys
from pathlib import Path
d = json.loads(Path(sys.argv[1]).read_text())
assert d.get('productionReady') is False
protocol = d.get('validationProtocol') or {}
assert protocol.get('writerDisjoint') is False
assert protocol.get('productionEvidence') is False
print('writer-disjoint: false')
print('production ready: false')
PY

echo "factorial report: $FACTORIAL_REPORT"
