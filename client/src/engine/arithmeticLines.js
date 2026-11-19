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
import { parse, normalize, evaluate, variablesOf } from './expr.js';

const LIMITS = { lines: 20, chars: 160 };
const NOTE = 'Not checked: this line has no arithmetic Pri can check on its own.';
const UNREAD = 'This line could not be read as maths, so it is not checked.';
const SOFT_NOTE = 'Not checked: this line may use a rounded value, so it is not marked.';
const MISREAD_NOTE = 'Not checked: this line may have been misread, so it is not marked.';
const FUNCTION_WORDS = /\b(?:sin|cos|tan|sec|cosec|csc|cot|ln|log|asin|acos|atan|arcsin|arccos|arctan)\b/i;

const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const shown = v => { const r = Math.round(v * 1e6) / 1e6; return String(Object.is(r, -0) ? 0 : r).replace(/-/g, '−'); };

/** The value of one side when it is plain arithmetic on numbers; null otherwise. */
function valueOf(side) {
  let ast;
  try { ast = parse(normalize(side)); } catch { return null; }
  if (!ast || ast.t === 'equation') return null;
  if ([...variablesOf(ast)].length) return null;            // any letter at all, π and e included: not arithmetic on numbers alone
  let v;
  try { v = evaluate(ast, {}); } catch { return null; }
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

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

export function stepCheckArithmetic(workingText) {
  const raw = String(workingText || '').split('\n').map(l => l.trim()).filter(Boolean);
  const out = [];
  let firstBreak = -1;
  let diagnosis = null;
  let prev = null;   // { value, text } the last side of the line above, when it was plain arithmetic

  const note = (text, why, extra = {}) => { out.push({ text, status: 'note', note: why, unverified: true, ...extra }); };

  raw.forEach((line, i) => {
    const before = prev;
    prev = null;
    if (i >= LIMITS.lines || line.length > LIMITS.chars) return note(line, 'Not checked: this line is too long or too far down the working to check.');
    if (firstBreak !== -1) return note(line, 'Follows from the earlier slip.');
    const text = line.replace(/[−–—]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/^∴\s*/, '').replace(/^(so|hence|then|therefore|thus)\s+/i, '')
      // `Ans = 72` continues the line above; `6 x 12` between two numbers is a times sign; square brackets group.
      .replace(/^(?:ans|answer)\.?\s*(?==)/i, '').replace(/(\d|\))\s+x\s+(?=\d|\()/gi, '$1*')
      .replace(/\[([^\[\],;_]*)\](?![_^])/g, '($1)');
    // Independent review, round 1. None of these is arithmetic Pri can read one way only, so none is judged:
    //   a line label or a trailing equation number (`1. 2+3 = 5`, `(2) 2+3 = 5`, `2 + 3 = 5 (2)`), which would be multiplied in;
    //   a comma (two statements on a line, or a decimal comma); a line that starts with an operator and so carries the
    //   line above forward (`- 1 = 2`); a spaced dot (`3 . 4`).
    if (/^\(?\d{1,3}[.)](?:\s|$)|^\(\d{1,3}\)|\s\(\d{1,3}\)\s*$|[,;:]|^[+*/×÷]|^-\s|\d\s+\.\s*\d|\d\s*\.\s+\d/.test(line.replace(/[−–—]/g, '-'))) return note(line, NOTE);
    // A mixed number (2 1/2) or a spaced thousand (1 000) reads as a product: two numbers side by side are not judged.
    if (/[<>≤≥≠%°]|==|!=|\d\s+\d/.test(text)) return note(line, NOTE);
    // Any letter left (a variable, π, e, a unit, a function name) and the line is not arithmetic on numbers alone.
    // nCr and nPr between two numbers, and sqrt, are arithmetic.
    if (/[A-Za-zπθ]/.test(text.replace(/sqrt/gi, '').replace(/(\d)\s*[CP]\s*(?=\d)/g, '$1'))) return note(line, NOTE);
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
    const allSides = continuation && before ? [before.text, ...sides] : sides;
    const allValues = continuation && before ? [before.value, ...values] : values;
    if (allSides.length < 2) return note(line, continuation ? 'Not checked: the line above is not arithmetic Pri can check, so this line has nothing to be compared with.' : NOTE);

    // A division followed by a product (6/2(1+2), 10!/3!7!, 5·4·3/3·2·1) is read two ways by convention: not judged.
    if (allSides.some(s => /[\/÷]/.test(s) && /[\/÷].*(?:\*|[\d)!]\s*\(|\)\s*\d|!\s*\d)/.test(s))) return note(line, NOTE);
    const soft = approx || allSides.some(s => /\d\.\d|^\.\d|[^\d]\.\d/.test(s) || FUNCTION_WORDS.test(s));
    if (allValues.every(v => close(v, allValues[0]))) {
      out.push({ text: line, status: 'ok', state: 'arithmetic', valueChain: { rule: 'arithmetic' } });
      return;
    }
    if (soft) return note(line, SOFT_NOTE);
    if (trueUnderAnotherReading(allSides, allValues)) return note(line, MISREAD_NOTE);
    const k = allValues.findIndex(v => !close(v, allValues[0]));
    const message = continuation && before && k >= 1 && allValues.slice(1, k).every(v => close(v, allValues[0]))
      ? `The line above comes to ${shown(allValues[0])}, but this line gives ${shown(allValues[k])}.`
      : `${allSides[0].trim()} comes to ${shown(allValues[0])}, but this line gives ${shown(allValues[k])}.`;
    diagnosis = { code: 'arithmetic-not-equal', title: 'The two sides of this line are not equal', message, fix: 'Work this line out again, one operation at a time.', confidence: 'high' };
    firstBreak = i;
    out.push({ text: line, status: 'break', note: message, diagnosis });
    prev = null;
  });

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
