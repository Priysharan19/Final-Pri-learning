#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STRUCT="${PRI_INK_V4_SYNTH_STRUCT:-/tmp/pri-ink-v4-synth-structural}"
TRAIN_WRITERS="${PRI_INK_V4_SYNTH_TRAIN_WRITERS:-64}"
VAL_WRITERS="${PRI_INK_V4_SYNTH_VAL_WRITERS:-16}"
SAMPLES="${PRI_INK_V4_SYNTH_SAMPLES_PER_WRITER:-24}"
EPOCHS="${PRI_INK_V4_SYNTH_EPOCHS:-12}"
BATCH="${PRI_INK_V4_SYNTH_BATCH:-16}"
OUT="${PRI_INK_V4_SYNTH_CHECKPOINT:-tools/ink-foundation/runs/pri-ink-structural-v4-synthetic.pt}"

rm -rf "$STRUCT"
rm -f "$OUT" "${OUT%.pt}.json"

echo "Pri Ink V4 exact synthetic structural pretraining"
echo "SYNTHETIC ONLY — never production evidence"
echo "train writers=$TRAIN_WRITERS validation writers=$VAL_WRITERS samples/writer=$SAMPLES"

# The structural generator owns the glyph renderer, therefore it emits exact
# trace->glyph groups and relations. Do not run human-corpus heuristic
# preannotation over synthetic data: that would replace known truth with guesses.
node tools/ink-foundation/generate_structural_synthetic.mjs \
  "$STRUCT" "$TRAIN_WRITERS" "$VAL_WRITERS" "$SAMPLES"

python3 tools/ink-foundation/audit_structural.py "$STRUCT" --require-all

PYTORCH_ENABLE_MPS_FALLBACK=1 python3 tools/ink-foundation/train_structural.py \
  --corpus "$STRUCT" \
  --out "$OUT" \
  --epochs "$EPOCHS" \
  --batch "$BATCH" \
  --patience 4

python3 tools/ink-foundation/tag_synthetic_checkpoint.py "$OUT"

test -f "$OUT"

echo
echo "Synthetic V4 pretraining complete: $OUT"
echo "Next: npm run ink:structure:train:dev:pretrained"
