// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Answer checker + Pri Reason safety layer
//
// The mature answer-format checker remains in checker-core.js. This facade keeps
// that API stable while replacing equation Step Check with Pri Reason's
// precision-first transformation verifier.
// ─────────────────────────────────────────────────────────────────────────────

import { normalize, parse, evaluate, exprEquivalent, numsClose } from './expr.js';
import { diagnoseStep } from './diagnose.js';
import { assessEquationLine } from './reason.js';
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
    const cleaned = normalize(lastLine.text).replace(/^∴\s*/, '');
    if (ans.final?.kind === 'expr') {
      const cand = cleaned.includes('=') ? cleaned.split('=').pop() : cleaned;
      reached = exprEquivalent(cand, ans.final.expr, { positiveOnly: ans.final.positiveOnly });
    } else if (meta.kind === 'equation') {
      const re = new RegExp(`${meta.variable}\\s*=`);
      if (re.test(cleaned)) {
        const rhs = cleaned.split('=').pop();
        const parts = rhs.split(/,|\bor\b/).map(p => p.trim()).filter(Boolean);
        const vals = uniqueNumeric(parts.map(p => { try { return parseNumericInput(p).value; } catch { return NaN; } }));
        const wanted = uniqueNumeric(meta.solutions);
        reached = vals.length === wanted.length && vals.every(v => wanted.some(s => numsClose(v, s)));
      }
    } else {
      const cand = cleaned.includes('=') ? cleaned.split('=').pop() : cleaned;
      reached = exprEquivalent(cand, meta.canonical, {});
    }
  } catch { reached = false; }

  if (!reached) {
    return { correct: false, feedback: 'Your verified steps do not yet end with the complete result — state every solution or the requested simplified expression on the final line.', stepReport: report, validLines: okLines.length };
  }
  return { correct: true, stepReport: report, validLines: okLines.length };
}

export function stepCheck(meta, workingText) {
  const rawLines = String(workingText || '').split('\n').map(l => l.trim()).filter(Boolean);
  const out = [];
  let firstBreak = -1;
  let previousEquation = null;
  let previousEquationTrusted = false;

  rawLines.forEach((line, i) => {
    let status = 'note';
    let note;
    let lineDiagnosis = null;
    try {
      const cleaned = normalize(line).replace(/^∴\s*/, '').replace(/^(so|hence|then|therefore)\s+/i, '');

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
            const assessed = assessEquationLine({ ast, previousAst: previousEquation, previousTrusted: previousEquationTrusted, meta });
            status = assessed.status;
            note = assessed.note;
            lineDiagnosis = assessed.diagnosis || null;
            if (status !== 'break') {
              previousEquation = ast;
              previousEquationTrusted = !!assessed.trusted;
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
