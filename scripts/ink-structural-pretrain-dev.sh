#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RAW="${PRI_INK_V4_SYNTH_RAW:-/tmp/pri-ink-v4-synth-raw}"
STRUCT="${PRI_INK_V4_SYNTH_STRUCT:-/tmp/pri-ink-v4-synth-structural}"
TRAIN_WRITERS="${PRI_INK_V4_SYNTH_TRAIN_WRITERS:-64}"
VAL_WRITERS="${PRI_INK_V4_SYNTH_VAL_WRITERS:-16}"
SAMPLES="${PRI_INK_V4_SYNTH_SAMPLES_PER_WRITER:-24}"
EPOCHS="${PRI_INK_V4_SYNTH_EPOCHS:-12}"
BATCH="${PRI_INK_V4_SYNTH_BATCH:-16}"
OUT="${PRI_INK_V4_SYNTH_CHECKPOINT:-tools/ink-foundation/runs/pri-ink-structural-v4-synthetic.pt}"

rm -rf "$RAW" "$STRUCT"

echo "Pri Ink V4 synthetic structural pretraining"
echo "SYNTHETIC ONLY — never production evidence"
echo "train writers=$TRAIN_WRITERS validation writers=$VAL_WRITERS samples/writer=$SAMPLES"

node tools/ink-foundation/generate_synthetic.mjs \
  "$RAW" "$TRAIN_WRITERS" "$VAL_WRITERS" "$SAMPLES"

node scripts/ink-structure-preannotate.mjs "$RAW" "$STRUCT"

PYTORCH_ENABLE_MPS_FALLBACK=1 python3 tools/ink-foundation/train_structural.py \
  --corpus "$STRUCT" \
  --out "$OUT" \
  --epochs "$EPOCHS" \
  --batch "$BATCH" \
  --patience 4

python3 tools/ink-foundation/tag_synthetic_checkpoint.py "$OUT"

echo
echo "Synthetic V4 pretraining complete: $OUT"
echo "Next: npm run ink:structure:train:dev:pretrained"
