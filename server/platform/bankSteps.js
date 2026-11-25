// Pri Learning · step marks for the author's own question bank, from HIS marking criteria (DRAFT: pays nothing until he files his own record)
//
// R4 (marking authority). The bank's questions (qbankPack.js) are sealed final-answer-only: a wrong final answer earns 0. The author approved the
// generic rule (genericSteps.js) for generator questions only. This module is a separate rule, with its own approval id (`bank-author-criteria`) and
// its own digest over THIS FILE (the rule's code and wording), for a bank question whose author-written criteria the engine can check.
// Nothing here pays until: the author's record at the current digest exists, PRI_METHOD_MARKS=on, Prithagoras, and the question was stamped at
// issue (editionBanks.sealForEdition). genericSteps.js is imported and never edited: its digest is the one he approved.
//
// THE RULE, for one part of a bank question worth N >= 2 marks (a part is one entry of the pack, with his marks, steps [{h, d}] and criteria
// [{marks, point, line?, answer?, manual?}]):
//   · a correct final answer earns N, as it always did. Working never earns the answer criterion.
//   · a wrong or missing final answer earns the marks of each of HIS working criteria that the page provably meets, and never more than N minus
//     the marks of his answer criterion (N - 1 when he has none).
//   · A CRITERION IS MET ONLY IF one of the two readings below holds, on a line of the student's working that is TICKED by the deterministic step
//     report (status ok; never the model-assisted displayed report; not a copied given; not carried forward after a slip), that comes BEFORE the
//     first crossed line and BEFORE the first unverified claim (below), and that no other criterion has already used:
//       (a) it carries a `line`: a line of the working is provably equal to it. An expression: the same function at many sample points. A label
//           with a value (m = 3): the same label and the same number. A label with an expression (y = 4x + 1): the same label and the same function.
//           An equation: a side-by-side equation whose left minus right is a nonzero constant multiple of his, with the same form (a number, a
//           single letter or something longer on each side). An inequality is not read: its criterion is "not verified".
//       (b) it carries no `line`: his worked steps hold EXACTLY ONE step whose heading or text matches the criterion's `point` by the matching rule
//           below, and a ticked line reaches that step's result as the generic rule defines reaching (genericSteps.js awardGeneric, with every
//           candidate step a key step). Two steps match, or none: the criterion is "not verified" and is never earned.
//   · NEVER MET: a criterion flagged `manual`; his answer criterion; a criterion whose line is the final answer or part of it (a bare value of the
//     answer, an expression equal to the answer key), a given of the question, or the same as another criterion's line; a criterion the author's own
//     steps, written as a student's page, do not earn (the self-test: the engine cannot tick what he wrote, so it is never paid).
//   · A BARE VALUE (a label equal to a number, or a number) criterion is met only if an earlier ticked line already reached another criterion or a
//     step of his solution. A bare value with no working before it is nothing. Restatements, given values, lines after a wrong line: nothing.
//   · THE STOP RULE, stricter than the generic rule's: no line at or after the first line that is not ticked earns, unless that line only restates
//     the question. A prose line, a note and a line the page cannot judge all stop the paying. The generic rule lets prose through; this rule does not.
//
// MATCHING RULE for (b), strict and deterministic: a text is its words, lowercased, with markup and punctuation removed (digits kept). A step
// matches a point when the point's words equal the heading's words, or the heading is three words or fewer and is a run of the point's words, or
// the point is three words or fewer and is a run of the heading's words, or the point is three words or more and is a run of the step's text.
//
// IMPORT-TIME PROOF (bankProof, run for every question by the importer and the real-pack check, and at issue): his steps as a student's page with
// a wrong typed answer earn exactly the criteria the rule can verify; with the last line made wrong they earn the same except what rested on
// that line; the answer criterion is never earned; his steps with the right answer earn N; the question restated, only its given values, and each
// trap answer alone earn 0. A question that fails any of these is not eligible and stays final-answer-only, with the reason listed.
//
// Pure and deterministic: no model, no network, no clock.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { _internals, _forChains } from '../../client/src/engine/solutionMatch.js';
import { parse, normalize, evaluate, variablesOf, withEvaluationBudget } from '../../client/src/engine/expr.js';
import { stepEvidence, marksPossibleFor, isSchemeStep } from './markerOps.js';
import { awardGeneric, genericDigest } from './genericSteps.js';
import { texToPlain as readTex, EXTENDED_TEX } from '../../client/src/engine/texToPlain.js';

// His steps are TeX, read here with the extended reading (engine/texToPlain.js) first and, where that is not certain, the older reading below. The switch
// that makes the generic rule read them the same way is scoped to this module's own calls (solutionMatch.withBankReading).
const { withBankReading } = _internals;

export const BANK_ID = 'bank-author-criteria';
export const BANK_TITLE = 'Step marks drawn from the author\'s own marking criteria for his question bank';
/** The choices the author can see, in the packet. Changing one changes the digest and so revokes an approval. */
export const PARAMETERS = Object.freeze({
  /** The least marks a bank part must be worth for the rule to apply. */
  MIN_MARKS: 2,
  /** A wrong or missing final answer earns at most this many marks fewer than the part's marks, when he has no answer criterion. */
  WRONG_ANSWER_CAP_BELOW_FULL: 1,
  /** How many sample points an expression, an equation and a criterion line are compared at, and how many must be defined. */
  SAMPLE_POINTS: 24,
  MIN_DEFINED_POINTS: 8,
  /** The generic rule reaches at most the last five distinct candidate steps (a part worth 6 marks). */
  REACH_MARKS: 6,
  /** The stop rule: no line at or after the first line that is not ticked (a restatement of the question aside) earns. */
  STOP_AT_FIRST_UNTICKED: true
});
export const BANK_WORDING = Object.freeze({
  answer: 'The final answer.',
  earned: 'Line {n} is ticked and is this criterion.',
  noLine: 'No ticked line before the first crossed line (line {n}) met it.',
  stopped: 'Line {n} could not be verified, so no line after it can earn a mark.',
  unverified: 'Pri could not verify a line for this criterion.',
  manual: 'Only a person can check this criterion, so Pri does not.',
  cannot: 'Pri has no way to check this criterion from a line, so it is not verified.',
  answerRight: 'The final answer is correct, so this criterion is met.',
  answerWrong: 'The final answer was not correct.',
  held: 'A wrong final answer never earns full marks, so this mark is held back.',
  note: '{n} of {N} marks for the criteria of the marking your ticked lines met: the final answer was not right.',
  none: 'No method marks: no criterion of the marking was met by a ticked line.'
});

const canonText = v => (Array.isArray(v) ? `[${v.map(canonText).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonText(v[k])}`).join(',')}}` : JSON.stringify(v ?? null));
let digestMemo = null;
/** The digest the author signs: id, title, wording, parameters, THE SOURCE OF THIS FILE (LF-normalised) and the digest of the generic rule it reuses. */
export function bankDigest() {
  if (digestMemo) return digestMemo;
  const source = fs.readFileSync(new URL(import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  digestMemo = crypto.createHash('sha256').update(canonText({ id: BANK_ID, title: BANK_TITLE, wording: BANK_WORDING, parameters: PARAMETERS, generic: genericDigest(), source })).digest('hex');
  return digestMemo;
}

const { readStudent, spanToPlain } = _internals;
const { canon, statementsOfSpans } = _forChains;
const BUDGET = 150000;
const AUTO_TYPES = new Set(['numeric', 'expression', 'set', 'interval', 'equation', 'point']);

/** Structural eligibility, cheap: a marked bank part (not a worked-solution question) worth at least MIN_MARKS with criteria. */
export function bankStructural(q) {
  try {
    if (!q || typeof q._bank !== 'string' || q._worked !== undefined || !AUTO_TYPES.has(q.answerType) || Array.isArray(q.boardScheme)) return false;
    if (!Array.isArray(q.criteria) || !q.criteria.length || !Array.isArray(q.steps)) return false;
    return marksPossibleFor(q) >= PARAMETERS.MIN_MARKS && q.criteria.reduce((s, c) => s + (Number(c?.marks) || 0), 0) === marksPossibleFor(q);
  } catch { return false; }
}

// ── reading expressions ─────────────────────────────────────────────────────────────────────────────────────────────────────
const SAMPLE = [1.37, 2.11, 0.53, 3.7, 1.9, 4.2, 0.77, 2.9, 5.3, 1.13, 3.1, 0.31, -0.61, -1.7, 2.6, -2.3, 0.89, 6.1, -0.37, 1.55, 3.3, 0.43, 4.9, -1.2];
const readExpr = text => {
  try {
    const ast = withEvaluationBudget(BUDGET, () => parse(normalize(String(text))));
    return ast ? { ast, vars: [...variablesOf(ast)] } : null;
  } catch { return null; }
};
const evalAt = (e, env) => { try { const v = withEvaluationBudget(BUDGET, () => evaluate(e.ast, env)); return typeof v === 'number' && Number.isFinite(v) ? v : null; } catch { return null; } };
const closeTo = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const envOf = (vars, j) => Object.fromEntries(vars.map((v, k) => [v, SAMPLE[(j * 7 + k * 5) % SAMPLE.length]]));
const constantOf = e => (e && e.vars.length === 0 ? evalAt(e, {}) : null);
/** The same function: equal at every sample where both are defined, defined at MIN_DEFINED_POINTS or more (a constant: equal numbers). */
function sameFunction(a, b) {
  if (!a || !b) return false;
  const vars = [...new Set([...a.vars, ...b.vars])];
  if (!vars.length) { const x = constantOf(a), y = constantOf(b); return x !== null && y !== null && closeTo(x, y); }
  let defined = 0;
  for (let j = 0; j < PARAMETERS.SAMPLE_POINTS; j++) {
    const env = envOf(vars, j);
    const x = evalAt(a, env), y = evalAt(b, env);
    if (x === null || y === null) continue;
    if (!closeTo(x, y)) return false;
    defined++;
  }
  return defined >= PARAMETERS.MIN_DEFINED_POINTS;
}
/** left minus right of one equation as a function. */
const difference = (l, r) => ({ vars: [...new Set([...l.vars, ...r.vars])], l, r });
function proportional(d1, d2) {
  const vars = [...new Set([...d1.vars, ...d2.vars])];
  if (!vars.length) return false;
  let ratio = null, defined = 0;
  for (let j = 0; j < PARAMETERS.SAMPLE_POINTS; j++) {
    const env = envOf(vars, j);
    const a1 = evalAt(d1.l, env), b1 = evalAt(d1.r, env), a2 = evalAt(d2.l, env), b2 = evalAt(d2.r, env);
    if ([a1, b1, a2, b2].some(v => v === null)) continue;
    const g1 = a1 - b1, g2 = a2 - b2;
    const scale = Math.max(1, Math.abs(a1), Math.abs(b1), Math.abs(a2), Math.abs(b2));
    if (Math.abs(g1) <= 1e-7 * scale || Math.abs(g2) <= 1e-7 * scale) { if (Math.abs(g1) <= 1e-7 * scale && Math.abs(g2) <= 1e-7 * scale) continue; return false; }
    const r = g2 / g1;
    if (ratio === null) ratio = r; else if (!closeTo(ratio, r)) return false;
    defined++;
  }
  return defined >= PARAMETERS.MIN_DEFINED_POINTS && ratio !== null && ratio !== 0;
}

const RELATION = /[<>≤≥≠]|!=/;
/** The sides of a line at its `=` signs, or null for an inequality. */
function sidesOf(text) {
  const t = String(text ?? '').trim();
  if (!t || RELATION.test(t)) return null;
  return t.split(/(?<![<>!:=])=(?!=)/).map(s => s.trim());
}
const labelKey = s => { const t = String(s).replace(/\s+/g, '').replace(/[\u2032\u2019]/g, "'"); return /^(?:dy\/dx|y'|d\/dx\(y\))$/.test(t) ? 'd1' : /^(?:d\^?2y\/dx\^?2|y'')$/.test(t) ? 'd2' : t; };
/** A label: a letter, a letter with a call (x(2.5), f'(x)), or a derivative symbol. Spacing aside. */
const isLabel = s => { const t = String(s).replace(/\s+/g, ''); return /^[A-Za-z][A-Za-z0-9_]*'*(?:\([^()]*\))?$/.test(t) || /^d\^?2?[a-z]\/d[a-z]\^?2?$/.test(t) || t === 'd/dx(y)'; };
const formClass = e => (e.vars.length === 0 ? 'number' : e.ast && e.ast.t === 'var' ? 'letter' : 'other');

/**
 * One criterion line read once: { kind: 'expr' | 'value' | 'labelled' | 'equation', ... } or { kind: null, why }.
 */
function readSpec(line) {
  const sides = sidesOf(line);
  if (!sides) return { kind: null, why: 'inequality' };
  if (sides.some(s => !s)) return { kind: null, why: 'unreadable' };
  if (sides.length === 1) {
    const e = readExpr(sides[0]);
    if (!e) return { kind: null, why: 'unreadable' };
    const c = constantOf(e);
    return c !== null ? { kind: 'value', label: null, value: c } : { kind: 'expr', e };
  }
  if (sides.length > 2) return { kind: null, why: 'chain' };
  const [L, R] = sides;
  const el = readExpr(L), er = readExpr(R);
  if (!el || !er) return { kind: null, why: 'unreadable' };
  const cl = constantOf(el), cr = constantOf(er);
  if (isLabel(L) && cr !== null) return { kind: 'value', label: labelKey(L), value: cr };
  if (isLabel(R) && cl !== null) return { kind: 'value', label: labelKey(R), value: cl };
  if (isLabel(L) && er.vars.length) return { kind: 'labelled', label: labelKey(L), e: er };
  if (isLabel(R) && el.vars.length) return { kind: 'labelled', label: labelKey(R), e: el };
  return { kind: 'equation', d: difference(el, er), form: [formClass(el), formClass(er)].sort().join('|') };
}
const bare = spec => spec.kind === 'value';

/** Does one line of the working state this criterion? (provably equal; see the header.) */
function lineStates(spec, text) {
  const sides = sidesOf(text);
  if (!sides || sides.some(s => !s)) return false;
  const first = sides.length >= 2 && isLabel(sides[0]);
  if (spec.kind === 'expr') {
    return sides.some((s, i) => !(first && i === 0) && sameFunction(spec.e, readExpr(s)));
  }
  if (spec.kind === 'value') {
    if (spec.label !== null) {
      if (sides.length < 2) return false;
      const at = sides.findIndex(s => isLabel(s) && labelKey(s) === spec.label);
      if (at < 0) return false;
      return sides.some((s, i) => i !== at && (() => { const c = constantOf(readExpr(s)); return c !== null && closeTo(c, spec.value); })());
    }
    return sides.some((s, i) => !(first && i === 0) && (() => { const c = constantOf(readExpr(s)); return c !== null && closeTo(c, spec.value); })());
  }
  if (spec.kind === 'labelled') {
    if (sides.length < 2 || !isLabel(sides[0]) || labelKey(sides[0]) !== spec.label) return false;
    return sides.slice(1).some(s => sameFunction(spec.e, readExpr(s)));
  }
  if (spec.kind === 'equation') {
    for (let i = 0; i + 1 < sides.length; i++) {
      const l = readExpr(sides[i]), r = readExpr(sides[i + 1]);
      if (!l || !r || [formClass(l), formClass(r)].sort().join('|') !== spec.form) continue;
      if (proportional(spec.d, difference(l, r))) return true;
    }
    return false;
  }
  return false;
}

// ── his steps as a student's page ───────────────────────────────────────────────────────────────────────────────────────────
/** One TeX span as the plain line a student would type, or null when this reader cannot read it. Braces are matched, never guessed at. */
export function texToPlain(tex) {
  { let strict = null; try { strict = readTex(String(tex ?? '').replace(/\\(?:approx|simeq)/g, '='), EXTENDED_TEX); } catch { strict = null; } if (strict) return strict.replace(/\s+/g, ' ').trim() || null; }
  let t = String(tex ?? '').replace(/\\(?:left|right|displaystyle|,|;|!|quad|qquad)/g, ' ').replace(/\\(?:dfrac|tfrac)/g, '\\frac').replace(/\\cdot|\\times/g, '*').replace(/\\div/g, '/').replace(/\\pi\b/g, 'pi').replace(/\\(sin|cos|tan|ln|log|exp)\b/g, '$1').replace(/\\(?:approx|simeq)/g, '=').replace(/\\(?:le|leq)\b/g, '<=').replace(/\\(?:ge|geq)\b/g, '>=').replace(/\\neq?\b/g, '!=').replace(/\\%/g, '%').replace(/\\infty/g, 'inf');
  const group = (str, at) => { // the {...} starting at `at`: [inner, indexAfter] or null
    if (str[at] !== '{') return null;
    let depth = 0;
    for (let i = at; i < str.length; i++) { if (str[i] === '{') depth++; else if (str[i] === '}') { depth--; if (!depth) return [str.slice(at + 1, i), i + 1]; } }
    return null;
  };
  const one = (str, at) => { while (str[at] === ' ') at++; if (str[at] === '{') return group(str, at); if (/[A-Za-z0-9]/.test(str[at] ?? '')) return [str[at], at + 1]; return null; };
  for (let guard = 0; guard < 60; guard++) {
    const f = t.indexOf('\\frac');
    const r = t.indexOf('\\sqrt');
    if (f < 0 && r < 0) break;
    if (f >= 0 && (r < 0 || f < r)) {
      const a = one(t, f + 5); if (!a) return null;
      const b = one(t, a[1]); if (!b) return null;
      const num = a[0].trim(), den = b[0].trim();
      const repl = /^d\^?\{?2?\}?y$/.test(num) && /^dx\^?\{?2?\}?$/.test(den) ? `${num.replace(/[{}]/g, '')}/${den.replace(/[{}]/g, '')}` : `((${num})/(${den}))`;
      t = t.slice(0, f) + repl + t.slice(b[1]);
    } else {
      const a = one(t, r + 5); if (!a) return null;
      t = t.slice(0, r) + `sqrt(${a[0]})` + t.slice(a[1]);
    }
  }
  if (/\\[A-Za-z]/.test(t)) return null;
  t = t.replace(/\^\{([^{}]*)\}/g, '^($1)').replace(/_\{([^{}]*)\}/g, '_$1').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
  t = t.replace(/(\d),(?=\d{3}(?!\d))/g, '$1').replace(/(\d|\))!=(?=[\d(])/g, '$1! = ');
  return t || null;
}
/** The lines of his worked steps as a student would write them: [{ text, step }]. Each $...$ span, cut at an implication or an "or"/"and". */
export function bankAuthoredLines(q) { return withBankReading(() => bankAuthoredLinesRead(q)); }
function bankAuthoredLinesRead(q) {
  const out = [];
  (q.steps || []).forEach((st, i) => {
    if (!isSchemeStep(st)) return;
    for (const m of String(st?.d ?? '').replace(/\\\$/g, '\u0001').matchAll(/\$([^$]+)\$/g)) {
      for (const piece of m[1].split(/\\Rightarrow|\\implies|\\therefore|\\text\{\s*(?:or|and)\s*\}/)) {
        const p = texToPlain(piece);
        if (p) out.push({ text: p, step: i });
      }
    }
  });
  return out;
}

// ── reading the question ────────────────────────────────────────────────────────────────────────────────────────────────────
const wordsOf = s => String(s ?? '').replace(/\\[a-zA-Z]+/g, ' ').replace(/[$\\{}]/g, ' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
const run = (a, b) => { if (!b.length || b.length > a.length) return false; for (let i = 0; i + b.length <= a.length; i++) if (b.every((w, k) => a[i + k] === w)) return true; return false; };
const same = (a, b) => a.length === b.length && a.every((w, i) => w === b[i]);
/** The indexes of q.steps whose heading or text matches a criterion's point (the matching rule in the header). */
export function stepsMatching(point, steps) {
  const P = wordsOf(point);
  if (!P.length) return [];
  const out = [];
  (steps || []).forEach((st, i) => {
    if (!isSchemeStep(st)) return;
    const H = wordsOf(st?.h), T = wordsOf(st?.d);
    const heading = H.length > 0 && (same(P, H) || (H.length <= 3 && run(P, H)) || (P.length <= 3 && run(H, P)));
    const text = P.length >= 3 && run(T, P);
    if (heading || text) out.push(i);
  });
  return out;
}

const promptSides = q => {
  const out = [];
  for (const m of String(q?.prompt ?? '').replace(/\\\$/g, '\u0001').matchAll(/\$([^$]+)\$/g)) {
    let plain = null; try { plain = spanToPlain(m[1]); } catch { plain = null; }
    const sides = plain ? sidesOf(plain) : null;
    if (sides) for (const s of sides) { const e = s ? readExpr(s) : null; if (e) out.push(e); }
  }
  return out;
};
const promptNumbers = q => [...String(q?.prompt ?? '').replace(/(\d),(?=\d{3}(?!\d))/g, '$1').matchAll(/\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
function answerParts(q) {
  const a = q?.answer ?? {};
  const out = { exprs: [], numbers: [] };
  const add = s => { const e = s != null ? readExpr(s) : null; if (e) out.exprs.push(e); };
  if (q.answerType === 'expression') add(a.expr);
  if (q.answerType === 'numeric' && Number.isFinite(a.value)) out.numbers.push(a.value);
  if (q.answerType === 'set') out.numbers.push(...(a.values || []));
  if (q.answerType === 'point') out.numbers.push(a.x, a.y);
  if (q.answerType === 'equation') { add(a.lhs); add(a.rhs); }
  return out;
}

/**
 * What each of his criteria is, decided from the question alone: [{ i, key, point, marks, kind, why, spec?, step? }] where kind is
 * 'answer' | 'manual' | 'line' | 'step' | 'none'. A 'none' says why the rule cannot verify it. `live` is added by the self-test.
 */
function classify(q) {
  _forChains.setFunctions(q);
  const given = promptSides(q), givenNumbers = promptNumbers(q), ans = answerParts(q);
  const isGivenNumber = v => givenNumbers.some(n => closeTo(n, v));
  const isAnswerNumber = v => ans.numbers.some(n => closeTo(n, v));
  const out = [];
  q.criteria.forEach((c, i) => {
    const base = { i, key: `c${i + 1}`, point: String(c.point ?? ''), marks: c.marks };
    if (c.answer === true) return out.push({ ...base, kind: 'answer' });
    if (c.manual === true) return out.push({ ...base, kind: 'manual', why: 'manual' });
    if (typeof c.line === 'string' && c.line.trim()) {
      const spec = readSpec(c.line);
      if (!spec.kind) return out.push({ ...base, kind: 'none', why: spec.why });
      if (spec.kind === 'value') {
        if (isGivenNumber(spec.value)) return out.push({ ...base, kind: 'none', why: 'given-value' });
        if (isAnswerNumber(spec.value)) return out.push({ ...base, kind: 'none', why: 'states-the-answer' });
      }
      const exprs = spec.kind === 'expr' || spec.kind === 'labelled' ? [spec.e] : [];
      if (exprs.some(e => ans.exprs.some(a => sameFunction(a, e)))) return out.push({ ...base, kind: 'none', why: 'states-the-answer' });
      if (spec.kind === 'equation' && q.answerType === 'equation' && ans.exprs.length === 2 && proportional(spec.d, difference(ans.exprs[0], ans.exprs[1]))) return out.push({ ...base, kind: 'none', why: 'states-the-answer' });
      if (spec.kind === 'expr' && given.some(g => sameFunction(g, spec.e))) return out.push({ ...base, kind: 'none', why: 'given' });
      if (spec.kind === 'labelled' && given.some(g => sameFunction(g, spec.e))) return out.push({ ...base, kind: 'none', why: 'given' });
      if (spec.kind === 'equation' && lineStatesGiven(spec, given)) return out.push({ ...base, kind: 'none', why: 'given' });
      const dup = out.find(o => o.kind === 'line' && lineStates(o.spec, String(c.line)));
      if (dup) return out.push({ ...base, kind: 'none', why: `same-as-${dup.key}` });
      return out.push({ ...base, kind: 'line', spec, text: String(c.line) });
    }
    const hits = stepsMatching(c.point, q.steps);
    if (hits.length !== 1) return out.push({ ...base, kind: 'none', why: hits.length ? 'ambiguous-step' : 'no-step' });
    const dup = out.find(o => o.kind === 'step' && o.step === hits[0]);
    if (dup) return out.push({ ...base, kind: 'none', why: `same-step-as-${dup.key}` });
    return out.push({ ...base, kind: 'step', step: hits[0] });
  });
  return out;
}
/** A criterion equation that is a given equation of the prompt (the same sides). */
function lineStatesGiven(spec, givenExprs) {
  for (let i = 0; i + 1 < givenExprs.length; i++) if ([formClass(givenExprs[i]), formClass(givenExprs[i + 1])].sort().join('|') === spec.form && proportional(spec.d, difference(givenExprs[i], givenExprs[i + 1]))) return true;
  return false;
}

// ── the award ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
const ticked = l => l?.status === 'ok' && l.ecf !== true && l.given !== true && l.state !== 'given' && l.restates !== true;
const probeOf = q => ({ ...q, authoredMarks: PARAMETERS.REACH_MARKS, steps: [...q.steps, { h: 'Note', d: 'bank-author-criteria probe: every candidate step of his solution is a key step' }] });

function promptCanons(q) {
  _forChains.setFunctions(q);
  const pc = new Set();
  try { for (const s of statementsOfSpans(q?.prompt)) { for (const p of s.parts) pc.add(canon(p)); pc.add(canon(s.plain)); } } catch { /* none */ }
  return pc;
}
/** The index of the first line that is not ticked and not a restatement of the question; lines.length when there is none. */
function stopOf(lines, limit, q) {
  const pc = promptCanons(q);
  for (let j = 0; j < limit; j++) {
    const l = lines[j];
    if (!l || l.status === 'ok') continue;
    let s = null; try { s = readStudent(String(l.text ?? '').trim()); } catch { s = null; }
    if (s && !s.multi && s.parts.length && s.parts.every(p => pc.has(canon(p)))) continue;
    return j;
  }
  return limit;
}

/** Distinct line per criterion, criteria in his order, lines earliest first (augmenting paths). candidates: Map(criterion index -> [line indexes]). */
function assign(order, candidates) {
  const lineOf = new Map(), holder = new Map();
  const tryOne = (c, seen) => {
    for (const j of candidates.get(c) || []) {
      if (seen.has(j)) continue;
      seen.add(j);
      const h = holder.get(j);
      if (h === undefined || tryOne(h, seen)) { holder.set(j, c); lineOf.set(c, j); return true; }
    }
    return false;
  };
  for (const c of order) tryOne(c, new Set());
  return lineOf;
}

/** Which criteria the working meets, before any cap: { lineOf: Map(criterion index -> line index), cross, stop, limit }. `live` limits to the verifiable ones. */
function meet(q, specs, lines) {
  const cross = lines.findIndex(l => l?.status === 'break');
  const limit0 = cross < 0 ? lines.length : cross;
  const stop = PARAMETERS.STOP_AT_FIRST_UNTICKED ? stopOf(lines, limit0, q) : limit0;
  const limit = Math.min(limit0, stop);
  const live = specs.filter(s => s.live !== false);
  const candidates = new Map();
  const prior = []; // line indexes that reached something: a step of his solution (the generic rule) or a non-bare criterion
  let stepLines = new Map();
  if (live.some(s => s.kind === 'step') || live.some(s => s.kind === 'line' && bare(s.spec))) {
    try {
      const award = awardGeneric(probeOf(q), { lines }, false);
      for (const it of award?.items || []) if (it.awarded && it.basis === 'lines' && it.lines.length) stepLines.set(Number(it.key.replace('step-', '')) - 1, it.lines[0] - 1);
    } catch { stepLines = new Map(); }
    for (const j of stepLines.values()) if (j < limit && ticked(lines[j])) prior.push(j);
  }
  for (const s of live) {
    if (s.kind === 'step') { const j = stepLines.get(s.step); if (j !== undefined && j < limit && ticked(lines[j])) candidates.set(s.i, [j]); }
    else if (s.kind === 'line') {
      const hits = [];
      for (let j = 0; j < limit; j++) if (ticked(lines[j]) && lineStates(s.spec, lines[j].text)) hits.push(j);
      if (!bare(s.spec) && hits.length) prior.push(hits[0]);
      candidates.set(s.i, hits);
    }
  }
  // a bare value needs working before it: an earlier ticked line that reached a step of his solution or another criterion, or an earlier ticked
  // equation of the page (not the question's own) that the value solves, for a one-letter label
  const pc = promptCanons(q);
  const supports = (s, j) => {
    if (!/^[A-Za-z]$/.test(s.spec.label ?? '')) return false;
    for (let p = 0; p < j; p++) {
      const l = lines[p];
      if (!ticked(l) || !(l.text || '').includes('=')) continue;
      const st = (() => { try { return readStudent(String(l.text).trim()); } catch { return null; } })();
      if (st && !st.multi && st.parts.length && st.parts.every(x => pc.has(canon(x)))) continue;
      const sides = sidesOf(l.text);
      if (!sides || sides.some(x => !x)) continue;
      for (let i = 0; i + 1 < sides.length; i++) {
        const a = readExpr(sides[i]), b = readExpr(sides[i + 1]);
        if (!a || !b || [...a.vars, ...b.vars].some(v => v !== s.spec.label) || (!a.vars.length && !b.vars.length)) continue;
        const at = (e, v) => evalAt(e, { [s.spec.label]: v });
        const g0 = [at(a, s.spec.value), at(b, s.spec.value)], g1 = [at(a, s.spec.value + 1.37), at(b, s.spec.value + 1.37)];
        if (g0.some(x => x === null) || g1.some(x => x === null)) continue;
        if (closeTo(g0[0], g0[1]) && !closeTo(g1[0], g1[1])) return true;
      }
    }
    return false;
  };
  for (const s of live) if (s.kind === 'line' && bare(s.spec)) candidates.set(s.i, (candidates.get(s.i) || []).filter(j => prior.some(p => p < j) || supports(s, j)));
  const lineOf = assign(live.map(s => s.i), candidates);
  return { lineOf, cross, stop, limit, lines };
}

const fmt = (t, o) => t.replace(/\{(\w+)\}/g, (_, k) => String(o[k]));

/** The table (items) and the total for a working, given the plan's specs. Items are HIS criteria, in his order. */
function tableOf(q, specs, report, correct) {
  const N = marksPossibleFor(q);
  const lines = Array.isArray(report?.lines) ? report.lines : [];
  const m = meet(q, specs, lines);
  const answerMarks = specs.filter(s => s.kind === 'answer').reduce((n, s) => n + s.marks, 0);
  const cap = N - Math.max(answerMarks, PARAMETERS.WRONG_ANSWER_CAP_BELOW_FULL);
  let running = 0;
  const items = specs.map(s => {
    const base = { key: s.key, text: s.point, marks: s.marks };
    if (s.kind === 'answer') return { ...base, awarded: correct === true, verified: true, lines: [], basis: 'answer', reason: correct === true ? BANK_WORDING.answerRight : BANK_WORDING.answerWrong };
    const at = s.live !== false && m.lineOf.has(s.i) ? m.lineOf.get(s.i) : -1;
    if (correct === true) return { ...base, awarded: true, verified: true, lines: at >= 0 ? [at + 1] : [], basis: at >= 0 ? 'lines' : 'answer', reason: at >= 0 ? fmt(BANK_WORDING.earned, { n: at + 1 }) : BANK_WORDING.answerRight };
    if (at >= 0) {
      if (running + s.marks > cap) return { ...base, awarded: false, verified: true, lines: [at + 1], basis: 'lines', reason: BANK_WORDING.held };
      running += s.marks;
      return { ...base, awarded: true, verified: true, lines: [at + 1], basis: 'lines', reason: fmt(BANK_WORDING.earned, { n: at + 1 }) };
    }
    if (s.kind === 'manual') return { ...base, awarded: false, verified: false, lines: [], basis: 'lines', reason: BANK_WORDING.manual };
    if (s.kind === 'none' || s.live === false) return { ...base, awarded: false, verified: false, lines: [], basis: 'lines', reason: BANK_WORDING.cannot };
    if (m.cross >= 0) return { ...base, awarded: false, verified: true, lines: [], basis: 'lines', reason: fmt(BANK_WORDING.noLine, { n: m.cross + 1 }) };
    if (m.stop < lines.length) return { ...base, awarded: false, verified: false, lines: [], basis: 'lines', reason: fmt(BANK_WORDING.stopped, { n: m.stop + 1 }) };
    return { ...base, awarded: false, verified: false, lines: [], basis: 'lines', reason: BANK_WORDING.unverified };
  });
  // held-back lines are not paid lines: the held marks fall below the cap, so a table that shows `lines` on an unawarded item stays honest
  for (const it of items) if (!it.awarded && it.reason === BANK_WORDING.held) it.lines = [];
  const total = items.reduce((n, i) => n + (i.awarded ? i.marks : 0), 0);
  return { items, total, possible: N, cross: m.cross, stop: m.stop, limit: m.limit, lineOf: m.lineOf };
}

// ── the plan and the proof ─────────────────────────────────────────────────────────────────────────────────────────────────
const planMemo = new Map();
const keyOf = q => JSON.stringify([q?._bank, q?.prompt, q?.steps, q?.criteria, q?.answer, q?.answerType, q?.authoredMarks, q?.traps]);
const trapText = t => (t?.expr !== undefined ? String(t.expr) : t?.value !== undefined ? String(t.value) : Array.isArray(t?.values) ? t.values.map(String).join(', ') : t?.region !== undefined ? String(t.region) : t?.eq !== undefined ? String(t.eq) : Array.isArray(t?.point) && t.point.length === 2 ? `(${t.point[0]}, ${t.point[1]})` : null);
const WRONG = '99991';
/** The line with its last number made a different one (a wrong line). */
function wrongLine(text) {
  const eq = text.lastIndexOf('=');
  const body = eq >= 0 ? text.slice(eq + 1) : text;
  const m = [...body.matchAll(/\d+/g)].pop();
  if (!m) return null;
  return text.slice(0, eq + 1) + body.slice(0, m.index) + (Number(m[0]) * 7 + 13) + body.slice(m.index + m[0].length);
}
const promptLines = q => [...String(q.prompt).replace(/\\\$/g, '\u0001').matchAll(/\$([^$]+)\$/g)].map(m => { try { return spanToPlain(m[1]); } catch { return null; } }).filter(Boolean);

/** Mark a page the way the server does (stepEvidence's deterministic report, then the award). */
export function markBankPage(q, specs, lines, typed, correct = false) { return withBankReading(() => markBankPageRead(q,specs,lines,typed,correct)); }
function markBankPageRead(q, specs, lines, typed, correct = false) {
  const ev = stepEvidence(q, typed, lines.join('\n'), { correct }, { slipWarnings: true });
  const report = ev?.stepReport || null;
  return { report, ...tableOf(q, specs, report, correct) };
}

/**
 * The plan of one bank part: { eligible, why, marks, specs, proof } where specs are his criteria with their kind and (after the self-test) `live`
 * (the rule can verify it and his own steps earn it). `proof` lists what each page of the import-time proof earned. Pure of the student's work.
 */
export function bankPlan(q) { return withBankReading(() => bankPlanRead(q)); }
function bankPlanRead(q) {
  if (!bankStructural(q)) return { eligible: false, why: 'not-structural', marks: 0, specs: [], proof: {} };
  const k = keyOf(q);
  if (planMemo.has(k)) return planMemo.get(k);
  let plan;
  try { plan = withEvaluationBudget(BUDGET * 40, () => buildPlan(q)); } catch { plan = { eligible: false, why: 'error', marks: marksPossibleFor(q), specs: [], proof: {} }; }
  if (planMemo.size > 600) planMemo.clear();
  planMemo.set(k, plan);
  return plan;
}

function buildPlan(q) {
  const N = marksPossibleFor(q);
  const specs = classify(q).map(s => ({ ...s, live: s.kind === 'line' || s.kind === 'step' }));
  const fail = (why, proof = {}) => ({ eligible: false, why, marks: N, specs, proof });
  if (!specs.some(s => s.live)) return fail('no-verifiable-criterion');
  const lines = bankAuthoredLines(q).slice(0, 24);
  if (!lines.length) return fail('no-lines');
  const texts = lines.map(l => l.text);
  // SELF-TEST: his steps, as a student's page with a wrong typed answer, through the same evidence path the server runs
  const p0 = markBankPage(q, specs, texts, WRONG);
  if (!p0.report || !Array.isArray(p0.report.lines) || p0.report.lines.length !== texts.length) return fail('authored-working-not-read');
  const earned0 = new Map(p0.lineOf);
  for (const s of specs) if (s.live && !earned0.has(s.i)) { s.live = false; s.why = 'his-own-steps-do-not-earn-it'; }
  if (!specs.some(s => s.live)) return fail('no-verifiable-criterion');
  const proof = { whole: { earned: [...earned0.keys()].map(i => specs[i].key) } };
  const earnedKeys = r => new Set([...r.lineOf.keys()].filter(i => r.items[i].awarded).map(i => specs[i].key));
  const live = new Set(specs.filter(s => s.live).map(s => s.key));
  // 1. his steps, wrong typed answer: exactly the verifiable criteria, never the answer criterion
  const p1 = markBankPage(q, specs, texts, WRONG);
  const e1 = earnedKeys(p1);
  const answerEarned = r => r.items.some((it, i) => specs[i].kind === 'answer' && it.awarded);
  if (answerEarned(p1) || [...e1].some(k => !live.has(k))) return fail('proof:wrong-answer-page', proof);
  if (p1.total > N - 1) return fail('proof:wrong-answer-page-at-N', proof);
  // 2. the last line made wrong: the same, except what rested on that line
  const last = texts.length - 1, bad = wrongLine(texts[last]);
  if (bad && bad !== texts[last]) {
    const broken = texts.map((t, i) => (i === last ? bad : t));
    const p2 = markBankPage(q, specs, broken, WRONG);
    const e2 = earnedKeys(p2);
    const restedOnLast = new Set([...earned0].filter(([, j]) => j === last).map(([i]) => specs[i].key));
    if (answerEarned(p2) || [...e2].some(k => !live.has(k))) return fail('proof:wrong-last-line', proof);
    // anything he earned that is lost must have rested on the line made wrong, or be a bare value (which needs an earlier line that reached something)
    const lost = [...live].filter(k => !e2.has(k) && !restedOnLast.has(k) && !specs.find(s => s.key === k && s.kind === 'line' && bare(s.spec)));
    if (lost.length) return fail('proof:wrong-last-line-lost-a-criterion', proof);
    proof.wrongLast = { earned: [...e2] };
  }
  // 3. his steps with the right answer: N
  const p3 = markBankPage(q, specs, texts, WRONG, true);
  if (p3.total !== N) return fail('proof:right-answer-not-N', proof);
  // 4. the question restated, only its given values, and each trap answer alone: nothing
  const nums = [...new Set([...String(q.prompt).matchAll(/\d+(?:\.\d+)?/g)].map(m => m[0]))];
  const pages = [['restated', promptLines(q), WRONG], ['given-values', nums, WRONG], ['no-working', [], WRONG]];
  for (const t of q.traps || []) { const tt = trapText(t); if (tt !== null) { pages.push(['trap-alone', [], tt]); pages.push(['trap-as-line', [tt], tt]); } }
  for (const [name, ls, typed] of pages) {
    if (!ls.length && name !== 'no-working' && name !== 'trap-alone') continue;
    const r = markBankPage(q, specs, ls, typed);
    if (r.total > 0) return fail(`proof:${name}-earned-${r.total}`, proof);
  }
  proof.pages = pages.length;
  return { eligible: true, why: null, marks: N, specs, proof };
}

export const bankEligible = q => bankPlan(q).eligible === true;

/**
 * Award the rule from the deterministic step report. Returns { items, total, possible, cross, plan } like awardScheme/awardGeneric, or null when the
 * rule cannot pay this question. items: HIS criteria, in his order, each earned / not earned / not verified with the line numbers.
 */
export function awardBank(q, report, correct) { return withBankReading(() => awardBankRead(q,report,correct)); }
function awardBankRead(q, report, correct) {
  const plan = bankPlan(q);
  if (!plan.eligible) return null;
  let t = null;
  try { t = withEvaluationBudget(BUDGET * 10, () => tableOf(q, plan.specs, report, correct === true)); } catch { return null; }
  return { items: t.items, total: t.total, possible: t.possible, cross: t.cross, stop: t.stop, plan };
}

/** The import-time proof of one part, for the importer and the real-pack check: { eligible, why, verifiable, notVerified, criteria } . */
export function bankProof(q) { return withBankReading(() => bankProofRead(q)); }
function bankProofRead(q) {
  const plan = bankPlan(q);
  const crit = plan.specs.filter(s => s.kind !== 'answer');
  return {
    eligible: plan.eligible, why: plan.why, marks: plan.marks,
    verifiable: crit.filter(s => s.live).length, notVerified: crit.filter(s => !s.live).length,
    criteria: plan.specs.map(s => ({ key: s.key, point: s.point, marks: s.marks, kind: s.kind, live: s.live === true, why: s.why ?? null }))
  };
}
