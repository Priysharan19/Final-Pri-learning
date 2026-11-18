// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras content-gap forms D: independent answer check
//   me12-calc D3 (volumes of revolution)   me12-calc D4 (areas between curves)
// Every generated key is RE-DERIVED from the numbers/curves parsed out of the prompt
// text, by composite Simpson integration of the geometric definition (discs/washers
// of the cross-section, or shells for rotation about the y-axis; area = integral of
// |upper - lower| between numerically located intersections, or horizontal strips).
// The generator's closed forms are never reused. The marker must accept the printed
// canonical key and reject every trap; no hint may state the final answer.
// SYNTHETIC: in-process generated questions; no evidence about real students.
// Usage: node client/test/nsw-gap-forms-d-check.mjs [seeds]
// ─────────────────────────────────────────────────────────────────────────────
const SRC = new URL('../src/', import.meta.url).href;
const { generateQuestion, loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
const { checkAnswer } = await import(`${SRC}engine/checker.js`);
await loadAllBanks();

const SEEDS = Number(process.argv.find(a => /^\d+$/.test(a))) || 1200;
const N = 20000;                       // Simpson intervals (>= 4000)
let failures = 0;
const fails = [];
const fail = (cell, seed, msg, q) => { failures++; if (fails.length < 40) fails.push(`${cell} seed ${seed}: ${msg}${q ? `\n    ${String(q.prompt).slice(0, 220)}` : ''}`); };
const hasBad = o => /undefined|NaN|\[object|Infinity/.test(JSON.stringify(o));
const skeleton = p => String(p).replace(/-?\d+(\.\d+)?/g, '#').replace(/\s+/g, ' ');

// composite Simpson
function simpson(f, a, b, n = N) {
  if (n % 2) n++;
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return s * h / 3;
}
// LaTeX fragment -> JS function of (x) (or of the variable named)
function toFn(tex, v = 'x') {
  let s = tex.replace(/\\dfrac\{([^{}]+)\}\{([^{}]+)\}/g, '(($1)/($2))').replace(/\\sqrt\{([^{}]+)\}/g, 'Math.sqrt($1)').replace(/\s+/g, '');
  s = s.replace(/\^/g, '**').replace(/(\d)([xy(])/g, '$1*$2').replace(/([xy)])\(/g, '$1*(').replace(/([xy])([xy])/g, '$1*$2').replace(/\)(\d|[xy])/g, ')*$1');
  return new Function(v, `return ${s};`);
}
// zeros of h on [lo, hi]: sign changes (bisected) plus exact/near-zero grid points
function zeros(h, lo, hi) {
  const out = [];
  const step = 0.0005;
  let px = lo, pv = h(lo);
  if (Math.abs(pv) < 1e-12) out.push(lo);
  for (let x = lo + step; x <= hi + 1e-12; x += step) {
    const v = h(x);
    if (Math.abs(v) < 1e-12) out.push(x);
    else if (pv * v < 0) {
      let a = px, b = x;
      for (let i = 0; i < 80; i++) { const m = (a + b) / 2; if (h(a) * h(m) <= 0) b = m; else a = m; }
      out.push((a + b) / 2);
    }
    px = x; pv = v;
  }
  return out;
}
const areaBetween = (f, g, lo, hi) => {
  const z = zeros(x => f(x) - g(x), lo, hi);
  return simpson(x => Math.abs(f(x) - g(x)), Math.min(...z), Math.max(...z));
};
const seg = p => [...String(p).matchAll(/\$([^$]+)\$/g)].map(m => m[1]);
const num = s => Number(s === '' ? 1 : s);

// ── classify + re-derive ────────────────────────────────────────────────────
// each entry: [name, regex, derive(match) -> coefficient (volumes: V/pi; areas: A)]
const VOL = [
  ['sqrt-x-axis', /curve \$y = \\sqrt\{(\d*)x \+ (\d+)\}\$.*line \$x = (\d+)\$ is rotated about the \$x\$-axis/,
    m => simpson(x => Math.sqrt(num(m[1]) * x + Number(m[2])) ** 2, 0, Number(m[3]))],
  ['parabola-x-axis', /parabola \$y = x\^2\$, the \$x\$-axis and the line \$x = (\d+)\$ is rotated about the \$x\$-axis/,
    m => simpson(x => (x * x) ** 2, 0, Number(m[1]))],
  ['reciprocal-x-axis', /\$y = \\dfrac\{1\}\{x\}\$, the \$x\$-axis and the lines \$x = (\d+)\$ and \$x = (\d+)\$ is rotated about the \$x\$-axis/,
    m => simpson(x => (1 / x) ** 2, Number(m[1]), Number(m[2]))],
  ['washer-parabola-line', /parabola \$y = x\^2\$ and the line \$y = (\d+)x\$ is rotated about the \$x\$-axis/,
    m => { const R = x => Number(m[1]) * x, r = x => x * x, z = zeros(x => R(x) - r(x), 0, 20); return simpson(x => R(x) ** 2 - r(x) ** 2, Math.min(...z), Math.max(...z)); }],
  ['washer-sqrt-line', /curve \$y = \\sqrt\{(\d+)x\}\$ and the line \$y = x\$ enclose a region\. The region is rotated about the \$x\$-axis/,
    m => { const R = x => Math.sqrt(Number(m[1]) * x), r = x => x, z = zeros(x => R(x) - r(x), 0, 30); return simpson(x => R(x) ** 2 - r(x) ** 2, Math.min(...z), Math.max(...z), 40000); }],
  // rotation about the y-axis, done by cylindrical SHELLS (2*pi*x*height), a different decomposition from the discs in y
  ['cubic-region', /curve \$y = x\(x - (\d+)\)\$ and the \$x\$-axis is rotated about the \$x\$-axis/,
    m => { const f = toFn(`x(x-${m[1]})`); const z = zeros(f, -1, 20); return simpson(x => f(x) ** 2, Math.min(...z), Math.max(...z)); }]
];
const AREA = [
  ['parabola-line', /parabola \$y = x\^2\$ and the line \$y = (.+)\$\.$/,
    m => areaBetween(x => x * x, toFn(m[1]), -20, 20)],
  ['two-parabolas', /parabolas \$y = (.+)\$ and \$y = (.+)\$\.$/,
    m => areaBetween(toFn(m[1]), toFn(m[2]), -20, 20)],
  ['x^2+k-yaxis', /curve \$y = x\^2 \+ (\d+)\$ \(for \$x \\ge 0\$\), the \$y\$-axis and the line \$y = (\d+)\$\.$/,
    m => { const k = Number(m[1]), h = Number(m[2]); const z = zeros(x => x * x + k - h, 0, 20); return simpson(x => h - (x * x + k), 0, Math.max(...z)); }],
  ['cubic-line', /curve \$y = x\^3\$ and the line \$y = (\d+)x\$\.$/,
    m => areaBetween(x => x ** 3, x => Number(m[1]) * x, 0, 30)],
  ['sqrt-line', /curve \$y = \\sqrt\{x\}\$ and the line \$y = \\dfrac\{x\}\{(\d+)\}\$\.$/,
    m => areaBetween(x => Math.sqrt(x), x => x / Number(m[1]), 0, 100)],
  ['sign-change', /curve \$y = x\(x - (\d+)\)\$ and the \$x\$-axis, from \$x = 0\$ to \$x = (\d+)\$\.$/,
    m => { const a = Number(m[1]); return simpson(x => Math.abs(x * (x - a)), 0, Number(m[2])); }],
  ['two-lobes', /curve \$y = x\^3 - (\d+)x\$ and the \$x\$-axis\.$/,
    m => { const f = x => x ** 3 - Number(m[1]) * x, z = zeros(f, -20, 20); return simpson(x => Math.abs(f(x)), Math.min(...z), Math.max(...z)); }]
];
const BASE3 = [/^The region under/, /^The region between \$y = \d*x\$ and the \$x\$-axis from/];
const BASE4 = [/bounded by the curve \$y = x\^\{\d\}\$/, /increasing function/, /reflection of/];

const parseKey = (s, pi) => {
  const m = String(s).match(pi ? /^(\d*)pi(?:\/(\d+))?$/ : /^(\d+)(?:\/(\d+))?$/);
  if (!m) return null;
  const n = pi && m[1] === '' ? 1 : Number(m[1]);
  return { n, d: m[2] ? Number(m[2]) : 1 };
};

const cells = {};
function sweep(diff, table, base, pi) {
  const cell = `me12-calc D${diff}`;
  const forms = new Map(), skels = new Set();
  let baseN = 0, n = 0;
  const want = pi ? 'me12-calc.2' : 'me12-calc.3';
  for (let seed = 1; seed <= SEEDS; seed++) {
    let q;
    try { q = generateQuestion('me12-calc', diff, seed * 7919 + 13); } catch (e) { fail(cell, seed, `generator threw ${e.message}`); continue; }
    if (base.some(r => r.test(q.prompt))) { baseN++; continue; }
    let form = null, m = null;
    for (const [name, re] of table) { m = q.prompt.match(re); if (m) { form = name; break; } }
    if (!form) { fail(cell, seed, 'unrecognised prompt form', q); continue; }
    n++;
    forms.set(form, (forms.get(form) || 0) + 1);
    skels.add(skeleton(q.prompt));
    const entry = table.find(t => t[0] === form);
    try {
      const derived = entry[2](m);                         // V/pi for volumes, A for areas
      if (q.dotpoint !== want) fail(cell, seed, `dotpoint ${q.dotpoint}, want ${want}`, q);
      if (q.answerType !== 'numeric') fail(cell, seed, 'not numeric', q);
      const key = pi ? q.answer.value / Math.PI : q.answer.value;
      if (!(Math.abs(key - derived) <= 3e-5 * Math.max(1, Math.abs(derived)))) fail(cell, seed, `[${form}] key ${key} != Simpson ${derived}`, q);
      if (!q.answer.requireExact) fail(cell, seed, 'requireExact not set', q);
      const typed = q.answer.canonicalInput;
      const pk = parseKey(typed, pi);
      if (!pk) fail(cell, seed, `unparseable canonicalInput ${typed}`, q);
      else {
        // the printed canonical text itself must encode the same number, exactly reduced
        const gcd = (a, b) => (b ? gcd(b, a % b) : a);
        if (gcd(pk.n, pk.d) !== 1) fail(cell, seed, `canonical ${typed} not reduced`, q);
        if (Math.abs(pk.n / pk.d - derived) > 3e-5 * Math.max(1, derived)) fail(cell, seed, `canonical ${typed} != Simpson ${derived}`, q);
        // hints never state the final answer (typed, TeX, or decimal form)
        const finals = pi
          ? [typed, pk.d === 1 ? `${pk.n === 1 ? '' : pk.n}\\pi` : `\\dfrac{${pk.n === 1 ? '' : pk.n}\\pi}{${pk.d}}`]
          : [typed, pk.d === 1 ? `${pk.n}` : `\\dfrac{${pk.n}}{${pk.d}}`];
        for (const f of finals) {
          if (f.length < 3 && !f.includes('\\')) { /* a bare small integer: only meaningful as a whole $...$ */ }
          const esc = f.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
          const re = new RegExp(`(?<![\\d.\\\\{^_])${esc}(?![\\d.])`);
          for (const h of q.hints || []) {
            const inMath = seg(h);
            if (f.length < 3 ? inMath.some(s => s.trim() === f) : re.test(h)) fail(cell, seed, `hint contains the final answer "${f}": ${h}`, q);
          }
        }
        const last = q.steps[q.steps.length - 1].d;
        if (!last.includes(finals[1])) fail(cell, seed, `last step does not display the key (${finals[1]})`, q);
      }
      if (hasBad(q)) fail(cell, seed, 'undefined/NaN in question', q);
      if ((q.hints || []).length < 3) fail(cell, seed, 'fewer than 3 hints', q);
      if ((q.steps || []).length < 3) fail(cell, seed, 'fewer than 3 steps', q);
      if (!/\*\*exact\*\*/.test(q.prompt) && pi) fail(cell, seed, 'volume prompt does not ask for the exact value', q);
      let v; try { v = checkAnswer(q, typed); } catch (e) { v = { correct: false, feedback: e.message }; }
      if (!v.correct) fail(cell, seed, `marker refused its printed key "${typed}": ${v.feedback || ''}`, q);
      if (!q.traps.length) fail(cell, seed, 'no traps', q);
      for (const t of q.traps) {
        if (Math.abs(t.value - q.answer.value) <= 1e-9 * Math.max(1, Math.abs(q.answer.value))) fail(cell, seed, `trap equals key (${t.value})`, q);
        if (!t.why) fail(cell, seed, 'trap without a why', q);
        let tv; try { tv = checkAnswer(q, String(t.value)); } catch { tv = { correct: false }; }
        if (tv.correct) fail(cell, seed, `marker accepts trap ${t.value}`, q);
      }
    } catch (e) { fail(cell, seed, `check threw ${e.stack || e.message}`, q); }
  }
  cells[cell] = { n, baseN, forms: forms.size, skels: skels.size, detail: [...forms].map(([k, v]) => `${k}:${v}`).join(' ') };
  if (forms.size < 6) fail(cell, 0, `only ${forms.size} new forms (need >= 6 incl. base 3, so >= 4 new; expected ${table.length})`);
  if (forms.size < table.length) fail(cell, 0, `only ${forms.size}/${table.length} forms were drawn`);
  if (skels.size < 5) fail(cell, 0, `only ${skels.size} prompt skeletons (need >= 5)`);
}

sweep(3, VOL, BASE3, true);
sweep(4, AREA, BASE4, false);

for (const [cell, v] of Object.entries(cells)) {
  console.log(`${v.forms >= 4 && v.skels >= 5 ? 'PASS' : 'FAIL'}  ${cell}: ${v.n} new-form questions (+${v.baseN} base draws), ${v.forms} new forms, ${v.skels} prompt skeletons\n        ${v.detail}`);
}
if (failures) { console.log(`\n${failures} failure(s):`); for (const f of fails) console.log(' - ' + f); console.log('\nFAIL'); process.exit(1); }
console.log('\nPASS: every key re-derived by Simpson (N=' + N + ') from the prompt geometry, the marker accepts each printed key and rejects every trap, no hint leaks the answer.');
