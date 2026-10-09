// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the marker's text readers, old against new
//
// The marking engine now also runs on the server, on text a student sent: an
// answer of up to 12,000 characters, working of up to 8,000. Eight places in it
// read that text with a regular expression whose running time grew with the
// square (or the cube) of a run of spaces, "<", "²" or "pi" — CodeQL's
// js/polynomial-redos. Each was rewritten to read its input once.
//
// A marker may not change its mind because of that. So this suite keeps a
// private copy of every ORIGINAL pattern and holds the rewrite to it:
//
//   · the same match, the same captured text, the same replaced output, over
//     seeded random strings from an alphabet chosen for each site, over every
//     short string of that alphabet's hardest tokens, over hand-written edge
//     cases, and over every piece of text the engine's own generators produce
//     across generators × difficulties × seeds;
//   · each rewrite reads a 12,000-character adversarial string in well under
//     50 ms;
//   · and the original pattern really was superlinear, measured as a ratio of
//     its own times at two sizes rather than against a clock.
//
// Nothing here is a model of what the patterns "should" do. Where an original
// had a quirk — a coordinate of only spaces keeps its last space; a unit with
// no power keeps its trailing whitespace — the rewrite has the same quirk.
// ─────────────────────────────────────────────────────────────────────────────
import { performance } from 'node:perf_hooks';
import { GENERATORS, generateQuestion, loadAllBanks } from '../src/engine/generators/index.js';
import { answerText } from '../src/engine/indiaExamComposer.js';
import { stripVectorNotation, parseVectorInput } from '../src/engine/answer-forms.js';
import { stripCurrencyTail, bracedInner, cleanInput, parseNumericInput } from '../src/engine/checker-core.js';
import { rewriteSuperscriptCounting, normalize } from '../src/engine/expr.js';
import { splitAtRelation, parseRelation } from '../src/engine/reason-v2.js';
import { coordinatePairs, assessPointLine } from '../src/engine/reason-v3.js';
import { trailingUnit, canonicalUnit, writtenUnit, withoutUnit } from '../src/engine/units.js';

let pass = 0;
const failures = [];
function ok(cond, label) {
  if (cond) pass++;
  else if (failures.length < 40) failures.push(label);
  else failures.count = (failures.count || 40) + 1;
}

// ── The original patterns, verbatim ──────────────────────────────────────────
// Copied from the engine as it stood before the rewrite. They are the oracle
// and must never be "tidied": editing one changes what this suite proves.
const OLD_HAT = /\\hat\s*\{?\s*([ijk])\s*\}?/g;
const OLD_VEC = /\\vec\s*\{?\s*[a-zA-Z]\s*\}?\s*=\s*/g;
const OLD_NAME = /^[a-zA-Z]{1,3}\s*(?:→|⃗)?\s*=\s*/;
const OLD_CURRENCY_TAIL = /\s*(?:\b(?:rupees?|paise|rs)\.?|₹)\s*$/i;
const OLD_ROSTER = /^\{\s*([^{}]*?)\s*\}$/;
const OLD_BRACED = /^\{\s*([\s\S]*?)\s*\}$/;
const OLD_COUNTING = /([⁰¹²³⁴⁵⁶⁷⁸⁹]+)\s*([CP])\s*([₀₁₂₃₄₅₆₇₈₉]+)/g;
const OLD_RELATION = /^(.*?)(<=|>=|<|>)(.*)$/;
const OLD_RELATION_AGAIN = /(<=|>=|<|>)/;
const OLD_PAIR = /\(\s*([^,()]+?)\s*,\s*([^()]+?)\s*\)/g;
const OLD_TRAIL = /(?:\d|\)|π|pi)\s*((?:square|sq\.?|cubic|cu\.?)?\s*[a-zA-Z°][a-zA-Z°.\s]*(?:\^?[23]|[²³])?(?:\s*(?:\/|per)\s*[a-zA-Z]+\.?(?:\^?[23]|[²³])?)?)\s*$/;
const SUPER = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
const SUB = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };

// Whitespace the patterns' `\s` reads beyond the space bar: a marker that
// trimmed with a narrower idea of "space" than `\s` would differ exactly here.
const SPACES = [' ', ' ', ' ', '\t', '\n', '\r', '\u00a0', '\u2028', '\ufeff', '\u3000'];

/**
 * One site: what the original did with a string, what the rewrite does, the
 * alphabet its random strings are drawn from, the tokens every short string of
 * which is tried, its hand-written cases, and its adversarial input.
 */
const SITES = [
  {
    name: 'answer-forms · \\hat, \\vec and name labels on a vector',
    old: (s) => s.replace(OLD_HAT, '$1').replace(OLD_VEC, '').replace(OLD_NAME, ''),
    now: (s) => stripVectorNotation(s),
    alphabet: ['\\hat', '\\hat', '\\vec', '{', '}', 'i', 'j', 'k', 'a', 'r', 'AB', '=', '→', '⃗', '+', '-', '2', ',', '(', ')', '\\', ...SPACES],
    tokens: ['\\hat', '\\vec', '{', '}', 'i', 'a', '=', '→', ' ', '\n'],
    depth: 6,
    cases: ['', ' ', '\\hat', '\\hat{i}', '\\hat { i }', '\\hat{ i', '\\hat i}', '\\hat{i} + 2\\hat{j} - \\hat {k}', '\\hat  x', '\\hat{{i}}',
      '\\vec{a} = (1, 2, 3)', '\\vec a = i + j', '\\vec { a } = \\hat i', '\\vec{a}', '\\vec{a} =', 'a = (1,2,3)', 'AB → = (1,2)', 'r⃗ = i + j',
      'abcd = 1', 'abc=1', 'a  →  =  1', 'a → → = 1', '= 1', 'a → 1', '\\hat\\hat i', '\\vec\\vec{a}=1', 'a = b = c'],
    attack: (n) => [`\\hat${' '.repeat(n)}`, `\\vec${' '.repeat(n)}`, `\\vec{a${' '.repeat(n)}`, `a${' '.repeat(n)}`, `${'\\hat '.repeat(Math.floor(n / 5))}`],
    slow: (n) => `\\hat${' '.repeat(n)}`, slowFrom: 2000
  },
  {
    name: 'checker-core · the trailing currency word (CURRENCY_TAIL)',
    old: (s) => s.replace(OLD_CURRENCY_TAIL, ''),
    now: (s) => stripCurrencyTail(s),
    alphabet: ['rupees', 'rupee', 'paise', 'rs', 'Rs', 'RS', 'RUPEES', 'Paise', '₹', '.', '9', '75', 'a', 's', 'r', 'e', '_', '-', 'ſ', 'K', '$', ...SPACES],
    tokens: ['rupee', 'rs', 's', 'paise', '₹', '.', '9', 'a', ' ', '\n', '_'],
    depth: 5,
    cases: ['', ' ', '9.75 rupees', '9.75 rupee', '9.75rupees', '9.75 Rs', '9.75 Rs.', '9.75 rs. ', '9.75 RS..', '50 paise', '50 paise.', '9.75 ₹', '9.75₹ ', '₹',
      'rs', ' rs ', 'rs.', 'cars', '9 cars', '9 xrs', '9_rs', '9-rs', '9.rs', 'rupees 9', '9 rupees rupees', '9 rs ₹', '9 ₹ rs', '9 ₹.', '9 rupeess', '9 rupe es',
      '9 \u00a0rupees\u2028', '9 ruſees', '9 rupeeſ', 'ſ', '9 paise₹', 'rs rs', '.', ' . ', '9  .rs', '9 rs .'],
    attack: (n) => [`1${' '.repeat(n)}x`, `${' '.repeat(n)}x`, `1${' '.repeat(n)}`, `1${' rs'.repeat(Math.floor(n / 3))}x`, `1${'₹'.repeat(n)}x`],
    slow: (n) => `1${' '.repeat(n)}x`, slowFrom: 2000
  },
  {
    name: 'checker-core · a one-element roster "{5}"',
    old: (s) => { const m = s.match(OLD_ROSTER); return m ? m[1] : null; },
    now: (s) => bracedInner(s),
    alphabet: ['{', '{', '}', '}', '5', '-2', ',', 'x', '=', '.', '\\', ...SPACES],
    tokens: ['{', '}', '5', ',', ' ', '\n', '\ufeff'],
    depth: 7,
    cases: ['', ' ', '{', '}', '{}', '{ }', '{5}', '{ 5 }', '{  5  ,  6  }', '{{5}}', '{5}}', '{{5}', '{5} ', ' {5}', '{5}\n', '{\n5\n}', '{5}{6}', '}{', '{ { } }', '5', '{ 5', '5 }',
      '{\u00a05\u3000}', '{\ufeff}', '{5 6}', '{ , }'],
    attack: (n) => [`{${' '.repeat(n)}`, `{{${' '.repeat(n)}`, `{${' '.repeat(n)}x`, `{${' '.repeat(n)}}x`, `{${' x'.repeat(Math.floor(n / 2))}`],
    slow: (n) => `{${' '.repeat(n)}x`, slowFrom: 300
  },
  {
    name: 'checker-core · a solution set in braces "{10, 12}"',
    old: (s) => { const m = s.match(OLD_BRACED); return m ? m[1] : null; },
    now: (s) => bracedInner(s, { nested: true }),
    alphabet: ['{', '{', '}', '}', '10', '-2', ',', 'x', '=', 'or', '.', '\\', ...SPACES],
    tokens: ['{', '}', '5', ',', ' ', '\n', '\ufeff'],
    depth: 7,
    cases: ['', ' ', '{', '}', '{}', '{ }', '{10, 12}', '{ 10 , 12 }', '{{5}}', '{5}}', '{{5}', '{5} ', ' {5}', '{5}\n', '{\n5\n}', '{5}{6}', '}{', '{ { } }', '{ } }', '{ }  }', '{a} }',
      '{\u00a05\u3000}', '{\ufeff}', '{ 1, {2} }', '{}}'],
    attack: (n) => [`{${' '.repeat(n)}`, `{{${' '.repeat(n)}`, `{${' '.repeat(n)}x`, `{${'}'.repeat(n)}x`, `{${' }'.repeat(Math.floor(n / 2))}x`],
    slow: (n) => `{${' '.repeat(n)}x`, slowFrom: 300
  },
  {
    name: 'expr · ⁵C₂ written with super- and subscripts',
    old: (s) => s.replace(OLD_COUNTING, (_, n, f, r) =>
      `${f === 'C' ? 'ncr' : 'npr'}(${[...n].map(ch => SUPER[ch]).join('')};${[...r].map(ch => SUB[ch]).join('')})`),
    now: (s) => rewriteSuperscriptCounting(s),
    alphabet: ['⁵', '²', '¹⁰', '⁰', 'C', 'C', 'P', 'P', '₂', '₃', '₁₀', 'c', 'x', '5', '2', '+', '(', ')', '$1', '$&', ...SPACES],
    tokens: ['⁵', '²', 'C', 'P', '₂', '₃', ' ', '\n', 'x'],
    depth: 6,
    cases: ['', ' ', '⁵C₂', '⁵ C ₂', '⁵P₂', '¹⁰C₃', '⁵C', 'C₂', '⁵₂', '⁵c₂', '⁵CP₂', '⁵C₂ + ⁴P₁', '⁵C₂⁴P₁', '⁵⁵C₂₂', '⁵ ⁵C₂', '⁵C ⁵C₂', 'x²C₂', 'x² + C₂', '⁵C₂C₂',
      '⁵\nC\n₂', '²²²', '² ² ²', '⁵C2', '5C₂', '⁵C₂₂₂⁵', '²C₂²C₂'],
    attack: (n) => ['²'.repeat(n), '⁵'.repeat(n), `${'²'.repeat(n)}₂`, `${'²'.repeat(n)}C`, `${'²'.repeat(n)} C x`, `²${' '.repeat(n)}x`, `²C${' '.repeat(n)}x`, '² '.repeat(Math.floor(n / 2))],
    // "²" alone is U+00B2, so a run of it is a one-byte string, in which V8 can
    // see at once that no subscript exists and never starts. One two-byte
    // character anywhere — here the subscript itself — and it reads every suffix.
    slow: (n) => `${'²'.repeat(n)}₂`, slowFrom: 1000
  },
  {
    name: 'reason-v2 · a line split at its relation (parseRelation)',
    // the whole decision parseRelation makes before it hands text to the parser
    old: (s) => {
      const m = s.match(OLD_RELATION);
      if (!m || !m[1].trim() || !m[3].trim()) return null;
      if (OLD_RELATION_AGAIN.test(m[3])) return null;
      return [m[1], m[2], m[3]];
    },
    now: (s) => {
      const m = splitAtRelation(s);
      if (!m || !m.left.trim() || !m.right.trim()) return null;
      if (/[<>]/.test(m.right)) return null;
      return [m.left, m.op, m.right];
    },
    // and the raw captures, with no decision made on them
    oldRaw: (s) => { const m = s.match(OLD_RELATION); return m ? [m[1], m[2], m[3]] : null; },
    nowRaw: (s) => { const m = splitAtRelation(s); return m ? [m.left, m.op, m.right] : null; },
    alphabet: ['<', '<', '>', '>', '=', '=', '<=', '>=', 'x', '2x', '3', '+', '-', '(', ')', 'a', '≤', '!', ...SPACES],
    tokens: ['<', '>', '=', 'x', '3', ' ', '\n', '\u2028'],
    depth: 6,
    cases: ['', ' ', 'x < 3', 'x<=3', 'x >= 3', 'x > 3', '2 < x < 5', '2 < x <= 5', 'x =< 3', 'x => 3', 'x <> 3', 'x >< 3', 'x << 3', 'x <== 3', '< 3', 'x <', '<', '<=', '=',
      'x = 3', 'x <\n3', 'x\n< 3', 'x < 3\n', '\nx < 3', 'x < 3\r', 'x \u2028< 3', 'x < \u20293', ' < ', ' <= ', 'x <= = 3', 'x < =3', '>=<', 'a>=b>c'],
    attack: (n) => [`${'<a'.repeat(Math.floor(n / 2))}\nx`, `<${'<a'.repeat(Math.floor(n / 2))}`, `${'<'.repeat(n)}\nx`, `${'a'.repeat(n)}<\nx`, `${'>='.repeat(Math.floor(n / 2))}\rx`],
    slow: (n) => `${'<a'.repeat(Math.floor(n / 2))}\nx`, slowFrom: 2000
  },
  {
    name: 'reason-v3 · every "(x, y)" on a line (assessPointLine)',
    old: (s) => [...s.matchAll(OLD_PAIR)].map(m => [m[1], m[2]]),
    now: (s) => coordinatePairs(s),
    alphabet: ['(', '(', ')', ')', ',', ',', '2', '-3', 'x', '1/2', 'sqrt', '.', '=', 'so', ...SPACES],
    tokens: ['(', ')', ',', '2', 'x', ' ', '\n'],
    depth: 7,
    cases: ['', ' ', '(2, 3)', '( 2 , 3 )', '(2,3)', '(2, 3, 4)', '(2,,3)', '(,3)', '(2,)', '(,)', '( , )', '(  ,  )', '( ,3)', '(2, )', '(\n,\n)', '((2, 3))', '(2, (3))', '((2), 3)',
      '(2, 3)(4, 5)', '(2, 3), (4, 5)', 'so the point is (2, 3) not (3, 2)', '(2, 3', '2, 3)', '(2 3)', '()', '(a,b,c,d)', '( a b , c d )', '(1,2)(', '(1,(2,3)', '(1,2,(3,4))',
      '(\u00a02\u3000,\ufeff3\u2028)', '(, ,)', '( ,, )', '(a, ,)'],
    attack: (n) => [`(${' '.repeat(n)}`, `( ${' '.repeat(n)}`, `(a,${' '.repeat(n)}`, `(a, ${' '.repeat(n)}`, `(${' '.repeat(n)},${' '.repeat(n)}`, '('.repeat(n), '(a'.repeat(Math.floor(n / 2)), '(a,b'.repeat(Math.floor(n / 4))],
    slow: (n) => `(${' '.repeat(n)}`, slowFrom: 300
  },
  {
    name: 'units · the unit written after an answer (TRAIL)',
    old: (s) => { const m = s.match(OLD_TRAIL); return m ? { index: m.index, unit: m[1] } : null; },
    now: (s) => trailingUnit(s),
    alphabet: ['0', '12', '2', '3', '2', '3', ')', 'π', 'pi', 'pi', 'p', 'i', 'm', 'cm', 's', 'h', 'km', 'per', 'per', 'e', 'r', 'square', 'sq', 'sq.', 'cubic', 'cu', 'cu.', 'units',
      '°', '.', '.', '^', '^', '^2', '^3', '²', '³', '/', '/', 'A', 'x', '-', '(', ',', '4', ...SPACES],
    tokens: ['2', '0', 'm', 'pi', 'per', 'sq', '.', '^', '²', '/', '°', ' ', '\t', ')', '-'],
    depth: 5,
    cases: ['', ' ', '12', '12 m', '12m', '12 m²', '12 m^2', '12 m2', '12 sq m', '12 sq. m', '12 square metres', '12 cubic cm', '12 cu. cm', '12 cu cm', '60 km/h', '60 km / h', '60 km per h',
      '60 km per hour', '60 kmperh', '9.8 m/s²', '9.8 m/s^2', '9.8 m/s2', '9.8 m s^-2', '9.8 m²/s²', '9.8 m^2 per s^2', '9.8 m² per s.²', '9.8 m/s.', '9.8 m/s. ', '9.8 m/ s .', '30°', '30 °', '30 deg',
      '2π cm', '2pi cm', 'pi', 'pi m', '2 pi', '(3) m', '3) m', 'm', ' m', '12 .m', '12 m.', '12 m. ', '12 m .', '12 m  ', '12 m² ', '12 m ²', '12 m^', '12 m^4', '12 m^22', '12 m22', '12 m2 2',
      '12 m/', '12 m/2', '12 m//s', '12 m/s/h', '12 m per', '12 m per ', '12 per', '12 perper', '12 m² perper s', '12 m² per', '12 m² pers', '12 m²/s', '12 m²s', '12 m² s', '2 m 3 cm', '2 m3 cm',
      '12 x 3 m', 'x = 12 m', '12 m, 13 m', '12 pipi', 'pipipi', 'pi pi pi²', 'pi/pi', '2/3', '2^3', '2^3 m', '22', '2 2', '2²', '2 ²', '12 sq', '12 sq.', '12 sq .', '12 cu.', '12 sq2', '12 square',
      '12\tm\n', '12\u00a0m\u3000', '12 m\u2028/\ufeffs', '0A', '0 A ', '0A\t\t^', '12 °C', '12 ° C²', '5 units', '5 square units', '5 units²', '12 m.s', '12 m..', '1 a/b.c', '1 a/b.²', '1 a/b ²',
      '1 a/b^2 ', '1 a/b^2 x', '1 a²/b', '1 a² /b', '1 a² / b³', '1 a²b/c', '1 a^', '1 a^/b', '1 a/^2', '1 a/ ', '1 /b', '1 ²', '1 a²³', '1 a²²', '1 a ^2', '1 a² per b³ ', '1 a² per b³ c'],
    attack: (n) => [`0${' '.repeat(n)}`, `0A${'\t'.repeat(n)}`, `0A${'\t'.repeat(n)}^`, `0A${' '.repeat(n)}-`, `0${' '.repeat(n)}-`, `0A^2${' '.repeat(n)}-`, `0A/${' '.repeat(n)}-`,
      `0A/b${' '.repeat(n)}-`, `${'pi'.repeat(Math.floor(n / 2))}-`, `${'pi'.repeat(Math.floor(n / 2))}^`, `${'pi '.repeat(Math.floor(n / 3))}² per x-`, `${'2'.repeat(n)}`, `${'2 '.repeat(Math.floor(n / 2))}`,
      `${'0A'.repeat(Math.floor(n / 2))}-`, `${'pi'.repeat(Math.floor(n / 2))}² per ${'a'.repeat(n)}-`, `${'2m'.repeat(Math.floor(n / 2))}`, `${'pi per '.repeat(Math.floor(n / 7))}-`, `0${'A.'.repeat(Math.floor(n / 2))}/`],
    slow: (n) => `0A${'\t'.repeat(n)}^`, slowFrom: 300
  }
];

// ── Comparison ───────────────────────────────────────────────────────────────
const show = (v) => JSON.stringify(v);
const same = (a, b) => show(a) === show(b);
function compare(site, input, origin) {
  const before = site.old(input), after = site.now(input);
  ok(same(before, after), `${site.name} [${origin}] ${show(input)} — original ${show(before)}, rewrite ${show(after)}`);
  if (site.oldRaw) {
    const rawBefore = site.oldRaw(input), rawAfter = site.nowRaw(input);
    ok(same(rawBefore, rawAfter), `${site.name} [${origin}, raw] ${show(input)} — original ${show(rawBefore)}, rewrite ${show(rawAfter)}`);
  }
}

// mulberry32 — a fixed seed, so a failure names a string that fails every run
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const counts = {};
const count = (site, kind, n = 1) => { (counts[site.name] ||= { cases: 0, exhaustive: 0, random: 0, generated: 0 })[kind] += n; };

// ── (c) Hand-written edge cases ──────────────────────────────────────────────
for (const site of SITES) {
  for (const input of site.cases) { compare(site, input, 'case'); count(site, 'cases'); }
}

// ── (a′) Every short string of each site's hardest tokens ────────────────────
// Random sampling finds the common disagreements; the rare ones live in exact
// arrangements of two or three tokens, so those are simply all tried.
for (const site of SITES) {
  const walk = (prefix, left) => {
    compare(site, prefix, 'exhaustive'); count(site, 'exhaustive');
    if (left) for (const t of site.tokens) walk(prefix + t, left - 1);
  };
  walk('', site.depth);
}

// ── (a) Seeded random strings ────────────────────────────────────────────────
const RANDOM_PER_SITE = 40000;
SITES.forEach((site, index) => {
  const rand = prng(0x5EED0000 + index);
  for (let i = 0; i < RANDOM_PER_SITE; i++) {
    // short strings are dense in matches; a tail of long ones reaches the
    // interactions between a match and what follows it
    const length = rand() < 0.85 ? Math.floor(rand() * 14) : 14 + Math.floor(rand() * 50);
    let input = '';
    for (let k = 0; k < length; k++) input += site.alphabet[Math.floor(rand() * site.alphabet.length)];
    compare(site, input, 'random'); count(site, 'random');
  }
});

// ── (b) Everything the engine's own generators write ─────────────────────────
// Every string anywhere in a generated question — the keyed answer in each form
// a student would write it, MCQ options, trap values, prompts, hints, worked
// steps — and the same strings dressed the way an answer box receives them.
{
  const loaded = loadAllBanks();
  if (loaded && typeof loaded.then === 'function') await loaded;
}
const corpus = new Set();
function harvest(value, depth = 0) {
  if (value == null || depth > 6) return;
  if (typeof value === 'string') { corpus.add(value); return; }
  if (typeof value === 'number') { corpus.add(String(value)); return; }
  if (Array.isArray(value)) { for (const v of value) harvest(v, depth + 1); return; }
  if (typeof value === 'object') for (const v of Object.values(value)) harvest(v, depth + 1);
}
const SEEDS_PER_CELL = 10;
let generated = 0;
const subtopics = Object.keys(GENERATORS);
for (const st of subtopics) {
  for (let d = 1; d <= 4; d++) {
    for (let i = 0; i < SEEDS_PER_CELL; i++) {
      const seed = (d * 100000 + i * 977 + st.length * 13) >>> 0;   // the selfcheck's own seeds
      let q;
      try { q = generateQuestion(st, d, seed); } catch { continue; }
      generated++;
      harvest(q);
      const a = q.answer || {};
      const shown = answerText(q);
      const forms = [shown, a.canonicalInput, a.expr, ...(a.anyOf || [])];
      if (a.simplestFraction) forms.push(`${a.simplestFraction.n}/${a.simplestFraction.d}`);
      if (Array.isArray(a.values)) forms.push(a.values.join(', '), `{${a.values.join(', ')}}`, `{ ${a.values.join(' , ')} }`, `x = ${a.values.join(' or x = ')}`, `x ∈ {${a.values.join(', ')}}`);
      if (a.x !== undefined && a.y !== undefined) forms.push(`(${a.x}, ${a.y})`, `( ${a.x} , ${a.y} )`, `so the point is (${a.x},${a.y})`);
      if (a.value !== undefined) {
        const v = String(a.value);
        forms.push(v, `{${v}}`, `{ ${v} }`, `x = ${v}`, `${v} rupees`, `${v} Rs.`, `${v} ₹`, `₹${v}`, `x < ${v}`, `x >= ${v}`, `${v} <= x`, `(${v}, ${v})`);
        for (const unit of [q.answerSuffix, 'm', 'cm²', 'm^2', 'sq m', 'km/h', 'm per s', '°', 'units']) if (unit) forms.push(`${v} ${unit}`, `${v}${unit}`);
      }
      for (const f of forms) if (f != null && String(f) !== '') corpus.add(String(f));
    }
  }
}
ok(subtopics.length >= 200, `the generator registry loaded (${subtopics.length} subtopics)`);
ok(generated >= subtopics.length * 4 * SEEDS_PER_CELL * 0.95, `the sweep generated its questions (${generated})`);
ok(corpus.size >= 20000, `the sweep produced a corpus worth comparing (${corpus.size} distinct strings)`);
for (const site of SITES) {
  for (const input of corpus) {
    compare(site, input, 'generated');
    const trimmed = input.trim();
    if (trimmed !== input) compare(site, trimmed, 'generated');
  }
  count(site, 'generated', corpus.size);
}

// ── The same question asked of the public functions ──────────────────────────
// The helpers are compared above; these hold the functions a marker calls to
// what the original lines of those functions computed, on the same corpus.
const oldWrittenUnit = (text) => { const m = String(text ?? '').trim().match(OLD_TRAIL); return m ? canonicalUnit(m[1]) : null; };
const oldWithoutUnit = (text) => {
  const s = String(text ?? '').trim();
  const m = s.match(OLD_TRAIL);
  if (!m || !canonicalUnit(m[1])) return s;
  return s.slice(0, s.length - m[0].length + m[0].indexOf(m[1])).trim();
};
const attempt = (fn) => { try { return { value: fn() }; } catch (error) { return { threw: String(error?.message) }; } };
const unitSite = SITES[7], pointSite = SITES[6];
let publicChecks = 0;
for (const input of [...corpus, ...unitSite.cases, ...pointSite.cases, ...SITES[1].cases, ...SITES[2].cases, ...SITES[5].cases]) {
  publicChecks++;
  ok(oldWrittenUnit(input) === writtenUnit(input), `writtenUnit(${show(input)}) — original ${show(oldWrittenUnit(input))}, now ${show(writtenUnit(input))}`);
  ok(oldWithoutUnit(input) === withoutUnit(input), `withoutUnit(${show(input)}) — original ${show(oldWithoutUnit(input))}, now ${show(withoutUnit(input))}`);
}
ok(publicChecks > 20000, `the public unit readers were compared on the corpus (${publicChecks})`);

// The functions still answer the questions they are for.
ok(same(parseVectorInput('\\hat{i} + 2\\hat { j } - \\hat k').components, [1, 2, -1]), 'parseVectorInput reads \\hat{i} + 2\\hat { j } - \\hat k');
ok(same(parseVectorInput('\\vec{a} = (1, 2, 3)').components, [1, 2, 3]), 'parseVectorInput drops a \\vec{a} = label');
ok(cleanInput('9.75 rupees') === '9.75' && cleanInput('9.75 Rs.') === '9.75' && cleanInput('50 paise') === '50', 'cleanInput strips a trailing currency word');
ok(parseNumericInput('{ 5 }').value === 5, 'parseNumericInput reads a one-element roster');
ok(attempt(() => parseNumericInput('{5, 6}')).threw !== undefined, 'and still refuses a two-element one as a number');
ok(normalize('⁵C₂').includes('ncr(5;2)'), 'normalize reads ⁵C₂');
ok(parseRelation('2x + 1 <= 7')?.op === '<=' && parseRelation('2 < x < 5') === null && parseRelation('x <\n3') === null, 'parseRelation splits one relation and refuses a chain or a broken line');
ok(assessPointLine({ text: 'so the point is ( 2 , 3 )', meta: { x: 2, y: 3 } }).status === 'ok', 'assessPointLine verifies a padded point');
ok(assessPointLine({ text: '(3, 2) then (2, 3)', meta: { x: 2, y: 3 } }).status === 'ok', 'and reads the last pair on the line');
ok(assessPointLine({ text: '(2, 3) then (3, 2)', meta: { x: 2, y: 3 } }).status === 'break', 'so a wrong final point is still a break');
ok(writtenUnit('12 sq. metres') === 'm²' && writtenUnit('60 km per hour') === 'km/h' && withoutUnit('12 metres') === '12', 'the unit readers read what they read before');

// ── Time ─────────────────────────────────────────────────────────────────────
// Best of several runs, so one garbage collection cannot fail the suite.
function best(fn, runs = 5) {
  let least = Infinity;
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    fn();
    least = Math.min(least, performance.now() - t);
  }
  return least;
}

// Each rewrite, on every adversarial shape named in the alerts and its
// neighbours, at the largest answer the server accepts.
const LIMIT = 12000, BUDGET_MS = 50;
const timings = {};
for (const site of SITES) {
  let worst = 0;
  for (const input of site.attack(LIMIT)) {
    const ms = best(() => site.now(input), 3);
    worst = Math.max(worst, ms);
    ok(ms < BUDGET_MS, `${site.name} — the rewrite took ${ms.toFixed(1)} ms on ${show(input.slice(0, 12))}… (${input.length} chars); the budget is ${BUDGET_MS} ms`);
  }
  timings[site.name] = { now: worst };
}

// And the original, to record what was fixed: quadrupling the input must cost
// it far more than four times as long. A linear reader's ratio is about 4, a
// quadratic one's 16, a cubic one's 64; the bar is 7, between the first two,
// and it is a ratio of two of the pattern's own times, so the speed of the
// machine cancels. The sizes are small — at 12,000 characters the cubic sites
// would not finish — and are raised until the smaller run is long enough to
// time.
for (const site of SITES) {
  let n = site.slowFrom, small = 0;
  for (;;) {
    const input = site.slow(n);
    small = best(() => site.old(input), 3);
    if (small >= 2 || n >= site.slowFrom * 16) break;
    n *= 2;
  }
  const big = best(() => site.old(site.slow(n * 4)), 3);
  const fresh = best(() => site.now(site.slow(n * 4)), 3);
  timings[site.name].old = { n, small, big, ratio: big / small, fresh };
  ok(small >= 0.5, `${site.name} — the original took ${small.toFixed(3)} ms at ${n} characters, too little to time: this input no longer shows what was fixed`);
  ok(big / small > 7, `${site.name} — the original was expected to be superlinear: ${small.toFixed(2)} ms at ${n}, ${big.toFixed(2)} ms at ${n * 4} (×${(big / small).toFixed(1)})`);
  ok(fresh < big, `${site.name} — the rewrite (${fresh.toFixed(2)} ms) is faster than the original (${big.toFixed(2)} ms) at ${n * 4} characters`);
}

// ── Report ───────────────────────────────────────────────────────────────────
for (const site of SITES) {
  const c = counts[site.name], t = timings[site.name];
  console.log(`  ${site.name}`);
  console.log(`      compared: ${c.cases} cases · ${c.exhaustive} exhaustive · ${c.random} random · ${c.generated} generated`);
  console.log(`      rewrite at ${LIMIT} chars: ${t.now.toFixed(2)} ms worst · original ${t.old.small.toFixed(2)} ms at ${t.old.n} → ${t.old.big.toFixed(2)} ms at ${t.old.n * 4} (×${t.old.ratio.toFixed(1)}), rewrite ${t.old.fresh.toFixed(3)} ms there`);
}
const failed = failures.count || failures.length;
if (failed) {
  console.error(`\nengine-regex-equivalence: ${failed} FAILED (${pass} passed)`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`\nengine-regex-equivalence: ${pass} checks passed — ${generated} generated questions, ${corpus.size} distinct strings, ${SITES.length} sites.`);
