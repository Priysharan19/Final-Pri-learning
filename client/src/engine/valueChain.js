// Pri Learning — step verdicts for "value-chain" working.
//
// A question that gives a function and asks for one number from it (the
// maximum of h(t) = 22 + 5 sin(πt/6); h(3); the period) was never step-checked:
// it carries no equation to solve, so the server held no Step Check meta for
// it and every line of working was left unjudged (only the typed final answer
// was marked). The owner wrote
//
//     22 + 5 sin(πt/6)        the function, restated
//     max = 22 + 5            a labelled value
//     = 27                    a continuation
//
// and only the last line, which was the answer, got a tick.
//
// This module judges such lines from the question's own structured data,
// which the generator supplies as `stepcheck`:
//
//   { kind: 'value-chain',
//     fn: { name: 'h', variable: 't', expr: '22+5*sin(pi*t/6)' },
//     quantities: { max: 27, min: 17, amplitude: 5, midline: 22, period: 12 } }
//
// Rules (every one is a proof or an abstention; nothing is guessed):
//   a. A line equivalent to the function's right-hand side, bare or written
//      `h(t) = …`, restates the question: ok with `restates: true` (no credit
//      is implied; the line only repeats what was given).
//   b. `LABEL = value [= value …]` where LABEL is on an explicit English
//      whitelist (max, maximum, min, minimum, amplitude, period, midline) or a
//      function evaluation `h(a)` with a constant `a`. The true quantity is
//      checked against the function by sampling (a quantity that does not
//      agree with the function is not used) and every value on the right must
//      equal it: ok when all do, a break when a value provably does not.
//   c. A line starting with `=` continues the line above: it is compared with
//      that line's last value, and only when that line was itself verified.
//   d. A line that cannot be read, or whose label is not on the whitelist, is
//      a note (`unverified`). It never blocks the lines after it.
//
// A value that equals the true quantity is never marked wrong. A trigonometric
// value written without π (sin 90) might be degrees, so a mismatch there is a
// note, not a break. Nothing here awards a method mark.
import { parse, normalize, evaluate, variablesOf, exprEquivalent } from './expr.js';

export const VALUE_CHAIN = 'value-chain';

const LIMITS = { lines: 12, chars: 160 };
const QUANTITY_WORDS = {
  max: 'max', maximum: 'max', min: 'min', minimum: 'min',
  amplitude: 'amplitude', period: 'period', midline: 'midline'
};
const QUANTITY_NAMES = { max: 'maximum', min: 'minimum', amplitude: 'amplitude', period: 'period', midline: 'midline' };
const TRIG = /\b(sin|cos|tan|sec|cosec|csc|cot)\b/;
const GENERIC_NOTE = 'Not verified: Pri cannot check this line against the question.';

const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

function parseSafe(text) {
  try {
    const ast = parse(normalize(text));
    return ast && ast.t !== 'equation' ? ast : null;
  } catch { return null; }
}
const freeVars = ast => [...variablesOf(ast)].filter(v => v !== 'e');
const constantValue = text => {
  const ast = parseSafe(text);
  if (!ast || freeVars(ast).length) return null;
  let v;
  try { v = evaluate(ast, {}); } catch { return null; }
  return Number.isFinite(v) ? v : null;
};
/** A function name followed by anything but "(" ("sin pi/2") may be read two ways: abstain. */
const ambiguousCall = text => /\b(?:sin|cos|tan|sec|cosec|csc|cot|ln|log|sqrt)\s*(?:\^|[^\s(])/i.test(text);

/** The meta is well formed: a one-variable function and finite quantities. */
export function valueChainMeta(meta) {
  if (meta?.kind !== VALUE_CHAIN || typeof meta.fn?.expr !== 'string') return null;
  const { name, variable, expr } = meta.fn;
  if (!/^[A-Za-z]$/.test(String(name)) || !/^[A-Za-z]$/.test(String(variable)) || name === variable) return null;
  const ast = parseSafe(expr);
  if (!ast || freeVars(ast).some(v => v !== variable)) return null;
  return { name, variable, ast, expr, quantities: meta.quantities && typeof meta.quantities === 'object' ? meta.quantities : {} };
}

/** The value of the function at a constant, or null. */
function fnAt(fn, x) {
  let v;
  try { v = evaluate(fn.ast, { [fn.variable]: x }); } catch { return null; }
  return Number.isFinite(v) ? v : null;
}

/**
 * The quantity, only when the function itself agrees with it: the maximum,
 * minimum, amplitude and midline are checked against a dense sample over three
 * periods; the period must repeat the function and no shorter fraction of it.
 * A quantity the function does not bear out is abstained on.
 */
function trueQuantity(fn, key) {
  const claimed = Number(fn.quantities[key]);
  if (!Number.isFinite(claimed)) return null;
  const P = Number(fn.quantities.period);
  const span = Number.isFinite(P) && P > 0 ? P : 24;
  if (key === 'period') {
    if (!(claimed > 0)) return null;
    const probes = [-3.1, 0.37, 1.9, 4.4, 7.3];
    for (const x of probes) {
      const a = fnAt(fn, x), b = fnAt(fn, x + claimed);
      if (a === null || b === null || !close(a, b)) return null;
    }
    for (let k = 2; k <= 12; k++) {
      if (probes.every(x => { const a = fnAt(fn, x), b = fnAt(fn, x + claimed / k); return a !== null && b !== null && close(a, b); })) return null;
    }
    return claimed;
  }
  let lo = Infinity, hi = -Infinity;
  const N = 6000;
  for (let i = 0; i <= N; i++) {
    const v = fnAt(fn, -span + (3 * span * i) / N);
    if (v === null) return null;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const swing = hi - lo, tol = 1e-3 * Math.max(1, swing);
  const sampled = { max: hi, min: lo, amplitude: swing / 2, midline: (hi + lo) / 2 };
  if (!(key in sampled)) return null;
  return Math.abs(sampled[key] - claimed) <= tol ? claimed : null;
}

function labelOf(raw, fn) {
  const text = String(raw).trim();
  const word = text.toLowerCase().replace(/\s+/g, ' ').replace(/ value$/, '');
  if (Object.hasOwn(QUANTITY_WORDS, word)) return { type: 'quantity', key: QUANTITY_WORDS[word] };
  const call = text.match(/^([A-Za-z])\s*\(\s*(.+)\s*\)$/);
  if (call && call[1] === fn.name) {
    const arg = call[2].trim();
    if (arg === fn.variable) return { type: 'definition' };
    const x = constantValue(arg);
    if (x !== null && !ambiguousCall(arg)) return { type: 'evaluation', x };
  }
  return null;
}

const shown = v => String(Math.round(v * 1e6) / 1e6);

/** Check working line by line. Returns the same report shape as stepCheck. */
export function stepCheckValueChain(meta, workingText) {
  const fn = valueChainMeta(meta);
  const raw = String(workingText || '').split('\n').map(l => l.trim()).filter(Boolean);
  const out = [];
  let firstBreak = -1;
  let diagnosis = null;
  let prev = null; // the last verified line's value: { value } for a number, { ast } for a function
  const note = (text, why, extra = {}) => { out.push({ text, status: 'note', note: why, unverified: true, ...extra }); prev = null; };

  raw.forEach((line, i) => {
    if (!fn) return note(line, GENERIC_NOTE);
    if (i >= LIMITS.lines || line.length > LIMITS.chars) return note(line, 'Not verified: this line is too long or too far down the working to check.');
    if (firstBreak !== -1) return note(line, 'Follows from the earlier slip.');
    const text = line.replace(/^∴\s*/, '').replace(/^(so|hence|then|therefore|thus)\s+/i, '').replace(/[−–—]/g, '-');
    if (/[<>≤≥≠≈]|==|!=/.test(text)) return note(line, GENERIC_NOTE);
    if (ambiguousCall(text)) return note(line, 'Not verified: write the function’s argument in brackets, like sin(π/2).');
    const parts = text.split('=').map(p => p.trim());
    const unreadable = () => note(line, 'This line could not be read as maths, so it is not checked.', { unreadable: true });

    // c. continuation: "= value"
    if (parts[0] === '' && parts.length >= 2) {
      const values = parts.slice(1);
      if (values.some(v => !v)) return unreadable();
      const asts = values.map(parseSafe);
      if (asts.some(a => !a)) return unreadable();
      if (!prev) return note(line, 'Not verified: the line above was not verified, so this line has nothing to be checked against.');
      if (prev.value !== undefined) {
        const nums = asts.map(a => (freeVars(a).length ? null : evaluate(a, {})));
        if (nums.some(v => v === null || !Number.isFinite(v))) return note(line, GENERIC_NOTE);
        if (nums.every(v => close(v, prev.value))) { out.push({ text: line, status: 'ok', valueChain: { rule: 'continuation' } }); return; }
        if (nums.some(v => !close(v, prev.value)) && !asts.some((a, k) => TRIG.test(values[k]) && !/pi|π/.test(values[k]))) return breakLine(line, i, `The line above comes to ${shown(prev.value)}, but this line gives ${shown(nums.find(v => !close(v, prev.value)))}.`, 'chain-not-equal');
        return note(line, GENERIC_NOTE);
      }
      // After a restated function the continuation is judged only when it is the same function.
      if (asts.every(a => !freeVars(a).some(v => v !== fn.variable)) && values.every((v, k) => exprEquivalent(asts[k], prev.ast) === true)) {
        out.push({ text: line, status: 'ok', valueChain: { rule: 'continuation' } }); return;
      }
      return note(line, GENERIC_NOTE);
    }

    // a. a bare expression: the function, restated
    if (parts.length === 1) {
      const ast = parseSafe(text);
      if (!ast) return unreadable();
      if (restatesFn(fn, ast)) { prev = { ast }; out.push({ text: line, status: 'ok', restates: true, note: 'Restates the function from the question.', valueChain: { rule: 'restated' } }); return; }
      return note(line, GENERIC_NOTE);
    }

    // b. LABEL = value [= value …]
    const label = labelOf(parts[0], fn);
    const rest = parts.slice(1);
    if (rest.some(v => !v)) return unreadable();
    const asts = rest.map(parseSafe);
    if (asts.some(a => !a)) return unreadable();
    if (!label) return note(line, 'Not verified: Pri does not check lines with this label.');

    if (label.type === 'definition') {
      if (asts.every(a => restatesFn(fn, a))) { prev = { ast: asts[0] }; out.push({ text: line, status: 'ok', restates: true, note: 'Restates the function from the question.', valueChain: { rule: 'restated' } }); return; }
      return note(line, 'Not verified: this does not match the function in the question, as it was read.');
    }
    let truth, name;
    if (label.type === 'quantity') {
      truth = trueQuantity(fn, label.key);
      name = QUANTITY_NAMES[label.key];
    } else {
      truth = fnAt(fn, label.x);
      name = `${fn.name}(${shown(label.x)})`;
    }
    if (truth === null) return note(line, GENERIC_NOTE);
    const nums = asts.map(a => (freeVars(a).length ? null : evaluate(a, {})));
    if (nums.some(v => v === null || !Number.isFinite(v))) return note(line, GENERIC_NOTE);
    if (nums.every(v => close(v, truth))) { prev = { value: truth }; out.push({ text: line, status: 'ok', valueChain: { rule: label.type, quantity: label.key || null } }); return; }
    // A decimal that is the true value to the places written is a rounded true value: not provably wrong.
    const roundedOf = (text, v) => { const m = String(text).trim().match(/^-?\d*\.(\d+)$/); return !!m && Math.abs(v - truth) <= 10 ** -m[1].length; };
    if (rest.every((v, k) => close(nums[k], truth) || roundedOf(v, nums[k]))) return note(line, 'Not verified: this agrees with the true value only to the decimals written, so it is not ticked as exact.');
    // A trigonometric value without π might be in degrees: that is not provably wrong.
    const maybeDegrees = rest.some((v, k) => !close(nums[k], truth) && TRIG.test(v) && !/pi|π/i.test(v));
    if (maybeDegrees) return note(line, 'Not verified: Pri cannot tell whether the angle is in radians or degrees.');
    const wrong = nums.find(v => !close(v, truth));
    breakLine(line, i, `This comes to ${shown(wrong)}, which is not the ${name}.`, 'value-not-true');
  });

  function breakLine(line, i, message, code) {
    diagnosis = { code, title: 'This value is not the quantity it is labelled as', message, fix: 'Recompute this value from the function in the question.', confidence: 'high' };
    firstBreak = i;
    out.push({ text: line, status: 'break', note: message, diagnosis });
    prev = null;
  }
  return { lines: out, firstBreak, diagnosis, source: 'value-chain' };
}

/** The expression is the function's right-hand side: the same variable only, and equivalent. */
function restatesFn(fn, ast) {
  const vars = freeVars(ast);
  if (!vars.length || vars.some(v => v !== fn.variable)) return false;
  try { return exprEquivalent(ast, fn.ast) === true && exprEquivalent(ast, fn.ast, { samples: 14 }) === true; } catch { return false; }
}
