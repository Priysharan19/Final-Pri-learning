// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Release-wide false-positive sweep
//
// The Phase 2 gate is ZERO false-correct marks. This suite draws questions from
// every generator at every difficulty (and every reviewed PYQ record), and for
// each keyed answer submits answers that are WRONG — near misses a real student
// writes — to the real marker. Not one of them may be marked correct:
//
//   · numeric: sign, ±1, reciprocal, ×10 and ÷10, a wrong-but-close value just
//     outside the marker's own tolerance, rounding to the wrong digit when the
//     prompt names a precision, a wrong unit of the same kind, an unsimplified
//     fraction when the prompt demands simplest form;
//   · set: a dropped, an extra, a negated and a shifted solution;
//   · point: swapped coordinates, a negated or shifted coordinate;
//   · ratio: reversed, shifted, unsimplified when simplest form is demanded;
//   · expression: +1, negated, doubled, a 0.1% scale, a tiny additive offset,
//     a shifted variable — each confirmed non-equivalent by direct evaluation
//     before it is submitted;
//   · mcq: every other option;
//   · working (answerType 'working'): a page that ends on the right result but
//     carries a false line, a page padded with trivially true lines but no
//     derivation, and a page that ends on a wrong result.
//   · method marks (methodMarks, the partial credit a wrong final answer can
//     still earn): working made only of restatements, identities and the
//     question's own equation flipped earns nothing.
//
// The keyed answer itself must be accepted (otherwise the probes prove
// nothing); a refused key is reported as a false negative, separately.
//
// Usage: node client/test/false-positive-sweep-check.mjs [seeds-per-cell]
//        FP_REPORT=1 prints every finding.
// ─────────────────────────────────────────────────────────────────────────────
const SRC = new URL('../src/', import.meta.url).href;
const { generateQuestion, loadAllBanks, GENERATORS } = await import(`${SRC}engine/generators/index.js`);
await loadAllBanks();
const { checkAnswer, methodMarks } = await import(`${SRC}engine/checker.js`);
const { parse, evaluate } = await import(`${SRC}engine/expr.js`);
const { stepMetaFor, marksPossibleFor } = await import('../../server/platform/markerOps.js');

const SEEDS = Number(process.argv[2]) || 12;
const REPORT = !!process.env.FP_REPORT;

const totals = { questions: 0, probes: 0, keysAccepted: 0, keysRefused: 0, workingProbes: 0, methodProbes: 0 };
const falseCorrect = [];   // P0: a wrong answer marked correct
const falseNegative = [];  // the key refused
const methodLeaks = [];    // method marks awarded for content-free working
const byType = {};

const fmt = x => {
  if (!Number.isFinite(x)) return String(x);
  if (Number.isInteger(x)) return String(x);
  return String(Number(x.toPrecision(12)));
};
const differs = (a, b) => Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** The marker's own default band for a numeric target (mirrors numsClose). */
function bandOf(v, tol) {
  if (tol != null) return tol;
  if (Number.isInteger(v)) return Math.min(0.25, Math.max(1e-9, Math.abs(v) * 1e-9));
  const text = String(Math.abs(v));
  const places = /e/i.test(text) ? Infinity : (text.split('.')[1] || '').length;
  const cap = places <= 2 ? 0.5 * 10 ** -places : 0.05;
  return Math.min(cap, Math.max(1e-6, Math.abs(v) * 1e-4));
}

function verdict(q, input) {
  try { return checkAnswer(q, input); } catch (err) { return { correct: false, error: err.message }; }
}

const UNIT_FAMILIES = [
  ['mm', 'cm', 'm', 'km'], ['mg', 'g', 'kg'], ['s', 'min', 'h'], ['ml', 'l'],
  ['cm²', 'm²', 'km²'], ['cm³', 'm³'], ['°', 'rad']
];
function wrongUnit(suffix) {
  const s = String(suffix || '').trim().replace(/\^2/, '²').replace(/\^3/, '³');
  for (const fam of UNIT_FAMILIES) {
    const i = fam.indexOf(s);
    if (i >= 0) return fam[(i + 1) % fam.length];
  }
  return null;
}

/** Decimal places the prompt names ("correct to 2 decimal places", "nearest tenth"). */
function namedPrecision(text) {
  // A precision the GIVEN data was measured to is not the answer's precision.
  const s = String(text || '').replace(/\b(?:measured|recorded)\b[^?!]*?\bto the nearest \w+(?: \w+)?/gi, '');
  let m = s.match(/\b(\w+)\s*(?:decimal\s+places?|d\.\s?p\.?)/i);
  const words = { one: 1, two: 2, three: 3, four: 4, five: 5, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5 };
  if (m && words[m[1].toLowerCase()] != null) return words[m[1].toLowerCase()];
  if (/(?:to|correct to)\s+(?:1|one)\s+decimal place\b/i.test(s)) return 1;
  if (/nearest\s+(?:whole number|integer|unit|rupee|degree|metre|cm|km|kg|gram|second|minute)/i.test(s)) return 0;
  if (/nearest\s+tenth/i.test(s)) return 1;
  if (/nearest\s+hundredth/i.test(s)) return 2;
  return null;
}
const demandsSimplest = text => /simplest form|lowest terms|fully simplif|simplest ratio|simplified fraction/i.test(String(text || ''));

function numericProbes(q, a) {
  const v = a.value;
  const band = bandOf(v, a.tol);
  const out = [];
  const push = (x, why) => { if (Number.isFinite(x) && Math.abs(x - v) > band * 1.0000001 && differs(x, v)) out.push({ input: fmt(x), why }); };
  push(-v, 'sign');
  push(v + 1, '+1'); push(v - 1, '-1');
  if (v !== 0 && Math.abs(v) !== 1) push(1 / v, 'reciprocal');
  push(v * 10, '×10'); push(v / 10, '÷10');
  const step = Math.max(band * 3, Math.abs(v) * 0.01, 1e-3);
  push(v + step, 'close+'); push(v - step, 'close-');
  // A named precision: the value rounded to that place, with the last digit
  // one off, is wrong whatever band the generator authored.
  const p = namedPrecision(`${q.prompt} ${q.answerSuffix || ''}`);
  if (p != null) {
    for (const off of [10 ** -p, -(10 ** -p)]) {
      const x = Number((Number(v.toFixed(p)) + off).toFixed(p));
      if (Math.abs(x - v) > 0.5 * 10 ** -p * (1 + 1e-6)) out.push({ input: fmt(x), why: `wrong last digit at the named ${p} d.p.` });
    }
    // Truncated instead of rounded, when that differs.
    const cut = Math.trunc(v * 10 ** p) / 10 ** p;
    if (Math.abs(cut - v) > 0.5 * 10 ** -p * (1 + 1e-6)) out.push({ input: fmt(cut), why: `truncated, not rounded, at ${p} d.p.` });
  }
  if (a.simplestFraction && a.simplestFraction.d !== 1) {
    const { n, d } = a.simplestFraction;
    push((n + 1) / d, 'numerator+1'); push(n / (d + 1), 'denominator+1');
    if (n !== 0) push(d / n, 'flipped fraction');
    if (demandsSimplest(q.prompt)) out.push({ input: `${2 * n}/${2 * d}`, why: 'unsimplified fraction on a simplest-form prompt', form: true });
  }
  if (q.answerSuffix && v !== 0) {
    const u = wrongUnit(q.answerSuffix);
    if (u) out.push({ input: `${fmt(v)} ${u}`, why: `wrong unit ${u} (asked ${String(q.answerSuffix).trim()})`, unit: true });
  }
  if ((a.percent || /\bper\s?cent(?:age)?s?\b/i.test(q.prompt || '')) && v !== 0) out.push({ input: fmt(v / 100), why: 'the percentage as a bare decimal (the box shows %)' });
  // On a percentage question a typed % is the answer's unit: 100 times the key
  // with the sign is 100 times too big, never the key read as ÷100.
  if ((a.percent || /%/.test(q.answerSuffix || '') || /\bper\s?cent(?:age)?s?\b/i.test(q.prompt || '')) && v !== 0) {
    out.push({ input: `${fmt(v * 100)}%`, why: 'a hundred times the percentage, with the % sign' }, { input: `${fmt(v / 100)}%`, why: 'the percentage as a decimal, with the % sign' },
      { input: `(${fmt(v * 100)}%)`, why: 'a hundred times the percentage, bracketed with the sign' }, { input: `${fmt(v * 100)}%%`, why: 'a hundred times the percentage, two signs' },
      { input: `${fmt(v * 100)}% + 0`, why: 'a hundred times the percentage, the sign used as arithmetic' });
  }
  return out;
}

function setProbes(a) {
  const vals = a.values;
  const out = [];
  const tol = a.tol ?? 1e-6;
  const has = x => vals.some(v => Math.abs(v - x) <= Math.max(tol, bandOf(v, a.tol)));
  const list = arr => arr.map(fmt).join(', ');
  if (vals.length > 1) out.push({ input: list(vals.slice(1)), why: 'a solution dropped' });
  const extra = Math.max(...vals) + 1;
  out.push({ input: list([...vals, extra]), why: 'an extra solution' });
  for (let i = 0; i < vals.length; i++) {
    const neg = -vals[i];
    if (!has(neg)) out.push({ input: list(vals.map((v, j) => (j === i ? neg : v))), why: `solution ${i + 1} negated` });
    const sh = vals[i] + 1;
    if (!has(sh)) out.push({ input: list(vals.map((v, j) => (j === i ? sh : v))), why: `solution ${i + 1} shifted` });
  }
  return out;
}

function pointProbes(a) {
  const out = [];
  const pt = (x, y) => `(${fmt(x)}, ${fmt(y)})`;
  if (differs(a.x, a.y)) out.push({ input: pt(a.y, a.x), why: 'coordinates swapped' });
  if (a.x !== 0) out.push({ input: pt(-a.x, a.y), why: 'x negated' });
  if (a.y !== 0) out.push({ input: pt(a.x, -a.y), why: 'y negated' });
  out.push({ input: pt(a.x + 1, a.y), why: 'x shifted' }, { input: pt(a.x, a.y + 1), why: 'y shifted' });
  return out;
}

function ratioProbes(q, a) {
  const out = [];
  if (a.a !== a.b) out.push({ input: `${a.b}:${a.a}`, why: 'ratio reversed' });
  out.push({ input: `${a.a + 1}:${a.b}`, why: 'first part shifted' });
  if (a.simplified || demandsSimplest(q.prompt)) out.push({ input: `${2 * a.a}:${2 * a.b}`, why: 'unsimplified ratio', form: true });
  return out;
}

/** Independent non-equivalence: evaluate both at sample points where both are defined. */
function clearlyDifferent(e1, e2) {
  let t1, t2;
  try { t1 = parse(e1); t2 = parse(e2); } catch { return false; }
  const pts = [0.37, 1.3, 2.71, -0.83, 3.9, 0.61, 5.2, -2.4];
  let compared = 0, diff = 0;
  for (const p of pts) {
    const scope = { x: p, y: p * 0.7 + 0.3, t: p, n: p, a: p + 1.1, b: p * 1.3 - 0.2, k: p, u: p, v: p, m: p, r: Math.abs(p) + 0.5, theta: p, θ: p };
    let v1, v2;
    try { v1 = evaluate(t1, scope); v2 = evaluate(t2, scope); } catch { continue; }
    if (!Number.isFinite(v1) || !Number.isFinite(v2)) continue;
    compared++;
    if (Math.abs(v1 - v2) > 1e-7 * Math.max(1, Math.abs(v1))) diff++;
  }
  return compared >= 4 && diff >= Math.ceil(compared / 2);
}

function expressionProbes(q, a) {
  const e = a.expr;
  // An antiderivative is any one of a family: adding a constant to it is still right.
  const antiderivative = a.stripC || /\+\s*C\b|∫|\\int\b/.test(String(q.prompt || ''));
  const cands = [[`-(${e})`, 'negated'], [`2*(${e})`, 'doubled'], [`1.001*(${e})`, '0.1% scale']];
  if (!antiderivative) cands.push([`(${e}) + 1`, '+1'], [`(${e}) + 0.001`, 'tiny additive offset']);
  if (/x/.test(e)) cands.push([e.replace(/x/g, '(x+1)'), 'variable shifted']);
  const out = [];
  for (const [input, why] of cands) {
    if (input.length > 118) continue;
    if (clearlyDifferent(input, e) && [e, ...(a.anyOf || [])].every(c => clearlyDifferent(input, c))) out.push({ input, why });
  }
  return out;
}

function probesFor(q) {
  const a = q.answer;
  if (!a) return [];
  switch (q.answerType) {
    case 'numeric': return typeof a.value === 'number' ? numericProbes(q, a) : [];
    case 'set': return Array.isArray(a.values) && a.values.length ? setProbes(a) : [];
    case 'point': return pointProbes(a);
    case 'ratio': return ratioProbes(q, a);
    case 'expression': return a.expr ? expressionProbes(q, a) : [];
    case 'mcq': return (q.mcqOptions || q.options || []).map((_, i) => i).filter(i => i !== a.correctIndex).map(i => ({ input: String(i), why: `option ${i}` }));
    default: return [];
  }
}

function keyInput(q) {
  const a = q.answer;
  switch (q.answerType) {
    case 'numeric':
      if (a.canonicalInput) return a.canonicalInput;
      if (a.surdForm) return `${a.surdForm.k === 1 ? '' : a.surdForm.k}sqrt(${a.surdForm.r})`;
      if (a.simplestFraction && a.simplestFraction.d !== 1) return `${a.simplestFraction.n}/${a.simplestFraction.d}`;
      return fmt(a.value);
    case 'set': return a.values.map(fmt).join(', ');
    case 'point': return `(${fmt(a.x)}, ${fmt(a.y)})`;
    case 'ratio': return `${a.a}:${a.b}`;
    case 'expression': return a.expr;
    case 'mcq': return String(a.correctIndex);
    default: return null;
  }
}

function record(list, id, d, seed, q, probe, res) {
  list.push({ id, d, seed, type: q.answerType, input: probe?.input, why: probe?.why, key: keyInput(q), prompt: String(q.prompt || '').slice(0, 220), feedback: res?.feedback });
}

// ── Working pages (answerType 'working') ───────────────────────────────────
function workingProbes(q) {
  const lines = String(q.answer.canonicalWorking || '').split('\n').map(s => s.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const last = lines[lines.length - 1];
  const out = [];
  // A false line in the middle, right result at the end.
  const broken = [...lines];
  const mid = Math.max(0, Math.floor((lines.length - 1) / 2));
  broken.splice(mid + 1, 0, '1 = 2');
  out.push({ input: broken.join('\n'), why: 'a false line inserted before the right result' });
  // Padding: identities and the final line only — no derivation.
  out.push({ input: ['0 = 0', '1 = 1', 'x = x', last].join('\n'), why: 'padded identities then the result, no derivation' });
  // The right derivation, ending on a wrong result.
  const m = last.match(/^(.*=\s*)(-?\d+(?:\.\d+)?)\s*$/);
  if (m) out.push({ input: [...lines.slice(0, -1), `${m[1]}${Number(m[2]) + 1}`].join('\n'), why: 'right derivation, wrong last line' });
  return out;
}

// ── Method marks for content-free working (a wrong final answer) ───────────
function methodProbes(q) {
  const meta = stepMetaFor(q);
  if (!meta) return [];
  const prompt = String(q.prompt || '');
  const eq = (prompt.match(/\$([^$]*=[^$]*)\$/) || [])[1];
  const pages = [
    ['0 = 0', '1 = 1', 'x = x'].join('\n'),
    ['2 + 2 = 4', '3 × 3 = 9', '10 - 10 = 0'].join('\n')
  ];
  if (eq && !/\\/.test(eq) && eq.split('=').length === 2) {
    const [l, r] = eq.split('=');
    pages.push([eq, `${r.trim()} = ${l.trim()}`, eq].join('\n'));
  }
  // The right answer stated with no method before it is a statement, not a
  // derivation: it earns no method mark (the final-answer box earns the mark).
  if (meta.kind === 'equation' && meta.variable && Array.isArray(meta.solutions) && meta.solutions.length === 1) {
    pages.push(`${meta.variable} = ${fmt(meta.solutions[0])}`);
    pages.push(['1 = 1', `${meta.variable} = ${fmt(meta.solutions[0])}`, `${meta.variable} = ${fmt(meta.solutions[0])}`].join('\n'));
  }
  if (meta.kind === 'expression' && meta.canonical && meta.canonical.length < 60) {
    pages.push(['0 = 0', `${meta.canonical} = ${meta.canonical}`].join('\n'));
  }
  return pages.map(working => ({ meta, working, marks: marksPossibleFor(q), prompt }));
}

function sweepQuestion(id, d, seed, q) {
  if (!q || !q.answerType) return;
  totals.questions++;
  byType[q.answerType] = (byType[q.answerType] || 0) + 1;
  if (q.answerType === 'working') {
    for (const p of workingProbes(q)) {
      totals.workingProbes++;
      const res = verdict(q, p.input);
      if (res.correct) record(falseCorrect, id, d, seed, q, p, res);
    }
    return;
  }
  const key = keyInput(q);
  if (key != null) {
    const res = verdict(q, key);
    if (res.correct) totals.keysAccepted++; else { totals.keysRefused++; record(falseNegative, id, d, seed, q, { input: key, why: 'the key' }, res); }
  }
  // The key rounded to a precision the prompt names is the answer a student
  // writes; tightening a band must never refuse it.
  const places = q.answerType === 'numeric' && typeof q.answer?.value === 'number' && !q.answer.simplestFraction && !q.answer.surdForm && !q.answer.requireExact
    ? namedPrecision(`${q.prompt} ${q.answerSuffix || ''}`) : null;
  if (places != null) {
    const rounded = fmt(Number(q.answer.value.toFixed(places)));
    const res = verdict(q, rounded);
    totals.roundedKeys = (totals.roundedKeys || 0) + 1;
    if (!res.correct) record(falseNegative, id, d, seed, q, { input: rounded, why: `the key rounded to the named ${places} d.p.` }, res);
  }
  for (const p of probesFor(q)) {
    totals.probes++;
    const res = verdict(q, p.input);
    if (res.correct) record(falseCorrect, id, d, seed, q, p, res);
  }
  for (const m of methodProbes(q)) {
    totals.methodProbes++;
    let r = null;
    try { r = methodMarks(m); } catch { r = null; }
    if (r && r.awarded > 0) record(methodLeaks, id, d, seed, q, { input: m.working, why: `method marks ${r.awarded} for content-free working` }, { feedback: r.note });
  }
}

// ── 1 · Every generator, every difficulty ──────────────────────────────────
const ids = Object.keys(GENERATORS);
for (const id of ids) {
  for (const d of [1, 2, 3, 4]) {
    for (let i = 0; i < SEEDS; i++) {
      const seed = ((i + 1) * 2654435761 + d * 40503 + id.length * 97) >>> 0;
      let q;
      try { q = generateQuestion(id, d, seed); } catch { continue; }
      sweepQuestion(id, d, seed, q);
      for (const [k, part] of (q.parts || []).entries()) sweepQuestion(`${id}#part${k + 1}`, d, seed, part);
    }
  }
}

// ── 2 · Every reviewed previous-year question ──────────────────────────────
let pyqCount = 0;
try {
  const { PYQ_RECORDS, buildPyqBank } = await import(`${SRC}engine/pyq/pyqArchive.js`);
  const bank = buildPyqBank(PYQ_RECORDS);
  for (const [gid, gen] of Object.entries(bank)) {
    for (const d of [1, 2, 3, 4]) for (let i = 0; i < 6; i++) {
      let q; try { q = gen(() => (i + 0.5) / 6, d); } catch { continue; }
      pyqCount++; sweepQuestion(`pyq:${gid}`, d, i, q);
    }
  }
} catch (err) { console.log(`(pyq archive not swept: ${err.message})`); }
try {
  const { jeePyqCatalogSnapshot, loadJeePyqPartRecords, asJeePyqPayload } = await import(`${SRC}engine/generators/jee-pyq-runtime.js`);
  for (const part of jeePyqCatalogSnapshot().parts) {
    const recs = await loadJeePyqPartRecords(part);
    for (const rec of recs) {
      let q; try { q = asJeePyqPayload(rec); } catch { continue; }
      pyqCount++; sweepQuestion(`jee-pyq:${rec.id || part}`, q?.difficulty || 0, 0, q);
    }
  }
} catch (err) { console.log(`(JEE PYQ bank not swept: ${err.message})`); }

// ── 3 · The defects this sweep found, pinned ───────────────────────────────
const regressions = [];
const expect = (name, cond) => { totals.regressions = (totals.regressions || 0) + 1; if (!cond) regressions.push(name); };
{
  // (a) A percentage question: the box shows "%", so a bare 0.6 is 0.6 %.
  const pct = { answerType: 'numeric', prompt: 'A retailer buys a bike for $160.00 and sells it for $64.00. Find the percentage loss.', answerSuffix: '%', answer: { value: 60, percent: true } };
  expect('percent: 60 is accepted', verdict(pct, '60').correct);
  expect('percent: 60% is accepted', verdict(pct, '60%').correct);
  expect('percent: a bare 0.6 is NOT 60 %', !verdict(pct, '0.6').correct);
  const pctTol = { answerType: 'numeric', prompt: 'Find the annual interest rate as a percentage.', answerSuffix: '% p.a.', answer: { value: 4.5, tol: 0.01, percent: true } };
  expect('percent p.a.: a bare 0.045 is NOT 4.5 %', !verdict(pctTol, '0.045').correct);
  expect('percent p.a.: 4.5 is accepted', verdict(pctTol, '4.5').correct);
  // (b) A named precision bounds an authored band that is wider.
  const dp4 = { answerType: 'numeric', prompt: 'In 12 independent shots, find P(exactly 4 scores), correct to 4 decimal places.', answer: { value: 0.2367, tol: 0.0006 } };
  expect('4 d.p.: the key is accepted', verdict(dp4, '0.2367').correct);
  expect('4 d.p.: a more precise value is accepted', verdict(dp4, '0.23671').correct);
  expect('4 d.p.: the wrong last digit 0.2368 is refused', !verdict(dp4, '0.2368').correct);
  expect('4 d.p.: the wrong last digit 0.2366 is refused', !verdict(dp4, '0.2366').correct);
  const dp2default = { answerType: 'numeric', prompt: 'Find the length, correct to 2 decimal places.', answer: { value: 1234.57 } };
  expect('2 d.p. default band: 1234.58 is refused', !verdict(dp2default, '1234.58').correct);
  expect('2 d.p. default band: 1234.57 is accepted', verdict(dp2default, '1234.57').correct);
  const data = { answerType: 'numeric', prompt: 'A quantity is measured as $5$ kg, to the nearest tenth of a kilogram. State the **absolute error**.', answer: { value: 0.05 } };
  expect('a precision of the GIVEN data does not bound the answer: 0.05 accepted', verdict(data, '0.05').correct);
  const dataAnd = { answerType: 'numeric', prompt: 'A quantity is measured as $17.3$ s, to the nearest tenth of a second. Find the percentage error, correct to 2 decimal places.', answer: { value: 0.29, tol: 0.011 } };
  expect('measured-to-a-tenth beside "correct to 2 d.p.": 0.30 refused', !verdict(dataAnd, '0.3').correct);
  // (c) Method marks: arithmetic beside an expression earns nothing.
  const mm = w => methodMarks({ meta: { kind: 'expression', canonical: '0x + 0' }, working: w, marks: 2, prompt: 'Simplify $5x - 3 - 5x + 3$ by collecting like terms.' })?.awarded || 0;
  expect('method: 0 = 0 / 1 = 1 / x = x earns nothing', mm('0 = 0\n1 = 1\nx = x') === 0);
  expect('method: 2 + 2 = 4 / 10 - 10 = 0 earns nothing', mm('2 + 2 = 4\n10 - 10 = 0') === 0);
  const ix = w => methodMarks({ meta: { kind: 'expression', canonical: 'x^1' }, working: w, marks: 2, prompt: 'Simplify $x^{6} \\div x^{5}$.' })?.awarded || 0;
  expect('method: x = x earns nothing on x^6 ÷ x^5', ix('0 = 0\n1 = 1\nx = x') === 0);
  expect('method: a genuine step still earns on x^6 ÷ x^5', ix('x^6/x^5 = x^(6-5)\nx^(6-5) = x') >= 1);
  // (e) On a percentage question a typed % is the unit (P0, owner review of #667's batch 2):
  // "6500%" was read as 6500 ÷ 100 and marked right for 65.
  const own = { answerType: 'numeric', prompt: 'What is the least possible percentage of households that own all three?', answerSuffix: '%', answer: { value: 65 } };
  for (const input of ['6500%', '6500 %', '13/20%', '0.65%', '0.65', '6500 percent']) expect(`percent: "${input}" is not 65 %`, !verdict(own, input).correct);
  for (const input of ['65', '65%', '65 %', '65 percent', '65 per cent']) expect(`percent: "${input}" is 65 %`, verdict(own, input).correct);
  const bySuffix = { answerType: 'numeric', prompt: 'Find the combined mean mark.', answerSuffix: '%', answer: { value: 66.3 } };
  expect('percent: a % beside the box asks for a percentage, so 66.3% is 66.3', verdict(bySuffix, '66.3%').correct);
  expect('percent: and 6630% is not', !verdict(bySuffix, '6630%').correct);
  // The sign anywhere but once at the end is arithmetic, not the unit (#670 review).
  for (const input of ['(6500%)', '6500%%', '6500% + 0', '6500%·1', 'percentage = (6500%)']) expect(`percent: "${input}" is not 65 %`, !verdict(own, input).correct);
  expect('percent: "(65%)" is 65 %', verdict(own, '(65%)').correct);
  const cv = { answerType: 'numeric', prompt: 'Find its coefficient of variation, as a percentage.', answerSuffix: '%', answer: { value: 20 / 3, simplestFraction: { n: 20, d: 3 }, requireFraction: false } };
  for (const input of ['20/3%', '(20/3)%', '6 2/3%']) expect(`percent: "${input}" is 20/3 %`, verdict(cv, input).correct);
  expect('percent: "2000/3%" is not 20/3 %', !verdict(cv, '2000/3%').correct);
  const asSymbol = { answerType: 'numeric', prompt: 'Express 13/20 as a %.', answer: { value: 65 } };
  expect('percent: "as a %" asks for a percentage: 65% accepted', verdict(asSymbol, '65%').correct);
  expect('percent: and 6500% refused', !verdict(asSymbol, '6500%').correct);
  const areaPct = { answerType: 'numeric', prompt: 'Find the area.', answer: { value: 72 } };
  for (const input of ['7200%', '7200 percent']) expect(`percent: "${input}" is a wrong unit for an area of 72`, !verdict(areaPct, input).correct);
  const accurate = { answerType: 'numeric', prompt: 'A test is 95 percent accurate. Find the probability that it gives a correct result twice.', answer: { value: 0.44 } };
  expect('percent: a "percent" in the data does not make the question ask for one: 44% is 0.44', verdict(accurate, '44%').correct);
  expect('percent: and 0.44% is not', !verdict(accurate, '0.44%').correct);
  const prob = { answerType: 'numeric', prompt: 'Find the probability.', answer: { value: 0.44 } };
  expect('percent: on a question not asking for a percentage, 44% is still 0.44', verdict(prob, '44%').correct);
  // (f) A label is read off only when it names the asked quantity.
  const b2 = { answerType: 'numeric', prompt: 'Find $b^2$.', answer: { value: 50 } };
  for (const input of ['b^2 = 50', 'b² = 50', 'B^2=50']) expect(`label: "${input}" names b², accepted`, verdict(b2, input).correct);
  for (const input of ['b = 50', 'a^2 = 50']) expect(`label: "${input}" is not b² = 50`, !verdict(b2, input).correct);
  // Legacy, undecided: a one-letter label on an unrelated letter the question
  // neither asks for nor gives is still read off as it always was.
  expect('label (legacy): "c = 50" on a question that never mentions c is still read off', verdict(b2, 'c = 50').correct);
  const tri = { answerType: 'numeric', prompt: 'In triangle ABC, $a = 7$ and $c = 9$. Find $b^2$.', answer: { value: 67 } };
  expect('label: "c = 67" names the given c, refused', !verdict(tri, 'c = 67').correct);
  expect('label: "b^2 = 67" accepted', verdict(tri, 'b^2 = 67').correct);
  const henceB = { answerType: 'numeric', prompt: 'Find $b^2$ and hence $b$.', answer: { value: 5 } };
  expect('label: "Find $b^2$ and hence $b$" asks for b too: "b = 5" accepted', verdict(henceB, 'b = 5').correct);
  const bold = { answerType: 'numeric', prompt: 'Find the **median** of the data.', answer: { value: 6 } };
  expect('label: bold markup does not hide the asked noun: "median = 6" accepted', verdict(bold, 'median = 6').correct);
  expect('label: "Answer = 6" accepted', verdict(bold, 'Answer = 6').correct);
  const pq = { answerType: 'numeric', prompt: 'Find $PQ^2$.', answer: { value: 87.2, simplestFraction: { n: 436, d: 5 }, requireFraction: false } };
  expect('label: "PQ² = 436/5" accepted', verdict(pq, 'PQ² = 436/5').correct);
  expect('label: "AB^2 = 436/5" (another length) refused', !verdict(pq, 'AB^2 = 436/5').correct);
  const area = { answerType: 'numeric', prompt: 'Find the area of triangle PQR.', answer: { value: 72 } };
  expect('label: "Area = 72" accepted', verdict(area, 'Area = 72').correct);
  expect('label: "Perimeter = 72" refused', !verdict(area, 'Perimeter = 72').correct);
  // A noun label must be the whole asked phrase or its trailing part (#670 review).
  const md = { answerType: 'numeric', prompt: 'Find the mean deviation about the mean of the data.', answer: { value: 2.4 } };
  expect('label: "Mean = 2.4" is not the mean deviation', !verdict(md, 'Mean = 2.4').correct);
  expect('label: "mean deviation = 2.4" accepted', verdict(md, 'mean deviation = 2.4').correct);
  const root = { answerType: 'numeric', prompt: 'Find the cube root of 91125.', answer: { value: 45 } };
  expect('label: "Cube = 45" is not the cube root', !verdict(root, 'Cube = 45').correct);
  expect('label: "cube root = 45" accepted', verdict(root, 'cube root = 45').correct);
  const hence = { answerType: 'numeric', prompt: 'Find the area of triangle ABC, and hence find the height from A.', answer: { value: 8 } };
  expect('label: only the last ask counts: "area = 8" refused', !verdict(hence, 'area = 8').correct);
  expect('label: "height = 8" accepted', verdict(hence, 'height = 8').correct);
  const sum = { answerType: 'numeric', prompt: 'Find $a + b$.', answer: { value: 7 } };
  expect('label: "a = 7" claims a = 7, refused for a + b', !verdict(sum, 'a = 7').correct);
  expect('label: "a + b = 7" accepted', verdict(sum, 'a + b = 7').correct);
  const red = { answerType: 'numeric', prompt: 'Find $P(\\text{red})$ as a fraction in simplest form.', answer: { value: 0.4, simplestFraction: { n: 2, d: 5 } } };
  expect('label: "P(red) = 2/5" accepted', verdict(red, 'P(red) = 2/5').correct);
  expect('label: "P = 2/5" still accepted', verdict(red, 'P = 2/5').correct);
}

// ── Report ─────────────────────────────────────────────────────────────────
const show = list => list.slice(0, REPORT ? list.length : 15).map(f => `  · ${f.id} D${f.d} seed ${f.seed} [${f.type}] ${f.why}: "${String(f.input).replace(/\n/g, ' ⏎ ')}" accepted (key ${f.key}) — ${f.prompt.replace(/\s+/g, ' ').slice(0, 140)}`).join('\n');
const groupCount = list => Object.entries(list.reduce((m, f) => { const k = `${f.id.replace(/#part\d+$/, '')} · ${f.why.replace(/\d+(\.\d+)?/g, 'n')}`; m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);

console.log(`swept ${ids.length} generators × 4 difficulties × ${SEEDS} seeds + ${pyqCount} PYQ payloads: ${totals.questions} questions (${Object.entries(byType).map(([k, v]) => `${k} ${v}`).join(', ')})`);
console.log(`keys accepted ${totals.keysAccepted}, refused ${totals.keysRefused}; ${totals.probes} wrong-answer probes, ${totals.workingProbes} adversarial working pages, ${totals.methodProbes} content-free method pages`);
if (falseNegative.length) console.log(`false negatives (key refused): ${falseNegative.length}\n${show(falseNegative)}`);
if (methodLeaks.length) console.log(`method credit for content-free working: ${methodLeaks.length}\n${groupCount(methodLeaks).slice(0, 20).map(([k, n]) => `  ${n}× ${k}`).join('\n')}\n${show(methodLeaks)}`);
if (falseCorrect.length) console.log(`FALSE CORRECT: ${falseCorrect.length}\n${groupCount(falseCorrect).slice(0, 40).map(([k, n]) => `  ${n}× ${k}`).join('\n')}\n${show(falseCorrect)}`);
if (regressions.length) console.log(`pinned regressions failing: ${regressions.length}\n${regressions.map(r => `  · ${r}`).join('\n')}`);
const failed = falseCorrect.length + methodLeaks.length + falseNegative.length + regressions.length;
console.log(failed
  ? `FALSE-POSITIVE SWEEP: FAIL — ${falseCorrect.length} wrong answers marked correct, ${methodLeaks.length} content-free method credits, ${falseNegative.length} keys refused`
  : `FALSE-POSITIVE SWEEP: PASS — 0 of ${totals.probes + totals.workingProbes} wrong answers marked correct across ${totals.questions} questions (${ids.length} generators × 4 difficulties, ${pyqCount} PYQ payloads), 0 of ${totals.methodProbes} content-free pages given method credit, ${totals.keysAccepted}/${totals.keysAccepted} keys accepted, ${totals.regressions}/${totals.regressions} pinned regressions`);
process.exit(failed ? 1 : 0);
