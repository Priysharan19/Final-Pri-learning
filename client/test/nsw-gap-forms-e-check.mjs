// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras gap forms E: independent answer check
//   y12-appdiff D3 (tangents / normals / stationary points / models)
//   me11-comb   D3 (selections and committees with conditions)
// Every generated key is RE-DERIVED by a different method, from the numbers parsed out of
// the prompt text only: calculus keys by numeric differentiation and fine numeric scans of
// the parsed function; counting keys by brute-force enumeration of the actual selections.
// The key must then be accepted by the deterministic marker, no trap may equal (or be
// accepted as) the key, and no hint may state the final answer.
// SYNTHETIC: in-process generated questions; no evidence about real students.
// Usage: node client/test/nsw-gap-forms-e-check.mjs [seeds]
// ─────────────────────────────────────────────────────────────────────────────
const SRC = new URL('../src/', import.meta.url).href;
const { generateQuestion, loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
const { checkAnswer } = await import(`${SRC}engine/checker.js`);
await loadAllBanks();

const SEEDS = Number(process.argv.find(a => /^\d+$/.test(a))) || 1200;
let failures = 0;
const fails = [];
const fail = (cell, seed, msg, q) => { failures++; if (fails.length < 40) fails.push(`${cell} seed ${seed}: ${msg}${q ? `\n    ${String(q.prompt).slice(0, 220)}` : ''}`); };
const hasBad = o => /undefined|NaN|\[object|Infinity/.test(JSON.stringify(o));
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e * Math.max(1, Math.abs(a), Math.abs(b));

const normSp = s => String(s).replace(/\s+/g, '');
function keyText(q) {
  const a = q.answer;
  if (q.answerType === 'mcq') return String(a.correctIndex);
  if (q.answerType === 'expression') return a.expr;
  if (q.answerType === 'set') return a.values.join(', ');
  return a.canonicalInput || String(a.value);
}
const accepted = (q, text) => { try { return !!checkAnswer(q, String(text)).correct; } catch { return false; } };

function commonChecks(cell, seed, q, finals) {
  if (hasBad(q)) fail(cell, seed, 'undefined/NaN in question', q);
  if (!q.hints || q.hints.length < 3) fail(cell, seed, 'fewer than 3 hints', q);
  if (!q.steps || q.steps.length < 2) fail(cell, seed, 'fewer than 2 steps', q);
  if (!accepted(q, keyText(q))) fail(cell, seed, `marker refused its own key "${keyText(q)}"`, q);
  if (!(q.traps || []).length && q.answerType !== 'mcq') fail(cell, seed, 'no traps', q);
  for (const t of q.traps || []) {
    if (t.expr !== undefined) {
      if (normSp(t.expr) === normSp(q.answer.expr)) fail(cell, seed, `trap equals key (${t.expr})`, q);
      if (accepted(q, t.expr)) fail(cell, seed, `marker accepts trap expression ${t.expr}`, q);
    } else {
      if (q.answer?.value !== undefined && near(t.value, q.answer.value)) fail(cell, seed, `trap equals key (${t.value})`, q);
      if (accepted(q, t.value)) fail(cell, seed, `marker accepts trap value ${t.value}`, q);
    }
    if (!t.why || t.why.length < 15) fail(cell, seed, 'trap without a reason', q);
  }
  if (q.answerType === 'mcq') {
    if (new Set(q.mcqOptions).size !== q.mcqOptions.length) fail(cell, seed, 'duplicate options', q);
    if (q.mcqOptions.length < 3) fail(cell, seed, 'fewer than 3 options', q);
    for (let i = 0; i < q.mcqOptions.length; i++) if (i !== q.answer.correctIndex && accepted(q, String(i))) fail(cell, seed, `marker accepts distractor ${i}`, q);
    const right = q.mcqOptions[q.answer.correctIndex];
    for (const h of q.hints) if (h.includes(right)) fail(cell, seed, `hint states the correct option: ${h}`, q);
  }
  for (const f of new Set(finals)) {
    if (!f || f.length < 3) continue;
    const esc = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![\\d.,])${esc}(?![\\d.]|,\\d)`);
    for (const h of q.hints || []) if (re.test(h)) fail(cell, seed, `hint contains the final answer "${f}": ${h}`, q);
  }
}
const fmtVariants = v => { const s = String(v); return [s, s.replace(/\B(?=(\d{3})+(?!\d))/g, ',')]; };

const cells = {};
function sweep(id, diff, classify, check, wantForms) {
  const cell = `${id} D${diff}`;
  const forms = new Map();
  let n = 0, foreign = 0;
  const dps = new Set();
  for (let seed = 1; seed <= SEEDS; seed++) {
    let q;
    try { q = generateQuestion(id, diff, seed * 7919 + 13); } catch (e) { fail(cell, seed, `generator threw ${e.message}`); continue; }
    if (q.dotpointSource !== 'payload') { foreign++; continue; }
    n++;
    dps.add(q.dotpoint);
    let form;
    try { form = classify(q.prompt); } catch { form = null; }
    if (!form) { fail(cell, seed, 'unrecognised prompt form', q); continue; }
    forms.set(form, (forms.get(form) || 0) + 1);
    try { check(cell, seed, q, form); } catch (e) { fail(cell, seed, `check threw ${e.stack || e.message}`, q); }
  }
  cells[cell] = { n, forms: forms.size, foreign, dps: [...dps].sort(), detail: [...forms].map(([k, v]) => `${k}:${v}`).join(' '), want: wantForms };
  if (forms.size < wantForms) fail(cell, 0, `only ${forms.size} distinct forms (need >= ${wantForms})`);
  if (n < SEEDS * 0.4) fail(cell, 0, `only ${n} payload draws of ${SEEDS}`);
}

// ═════════════ calculus: parse the function from the prompt, differentiate NUMERICALLY
function parsePoly(text, v = 'x') {
  const s = normSp(text).replace(/\\/g, '');
  const terms = s.match(/[+-]?[^+-]+/g) || [];
  const co = {};
  for (const t of terms) {
    const m = t.match(new RegExp(`^([+-]?)(\\d*)(?:${v}(?:\\^(\\d+))?)?$`));
    if (!m) throw new Error(`cannot parse term "${t}" in "${text}"`);
    const hasVar = t.includes(v);
    const mag = m[2] === '' ? (hasVar ? 1 : NaN) : Number(m[2]);
    const pow = hasVar ? (m[3] ? Number(m[3]) : 1) : 0;
    co[pow] = (co[pow] || 0) + (m[1] === '-' ? -mag : mag);
  }
  return x => Object.entries(co).reduce((a, [p, c]) => a + c * x ** Number(p), 0);
}
const H = 1e-4;
const d1 = (f, x) => (f(x + H) - f(x - H)) / (2 * H);
const d2 = (f, x) => (f(x + 1e-3) - 2 * f(x) + f(x - 1e-3)) / 1e-6;
const rnd = v => Math.round(v);
const polyIn = (p, re) => parsePoly(p.match(re)[1]);
const evalLine = (expr, x) => new Function('x', `return (${String(expr).replace(/\s+/g, '').replace(/(\d)x/g, '$1*x')});`)(x);

const appClass = p => {
  if (/\*\*normal\*\*/.test(p)) return 'normal';
  if (/has gradient \$-?\d+\$ at two points/.test(p)) return 'tangent-gradient-x';
  if (/Which statement describes it/.test(p)) return 'stationary-nature-mcq';
  if (/crosses the \$x\$-axis at \$A\$/.test(p)) return 'tangent-x-axis';
  if (/greatest height|least volume/.test(p)) return /greatest/.test(p) ? 'model-max' : 'model-min';
  if (/is increasing for|is decreasing for/.test(p)) return 'increasing-interval';
  return null;
};
sweep('y12-appdiff', 3, appClass, (cell, seed, q, form) => {
  const p = q.prompt;
  const dpWant = { 'stationary-nature-mcq': 'y12-appdiff.1', 'increasing-interval': 'y12-appdiff.1', 'model-max': 'y12-appdiff.3', 'model-min': 'y12-appdiff.3' };
  if (q.dotpoint !== (dpWant[form] || 'y12-appdiff.2')) fail(cell, seed, `dot point ${q.dotpoint} unexpected for ${form}`, q);
  let finals = [];
  if (form === 'normal') {
    const f = polyIn(p, /y = ([^$]+)\$ at the point/);
    const x0 = Number(p.match(/x = (-?\d+)\$/)[1]);
    const m = d1(f, x0), y0 = f(x0);
    if (Math.abs(m) < 1e-3) return fail(cell, seed, 'vertical normal', q);
    const lineAt = x => evalLine(q.answer.expr, x);
    if (!near(lineAt(x0), y0, 1e-6)) fail(cell, seed, `normal does not pass through (${x0}, ${y0}): gives ${lineAt(x0)}`, q);
    const slope = lineAt(1) - lineAt(0);
    if (!near(slope * m, -1, 1e-5)) fail(cell, seed, `normal slope ${slope} times tangent slope ${m} is not -1`, q);
    if (!/^[+-]?\s*(\d*x(\/\d+)?)?\s*([+-]\s*\d+(\/\d+)?)?$/.test(q.answer.expr)) fail(cell, seed, `odd key format ${q.answer.expr}`, q);
    finals = [q.answer.expr, normSp(q.answer.expr)];
    for (const h of q.hints) if (new RegExp('(?<![-\\d.x/])' + normSp(q.answer.expr).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\d/])').test(normSp(h))) fail(cell, seed, `hint contains key line: ${h}`, q);
    // equivalent spellings must be accepted by the marker
    if (!accepted(q, `y = ${q.answer.expr}`)) fail(cell, seed, 'marker refuses "y = key"', q);
    commonChecks(cell, seed, q, []);
    return;
  }
  if (form === 'tangent-gradient-x') {
    const g = Number(p.match(/has gradient \$(-?\d+)\$/)[1]);
    const f = polyIn(p, /y = ([^$]+)\$ has gradient/);
    const roots = [];
    for (let x = -30; x <= 30; x += 1e-3) {
      const a = d1(f, x) - g, b = d1(f, x + 1e-3) - g;
      if (a === 0 || a * b < 0) roots.push(Math.round((x + (a === 0 ? 0 : 5e-4)) * 100) / 100);
    }
    const got = [...new Set(roots.map(r => Math.round(r)))].sort((a, b) => a - b);
    if (got.length !== 2 || roots.some(r => Math.abs(r - Math.round(r)) > 0.02)) fail(cell, seed, `scan found roots ${roots}`, q);
    if (JSON.stringify(got) !== JSON.stringify(q.answer.values)) fail(cell, seed, `key ${q.answer.values} ≠ scanned ${got}`, q);
    finals = [`x = ${got[0]}`, `x = ${got[1]}`];
    commonChecks(cell, seed, q, finals);
    return;
  }
  if (form === 'stationary-nature-mcq') {
    const f = polyIn(p, /y = ([^$]+)\$ has a stationary/);
    const at = Number(p.match(/at \$x = (-?\d+)\$/)[1]);
    if (Math.abs(d1(f, at)) > 1e-4) fail(cell, seed, 'x is not stationary', q);
    const sec = d2(f, at);
    const kind = sec > 0.5 ? 'minimum' : sec < -0.5 ? 'maximum' : 'inflexion';
    const want = `Local ${kind} at (${at}, ${rnd(f(at))})`;
    if (q.mcqOptions[q.answer.correctIndex] !== want) fail(cell, seed, `key "${q.mcqOptions[q.answer.correctIndex]}" ≠ derived "${want}"`, q);
    const dupSemantics = q.mcqOptions.filter((o, i) => i !== q.answer.correctIndex && o === want);
    if (dupSemantics.length) fail(cell, seed, 'distractor equals the key', q);
    commonChecks(cell, seed, q, []);
    return;
  }
  if (form === 'tangent-x-axis') {
    const f = polyIn(p, /y = ([^$]+)\$ at the point/);
    const x0 = Number(p.match(/where \$x = (-?\d+)\$/)[1]);
    const m = d1(f, x0), y0 = f(x0);
    // walk along the tangent line until it reaches y = 0 (bisection on the line, independent of the closed form)
    const tan = x => y0 + m * (x - x0);
    let lo = -200, hi = 200;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (tan(lo) * tan(mid) <= 0) hi = mid; else lo = mid; }
    const want = rnd((lo + hi) / 2);
    if (!near(lo, want, 1e-6)) fail(cell, seed, `non-integer intercept ${lo}`, q);
    if (q.answer.value !== want) fail(cell, seed, `key ${q.answer.value} ≠ derived ${want}`, q);
    commonChecks(cell, seed, q, fmtVariants(want));
    return;
  }
  if (form === 'model-max' || form === 'model-min') {
    const f = parsePoly(p.match(/\((?:t)\) = ([^$]+)\$ for/)[1], 't');
    let best = f(0), bt = 0;
    for (let t = 0; t <= 60; t += 0.001) { const v = f(t); if (form === 'model-max' ? v > best : v < best) { best = v; bt = t; } }
    const want = rnd(best);
    if (!near(best, want, 1e-4)) fail(cell, seed, `scan extreme ${best} not whole`, q);
    if (bt <= 0.5 || bt > 59) fail(cell, seed, `extreme at the boundary t = ${bt}`, q);
    if (q.answer.value !== want) fail(cell, seed, `key ${q.answer.value} ≠ scanned ${want}`, q);
    commonChecks(cell, seed, q, fmtVariants(want));
    return;
  }
  if (form === 'increasing-interval') {
    const f = polyIn(p, /y = ([^$]+)\$ is (?:increasing|decreasing)/);
    const flips = [];
    let prev = Math.sign(d1(f, -40));
    for (let x = -40; x <= 40; x += 1e-3) { const s = Math.sign(d1(f, x)); if (s !== prev && s !== 0) { flips.push(Math.round(x * 100) / 100); prev = s; } }
    if (flips.length !== 2 || flips.some(v => Math.abs(v - Math.round(v)) > 0.02)) fail(cell, seed, `sign changes at ${flips}`, q);
    const [a, b] = flips.map(Math.round);
    const mid = d1(f, (a + b) / 2);
    const increasingOutside = mid < 0;
    if (/is increasing/.test(p)) { if (!increasingOutside) fail(cell, seed, 'prompt says increasing outside; scan says inside', q); if (q.answer.value !== b) fail(cell, seed, `key ${q.answer.value} ≠ b ${b}`, q); }
    else { if (!increasingOutside) fail(cell, seed, 'prompt says decreasing inside; scan disagrees', q); if (q.answer.value !== b - a) fail(cell, seed, `key ${q.answer.value} ≠ b - a ${b - a}`, q); }
    commonChecks(cell, seed, q, fmtVariants(q.answer.value));
    return;
  }
}, 6);

// ═════════════ counting: brute-force enumeration of actual subsets
function combosOf(n, k, cb, start = 0, cur = []) {
  if (cur.length === k) { cb(cur); return; }
  for (let i = start; i < n; i++) { cur.push(i); combosOf(n, k, cb, i + 1, cur); cur.pop(); }
}
const memo = new Map();
const memoised = (key, fn) => { if (!memo.has(key)) memo.set(key, fn()); return memo.get(key); };
const ints = p => [...p.matchAll(/\$(\d+)\$/g)].map(m => Number(m[1]));
const combClass = p => {
  if (/must \*\*both\*\* be on/.test(p)) return 'both-serve';
  if (/must \*\*not both\*\* be on/.test(p)) return 'not-both-serve';
  if (/standard pack of \$52\$/.test(p)) return 'cards-at-least-one-ace';
  if (/appointed captain/.test(p)) return 'team-captain';
  if (/lie on a circle/.test(p)) return 'circle-fixed-vertex';
  if (/contains \*\*none\*\* of the unsuitable/.test(p)) return 'exclude-set';
  if (/a president is chosen/.test(p)) return 'president-committee';
  return null;
};
sweep('me11-comb', 3, combClass, (cell, seed, q, form) => {
  const p = q.prompt;
  if (q.dotpoint !== 'me11-comb.2') fail(cell, seed, `dot point ${q.dotpoint}, want me11-comb.2`, q);
  const I = ints(p);
  let want;
  if (form === 'both-serve' || form === 'not-both-serve') {
    const [k, n] = I;
    want = memoised(`${form}${n}${k}`, () => { let c = 0; combosOf(n, k, s => { const both = s.includes(0) && s.includes(1); if (form === 'both-serve' ? both : !both) c++; }); return c; });
  } else if (form === 'cards-at-least-one-ace') {
    const k = I[0];
    want = memoised(`cards${k}`, () => { let c = 0; combosOf(52, k, s => { if (s.some(x => x < 4)) c++; }); return c; });   // cards 0..3 are the aces
    if (I[2] !== 4) fail(cell, seed, 'ace count not 4', q);
  } else if (form === 'team-captain') {
    const [k, n] = I;
    want = memoised(`cap${n}${k}`, () => { let c = 0; combosOf(n, k, s => { for (let cap = 0; cap < s.length; cap++) c++; }); return c; });
  } else if (form === 'circle-fixed-vertex') {
    const [n, k0] = [I[0], /triangles/.test(p) ? 3 : 4];
    want = memoised(`circ${n}${k0}`, () => { let c = 0; combosOf(n, k0, s => { if (s.includes(0)) c++; }); return c; });
  } else if (form === 'exclude-set') {
    const [n, m, k] = I;
    want = memoised(`ex${n}${m}${k}`, () => { let c = 0; combosOf(n, k, s => { if (s.every(x => x >= m)) c++; }); return c; });
  } else if (form === 'president-committee') {
    const [n, k] = I;
    want = memoised(`pres${n}${k}`, () => {
      let c = 0;
      for (let pres = 0; pres < n; pres++) combosOf(n, k, s => { if (!s.includes(pres)) c++; });
      return c;
    });
  }
  if (q.answerType !== 'numeric') return fail(cell, seed, 'expected numeric', q);
  if (q.answer.value !== want) fail(cell, seed, `key ${q.answer.value} ≠ enumerated ${want} (${form})`, q);
  if (!Number.isInteger(q.answer.value) || q.answer.value <= 0) fail(cell, seed, 'key not a positive whole number', q);
  if (/pigeon/i.test(p)) fail(cell, seed, 'pigeonhole wording', q);
  commonChecks(cell, seed, q, fmtVariants(q.answer.value));
}, 6);

// ── summary ─────────────────────────────────────────────────────────────────
for (const [cell, v] of Object.entries(cells)) {
  const ok = v.forms >= v.want;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${cell.padEnd(16)} ${v.n} questions, ${v.forms} forms, ordinals ${v.dps.join('/')}${v.foreign ? `, +${v.foreign} draws of other pre-existing forms (not checked)` : ''}\n        ${v.detail}`);
}
if (failures) { console.log(`\n${failures} failure(s):`); for (const f of fails) console.log(' - ' + f); console.log('\nFAIL'); process.exit(1); }
console.log('\nPASS: all keys re-derived independently (numeric calculus / brute-force enumeration), marker accepts every key, no trap equals the key, no hint leaks the answer.');
