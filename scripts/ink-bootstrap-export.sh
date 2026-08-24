#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CHECKPOINT="tools/ink-foundation/runs/bootstrap-one-writer/pri-ink-bootstrap.pt"
MODEL="tools/ink-foundation/runs/bootstrap-one-writer/PriInkFoundation.mlpackage"
VENV=".venv-ink-export"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "ERROR: Core ML export must run on macOS."
  exit 2
fi

if [[ ! -f "$CHECKPOINT" ]]; then
  echo "ERROR: trained bootstrap checkpoint was not found:"
  echo "  $CHECKPOINT"
  echo "Do not retrain blindly; confirm the prior bootstrap training output first."
  exit 2
fi

choose_python() {
  if [[ -n "${PRI_INK_EXPORT_PYTHON:-}" ]] && [[ -x "${PRI_INK_EXPORT_PYTHON}" ]]; then
    printf '%s\n' "$PRI_INK_EXPORT_PYTHON"
    return 0
  fi

  if command -v python3.12 >/dev/null 2>&1; then
    command -v python3.12
    return 0
  fi

  if command -v brew >/dev/null 2>&1; then
    local prefix
    prefix="$(brew --prefix python@3.12 2>/dev/null || true)"
    if [[ -n "$prefix" ]] && [[ -x "$prefix/bin/python3.12" ]]; then
      printf '%s\n' "$prefix/bin/python3.12"
      return 0
    fi

    echo "Python 3.12 is needed for the Core ML export environment." >&2
    echo "Installing Homebrew python@3.12 once; the trained checkpoint is preserved." >&2
    brew install python@3.12 >&2
    prefix="$(brew --prefix python@3.12)"
    printf '%s\n' "$prefix/bin/python3.12"
    return 0
  fi

  echo "ERROR: Python 3.12 was not found and Homebrew is unavailable." >&2
  echo "Install Python 3.12, then run npm run ink:bootstrap:export again." >&2
  return 1
}

PYTHON="$(choose_python)"

printf '\n============================================================\n'
printf ' Pri Ink · resume Core ML export (NO RETRAIN)\n'
printf '============================================================\n\n'
printf 'Checkpoint: %s\n' "$CHECKPOINT"
printf 'Python:     %s\n\n' "$PYTHON"

if [[ -d "$VENV" ]]; then
  existing="$($VENV/bin/python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true)"
  if [[ "$existing" != "3.12" ]]; then
    rm -rf "$VENV"
  fi
fi

if [[ ! -x "$VENV/bin/python" ]]; then
  "$PYTHON" -m venv "$VENV"
fi

PY="$VENV/bin/python"
PIP="$VENV/bin/pip"

printf '1/4  Preparing a Core ML-compatible export environment\n'
"$PY" -m pip install --upgrade pip
"$PIP" install "torch==2.7.0" "coremltools==9.0"

"$PY" - <<'PY'
import importlib.util, sys, torch, coremltools
print(f"export Python {sys.version.split()[0]} · torch {torch.__version__} · coremltools {coremltools.__version__}")
if sys.version_info[:2] != (3, 12):
    raise SystemExit("export environment must use Python 3.12")
if importlib.util.find_spec("coremltools.libcoremlpython") is None:
    raise SystemExit("coremltools native macOS extension is missing; refusing a broken export")
PY

printf '\n2/4  Inspecting the saved development checkpoint\n'
"$PY" - "$CHECKPOINT" <<'PY'
import sys, torch
p = sys.argv[1]
ckpt = torch.load(p, map_location="cpu", weights_only=False)
if ckpt.get("stage") != "bootstrap":
    raise SystemExit(f"expected bootstrap checkpoint, got stage={ckpt.get('stage')!r}")
val = ckpt.get("validation") or {}
print(f"stage={ckpt.get('stage')} epoch={ckpt.get('epoch')} same-writer exact={100*float(val.get('exact',0)):.2f}% CER={100*float(val.get('cer',0)):.2f}%")
print("QUALITY WARNING: this checkpoint is diagnostic only; same-writer exact accuracy is not production evidence.")
PY

printf '\n3/4  Converting the saved checkpoint to Core ML\n'
rm -rf "$MODEL"
"$PY" tools/ink-foundation/export_coreml.py "$CHECKPOINT" --out "$MODEL"

"$PY" - "$MODEL" <<'PY'
import sys
import coremltools as ct
m = ct.models.MLModel(sys.argv[1])
meta = m.user_defined_metadata
assert meta.get("pri.productionReady") == "false", meta
assert meta.get("pri.trainingStage") == "bootstrap", meta
print("Core ML metadata lock: PASS — bootstrap model is development-only")
PY

printf '\n4/4  Installing the diagnostic model into both DEBUG iPad packages\n'
for package in "ios/PriLearning.swiftpm" "ios/PriLearning 2.swiftpm"; do
  dest="$package/Resources/Models/PriInkFoundation.mlpackage"
  mkdir -p "$(dirname "$dest")"
  rm -rf "$dest"
  cp -R "$MODEL" "$dest"
done

printf '\n============================================================\n'
printf ' EXPORT RESUME COMPLETE\n'
printf '============================================================\n'
printf 'No neural retraining was performed.\n'
printf 'The saved bootstrap checkpoint was reused.\n'
printf 'The installed model remains DEBUG/development-only.\n'
printf 'Next: measure it on fresh unseen Pencil equations before trusting it.\n\n'
