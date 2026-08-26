// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Answer checker
// Marks a student's typed answer against a question's canonical answer.
// Accepts equivalent forms (fractions ↔ decimals, unsimplified surds, "x = 3",
// re-ordered solution sets, equivalent algebraic expressions) and returns
// targeted misconception feedback for recognised wrong answers.
// ─────────────────────────────────────────────────────────────────────────────

import { normalize, parse, evaluate, evalNumeric, exprEquivalent, numsClose, variablesOf } from './expr.js';
import { diagnoseStep } from './diagnose.js';

const UNIT_TAIL = /(cm³|m³|mm³|cm²|m²|mm²|km²|km\/h|m\/s|cm|mm|km|kg|ml|l\b|m\b|s\b|h\b|hours?|mins?|minutes?|seconds?|degrees?|deg|°|units?²?|sq units)\s*$/i;

/** Light clean: trim, strip currency/units/thousands separators, unify symbols. */
export function cleanInput(raw) {
  if (raw == null) return '';
  let s = String(raw).trim();
  s = s.replace(/^[a-zA-Zθ]\s*[=≈]\s*/, '');       // "x = 3" → "3"
  s = s.replace(UNIT_TAIL, '');
  return s.trim();
}

/** Parse a numeric-ish student answer: "2 1/2", "3/4", "50%", "$1,200", "sqrt(2)+1". */
export function parseNumericInput(raw) {
  let s = cleanInput(raw);
  if (!s) throw new Error('Empty answer');
  const meta = { isPercent: /%\s*$/.test(s), text: s };

  // mixed numeral: "2 1/2" or "-2 1/2" — also the handwritten form "2 (1)/(2)"
  const mixed = s.match(/^(-?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/) ||
    s.match(/^(-?)(\d+)\s*\((\d+)\)\s*\/\s*\((\d+)\)$/);
  if (mixed) {
    const sign = mixed[1] === '-' ? -1 : 1;
    const val = sign * (Number(mixed[2]) + Number(mixed[3]) / Number(mixed[4]));
    return { value: val, meta };
  }
  const value = evalNumeric(s);           // handles %, fractions, surds, pi, etc.
  return { value, meta };
}

/** Does the input look like a rounded decimal rather than an exact form? */
function looksLikeDecimalApprox(raw) {
  const s = normalize(cleanInput(raw));
  return /^-?\d+\.\d+$/.test(s);
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function splitList(raw) {
  const s = cleanInput(raw)
    .replace(/\bor\b/gi, ',')
    .replace(/\band\b/gi, ',')
    .replace(/;/g, ',');
  return s.split(',').map(p => p.trim()).filter(Boolean);
}

function matchTraps(question, studentValue, studentRaw) {
  const traps = question.traps || [];
  for (const trap of traps) {
    try {
      if (trap.value !== undefined && isNum(studentValue) && numsClose(studentValue, trap.value, trap.tol)) return trap.why;
      if (trap.expr !== undefined && exprEquivalent(cleanInput(studentRaw), trap.expr)) return trap.why;
    } catch { /* keep trying */ }
  }
  return null;
}

/**
 * Check a student answer. `question.answer` shape depends on answerType:
 *  numeric    { value, tol?, requireExact?, percent? }
 *  expression { expr, anyOf?, domain?, positiveOnly? }
 *  set        { values: [..], tol? }           — any order, "x=1 or x=-2" ok
 *  point      { x, y }                          — "(2, -3)"
 *  ratio      { a, b }                          — "2:3", "2 to 3", "2/3"
 *  mcq        { correctIndex }
 * Returns { correct, feedback?, normalized? }
 */
export function checkAnswer(question, rawInput) {
  const type = question.answerType;
  const ans = question.answer;
  try {
    // Optional form guard: reject inputs matching a forbidden pattern
    if (ans && ans.forbid) {
      const s = normalize(cleanInput(rawInput));
      if (new RegExp(ans.forbid, 'i').test(s)) {
        return { correct: false, feedback: ans.forbidWhy || 'That form isn’t fully simplified — rewrite it.' };
      }
    }
    // Surd-form questions: require k√r exactly (accepts 2sqrt5, 2*sqrt(5), 2√5)
    if (ans && ans.surdForm && type === 'numeric') {
      const s = normalize(cleanInput(rawInput)).replace(/\s|\*/g, '');
      const mm = s.match(/^(-?\d*)sqrt\(?(\d+)\)?$/);
      if (mm) {
        const k = mm[1] === '' ? 1 : mm[1] === '-' ? -1 : Number(mm[1]);
        const r = Number(mm[2]);
        if (k === ans.surdForm.k && r === ans.surdForm.r) return { correct: true };
        if (numsClose(k * Math.sqrt(r), ans.value)) {
          return { correct: false, feedback: `Equivalent — but not fully simplified: $\\sqrt{${r}}$ still contains a square factor.` };
        }
        const why = matchTraps(question, k * Math.sqrt(r), rawInput);
        return { correct: false, feedback: why ?? undefined };
      }
      try {
        const v = parseNumericInput(rawInput).value;
        if (numsClose(v, ans.value)) return { correct: false, feedback: 'Right value — but write it in simplified surd form $k\\sqrt{r}$ (e.g. 2sqrt(5)).' };
        const why = matchTraps(question, v, rawInput);
        return { correct: false, feedback: why ?? undefined };
      } catch {
        return { correct: false, feedback: 'Write your answer in the form $k\\sqrt{r}$, e.g. 2sqrt(5).' };
      }
    }
    switch (type) {
      case 'mcq': {
        const idx = Number(rawInput);
        return { correct: idx === ans.correctIndex };
      }

      case 'numeric': {
        const { value, meta } = parseNumericInput(rawInput);
        let target = ans.value;
        let ok = numsClose(value, target, ans.tol);
        // Fraction questions that demand simplest form (e.g. simplify 12/18 → 2/3)
        if (ans.simplestFraction) {
          const { n, d } = ans.simplestFraction;
          const s = cleanInput(rawInput).replace(/\s+/g, ' ');
          const frac = s.match(/^(-?\d+)\s*\/\s*(\d+)$/) || s.match(/^\((-?\d+)\)\s*\/\s*\((\d+)\)$/);
          const mixed = s.match(/^(-?)(\d+) (\d+)\s*\/\s*(\d+)$/) || s.match(/^(-?)(\d+) ?\((\d+)\)\s*\/\s*\((\d+)\)$/);
          let gn, gd;
          if (frac) { gn = Number(frac[1]); gd = Number(frac[2]); }
          else if (mixed) { const sign = mixed[1] === '-' ? -1 : 1; gd = Number(mixed[4]); gn = sign * (Number(mixed[2]) * gd + Number(mixed[3])); }
          else if (d !== 1) return { correct: false, feedback: 'Give your answer as a fraction in simplest form (like 2/3).' };
          if (gd !== undefined) {
            if (!numsClose(gn / gd, n / d)) {
              const why = matchTraps(question, gn / gd, rawInput);
              return { correct: false, feedback: why ?? undefined };
            }
            if (gn !== n || gd !== d) {
              const g = gcdInt(gn, gd);
              return { correct: false, feedback: `Equivalent — but not fully simplified. Divide top and bottom by ${g}.` };
            }
            return { correct: true };
          }
        }
        // Percentage forgiveness: expected 25 (%) but student typed 0.25, or vice versa
        if (!ok && ans.percent) {
          if (numsClose(value * 100, target, ans.tol)) ok = true;
          if (meta.isPercent && numsClose(value / 100, target, ans.tol)) ok = false;
        }
        if (ok && ans.requireExact && looksLikeDecimalApprox(rawInput)) {
          const exact = numsClose(value, target, Math.max(1e-9, Math.abs(target) * 1e-9));
          if (!exact) {
            return { correct: false, feedback: 'So close — but this question wants an exact value (leave it as a fraction, surd or multiple of π rather than a rounded decimal).' };
          }
        }
        if (!ok) {
          const why = matchTraps(question, value, rawInput);
          return { correct: false, feedback: why ?? undefined };
        }
        return { correct: true };
      }

      case 'expression': {
        let student = cleanInput(rawInput);
        if (ans.stripC) student = student.replace(/[+\-]\s*c\s*$/i, '').trim();
        const opts = { domain: ans.domain, positiveOnly: ans.positiveOnly };
        const candidates = [ans.expr, ...(ans.anyOf || [])];
        for (const cand of candidates) {
          if (exprEquivalent(student, cand, opts)) {
            // guard against a bare number matching an expression with variables
            const wantVars = variablesOf(parse(cand));
            if (wantVars.size > 0) {
              const gotVars = variablesOf(parse(student));
              if (gotVars.size === 0) continue;
            }
            return { correct: true };
          }
        }
        const why = matchTraps(question, null, rawInput);
        return { correct: false, feedback: why ?? undefined };
      }

      case 'set': {
        const parts = splitList(rawInput);
        const values = parts.map(p => parseNumericInput(p).value);
        const targets = [...ans.values];
        if (values.length !== targets.length) {
          return { correct: false, feedback: targets.length > values.length ? `There ${targets.length === 2 ? 'are two solutions' : `are ${targets.length} solutions`} — you've given ${values.length}.` : 'You have listed too many solutions.' };
        }
        for (const v of values) {
          const i = targets.findIndex(t => numsClose(v, t, ans.tol));
          if (i === -1) {
            const why = matchTraps(question, v, rawInput);
            return { correct: false, feedback: why ?? undefined };
          }
          targets.splice(i, 1);
        }
        return { correct: true };
      }

      case 'point': {
        const s = cleanInput(rawInput).replace(/^\(/, '').replace(/\)$/, '');
        const parts = s.split(/[,;]| {2,}/).map(p => p.trim()).filter(Boolean);
        if (parts.length !== 2) return { correct: false, feedback: 'Give your answer as a coordinate pair, like (2, -3).' };
        const x = parseNumericInput(parts[0]).value;
        const y = parseNumericInput(parts[1]).value;
        const ok = numsClose(x, ans.x, ans.tol) && numsClose(y, ans.y, ans.tol);
        if (!ok && numsClose(y, ans.x, ans.tol) && numsClose(x, ans.y, ans.tol)) {
          return { correct: false, feedback: 'Check the order — coordinates are written (x, y).' };
        }
        return ok ? { correct: true } : { correct: false, feedback: matchTraps(question, null, rawInput) ?? undefined };
      }

      case 'ratio': {
        let s = cleanInput(rawInput).replace(/\bto\b/gi, ':').replace(/\s+/g, '');
        let a, b;
        if (s.includes(':')) [a, b] = s.split(':').map(Number);
        else if (s.includes('/')) [a, b] = s.split('/').map(Number);
        else return { correct: false, feedback: 'Write the ratio in the form a : b.' };
        if (!isNum(a) || !isNum(b) || b === 0) return { correct: false };
        const ok = Math.abs(a * ans.b - b * ans.a) < 1e-9;
        if (ok && ans.simplified) {
          const g = gcdInt(Math.round(a), Math.round(b));
          if (g > 1) return { correct: false, feedback: `Right proportions — but simplify the ratio fully (divide both parts by ${g}).` };
        }
        if (!ok && Math.abs(a * ans.a - b * ans.b) < 1e-9 && ans.a !== ans.b) {
          return { correct: false, feedback: 'Check the order of the ratio — it looks reversed.' };
        }
        return { correct: ok };
      }

      case 'working':
        return checkWorking(question, String(rawInput ?? ''));

      default:
        return { correct: false, feedback: 'Unknown answer type.' };
    }
  } catch (err) {
    return { correct: false, invalid: true, feedback: "I couldn't read that as a maths answer — check for typos (e.g. write 3/4, 0.75, sqrt(2), 2pi, or (2, -3))." };
  }
}

function gcdInt(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; }

// ── "Show your working" questions ────────────────────────────────────────────
/**
 * Mark a working-type question: the submitted answer IS multi-line working.
 * q.answer = {
 *   stepMeta: {kind:'equation', variable, solutions} | {kind:'expression', canonical},
 *   minLines: 2,
 *   final: {kind:'solution'} | {kind:'expr', expr} — what the last line must state
 * }
 * Returns { correct, feedback, stepReport, validLines }
 */
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
    return { correct: false, feedback: `Show at least ${minLines} lines of mathematical working — I could only read ${parsed.length}.`, stepReport: report, validLines: okLines.length };
  }
  if (report.firstBreak !== -1) {
    const named = report.diagnosis && report.diagnosis.code !== 'counterexample'
      ? `${report.diagnosis.title} — line ${report.firstBreak + 1} is marked below.`
      : 'There’s a slip in your working — Step Check has marked the line where it breaks.';
    return { correct: false, feedback: named, stepReport: report, validLines: okLines.length };
  }
  // The final readable line must state the result
  const lastLine = [...report.lines].reverse().find(l => l.status === 'ok');
  if (!lastLine) return { correct: false, feedback: 'Finish your working with the final result on its own line.', stepReport: report, validLines: 0 };
  let reached = false;
  try {
    const cleaned = normalize(lastLine.text).replace(/^∴\s*/, '');
    if (ans.final?.kind === 'expr') {
      const cand = cleaned.includes('=') ? cleaned.split('=').pop() : cleaned;
      reached = exprEquivalent(cand, ans.final.expr, { positiveOnly: ans.final.positiveOnly });
    } else if (meta.kind === 'equation') {
      // must pin the variable to a solution: "x = 3" (or list all solutions)
      const re = new RegExp(`${meta.variable}\\s*=`);
      if (re.test(cleaned)) {
        const rhs = cleaned.split('=').pop();
        const parts = rhs.split(/,|\bor\b/).map(p => p.trim()).filter(Boolean);
        const vals = parts.map(p => { try { return parseNumericInput(p).value; } catch { return NaN; } });
        reached = vals.length > 0 && vals.every(v => meta.solutions.some(s => numsClose(v, s)));
      }
    } else {
      const cand = cleaned.includes('=') ? cleaned.split('=').pop() : cleaned;
      reached = exprEquivalent(cand, meta.canonical, {});
    }
  } catch { reached = false; }
  if (!reached) {
    return { correct: false, feedback: 'Your steps hold up, but the final line doesn’t state the result — end with the answer (e.g. "x = 3" or the simplified expression).', stepReport: report, validLines: okLines.length };
  }
  return { correct: true, stepReport: report, validLines: okLines.length };
}

// ── Step Check: line-by-line marking of working ─────────────────────────────
/**
 * Given a question's stepcheck meta and the student's working (one step per
 * line), locate the first line where the maths breaks.
 *  meta = { kind: 'equation', variable: 'x', solutions: [..] }
 *       | { kind: 'expression', canonical: '...' }
 * Returns { lines: [{ text, status: 'ok'|'break'|'note', note? }], firstBreak }
 */
export function stepCheck(meta, workingText) {
  const rawLines = String(workingText || '').split('\n').map(l => l.trim()).filter(Boolean);
  const out = [];
  let firstBreak = -1;

  rawLines.forEach((line, i) => {
    let status = 'note';
    let note;
    try {
      let cleaned = normalize(line).replace(/^∴\s*/, '').replace(/^(so|hence|then|therefore)\s+/i, '');
      // "x = 2 ± 3" → the two branches must land on the solution set between them
      if (cleaned.includes('±') && meta.kind === 'equation' && cleaned.includes('=')) {
        const branchSols = (variant) => {
          try {
            const ast = parse(variant);
            if (ast.t !== 'equation') return null;
            return meta.solutions.filter(sol => {
              const env = { [meta.variable]: sol };
              const L = evaluate(ast.l, env);
              const R = evaluate(ast.r, env);
              return Number.isFinite(L) && Number.isFinite(R) && Math.abs(L - R) <= Math.max(1e-6, Math.abs(R) * 1e-6);
            });
          } catch { return null; }
        };
        const sp = branchSols(cleaned.replace(/±/g, '+'));
        const sm = branchSols(cleaned.replace(/±/g, '-'));
        if (sp !== null && sm !== null) {
          const covered = new Set([...sp, ...sm]);
          const ok = sp.length > 0 && sm.length > 0 && covered.size >= Math.min(2, meta.solutions.length);
          out.push({ text: line, status: ok ? 'ok' : 'break', note: ok ? undefined : 'One branch of the ± doesn’t land on a solution — check the signs.' });
          if (!ok && firstBreak === -1) firstBreak = i;
          return;
        }
      }
      if (meta.kind === 'equation') {
        if (cleaned.includes('=')) {
          const ast = parse(cleaned);
          if (ast.t === 'equation') {
            const holds = meta.solutions.every(sol => {
              const env = { [meta.variable]: sol };
              const L = evaluate(ast.l, env);
              const R = evaluate(ast.r, env);
              return Number.isFinite(L) && Number.isFinite(R) && Math.abs(L - R) <= Math.max(1e-6, Math.abs(R) * 1e-6);
            });
            status = holds ? 'ok' : 'break';
            if (!holds) note = `This is the line where it goes wrong — the true solution no longer satisfies this equation. Compare it carefully with the line above.`;
          }
        } else {
          // a bare value — treat as a claimed solution
          const v = parseNumericInput(cleaned).value;
          const near = meta.solutions.some(sol => numsClose(v, sol));
          status = near ? 'ok' : 'break';
          if (!near) note = 'This value doesn’t satisfy the original equation.';
        }
      } else if (meta.kind === 'expression') {
        const target = meta.canonical;
        const candidate = cleaned.includes('=') ? cleaned.split('=').pop() : cleaned;
        const same = exprEquivalent(candidate, target, { positiveOnly: meta.positiveOnly });
        status = same ? 'ok' : 'break';
        if (!same) note = 'This line is no longer equivalent to the expression you started with — the slip is here.';
      }
    } catch {
      status = 'note';
      note = 'Skipped — I couldn’t parse this line as maths.';
    }
    if (status === 'break' && firstBreak === -1) firstBreak = i;
    out.push({ text: line, status, note });
  });

  // Everything after the first break is unreliable — soften to notes
  if (firstBreak === -1) return { lines: out, firstBreak, diagnosis: null };
  for (let i = firstBreak + 1; i < out.length; i++) {
    if (out[i].status === 'break') { out[i].status = 'note'; out[i].note = 'Follows from the earlier slip.'; }
  }

  // Knowing *where* it broke is the cheap half. Against the last line that was
  // still true, work out which move the student actually made and say so — a
  // named mistake is something a student can fix; "there is a slip here" is not.
  let prevText = null;
  for (let i = firstBreak - 1; i >= 0; i--) {
    if (out[i].status === 'ok') { prevText = out[i].text; break; }
  }
  let diagnosis = null;
  try { diagnosis = diagnoseStep({ prevText, brokenText: out[firstBreak].text, meta }); }
  catch { diagnosis = null; }
  if (diagnosis) {
    out[firstBreak].diagnosis = diagnosis;
    out[firstBreak].note = diagnosis.message;
  }
  return { lines: out, firstBreak, diagnosis };
}
