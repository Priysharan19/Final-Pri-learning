// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras content-gap forms A: independent answer check
//   y8-equations D1, y8-linear D4, y11-trigfunc D4, y11-quadfunc D1
// Every generated key is RE-DERIVED here by a different method, working from the
// numbers in the prompt text only (brute force over integers or degrees, direct
// numeric evaluation of the prompt's own expression), then compared with the
// generator's key and run through the deterministic marker.
// SYNTHETIC: in-process generated questions; no evidence about real students.
// Usage: node client/test/nsw-gap-forms-a-check.mjs [seeds]
// ─────────────────────────────────────────────────────────────────────────────
const SRC = new URL('../src/', import.meta.url).href;
const { generateQuestion, loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
const { checkAnswer } = await import(`${SRC}engine/checker.js`);
await loadAllBanks();

const SEEDS = Number(process.argv.find(a => /^\d+$/.test(a))) || 300;
let failures = 0;
const fails = [];
const fail = (cell, seed, msg, q) => { failures++; if (fails.length < 40) fails.push(`${cell} seed ${seed}: ${msg}${q ? `\n    ${String(q.prompt).slice(0, 160)}` : ''}`); };

// ── prompt → JS evaluators (independent of the generators) ─────────────────
/** LaTeX fragment in x (or θ as T, or k) → JS function body expression. */
function toJs(src, vars) {
  let s = src.replace(/\\left|\\right/g, '').replace(/\\dfrac|\\frac/g, '\\frac');
  for (let i = 0; i < 4; i++) s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))');
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, '(Math.sqrt($1))')
    .replace(/\\(sin|cos|tan)\^2\(\\theta\)/g, '((Math.$1(T))**2)')
    .replace(/\\(sin|cos|tan)\(\\theta\)/g, '(Math.$1(T))')
    .replace(/([a-zA-Z])\^\{?(\d+)\}?/g, '($1**$2)')
    .replace(/\\times/g, '*').replace(/−/g, '-');
  // implicit multiplication: digit/')' before a letter-var, 'Math' or '('
  const v = vars.join('');
  s = s.replace(new RegExp(`([${v}])(?=[${v}])`, 'g'), '$1*')
    .replace(new RegExp(`(\\d|\\))\\s*(?=[${v}]|Math|\\()`, 'g'), '$1*')
    .replace(new RegExp(`([${v}])\\s*(?=\\(|Math|\\d)`, 'g'), '$1*')
    .replace(/\)\s*(?=\()/g, ')*');
  return s;
}
const fnOf = (src, vars) => new Function(...vars, `return (${src});`);
/** Residual lhs − rhs of an equation string as a JS function of the given vars. */
function residual(eq, vars) {
  const parts = eq.split('=');
  if (parts.length !== 2) throw new Error(`not an equation: ${eq}`);
  return fnOf(`(${toJs(parts[0], vars)}) - (${toJs(parts[1], vars)})`, vars);
}
const mathSegments = p => [...String(p).matchAll(/\$([^$]+)\$/g)].map(m => m[1]);
const eqSegment = p => mathSegments(p).find(s => s.includes('='));
const hasBad = o => /undefined|NaN|\[object|Infinity/.test(JSON.stringify(o));
const skeleton = p => String(p).replace(/-?\d+(\.\d+)?/g, '#').replace(/\s+/g, ' ');
const evalTyped = t => new Function(`return (${String(t).replace(/sqrt\(/g, 'Math.sqrt(').replace(/(\d)Math/g, '$1*Math')});`)();
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e * Math.max(1, Math.abs(a), Math.abs(b));
const SETINT = (f, lo, hi) => { const out = []; for (let t = lo; t <= hi; t++) { const r = f(t); if (r) out.push(t); } return out; };

function textOf(q) { return [q.prompt, ...(q.hints || []), ...(q.steps || []).map(s => s.d), ...(q.mcqOptions || [])].join(' '); }

function commonChecks(cell, seed, q, keyStr, finals) {
  if (hasBad(q)) fail(cell, seed, 'undefined/NaN in question text', q);
  // the marker must accept the key as the answer box would hold it
  let v;
  try { v = checkAnswer(q, keyStr); } catch (e) { v = { correct: false, feedback: `threw ${e.message}` }; }
  if (!v.correct) fail(cell, seed, `marker refused its own key "${keyStr}": ${v.feedback || ''}`, q);
  // a listed trap value is never the key
  for (const t of q.traps || []) if (Number.isFinite(t.value) && q.answer?.value !== undefined && near(t.value, q.answer.value, 1e-9)) fail(cell, seed, `trap equals key (${t.value})`, q);
  // hints never state the final answer
  for (const f of new Set(finals)) {
    const esc = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // the unknown stated as the result ("x = 5", "m = -2"), not an intermediate line that happens to share the number
    const lead = (q.answerPrefix || '').replace(/\s*=.*$/, '') || '(?:\\\\Delta|answer|is)';
    const stated = new RegExp(`(?<![-+]\\s)(?<![\\w])${lead}\\s*=?\\s*\\$?\\s*${esc}(?![\\w.])`);
    for (const h of q.hints || []) if (stated.test(h) || (f.length >= 5 && h.includes(f))) fail(cell, seed, `hint states the final answer "${f}": ${h}`, q);
  }
}

function keyText(q) {
  const a = q.answer;
  if (q.answerType === 'mcq') return String(a.correctIndex);
  if (q.answerType === 'set') return a.values.join(', ');
  if (q.answerType === 'expression') return a.expr;
  return a.canonicalInput || String(a.value);
}

const cells = {};
function sweep(id, diff, check) {
  const cell = `${id} D${diff}`;
  const seen = new Map();
  let n = 0, foreign = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    let q;
    try { q = generateQuestion(id, diff, seed * 7919 + 13); } catch (e) { fail(cell, seed, `generator threw ${e.message}`); continue; }
    if (q.dotpointSource !== 'payload') { foreign++; continue; }   // a pre-existing form of the cell, not ours
    n++;
    seen.set(skeleton(q.prompt), (seen.get(skeleton(q.prompt)) || 0) + 1);
    try { check(cell, seed, q); } catch (e) { fail(cell, seed, `check threw ${e.message}`, q); }
  }
  const forms = seen.size;
  cells[cell] = { n, forms, foreign };
  if (forms < 4) fail(cell, 0, `only ${forms} distinct prompt skeletons (need ≥ 4)`);
}

// ═════════════ y8-equations D1: brute-force integer solve of the prompt's equation
sweep('y8-equations', 1, (cell, seed, q) => {
  const eq = eqSegment(q.prompt);
  if (!eq) return fail(cell, seed, 'no equation found in prompt', q);
  if (!/\(/.test(eq)) fail(cell, seed, 'equation has no bracket', q);
  const r = residual(eq, ['x']);
  const sols = SETINT(x => Math.abs(r(x)) < 1e-9, -300, 300);
  if (sols.length !== 1) return fail(cell, seed, `brute force found ${sols.length} integer solutions`, q);
  if (q.answerType !== 'numeric' || q.answer.value !== sols[0]) fail(cell, seed, `key ${q.answer.value} ≠ brute-force ${sols[0]}`, q);
  if (q.dotpointSource !== 'payload' || q.dotpoint !== 'y8-equations.1') fail(cell, seed, `dot point ${q.dotpoint}/${q.dotpointSource}, want payload y8-equations.1 (ordinal 0)`, q);
  if (q.stepcheck && !(q.stepcheck.solutions || []).every(s => s === sols[0])) fail(cell, seed, 'stepcheck solution differs', q);
  commonChecks(cell, seed, q, keyText(q), [String(sols[0])]);
});

// ═════════════ y8-linear D4
sweep('y8-linear', 4, (cell, seed, q) => {
  const p = q.prompt;
  if (q.dotpointSource !== 'payload' || !['y8-linear.2', 'y8-linear.3'].includes(q.dotpoint)) fail(cell, seed, `dot point ${q.dotpoint}/${q.dotpointSource}, want ordinal 1 or 2`, q);
  const pts = [...p.matchAll(/\((-?\d+), (-?\d+)\)/g)].map(m => [Number(m[1]), Number(m[2])]);
  const line = mathSegments(p).find(s => /^y = /.test(s) && !/mx/.test(s));
  let ok = null;
  if (q.answerType === 'expression') {
    // numeric check: the key line passes through the stated point(s) with the stated gradient
    const keyFn = new Function('x', `return ${toJs(q.answer.expr, ['x'])};`);
    if (/through \$\(.*\)\$ and \$\(/.test(p) || pts.length === 2) {
      for (const [x, y] of pts) if (!near(keyFn(x), y)) fail(cell, seed, `key line misses point (${x}, ${y})`, q);
    } else {
      const g = Number((p.match(/gradient \$(-?\d+)\$/) || [])[1]);
      if (!Number.isFinite(g) || pts.length !== 1) return fail(cell, seed, 'cannot parse gradient/point form', q);
      if (!near(keyFn(1) - keyFn(0), g) || !near(keyFn(pts[0][0]), pts[0][1])) fail(cell, seed, 'key line disagrees with gradient/point', q);
    }
    // the marker refuses a line with the right gradient but the wrong intercept
    const wrong = `${q.answer.expr} + 1`;
    if (checkAnswer(q, wrong).correct) fail(cell, seed, 'marker accepted a shifted line', q);
    ok = true;
  } else if (/respectively/.test(p)) {                       // table of values
    const nums = mathSegments(p).filter(s => /^-?\d+(, -?\d+)+$/.test(s)).map(s => s.split(', ').map(Number));
    const [xs, ys] = nums;
    const grads = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]));
    if (!grads.every(g => near(g, grads[0]))) return fail(cell, seed, 'table is not linear', q);
    if (q.answer.value !== grads[0]) fail(cell, seed, `key ${q.answer.value} ≠ table gradient ${grads[0]}`, q);
    ok = true;
  } else if (/parallel/.test(p)) {                           // parallel line, y-intercept
    const base = mathSegments(p)[0].replace(/^y = /, '');
    const f = new Function('x', `return ${toJs(base, ['x'])};`);
    const m = f(1) - f(0);
    const [px, py] = pts[0];
    const c = py - m * px;
    if (q.answer.value !== c) fail(cell, seed, `key ${q.answer.value} ≠ ${c}`, q);
    ok = true;
  } else if (/Find its y-intercept/.test(p)) { // ax + by = c  → y-intercept
    const eq = eqSegment(p);
    const r = residual(eq, ['x', 'y']);
    // y-intercept: solve r(0, y) = 0 by brute force over integers
    const ys = SETINT(y => Math.abs(r(0, y)) < 1e-9, -400, 400);
    if (ys.length !== 1 || q.answer.value !== ys[0]) fail(cell, seed, `key ${q.answer.value} ≠ brute-force y-intercept ${ys}`, q);
    ok = true;
  } else if (q.answerType === 'mcq') {                       // k·y = p·x + q
    const eq = eqSegment(p);
    const r = residual(eq, ['x', 'y']);
    // recover y = m x + c numerically: for x=0 and x=1 find y by solving the linear residual
    const solveY = x => { const f0 = r(x, 0), f1 = r(x, 1); return -f0 / (f1 - f0); };
    const c = solveY(0), m = solveY(1) - solveY(0);
    const want = `gradient $${m}$, y-intercept $${c}$`;
    if (q.mcqOptions[q.answer.correctIndex] !== want) fail(cell, seed, `mcq key "${q.mcqOptions[q.answer.correctIndex]}" ≠ "${want}"`, q);
    if (new Set(q.mcqOptions).size !== q.mcqOptions.length) fail(cell, seed, 'duplicate options', q);
    ok = true;
  } else if (/Rearrange/.test(p)) {                          // p x + y = q  → gradient
    const eq = eqSegment(p);
    const r = residual(eq, ['x', 'y']);
    const solveY = x => { const f0 = r(x, 0), f1 = r(x, 1); return -f0 / (f1 - f0); };
    const m = solveY(1) - solveY(0);
    if (q.answer.value !== m) fail(cell, seed, `key ${q.answer.value} ≠ gradient ${m}`, q);
    ok = true;
  }
  if (!ok) fail(cell, seed, 'unrecognised y8-linear D4 form', q);
  commonChecks(cell, seed, q, keyText(q), q.answerType === 'numeric' ? [String(q.answer.value).length >= 2 ? `${q.answer.value}` : `= ${q.answer.value}`] : []);
});

// ═════════════ y11-trigfunc D4
sweep('y11-trigfunc', 4, (cell, seed, q) => {
  const p = q.prompt;
  if (q.dotpointSource !== 'payload' || !['y11-trigfunc.2', 'y11-trigfunc.3'].includes(q.dotpoint)) fail(cell, seed, `dot point ${q.dotpoint}/${q.dotpointSource}, want ordinal 1 or 2`, q);
  const deg = Math.PI / 180;
  const rd = x => x * deg;
  if (q.answerType === 'numeric') {
    // exact value of a trig expression in degrees: evaluate with Math.*
    const body = mathSegments(p)[0];
    const js = body.replace(/\\(sin|cos|tan)\((-?\d+)°\)/g, (_, f, a) => `Math.${f}(${rd(Number(a))})`)
      .replace(/\)\s*Math/g, ')*Math');
    const truth = new Function(`return ${js};`)();
    if (!near(q.answer.value, truth, 1e-9)) fail(cell, seed, `key ${q.answer.value} ≠ Math value ${truth}`, q);
    const typed = evalTyped(q.answer.canonicalInput);
    if (!near(typed, truth, 1e-9)) fail(cell, seed, `canonical "${q.answer.canonicalInput}" = ${typed} ≠ ${truth}`, q);
    if (!q.answer.requireExact) fail(cell, seed, 'exact key without requireExact', q);
    const dec = checkAnswer(q, String(Number(truth.toFixed(4))));
    if (dec.correct && /sqrt/.test(q.answer.canonicalInput)) fail(cell, seed, 'marker accepted a rounded decimal for an exact value', q);
    const neg = checkAnswer(q, `-(${q.answer.canonicalInput})`);
    if (neg.correct) fail(cell, seed, 'marker accepted the negated value', q);
    commonChecks(cell, seed, q, q.answer.canonicalInput, [q.answer.canonicalInput]);
  } else if (q.answerType === 'set') {
    const eq = eqSegment(p);
    const dm = p.match(/(-?\d+)° \\le \\theta \\le (-?\d+)°/);
    const lo = Number(dm[1]), hi = Number(dm[2]);
    const eqOnly = eq.split('\\le')[0].replace(/\s*for.*$/, '');
    const r = residual(eqOnly, ['T']);
    const sols = SETINT(t => { const R = rd(t); if (/\\tan/.test(eqOnly) && Math.abs(Math.cos(R)) < 1e-9) return false; return Math.abs(r(R)) < 1e-9; }, lo, hi);
    // the generator's integer scan could in principle miss; confirm each key value and the full set
    if (JSON.stringify(sols) !== JSON.stringify(q.answer.values)) fail(cell, seed, `key [${q.answer.values}] ≠ brute-force [${sols}] on [${lo}, ${hi}]`, q);
    if (!sols.length) fail(cell, seed, 'empty solution set', q);
    // a dropped solution must be refused
    if (sols.length > 1 && checkAnswer(q, sols.slice(1).join(', ')).correct) fail(cell, seed, 'marker accepted a dropped solution', q);
    commonChecks(cell, seed, q, keyText(q), []);
  } else fail(cell, seed, `unexpected answer type ${q.answerType}`, q);
});

// ═════════════ y11-quadfunc D1
const discOf = (r) => { const f = x => r(x); const c = f(0), a = (f(1) + f(-1)) / 2 - c, b = (f(1) - f(-1)) / 2; return { a, b, c, d: b * b - 4 * a * c }; };
sweep('y11-quadfunc', 1, (cell, seed, q) => {
  const p = q.prompt;
  if (q.dotpointSource !== 'payload' || q.dotpoint !== 'y11-quadfunc.2') fail(cell, seed, `dot point ${q.dotpoint}/${q.dotpointSource}, want ordinal 1`, q);
  if (q.answerPrefix && /Δ/.test(q.answerPrefix)) fail(cell, seed, 'Δ answerPrefix still present', q);
  if (/exactly one|all values of \$k\$/.test(p)) {
    const eq = eqSegment(p);
    const rk = residual(eq, ['x', 'k']);
    const kd = k => discOf(x => rk(x, k)).d;
    const ks = SETINT(k => Math.abs(kd(k)) < 1e-9, -60, 60);
    const given = q.answerType === 'set' ? q.answer.values : [q.answer.value];
    if (/\(repeated\)/.test(p)) { if (JSON.stringify(ks) !== JSON.stringify(given)) fail(cell, seed, `key [${given}] ≠ brute-force k [${ks}]`, q); }
    else if (JSON.stringify(ks) !== JSON.stringify(given)) fail(cell, seed, `key [${given}] ≠ brute-force k [${ks}]`, q);
    if (q.answerType === 'set' && checkAnswer(q, String(given[0])).correct) fail(cell, seed, 'marker accepted a single value of a two-value set', q);
  } else if (q.answerType === 'mcq') {
    const eq = eqSegment(p);
    const { d } = discOf(residual(eq, ['x']));
    const want = d > 0 ? 'two distinct real roots' : d === 0 ? 'one repeated real root' : 'no real roots';
    if (q.mcqOptions[q.answer.correctIndex] !== want) fail(cell, seed, `mcq key "${q.mcqOptions[q.answer.correctIndex]}" ≠ "${want}"`, q);
    if (new Set(q.mcqOptions).size !== q.mcqOptions.length) fail(cell, seed, 'duplicate options', q);
    if (q.mcqOptions.length < 3) fail(cell, seed, 'fewer than 3 options', q);
  } else {
    const eq = eqSegment(p);
    // base form is "poly = 0"; rearranged forms carry a non-zero right-hand side
    const { d } = discOf(residual(eq, ['x']));
    if (/How many real roots/.test(p)) { const n = d > 0 ? 2 : d === 0 ? 1 : 0; if (q.answer.value !== n) fail(cell, seed, `roots key ${q.answer.value} ≠ ${n}`, q); }
    else if (q.answer.value !== d) fail(cell, seed, `discriminant key ${q.answer.value} ≠ ${d}`, q);
  }
  commonChecks(cell, seed, q, keyText(q), q.answerType === 'numeric' ? [String(q.answer.value).length >= 2 ? `${q.answer.value}` : `= ${q.answer.value}`] : []);
});

// ── summary ─────────────────────────────────────────────────────────────────
for (const [cell, v] of Object.entries(cells)) console.log(`${v.forms >= 4 ? 'PASS' : 'FAIL'}  ${cell.padEnd(18)} ${v.n} questions, ${v.forms} distinct prompt skeletons${v.foreign ? ` (+${v.foreign} draws of other, pre-existing forms of the cell with no payload dot point, not checked here)` : ''}`);
if (failures) { console.log(`\n${failures} failure(s):`); for (const f of fails) console.log(' - ' + f); console.log('\nFAIL'); process.exit(1); }
console.log('\nPASS: all keys re-derived independently, marker accepts every key, no hint leaks the answer.');
