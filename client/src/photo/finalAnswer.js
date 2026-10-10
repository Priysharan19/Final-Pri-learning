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
import { cleanInput, parseNumericInput } from '../engine/checker-core.js';
import { normalize, parse } from '../engine/expr.js';
import { parseIntervalInput, parseMatrixInput, parseVectorInput } from '../engine/answer-forms.js';
import { withoutUnit } from '../engine/units.js';

/** Answer types this module can propose for. A choice or a page of working has no final-answer field. */
export const PROPOSABLE_TYPES = Object.freeze(['numeric', 'expression', 'set', 'point', 'ratio', 'interval', 'matrix', 'vector']);

const ARROWS = ['⇒', '⟹', '=>', '→', '⟶', '->', '↦'];
const INEQUALITIES = ['>=', '<=', '!=', '≥', '≤', '≠', '⩾', '⩽', '≧', '≦', '<', '>'];
// Words a student writes in front of the value. Matched as whole words.
const ANSWER_WORDS = [
  'final answer', 'answer', 'ans', 'least value', 'greatest value', 'minimum value', 'maximum value',
  'min value', 'max value', 'minimum', 'maximum', 'min', 'max', 'value', 'result', 'solution', 'required',
  'therefore', 'hence', 'thus', 'so', 'is', 'are', 'equals', 'gives', 'get', 'we get',
  'उत्तर', 'अतः', 'इसलिए', 'न्यूनतम मान', 'अधिकतम मान', 'मान', 'है'
];
// The ones that announce THE answer, wherever on the page they are written.
const STRONG_WORDS = /(^|[^\p{L}])(final\s+answer|answer|ans|उत्तर)(?=$|[^\p{L}])/iu;
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
const LIST_TYPES = new Set(['set', 'point', 'interval', 'matrix', 'vector']);

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
  const head = s.slice(0, m.index + m[1].length).trim();
  const tail = s.slice(m.index + m[0].length);
  return head && relations(tail).length ? head.replace(/[(\[,]\s*$/, '').trim() : s;
}

/** A line that checks or verifies an answer is not the answer ("check: 3 + 1 = 4"). */
const CHECK_LINE = /^\s*[(\[]?\s*(check(ing)?|verify|verification|verified|proof|l\.?h\.?s\.?|r\.?h\.?s\.?|जाँच|सत्यापन)(?=[^\p{L}]|$)/iu;
export const isCheckLine = text => CHECK_LINE.test(String(text ?? ''));

/** The one value a piece of a line states, or null. */
function valueOf(piece, question) {
  const type = question?.answerType || 'numeric';
  const s = withoutCondition(stripSentence(piece));
  if (!s) return null;
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
    if (tail && readsAsAnswer(tail, question)) return tail;
    const bare = type === 'numeric' ? beforeOwnUnit(tail, question?.answerSuffix) : null;
    if (bare && readsAsAnswer(bare, question)) return bare;
    // "6 is the least value": the value stands in front of the words.
    const firstWord = words.sort((a, b) => a.at - b.at)[0];
    if (firstWord && !rel.length) {
      const head = stripSentence(s.slice(0, firstWord.at));
      if (head && readsAsAnswer(head, question)) return head;
    }
    return null;
  }
  if (readsAsAnswer(s, question)) return s;
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
  const rel = relations(text).filter(r => r.kind === 'arrow' || r.kind === 'colon');
  const words = answerWords(text);
  const lead = [...rel, ...words].sort((a, b) => a.end - b.end);
  // Drop a lead-in ("so the point is", "∴", "vertex:") but never a coordinate name.
  for (const cut of lead.reverse()) {
    const rest = text.slice(cut.end).trim();
    if (segments(rest).length === 2) { text = rest; break; }
  }
  const parts = segments(text);
  if (parts.length !== 2) return { status: 'none' };
  const read = parts.map(part => {
    const m = part.match(/^([a-zA-Z])\s*=\s*(.+)$/);
    const value = stripSentence(m ? m[2] : part);
    return readsAsAnswer(value, NUMBER) ? { name: m ? m[1].toLowerCase() : null, value } : null;
  });
  if (read.some(r => !r)) return { status: 'none' };
  const names = read.map(r => r.name);
  let ordered = null;
  if (names[0] === null && names[1] === null) ordered = read;
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
  const parts = segments(withoutCondition(s));
  if (parts.length < 2) return null;
  const values = parts.map(part => valueOf(part, NUMBER));
  if (values.some(v => !v)) {
    // "roots are {1, -2}" and the like are read whole by the ordinary rules.
    return valueOf(s, question) && parts.every(part => !/=/.test(part) || valueOf(part, NUMBER)) ? null : { status: 'none' };
  }
  const answer = distinct(values, NUMBER).join(', ');
  return readsAsAnswer(answer, question) ? { status: 'proposed', answer } : { status: 'none' };
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
  const s = stripSentence(line);
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
export function proposeFinalAnswer(lines, question = {}) {
  const type = question?.answerType || 'numeric';
  if (!PROPOSABLE_TYPES.includes(type)) return { status: 'not-applicable' };
  const kept = (Array.isArray(lines) ? lines : String(lines ?? '').split('\n'))
    .map((text, index) => ({ text: String(text ?? '').trim(), index }))
    .filter(l => l.text);
  if (!kept.length) return { status: 'none' };

  // A trailing "check: 3 + 1 = 4" verifies the answer; it is not the answer.
  while (kept.length > 1 && isCheckLine(kept.at(-1).text)) kept.pop();
  if (isCheckLine(kept.at(-1).text)) return { status: 'none' };
  const last = kept.at(-1);
  const fromLast = answerFromLine(last.text, question);
  // A line that says "answer" anywhere on the page is a candidate final too.
  const announced = kept.slice(0, -1)
    .filter(l => STRONG_WORDS.test(l.text))
    .map(l => ({ ...l, found: answerFromLine(l.text, question) }))
    .filter(l => l.found.status !== 'none');

  if (fromLast.status === 'ambiguous') return { status: 'ambiguous', candidates: fromLast.candidates };
  const all = distinct([
    ...(fromLast.status === 'proposed' ? [fromLast.answer] : []),
    ...announced.flatMap(l => (l.found.status === 'proposed' ? [l.found.answer] : l.found.candidates))
  ], question);
  if (all.length > 1) return { status: 'ambiguous', candidates: all };
  if (fromLast.status === 'proposed') return { status: 'proposed', answer: fromLast.answer, line: last.index };
  if (all.length === 1) {
    const source = announced.find(l => l.found.status === 'proposed');
    return { status: 'proposed', answer: all[0], line: source ? source.index : last.index };
  }
  return { status: 'none' };
}
