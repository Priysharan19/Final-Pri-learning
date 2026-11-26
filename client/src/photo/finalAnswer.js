// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the final answer inside a photographed page
//
// A student ends a page of working with a sentence: "least value ⇒ 6.",
// "∴ min value is 6", "x = 6". The final-answer field holds mathematics, not a
// sentence, so the last line was never something to copy into it: the typed
// field's own parser refused "least value => 6." as unreadable, and the student
// was told to rewrite a page that was perfectly clear.
//
// This module proposes the mathematical answer from the lines the student has
// kept, for the PUBLIC answer type of the question on screen. It runs on the
// device, after the page has been read, and it holds no key: it never sees an
// expected answer, a solution or a mark. What it proposes is whatever follows
// the last "=", "⇒", "→", ":" or answer word — and only when that reads as an
// answer of the right kind in the same parser the typed field uses. Two
// different candidates, or none, is not a reason to guess: the field is left
// empty and the student is asked.
//
// Pure: no network, no storage, no DOM.
// ─────────────────────────────────────────────────────────────────────────────
import { cleanInput, parseNumericInput, readAnswerLabel } from '../engine/checker-core.js';
import { normalize, parse } from '../engine/expr.js';
import { parseIntervalInput, parseMatrixInput, parseVectorInput } from '../engine/answer-forms.js';
import { canonicalUnit, withoutUnit } from '../engine/units.js';
import { unboxed, LIST_TYPES } from '../engine/boxes.js';

/** Answer types this module can propose for. A choice or a page of working has no final-answer field. */
export const PROPOSABLE_TYPES = Object.freeze(['numeric', 'expression', 'set', 'point', 'ratio', 'interval', 'matrix', 'vector']);

const ARROWS = ['⇒', '⟹', '=>', '→', '⟶', '->', '↦'];
const INEQUALITIES = ['>=', '<=', '!=', '≥', '≤', '≠', '⩾', '⩽', '≧', '≦', '<', '>'];
// Words a student writes in front of the value. Matched as whole words.
const ANSWER_WORDS = [
  'final answer', 'answer', 'ans', 'conclusion', 'least value', 'greatest value', 'minimum value', 'maximum value',
  'min value', 'max value', 'minimum', 'maximum', 'min', 'max', 'value', 'result', 'solution', 'required',
  'therefore', 'hence', 'thus', 'so', 'is', 'are', 'of', 'equals', 'gives', 'get', 'we get',
  'उत्तर', 'अतः', 'इसलिए', 'न्यूनतम मान', 'अधिकतम मान', 'मान', 'है'
];
// The ones that announce THE answer, wherever on the page they are written.
const STRONG_WORDS = /(^|[^\p{L}])(final\s+answer|answer|ans|conclusion|उत्तर)(?=$|[^\p{L}])/iu;
const LEAD_MARKS = /^(?:[∴∵•·*▪◦➤➔]|⇒|⟹|=>|→|⟶|->|[-–—](?=\s))\s*/u;
const WORD_NAMES = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'cosec', 'csc', 'log', 'ln', 'exp', 'sqrt', 'cbrt', 'abs', 'pi', 'asin', 'acos', 'atan', 'arcsin', 'arccos', 'arctan', 'nCr', 'nPr', 'inf', 'infinity', 'or', 'and']);

const isLetter = ch => /\p{L}/u.test(ch || '');

/**
 * A sentence's punctuation is not mathematics. A final full stop (or danda),
 * comma or semicolon is dropped; a run of dots is kept, because "0.333..."
 * says something. Leading list marks and arrows go too.
 */
export function stripSentence(text) {
  let s = String(text ?? '').replace(/\s+/g, ' ').trim();
  for (;;) {
    const next = s.replace(LEAD_MARKS, '').replace(/^\(?\s*(?:[ivx]{1,4}|\d{1,2}|[a-h])\s*[).]\s+(?=\S)/i, m => (/^\(?\s*\d+\s*\.\s+\d/.test(m + ' ') ? m : ''));
    if (next === s) break;
    s = next.trim();
  }
  for (;;) {
    const next = s.replace(/\s*[,;:।]\s*$/u, '').replace(/(?<![.])\.\s*$/u, '').trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

/** Every relation sign and separator in the line, in order: { at, end, kind }. */
function relations(s) {
  const found = [];
  for (let i = 0; i < s.length;) {
    const hit = [...ARROWS.map(t => [t, 'arrow']), ...INEQUALITIES.map(t => [t, 'inequality'])]
      .find(([token]) => s.startsWith(token, i));
    if (hit) { found.push({ at: i, end: i + hit[0].length, kind: hit[1] }); i += hit[0].length; continue; }
    if (s[i] === '=' || s[i] === '≈') found.push({ at: i, end: i + 1, kind: 'equals' });
    // A colon between digits is a ratio, not a label.
    else if (s[i] === ':' && !(/\d\s*$/.test(s.slice(0, i)) && /^\s*\d/.test(s.slice(i + 1)))) found.push({ at: i, end: i + 1, kind: 'colon' });
    i += 1;
  }
  return found;
}

/** Whole-word occurrences of the answer words: { at, end, kind: 'word' }. */
function answerWords(s) {
  const lower = s.toLowerCase();
  const found = [];
  for (const word of ANSWER_WORDS) {
    for (let from = 0; ;) {
      const at = lower.indexOf(word, from);
      if (at < 0) break;
      const end = at + word.length;
      if (!isLetter(lower[at - 1]) && !isLetter(lower[end])) found.push({ at, end, kind: 'word' });
      from = at + 1;
    }
  }
  return found;
}

/** Runs of letters that are not a function name are words, and words are not an expression. */
function hasProse(s) {
  for (const run of String(s).match(/\p{L}{3,}/gu) || []) if (!WORD_NAMES.has(run) && !WORD_NAMES.has(run.toLowerCase())) return true;
  // "so x = 3", "it is 6": two-letter words are words too, not s·o or i·t.
  return /(^|[^\p{L}])(so|is|if|as|we|to|at|by|an|it|of|on)(?=\s|$)/iu.test(String(s));
}

/** The answer with a unit the marker itself reads off ("12 metres" → "12"). */
function markerUnitOff(text) {
  try { return withoutUnit(String(text ?? '').trim()); } catch { return String(text ?? '').trim(); }
}

/**
 * The number in front of the question's OWN unit, exactly as the question
 * prints it ("-19 °C" for a question whose answer is in °C), or null. Used
 * only where the marker cannot read that unit off by itself: the number alone
 * is then what is proposed, since the field already shows the unit beside it.
 * A different unit is never taken off.
 */
function beforeOwnUnit(text, suffix) {
  const s = String(text ?? '').trim();
  const unit = String(suffix ?? '').trim();
  if (!unit || s.length <= unit.length || !s.toLowerCase().endsWith(unit.toLowerCase())) return null;
  const body = s.slice(0, -unit.length).trim();
  return /[\d)π]$/.test(body) ? body : null;
}


// ── What a page's conclusion looks like on paper ────────────────────────────
// 20 Nov 2026 (owner's photo of a fully correct page: "Conclusion: The maximum velocity is
// [12 m s⁻¹] (boxed), obtained at t = 2." came back "couldn't read your final answer"). Three things
// about a conclusion are layout and spelling, not mathematics, and none of them may make it unreadable:
// a box drawn round the value, a unit written after it in any notation, and a clause that says WHERE
// the value was reached. Everything here is read from the page's own words; no key is ever consulted.

// The reading of a box is shared with the marked page's answer line (engine/boxes.js): one function, so the card and the page agree.
export { unboxed };

// "…, obtained at t = 2", "which occurs when x = 3", "(at t = 2)": where the value was reached, not the value.
const CLAUSE_VERBS = '(?:is|are|was|were|occurs?|occurring|occurred|happens?|obtained|attained|achieved|reached|found|given|seen|realised|realized|got|gained|taking\\s+place|being\\s+reached|attained)';
const TRAILING_CLAUSE = new RegExp(`\\s*[,;(]?\\s*(?:\\b(?:which|that|this|it|and)\\s+)?(?:\\b${CLAUSE_VERBS}\\s+)+(?:at|when|whenever|where|if|for|after|during|by|as|on|in|with)\\b[^]*$`, 'iu');
const TRAILING_PAREN = /\s*\(\s*(?:at|when|where|if|for|occurs|reached|attained)\b[^()]*\)\s*[.,;]?\s*$/iu;
/** The sentence without a trailing "obtained at …" clause — only when a value is still left in front of it. */
export function withoutTrailingClause(text) {
  const s = String(text ?? '');
  for (const re of [TRAILING_PAREN, TRAILING_CLAUSE]) {
    const m = re.exec(s);
    if (m && /\d|π/u.test(s.slice(0, m.index))) return s.slice(0, m.index).trim();
  }
  return s;
}

/** One line as the reader returned it, without the box and the trailing where-clause. */
export function tidyLine(text, type = 'numeric') {
  return withoutTrailingClause(unboxed(text, type));
}

// Units written after a number, in any notation the student's pen used.
const PROSE_AFTER_NUMBER = new Set(['is', 'are', 'was', 'at', 'when', 'where', 'if', 'for', 'and', 'or', 'the', 'of', 'to', 'by', 'in', 'on', 'with', 'as', 'so', 'obtained', 'occurs', 'which', 'that', 'then', 'hence', 'thus', 'therefore', 'when', 'after', 'before', 'during', 'answer', 'ans', 'where', 'since', 'because', 'but', 'from', 'than']);
const SUPERSCRIPTS = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };
const UNIT_TOKENS = /[A-Za-zµμΩ]+|\^\s*[({]?\s*[-−–]?\s*\d+\s*[)}]?|[⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+|[-−–]\s*\d+|[·.*/]/gu;

function exponentOf(token) {
  const sup = token.match(/^([⁻⁺]?)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/u);
  if (sup) return (sup[1] === '⁻' ? -1 : 1) * Number([...sup[2]].map(c => SUPERSCRIPTS[c]).join(''));
  const digits = token.match(/(\d+)/);
  return digits ? (/[-−–]/.test(token) ? -1 : 1) * Number(digits[1]) : null;
}
/** "ms" written for "m s" before a negative power: split a word into two known units when it is none itself. */
function splitCompound(word) {
  if (canonicalUnit(word)) return [word];
  for (let i = 1; i < word.length; i += 1) if (canonicalUnit(word.slice(0, i)) && canonicalUnit(word.slice(i))) return [word.slice(0, i), word.slice(i)];
  return [word];
}
const POWER_SPELLING = { 2: '²', 3: '³' };
const withPower = (name, exp) => (exp === 1 ? name : `${name}${POWER_SPELLING[exp] || `^${exp}`}`);

/**
 * A unit written after a number as the spelling the marker reads ("m s⁻¹", "ms^-1", "m s^{-1}" → "m/s"), or null
 * when what follows the number is not a unit this can set down in one piece.
 */
export function canonicalUnitText(tail) {
  const text = String(tail ?? '').trim();
  if (!text) return null;
  const tokens = text.match(UNIT_TOKENS) || [];
  if (tokens.join('').length !== text.replace(/\s+/g, '').length || tokens.length > 10) return null;
  const top = [], bottom = [];
  let slash = false, last = null;
  for (const token of tokens) {
    if (/^[A-Za-zµμΩ]+$/u.test(token)) {
      if (PROSE_AFTER_NUMBER.has(token.toLowerCase()) || token.length > 12) return null;
      const parts = splitCompound(token);
      parts.forEach(part => { last = { name: part, exp: 1, below: slash }; (slash ? bottom : top).push(last); });
    } else if (token === '/') { slash = true; last = null; }
    else if (/^[·.*]$/.test(token)) { /* separators */ }
    else if (last) { last.exp = exponentOf(token) ?? 1; if (last.exp < 0) { last.exp = -last.exp; last.below = !last.below; } }
    else return null;
  }
  const num = top.filter(u => !u.below).concat(bottom.filter(u => !u.below));
  const den = top.filter(u => u.below).concat(bottom.filter(u => u.below));
  if (!num.length || num.length > 3 || den.length > 2) return null;
  const spell = list => list.map(u => withPower(u.name, u.exp));
  const below = den.length === 0 ? '' : den.length === 1 ? `/${spell(den)[0]}` : `/(${spell(den).join(' ')})`;
  return `${spell(num).join(' ')}${below}`;
}

const NUMBER_THEN_TAIL = /^([-+−–]?\s*(?:\d[\d,]*(?:\.\d+)?|\.\d+)(?:\s*\/\s*\d+)?)\s*([A-Za-zµμΩ][^]*)$/u;

/**
 * The text of a value that reads as an answer of this question's type, or null. A number followed by units in any
 * notation ("12 m s⁻¹", "12 ms^-1", "12 kg m⁻³") is that number with its unit spelt as the marker reads it; a unit that
 * cannot be spelt leaves the bare number. Units never make an answer unreadable.
 */
function readableValue(text, question) {
  const s = String(text ?? '').trim();
  if (!s) return null;
  if (readsAsAnswer(s, question)) return s;
  if ((question?.answerType || 'numeric') !== 'numeric') return null;
  const m = NUMBER_THEN_TAIL.exec(s);
  if (!m) return null;
  const number = m[1].replace(/\s+/g, '');
  const unit = canonicalUnitText(m[2]);
  if (unit && readsAsAnswer(`${number} ${unit}`, question)) return `${number} ${unit}`;
  // A unit the marker does not read (kg m⁻³, N m, J/kg): a rate, a power or short symbols after the number. With no unit
  // in the question's box, or the box's own unit, the number is the answer and the box shows the unit. A DIFFERENT unit
  // is never taken off: that is the student's to check.
  const letters = m[2].match(/[A-Za-zµμΩ]+/gu) || [];
  const unitish = w => !!canonicalUnit(w) || w.length <= 3 || ['per', 'square', 'sq', 'cubic', 'cu'].includes(w.toLowerCase());
  const shape = /^[A-Za-zµμΩ\s·.*/^(){}⁻⁺⁰¹²³⁴⁵⁶⁷⁸⁹0-9−–-]+$/u.test(m[2]) && !/\d[\d\s]*\d/.test(m[2].replace(/\^\s*[({]?-?\d+[)}]?/g, ''));
  if (shape && letters.length && letters.length <= 4 && letters.every(unitish) && !letters.some(w => PROSE_AFTER_NUMBER.has(w.toLowerCase()))) {
    const suffix = String(question?.answerSuffix ?? '').trim();
    const own = !suffix || (unit !== null && canonicalUnitText(suffix) === unit) || suffix.replace(/\s+/g, '').toLowerCase() === m[2].replace(/\s+/g, '').toLowerCase();
    return own && readsAsAnswer(number, question) ? number : null;
  }
  return null;
}

/**
 * Does this text read as an answer of this type, in the typed field's parser?
 * `question` is the PUBLIC question (answerType, answerSuffix); nothing else of
 * it is read.
 */
export function readsAsAnswer(text, question = {}) {
  const type = question?.answerType || 'numeric';
  const s = String(text ?? '').trim();
  if (!s || s.length > 200) return false;
  try {
    switch (type) {
      case 'numeric': {
        // A value written with the question's own unit ("147 cm³/s",
        // "1 square units") is that value: the marker reads the unit off the
        // same way before it parses (checker-core: withoutUnit). Only the
        // PUBLIC suffix is used, and nothing is dropped from what is proposed
        // or sent — the unit stays on the text, so a different unit still
        // meets the marker's own "check the unit".
        const value = question?.answerSuffix ? markerUnitOff(s) : s;
        if (hasProse(cleanInput(value))) return false;
        return Number.isFinite(parseNumericInput(value).value);
      }
      case 'expression': {
        if (hasProse(s) || relations(s).some(r => r.kind !== 'equals')) return false;
        const cleaned = cleanInput(s, { stripUnits: false });
        if (!cleaned) return false;
        const ast = parse(normalize(cleaned));
        return !!ast && ast.t !== 'equation';
      }
      case 'ratio': {
        const m = s.replace(/\bto\b/i, ':').match(/^\s*([^:]+):([^:]+)(?::([^:]+))?\s*$/);
        const parts = m ? [m[1], m[2], m[3]].filter(x => x !== undefined) : s.includes('/') ? s.split('/') : null;
        return !!parts && parts.length >= 2 && parts.every(p => Number.isFinite(parseNumericInput(p).value));
      }
      case 'point': {
        const m = s.replace(/^[A-Za-z]\s*=?\s*(?=\()/, '').match(/^\(\s*([^,()]+)\s*,\s*([^,()]+)\s*\)$/);
        return !!m && [m[1], m[2]].every(p => Number.isFinite(parseNumericInput(p).value));
      }
      case 'set': {
        let inner = s.replace(/^[a-zA-Z]\s*(?:∈|\\in)\s*/, '').replace(/^[A-Za-z]\s*=\s*(?=\{)/, '');
        if (/^(∅|phi|φ|\{\s*\})$/i.test(inner)) return true;
        if (inner.startsWith('{') && inner.endsWith('}')) inner = inner.slice(1, -1);
        const parts = inner.replace(/\bor\b|\band\b|;/gi, ',').split(',').map(p => p.trim()).filter(Boolean);
        return parts.length > 0 && parts.every(p => !hasProse(cleanInput(p)) && Number.isFinite(parseNumericInput(p).value));
      }
      case 'interval': return hasProse(s.replace(/\b(or|and)\b/gi, '')) ? false : !!parseIntervalInput(s, null);
      case 'matrix': return !!parseMatrixInput(s);
      case 'vector': return !!parseVectorInput(s);
      default: return false;
    }
  } catch { return false; }
}

/**
 * Does this line read, exactly as written, in the typed field's parser for
 * this answer type? The Write surface sends such a last line verbatim, as it
 * always has.
 *
 * An equation is never kept whole as an expression answer. No keyed
 * expression answer in the bank contains "=", so a line such as
 * "6x - 6 - 3x + 9 = 3x + 3" or "x^2 - 5x - 14 = (x + 2)(x - 7)" is the
 * student restating what they were asked to simplify or factorise: the answer
 * is what follows the "=", and that is what is proposed.
 */
export function readsAsWritten(text, question = {}) {
  return readsAsAnswer(text, question);
}

// Types whose answer may itself contain a comma, "or" or an inequality sign.

/** Split at top-level "," ";" "or" "and" — never inside brackets. */
function segments(s) {
  const out = [];
  let depth = 0, cur = '';
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if ('([{'.includes(ch)) depth += 1;
    else if (')]}'.includes(ch)) depth = Math.max(0, depth - 1);
    if (depth === 0) {
      if (ch === ',' || ch === ';') { out.push(cur); cur = ''; continue; }
      const word = s.slice(i).match(/^(or|and|तथा|या)(?=[^\p{L}]|$)/iu);
      if (word && !isLetter(s[i - 1])) { out.push(cur); cur = ''; i += word[0].length - 1; continue; }
    }
    cur += ch;
  }
  out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}

// "3 at x = 1", "x = 3 if y = 2", "least value 6 when x = -3": what follows
// the word is WHERE or WHEN, not the answer. It is set aside only when it
// really is a condition (it states a relation of its own).
const CONDITION = /(^|[^\p{L}])(at|when|whenever|where|if|for)(?=[^\p{L}])/iu;
function withoutCondition(s) {
  const m = CONDITION.exec(s);
  if (!m) return s;
  const head = s.slice(0, m.index + m[1].length).trim().replace(/[(\[,]\s*$/, '').trim();
  const tail = s.slice(m.index + m[0].length);
  if (!head || !relations(tail).length) return s;
  // "solving for x: x = 3" — the "for" names what is being solved, and no
  // value stands in front of it: it is not a condition on an answer.
  if (m[2].toLowerCase() === 'for' && !/\d/.test(head)) return s;
  // "x = 3 if y = 2" and "least value = 6 at x = -3" say what the answer is and
  // then where. "2x = 6 if x = 3" does not: the line is a step, and either
  // number could be meant. That one is left for the student.
  const at = head.lastIndexOf('=');
  if (at > 0) {
    const left = head.slice(0, at).trim();
    const named = /^[a-zA-Zθ]['′]?(\s*\(\s*[^()]{1,12}\s*\))?$/.test(left);
    if (!named && !hasProse(left)) return null;
  }
  return head;
}

/** A line that checks or verifies an answer is not the answer ("check: 3 + 1 = 4"). */
const CHECK_LINE = /^\s*[(\[]?\s*(check(ing)?|verify|verification|verified|proof|l\.?h\.?s\.?|r\.?h\.?s\.?|जाँच|सत्यापन)(?=[^\p{L}]|$)/iu;
export const isCheckLine = text => CHECK_LINE.test(String(text ?? ''));

/** The one value a piece of a line states, or null. */
function valueOf(piece, question) {
  const type = question?.answerType || 'numeric';
  const s = withoutCondition(stripSentence(piece));
  if (!s) return null;      // nothing there, or a conditional step too doubtful to cut
  const rel = relations(s);
  const words = answerWords(s);
  // For a list-shaped answer the whole line may be the answer ("x > 3",
  // "(2, -3)", "{1, 2}"); try it before cutting anything off.
  if (LIST_TYPES.has(type) && readsAsAnswer(s, question)) return s;
  const cuts = [...rel.filter(r => LIST_TYPES.has(type) ? r.kind !== 'inequality' : true), ...words].sort((a, b) => a.end - b.end);
  const last = cuts.at(-1);
  if (last) {
    // "x > 3" does not state a value: the last relation is an inequality.
    if (last.kind === 'inequality') return null;
    // "Ans. 6": the stop belongs to the abbreviation, not to the value.
    const tail = stripSentence(s.slice(last.end).replace(/^\s*[.:,]\s+/, ''));
    const said = tail ? readableValue(tail, question) : null;
    if (said) return said;
    const bare = type === 'numeric' ? beforeOwnUnit(tail, question?.answerSuffix) : null;
    if (bare && readsAsAnswer(bare, question)) return bare;
    // "6 is the least value": the value stands in front of the words.
    const firstWord = words.sort((a, b) => a.at - b.at)[0];
    if (firstWord && !rel.length) {
      const head = stripSentence(s.slice(0, firstWord.at));
      const said = head ? readableValue(head, question) : null;
      if (said) return said;
    }
    return null;
  }
  const whole = readableValue(s, question);
  if (whole) return whole;
  const bare = type === 'numeric' ? beforeOwnUnit(s, question?.answerSuffix) : null;
  return bare && readsAsAnswer(bare, question) ? bare : null;
}

/** Two candidate texts that would be marked as the same answer are one candidate. */
function sameCandidate(a, b, question) {
  if (a === b) return true;
  const strip = v => String(v).replace(/\s+/g, '').replace(/[−–]/g, '-').toLowerCase();
  if (strip(a) === strip(b)) return true;
  if ((question?.answerType || 'numeric') !== 'numeric') return false;
  try {
    const x = parseNumericInput(a).value, y = parseNumericInput(b).value;
    return Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y));
  } catch { return false; }
}

function distinct(values, question) {
  const out = [];
  for (const v of values) if (v && !out.some(o => sameCandidate(o, v, question))) out.push(v);
  return out;
}

const NUMBER = { answerType: 'numeric' };

/** A sentence that states a quantity: "The maximum velocity is 12", "Hence the area = 6", "∴ x = 3". */
const CONCLUSION_SENTENCE = /^\s*(?:[∴•*]\s*)?(?:(?:so|hence|thus|therefore|finally|overall)[\s,]+)?(?:the\s+)?[\p{L}][\p{L}\s'’-]{2,40}?\s+(?:is|are|equals?|=)\s+\S/iu;
/** A few marks from a graph or table (axis ticks, a point label, an axis name), not a line of working. */
export function isDiagramFragment(text) {
  const s = String(text ?? '').trim();
  if (!s || s.length > 18) return false;
  if (/[=≈⇒→∴<>]|=>|->|≥|≤/u.test(s)) return false;
  if ((s.match(/\p{L}{3,}/gu) || []).length) return false;
  return true;
}

/**
 * An ordered pair. Written as a pair it is taken as written. Written as its
 * coordinates — "x = 1, y = 0" or "1, 0" — it is proposed as "(1, 0)" only
 * when there are exactly two values and it is clear which is which; anything
 * else is left for the student.
 */
function pointFromLine(s, question) {
  const whole = valueOf(s, question);
  if (whole) return { status: 'proposed', answer: whole };
  let text = withoutCondition(s);
  // "x = 1 or y = 0" offers alternatives, not the two coordinates of a point.
  if (!text || /(^|[^\p{L}])(or|या)(?=[^\p{L}]|$)/iu.test(text)) return { status: 'none' };
  const rel = relations(text).filter(r => r.kind === 'arrow' || r.kind === 'colon');
  const words = answerWords(text);
  const lead = [...rel, ...words].sort((a, b) => a.end - b.end);
  // Drop a lead-in ("so the point is", "∴", "vertex:") but never a coordinate name.
  for (const cut of lead.reverse()) {
    // "Ans. 4, 0": the stop belongs to the abbreviation, not to the first
    // coordinate (the same rule valueOf applies) — never "(. 4, 0)".
    const rest = text.slice(cut.end).replace(/^\s*[.:,]\s+/, '').trim();
    if (segments(rest).length === 2) { text = rest; break; }
  }
  const parts = segments(text);
  if (parts.length !== 2) return { status: 'none' };
  const read = parts.map(part => {
    const m = part.match(/^([a-zA-Z])\s*=\s*(.+)$/);
    const value = stripSentence(m ? m[2] : part);
    // A coordinate is a plain number as written. A piece that starts with a
    // stray stop (". 4") or is a zero-padded group ("000" — the tail of
    // "1, 000", one number written with a separator) is not one.
    if (/^\.\s/.test(value) || /^[-+−]?0\d/.test(value) || /=/.test(value)) return null;
    return readsAsAnswer(value, NUMBER) ? { name: m ? m[1].toLowerCase() : null, value } : null;
  });
  if (read.some(r => !r)) return { status: 'none' };
  const names = read.map(r => r.name);
  let ordered = null;
  // Two bare numbers are a pair only when written as one: "4, 0". "1,234" is
  // one number, and "7 and 9" lists two things that need not be coordinates.
  if (names[0] === null && names[1] === null) {
    if (/\d,\d{3}(?!\d)/.test(text) || /(^|[^\p{L}])(and|तथा)(?=[^\p{L}]|$)/iu.test(text)) return { status: 'none' };
    ordered = read;
  }
  else if (names[0] === 'x' && names[1] === 'y') ordered = read;
  else if (names[0] === 'y' && names[1] === 'x') ordered = [read[1], read[0]];
  if (!ordered) return { status: 'none' };
  const answer = `(${ordered[0].value}, ${ordered[1].value})`;
  return readsAsAnswer(answer, question) ? { status: 'proposed', answer } : { status: 'none' };
}

/**
 * A set of values written one by one — "so x = 1 or x = 2" — is every value,
 * never just the last. Returns null when the line is not that shape (the
 * ordinary rules then apply), and proposes nothing when one of the pieces
 * states no value.
 */
function setFromLine(s, question) {
  const whole = withoutCondition(s);
  if (!whole) return { status: 'none' };
  const parts = segments(whole);
  if (parts.length < 2) return null;
  // Only values of the solved variable belong in the set. "x² = 4, x = 2 or
  // x = -2" states one equation and two roots: the 4 is a step. A piece whose
  // "=" has anything but a bare variable on its left is a step, not a value.
  const kinds = parts.map(part => {
    const at = part.lastIndexOf('=');
    if (at < 0) return { kind: 'value' };
    // What stands immediately before the last "=": in "answer = x = 2" and
    // "= x = 2" that is the variable, not the lead-in.
    const left = part.slice(part.lastIndexOf('=', at - 1) + 1, at);
    const named = /(^|[^\p{L}\p{N}^)\]}²³])([a-zA-Zθ])\s*$/u.exec(left);
    return named && !/[\d^()\[\]{}²³√+*/<>=-]/.test(left.slice(0, named.index + named[1].length)) ? { kind: 'root', name: named[2] } : { kind: 'step' };
  });
  if (kinds.some(k => k.kind === 'step')) {
    const roots = kinds.filter(k => k.kind === 'root');
    const sameVariable = roots.length > 0 && roots.every(k => k.name === roots[0].name);
    // Bare values ("x = 2 or -2") follow the root they are listed with.
    const firstRoot = kinds.findIndex(k => k.kind === 'root');
    // A step AFTER a root ("x = 1 or x - 2 = 0") is an alternative the student
    // has not solved: which values are meant is theirs to say.
    const stepAfterRoot = firstRoot >= 0 && kinds.some((k, i) => k.kind === 'step' && i > firstRoot);
    const kept = sameVariable && !stepAfterRoot ? parts.filter((_, i) => kinds[i].kind === 'root' || (kinds[i].kind === 'value' && i > firstRoot)) : [];
    const solved = kept.map(part => valueOf(part, NUMBER));
    if (kept.length && solved.every(Boolean)) {
      const answer = distinct(solved, NUMBER).join(', ');
      if (readsAsAnswer(answer, question)) return { status: 'proposed', answer };
    }
    // Steps only, or roots of different variables: which numbers are meant is
    // the student's to say.
    const candidates = distinct(parts.map(part => valueOf(part, NUMBER)).filter(Boolean), NUMBER);
    return candidates.length ? { status: 'ambiguous', candidates } : { status: 'none' };
  }
  const values = parts.map(part => valueOf(part, NUMBER));
  if (values.some(v => !v)) {
    // "roots are {1, -2}" and the like are read whole by the ordinary rules.
    return valueOf(s, question) && parts.every(part => !/=/.test(part) || valueOf(part, NUMBER)) ? null : { status: 'none' };
  }
  const answer = distinct(values, NUMBER).join(', ');
  return readsAsAnswer(answer, question) ? { status: 'proposed', answer } : { status: 'none' };
}

// "5h = 125, so h = 25": the step before the connector is a step; what follows "so", "hence", "∴" is what the line concludes.
const CONNECTOR = /[,;]?\s*(?:^|(?<=[\s,;]))(?:so|hence|thus|therefore|∴|which\s+gives|giving|gives)(?=[\s:=⇒→]|$)\s*/giu;
function fromLastConnector(s) {
  let cut = -1, end = 0;
  for (const m of s.matchAll(CONNECTOR)) { if (m.index > 0 || /^[,;]/.test(m[0])) { cut = m.index; end = m.index + m[0].length; } }
  if (cut < 0) return s;
  const rest = s.slice(end).trim();
  return rest && /[\d)π]/u.test(rest) ? rest : s;
}

/**
 * What one line states as an answer.
 *   { status: 'proposed', answer }
 *   { status: 'ambiguous', candidates }   two different values on the line
 *   { status: 'none' }
 */
export function answerFromLine(line, question = {}) {
  const type = question?.answerType || 'numeric';
  if (!PROPOSABLE_TYPES.includes(type)) return { status: 'none' };
  const s = fromLastConnector(stripSentence(tidyLine(line, type)));
  if (!s) return { status: 'none' };
  if (type === 'point') return pointFromLine(s, question);
  if (type === 'set') {
    const listed = setFromLine(s, question);
    if (listed) return listed;
  }
  const whole = valueOf(s, question);
  const parts = LIST_TYPES.has(type) ? [s] : segments(s);
  if (parts.length > 1) {
    // "1,234" and "total = 1,234" are one number, and the typed field's
    // parser says so: the value itself carries the comma.
    if (whole && segments(whole).length > 1) return { status: 'proposed', answer: whole };
    const found = distinct(parts.map(p => valueOf(p, question)), question);
    if (found.length > 1) return { status: 'ambiguous', candidates: found };
    if (found.length === 1) return { status: 'proposed', answer: found[0] };
    return { status: 'none' };
  }
  return whole ? { status: 'proposed', answer: whole } : { status: 'none' };
}

/** Every word of the label is a word of the question or the start of one ("max" for "maximum", "v_max"). */
function abbreviatesTheAsk(label, prompt) {
  const promptWords = (String(prompt ?? '').toLowerCase().match(/\p{L}{3,}/gu) || []);
  const words = (String(label).toLowerCase().match(/\p{L}+/gu) || []).filter(w => w.length >= 2);
  if (!words.length || !promptWords.length) return false;
  return words.every(w => w.length >= 3 && promptWords.some(p => p === w || (p.startsWith(w) && w.length >= 3)));
}

/** Does the label in front of a final line (if any) name what the question asks for? */
function labelNamesTheAsk(text, answer, question) {
  // "Ans: Perimeter = 72", "Answer: b = 50": the announcement is not the label.
  const line = stripSentence(text).replace(/^\s*(?:final\s+answer|answer|ans|उत्तर)\s*[:=-]?\s*/iu, '');
  // The label before the value, however it is joined on: "=", "≈", an arrow,
  // "is" or a colon (a ratio's "2:3" has no letters before it, so is no label).
  // The typed arrows "=>" and "->" are read as the arrow they draw before the
  // match, so no pattern here parses "->" (CodeQL js/bad-tag-filter read the
  // earlier "->" alternative as an HTML comment end).
  const drawn = line.split('=>').join('⇒').split('->').join('→');
  const m = drawn.match(/^\s*([^=≈<>⇒→:]{1,40}?)\s*(?:⇒|→|=(?!=)|≈|:|\s+is\s+)/u);
  if (!m || !/\p{L}/u.test(m[1]) || STRONG_WORDS.test(m[1])) return true;
  const label = m[1].trim();
  const read = readAnswerLabel(question, `${label} = ${answer}`);
  if (read.refuse) return false;
  // Nothing to judge the label against (no asked quantity found): propose as before.
  if (!read.asked) return true;
  // "max = 12" under "Find the maximum velocity": the label is the asked word, shortened as students do.
  if (abbreviatesTheAsk(label, question?.prompt)) return true;
  // A one-letter label is read as the typed field always has; a longer one
  // must have been read off, or it names something else.
  return /^[\p{L}θ]$/u.test(label) || !/[=≈]/.test(String(read.input));
}

/**
 * Propose the final answer from the lines of working the student has kept.
 *
 * `lines` are strings, in page order, excluded lines already left out.
 * `question` is the public question; only `answerType` is needed.
 *
 *   { status: 'proposed', answer, line }         one candidate; `line` is its index
 *   { status: 'ambiguous', candidates }          do not guess; ask the student
 *   { status: 'none' }                           nothing reads as an answer; ask
 *   { status: 'not-applicable' }                 this answer type has no final-answer field
 */
function proposeFromWorking(lines, question = {}) {
  const type = question?.answerType || 'numeric';
  if (!PROPOSABLE_TYPES.includes(type)) return { status: 'not-applicable' };
  const kept = (Array.isArray(lines) ? lines : String(lines ?? '').split('\n'))
    .map((text, index) => ({ text: String(text ?? '').trim(), index }))
    .filter(l => l.text);
  if (!kept.length) return { status: 'none' };

  // A trailing "check: 3 + 1 = 4" verifies the answer; it is not the answer.
  while (kept.length > 1 && isCheckLine(kept.at(-1).text)) kept.pop();
  if (isCheckLine(kept.at(-1).text)) return { status: 'none' };
  // Marks drawn round a graph or a table that follow the conclusion on the sheet ("(2,12)", "0 2 4", "12", "v (m/s)") are
  // not a last line of working. They are set aside when a line before them announces the answer in so many words, or is
  // a sentence that states a quantity ("The maximum velocity is …"): the page's own structure, no key.
  if (['numeric', 'expression'].includes(type)) {
    for (;;) {
      const tail = kept.at(-1);
      if (kept.length < 2 || !isDiagramFragment(tail.text)) break;
      const before = kept.slice(0, -1);
      // A lone number could be the answer itself: it goes only when a line says in so many words that it is not.
      const bare = /^[-+−–]?\s*[\d.,]+$/.test(tail.text.trim());
      const announces = before.some(l => STRONG_WORDS.test(l.text)) || (!bare && before.some(l => CONCLUSION_SENTENCE.test(tidyLine(l.text, type))));
      if (!announces) break;
      kept.pop();
    }
  }
  const last = kept.at(-1);
  const fromLast = answerFromLine(last.text, question);
  // A line that says "answer" or "conclusion" anywhere on the page is a candidate final too.
  const announced = kept.slice(0, -1)
    .filter(l => STRONG_WORDS.test(l.text))
    .map(l => ({ ...l, found: answerFromLine(l.text, question) }))
    .filter(l => l.found.status !== 'none');

  // A lone number under a conclusion sentence may be a mark on a graph or the answer written again: when it differs from what
  // the sentence says, both are offered.
  if (['numeric', 'expression'].includes(type) && isDiagramFragment(last.text) && /^[-+−–]?\s*[\d.,]+$/.test(last.text.trim())) {
    const before = kept.slice(0, -1).reverse().find(l => !isDiagramFragment(l.text));
    if (before && CONCLUSION_SENTENCE.test(tidyLine(before.text, type)) && !announced.some(l => l.index === before.index)) {
      const found = answerFromLine(before.text, question);
      if (found.status !== 'none') announced.push({ ...before, found });
    }
  }
  if (fromLast.status === 'ambiguous') return { status: 'ambiguous', candidates: fromLast.candidates };
  // The label on the final line is judged as the typed field judges it: a line
  // "b = 50" under "Find b²", or "Perimeter = 72" under "Find the area", names
  // something other than what was asked, so nothing is proposed — the student
  // is asked to enter the answer (#670 review: the photo path took whatever
  // followed the last "=" and so accepted what the typed field refused).
  if (type === 'numeric' && fromLast.status === 'proposed' && !labelNamesTheAsk(last.text, fromLast.answer, question)) return { status: 'none' };
  const all = distinct([
    ...(fromLast.status === 'proposed' ? [fromLast.answer] : []),
    ...announced.flatMap(l => (l.found.status === 'proposed' ? [l.found.answer] : l.found.candidates))
  ], question);
  if (all.length > 1) return { status: 'ambiguous', candidates: all };
  if (fromLast.status === 'proposed') return { status: 'proposed', answer: fromLast.answer, line: last.index };
  // Nothing on the last line (a comment, a note in the margin, words under the conclusion): the page's own conclusion
  // sentence a few lines up is the final answer when every line after it states no value.
  if (all.length === 0 && fromLast.status === 'none' && ['numeric', 'expression'].includes(type)) {
    for (let i = kept.length - 2; i >= Math.max(0, kept.length - 8); i -= 1) {
      const found = answerFromLine(kept[i].text, question);
      if (found.status === 'none') continue;
      if (found.status === 'proposed' && CONCLUSION_SENTENCE.test(tidyLine(kept[i].text, type))) return { status: 'proposed', answer: found.answer, line: kept[i].index };
      break;
    }
  }
  if (all.length === 1) {
    const source = announced.find(l => l.found.status === 'proposed');
    return { status: 'proposed', answer: all[0], line: source ? source.index : last.index };
  }
  return { status: 'none' };
}

// ── The asked quantity ───────────────────────────────────────────────────────
// A final answer must not be guessed from a line that does not state what was
// asked. Owner test, 18 Nov 2026: a question asking for a y-coordinate and an
// unfinished page whose last line was "x = 0 or x = −3" arrived with "y = 0" in
// the answer field and a "Not quite". Where the question names the quantity it
// asks for, only lines that state THAT quantity are candidates: "y = 5",
// "y(0) = 0", or a point "(0, 0)" for a y-coordinate. A line that states a
// different variable ("x = 0") is not the answer to a question about y.

/** The single letter the question asks for (answerPrefix first, then the asking words), or null. */
export function askedVariable(question = {}) {
  const prefix = String(question?.answerPrefix ?? '').replace(/\$/g, '').trim().match(/^([A-Za-zθ])\s*=?$/u);
  if (prefix) return prefix[1].toLowerCase();
  const prompt = String(question?.prompt ?? '').replace(/\$/g, ' ');
  const asks = [...prompt.matchAll(/(?:^|[^\p{L}])([xyz])[\s-]*(?:co-?ordinate|value|intercept)s?(?![\p{L}])/giu)]
    .map(m => ({ at: m.index, v: m[1].toLowerCase() }));
  for (const m of prompt.matchAll(/(?:find|calculate|determine|state|work out)\s+(?:the\s+)?(?:value\s+of\s+)?([xyz])(?=[\s.,?]|$)/giu)) asks.push({ at: m.index, v: m[1].toLowerCase() });
  for (const m of prompt.matchAll(/value\s+of\s+([xyz])(?=[\s.,?]|$)/giu)) asks.push({ at: m.index, v: m[1].toLowerCase() });
  if (!asks.length) return null;
  asks.sort((a, b) => a.at - b.at);
  return asks.at(-1).v;
}

const LABEL_OF = /^\s*([^=≈<>⇒→:]{1,40}?)\s*=(?!=)/u;

/** What one piece of a line says about the asked letter: { states, answer } or { other: true } or null (unlabelled). */
function pieceAbout(piece, V) {
  const text = stripSentence(piece);
  const m = text.match(LABEL_OF);
  if (!m) return null;
  const label = m[1].trim().replace(/^(?:so|hence|thus|therefore|∴)\s+/iu, '');
  if (STRONG_WORDS.test(label)) return null;
  const named = label.match(/^([A-Za-zθ])(?:['′]|\s*\([^()]{0,12}\))?$/u);
  if (!named) return null;
  if (named[1].toLowerCase() === V && !/['′]/.test(label)) return { states: true, value: stripSentence(text.slice(m[0].length)) };
  return { other: true };
}

/** A point written on the line, read for the asked coordinate: "smallest: (0, 0)" asks y → 0. */
function coordinateOf(text, V) {
  if (V !== 'x' && V !== 'y') return null;
  const m = String(text).match(/\(\s*([-+−–]?\d+(?:\.\d+)?(?:\/\d+)?)\s*,\s*([-+−–]?\d+(?:\.\d+)?(?:\/\d+)?)\s*\)/);
  if (!m) return null;
  return (V === 'x' ? m[1] : m[2]).replace(/[−–]/g, '-');
}

/** Every line that states the asked letter, with the value it gives. */
function statedLines(kept, V) {
  const out = [];
  for (const l of kept) {
    if (isCheckLine(l.text)) continue;
    const pieces = segments(stripSentence(l.text));
    const about = pieces.map(p => pieceAbout(p, V));
    const hit = about.map((a, i) => (a?.states && a.value ? a.value : null)).filter(Boolean);
    if (hit.length) { out.push({ index: l.index, values: hit }); continue; }
    if (about.some(a => a?.other)) continue;
    const point = coordinateOf(l.text, V);
    if (point !== null) out.push({ index: l.index, values: [point] });
  }
  return out;
}

function proposeFinalAnswerFrom(lines, question = {}) {
  const base = proposeFromWorking(lines, question);
  const V = askedVariable(question);
  const type = question?.answerType || 'numeric';
  if (!V || !['numeric', 'expression'].includes(type)) return base;
  const kept = (Array.isArray(lines) ? lines : String(lines ?? '').split('\n'))
    .map((text, index) => ({ text: String(text ?? '').trim(), index })).filter(l => l.text);
  if (!kept.length) return base;
  const lastLine = kept.at(-1);
  const aboutLast = segments(stripSentence(lastLine.text)).map(p => pieceAbout(p, V));
  const lastIsOther = aboutLast.length > 0 && aboutLast.every(a => a?.other);
  if ((base.status === 'proposed' || base.status === 'ambiguous') && !lastIsOther) return base;
  if (base.status === 'not-applicable') return base;
  // Nothing from the last line, or the last line is about a different letter:
  // only lines that state the asked letter are candidates.
  const stated = statedLines(kept, V);
  const valid = [];
  for (const st of stated) for (const v of st.values) if (readsAsAnswer(v, question)) valid.push({ v, index: st.index });
  const answers = distinct(valid.map(x => x.v), question);
  if (answers.length === 1) return { status: 'proposed', answer: answers[0], line: valid.at(-1).index };
  if (answers.length > 1) return { status: 'ambiguous', candidates: answers };
  return { status: 'none', missing: V };
}

/** The text of a line as the student would be shown it: one line, a sensible length. */
const shown = text => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 140);

/**
 * The line the final answer was looked for on, and the one value on it that reads as an answer (or null). The line is
 * the page's own conclusion when there is one near the end, else the last line of working that is not a mark on a
 * graph. Said to the student so that "couldn't read" is never a blank: they see which line was meant, and one tap
 * confirms the reading. Never chosen with a key.
 */
export function lookedAt(lines, question = {}) {
  const type = question?.answerType || 'numeric';
  const kept = (Array.isArray(lines) ? lines : String(lines ?? '').split('\n'))
    .map((text, index) => ({ text: String(text ?? '').trim(), index })).filter(l => l.text && !isCheckLine(l.text));
  if (!kept.length) return { lineText: '', best: null };
  const numericLike = ['numeric', 'expression'].includes(type);
  const body = numericLike ? kept.filter((l, i) => !(i > 0 && isDiagramFragment(l.text) && /[^\d.,\s−-]/.test(l.text))) : kept;
  const pool = body.length ? body : kept;
  const near = pool.slice(-6);
  const conclusion = [...near].reverse().find(l => STRONG_WORDS.test(l.text) || CONCLUSION_SENTENCE.test(tidyLine(l.text, type)));
  const line = conclusion || pool.at(-1);
  const stripped = stripSentence(tidyLine(line.text, type));
  const tidy = withoutCondition(stripped) || stripped;
  let best = null;
  if (numericLike || type === 'ratio') {
    const starts = [...tidy.matchAll(/(?<![\p{L}\d.^_])(?<!\^\s*[({]?\s*[-−–]?)[-+−–]?\s*(?:\d[\d,]*(?:\.\d+)?|\.\d+)/gu)].map(m => m.index).reverse();
    for (const at of starts) {
      const value = readableValue(tidy.slice(at).trim(), type === 'ratio' ? question : { ...question, answerType: 'numeric' });
      if (value) { best = value; break; }
    }
  } else {
    const cut = tidy.split(/[=⇒→:]|\bis\b/i).pop().trim();
    best = cut && readsAsAnswer(cut, question) ? cut : null;
  }
  return { lineText: shown(line.text), lineIndex: line.index, best };
}

/**
 * A mark someone else put on the page, not the student's working: a teacher's "1/1" or "2 / 2" in the margin, a tick or
 * cross, or a word of praise ("Correct", "Well done"). It is never an answer candidate (a real photo of a marked page
 * came back with "1/1" as the final answer and a correct page got 0/1). A fraction counts only when both numbers are
 * the same or it is written as marks, so "3/4" stays a fraction.
 */
export function isMarginMark(text) {
  const s = String(text ?? '').trim();
  if (!s) return false;
  const frac = s.match(/^[\s(\[]*(\d+)\s*\/\s*(\d+)[\s)\]]*(marks?)?\s*$/i);
  if (frac) return frac[1] === frac[2] || !!frac[3];
  if (/^[\s✓✔✗✘✕✖☑☒×]+$/u.test(s)) return true;
  return /^(?:well done|good(?: work)?|correct|right|excellent|nice(?: work)?|great)(?![\p{L}])/iu.test(s) && !/[=\d]/.test(s) && s.split(/\s+/).length <= 6;
}

/**
 * Which lines are marks on a graph or table (axis ticks, a point label, an axis name) rather than working: short lines
 * with no relation sign, three or more of them on the page. A last line that is a lone number is left (it may be the
 * answer). The page's structure only; nothing about the question or its key.
 */
export function figureLabelIndexes(texts) {
  const list = Array.isArray(texts) ? texts : [];
  const at = list.map((t, i) => (isDiagramFragment(t) && !isMarginMark(t) ? i : -1)).filter(i => i >= 0);
  if (at.length < 3) return new Set();
  const lastBare = list.length - 1;
  return new Set(at.filter(i => !(i === lastBare && /^[-+−–]?\s*[\d.,]+$/.test(String(list[i]).trim()))));
}

export function proposeFinalAnswer(rawLines, question = {}) {
  const lines = (Array.isArray(rawLines) ? rawLines : String(rawLines ?? '').split('\n')).map(l => (isMarginMark(l) ? '' : l));
  const out = proposeFinalAnswerFrom(lines, question);
  if (out.status !== 'none' && out.status !== 'ambiguous') return out;
  const type = question?.answerType || 'numeric';
  if (!PROPOSABLE_TYPES.includes(type)) return out;
  const seen = lookedAt(lines, question);
  // An ambiguous line is offered as its candidates; the line itself is still named.
  return { ...out, lineText: seen.lineText, lineIndex: seen.lineIndex, ...(out.status === 'none' ? { best: seen.best } : {}) };
}

/**
 * A typed or confirmed final answer whose only fault is how its unit is written ("12 m s⁻¹", "12 ms^-1") as the
 * spelling the marker reads ("12 m/s"); anything else — a sentence, a label, a different unit — is returned untouched.
 */
export function spellUnits(text, question = {}) {
  const s = String(text ?? '').trim();
  if ((question?.answerType || 'numeric') !== 'numeric' || !s || readsAsAnswer(s, question) || !NUMBER_THEN_TAIL.test(s)) return text;
  const spelt = readableValue(s, question);
  return spelt && spelt !== s ? spelt : text;
}
