#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)";cd "$ROOT"
RUNS="${PRI_INK_V4_RUNS:-tools/ink-foundation/runs}";CORPUS="${PRI_INK_V4_REAL_CORPUS:-client/test/ink-corpus-structural}";SYNTH_CORPUS="${PRI_INK_V4_SYNTH_STRUCT:-/tmp/pri-ink-v4-synth-structural}"
SYNTH_BASE="${PRI_INK_V4_SYNTH_CHECKPOINT:-$RUNS/pri-ink-structural-v4-synthetic.pt}";DEV_BASE="${PRI_INK_V4_DEV_CHECKPOINT:-$RUNS/pri-ink-structural-v4-dev.pt}"
SYNTH_LOCAL="${PRI_INK_V4_SYNTH_GLYPH_LOCAL:-$RUNS/pri-ink-v4-glyph-local-synthetic.pt}";SYNTH_CONTEXT="${PRI_INK_V4_SYNTH_GLYPH_CONTEXT:-$RUNS/pri-ink-v4-glyph-context-synthetic.pt}"
DEV_LOCAL="${PRI_INK_V4_DEV_GLYPH_LOCAL:-$RUNS/pri-ink-v4-glyph-local-dev.pt}";DEV_CONTEXT="${PRI_INK_V4_DEV_GLYPH_CONTEXT:-$RUNS/pri-ink-v4-glyph-context-dev.pt}";REPORT="${PRI_INK_V4_GLYPH_ABLATION_REPORT:-$RUNS/pri-ink-v4-dev-contextual-glyph-ablation.json}"
for p in "$SYNTH_BASE" "$DEV_BASE";do [[ -f "$p" ]]||{ echo "missing V4 checkpoint: $p" >&2;exit 2;};done
for d in "$SYNTH_CORPUS" "$CORPUS";do [[ -d "$d" ]]||{ echo "missing structural corpus: $d" >&2;exit 2;};done
python3 tools/ink-foundation/test_structural_contextual_glyphs.py
python3 tools/ink-foundation/audit_structural.py "$CORPUS" --require-all
python3 tools/ink-foundation/audit_structural.py "$SYNTH_CORPUS" --require-all
rm -f "$SYNTH_LOCAL" "$SYNTH_CONTEXT" "$DEV_LOCAL" "$DEV_CONTEXT" "$REPORT"
echo "Pri Ink V4 contextual glyph fusion — PRIVATE FROZEN DEV EXPERIMENT"
echo "same-writer development only · NEVER production evidence"
python3 tools/ink-foundation/train_contextual_glyphs.py "$SYNTH_BASE" --corpus "$SYNTH_CORPUS" --out "$SYNTH_LOCAL" --mode writer-disjoint --feature-mode local-control --epochs 12 --batch 24 --patience 5
python3 tools/ink-foundation/train_contextual_glyphs.py "$SYNTH_BASE" --corpus "$SYNTH_CORPUS" --out "$SYNTH_CONTEXT" --mode writer-disjoint --feature-mode local-plus-visual --epochs 12 --batch 24 --patience 5
python3 tools/ink-foundation/train_contextual_glyphs.py "$DEV_BASE" --corpus "$CORPUS" --out "$DEV_LOCAL" --mode same-writer-dev --feature-mode local-control --init "$SYNTH_LOCAL" --allow-base-transfer --epochs 16 --batch 8 --patience 6
python3 tools/ink-foundation/train_contextual_glyphs.py "$DEV_BASE" --corpus "$CORPUS" --out "$DEV_CONTEXT" --mode same-writer-dev --feature-mode local-plus-visual --init "$SYNTH_CONTEXT" --allow-base-transfer --epochs 16 --batch 8 --patience 6
python3 tools/ink-foundation/evaluate_contextual_glyphs.py "$DEV_BASE" "$DEV_LOCAL" "$DEV_CONTEXT" --corpus "$CORPUS" --mode same-writer-dev --decoder joint-auto --out "$REPORT"
echo "writer-disjoint: false";echo "production ready: false";echo "report: $REPORT"
