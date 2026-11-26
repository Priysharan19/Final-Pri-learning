// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Pri Learning · the fourth page-proof pass: a value stated with no relation to check
// (27 November 2026, Prithagoras edition; owner rule: nothing "not checked" on a correct page, and never a wrong line ticked or neutralised)
//
// A worked page is full of lines that are only a value, or a short list of values, with no `=` and nothing to compare: the sides of a triangle written out
// (`4, 3, 5`), the number a table needs (`12`), the value of the line above carried over (`24.4` under `(122/5)`). Such a line is neither true nor false on
// its own, so the older passes leave it a note ("not checked"), which on a correct page is the wrong thing to say.
//
// Two things are said here, each only when it can be proved or when nothing the engine can compute says otherwise:
//   equal-to-line-above   the line is one number and the line above is a letter-free expression (or ends on one) that comes to that very number, exact to
//                         1e-12 (a rounded value is not equal): a TICK, the continuation the line above begins
//   stated-value          the line is a number, a number with a unit or degree sign, a letter-free expression, or a short list of those, and nothing here
//                         contradicts it: NEUTRAL (context), never a tick and never a mark. The page says "A value stated without working".
// It is WITHHELD (the line stays a note) whenever a later reading could make the line wrong:
//   · the line above is a letter-free expression not yet worked out and this single number is not its value (a wrong continuation looks exactly like this);
//   · the line is the last line of the page, a single number, and the question's own numeric key (when it has one) is a different number: the last number
//     is then the answer given, and the answer check, not this pass, decides it;
//   · the line is a labelled value (`d = 4`), a point (`(3, 0)`), a relation, a word sentence: never read here.
// Nothing here reads the worked solution, the hints or the traps. Nothing is ever crossed. Display only: no mark reads these lines. Pure, deterministic.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
import { valueOfSide } from './pageProofs3.js';
import { clean, lead } from './pageProofs.js';

export const CLASS4 = Object.freeze({ stated: 'stated-value', equal: 'equal-to-line-above' });
export const NEUTRAL4 = Object.freeze(new Set([CLASS4.stated]));

const MAX_CHARS = 120;
const same = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b));
const UNIT = /\s*(?:%|cm²|cm³|m²|m³|cm|mm|km|kg|mL|ml|L|m|g|s|min|h|units?|°C|\$)$/;
const PLAIN_NUMBER = /^-?\d+(?:\.\d+)?$/;

/** { v, plain } for one item that is a number, a number with a unit, or a letter-free expression; null for anything else. `plain` = a bare number (already worked out). */
function itemValue(raw) {
  let t = String(raw ?? '').trim().replace(/[.;]+$/, '').trim();
  if (!t || t.length > MAX_CHARS) return null;
  if (/[=<>≤≥≠≈≃~:;±⇒⟹→∫|{}\\]|=>|->|\bor\b|\band\b/i.test(t)) return null;
  t = t.replace(/^\$\s*/, '').replace(/(?<=\d),(?=\d{3}(?!\d))/g, '');
  // a unit after one number (12 cm, 40%) is stated with the value; units are not read as maths
  const u = UNIT.exec(t);
  if (u && u.index > 0 && /\d$/.test(t.slice(0, u.index).trim()) && PLAIN_NUMBER.test(t.slice(0, u.index).trim())) return { v: Number(t.slice(0, u.index).trim()), plain: true, unit: u[0].trim() };
  if (PLAIN_NUMBER.test(t)) return { v: Number(t), plain: true, unit: null };
  // an angle in degrees is a value already worked out (it is stated, not computed)
  const deg = /^(-?\d+(?:\.\d+)?)\s*°$/.exec(t);
  if (deg) return { v: Number(deg[1]), plain: true, unit: '°' };
  // a count (6C4, (8C3)) is two numbers round a C; the C is not a letter of the maths
  const counted = t.replace(/(?<=\d)\s*C\s*(?=\d)/g, '*');
  if (/[A-Za-z]/.test(counted.replace(/\b(?:sqrt|pi|sin|cos|tan|sec|cosec|csc|cot|ln|log|exp|arcsin|arccos|arctan)\b|π|√/g, ''))) return null;
  if (!/\d/.test(t) && !/^(?:π|pi)$/.test(t)) return null;
  const r = valueOfSide(t);
  return r ? { v: r.v, plain: false, unit: null } : null;
}

/** The items of a line that is only values: [{ v, plain, unit }, ...] (one item for a single value), or null. */
export function valuesOf(text) {
  const t = lead(String(text ?? '')).replace(/[.]+$/, '').trim();
  if (!t || t.length > MAX_CHARS) return null;
  // a coordinate pair or any bracketed group of values is a point, a vector or an interval: another kind of line
  if (/^[(\[]\s*[^()\[\]]*,\s*[^()\[\]]*[)\]]$/.test(t)) return null;
  const pieces = [];
  let depth = 0, cur = '';
  for (const c of t) {
    if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth--;
    if (depth === 0 && c === ',') { pieces.push(cur); cur = ''; continue; }
    cur += c;
  }
  pieces.push(cur);
  // a thousands comma (`115,170`) is one number, not a list
  if (pieces.length === 2 && /^\s*\d{1,3}\s*$/.test(pieces[0]) && /^\d{3}(?:\.\d+)?\s*$/.test(pieces[1])) return [itemValue(`${pieces[0].trim()}${pieces[1].trim()}`)].filter(Boolean).length ? [itemValue(`${pieces[0].trim()}${pieces[1].trim()}`)] : null;
  if (pieces.length > 12 || pieces.some(p => !p.trim())) return null;
  // `±2` and `170±16` are two values stated at once
  const expand = p => {
    const m = /^(.*?)±(.*)$/.exec(p.trim());
    if (!m || /±/.test(m[2])) return [p];
    const a = m[1].trim(), b = m[2].trim();
    return a ? [`${a}+${b}`, `${a}-${b}`] : [b, `-${b}`];
  };
  const items = pieces.flatMap(expand).map(itemValue);
  return items.some(x => x === null) ? null : items;
}

/** What the line above stands for as a value still to be worked out: { v, open } where `open` is true when it ends on an expression that is not a bare number. null when it is no such line. */
export function aboveValue(text) {
  const t = lead(String(text ?? '')).replace(/[.]+$/, '').trim();
  if (!t || t.length > MAX_CHARS * 2 || /[<>≤≥≠≈≃~:;±⇒⟹→∫,]|=>|->/.test(t)) return null;
  const sides = t.split('=').map(s => s.trim());
  if (sides.some(s => !s)) return null;
  const last = sides[sides.length - 1];
  const x = itemValue(last);
  if (!x) return null;
  // a chain that ends on a bare number is worked out; a line that is just an expression, or a chain ending on one, is not
  return { v: x.v, open: !x.plain };
}

const note4 = (kind, v) => (kind === 'equal'
  ? `Correct: this is the value of the line above, ${fmt(v)}, carried on.`
  : 'This is a value stated with no working and no relation to check, so Pri does not mark it right or wrong.');
const fmt = v => String(Number(v.toPrecision(12)));

/**
 * @param q      the question (only its numeric key is read, to withhold the last line)
 * @param lines  the report's lines, in order
 * @param limit  lines at or after this index are never touched (the first cross)
 * @param open   (l, i) => may this line take a new tick? Notes only.
 */
export function pageProofs4(q, lines, limit, open) {
  const out = lines.slice();
  let n = 0;
  const stop = Math.min(limit, lines.length);
  const key = q && q.answerType === 'numeric' && Number.isFinite(q.answer?.value) ? q.answer.value : null;
  const tol = Number.isFinite(q?.answer?.tol) ? q.answer.tol : 0;
  const lastIdx = (() => { for (let k = lines.length - 1; k >= 0; k--) { const t = String(lines[k]?.text ?? '').trim(); if (t) return k; } return -1; })();
  for (let i = 0; i < stop; i++) {
    const l = lines[i];
    if (!l || l.status !== 'note' || !open(l, i) || l.unread || l.unreadable || l.context === true) continue;
    const items = valuesOf(l.text);
    if (!items) continue;
    // the line above, if it is a letter-free expression or a chain: what a bare value under it would be continuing
    const prev = i > 0 ? aboveValue(lines[i - 1]?.text) : null;
    const single = items.length === 1 ? items[0] : null;
    if (single && prev && prev.open && !single.unit) {
      if (same(prev.v, single.v)) { out[i] = { text: l.text, status: 'ok', state: 'arithmetic', note: note4('equal', single.v), valueChain: { rule: 'proved' }, fact: { kind: 'proved', proof: CLASS4.equal }, tickClass: CLASS4.equal }; n++; }
      continue;   // a different number under an expression not yet worked out is what a wrong continuation looks like: left a note
    }
    // the last number on the page, against the question's own numeric key
    if (single && i === lastIdx && key !== null && !single.unit && Math.abs(single.v - key) > Math.max(1e-9, tol)) continue;
    out[i] = { text: l.text, status: 'note', state: 'unverified', unverified: true, context: true, note: note4('stated'), tickClass: CLASS4.stated };
    n++;
  }
  return { lines: n ? out : lines, n };
}
