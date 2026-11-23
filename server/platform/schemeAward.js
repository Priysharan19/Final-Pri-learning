// Pri Learning · method marks paid by a signed scheme, per question type, from the SAME line report the page shows
//
// R4 (marking authority). The generic method-mark rubric (checker.methodMarks) counts lines that "moved the solution on". A scheme
// is different: the author signs a short list of criteria for ONE question type (docs/marking/method-marks-signoff), and this module pays
// exactly those, so that what he signs is what is paid. It is the only source of the criteria: tools/method-marks-drafts.mjs
// generates the owner packets from it, so a packet and the server cannot disagree.
//
//   · a criterion is earned by a TICKED line of the displayed step report (status ok, not a copied given, not carried forward),
//     before the first line the report crosses; nothing at or after a crossed line earns (the existing policy, unchanged)
//   · the final-answer criterion is earned only by a correct final answer (the answer checker, never a line, never a model)
//   · a correct final answer is full marks, as it always was: every criterion is then earned, and a criterion no ticked line
//     could be found for says "the final answer" as its reason
//   · a wrong final answer can never reach full marks, and the marks never exceed the question's marks
//   · a criterion earned by lines records which line numbers earned it; one it could not verify says so (not "wrong")
//   · the scheme pays a question only when its criteria add up to the question's marks; otherwise the question stays on the final
//     answer and the reply records why
//
// GATES (all must hold; none is set by this module):
//   1. APPROVED_SCHEME_TYPES, the explicit per-type allow-list for the NSW bank. EMPTY in the repository: nothing is paid by a
//      scheme until the author's approval is committed here, type by type, with the digest he read.
//   2. editionMarkingPolicy(env): PRI_METHOD_MARKS=on, in production PRI_METHOD_MARKS_EXAMINER_RESULT (markingPolicy.js), and the edition
//      not in UNCERTIFIED_EDITIONS (editionMarking.js: Prithagoras is, until its own signed evidence lifts it). All unchanged.
//   3. A question is stamped `_methodScheme` at issue only for an allow-listed type (editionBanks.sealForEdition); every other
//      question stays sealed final-answer-only.
//
// Pure and deterministic: no model, no network, no clock. India is unchanged (its bank has no allow-list and no seal).
import crypto from 'node:crypto';
import { publicDescription } from './lineInterpreter/givens.js';
import { makeFn, polynomial, extremes } from './lineInterpreter/truth.js';
import { editionMarkingPolicy, editionMethodMarksRefusal } from './editionMarking.js';

/** The question types whose scheme the author has approved for payment. EMPTY by default. Entries: { typeId, digest }. */
export const APPROVED_SCHEME_TYPES = Object.freeze([]);

const fnOf = q => { const f = publicDescription(q).functions; return f.length === 1 ? makeFn(f[0]) : null; };
const aLoneNumber = text => /=\s*-?\d+(?:\.\d+)?\s*$/.test(String(text ?? ''));
const labelled = word => l => new RegExp(`^\\s*${word}\\b`, 'i').test(String(l.text ?? ''));
// "Substitutes the value" is earned only when the line really puts the asked value in: the number after the function's name (P(2), h(5))
// must stand in the right side as often as the function has its variable. A line that substitutes a different number and happens to come to
// the same value (P(2) = P(3)) is true as written, so the tick alone cannot tell it apart; this can.
const askedValue = q => {
  const p = String(q?.prompt ?? '');
  const ev = /evaluate \$P\((-?\d+)\)\$/i.exec(p) || /find \$[a-z]\((-?\d+)\)\$/i.exec(p);
  if (ev) return Number(ev[1]);
  const rem = /divided by \$?\(x\s*([+-])\s*(\d+)\)/i.exec(p);
  return rem ? (rem[1] === '+' ? -Number(rem[2]) : Number(rem[2])) : null;
};
const substitutes = (l, q) => {
  const m = /^\s*[A-Za-z]\(\s*(-?\d+(?:\.\d+)?)\s*\)\s*=(.*)$/.exec(String(l.text ?? ''));
  const f = publicDescription(q).functions[0];
  if (!m || !f || aLoneNumber(l.text) || Number(m[1]) !== askedValue(q)) return false;
  const uses = (f.rhs.match(new RegExp(`(?<![A-Za-z])${f.variable}(?![A-Za-z])`, 'g')) || []).length;
  const at = m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return uses > 0 && (m[2].match(new RegExp(`(?<![\\d.^])${at}(?![\\d.])`, 'g')) || []).length >= uses;
};
const ANSWER = { key: 'answer', by: 'final', marks: 1, how: 'the answer checker marks the final answer, the same check that marks a one-line answer' };

// A criterion's `line` predicate sees one TICKED line of the displayed report (and its place); it never sees the key or a mark.
export const SCHEMES = Object.freeze([
  {
    id: 'y12-diff-rules', title: 'Differentiate using the chain, product or quotient rule', course: 'Year 12 Mathematics Advanced', year: 12, level: 1,
    families: ['y12-diff'],
    pick: q => q.answerType === 'expression' && !!fnOf(q) && fnOf(q).name === 'y' && /differentiate/i.test(q.prompt),
    criteria: [
      { key: 'derivative', by: 'line', marks: 1, text: 'Writes a correct derivative of the given function (any equivalent form).', how: 'a line the step check ticks as equal to the derivative of the given function, in any form', line: () => true },
      { ...ANSWER, marks: 1, text: 'Gives the final answer correctly, in the form the question asks.' }
    ]
  },
  {
    id: 'y12-trig-extreme', title: 'Maximum or minimum of a sine or cosine model', course: 'Year 12 Mathematics Advanced', year: 12, level: 1,
    families: ['y12-trig-model'],
    pick: q => q.answerType === 'numeric' && !!fnOf(q) && /(maximum|minimum) value/i.test(q.prompt) && !!extremes(fnOf(q))?.period,
    criteria: [
      { key: 'amplitude', by: 'line', marks: 1, text: 'States the amplitude correctly.', how: 'a line "amplitude = ..." that the step check ticks as the amplitude of the given function', line: labelled('amplitude') },
      { key: 'midline', by: 'line', marks: 1, text: 'States the midline (centre value) correctly.', how: 'a line "midline = ..." that the step check ticks as the centre value of the given function', line: labelled('midline') },
      { ...ANSWER, key: 'extreme', marks: 1, text: 'States the maximum or minimum value asked for, correctly (the final answer).' }
    ]
  },
  {
    id: 'y12-trig-evaluate', title: 'Find the value of a sine or cosine model at a time', course: 'Year 12 Mathematics Advanced', year: 12, level: 1,
    families: ['y12-trig-model'],
    pick: q => q.answerType === 'numeric' && !!fnOf(q) && /find \$[a-z]\(\d+\)\$/i.test(q.prompt),
    criteria: [
      { key: 'substitute', by: 'line', marks: 1, text: 'Substitutes the value of t into the model correctly.', how: 'a line that starts with the model written at the given value, for example h(5) = ..., with a right side that is not just a number, which the step check ticks', line: (l, k, lines, q) => substitutes(l, q) },
      { ...ANSWER, marks: 1, text: 'States the value correctly.' }
    ]
  },
  {
    id: 'y12-diff-explog', title: 'Differentiate an exponential or logarithmic function', course: 'Year 12 Mathematics Advanced', year: 12, level: 1,
    families: ['y12-explogcalc'],
    pick: q => q.answerType === 'expression' && /differentiate/i.test(q.prompt) && !/integral|\\int/i.test(q.prompt),
    criteria: [
      { key: 'derivative', by: 'line', marks: 1, text: 'Writes a correct derivative (any equivalent form).', how: 'a line the step check ticks as equal to the derivative of the given function, in any form', line: () => true },
      { ...ANSWER, marks: 1, text: 'Gives the final answer correctly, in the form the question asks.' }
    ]
  },
  {
    id: 'y11-poly-evaluate', title: 'Evaluate a polynomial or find a remainder by substitution', course: 'Year 11 Mathematics Advanced', year: 11, level: 2,
    families: ['y11-polynomials'],
    pick: q => q.answerType === 'numeric' && !!fnOf(q) && fnOf(q).name === 'P' && /evaluate \$P\(-?\d+\)\$|remainder when/i.test(q.prompt),
    criteria: [
      { key: 'substitute', by: 'line', marks: 1, text: 'Substitutes the correct value into P(x).', how: 'a line that starts with P at the given value, with a right side that is not just a number, which the step check ticks as true for the question\'s polynomial', line: (l, k, lines, q) => /^\s*P\s*\(/.test(String(l.text ?? '')) && substitutes(l, q) },
      { ...ANSWER, marks: 1, text: 'Evaluates correctly to give the value or remainder.' }
    ]
  },
  {
    id: 'y11-diff-gradient-plan', title: 'Gradient of a tangent: differentiate, then substitute', course: 'Year 11 Mathematics Advanced', year: 11, level: 2,
    families: ['y11-diff'],
    pick: q => q.stepcheck?.kind === 'plan' && q.answerType === 'numeric' && /gradient of the tangent/i.test(q.prompt) && !!fnOf(q) && polynomial(fnOf(q)) !== null,
    criteria: [
      { key: 'derivative', by: 'line', marks: 1, text: 'Differentiates the function correctly (stage 1 of the plan).', how: 'a line the step check ticks at stage 1 of the question\'s plan (the derivative stage)', line: l => l.stage === 0 },
      { ...ANSWER, key: 'gradient', marks: 1, text: 'Substitutes the x-value and finds the gradient correctly (the final answer).' }
    ]
  },
  {
    id: 'y11-diff-power-rule', title: 'Differentiate a polynomial by the power rule', course: 'Year 11 Mathematics Advanced', year: 11, level: 2,
    families: ['y11-diff'],
    pick: q => q.answerType === 'expression' && q.stepcheck?.kind === 'derivative',
    criteria: [
      { key: 'derivative', by: 'line', marks: 1, text: 'Writes a correct derivative.', how: 'a line the step check ticks against the question\'s derivative step', line: () => true },
      { ...ANSWER, marks: 1, text: 'Gives the final answer correctly.' }
    ]
  }
]);

/** Types the page cannot verify line by line today, each with the reason. They are never paid by a scheme. */
export const UNAVAILABLE = Object.freeze([
  { id: 'y12-diff-gradient', title: 'Differentiate, then find the gradient at a point', course: 'Year 12 Mathematics Advanced', level: 1, families: ['y12-diff'],
    reason: 'The question has no step plan, so the page leaves the derivative line unchecked; only the final value is verified. "Differentiates correctly" cannot be decided from the lines the student sees.' },
  { id: 'y12-stationary-x', title: 'Find the x-coordinates of the stationary points', course: 'Year 12 Mathematics Advanced', level: 1, families: ['y12-appdiff'],
    reason: 'The page leaves the derivative line and the "let the derivative equal zero" line unchecked (it checks the equation and the roots only), so two of the three criteria cannot be decided from the lines the student sees.' },
  { id: 'y12-tangent', title: 'Find the equation of a tangent', course: 'Year 12 Mathematics Advanced', level: 1, families: ['y12-appdiff'],
    reason: 'The page ticks the line that finds the point of contact but leaves the derivative line unchecked, so "differentiates correctly" cannot be decided from the lines the student sees.' }
]);

const byId = new Map(SCHEMES.map(s => [s.id, s]));
export const schemeById = id => byId.get(id) ?? null;
export const schemeMarks = scheme => scheme.criteria.reduce((n, c) => n + c.marks, 0);

const canon = v => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v ?? null));
/** The digest the author signs: the type, its criteria, their marks and how each is decided. Any change revokes an approval. */
export const schemeDigest = scheme => crypto.createHash('sha256').update(canon({
  id: scheme.id, title: scheme.title, criteria: scheme.criteria.map(c => ({ key: c.key, by: c.by, marks: c.marks, text: c.text, how: c.how }))
})).digest('hex');

/** The scheme of an issued question's type, or null. `generator` is the family that drew it. */
export function schemeTypeOf(q, generator = q?._generator ?? q?.subtopic) {
  for (const s of SCHEMES) {
    if (!s.families.includes(generator)) continue;
    try { if (s.pick(q)) return s.id; } catch { /* not this type */ }
  }
  return null;
}

/** Is this type approved, for the digest it has now? `list` defaults to the repository's (empty) allow-list. */
export const isApproved = (typeId, list = APPROVED_SCHEME_TYPES) => {
  const s = byId.get(typeId);
  return !!s && list.some(a => a?.typeId === typeId && a.digest === schemeDigest(s));
};

/** A line a criterion may rest on: ticked, the student's own work, not a copied given and not carried forward from a slip. */
const ticked = l => l?.status === 'ok' && l.ecf !== true && l.given !== true && l.state !== 'given' && l.restates !== true;

/**
 * Award one scheme from the displayed step report and whether the final answer is right. `topic` is the zero-based lines the topic check
 * itself verified (null: every ticked line counts, as where the page's report is the topic check's own).
 * Returns { items, total, possible, cross }: items are { key, text, marks, awarded, verified, lines, basis, reason }, in the scheme's order.
 *   awarded     the criterion is earned
 *   verified    false only for an unearned line criterion that no line of the page could settle (never a claim that it is wrong)
 *   lines       the 1-based line numbers that earned it (empty when only the final answer did)
 *   basis       'lines' | 'answer'
 */
export function awardScheme(scheme, report, correct, topic = null, q = null) {
  const lines = Array.isArray(report?.lines) ? report.lines : [];
  const cross = lines.findIndex(l => l?.status === 'break');
  const limit = cross < 0 ? lines.length : cross;
  const used = new Set();
  const items = scheme.criteria.map(c => {
    const base = { key: c.key, text: c.text, marks: c.marks };
    if (c.by === 'final') {
      return correct === true
        ? { ...base, awarded: true, verified: true, lines: [], basis: 'answer', reason: 'The final answer is correct.' }
        : { ...base, awarded: false, verified: true, lines: [], basis: 'answer', reason: 'The final answer was not correct.' };
    }
    const at = lines.slice(0, limit).findIndex((l, k) => !used.has(k) && ticked(l) && (topic === null || topic.includes(k)) && c.line(l, k, lines, q));
    if (at >= 0) used.add(at);
    if (correct === true) return { ...base, awarded: true, verified: true, lines: at >= 0 ? [at + 1] : [], basis: at >= 0 ? 'lines' : 'answer', reason: at >= 0 ? `Line ${at + 1} is ticked.` : 'The final answer is correct, so this criterion is met.' };
    if (at >= 0) return { ...base, awarded: true, verified: true, lines: [at + 1], basis: 'lines', reason: `Line ${at + 1} is ticked.` };
    return cross >= 0
      ? { ...base, awarded: false, verified: true, lines: [], basis: 'lines', reason: `No ticked line before the first crossed line (line ${cross + 1}) earned it.` }
      : { ...base, awarded: false, verified: false, lines: [], basis: 'lines', reason: 'Pri could not verify a line for this criterion.' };
  });
  const total = items.reduce((n, i) => n + (i.awarded ? i.marks : 0), 0);
  return { items, total, possible: schemeMarks(scheme), cross };
}

/**
 * What a scheme pays one resolved practice question. `{ paid: false, reason }` when it must not pay it; otherwise
 * `{ paid: true, typeId, digest, items, awarded, partial }` where `partial` has the shape the rest of the reply already reads.
 */
export function schemePay({ q, report, topic = null, correct, marksPossible, env = process.env, list = APPROVED_SCHEME_TYPES }) {
  const typeId = typeof q?._methodScheme === 'string' ? q._methodScheme : null;
  const scheme = typeId ? byId.get(typeId) : null;
  if (!scheme) return { paid: false, reason: 'not-a-scheme-question' };
  if (!isApproved(typeId, list)) return { paid: false, typeId, reason: 'type-not-approved' };
  // Every existing gate, unchanged: the switch, the production examiner result, and the edition's certification. While Prithagoras is in
  // UNCERTIFIED_EDITIONS (editionMarking.js) the policy is final answer only and nothing is paid, whatever the list and the switch say.
  if (editionMarkingPolicy(env).methodMarks !== true) return { paid: false, typeId, reason: editionMethodMarksRefusal(env)?.code ?? 'method-marks-off' };
  const possible = schemeMarks(scheme);
  if (possible !== marksPossible) return { paid: false, typeId, reason: `criteria-count: the scheme has ${possible} marks and this question is worth ${marksPossible}, so it stays on the final answer` };
  const award = awardScheme(scheme, report, correct, topic, q);
  // A wrong final answer never reaches full marks (the answer criterion is the one a wrong answer cannot earn).
  const awarded = correct === true ? possible : Math.min(award.total, possible - 1);
  const earnedLines = award.items.filter(i => i.awarded && i.basis === 'lines').length;
  return {
    paid: true, typeId, digest: schemeDigest(scheme), items: award.items, awarded,
    partial: {
      okLines: earnedLines, awarded,
      note: awarded > 0 ? `${awarded} of ${possible} marks for the criteria your ticked lines earned: the final answer was not right.` : 'No method marks: no criterion of the scheme was earned by a ticked line.',
      lines: [], lost: [], scheme: typeId
    }
  };
}
