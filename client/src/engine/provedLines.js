// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · more true lines ticked, each one proved (feedback only)
//
// 24 November 2026. A student's CORRECT working came back with some true lines still marked "not checked". This pass ticks
// four classes of them, and nothing else. Each tick carries a proof Pri computed, and a sentence saying what was done right.
//
//   1. a SOLUTION LIST       `θ = 45°, -45°`, `x = ±3`, `x = 2 or x = -5`: every value of it, as a SET, equals the solutions of the
//                            question. Order and the ± form do not matter. Degrees are accepted only where the question works in
//                            degrees; a list that says radians, or carries π, is never read here.
//   2. a ROUNDED VALUE       `(1.06)^5 = 1.338226`: the number on the left comes to a value that, rounded or truncated to the
//                            places written, is the number written. The comment says to how many places. A value that lands on
//                            the edge of a rounding (…5 exactly) is left alone: a float cannot say which way it falls.
//   3. a LABELLED SUBSTITUTION  `P(1) = 0: 1 + a + b - 1 = 0`: the question defines P, the line substitutes a value into it, the
//                            substituted expression equals P(value) as an IDENTITY in the unknown coefficients (compared at many
//                            sample points), and the value the line says P takes there is one the question GIVES (a factor
//                            (x - c) gives P(c) = 0; a remainder r on division by (x - c) gives P(c) = r).
//   4. a RESTATED EQUATION   `cosθ = √2/2`: the line is, side for side, the equation the question tells the student to solve.
//
// Hard rules. It never crosses a line and never changes one that is not a note; nothing here reaches a mark (it runs after every
// mark is decided, as foldTrueAsWritten does). It reads only the question's PROMPT and the engine's own step meta (never the
// worked solution, the traps or the hints). A line it cannot prove stays exactly as it was: a note. Pure, deterministic.
// ─────────────────────────────────────────────────────────────────────────────
import { normalize, parse, evaluate, variablesOf } from './expr.js';
import { texToPlain } from './texToPlain.js';
import { questionFacts } from './questionFacts.js';
import { pageProofs } from './pageProofs.js';
import { pageProofs2, NEUTRAL as NEUTRAL_CLASSES } from './pageProofs2.js';

const MINUS = /[−–—]/g;
const clean = t => String(t ?? '').replace(MINUS, '-').replace(/\s+/g, ' ').trim();
const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const lead = t => clean(t).replace(/^(?:∴|so|hence|then|therefore|thus)\s*:?\s*/i, '');
const UNKNOWN_LETTER = /^[A-Za-zθαβγφ]$/;

/** Every `$…$` span of the prompt as raw TeX, and its sentence-ish context (the text before it since the last full stop). */
function promptSpans(prompt) {
  const text = String(prompt ?? '').replace(/\\\$/g, '\u0001');
  const out = [];
  let last = 0;
  for (const m of text.matchAll(/\$\$?([^$]+)\$\$?/g)) {
    const before = text.slice(last, m.index);
    last = m.index + m[0].length;
    const sentence = before.slice(Math.max(before.lastIndexOf('.'), before.lastIndexOf('?'), before.lastIndexOf('!')) + 1);
    out.push({ tex: m[1], sentence, plain: (() => { try { return texToPlain(m[1]); } catch { return null; } })() });
  }
  return out;
}
const letterInPrompt = (spans, letter) => spans.some(s => (s.plain || s.tex).includes(letter) || s.tex.includes(letter === 'θ' ? '\\theta' : letter));

// ── 1. a solution list ───────────────────────────────────────────────────────
const NUM = String.raw`(?:\d+(?:\.\d+)?)`;
const ENTRY = new RegExp(String.raw`^(±\s*)?(-)?(${NUM})\s*(°)?$`);
/** The set a solution-list line states, or null when the line is not exactly one. `unit` is 'deg' when a degree sign was written. */
export function readList(text, variable) {
  let src = lead(text);
  if (/[()]/.test(src)) return null;                       // a comment or a bracketed value: not a plain list
  const v = variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const head = new RegExp(`^${v}\\s*=\\s*`);
  if (!head.test(src)) return null;
  const parts = src.split(/\s*(?:\bor\b|\band\b|,|;)\s*/i).map(s => s.trim()).filter(Boolean);
  if (!parts.length || (parts.length < 2 && !/±/.test(src))) return null;
  const values = [];
  let degrees = 0, plain = 0;
  for (let part of parts) {
    part = part.replace(head, '');                         // `x = 3 or x = -3`: each part may repeat the letter
    const m = ENTRY.exec(part.replace(/\s+/g, ' '));
    if (!m) return null;
    const n = Number(m[3]);
    if (m[1]) { values.push(n, -n); } else values.push(m[2] ? -n : n);
    if (m[4]) degrees++; else plain++;
  }
  if (degrees && plain && degrees !== parts.length) {
    // `θ = 45, -45°`: the sign is written once. Only a list that gives the unit on its last entry or on every entry is read.
    if (!/°\s*$/.test(src)) return null;
  }
  return { values: [...new Set(values.map(x => (Object.is(x, -0) ? 0 : x)))], degrees: degrees > 0 };
}
const sameSet = (a, b) => a.length === b.length && a.every(x => b.some(y => close(x, y))) && b.every(y => a.some(x => close(x, y)));
const fmtList = (vals, deg) => { const s = vals.slice().sort((p, q) => p - q).map(x => `${x}${deg ? '°' : ''}`); return s.length === 2 ? `${s[0]} and ${s[1]}` : `${s.slice(0, -1).join(', ')} and ${s[s.length - 1]}`; };

function proveList(q, meta, text, spans) {
  if (!meta || meta.kind !== 'equation' || !Array.isArray(meta.solutions) || !meta.solutions.length) return null;
  const raw = clean(lead(text));
  const letterM = /^([A-Za-zθαβγφ])\s*=/.exec(raw);
  if (!letterM || !UNKNOWN_LETTER.test(letterM[1]) || !letterInPrompt(spans, letterM[1])) return null;
  const list = readList(text, letterM[1]);
  if (!list) return null;
  const prompt = String(q?.prompt ?? '');
  const inDegrees = /\\circ|°|\bdegrees?\b/i.test(prompt);
  if (/\bradians?\b|\\pi|π/i.test(prompt) && !inDegrees) return null;
  if (list.degrees && !inDegrees) return null;             // a degree sign on a question that is not in degrees: not read
  if (!list.degrees && inDegrees && !/\bdegrees?\b|\\circ|°/i.test(prompt)) return null;
  if (!sameSet(list.values, meta.solutions)) return null;
  const sentence = `This list is exactly right: ${letterM[1]} = ${fmtList(list.values, list.degrees)} are all of the solutions, with none missing and none extra.`;
  return { kind: 'listed', note: sentence, how: { kind: 'listed', letter: letterM[1], valuesTex: fmtList(list.values, list.degrees).replace(/ and /g, ' \\text{ and } ').replace(/°/g, '^\\circ') } };
}

// ── 2. a rounded value ──────────────────────────────────────────────────────
const DECIMAL = /^-?\d+\.(\d+)$/;
function numericSide(side) {
  const s = clean(side);
  if (!s || /[A-Za-z]/.test(s.replace(/\b(?:sin|cos|tan|ln|log|exp|sqrt|pi)\b|[πe]/g, '')) ) return null;
  try { const ast = parse(normalize(s)); if (ast.t === 'equation' || variablesOf(ast).size) return null; const v = evaluate(ast, {}); return Number.isFinite(v) ? v : null; } catch { return null; }
}
/** Is `shown` (a decimal string of p places) the value v rounded half-up or truncated to p places? Edge cases are refused. */
export function roundedTo(v, shown) {
  const m = DECIMAL.exec(shown);
  if (!m) return null;
  const p = m[1].length, scale = 10 ** p;
  const written = Number(shown.replace('.', '').replace(/^(-?)0+(?=\d)/, '$1'));
  const scaled = Math.abs(v) * scale;
  const target = Math.abs(written);
  const frac = scaled - Math.floor(scaled);
  if (Math.abs(frac - 0.5) < 1e-7 || frac < 1e-7 || frac > 1 - 1e-7) return null;   // on a boundary: a float cannot say
  if (Math.sign(v) !== Math.sign(written) && written !== 0) return null;
  const rounded = Math.round(scaled), truncated = Math.floor(scaled);
  if (target === rounded) return { places: p, how: rounded === truncated ? 'rounded or truncated' : 'rounded' };
  if (target === truncated) return { places: p, how: 'truncated' };
  return null;
}
/** The numbers a calculation on the page may use without an earlier ticked line: the question's own numbers, what a percentage gives (1 + r/100, 1 - r/100, r/100), 1 - x for a proportion, and 0, 1, 2, 100. */
export function knownNumbers(q) {
  const out = [0, 1, 2, 100];
  const prompt = q && typeof q.prompt === 'string' ? q.prompt : '';
  for (const m of prompt.replace(/\\\$/g, ' ').matchAll(/(?<![\w.])(\d+(?:\.\d+)?)\s*(\\?%|per\s?cent)?/g)) {
    const v = Number(m[1]);
    out.push(v);
    if (m[2]) out.push(v / 100, 1 + v / 100, 1 - v / 100);
    if (v > 0 && v < 1) out.push(1 - v);
  }
  return out;
}
const NUMWORD = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const numOf = w => (/^\d+$/.test(w) ? Number(w) : NUMWORD[String(w).toLowerCase()] ?? null);
/**
 * What the question's own words ask of a decimal answer: { dp } or { sf } (a stated precision), { exact: true } (an exact value is asked for), or
 * {} (nothing stated). Read from the prompt's words only, never from the answer or the solution.
 */
export function precisionOf(q) {
  const prompt = q && typeof q.prompt === 'string' ? q.prompt : '';
  const words = prompt.replace(/\\\$/g, '\u0001').replace(/\$\s*(\d+)\s*\$/g, ' $1 ').replace(/\$\$?[^$]*\$\$?/g, ' § ').replace(/\u0001/g, '$');
  const tex = prompt;
  const N = '(\\d+|one|two|three|four|five|six)';
  let m;
  if ((m = new RegExp(`\\b${N}\\s*(?:decimal\\s+(?:place|point)s?|d\\.\\s?p(?![A-Za-z])|dp(?![A-Za-z]))`, 'i').exec(words))) { const n = numOf(m[1]); if (n !== null) return { dp: n }; }
  if ((m = new RegExp(`\\b${N}\\s*(?:significant\\s+(?:figure|digit)s?|s\\.\\s?f(?![A-Za-z])|sf(?![A-Za-z]))`, 'i').exec(words))) { const n = numOf(m[1]); if (n !== null) return { sf: n }; }
  if (/\bnearest (?:cent|hundredth)s?\b/i.test(words)) return { dp: 2 };
  if (/\bnearest thousandths?\b/i.test(words)) return { dp: 3 };
  if (/\bnearest tenths?\b/i.test(words)) return { dp: 1 };
  if (/\bnearest (?:whole number|integer|dollar|degree|minute|second|metre|meter|centimetre|centimeter|kilometre|kilometer|unit|year|month|day|hour|person|student)s?\b/i.test(words)) return { dp: 0 };
  if (/\bexact(?:ly)?\b|\bsurds?\b|\bfractions?\b|\bsimplest form\b|\bin terms of\b|\bleave (?:your )?answer\b/i.test(words) || /\bin terms of\b/i.test(tex)) return { exact: true };
  if (/\\\$|\bdollars?\b|\bcents?\b/i.test(prompt)) return { dp: 2, money: true };
  return {};
}
const sigFigs = shown => { const d = shown.replace(/^-/, '').replace('.', '').replace(/^0+/, ''); return d.length; };
/** Does v have a terminating decimal expansion that a float can show (so an equals sign with a different decimal is a false equality)? */
const terminating = v => { for (let k = 0; k <= 8; k++) { const x = Math.abs(v) * 10 ** k; if (Math.abs(x - Math.round(x)) < 1e-7) return true; } return false; };
function proveRounded(q, text, previous, known) {
  const approx = /[≈≃]/.test(text);
  let src = lead(text).replace(/[≈≃]/g, '=');
  const cont = /^=/.test(src);
  const sides = src.split('=').map(s => s.trim());
  if (cont) sides.shift();
  if (sides.length < (cont ? 1 : 2) || sides.some(s => !s)) return null;
  const shown = sides[sides.length - 1];
  if (!DECIMAL.test(shown)) return null;
  let before = sides.slice(0, -1);
  if (cont) {
    const prevLast = previous ? lead(previous).replace(/[≈≃]/g, '=').split('=').map(s => s.trim()).filter(Boolean).pop() : null;
    if (!prevLast) return null;
    before = [prevLast, ...before];
  }
  const values = before.map(numericSide);
  if (!values.length || values.some(v => v === null) || !values.every(v => close(v, values[0]))) return null;
  // every number of the calculation must be one the question gives or an earlier ticked line reached: otherwise a slipped operand hides behind the rounding
  const nums = [...clean(before[0]).matchAll(/\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
  if (!nums.length || !Array.isArray(known) || nums.some(x => !known.some(k => close(k, x)))) return null;
  const hit = roundedTo(values[0], shown);
  // fail closed: only a correct ROUNDING, never a truncation that differs from it, and only at the precision the question asks
  if (!hit || hit.how === 'truncated') return null;
  const want = precisionOf(q);
  if (want.exact) return null;                                   // an exact value is asked for: no decimal is the answer
  if (!approx && terminating(values[0])) return null;            // a finite decimal must be written exactly with an equals sign
  const sf = sigFigs(shown);
  if (want.dp !== undefined) { if (hit.places < want.dp) return null; }
  else if (want.sf !== undefined) { if (sf < want.sf) return null; }
  else if (sf < 3) return null;                                  // nothing stated: at least 3 significant figures
  const exactSide = before[before.length - 1];
  const places = `${hit.places} decimal place${hit.places === 1 ? '' : 's'}`;
  return { kind: 'rounded', note: `Correct to ${places}: the value on the left comes to ${Number(values[0].toPrecision(10))}, and ${shown} is that ${hit.how === 'truncated' ? 'cut off' : 'rounded'} to ${places}.`, how: { kind: 'rounded', places: hit.places, shown, exact: exactSide } };
}

// ── 3. a labelled substitution ─────────────────────────────────────────────
const SAMPLES = [[0.7, 1.3, -0.6], [2.1, -1.7, 0.35], [3.4, -2.3, 1.9], [-0.9, 0.15, 2.8], [1.1, -1.35, 0.55], [2.6, 0.45, -3.1], [-1.8, 3.3, 0.25], [0.95, -2.7, 1.45]];
const paramEnv = (letters, k) => { const env = {}; letters.forEach((l, i) => { env[l] = SAMPLES[k % SAMPLES.length][i % 3] + Math.floor(k / SAMPLES.length) * 0.37 + i * 0.011; }); return env; };
function astOf(s) { try { const a = parse(normalize(clean(s))); return a; } catch { return null; } }
/** What the prompt GIVES about P at a point: a factor (x - c) means P(c) = 0, a remainder r on division by (x - c) means P(c) = r. */
function givenValues(spans, name, variable) {
  const out = new Map();
  const num = x => { try { return numericSide(x); } catch { return null; } };
  const linear = lin => {
    const m = new RegExp(`^\\(?\\s*${variable}\\s*([+-])\\s*(\\d+(?:\\.\\d+)?)\\s*\\)?$`).exec(clean(lin));
    if (m) return m[1] === '+' ? -Number(m[2]) : Number(m[2]);
    return new RegExp(`^\\(?\\s*${variable}\\s*\\)?$`).test(clean(lin)) ? 0 : null;
  };
  const isP = x => new RegExp(`^${name}\\(${variable}\\)$`).test(clean(x));
  for (const [i, s] of spans.entries()) {
    const plain = s.plain; if (!plain) continue;
    const next = spans[i + 1];
    // `$(x - 1)$ is a factor of $P(x)$`
    if (next && next.plain && isP(next.plain) && /\bis a factor of\s*$/i.test(next.sentence) && linear(plain) !== null) out.set(linear(plain), 0);
    // `the remainder when $P(x)$ is divided by $(x + 3)$ is $20$`
    const r = spans[i + 2];
    if (isP(plain) && next && next.plain && r && r.plain && /\bremainder when\s*$/i.test(s.sentence) && /\bis divided by\s*$/i.test(next.sentence) && /\bis\s*$/i.test(r.sentence)) {
      const c = linear(next.plain), v = num(r.plain);
      if (c !== null && v !== null) out.set(c, v);
    }
  }
  return out;
}
function proveSubstitution(q, text, spans) {
  const facts = (() => { try { return questionFacts(q); } catch { return null; } })();
  if (!facts) return null;
  const src = lead(text);
  const m = /^([A-Za-z])\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)\s*=\s*(-?\d+(?:\.\d+)?)\s*:\s*(.+)$/.exec(src);
  if (!m) return null;
  const [, name, argText, valueText, rest] = m;
  const def = facts.defs.find(d => d.name === name && d.variable);
  if (!def) return null;
  const arg = Number(argText), value = Number(valueText);
  const given = givenValues(spans, name, def.variable);
  if (!given.has(arg) || !close(given.get(arg), value)) return null;      // the question must give the value the line says
  const eq = rest.split('=').map(s => s.trim());
  if (eq.length !== 2 || !eq[0] || !eq[1]) return null;
  const defAst = astOf(def.expr), subAst = astOf(eq[0]), rhs = numericSide(eq[1]);
  if (!defAst || !subAst || defAst.t === 'equation' || subAst.t === 'equation' || rhs === null || !close(rhs, value)) return null;
  const letters = [...new Set([...variablesOf(defAst), ...variablesOf(subAst)])].filter(l => l !== def.variable);
  if (!letters.length || letters.length > 3) return null;
  if (variablesOf(subAst).has(def.variable)) return null;                  // a substitution leaves no x behind
  let seen = 0;
  for (let k = 0; k < 14; k++) {
    const env = paramEnv(letters, k);
    let want, got;
    try { want = evaluate(defAst, { ...env, [def.variable]: arg }); got = evaluate(subAst, env); } catch { continue; }
    if (!Number.isFinite(want) || !Number.isFinite(got)) continue;
    if (!close(want, got)) return null;
    seen++;
  }
  if (seen < 8) return null;
  const why = value === 0 ? `(${def.variable} ${arg < 0 ? '+' : '-'} ${Math.abs(arg)}) is a factor` : `the remainder on division by (${def.variable} ${arg < 0 ? '+' : '-'} ${Math.abs(arg)}) is ${valueText}`;
  return { kind: 'substituted', note: `Correct: ${name}(${argText}) = ${valueText} because ${why}, and putting ${def.variable} = ${argText} into ${name}(${def.variable}) gives exactly ${clean(eq[0])}.`, how: { kind: 'substituted-at', name, argText, valueText, exprTex: clean(eq[0]) } };
}

// ── 4. a restated equation ────────────────────────────────────────────────
const INSTRUCTION = /\b(?:solve|find|evaluate|simplify|expand|factori[sz]e|differentiate|integrate|determine|calculate)\b[^.?!]*$/i;
const CLAIMS = /\b(?:show|prove|verify|test|check|whether|disprove|explain|claim|claims|student|is it true|justify|true or false|identity|error|mistake|correct|which)\b/i;
function proveRestated(text, spans, state) {
  const line = clean(lead(text)).replace(/[()]/g, m => m);
  if ((line.match(/=/g) || []).length !== 1) return null;
  const lineAst = astOf(line);
  if (!lineAst || lineAst.t !== 'equation') return null;
  for (const s of spans) {
    if (!s.plain || !INSTRUCTION.test(s.sentence) || CLAIMS.test(s.sentence)) continue;
    if ((s.plain.match(/=/g) || []).length !== 1) continue;
    const spanAst = astOf(s.plain);
    if (!spanAst || spanAst.t !== 'equation') continue;
    const letters = [...new Set([...variablesOf(lineAst), ...variablesOf(spanAst)])];
    if (!letters.length || [...variablesOf(lineAst)].sort().join() !== [...variablesOf(spanAst)].sort().join()) continue;
    let seen = 0, ok = true;
    for (let k = 0; k < 12 && ok; k++) {
      const env = paramEnv(letters, k);
      try {
        const a = [evaluate(lineAst.l, env), evaluate(lineAst.r, env)], b = [evaluate(spanAst.l, env), evaluate(spanAst.r, env)];
        if (a.some(x => !Number.isFinite(x)) || b.some(x => !Number.isFinite(x))) continue;
        if (!close(a[0], b[0]) || !close(a[1], b[1])) ok = false; else seen++;
      } catch { /* a sample the line is not defined at */ }
    }
    if (ok && seen >= 8) {
      state.restated = true;
      const same = x => String(x).replace(/\s+/g, '').replace(/[{}]/g, '');
      const copy = same(line) === same(clean(s.plain));
      return { kind: 'restated', note: copy ? 'Correct. This copies the equation the question asks you to solve, side for side.' : 'Correct. This is the question\'s equation written another way: both sides have the same values as the question\'s for every x.', how: null };
    }
  }
  return null;
}


// ── 5. a true identity ───────────────────────────────────────────────────────
// `cos(A - B) = cos A cos B + sin A sin B`, `x^2 - 6x - 3 = (x - 3)^2 - 12`: both sides agree at every one of many sample values of
// every letter. A line that is only true at some values (an equation to solve) never passes, and a line whose two sides read the same
// (`x = x`) says nothing and is not ticked.
const IDENT_SAMPLES = [[0.7, 1.3, -0.6, 2.1], [2.1, -1.7, 0.35, 0.9], [3.4, -2.3, 1.9, -0.45], [-0.9, 0.15, 2.8, 1.65], [1.1, -1.35, 0.55, 2.35], [2.6, 0.45, -3.1, -1.2], [-1.8, 3.3, 0.25, 0.8], [0.95, -2.7, 1.45, 3.05], [0.31, 1.77, -2.05, 1.15], [-0.42, 0.88, 2.2, -2.9], [1.5, -0.25, 0.65, 2.75], [2.9, 1.05, -1.1, 0.2]];
function proveIdentity(text) {
  const line = clean(lead(text));
  if ((line.match(/=/g) || []).length !== 1 || /[<>≤≥≠≈,;:]/.test(line)) return null;
  // `((d)/(dx))(…)` is a derivative, not d divided by d·x: such a line is judged by the derivative class only
  if (/\(d[A-Za-z^0-9*]*\)\s*\/\s*\(d/.test(line) || /\bd\s*\/\s*d[a-z]/.test(line)) return null;
  const ast = astOf(line);
  if (!ast || ast.t !== 'equation') return null;
  const letters = [...variablesOf(ast)].sort();
  if (!letters.length || letters.length > 4) return null;
  const sides = line.split('=').map(x => x.replace(/\s+/g, ''));
  if (sides[0] === sides[1]) return null;
  // `f(0)`, `P(-3)`, `g(1)`: a letter written straight before a bracket is a function value or a product, and Pri will not guess which
  if (/(?<![A-Za-z])[A-Za-z]\(/.test(line.replace(/\b(?:sin|cos|tan|sec|csc|cot|ln|log|exp|sqrt)\(/g, ''))) return null;
  let seen = 0, varies = false, last = null;
  for (const row of IDENT_SAMPLES) {
    const env = {}; letters.forEach((l, i) => { env[l] = row[i]; });
    let a, b;
    try { a = evaluate(ast.l, env); b = evaluate(ast.r, env); } catch { continue; }
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (!close(a, b)) return null;
    if (last !== null && !close(a, last)) varies = true;
    last = a;
    seen++;
  }
  if (seen < 9 || !varies) return null;
  const names = letters.length === 1 ? letters[0] : `${letters.slice(0, -1).join(', ')} and ${letters[letters.length - 1]}`;
  return { kind: 'identity', note: `Correct: this is a true identity. Both sides come to the same value at every value of ${names} tried, so the line holds whatever ${letters.length === 1 ? 'it stands' : 'they stand'} for.`, how: { kind: 'identity', names } };
}

// ── 6. a derivative statement ─────────────────────────────────────────────────
// `d/du sin u = cos u`, `d/dx (a x^n) = a n x^(n-1)`: the derivative of the stated expression, taken by a five-point difference at
// many values of the variable (and of any other letter, which is held fixed), equals the right-hand side at every one.
const DERIV = /^\(\(d\)\/\(d([A-Za-z])\)\)\s*\*?\s*(.+?)\s*=\s*([^=]+)$/;
/** The operand of d/dx is one unit: with a `+` or `-` outside every bracket (`(ax^n) + 1`) the operator reaches only part of it, and the line is not read. */
function oneUnit(operand) {
  let depth = 0;
  const t = clean(operand).replace(/^-/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if ('([{'.includes(c)) depth++; else if (')]}'.includes(c)) depth--;
    else if (depth === 0 && (c === '+' || c === '-') && !(i > 0 && /[\^(]/.test(t[i - 1]))) return false;
  }
  return depth === 0;
}
function proveDerivative(text) {
  const m = DERIV.exec(clean(lead(text)));
  if (!m) return null;
  const [, v, exprText, rhsText] = m;
  if (!oneUnit(exprText)) return null;
  const f = astOf(exprText), g = astOf(rhsText);
  if (!f || !g || f.t === 'equation' || g.t === 'equation') return null;
  const vars = new Set([...variablesOf(f), ...variablesOf(g)]);
  if (!variablesOf(f).has(v)) return null;
  const params = [...vars].filter(l => l !== v);
  if (params.length > 2) return null;
  const at = (ast, env) => evaluate(ast, env);
  let seen = 0;
  const h = 1e-3;
  for (let k = 0; k < IDENT_SAMPLES.length; k++) {
    const row = IDENT_SAMPLES[k];
    const x0 = Math.abs(row[0]) * 0.45 + 0.2;                                  // 0.2 to about 1.8, away from the usual trouble spots
    const env = {}; params.forEach((l, i) => { env[l] = Math.abs(row[i + 1]) * 0.5 + 0.6; });
    try {
      const F = d => at(f, { ...env, [v]: x0 + d });
      const num = (-F(2 * h) + 8 * F(h) - 8 * F(-h) + F(-2 * h)) / (12 * h);
      const want = at(g, { ...env, [v]: x0 });
      if (!Number.isFinite(num) || !Number.isFinite(want)) continue;
      if (Math.abs(num - want) > 1e-6 * Math.max(1, Math.abs(want))) return null;
      seen++;
    } catch { /* a value the expression is not defined at */ }
  }
  if (seen < 8) return null;
  return { kind: 'derivative', note: `Correct derivative: the derivative of ${clean(exprText)} with respect to ${v} is ${clean(rhsText)}, and it checks out at every value tried.`, how: { kind: 'derivative-rule', v, exprText: clean(exprText), rhsText: clean(rhsText) } };
}

// the chain-rule form: `d/dx cos(u) = -sin(u) * u'`, where u stands for any function of x. Three different test functions are put in for u,
// with their own exact derivatives for u', and the line has to hold for every one of them.
const TEST_FUNCTIONS = [
  { u: x => x * x + 0.5 * x + 0.3, d: x => 2 * x + 0.5 },
  { u: x => 1.5 * x + 0.7, d: () => 1.5 },
  { u: x => 0.4 * x ** 3 - x + 1.2, d: x => 1.2 * x * x - 1 },
  { u: x => 0.5 * x * x - 0.8 * x + 0.4, d: x => x - 0.8 }
];
function proveChainRule(text) {
  const src = clean(lead(text));
  const m = DERIV.exec(src);
  if (!m) return null;
  const [, v, exprText, rhsText] = m;
  if (!oneUnit(exprText)) return null;
  const primed = /\b([A-Za-z])'/.exec(rhsText);
  if (!primed || /'/.test(exprText)) return null;
  const inner = primed[1];
  if (inner === v) return null;
  const spare = 'pqrstzK'.split('').find(c => !src.includes(c) && c !== v && c !== inner);
  if (!spare) return null;
  const rhsPlain = rhsText.replace(new RegExp(`${inner}'`, 'g'), spare);
  const f = astOf(exprText), g = astOf(rhsPlain);
  if (!f || !g || f.t === 'equation' || g.t === 'equation') return null;
  const names = new Set([...variablesOf(f), ...variablesOf(g)]);
  if (!names.has(inner) || !variablesOf(f).has(inner) || variablesOf(f).has(v) || [...names].some(l => ![v, inner, spare].includes(l))) return null;
  let seen = 0;
  const h = 1e-3;
  for (const t of TEST_FUNCTIONS) {
    for (const x0 of [0.35, 0.8, 1.25]) {
      try {
        const F = d => evaluate(f, { [inner]: t.u(x0 + d) });
        const num = (-F(2 * h) + 8 * F(h) - 8 * F(-h) + F(-2 * h)) / (12 * h);
        const want = evaluate(g, { [v]: x0, [inner]: t.u(x0), [spare]: t.d(x0) });
        if (!Number.isFinite(num) || !Number.isFinite(want)) continue;
        if (Math.abs(num - want) > 1e-6 * Math.max(1, Math.abs(want))) return null;
        seen++;
      } catch { /* a value the expression is not defined at */ }
    }
  }
  if (seen < 8) return null;
  return { kind: 'derivative', note: `Correct chain rule: the derivative of ${clean(exprText)} with respect to ${v} is ${clean(rhsText)}, and it holds whatever function of ${v} ${inner} is (checked for several).`, how: { kind: 'derivative-rule', v, exprText: clean(exprText), rhsText: clean(rhsText) } };
}

// ── the pass ─────────────────────────────────────────────────────────────────
const unjudged = l => l && l.status === 'note' && !l.unread && !l.unreadable && (l.state === undefined || l.state === 'unverified') && l.note !== 'Follows from the earlier slip.';

/** A note the page proofs (pageProofs.js) may turn into a tick or a heading: unjudged, unread, or a stated condition; never a candidate root or a slip follow-on. */
export const openNote = l => !!l && l.status === 'note' && !l.candidate && !l.slipFollow && l.note !== 'Follows from the earlier slip.' && l.state !== 'wrong' && !l.context;

/**
 * @param q       the question (only `prompt` is read)
 * @param meta    the question's step meta (markerOps.stepMetaFor)
 * @param report  a line report whose lines are the page's lines, in order
 * @returns the same report with each provable note line ticked, or `report` itself when none is
 */
export function provedLines(q, meta, report) {
  if (!report || !Array.isArray(report.lines)) return report;
  const brk = report.lines.findIndex(l => l?.status === 'break');
  const limit = brk >= 0 ? brk : report.lines.length;
  const spans = promptSpans(q?.prompt);
  let n = 0;
  // the numbers a free-standing calculation may use: the question's own (and what they give as a rate), plain constants of the method, and the sides
  // of EARLIER lines that are themselves ticked (so an operand that slipped is never hidden by a rounded result)
  const known = knownNumbers(q);
  const learn = text => { for (const side of lead(text).replace(/[≈≃]/g, '=').split('=')) { const v = numericSide(side); if (v !== null) known.push(v); } };
  const lines = report.lines.map((l, i) => {
    if (i >= limit) return l;
    if (!unjudged(l)) { if (l && l.status === 'ok') learn(String(l.text ?? '')); return l; }
    const text = String(l.text ?? '');
    let proof = null;
    const state = {};
    try {
      proof = proveList(q, meta, text, spans) || proveSubstitution(q, text, spans) || proveRounded(q, text, i > 0 ? report.lines[i - 1]?.text : null, known) || proveRestated(text, spans, state) || proveIdentity(text) || proveDerivative(text) || proveChainRule(text);
    } catch { proof = null; }
    if (!proof || /[$—–]/.test(proof.note)) return l;
    n++;
    learn(text);
    if (proof.kind === 'restated') return { text: l.text, status: 'ok', state: 'given', solutionMatch: true, note: proof.note };
    // state 'arithmetic' = true as written: the page says once that such a line is true, not that it is the right step; the note is shown as it is
    return { text: l.text, status: 'ok', state: 'arithmetic', note: proof.note, valueChain: { rule: 'proved' }, fact: { kind: 'proved', proof: proof.kind, ...(proof.how || {}) } };
  });
  // The page-level proofs (pageProofs.js): substitutions, chains, second derivative, sign and nature, conclusions, conditions, the restated question
  // and headings, each proved from the question's own function and the roots an earlier ticked line of the page established.
  let pageN = 0, final;
  try { const pp = pageProofs(q, lines, limit, (l, i) => openNote(l)); final = pp.lines; pageN = pp.n + pp.lines.filter((l, i) => l !== lines[i] && l.status !== 'ok').length; } catch { final = lines; pageN = 0; }
  // The second page pass (pageProofs2.js): function values, implications, conditions, derivatives, the closed-interval extreme, check lists and the labels of a sketch.
  try { const p2 = pageProofs2(q, final, limit, (l, i) => openNote(l)); if (p2.n) { final = p2.lines; pageN += p2.n; } } catch { /* the first pass stands */ }
  if (!n && !pageN) return report;
  return withLines(report, final);
}

/**
 * The author's bank (a packed `qbank:` question): ONLY the second page pass (pageProofs2.js), on the page the marker made. The first pass and the older proofs
 * above are for the generated Years 11-12 banks and do not run here. Returns the same report when nothing is proved. Display only: never a cross, never a mark.
 */
export function provedLinesBank(q, report) {
  if (!report || !Array.isArray(report.lines)) return report;
  const brk = report.lines.findIndex(l => l?.status === 'break');
  const limit = brk >= 0 ? brk : report.lines.length;
  const p2 = pageProofs2(q, report.lines, limit, (l, i) => openNote(l));
  return p2.n ? withLines(report, p2.lines) : report;
}

// The report with these lines in place of its own, the summary counted again from them.
function withLines(report, lines) {
  const stated = lines.map(l => ({ ...l, state: l.state || (l.status === 'ok' ? 'verified' : l.status === 'break' ? 'wrong' : l.unreadable ? 'unread' : 'unverified') }));
  const at = st => stated.flatMap((l, k) => (l.state === st ? [k + 1] : []));
  const unverified = stated.flatMap((l, k) => (l.state === 'unverified' && l.context !== true ? [k + 1] : [])), unread = at('unread');
  return {
    ...report, lines: stated, folded: report.folded || undefined,
    summary: {
      ...(report.summary || {}), total: stated.length, checked: stated.filter(l => l.status === 'ok').length,
      given: at('given'), verified: at('verified'), arithmetic: at('arithmetic'), conditions: at('condition'), wrong: at('wrong'), unverified, unread,
      reason: unverified.length ? (report.summary?.reason || 'Pri could not tie these lines to anything it can prove about this question, so it did not mark them.') : null
    }
  };
}

/**
 * What the page draws when the lines were also folded by another reading (the interpreter's rules): `shown` is the engine's report with the proved
 * lines ticked, `displayed` is the report the page would draw without them. Only a line that is still an unjudged note there takes the proved tick;
 * every other line (ticked, crossed, folded) stays exactly as it is, so this can only turn a note into a tick.
 */
const DISPLAY_FIELDS = ['tickClass', 'notRequired', 'reasonId', 'correctedLine', 'correctedRhs', 'followsFromError', 'followsFrom'];
export function adoptProved(displayed, shown) {
  if (!displayed || !shown || !Array.isArray(displayed.lines) || !Array.isArray(shown.lines) || displayed.lines.length !== shown.lines.length) return displayed;
  const brk = displayed.lines.findIndex(l => l?.status === 'break');
  let n = 0;
  const lines = displayed.lines.map((l, i) => {
    const w = shown.lines[i];
    if (!l || !w || String(w.text ?? '') !== String(l.text ?? '')) return l;
    if (brk < 0 || i < brk) {
      // a heading is context, never a tick; a page-proved tick may replace any open note, an older proved tick only an unjudged one
      if (w.context === true && (['heading', 'restated', 'substitution-defined', 'method-stated', 'defines'].includes(w.tickClass) || NEUTRAL_CLASSES.has(w.tickClass)) && openNote(l)) { n++; return w; }
      // a line of integration working (integrationLines.js) that is provably false is crossed on the displayed page, and only on it (no mark reads the shown report)
      if (w.status === 'break' && w.fact?.proof === 'integration-false' && openNote(l)) { n++; return w; }
      if (w.status === 'ok' && (unjudged(l) || (w.fact?.kind === 'proved' && openNote(l)))) { n++; return w; }
    }
    // display-only fields (displayFields.js) are copied onto a line that keeps its own status and state
    const add = Object.fromEntries(DISPLAY_FIELDS.filter(k => w[k] !== undefined && l[k] === undefined && (k !== 'tickClass' || l.status === 'ok') && (k !== 'notRequired' || l.status === 'ok')).map(k => [k, w[k]]));
    if (!Object.keys(add).length) return l;
    n++;
    return { ...l, ...add };
  });
  if (!n) return displayed;
  const out = withLines(displayed, lines);
  return shown.answerLine !== undefined ? { ...out, answerLine: shown.answerLine } : out;
}
