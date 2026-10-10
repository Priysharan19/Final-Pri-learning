// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the line audit — is each line true of the line before it?
//
// Step Check asks whether a line holds for the question's answer. That needs
// the answer, and it says nothing about `= 9 + 24` followed by `= 35`: neither
// line names an unknown, so neither is a claim about the answer at all.
//
// The audit asks a different question, and needs no key to ask it: does each
// thing a student wrote follow from the thing written before it?
//
//   T_9 = 9 + 8 × 3        one chain of equal things:
//       = 9 + 24             9 + 8 × 3  →  9 + 24  →  35
//       = 35               the first two are 33; the last is not.
//
// A chain is every side of a line's `=` signs, carried on by any following line
// that BEGINS with `=`. Two neighbouring sides with no letter in them are
// arithmetic, and arithmetic is decidable: they are equal, or they are not.
// Because each side is compared with its own neighbour — never with the right
// answer — a slip is found where it was made, what follows from the wrong value
// is checked against that value and not penalised again, and a second,
// independent slip further down is found as its own mistake.
//
// What the audit will not do is accuse on a doubt. It says nothing (the line is
// "not checked") when a side cannot be read as plain arithmetic, when it could
// be read two ways (`-3^2`, `6/2(1+2)`, `3 1/2`), when the difference is what
// rounding would make, when an angle or a logarithm is involved (degrees or
// radians, which base?), or when a letter stands where a digit probably was
// (`g + 24`): that last one is reported as a reading to confirm, never as a
// mistake in the mathematics.
//
// Pure, deterministic, and key-free: no question, no answer, no clock beyond
// the backstop the rest of the engine uses. The same lines always audit the
// same way, on the device before anything is submitted and on the server after.
// ─────────────────────────────────────────────────────────────────────────────
import { normalize, parse, evaluate, variablesOf, numsClose, exprEquivalent, withEvaluationBudget } from './expr.js';

/** The same bounds Step Check reads working under (checker.js WORKING_LIMITS). */
export const AUDIT_LIMITS = Object.freeze({ lineChars: 200, lines: 100, work: 600000, backstopMs: 750 });
const AUDIT_BUDGET = 50000;

const LEAD = /^(?:[∴∵•▪◦➤➔]|⇒|⟹|=>|→|⟶|->|i\.e\.|(?:so|hence|then|therefore|thus|or|and|now|also)\b[,:]?)\s*/i;
const RELATION = /(<=|>=|!=|[<>≤≥≠⩽⩾])/;
const ANGLE_OR_LOG = /(sin|cos|tan|cot|sec|csc|cosec|log|ln|exp)/i;
const SAFE_WORDS = /sqrt|cbrt|pi/g;
// Letters a reader writes where the page had a digit. Offered as a question
// ("is this g a 9?"), never applied.
const LOOKALIKE = Object.freeze({ g: '9', q: '9', l: '1', I: '1', O: '0', o: '0', S: '5', s: '5', Z: '2', z: '2', B: '8', b: '6' });

const tidy = text => String(text ?? '')
  .replace(/[−–—]/g, '-').replace(/[×·✕✖]/g, '×').replace(/[⁄∕]/g, '/')
  .replace(/\s+/g, ' ').trim();

function stripLead(text) {
  let s = text;
  for (let i = 0; i < 4; i += 1) {
    const next = s.replace(LEAD, '');
    if (next === s) break;
    s = next;
  }
  return s.replace(/\s*[.;,]\s*$/, '').trim();
}

/** A side that is a bare name for what follows: `T_9`, `a_n`, `S9`, `Area`, `LHS`. */
function labelOf(text) {
  const s = text.replace(/\s+/g, '');
  if (/^[A-Za-z]{1,3}(?:_\{?[A-Za-z0-9+\-]{1,5}\}?|[₀-₉]{1,3}|\d{1,3})$/.test(s)) return s.replace(/[{}]/g, '');
  if (/^[A-Za-z]\([A-Za-z0-9.\-]{1,6}\)$/.test(s)) return s;                    // f(2)
  if (/^[A-Za-z][A-Za-z .]{2,30}$/.test(text.trim()) && !ANGLE_OR_LOG.test(text)) return text.trim().toLowerCase();
  return null;
}

const lettersIn = s => (s.replace(SAFE_WORDS, '').match(/[A-Za-z]/g) || []);

function valueOf(source) {
  try {
    const ast = parse(source);
    if (ast.t === 'equation') return null;
    const v = evaluate(ast, {});
    return Number.isFinite(v) ? { ast, v } : null;
  } catch { return null; }
}

/** The top-level operation of a piece of arithmetic, in a word. */
function operationOf(ast) {
  let node = ast;
  while (node?.t === 'group') node = node.v;
  if (node?.t !== 'bin') return null;
  return { '+': 'addition', '-': 'subtraction', '*': 'multiplication', '/': 'division', '^': 'power' }[node.op] || null;
}

/**
 * Read one side of an `=`.
 *   kind 'num'    plain arithmetic; `values` holds every way it can be read
 *   kind 'sym'    has letters (an expression, or a name); never evaluated here
 *   kind 'doubt'  a letter where a digit probably was — a reading to confirm
 *   kind 'bad'    not readable as mathematics
 */
function readSide(raw, vocabulary) {
  let text = tidy(raw).replace(/^[₹$]\s*|^Rs\.?\s*/i, '').replace(/\s*°$/, '').trim();
  // A unit after a number (`35 cm`, `4500 rupees`) is not part of the value.
  const side = { text: tidy(raw), kind: 'bad', values: [], vars: new Set(), label: null, bare: false, decimals: 0, assumed: null, doubt: null, ast: null, source: '' };
  if (!text) return side;
  side.label = labelOf(text);

  let source;
  try { source = normalize(text.replace(/×/g, '*')); } catch { source = null; }
  if (source === null) return side;
  const letters = lettersIn(source);

  if (letters.length) {
    // `8 x 3` where the question has no x: the letter x written for ×.
    if (!vocabulary.has('x') && !vocabulary.has('X')) {
      const timed = text.replace(/(?<=[\d)])\s*[xX]\s*(?=[\d(])/g, ' * ');
      let asTimes = null;
      try { asTimes = normalize(timed.replace(/×/g, '*')); } catch { asTimes = null; }
      if (asTimes !== null && !lettersIn(asTimes).length) {
        const num = readSide(timed, vocabulary);
        if (num.kind === 'num') return { ...num, text: side.text, assumed: '×' };
      }
    }
    // A lone letter among digits that the question never used: `g + 24`, `T_q`.
    const strange = [...new Set(letters)].filter(ch => !vocabulary.has(ch) && Object.hasOwn(LOOKALIKE, ch));
    if (strange.length && !side.label) {
      const swapped = text.replace(/[A-Za-z]/g, ch => (strange.includes(ch) ? LOOKALIKE[ch] : ch));
      let asDigits = null;
      try { asDigits = normalize(swapped.replace(/×/g, '*')); } catch { asDigits = null; }
      if (asDigits !== null && !lettersIn(asDigits).length && /\d/.test(text)) {
        return { ...side, kind: 'doubt', doubt: { read: strange[0], maybe: LOOKALIKE[strange[0]] } };
      }
    }
    if (side.label && /_[A-Za-z]$|[A-Za-z]_\{?[gqlIOoSsZzBb]\}?$/.test(text.replace(/\s+/g, ''))) {
      const sub = text.replace(/\s+/g, '').match(/_\{?([A-Za-z])\}?$/)?.[1];
      if (sub && !vocabulary.has(sub) && Object.hasOwn(LOOKALIKE, sub) && sub !== 'n') side.doubt = { read: sub, maybe: LOOKALIKE[sub] };
    }
    try {
      const ast = parse(source);
      if (ast.t !== 'equation') { side.ast = ast; side.vars = variablesOf(ast); side.source = source; }
    } catch { /* a name the parser has no word for: still a label */ }
    side.kind = side.ast || side.label ? 'sym' : 'bad';
    return side;
  }

  // Plain arithmetic from here. Anything that could be read two ways is read
  // both ways; anything whose reading is a guess is not read at all.
  if (/,/.test(text) || ANGLE_OR_LOG.test(text) || /\^[^^]*\^/.test(source)) return side;
  const candidates = [];
  // `2 1/4` is two and a quarter. Any other gap between two numbers (`9 24`) is
  // two numbers or one, and is not guessed.
  const unmixed = text.replace(/(\d+)\s+(\d+)\s*\/\s*(\d+)/g, '($1+$2/$3)');
  if (/\d\s+\d/.test(unmixed)) return side;
  if (unmixed !== text) { try { source = normalize(unmixed.replace(/×/g, '*')); } catch { return side; } }
  const primary = valueOf(source);
  if (!primary) return side;
  candidates.push(primary.v);
  side.ast = primary.ast;
  // `-3^2`: the engine reads −(3²); a student usually means (−3)².
  const bracketed = source.replace(/(^|[(+\-*/\s])-\s*(\d+(?:\.\d+)?)\s*\^/g, '$1(-$2)^');
  if (bracketed !== source) { const alt = valueOf(bracketed); if (alt) candidates.push(alt.v); }
  // `9/2(18 + 24)`: (9/2)(…) to the engine; 9/(2(…)) on some pages.
  const under = source.replace(/\/\s*(\d+(?:\.\d+)?)\s*(\((?:[^()]|\([^()]*\))*\))/g, '/($1*$2)');
  if (under !== source) { const alt = valueOf(under); if (alt) candidates.push(alt.v); }
  // `3/4 ÷ 3/8`: each written fraction is one number.
  if (/[÷×]/.test(unmixed) && /\d\s*\/\s*\d/.test(unmixed)) {
    let atoms = null;
    try { atoms = normalize(unmixed.replace(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/g, '($1/$2)').replace(/×/g, '*')); } catch { atoms = null; }
    const alt = atoms === null ? null : valueOf(atoms);
    if (alt) candidates.push(alt.v);
  }
  side.kind = 'num';
  side.values = candidates.filter((v, i) => candidates.findIndex(x => numsClose(x, v, 1e-9)) === i);
  side.source = source;
  const literal = text.replace(/^\(\s*(.*)\s*\)$/, '$1').match(/^[+-]?\s*\d+(?:\.(\d+))?$/);
  if (literal) { side.bare = true; side.decimals = (literal[1] || '').length; }
  return side;
}

const fmt = v => {
  const n = Number(Number(v).toPrecision(10));
  return Object.is(n, -0) ? '0' : String(n);
};

/** Is `claimed` what rounding (or cutting short) `actual` to its own number of decimals gives? */
function roundedFrom(actual, side) {
  if (!side.bare) return null;
  const unit = 10 ** -side.decimals;
  const scaled = actual / unit;
  if (Math.abs(scaled - Math.round(scaled)) < 1e-7) return null;       // exact at that precision: nothing to round
  const off = Math.abs(actual - side.values[0]);
  const nearest = Math.sign(scaled) * Math.round(Math.abs(scaled)) * unit;            // a half rounds away from zero
  if (Math.abs(nearest - side.values[0]) < unit * 1e-6) return 'rounded';
  return off < unit * (1 + 1e-9) ? 'truncated' : null;
}

/**
 * Judge two neighbouring sides.
 *   ok       equal (`how` says in what sense)      break    not equal: arithmetic, or an expression changed
 *   confirm  a reading to confirm first             open     nothing decidable (a name, an equation, a doubt)
 */
function judge(a, b, { inner, approx, vocabulary }) {
  if (a.kind === 'doubt' || b.kind === 'doubt') return { verdict: 'confirm', doubt: (b.kind === 'doubt' ? b : a).doubt };
  if (a.kind === 'bad' || b.kind === 'bad') return { verdict: 'open', why: 'unread' };
  if (a.kind === 'num' && b.kind === 'num') {
    for (const x of a.values) for (const y of b.values) if (numsClose(x, y, 1e-9)) return { verdict: 'ok', how: 'arithmetic', value: y };
    const actual = a.values[0], claimed = b.values[0];
    if (approx || a.values.some(x => roundedFrom(x, b) === 'rounded')) return { verdict: 'ok', how: 'rounded', value: claimed };
    // Cut short rather than rounded (`7/2 = 3`): possibly meant, never certified.
    if (a.values.some(x => roundedFrom(x, b) === 'truncated')) return { verdict: 'approx', value: claimed };
    // `9 + 24 = 33 + 2 = 35`: a running total, each piece true, the `=` misused.
    const lead = b.text.match(/^\(?\s*(-?\d+(?:\.\d+)?)\s*\)?\s*[+\-×*/÷]/);
    if (lead && a.values.some(x => numsClose(x, Number(lead[1]), 1e-9))) return { verdict: 'ok', how: 'running', value: claimed };
    if (a.assumed || b.assumed || a.values.length > 1 || b.values.length > 1) return { verdict: 'confirm', why: 'ambiguous' };
    return {
      verdict: 'break', cls: numsClose(actual, -claimed, 1e-9) && Math.abs(actual) > 1e-12 ? 'sign' : 'arithmetic',
      from: a.text, actual, claimed, claimedText: b.text, operation: operationOf(a.ast)
    };
  }
  if (a.kind === 'sym' && b.kind === 'sym' && inner && a.ast && b.ast) {
    // Two expressions in the same letters, one written as equal to the other.
    const va = [...a.vars], vb = [...b.vars];
    const sameLetters = va.length > 0 && va.length === vb.length && va.every(v => b.vars.has(v));
    const known = va.every(v => v.length === 1 && vocabulary.has(v));
    if (!sameLetters || !known || va.length > 3) return { verdict: 'open', why: 'symbolic' };
    let same;
    try { same = exprEquivalent(a.source, b.source, {}); } catch { return { verdict: 'open', why: 'symbolic' }; }
    if (same) return { verdict: 'ok', how: 'equivalent' };
    // Not equivalent is only said when it is shown: every probe finite and apart.
    const probes = [[1.37, -2.11, 0.73], [2.9, 1.3, -1.7], [-0.6, 3.1, 2.3]];
    let apart = 0;
    for (const p of probes) {
      const env = Object.fromEntries(va.map((v, i) => [v, p[i]]));
      let x, y;
      try { x = evaluate(a.ast, env); y = evaluate(b.ast, env); } catch { return { verdict: 'open', why: 'symbolic' }; }
      if (!Number.isFinite(x) || !Number.isFinite(y)) return { verdict: 'open', why: 'symbolic' };
      if (Math.abs(x - y) > 1e-6 * Math.max(1, Math.abs(x), Math.abs(y))) apart += 1;
    }
    return apart === probes.length ? { verdict: 'break', cls: 'transformation', from: a.text, claimedText: b.text } : { verdict: 'open', why: 'symbolic' };
  }
  return { verdict: 'open', why: a.kind === 'sym' && b.kind === 'num' ? 'assignment' : 'symbolic' };
}

/** Split `a = 9, d = 3` into its statements; leave `1,000` and `f(2, 3)` alone. */
function statementsOf(text) {
  const parts = text.split(/\s*(?:,|;|\band\b)\s*/i).map(p => p.trim()).filter(Boolean);
  return parts.length > 1 && parts.every(p => /[^<>!=]=[^=>]|^=/.test(' ' + p)) ? parts : [text];
}

const sidesOf = text => text.split(/≈|(?<![<>!=])=(?![=>])/).map(s => s.trim());
const approxAt = text => [...text.matchAll(/≈|(?<![<>!=])=(?![=>])/g)].map(m => m[0] === '≈');

/**
 * Audit the lines of a working.
 *
 * `lines` are the lines exactly as submitted — blank ones included, so the
 * index of a result is the index of the line it is about. `vocabulary` is the
 * set of letters the public question uses (and never anything about its answer).
 *
 * Returns { lines: [{ index, text, blank, continuation, sides, links, verdict,
 *                      carried }], firstBreak, breaks: [index…] }
 *   verdict  'ok' | 'break' | 'confirm' | 'approx' | 'open' | 'none' | 'unread'
 */
export function auditWorking(lines, { vocabulary = [] } = {}) {
  return withEvaluationBudget(AUDIT_BUDGET, () => auditWithinBudget(lines, new Set(vocabulary)));
}

function auditWithinBudget(lines, vocabulary) {
  const raw = (Array.isArray(lines) ? lines : String(lines ?? '').split('\n')).map(l => String(l ?? ''));
  // A letter the working itself uses on two or more lines is a name the student
  // chose, not a digit misread once.
  const seenOn = new Map();
  raw.slice(0, AUDIT_LIMITS.lines).forEach(line => {
    if (line.length > AUDIT_LIMITS.lineChars) return;
    for (const ch of new Set(line.replace(SAFE_WORDS, '').match(/[A-Za-z]/g) || [])) seenOn.set(ch, (seenOn.get(ch) || 0) + 1);
  });
  vocabulary = new Set([...vocabulary, ...[...seenOn].filter(([, n]) => n >= 2).map(([ch]) => ch)]);
  const started = Date.now();
  let spent = 0, closed = false, read = 0;
  let tail = null;                // the last side of the chain a `=` line would continue
  let chainBroken = false;        // has this chain already had its slip?
  let sound = null;               // what the chain was worth before that slip
  let unsure = false;             // does the chain hold a reading still to be confirmed?
  const out = [];
  const breaks = [];

  raw.forEach((line, index) => {
    const text = stripLead(tidy(line));
    const row = { index, text: line.trim(), blank: !text, continuation: false, sides: [], links: [], statements: [], verdict: 'none', carried: false };
    out.push(row);
    if (row.blank) return;
    if (line.length > AUDIT_LIMITS.lineChars) { row.verdict = 'unread'; tail = null; return; }
    spent += line.length * line.length;
    read += 1;
    if (closed || read > AUDIT_LIMITS.lines || spent > AUDIT_LIMITS.work || Date.now() - started > AUDIT_LIMITS.backstopMs) {
      closed = true; row.verdict = 'unread'; tail = null; return;
    }
    if (RELATION.test(text)) { tail = null; return; }            // an inequality is Step Check's to judge

    row.continuation = /^[=≈]/.test(text);
    const statements = row.continuation ? [text] : statementsOf(text);
    for (const statement of statements) {
      const continues = /^[=≈]/.test(statement);
      const body = continues ? statement.replace(/^[=≈]\s*/, '') : statement;
      const approxFlags = [...(continues ? [statement[0] === '≈'] : []), ...approxAt(body)];
      const sides = sidesOf(body).map(s => readSide(s, vocabulary));
      if (!continues && sides.length < 2) {
        // No `=`: a bare expression or prose. It starts nothing and ends the chain.
        row.sides.push(...sides);
        row.statements.push({ continues: false, sides, links: sides.map(() => null), bare: true });
        tail = sides[0]?.kind === 'num' || sides[0]?.kind === 'sym' ? { side: sides[0], position: 0 } : null;
        chainBroken = false; sound = null; unsure = false;
        continue;
      }
      let previous = continues ? tail : null;
      if (!continues) { chainBroken = false; sound = null; unsure = false; }
      const record = { continues, sides, links: [] };       // links[k] ends at sides[k]
      row.statements.push(record);
      sides.forEach((side, k) => {
        row.sides.push(side);
        let link = null;
        if (side.label && side.doubt && side.kind === 'sym') { row.links.push({ verdict: 'confirm', doubt: side.doubt, label: true }); unsure = true; }
        if (side.kind === 'doubt') unsure = true;
        if (previous) {
          const position = previous.position + 1;
          link = judge(previous.side, side, { inner: position >= 2 || (continues && k === 0), approx: approxFlags[continues ? k : k - 1] === true, vocabulary });
          // Nothing under an unconfirmed reading is called a mistake.
          if (link.verdict === 'break' && unsure) link = { verdict: 'confirm', why: 'above' };
          // Back to the value the chain had before its slip: the slip was not
          // carried on, and this side is not a second mistake.
          if (link.verdict === 'break' && chainBroken && side.kind === 'num' && sound && sound.some(x => side.values.some(y => numsClose(x, y, 1e-9)))) {
            link = { verdict: 'ok', how: 'recovered', value: side.values[0] };
            chainBroken = false;
          } else if (link.verdict === 'ok' && chainBroken) link.carried = true;
          if (link.verdict === 'break') { if (!chainBroken && previous.side.kind === 'num') sound = previous.side.values; chainBroken = true; }
          row.links.push(link);
          previous = { side, position };
        } else {
          previous = { side, position: 0 };
        }
        record.links.push(link);
      });
      tail = previous;
    }

    const verdicts = row.links.map(l => l.verdict);
    row.verdict = verdicts.includes('break') ? 'break'
      : verdicts.includes('confirm') ? 'confirm'
        : verdicts.includes('approx') ? 'approx'
          : verdicts.includes('ok') ? 'ok'
            : verdicts.length ? 'open' : 'none';
    // A line is carried when what it checks out against is the student's own slipped value.
    row.carried = row.verdict === 'ok' && row.links.some(l => l.carried);
    if (row.verdict === 'break') breaks.push(index);
  });

  return { lines: out, firstBreak: breaks.length ? breaks[0] : -1, breaks };
}

/** The break on a line, if the audit found one there. */
export const breakOn = row => (row?.links || []).find(l => l.verdict === 'break') || null;

/**
 * What a break says, three ways:
 *   what        the kind of mistake, with nothing of the right value in it
 *   hint        where to look again — safe before anything is marked
 *   correction  the right value, for after the grade is committed
 */
export function describeBreak(link) {
  if (!link) return null;
  if (link.cls === 'transformation') {
    return {
      cls: 'invalid-transformation',
      what: 'This line is not equal to the line before it.',
      hint: `Recheck how ${link.from} became ${link.claimedText}.`,
      correction: `${link.from} is not the same expression as ${link.claimedText} — they give different values.`
    };
  }
  const op = link.operation ? `the ${link.operation}` : 'the calculation';
  // A wrong value written out (`= 35`) is corrected by the value; a wrong
  // expression (`= 9 + 26`) by showing that the two lines are different numbers.
  const bare = /^\(?\s*[+-]?\s*\d+(?:\.\d+)?\s*\)?$/.test(String(link.claimedText ?? ''));
  const correction = bare
    ? `${link.from} = ${fmt(link.actual)}, not ${fmt(link.claimed)}.`
    : `${link.from} = ${fmt(link.actual)}, but ${link.claimedText} = ${fmt(link.claimed)}.`;
  if (link.cls === 'sign') {
    return { cls: 'sign', what: `Sign error in ${op}.`, hint: `Recheck the sign of ${link.from}.`, correction: `${correction.slice(0, -1)} — the sign is wrong.` };
  }
  return {
    cls: 'arithmetic-slip',
    what: bare ? `Arithmetic slip in ${op}.` : 'Arithmetic slip: this line is not equal to the one before it.',
    hint: bare ? `Recheck ${link.from}.` : `Recheck how ${link.from} became ${link.claimedText}.`,
    correction
  };
}

/**
 * The pre-submission hint: the first line of the student's own working that is
 * not true of the line before it, or a reading to confirm before that. Key-free
 * by construction — it is computed from the lines alone — and it never states
 * the value the line should have had.
 */
export function workingHint(lines, { vocabulary = [] } = {}) {
  const audit = auditWorking(lines, { vocabulary });
  for (const row of audit.lines) {
    if (row.verdict === 'confirm') {
      const doubt = row.links.find(l => l.verdict === 'confirm')?.doubt || null;
      return { index: row.index, kind: 'confirm', doubt, text: doubt ? `Is “${doubt.read}” on this line a ${doubt.maybe}? Correct the line if it is.` : 'This line can be read more than one way — add brackets or correct it.' };
    }
    if (row.verdict === 'break') {
      const said = describeBreak(breakOn(row));
      return { index: row.index, kind: 'recheck', cls: said.cls, text: said.hint };
    }
  }
  return null;
}
