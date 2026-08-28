from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new, label):
    p = ROOT / path
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one anchor, found {count}")
    p.write_text(text.replace(old, new, 1))
    print(f"patched {label}")


# 1) Wire V3 proof-plan dispatch into the stable checker facade.
checker = "client/src/engine/checker.js"
replace_once(
    checker,
    """import {\n  assessEquationLine, sameEquationClaim,\n  assessRelationLine, assessDerivativeLine\n} from './reason-v2-safe.js';\n""",
    """import {\n  assessEquationLine, sameEquationClaim, sameExpressionClaim,\n  assessRelationLine, assessDerivativeLine\n} from './reason-v2-safe.js';\nimport { assessEvaluationLine, assessPointLine } from './reason-v3.js';\n""",
    "checker V3 imports",
)
replace_once(
    checker,
    "export function stepCheck(meta, workingText) {",
    "function stepCheckSingle(meta, workingText) {",
    "checker single-domain rename",
)

p = ROOT / checker
text = p.read_text()
if "function stepCheckPlan(meta, workingText)" in text:
    raise SystemExit("checker V3 plan wrapper already present")

text += r'''

// ── Pri Reason V3: authored multi-operation proof plans ─────────────────────
// A plan is an ordered list of already-safe verifiers. It cannot skip a stage:
// a later-stage truth shown before its prerequisite is recognised only as a
// note. This preserves the V1/V2 prove/disprove/abstain contract while allowing
// a real solution to move from differentiation into solving and substitution.

function planClause(line) {
  return String(line || '').split(/(?:=>|⇒|→)/).pop().trim();
}

function derivativeSourceLine(stage, line) {
  if (stage?.kind !== 'derivative' || !stage.source) return false;
  const raw = String(line || '').trim().replace(/[−–—]/g, '-').replace(/^∴\s*/, '');
  let candidate = raw;
  const eq = raw.indexOf('=');
  if (eq >= 0) {
    const lhs = raw.slice(0, eq).trim();
    if (!/^(?:y|f\s*\(\s*x\s*\))$/i.test(lhs)) return false;
    candidate = raw.slice(eq + 1).trim();
  }
  try {
    const a = parse(normalize(candidate));
    const b = parse(normalize(stage.source));
    return a.t !== 'equation' && b.t !== 'equation' && sameExpressionClaim(a, b);
  } catch { return false; }
}

function assessPlanStage(stage, line) {
  if (!stage || typeof stage !== 'object') {
    return { status: 'note', note: 'This proof stage is not configured safely.', trusted: false };
  }
  if (stage.kind === 'evaluation') return assessEvaluationLine({ text: line, meta: stage });
  if (stage.kind === 'point') return assessPointLine({ text: line, meta: stage });
  if (derivativeSourceLine(stage, line)) {
    return { status: 'note', trusted: false, note: 'Starting function recognised — differentiate it on the next line.' };
  }
  const checked = stepCheckSingle(stage, stage.kind === 'equation' ? planClause(line) : line);
  const item = checked.lines?.[0];
  if (!item) return { status: 'note', trusted: false, note: 'Pri could not verify this proof stage safely.' };
  return {
    status: item.status,
    note: item.note,
    diagnosis: item.diagnosis || checked.diagnosis || null,
    trusted: item.status === 'ok'
  };
}

function stepCheckPlan(meta, workingText) {
  const rawLines = String(workingText || '').split('\n').map(line => line.trim()).filter(Boolean);
  const stages = Array.isArray(meta?.stages) ? meta.stages.filter(Boolean) : [];
  if (!stages.length) {
    return {
      lines: rawLines.map(text => ({ text, status: 'note', note: 'This proof plan has no authored stages.' })),
      firstBreak: -1, diagnosis: null, completedStages: 0, totalStages: 0
    };
  }

  const out = [];
  const completed = new Set();
  let active = 0;
  let activeSatisfied = false;
  let firstBreak = -1;
  let diagnosis = null;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (firstBreak !== -1) {
      out.push({ text: line, status: 'note', note: 'Follows from the earlier slip.', stage: active });
      continue;
    }

    const currentStage = stages[active];

    if (!activeSatisfied) {
      const current = assessPlanStage(currentStage, line);
      if (current.status === 'ok') {
        activeSatisfied = true;
        completed.add(active);
        out.push({ text: line, status: 'ok', stage: active });
        continue;
      }

      // Do not falsely call a correct later-stage result a derivative/algebra
      // error merely because the prerequisite working was omitted. It still
      // cannot advance the plan, so it receives a note rather than credit.
      let laterTruth = false;
      for (let s = active + 1; s < stages.length; s++) {
        const later = assessPlanStage(stages[s], line);
        if (later.status === 'ok') { laterTruth = true; break; }
      }
      if (laterTruth) {
        out.push({
          text: line, status: 'note', stage: active,
          note: 'This matches a later result, but Pri has not yet verified the prerequisite stage, so it cannot receive step credit.'
        });
        continue;
      }

      if (current.status === 'break') {
        firstBreak = i;
        diagnosis = current.diagnosis || null;
        out.push({ text: line, status: 'break', stage: active, note: current.note, ...(diagnosis ? { diagnosis } : {}) });
      } else {
        out.push({ text: line, status: 'note', stage: active, note: current.note });
      }
      continue;
    }

    const hasNext = active + 1 < stages.length;
    if (hasNext) {
      const nextIndex = active + 1;
      const next = assessPlanStage(stages[nextIndex], line);
      if (next.status === 'ok') {
        active = nextIndex;
        activeSatisfied = true;
        completed.add(active);
        out.push({ text: line, status: 'ok', stage: active });
        continue;
      }
      if (next.status === 'break') {
        active = nextIndex;
        firstBreak = i;
        diagnosis = next.diagnosis || null;
        out.push({ text: line, status: 'break', stage: active, note: next.note, ...(diagnosis ? { diagnosis } : {}) });
        continue;
      }

      // The line may be another equivalent form within the already-completed
      // stage (for example source equation then x = 2). Keep that stage active.
      const current = assessPlanStage(currentStage, line);
      if (current.status === 'ok') {
        out.push({ text: line, status: 'ok', stage: active });
        continue;
      }
      // Equation solvers have strong exact solution-set diagnostics. Preserve
      // those rather than hiding a wrong solved root as an unsupported next op.
      if (current.status === 'break' && currentStage.kind === 'equation') {
        firstBreak = i;
        diagnosis = current.diagnosis || null;
        out.push({ text: line, status: 'break', stage: active, note: current.note, ...(diagnosis ? { diagnosis } : {}) });
        continue;
      }

      out.push({
        text: line, status: 'note', stage: active,
        note: next.note || current.note || 'Pri could not prove which authored operation this line belongs to.'
      });
      continue;
    }

    // Final stage: a positively disproved final claim is a real break.
    const current = assessPlanStage(currentStage, line);
    if (current.status === 'break') {
      firstBreak = i;
      diagnosis = current.diagnosis || null;
      out.push({ text: line, status: 'break', stage: active, note: current.note, ...(diagnosis ? { diagnosis } : {}) });
    } else {
      if (current.status === 'ok') completed.add(active);
      out.push({ text: line, status: current.status, stage: active, ...(current.note ? { note: current.note } : {}) });
    }
  }

  return {
    lines: out,
    firstBreak,
    diagnosis,
    completedStages: completed.size,
    totalStages: stages.length
  };
}

export function stepCheck(meta, workingText) {
  if (meta?.kind === 'plan') return stepCheckPlan(meta, workingText);
  return stepCheckSingle(meta, workingText);
}
'''
p.write_text(text)
print("patched checker V3 proof-plan wrapper")


# 2) Activate exact proof-plan metadata only on Year 11 differentiation forms
# whose complete mathematical route is represented by V3.
year11 = "client/src/engine/generators/year11.js"
replace_once(
    year11,
    """        prompt: `Find the gradient of the tangent to $y = ${poly([a, b, c])}$ at the point where $x = ${x0}$.`,\n        answerType: 'numeric', answer: { value: grad },\n""",
    """        prompt: `Find the gradient of the tangent to $y = ${poly([a, b, c])}$ at the point where $x = ${x0}$.`,\n        answerType: 'numeric', answer: { value: grad },\n        stepcheck: {\n          kind: 'plan',\n          stages: [\n            { kind: 'derivative', variable: 'x', source: poly([a, b, c]), canonical: poly([2 * a, b]) },\n            { kind: 'evaluation', source: poly([2 * a, b]), substitutions: { x: x0 }, expected: grad, labels: ['m', 'gradient', 'dy/dx'] }\n          ]\n        },\n""",
    "Year 11 differentiation D3 proof plan",
)
replace_once(
    year11,
    """      prompt: `Find the point on the curve $y = ${poly([1, b, c])}$ where the gradient equals $${targetGrad}$.`,\n      answerType: 'point', answer: { x: x0v, y: y0 },\n""",
    """      prompt: `Find the point on the curve $y = ${poly([1, b, c])}$ where the gradient equals $${targetGrad}$.`,\n      answerType: 'point', answer: { x: x0v, y: y0 },\n      stepcheck: {\n        kind: 'plan',\n        stages: [\n          { kind: 'derivative', variable: 'x', source: poly([1, b, c]), canonical: poly([2, b]) },\n          { kind: 'equation', variable: 'x', source: `${poly([2, b])} = ${targetGrad}`, solutions: [x0v] },\n          { kind: 'evaluation', source: poly([1, b, c]), substitutions: { x: x0v }, expected: y0, labels: ['y'] },\n          { kind: 'point', x: x0v, y: y0 }\n        ]\n      },\n""",
    "Year 11 differentiation D4 proof plan",
)


# 3) Turn the former D3/D4 abstention assertion into a permanent authored-plan
# integration gate. This proves exact generator metadata rather than prompt text.
curriculum = "client/test/pri-reason-curriculum-check.mjs"
replace_once(
    curriculum,
    """for (const difficulty of [3, 4]) {\n  const q = year11['y11-diff'](makeRng(0x521100 + difficulty), difficulty);\n  ok(`Year 11 differentiation D${difficulty} stays outside single-operation metadata`, !q.stepcheck);\n}\n""",
    """{\n  const q = year11['y11-diff'](makeRng(0x521103), 3);\n  same('Year 11 differentiation D3 uses proof plan', q.stepcheck?.kind, 'plan');\n  same('Year 11 differentiation D3 has two authored stages', q.stepcheck?.stages?.length, 2);\n  const [derivative, evaluation] = q.stepcheck.stages;\n  same('Year 11 differentiation D3 stage 1 derivative', derivative.kind, 'derivative');\n  same('Year 11 differentiation D3 stage 2 evaluation', evaluation.kind, 'evaluation');\n  let r = stepCheck(q.stepcheck, `dy/dx = ${derivative.canonical}\\nm = ${evaluation.expected}`);\n  same('Year 11 differentiation D3 full plan has no break', r.firstBreak, -1);\n  same('Year 11 differentiation D3 completes both stages', r.completedStages, 2);\n  r = stepCheck(q.stepcheck, `dy/dx = ${derivative.canonical}\\nm = ${evaluation.expected + 1}`);\n  same('Year 11 differentiation D3 wrong substitution breaks', r.firstBreak, 1);\n  same('Year 11 differentiation D3 wrong substitution diagnosis', r.diagnosis?.code, 'substitution-error');\n}\n\n{\n  const q = year11['y11-diff'](makeRng(0x521104), 4);\n  same('Year 11 differentiation D4 uses proof plan', q.stepcheck?.kind, 'plan');\n  same('Year 11 differentiation D4 has four authored stages', q.stepcheck?.stages?.length, 4);\n  const [derivative, equation, evaluation, point] = q.stepcheck.stages;\n  const x = equation.solutions[0];\n  const working = `dy/dx = ${derivative.canonical}\\n${equation.source}\\nx = ${x}\\ny = ${evaluation.expected}\\n(${point.x}, ${point.y})`;\n  let r = stepCheck(q.stepcheck, working);\n  same('Year 11 differentiation D4 full plan has no break', r.firstBreak, -1);\n  same('Year 11 differentiation D4 completes all stages', r.completedStages, 4);\n  ok('Year 11 differentiation D4 full plan lines verify', r.lines.every(line => line.status === 'ok'));\n  r = stepCheck(q.stepcheck, `dy/dx = ${derivative.canonical}\\n${equation.source}\\nx = ${x}\\ny = ${evaluation.expected + 1}`);\n  same('Year 11 differentiation D4 wrong y breaks', r.firstBreak, 3);\n  same('Year 11 differentiation D4 wrong y diagnosis', r.diagnosis?.code, 'substitution-error');\n}\n""",
    "curriculum D3/D4 proof-plan gate",
)

print("Pri Reason V3 source patch complete")
