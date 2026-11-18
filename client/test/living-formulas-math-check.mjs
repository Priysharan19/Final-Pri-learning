// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · living formulas: every stated feature is mathematically right
//
// client/src/living/specs.js states, for each formula and every setting of its parameters, the roots,
// turning point, intercepts, period, amplitude, asymptote, centre, spread and so on. Those statements
// come from closed forms and exact rational arithmetic. This suite re-derives each one by an
// INDEPENDENT numerical route (dense sampling, sign changes, bisection, finite differences, numerical
// integration of the density) over the whole grid of parameter stops, and fails on any disagreement.
// It also holds that every string a feature, parameter or title needs exists in English and Hindi,
// that a Hindi string differs from its English source, and that no spec touches marking or the network.
//
//   node client/test/living-formulas-math-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SPECS, SPEC_BY_ID, discriminantSign, periodInPi, valueAt, stopsOf } from '../src/living/specs.js';
import { fmt, piText, featureVars, isRounded } from '../src/living/format.js';
import { TITLE, NOTE, FEATURE, MARK } from '../src/living/keys.js';
import EN from '../src/i18n/strings.en.js';
import HI from '../src/i18n/strings.hi.js';

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) pass++; else if (failures.length < 40) failures.push(label); else failures.push(null); };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

// every combination of parameter stops, thinned so no spec is checked at fewer than ~1500 settings
function* grid(spec) {
  const ps = spec.params, counts = ps.map(p => stopsOf(p) + 1);
  const total = counts.reduce((a, b) => a * b, 1);
  const stride = Math.max(1, Math.floor(total / 1500));
  for (let n = 0; n < total; n += stride) {
    let r = n; const v = {};
    ps.forEach((p, i) => { v[p.id] = valueAt(p, r % counts[i]); r = Math.floor(r / counts[i]); });
    yield v;
  }
}
const sample = (fn, lo, hi, n) => Array.from({ length: n + 1 }, (_, i) => { const x = lo + ((hi - lo) * i) / n; return [x, fn(x)]; });
function numericRoots(fn, lo, hi) {
  const pts = sample(fn, lo, hi, 8000), out = [];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    if (!Number.isFinite(y0) || !Number.isFinite(y1)) continue;
    if (y0 === 0) { if (!out.length || Math.abs(out.at(-1) - x0) > 1e-3) out.push(x0); continue; }
    if (y0 * y1 < 0) { let a = x0, b = x1; for (let k = 0; k < 60; k++) { const m = (a + b) / 2; if (fn(a) * fn(m) <= 0) b = m; else a = m; } out.push((a + b) / 2); }
  }
  return out;
}
const kinds = new Set();
const get = (fs, k) => fs.find(f => f.kind === k);

// ── quadratic, vertex form, line, absolute value: roots, turning point, intercepts ──
for (const id of ['quadratic', 'vertex', 'line', 'absolute']) {
  const spec = SPEC_BY_ID[id];
  let n = 0;
  for (const v of grid(spec)) {
    n++;
    const fn = spec.fn(v), fs = spec.features(v);
    fs.forEach(f => kinds.add(f.kind));
    const roots = numericRoots(fn, -40, 40);
    const claimed = fs.filter(f => /^root|^xInt$/.test(f.kind)).flatMap(f => [f.facts.x, f.facts.x1, f.facts.x2].filter(x => x !== undefined));
    const none = fs.some(f => f.kind === 'rootsNone'), every = fs.some(f => f.kind === 'rootsEvery');
    const touching = fs.some(f => f.kind === 'rootTouch');
    if (every) ok(sample(fn, -40, 40, 400).every(p => p[1] === 0) , `${id} ${JSON.stringify(v)}: "every x is a root" but f is not 0`);
    else if (none) ok(roots.length === 0 && claimed.length === 0 && fn(-40) * fn(40) > 0 && Math.min(...sample(fn, -40, 40, 4000).map(p => Math.abs(p[1]))) > 0, `${id} ${JSON.stringify(v)}: "no roots" but the curve meets the x-axis`);
    else {
      const need = touching ? 1 : claimed.length;
      // a double root has no sign change: it is found as the sampled minimum of |f| being 0
      const found = touching ? (Math.min(...sample(fn, -40, 40, 8000).map(p => Math.abs(p[1]))) < 1e-9 ? 1 : 0) : roots.length;
      ok(found === need, `${id} ${JSON.stringify(v)}: ${claimed.length} roots stated, ${found} found`);
      for (const x of claimed) ok(Math.abs(fn(x)) < 1e-9, `${id} ${JSON.stringify(v)}: f(${x}) is not 0`);
      if (!touching) for (const r of roots) ok(claimed.some(x => near(x, r, 1e-5)), `${id} ${JSON.stringify(v)}: a root at ${r} is not stated`);
    }
    const yi = get(fs, 'yInt');
    if (yi) ok(near(yi.facts.y, fn(0)), `${id} ${JSON.stringify(v)}: y-intercept ${yi.facts.y} vs ${fn(0)}`);
    const tp = get(fs, 'turnMin') || get(fs, 'turnMax') || get(fs, 'cornerMin') || get(fs, 'cornerMax');
    if (tp) {
      const pts = sample(fn, -40, 40, 8000), isMin = /Min$/.test(tp.kind);
      const best = pts.reduce((b, p) => (isMin ? p[1] < b[1] : p[1] > b[1]) ? p : b);
      ok(Math.abs(best[0] - tp.facts.x) <= 0.011 && Math.abs(best[1] - tp.facts.y) <= 1e-3, `${id} ${JSON.stringify(v)}: turning point ${tp.facts.x},${tp.facts.y} vs sampled ${best}`);
      if (v.a !== undefined) ok((v.a > 0) === isMin, `${id} ${JSON.stringify(v)}: opens the wrong way`);
    }
    const ax = get(fs, 'axis');
    if (ax) for (const d of [0.5, 1.7, 3]) ok(near(fn(ax.facts.x - d), fn(ax.facts.x + d)), `${id} ${JSON.stringify(v)}: not symmetric about x = ${ax.facts.x}`);
    const sl = get(fs, 'slopeUp') || get(fs, 'slopeDown') || get(fs, 'slopeFlat');
    if (sl) ok(near(sl.facts.m, fn(1) - fn(0)) && near(sl.facts.m, fn(7.5) - fn(6.5)), `${id} ${JSON.stringify(v)}: slope`);
    const sp = get(fs, 'slopes');
    if (sp) ok(near(sp.facts.m, Math.abs(fn(h(v) + 1) - fn(h(v)))) && near(sp.facts.m, Math.abs(fn(h(v) - 1) - fn(h(v)))), `${id} ${JSON.stringify(v)}: arm slopes`);
  }
  ok(n > 100, `${id}: grid has ${n} settings`);
}
function h(v) { return v.h; }
// the exact discriminant agrees with the float one on every quarter stop (floats hold quarters exactly)
{
  let n = 0;
  for (let a = -3; a <= 3; a += 0.25) for (let b = -6; b <= 6; b += 0.25) for (let c = -6; c <= 6; c += 0.5) { n++; ok(discriminantSign(a, b, c) === Math.sign(b * b - 4 * a * c), `discriminant ${a},${b},${c}`); }
  ok(n > 10000, 'discriminant grid');
}

// ── sine: amplitude, period (exact multiple of π), midline, range, shift, first maximum ──
{
  const spec = SPEC_BY_ID.sine;
  for (const v of grid(spec)) {
    const fn = spec.fn(v), fs = spec.features(v);
    fs.forEach(f => kinds.add(f.kind));
    if (v.a === 0) { ok(fs.length === 1 && fs[0].kind === 'flatSine' && fn(1.3) === v.d, `sine ${JSON.stringify(v)}: a = 0`); continue; }
    const ys = sample(fn, -14, 14, 28000).map(p => p[1]), mx = Math.max(...ys), mn = Math.min(...ys);
    const amp = get(fs, 'amplitude').facts.amp, mid = get(fs, 'midline').facts.y, rg = get(fs, 'range').facts;
    ok(near(amp, (mx - mn) / 2, 1e-5) && near(mid, (mx + mn) / 2, 1e-5) && near(rg.max, mx, 1e-5) && near(rg.min, mn, 1e-5), `sine ${JSON.stringify(v)}: amplitude/midline/range`);
    const p = get(fs, 'period').facts;
    const per = (p.n / p.d) * Math.PI;
    ok(near(p.value, per) && near(per, (2 * Math.PI) / v.b), `sine ${JSON.stringify(v)}: period ${p.n}π/${p.d} vs 2π/b`);
    const periodic = [0.3, 1.9, -2.2, 5].every(x => near(fn(x), fn(x + per), 1e-9));
    const smaller = [2, 3, 4, 5, 6].some(k => [0.3, 1.9, -2.2, 5, 0.9].every(x => near(fn(x), fn(x + per / k), 1e-9)));
    ok(periodic && !smaller, `sine ${JSON.stringify(v)}: ${per} is not the smallest period`);
    const fm = get(fs, 'firstMax').facts;
    ok(near(fn(fm.x), fm.y, 1e-9) && near(fm.y, mx, 1e-4) && fm.y === v.d + Math.abs(v.a), `sine ${JSON.stringify(v)}: first maximum`);
    const earlier = sample(fn, v.c, fm.x - 1e-3, 4000).some(pt => pt[1] > fm.y - 1e-9);
    ok(!earlier && fm.x > v.c, `sine ${JSON.stringify(v)}: an earlier maximum exists`);
    ok(near(fn(v.c), v.d, 1e-9), `sine ${JSON.stringify(v)}: not on the midline at x = c`);
  }
  // exact period as a multiple of π: independent rational arithmetic
  for (let B = 2; B <= 12; B++) { const f = periodInPi(B / 4); const g = (a, b) => (b ? g(b, a % b) : a); const d = g(8, B); ok(Number(f.n) === 8 / d && Number(f.d) === B / d, `period b=${B / 4}`); }
  ok(piText(4, 3) === '4π/3' && piText(1, 1) === 'π' && piText(2, 1) === '2π' && piText(1, 3) === 'π/3', 'π text');
}

// ── exponential ──
{
  const spec = SPEC_BY_ID.exponential;
  for (const v of grid(spec)) {
    const fn = spec.fn(v), fs = spec.features(v);
    fs.forEach(f => kinds.add(f.kind));
    if (v.a === 0) { ok(fs[0].kind === 'zeroFn' && fn(2) === 0, 'exp a=0'); continue; }
    if (v.b === 1) { ok(fs[0].kind === 'constantFn' && fn(5) === v.a && fs[0].facts.y === v.a, 'exp b=1'); continue; }
    ok(near(get(fs, 'yInt').facts.y, fn(0)), `exp ${JSON.stringify(v)}: y-intercept`);
    const fact = get(fs, 'grows') || get(fs, 'decays');
    ok(fact.facts.b === v.b && (fact.kind === 'grows') === (v.b > 1) && [-3, -1, 0.5, 2].every(x => near(fn(x + 1) / fn(x), v.b, 1e-9)), `exp ${JSON.stringify(v)}: growth factor`);
    const far = v.b > 1 ? -60 : 60;
    ok(Math.abs(fn(far)) < 1e-6 * Math.max(1, Math.abs(v.a)) * 1e3 && Math.sign(fn(far)) === Math.sign(v.a) && sample(fn, -30, 30, 3000).every(p => p[1] !== 0), `exp ${JSON.stringify(v)}: asymptote y = 0`);
    ok(get(fs, 'asymH').facts.y === 0 && !!get(fs, 'noXInt'), `exp ${JSON.stringify(v)}: stated asymptote`);
  }
}

// ── logarithm ──
{
  const spec = SPEC_BY_ID.logarithm;
  for (const v of grid(spec)) {
    const fn = spec.fn(v), fs = spec.features(v);
    fs.forEach(f => kinds.add(f.kind));
    if (v.a === 0) { ok(fs[0].kind === 'zeroLog' && fn(v.h + 3) === v.k, 'log a=0'); continue; }
    const av = get(fs, 'asymV').facts.x;
    ok(av === v.h && Number.isNaN(fn(av)) && Number.isNaN(fn(av - 1)), `log ${JSON.stringify(v)}: domain edge`);
    const eps = [1e-3, 1e-6, 1e-9].map(e => fn(av + e));
    ok(Math.abs(eps[2]) > Math.abs(eps[1]) && Math.abs(eps[1]) > Math.abs(eps[0]) && Math.sign(eps[2]) === -Math.sign(v.a), `log ${JSON.stringify(v)}: does not run off the asymptote`);
    const xi = get(fs, 'xInt').facts.x;
    ok(Math.abs(fn(xi)) < 1e-9 && numericRoots(fn, v.h + 1e-9, v.h + 5000).length === 1, `log ${JSON.stringify(v)}: x-intercept`);
    const ps = get(fs, 'passes').facts;
    ok(near(fn(ps.x), ps.y), `log ${JSON.stringify(v)}: passes through`);
    const up = fn(v.h + 9) > fn(v.h + 3);
    ok(up === !!get(fs, 'rises') && up === (v.a > 0), `log ${JSON.stringify(v)}: rising or falling`);
  }
}

// ── circle ──
{
  const spec = SPEC_BY_ID.circle;
  for (const v of grid(spec)) {
    const fs = spec.features(v), [pts] = spec.polylines(v);
    fs.forEach(f => kinds.add(f.kind));
    ok(pts.every(([x, y]) => near((x - v.h) ** 2 + (y - v.k) ** 2, v.r * v.r, 1e-9)), `circle ${JSON.stringify(v)}: points are not on the circle`);
    const c = get(fs, 'centre').facts, r = get(fs, 'radius').facts.r;
    ok(c.x === v.h && c.y === v.k && r === v.r, `circle ${JSON.stringify(v)}: centre/radius`);
    // axis crossings: solve on a dense parametric walk, with an exact tangent test by distance from the centre to the axis
    for (const [axis, cross, touch, miss, dist] of [['x', 'crossX', 'touchX', 'missX', Math.abs(v.k)], ['y', 'crossY', 'touchY', 'missY', Math.abs(v.h)]]) {
      const walk = Array.from({ length: 20001 }, (_, i) => { const t = (i / 20000) * 2 * Math.PI; return axis === 'x' ? v.k + v.r * Math.sin(t) : v.h + v.r * Math.cos(t); });
      const nz = walk.filter(a => Math.abs(a) > 1e-9);
      const sc = nz.reduce((n, a, i) => (nz[(i + nz.length - 1) % nz.length] * a < 0 ? n + 1 : n), 0);
      const kind = fs.find(f => [cross, touch, miss].includes(f.kind)).kind;
      ok(kind === (dist < v.r ? cross : dist === v.r ? touch : miss), `circle ${JSON.stringify(v)}: ${axis}-axis ${kind} but distance ${dist} vs r ${v.r}`);
      if (kind === cross) {
        ok(sc === 2, `circle ${JSON.stringify(v)}: ${sc} sign changes on the ${axis}-axis`);
        const f = get(fs, cross).facts;
        const vals = axis === 'x' ? [f.x1, f.x2].map(x => [x, 0]) : [f.y1, f.y2].map(y => [0, y]);
        for (const [x, y] of vals) ok(near((x - v.h) ** 2 + (y - v.k) ** 2, v.r * v.r, 1e-9), `circle ${JSON.stringify(v)}: stated ${axis}-crossing is not on the circle`);
      }
    }
  }
}

// ── normal distribution ──
{
  const spec = SPEC_BY_ID.normal;
  for (const v of grid(spec)) {
    const fn = spec.fn(v), fs = spec.features(v);
    fs.forEach(f => kinds.add(f.kind));
    const pk = get(fs, 'peak').facts;
    const pts = sample(fn, v.mu - 10 * v.sigma, v.mu + 10 * v.sigma, 8000);
    const best = pts.reduce((b, p) => (p[1] > b[1] ? p : b));
    ok(Math.abs(best[0] - pk.x) <= 0.03 && near(best[1], pk.y, 1e-4), `normal ${JSON.stringify(v)}: peak`);
    const d = 1e-3, second = x => (fn(x + d) - 2 * fn(x) + fn(x - d)) / (d * d);
    const inf = get(fs, 'inflect').facts;
    ok(Math.abs(second(inf.x1)) < 1e-4 * pk.y / (v.sigma * v.sigma) * 100 && second(v.mu) < 0 && second(inf.x1 - 0.2 * v.sigma) > 0 && second(inf.x1 + 0.2 * v.sigma) < 0 && second(inf.x2 + 0.2 * v.sigma) > 0, `normal ${JSON.stringify(v)}: inflection points`);
    const area = (lo, hi) => { const n = 20000; let s = 0; for (let i = 0; i < n; i++) s += fn(lo + ((i + 0.5) * (hi - lo)) / n); return (s * (hi - lo)) / n; };
    const r = get(fs, 'rule').facts;
    ok(near(area(r.lo1, r.hi1), 0.68, 0.01) && near(area(r.lo2, r.hi2), 0.95, 0.01) && near(area(r.lo3, r.hi3), 0.997, 0.003), `normal ${JSON.stringify(v)}: 68-95-99.7 areas`);
    ok(near(area(v.mu - 12 * v.sigma, v.mu + 12 * v.sigma), 1, 1e-6), `normal ${JSON.stringify(v)}: total area is 1`);
  }
}

// ── spec shape, strings, honesty ──
for (const spec of SPECS) {
  ok(TITLE[spec.id] === `living.${spec.id}.title`, `${spec.id}: key table title`);
  for (const p of spec.params) ok(NOTE[spec.id]?.[p.id] === `living.${spec.id}.p.${p.id}`, `${spec.id}.${p.id}: key table note`);
}
for (const k of kinds) ok(FEATURE[k] === `living.feat.${k}`, `feature ${k}: key table`);
ok(Object.values(MARK).every(k => Object.hasOwn(EN, k)), 'marker legend keys exist');
const KEYS = new Set(Object.keys(EN));
ok(SPECS.length >= 8, `at least eight living formulas (${SPECS.length})`);
for (const spec of SPECS) {
  ok(KEYS.has(`living.${spec.id}.title`) && Object.hasOwn(HI, `living.${spec.id}.title`), `${spec.id}: title in en and hi`);
  for (const p of spec.params) {
    ok(KEYS.has(`living.${spec.id}.p.${p.id}`) && Object.hasOwn(HI, `living.${spec.id}.p.${p.id}`), `${spec.id}.${p.id}: note in en and hi`);
    ok(p.def >= p.min && p.def <= p.max && near(valueAt(p, Math.round((p.def - p.min) / p.step)), p.def), `${spec.id}.${p.id}: default is a stop`);
    ok(stopsOf(p) > 1 && Math.abs(Math.log2(p.step) % 1) < 1e-9 || Number.isInteger(p.step * 4), `${spec.id}.${p.id}: step is a multiple of 1/4`);
    ok(spec.formula.some(t => t.p === p.id || t.sp === p.id || t.sup === p.id || (t.supOf || []).some(s => s.p === p.id)), `${spec.id}.${p.id}: appears in the formula`);
  }
  ok(Object.keys(spec.emphasis).every(id => spec.params.some(p => p.id === id)), `${spec.id}: emphasis names real parameters`);
  ok(spec.together.every(g => g.every(id => spec.params.some(p => p.id === id))), `${spec.id}: together names real parameters`);
}
for (const k of kinds) ok(KEYS.has(`living.feat.${k}`) && Object.hasOwn(HI, `living.feat.${k}`) && HI[`living.feat.${k}`] !== EN[`living.feat.${k}`], `feature "${k}" has en and a different hi sentence`);
for (const k of Object.keys(EN).filter(k => k.startsWith('living.'))) {
  const ph = s => (String(s).match(/\{\w+\}/g) || []).sort().join();
  ok(Object.hasOwn(HI, k) && ph(EN[k]) === ph(HI[k]), `${k}: hi has the same placeholders`);
}
for (const spec of SPECS) for (const f of spec.features(Object.fromEntries(spec.params.map(p => [p.id, p.def])))) {
  const vars = featureVars(f.kind, f.facts), need = String(EN[`living.feat.${f.kind}`]).match(/\{(\w+)\}/g) || [];
  ok(need.every(n => Object.hasOwn(vars, n.slice(1, -1))), `${spec.id}/${f.kind}: every placeholder is supplied`);
}
ok(fmt(-1.5) === '−1.5' && fmt(1 / 3) === '0.33' && isRounded(1 / 3) && !isRounded(2.5) && fmt(2) === '2', 'number text');
const src = ['specs.js', 'format.js', 'LivingFormula.jsx', 'LivingFormulas.jsx'].map(f => readFileSync(fileURLToPath(new URL(`../src/living/${f}`, import.meta.url)), 'utf8')).join('\n');
ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|\bapi\.js|outbox|localStorage|sessionStorage/.test(src), 'living formulas make no network call and keep nothing');
ok(!/checker|marker|attempt|hint|mastery|learnerState|recordAnswer/i.test(src.replace(/\/\/.*$/gm, '')), 'living formulas touch no marking, hint, attempt or learner state');
ok(readdirSync(fileURLToPath(new URL('../src/living/', import.meta.url))).every(f => !/\.(png|jpe?g|woff2?)$/.test(f)), 'no new asset in the living formulas');

if (failures.length) {
  console.error(`LIVING FORMULAS MATH: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures.filter(Boolean).slice(0, 40)) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`LIVING FORMULAS MATH: PASS — ${pass}/${pass} checks — ${SPECS.length} formulas, every stated feature re-derived by an independent numerical route across the parameter grid, en/hi strings complete, no network and no marking`);
