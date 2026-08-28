// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Answer checker + Pri Reason safety layer
//
// The mature answer-format checker remains in checker-core.js. This facade keeps
// that API stable while routing mathematical working through Pri Reason.
// ─────────────────────────────────────────────────────────────────────────────

import { normalize, parse, evaluate, exprEquivalent, numsClose } from './expr.js';
import { diagnoseStep } from './diagnose.js';
import {
  assessEquationLine, sameEquationClaim, sameExpressionClaim,
  assessRelationLine, assessDerivativeLine
} from './reason-v2-safe.js';
import { assessEvaluationLine, assessPointLine } from './reason-v3.js';
import { cleanInput, parseNumericInput, checkAnswer as coreCheckAnswer } from './checker-core.js';

export { cleanInput, parseNumericInput };

export function checkAnswer(question, rawInput) {
  if (question?.answerType === 'working') return checkWorking(question, String(rawInput ?? ''));
  return coreCheckAnswer(question, rawInput);
}

function uniqueNumeric(values) {
  const out = [];
  for (const v of values || []) {
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    if (!out.some(x => numsClose(x, n, 1e-7))) out.push(n);
  }
  return out;
}

function lostRootDiagnosis(variable, kept, total) {
  return {
    code: 'lost-root',
    title: 'A solution was dropped',
    message: `${variable} = ${kept} is one valid solution, but the original equation has ${total} solutions. This line has thrown at least one away.`,
    fix: 'When an equation branches, keep every branch until each solution has been checked.',
    confidence: 'high'
  };
}

function extraListedRootDiagnosis(variable, value) {
  return {
    code: 'extraneous-solution',
    title: 'An extra solution was introduced',
    message: `${variable} = ${value} is listed here, but it does not solve the original equation.`,
    fix: 'Check every proposed solution in the original equation before keeping it.',
    confidence: 'high'
  };
}

/**
 * Read a natural final solution list before normalize() removes commas.
 * Accepted forms include:
 *   x = 3 or x = -3
 *   x = 3, -3
 *   x = 3; x = -3
 * A single equation is deliberately not handled here.
 */
function readSolutionList(raw, meta) {
  if (meta?.kind !== 'equation' || !meta.variable || !Array.isArray(meta.solutions)) return null;
  let src = String(raw || '').trim()
    .replace(/[−–—]/g, '-')
    .replace(/^∴\s*/, '')
    .replace(/^(so|hence|then|therefore)\s+/i, '');
  if (!/(\bor\b|,|;)/i.test(src)) return null;
  const variable = String(meta.variable).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lead = new RegExp(`^${variable}\\s*=\\s*`, 'i');
  const parts = src.split(/\bor\b|,|;/i).map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const values = [];
  for (let part of parts) {
    part = part.replace(lead, '').trim();
    if (!part || part.includes('=')) return { values: [], invalid: true };
    try { values.push(parseNumericInput(part).value); }
    catch { return { values: [], invalid: true }; }
  }
  return { values: uniqueNumeric(values), invalid: false };
}

export function checkWorking(q, workingText) {
  const ans = q.answer;
  const meta = ans.stepMeta;
  let report;
  try { report = stepCheck(meta, workingText); }
  catch { return { correct: false, feedback: 'I couldn’t read that working — write one step per line.', stepReport: null, validLines: 0 }; }

  const okLines = report.lines.filter(l => l.status === 'ok');
  const parsed = report.lines.filter(l => l.status !== 'note');
  const minLines = ans.minLines || 2;
  if (parsed.length < minLines) {
    return { correct: false, feedback: `Show at least ${minLines} lines of mathematical working — I could only verify ${parsed.length}.`, stepReport: report, validLines: okLines.length };
  }
  if (report.firstBreak !== -1) {
    const named = report.diagnosis && report.diagnosis.code !== 'counterexample'
      ? `${report.diagnosis.title} — line ${report.firstBreak + 1} is marked below.`
      : 'There’s a slip in your working — Step Check has marked the line where it breaks.';
    return { correct: false, feedback: named, stepReport: report, validLines: okLines.length };
  }

  const lastLine = [...report.lines].reverse().find(l => l.status === 'ok');
  if (!lastLine) return { correct: false, feedback: 'Finish with a line Pri can verify as the final result.', stepReport: report, validLines: 0 };

  let reached = false;
  try {
    const naturalList = readSolutionList(lastLine.text, meta);
    if (naturalList && !naturalList.invalid) {
      const wanted = uniqueNumeric(meta.solutions);
      reached = naturalList.values.length === wanted.length
        && naturalList.values.every(v => wanted.some(s => numsClose(v, s)));
    } else {
      const cleaned = normalize(lastLine.text).replace(/^∴\s*/, '');
      if (ans.final?.kind === 'expr') {
        const cand = cleaned.includes('=') ? cleaned.split('=').pop() : cleaned;
        reached = exprEquivalent(cand, ans.final.expr, { positiveOnly: ans.final.positiveOnly });
      } else if (meta.kind === 'equation') {
        const re = new RegExp(`${meta.variable}\\s*=`);
        if (re.test(cleaned)) {
          const rhs = cleaned.split('=').pop();
          const vals = uniqueNumeric([parseNumericInput(rhs).value]);
          const wanted = uniqueNumeric(meta.solutions);
          reached = vals.length === wanted.length && vals.every(v => wanted.some(s => numsClose(v, s)));
        }
      } else {
        const cand = cleaned.includes('=') ? cleaned.split('=').pop() : cleaned;
        reached = exprEquivalent(cand, meta.canonical, {});
      }
    }
  } catch { reached = false; }

  if (!reached) {
    return { correct: false, feedback: 'Your verified steps do not yet end with the complete result — state every solution or the requested simplified expression on the final line.', stepReport: report, validLines: okLines.length };
  }
  return { correct: true, stepReport: report, validLines: okLines.length };
}

function stepCheckSingle(meta, workingText) {
  const rawLines = String(workingText || '').split('\n').map(l => l.trim()).filter(Boolean);
  const out = [];
  let firstBreak = -1;
  let previousEquation = null;
  let previousEquationTrusted = false;
  let previousRelation = null;
  let previousRelationTrusted = false;

  rawLines.forEach((line, i) => {
    let status = 'note';
    let note;
    let lineDiagnosis = null;
    try {
      const listed = readSolutionList(line, meta);
      if (listed) {
        const wanted = uniqueNumeric(meta.solutions);
        if (listed.invalid || !listed.values.length) {
          status = 'note';
          note = 'Skipped — I couldn’t read the solution list safely.';
        } else {
          const extra = listed.values.find(v => !wanted.some(sol => numsClose(v, sol)));
          const missing = wanted.filter(sol => !listed.values.some(v => numsClose(v, sol)));
          if (extra !== undefined) {
            status = 'break';
            lineDiagnosis = extraListedRootDiagnosis(meta.variable, extra);
            note = lineDiagnosis.message;
          } else if (missing.length || listed.values.length !== wanted.length) {
            status = 'break';
            lineDiagnosis = lostRootDiagnosis(meta.variable, listed.values.join(' or '), wanted.length);
            note = lineDiagnosis.message;
          } else {
            status = 'ok';
          }
        }
        if (status === 'break' && firstBreak === -1) firstBreak = i;
        out.push({ text: line, status, note, ...(lineDiagnosis ? { diagnosis: lineDiagnosis } : {}) });
        return;
      }

      const proseClean = String(line).trim()
        .replace(/^∴\s*/, '')
        .replace(/^(so|hence|then|therefore)\s+/i, '');

      // V2 inequalities are parsed before normalize(), because <, >, ≤ and ≥
      // are relations rather than arithmetic tokens in the expression engine.
      if (meta?.kind === 'inequality') {
        const assessed = assessRelationLine({
          text: proseClean,
          previous: previousRelation,
          previousTrusted: previousRelationTrusted,
          meta
        });
        status = assessed.status;
        note = assessed.note;
        lineDiagnosis = assessed.diagnosis || null;
        if (status !== 'break' && assessed.relation) {
          previousRelation = assessed.relation;
          previousRelationTrusted = !!assessed.trusted;
        }
        if (status === 'break' && firstBreak === -1) firstBreak = i;
        out.push({ text: line, status, note, ...(lineDiagnosis ? { diagnosis: lineDiagnosis } : {}) });
        return;
      }

      // Authored derivative metadata lets Pri verify the mathematical operation,
      // not merely whether the student's final expression happens to match.
      if (meta?.kind === 'derivative') {
        const assessed = assessDerivativeLine({ text: proseClean, meta });
        status = assessed.status;
        note = assessed.note;
        lineDiagnosis = assessed.diagnosis || null;
        if (status === 'break' && firstBreak === -1) firstBreak = i;
        out.push({ text: line, status, note, ...(lineDiagnosis ? { diagnosis: lineDiagnosis } : {}) });
        return;
      }

      const cleaned = normalize(proseClean);

      if (cleaned.includes('±') && meta.kind === 'equation' && cleaned.includes('=')) {
        const branchSols = (variant) => {
          try {
            const ast = parse(variant);
            if (ast.t !== 'equation') return null;
            return uniqueNumeric(meta.solutions).filter(sol => {
              const env = { [meta.variable]: sol };
              const L = evaluate(ast.l, env);
              const R = evaluate(ast.r, env);
              return Number.isFinite(L) && Number.isFinite(R) && Math.abs(L - R) <= Math.max(1e-6, Math.abs(L), Math.abs(R)) * 1e-6;
            });
          } catch { return null; }
        };
        const sp = branchSols(cleaned.replace(/±/g, '+'));
        const sm = branchSols(cleaned.replace(/±/g, '-'));
        if (sp !== null && sm !== null) {
          const wanted = uniqueNumeric(meta.solutions);
          const covered = uniqueNumeric([...sp, ...sm]);
          const ok = sp.length > 0 && sm.length > 0 && covered.length === wanted.length && wanted.every(sol => covered.some(v => numsClose(v, sol)));
          status = ok ? 'ok' : 'break';
          note = ok ? undefined : 'The ± branches do not reproduce the complete solution set — check the signs or the missing branch.';
          if (!ok) lineDiagnosis = lostRootDiagnosis(meta.variable, covered.join(' or ') || 'this branch', wanted.length);
          if (status === 'break' && firstBreak === -1) firstBreak = i;
          out.push({ text: line, status, note, ...(lineDiagnosis ? { diagnosis: lineDiagnosis } : {}) });
          return;
        }
      }

      if (meta.kind === 'equation') {
        if (cleaned.includes('=')) {
          const ast = parse(cleaned);
          if (ast.t === 'equation') {
            // The common case is a reversible rearrangement of a line already
            // proved correct. Verify that cheaply before invoking counterevidence.
            if (previousEquationTrusted && previousEquation && sameEquationClaim(previousEquation, ast, meta.variable)) {
              status = 'ok';
              previousEquation = ast;
              previousEquationTrusted = true;
            } else {
              const assessed = assessEquationLine({ ast, previousAst: previousEquation, previousTrusted: previousEquationTrusted, meta });
              status = assessed.status;
              note = assessed.note;
              lineDiagnosis = assessed.diagnosis || null;
              if (status !== 'break') {
                previousEquation = ast;
                previousEquationTrusted = !!assessed.trusted;
              }
            }
          }
        } else {
          const v = parseNumericInput(cleaned).value;
          const wanted = uniqueNumeric(meta.solutions);
          const near = wanted.some(sol => numsClose(v, sol));
          if (!near) {
            status = 'break';
            note = 'This value doesn’t satisfy the original equation.';
          } else if (wanted.length > 1) {
            status = 'break';
            lineDiagnosis = lostRootDiagnosis(meta.variable, v, wanted.length);
            note = lineDiagnosis.message;
          } else status = 'ok';
        }
      } else if (meta.kind === 'expression') {
        const candidate = cleaned.includes('=') ? cleaned.split('=').pop() : cleaned;
        const same = exprEquivalent(candidate, meta.canonical, { positiveOnly: meta.positiveOnly });
        status = same ? 'ok' : 'break';
        if (!same) note = 'This line is no longer equivalent to the expression you started with — the slip is here.';
      }
    } catch {
      status = 'note';
      note = 'Skipped — I couldn’t parse this line as maths.';
    }

    if (status === 'break' && firstBreak === -1) firstBreak = i;
    out.push({ text: line, status, note, ...(lineDiagnosis ? { diagnosis: lineDiagnosis } : {}) });
  });

  if (firstBreak === -1) return { lines: out, firstBreak, diagnosis: null };
  for (let i = firstBreak + 1; i < out.length; i++) {
    if (out[i].status === 'break') {
      out[i].status = 'note';
      out[i].note = 'Follows from the earlier slip.';
      delete out[i].diagnosis;
    }
  }

  let prevText = null;
  for (let i = firstBreak - 1; i >= 0; i--) {
    if (out[i].status === 'ok') { prevText = out[i].text; break; }
  }

  let diagnosis = out[firstBreak]?.diagnosis || null;
  if (!diagnosis || diagnosis.code === 'lost-solution') {
    try {
      const specific = diagnoseStep({ prevText, brokenText: out[firstBreak].text, meta });
      if (specific) diagnosis = specific;
    } catch { /* remain conservative */ }
  }
  if (diagnosis) {
    out[firstBreak].diagnosis = diagnosis;
    out[firstBreak].note = diagnosis.message;
  }
  return { lines: out, firstBreak, diagnosis };
}


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
