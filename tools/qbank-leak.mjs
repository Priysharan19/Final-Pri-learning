// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · does a hint give the answer? (the author question bank)
//
// A real leak test, not a plain-text match. The text of a hint rung is read the way a student reads it: every `$…$` span is parsed as TeX
// (\binom, \tfrac, \dfrac, \frac, \sqrt, \times, \cdot, powers, e^{…}, \pi, degrees, sets, intervals, points, \pm, chains of `=`), and
// every closed side of it is EVALUATED. The rung leaks when
//   · the engine accepts any side, any list or any whole span as the answer (checkAnswer, so rounding and equivalent forms count);
//   · a closed numeric side evaluates to the answer (so `\binom{10}{5}`, `56/8`, `10 \times 2`, `\tfrac{48}{90}` against 8/15 are caught:
//     the one missing step is arithmetic);
//   · a set answer's element, or a point's coordinates, is stated;
//   · a bare number the prose states next to a word that announces a result ("the answer is 7") is the answer;
//   · a side that has digits, no letters of its own, and cannot be parsed: unread is treated as leaking (FAIL CLOSED).
// A rung that mentions an interval's endpoints as roots is not, by itself, the interval: the whole relation is what is tested.
//
// Deterministic. No clock, no network, no model.
// ─────────────────────────────────────────────────────────────────────────────
import { checkAnswer } from '../client/src/engine/checker.js';
import { normalize, evalNumeric, parse } from '../client/src/engine/expr.js';
import { repeats } from '../client/src/engine/hintLadder.js';
import { evalMath } from './qbank-figure-risk.mjs';

const MATH = /(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g;

// ── TeX → the plain text the engine reads ────────────────────────────────────
const GREEK = { theta: 'θ', alpha: 'α', beta: 'β', gamma: 'γ', mu: 'μ', lambda: 'λ', sigma: 'σ', Sigma: 'Σ', delta: 'δ', phi: 'φ', omega: 'ω' };
const FUNCS = new Set(['sin', 'cos', 'tan', 'sec', 'cot', 'ln', 'log', 'exp', 'arcsin', 'arccos', 'arctan']);
const ALIASES = { csc: 'cosec' };
/** A `{…}` group starting at `i` (which holds `{`): [inner, index after the closing brace], or null. */
function group(s, i) {
  if (s[i] !== '{') return null;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === '{') depth++;
    else if (s[j] === '}' && --depth === 0) return [s.slice(i + 1, j), j + 1];
  }
  return null;
}
/** One argument at `i`: a braced group or a single character (TeX's own rule). */
function arg(s, i) {
  while (s[i] === ' ') i++;
  if (s[i] === '{') return group(s, i);
  if (s[i] === '\\') { const m = /^\\[A-Za-z]+/.exec(s.slice(i)); return m ? [m[0], i + m[0].length] : null; }
  return i < s.length ? [s[i], i + 1] : null;
}

/**
 * TeX → plain, or { plain, unread: [commands the reader has no reading of] }. Separators (`=`, \approx, \Rightarrow, …) are kept as
 * written so a caller can split on them.
 */
export function texToPlain(tex) {
  const unread = [];
  const go = (s, depth = 0) => {
    if (depth > 12) { unread.push('depth'); return ''; }
    let out = '';
    for (let i = 0; i < s.length;) {
      const ch = s[i];
      if (ch === '\\') {
        const m = /^\\([A-Za-z]+|.)/.exec(s.slice(i));
        const name = m[1];
        i += m[0].length;
        if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
          const a = arg(s, i); const b = a && arg(s, a[1]);
          if (!a || !b) { unread.push(name); continue; }
          out += `((${go(a[0], depth + 1)})/(${go(b[0], depth + 1)}))`; i = b[1];
        } else if (name === 'binom' || name === 'dbinom' || name === 'tbinom') {
          const a = arg(s, i); const b = a && arg(s, a[1]);
          if (!a || !b) { unread.push(name); continue; }
          out += `ncr(${go(a[0], depth + 1)},${go(b[0], depth + 1)})`; i = b[1];
        } else if (name === 'sqrt') {
          let k = null;
          if (s[i] === '[') { const e = s.indexOf(']', i); if (e > 0) { k = s.slice(i + 1, e); i = e + 1; } }
          const a = arg(s, i);
          if (!a) { unread.push(name); continue; }
          const inner = go(a[0], depth + 1); i = a[1];
          out += k ? `((${inner})^(1/(${go(k, depth + 1)})))` : `sqrt(${inner})`;
        } else if (name === 'times' || name === 'cdot') out += '*';
        else if (name === 'div') out += '/';
        else if (name === 'pi') out += 'pi';
        else if (name === 'infty') out += 'inf';
        else if (name === 'circ') out += '°';
        else if (name === 'pm') out += '±';
        else if (name === 'mp') out += '∓';
        else if (name === 'le' || name === 'leq' || name === 'leqslant') out += '<=';
        else if (name === 'ge' || name === 'geq' || name === 'geqslant') out += '>=';
        else if (name === 'ne' || name === 'neq') out += '!=';
        else if (name === 'approx' || name === 'Rightarrow' || name === 'to' || name === 'iff' || name === 'mapsto' || name === 'therefore' || name === 'implies' || name === 'Leftrightarrow' || name === 'rightarrow') out += '=';
        else if (name === 'in' || name === 'sim' || name === 'propto') out += '=';
        else if (name === 'left' || name === 'right' || name === 'displaystyle' || name === 'quad' || name === 'qquad' || name === ',' || name === ';' || name === '!' || name === ' ' || name === ':' || name === '%') { if (name === '%') out += '%'; if (name === 'left' || name === 'right') { if (s[i] === '.') i++; } }
        else if (name === 'text' || name === 'mathrm' || name === 'textbf' || name === 'mbox' || name === 'operatorname') { const a = arg(s, i); if (a) i = a[1]; else unread.push(name); out += ' '; }
        else if (name === 'mathbf' || name === 'vec' || name === 'overrightarrow' || name === 'dot' || name === 'hat' || name === 'bar') { const a = arg(s, i); if (a) { out += go(a[0], depth + 1); i = a[1]; } else unread.push(name); }
        else if (name === 'prime') out += "'";
        else if (name === 'cdots' || name === 'dots' || name === 'ldots') out += '...';
        else if (GREEK[name]) out += GREEK[name];
        else if (FUNCS.has(name)) out += name;
        else if (ALIASES[name]) out += ALIASES[name];
        else if (name === '{' || name === '}') out += name;
        else if (name === '\\') out += ' ';
        else { unread.push(name); out += ' '; }
      } else if (ch === '{') {
        const g = group(s, i);
        if (!g) { out += '('; i++; continue; }
        out += `(${go(g[0], depth + 1)})`; i = g[1];
      } else if (ch === '^' || ch === '_') {
        const a = arg(s, i + 1);
        if (!a) { out += ch; i++; continue; }
        out += `${ch}(${go(a[0], depth + 1)})`; i = a[1];
      } else { out += ch; i++; }
    }
    return out;
  };
  const plain = go(String(tex ?? '')).replace(/\s+/g, ' ').trim();
  return { plain, unread: [...new Set(unread)] };
}

// ── what the reader may call closed ──────────────────────────────────────────
const NAMES = /(?:sin|cos|tan|sec|cosec|cot|ln|log|exp|sqrt|ncr|npr|arcsin|arccos|arctan|pi|inf|e)\b/g;
const hasFreeLetters = plain => /[A-Za-zΑ-Ωα-ω]/.test(plain.replace(NAMES, ''));
const SEPARATORS = /\s*(?:<=|>=|!=|=|<|>)\s*/;

const numberOf = text => {
  const t = String(text).replace(/π/g, 'pi').replace(/[−–]/g, '-').replace(/°/g, '*pi/180').replace(/(\d)\s*%/g, '($1/100)').trim();
  if (!t || !/\d/.test(t)) return null;
  try { const v = evalNumeric(normalize(t)); return Number.isFinite(v) ? v : null; } catch { return undefined; }   // undefined: could not be read
};
const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** The numbers the key is, for the numeric comparison. */
function keyNumbers(q) {
  const a = q?.answer || {};
  if (q?.answerType === 'numeric' && Number.isFinite(a.value)) return [a.value];
  if (q?.answerType === 'set') return (a.values || []).filter(Number.isFinite);
  if (q?.answerType === 'point') return [a.x, a.y].filter(Number.isFinite);
  return [];
}

const RESULT_WORDS = /(?:answer|result|equals?|gives?|get|so|therefore|hence|thus|is|are|=)\s*(?:then\s*)?(?:about\s*|approximately\s*)?$/i;

/** The text inside one pair of brackets that wraps all of it, else the text. */
function unwrap(s) {
  const t = s.trim();
  if (!/^[({\[]/.test(t) || !/[)}\]]$/.test(t)) return t;
  let depth = 0;
  for (let i = 0; i < t.length; i++) {
    if ('([{'.includes(t[i])) depth++; else if (')]}'.includes(t[i]) && --depth === 0 && i < t.length - 1) return t;
  }
  return t.slice(1, -1);
}

/** Splits a candidate at top-level commas (not inside brackets or braces). */
function topLevelList(s) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s) {
    if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}

/**
 * Why a text of a hint gives the answer to question `q` (a pack question as the server issues it), or null. The string names the reason.
 */
export function leakReason(q, text) {
  const t = String(text ?? '');
  if (!t.trim()) return null;
  const keys = keyNumbers(q);
  const numericKind = keys.length > 0;
  const accepted = c => { try { return checkAnswer(q, c)?.correct === true; } catch { return false; } };
  const spans = [...t.matchAll(MATH)].map(m => m[1]);
  for (const span of spans) {
    const { plain, unread } = texToPlain(span);
    // Candidates: the span, each side of its chain, each side of every relation, and, for ± , both signs.
    const variants = plain.includes('±') || plain.includes('∓')
      ? [plain.replace(/[±∓]/g, '+'), plain.replace(/[±∓]/g, '-'), plain.replace(/∓/g, '-').replace(/±/g, '+')]
      : [plain];
    for (const v of variants) {
      const cands = new Set([v, ...v.split(SEPARATORS).filter(Boolean)]);
      for (const side of v.split(/\s*=\s*/).filter(Boolean)) cands.add(side);
      for (const c of [...cands]) for (const item of topLevelList(unwrap(c))) cands.add(item);
      for (const c of cands) {
        const s = c.trim();
        if (!s || s.length > 160) continue;
        if (accepted(s)) return `the engine accepts "${s.slice(0, 40)}" as the answer`;
        if (accepted(s.replace(/^[A-Za-z']+(\([a-z]\))?\s*=\s*/, ''))) return `the engine accepts "${s.slice(0, 40)}" as the answer`;
        if (numericKind && !hasFreeLetters(s) && !SEPARATORS.test(s)) {
          const v2 = numberOf(s);
          if (v2 === undefined) return `a closed value "${s.slice(0, 40)}" cannot be read (fail closed)`;
          if (v2 !== null && keys.some(k => near(v2, k))) return `"${s.slice(0, 40)}" evaluates to the answer`;
        }
      }
      if (q?.answerType === 'set' && accepted(topLevelList(unwrap(v)).join(', '))) return 'the whole set is stated';
      if (q?.answerType === 'point') { const m = /^\(?\s*([^,]+),\s*([^,)]+)\)?$/.exec(v); if (m && accepted(`(${m[1]}, ${m[2]})`)) return 'the point is stated'; }
    }
    // A command the reader has no reading of, in a span that is all numbers and no letters of its own, is an unread value.
    if (numericKind && unread.length && !hasFreeLetters(plain) && /\d/.test(plain)) return `unread TeX (${unread.join(' ')}) in a numeric span (fail closed)`;
  }
  // Prose written without TeX ("d/dx x^3 = 3x^2."): what follows each equals sign is read like a side of a span.
  for (const m of t.replace(MATH, ' ').matchAll(/=\s*([^=;\n]{1,80}?)(?:[.;,](?:\s|$)|$)/g)) {
    const s = m[1].trim();
    if (s && accepted(s)) return `the engine accepts "${s.slice(0, 40)}" as the answer`;
  }
  // Prose: a number the words announce as the result.
  const prose = t.replace(MATH, m => ` @@${m.length}@@ `);
  if (numericKind) {
    for (const m of prose.matchAll(/(?<![\d.@])-?\d+(?:\.\d+)?(?:\/\d+)?(?!\d|\.\d)/g)) {
      const [p, d] = m[0].split('/');
      const v = d ? Number(p) / Number(d) : Number(p);
      if (keys.some(k => near(v, k)) && RESULT_WORDS.test(prose.slice(Math.max(0, m.index - 30), m.index))) return `the prose states ${m[0]} as the result`;
    }
  }
  return null;
}

/** Every text of a pack question that gives the answer: the hints, the answer box's own hint and the rungs of its ladder. [label, reason]. */
export function leaksOf(q, texts) {
  const out = [];
  for (const [label, text] of texts) { const r = leakReason(q, text); if (r) out.push([label, r]); }
  return out;
}


// ─────────────────────────────────────────────────────────────────────────────
// The rung rule (fail closed). A bank question's hint ladder is built ONLY from the author's own hints, in his order; nothing is derived
// from a worked step or a step heading. A hint becomes a rung only when every test below passes; a hint that fails any is dropped,
// and a question may end with 0 to 3 rungs (with none the hint control is not offered for it).
//
//   · empty, a lone ordinary word, or only a bare verb from a stoplist (alone or with "it"/"this"): nothing to learn from it. Two or more
//     words are otherwise kept, and so is one maths span that passes every test below;
//   · every TeX span is read; one the reader cannot read is dropped; so is any side of it the engine's parser cannot parse;
//   · every maths run written in plain prose ("56/8", "100 − 50", "2 ln 3 = ln 9") is read the same way;
//   · ANY side, run, list or number in it that is the accepted answer, any accepted form of it, or an arithmetic expression that
//     evaluates to it, is a leak (leakReason, and the standalone-number and plain-run tests here);
//   · it is not the text of the question, of its answer box, of a criterion, a step, a trap's reason or expression, or the title, and
//     a hint that contains one of those long texts whole is dropped (those are sealed until the question resolves, and the hints are
//     sent when it is issued).
// ─────────────────────────────────────────────────────────────────────────────

/** Verbs that, alone or with "it" or "this", say nothing the question did not (the stoplist of the thin-hint rule). */
const BARE_VERBS = new Set(['evaluate', 'simplify', 'multiply', 'substitute', 'solve', 'calculate', 'compute', 'expand', 'factorise', 'factorize', 'factor', 'differentiate', 'integrate', 'rearrange', 'divide', 'add', 'subtract', 'cancel', 'rewrite', 'find', 'use', 'apply', 'try', 'do', 'square', 'equate', 'collect', 'combine', 'reduce', 'complete', 'read', 'look', 'see', 'check', 'draw', 'plot']);
const ARTICLES = new Set(['the', 'a', 'an', 'each', 'both', 'all', 'of', 'to']);
/** Nouns that make a bare verb no more than the question again ("Read the graph."). */
const GENERIC_NOUNS = new Set(['graph', 'diagram', 'figure', 'picture', 'sketch', 'table', 'axes']);
const FILLER = new Set(['it', 'this', 'that', 'them', 'these', 'those', 'first', 'now', 'then', 'again', 'please']);
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

const RELATION = /\s*(?:<=|>=|!=|=|<|>|≤|≥|≈)\s*/;
/** A text folded to what it says: no TeX markup, spacing, case or punctuation. */
const fold = t => String(t ?? '').toLowerCase().replace(/\\[dt]?frac/g, 'frac').replace(/\\(?:left|right|displaystyle|quad|qquad|,|;|!)/g, '')
  .replace(/\\(?:cdot|times)/g, '').replace(/[*×]/g, '').replace(/[−–—]/g, '-').replace(/[$\\{}\s.,;:!?'"`]/g, '');

const wordsOf = prose => prose.split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w));

/** The numbers the accepted answer is, in every place it can be a number (a numeric key, a set's elements, a point's coordinates, an interval's ends). */
function answerNumbers(q) {
  const a = q?.answer || {};
  const out = [...keyNumbers(q)];
  // One step from a numeric answer: its coefficient of pi (5/4 for 5pi/4), and what the logarithm of it is the logarithm of
  // (10^3 for log 1000 = 3, 2^k, e^k for a small whole answer k).
  if (q?.answerType === 'numeric' && Number.isFinite(a.value)) {
    const c = a.value / Math.PI;
    for (let d = 1; d <= 12; d++) { const n = Math.round(c * d); if (n !== 0 && Math.abs(c * d - n) < 1e-9 * Math.max(1, Math.abs(n))) { out.push(n / d); break; } }
    if (Number.isInteger(a.value) && Math.abs(a.value) <= 12) out.push(10 ** a.value, 2 ** a.value, Math.E ** a.value);
    if (Math.abs(a.value) <= 360) out.push(Math.sin(a.value * Math.PI / 180), Math.cos(a.value * Math.PI / 180), Math.tan(a.value * Math.PI / 180));
  }
  if (q?.answerType === 'interval' && typeof a.region === 'string') for (const m of a.region.matchAll(/\d+(?:\.\d+)?/g)) out.push(Number(m[0]));
  return out.filter(Number.isFinite);
}

/** The standalone numbers of a reading: not an exponent or subscript, not a coefficient of a letter, function or bracket. */
function standaloneNumbers(plain) {
  const out = [];
  for (const m of String(plain).matchAll(/(?<![A-Za-z0-9_.])(\d+(?:\.\d+)?)(?![A-Za-z0-9_.(])/g)) {
    const before = plain.slice(Math.max(0, m.index - 2), m.index);
    if (/[\^_]\(?$/.test(before)) continue;     // an exponent or a subscript
    out.push(Number(m[1]));
  }
  return out;
}

/** The maths runs of prose written without TeX: maximal runs of number, operator and function tokens (a lone letter joins one only beside a number or operator). */
const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', 'ˣ': 'x', 'ⁿ': 'n', '⁺': '+' };
const SUB = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', 'ₙ': 'n' };
const VULGAR = { '½': '(1/2)', '⅓': '(1/3)', '⅔': '(2/3)', '¼': '(1/4)', '¾': '(3/4)', '⅕': '(1/5)', '⅛': '(1/8)' };
/** Prose maths written in Unicode (x², aₙ, ½) as the plain ASCII the reader parses. */
export function plainUnicode(t) {
  return String(t)
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺ˣⁿ]+/g, m => `^${[...m].map(c => SUP[c]).join('')}`)
    .replace(/[₀₁₂₃₄₅₆₇₈₉ₙ]+/g, m => `_${[...m].map(c => SUB[c]).join('')}`)
    .replace(/[½⅓⅔¼¾⅕⅛]/g, m => VULGAR[m]);
}
export function proseRuns(proseRaw) {
  const prose = plainUnicode(proseRaw);
  const FN = '(?:arcsin|arccos|arctan|cosec|sqrt|sin|cos|tan|sec|cot|log|exp|ln|pi)';
  const L = 'A-Za-zα-ωΑ-Ω';
  const kindOf = tok => {
    const t = tok.replace(/[.,;:!?]+$/, '');
    if (!t) return 'x';
    if (new RegExp(`^[${L}]$`).test(t)) return 'v';
    if (new RegExp(`^${FN}$`).test(t)) return 'f';
    const rest = t.replace(new RegExp(FN, 'g'), '').replace(new RegExp(`(?<![${L}])[${L}](?![${L}])`, 'g'), '');
    if (/^[0-9.+\-−–×÷*/^()=π√°%<>≤≥′″'_]*$/.test(rest) && /[0-9π√=+\-−–×÷*/^]/.test(t)) return 'm';
    if (/^[()_′″']*$/.test(rest) && new RegExp(`[${L}]`).test(t)) return 'v';      // x), P(X, f(x): symbols and brackets
    return 'x';
  };
  const runs = [];
  let cur = [];
  const flush = () => {
    while (cur.length && cur[0].k === 'v' && /^[aAI]$/.test(cur[0].t)) cur.shift();
    while (cur.length && cur[cur.length - 1].k === 'v' && /^[aAI]$/.test(cur[cur.length - 1].t)) cur.pop();
    if (cur.some(x => x.k === 'm')) runs.push(cur.map(x => x.t).join(' ').replace(/[,;:]+$/, '').replace(/^[=<>≤≥+×÷*/^\s]+/, '').replace(/[=<>≤≥+−–×÷*/^\s-]+$/, ''));
    cur = [];
  };
  for (const raw of prose.split(/\s+/).filter(Boolean)) {
    const k = kindOf(raw);
    if (k === 'x') { flush(); continue; }
    cur.push({ k, t: raw.replace(/[.!?]+$/, '') });
    if (/[.!?]$/.test(raw)) flush();
  }
  flush();
  return runs;
}

/** Inverse trigonometric notation, minus signs and the multiplication sign, as the engine writes them. */
const cleanMath = s => s.replace(/π/g, 'pi').replace(/\b(sin|cos|tan)\s*\^\s*\(?-1\)?/g, 'arc$1').replace(/[−–]/g, '-').replace(/[×]/g, '*').replace(/÷/g, '/').replace(/[:;]/g, ',');
/** What the engine's parser needs to be asked "is this readable": subscripts, primes and Greek letters it has no spelling for are made plain. */
const forParse = s => s.replace(/\^\(°\)/g, '°').replace(/_\(?([A-Za-z0-9]+)\)?/g, '$1').replace(/[′″'‴]+/g, '').replace(/[α-ωΑ-Ω]/g, m => (m === 'θ' || m === 'π' ? m : 'q')).replace(/°/g, '*pi/180').replace(/%/g, '/100');
const bareFns = s => s.replace(/\b(arcsin|arccos|arctan|cosec|sqrt|sin|cos|tan|sec|cot|log|exp|ln)\b(?!\s*[0-9(A-Za-zπθ√])/g, '$1(1)');
const SYMBOL = /^[A-Za-zα-ωΑ-Ω]+(?:_\(?[A-Za-z0-9]+\)?)?['′″]*$/;
const balance = s => { let depth = 0; let out = ''; for (const ch of s) { if (ch === '(') { depth++; out += ch; } else if (ch === ')') { if (depth > 0) { depth--; out += ch; } } else out += ch; } return out + ')'.repeat(depth); };
const parsable = s => { const t = forParse(s); for (const u of [t, bareFns(t)]) { try { parse(normalize(u)); return true; } catch { /* next */ } } return false; };
/** Can the engine's parser read it? A relation inside brackets (P(X = 0)) is read a side at a time. */
function readable(s) {
  const t = cleanMath(s);
  if (parsable(t)) return true;
  if (!RELATION.test(t)) return false;
  return t.split(RELATION).map(x => balance(x.trim())).filter(Boolean).every(parsable);
}

/** `s` split at the relations that are not inside brackets. */
function splitTop(s) {
  const out = []; let depth = 0, cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--;
    const m = depth === 0 ? /^\s*(?:<=|>=|!=|=|<|>|≤|≥|≈)\s*/.exec(s.slice(i)) : null;
    if (m && m[0].trim()) { out.push(cur); cur = ''; i += m[0].length - 1; } else cur += ch;
  }
  out.push(cur);
  return out;
}
const sidesOf = v => [...new Set(splitTop(v).flatMap(part => topLevelList(unwrap(part))))];

/** Why a side states the answer or cannot be read, or null. `strict` (TeX): what cannot be read is dropped; prose: only a side that is all digits and operators. */
function sideReason(q, side, accepted, keys, strict, whole = false) {
  const s = balance(cleanMath(side.trim()));
  if (!s) return null;
  if (accepted(s) || accepted(s.replace(/^[A-Za-z']+(\([a-z]\))?\s*=\s*/, ''))) return `the engine accepts "${s.slice(0, 40)}" as the answer`;
  if (whole) return null;
  const letters = hasFreeLetters(s) || bareFns(forParse(s)) !== forParse(s);
  if (!letters && /\d/.test(s) && !RELATION.test(s)) {
    const v = numberOf(s);
    if (v === undefined) return `a closed value "${s.slice(0, 40)}" cannot be read (fail closed)`;
    if (v !== null && keys.some(k => near(v, k))) return `"${s.slice(0, 40)}" evaluates to the answer`;
    // one step from the answer: its logarithm (3 ln 2 = ln 8 when the answer is 8)
    if (v !== null && keys.some(k => k > 0 && (near(v, Math.log(k)) || near(v, Math.log10(k))) && !(Number.isInteger(v) && Math.abs(v) <= 3))) return `"${s.slice(0, 40)}" is the logarithm of the answer`;
  }
  if ((strict || (!letters && /\d/.test(s))) && /[A-Za-z0-9α-ωΑ-Ω]/.test(s) && !SYMBOL.test(s) && !readable(s)) return `"${s.slice(0, 40)}" cannot be parsed (fail closed)`;
  return null;
}

// ── what a rung can DERIVE: values it produces in one step, tested against the real marker ─────────────────────────────
const METHOD_NOUN = /\b(?:rule|theorem|law|method|identity|formula|principle|test|complement(?:ary)?|substitution|inverse|chain|product|quotient|symmetry|conditional|bayes|pythagoras|pythagorean|binomial|discriminant|remainder|factor|completing the square|by parts|partial fractions|trapezoidal|simpson|difference of (?:two )?squares|sine|cosine|tangent|domain|range|empirical|normal approximation|total probability|inclusion|exclusion|arrangements?|combinations?|permutations?|slots|gaps|restriction|tree|diagram)\b/i;
/** A short noun phrase naming a rule, law, theorem or method, with no number in it: a good hint whatever else it matches. */
export const isMethodName = t => { const x = String(t).trim(); return !/\d|[=<>+*/^$\\]/.test(x) && x.split(/\s+/).length <= 6 && METHOD_NOUN.test(x) && !/\b(?:answer|result|equals?)\b/i.test(x); };
const SUPERS = { '\u2070': '0', '\u00b9': '1', '\u00b2': '2', '\u00b3': '3', '\u2074': '4', '\u2075': '5', '\u2076': '6', '\u2077': '7', '\u2078': '8', '\u2079': '9', '\u2080': '0', '\u2081': '1', '\u2082': '2', '\u2083': '3', '\u2084': '4', '\u2085': '5', '\u2086': '6', '\u2087': '7', '\u2088': '8', '\u2089': '9' };
const digitsOfScript = x => [...String(x)].map(c => SUPERS[c] ?? c).join('');
const ncr = (n, r) => { if (r < 0 || r > n || n > 60) return null; let v = 1; for (let i = 1; i <= r; i++) v = v * (n - r + i) / i; return Math.round(v); };
const npr = (n, r) => { if (r < 0 || r > n || n > 20) return null; let v = 1; for (let i = 0; i < r; i++) v *= n - i; return v; };
const pi2 = x => String(x).replace(/π/g, 'pi');
/** Values a rung produces in one line: "a of b", a divided by b, C(n,r) and nPr, a product of listed numbers, a one-line linear equation, a percentage. */
function derivedValues(text) {
  const t = plainUnicode(String(text)).replace(/\$/g, ' ');
  const raw = String(text);
  const out = [];
  const add = (v, why) => { if (Number.isFinite(v)) out.push({ v, why }); };
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s+(?:of|out of|in)\s+(\d+(?:\.\d+)?)/gi)) add(Number(m[1]) / Number(m[2]), `"${m[0]}"`);
  for (const m of t.matchAll(/divide\s+([\d.π*]*[\dπ])\s+by\s+([\d.π*]*[\dπ])/gi)) { const a = evalMath(pi2(m[1])), b = evalMath(pi2(m[2])); if (a && b) add(a / b, `"${m[0]}"`); }
  for (const m of t.matchAll(/([\d.π*]*[\dπ])\s*(?:÷|divided by)\s*([\d.π*]*[\dπ])/gi)) { const a = evalMath(pi2(m[1])), b = evalMath(pi2(m[2])); if (a && b) add(a / b, `"${m[0]}"`); }
  for (const m of raw.matchAll(/(?<![A-Za-z])C\(\s*(\d+)\s*,\s*(\d+)\s*\)|(?<![A-Za-z\d])(\d+)C(\d+)(?![\d])|\\binom\{(\d+)\}\{(\d+)\}/g)) { const n = Number(m[1] ?? m[3] ?? m[5]), r = Number(m[2] ?? m[4] ?? m[6]); add(ncr(n, r), `C(${n}, ${r})`); }
  for (const m of raw.matchAll(/([\u2070\u00b9\u00b2\u00b3\u2074-\u2079\d]+)\s*P\s*([\u2080-\u2089\d]+)|\^?\{?(\d+)\}?P_?\{?(\d+)\}?/g)) { const n = Number(digitsOfScript(m[1] ?? m[3])), r = Number(digitsOfScript(m[2] ?? m[4])); if (Number.isFinite(n) && Number.isFinite(r)) add(npr(n, r), `${n}P${r}`); }
  const nums = [...t.matchAll(/(?<![\w.^_])(\d+(?:\.\d+)?)(?![\w^_]|\.\d)/g)].map(m => Number(m[1]));
  if (nums.length >= 3 && nums.length <= 6 && /\bthen\b|\u00d7|\*/i.test(t)) add(nums.reduce((a, b) => a * b, 1), `the product of ${nums.join(', ')}`);
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s*%/g)) { add(Number(m[1]), `${m[0]}`); add(Number(m[1]) / 100, `${m[0]}`); }
  // one-line linear equation in one letter: 2b = 20, 45 = 2v
  for (const m of t.matchAll(/([^=;,]+?)\s*=\s*([^=;,]+?)(?=[;,.]?\s*$|[;,]|\.\s)/g)) {
    const L = pi2(m[1]), Rr = pi2(m[2]);
    const letters = [...new Set((L + ' ' + Rr).replace(/\b(?:sin|cos|tan|ln|log|exp|sqrt|pi|e)\b/g, '').match(/[A-Za-z]/g) || [])];
    if (letters.length !== 1) continue;
    const v = letters[0];
    const f = x => { const l = evalMath(L, { [v]: x }), r = evalMath(Rr, { [v]: x }); return l === null || r === null ? null : l - r; };
    const f0 = f(0), f1 = f(1), f2 = f(2);
    if (f0 === null || f1 === null || f2 === null || Math.abs((f2 - f1) - (f1 - f0)) > 1e-9 || Math.abs(f1 - f0) < 1e-12) continue;
    add(-f0 / (f1 - f0), `the equation "${m[0].trim()}"`);
  }
  return out;
}
/** Why a rung derives the answer (or its complement) through the marker, or null. */
function derivedLeak(q, text, accepted) {
  const fmt = v => String(Number(v.toPrecision(12)));
  for (const { v, why } of derivedValues(text)) {
    for (const c of [v, 1 - v, 100 - v]) if (Number.isFinite(c) && accepted(fmt(c)) && !(c === 0 || c === 1 && v !== 1)) return `${why} gives ${fmt(c)}, which the marker accepts as the answer`;
    for (const c of [v]) if (accepted(fmt(c))) return `${why} gives ${fmt(c)}, which the marker accepts as the answer`;
  }
  return null;
}
/** Numbers and sides of the LAST worked step, and the numbers the question states (a rung may repeat what is given). */
function lastStepLeak(q, ctx, t, spans, prose) {
  const steps = ctx.steps || q.steps || [];
  const last = steps.length ? String(steps[steps.length - 1]?.d ?? '') : '';
  if (!last) return null;
  const lastPlain = plainUnicode(texToPlain(last.replace(/\$/g, '')).plain);
  const stated = new Set([...String(q.prompt ?? '').matchAll(/(?<![\w.^_])(\d+(?:\.\d+)?)(?![\w.^_])/g)].map(m => Number(m[1])));
  const lastAll = [...lastPlain.matchAll(/(?<![\w.^_])(\d+(?:\.\d+)?)(?![\w^_]|\.\d)/g)].map(m => Number(m[1])).filter(v => v !== 0);
  const lastNums = lastAll.filter(v => !stated.has(v));
  // The result of the last worked step is its final side. A rung that STATES it (an equation or a percentage with that value on its right) is a leak;
  // one that only mentions a factor or a count in words ("multiply by 0.85 each year", "78 periods") or sets a substitution up ("let u = sin x") is a method.
  const lastFinal = fold(lastPlain.split(/=|\u21d2|\u2248/).pop());
  const setsUp = /^\s*(?:let|set|write|rewrite|use|substitute|define|put|take)\b/i.test(prose.trim()) || /^\s*(?:let|set|write|rewrite|use)\b/i.test(t);
  const rungSides = [];
  for (const sp of spans) rungSides.push(...texToPlain(sp).plain.split(/=/));
  const eqSides = prose.includes('=') ? prose.split(/=/) : [];
  rungSides.push(...eqSides);
  const hasEq = rungSides.length > spans.length || spans.some(sp => sp.includes('=')) || eqSides.length > 0;
  if (hasEq && !setsUp) {
    const finals = [];
    for (const sp of spans) if (sp.includes('=')) finals.push(texToPlain(sp).plain.split(/=/).pop());
    if (eqSides.length) finals.push(eqSides[eqSides.length - 1]);
    for (const side of finals) {
      const f = fold(side);
      if (f.length >= 2 && f === lastFinal && !(/^\d+(?:\.\d+)?$/.test(f) && stated.has(Number(f)))) return `its right side ("${side.trim().slice(0, 30)}") is the result of the last worked step`;
    }
  }
  const closed = [];
  for (const side of rungSides.concat(proseRuns(prose))) { const v = numberOf(String(side).replace(/%/g, '').replace(/[.,;:\s]+$/, '')); if (typeof v === 'number' && v !== 0) closed.push(v); }
  const pct = [...prose.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map(m => Number(m[1]));
  const smallWhole = v => Number.isInteger(v) && Math.abs(v) < 10;       // a stated small count is a method ("choose 2 from the other 7"), not a result
  if (hasEq && !setsUp) for (const v of closed) if (!smallWhole(v)) for (const n of lastNums) if (near(v, n)) return `it states ${+v.toFixed(6)}, a number of the last worked step`;
  for (const v of pct) for (const n of lastNums) if (near(v, n) || near(v, 100 - n)) return `it states ${v}%, a number of the last worked step`;
  for (const v of closed) for (const n of lastAll) if (n > 0 && n < 1 && near(v, 1 - n)) return `it states ${+v.toFixed(6)}, the complement of a number of the last worked step`;
  return null;
}

/** Why this text must not be a rung of question `q` (a pack question as the server issues it), or null. `ctx`: { title, criteria, steps, traps }. */
export function rungDropReason(q, text, ctx = {}) {
  const t = String(text ?? '').trim();
  if (!t) return 'empty';
  const spans = [...t.matchAll(MATH)].map(m => m[1]);
  const prose = t.replace(MATH, ' ');
  const words = wordsOf(prose);
  // A rule, law, theorem or method named in words with no number in it is a good hint: it is not thin, and a step heading that names the same
  // method does not make it a leak (the heading is the method, not a result).
  const methodName = isMethodName(t);
  // Thin hints. Two or more words are kept, whatever they say, unless they are only a bare verb (alone, or with "it"/"this"); one maths span
  // or one run of plain maths is kept when it passes every test below; a lone ordinary word is nothing to learn from.
  if (words.length + spans.length === 0) return 'empty';
  const plainWords = words.map(w => w.toLowerCase().replace(/[^a-z]/g, '')).filter(Boolean);
  const symbolOnly = spans.every(sp => /^\s*\\?[A-Za-z]{1,6}(?:_\{?\w+\}?)?\s*$/.test(sp));
  if (!methodName && plainWords.length && symbolOnly && plainWords.some(w => BARE_VERBS.has(w)) && plainWords.every(w => BARE_VERBS.has(w) || FILLER.has(w) || ARTICLES.has(w) || GENERIC_NOUNS.has(w) || w.length === 1)) return 'a bare verb';
  if (!methodName && words.length + spans.length === 1 && !spans.length && !/[0-9=+\-−×÷*/^²³]/.test(words[0])) return 'a single word';

  // Only a number, a fraction or a power of numbers: it names no method and gives, or is one step from, a value.
  { const bare = plainUnicode(texToPlain(spans.length ? spans.join(' ') + ' ' + prose : t).plain).replace(/[\s.,;:!?]+$/g, '').trim();
    if (bare && !/[A-Za-z\u03b1-\u03c9\u0391-\u03a9\u221a]/.test(bare) && /\d/.test(bare) && !words.some(w => /[A-Za-z]/.test(w))) return 'only a number, fraction or power'; }

  const direct = leakReason(q, t);
  if (direct) return direct;

  const keys = answerNumbers(q);
  const accepted = c => { try { return checkAnswer(q, c)?.correct === true; } catch { return false; } };
  const numberHit = (list, where) => { const n = list.find(v => keys.some(k => near(v, k))); return n === undefined ? null : `${where} states the number ${n}, which is in the answer`; };

  for (const span of spans) {
    const { plain, unread } = texToPlain(span);
    if (unread.length) return `unread TeX (${unread.join(' ')}) (fail closed)`;
    const variants = plain.includes('±') || plain.includes('∓') ? [plain.replace(/[±∓]/g, '+'), plain.replace(/[±∓]/g, '-')] : [plain];
    for (const v of variants) {
      for (const side of sidesOf(v)) { const r = sideReason(q, side, accepted, keys, true); if (r) return r; }
    }
    const hit = numberHit(standaloneNumbers(cleanMath(plain)), 'a maths span'); if (hit) return hit;
  }
  for (const run of proseRuns(prose)) {
    const variants = run.includes('±') ? [run.replace(/±/g, '+'), run.replace(/±/g, '-')] : [run];
    for (const v of variants) {
      const clean = x => x;
      const whole = sideReason(q, clean(v), accepted, keys, false, true); if (whole) return whole;
      for (const side of sidesOf(v)) { const r = sideReason(q, clean(side), accepted, keys, false); if (r) return r; }
    }
    const hit = numberHit(standaloneNumbers(cleanMath(run)), 'the prose'); if (hit) return hit;
  }

  // What the rung produces in one line, through the real marker (the complement too), and what it repeats of the last worked step.
  { const dl = derivedLeak(q, t, accepted); if (dl) return dl; const ls = lastStepLeak(q, ctx, t, spans, prose); if (ls) return ls; }
  // One step from the answer of a logarithm, exponential or inverse trigonometric answer: its argument.
  if (q?.answerType === 'expression' && typeof q.answer?.expr === 'string') {
    const m = /^(ln|log|exp|asin|acos|atan|sqrt)\((.*)\)$/.exec(q.answer.expr.replace(/\s+/g, ''));
    if (m) {
      for (const sp of [...spans, ...proseRuns(prose)]) for (const side of String(sp).split(/=/)) {
        const a1 = evalMath(texToPlain(side).plain, { x: 0.37 }), a2 = evalMath(m[2], { x: 0.37 });
        const b1 = evalMath(texToPlain(side).plain, { x: 1.9 }), b2 = evalMath(m[2], { x: 1.9 });
        if (a1 !== null && a2 !== null && b1 !== null && b2 !== null && Math.abs(a1 - a2) < 1e-9 && Math.abs(b1 - b2) < 1e-9 && !/^\s*x?\s*$/.test(side)) return `it states the argument of the answer (${m[2].slice(0, 20)})`;
      }
    }
  }

  // A number spelled out as the result ("the answer is seven").
  for (const k of keys) if (Number.isInteger(k) && k >= 0 && k <= 20 && new RegExp(`(?:answer|result|equals?|gives?|get|so|therefore|hence|thus|is|are|=)\\s*(?:then\\s*)?(?:about\\s*)?${NUMBER_WORDS[k]}\\b`, 'i').test(prose)) return `the prose spells out ${NUMBER_WORDS[k]} as the result`;

  // The same words as another thing a student is sent or that is sealed until the question resolves.
  const f = fold(t);
  const steps = ctx.steps || q.steps || [], criteria = ctx.criteria || q.criteria || [], traps = ctx.traps || q.traps || [];
  const sealed = [
    ['a step heading', ...steps.map(s => s?.h)], ['a step', ...steps.map(s => s?.d)],
    ['a criterion', ...criteria.flatMap(c => [c?.point, c?.line])],
    ['a trap reason', ...traps.map(x => x?.why)], ['a trap answer', ...traps.flatMap(x => [x?.expr, x?.value])],
    ['the title', ctx.title]
  ];
  for (const [what, ...fields] of sealed) for (const field of fields) {
    if (methodName && what === 'a step heading') continue;
    if (field === undefined || field === null || field === '') continue;
    const g = fold(String(field));
    if (g.length >= 3 && f === g) return `it is word for word ${what}`;
    if (g.length >= 10 && f.includes(g)) return `it contains ${what} whole`;
  }
  const open = [['the question', q.prompt], ['the answer box hint', q.inputHint], ['the answer box label', q.answerPrefix]];
  for (const [what, field] of open) {
    if (!field) continue;
    const g = fold(field);
    if (g.length >= 3 && (f === g || (g.length >= 8 && (f.includes(g) || g.includes(f))))) return `it repeats ${what}`;
  }
  // A span whose whole reading is a criterion's line or a trap's expression is that line.
  const lines = new Set([...criteria.map(c => c?.line), ...traps.map(x => (typeof x?.expr === 'string' ? x.expr : null))].filter(Boolean).map(fold).filter(x => x.length >= 4));
  for (const span of spans) if (lines.has(fold(texToPlain(span).plain)) || lines.has(fold(span))) return 'a maths span is a criterion line or a trap expression';
  for (const run of proseRuns(prose)) if (lines.has(fold(run))) return 'a maths run is a criterion line or a trap expression';
  return null;
}

/**
 * The ladder of one bank question: ONLY his authored hints (`q.hints`, in his order, at most three), each kept as a rung when it passes
 * rungDropReason and does not repeat a rung already kept. Nothing is derived from a step or a heading. Returns
 * { hints, ladder, dropped }: `hints` the kept texts in order, `ladder` { nudge, method, worked } filled from the front (a question may have
 * 0 to 3 rungs), `dropped` [{ index, why }].
 */
export function bankLadder(q, ctx = {}) {
  const authored = (Array.isArray(q.hints) ? q.hints : []).slice(0, 3);
  const kept = [], dropped = [];
  authored.forEach((h, index) => {
    const text = typeof h === 'string' ? h.trim() : '';
    let why = rungDropReason(q, text, ctx);
    if (!why && kept.some(k => repeats(k, text))) why = 'it repeats a rung already kept';
    if (why) dropped.push({ index, why }); else kept.push(text);
  });
  const ladder = {};
  ['nudge', 'method', 'worked'].forEach((rung, i) => { if (kept[i]) ladder[rung] = kept[i]; });
  return { hints: kept, ladder, dropped };
}
