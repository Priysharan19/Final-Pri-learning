// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the working review — one result per written line
//
// What a student is shown about their working after the grade is committed,
// whichever way the working arrived (typed, written in ink, photographed). It
// is assembled from deterministic evidence only:
//
//   · Step Check's report (checker.js) — is the line true of this question?
//   · the line audit (lineAudit.js)    — is the line true of the line before it?
//   · the method-mark vector            — which rubric criterion did it earn?
//
// and it keeps four things apart that are easy to blur into one tick:
//
//   read       the line as submitted (a blank line keeps its place)
//   check      what the mathematics on it was shown to be
//   criterion  the rubric criterion it earned a mark for, if any
//   final      whether the value the working arrives at is the right one
//
// `check` is one of
//   verified         shown true            follows-through  true of the student's own slipped value
//   first-mistake    the first line shown false, and independent of anything above it
//   later-mistake    a second mistake, independent of the first
//   after-mistake    after the first mistake and not judged again
//   confirm          a reading to confirm — a letter where a digit probably was, or two possible readings
//   not-checked      nothing could be shown either way
//
// A line that was not shown false is never called a mistake, and a line that
// was not shown true is never ticked. `certified` is true only when every
// written line is verified and the final answer is right.
//
// This module decides no mark. It reports the marks the marker already decided.
// It is built only by the reply that resolves a question, so the corrections in
// it (which state right values) are released together with the solution.
// ─────────────────────────────────────────────────────────────────────────────
import { normalize, parse, evaluate, variablesOf, numsClose, withEvaluationBudget } from './expr.js';
import { auditWorking, breakOn, describeBreak } from './lineAudit.js';

export const WORKING_REVIEW_VERSION = 1;
export const REVIEW_CHECKS = Object.freeze(['verified', 'follows-through', 'first-mistake', 'later-mistake', 'after-mistake', 'confirm', 'not-checked']);
export const ERROR_CLASSES = Object.freeze(['arithmetic-slip', 'sign', 'wrong-formula', 'substitution', 'given-misread', 'invalid-transformation', 'unknown']);

const fmt = v => String(Number(Number(v).toPrecision(10)));

/** The single letters the PUBLIC question uses in its mathematics. */
export function promptLetters(prompt) {
  const out = new Set();
  for (const m of String(prompt ?? '').matchAll(/\$\$?([^$]+)\$\$?/g)) {
    const plain = m[1].replace(/\\[a-zA-Z]+/g, ' ');
    for (const hit of plain.matchAll(/(?<![A-Za-z])[A-Za-z](?![A-Za-z])/g)) out.add(hit[0]);
  }
  return out;
}

function vocabularyFor(meta, prompt) {
  const letters = promptLetters(prompt);
  for (const name of [meta?.variable, ...(Array.isArray(meta?.variables) ? meta.variables : []), ...Object.keys(meta?.substitutions || {}), ...Object.keys(meta?.solution || {})]) {
    if (typeof name === 'string' && name.length === 1) letters.add(name);
  }
  for (const source of [meta?.source, meta?.canonical]) {
    if (typeof source === 'string') for (const hit of source.matchAll(/(?<![A-Za-z])[A-Za-z](?![A-Za-z])/g)) letters.add(hit[0]);
  }
  return letters;
}

const SIGN_CODES = new Set(['sign-flipped', 'sign-on-transfer', 'arithmetic-sign', 'negative-squared', 'inequality-direction', 'sign-not-distributed', 'minus-not-distributed']);
function classOf(diagnosis) {
  if (!diagnosis) return 'unknown';
  if (ERROR_CLASSES.includes(diagnosis.cls)) return diagnosis.cls;
  const code = String(diagnosis.code || '');
  if (SIGN_CODES.has(code) || /sign|negative/.test(code)) return 'sign';
  if (code === 'arithmetic-slip') return 'arithmetic-slip';
  if (code === 'wrong-formula') return 'wrong-formula';
  if (code === 'substitution-error') return 'substitution';
  if (code === 'given-misread') return 'given-misread';
  if (!code || code === 'counterexample' || code === 'wrong-value') return 'unknown';
  return 'invalid-transformation';
}

/**
 * `-3x = 12` then `x = 4`: the unknown was isolated by one division, and the
 * division is wrong. Step Check has already shown the second line false for the
 * question; this says which calculation it was, from the two lines alone.
 */
function isolatingDivision(previousText, brokenText, variable) {
  if (!variable || !previousText) return null;
  const sides = text => {
    try {
      const ast = parse(normalize(String(text).replace(/[−–—]/g, '-').replace(/^∴\s*/, '')));
      return ast.t === 'equation' ? [ast.l, ast.r] : null;
    } catch { return null; }
  };
  const before = sides(previousText), after = sides(brokenText);
  if (!before || !after) return null;
  const at = (node, x) => { try { return evaluate(node, { [variable]: x }); } catch { return NaN; } };
  const only = node => { const names = variablesOf(node); return names.size === 1 && names.has(variable); };
  const multiple = before.find(side => only(side));
  const constant = before.find(side => variablesOf(side).size === 0);
  const stated = after.find(side => variablesOf(side).size === 0);
  const lone = after.find(side => only(side) && numsClose(at(side, 0), 0, 1e-12) && numsClose(at(side, 1), 1, 1e-12) && numsClose(at(side, 2.5), 2.5, 1e-12));
  if (!multiple || !constant || !stated || !lone) return null;
  const k = at(multiple, 1), b = at(constant, 0), got = at(stated, 0);
  if (![k, b, got].every(Number.isFinite) || !numsClose(at(multiple, 0), 0, 1e-12) || !numsClose(at(multiple, 3), 3 * k, 1e-9) || Math.abs(k) < 1e-12 || numsClose(k, 1, 1e-12)) return null;
  const right = b / k;
  if (numsClose(right, got, 1e-9)) return null;
  const sum = `${fmt(b)} ÷ ${k < 0 ? `(${fmt(k)})` : fmt(k)}`;
  const sign = numsClose(right, -got, 1e-9);
  return {
    code: sign ? 'arithmetic-sign' : 'arithmetic-slip', confidence: 'high', cls: sign ? 'sign' : 'arithmetic-slip',
    title: sign ? 'The sign was lost in the division' : 'The division is wrong',
    what: sign ? 'Sign error in the division.' : 'Arithmetic slip in the division.',
    message: `${sum} = ${fmt(right)}, not ${fmt(got)}${sign ? ' — the sign is wrong' : ''}.`,
    hint: `Recheck ${sum}.`,
    fix: 'Dividing by a negative number changes the sign of the result.'
  };
}

const IMPROVE = Object.freeze({
  'arithmetic-slip': 'Work each calculation once more before you move to the next line — a quick estimate of the size of the answer catches a slip like this.',
  sign: 'Say the sign aloud as you write each term. A sign changes only when a term crosses the equals sign, a bracket is expanded, or both sides are multiplied or divided by a negative number.',
  'wrong-formula': 'Before substituting, write what the question asks for beside the formula you choose, and check that they are the same quantity.',
  substitution: 'Write the formula first, then replace one letter at a time with its value, keeping every value in its own place.',
  'given-misread': 'Copy the given values from the question onto your first line and tick each one against the question before you start.',
  'invalid-transformation': 'Change one thing per line, and do the same thing to every term (or to both sides of an equation).',
  unknown: 'Write one step per line, with each line equal to the one before it, so that a slip can be found.'
});

const ROLE_REASON = Object.freeze({
  given: 'Matches the value given in the question.',
  formula: 'Correct formula for this question.',
  substitution: 'The values are substituted correctly.',
  value: 'True for the given values.',
  answer: 'This is the correct value.'
});

function arithmeticReason(row) {
  const link = (row?.links || []).filter(l => l.verdict === 'ok').at(-1);
  if (!link) return 'Verified.';
  if (link.how === 'equivalent') return 'Equal to the line above — the same expression written another way.';
  if (link.how === 'rounded') return `Correctly rounded (to ${fmt(link.value)}).`;
  if (link.how === 'recovered') return 'Back to the value before the slip — this does not follow from the line above, but the slip was not carried on.';
  if (link.how === 'running') return 'Each calculation is right. (Write the next calculation on a new line rather than after the = sign.)';
  return Number.isFinite(link.value) ? `Correct arithmetic — both sides come to ${fmt(link.value)}.` : 'Correct arithmetic.';
}

function confirmReason(row, fallback) {
  const doubt = (row?.links || []).find(l => l.verdict === 'confirm')?.doubt;
  if (doubt) return `Not checked — is “${doubt.read}” a ${doubt.maybe}? Please confirm this line.`;
  return fallback || 'Not checked — this line can be read more than one way. Please confirm it.';
}

/**
 * Build the review.
 *
 *   meta      the question's step metadata, or null when it has none
 *   prompt    the public question text
 *   working   the working exactly as submitted (lines joined by \n; blank lines kept)
 *   report    Step Check's report for these lines, or null
 *   method    the method-mark result ({ awarded, lines: [{ index, mark, reason, stage }] }) or null
 *   correct   the marker's verdict on the final answer
 *
 * Returns null when there is no working to review.
 */
export function buildWorkingReview(input = {}) {
  return withEvaluationBudget(50000, () => buildWithinBudget(input));
}

function buildWithinBudget({ meta = null, prompt = '', working = '', report = null, method = null, correct = false } = {}) {
  const submitted = String(working ?? '').split('\n');
  const written = [];                                  // submitted index of each non-blank line
  submitted.forEach((line, index) => { if (line.trim()) written.push(index); });
  if (!written.length) return null;
  const texts = written.map(i => submitted[i].trim());
  // Step Check reads the same non-blank lines, in the same order; if its report
  // is of some other shape it is not used at all rather than misaligned.
  const keyed = report && Array.isArray(report.lines) && report.lines.length === texts.length ? report : null;
  let audit;
  try { audit = auditWorking(texts, { vocabulary: [...vocabularyFor(meta, prompt)] }); }
  catch { audit = { lines: texts.map((text, index) => ({ index, text, links: [], verdict: 'none' })), firstBreak: -1, breaks: [] }; }
  const formula = meta?.kind === 'formula' && !!keyed;

  const rows = texts.map((text, n) => {
    const k = keyed?.lines[n] || null;
    const a = audit.lines[n] || { links: [], verdict: 'none' };
    const row = { n, text, check: 'not-checked', role: null, reason: '', diagnosis: null, cls: null };
    if (formula) {
      if (k.status === 'break') { row.check = 'mistake'; row.diagnosis = k.diagnosis; }
      else if (k.later) { row.check = 'mistake'; row.diagnosis = k.diagnosis; }
      else if (k.carried) { row.check = 'follows-through'; row.reason = 'Follows from the earlier slip — this line is right for your own value.'; }
      else if (k.confirm) { row.check = 'confirm'; row.reason = k.note; }
      else if (k.status === 'ok') { row.check = 'verified'; row.role = k.role || 'arithmetic'; row.reason = ROLE_REASON[row.role] || arithmeticReason(a); }
      else { row.reason = k.note || 'Not checked.'; if (k.unread) row.unread = true; }
      return row;
    }
    const arithmeticBreak = a.verdict === 'break' ? breakOn(a) : null;
    if (k?.status === 'break') {
      row.check = 'mistake'; row.keyed = true;
      const above = n > 0 && keyed.lines[n - 1]?.status === 'ok' ? texts[n - 1] : null;
      row.diagnosis = isolatingDivision(above, text, meta?.variable) || k.diagnosis || null;
      if (!row.diagnosis && k.note) row.reason = k.note;
    }
    else if (arithmeticBreak) {
      const said = describeBreak(arithmeticBreak);
      row.check = 'mistake';
      row.diagnosis = { code: said.cls === 'sign' ? 'arithmetic-sign' : said.cls === 'invalid-transformation' ? 'not-equal' : 'arithmetic-slip', title: said.what, message: said.correction, cls: said.cls, what: said.what, hint: said.hint, confidence: 'high' };
    } else if (a.verdict === 'confirm') { row.check = 'confirm'; row.reason = confirmReason(a); }
    else if (k?.status === 'ok') {
      row.check = 'verified'; row.role = 'question';
      row.reason = a.verdict === 'ok' ? arithmeticReason(a) : 'Holds for this question.';
    } else if (a.verdict === 'ok') {
      row.check = a.carried ? 'follows-through' : 'verified';
      row.role = 'arithmetic';
      row.reason = a.carried ? 'Follows from the earlier slip — the arithmetic here is right for your own value.' : arithmeticReason(a);
    } else if (a.verdict === 'approx') { row.reason = 'Not checked exactly — this value looks cut short rather than rounded.'; }
    else if (k?.note === 'Follows from the earlier slip.') { row.check = 'after-mistake'; row.reason = 'After the first mistake — not marked again.'; }
    else {
      row.reason = k?.unread || a.verdict === 'unread' ? (k?.note || 'Not checked — this is more working than can be checked.')
        : k?.note ? `Not checked — ${String(k.note).replace(/^Skipped — /, '').replace(/^Not checked — /, '')}`
          : 'Not checked — nothing on this line could be verified or disproved.';
      if (k?.unread || a.verdict === 'unread') row.unread = true;
    }
    return row;
  });

  // One first mistake. A later mistake found by the audit is independent of it
  // (the audit compares a line with the student's own line before it); a later
  // one found against the question may only be the first carried on, so it is
  // not marked again.
  const first = rows.findIndex(r => r.check === 'mistake');
  rows.forEach((row, n) => {
    if (row.check !== 'mistake') return;
    if (n === first) { row.check = 'first-mistake'; return; }
    if (row.keyed) { row.check = 'after-mistake'; row.reason = 'After the first mistake — not marked again.'; row.diagnosis = null; return; }
    row.check = 'later-mistake';
  });

  const vector = Array.isArray(method?.lines) && method.lines.length === texts.length ? method.lines : null;
  const describe = row => {
    const d = row.diagnosis;
    const cls = classOf(d);
    return {
      cls,
      what: String(d?.what || d?.title || 'This line is not correct.'),
      correction: String(d?.message || row.reason || ''),
      hint: String(d?.hint || 'Compare this line with the one above it, one term at a time.'),
      confidence: d?.confidence === 'medium' ? 'medium' : 'high',
      ...(d?.code ? { code: String(d.code) } : {})
    };
  };

  const lines = submitted.map((line, index) => {
    const n = written.indexOf(index);
    if (n < 0) return { index, n: null, text: '', read: 'blank', check: null };
    const row = rows[n];
    const mark = vector ? Number(vector[n]?.mark) || 0 : 0;
    const mistake = row.check === 'first-mistake' || row.check === 'later-mistake';
    const said = mistake ? describe(row) : null;
    return {
      index, n, text: row.text, read: 'submitted',
      check: row.check,
      ...(row.role ? { role: row.role } : {}),
      reason: mistake ? said.correction : row.reason,
      ...(mistake ? { cls: said.cls } : {}),
      ...(row.unread ? { unread: true } : {}),
      criterion: mark > 0 ? String(vector[n].stage || 'method') : null,
      mark,
      ...(formula && keyed.final && keyed.final.line === n ? { final: { correct: keyed.final.correct === true } } : {})
    };
  });

  const firstRow = first >= 0 ? rows[first] : null;
  const firstMistake = firstRow ? {
    index: written[first], n: first, line: first + 1,
    position: first === rows.length - 1 ? 'last' : first === 0 ? 'first' : 'middle',
    ...describe(firstRow)
  } : null;
  const laterMistakes = rows.map((row, n) => (row.check === 'later-mistake' ? { index: written[n], n, line: n + 1, ...describe(row) } : null)).filter(Boolean);

  const verifiedBefore = rows.filter((r, n) => r.check === 'verified' && (first < 0 || n < first));
  const didWell = [];
  if (verifiedBefore.some(r => r.role === 'formula')) didWell.push('You chose the right formula.');
  if (verifiedBefore.some(r => r.role === 'substitution')) didWell.push('You substituted the values correctly.');
  const arithmetic = verifiedBefore.filter(r => r.role === 'arithmetic' || r.role === 'value' || r.role === 'question').length;
  if (firstMistake && firstMistake.position === 'last' && verifiedBefore.length) didWell.push('Every line before the last one checks out.');
  else if (arithmetic) didWell.push(`${arithmetic} line${arithmetic === 1 ? '' : 's'} of your working ${arithmetic === 1 ? 'is' : 'are'} verified${firstMistake ? ' before the mistake' : ''}.`);
  if (rows.some(r => r.check === 'follows-through')) didWell.push('After the slip, your working was right for the value you had.');

  const counts = { written: rows.length, verified: 0, followsThrough: 0, notChecked: 0, confirm: 0, mistakes: 0 };
  for (const r of rows) {
    if (r.check === 'verified') counts.verified += 1;
    else if (r.check === 'follows-through') counts.followsThrough += 1;
    else if (r.check === 'confirm') counts.confirm += 1;
    else if (r.check === 'first-mistake' || r.check === 'later-mistake') counts.mistakes += 1;
    else counts.notChecked += 1;
  }
  const undecided = counts.notChecked + counts.confirm;
  // How many lines were shown true OF THIS QUESTION (not merely true in
  // themselves). None, under a wrong answer, means the working could not be
  // matched to the question at all — a page of something else, perhaps.
  const TIED = new Set(['given', 'formula', 'substitution', 'answer', 'question']);
  counts.tied = rows.filter(r => r.check === 'verified' && TIED.has(r.role)).length;
  return {
    version: WORKING_REVIEW_VERSION,
    basis: 'deterministic',
    checkedAgainst: keyed ? 'question-and-lines' : 'lines-only',
    lines,
    firstMistake,
    laterMistakes,
    didWell,
    improve: firstMistake ? IMPROVE[firstMistake.cls] || IMPROVE.unknown : null,
    counts,
    answerCorrect: correct === true,
    // true: at least one line is verified against this question. false: the
    // question's working is checked and no line matched it. null: this question
    // has no step metadata, so lines were only checked against each other.
    matchesQuestion: !keyed ? null : counts.tied > 0 || correct === true,
    // Every written line shown true and the answer right: the only case in
    // which the working may be called fully verified.
    certified: correct === true && counts.verified === counts.written,
    // Wrong, with no mistake found and lines nobody could judge: the one case
    // a second opinion on the working is worth asking for.
    unexplained: correct !== true && !firstMistake && undecided >= 1 && counts.written >= 2
  };
}
