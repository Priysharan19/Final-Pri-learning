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
  if ([...variablesOf(ast)].length) return null;            // any letter at all, π and e included: not arithmetic on numbers alone
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
function infoOf(side) {
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
function sameAsWritten(a, b) {
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
  let prev = null;   // { text, value } or { text, ast, vars }: the last side of the line above, when it could be read

  const note = (text, why, extra = {}) => { out.push({ text, status: 'note', note: why, unverified: true, ...extra }); };

  raw.forEach((line, i) => {
    const carried = prev;
    const before = carried && carried.value !== undefined && !carried.calculus ? carried : null;   // plain arithmetic only
    prev = null;
    if (i >= LIMITS.lines || line.length > LIMITS.chars) return note(line, 'Not checked: this line is too long or too far down the working to check.');
    if (firstBreak !== -1) return note(line, 'Follows from the earlier slip.');
    const text0 = line.replace(/\s*\.\s*$/, '').replace(/[−–—]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/^∴\s*/, '').replace(/^(so|hence|then|therefore|thus)\s+/i, '')
      // `Ans = 72` continues the line above; `6 x 12` between two numbers is a times sign; square brackets group.
      .replace(ANS_LABEL, '').replace(/(\d|\))\s+x\s+(?=\d|\()/gi, '$1*')
      .replace(/\[([^\[\],;_]*)\](?![_^])/g, '($1)');
    const ansLine = ANS_LABEL.test(line.replace(/^∴\s*/, '').replace(/^(so|hence|then|therefore|thus)\s+/i, ''));
    // A root with an index, √[3]{…}, is not read: its bracket is not a grouping.
    if (/(?:√|sqrt)\s*\[/i.test(line)) return note(line, NOTE);
    const calc = /∫|\]_/.test(text0) ? workOutCalculus(text0) : { text: text0, used: false };
    if (!calc) return note(line, NOT_PROVED);
    const text = calc.text;
    // Independent review, round 1. None of these is arithmetic Pri can read one way only, so none is judged:
    //   a line label or a trailing equation number (`1. 2+3 = 5`, `(2) 2+3 = 5`, `2 + 3 = 5 (2)`), which would be multiplied in;
    //   a comma (two statements on a line, or a decimal comma); a line that starts with an operator and so carries the
    //   line above forward (`- 1 = 2`); a spaced dot (`3 . 4`).
    if (/^\(?\d{1,3}[.)](?:\s|$)|^\(\d{1,3}\)|\s\(\d{1,3}\)\s*$|[,;:]|^[+*/×÷]|^-\s|\d\s+\.\s*\d|\d\s*\.\s+\d/.test(line.replace(/[−–—]/g, '-'))) return note(line, NOTE);
    // A mixed number (2 1/2) or a spaced thousand (1 000) reads as a product: two numbers side by side are not judged.
    if (/[<>≤≥≠%°]|==|!=|\d\s+\d/.test(text)) return note(line, NOTE);
    // Any letter left (a variable, π, e, a unit, a function name) and the line is not arithmetic on numbers alone.
    // nCr and nPr between two numbers, and sqrt, are arithmetic.
    if (calc.used || /[A-Za-zπθ]/.test(text.replace(/sqrt/gi, '').replace(/(\d)\s*[CP]\s*(?=\d)/g, '$1'))) {
      // True as written, or a note: never a cross (see "Lines that are true as written").
      if (/≈|≃|~/.test(text)) return note(line, NOT_PROVED);
      const bits = text.split('=').map(s => s.trim());
      const cont = bits[0] === '' && bits.length >= 2;
      const written = cont ? bits.slice(1) : bits;
      if (written.some(s => !s)) return note(line, UNREAD, { unreadable: true });
      // A last side of plain numbers carries to the `=` line below (tick only) even when the line itself is not read.
      { const tail = valueOf(written[written.length - 1]); if (tail !== null) prev = { text: written[written.length - 1], value: tail, calculus: true }; }
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
      if (written.some(s => /[\/÷]/.test(s) && /[\/÷].*(?:\*|[\d)!]\s*\(|\)\s*\d|!\s*\d)/.test(s))) return note(line, NOT_PROVED);
      const infos = written.map(infoOf);
      const lastInfo = infos[infos.length - 1];
      // What a line of letters or an integral leaves for the `=` line below is tick only (`calculus`): `t = 5` then `= 20`
      // is the student carrying on something else, not a claim that 5 is 20 (found by the labelled audit).
      if (lastInfo) prev = { text: written[written.length - 1], ...lastInfo, calculus: true };
      if (infos.some(x => !x)) return note(line, NOT_PROVED);
      const all = cont && carried ? [carried, ...infos] : infos;
      if (all.length < 2 || !all.every(x => sameAsWritten(x, all[0]))) return note(line, NOT_PROVED);
      const number = all.find(x => x.value !== undefined);
      const why = calc.used ? (number ? `Worked out, each side comes to ${shown(number.value)}.` : 'Worked out at the limits, the sides agree.')
        : number ? `This is ${shown(number.value)} for every value of the letters.`
          : cont && carried ? 'This is the line above, written another way.' : 'Both sides are the same expression, written two ways.';
      out.push({ text: line, status: 'ok', state: 'arithmetic', note: why, valueChain: { rule: 'true-as-written' } });
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
    const soft = approx || allSides.some(s => /\d\.\d|^\.\d|[^\d]\.\d/.test(s) || FUNCTION_WORDS.test(s));
    if (allValues.every(v => close(v, allValues[0]))) {
      const why = continuation && before ? `This equals the line above: ${shown(allValues[0])}.` : `Both sides come to ${shown(allValues[0])}.`;
      out.push({ text: line, status: 'ok', state: 'arithmetic', note: why, valueChain: { rule: 'arithmetic' } });
      return;
    }
    if (soft) return note(line, SOFT_NOTE);
    if (ansLine) return note(line, NOTE);
    // Two bare numbers and nothing else (`500 = 340`) is words lost in reading, not a sum someone got wrong.
    if (allSides.every(x => /^\s*-?\d+(?:\.\d+)?\s*$/.test(x)) && !(continuation && before)) return note(line, NOTE);
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
