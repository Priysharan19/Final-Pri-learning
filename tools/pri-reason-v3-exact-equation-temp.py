from pathlib import Path

p = Path(__file__).resolve().parents[1] / "client/src/engine/checker.js"
text = p.read_text()
old = r'''  if (stage.kind === 'evaluation') return assessEvaluationLine({ text: line, meta: stage });
  if (stage.kind === 'point') return assessPointLine({ text: line, meta: stage });
  if (derivativeSourceLine(stage, line)) {
    return { status: 'note', trusted: false, note: 'Starting function recognised — differentiate it on the next line.' };
  }
  const checked = stepCheckSingle(stage, stage.kind === 'equation' ? planClause(line) : line);
'''
new = r'''  if (stage.kind === 'evaluation') return assessEvaluationLine({ text: line, meta: stage });
  if (stage.kind === 'point') return assessPointLine({ text: line, meta: stage });
  if (derivativeSourceLine(stage, line)) {
    return { status: 'note', trusted: false, note: 'Starting function recognised — differentiate it on the next line.' };
  }

  // For an explicit equation inside a proof plan, prefer the direct exact
  // equation proof before the legacy single-line facade. The facade may replace
  // a mathematically certified lost-solution diagnosis with a lower-confidence
  // pedagogical heuristic; the plan must retain the proof-grade diagnosis.
  if (stage.kind === 'equation') {
    const clause = planClause(line)
      .replace(/^∴\s*/, '')
      .replace(/^(so|hence|then|therefore)\s+/i, '');
    try {
      const ast = parse(normalize(clause));
      if (ast.t === 'equation') {
        const exact = assessEquationLine({ ast, meta: stage });
        if (exact.status === 'ok' || exact.status === 'break') return exact;
      }
    } catch { /* fall back to the stable facade */ }
  }

  const checked = stepCheckSingle(stage, stage.kind === 'equation' ? planClause(line) : line);
'''
count = text.count(old)
if count != 1:
    raise SystemExit(f"exact-equation patch: expected one anchor, found {count}")
p.write_text(text.replace(old, new, 1))
print("patched V3 proof-plan exact equation precedence")
