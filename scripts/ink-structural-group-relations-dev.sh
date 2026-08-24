#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RUNS="${PRI_INK_V4_RUNS:-tools/ink-foundation/runs}"
CORPUS="${PRI_INK_V4_REAL_CORPUS:-client/test/ink-corpus-structural}"
SYNTH_CORPUS="${PRI_INK_V4_SYNTH_STRUCT:-/tmp/pri-ink-v4-synth-structural}"
SYNTH_BASE="${PRI_INK_V4_SYNTH_CHECKPOINT:-$RUNS/pri-ink-structural-v4-synthetic.pt}"
DEV_BASE="${PRI_INK_V4_DEV_CHECKPOINT:-$RUNS/pri-ink-structural-v4-dev.pt}"
SYNTH_REL="${PRI_INK_V4_SYNTH_GROUP_RELATIONS:-$RUNS/pri-ink-v4-group-relations-synthetic.pt}"
DEV_REL="${PRI_INK_V4_DEV_GROUP_RELATIONS:-$RUNS/pri-ink-v4-group-relations-dev.pt}"
REPORT="${PRI_INK_V4_GROUP_RELATION_REPORT:-$RUNS/pri-ink-v4-dev-group-relation-ab.json}"
DECODER="${PRI_INK_V4_RELATION_DECODER:-joint-auto}"
SYNTH_EPOCHS="${PRI_INK_V4_GROUP_REL_SYNTH_EPOCHS:-12}"
DEV_EPOCHS="${PRI_INK_V4_GROUP_REL_DEV_EPOCHS:-16}"

mkdir -p "$RUNS"
for path in "$SYNTH_BASE" "$DEV_BASE"; do
  if [[ ! -f "$path" ]]; then
    echo "missing V4 checkpoint: $path" >&2
    echo "Run: npm run ink:structure:rebuild:dev" >&2
    exit 2
  fi
done
for dir in "$SYNTH_CORPUS" "$CORPUS"; do
  if [[ ! -d "$dir" ]]; then
    echo "missing structural corpus: $dir" >&2
    exit 2
  fi
done

python3 - "$SYNTH_BASE" "$DEV_BASE" <<'PY'
import sys, torch
synth = torch.load(sys.argv[1], map_location='cpu', weights_only=False)
dev = torch.load(sys.argv[2], map_location='cpu', weights_only=False)
assert synth.get('architecture_version') == 4
assert synth.get('production_ready') is False
if synth.get('stage') == 'structural-synthetic-pretrain':
    assert synth.get('synthetic_pretraining') is True
else:
    assert synth.get('stage') == 'structural-research'
assert dev.get('architecture_version') == 4
assert dev.get('stage') == 'structural-research-dev'
assert dev.get('production_ready') is False
split = dev.get('dev_split') or {}
assert split.get('protocol') == 'same-writer-dev-holdout'
assert split.get('writerDisjoint') is False
assert split.get('productionEvidence') is False
print(f"Frozen dev protocol: writer={split.get('writer')} train={split.get('trainSamples')} validation={split.get('validationSamples')}")
print('writer-disjoint: false · production evidence: false')
PY

python3 tools/ink-foundation/test_structural_group_relations.py
python3 tools/ink-foundation/audit_structural.py "$CORPUS" --require-all
python3 tools/ink-foundation/audit_structural.py "$SYNTH_CORPUS" --require-all
rm -f "$SYNTH_REL" "${SYNTH_REL%.pt}.json" "$DEV_REL" "${DEV_REL%.pt}.json" "$REPORT"

echo
echo "Pri Ink V4 pooled group relations — PRIVATE FROZEN DEV EXPERIMENT"
echo "same-writer development only · NEVER production evidence"

echo "1/3 Train pooled relation head on exact synthetic writer-disjoint structure"
PYTORCH_ENABLE_MPS_FALLBACK=1 python3 tools/ink-foundation/train_group_relations.py \
  "$SYNTH_BASE" --corpus "$SYNTH_CORPUS" --out "$SYNTH_REL" \
  --mode writer-disjoint --epochs "$SYNTH_EPOCHS" --batch 24 --patience 5

echo
echo "2/3 Transfer + fine-tune relation head on frozen real-Pencil DEV TRAIN subset"
PYTORCH_ENABLE_MPS_FALLBACK=1 python3 tools/ink-foundation/train_group_relations.py \
  "$DEV_BASE" --corpus "$CORPUS" --out "$DEV_REL" \
  --mode same-writer-dev --init-group-relations "$SYNTH_REL" --allow-base-transfer \
  --epochs "$DEV_EPOCHS" --batch 8 --patience 6

echo
echo "3/3 Same-base root-stroke vs pooled-group relation A/B on frozen DEV VALIDATION"
PYTORCH_ENABLE_MPS_FALLBACK=1 python3 tools/ink-foundation/evaluate_group_relations.py \
  "$DEV_BASE" "$DEV_REL" --corpus "$CORPUS" --mode same-writer-dev \
  --decoder "$DECODER" --out "$REPORT"

echo
echo "report: $REPORT"
echo "writer-disjoint: false"
echo "production ready: false"
