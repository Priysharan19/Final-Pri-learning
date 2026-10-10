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
        if (hasProse(cleanInput(s))) return false;
        return Number.isFinite(parseNumericInput(s).value);
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
      case 'interval': return hasProse(s.replace(/\b(or|and)\b/gi, '')) ? false : !!parseIntervalInput(s, question?.answer?.variable ?? null);
      case 'matrix': return !!parseMatrixInput(s);
      case 'vector': return !!parseVectorInput(s);
      default: return false;
    }
  } catch { return false; }
}

/**
 * Does this line read, exactly as written, in the typed field's parser for
 * this answer type? The Write surface sends such a last line verbatim, as it
 * always has. For an expression answer that includes a whole equation
 * ("2x + 3y = 6"): an equation can BE the answer there.
 */
export function readsAsWritten(text, question = {}) {
  if (readsAsAnswer(text, question)) return true;
  return (question?.answerType || 'numeric') === 'expression' && isEquationAnswer(String(text ?? '').trim());
}

/** A whole equation that is not just a name being given a value ("y = …", "f(x) = …", "dy/dx = …"). */
function isEquationAnswer(s) {
  if (!s || s.length > 200 || hasProse(s) || relations(s).some(r => r.kind !== 'equals')) return false;
  const at = s.lastIndexOf('=');
  if (at <= 0 || s.indexOf('=') !== at) return false;
  const left = s.slice(0, at).trim();
  if (/^[a-zA-Zθ]['′]?(\s*\(\s*[a-zA-Zθ]\s*\))?$/.test(left) || /^d\s*[a-zA-Z]\s*\/\s*d\s*[a-zA-Z]$/.test(left)) return false;
  try { return parse(normalize(cleanInput(s, { stripUnits: false })))?.t === 'equation'; } catch { return false; }
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

/** The one value a piece of a line states, or null. */
function valueOf(piece, question) {
  const type = question?.answerType || 'numeric';
  const s = stripSentence(piece);
  if (!s) return null;
  const rel = relations(s);
  const words = answerWords(s);
  // For a list-shaped answer the whole line may be the answer ("x > 3",
  // "(2, -3)", "{1, 2}"); try it before cutting anything off.
  if (LIST_TYPES.has(type) && readsAsAnswer(s, question)) return s;
  // An expression answer can be a whole equation ("x^2 + y^2 = 25"): its
  // right-hand side alone is not the answer, so nothing is cut off it.
  if (type === 'expression' && isEquationAnswer(s)) return s;
  // "the line is 2x + 3y = 6", "so x^2 + y^2 = 25": what follows the words is
  // a whole equation, and for an expression answer that equation is kept.
  if (type === 'expression') {
    for (const word of [...words].sort((a, b) => b.end - a.end)) {
      const rest = stripSentence(s.slice(word.end));
      if (isEquationAnswer(rest)) return rest;
    }
  }
  const cuts = [...rel.filter(r => LIST_TYPES.has(type) ? r.kind !== 'inequality' : true), ...words].sort((a, b) => a.end - b.end);
  const last = cuts.at(-1);
  if (last) {
    // "x > 3" does not state a value: the last relation is an inequality.
    if (last.kind === 'inequality') return null;
    // "Ans. 6": the stop belongs to the abbreviation, not to the value.
    const tail = stripSentence(s.slice(last.end).replace(/^\s*[.:,]\s+/, ''));
    if (tail && readsAsAnswer(tail, question)) return tail;
    // "6 is the least value": the value stands in front of the words.
    const firstWord = words.sort((a, b) => a.at - b.at)[0];
    if (firstWord && !rel.length) {
      const head = stripSentence(s.slice(0, firstWord.at));
      if (head && readsAsAnswer(head, question)) return head;
    }
    return null;
  }
  return readsAsAnswer(s, question) ? s : null;
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
