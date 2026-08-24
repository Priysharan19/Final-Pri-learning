#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RUNS="${PRI_INK_V4_RUNS:-tools/ink-foundation/runs}"
CORPUS="${PRI_INK_V4_REAL_CORPUS:-client/test/ink-corpus-structural}"
SYNTH_CORPUS="${PRI_INK_V4_SYNTH_STRUCT:-/tmp/pri-ink-v4-synth-structural}"
SYNTH_BASE="${PRI_INK_V4_SYNTH_CHECKPOINT:-$RUNS/pri-ink-structural-v4-synthetic.pt}"
DEV_BASE="${PRI_INK_V4_DEV_CHECKPOINT:-$RUNS/pri-ink-structural-v4-dev.pt}"
SYNTH_VALIDITY="${PRI_INK_V4_SYNTH_VALIDITY:-$RUNS/pri-ink-v4-component-validity-synthetic.pt}"
DEV_VALIDITY="${PRI_INK_V4_DEV_VALIDITY:-$RUNS/pri-ink-v4-component-validity-dev.pt}"
BASELINE_REPORT="${PRI_INK_V4_VALIDITY_BASELINE_REPORT:-$RUNS/pri-ink-v4-dev-joint-before-validity.json}"
VALIDITY_REPORT="${PRI_INK_V4_VALIDITY_REPORT:-$RUNS/pri-ink-v4-dev-joint-with-validity.json}"
AB_REPORT="${PRI_INK_V4_VALIDITY_AB_REPORT:-$RUNS/pri-ink-v4-dev-component-validity-ab.json}"
DECODER="${PRI_INK_V4_VALIDITY_DECODER:-joint-auto}"
GENERAL_MAX="${PRI_INK_V4_GENERAL_MAX_STROKES:-14}"
MAX_GROUP="${PRI_INK_V4_MAX_GROUP_SIZE:-4}"
SYNTH_EPOCHS="${PRI_INK_V4_VALIDITY_SYNTH_EPOCHS:-12}"
DEV_EPOCHS="${PRI_INK_V4_VALIDITY_DEV_EPOCHS:-16}"
SYNTH_BATCH="${PRI_INK_V4_VALIDITY_SYNTH_BATCH:-24}"
DEV_BATCH="${PRI_INK_V4_VALIDITY_DEV_BATCH:-8}"
MAX_NEGATIVES="${PRI_INK_V4_VALIDITY_MAX_NEGATIVES:-32}"
VALIDITY_WEIGHT="${PRI_INK_V4_VALIDITY_WEIGHT:-1.0}"

mkdir -p "$RUNS"

case "$DECODER" in
  joint|joint-general|joint-auto) ;;
  *)
    echo "component validity requires a joint decoder; got: $DECODER" >&2
    exit 2
    ;;
esac

for path in "$SYNTH_BASE" "$DEV_BASE"; do
  if [[ ! -f "$path" ]]; then
    echo "missing V4 checkpoint: $path" >&2
    echo "Run: npm run ink:structure:rebuild:dev" >&2
    exit 2
  fi
done

if [[ ! -d "$SYNTH_CORPUS" ]]; then
  echo "missing exact synthetic structural corpus: $SYNTH_CORPUS" >&2
  echo "The clean dev rebuild creates it. Run: npm run ink:structure:rebuild:dev" >&2
  exit 2
fi

if [[ ! -d "$CORPUS" ]]; then
  echo "missing private structural corpus: $CORPUS" >&2
  exit 2
fi

# Fail before training if the two base checkpoints or the frozen development
# protocol are stale. This script is intentionally same-writer development only;
# it never accesses the locked final holdout and never creates production evidence.
python3 - "$SYNTH_BASE" "$DEV_BASE" <<'PY'
import sys, torch
synth_path, dev_path = sys.argv[1:3]
synth = torch.load(synth_path, map_location='cpu', weights_only=False)
dev = torch.load(dev_path, map_location='cpu', weights_only=False)
assert synth.get('architecture_version') == 4
assert synth.get('stage') == 'structural-synthetic-pretrain'
assert synth.get('synthetic_pretraining') is True
assert synth.get('production_ready') is False
assert dev.get('architecture_version') == 4
assert dev.get('stage') == 'structural-research-dev'
assert dev.get('production_ready') is False
split = dev.get('dev_split') or {}
assert split.get('protocol') == 'same-writer-dev-holdout'
assert split.get('writerDisjoint') is False
assert split.get('productionEvidence') is False
print(
    'Frozen dev protocol: '
    f"writer={split.get('writer')} train={split.get('trainSamples')} "
    f"validation={split.get('validationSamples')}"
)
print('synthetic base provenance: structural-synthetic-pretrain')
print('writer-disjoint: false · production evidence: false')
PY

python3 tools/ink-foundation/test_structural_component_validity.py
python3 tools/ink-foundation/audit_structural.py "$CORPUS" --require-all
python3 tools/ink-foundation/audit_structural.py "$SYNTH_CORPUS" --require-all

rm -f \
  "$SYNTH_VALIDITY" "${SYNTH_VALIDITY%.pt}.json" \
  "$DEV_VALIDITY" "${DEV_VALIDITY%.pt}.json" \
  "$BASELINE_REPORT" "$VALIDITY_REPORT" "$AB_REPORT"

echo
echo "Pri Ink V4 component-validity V2 — PRIVATE FROZEN DEV EXPERIMENT"
echo "same-writer development only · NEVER production evidence"
echo "decoder=$DECODER generalMaxStrokes=$GENERAL_MAX maxGroupSize=$MAX_GROUP"

echo
echo "1/5 Train rejection preconditioner on exact synthetic writer-disjoint data"
PYTORCH_ENABLE_MPS_FALLBACK=1 python3 tools/ink-foundation/train_component_validity.py \
  "$SYNTH_BASE" \
  --corpus "$SYNTH_CORPUS" \
  --out "$SYNTH_VALIDITY" \
  --mode writer-disjoint \
  --epochs "$SYNTH_EPOCHS" \
  --batch "$SYNTH_BATCH" \
  --max-group-size "$MAX_GROUP" \
  --max-negatives "$MAX_NEGATIVES" \
  --patience 5

test -f "$SYNTH_VALIDITY"

echo
echo "2/5 Transfer + fine-tune validity on the frozen real-Pencil DEV TRAIN subset"
PYTORCH_ENABLE_MPS_FALLBACK=1 python3 tools/ink-foundation/train_component_validity.py \
  "$DEV_BASE" \
  --corpus "$CORPUS" \
  --out "$DEV_VALIDITY" \
  --mode same-writer-dev \
  --init-validity "$SYNTH_VALIDITY" \
  --allow-base-transfer \
  --epochs "$DEV_EPOCHS" \
  --batch "$DEV_BATCH" \
  --max-group-size "$MAX_GROUP" \
  --max-negatives "$MAX_NEGATIVES" \
  --patience 6

test -f "$DEV_VALIDITY"

echo
echo "3/5 Evaluate frozen base + joint search WITHOUT validity"
PYTORCH_ENABLE_MPS_FALLBACK=1 python3 tools/ink-foundation/evaluate_structural_dev.py \
  "$DEV_BASE" \
  --corpus "$CORPUS" \
  --decoder "$DECODER" \
  --max-group-size "$MAX_GROUP" \
  --general-max-strokes "$GENERAL_MAX" \
  --out "$BASELINE_REPORT"

echo
echo "4/5 Evaluate the IDENTICAL frozen base/search WITH validity"
PYTORCH_ENABLE_MPS_FALLBACK=1 python3 tools/ink-foundation/evaluate_structural_dev.py \
  "$DEV_BASE" \
  --corpus "$CORPUS" \
  --decoder "$DECODER" \
  --max-group-size "$MAX_GROUP" \
  --general-max-strokes "$GENERAL_MAX" \
  --component-validity "$DEV_VALIDITY" \
  --component-validity-weight "$VALIDITY_WEIGHT" \
  --out "$VALIDITY_REPORT"

echo
echo "5/5 Evidence-safe same-base A/B"
python3 tools/ink-foundation/compare_component_validity.py \
  "$BASELINE_REPORT" "$VALIDITY_REPORT" --out "$AB_REPORT"

python3 - "$DEV_VALIDITY" "$BASELINE_REPORT" "$VALIDITY_REPORT" "$AB_REPORT" <<'PY'
import json, sys, torch
from pathlib import Path
validity_path, before_path, after_path, ab_path = map(Path, sys.argv[1:5])
validity = torch.load(validity_path, map_location='cpu', weights_only=False)
before = json.loads(before_path.read_text())
after = json.loads(after_path.read_text())
ab = json.loads(ab_path.read_text())

assert validity.get('production_ready') is False
assert validity.get('stage') == 'component-validity-research-dev'
assert (validity.get('validation_protocol') or {}).get('writerDisjoint') is False
assert before.get('productionReady') is False and after.get('productionReady') is False
assert before.get('checkpointSha256') == after.get('checkpointSha256')
assert before.get('decoder') == after.get('decoder')
assert before.get('validationProtocol') == after.get('validationProtocol')
assert (before.get('jointPartition') or {}).get('actualSearchRegimes') == \
       (after.get('jointPartition') or {}).get('actualSearchRegimes')
assert (after.get('componentValidity') or {}).get('baseCheckpointSha256') == before.get('checkpointSha256')
assert ab.get('productionReady') is False

vm = validity.get('validation') or {}
print('\nPri Ink V4 component-validity frozen-dev result')
print(f"validity AUC: {100*vm.get('auc', 0):.2f}%")
print(f"validity balanced accuracy: {100*vm.get('balancedAccuracy', 0):.2f}%")
print(f"hard-negative reject rate: {100*vm.get('hardNegativeRejectRate', 0):.2f}%")
print(f"exact expression: {100*before.get('exactExpressionAccuracy', 0):.2f}% -> {100*after.get('exactExpressionAccuracy', 0):.2f}%")
print(f"CER: {100*before.get('characterErrorRate', 0):.2f}% -> {100*after.get('characterErrorRate', 0):.2f}%")
print(f"safe precision: {100*before.get('safePrecision', 0):.2f}% -> {100*after.get('safePrecision', 0):.2f}%")
print(f"coverage: {100*before.get('coverage', 0):.2f}% -> {100*after.get('coverage', 0):.2f}%")
print('regressions: ' + (', '.join(ab.get('regressions') or []) or 'none in reported metrics'))
print('writer-disjoint: false')
print('production ready: false')
PY

echo
echo "Reports:"
echo "  validity checkpoint: $DEV_VALIDITY"
echo "  before:             $BASELINE_REPORT"
echo "  after:              $VALIDITY_REPORT"
echo "  A/B:                $AB_REPORT"
