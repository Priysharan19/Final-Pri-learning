// Pri Learning — the arithmetic check: line marks for a question with no Step Check.
//
// Owner request, 19 November 2026: "make sure every question has line marking".
// Measured that day, about one written question in seven carried a Step Check
// meta; for the rest, working came back "not verified" and no line was judged.
//
// A full checker needs the question's own structure, topic by topic. This
// module needs nothing from the question, so it applies to all of them. It
// proves one thing only: whether the numbers a line states equal ARE equal.
//
//     -20 - 6 = 14            crossed: -20 - 6 is -26
//     196 + 64 = 260          ticked
//     √(14^2 + 8^2)           not judged (it states nothing)
//     = √260                  ticked, against the line above
//
// A tick here says "the arithmetic on this line is right". It does NOT say the
// line is the right step for the question, and no copy built on it may say so:
// the report is marked `arithmetic: true` and each tick has state 'arithmetic'.
// No mark of any kind comes from it.
//
// Never crossed (a note instead):
//   · a line with a letter in it, an inequality, a unit, a percent or degree sign;
//   · a line with a decimal or an "about equal" sign, which may be a rounding;
//   · a trigonometric or logarithmic value (the angle unit and base are not known);
//   · a line that becomes true under another plausible reading of the
//     handwriting: 23 = 8 is 2^3 = 8 with the index read on the line, and
//     12 = 0.5 is 1/2 with the bar lost. The reader, not the student, may
//     have made that slip.
import { parse, normalize, evaluate, variablesOf, exprEquivalent } from './expr.js';

const LIMITS = { lines: 20, chars: 160 };
const NOTE = 'Not checked: this line has no arithmetic Pri can check on its own.';
const UNREAD = 'This line could not be read as maths, so it is not checked.';
const SOFT_NOTE = 'Not checked: this line may use a rounded value, so it is not marked.';
const MISREAD_NOTE = 'Not checked: this line may have been misread, so it is not marked.';
const FUNCTION_WORDS = /\b(?:sin|cos|tan|sec|cosec|csc|cot|ln|log|asin|acos|atan|arcsin|arccos|arctan)\b/i;

// `Ans = 72` under the working: ticked when it equals the line above, never crossed (it may answer something else).
const ANS_LABEL = /^(?:ans|answer)\.?\s*(?==)/i;
const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const shown = v => { const r = Math.round(v * 1e6) / 1e6; return String(Object.is(r, -0) ? 0 : r).replace(/-/g, '−'); };

/** The value of one side when it is plain arithmetic on numbers; null otherwise. */
function valueOf(side) {
  let ast;
  try { ast = parse(normalize(side)); } catch { return null; }
  if (!ast || ast.t === 'equation') return null;
  if ([...variablesOf(ast)].some(v => v !== 'e')) return null;   // any letter but the constants e and π: not arithmetic on numbers alone
  let v;
  try { v = evaluate(ast, {}); } catch { return null; }
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// ── Lines that are true as written, whatever the question ────────────────────
// Owner, 19 November 2026: step marking on every Year 11 and 12 question. Two
// more kinds of line can be proved with nothing but the line itself, and both
// are TICK ONLY (a line of this kind is never crossed):
//   · an identity: both sides are the same function of the same letters
//     (12x^2/2 = 6x^2). Sides that differ may be an equation to solve, so
//     that is a note;
//   · a definite integral or a bracket evaluation, worked out numerically:
//     ∫_-2^4 12x dx, [6x^2]_-2^4. Limits are small marks that are easily
//     misread, which is the other reason such a line is never crossed.
const NOT_PROVED = 'Not checked: Pri cannot tell from this line alone whether it is true.';
const LIM = '(\\{[^{}]*\\}|-?\\d+(?:\\.\\d+)?|-?(?:pi|π|e))';
const BRACKET_EVAL = new RegExp(`\\[([^\\[\\]]+)\\]_${LIM}\\^${LIM}`, 'g');
const INTEGRAL = new RegExp(`∫_${LIM}\\^${LIM}\\s*(.+?)\\s*d([a-z])(?![a-z])`, 'g');
const closeLoose = (a, b) => Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b));

/** A side as a number, or as a function of its letters; null when it cannot be read. */
export function infoOf(side) {
  let ast;
  try { ast = parse(normalize(side)); } catch { return null; }
  if (!ast || ast.t === 'equation') return null;
  const vars = [...variablesOf(ast)].filter(v => v !== 'e').sort();
  if (vars.length) return { ast, vars };
  let v;
  try { v = evaluate(ast, {}); } catch { return null; }
  return typeof v === 'number' && Number.isFinite(v) ? { value: v } : null;
}
const at = (info, v, x) => { try { const y = info.value !== undefined ? info.value : evaluate(info.ast, { [v]: x }); return typeof y === 'number' && Number.isFinite(y) ? y : null; } catch { return null; } };

/** Replace every definite integral and bracket evaluation by its value; null when one cannot be worked out. */
function workOutCalculus(text) {
  let failed = false, used = false;
  const limit = raw => { const info = infoOf(raw.replace(/^\{|\}$/g, '').replace(/π/g, 'pi')); return info && info.value !== undefined ? info.value : null; };
  const put = v => { used = true; return `(${String(Number(v.toPrecision(15)))})`; };
  let out = text.replace(INTEGRAL, (_, lo, hi, body, v) => {
    const a = limit(lo), b = limit(hi), f = infoOf(body);
    if (a === null || b === null || !f || (f.vars && (f.vars.length !== 1 || f.vars[0] !== v))) { failed = true; return _; }
    const n = 2000, h = (b - a) / n;
    let sum = 0;
    for (let k = 0; k <= n; k++) { const y = at(f, v, a + k * h); if (y === null) { failed = true; return _; } sum += y * (k === 0 || k === n ? 1 : k % 2 ? 4 : 2); }
    return put(sum * h / 3);
  });
  out = out.replace(BRACKET_EVAL, (_, body, lo, hi) => {
    const a = limit(lo), b = limit(hi), f = infoOf(body);
    if (a === null || b === null || !f || (f.vars && f.vars.length !== 1)) { failed = true; return _; }
    const v = f.vars ? f.vars[0] : 'x', top = at(f, v, b), bottom = at(f, v, a);
    if (top === null || bottom === null) { failed = true; return _; }
    return put(top - bottom);
  });
  if (failed || /∫|\]_|\]\^/.test(out)) return null;
  return { text: out, used };
}

/** The same number, or the same function of the same letters at every point tried. */
export function sameAsWritten(a, b) {
  if (a.value !== undefined && b.value !== undefined) return closeLoose(a.value, b.value);
  // Two functions must be of the same letters; a function and a number (sin²x + cos²x = 1) are compared at every point.
  const vars = a.vars || b.vars;
  if (a.ast && b.ast) {
    if (a.vars.join() !== b.vars.join()) return false;
    let equal;
    try { equal = exprEquivalent(a.ast, b.ast) === true; } catch { equal = false; }
    if (!equal) return false;
  }
  // Points of both signs. Where only one side has a value the two are not the same function (ln(x^2) and 2 ln x;
  // √(x^2) and x differ outright), so that is not an identity.
  let agreed = 0;
  for (const x of [-2.7, -1.3, -0.4, 0.6, 1.9, 3.1, 4.3]) {
    const env = Object.fromEntries(vars.map((v, k) => [v, x + 0.37 * k]));
    const val = info => { if (info.value !== undefined) return info.value; try { const y = evaluate(info.ast, env); return typeof y === 'number' && Number.isFinite(y) ? y : null; } catch { return null; } };
    const p = val(a), q = val(b);
    if ((p === null) !== (q === null)) return false;
    if (p === null) continue;
    if (!closeLoose(p, q)) return false;
    agreed++;
  }
  return agreed >= 3;
}

// ── Handwritten function notation, and the name of the step ──────────────────
// Owner, 19 November 2026 (a trig proof marked by a competitor step by step):
// students write sin θ, cos²θ, sec θ with no brackets. A named function is
// given its bracket only where the page can be read one way: the function, an
// optional whole-number power (not −1, which is the inverse), then ONE letter,
// for a trig function optionally with a number in front (sin 2θ), and nothing
// attached after it. sin x^2, sin x(x+1) and ln 2x stay unread.
const TRIG = 'sin|cos|tan|sec|cosec|csc|cot';
const FN_END = `(?!\\s*(?!${TRIG}|ln|log)[A-Za-z0-9^(θαβφ])`;   // nothing attached after it, across a space too (sin x y)
const TRIG_BARE = new RegExp(`(?<![A-Za-z])(${TRIG})\\s*(?:\\^\\s*(\\d)\\s*)?(?!\\()\\s*((?:\\d+(?:\\.\\d+)?)?\\s*(?:[A-Za-z]|[θαβφ]))${FN_END}`, 'g');
const LOG_BARE = new RegExp(`(?<![A-Za-z])(ln|log)\\s+([A-Za-z]|[θαβφ])${FN_END}`, 'g');
function bracketFunctions(text) {
  return text
    .replace(TRIG_BARE, (_, fn, power, arg) => (power ? `(${fn}(${arg.replace(/\s+/g, '')}))^${power}` : `${fn}(${arg.replace(/\s+/g, '')})`))
    .replace(LOG_BARE, (_, fn, arg) => `${fn}(${arg})`)
    // a logarithm of one plain number (log 3, ln 10), and a space before its bracket (log (3 + 2))
    .replace(/(?<![A-Za-z])(ln|log)\s+\(/g, '$1(')
    .replace(/(?<![A-Za-z])(ln|log)\s*(\d+(?:\.\d+)?)(?!\s*[A-Za-z0-9^(.!])/g, '$1($2)');
}

// The comment on a tick may name the step, but only as something the two
// sides are seen to do ("It matches …"): the tick itself rests on the two
// sides being equal, never on this description.
function nameOfStep(fromRaw, toRaw) {
  const a = String(fromRaw || '').toLowerCase().replace(/\s+/g, ''), b = String(toRaw || '').toLowerCase().replace(/\s+/g, '');
  if (!a || !b) return '';
  const v = (a.replace(/cosec/g, 'csc').match(/(?<![a-z])(?:sin|cos|tan|sec|csc|cot)(?:\^\(?\d\)?)?\(?\d*([a-zθαβφ])(?![a-z])/) || [])[1] || 'θ';
  const has = (t, fn) => new RegExp(`(?<![a-z])${fn}(?![a-z])`).test(t.replace(/cosec/g, 'csc'));
  const A = a.replace(/cosec/g, 'csc'), B = b.replace(/cosec/g, 'csc');
  if (has(A, 'sec') && !has(B, 'sec') && has(B, 'cos')) return `the reciprocal identity sec ${v} = 1/cos ${v}`;
  if (has(A, 'csc') && !has(B, 'csc') && has(B, 'sin')) return `the reciprocal identity cosec ${v} = 1/sin ${v}`;
  if (has(A, 'cot') && !has(B, 'cot') && has(B, 'tan')) return `the reciprocal identity cot ${v} = 1/tan ${v}`;
  if (has(A, 'cot') && !has(B, 'cot') && has(B, 'sin') && has(B, 'cos')) return `cot ${v} = cos ${v} / sin ${v}`;
  const sq = (t, fn) => new RegExp(`${fn}\\^\\(?2|\\(${fn}\\([^)]*\\)\\)\\^\\(?2|${fn}\\([^)]*\\)\\^\\(?2`).test(t);
  if (/1[-+]/.test(A) && ((sq(A, 'cos') && !sq(B, 'cos') && sq(B, 'sin')) || (sq(A, 'sin') && !sq(B, 'sin') && sq(B, 'cos')))) return `the Pythagorean identity sin²${v} + cos²${v} = 1`;
  if (/1\+/.test(A) && sq(A, 'tan') && sq(B, 'sec') && !sq(A, 'sec')) return `the identity 1 + tan²${v} = sec²${v}`;
  if (has(B, 'tan') && !has(A, 'tan') && has(A, 'sin') && has(A, 'cos')) return `tan ${v} = sin ${v} / cos ${v}`;
  if (has(A, 'tan') && !has(B, 'tan') && has(B, 'sin') && has(B, 'cos')) return `tan ${v} = sin ${v} / cos ${v}`;
  if (/(?:sin|cos|tan)\(?2[a-zθαβφ]/.test(A) !== /(?:sin|cos|tan)\(?2[a-zθαβφ]/.test(B)) return 'a double-angle identity';
  if (/\+/.test(A) && sq(A, 'sin') && sq(A, 'cos') && !(sq(B, 'sin') && sq(B, 'cos'))) return `the Pythagorean identity sin²${v} + cos²${v} = 1`;
  // Brackets that only hold a function's argument, or wrap a function for its power, are not brackets to expand.
  const plain = t => t.replace(/(?:sqrt|sin|cos|tan|sec|csc|cot|ln|log)\(/g, '#[').replace(/#\[[^()]*\)/g, '#').replace(/\(#\)/g, '#');
  const pa = plain(A), pb = plain(B);
  if (/\(/.test(pa) && !/\(/.test(pb) && !/\//.test(pa)) return 'expanding the brackets';
  if (!/\(/.test(pa) && /\)\(|\d\(|[a-zθ]\(|\)\^/.test(pb) && !/\//.test(pb)) return 'factorising';
  const fractions = t => (t.match(/\//g) || []).length;
  if (fractions(pa) >= 1 && /[-+]/.test(pa.replace(/\([^()]*\)/g, '')) && fractions(pb) === 1 && /^\(.*\)\/[^/]+$/.test(pb)) return 'putting the terms over a common denominator';
  return '';
}


// Hoisted so that the plain-number path can use it for lines with e or π.
const folded = side => { let t = side, last; do { last = t; t = t.replace(/\([^()]*\)/g, '#'); } while (t !== last); return t.replace(/(?:√|∛|sqrt)\s*(?:#|\d+(?:\.\d+)?|[A-Za-zθαβφπ])/gi, '#'); };   // a root is one factor too: 1/√2 x
// Structural, not a list of cases: after a division sign comes ONE denominator (a function with its bracket, a
// bracket, a root, a number, or one letter, with an optional power) and then an operator, a closing bracket or the
// end of the side. Anything else attached to it, or a denominator of another shape, or a later `*`, is not read.
const DENOMINATOR = '(?:[A-Za-z]{2,6}#|#|\\d+(?:\\.\\d+)?!?(?![\\d.!])|[A-Za-zθαβφπ](?![A-Za-z]))(?:\\^(?:#|-?\\d+(?!\\d)|[A-Za-zθαβφπ]))?';
const twoWays = t => new RegExp(`[\\/÷]\\s*${DENOMINATOR}\\s*(?![-+=)\\/÷,^\\s]|$)`).test(t) || new RegExp(`[\\/÷](?!\\s*${DENOMINATOR})`).test(t) || /[\/÷].*\*/.test(t);

/** Other ways the same ink may be read: one whole number split as a power or as a fraction. */
function otherReadings(side) {
  const out = [];
  const re = /\d+(?:\.\d+)?/g;
  let m;
  while ((m = re.exec(side)) && out.length < 24) {
    const tok = m[0];
    if (tok.includes('.') || tok.length < 2 || tok.length > 4) continue;
    const before = side[m.index - 1], after = side[m.index + tok.length];
    if (before === '.' || after === '.') continue;
    for (let k = 1; k < tok.length; k++) {
      const a = tok.slice(0, k), b = tok.slice(k);
      if (/^0/.test(b) && b.length > 1) continue;
      for (const joined of [`(${a})^(${b})`, `((${a})/(${b}))`]) out.push(side.slice(0, m.index) + joined + side.slice(m.index + tok.length));
    }
  }
  return out;
}

/** True when re-reading one or two of the numbers on one side makes every side agree. */
function trueUnderAnotherReading(sides, values) {
  // per side: the readings one step away, and (capped) two steps away
  const variants = sides.map(side => {
    const one = otherReadings(side);
    const two = one.slice(0, 12).flatMap(v => otherReadings(v)).slice(0, 60);
    return { one: one.map(valueOf).filter(v => v !== null), all: [...one, ...two].map(valueOf).filter(v => v !== null) };
  });
  const agree = all => all.every(x => close(x, all[0]));
  for (let i = 0; i < sides.length; i++) {
    for (const v of variants[i].all) if (agree(values.map((x, k) => (k === i ? v : x)))) return true;
  }
  return false;
}


// ── What the page itself defines ─────────────────────────────────────────────
// Owner, 19 November 2026 (side by side with a competitor that follows a value
// from line to line): a second pass over the lines the first pass left unmarked.
// It keeps what the student defined on the page and holds later lines to it:
//
//   k = ln(3)/8                       a definition (not judged)
//   A = 12e^(4k) = 12e^(ln(3)/4)      crossed: with k from above, 12e^(4k) is 20.78…, not 15.79…
//   u = x^2 - 4x + 1,  u' = 2x - 4    ticked: the derivative of u, checked numerically
//   e^(8k) = 3 so k = ln(3)/8         ticked: k satisfies the equation before it
//   -x^2 + 6x - 5 = 0,  (x-5)(x-1) = 0   ticked: the same equation, rearranged
//
// A cross needs a worked chain under a name (A = … = …) whose sides are plain
// numbers once the definitions are put in, with no decimal written on the line; a wrong derivative is crossed only
// when it differs clearly at every point tried. Everything else is a tick or
// stays a note. Nothing here reads the question or the answer.
const KEEP = /^(?:sqrt|arcsin|arccos|arctan|asin|acos|atan|cosec|sin|cos|tan|sec|csc|cot|ln|log|exp|abs|pi|e)$/i;
const STATEMENT_SPLIT = /\s+(?:so|and|hence|therefore|then|thus|giving|gives)\s+|\s*(?:⇒|=>|∴)\s*/i;
const POINTS = [-2.3, -1.1, 0.7, 1.6, 2.9];

export function cleanStatement(text) {
  return bracketFunctions(text.replace(/\s*\.\s*$/, '').replace(/[−–—]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/')
    .replace(/(\d|\))\s+x\s+(?=\d|\()/gi, '$1*').replace(/\[([^\[\],;_]*)\](?![_^])/g, '($1)'));
}

/** Put the page's definitions into a side. Returns { text, used } or null when a letter stays that is neither defined nor `free`. */
function putIn(side, defs, free) {
  const used = new Set();
  let bad = false;
  // a defined function applied to an argument: M(2), f'(5)
  let t = side.replace(/([A-Za-z])('?)\(([^()]*)\)/g, (m, name, prime, arg) => {
    const d = defs[name + prime];
    if (!d || !d.variable) return m;
    used.add(name + prime);
    return `(${d.expr.replace(new RegExp(`(?<![A-Za-z])${d.variable}(?![A-Za-z])`, 'g'), `(${arg})`)})`;
  });
  t = t.replace(/[A-Za-z]+'?/g, tok => {
    const prime = tok.endsWith("'"), word = prime ? tok.slice(0, -1) : tok;
    if (KEEP.test(word)) { if (prime) bad = true; return tok; }
    return [...word].map((c, k) => {
      const key = c + (prime && k === word.length - 1 ? "'" : '');
      const d = defs[key];
      if (d && !d.variable) { used.add(key); return `(${d.expr})`; }
      if (d && d.variable && free === d.variable) { used.add(key); return `(${d.expr})`; }
      if (key.endsWith("'") || (c !== free)) bad = true;
      return c;
    }).join('*');
  });
  if (bad || /'/.test(t)) return null;
  return { text: t, used: [...used] };
}
const numberOf = text => { const i = infoOf(text); return i && i.value !== undefined ? i.value : null; };
const fnOf = (text, v) => { const i = infoOf(text); if (!i) return null; if (i.value !== undefined) return () => i.value; if (i.vars.join() !== v) return null; return x => { try { const y = evaluate(i.ast, { [v]: x }); return Number.isFinite(y) ? y : null; } catch { return null; } }; };
const lettersOf = text => [...new Set((text.replace(/[A-Za-z]+/g, w => (KEEP.test(w) ? ' ' : w)).match(/[A-Za-z]/g) || []))];

function pageDefinitions(raw, out, firstBreak) {
  const defs = {};            // 'k' → { expr, line }, 'f' → { expr, variable, line }, "u'" → …
  let equation = null;        // the last equation in one unknown: { left, right, variable }
  let broke = null;
  let carry = null;           // { text, variable }: what the last line this pass ticked came to, for the `=` line below
  const limit = firstBreak === -1 ? raw.length : firstBreak;
  for (let i = 0; i < Math.min(limit, LIMITS.lines); i++) {
    if (raw[i].length > LIMITS.chars) continue;
    // A new part of the question may give a letter a new value on the paper, not on the page: what was defined is dropped.
    if (/^\(?(?:[a-h]|i{1,3}|iv|v|vi{0,3})[.)]\s|^\([a-h]\)|^(?:part|question|q)\s*\(?[a-h0-9]/i.test(raw[i])) { for (const k of Object.keys(defs)) delete defs[k]; equation = null; carry = null; }
    const src = raw[i].replace(/^\(?[a-h1-9ivx]{1,3}[.)]\s+/i, '').replace(/^[A-Za-z][A-Za-z ]{1,24}:\s*(?=\S)/, '');
    if (/[<>≤≥≠≈%°,;:]|==|!=|√\s*\[|∫|\]_/.test(src)) continue;
    const decimal = /\d\.\d|(?:^|[^\d])\.\d/.test(src);
    const ticks = [], facts = [];
    let cross = null;
    const carried = carry;
    carry = null;
    // A `=` line under a line this pass ticked: the same expression carried on (tick only).
    if (/^=/.test(src.trim()) && carried && out[i].status === 'note' && !STATEMENT_SPLIT.test(src)) {
      const sides = cleanStatement(src.trim()).split('=').map(x => x.trim()).slice(1);
      const put = sides.every(Boolean) ? sides.map(x => putIn(x, defs, carried.variable)) : [];
      const infos = put.length && put.every(Boolean) ? put.map(x => infoOf(x.text)) : [];
      const top = infoOf(carried.text);
      const grouped = sides.some(x => /[\/÷]\s*\d+(?:\.\d+)?\s*[A-Za-z(]|[\/÷]\s*[A-Za-z]\s*[A-Za-z(]|\^\s*-?\d+(?:\.\d+)?[A-Za-z]|\^\s*[A-Za-z][A-Za-z0-9(]|[\/÷].*\*/.test(x));
      if (top && infos.length && infos.every(Boolean) && !grouped && infos.every(x => sameAsWritten(x, top))) {
        out[i] = { text: out[i].text, status: 'ok', state: 'arithmetic', note: 'This is the line above, written another way.', valueChain: { rule: 'page-definitions' } };
        carry = { text: put[put.length - 1].text, variable: carried.variable };
      }
      continue;
    }
    if (out[i].status === 'ok' && /^=/.test(src.trim()) && carried) { carry = carried; continue; }
    const judgeOne = stmt => {
      const text = cleanStatement(stmt);
      const parts = text.split('=').map(x => x.trim());
      if (parts.length < 2 || parts.some(x => !x)) return;
      const head = parts[0];
      const twoWaysHere = parts.some(x => /[\/÷]/.test(x) && (/[\/÷]\s*\d+(?:\.\d+)?\s*[A-Za-z(]|[\/÷]\s*[A-Za-z]\s*[A-Za-z(]|\^\s*-?\d+(?:\.\d+)?[A-Za-z]|\^\s*[A-Za-z][A-Za-z0-9(]/.test(x)));
      if (twoWaysHere) return;
      // B. a derivative of something the page defined: u' = …, f'(x) = …
      let m = head.match(/^([A-Za-z])'(?:\(([a-z])\))?$/);
      if (m && defs[m[1]] && parts.length === 2) {
        const d = defs[m[1]];
        const variable = m[2] || d.variable || (lettersOf(d.expr).length === 1 ? lettersOf(d.expr)[0] : null);
        const base = variable ? putIn(d.expr, defs, variable) : null;
        const claim = variable ? putIn(parts[1], defs, variable) : null;
        const f = base && fnOf(base.text, variable), g = claim && fnOf(claim.text, variable);
        if (f && g) {
          let agree = 0, differ = 0, tried = 0;
          for (const x of POINTS) {
            const h = 1e-5, a = f(x + h), b = f(x - h), c = g(x);
            if (a === null || b === null || c === null) return;
            tried++;
            const slope = (a - b) / (2 * h);
            if (Math.abs(slope - c) <= 1e-5 * Math.max(1, Math.abs(slope), Math.abs(c))) agree++;
            else if (Math.abs(slope - c) > 1e-2 * Math.max(1, Math.abs(slope), Math.abs(c))) differ++;
          }
          if (tried >= 3 && agree === tried) { carry = { text: claim.text, variable }; ticks.push(`This is the derivative of ${m[1]} = ${d.shown}.`); facts.push([`${m[1]}'`, { expr: parts[1], shown: parts[1], variable: m[2] || d.variable || null, line: i }]); return; }
          // A number on the right is the gradient at a point (y' = 3√2/2), not a wrong derivative: never crossed.
          if (tried >= 3 && differ === tried && !decimal && lettersOf(claim.text).includes(variable)) { cross = `The derivative of ${m[1]} = ${d.shown} is not ${parts[1]}.`; return; }
        }
        return;
      }
      // A. a definition: k = …, f(x) = … (a chain after the name is judged below, then its last side is kept)
      m = head.match(/^([A-Za-z])(?:\(([a-z])\))?$/);
      const sides = m ? parts.slice(1) : parts;
      // D. x = value straight after an equation in x: a root of it
      if (m && !m[2] && sides.length === 1 && equation && equation.variable === m[1]) {
        const value = putIn(sides[0], defs, null), v = value && numberOf(value.text);
        const L = v !== null && v !== undefined ? fnOf(equation.left, m[1]) : null, R = L ? fnOf(equation.right, m[1]) : null;
        if (L && R) { const a = L(v), b = R(v); if (a !== null && b !== null && close(a, b)) ticks.push(`${m[1]} = ${sides[0]} satisfies the equation before it.`); }
      }
      // C. sides that become plain numbers, or one function of one letter, once the definitions are in
      if (sides.length >= 2) {
        const free = (() => { const all = [...new Set(sides.flatMap(lettersOf))].filter(c => !defs[c] || defs[c].variable); return all.length === 1 ? all[0] : null; })();
        const put = sides.map(x => putIn(x, defs, free));
        if (put.every(Boolean)) {
          const used = [...new Set(put.flatMap(x => x.used))];
          const infos = put.map(x => infoOf(x.text));
          if (infos.every(Boolean)) {
            const numbers = infos.every(x => x.value !== undefined);
            const same = infos.every(x => sameAsWritten(x, infos[0]));
            const from = used.map(k => `${k} = ${defs[k].shown}`).join(', ');
            if (same && used.length) ticks.push(numbers ? `With ${from} from above, each side comes to ${shown(infos[0].value)}.` : `With ${from} from above, the sides are the same expression.`);
            // Crossed only in a worked chain under a name (A = 12e^(4k) = 12e^(ln(3)/4)): there the two sides are stated
            // equal. Two sides on their own (x^2 = 9 after x = 2) may be a new equation to solve, so that is a note.
            // …and only against a value set on this line or the line straight above it: an older value may belong to
            // another part of the question (independent review).
            else if (!same && numbers && m && used.length && !decimal && used.every(k => !defs[k].variable && defs[k].line >= i - 1)) {
              const k = infos.findIndex(x => !close(x.value, infos[0].value));
              cross = `With ${from} from above, ${sides[0]} comes to ${shown(infos[0].value)}, but this line gives ${shown(infos[k].value)}.`;
              return;
            }
            // E. the same equation as the one before it, rearranged (the difference of the sides is a constant multiple)
            if (!m && sides.length === 2 && free) {
              const L = fnOf(put[0].text, free), R = fnOf(put[1].text, free);
              if (L && R && equation && equation.variable === free && !same) {
                const L0 = fnOf(equation.left, free), R0 = fnOf(equation.right, free);
                let ratio = null, okRatio = 0, tried = 0;
                for (const x of POINTS) { const a = L(x), b = R(x), c = L0 && L0(x), d = R0 && R0(x); if ([a, b, c, d].some(z => z === null || z === undefined)) return; const p1 = a - b, p0 = c - d; if (Math.abs(p0) < 1e-9 || Math.abs(p1) < 1e-9) return; tried++; const r = p1 / p0; if (ratio === null) ratio = r; if (Math.abs(r - ratio) <= 1e-7 * Math.max(1, Math.abs(ratio))) okRatio++; }
                if (tried >= 3 && okRatio === tried) ticks.push('The same equation as the one before it, rearranged.');
              }
              if (L && R && !same) equation = { left: put[0].text, right: put[1].text, variable: free };
            }
          }
        }
      } else if (!m && sides.length === 1) { /* nothing stated */ }
      if (m && !cross) {
        const last = sides[sides.length - 1];
        if (!new RegExp(`(?<![A-Za-z])${m[1]}(?![A-Za-z])`).test(last.replace(/[A-Za-z]+/g, w => (KEEP.test(w) ? ' ' : w)))) {
          const variable = m[2] || null;
          const settled = putIn(last, defs, variable);
          if (settled && infoOf(settled.text)) facts.push([m[1], { expr: settled.text, shown: last, variable, line: i }]);
          else if (!m[2] && infoOf(last)) facts.push([m[1], { expr: last, shown: last, variable: lettersOf(last).length === 1 ? lettersOf(last)[0] : null, line: i, open: lettersOf(last).length > 1 }]);
        }
      }
        };
    // A line is ticked only when its LAST statement is ticked and nothing after the first tick is left unjudged
    // (independent review: `x = 2 so 2x = 5`). Before the first tick a statement may be a premise: words, or an
    // equation or definition with a letter in it. A premise of plain numbers must itself be true.
    const verdicts = [];
    for (const stmt of src.split(STATEMENT_SPLIT).map(x => x && x.trim()).filter(Boolean)) {
      const before = ticks.length;
      const equationBefore = equation;
      judgeOne(stmt);
      if (cross) break;
      if (ticks.length > before) { verdicts.push('tick'); continue; }
      const sides = cleanStatement(stmt).split('=').map(x => x.trim());
      // A statement about the unknown of the equation before it that this pass could not tick (`x = 3`, `2x = 5` after
      // `2x = 4`) is not a premise: it may be false, so the line is not ticked (independent review, rounds 2 and 3).
      if (sides.length >= 2 && equationBefore && sides.some(x => lettersOf(x).includes(equationBefore.variable))) { verdicts.push('bad'); continue; }
      const plain = sides.length >= 2 && sides.every(x => x && !lettersOf(x).length);
      const values = plain ? sides.map(numberOf) : [];
      verdicts.push(plain && !(values.every(v => v !== null) && values.every(v => close(v, values[0]))) ? 'bad' : 'premise');
    }
    const firstTick = verdicts.indexOf('tick');
    const lineHolds = firstTick !== -1 && verdicts[verdicts.length - 1] === 'tick' && verdicts.slice(firstTick).every(v => v === 'tick') && !verdicts.includes('bad');
    if (cross) { broke = { index: i, message: cross }; break; }
    for (const [name, d] of facts) if (!d.open) defs[name] = d;
    // A letter set on this line in a way this pass did not record (`Let x = 4`, `x = 4 now`) no longer has its old value.
    for (const k of Object.keys(defs)) if (!facts.some(([name]) => name === k) && new RegExp(`(?<![A-Za-z])${k.replace(/[^A-Za-z]/g, '\\$&')}\\s*=`).test(src)) delete defs[k];
    if (!lineHolds) { if (ticks.length) carry = null; continue; }
    if (ticks.length && out[i].status === 'note') out[i] = { text: out[i].text, status: 'ok', state: 'arithmetic', note: ticks.join(' '), valueChain: { rule: 'page-definitions' } };
  }
  return broke;
}

export function stepCheckArithmetic(workingText) {
  const raw = String(workingText || '').split('\n').map(l => l.trim()).filter(Boolean);
  const out = [];
  let firstBreak = -1;
  let diagnosis = null;
  let labelled = false;
  let prev = null;   // { text, value } or { text, ast, vars }: the last side of the line above, when it could be read

  const note = (text, why, extra = {}) => { out.push({ text, status: 'note', note: why, unverified: true, ...extra }); };

  raw.forEach((line, i) => {
    const carried = prev;
    // A label is set aside: `Numerator:`, `LHS =` in front, `= RHS` behind, an end mark. What such a line leaves for
    // the `=` line below is tick only, like a line of letters.
    const src0 = line.replace(/^[A-Za-z][A-Za-z ]{1,24}:\s*(?=\S)/, '').replace(/^(?:LHS|RHS|L\.H\.S\.?|R\.H\.S\.?)\s*=\s*(?=\S)/i, '')
      .replace(/\s*(?:\/\/|∎|□)\s*$/, '').replace(/\s*=\s*(?:LHS|RHS|L\.H\.S\.?|R\.H\.S\.?)\s*$/i, '');
    // Owner, 19 November 2026 (a sign slip a competitor caught: `a(2) = (4 - 8 + 2)e^(-2) = 2e^(-2) > 0 so …`):
    //   · a value of a function in front of a worked chain (`a(2) = … = …`) is a label for the chain;
    //   · words after the chain are set aside; `> 0` or `< 0` after it is kept as a claim about the chain's value,
    //     and a tick needs that claim to be true as well.
    let src = src0.replace(/^\(?[a-h]\)(?:\s*\((?:i{1,3}|iv|v)\))?\s+(?=\S)|^\((?:i{1,3}|iv|v)\)\s+(?=\S)/i, ''), signClaim = null;
    { const tail = src.match(/^(.*=.*?)\s*([<>])\s*0\s*(?:(?:so|hence|therefore|thus|which)\b[^=<>]*)?$/i);
      if (tail) { src = tail[1]; signClaim = tail[2]; }
      else { const words = src.match(/^(.*=.*?[\d)])\s+(?:so|hence|therefore|thus)\s+[A-Za-z][^=<>\d]*$/i); if (words) src = words[1]; }
      src = src.replace(/^[A-Za-z]'{0,2}\(\s*-?\d+(?:\.\d+)?\s*\)\s*=\s*(?=[^=]+=)/, ''); }
    const afterLabel = labelled; labelled = src !== line;
    // Plain arithmetic only, with one more case (owner, 19 November: `… = log 3 + log 2 + log 5` then `= log(3 + 2 + 5)`):
    // a line of letters whose LAST side is a worked expression of plain numbers. The `=` line below it rewrites that
    // expression, so it is held to it. A bare number left by such a line (`t = 5` then `= 20`) stays tick only.
    const before = carried && carried.value !== undefined && (!carried.calculus || carried.compound) && !afterLabel ? carried : null;
    prev = null;
    if (i >= LIMITS.lines || line.length > LIMITS.chars) return note(line, 'Not checked: this line is too long or too far down the working to check.');
    if (firstBreak !== -1) return note(line, 'Follows from the earlier slip.');
    const text0 = src.replace(/\s*\.\s*$/, '').replace(/[−–—]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/^∴\s*/, '').replace(/^(so|hence|then|therefore|thus)\s+/i, '')
      // `Ans = 72` continues the line above; `6 x 12` between two numbers is a times sign; square brackets group.
      .replace(ANS_LABEL, '').replace(/(\d|\))\s+x\s+(?=\d|\()/gi, '$1*')
      .replace(/\[([^\[\],;_]*)\](?![_^])/g, '($1)');
    const ansLine = ANS_LABEL.test(src.replace(/^∴\s*/, '').replace(/^(so|hence|then|therefore|thus)\s+/i, ''));
    // A root with an index, √[3]{…}, is not read: its bracket is not a grouping.
    if (/(?:√|sqrt)\s*\[/i.test(src)) return note(line, NOTE);
    const calc = /∫|\]_/.test(text0) ? workOutCalculus(text0) : { text: text0, used: false };
    if (!calc) return note(line, NOT_PROVED);
    const text = bracketFunctions(calc.text);
    // Independent review, round 1. None of these is arithmetic Pri can read one way only, so none is judged:
    //   a line label or a trailing equation number (`1. 2+3 = 5`, `(2) 2+3 = 5`, `2 + 3 = 5 (2)`), which would be multiplied in;
    //   a comma (two statements on a line, or a decimal comma); a line that starts with an operator and so carries the
    //   line above forward (`- 1 = 2`); a spaced dot (`3 . 4`).
    if (/^\(?\d{1,3}[.)](?:\s|$)|^\(\d{1,3}\)|\s\(\d{1,3}\)\s*$|[,;:]|^[+*/×÷]|^-\s|\d\s+\.\s*\d|\d\s*\.\s+\d/.test(src.replace(/[−–—]/g, '-'))) return note(line, NOTE);
    // A mixed number (2 1/2) or a spaced thousand (1 000) reads as a product: two numbers side by side are not judged.
    if (/[<>≤≥≠%°]|==|!=|\d\s+\d/.test(text)) return note(line, NOTE);
    // Any letter left (a variable, π, e, a unit, a function name) and the line is not arithmetic on numbers alone.
    // nCr and nPr between two numbers, and sqrt, are arithmetic.
    // The constants e and π are numbers; a digit on each side of e (3e2) is not read.
    const CONSTANT = /(?<![A-Za-z])(?:e|pi|π)(?![A-Za-z])/g;
    if (/\de\s*[-+]?\s*\d/.test(text)) return note(line, NOTE);   // 3e2, and 2e + 3 (which reads as 2000)
    if (calc.used || /[A-Za-zπθ]/.test(text.replace(/sqrt/gi, '').replace(/(\d)\s*[CP]\s*(?=\d)/g, '$1').replace(CONSTANT, '').replace(/(?<![A-Za-z])(?:ln|log)(?=\()/g, ''))) {
      if (signClaim) return note(line, NOT_PROVED);
      // True as written, or a note: never a cross (see "Lines that are true as written").
      if (/≈|≃|~/.test(text)) return note(line, NOT_PROVED);
      const bits = text.split('=').map(s => s.trim());
      const cont = bits[0] === '' && bits.length >= 2;
      const written = cont ? bits.slice(1) : bits;
      if (written.some(s => !s)) return note(line, UNREAD, { unreadable: true });
      // A last side of plain numbers carries to the `=` line below (tick only) even when the line itself is not read.
      { const tail = valueOf(written[written.length - 1]); if (tail !== null) prev = { text: written[written.length - 1], value: tail, calculus: true, compound: !calc.used && /[-+*\/^(]/.test(written[written.length - 1].trim().replace(/^-/, '')) }; }
      // Independent review (two rounds): a letter before a bracket may be a function, and f(x+h) = f(x)+f(h) or
      // x(t+h) = xt+xh read as products is a false line that looks like an identity. A letter before a bracket is read
      // as a product only when the same letter stands inside that bracket (x(x+2), n(n+1)): a function is not applied
      // to itself in school working. A named function must be followed by its bracket (sin x^2 groups two ways).
      // A division or a power followed by a number-and-letter or two letters (1/2x, x^2x, 1/xy) groups two ways too.
      const NAMED = /(?<![A-Za-z])(?:sqrt|arcsin|arccos|arctan|asin|acos|atan|cosec|sin|cos|tan|sec|csc|cot|ln|log|exp|abs)(?![A-Za-z])/gi;
      if (/#(?!\()/.test(text.replace(NAMED, '#'))) return note(line, NOT_PROVED);
      const bare = text.replace(NAMED, '#');
      for (const m of bare.matchAll(/([A-Za-zπθ])\s*\(/g)) {
        let depth = 0, end = -1;
        for (let k = m.index + m[0].length - 1; k < bare.length; k++) { if (bare[k] === '(') depth++; else if (bare[k] === ')' && --depth === 0) { end = k; break; } }
        const inside = end < 0 ? '' : bare.slice(m.index + m[0].length, end);
        if (!new RegExp(`${m[1]}(?!\\s*\\()`).test(inside)) return note(line, NOT_PROVED);
      }
      if (/\/\s*\d+(?:\.\d+)?\s*[A-Za-z(]|\/\s*[A-Za-z]\s*[A-Za-z(]|\^\s*-?\d+(?:\.\d+)?[A-Za-z]|\^\s*[A-Za-z][A-Za-z0-9(]/.test(bare)) return note(line, NOT_PROVED);
      // A division followed by a product groups two ways (6/2(1+2), 10!/3!7!, 1/cos θ tan θ, 1/2x). Every bracket is
      // first folded to one mark, so a function's own bracket cannot hide what follows the denominator.
      if (written.some(s => twoWays(folded(s).trim()))) return note(line, NOT_PROVED);
      const infos = written.map(infoOf);
      const lastInfo = infos[infos.length - 1];
      // What a line of letters or an integral leaves for the `=` line below is tick only (`calculus`): `t = 5` then `= 20`
      // is the student carrying on something else, not a claim that 5 is 20 (found by the labelled audit).
      if (lastInfo) prev = { text: written[written.length - 1], ...lastInfo, calculus: true, compound: !calc.used && lastInfo.value !== undefined && /[-+*\/^(]/.test(written[written.length - 1].trim().replace(/^-/, '')) };
      if (infos.some(x => !x)) return note(line, NOT_PROVED);
      const all = cont && carried ? [carried, ...infos] : infos;
      if (all.length < 2 || !all.every(x => sameAsWritten(x, all[0]))) return note(line, NOT_PROVED);
      const number = all.find(x => x.value !== undefined);
      const why = calc.used ? (number ? `Worked out, each side comes to ${shown(number.value)}.` : 'Worked out at the limits, the sides agree.')
        : number ? `This is ${shown(number.value)} for every value of the letters.`
          : cont && carried ? 'This is the line above, written another way.' : 'Both sides are the same expression, written two ways.';
      // The step is named from the first two sides that differ in writing (the line above and this one, or this line's own sides).
      const texts = cont && carried ? [carried.text, ...written] : written;
      const named = !calc.used && !number ? nameOfStep(texts[0], texts[1]) : '';
      out.push({ text: line, status: 'ok', state: 'arithmetic', note: named ? `${why} It matches ${named}.` : why, valueChain: { rule: 'true-as-written' } });
      return;
    }
    const approx = /≈|≃|~/.test(text);
    const parts = text.replace(/[≈≃]/g, '=').split('=').map(s => s.trim());
    const continuation = parts[0] === '' && parts.length >= 2;
    const sides = continuation ? parts.slice(1) : parts;
    if (sides.some(s => !s)) return note(line, UNREAD, { unreadable: true });
    const values = sides.map(valueOf);
    // The last side carries to a `= …` line below, whether or not this line states anything.
    const last = values[values.length - 1];
    if (last !== null) prev = { value: last, text: sides[sides.length - 1] };
    if (values.some(v => v === null)) return note(line, NOTE);
    // After a line worked out numerically (an integral) or a line of letters, a `=` line of numbers is ticked when it
    // agrees and is otherwise a note: the value above came from limits or letters that may have been misread.
    if (continuation && carried && !before) {
      const agrees = carried.value !== undefined && values.every(v => closeLoose(v, carried.value));
      if (agrees) { prev = { ...prev, calculus: true }; out.push({ text: line, status: 'ok', state: 'arithmetic', note: `This equals the line above: ${shown(carried.value)}.`, valueChain: { rule: 'true-as-written' } }); return; }
      return note(line, NOT_PROVED);
    }
    const allSides = continuation && before ? [before.text, ...sides] : sides;
    const allValues = continuation && before ? [before.value, ...values] : values;
    if (allSides.length < 2) return note(line, continuation ? 'Not checked: the line above is not arithmetic Pri can check, so this line has nothing to be compared with.' : NOTE);

    // A division followed by a product (6/2(1+2), 10!/3!7!, 5·4·3/3·2·1) is read two ways by convention: not judged.
    if (allSides.some(s => /[\/÷]/.test(s) && /[\/÷].*(?:\*|[\d)!]\s*\(|\)\s*\d|!\s*\d)/.test(s))) return note(line, NOTE);
    if (allSides.some(x => x.match(CONSTANT) && twoWays(folded(x).trim()))) return note(line, NOTE);   // 1/2π groups two ways
    // `log` may be base 10 or base e. A line with it is ticked only when it is true in both, and crossed only when it
    // is false in both (log 3 + log 2 + log 5 = log(3 + 2 + 5) is false whichever base is meant).
    const BARE_LOG = /(?<![A-Za-z])log\(/g;
    let logFalseInBoth = false;
    if (allSides.some(x => x.match(BARE_LOG))) {
      const natural = allSides.map(x => valueOf(x.replace(BARE_LOG, 'ln(')));
      if (natural.some(v => v === null)) return note(line, NOTE);
      const true10 = allValues.every(v => close(v, allValues[0])), trueE = natural.every(v => close(v, natural[0]));
      if (true10 !== trueE) return note(line, 'Not checked: this line is true for one base of log and not the other, so it is not marked.');
      logFalseInBoth = !true10;
    }
    const soft = approx || allSides.some(s => /\d\.\d|^\.\d|[^\d]\.\d/.test(s) || FUNCTION_WORDS.test(s.replace(/(?<![A-Za-z])(?:ln|log)(?=\()/g, '')));
    // A logarithm set equal to a plain number (ln 5 = 2, log 100 = 3) may be a rounding or a slip of base: a cross needs
    // a logarithm on both of the sides that disagree.
    { const hasLog = x => /(?<![A-Za-z])(?:ln|log)\(/.test(x); const k0 = allValues.findIndex(v => !close(v, allValues[0]));
      if (k0 > 0 && allSides.some(hasLog) && !(hasLog(allSides[0]) && hasLog(allSides[k0]))) return note(line, SOFT_NOTE); }
    if (allValues.every(v => close(v, allValues[0]))) {
      if (signClaim && !(signClaim === '>' ? allValues[0] > 0 : allValues[0] < 0)) return note(line, NOTE);
      const why = continuation && before ? `This equals the line above: ${shown(allValues[0])}.` : `Both sides come to ${shown(allValues[0])}.`;
      out.push({ text: line, status: 'ok', state: 'arithmetic', note: why, valueChain: { rule: 'arithmetic' } });
      return;
    }
    if (soft) return note(line, SOFT_NOTE);
    // With e or π on the line a cross needs the constant on every side: `2π = 6` or `e^2 = 7` is a rounding, not a slip.
    { const withConstant = allSides.filter(x => x.match(CONSTANT)).length; if (withConstant && withConstant !== allSides.length) return note(line, SOFT_NOTE); }
    // e may be the student's own letter (e^2 = 4e is true when e = 4): a cross needs every e on the line to be the
    // base of a power, e^(…), which is how Euler's number is written in working. A bare or multiplied e is a note.
    if (allSides.some(x => /(?<![A-Za-z])e(?![A-Za-z])(?!\s*\^)/.test(x))) return note(line, NOTE);
    if (ansLine) return note(line, NOTE);
    // Two bare numbers and nothing else (`500 = 340`) is words lost in reading, not a sum someone got wrong.
    if (allSides.every(x => /^\s*-?\d+(?:\.\d+)?\s*$/.test(x)) && !(continuation && before)) return note(line, NOTE);
    if (trueUnderAnotherReading(allSides, allValues)) return note(line, MISREAD_NOTE);
    const k = allValues.findIndex(v => !close(v, allValues[0]));
    const message = logFalseInBoth ? `${allSides[0].trim()} does not equal ${allSides[k].trim()}, whether log means base 10 or base e.`
      : continuation && before && k >= 1 && allValues.slice(1, k).every(v => close(v, allValues[0]))
      ? `The line above comes to ${shown(allValues[0])}, but this line gives ${shown(allValues[k])}.`
      : `${allSides[0].trim()} comes to ${shown(allValues[0])}, but this line gives ${shown(allValues[k])}.`;
    diagnosis = { code: 'arithmetic-not-equal', title: 'The two sides of this line are not equal', message, fix: 'Work this line out again, one operation at a time.', confidence: 'high' };
    firstBreak = i;
    out.push({ text: line, status: 'break', note: message, diagnosis });
    prev = null;
  });

  // The second pass: what the page itself defines (see pageDefinitions).
  {
    let broke = null;
    try { broke = pageDefinitions(raw, out, firstBreak); } catch { broke = null; }
    if (broke) {
      const message = broke.message;
      diagnosis = { code: 'page-definition-not-held', title: 'This line does not agree with what you wrote above', message, fix: 'Put the value from the earlier line in again and work this line out once more.', confidence: 'high' };
      firstBreak = broke.index;
      out[broke.index] = { text: out[broke.index].text, status: 'break', note: message, diagnosis };
      for (let k = broke.index + 1; k < out.length; k++) out[k] = { text: out[k].text, status: 'note', unverified: true, note: 'Follows from the earlier slip.' };
    }
  }
  const state = l => l.state || (l.status === 'break' ? 'wrong' : l.unreadable ? 'unread' : 'unverified');
  const lines = out.map(l => ({ ...l, state: state(l) }));
  const at = st => lines.flatMap((l, k) => (l.state === st ? [k + 1] : []));
  const unverified = at('unverified'), unread = at('unread');
  const summary = {
    total: lines.length,
    checked: lines.filter(l => l.status === 'ok').length,
    given: [], verified: [], arithmetic: at('arithmetic'), conditions: [], wrong: at('wrong'), unverified, unread,
    reason: unverified.length ? 'Pri checks only the arithmetic on this question. These lines have none it can check on its own.' : null
  };
  return { lines, firstBreak, diagnosis, source: 'value-chain', arithmetic: true, summary };
}
