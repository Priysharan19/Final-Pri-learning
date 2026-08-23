#!/usr/bin/env bash
set -euo pipefail

# Pri Ink Foundation — one-writer DEVELOPMENT bootstrap.
#
# Keeps the real corpus local, pretrains on synthetic writer diversity, adapts
# on the one available real Pencil writer, exports a non-production Core ML
# model, and installs it into both local SwiftPM packages for DEBUG testing.
# It never reads test/final-holdout evidence and can never promote a release.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "ERROR: Core ML bootstrap export must run on macOS."
  exit 2
fi

PYTHON="${PYTHON:-python3}"
VENV=".venv-ink"
PY="$VENV/bin/python"
PIP="$VENV/bin/pip"
RUN_DIR="tools/ink-foundation/runs/bootstrap-one-writer"
SYNTH_DIR="${TMPDIR:-/tmp}/pri-ink-bootstrap-synth"
PRETRAIN="$RUN_DIR/pri-ink-bootstrap-pretrain.pt"
BOOTSTRAP="$RUN_DIR/pri-ink-bootstrap.pt"
MODEL="$RUN_DIR/PriInkFoundation.mlpackage"

# Balanced default for a laptop bootstrap. Increase these with environment
# variables later without changing code; none of these numbers are release
# evidence because the only real writer count remains one.
SYNTH_TRAIN_WRITERS="${PRI_INK_SYNTH_TRAIN_WRITERS:-96}"
SYNTH_VAL_WRITERS="${PRI_INK_SYNTH_VAL_WRITERS:-24}"
SYNTH_SAMPLES_PER_WRITER="${PRI_INK_SYNTH_SAMPLES_PER_WRITER:-24}"
PRETRAIN_EPOCHS="${PRI_INK_PRETRAIN_EPOCHS:-16}"
BOOTSTRAP_EPOCHS="${PRI_INK_BOOTSTRAP_EPOCHS:-32}"
D_MODEL="${PRI_INK_D_MODEL:-192}"
STROKE_LAYERS="${PRI_INK_STROKE_LAYERS:-6}"
DECODER_LAYERS="${PRI_INK_DECODER_LAYERS:-4}"

printf '\n============================================================\n'
printf ' Pri Ink · one-writer DEVELOPMENT bootstrap\n'
printf '============================================================\n\n'

echo "1/7  Auditing the private real-Pencil corpus"
npm run test:ink:corpus:strict

node <<'NODE'
const fs = require('fs');
const path = require('path');
const dir = path.join(process.cwd(), 'client/test/ink-corpus');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
const docs = files.map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const writers = [...new Set(docs.map(d => d.writer?.id).filter(Boolean))];
const samples = docs.reduce((n, d) => n + (d.samples?.length || 0), 0);
const badCollector = docs.filter(d => Number(d.collector?.version || 0) < 7);
const nonTrain = docs.filter(d => d.split !== 'train');
if (writers.length !== 1) throw new Error(`bootstrap requires exactly one real writer; found ${writers.length}: ${writers.join(', ')}`);
if (samples < 20) throw new Error(`bootstrap needs at least 20 real expressions; found ${samples}`);
if (badCollector.length) throw new Error('bootstrap requires capture v7+ real data');
if (nonTrain.length) throw new Error('bootstrap must not consume validation/test/final-holdout files');
console.log(`bootstrap source: ${writers[0]} · ${samples} real expressions · capture v7+`);
NODE

echo
echo "2/7  Preparing the isolated Python environment"
if [[ ! -x "$PY" ]]; then
  "$PYTHON" -m venv "$VENV"
fi
"$PY" -m pip install --upgrade pip
"$PIP" install -r tools/ink-foundation/requirements.txt

mkdir -p "$RUN_DIR"
rm -rf "$SYNTH_DIR" "$MODEL"

echo
echo "3/7  Generating synthetic whole-expression writer diversity"
node tools/ink-foundation/generate_synthetic.mjs \
  "$SYNTH_DIR" \
  "$SYNTH_TRAIN_WRITERS" \
  "$SYNTH_VAL_WRITERS" \
  "$SYNTH_SAMPLES_PER_WRITER"

echo
echo "4/7  Pretraining the multimodal backbone"
"$PY" tools/ink-foundation/train.py \
  --stage pretrain \
  --corpus "$SYNTH_DIR" \
  --out "$PRETRAIN" \
  --epochs "$PRETRAIN_EPOCHS" \
  --batch 16 \
  --lr 2e-4 \
  --d-model "$D_MODEL" \
  --stroke-layers "$STROKE_LAYERS" \
  --decoder-layers "$DECODER_LAYERS" \
  --max-points 768 \
  --max-tokens 96 \
  --patience 5

echo
echo "5/7  Adapting to the one available real Pencil writer"
"$PY" tools/ink-foundation/bootstrap.py \
  --init "$PRETRAIN" \
  --corpus client/test/ink-corpus \
  --out "$BOOTSTRAP" \
  --epochs "$BOOTSTRAP_EPOCHS" \
  --batch 8 \
  --lr 5e-5 \
  --d-model "$D_MODEL" \
  --stroke-layers "$STROKE_LAYERS" \
  --decoder-layers "$DECODER_LAYERS" \
  --max-points 768 \
  --max-tokens 96 \
  --validation-fraction 0.20 \
  --patience 8

echo
echo "6/7  Exporting a development-only Core ML model"
"$PY" tools/ink-foundation/export_coreml.py \
  "$BOOTSTRAP" \
  --out "$MODEL"

"$PY" - "$MODEL" <<'PY'
import sys
import coremltools as ct
m = ct.models.MLModel(sys.argv[1])
meta = m.user_defined_metadata
assert meta.get('pri.productionReady') == 'false', meta
assert meta.get('pri.trainingStage') == 'bootstrap', meta
print('Core ML promotion lock: PASS — bootstrap model is development-only')
PY

echo
echo "7/7  Installing the DEBUG model into both local iPad packages"
for package in "ios/PriLearning.swiftpm" "ios/PriLearning 2.swiftpm"; do
  dest="$package/Resources/Models/PriInkFoundation.mlpackage"
  mkdir -p "$(dirname "$dest")"
  rm -rf "$dest"
  cp -R "$MODEL" "$dest"
done

printf '\n============================================================\n'
printf ' BOOTSTRAP COMPLETE\n'
printf '============================================================\n'
printf 'Checkpoint: %s\n' "$BOOTSTRAP"
printf 'Core ML:    %s\n' "$MODEL"
printf 'Installed:  ios/PriLearning.swiftpm/Resources/Models/PriInkFoundation.mlpackage\n'
printf '\nThis model is for DEBUG/iPad testing only.\n'
printf 'It is NOT evidence of accuracy on other people and cannot be promoted.\n'
printf 'Pri production promotion still requires writer-disjoint real test/final-holdout gates.\n\n'
