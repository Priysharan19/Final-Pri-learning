// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · maths inside an engine comment
//
// The line-marking engines write English sentences about a student's working
// ("Worked out, each side comes to 64/3."). The client typesets any `$…$` span
// of such a sentence, so the engines mark their maths with these helpers: the
// sentence stays prose and only the maths becomes TeX.
//
// Presentation only: nothing here decides a verdict, and a fragment that the
// plain-to-TeX converter (answerTex.js) cannot read stays exactly as the
// student wrote it, never broken TeX. Pure: no I/O.
// ─────────────────────────────────────────────────────────────────────────────
import { answerToTex, expressionTex } from './answerTex.js';

const SPAN = /^\$(.+)\$$/s;

// ── Derivative marks ─────────────────────────────────────────────────────────
// y', f'(x), u', f''(2), dy/dx, d/dx, d²y/dx²: the notation a student writes for a derivative. answerToTex reads `dy/dx`
// as a quotient of products (d·y over d·x), which is wrong, and leaves a prime as plain text. These are set here, by shape
// alone: nothing is evaluated, and an apostrophe inside an ordinary English word is never a prime.
const PRIMES = "['′]";
const SQUARE = '(?:\\^?2|²)';
const ONE_MARK = new RegExp(`^([A-Za-z])(${PRIMES}{1,3})(?:\\(\\s*(-?\\d+(?:\\.\\d+)?|[A-Za-z])\\s*\\))?$`);
const ONE_LEIBNIZ = new RegExp(`^d(${SQUARE})?([a-z])?/d([a-z])(${SQUARE})?$`);
const OF_EXPRESSION = /^d\/d([a-z])\s*\((.+)\)$/;

/** TeX for text that is exactly one derivative mark (y', f'(x), dy/dx, d/dx, d²y/dx², d/dx(…)); null otherwise. */
export function derivativeMarkTex(text) {
  const raw = String(text ?? '').trim();
  if (!raw || raw.includes('$')) return null;
  let m = ONE_MARK.exec(raw);
  if (m) return `${m[1]}${"'".repeat(m[2].length)}${m[3] ? `(${m[3]})` : ''}`;
  m = ONE_LEIBNIZ.exec(raw);
  if (m) {
    if (Boolean(m[1]) !== Boolean(m[4])) return null;   // d²y/dx is not a derivative mark
    const sq = m[1] ? '^{2}' : '';
    return `\\frac{d${sq}${m[2] || ''}}{d${m[3]}${sq}}`;
  }
  m = OF_EXPRESSION.exec(raw);
  if (m) { const inner = fragmentTex(m[2]); return inner === null ? null : `\\frac{d}{d${m[1]}}(${inner})`; }
  return null;
}

// In a sentence: one lowercase letter, then primes, then an optional (argument); or d/dx(…), dy/dx, d²y/dx². The letter must
// not belong to a word ("isn't", "Pri's", "students'"), the prime must not lead into a word ("I'm"), and it must not be
// the apostrophe that closes a quoted phrase (call it 'point a' now): see quoteClosers.
const IN_PROSE = new RegExp(
  `(?<![A-Za-z0-9'’‘"“′])([a-z])(${PRIMES}{1,3})(?:\\(\\s*(-?\\d+(?:\\.\\d+)?|[A-Za-z])\\s*\\))?(?![A-Za-z0-9'’])` +
  `|(?<![A-Za-z0-9_])d/d[a-z]\\([^()]*\\)` +
  `|(?<![A-Za-z0-9_])d${SQUARE}?[a-z]?/d[a-z]${SQUARE}?(?![A-Za-z0-9])`, 'g');
const MATH_SPAN_IN_TEXT = /(?<!\\)\$(?:\\\$|[^$])+?(?<!\\)\$/g;
/** Positions of the apostrophes that close a quoted phrase: an opening ' (no letter or digit before it) stays open until the next ' that follows a letter or digit. */
function quoteClosers(chunk) {
  const closers = new Set();
  let open = false;
  for (let i = 0; i < chunk.length; i++) {
    const c = chunk[i];
    if (/[.?!]/.test(c) && /\s/.test(chunk[i + 1] || ' ')) { open = false; continue; }
    if (c !== "'" && c !== '‘') continue;
    const before = chunk[i - 1] || '', after = chunk[i + 1] || '';
    if (!/[A-Za-z0-9]/.test(before) && /[A-Za-z0-9]/.test(after)) open = true;
    else if (open && /[A-Za-z0-9]/.test(before) && !/[A-Za-z0-9]/.test(after)) { closers.add(i); open = false; }
  }
  return closers;
}

/** The d/dx(…) marks in a chunk of prose: [from, to, tex] for each one whose brackets balance and whose argument can be set as maths. */
function ofExpressionSpans(chunk) {
  const spans = [];
  const open = /(?<![A-Za-z0-9_])d\/d[a-z]\s*\(/g;
  let m;
  while ((m = open.exec(chunk)) !== null) {
    let depth = 0, end = -1;
    for (let i = m.index + m[0].length - 1; i < chunk.length; i++) {
      if (chunk[i] === '(') depth++;
      else if (chunk[i] === ')' && --depth === 0) { end = i + 1; break; }
    }
    if (end < 0) continue;
    const tex = derivativeMarkTex(chunk.slice(m.index, end));
    if (tex !== null) { spans.push([m.index, end, tex]); open.lastIndex = end; }
  }
  return spans;
}

/**
 * An engine sentence with every derivative mark in its prose set as maths ($y'$, $\frac{dy}{dx}$). Maths already
 * between dollars is left exactly as it is. Presentation only: the words and the verdict are untouched.
 */
export function typesetDerivativeMarks(text) {
  const s = String(text ?? '');
  if (!/['′]|\/d/.test(s)) return s;
  const plainProse = chunk => {
    const closers = quoteClosers(chunk);
    return chunk.replace(IN_PROSE, (found, letter, primes, arg, at) => {
      if (primes && closers.has(at + 1)) return found;
      const tex = derivativeMarkTex(found);
      return tex === null ? found : `$${tex}$`;
    });
  };
  // d/dx(…) takes its whole argument, brackets inside it and all: d/dx(f(x)) is one span, never "$d/dx$(f(x))".
  const prose = chunk => {
    let out = '', last = 0;
    for (const [from, to, tex] of ofExpressionSpans(chunk)) { out += plainProse(chunk.slice(last, from)) + `$${tex}$`; last = to; }
    return out + plainProse(chunk.slice(last));
  };
  let out = '', last = 0;
  for (const m of s.matchAll(MATH_SPAN_IN_TEXT)) { out += prose(s.slice(last, m.index)) + m[0]; last = m.index + m[0].length; }
  return out + prose(s.slice(last));
}

/** TeX (without the dollars) for one expression the student wrote, or null when it cannot be read as one. */
export function fragmentTex(text) {
  const raw = String(text ?? '').trim().replace(/[−–]/g, '-');
  if (!raw || raw.includes('$')) return null;
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) return raw;
  const mark = derivativeMarkTex(raw);
  if (mark !== null) return mark;
  // dy/dx inside a larger expression (3dy/dx, (dy/dx)/(dx/dt)): read as a quotient it would be wrong and nothing is guessed, so it stays plain.
  if (/(?<![A-Za-z_])d(?:\^?2|²)?[a-z]?\/d[a-z]/.test(raw)) return null;
  // Arithmetic on numbers alone: answerToTex leaves such text for a list of numbers, this is one expression.
  if (/^[\d\s.+\-*/^()]+$/.test(raw)) return /\d\s+\d/.test(raw) ? null : expressionTex(raw);
  const out = answerToTex(raw);
  const m = out !== raw ? SPAN.exec(out) : null;
  return m ? m[1] : null;
}

/** TeX for a line or an equation: each side of every `=` set as maths, or null when any side cannot be. */
export function lineTex(text) {
  const raw = String(text ?? '').trim();
  if (!raw || raw.includes('$')) return null;
  // A continuation line starts with the sign: "= 2[32 - 64/3]".
  const lead = /^[=≈]\s*/.exec(raw);
  if (lead && raw.length > lead[0].length) { const rest = lineTex(raw.slice(lead[0].length)); return rest === null ? null : `${lead[0].trim() === '≈' ? '\\approx' : '='} ${rest}`; }
  const sides = raw.split(/(?<![<>!=≤≥≠])=(?!=)/).map(s => s.trim());
  if (sides.some(s => !s)) return null;
  const tex = sides.map(fragmentTex);
  return tex.every(x => x !== null) ? tex.join(' = ') : null;
}

/** Text that stays plain inside a sentence: a literal dollar is escaped and `*` (italics in the renderer) becomes ×. */
// A backslash is deliberately NOT doubled: the renderer (MathText) unescapes `\$` and nothing else, so `a\\` would be shown with
// two backslashes. `a\$b` becomes `a\\$b`, whose `$` is escaped, and is shown as `a\$b`; `a\\` is shown as `a\\`.
const plainText = s => String(s ?? '').replace(/\*/g, '×').replace(/\$/g, '\\$');

/** A student's expression or equation as a `$…$` span for a comment, or as plain text when it cannot be set. */
export function mathSpan(text) {
  const tex = lineTex(text);
  return tex === null ? plainText(String(text ?? '').trim()) : `$${tex}$`;
}

/** `name = expr` as one span: the name is a letter or a short call, the expression is the student's. */
export function assignSpan(name, expr) {
  return mathSpan(`${name} = ${expr}`);
}

/** TeX the engines build themselves (a value, a vector) as a span. */
export const texSpan = tex => `$${tex}$`;

/**
 * An engine comment as plain text, for a tooltip, a title or a spoken label: the dollars go and
 * the TeX is turned back into the notation a student writes.
 */
export function plainComment(text) {
  let s = String(text ?? '');
  if (!s.includes('$')) return s;
  s = s.replace(/(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g, (_, tex) => {
    const unit = x => (/^[\w.√π]+(?:\([^()]*\))?$/.test(x) ? x : `(${x})`);
    let t = tex.replace(/\\frac\{d\^\{2\}([a-z]?)\}\{d([a-z])\^\{2\}\}/g, 'd²$1/d$2²')   // a second derivative: d²y/dx²
      .replace(/\\[ ,;]/g, ' ').replace(/\\(?:left|right)/g, '').replace(/\\operatorname\{([a-z]+)\}/g, '$1')
      .replace(/\\sqrt\{([^{}]*)\}/g, (_, x) => (/^[\w.]+$/.test(x) ? `√${x}` : `√(${x})`))
      .replace(/\\pi\s*/g, 'π').replace(/\\times\s*/g, '×').replace(/\\cdot\s*/g, '·').replace(/\\(?!frac)([a-z]+)\s*/gi, '$1');
    for (let i = 0; i < 6; i++) t = t.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (__, a, b) => `${unit(a)}/${unit(b)}`);
    t = t.replace(/\^\{([^{}]*)\}/g, (_, e) => (/^(?:[\d.]+|[A-Za-z])$/.test(e) ? `^${e}` : `^(${e})`))
      .replace(/(^|[(,=\s])-(?=[\d√π(])/g, '$1−');   // a sign, not a subtraction
    return t.trim();
  });
  return s.replace(/\\\$/g, '$');
}

/** True when a sentence's dollars pair up (an escaped `\$` is a literal dollar, not a delimiter). */
export const dollarsBalanced = text => (String(text ?? '').replace(/\\\$/g, '').match(/\$/g) || []).length % 2 === 0;
