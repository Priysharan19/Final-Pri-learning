// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what the tutor may and may not say, checked deterministically
//
// The tutor is grounded in a verified worked solution and is told never to give
// the answer away. Being told is not the guarantee. Everything a model writes
// passes through the checks in this file before a student can read it.
//
// 1. A nudge or a Socratic question must not reveal the final answer or the
//    result of the step the student is about to take — in ANY form. Both the
//    protected results and the reply are reduced to numeric values: fractions
//    (3/4, \frac{3}{4}), decimals (0.75), percentages (75%), mixed numbers
//    (1 3/4), powers and short arithmetic (2², 16/4), number words in English
//    and Hindi (four, three quarters, minus two, चार, पौना), and Devanagari
//    digits. Any value equal to a protected one is a leak, and so is a range
//    ("between 3 and 5", "3 < x < 5") that brackets it. A protected value is
//    never excused because the question also prints it.
//
// 2. A result the student has genuinely reached is theirs: it is excused only
//    when it is exactly their final line AND the deterministic checker marked
//    every line of their work correct. Appearing among guesses excuses nothing.
//
// 3. A rephrased walkthrough caption may change the words, never the maths. Its
//    only mathematics may be whole $…$ spans copied verbatim from the verified
//    step it replaces; outside those spans it may hold no digit, no operator,
//    no number word and no operation word. Anything else is replaced by the
//    deterministic caption.
//
// All of this errs towards refusal. A false alarm costs one regenerated message
// or the authored hint; a miss costs a student the exercise.
// ─────────────────────────────────────────────────────────────────────────────

const DEVANAGARI_DIGITS = /[०-९]/g;
const MATH_SPAN = /\$([^$]+)\$/g;

function asciiDigits(value) {
  return String(value ?? '').replace(DEVANAGARI_DIGITS, d => String(d.charCodeAt(0) - 0x0966));
}

/** One normal form for a piece of mathematics, for whole-expression comparison. */
export function normalizeMath(value) {
  let s = asciiDigits(value).toLowerCase();
  for (let guard = 0; guard < 6 && /\\[dt]?frac/.test(s); guard += 1) {
    s = s.replace(/\\[dt]?frac\s*(\{[^{}]*\}|[0-9a-z])\s*(\{[^{}]*\}|[0-9a-z])/g, (_, a, b) =>
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
    .replace(/²/g, '^2').replace(/³/g, '^3')
    .replace(/[{}\\]/g, '')
    .replace(/\s+/g, '');
}

export function mathSpans(value) {
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

// ── Number words ─────────────────────────────────────────────────────────────

const EN_UNITS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19
};
const EN_TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const EN_SCALES = { hundred: 100, thousand: 1000, lakh: 100000, million: 1000000 };
const EN_DENOMINATORS = {
  half: 2, halves: 2, third: 3, thirds: 3, quarter: 4, quarters: 4, fourth: 4, fourths: 4, fifth: 5, fifths: 5,
  sixth: 6, sixths: 6, seventh: 7, sevenths: 7, eighth: 8, eighths: 8, ninth: 9, ninths: 9, tenth: 10, tenths: 10
};
const EN_MINUS = new Set(['minus', 'negative']);

const HI_NUMBERS = {
  'शून्य': 0, 'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पाँच': 5, 'पांच': 5, 'छह': 6, 'छः': 6, 'सात': 7, 'आठ': 8,
  'नौ': 9, 'दस': 10, 'ग्यारह': 11, 'बारह': 12, 'तेरह': 13, 'चौदह': 14, 'पंद्रह': 15, 'पन्द्रह': 15, 'सोलह': 16,
  'सत्रह': 17, 'अठारह': 18, 'उन्नीस': 19, 'बीस': 20, 'पच्चीस': 25, 'तीस': 30, 'चालीस': 40, 'पचास': 50,
  'साठ': 60, 'सत्तर': 70, 'अस्सी': 80, 'नब्बे': 90
};
const HI_SCALES = { 'सौ': 100, 'हज़ार': 1000, 'हजार': 1000, 'लाख': 100000 };
const HI_FRACTIONS = { 'आधा': 0.5, 'आधी': 0.5, 'आधे': 0.5, 'डेढ़': 1.5, 'डेढ': 1.5, 'ढाई': 2.5, 'पौना': 0.75, 'पौन': 0.75, 'चौथाई': 0.25, 'तिहाई': 1 / 3 };
const HI_MINUS = new Set(['ऋण', 'माइनस']);
const HI_OVER = new Set(['बटा', 'बटे']);

const isEnNumberWord = w => w in EN_UNITS || w in EN_TENS || w in EN_SCALES;
const isHiNumberWord = w => w in HI_NUMBERS || w in HI_SCALES;

/**
 * Replace spelled-out numbers with digits, so every later check reads one
 * notation: "three quarters" → "0.75", "minus two" → "-2", "चार" → "4",
 * "दो बटा तीन" → "2/3", "two and a half" → "2.5".
 */
export function wordsToDigits(text) {
  const tokens = String(text ?? '').split(/(\s+|[,.;:!?()[\]{}"'।‘’“”-])/u);
  const out = [];
  let i = 0;
  const word = k => String(tokens[k] ?? '').toLowerCase();
  const nextWordIndex = k => { let j = k + 1; while (j < tokens.length && /^\s*$/.test(tokens[j])) j += 1; return j; };

  while (i < tokens.length) {
    const w = word(i);
    let sign = 1;
    let start = i;
    let j = i;
    if (EN_MINUS.has(w) || HI_MINUS.has(w)) {
      const n = nextWordIndex(i);
      const nw = word(n);
      if (isEnNumberWord(nw) || isHiNumberWord(nw) || nw in EN_DENOMINATORS || nw in HI_FRACTIONS || /^\d/.test(nw)) {
        sign = -1;
        j = n;
        if (/^\d/.test(nw)) { out.push(`-${tokens[n]}`); i = n + 1; continue; }
      }
    }
    const first = word(j);
    if (first in HI_FRACTIONS) {
      out.push(String(sign * HI_FRACTIONS[first]));
      i = j + 1;
      continue;
    }
    const english = isEnNumberWord(first) || ((first === 'a' || first === 'an' || first === 'half') && (first === 'half' || word(nextWordIndex(j)) in EN_DENOMINATORS));
    const hindi = isHiNumberWord(first);
    if (!english && !hindi) {
      out.push(tokens[i]);
      i += 1;
      continue;
    }
    // An integer part from units, tens and scales.
    let total = 0;
    let current = 0;
    let seen = false;
    let k = j;
    let last = j;
    let prev = null;          // 'unit' | 'teen' | 'tens' | 'scale'
    while (k < tokens.length) {
      const t = word(k);
      // A number word may only follow one it can combine with: "twenty four",
      // "two hundred", "one hundred and five" — never "four five".
      const fits = kind => prev === null || prev === 'scale' || (prev === 'tens' && kind === 'unit');
      const enKind = t in EN_UNITS ? (EN_UNITS[t] < 10 ? 'unit' : 'teen') : t in EN_TENS ? 'tens' : null;
      const hiKind = t in HI_NUMBERS ? (HI_NUMBERS[t] < 10 ? 'unit' : 'tens') : null;
      if (english && enKind && fits(enKind)) { current += EN_UNITS[t] ?? EN_TENS[t]; seen = true; last = k; prev = enKind; }
      else if (english && t in EN_SCALES && seen && prev !== 'scale') { current = current * EN_SCALES[t]; if (EN_SCALES[t] >= 1000) { total += current; current = 0; } last = k; prev = 'scale'; }
      else if (hindi && hiKind && fits(hiKind)) { current += HI_NUMBERS[t]; seen = true; last = k; prev = hiKind; }
      else if (hindi && t in HI_SCALES && seen && prev !== 'scale') { current = current * HI_SCALES[t]; if (HI_SCALES[t] >= 1000) { total += current; current = 0; } last = k; prev = 'scale'; }
      else if (english && t === '-' && prev === 'tens' && word(k + 1) in EN_UNITS) { last = k; }
      else if (english && t === 'and' && prev === 'scale' && isEnNumberWord(word(nextWordIndex(k)))) { last = k; }
      else if (!/^\s*$/.test(tokens[k])) break;
      k += 1;
    }
    let value = seen ? total + current : null;
    let end = last;
    // Fractions: "three quarters", "a half", "one third", "दो बटा तीन".
    const after = nextWordIndex(end);
    const aw = word(after);
    if (english && (aw in EN_DENOMINATORS || first === 'half' || ((first === 'a' || first === 'an') && word(nextWordIndex(j)) in EN_DENOMINATORS))) {
      if (first === 'half') { value = 0.5; end = j; }
      else if (first === 'a' || first === 'an') { const d = nextWordIndex(j); value = 1 / EN_DENOMINATORS[word(d)]; end = d; }
      else { value = (value || 1) / EN_DENOMINATORS[aw]; end = after; }
    } else if (english && aw === 'and') {
      // "two and a half"
      const a2 = nextWordIndex(after);
      const d2 = nextWordIndex(a2);
      if ((word(a2) === 'a' || word(a2) === 'one') && word(d2) in EN_DENOMINATORS && value != null) {
        value += 1 / EN_DENOMINATORS[word(d2)];
        end = d2;
      }
    } else if (hindi && HI_OVER.has(aw)) {
      const d = nextWordIndex(after);
      if (word(d) in HI_NUMBERS && HI_NUMBERS[word(d)] !== 0 && value != null) { value /= HI_NUMBERS[word(d)]; end = d; }
    }
    if (value == null) { out.push(tokens[i]); i += 1; continue; }
    out.push(String(sign * value));
    i = Math.max(end, start) + 1;
  }
  return out.join('');
}

// ── Numeric values in text ───────────────────────────────────────────────────

/** Text with every notation brought to plain arithmetic: a b/c, ^, *, /, √, π. */
function arithmeticText(value) {
  let s = asciiDigits(wordsToDigits(value));
  for (let guard = 0; guard < 6 && /\\[dt]?frac/.test(s); guard += 1) {
    s = s.replace(/\\[dt]?frac\s*(\{[^{}]*\}|[0-9a-z])\s*(\{[^{}]*\}|[0-9a-z])/gi, (_, a, b) =>
      `(${a.replace(/^\{|\}$/g, '')})/(${b.replace(/^\{|\}$/g, '')})`);
  }
  return s
    .replace(/\$/g, ' ')
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)')
    .replace(/\\(times|cdot)|[×·]/g, '*')
    .replace(/\\div|÷/g, '/')
    .replace(/\\pi(?![a-z])/gi, 'π')
    .replace(/\\(left|right|displaystyle|,|;|!)/g, '')
    .replace(/[−–—]/g, '-')
    .replace(/²/g, '^2').replace(/³/g, '^3')
    .replace(/\*\*/g, '^')
    .replace(/[{}\\]/g, ' ');
}

/** A tiny exact parser for + - * / ^ √ π and brackets. Returns null if it is not arithmetic. */
function evaluate(expr) {
  const src = String(expr).replace(/\s+/g, '');
  if (!src || !/^[-+*/^().0-9√π]+$/.test(src)) return null;
  let i = 0;
  const peek = () => src[i];
  function primary() {
    if (peek() === '(') { i += 1; const v = additive(); if (peek() !== ')') throw new Error('bracket'); i += 1; return v; }
    if (peek() === '√') { i += 1; const v = unary(); return v < 0 ? NaN : Math.sqrt(v); }
    if (peek() === 'π') { i += 1; return Math.PI; }
    const m = /^\d+(?:\.\d+)?|^\.\d+/.exec(src.slice(i));
    if (!m) throw new Error('number');
    i += m[0].length;
    let v = Number(m[0]);
    if (peek() === 'π' || peek() === '(' || peek() === '√') v *= primary();   // 2π, 2(3), 2√3
    return v;
  }
  function power() { const b = primary(); if (peek() === '^') { i += 1; return b ** unary(); } return b; }
  function unary() { if (peek() === '-') { i += 1; return -unary(); } if (peek() === '+') { i += 1; return unary(); } return power(); }
  function multiplicative() {
    let v = unary();
    while (peek() === '*' || peek() === '/') { const op = src[i]; i += 1; const r = unary(); v = op === '*' ? v * r : v / r; }
    return v;
  }
  function additive() {
    let v = multiplicative();
    while (peek() === '+' || peek() === '-') { const op = src[i]; i += 1; const r = multiplicative(); v = op === '+' ? v + r : v - r; }
    return v;
  }
  try {
    const v = additive();
    return i === src.length && Number.isFinite(v) ? v : null;
  } catch { return null; }
}

/** The value of a result expression ("x = 3/4", "\frac{3}{4}", "75%"), or null. */
export function valueOf(expression) {
  const text = arithmeticText(expression).trim();
  const rhs = text.split(/<=|>=|!=|=|<|>/).pop().trim();
  const percent = /^(-?\d+(?:\.\d+)?)\s*%$/.exec(rhs);
  if (percent) return Number(percent[1]) / 100;
  const mixed = /^(-?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(rhs);
  if (mixed) return (mixed[1] ? -1 : 1) * (Number(mixed[2]) + Number(mixed[3]) / Number(mixed[4]));
  return evaluate(rhs);
}

const RUN = /[-+]?\s*(?:\d|\.\d|π|√|\()[\d.\s+\-*/^()√π%]*/g;

/**
 * Every numeric value a piece of text states: each number, each fraction,
 * percentage and mixed number, each additive term and each whole arithmetic run.
 * Decimals carry the tolerance their own precision implies, so "0.33" states 1/3.
 */
export function statedValues(text) {
  const s = arithmeticText(text);
  const values = [];
  const add = (v, tol = 1e-9) => { if (Number.isFinite(v)) values.push({ v, tol }); };
  for (const m of s.matchAll(/(-?)\b(\d+)\s+(\d+)\s*\/\s*(\d+)\b/g)) {
    add((m[1] ? -1 : 1) * (Number(m[2]) + Number(m[3]) / Number(m[4])));
  }
  for (const m of s.matchAll(/(-?\d+(?:\.\d+)?)\s*%/g)) add(Number(m[1]) / 100);
  for (const m of s.matchAll(/(?<!\d|\d\.)(-?)(\d*\.(\d+)|\d+)(?!\d|\.\d)/g)) {
    const n = Number(`${m[1]}${m[2]}`);
    const decimals = m[3] ? m[3].length : 0;
    add(n, decimals >= 2 ? 0.5 * 10 ** -decimals + 1e-12 : 1e-9);
  }
  for (const m of s.matchAll(RUN)) {
    const run = m[0].replace(/%/g, ' ').trim().replace(/[-+*/^(.\s]+$/, '');
    if (!run) continue;
    add(evaluate(run));
    // Additive terms: "1 + 3/4" states 3/4 as well as 7/4.
    let depth = 0;
    let term = '';
    const terms = [];
    for (const ch of run.replace(/\s+/g, '')) {
      if (ch === '(') depth += 1;
      if (ch === ')') depth -= 1;
      if ((ch === '+' || ch === '-') && depth === 0 && term && !/[*/^]$/.test(term)) { terms.push(term); term = ch === '-' ? '-' : ''; continue; }
      term += ch;
    }
    if (term) terms.push(term);
    for (const t of terms) add(evaluate(t));
  }
  return values;
}

const NUM = String.raw`(-?\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)`;
const RANGES = [
  new RegExp(String.raw`between\s+${NUM}\s+(?:and|&)\s+${NUM}`, 'gi'),
  new RegExp(String.raw`${NUM}\s+(?:और|तथा)\s+${NUM}\s+के\s+बीच`, 'g'),
  new RegExp(String.raw`(?:more|greater|bigger|larger)\s+than\s+${NUM}\s+(?:and|but)\s+(?:less|smaller|fewer)\s+than\s+${NUM}`, 'gi'),
  new RegExp(String.raw`${NUM}\s*(?:<|<=|≤)\s*[a-z]\s*(?:<|<=|≤)\s*${NUM}`, 'gi'),
  new RegExp(String.raw`${NUM}\s*(?:>|>=|≥)\s*[a-z]\s*(?:>|>=|≥)\s*${NUM}`, 'gi')
];

/** Ranges a piece of text puts the unknown in. */
export function statedRanges(text) {
  const s = arithmeticText(text);
  const out = [];
  for (const re of RANGES) {
    for (const m of s.matchAll(re)) {
      const a = evaluate(m[1]);
      const b = evaluate(m[2]);
      if (a != null && b != null) out.push([Math.min(a, b), Math.max(a, b)]);
    }
  }
  return out;
}

const close = (a, b, tol) => Math.abs(a - b) <= Math.max(tol, 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)));

// ── What is protected ────────────────────────────────────────────────────────

function lastSpan(text) {
  const spans = mathSpans(text);
  return spans.length ? spans[spans.length - 1] : null;
}

function stringForms(expression) {
  const n = normalizeMath(expression);
  if (!n) return [];
  const parts = n.split(/<=|>=|!=|=|<|>/);
  const rhs = parts[parts.length - 1];
  return rhs && rhs !== n ? [n, rhs] : [n];
}

/**
 * The guard for one request.
 *
 *   protected — the final answer and the next step's result: never stated, in
 *               any notation, and never excused by the question printing it.
 *   other     — every other step result, as a whole expression: never written
 *               out, unless the question itself states it.
 *
 * A result is excused only when it is exactly the student's final line and the
 * deterministic checker verified every line (`verifiedLines === lines.length`).
 */
export function buildGuard(question, { studentLines = [], verifiedLines = 0 } = {}) {
  const lines = (studentLines || []).map(l => String(l ?? '').trim()).filter(Boolean);
  const finalLine = lines.length ? normalizeMath(lines[lines.length - 1]) : '';
  const allVerified = lines.length > 0 && Number(verifiedLines) >= lines.length;
  const reached = expr => allVerified && !!finalLine && normalizeMath(expr) === finalLine;

  const steps = Array.isArray(question?.steps) ? question.steps : [];
  const results = steps.map(step => lastSpan(step?.d)).map(r => r || null);
  const answerText = String(question?.answer ?? '').trim();
  const answerExprs = mathSpans(answerText).length ? mathSpans(answerText) : (answerText ? [answerText] : []);
  if (results.length && results[results.length - 1]) answerExprs.push(results[results.length - 1]);

  let reachedIndex = -1;
  results.forEach((r, j) => { if (r && reached(r)) reachedIndex = j; });
  const nextIndex = Math.min(reachedIndex + 1, Math.max(0, results.length - 1));

  const protectedExprs = [];
  const answerReached = answerExprs.some(reached);
  if (!answerReached) protectedExprs.push(...answerExprs);
  if (results[nextIndex] && !reached(results[nextIndex]) && !answerReached) protectedExprs.push(results[nextIndex]);

  const protectedStrings = new Set(protectedExprs.flatMap(stringForms).filter(s => s && !/^[a-z]$/.test(s)));
  const protectedValues = [];
  for (const e of protectedExprs) {
    const v = valueOf(e);
    if (v != null && !protectedValues.some(p => close(p, v, 1e-12))) protectedValues.push(v);
  }
  const otherStrings = new Set(results
    .filter((r, j) => r && j !== reachedIndex && !protectedExprs.includes(r))
    .map(r => normalizeMath(r))
    .filter(s => s && !/^[a-z]$/.test(s) && !protectedStrings.has(s)));
  return { protectedStrings: [...protectedStrings], protectedValues, otherStrings: [...otherStrings] };
}

/**
 * Why this message may not be shown, or an empty list when it may.
 */
export function leakedExpressions(message, guard, { prompt = '' } = {}) {
  const m = normalizeMath(message);
  if (!m) return [];
  const p = normalizeMath(prompt);
  const leaks = [];
  for (const s of guard.protectedStrings || []) {
    // Bare numbers are judged by value below; whole expressions by text here.
    if (/^-?[\d.]+$/.test(s)) continue;
    if (m.includes(s)) leaks.push(`expression:${s}`);
  }
  for (const s of guard.otherStrings || []) {
    if (m.includes(s) && !p.includes(s)) leaks.push(`step:${s}`);
  }
  if ((guard.protectedValues || []).length) {
    const stated = statedValues(message);
    const ranges = statedRanges(message);
    for (const v of guard.protectedValues) {
      if (stated.some(x => close(x.v, v, x.tol))) leaks.push(`value:${v}`);
      else if (ranges.some(([lo, hi]) => v >= lo - 1e-9 && v <= hi + 1e-9)) leaks.push(`range:${v}`);
    }
  }
  return leaks;
}

// ── Captions ─────────────────────────────────────────────────────────────────

const OPERATION_WORDS = new Set([
  'add', 'adds', 'adding', 'added', 'addition', 'plus', 'subtract', 'subtracts', 'subtracting', 'subtracted', 'subtraction',
  'minus', 'multiply', 'multiplies', 'multiplying', 'multiplied', 'multiplication', 'times', 'divide', 'divides', 'dividing',
  'divided', 'division', 'over', 'half', 'halve', 'halves', 'double', 'doubled', 'twice', 'triple', 'square', 'squared',
  'squares', 'cube', 'cubed', 'root', 'roots', 'sum', 'difference', 'product', 'quotient', 'power', 'powers', 'exponent',
  'reciprocal', 'negative', 'percent', 'percentage', 'equals', 'equal', 'increase', 'decrease',
  'जोड़', 'जोड़ें', 'जोड़ो', 'जोड़कर', 'घटा', 'घटाएँ', 'घटाएं', 'घटाओ', 'घटाकर', 'गुणा', 'भाग', 'विभाजित', 'वर्ग', 'घन',
  'मूल', 'योग', 'अंतर', 'गुणनफल', 'भागफल', 'घात', 'दुगुना', 'दोगुना', 'बराबर'
]);

function wordsOf(text) {
  return String(text ?? '').toLowerCase().split(/[^\p{L}\p{M}]+/u).filter(Boolean);
}

/**
 * May this rephrased caption replace the deterministic one?
 *
 * Its mathematics may only be whole $…$ spans copied verbatim from the caption
 * it replaces, each also a span of the verified solution. Outside those spans:
 * no digit, no operator, no number word, no operation word.
 */
export function captionWordingOk(proposed, sourceCaption, solutionSpans) {
  const text = String(proposed ?? '');
  if (!text.trim()) return false;
  const allowed = new Set(mathSpans(sourceCaption).filter(s => solutionSpans.has(s)));
  for (const span of mathSpans(text)) if (!allowed.has(span)) return false;
  if ((text.match(/\$/g) || []).length % 2) return false;
  const prose = text.replace(MATH_SPAN, ' ').replace(/(?<=\p{L})[-'’](?=\p{L})/gu, '');
  if (/[0-9०-९]/.test(prose)) return false;
  if (/[=+\-−–—×÷*/^<>≤≥√π%∫∑\\{}]/.test(prose)) return false;
  for (const w of wordsOf(prose)) {
    if (OPERATION_WORDS.has(w) || isEnNumberWord(w) || w in EN_DENOMINATORS || EN_MINUS.has(w)
      || isHiNumberWord(w) || w in HI_FRACTIONS || HI_MINUS.has(w) || HI_OVER.has(w)) return false;
  }
  return true;
}

/** Every $…$ span of the verified solution, trimmed exactly as captions carry them. */
export function solutionSpans(question) {
  const spans = new Set();
  for (const step of Array.isArray(question?.steps) ? question.steps : []) {
    for (const s of mathSpans(step?.h)) spans.add(s);
    for (const s of mathSpans(step?.d)) spans.add(s);
  }
  for (const s of mathSpans(question?.answer)) spans.add(s);
  return spans;
}
