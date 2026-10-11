// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Answer checker + Pri Reason safety layer
//
// The mature answer-format checker remains in checker-core.js. This facade keeps
// that API stable while routing mathematical working through Pri Reason.
// ─────────────────────────────────────────────────────────────────────────────

import { normalize, parse, evaluate, exprEquivalent, numsClose, variablesOf, withEvaluationBudget } from './expr.js';

// Every sum term and counting-loop turn spent while one answer or one page of
// working is checked comes out of this — see "What an evaluation may cost" in expr.js.
const EVALUATION_BUDGET = 50000;
import { diagnoseStep } from './diagnose.js';
import { answerTooLong } from './checker-core.js';
import {
  assessEquationLine, sameEquationClaim, sameExpressionClaim,
  assessRelationLine, assessDerivativeLine, differentiateAst, parseRelation
} from './reason-v2-safe.js';
import { assessEvaluationLine, assessPointLine } from './reason-v3.js';
import { assessRelationChainLine, assessModulusInequalityLine } from './reason-v4.js';
import { assessAreaLine, AREA_STAGE_KINDS } from './reason-area.js';
import { cleanInput, parseNumericInput, checkAnswer as coreCheckAnswer } from './checker-core.js';

export { cleanInput, parseNumericInput };

function malformedRatioInput(rawInput) {
  const s = cleanInput(rawInput).replace(/\bto\b/gi, ':').replace(/\s+/g, '');
  const hasColon = s.includes(':');
  const hasSlash = s.includes('/');
  if (hasColon && hasSlash) return true;
  if (!hasColon && !hasSlash) return false;
  const parts = s.split(hasColon ? ':' : '/');
  return parts.length !== 2 || parts.some(part => part === '');
}

export function checkAnswer(question, rawInput) {
  return unlessStopped(() => withEvaluationBudget(EVALUATION_BUDGET, () => checkAnswerWithinBudget(question, rawInput)), unverifiedAnswer);
}
function checkAnswerWithinBudget(question, rawInput) {
  if (question?.answerType === 'working') return checkWorking(question, String(rawInput ?? ''));
  const long = answerTooLong(rawInput);
  if (long) return long;
  if (question?.answerType === 'ratio' && malformedRatioInput(rawInput)) {
    return { correct: false, feedback: 'Write the ratio with exactly two parts, like 2 : 3.' };
  }
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

// ── Diagnosis confidence ─────────────────────────────────────────────────────
// Every diagnosis that leaves Step Check says how sure the engine is. `high`
// means exactly one authored move reproduces the student's line, or the line
// was disproved outright against the authored solution; `medium` means more
// than one move fits, or the verdict rests on a counterexample alone. The copy
// a student reads hedges medium ("This looks like …") and states high.
export const DIAGNOSIS_CONFIDENCE = ['high', 'medium'];

function withConfidence(diagnosis) {
  if (!diagnosis || typeof diagnosis !== 'object') return diagnosis;
  const confidence = DIAGNOSIS_CONFIDENCE.includes(diagnosis.confidence) ? diagnosis.confidence : 'medium';
  return diagnosis.confidence === confidence ? diagnosis : { ...diagnosis, confidence };
}

/** The one-line verdict for a broken line, hedged when the diagnosis is not certain. */
export function diagnosisVerdict(diagnosis, lineNumber) {
  const d = withConfidence(diagnosis);
  if (!d || d.code === 'counterexample') return 'There’s a slip in your working — Step Check has marked the line where it breaks.';
  const where = lineNumber ? ` — line ${lineNumber} is marked below.` : '.';
  return d.confidence === 'high' ? `${d.title}${where}` : `This looks like: ${d.title}${where}`;
}

// ── Pairs of linear equations (and any system with one authored solution) ───
// A system pins its solution, so every equation a student writes on the way is
// a consequence of it exactly when it holds at that solution — the line can be
// proved or disproved by substitution alone, whichever variable it is in. A
// pair "x = 2, y = 3" and a point "(2, 3)" are read the same way.
function systemDiagnosis(vars, sol, L, R) {
  const fmt = v => Number(Number(v).toPrecision(10));
  return {
    code: 'system-line-false',
    title: 'This line is not true for the solution of the system',
    message: `With ${vars.map(v => `${v} = ${fmt(sol[v])}`).join(' and ')} — the solution of the pair — this line reads ${fmt(L)} = ${fmt(R)}, which is false.`,
    fix: 'Compare it term by term with the line above: a term or a sign changed on the way, or the substitution was made into the wrong equation.',
    confidence: 'high'
  };
}

export function assessSystemLine({ text, meta = null } = {}) {
  const vars = Array.isArray(meta?.variables) && meta.variables.length ? meta.variables : Object.keys(meta?.solution || {});
  const sol = meta?.solution || {};
  if (!vars.length || vars.some(v => !Number.isFinite(Number(sol[v])))) {
    return { status: 'note', trusted: false, note: 'Pri needs the authored solution of the system before it can verify this line.' };
  }
  const env = {};
  for (const v of vars) env[v] = Number(sol[v]);
  const src = String(text || '').trim().replace(/[−–—]/g, '-').replace(/^∴\s*/, '').replace(/^(so|hence|then|therefore)\s+/i, '');
  if (!src) return { status: 'note', trusted: false, note: 'Skipped — an empty line.' };

  const holds = ast => {
    const L = evaluate(ast.l, env), R = evaluate(ast.r, env);
    if (!Number.isFinite(L) || !Number.isFinite(R)) return null;
    return { same: Math.abs(L - R) <= Math.max(1e-6, Math.abs(L), Math.abs(R)) * 1e-6, L, R };
  };

  // "(2, 3)" — the solution as a point, in the order the variables were named
  if (vars.length === 2 && !src.includes('=')) {
    const assessed = assessPointLine({ text: src, meta: { kind: 'point', x: env[vars[0]], y: env[vars[1]] } });
    if (assessed.status !== 'note') return assessed;
  }
  if (!src.includes('=')) return { status: 'note', trusted: false, note: 'Skipped — this line makes no claim Pri can test against the solution.' };

  // "x = 2, y = 3" / "x = 2 and y = 3" — every part must hold
  const parts = src.split(/,|;|\band\b/i).map(p => p.trim()).filter(Boolean);
  if (!parts.length) return { status: 'note', trusted: false, note: 'Skipped — I couldn’t read this line safely.' };
  for (const part of parts) {
    let ast;
    try { ast = parse(normalize(part)); } catch { return { status: 'note', trusted: false, note: 'Skipped — I couldn’t parse this line as maths.' }; }
    if (ast.t !== 'equation') return { status: 'note', trusted: false, note: 'Skipped — this is not an equation.' };
    const h = holds(ast);
    if (!h) return { status: 'note', trusted: false, note: 'Skipped — this line could not be evaluated at the solution.' };
    if (!h.same) {
      const diagnosis = systemDiagnosis(vars, sol, h.L, h.R);
      return { status: 'break', trusted: false, note: diagnosis.message, diagnosis };
    }
  }
  return { status: 'ok', trusted: true };
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
  // "x + 3 = 0 or x + 6 = 0" is how NCERT writes the two branches of a factorised
  // quadratic on one line. Each part names its root as directly as "x = -3".
  const branch = new RegExp(`^${variable}\\s*([+-])\\s*(.+?)\\s*=\\s*0$`, 'i');
  const values = [];
  for (let part of parts) {
    part = part.replace(lead, '').trim();
    if (!part) return { values: [], invalid: true };
    if (part.includes('=')) {
      const m = part.match(branch);
      if (!m) return { values: [], invalid: true };
      try { values.push((m[1] === '+' ? -1 : 1) * parseNumericInput(m[2]).value); }
      catch { return { values: [], invalid: true }; }
      continue;
    }
    try { values.push(parseNumericInput(part).value); }
    catch { return { values: [], invalid: true }; }
  }
  return { values: uniqueNumeric(values), invalid: false };
}

export function checkWorking(q, workingText) {
  return unlessStopped(() => withEvaluationBudget(EVALUATION_BUDGET, () => checkWorkingWithinBudget(q, workingText)), unverifiedAnswer);
}
function checkWorkingWithinBudget(q, workingText) {
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
    return { correct: false, feedback: diagnosisVerdict(report.diagnosis, report.firstBreak + 1), stepReport: report, validLines: okLines.length };
  }

  // A student who finishes by substituting their answer back has still finished
  // at the line before it: the check states no new result.
  const lastLine = [...report.lines].reverse().find(l => l.status === 'ok' && !l.check);
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
        reached = exprEquivalent(cand, ans.final.expr, { positiveOnly: ans.final.positiveOnly, isolatedDomain: true, strictDomain: ans.final.strictDomain === true });
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

// ── The zero-product branch ──────────────────────────────────────────────────
// "(x + 3)(x + 6) = 0 → x + 3 = 0, x + 6 = 0" is the method NCERT prints. Each
// branch is true of exactly one root by construction, so a checker that
// demands every authored solution satisfy every line calls the taught method a
// mistake and greys out everything after it. A line whose solutions are a
// non-empty proper subset of the authored ones is read as a branch once a
// trusted product-equals-zero line has been shown above it. Nothing is
// forgiven: if the working ends without the branches between them covering
// every root, the first branch becomes the lost-root break it always was.

/** Is this line a product (or a power) set equal to zero? */
function productEqualsZero(ast) {
  if (!ast || ast.t !== 'equation') return false;
  const isZero = (side) => {
    const n = unwrapGroup(side);
    return n && n.t === 'num' && Math.abs(n.v) < 1e-12;
  };
  const isProduct = (side) => {
    const n = unwrapGroup(side);
    if (!n) return false;
    if (n.t === 'neg') return isProduct(n.v);
    return n.t === 'bin' && (n.op === '*' || n.op === '^');
  };
  return (isZero(ast.r) && isProduct(ast.l)) || (isZero(ast.l) && isProduct(ast.r));
}

/** Which of the authored solutions satisfy this line. */
function solutionsSatisfying(ast, meta) {
  const wanted = uniqueNumeric(meta?.solutions);
  if (!ast || ast.t !== 'equation' || !meta?.variable || !wanted.length) return [];
  const held = [];
  for (const sol of wanted) {
    try {
      const env = { [meta.variable]: sol };
      const L = evaluate(ast.l, env);
      const R = evaluate(ast.r, env);
      if (Number.isFinite(L) && Number.isFinite(R)
          && Math.abs(L - R) <= Math.max(1e-6, Math.abs(L), Math.abs(R)) * 1e-6) held.push(sol);
    } catch { /* a branch Pri cannot evaluate is not a branch */ }
  }
  return held;
}

// ── A line about another unknown ─────────────────────────────────────────────
// "Solve 3x + 5y = 5 and 5x − 2y = 29. Find the value of y" is marked against
// y, but the working is in both letters: x = 5 is true, and so is −31x = −155.
// Judged against y alone, a line that never mentions y cannot hold "when
// y = −2", so every one of them was called the first mistake. A true statement
// is never a mistake. A line in a letter the question's own equation does not
// carry is checked at the solution of the system when the question pins one,
// and is otherwise a note: neither a mistake nor credit.

/** The letters in `ast` that are neither the unknown nor in the authored equation. */
function foreignLetters(ast, meta) {
  if (!ast || meta?.kind !== 'equation' || !meta.variable) return [];
  const own = new Set([meta.variable]);
  for (const text of [meta.source, ...(Array.isArray(meta.sources) ? meta.sources : [])]) {
    if (typeof text !== 'string') continue;
    try { variablesOf(parse(normalize(text)), own); } catch { /* an unreadable source names no letters */ }
  }
  return [...variablesOf(ast)].filter(name => !own.has(name));
}

const holdsWithin = (L, R) => Number.isFinite(L) && Number.isFinite(R)
  && Math.abs(L - R) <= Math.max(1e-6, Math.abs(L), Math.abs(R)) * 1e-6;

/**
 * The one point a question's equations pin, when they pin one: the authored
 * value of the unknown, and the single other letter the equations carry, read
 * off one of them and confirmed by a second. Anything less — one equation, a
 * third letter, a disagreement — is no system, and nothing is assumed.
 */
function pinnedSystem(meta, prompt = '') {
  if (meta?.kind !== 'equation' || !meta.variable) return null;
  const roots = uniqueNumeric(meta.solutions);
  if (roots.length !== 1) return null;
  let equations;
  try { equations = questionClaims(meta, prompt).filter(c => c.kind === 'equation'); } catch { return null; }
  const letters = new Set();
  for (const c of equations) variablesOf(c.ast, letters);
  if (!letters.has(meta.variable)) return null;
  letters.delete(meta.variable);
  if (letters.size !== 1) return null;
  const [other] = letters;
  const sides = (c, value) => {
    const env = { [meta.variable]: roots[0], [other]: value };
    return [evaluate(c.ast.l, env), evaluate(c.ast.r, env)];
  };
  let value = null;
  for (const c of equations) {
    if (!variablesOf(c.ast).has(other)) continue;
    let f;
    try { f = [0, 1, 2].map(x => { const [L, R] = sides(c, x); return L - R; }); } catch { continue; }
    if (!f.every(Number.isFinite)) continue;
    const slope = f[1] - f[0];
    if (numsClose(slope, 0) || !numsClose(f[2] - f[1], slope)) continue;   // does not pin it, or not linear in it
    value = -f[0] / slope;
    break;
  }
  if (value === null || !Number.isFinite(value)) return null;
  let confirmed = 0;
  for (const c of equations) {
    let L, R;
    try { [L, R] = sides(c, value); } catch { return null; }
    if (!holdsWithin(L, R)) return null;
    if (variablesOf(c.ast).has(other)) confirmed++;
  }
  if (confirmed < 2) return null;
  return { variables: [meta.variable, other], solution: { [meta.variable]: roots[0], [other]: value } };
}

/** Is this equation true whatever its letters stand for? */
function holdsForEveryValue(ast) {
  const names = [...variablesOf(ast)];
  let seen = 0;
  for (let k = 0; k < UNKNOWN_PROBES.length; k++) {
    const env = {};
    names.forEach((name, i) => { env[name] = UNKNOWN_PROBES[(k + i) % UNKNOWN_PROBES.length] + 0.173 * i; });
    let L, R;
    try { L = evaluate(ast.l, env); R = evaluate(ast.r, env); } catch { continue; }
    if (!Number.isFinite(L) || !Number.isFinite(R)) continue;
    if (!numsClose(L, R)) return false;
    seen++;
  }
  return seen >= 3;
}

/** The verdict on an equation line that carries a letter the question's equation does not. */
function assessOtherUnknownLine(ast, system) {
  if (holdsForEveryValue(ast)) {
    return { status: 'note', note: 'True whatever the letters stand for — it says nothing about this question.' };
  }
  const known = system && [...variablesOf(ast)].every(name => name in system.solution);
  if (!known) {
    return { status: 'note', note: 'This line is about another letter. Pri has nothing in this question to check it against, so it is neither marked wrong nor counted.' };
  }
  let L, R;
  try { L = evaluate(ast.l, system.solution); R = evaluate(ast.r, system.solution); } catch { L = R = NaN; }
  if (!Number.isFinite(L) || !Number.isFinite(R)) {
    return { status: 'note', note: 'Skipped — this line could not be evaluated at the solution.' };
  }
  if (holdsWithin(L, R)) return { status: 'ok' };
  const diagnosis = systemDiagnosis(system.variables, system.solution, L, R);
  return { status: 'break', note: diagnosis.message, diagnosis };
}

// On a differentiation, `y = 26`, `m = 5` and `2m + 1 = 11` say that something
// which does not depend on the variable equals a number: a value of the
// function, a gradient at a point, a letter the student named. Unless the
// derivative is itself a constant, that is not a claim about the derivative,
// and reading it as one calls a true line a broken rule.
function namesAValue(text, meta) {
  const parts = String(text || '').replace(/[−–—]/g, '-').split('=');
  if (parts.length !== 2 || /['′]/.test(parts[0])) return false;
  try {
    const variable = meta?.variable || 'x';
    const named = parse(normalize(parts[0])), value = parse(normalize(parts[1]));
    const bareVariable = unwrapGroup(named)?.t === 'var';     // `x = -3`: where, not what the derivative is
    if (!variablesOf(named).size || (variablesOf(named).has(variable) && !bareVariable)) return false;
    if (variablesOf(value).size || !Number.isFinite(evaluate(value, {}))) return false;
    const derivative = typeof meta?.canonical === 'string'
      ? parse(normalize(meta.canonical))
      : differentiateAst(parse(normalize(meta.source)), variable);
    return [0.37, 1.91, -2.43].some(x => !numsClose(evaluate(derivative, { [variable]: x }), evaluate(derivative, { [variable]: x + 1 })));
  } catch { return false; }
}

// ── How much working is read ─────────────────────────────────────────────────
// Checking a line costs time that grows faster than its length: a line of
// 8000 characters of `(x+1)(x+1)…` took four seconds, on the thread every
// other request waits on. So the engine itself — whoever calls it — reads only
// what a page of working can be:
//   · a line of more than 300 characters is not read;
//   · no more than 100 lines are read;
//   · the lines read are bounded together, by the sum of the squares of their
//     lengths (sixteen lines of 300 characters, or a hundred of 120).
// A line that is not read is returned as a note saying so. It is neither a
// mistake nor credit, and nothing after the budget is spent is credited. The
// bound is on the text, not the clock, so the same working is always marked
// the same way; the clock is only a backstop that these bounds keep idle.
//
// WHEN THE CLOCK DOES STOP A CHECK. How long a line takes depends on what else
// the machine is doing, so a line the clock skipped is not a fact about the
// working. It used to be returned as an ordinary unread line, which earns
// nothing — and a short, valid page of working marked on a busy machine lost
// marks it earns on an idle one (`(x-1)(x+3)=0`, `x-1=0`, `x+3=0` read 1 of 3).
// A mark must be a function of what was written. So a check the clock stopped
// has NO result: every public entry of this file says so, with
// `unverified: true`, and gives no mark, no verdict and no line-by-line
// report to read one from —
//   · stepCheck:   { unverified: true, firstBreak: -1, lines: every line a note }
//   · methodMarks: { unverified: true, awarded: 0, lines: [] }  (never a count of what happened to finish)
//   · checkAnswer / checkWorking: { correct: false, invalid: true, unverified: true }
// `invalid` is this engine's existing word for "not an attempt": no try is
// spent and nothing is recorded, so the same entry can simply be sent again.
// The 750 ms ceiling itself is unchanged.
export const WORKING_LIMITS = Object.freeze({ lineChars: 200, lines: 100, work: 600000, backstopMs: 750 });
const UNREAD = {
  long: `Not checked — this line is longer than ${WORKING_LIMITS.lineChars} characters. Write one step per line.`,
  many: 'Not checked — this is more working than can be checked. Keep to the steps of your method.'
};
/** What a check the clock stopped says: nothing was marked. */
export const UNVERIFIED_NOTE = 'This could not be checked this time, so nothing was marked. Send it again.';
// The clock the backstop reads. A test puts its own here to stop a check at a
// chosen line; nothing else may (`setBackstopClockForTests`).
let backstopClock = () => Date.now();
export function setBackstopClockForTests(clock) {
  const previous = backstopClock;
  backstopClock = typeof clock === 'function' ? clock : () => Date.now();
  return previous;
}
// How many times the clock has stopped a line since this module loaded. A
// public entry compares it before and after: any change means its result is
// not a result.
let backstopTrips = 0;
const unverifiedReport = (workingText, report = null) => ({
  unverified: true, firstBreak: -1,
  lines: (report?.lines?.length ? report.lines.map(l => String(l?.text ?? '')) : String(workingText || '').split('\n').map(l => l.trim()).filter(Boolean))
    .map(text => ({ text, status: 'note', note: UNVERIFIED_NOTE, unread: true }))
});
const unverifiedAnswer = () => ({ correct: false, invalid: true, unverified: true, feedback: UNVERIFIED_NOTE });
const unverifiedMethod = report => ({ unverified: true, okLines: 0, progressLines: 0, restatedLines: 0, awarded: 0, note: UNVERIFIED_NOTE, lines: [], report });
/** Run a check; if the clock stopped any line of it, return `whenStopped()` instead of what it produced. */
function unlessStopped(check, whenStopped) {
  const before = backstopTrips;
  const out = check();
  return backstopTrips === before ? out : whenStopped(out);
}

/** For each line of working, null when it is to be read, or the note saying why it is not. */
function unreadLines(rawLines) {
  let spent = 0, closed = false;
  const started = backstopClock();
  return rawLines.map((line, index) => {
    if (line.length > WORKING_LIMITS.lineChars) return UNREAD.long;
    spent += line.length * line.length;
    if (closed || index >= WORKING_LIMITS.lines || spent > WORKING_LIMITS.work) { closed = true; return UNREAD.many; }
    return () => {
      if (!(backstopClock() - started > WORKING_LIMITS.backstopMs)) return null;
      backstopTrips += 1;
      return UNREAD.many;
    };
  });
}
const unreadNote = entry => (typeof entry === 'function' ? entry() : entry);

function stepCheckSingle(meta, workingText, system = null, { loneBranches = false } = {}) {
  const rawLines = String(workingText || '').split('\n').map(l => l.trim()).filter(Boolean);
  const unread = unreadLines(rawLines);
  const out = [];
  let firstBreak = -1;
  let previousEquation = null;
  let previousEquationTrusted = false;
  let previousRelation = null;
  let previousRelationTrusted = false;
  let branchesOpen = false;
  const branchLines = [];

  rawLines.forEach((line, i) => {
    const skipped = unreadNote(unread[i]);
    if (skipped) { out.push({ text: line, status: 'note', note: skipped, unread: true }); return; }
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
        out.push({ text: line, status, note, ...(status === 'ok' ? { coversAll: true } : {}), ...(lineDiagnosis ? { diagnosis: lineDiagnosis } : {}) });
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

      if (meta?.kind === 'chained-inequality') {
        const assessed = assessRelationChainLine({ text: proseClean, meta });
        status = assessed.status;
        note = assessed.note;
        lineDiagnosis = assessed.diagnosis || null;
        if (status === 'break' && firstBreak === -1) firstBreak = i;
        out.push({ text: line, status, note, ...(lineDiagnosis ? { diagnosis: lineDiagnosis } : {}) });
        return;
      }

      if (meta?.kind === 'modulus-inequality') {
        const assessed = assessModulusInequalityLine({ text: proseClean, meta });
        status = assessed.status;
        note = assessed.note;
        lineDiagnosis = assessed.diagnosis || null;
        if (status === 'break' && firstBreak === -1) firstBreak = i;
        out.push({ text: line, status, note, ...(lineDiagnosis ? { diagnosis: lineDiagnosis } : {}) });
        return;
      }

      // A pair of linear equations (or any system with one authored solution):
      // every line is proved or disproved at the solution point.
      if (meta?.kind === 'system') {
        const assessed = assessSystemLine({ text: proseClean, meta });
        status = assessed.status;
        note = assessed.note;
        lineDiagnosis = assessed.diagnosis || null;
        if (status === 'break' && firstBreak === -1) firstBreak = i;
        out.push({ text: line, status, note, ...(lineDiagnosis ? { diagnosis: lineDiagnosis } : {}) });
        return;
      }

      // Authored derivative metadata lets Pri verify the mathematical operation,
      // not merely whether the student's final expression happens to match.
      if (meta?.kind === 'derivative') {
        const assessed = namesAValue(proseClean, meta)
          ? { status: 'note', note: 'This gives a value, not a derivative, so it is not checked as one.' }
          : assessDerivativeLine({ text: proseClean, meta });
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
          // An accepted ± line has already been proved to reproduce every root.
          out.push({ text: line, status, note, ...(ok ? { coversAll: true } : {}), ...(lineDiagnosis ? { diagnosis: lineDiagnosis } : {}) });
          return;
        }
      }

      if (meta.kind === 'equation') {
        if (cleaned.includes('=')) {
          const ast = parse(cleaned);
          if (ast.t === 'equation' && foreignLetters(ast, meta).length) {
            const assessed = assessOtherUnknownLine(ast, system);
            status = assessed.status;
            note = assessed.note;
            lineDiagnosis = assessed.diagnosis || null;
            if (status === 'break' && firstBreak === -1) firstBreak = i;
            out.push({ text: line, status, note, otherUnknown: true, ...(lineDiagnosis ? { diagnosis: lineDiagnosis } : {}) });
            return;
          }
          if (ast.t === 'equation') {
            const wantedRoots = uniqueNumeric(meta.solutions);
            // A line of lower degree than the equation — `x - 3 = 4` after
            // `(x - 3)^2 = 16`, one branch of the quadratic formula — names
            // one root and is true of it. It is a branch whether or not a
            // product was written first.
            const names = side => unwrapGroup(side)?.t === 'var' && unwrapGroup(side).v === meta.variable;
            const valued = (names(ast.l) && !variablesOf(ast.r).size) || (names(ast.r) && !variablesOf(ast.l).size);
            // (Only where the whole working is read at once: a stage of a plan
            // is checked a line at a time, and one limit is not the pair.)
            const lone = loneBranches && !branchesOpen && wantedRoots.length > 1 && (valued || !!linearState({ kind: 'equation', ast }, meta.variable));
            const held = (branchesOpen || lone) && wantedRoots.length > 1 ? solutionsSatisfying(ast, meta) : [];
            if (held.length && held.length < wantedRoots.length) {
              // One branch of a factorisation already shown. It is true of the
              // roots it names; whether the working keeps the rest is settled
              // once every line has been read.
              status = 'ok';
              branchLines.push({ index: i, covered: held, lone });
              out.push({ text: line, status, branch: true });
              return;
            }
            // The common case is a reversible rearrangement of a line already
            // proved correct. Verify that cheaply before invoking counterevidence.
            if (previousEquationTrusted && previousEquation && sameEquationClaim(previousEquation, ast, meta.variable)) {
              status = 'ok';
              previousEquation = ast;
              previousEquationTrusted = true;
              if (productEqualsZero(ast)) branchesOpen = true;
            } else {
              const assessed = assessEquationLine({ ast, previousAst: previousEquation, previousTrusted: previousEquationTrusted, meta });
              status = assessed.status;
              note = assessed.note;
              lineDiagnosis = assessed.diagnosis || null;
              // A mistake is a line that is false for the question. A line
              // that every answer satisfies and that would also let in
              // another value — `a^2 = 4` where the question says a > 0,
              // `n(n - 1) = 20` where n counts things — is true: the
              // question's own conditions decide between its values. Where
              // it is what the student starts from, it is a note, not the
              // point after which nothing is credited. Where it FOLLOWS a
              // verified line with the answer's values and no others
              // (`x = 5` then `x^2 = 25`), the step itself let the extra
              // value in, and that stays the mistake.
              if (status === 'break' && lineDiagnosis?.code === 'extraneous-solution' &&
                  !previousEquationTrusted && typeof meta.source !== 'string' &&
                  solutionsSatisfying(ast, meta).length === uniqueNumeric(meta.solutions).length) {
                status = 'note';
                note = `True for the answer. It would also allow another value of ${meta.variable}, which the question's conditions rule out — check each value against the question.`;
                lineDiagnosis = null;
              }
              if (assessed.check) {
                // A check of the answer makes no claim to reason from.
                out.push({ text: line, status, note, check: true, ...(lineDiagnosis ? { diagnosis: lineDiagnosis } : {}) });
                if (status === 'break' && firstBreak === -1) firstBreak = i;
                return;
              }
              if (status !== 'break') {
                previousEquation = ast;
                previousEquationTrusted = !!assessed.trusted;
                if (assessed.trusted && productEqualsZero(ast)) branchesOpen = true;
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

  // Branches were allowed on the promise that the working keeps every root.
  // If it does not, the first branch is the line where the root was lost.
  if (branchLines.length) {
    const wanted = uniqueNumeric(meta.solutions);
    const covered = uniqueNumeric(branchLines.flatMap(b => b.covered));
    const listedInFull = out.some(l => l.status === 'ok' && l.coversAll);
    const complete = covered.length === wanted.length && wanted.every(sol => covered.some(v => numsClose(v, sol)));
    if (!listedInFull && !complete && branchLines.every(b => b.lone)) {
      // One branch written alone, with no product before it that promised
      // the rest: a true statement about the root it names, not a mistake.
      // The answer is still incomplete, and the final line is judged on that.
      for (const b of branchLines) {
        out[b.index].note = `True for ${meta.variable} = ${b.covered.join(' or ')} — the equation has ${wanted.length} solutions, and the other is still to find.`;
      }
    } else if (!listedInFull && !complete) {
      const { index } = branchLines[0];
      const diagnosis = lostRootDiagnosis(meta.variable, covered.join(' or ') || 'this branch', wanted.length);
      out[index] = { text: out[index].text, status: 'break', note: diagnosis.message, diagnosis };
      firstBreak = firstBreak === -1 ? index : Math.min(firstBreak, index);
    }
  }

  if (firstBreak === -1) return { lines: out, firstBreak, diagnosis: null };
  for (let i = firstBreak + 1; i < out.length; i++) {
    if (out[i].status === 'break' || out[i].branch) {
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
  if (!diagnosis || diagnosis.code === 'lost-solution' || diagnosis.code === 'system-line-false') {
    try {
      const specific = diagnoseStep({ prevText, brokenText: out[firstBreak].text, meta });
      if (specific) diagnosis = specific;
    } catch { /* remain conservative */ }
  }
  if (diagnosis) {
    diagnosis = withConfidence(diagnosis);
    out[firstBreak].diagnosis = diagnosis;
    out[firstBreak].note = diagnosis.message;
  }
  return { lines: out, firstBreak, diagnosis };
}


// ── Pri Reason V3: authored multi-operation proof plans ─────────────────────
// A plan is a list of already-safe verifiers with prerequisites between them.
// A stage cannot be credited before its prerequisites: a later-stage truth
// shown before them is recognised only as a note. This preserves the V1/V2
// prove/disprove/abstain contract while allowing a real solution to move from
// differentiation into solving and substitution.
//
// Stage order (marking-10). By default every stage requires the one before it,
// which is the authored order. A plan may declare that stages are independent
// so any valid order of working is accepted:
//
//   { kind: 'plan', anyOrder: true, stages: [...] }   every stage independent
//   { kind: 'evaluation', ..., independent: true }     this stage needs nothing
//   { kind: 'equation', ..., requires: [0, 2] }        explicit prerequisites
//
// The rule: a line earns credit for a stage only when every stage that stage
// requires has already been verified in the working above it. Stages with no
// requirement between them may appear in either order (solve for x before y or
// y before x; compute the three minors of a determinant in any order). A stage
// that names a prerequisite still cannot be skipped — a substitution stage
// that requires the derivative stage is a note, never credit, until the
// derivative has been shown. Nothing here makes a wrong line right: a line
// that disproves an available stage is a break wherever it appears.

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
  if (stage.kind === 'chained-inequality') return assessRelationChainLine({ text: line, meta: stage });
  if (stage.kind === 'modulus-inequality') return assessModulusInequalityLine({ text: line, meta: stage });
  if (AREA_STAGE_KINDS.has(stage.kind)) {
    return assessAreaLine({
      text: line, meta: stage,
      checkEquation: (equationMeta, clause) => stepCheckSingle(equationMeta, clause).lines?.[0]?.status === 'ok'
    });
  }
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
      if (ast.t === 'equation' && foreignLetters(ast, stage).length) {
        return { ...assessOtherUnknownLine(ast, null), trusted: false };
      }
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

/** The prerequisite stages of each stage — the authored order unless the plan says otherwise. */
export function planRequirements(meta) {
  const stages = Array.isArray(meta?.stages) ? meta.stages.filter(Boolean) : [];
  return stages.map((stage, i) => {
    if (Array.isArray(stage?.requires)) {
      return [...new Set(stage.requires.filter(r => Number.isInteger(r) && r >= 0 && r < stages.length && r !== i))];
    }
    if (stage?.independent === true || meta?.anyOrder === true) return [];
    return i === 0 ? [] : [i - 1];
  });
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

  const requires = planRequirements(meta);
  const out = [];
  const completed = new Set();
  let active = 0;
  let firstBreak = -1;
  let diagnosis = null;

  const ready = idx => requires[idx].every(r => completed.has(r));

  const unread = unreadLines(rawLines);
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const skipped = unreadNote(unread[i]);
    if (skipped) { out.push({ text: line, status: 'note', note: skipped, unread: true, stage: active }); continue; }
    if (firstBreak !== -1) {
      out.push({ text: line, status: 'note', note: 'Follows from the earlier slip.', stage: active });
      continue;
    }

    // Every verdict on this line is drawn once and kept.
    const verdicts = new Map();
    const assess = idx => {
      if (!verdicts.has(idx)) verdicts.set(idx, assessPlanStage(stages[idx], line));
      return verdicts.get(idx);
    };
    const open = [];        // not yet verified, prerequisites verified
    const blocked = [];     // not yet verified, a prerequisite still missing
    for (let idx = 0; idx < stages.length; idx++) {
      if (completed.has(idx)) continue;
      (ready(idx) ? open : blocked).push(idx);
    }
    const done = [...completed].sort((a, b) => b - a);   // most recent first

    // 1. A line that proves an available stage completes it.
    const proved = open.find(idx => assess(idx).status === 'ok');
    if (proved !== undefined) {
      completed.add(proved);
      active = proved;
      out.push({ text: line, status: 'ok', stage: proved });
      continue;
    }

    // 2. Do not falsely call a correct later-stage result an error merely
    //    because its prerequisite working was omitted. It still cannot earn
    //    credit, so it receives a note.
    const later = blocked.find(idx => assess(idx).status === 'ok');
    if (later !== undefined) {
      out.push({
        text: line, status: 'note', stage: active,
        note: 'This matches a later result, but Pri has not yet verified the prerequisite stage, so it cannot receive step credit.'
      });
      continue;
    }

    // 3. A line that disproves an available stage is the break.
    const broken = open.find(idx => assess(idx).status === 'break');
    if (broken !== undefined) {
      const verdict = assess(broken);
      active = broken;
      firstBreak = i;
      diagnosis = verdict.diagnosis || null;
      out.push({ text: line, status: 'break', stage: broken, note: verdict.note, ...(diagnosis ? { diagnosis } : {}) });
      continue;
    }

    // 4. Another equivalent form within a stage already verified (for
    //    example the source equation and then x = 2) keeps that stage's credit.
    const again = done.find(idx => assess(idx).status === 'ok');
    if (again !== undefined) {
      out.push({ text: line, status: 'ok', stage: again });
      continue;
    }

    // 5. Equation solvers have strong exact solution-set diagnostics. A wrong
    //    root written after the equation stage was verified is a real break,
    //    not an unsupported next operation.
    const wrongRoot = done.find(idx => stages[idx].kind === 'equation' && assess(idx).status === 'break');
    if (wrongRoot !== undefined) {
      const verdict = assess(wrongRoot);
      firstBreak = i;
      diagnosis = verdict.diagnosis || null;
      out.push({ text: line, status: 'break', stage: wrongRoot, note: verdict.note, ...(diagnosis ? { diagnosis } : {}) });
      continue;
    }

    // 6. Abstain, saying why the nearest stage could not use the line.
    const reason = [...open, ...done].map(idx => assess(idx).note).find(Boolean);
    out.push({
      text: line, status: 'note', stage: active,
      note: reason || 'Pri could not prove which authored operation this line belongs to.'
    });
  }

  if (diagnosis) {
    diagnosis = withConfidence(diagnosis);
    out[firstBreak].diagnosis = diagnosis;
  }
  return {
    lines: out,
    firstBreak,
    diagnosis,
    completedStages: completed.size,
    totalStages: stages.length
  };
}

/**
 * Check working line by line. `options.prompt` is the question as the student
 * saw it: with it, a line about a second unknown is checked against the
 * equations the question gives; without it, such a line is a note.
 */
export function stepCheck(meta, workingText, options = null) {
  return unlessStopped(() => withEvaluationBudget(EVALUATION_BUDGET, () => stepCheckWithinBudget(meta, workingText, options)),
    report => unverifiedReport(workingText, report));
}
function stepCheckWithinBudget(meta, workingText, options = null) {
  if (meta?.kind === 'plan') return stepCheckPlan(meta, workingText);
  return stepCheckSingle(meta, workingText, pinnedSystem(meta, typeof options?.prompt === 'string' ? options.prompt : ''), { loneBranches: true });
}

// ── Method marks (marking-11) ────────────────────────────────────────────────
// One rule for Practice and for exams: a mark for each verified line that
// moves the solution on, capped one below the question's marks (the final mark
// is for the answer). A line that restates the question — the equation or
// expression the prompt gave — earns nothing, and a step written twice is
// counted once.

const TEX_MATH = /\$([^$]+)\$/g;

/** A KaTeX span reduced to what the expression engine reads; null when it cannot be. */
function plainTex(tex) {
  let s = String(tex || '');
  for (let guard = 0; guard < 6 && /\\d?frac/.test(s); guard++) {
    s = s.replace(/\\d?frac\s*(\{[^{}]*\}|[0-9a-zA-Z])\s*(\{[^{}]*\}|[0-9a-zA-Z])/g, (_, a, b) =>
      `((${a.replace(/^\{|\}$/g, '')})/(${b.replace(/^\{|\}$/g, '')}))`);
  }
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, 'sqrt($1)')
    .replace(/\\(times|cdot)/g, '*').replace(/\\div/g, '/')
    .replace(/\\le(q|qslant)?\b/g, '<=').replace(/\\ge(q|qslant)?\b/g, '>=')
    .replace(/\\(left|right|,|;|!|quad|qquad|displaystyle)/g, '')
    .replace(/\\pi/g, 'pi')
    .replace(/[{}]/g, '');
  if (/\\[a-zA-Z]+/.test(s)) return null;   // a command the engine has no reading of
  return s.trim();
}

function readClaim(text) {
  if (String(text ?? '').length > WORKING_LIMITS.lineChars) return null;     // not read: see "How much working is read"
  const src = String(text ?? '').trim()
    .replace(/[−–—]/g, '-')
    .replace(/^∴\s*/, '')
    .replace(/^(so|hence|then|therefore)\s+/i, '');
  if (!src) return null;
  const relation = parseRelation(src);
  if (relation) return { kind: 'relation', relation };
  try {
    const ast = parse(normalize(src));
    return ast.t === 'equation' ? { kind: 'equation', ast } : { kind: 'expression', ast };
  } catch { return null; }
}

// ── What counts as restating the question ────────────────────────────────────
// A line restates the question when it is that line written again: the same
// symbols, allowing spacing, unicode notation, an explicit ×, the order of a
// sum or a product, and the two sides of an equation swapped.
//
// It is NOT enough for the line to be logically equivalent to the question.
// Every valid rearrangement of an equation is equivalent to it, so defining
// restatement as equivalence made every correct step a copy of the question:
// "Solve 2x − 7 = −11" with working 2x − 7 = −11 / 2x = −4 / x = −2 earned no
// method marks at all, while the exam path — which counts verified lines —
// awarded two. Restatement is a syntactic test, and only a syntactic one.

function unwrapGroup(node) {
  let out = node;
  while (out && out.t === 'group') out = out.v;
  return out;
}

/** Flatten one commutative operator's chain, rewriting a − b as a + (−b). */
function commutativeParts(node, op, acc = []) {
  const n = unwrapGroup(node);
  if (n && n.t === 'bin' && (n.op === op || (op === '+' && n.op === '-'))) {
    commutativeParts(n.l, op, acc);
    if (n.op === '-') acc.push({ t: 'neg', v: n.r });
    else commutativeParts(n.r, op, acc);
    return acc;
  }
  acc.push(n);
  return acc;
}

/** A canonical rendering of what was written, not of what it means. */
function writtenKey(node) {
  const n = unwrapGroup(node);
  if (!n || typeof n !== 'object') return '?';
  switch (n.t) {
    case 'num': return `#${Number(n.v)}`;
    case 'var': return `v${n.v}`;
    case 'const': return `k${n.v}`;
    case 'neg': {
      const inner = unwrapGroup(n.v);
      if (inner && inner.t === 'num') return `#${-Number(inner.v)}`;
      return `-(${writtenKey(n.v)})`;
    }
    case 'fact': return `!(${writtenKey(n.v)})`;
    case 'call': return `${n.fn}(${(Array.isArray(n.args) ? n.args : [n.arg]).map(writtenKey).join(',')})`;
    case 'bin': {
      if (n.op === '+' || n.op === '-' || n.op === '*') {
        const op = n.op === '-' ? '+' : n.op;
        return `${op}(${commutativeParts(n, op).map(writtenKey).sort().join(',')})`;
      }
      return `${n.op}(${writtenKey(n.l)},${writtenKey(n.r)})`;
    }
    default: return '?';
  }
}

const MIRRORED_RELATION = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' };

/** Is this line the same line, written again? */
function sameWrittenClaim(a, b) {
  if (!a || !b || a.kind !== b.kind) return false;
  try {
    if (a.kind === 'relation') {
      const [al, ar] = [writtenKey(a.relation.l), writtenKey(a.relation.r)];
      const [bl, br] = [writtenKey(b.relation.l), writtenKey(b.relation.r)];
      if (a.relation.op === b.relation.op) return al === bl && ar === br;
      return MIRRORED_RELATION[a.relation.op] === b.relation.op && al === br && ar === bl;
    }
    if (a.kind === 'equation') {
      const [al, ar] = [writtenKey(a.ast.l), writtenKey(a.ast.r)];
      const [bl, br] = [writtenKey(b.ast.l), writtenKey(b.ast.r)];
      return (al === bl && ar === br) || (al === br && ar === bl);
    }
    if (a.kind === 'text') return String(a.text).trim() === String(b.text).trim();
    return writtenKey(a.ast) === writtenKey(b.ast);
  } catch { return false; }
}

/** The claims a question hands the student: authored sources and the maths spans of the prompt. */
export function questionClaims(meta, prompt = '') {
  const texts = [];
  if (meta && typeof meta === 'object') {
    if (typeof meta.source === 'string') texts.push(meta.source);
    if (Array.isArray(meta.sources)) texts.push(...meta.sources.filter(s => typeof s === 'string'));
    if (Array.isArray(meta.stages)) {
      for (const stage of meta.stages) {
        if (stage && typeof stage.source === 'string' && stage.kind !== 'derivative' && stage.kind !== 'evaluation') texts.push(stage.source);
      }
    }
  }
  for (const m of String(prompt || '').matchAll(TEX_MATH)) {
    const plain = plainTex(m[1]);
    // An expression task hands the student an expression; a relation task a relation.
    if (plain && (/[=<>≤≥]/.test(plain) || meta?.kind === 'expression')) texts.push(plain);
  }
  return texts.map(readClaim).filter(Boolean);
}

/** Does this line of working merely restate the question? */
export function restatesQuestion(line, meta, prompt = '') {
  const claim = readClaim(line);
  if (!claim) return false;
  return questionClaims(meta, prompt).some(c => sameWrittenClaim(claim, c));
}

/**
 * Normalise ONLY arithmetic identities, not full algebraic equivalence.
 *
 * Solving an equation normally preserves its solution set. Treating every
 * equivalent equation as a duplicate would erase legitimate method marks for
 * subtraction, distribution, fraction clearing and alternate solution paths.
 * These four identities do not change the written mathematical state at all:
 * +0, -0, *1 and /1. Keep all other transformations visible to the rubric.
 */
function withoutNeutralArithmetic(node) {
  const n = unwrapGroup(node);
  if (!n || typeof n !== 'object') return n;
  // A sub-expression with no unknown in it that is exactly 0 or 1 (`2^0`,
  // `sqrt(1)`, `3-3`) is the literal it equals; anything else is left as written.
  const fixed = constantValue(n);
  if (fixed === 0 || fixed === 1) return { t: 'num', v: fixed };
  if (n.t === 'neg') return { ...n, v: withoutNeutralArithmetic(n.v) };
  if (n.t === 'call') {
    return Array.isArray(n.args)
      ? (() => { const args = n.args.map(withoutNeutralArithmetic); const call = { ...n, args }; Object.defineProperty(call, 'arg', { value: args[0], enumerable: false, writable: true, configurable: true }); return call; })()
      : { ...n, arg: withoutNeutralArithmetic(n.arg) };
  }
  if (n.t !== 'bin') return n;
  const l = withoutNeutralArithmetic(n.l);
  const r = withoutNeutralArithmetic(n.r);
  const isNumber = (part, value) => literalValue(part) === value;
  if (n.op === '+' && isNumber(r, 0)) return l;
  if (n.op === '+' && isNumber(l, 0)) return r;
  if (n.op === '-' && isNumber(r, 0)) return l;
  if (n.op === '*' && isNumber(r, 1)) return l;
  if (n.op === '*' && isNumber(l, 1)) return r;
  if (n.op === '/' && isNumber(r, 1)) return l;
  if (n.op === '^' && isNumber(r, 1)) return l;
  return cancelInsertedPairs({ ...n, l, r });
}

const literalValue = node => {
  const p = unwrapGroup(node);
  if (p?.t === 'num') return Number(p.v);
  if (p?.t === 'neg') {
    const v = unwrapGroup(p.v);
    if (v?.t === 'num') return -Number(v.v);
  }
  return null;
};

function constantValue(node) {
  try {
    if (variablesOf(node).size) return null;
    const value = evaluate(node, {});
    return Number.isFinite(value) ? (numsClose(value, 0) ? 0 : numsClose(value, 1) ? 1 : value) : null;
  } catch { return null; }
}

/**
 * `+1-1`, `+x-x` and `*2/2`, `*m/m` are the same non-step as `+0` and `*1`,
 * spelt with two terms instead of one. Inside one sum, a term is removed only
 * together with its own exact negative; inside one product, a factor only with
 * the identical divisor. Every other term and factor stays exactly as written,
 * so collecting, expanding, factorising and evaluating remain visible.
 */
function cancelInsertedPairs(node) {
  const sameWritten = (x, y) => { try { return writtenKey(x) === writtenKey(y); } catch { return false; } };
  if (node.op === '+' || node.op === '-') {
    const terms = [];
    const walk = (part, sign) => {
      const p = unwrapGroup(part);
      if (p?.t === 'bin' && (p.op === '+' || p.op === '-')) {
        walk(p.l, sign); walk(p.r, p.op === '-' ? -sign : sign);
      } else if (p?.t === 'neg') walk(p.v, -sign);
      else terms.push({ sign, node: p });
    };
    walk(node, 1);
    let cancelled = false;
    // Several literals that together add nothing (`+2-1-1`).
    const literals = terms.filter(t => literalValue(t.node) !== null);
    for (let size = literals.length; size >= 2 && !cancelled; size--) {
      const tail = literals.slice(literals.length - size);
      if (tail.reduce((sum, t) => sum + t.sign * literalValue(t.node), 0) === 0 &&
          tail.every(t => literalValue(t.node) !== 0)) {
        for (const t of tail) terms[terms.indexOf(t)] = null;
        cancelled = true;
      }
    }
    for (let i = 0; i < terms.length; i++) {
      if (!terms[i] || literalValue(terms[i].node) === 0) continue;
      for (let j = i + 1; j < terms.length; j++) {
        if (terms[j] && terms[j].sign === -terms[i].sign && sameWritten(terms[i].node, terms[j].node)) {
          terms[i] = terms[j] = null; cancelled = true; break;
        }
      }
    }
    if (!cancelled) return node;
    const kept = terms.filter(Boolean);
    if (!kept.length) return { t: 'num', v: 0 };
    let acc = kept[0].sign < 0 ? { t: 'neg', v: kept[0].node } : kept[0].node;
    for (const term of kept.slice(1)) acc = { t: 'bin', op: term.sign < 0 ? '-' : '+', l: acc, r: term.node };
    return acc;
  }
  if (node.op === '*' || node.op === '/') {
    const factors = [];
    const walk = (part, power) => {
      const p = unwrapGroup(part);
      if (p?.t === 'bin' && (p.op === '*' || p.op === '/')) {
        walk(p.l, power); walk(p.r, p.op === '/' ? -power : power);
      } else factors.push({ power, node: p });
    };
    walk(node, 1);
    let cancelled = false;
    for (let i = 0; i < factors.length; i++) {
      if (!factors[i]) continue;
      const lit = literalValue(factors[i].node);
      if (lit === 0 || lit === 1) continue;
      for (let j = i + 1; j < factors.length; j++) {
        if (factors[j] && factors[j].power === -factors[i].power && sameWritten(factors[i].node, factors[j].node)) {
          factors[i] = factors[j] = null; cancelled = true; break;
        }
      }
    }
    if (!cancelled) return node;
    const top = factors.filter(f => f && f.power > 0), bottom = factors.filter(f => f && f.power < 0);
    let acc = top.length ? top[0].node : { t: 'num', v: 1 };
    for (const f of top.slice(1)) acc = { t: 'bin', op: '*', l: acc, r: f.node };
    for (const f of bottom) acc = { t: 'bin', op: '/', l: acc, r: f.node };
    return acc;
  }
  return node;
}

const symbolCount = node => {
  const n = unwrapGroup(node);
  if (!n || typeof n !== 'object') return 0;
  if (n.t === 'neg' || n.t === 'fact') return 1 + symbolCount(n.v);
  if (n.t === 'call') return 1 + (Array.isArray(n.args) ? n.args : [n.arg]).reduce((t, x) => t + symbolCount(x), 0);
  if (n.t === 'bin') return 1 + symbolCount(n.l) + symbolCount(n.r);
  return 1;
};
const claimSides = c => c?.kind === 'equation' ? [c.ast.l, c.ast.r]
  : c?.kind === 'relation' ? [c.relation.l, c.relation.r]
  : c?.kind === 'expression' ? [c.ast] : null;

/**
 * Is `line` the reference written again? Exactly the same line always is. So
 * is the reference with identities padded into it (`+0`, `*1`, `^1`, `+1-1`,
 * `+x-x`, `*m/m`, `+2^0-1`) — on an equation, an inequality or an expression.
 * A line that is the same once identities are removed but is written SHORTER
 * than the reference has evaluated or collected something, and is a step.
 */
function methodProgressDuplicate(line, reference) {
  if (sameWrittenClaim(line, reference)) return true;
  const ls = claimSides(line), rs = claimSides(reference);
  if (!ls || !rs || line.kind !== reference.kind) return false;
  const strip = c => c.kind === 'relation'
    ? { ...c, relation: { ...c.relation, l: withoutNeutralArithmetic(c.relation.l), r: withoutNeutralArithmetic(c.relation.r) } }
    : c.kind === 'equation'
      ? { ...c, ast: { ...c.ast, l: withoutNeutralArithmetic(c.ast.l), r: withoutNeutralArithmetic(c.ast.r) } }
      : { ...c, ast: withoutNeutralArithmetic(c.ast) };
  let same = false;
  try { same = sameWrittenClaim(strip(line), strip(reference)); } catch { same = false; }
  if (!same) return false;
  const size = sides => sides.reduce((t, side) => t + symbolCount(side), 0);
  return size(ls) >= size(rs);
}

/** An isolated final value is an answer claim, not a new method step. */
function isolatedFinalAnswer(claim, meta) {
  if (meta?.kind !== 'equation' || claim?.kind !== 'equation') return false;
  const solutions = uniqueNumeric(meta.solutions);
  if (solutions.length !== 1) return false;
  const l = withoutNeutralArithmetic(claim.ast.l);
  const r = withoutNeutralArithmetic(claim.ast.r);
  const isVariable = node => unwrapGroup(node)?.t === 'var'
    && unwrapGroup(node).v === meta.variable;
  const other = isVariable(l) ? r : isVariable(r) ? l : null;
  if (!other) return false;
  try {
    const value = evaluate(other, {});
    return Number.isFinite(value) && numsClose(value, solutions[0]);
  } catch { return false; }
}

/**
 * A single straightforward linear operation can transform a *shown* authored
 * equation directly into its root, without an intermediate line:
 *   2t = t - 3 -> t = -3          (subtract t)
 *   x + 2 = 4 -> x = 2           (subtract 2)
 *   3x = 6 -> x = 2              (divide by 3)
 * This is ONE verified method step, not an extra award for saying the answer.
 * Arbitrary solutions, e.g. 6m+15=7m+29 -> m=-14, demand more than one
 * operation and must show genuine intermediate progress for method credit.
 *
 * The calculation only recognises exact affine arithmetic from a single
 * variable; unsupported/nonlinear/domain-sensitive equations fail closed.
 */
function oneStepLinearRoot(meta, originals) {
  if (meta?.kind !== 'equation' || !meta.variable || uniqueNumeric(meta.solutions).length !== 1) return false;
  const linear = node => affineSide(node, meta.variable);
  for (const source of originals) {
    if (source?.kind !== 'equation') continue;
    const l = linear(source.ast.l), r = linear(source.ast.r);
    if (!l || !r || ![l.a,l.b,r.a,r.b].every(Number.isFinite)) continue;
    const a = l.a - r.a, b = r.b - l.b;
    if (!a || !numsClose(b / a, Number(meta.solutions[0]))) continue;
    // One step: remove a variable term when the other side's coefficient
    // becomes 1 and one side has no constant to also collect.
    const subtractVariable = Math.abs(a) === 1 && (l.b === 0 || r.b === 0);
    // Or operate once on an already isolated single variable: subtract a
    // constant, or divide a single coefficient (not BOTH).
    const singleSide = (l.a === 0) !== (r.a === 0);
    const singleOperation = singleSide &&
      (Math.abs(a) === 1 || (l.b === 0 && r.b === 0));
    if (subtractVariable || singleOperation) return true;
  }
  return false;
}

/** `a·v + b` for one side of an equation, or null when the side is not affine in v. */
function affineSide(node, variable) {
  const n = unwrapGroup(node);
  if (!n) return null;
  if (n.t === 'num') return { a: 0, b: Number(n.v) };
  if (n.t === 'var') return n.v === variable ? { a: 1, b: 0 } : null;
  if (n.t === 'neg') {
    const v = affineSide(n.v, variable);
    return v ? { a: -v.a, b: -v.b } : null;
  }
  if (n.t !== 'bin') return null;
  const l = affineSide(n.l, variable), r = affineSide(n.r, variable);
  if (!l || !r) return null;
  if (n.op === '+') return { a: l.a + r.a, b: l.b + r.b };
  if (n.op === '-') return { a: l.a - r.a, b: l.b - r.b };
  if (n.op === '*') {
    if (l.a && r.a) return null;
    return { a: l.a * r.b + l.b * r.a, b: l.b * r.b };
  }
  if (n.op === '/' && r.a === 0 && r.b !== 0) return { a: l.a / r.b, b: l.b / r.b };
  return null;
}

/**
 * Where a written linear equation stands on the way to `v = root`.
 *
 * Every equivalent equation has the same solution set, so equivalence cannot
 * tell a step from a restatement. What a step changes is how much isolating
 * is still to do. Each side is read as written (a·v + b, never moved across
 * the equals sign), and the state is ordered by:
 *   left  — isolating moves still owed: the variable's coefficient is not 1
 *           (a coefficient of 1 counts as done only once the variable is gone
 *           from the other side — in `3m+12=m+8` the lone `m` is not isolated),
 *           a constant still sits beside the variable, the variable still
 *           appears on the other side;
 *   fractional — coefficients that are not whole numbers (clearing them is a step);
 *   written — undistributed brackets, then additive terms, then symbols, which
 *           orders two lines whose sides are already the same (expanding,
 *           collecting and evaluating are steps; padding is not).
 * Adding the same number to both sides, doubling both sides, or inserting
 * `+1-1` / `*2/2` leaves all of these where they were.
 */
function linearState(claim, variable) {
  const written = claim?.kind === 'equation' || claim?.kind === 'relation' ? claimSides(claim) : null;
  if (!written || !variable) return null;
  const l = affineSide(written[0], variable), r = affineSide(written[1], variable);
  if (!l || !r || ![l.a, l.b, r.a, r.b].every(Number.isFinite)) return null;
  if (numsClose(l.a, r.a)) return null;
  // Moves still owed, counted the same whichever side the student collects on:
  // the unknown on both sides (three: collecting it can leave a constant and a
  // coefficient to clear, and scaling the equation before collecting is not a move); each constant that still has to move (both of
  // them while the unknown is on both sides, the one beside it afterwards);
  // and a net coefficient that still has to be divided out.
  const zero = x => numsClose(x, 0);
  const both = !zero(l.a) && !zero(r.a);
  const own = zero(r.a) ? l : r;
  const left = both
    ? 3 + (zero(l.b) ? 0 : 1) + (zero(r.b) ? 0 : 1)
    : (zero(own.b) ? 0 : 1) + (numsClose(own.a, 1) ? 0 : 1);
  const whole = x => numsClose(x, Math.round(x));
  let brackets = 0, terms = 0, symbols = 0;
  const walk = node => {
    const n = unwrapGroup(node);
    if (!n || typeof n !== 'object') return;
    symbols++;
    if (n.t === 'neg') return walk(n.v);
    if (n.t !== 'bin') return;
    if (n.op === '+' || n.op === '-') terms++;
    if (n.op === '*' || n.op === '/') {
      for (const side of [n.l, n.r]) {
        const inner = unwrapGroup(side);
        if (inner?.t === 'bin' && (inner.op === '+' || inner.op === '-')) brackets++;
      }
    }
    walk(n.l); walk(n.r);
  };
  walk(written[0]); walk(written[1]);
  return {
    sides: [l.a, l.b, r.a, r.b],
    left,
    fractional: [l.a, l.b, r.a, r.b].filter(x => !whole(x)).length,
    written: [brackets, terms, symbols],
    size: [symbolCount(written[0]), symbolCount(written[1])]
  };
}

/** Are the sides `f` the sides `g` (as written, or swapped) all multiplied by one number other than 1? */
function scaledSides(f, g) {
  const [a, b, c, d] = g;
  return [[a, b, c, d], [c, d, a, b]].some(ref => {
    const pivot = ref.findIndex(v => !numsClose(v, 0));
    if (pivot < 0 || numsClose(f[pivot], 0)) return false;
    const k = f[pivot] / ref[pivot];
    return !numsClose(k, 1) && ref.every((v, i) => numsClose(f[i], v * k));
  });
}

/** Is `f` the equation `g` with the same amount added to, or the same factor applied to, both sides — each side written longer? */
function announcedOnBothSides(f, g) {
  const [a, b, c, d] = g.sides;
  return [[[a, b, c, d], g.size], [[c, d, a, b], [g.size[1], g.size[0]]]].some(([ref, size]) => {
    if (!(f.size[0] > size[0] && f.size[1] > size[1])) return false;
    const shifted = numsClose(f.sides[0] - ref[0], f.sides[2] - ref[2]) && numsClose(f.sides[1] - ref[1], f.sides[3] - ref[3]);
    return shifted || scaledSides(f.sides, ref);
  });
}

/** Is linear state `f` strictly further on than `g`? */
function linearStateAdvances(f, g) {
  // Scaling both sides isolates nothing, so it is a step only once it has been
  // carried out: `x + 2 = 3x` from `6x + 12 = 18x`, `x + 2 = 8` from
  // `x/2 + 1 = 4`. Wrapping each side in a bracket and writing the factor
  // beside it — `(4x + 10)/2 = (-2x + 46)/2`, `2(0.4f - 0.7) = 2(0.1f - 2.5)` —
  // announces the operation without doing it.
  const carriedOut = f.written[0] <= g.written[0];
  const same = (x, y) => x.every((v, i) => numsClose(v, y[i]));
  // The same holds where the scaling also brings a coefficient to 1, which
  // reads as one move fewer owed: `(2y - 12)/2 = (-22)/2` — and
  // `(2y - 12)/2 = -11`, where only the bare number was worked out — is
  // `2y - 12 = -22` with the division still to do on the side that carries
  // the unknown.
  if (!carriedOut && scaledSides(f.sides, g.sides)) return false;
  // One thing done to both sides and written beside each — `2x - 7 + 7 =
  // -11 + 7`, `6m + 11 - 3m = 3m + 20 - 3m` — is the reference with the
  // operation announced: each side is the reference's side and more. The step
  // is the line that carries it out (`2x = -4`), which is no longer than what
  // it came from on at least one side.
  if (announcedOnBothSides(f, g)) return false;
  // Nor is a line a step while it is written in more terms than what it comes
  // from: `6m + 11 - (3m + 20) = 0` and `6m + 11 - (3m + 20) + 1 = 1` have
  // moved everything and collected nothing. Moving a term across, expanding a
  // bracket and clearing a fraction leave the count where it was or lower.
  if (f.written[1] > g.written[1]) return false;
  if (f.left < g.left) return true;
  if (f.left > g.left) return false;
  if (f.fractional < g.fractional && carriedOut) return true;
  // Dividing a whole-number equation through by a common factor.
  if (!f.fractional && !g.fractional && carriedOut) {
    const pivot = g.sides.findIndex((v, i) => !numsClose(v, 0) && !numsClose(f.sides[i], 0));
    const k = pivot < 0 ? 0 : g.sides[pivot] / f.sides[pivot];
    if (Number.isInteger(Math.round(k)) && numsClose(k, Math.round(k)) && Math.abs(k) > 1 &&
        same(g.sides, f.sides.map(v => v * k))) return true;
  }
  const [a, b, c, d] = g.sides;
  if (!same(f.sides, g.sides) && !same(f.sides, [c, d, a, b])) return false;
  for (let i = 0; i < f.written.length; i++) {
    if (f.written[i] !== g.written[i]) return f.written[i] < g.written[i];
  }
  return false;
}

/**
 * Is `line` the equation `reference` with one thing done to both sides — the
 * same expression added to both (any h(x): a number, `m^2`, `sin x`, a term
 * moved across), or both multiplied or divided by the same thing (any g(x),
 * including `(L)/(R) = 1` and, where a side is zero, any multiple of the other
 * side)? Checked numerically at fixed points, either way round. Such a line
 * has the reference's solutions by construction: it can be written without
 * solving anything. It can be a real step where the equation is not linear
 * (moving a constant across, completing the square, clearing a denominator),
 * but repeating it is never a second one.
 * Returns 'same' when both sides are unchanged as functions.
 */
function rescalesBothSides(line, reference, variable) {
  if (line?.kind !== 'equation' || reference?.kind !== 'equation' || !variable) return false;
  const at = (node, x) => evaluate(node, { [variable]: x });
  let image = false;
  try {
    for (const [left, right] of [[line.ast.l, line.ast.r], [line.ast.r, line.ast.l]]) {
      let same = true, shifted = true, scaled = true, seen = 0;
      for (const x of [0.37, 1.91, -2.43, 5.13, 0.83]) {
        const [ll, lr, gl, gr] = [at(left, x), at(right, x), at(reference.ast.l, x), at(reference.ast.r, x)];
        if (![ll, lr, gl, gr].every(Number.isFinite)) continue;
        seen++;
        // The same h(x) added to both sides; the same g(x) applied to both
        // (cross-multiplied, so a side that is zero stays zero).
        if (!numsClose(ll - gl, lr - gr)) shifted = false;
        if (!numsClose(ll - gl, 0) || !numsClose(lr - gr, 0)) same = false;
        if (!numsClose(ll * gr, lr * gl)) scaled = false;
      }
      if (seen < 3) continue;
      if (same) return 'same';
      if (shifted || scaled) image = true;
    }
  } catch { return false; }
  return image;
}

// Does this line say anything about the unknown? Not when it holds for every
// value of the unknown.
const UNKNOWN_PROBES = [1.37, -2.11, 5.03, 0.29];

// ── Working with no letter in it ─────────────────────────────────────────────
// `3 + 4 = 7` is true on every question ever set, so a true sum cannot earn a
// method mark for being true: any amount of it would fill the marks. Nor can
// it earn one for being built from the numbers the question prints: a handful
// of small numbers folds into the answer in many ways that are not the method
// (`6/3 = 2; 60 - 4 = 56; 56/2 = 28; 22 - 28 = -6` "solves" a pair of
// equations), and nothing in a sum says which fold the student meant. No
// general rule tells arithmetic that is the method from arithmetic that
// happens to land, so none is applied: where a method is arithmetic (a
// gradient from two points, a z-score), its marks need an authored plan for
// that question (`meta.kind === 'plan'`), which says which quantities the
// method computes.
//
// One letter-free line is working, because the question itself authors it —
// a check of a root. The line is the question's own equation in the unknown
// alone with a root put in for the unknown. It may be written out (`4(6) + 10 = -2(6) + 46`) or,
// when the unknown stands on both sides of the equation so that neither
// side's value is printed in the question, with each term of both sides
// worked out (`24 + 10 = -12 + 46`; not `24 + 10 = 34`, which shows one side
// only). When one side of the question is a bare number, only the written-out
// form counts: `-4 - 7 = -11` reaches a number the question shows, and so
// does every other sum that comes to -11.

/** Is `line` the tree `given` with each letter replaced, consistently, by a number? */
function substitutedInto(given, line, bound) {
  const g = unwrapGroup(given);
  if (g?.t === 'var') {
    let value;
    try { value = evaluate(line, {}); } catch { return false; }
    if (!Number.isFinite(value) || variablesOf(line).size) return false;
    if (bound.has(g.v) && !numsClose(bound.get(g.v), value)) return false;
    bound.set(g.v, value);
    return true;
  }
  const l = unwrapGroup(line);
  if (!g || !l || typeof g !== 'object' || typeof l !== 'object') return false;
  if (g.t !== l.t || g.op !== l.op || g.fn !== l.fn) return false;
  if (g.t === 'num') return numsClose(g.v, l.v);
  for (const key of new Set([...Object.keys(g), ...Object.keys(l)])) {
    const a = g[key], b = l[key];
    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
      if (!a.every((item, i) => substitutedInto(item, b[i], bound))) return false;
    } else if ((a && typeof a === 'object') || (b && typeof b === 'object')) {
      if (!substitutedInto(a, b, bound)) return false;
    } else if (key === 'v' && a !== b) return false;
  }
  return true;
}

/** The terms of a sum, in the order written, each with its sign folded in. */
function additiveTerms(node, sign = 1, acc = []) {
  const n = unwrapGroup(node);
  if (n?.t === 'bin' && (n.op === '+' || n.op === '-')) {
    additiveTerms(n.l, sign, acc);
    additiveTerms(n.r, n.op === '-' ? -sign : sign, acc);
  } else acc.push({ sign, node: n });
  return acc;
}

/** Is `side` the question's `given` side with every term worked out at `root`? */
function evaluatedSide(given, side, variable, root) {
  const want = additiveTerms(given), got = additiveTerms(side);
  try {
    const values = terms => terms.map(t => t.sign * evaluate(t.node, { [variable]: root }));
    const w = values(want);
    if (!w.every(Number.isFinite)) return false;
    if (got.length !== want.length) return false;
    const g = values(got);
    return g.every((v, i) => Number.isFinite(v) && numsClose(v, w[i]));
  } catch { return false; }
}

// `y = p(x)` and `f(x) = 3x + 1` name a function; the engine reads a letter
// against a bracket as a product. Such a line is not a formula to put numbers
// into: `2*3 = 6` would be "p = 2, x = 3, y = 6".
function appliesLetter(node) {
  const n = node && typeof node === 'object' ? node : null;
  if (!n) return false;
  if (n.t === 'bin' && n.op === '*' && n.l?.t === 'var' && n.r?.t === 'group') return true;
  // A call with several arguments names its first one twice; follow `args` then.
  return (Array.isArray(n.args) ? ['l', 'r', 'v'] : ['l', 'r', 'v', 'arg']).some(key => appliesLetter(n[key]))
    || (Array.isArray(n.args) && n.args.some(appliesLetter));
}

/**
 * The root a letter-free line checks, or null when it is not a check of one.
 */
function checkedRoot(claim, given, meta) {
  if (claim?.kind !== 'equation') return null;
  const variable = meta.variable;
  const roots = uniqueNumeric(meta.solutions);
  const [l, r] = claimSides(claim);
  for (const g of given) {
    if (g?.kind !== 'equation') continue;
    const [gl, gr] = claimSides(g);
    const letters = variablesOf(g.ast);
    // An equation in the unknown alone. A formula in several letters
    // (`y = 2x - 8`, find y when x = 3) is not checked this way: with only
    // two or three numbers in the question, a page of every sum they make
    // contains `2(3) - 8 = -2` without the student having chosen it.
    if (letters.size !== 1 || !letters.has(variable) || appliesLetter(g.ast)) continue;
    for (const [a, b] of [[gl, gr], [gr, gl]]) {
      const bound = new Map();
      if (substitutedInto(a, l, bound) && substitutedInto(b, r, bound) && bound.size === 1) {
        const root = roots.find(x => numsClose(x, bound.get(variable)));
        if (root !== undefined) return root;
      }
      // Each term worked out: only where the unknown stands on both sides,
      // so neither side's value is printed.
      if (!variablesOf(gl).has(variable) || !variablesOf(gr).has(variable)) continue;
      for (const root of roots) {
        if (evaluatedSide(a, l, variable, root) && evaluatedSide(b, r, variable, root)) return root;
      }
    }
  }
  return null;
}

// ── The stages of solving an equation that is not linear ─────────────────────
// Anything can be done to both sides of an equation without solving it, so on
// an equation that is not linear a line earns only as a recognised stage of
// solving it, defined by how the line is built and never by how long the
// question happened to be:
//   standard    everything on one side, equal to 0, written as a polynomial
//               with its like terms collected (`x^2 - 5x + 6 = 0`);
//   expanded    a bracketed question multiplied out, each side collected;
//   cleared     a question with the unknown in a denominator or under a root,
//               written as a polynomial equation;
//   grouped     a quadratic's middle term split with the pair that factorises
//               it, or the common factor taken out of each half;
//   factorised  a product of factors of lower degree, equal to 0;
//   square      a completed square, `(x + a)^2 = b`.
// Each earns once. A line of lower degree (`x - 3 = 4`, `x - 2 = 0`) is linear
// and is marked as linear working. Everything else — the same thing added to
// or applied to both sides, terms moved back and forth, a multiple — is the
// equation written again.

/** The coefficients of a polynomial in `variable`, lowest power first; null when it is not one. */
function polynomialIn(node, variable) {
  const n = unwrapGroup(node);
  if (!n || typeof n !== 'object') return null;
  const trim = p => { while (p.length > 1 && numsClose(p[p.length - 1], 0)) p.pop(); return p; };
  if (n.t === 'num') return [Number(n.v)];
  if (n.t === 'var') return n.v === variable ? [0, 1] : null;
  if (n.t === 'neg') { const p = polynomialIn(n.v, variable); return p && p.map(c => -c); }
  if (n.t !== 'bin') return null;
  const a = polynomialIn(n.l, variable);
  if (!a) return null;
  if (n.op === '^') {
    const k = literalValue(unwrapGroup(n.r));
    if (!Number.isInteger(k) || k < 0 || k > 8) return null;
    let out = [1];
    for (let i = 0; i < k; i++) {
      const next = Array(out.length + a.length - 1).fill(0);
      out.forEach((x, p) => a.forEach((y, q) => { next[p + q] += x * y; }));
      out = next;
      if (out.length > 13) return null;
    }
    return out.length > 13 ? null : trim(out);
  }
  const b = polynomialIn(n.r, variable);
  if (!b) return null;
  if (n.op === '+' || n.op === '-') {
    const sign = n.op === '-' ? -1 : 1;
    return trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] || 0) + sign * (b[i] || 0)));
  }
  if (n.op === '*') {
    if (a.length + b.length > 14) return null;
    const out = Array(a.length + b.length - 1).fill(0);
    a.forEach((x, i) => b.forEach((y, j) => { out[i + j] += x * y; }));
    return trim(out);
  }
  if (n.op === '/' && b.length === 1 && !numsClose(b[0], 0)) return a.map(c => c / b[0]);
  return null;
}

const samePolynomial = (p, q) => p.length === q.length && p.every((c, i) => numsClose(c, q[i]));

/** One side written as a polynomial with its like terms collected: no brackets, no power twice. */
function collectedSide(side, variable) {
  const degrees = new Set();
  for (const term of additiveTerms(side)) {
    const p = polynomialIn(term.node, variable);
    if (!p || p.filter(c => !numsClose(c, 0)).length !== 1) return false;       // one monomial, not zero
    let sums = false, letters = 0;
    JSON.stringify(term.node, (k, v) => {
      if (v && v.t === 'bin' && (v.op === '+' || v.op === '-')) sums = true;
      if (v && v.t === 'var') letters++;
      return v;
    });
    if (sums || letters > 1 || degrees.has(p.length - 1)) return false;
    degrees.add(p.length - 1);
  }
  return true;
}

/** The factors of a product, a power counted as its base repeated. */
function productFactors(node, acc = []) {
  const n = unwrapGroup(node);
  if (n?.t === 'bin' && n.op === '*') { productFactors(n.l, acc); productFactors(n.r, acc); }
  else if (n?.t === 'bin' && n.op === '^' && Number.isInteger(literalValue(unwrapGroup(n.r))) && literalValue(unwrapGroup(n.r)) >= 2 && literalValue(unwrapGroup(n.r)) <= 8) {
    for (let i = 0; i < literalValue(unwrapGroup(n.r)); i++) acc.push(n.l);
  } else if (n?.t === 'neg') productFactors(n.v, acc);
  else acc.push(n);
  return acc;
}

/**
 * A quadratic on the way to its factors: the middle term split with the pair
 * that factorises it (`x^2 + 8x - 4x - 32`: 8 + (-4) is b, 8 × (-4) is a·c),
 * or the common factor taken out of each half (`x(x + 8) - 4(x + 8)`). Neither
 * can be written without finding the factor pair.
 */
/** The two coefficients a middle term was split into (`x^2 + 8x - 4x - 32`: [-4, 8]), or null. */
function middleTermSplit(side, variable) {
  const terms = additiveTerms(side).map(term => ({ ...term, poly: polynomialIn(term.node, variable) }));
  // Four monomials: one square, two in the unknown, one constant.
  if (terms.length !== 4 || terms.some(term => !term.poly || term.poly.filter(x => !numsClose(x, 0)).length !== 1)) return null;
  const linear = terms.filter(term => term.poly.length === 2).map(term => term.sign * term.poly[1]);
  if (linear.length !== 2 || terms.filter(term => term.poly.length === 3).length !== 1 || terms.filter(term => term.poly.length === 1).length !== 1) return null;
  return linear.sort((x, y) => x - y);
}
function groupedQuadratic(side, variable, poly) {
  const [c, , a] = poly;
  const split = middleTermSplit(side, variable);
  if (split) return numsClose(split[0] * split[1], a * c) && !numsClose(split[0], 0) && !numsClose(split[1], 0);
  const terms = additiveTerms(side).map(term => ({ ...term, poly: polynomialIn(term.node, variable) }));
  if (terms.some(term => !term.poly)) return false;
  // Two products sharing a linear factor.
  if (terms.length === 2) {
    const [first, second] = terms.map(term => productFactors(term.node).filter(f => { const n = unwrapGroup(f); return n?.t === 'bin' && (n.op === '+' || n.op === '-') && polynomialIn(f, variable)?.length === 2; }).map(f => polynomialIn(f, variable)));
    return first.some(p => second.some(q => samePolynomial(p, q) || samePolynomial(p, q.map(x => -x))));
  }
  return false;
}
/** What the equation `claim` is in itself: 'standard', 'factorised', 'grouped', 'square', 'collected' or null. */
function equationForm(claim, variable) {
  if (claim?.kind !== 'equation') return null;
  const [l, r] = claimSides(claim);
  const pl = polynomialIn(l, variable), pr = polynomialIn(r, variable);
  const zero = side => literalValue(unwrapGroup(side)) === 0;
  for (const [side, other, poly] of [[l, r, pl], [r, l, pr]]) {
    if (zero(other) && poly && poly.length >= 3) {
      if (collectedSide(side, variable)) return 'standard';
      const factors = productFactors(side).map(f => polynomialIn(f, variable));
      const real = factors.filter(p => p && p.length >= 2);
      if (factors.every(Boolean) && real.length >= 2 && real.every(p => p.length < poly.length)) return 'factorised';
      if (poly.length === 3 && groupedQuadratic(side, variable, poly)) return 'grouped';
    }
    // (x + a)^2 = b, with or without a number in front.
    if (!variablesOf(other).size) {
      const core = productFactors(side).filter(f => { const p = polynomialIn(f, variable); return !(p && p.length === 1); });
      if (core.length === 2 && JSON.stringify(unwrapGroup(core[0])) === JSON.stringify(unwrapGroup(core[1])) && polynomialIn(core[0], variable)?.length === 2 &&
          unwrapGroup(core[0])?.t === 'bin') return 'square';
    }
  }
  if (pl && pr && Math.max(pl.length, pr.length) >= 3 && collectedSide(l, variable) && collectedSide(r, variable)) return 'collected';
  return null;
}

/** Is the number under a square root in `value` the discriminant of a quadratic among `references`? */
function usesDiscriminant(value, references, variable) {
  const under = [];
  JSON.stringify(value, (k, v) => {
    if (v && v.t === 'call' && /^sqrt$/i.test(String(v.fn || v.name || ''))) under.push(v.arg ?? (Array.isArray(v.args) ? v.args[0] : null));
    return v;
  });
  if (!under.length) return false;
  const discriminants = [];
  for (const c of references) {
    if (c?.kind !== 'equation') continue;
    const [l, r] = claimSides(c);
    const pl = polynomialIn(l, variable), pr = polynomialIn(r, variable);
    // An equation in the unknown — or a polynomial the question names
    // (`p(x) = x^2 + 11x + 30`, `y = x^2 - 6x + 8`), whose zeroes are asked for.
    const p = pl && pr ? polynomialIn({ t: 'bin', op: '-', l, r }, variable) : pl && pl.length === 3 ? pl : pr && pr.length === 3 ? pr : null;
    if (p && p.length === 3) discriminants.push(p[1] * p[1] - 4 * p[2] * p[0]);
  }
  return under.some(node => {
    let d;
    try { d = evaluate(node, {}); } catch { return false; }
    return Number.isFinite(d) && discriminants.some(x => numsClose(x, d));
  });
}

/**
 * The stage of solving that `claim` is, given the equations the question
 * gives in the unknown alone; null when it is none.
 */
function solvingStage(claim, variable, givenOwn) {
  const form = equationForm(claim, variable);
  if (!form) return null;
  const givenForms = givenOwn.map(c => equationForm(c, variable));
  const residual = c => {
    const [l, r] = claimSides(c);
    const pl = polynomialIn(l, variable), pr = polynomialIn(r, variable);
    return pl && pr ? polynomialIn({ t: 'bin', op: '-', l, r }, variable) : null;
  };
  if (form === 'standard') {
    if (!givenForms.includes('standard')) return 'standard';
    // The question is already in standard form: only dividing a common factor out of it is a step.
    const mine = residual(claim);
    return givenOwn.some((c, i) => {
      const theirs = givenForms[i] === 'standard' ? residual(c) : null;
      if (!mine || !theirs || mine.length !== theirs.length) return false;
      const k = theirs[theirs.length - 1] / mine[mine.length - 1];
      return Number.isInteger(Math.round(k)) && numsClose(k, Math.round(k)) && Math.abs(k) > 1 && samePolynomial(theirs, mine.map(c2 => c2 * k)) &&
        mine.every(c2 => numsClose(c2, Math.round(c2)));
    }) ? 'standard' : null;
  }
  if (form === 'factorised') return givenForms.includes('factorised') ? null : 'factorised';
  if (form === 'grouped') return givenForms.includes('grouped') || givenForms.includes('factorised') ? null : 'grouped';
  if (form === 'square') return givenForms.includes('square') ? null : 'square';
  // Each side collected, but not yet standard form.
  const mine = residual(claim);
  if (!mine) return null;
  // A question with the unknown in a denominator or under a root, cleared.
  if (givenOwn.length && givenOwn.every(c => !residual(c))) return 'cleared';
  // A bracketed question multiplied out: the same two sides, without the brackets.
  const bracketed = c => { const f = equationForm(c, variable); return f !== 'standard' && f !== 'collected'; };
  if (givenOwn.some(c => bracketed(c) && rescalesBothSides(claim, c, variable) === 'same')) return 'expanded';
  return null;
}

/** The one value a line that is linear in `variable` alone pins it to; null when it is not such a line. */
function statedRootOf(claim, variable) {
  if (claim?.kind !== 'equation') return null;
  const names = variablesOf(claim.ast);
  if (names.size !== 1 || !names.has(variable)) return null;
  const [l, r] = claimSides(claim);
  const lone = side => unwrapGroup(side)?.t === 'var' && unwrapGroup(side).v === variable;
  try {
    if (lone(l) && !variablesOf(r).size) { const v = evaluate(r, {}); return Number.isFinite(v) ? v : null; }
    if (lone(r) && !variablesOf(l).size) { const v = evaluate(l, {}); return Number.isFinite(v) ? v : null; }
  } catch { return null; }
  const state = linearState(claim, variable);
  if (!state) return null;
  const [a, b, c, d] = state.sides;
  const value = (d - b) / (a - c);
  return Number.isFinite(value) ? value : null;
}

/**
 * Is `claim` — an equation in one letter of a pair — what elimination leaves:
 * a sum of whole multiples of the question's two-letter equations (each
 * equation taken as written, or with its common factor divided out)?
 */
function eliminatedFromGiven(claim, given, letters) {
  if (claim?.kind !== 'equation' || !Array.isArray(letters) || letters.length !== 2) return false;
  const [p, q] = letters;
  const coefficients = c => {
    const names = variablesOf(c.ast);
    if (![...names].every(n => n === p || n === q)) return null;
    const f = (x, y) => evaluate(c.ast.l, { [p]: x, [q]: y }) - evaluate(c.ast.r, { [p]: x, [q]: y });
    try {
      const k = f(0, 0), a = f(1, 0) - k, b = f(0, 1) - k;
      if (![a, b, k].every(Number.isFinite) || !numsClose(f(2, 3), 2 * a + 3 * b + k)) return null;
      return [a, b, k];
    } catch { return null; }
  };
  const line = coefficients(claim);
  if (!line) return false;
  const whole = x => numsClose(x, Math.round(x));
  const gcd = (x, y) => { x = Math.abs(Math.round(x)); y = Math.abs(Math.round(y)); while (y) [x, y] = [y, x % y]; return x || 1; };
  const system = given.filter(c => c.kind === 'equation' && variablesOf(c.ast).has(p) && variablesOf(c.ast).has(q)).map(coefficients).filter(Boolean);
  for (let i = 0; i < system.length; i++) for (let j = i + 1; j < system.length; j++) {
    const [a1, b1, k1] = system[i], [a2, b2, k2] = system[j];
    const det = a1 * b2 - a2 * b1;
    if (numsClose(det, 0)) continue;
    // line = s·(first) + t·(second)
    const s2 = (line[0] * b2 - line[1] * a2) / det, t2 = (a1 * line[1] - b1 * line[0]) / det;
    if (!numsClose(s2 * k1 + t2 * k2, line[2])) continue;
    const g1 = [a1, b1, k1].every(whole) ? gcd(gcd(a1, b1), k1) : 1, g2 = [a2, b2, k2].every(whole) ? gcd(gcd(a2, b2), k2) : 1;
    if (whole(s2 * g1) && whole(t2 * g2)) return true;
  }
  return false;
}

/** Is this line the answer itself — the solved inequality, or the expression as the answer writes it? */
function statesTheAnswer(claim, meta, unknown) {
  try {
    if (claim.kind === 'relation' && unknown && typeof meta.canonical === 'string') {
      const lone = side => unwrapGroup(side)?.t === 'var' && unwrapGroup(side).v === unknown;
      const { l, r } = claim.relation;
      return (lone(l) && !variablesOf(r).size) || (lone(r) && !variablesOf(l).size);
    }
    if (meta.kind === 'expression' && typeof meta.canonical === 'string') {
      const answer = readClaim(meta.canonical);
      const written = claim.kind === 'equation' ? { kind: 'expression', ast: claim.ast.r } : claim;
      return !!answer && written.kind === 'expression' && sameWrittenClaim(written, answer);
    }
    // A derivative is checked as "is this the derivative": every verified line
    // is the answer in some form. Written as simply as the answer, it is the
    // answer; written with the rule still showing (`-9 * 2x`), it is working.
    if (meta.kind === 'derivative' && typeof meta.canonical === 'string') {
      const answer = readClaim(meta.canonical);
      const written = claim.kind === 'equation' ? claim.ast.r : claim.kind === 'expression' ? claim.ast : null;
      return !!answer && !!written && answer.kind === 'expression' && symbolCount(written) <= symbolCount(answer.ast);
    }
  } catch { /* unreadable: not the answer */ }
  return false;
}

/** Does an equation in the unknown alone hold whatever the unknown is? */
function silentOnUnknown(claim, variable) {
  const sides = claimSides(claim);
  if (!sides) return false;
  const names = new Set();
  for (const side of sides) variablesOf(side, names);
  if (claim.kind !== 'equation' || names.size !== 1 || !names.has(variable)) return false;
  let seen = 0;
  for (const x of UNKNOWN_PROBES) {
    let l, r;
    try { l = evaluate(sides[0], { [variable]: x }); r = evaluate(sides[1], { [variable]: x }); } catch { continue; }
    if (!Number.isFinite(l) || !Number.isFinite(r)) continue;
    if (!numsClose(l, r)) return false;
    seen++;
  }
  return seen >= 3;
}

/**
 * Is `claim` one of the question's own equations rearranged to make a letter
 * its subject (`y = 10 - x` from `x + y = 10`)? Tested as functions, not at
 * the solution alone: with the subject's expression put in for that letter,
 * the given equation must hold whatever the other letters are.
 */
function subjectOfGiven(claim, given) {
  if (claim?.kind !== 'equation') return false;
  const [cl, cr] = claimSides(claim).map(unwrapGroup);
  for (const [subject, expression] of [[cl, cr], [cr, cl]]) {
    if (subject?.t !== 'var' || variablesOf(expression).has(subject.v)) continue;
    const free = [...variablesOf(expression)];
    if (!free.length) continue;
    for (const g of given) {
      if (g?.kind !== 'equation') continue;
      const letters = variablesOf(g.ast);
      if (!letters.has(subject.v) || ![...letters].every(name => name === subject.v || free.includes(name))) continue;
      let seen = 0, holds = true;
      for (let k = 0; k < UNKNOWN_PROBES.length && holds; k++) {
        const env = {};
        free.forEach((name, i) => { env[name] = UNKNOWN_PROBES[(k + i) % UNKNOWN_PROBES.length] + 0.173 * i; });
        try {
          env[subject.v] = evaluate(expression, env);
          const L = evaluate(g.ast.l, env), R = evaluate(g.ast.r, env);
          if (![env[subject.v], L, R].every(Number.isFinite)) continue;
          if (!numsClose(L, R)) holds = false;
          seen++;
        } catch { /* a probe the expression is undefined at says nothing */ }
      }
      if (holds && seen >= 3) return true;
    }
  }
  return false;
}

const letterFree = claim => {
  const sides = claimSides(claim);
  return !!sides && sides.every(side => variablesOf(side).size === 0);
};

/**
 * Method marks for a wrong final answer, from the student's working.
 * Returns null when nothing in the working could be verified; otherwise
 * { okLines, progressLines, awarded, note, report }.
 */
export function methodMarks(input = {}) {
  // A report the clock stopped is not evidence of anything, whoever made it.
  if (input?.report?.unverified === true) return unverifiedMethod(input.report);
  return unlessStopped(() => withEvaluationBudget(EVALUATION_BUDGET, () => methodMarksWithinBudget(input)),
    () => unverifiedMethod(unverifiedReport(input?.working)));
}
function methodMarksWithinBudget({ meta, working, marks, prompt = '', report = null } = {}) {
  if (!meta || working == null || !String(working).trim()) return null;
  let rep = report;
  if (!rep) {
    try { rep = stepCheck(meta, String(working), { prompt }); } catch { return null; }
  }
  const given = questionClaims(meta, prompt);
  // A report made without the prompt could not check a line about another
  // unknown against the question's system. The prompt is here, so it is
  // checked now: a line that holds at the system's solution is verified.
  const system = pinnedSystem(meta, prompt);
  const allLines = (rep?.lines || []).map(l => {
    if (l.status !== 'note' || !l.otherUnknown || !system) return l;
    const claim = readClaim(l.text);
    if (claim?.kind !== 'equation') return l;
    return assessOtherUnknownLine(claim.ast, system).status === 'ok' ? { ...l, status: 'ok' } : l;
  });
  const okLines = allLines.filter(l => l.status === 'ok');
  if (!okLines.length) return null;
  const counted = [];
  const creditedStages = new Set();
  const checkedRoots = [];
  const otherFound = new Set();      // the other unknowns whose value has already earned its mark
  let restated = 0;
  let shownAuthoredEquation = false;
  const solvedStages = new Set();    // the stages of a non-linear solution already credited
  let isolatedOther = false;
  const total = Math.max(1, Number(marks) || 1);
  const cap = Math.max(0, total - 1);
  // Working is a derivation, not a list of guesses.
  //  · On an equation or an inequality, nothing after the first mistake earns:
  //    what follows a false line is built on it or is another attempt at the
  //    same thing. Marks earned before the mistake stay earned. On an
  //    inequality a relation that has not the question's solutions is the
  //    mistake, whether the checker could name the fault or not. (Not on an
  //    expression or a derivative, where an honest side line — `u = x^2`,
  //    `y = 2x + c` — is "not the answer" without being wrong.)
  //  · Three or more lines of one shape with different numbers in them —
  //    `v = 3`, `v = 4`, `v = 5`; `2v > 6`, `2v > 8`, `2v > 10`; `A = 1/3`,
  //    `A = 2/3`, `A = 1` — are a sweep of candidates, and none of them earns,
  //    wherever the true one stands. The shape is the line as written with its
  //    numbers blanked out. Two are a slip and its correction, which the first
  //    rule settles. This holds for every kind of question.
  //  · A check of a root earns once, and not beside a letter-free line that
  //    is false: one true substitution among false ones is the one that
  //    happened to balance.
  const relational = meta.kind === 'inequality' || meta.kind === 'chained-inequality' || meta.kind === 'modulus-inequality';
  const firstBreak = meta.kind === 'equation' ? allLines.findIndex(l => l.status === 'break')
    : relational ? allLines.findIndex(l => l.status === 'break' || (l.status !== 'ok' && readClaim(l.text)?.kind === 'relation'))
      : -1;
  // More values than the equation has roots, and at least three.
  const sweepSize = Math.max(3, uniqueNumeric(meta.solutions).length + 1);
  const contradicted = new Set();
  let falseArithmetic = false;
  const shapes = new Map();
  {
    allLines.forEach((l, index) => {
      const text = String(l.text ?? '').replace(/[−–—]/g, '-').replace(/\s+/g, '');
      const c = readClaim(l.text);
      if (c?.kind === 'equation' && !variablesOf(c.ast).size) {
        try {
          const L = evaluate(c.ast.l, {}), R = evaluate(c.ast.r, {});
          if (Number.isFinite(L) && Number.isFinite(R) && !holdsWithin(L, R)) falseArithmetic = true;
        } catch { /* unreadable arithmetic says nothing */ }
        return;
      }
      if (!/[a-zA-Z]/.test(text) || !/\d/.test(text)) return;
      // The shape is the line as written with its numbers blanked out.
      const numbers = text.match(/\d+(?:\.\d+)?/g).join(',');
      const key = text.replace(/\d+(?:\.\d+)?/g, '#');
      const seen = shapes.get(key) || { values: new Set(), lines: [] };
      seen.values.add(numbers);
      seen.lines.push(index);
      shapes.set(key, seen);
    });
    // The middle term split more than one way is a search for the pair, not
    // the pair found: every split of `bx` adds back to `bx`, so a wrong one
    // is never false, and only one of them factorises. None of them earns.
    if (meta.variable) {
      const splits = new Map();
      allLines.forEach((l, index) => {
        const c = readClaim(l.text);
        if (c?.kind !== 'equation') return;
        for (const side of claimSides(c)) {
          const pair = middleTermSplit(side, meta.variable);
          if (pair) { const key = pair.map(x => x.toFixed(6)).join(','); splits.set(key, [...(splits.get(key) || []), index]); }
        }
      });
      if (splits.size > 1) for (const lines of splits.values()) for (const index of lines) contradicted.add(index);
    }
  }
  // Does the question hand over an equation that is linear in the unknown
  // alone? Then every step towards the answer is linear in it too.
  // An inequality's meta names no unknown; it is the one letter of its source.
  const unknown = meta.variable || (() => {
    if (!relational || typeof meta.source !== 'string') return null;
    const letters = [...new Set(meta.source.match(/[a-zA-Z]/g) || [])];
    return letters.length === 1 ? letters[0] : null;
  })();
  const linearQuestion = !!unknown && given.some(c => !!linearState(c, unknown));
  // The question's own equations in the unknown alone, and whether stated
  // roots are to be read as such: a polynomial equation of degree two or
  // more, or any equation with several roots.
  const givenOwnAll = meta.kind === 'equation' && meta.variable ? given.filter(c => {
    if (c.kind !== 'equation') return false;
    const names = variablesOf(c.ast);
    return names.size === 1 && names.has(meta.variable);
  }) : [];
  const degreeOf = c => {
    const [l, r] = claimSides(c);
    const pl = polynomialIn(l, meta.variable), pr = polynomialIn(r, meta.variable);
    return pl && pr ? polynomialIn({ t: 'bin', op: '-', l, r }, meta.variable).length - 1 : -1;
  };
  const statedRoots = meta.kind === 'equation' && !!meta.variable && !linearQuestion &&
    (uniqueNumeric(meta.solutions).length > 1 || givenOwnAll.some(c => degreeOf(c) >= 2));
  const givenSolved = givenOwnAll.some(c => ['factorised', 'square'].includes(equationForm(c, meta.variable)));
  const rootsRead = [];
  // Stated roots are one shape whatever their spelling: a working that gives
  // the unknown two or more different values, not all of them roots, is a
  // list of candidates, and none of its stated roots earns.
  // The first false line is not one of the candidates. It is where the working
  // broke — a slip, or the wrong final answer written under the working — and
  // it already earns nothing and stops everything after it. Counting it here
  // took the marks back from roots read off correctly ABOVE it: factorise,
  // `x = 2`, `x = -3`, then a slip `x = 5`, fell from three marks to one. A
  // second wrong value after the break is still a list of candidates.
  let rootSweep = false;
  if (statedRoots) {
    const wanted = uniqueNumeric(meta.solutions);
    const values = [];
    for (const l of allLines) {
      if (l.status === 'break') continue;
      const c = readClaim(l.text);
      const v = c?.kind === 'equation' ? statedRootOf(c, meta.variable) : null;
      if (v !== null && !values.some(x => numsClose(x, v))) values.push(v);
    }
    rootSweep = values.length >= 2 && values.some(v => !wanted.some(w => numsClose(w, v)));
  }
  // The sweep of one shape, decided here because it needs to know what a root
  // of the question is. Where roots are read off, the first false line is,
  // again, not one of the candidates when it is the only thing wrong with its
  // shape. Roots of one sign are written in one shape, so both roots read off
  // and then one slip made three values of `x = #` and voided the two roots
  // above the slip: `(x-3)(x-5) = 0`, `x = 3`, `x = 5`, then `x = 7`, fell from
  // three marks to one, where the same working on roots of opposite sign
  // (`x = 2`, `x = -3` are two shapes) kept all three. The slip is set aside
  // only when
  //  · every other line of the shape states a root of the question — is true,
  //    that is, and not merely unrefuted: a factorisation that shares one root
  //    with the question is not — so a second wrong value is still a list of
  //    candidates; and
  //  · what is left is itself too few to be a sweep, so a slip can never
  //    rescue a sweep it was added to.
  // Setting it aside credits nothing: each root left standing still has to be
  // read off something solved, once, and nothing after the slip earns.
  // It is not done on a linear equation. There a line that pins the unknown
  // (`x + 1 = 6`) stands as far on as the answer, so letting two of them stand
  // beside a slip would leave every genuine step written after them a
  // `repeat`: the sweep rule voiding them is what lets those steps earn.
  {
    const wanted = uniqueNumeric(meta.solutions);
    const statesRoot = index => {
      if (!statedRoots) return false;
      const c = readClaim(allLines[index].text);
      const v = c?.kind === 'equation' ? statedRootOf(c, meta.variable) : null;
      return v !== null && wanted.some(w => numsClose(w, v));
    };
    const numbersOf = index => String(allLines[index].text ?? '').replace(/[−–—]/g, '-').replace(/\s+/g, '').match(/\d+(?:\.\d+)?/g).join(',');
    for (const seen of shapes.values()) {
      if (seen.values.size < sweepSize) continue;
      if (statedRoots && firstBreak >= 0 && seen.lines.includes(firstBreak)) {
        const rest = seen.lines.filter(index => index !== firstBreak);
        if (rest.every(statesRoot) && new Set(rest.map(numbersOf)).size < sweepSize) continue;
      }
      for (const index of seen.lines) contradicted.add(index);
    }
  }
  // The per-line mark vector: one entry per written line, in order, saying
  // what that line earned and why. Its marks always sum to `awarded`, so a
  // multi-line answer can show the examiner's tick (or its absence) per line.
  const vector = allLines.map((l, index) => {
    const row = { index, text: String(l.text ?? ''), status: l.status, mark: 0, reason: l.status === 'ok' ? 'progress' : l.status };
    if (l.status !== 'ok') return row;
    if (firstBreak >= 0 && index > firstBreak) { row.reason = 'after-mistake'; return row; }
    if (contradicted.has(index)) { row.reason = 'contradicted'; return row; }
    const claim = readClaim(l.text);
    const credit = () => {
      counted.push(claim || { kind: 'text', text: String(l.text).trim() });
      if (counted.length <= cap) row.mark = 1; else row.reason = 'cap';
      return row;
    };
    if (claim && given.some(c => methodProgressDuplicate(claim, c))) {
      restated++;
      if (claim.kind === 'equation') shownAuthoredEquation = true;
      row.reason = 'restated'; return row;
    }
    if (claim && counted.some(c => methodProgressDuplicate(claim, c))) { row.reason = 'repeat'; return row; }
    // A verified line in another unknown of the question's system. Finding the
    // other unknown is part of solving the pair, and it earns at most two
    // marks, each once:
    //  · making one letter the subject of one of the question's own equations
    //    (the first move of substitution). A line in both letters that is not
    //    a rearrangement of an equation the question gives has eliminated
    //    nothing, however true it is at the solution;
    //  · reaching the other unknown: the first verified line in that letter
    //    alone. Every such line says the same one thing — what that letter is
    //    — so `6y = 12`, `3y = 6`, `y = 2` is one finding written three ways,
    //    not three steps. A bare value with no working before it is a
    //    statement, not a derivation.
    const foreign = claim?.kind === 'equation' ? foreignLetters(claim.ast, meta) : [];
    if (foreign.length) {
      const names = [...variablesOf(claim.ast)];
      if (names.length !== 1) {
        if (isolatedOther || !subjectOfGiven(claim, given)) { row.reason = 'other-unknown'; return row; }
        isolatedOther = true;
        return credit();
      }
      const state = linearState(claim, names[0]);
      if (!state) { row.reason = 'other-unknown'; return row; }
      // A value the question itself prints for that letter (`x = 5`) is not found
      // by writing it another way (`x - 5 = 0`).
      if (given.map(c => linearState(c, names[0])).filter(Boolean).some(g => !linearStateAdvances(state, g))) { row.reason = 'restated'; return row; }
      if (otherFound.has(names[0])) { row.reason = 'repeat'; return row; }
      if (state.left === 0 && !counted.length) { row.reason = 'other-unknown'; return row; }
      // With nothing before it, a line in that letter alone must be what
      // eliminating leaves — whole multiples of the question's equations
      // added together. `2x = -14` on `6x + 3y = -60`, `4x - y = -22` is not:
      // it is the value of x doubled, as bare as `x = -7`.
      if (!counted.length && system && !eliminatedFromGiven(claim, given, system.variables)) { row.reason = 'other-unknown'; return row; }
      otherFound.add(names[0]);
      return credit();
    }
    // A final answer in a different spelling is still the same final answer,
    // not two independently demonstrated method criteria. This applies only
    // to single-root equations; branch and multi-root work retain their
    // separately authored verification.
    if (claim && isolatedFinalAnswer(claim, meta)) {
      // An unsupported statement of the final answer is not a derivation.
      // After a genuine preceding method step, however, the first isolated
      // root can complete an authored step criterion exactly once. Retelling
      // that same root as +0, *1 or another arithmetic spelling earns nothing.
      if (!counted.length && !(shownAuthoredEquation && oneStepLinearRoot(meta, given))) {
        row.reason = 'final-answer'; return row;
      }
      if (counted.length >= cap) { row.reason = 'cap'; return row; }
      if (counted.some(c => isolatedFinalAnswer(c, meta))) { row.reason = 'repeat'; return row; }
    }
    // A stated root. On a polynomial equation of degree two or more, a line
    // that is linear in the unknown pins it to one value, however it is
    // spelt: `x = 4`, `x - 4 = 0`, `2x = 8`, `8 = 2x`, `x/2 = 2`, `-x = -4`.
    // It is a root read off, and earns as one: only after the equation has
    // been solved — a factorisation, a completed square or the formula is
    // credited, or the question is itself given in one of those forms — and
    // once for each root. With nothing solved before it, it is a statement.
    // The quadratic formula with the equation's own discriminant under the
    // root is itself a stage of solving, once.
    // A verified `±` line gives every root at once (`x = (-15 ± 1)/2`): the
    // formula applied. The roots written out after it are read off it.
    if (statedRoots && !claim && l.coversAll === true && /±/.test(String(l.text))) {
      solvedStages.add('formula');
      row.stage = 'formula';
      return credit();
    }
    if (statedRoots && claim?.kind === 'equation') {
      const [vl, vr] = claimSides(claim);
      const lone = side => unwrapGroup(side)?.t === 'var' && unwrapGroup(side).v === meta.variable;
      const value = lone(vl) && !variablesOf(vr).size ? vr : lone(vr) && !variablesOf(vl).size ? vl : null;
      if (value && usesDiscriminant(value, [...given, ...counted], meta.variable)) {
        if (solvedStages.has('formula')) { row.reason = 'repeat'; return row; }
        solvedStages.add('formula');
        row.stage = 'formula';
        return credit();
      }
      const pinned = statedRootOf(claim, meta.variable);
      if (pinned !== null) {
        if (rootSweep) { row.reason = 'contradicted'; return row; }
        const solved = ['factorised', 'square', 'formula'].some(stage => solvedStages.has(stage)) || givenSolved;
        if (!solved) { row.reason = 'final-answer'; return row; }
        if (rootsRead.some(x => numsClose(x, pinned))) { row.reason = 'repeat'; return row; }
        rootsRead.push(pinned);
        row.stage = 'root';
        return credit();
      }
    }
    if (meta.kind === 'equation' && meta.variable && claim) {
      // Solving an equation is work on its unknown. A line that is true
      // whatever the unknown is (x + 1 = 1 + x) moves nothing on.
      if (silentOnUnknown(claim, meta.variable)) { row.reason = 'unrelated'; return row; }
      // A line with no letter in it earns a mark only as a check of a root —
      // see "Working with no letter in it". True arithmetic is not a method.
      if (letterFree(claim)) {
        const root = checkedRoot(claim, given, meta);
        if (root === null) { row.reason = 'unrelated'; return row; }
        if (falseArithmetic) { row.reason = 'contradicted'; return row; }
        if (checkedRoots.length) { row.reason = 'repeat'; return row; }
        checkedRoots.push(root);
        return credit();
      }
    }
    // An evidence plan (creditPerStage) carries one mark per verified stage:
    // a second line inside a stage already credited is the same criterion
    // shown again, however differently it is written.
    if (meta.kind === 'plan' && meta.creditPerStage === true && Number.isInteger(l.stage)) {
      if (creditedStages.has(l.stage)) { row.reason = 'repeat'; return row; }
      creditedStages.add(l.stage);
    }
    // A linear equation line earns a mark only when it stands further on than
    // the question and every line already credited. Equations that are not
    // linear in the unknown keep the written-duplicate rule above.
    // On an equation, a line that is not an equation (a bare `7`) states a
    // value; it derives nothing.
    if (meta.kind === 'equation' && claim && claim.kind === 'expression') { row.reason = 'final-answer'; return row; }
    // The answer itself, written with nothing before it, is a statement: the
    // inequality solved (`x > 6`) or the expression in its final form.
    // (Written under the question's own line it is the one step of a one-step
    // question, as `x = 2` is under `3x = 6`.)
    if (!counted.length && !restated && claim && statesTheAnswer(claim, meta, unknown)) { row.reason = 'final-answer'; return row; }
    const state = unknown ? linearState(claim, unknown) : null;
    // The same for the asked unknown of a pair: `y + 6 = 0` with nothing
    // before it is the answer stated, not y found by elimination.
    if (state && system && claim?.kind === 'equation' && !counted.length && !eliminatedFromGiven(claim, given, system.variables)) {
      row.reason = 'final-answer'; return row;
    }
    if (state) {
      const before = [...given, ...counted].map(c => linearState(c, unknown)).filter(Boolean);
      if (before.some(g => !linearStateAdvances(state, g))) { row.reason = 'repeat'; return row; }
    } else if (meta.kind === 'equation' && meta.variable && claim?.kind === 'equation') {
      // A line that is not linear in the unknown.
      // On a linear equation it moves nothing on: `L + m^2 = R + m^2`,
      // `(L)/(R) = 1`, `(L)^3 = (R)^3` are the question dressed up.
      if (linearQuestion) { row.reason = 'restated'; return row; }
      // Otherwise it earns as a recognised stage of solving — see "The stages
      // of solving an equation that is not linear" — and each stage once.
      const givenOwn = given.filter(c => {
        if (c.kind !== 'equation') return false;
        const names = variablesOf(c.ast);
        return names.size === 1 && names.has(meta.variable);
      });
      const stage = solvingStage(claim, meta.variable, givenOwn);
      if (!stage) { row.reason = 'restated'; return row; }
      if (solvedStages.has(stage)) { row.reason = 'repeat'; return row; }
      solvedStages.add(stage);
      row.stage = stage;
    }
    return credit();
  });
  // Rewriting the equation — expanding it, clearing it, putting it in standard
  // form — can be done without knowing how to solve it. With nothing solved
  // after it (no factorisation, square, formula, root or line of lower
  // degree), all the rewriting together is one mark.
  if (meta.kind === 'equation') {
    const REWRITING = ['expanded', 'cleared', 'standard'];
    const marked = vector.filter(row => row.mark > 0);
    const rewritten = marked.filter(row => REWRITING.includes(row.stage));
    if (rewritten.length > 1 && marked.length === rewritten.length) {
      for (const row of rewritten.slice(1)) { row.mark = 0; row.reason = 'rewriting'; counted.pop(); }
    }
  }
  const progress = counted.length;
  const awarded = Math.min(cap, progress);
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const note = awarded > 0
    ? `${plural(awarded, 'mark')} for correct working — the final answer was wrong, but ${plural(progress, 'line')} of your working moved the solution on.`
    : restated
      ? 'No method marks: the lines that check out only restate the question. Marks come from steps that move the solution on.'
      : 'No method marks: correct working earns marks only when it moves the solution on, and this question carries a single mark for the answer.';
  return { okLines: okLines.length, progressLines: progress, restatedLines: restated, awarded, note, lines: vector, report: rep };
}
