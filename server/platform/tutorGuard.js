// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what the tutor may and may not say, checked deterministically
//
// The tutor is grounded in a verified worked solution and is told never to give
// the answer away. Being told is not the guarantee. Everything a model writes
// passes through the two checks in this file before a student can read it:
//
//   · leakedExpressions — a nudge or a Socratic question must not contain the
//     final answer, nor the result of the step the student is about to take.
//     The expressions are taken from the verified solution itself and compared
//     against the message after both are reduced to one normal form, so
//     "$x = 4$", "x=4" and "x = ४" are the same string here.
//
//   · captionMathOk — a rephrased walkthrough caption may say things in other
//     words, never in other mathematics. Every maths token it carries (each
//     $…$ span, every number, every equation-shaped run of symbols) must
//     already occur in the verified solution or the question. A caption that
//     invents a single number is rejected and the deterministic caption is used.
//
// Both checks err towards refusal. A false alarm costs one regenerated message
// or one deterministic caption; a miss costs a student the exercise.
// ─────────────────────────────────────────────────────────────────────────────

const DEVANAGARI_DIGITS = /[०-९]/g;
const MATH_SPAN = /\$([^$]+)\$/g;

/** Devanagari digits read as the ASCII digits they are. */
function asciiDigits(value) {
  return String(value ?? '').replace(DEVANAGARI_DIGITS, d => String(d.charCodeAt(0) - 0x0966));
}

/**
 * One normal form for a piece of mathematics, wherever it came from: KaTeX in
 * the solution, Unicode in a model reply, Devanagari digits in Hindi.
 */
export function normalizeMath(value) {
  let s = asciiDigits(value).toLowerCase();
  for (let guard = 0; guard < 6 && /\\d?frac/.test(s); guard += 1) {
    s = s.replace(/\\d?frac\s*(\{[^{}]*\}|[0-9a-z])\s*(\{[^{}]*\}|[0-9a-z])/g, (_, a, b) =>
      `(${a.replace(/^\{|\}$/g, '')})/(${b.replace(/^\{|\}$/g, '')})`);
  }
  return s
    .replace(/\$/g, '')
    .replace(/\\sqrt/g, '√')
    .replace(/\\(times|cdot)|[×·]/g, '*')
    .replace(/\\div|÷/g, '/')
    .replace(/\\le(q|qslant)?(?![a-z])|≤/g, '<=')
    .replace(/\\ge(q|qslant)?(?![a-z])|≥/g, '>=')
    .replace(/\\neq?(?![a-z])|≠/g, '!=')
    .replace(/\\pi(?![a-z])/g, 'π')
    .replace(/\\(left|right|displaystyle|quad|qquad|,|;|!|\s)/g, '')
    .replace(/[−–—]/g, '-')
    .replace(/[{}\\]/g, '')
    .replace(/\s+/g, '');
}

function mathSpans(value) {
  const out = [];
  const source = String(value ?? '');
  MATH_SPAN.lastIndex = 0;
  let match;
  while ((match = MATH_SPAN.exec(source))) {
    const expr = match[1].trim();
    if (expr) out.push(expr);
  }
  return out;
}

const ATOMIC = /^-?(\d+(\.\d+)?|π)$/;
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Does `needle` occur in `hay` as a whole value rather than inside a bigger one? */
function standalone(hay, needle) {
  return new RegExp(`(?<![0-9a-z.])${escape(needle)}(?![0-9.]|[a-z])`).test(hay);
}

function resultOf(expression) {
  const n = normalizeMath(expression);
  if (!n) return [];
  const out = [n];
  const parts = n.split(/<=|>=|!=|=|<|>/);
  if (parts.length > 1) {
    const rhs = parts[parts.length - 1];
    if (rhs && rhs !== n) out.push(rhs);
  }
  return out;
}

/**
 * The expressions a nudge or a Socratic question must never contain: the final
 * answer, and the result of every step of the verified solution the student has
 * not already written down themselves — the next step's result above all.
 *
 * A result the student has already reached is theirs: naming it back to them
 * ("you have 2x = 8, now…") gives nothing away.
 */
export function forbiddenExpressions(question, { studentLines = [] } = {}) {
  const written = normalizeMath((studentLines || []).join(' ; '));
  const forbidden = new Set();
  const add = value => {
    const results = resultOf(value);
    // The whole result was written by the student: neither it nor its value is a secret.
    if (results.length && written && written.includes(results[0])) return;
    for (const item of results) if (item) forbidden.add(item);
  };

  const answer = String(question?.answer ?? '').trim();
  if (answer) {
    const spans = mathSpans(answer);
    if (spans.length) spans.forEach(add); else add(answer);
  }
  for (const step of Array.isArray(question?.steps) ? question.steps : []) {
    const spans = mathSpans(step?.d);
    if (spans.length) add(spans[spans.length - 1]);
  }
  // A single letter is a variable name, not a result: "x" is in every hint.
  return [...forbidden].filter(item => item.length > 0 && !/^[a-z]$/.test(item));
}

/** Like normalizeMath, but words stay apart: for "is this value said on its own?". */
function spaced(value) {
  return String(value ?? '').split(/\s+/).map(normalizeMath).filter(Boolean).join(' ');
}

/**
 * The forbidden expressions this message contains. Empty means it may be shown.
 *
 * A bare number the question itself prints is exempt from the stand-alone
 * check — "subtract 3 from both sides" of "2x + 3 = 11" is not a leak just
 * because some result is also 3. The full expression is never exempt unless
 * the question itself states it.
 */
export function leakedExpressions(message, forbidden, { prompt = '' } = {}) {
  const m = normalizeMath(message);
  if (!m) return [];
  const loose = spaced(message);
  const p = normalizeMath(prompt);
  const pLoose = spaced(prompt);
  const leaked = [];
  for (const f of forbidden || []) {
    if (ATOMIC.test(f)) {
      if ((standalone(loose, f) || standalone(m, f)) && !standalone(pLoose, f) && !standalone(p, f)) leaked.push(f);
    } else if (m.includes(f) && !p.includes(f)) {
      leaked.push(f);
    }
  }
  return leaked;
}

// ── Captions ─────────────────────────────────────────────────────────────────

const NUMBER = /\d+(?:\.\d+)?/g;
// An equation-shaped run of symbols outside $…$: operands joined by operators.
const EQUATION_RUN = /[a-z0-9().^√π]+(?:\s*[=+\-*/^×÷<>≤≥]\s*[a-z0-9().^√π]+)+/gi;

/** Everything the verified solution and the question say, in normal form. */
export function solutionCorpus(question) {
  const pieces = [question?.prompt, question?.answer];
  for (const step of Array.isArray(question?.steps) ? question.steps : []) pieces.push(step?.h, step?.d);
  const raw = asciiDigits(pieces.filter(Boolean).join(' \n '));
  const spans = new Set();
  for (const piece of pieces) for (const span of mathSpans(piece)) spans.add(normalizeMath(span));
  const numbers = new Set((raw.replace(/\$/g, ' ').match(NUMBER) || []).map(n => String(Number(n))));
  return { text: normalizeMath(raw), spans, numbers };
}

/**
 * May this caption be shown? Only if every piece of mathematics in it is
 * already in the verified solution or the question.
 */
export function captionMathOk(caption, corpus) {
  const source = asciiDigits(caption);
  for (const span of mathSpans(source)) {
    const n = normalizeMath(span);
    if (!corpus.spans.has(n) && !corpus.text.includes(n)) return false;
  }
  for (const n of source.match(NUMBER) || []) {
    if (!corpus.numbers.has(String(Number(n)))) return false;
  }
  const prose = source.replace(MATH_SPAN, ' ');
  for (const run of prose.match(EQUATION_RUN) || []) {
    if (!/[0-9=<>≤≥]/.test(run)) continue;            // "step-by-step" is prose, not maths
    if (!corpus.text.includes(normalizeMath(run))) return false;
  }
  return true;
}
