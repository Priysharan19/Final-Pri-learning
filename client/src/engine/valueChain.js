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
import { assignSpan } from './commentTex.js';
import { falseStepFacts, readPoly, crossDiagnosis, readingIsAmbiguous } from './falseStep.js';

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

/** A brace pair holding no comma or semicolon groups like a bracket (`6x{x + 3}`); a set `{1, 2}`, an interval and a coordinate pair are left as they are. */
export const groupBraces = t => { let s = String(t); for (let k = 0; k < 4 && /\{[^{},;]*\}/.test(s); k++) s = s.replace(/(?<!\^)\{([^{},;]*)\}/g, '($1)'); return s; };

function parseSafe(text) {
  try {
    const ast = parse(normalize(groupBraces(text)));
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
  const out = { name, variable, ast, expr, quantities: meta.quantities && typeof meta.quantities === 'object' ? meta.quantities : {} };
  // A curve with its derivative and stationary points (the stationary-points family). Each claim is
  // checked against the function before it is trusted, so a bad meta abstains rather than ticks.
  const c = meta.curve;
  if (c && typeof c.derivative === 'string' && Array.isArray(c.stationary) && c.stationary.length) {
    const dast = parseSafe(c.derivative);
    if (dast && !freeVars(dast).some(v => v !== variable)) {
      const num = (f, x) => { try { return evaluate(f, { [variable]: x }); } catch { return NaN; } };
      const h = 1e-5;
      const derivativeOk = [-2.3, -0.7, 0.4, 1.9, 3.3].every(x => { const d = (num(ast, x + h) - num(ast, x - h)) / (2 * h); return Math.abs(d - num(dast, x)) <= 1e-4 * Math.max(1, Math.abs(d)); });
      const stationary = c.stationary.map(Number);
      if (derivativeOk && stationary.every(x => Number.isFinite(x) && Math.abs(num(dast, x)) < 1e-9)) {
        out.curve = { dast, derivative: c.derivative, stationary: [...new Set(stationary)].sort((a, b) => a - b), choose: c.choose === 'smaller' || c.choose === 'larger' ? c.choose : null };
      }
    }
  }
  return out;
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
  if (fn.curve && text === fn.name) return { type: 'definition' };
  const call = text.match(/^([A-Za-z])\s*\(\s*(.+)\s*\)$/);
  if (call && call[1] === fn.name) {
    const arg = call[2].trim();
    if (arg === fn.variable) return { type: 'definition' };
    const x = constantValue(arg);
    if (x !== null && !ambiguousCall(arg)) return { type: 'evaluation', x };
  }
  return null;
}

const shownPlain = v => String(Math.round(v * 1e6) / 1e6);
// A value in a comment is a `$…$` span the client typesets.
const shown = v => `$${shownPlain(v)}$`;

/** Check working line by line. Returns the same report shape as stepCheck. */
/**
 * Does the question restrict the domain (an interval, an inequality, "between", a stated domain)? The max / min / amplitude /
 * midline claims are checked against the function over the whole line, so on a restricted domain a true restricted maximum would
 * be crossed: the check cannot know it, so it abstains. Anything that looks like a restriction counts; over-abstaining is safe.
 */
export function domainRestricted(meta, prompt) {
  if (meta && (meta.domain || meta.interval || meta.restricted || meta.fn?.domain || meta.fn?.interval)) return true;
  // A half-line lower bound ("for t ≥ 0", "t > 0") leaves a periodic function every value it takes, so it is not a restriction.
  const text = String(prompt || '').replace(/[A-Za-z]\s*(?:≥|>|\\ge(?:q)?\b|\\gt\b)\s*-?\d+(?:\.\d+)?(?![\d.]*\s*(?:≤|<|\\le|\\lt))/gi, ' ');
  return /\b(?:first|next|last|initial)\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|hour|minute|second|day|week|month|year)\b|\b(?:over|for|in|during|within|until|up to)\s+(?:the\s+)?(?:first|next|last|initial)\b|\b(?:for|from|over)\s+\$?(?:[a-z]\s*=\s*)?-?\d+(?:\.\d+)?\s*(?:to|-|–)\s*-?\d|\b[a-z]\$?\s*(?:in|∈)\s*\$?\s*[\[(]|[a-z]\s*=\s*-?\d+(?:\.\d+)?\s*[,;]\s*-?\d|\bat\s+(?:the\s+)?times?\b|\bonly\b|[≤≥<>]|\\(?:le|leq|ge|geq|lt|gt)\b|\bdomain\b|\binterval\b|\bbetween\b|\brestrict|\\in\s*[\[(]|\bfrom\s+\$?(?:[a-z]\s*=\s*)?-?\d[^.?]*\bto\s+\$?(?:[a-z]\s*=\s*)?-?\d|\bfirst\s+\d|\bduring\b|\bwithin\b|\buntil\b/i.test(text);
}

export function stepCheckValueChain(meta, workingText, options = null) {
  const restricted = domainRestricted(meta, options?.prompt);
  const fn = valueChainMeta(meta);
  const raw = String(workingText || '').split('\n').map(l => l.trim()).filter(Boolean);
  const out = [];
  let firstBreak = -1;
  let diagnosis = null;
  const eqState = { at: -2, side: null };   // the last line that was the stationary equation: where, and its side that is not 0
  let prev = null; // the last verified line's value: { value } for a number, { ast } for a function
  const note = (text, why, extra = {}) => { out.push({ text, status: 'note', note: why, unverified: true, ...extra }); prev = null; };

  raw.forEach((line, i) => {
    if (!fn) return note(line, GENERIC_NOTE);
    if (i >= LIMITS.lines || line.length > LIMITS.chars) return note(line, 'Not verified: this line is too long or too far down the working to check.');
    if (firstBreak !== -1) return note(line, 'Follows from the earlier slip.');
    const text = groupBraces(line).replace(/[′’]/g, "'").replace(/^∴\s*/, '').replace(/^(so|hence|then|therefore|thus)\s+/i, '').replace(/[−–—]/g, '-');
    if (/[<>≤≥≠≈]|==|!=/.test(text)) return note(line, GENERIC_NOTE);
    if (ambiguousCall(text)) return note(line, 'Not verified: write the function’s argument in brackets, like sin(π/2).');
    const curveRule = fn.curve ? curveLine(fn, text, line, eqState, i) : null;
    if (curveRule) {
      if (curveRule.status === 'break') return breakLine(line, i, curveRule.note, curveRule.code, curveRule.diagnosis);
      out.push({ text: line, ...curveRule }); prev = curveRule.status === 'ok' ? prev : null; return;
    }
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
      // Safe by default: the max / min / amplitude / midline are the function's global values, so they are held to the line only when
      // the question is positively known to be unrestricted (the generator's meta says fullDomain) and its prompt shows no restriction.
      if ((restricted || meta.fullDomain !== true) && label.key !== 'period') return note(line, 'Not verified: Pri cannot tell that this question covers every value of the function, and the maximum or minimum on part of it can differ, so this line is not marked.');
      truth = trueQuantity(fn, label.key);
      name = QUANTITY_NAMES[label.key];
    } else {
      truth = fnAt(fn, label.x);
      name = `$${fn.name}(${shownPlain(label.x)})$`;
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

  function breakLine(line, i, message, code, given) {
    diagnosis = given || { code, title: 'This value is not the quantity it is labelled as', message, fix: 'Recompute this value from the function in the question.', confidence: 'high' };
    firstBreak = i;
    out.push({ text: line, status: 'break', note: message, diagnosis });
    prev = null;
  }
  // One state per line, and ONE reason for the unverified ones, so a caller never has to repeat it.
  const state = l => l.state || (l.status === 'ok' ? (l.restates ? 'given' : 'verified') : l.status === 'break' ? 'wrong' : l.unreadable ? 'unread' : 'unverified');
  const lines = out.map(l => ({ ...l, state: state(l) }));
  const at = st => lines.flatMap((l, k) => (l.state === st ? [k + 1] : []));
  const unverified = at('unverified'), unread = at('unread');
  const summary = {
    total: lines.length,
    checked: lines.filter(l => l.status === 'ok').length,
    given: at('given'), verified: at('verified'), conditions: at('condition'), wrong: at('wrong'), unverified, unread,
    reason: unverified.length ? 'Pri could not tie these lines to anything it can prove about this question, so it did not mark them.' : null
  };
  return { lines, firstBreak, diagnosis, source: 'value-chain', summary };
}


const STATIONARY_CONDITION = /(?:^|[\s(])(?:y'|dy\/dx|f'\(x\)|derivative)\s*(?:=|is|equals)\s*0\b/i;
const ORDER_WORDS = { smaller: 'smaller', smallest: 'smaller', lower: 'smaller', lowest: 'smaller', least: 'smaller', larger: 'larger', largest: 'larger', bigger: 'larger', greater: 'larger', greatest: 'larger', higher: 'larger', highest: 'larger' };
const sameNum = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/**
 * Lines about a curve with stationary points. Returns null when none of these rules is about the
 * line (the general rules then apply), else { status, note?, state, code? }.
 */
function curveLine(fn, text, original, eqState = null, lineIndex = -1) {
  const { curve, variable, name } = fn;
  const num = (ast, x) => { try { return evaluate(ast, { [variable]: x }); } catch { return NaN; } };
  const at = x => num(fn.ast, x);
  const fmt = v => shownPlain(v);   // the number inside a `$…$` span
  const compact = text.replace(/\s+/g, '');
  // A stated condition (prose or a bare "y' = 0"): accepted as what it says, never "not verified".
  if (STATIONARY_CONDITION.test(text) && !text.replace(STATIONARY_CONDITION, '').includes('=')) {
    return { status: 'note', state: 'condition', note: 'A stated condition: stationary points are where the derivative is 0.' };
  }
  // y' = …, dy/dx = …
  const label = compact.split('=')[0];
  if ((label === `${name}'` || label === `d${name}/d${variable}` || label === `${name}'(${variable})`) && compact.includes('=')) {
    const rhs = text.split('=').slice(1).map(x => x.trim());
    const asts = rhs.map(parseSafe);
    if (asts.some(a => !a || freeVars(a).some(v => v !== variable))) return null;
    if (asts.every(a => exprEquivalent(a, curve.dast) === true)) return { status: 'ok', state: 'verified', valueChain: { rule: 'derivative' } };
    // `y' = 6x^2 - 6x - 12 = 0`: the derivative, set to 0 to find the stationary points. The chain ends at the condition; what comes before it is the derivative.
    if (asts.length >= 2 && constantValue(rhs[rhs.length - 1]) === 0 && asts.slice(0, -1).every(a => exprEquivalent(a, curve.dast) === true)) return { status: 'ok', state: 'verified', valueChain: { rule: 'derivative' } };
    return { status: 'break', code: 'derivative-not-true', note: `This is not the derivative of the curve ${assignSpan(name, fn.expr.replace(/\*/g, ''))}.` };
  }
  // A choice between the stationary points: "smaller: (0,0)", "smaller x = -3"
  const choice = text.match(/^(smaller|smallest|lower|lowest|least|larger|largest|bigger|greater|greatest|higher|highest)(?:\s+x(?:\s*-?\s*(?:value|coordinate))?)?\s*[:=-]?\s*(.+)$/i);
  if (choice) {
    const which = ORDER_WORDS[choice[1].toLowerCase()];
    const body = choice[2].trim().replace(/^x\s*=\s*/i, '');
    const pt = body.match(/^\(\s*([^,()]+?)\s*,\s*([^()]+?)\s*\)$/);
    const a = constantValue(pt ? pt[1] : body);
    const b = pt ? constantValue(pt[2]) : null;
    if (a === null || (pt && b === null)) return null;
    if (pt && Math.abs(b - at(a)) > 1e-9 * Math.max(1, Math.abs(b))) return { status: 'break', code: 'point-not-on-curve', note: `The point $(${fmt(a)},\\ ${fmt(b)})$ is not on the curve.` };
    if (!curve.stationary.some(x => sameNum(x, a))) return { status: 'break', code: 'not-stationary', note: `$x = ${fmt(a)}$ is not a stationary point.` };
    const target = which === 'smaller' ? curve.stationary[0] : curve.stationary[curve.stationary.length - 1];
    if (!sameNum(target, a)) {
      const other = which === 'smaller' ? 'smaller' : 'larger';
      return { status: 'break', code: 'wrong-stationary-point', note: `$x = ${fmt(target)}$ is ${other} than $x = ${fmt(a)}$, so use $x = ${fmt(target)}$: $${name}(${fmt(target)}) = ${fmt(at(target))}$.` };
    }
    return { status: 'ok', state: 'verified', valueChain: { rule: 'choice' } };
  }
  // x = 0 or x = -3  /  x = 0, x = -3 : the solutions of y' = 0
  const pieces = text.split(/\bor\b|\band\b|[,;]/i).map(x => x.trim()).filter(Boolean);
  if (pieces.length >= 1 && pieces.every(pc => new RegExp(`^(?:${variable}\\s*=\\s*)?[-+]?[0-9.]+(?:/[0-9.]+)?$|^(?:${variable}\\s*=\\s*)?\\(?-?[0-9./ ]+\\)?$`).test(pc)) && pieces.some(pc => pc.startsWith(variable))) {
    const vals = pieces.map(pc => constantValue(pc.replace(new RegExp(`^${variable}\\s*=\\s*`), '')));
    if (vals.every(v => v !== null)) {
      const extra = vals.find(v => !curve.stationary.some(x => sameNum(x, v)));
      if (pieces.length > 1) {
        if (extra !== undefined) return { status: 'break', code: 'extra-stationary-value', note: `$${variable} = ${fmt(extra)}$ does not make the derivative 0.` };
        const complete = curve.stationary.every(x => vals.some(v => sameNum(x, v)));
        return complete ? { status: 'ok', state: 'verified', valueChain: { rule: 'stationary-values' } } : { status: 'note', state: 'unverified', note: 'True, but the derivative is 0 at more values than these.' };
      }
      if (extra === undefined) return { status: 'ok', state: 'verified', valueChain: { rule: 'stationary-values' } };
      return null;
    }
  }
  // An equation that is the stationary condition in another form: A = B with A - B a constant multiple of y'.
  const sides = text.split('=');
  if (sides.length === 2) {
    const A = parseSafe(sides[0]), B = parseSafe(sides[1]);
    if (A && B && !freeVars(A).some(v => v !== variable) && !freeVars(B).some(v => v !== variable) && (freeVars(A).length || freeVars(B).length)) {
      const g = x => num(A, x) - num(B, x);
      const ratios = [-3.1, -1.7, 0.6, 1.3, 2.9, 4.1].map(x => { const d = num(curve.dast, x); return Math.abs(d) < 1e-6 ? NaN : g(x) / d; });
      const zeroSide = constantValue(sides[0]) === 0 ? 0 : constantValue(sides[1]) === 0 ? 1 : -1;
      if (ratios.every(r => Number.isFinite(r)) && Math.abs(ratios[0]) > 1e-9 && ratios.every(r => Math.abs(r - ratios[0]) <= 1e-7 * Math.max(1, Math.abs(ratios[0])))) {
        if (eqState && zeroSide >= 0) { eqState.at = lineIndex; eqState.side = sides[1 - zeroSide].trim(); }
        return { status: 'ok', state: 'verified', valueChain: { rule: 'stationary-equation' } };
      }
      // The line above was the stationary equation (`0 = 6x^2 + 18x`) and this one is the same equation with the other side rewritten
      // (`0 = 6x(x + 4)`): a rewrite of one side of an equation whose other side is 0 must keep that side's value everywhere (or divide it by a
      // constant), so a polynomial of the same degree that is not a constant multiple of it is a false step. A lower degree is a factor (a root
      // line), and anything that is not a polynomial in the letter is left alone.
      if (eqState && zeroSide >= 0 && eqState.at === lineIndex - 1 && eqState.side) {
        const written = sides[1 - zeroSide].trim();
        let a = null, b = null;
        try { a = readPoly(eqState.side); b = readPoly(written); } catch { a = null; b = null; }
        const deg = p => (p && p.c.size ? Math.max(...p.c.keys()) : -1);
        if (a && b && a.v === variable && b.v === variable && deg(a) >= 1 && deg(a) === deg(b) && !readingIsAmbiguous(written) && !readingIsAmbiguous(eqState.side)) {
          const facts = falseStepFacts(eqState.side, written);
          const fixed0 = facts ? oneNumberRepair(eqState.side, written) : null;
          // only a wrong REWRITING of the line above: one number off (a unique repair) or one term different, never a new unrelated equation of the same degree
          if (facts && (fixed0 || facts.changed.length === 1)) {
            const d = crossDiagnosis(facts, null, { aboveSide: eqState.side, writtenSide: written, lineNo: lineIndex + 1, checkedBefore: 0 });
            // the line written again with ONE number changed so that it equals the line above, when exactly one such repair exists (`6x[x + 4]` -> `6x[x + 3]`)
            const fixed = fixed0;
            if (fixed) { d.corrected = zeroSide === 0 ? `= ${fixed}` : `${fixed} =`; d.errorType = 'factor-number-wrong'; d.correctedRhs = fixed; d.comment = `${d.comment} The factorised line should read ${fixed}.`; d.message = d.comment; }
            return { status: 'break', code: d.code, note: d.message, diagnosis: d };
          }
        }
      }
    }
  }
  return null;
}

/** `written` with exactly one number changed so that it equals `above` as a polynomial; the one repair, or null when there is none or more than one. */
function oneNumberRepair(above, written) {
  const found = new Set();
  const re = /\d+(?:\.\d+)?/g;
  let m;
  while ((m = re.exec(written))) {
    for (let v = -30; v <= 30; v++) {
      if (String(v) === m[0]) continue;
      // a negative value takes the sign of the operator before it (`x + 6` -> `x - 6`), else it is bracketed
      const before = written.slice(0, m.index), op = /([+-])\s*$/.exec(before);
      const cand = v < 0 && op ? before.slice(0, op.index) + (op[1] === '+' ? '- ' : '+ ') + String(-v) + written.slice(m.index + m[0].length)
        : v >= 0 && op && op[1] === '-' && false ? '' : before + (v < 0 ? `(${v})` : String(v)) + written.slice(m.index + m[0].length);
      let eq = false;
      try { const a = readPoly(above), b = readPoly(cand); eq = !!(a && b && falseStepFacts(above, cand) === null); } catch { eq = false; }
      if (eq) found.add(v < 0 ? cand : cand);
    }
  }
  return found.size === 1 ? [...found][0] : null;
}

/** The expression is the function's right-hand side: the same variable only, and equivalent. */
function restatesFn(fn, ast) {
  const vars = freeVars(ast);
  if (!vars.length || vars.some(v => v !== fn.variable)) return false;
  try { return exprEquivalent(ast, fn.ast) === true && exprEquivalent(ast, fn.ast, { samples: 14 }) === true; } catch { return false; }
}
