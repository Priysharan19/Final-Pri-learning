// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · diagram pack "stats" (client/src/diagrams/packs/stats.*)
//
//   1. hand-worked values: B(4, 1/2) P(X = 2) = 0.375; B(10, 0.3) mean 3 and
//      variance 2.1; Pascal row 5 = 1 5 10 10 5 1 and row sums 2^n; pie [1, 1, 2] →
//      90°, 90°, 180° and every pie adds to 360° exactly; two dice P(sum 7) = 1/6 with
//      the 1/36 … 6/36 distribution; summary measures of a worked data set (population
//      standard deviation);
//   2. the simulator: the same seed gives the same trials, adding in chunks gives the
//      same result as adding at once, and 10 000 die rolls land within 0.02 of 1/6;
//   3. validators reject bad specs with a helpful reason and accept good ones;
//   4. layout: value axes start at 0, category and pie labels never share a spot;
//   5. words: every English string has a Hindi one with the same {slots};
//   6. drawn (react-dom/server): each kind is one accessible figure, in bounds, no NaN,
//      KaTeX renders, its words state the computed numbers; interactive kinds have
//      labelled native controls and a polite live region, and a question gets the
//      static counterpart.
//   node client/test/diagram-pack-stats-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { fileURLToPath } from 'node:url';
import * as S from '../src/diagrams/packs/stats.kinds.js';
import { kitText } from '../src/diagrams/kitText.js';
import { validateSpec, STATIC_KIND_NAMES, INTERACTIVE_KIND_NAMES, PACK_COUNTERPARTS } from '../src/diagrams/kinds.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const hasNaN = o => JSON.stringify(o, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? '__NaN__' : v)).includes('__NaN__');

// ── 1. Hand-worked values ────────────────────────────────────────────────────
{
  const b = S.binomialModel({ n: 4, p: 0.5, highlight: [2] });
  ok(near(b.probs[2], 0.375) && b.pSet4 === 0.375, `B(4, 1/2): P(X = 2) = 6/16 = 0.375 (${b.probs[2]})`);
  ok(b.probs.map(v => v * 16).join() === '1,4,6,4,1', 'B(4, 1/2): the probabilities are 1, 4, 6, 4, 1 sixteenths');
  ok(b.mean === 2 && b.variance === 1, 'B(4, 1/2): mean 2, variance 1');
  const t = S.binomialModel({ n: 10, p: 0.3 });
  ok(t.mean === 3 && t.variance === 2.1, `B(10, 0.3): E(X) = 3, Var(X) = 2.1 (${t.mean}, ${t.variance})`);
  ok(near(t.probs[3], 120 * 0.3 ** 3 * 0.7 ** 7) && t.bars[3].p4 === 0.2668, `B(10, 0.3): P(X = 3) = 120(0.3)^3(0.7)^7 = 0.2668 (${t.bars[3].p4})`);
  const ge = S.binomialModel({ n: 10, p: 0.3, highlight: { atLeast: 8 } });
  ok(near(ge.pSet, 45 * 0.3 ** 8 * 0.7 ** 2 + 10 * 0.3 ** 9 * 0.7 + 0.3 ** 10) && ge.pSet4 === 0.0016 && ge.event === 'X\\ge 8', `B(10, 0.3): P(X ≥ 8) = 0.0016 (${ge.pSet4})`);
  const le = S.binomialModel({ n: 5, p: 0.5, highlight: { atMost: 1 } });
  ok(near(le.pSet, 6 / 32) && le.set.join() === '0,1', 'B(5, 1/2): P(X ≤ 1) = 6/32');
  ok(near(S.binomialModel({ n: 6, p: 0.5, highlight: { between: [2, 4] } }).pSet, 50 / 64), 'B(6, 1/2): P(2 ≤ X ≤ 4) = 50/64');
  for (const [n, p] of [[1, 0.5], [7, 0.13], [20, 0.95], [50, 0.5], [12, 0], [12, 1]]) ok(near(S.binomialDist(n, p).reduce((s, v) => s + v, 0), 1, 1e-12), `B(${n}, ${p}): the probabilities add to 1`);
  ok(S.choose(50, 25) === 126410606437752 && S.choose(10, 3) === 120 && S.choose(5, 7) === 0, 'C(n, k) is exact (C(50, 25) = 126410606437752)');

  const pas = S.pascalModel({ rows: 5 });
  ok(pas.entries.filter(e => e.n === 5).map(e => e.value).join(' ') === '1 5 10 10 5 1', 'Pascal row 5 = 1 5 10 10 5 1');
  const p12 = S.pascalModel({ rows: 12, highlight: [[12, 6]] });
  ok(p12.rowSums.every(r => r.check === r.value && r.value === 2 ** r.n), 'Pascal: every row adds to 2^n (rows 0–12)');
  ok(p12.entries.every(e => e.n === 0 || e.k === 0 || e.k === e.n || e.value === S.choose(e.n - 1, e.k - 1) + S.choose(e.n - 1, e.k)), 'Pascal: every inner entry is the sum of the two above it');
  ok(p12.highlighted.length === 1 && p12.highlighted[0].value === 924, 'Pascal: the highlighted entry C(12, 6) = 924');
  ok(S.pascalModel({ rows: 4, show: 'binomial' }).entries.find(e => e.n === 4 && e.k === 2).tex === '\\tbinom{4}{2}', "Pascal show: 'binomial' writes C(n, k) as a binomial coefficient");

  ok(S.pieAngles([1, 1, 2]).angles.join() === '90,90,180', 'pie [1, 1, 2] → 90°, 90°, 180°');
  for (const vals of [[1, 1, 1], [1, 2, 3, 4, 5, 6, 7], [1, 1, 1, 1, 1, 1, 1], [0.1, 0.2, 0.3], [17, 23, 31, 7, 2], [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5], [1, 999]]) {
    const { angles, exact } = S.pieAngles(vals);
    ok(angles.reduce((s, v) => s + v, 0) === 360 && angles.every((a, i) => Number.isInteger(a) && Math.abs(a - exact[i]) < 1), `pie [${vals}] → whole angles [${angles}] adding to 360, each within 1° of exact`);
  }
  ok(S.pieAngles([1, 2, 3, 4, 5, 6, 7]).angles.join() === '13,26,39,51,64,77,90', 'pie [1…7]: largest remainders take the spare degrees (13, 26, 39, 51, 64, 77, 90)');

  const two = S.experimentOutcomes({ experiment: 'twoDiceSum' });
  ok(two.length === 11 && two.map(o => `${o.frac.n}/${o.frac.d}`).join(' ') === '1/36 2/36 3/36 4/36 5/36 6/36 5/36 4/36 3/36 2/36 1/36', 'two dice: 11 sums with probabilities 1/36 … 6/36 … 1/36');
  const seven = S.eventOf(two, [7]);
  ok(seven.frac.n === 1 && seven.frac.d === 6 && near(seven.p, 1 / 6), 'two dice: P(sum 7) = 1/6');
  const doubles = S.eventOf(two, [2, 12]);
  ok(doubles.frac.n === 1 && doubles.frac.d === 18, 'two dice: P(sum 2 or 12) = 1/18');
  const spin = S.experimentOutcomes({ experiment: 'spinner', sectors: [{ label: 'Red', weight: 1 }, { label: 'Blue', weight: 3 }] });
  ok(spin[1].frac.n === 3 && spin[1].frac.d === 4, 'spinner weights 1 and 3: P(Blue) = 3/4');
  const bag = S.experimentOutcomes({ experiment: 'bag', bag: [{ label: 'red', weight: 1.5 }, { label: 'blue', weight: 0.5 }] });
  ok(bag[0].frac === null && near(bag[0].p, 0.75), 'weights that are not whole give decimal probabilities (0.75), never a wrong fraction');
  ok(S.eventOf(S.experimentOutcomes({ experiment: 'coin' }), ['heads']).p === 0.5, 'a coin event may name heads or H');

  const d = S.dataStats([2, 4, 4, 4, 5, 5, 7, 9]);
  ok(d.mean === 5 && d.sd === 2 && d.median === 4.5 && d.modes.join() === '4' && d.range === 7 && d.q1 === 4 && d.q3 === 6 && d.iqr === 2, `data 2 4 4 4 5 5 7 9: mean 5, population sd 2, median 4.5, mode 4, range 7, IQR 6 − 4 = 2 (${JSON.stringify(d)})`);
  ok(S.dataStats([1, 2, 3]).modes.length === 0 && S.dataStats([1, 1, 3, 3]).modes.join() === '1,3', 'no mode when every value appears once; two modes when two tie');
  const before = S.dataStats([2, 4, 4, 5, 7, 9, 10]); const after = S.dataStats([2, 4, 4, 5, 7, 9, 30]);
  ok(S.changedMeasures(before, after).join() === 'mean,range,sd', `moving 10 to an outlier 30 changes the mean, range and sd, not the median, mode or IQR (${S.changedMeasures(before, after)})`);
}

// ── 2. The seeded simulator ──────────────────────────────────────────────────
{
  const die = { experiment: 'die', seed: 2026 };
  ok(S.simSequence(die, 50).join() === S.simSequence(die, 50).join(), 'the same seed gives the same 50 rolls');
  ok(S.simSequence(die, 50).join() !== S.simSequence({ ...die, seed: 2027 }, 50).join(), 'a different seed gives different rolls');
  const chunked = S.simAdd(die, S.simAdd(die, S.simAdd(die, S.simStart(die), 1), 10), 100);
  const once = S.simAdd(die, S.simStart(die), 111);
  ok(JSON.stringify(chunked) === JSON.stringify(once), 'adding 1 + 10 + 100 trials gives exactly the same counts as adding 111 at once');
  ok(S.simSequence({ experiment: 'die', seed: 1 }, 8).join('') === '41466245', `seed 1 rolls 4 1 4 6 6 2 4 5 on every device (${S.simSequence({ experiment: 'die', seed: 1 }, 8).join('')})`);
  for (const seed of [1, 7, 42, 2026]) {
    const s = S.simAdd({ experiment: 'die', seed }, S.simStart({ experiment: 'die', seed }), 10000);
    const worst = Math.max(...s.counts.map(c => Math.abs(c / 10000 - 1 / 6)));
    ok(s.trials === 10000 && worst < 0.02, `seed ${seed}: after 10 000 rolls every face is within 0.02 of 1/6 (worst ${worst.toFixed(4)})`);
  }
  const twoDice = { experiment: 'twoDiceSum', seed: 5, event: [7] };
  const m = S.probabilitySimModel(twoDice, S.simAdd(twoDice, S.simStart(twoDice), 10000));
  ok(Math.abs(m.event.freq - 1 / 6) < 0.02 && m.event.tex === '\\tfrac{1}{6}', `two dice: 10 000 throws give a sum of 7 about 1/6 of the time (${m.event.freq3})`);
  ok(m.bars.every(b => Math.abs(b.freq - b.p) < 0.02), 'two dice: every sum is within 0.02 of its theoretical probability');
  const sp = { experiment: 'spinner', seed: 9, sectors: [{ label: 'A', weight: 1 }, { label: 'B', weight: 3 }] };
  const spm = S.probabilitySimModel(sp, S.simAdd(sp, S.simStart(sp), 10000));
  ok(Math.abs(spm.bars[1].freq - 0.75) < 0.02, `a spinner weighted 1 : 3 lands on B about 3/4 of the time (${spm.bars[1].freq3})`);
  const capped = S.simAdd(die, { ...S.simStart(die), trials: S.SIM_MAX_TRIALS - 5 }, 1000);
  ok(capped.trials === S.SIM_MAX_TRIALS, 'the simulator stops at its cap');
  const zero = S.probabilitySimModel({ experiment: 'coin' });
  ok(zero.trials === 0 && zero.bars.every(b => b.freq === 0 && b.h === 0) && !hasNaN(zero), 'with no trials the bars are empty and nothing is NaN');
}

// ── 3. Validators ────────────────────────────────────────────────────────────
{
  const rejects = (spec, re, label) => { const e = validateSpec(spec); ok(e.length > 0 && re.test(e.join(' ')), `rejects ${label} (${e.join('; ') || 'accepted'})`); };
  rejects({ kind: 'barChart', categories: ['a', 'b', 'c'], values: [1, 2] }, /3 categories but 2 values/, 'mismatched categories and values');
  rejects({ kind: 'barChart', categories: ['a', 'a'], values: [1, 2] }, /different/, 'repeated categories');
  rejects({ kind: 'barChart', categories: ['a', 'b'], values: [1, NaN] }, /finite/, 'a NaN value');
  rejects({ kind: 'barChart', categories: ['a', 'b'], values: [1, 2], dual: { values: [1] } }, /dual has 1 values/, 'a dual series of the wrong length');
  rejects({ kind: 'pieChart', categories: ['a', 'b'], values: [1, 0] }, /positive/, 'a pie sector of 0');
  rejects({ kind: 'pieChart', categories: ['a', 'b'], values: [1, -2] }, /positive/, 'a negative pie value');
  rejects({ kind: 'pascal', rows: 13 }, /0 to 12/, 'Pascal with 13 rows');
  rejects({ kind: 'pascal', rows: 4.5 }, /whole number/, 'Pascal with 4.5 rows');
  rejects({ kind: 'pascal', rows: 4, highlight: [[3, 5]] }, /not in the triangle/, 'a Pascal highlight with k > n');
  rejects({ kind: 'binomial', n: 10, p: 1.2 }, /p must be a number from 0 to 1/, 'p outside [0, 1]');
  rejects({ kind: 'binomial', n: 2.5, p: 0.5 }, /n must be a whole number/, 'n not a whole number');
  rejects({ kind: 'binomial', n: 0, p: 0.5 }, /n must be a whole number from 1/, 'n = 0');
  rejects({ kind: 'binomial', n: 5, p: 0.5, highlight: [6] }, /0 ≤ k ≤ n/, 'a highlighted k above n');
  rejects({ kind: 'binomialExplorer', n: 5, p: 0.5, highlight: { atLeast: 9 } }, /atLeast/, 'atLeast above n');
  rejects({ kind: 'binomialExplorer', n: 5, p: 0.5, highlight: { more: 2 } }, /atLeast/, 'an unknown highlight form');
  rejects({ kind: 'probabilitySim', experiment: 'spinner', sectors: [{ label: 'A', weight: 0 }, { label: 'B', weight: 1 }] }, /weight 0; every weight must be a positive/, 'a spinner weight of 0');
  rejects({ kind: 'probabilitySim', experiment: 'bag', bag: [{ label: 'red', weight: -1 }, { label: 'blue', weight: 2 }] }, /positive/, 'a negative bag weight');
  rejects({ kind: 'probabilitySim', experiment: 'spinner' }, /needs sectors/, 'a spinner without sectors');
  rejects({ kind: 'probabilitySim', experiment: 'dice' }, /experiment must be one of/, 'an unknown experiment');
  rejects({ kind: 'probabilitySim', experiment: 'die', event: [7] }, /does not have: 7/, 'an event outcome the die cannot show');
  rejects({ kind: 'probabilitySim', experiment: 'die', seed: 1.5 }, /seed/, 'a seed that is not whole');
  rejects({ kind: 'probabilitySim', experiment: 'bag', bag: [{ label: 'red', weight: 1 }, { label: 'Red', weight: 2 }] }, /different/, 'two bag labels the same');
  rejects({ kind: 'dataExplorer', data: [3] }, /at least 2/, 'one data value');
  rejects({ kind: 'dataExplorer', data: [1, 2, 3], editable: [3] }, /0 to 2/, 'an editable position past the end');
  rejects({ kind: 'dataExplorer', data: [1, 2, 3], show: ['mean', 'average'] }, /show must list/, 'an unknown measure');
  rejects({ kind: 'dataExplorer', data: [1, 2, 30], max: 20 }, /between min/, 'data outside the slider range');
  const good = [
    { kind: 'barChart', categories: ['Walk', 'Bus', 'Car'], values: [12, 8, 5], yLabel: 'Students' },
    { kind: 'barChart', categories: ['Mon', 'Tue'], values: [3, 4], dual: { values: [5, 2], label: 'Week 2' }, horizontal: true },
    { kind: 'pieChart', categories: ['A', 'B', 'C'], values: [1, 1, 2] }, { kind: 'pascal', rows: 6, highlight: [[6, 2]], show: 'binomial' },
    { kind: 'binomial', n: 10, p: 0.3, highlight: { atLeast: 8 } }, { kind: 'binomialExplorer', n: 4, p: 0.5, highlight: [2] },
    { kind: 'probabilitySim', experiment: 'twoDiceSum', event: [7], seed: 3 }, { kind: 'probabilitySim', experiment: 'coin', event: ['H'], seed: 1 },
    { kind: 'probabilitySim', experiment: 'spinner', sectors: [{ label: 'Red', weight: 1 }, { label: 'Blue', weight: 2 }, { label: 'Green', weight: 3 }], seed: 11 },
    { kind: 'dataExplorer', data: [2, 4, 4, 5, 7, 9, 10], editable: [6], show: ['mean', 'median', 'iqr'] }
  ];
  for (const g of good) { const e = validateSpec(g); ok(e.length === 0, `accepts ${g.kind} ${JSON.stringify(g).slice(0, 60)} (${e.join('; ')})`); }
  for (const g of good) { const { kind, ...params } = g; let mod; try { mod = (S.STATIC[kind] || S.INTERACTIVE[kind]).model(params); } catch (err) { mod = { err: NaN }; } ok(!hasNaN(mod), `${kind}: the model builds without NaN`); }
}

// ── 4. Registry, layout ──────────────────────────────────────────────────────
{
  for (const k of ['barChart', 'pieChart', 'pascal', 'binomial']) ok(STATIC_KIND_NAMES.includes(k), `${k} is a static kind`);
  for (const k of ['binomialExplorer', 'probabilitySim', 'dataExplorer']) ok(INTERACTIVE_KIND_NAMES.includes(k), `${k} is an interactive kind`);
  ok(PACK_COUNTERPARTS.binomialExplorer === 'binomial' && PACK_COUNTERPARTS.probabilitySim === 'barChart' && PACK_COUNTERPARTS.dataExplorer === 'boxPlot', 'each interactive kind has its static counterpart');

  for (const vals of [[3, 7, 12], [1002, 1005, 1010], [0.2, 0.25]]) { const m = S.barChartModel({ categories: vals.map((_, i) => `c${i}`), values: vals }); ok(m.vmin === 0 && m.vmax >= Math.max(...vals) && m.ticks[0].value === 0, `bar chart [${vals}]: the value axis starts at 0 (never truncated)`); }
  const neg = S.barChartModel({ categories: ['a', 'b'], values: [-3, 5] });
  ok(neg.vmin <= -3 && neg.vmax >= 5 && neg.ticks.some(t => t.value === 0) && neg.bars[0].y === neg.base, 'a negative bar hangs from 0, and 0 is on the axis');
  const hz = S.barChartModel({ categories: ['a', 'b'], values: [2, 6], horizontal: true });
  ok(hz.horizontal && hz.bars.every(b => b.x === hz.base) && hz.bars[1].w > hz.bars[0].w * 2.9, 'a horizontal bar chart grows from 0 to the right, in proportion');
  const crowded = S.barChartModel({ categories: Array.from({ length: 16 }, (_, i) => `Category ${i + 1}`), values: Array.from({ length: 16 }, (_, i) => i + 1) });
  const boxes = crowded.cats.filter(c => c.shown).map(c => ({ y: c.y, l: c.x - S.estWidth(c.text) / 2, r: c.x + S.estWidth(c.text) / 2 }));
  const clash = boxes.some((a, i) => boxes.some((b, j) => j > i && a.y === b.y && a.l < b.r && b.l < a.r));
  ok(crowded.axis.mode !== 'row' && !clash, `16 long category names are staggered or thinned so no two collide (${crowded.axis.mode}, every ${crowded.axis.every})`);
  const roomy = S.barChartModel({ categories: ['A', 'B', 'C'], values: [1, 2, 3] });
  ok(roomy.axis.mode === 'row' && roomy.cats.every(c => c.shown), 'short names stay in one row, all shown');

  const pie = S.pieChartModel({ categories: Array.from({ length: 12 }, (_, i) => `S${i}`), values: [30, 1, 1, 1, 1, 1, 30, 1, 1, 1, 1, 1] });
  const sides = ['left', 'right'].map(side => pie.sectors.filter(s => s.side === side).map(s => s.ly).sort((a, b) => a - b));
  ok(sides.every(ys => ys.every((y, i) => i === 0 || y - ys[i - 1] >= 21.9)) && pie.sectors.every(s => s.ly >= 10 && s.ly <= pie.height - 10), 'pie labels for many thin sectors are spread at least 22 px apart and stay in the frame');

  const dx = S.dataExplorerModel({ data: [5, 5, 5, 5, 6, 5, 5], show: S.MEASURES });
  const marks = dx.marks.map(m => ({ row: m.row, l: m.boxX[0], r: m.boxX[1], x: m.x }));
  ok(!marks.some((a, i) => marks.some((b, j) => j > i && a.row === b.row && a.l < b.r && b.l < a.r)), 'mean, median and mode labels at almost the same place go to different rows');
  for (const data of [[2, 4, 4, 5, 7, 9, 10], [1, 2, 2, 3, 9], [10, 10, 11, 30], [5, 6, 6, 7, 7.5, 8]]) {
    const ms = S.dataExplorerModel({ data, editable: [0] }).marks.map(m => ({ row: m.row, l: m.boxX[0], r: m.boxX[1], x: m.x }));
    const crossed = ms.some(a => ms.some(b => b !== a && b.row > a.row && a.x > b.l + 1 && a.x < b.r - 1));
    const overlap = ms.some((a, i) => ms.some((b, j) => j > i && a.row === b.row && a.l < b.r && b.l < a.r));
    ok(!crossed && !overlap, `data [${data}]: measure labels neither overlap nor sit across another mark's leader`);
  }
  ok(dx.dots.every(d => d.cy > dx.frame.top - 10 && d.cy < dx.axisY), 'stacked dots stay above the axis and inside the plot');
}

// ── 5. Words: English and Hindi ──────────────────────────────────────────────
{
  const en = S.STATS_TEXT.en; const hi = S.STATS_TEXT.hi;
  const missing = Object.keys(en).filter(k => typeof hi[k] !== 'string' || !hi[k].trim());
  ok(missing.length === 0, `every English string has a Hindi one (missing: ${missing.join(', ')})`);
  ok(Object.keys(hi).every(k => Object.hasOwn(en, k)), 'no Hindi string without an English one');
  const slots = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join();
  const bad = Object.keys(en).filter(k => hi[k] && slots(en[k]) !== slots(hi[k]));
  ok(bad.length === 0, `the Hindi strings fill the same {slots} (${bad.join(', ')})`);
  ok(Object.keys(hi).filter(k => !/^(kLabel|eqK|leK|geK|iqr|changedItem)$/.test(k)).every(k => /[ऀ-ॿ]/.test(hi[k])), 'the Hindi strings are in Devanagari');
  ok(kitText(S.STATS_TEXT, 'hi', 'heads') === 'चित' && kitText(S.STATS_TEXT, 'en', 'addName', { k: 10 }) === 'Add 10 trials', 'kitText fills the pack strings');
  const FILLER = /\b(let'?s|dive|delve|unlock|journey|crucial|powerful|seamless|exciting)\b|!/i;
  ok(!Object.values(en).some(s => FILLER.test(s)), 'no filler or exclamation marks in the English strings');
}

// ── 6. Drawn ─────────────────────────────────────────────────────────────────
const root = fileURLToPath(new URL('..', import.meta.url));
const { createServer } = await import('vite');
const react = (await import('@vitejs/plugin-react')).default;
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const server = await createServer({
  root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true },
  plugins: [react()], define: { __PRI_FEATURE_TUTOR__: 'false', __PRI_PRODUCTION_BUILD__: 'false' }
});
try {
  const reg = await server.ssrLoadModule('/src/diagrams/DiagramFromSpec.jsx');
  const h = React.createElement;
  const draw = (spec, interactive = false) => renderToStaticMarkup(h(reg.default, { spec, interactive }));
  const SPECS = {
    bar: { kind: 'barChart', categories: ['Walk', 'Bus', 'Car', 'Bike'], values: [12, 8, 5, 3], yLabel: 'Students' },
    barDual: { kind: 'barChart', categories: ['Mon', 'Tue', 'Wed'], values: [3, 4, 6], dual: { values: [5, 2, 6], label: 'Week 2' }, label: 'Week 1' },
    barHorizontal: { kind: 'barChart', categories: ['Mathematics', 'English', 'Science'], values: [24, 17, 9], horizontal: true },
    barNegative: { kind: 'barChart', categories: ['Jan', 'Feb', 'Mar', 'Apr'], values: [-3, 2, 7, -1], yLabel: 'Temperature' },
    barCrowded: { kind: 'barChart', categories: Array.from({ length: 16 }, (_, i) => `Category ${i + 1}`), values: Array.from({ length: 16 }, (_, i) => (i * 7) % 11 + 1) },
    pie: { kind: 'pieChart', categories: ['Rent', 'Food', 'Savings'], values: [1, 1, 2] },
    pieMany: { kind: 'pieChart', categories: Array.from({ length: 12 }, (_, i) => `Item ${i + 1}`), values: [30, 1, 1, 1, 1, 1, 30, 1, 1, 1, 1, 1] },
    pieOne: { kind: 'pieChart', categories: ['All'], values: [5] },
    pascal: { kind: 'pascal', rows: 5, highlight: [[5, 2]] },
    pascal12: { kind: 'pascal', rows: 12, highlight: [[12, 6]] },
    pascalBinom: { kind: 'pascal', rows: 4, show: 'binomial', highlight: [[4, 2]] },
    binomial: { kind: 'binomial', n: 4, p: 0.5, highlight: [2] },
    binomialBig: { kind: 'binomial', n: 30, p: 0.3, highlight: { atLeast: 12 } },
    binomialTen: { kind: 'binomial', n: 10, p: 0.3 }
  };
  const inBounds = (html, label) => {
    const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(html);
    ok(vb && !/<svg [^>]*\swidth="/.test(html), `${label}: a viewBox and no fixed width`);
    if (!vb) return;
    const W = Number(vb[1]); const H = Number(vb[2]);
    const main = html.slice(html.indexOf('<svg'), html.indexOf('</svg>'));
    let bad = 0;
    for (const m of main.matchAll(/\b(?:cx|x1|x2|x)="(-?[\d.]+)"/g)) if (Number(m[1]) < -2 || Number(m[1]) > W + 2) bad++;
    for (const m of main.matchAll(/\b(?:cy|y1|y2|y)="(-?[\d.]+)"/g)) if (Number(m[1]) < -2 || Number(m[1]) > H + 2) bad++;
    for (const m of main.matchAll(/ d="([^"]+)"/g)) for (const n of m[1].replace(/A\S+ \S+ \S+ [01] [01] /g, 'L').matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)) if (Number(n[1]) < -2 || Number(n[1]) > W + 2 || Number(n[2]) < -2 || Number(n[2]) > H + 2) bad++;
    ok(bad === 0, `${label}: every drawn coordinate lies inside the ${W}×${H} viewBox (${bad} outside)`);
    let off = 0;
    for (const m of main.matchAll(/<foreignObject x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)) { const [x, y, w, hh] = m.slice(1).map(Number); if (x < -2 || x + w > W + 2 || y < -2 || y + hh > H + 2) off++; }
    ok(off === 0, `${label}: every label box lies on the figure (${off} off it)`);
  };
  const figure = (html, label) => {
    ok(/<figure class="dg[^"]*" data-diagram="true">/.test(html) && /<svg [^>]*role="img"/.test(html), `${label}: one figure with an svg role="img"`);
    const t = /<title id="([^"]+)">([^<]+)<\/title>/.exec(html); const d = /<desc id="([^"]+)">([^<]+)<\/desc>/.exec(html);
    ok(t && d && d[2].length > 30 && html.includes(`aria-labelledby="${t[1]} ${d[1]}"`), `${label}: titled and described, both referenced by aria-labelledby`);
    ok(!/NaN|undefined|Infinity|\[object/.test(html), `${label}: no NaN, undefined or Infinity in the markup`);
    ok(!/katex-error/.test(html), `${label}: every KaTeX label renders`);
    ok(/class="katex"/.test(html), `${label}: labels are KaTeX`);
    for (const m of html.matchAll(/fill="url\(#([^)]+)\)"/g)) ok(html.includes(`<pattern id="${m[1]}"`), `${label}: the hatch pattern ${m[1]} is defined in the figure`);
    inBounds(html, label);
    return d ? d[2] : '';
  };
  const desc = {};
  for (const [name, spec] of Object.entries(SPECS)) desc[name] = figure(draw(spec), name);
  ok(/Walk 12; Bus 8; Car 5; Bike 3/.test(desc.bar) && /starting at 0/.test(desc.bar), 'bar chart: the words list every value and say the axis starts at 0');
  ok(/Mon 3 \/ 5/.test(desc.barDual) && /Week 1, then Week 2/.test(desc.barDual), 'dual bar chart: the words give both series');
  ok(/Item 1 30 \(42\.9%\), 155°; Item 2 1 \(1\.4%\), 5°/.test(desc.pieMany) && /add to 360°/.test(desc.pieMany), 'pie: each sector angle and percentage is stated, adding to 360°');
  ok(/Rent 1 \(25%\), 90°; Food 1 \(25%\), 90°; Savings 2 \(50%\), 180°/.test(desc.pie), 'pie [1, 1, 2]: 90°, 90°, 180°');
  ok(/<circle class="dgs-sector/.test(draw(SPECS.pieOne)) && /360°/.test(desc.pieOne), 'a one-sector pie is a full circle of 360°');
  ok(/Row 5: 1, 5, 10, 10, 5, 1/.test(desc.pascal) && /5: 32/.test(desc.pascal) && /C\(5, 2\) = 10/.test(desc.pascal), "Pascal: row 5, the row sum 32 and the highlighted C(5, 2) = 10 are stated");
  ok(/12: 4096/.test(desc.pascal12) && /C\(12, 6\) = 924/.test(desc.pascal12), 'Pascal row 12: sum 4096 and C(12, 6) = 924');
  ok(/tbinom|mfrac/.test(draw(SPECS.pascalBinom)), "Pascal in binomial form draws binomial coefficients");
  ok(/0\.0625, 0\.25, 0\.375, 0\.25, 0\.0625/.test(desc.binomial) && /E\(X\) = np = 2/.test(desc.binomial) && /P\(X = 2\)[^.]*0\.375/.test(desc.binomial), 'binomial B(4, 1/2): the words give every probability, the mean and P(X = 2) = 0.375');
  ok(/E\(X\) = np = 3/.test(desc.binomialTen) && /np\(1 − p\) = 2\.1/.test(desc.binomialTen), 'binomial B(10, 0.3): mean 3 and variance 2.1 in the words');
  ok(/P\(X ≥ 12\)/.test(desc.binomialBig), 'binomial with atLeast: the event is named in the words');
  ok(draw(SPECS.binomialBig).match(/dgs-hatch"/g)?.length === 19, 'binomial B(30, 0.3) with X ≥ 12: 19 highlighted bars are hatched as well as coloured');

  // Interactive kinds, and what a question gets instead.
  const INTER = {
    binomialExplorer: { kind: 'binomialExplorer', n: 10, p: 0.3, highlight: { atLeast: 8 } },
    probabilitySim: { kind: 'probabilitySim', experiment: 'twoDiceSum', event: [7], seed: 3 },
    probabilitySimCoin: { kind: 'probabilitySim', experiment: 'coin', seed: 1 },
    probabilitySimSpinner: { kind: 'probabilitySim', experiment: 'spinner', sectors: [{ label: 'Red', weight: 1 }, { label: 'Blue', weight: 2 }, { label: 'Green', weight: 3 }], seed: 11 },
    dataExplorer: { kind: 'dataExplorer', data: [2, 4, 4, 5, 7, 9, 10], editable: [6] }
  };
  for (const [name, spec] of Object.entries(INTER)) {
    const html = draw(spec, true);
    ok(/data-diagram-interactive/.test(html) && /<section [^>]*aria-labelledby=/.test(html) && /<h4 class="dgi-title"/.test(html), `${name}: a titled section`);
    const ranges = [...html.matchAll(/<input[^>]*type="range"[^>]*>/g)].map(m => m[0]);
    ok(ranges.every(r => /\bid="/.test(r) && /\bmin="/.test(r) && /\bmax="/.test(r) && /\bstep="/.test(r) && /aria-valuetext="/.test(r) && html.includes(`<label for="${/id="([^"]+)"/.exec(r)[1]}"`)), `${name}: every slider is a labelled native range input`);
    ok(/role="status" aria-live="polite"/.test(html), `${name}: a polite live region`);
    ok(/<button/.test(html) && !/<button(?![^>]*type="button")/.test(html), `${name}: real buttons, each type="button"`);
    figure(html.slice(html.indexOf('<figure'), html.indexOf('</figure>') + 9), `${name} (figure)`);
    const asked = draw(spec, false);
    ok(!/data-diagram-interactive|type="range"|<button/.test(asked) && /role="img"/.test(asked), `${name}: a question gets the static counterpart, with no control`);
  }
  ok((draw(INTER.binomialExplorer, true).match(/type="range"/g) || []).length === 3 && /aria-pressed="true"[^>]*>P\(X ≥ k\)/.test(draw(INTER.binomialExplorer, true)), 'binomial explorer: sliders for n, p and k, and the ≥ button is pressed');
  ok(/P\(X\\ge 8\)=0\.0016/.test(draw(INTER.binomialExplorer, true)) && /np\(1-p\)=2\.1/.test(draw(INTER.binomialExplorer, true)), 'binomial explorer readout: P(X ≥ 8) = 0.0016, Var(X) = 2.1');
  const sim = draw(INTER.probabilitySim, true);
  ok(['Add 1 trial', 'Add 10 trials', 'Add 100 trials', 'Add 1000 trials'].every(n => sim.includes(`aria-label="${n}"`)) && />Reset</.test(sim), 'the simulator has +1, +10, +100, +1000 and Reset buttons');
  ok((sim.slice(0, sim.indexOf('</svg>')).match(/class="dgs-theory"/g) || []).length === 11 && /No trials yet/.test(sim), 'two dice: 11 theoretical-probability lines, and the readout says no trials yet');
  ok(/1\/36[^.]*6\/36/.test(sim) || /2 1\/36; 3 2\/36/.test(sim), 'two dice: the description gives 1/36 … 6/36');
  ok(/frac/.test(sim) && /dgs-legend/.test(sim), 'theoretical probabilities are typeset fractions, with a legend');
  ok(/Heads/.test(draw(INTER.probabilitySimCoin, true)) && /Toss a coin/.test(draw(INTER.probabilitySimCoin, true)), 'the coin is labelled Heads and Tails');
  const counter = draw(INTER.probabilitySim, false);
  ok(/theoretical probability of each outcome: 2 1\/36; 3 2\/36; 4 3\/36; 5 4\/36; 6 5\/36; 7 6\/36/.test(counter) && /add to 1/.test(counter), `in a question the simulator becomes a bar chart of the theoretical probabilities (${(/<desc[^>]*>([^<]+)/.exec(counter) || [])[1]})`);
  const spinQ = draw(INTER.probabilitySimSpinner, false);
  ok(/Red 1\/6; Blue 1\/3; Green 1\/2/.test(spinQ), 'a spinner weighted 1 : 2 : 3 becomes 1/6, 1/3, 1/2');
  const dx = draw(INTER.dataExplorer, true);
  ok(/mean 5\.8571/.test(dx) && /median 5/.test(dx) && /mode 4/.test(dx) && /range 8/.test(dx) && /interquartile range 5/.test(dx) && /population standard deviation 2\.6954/.test(dx), 'data explorer: the description gives every measure (mean 41/7, median 5, mode 4, range 8, IQR 5, population sd)');
  ok(/population standard deviation \(divide by n\)/.test(dx), 'data explorer: the readout says the standard deviation is the population one');
  ok(/class="dgs-dot-edit"/.test(dx) && (dx.match(/class="dg-dot"/g) || []).length === 6, 'the movable value is an open ring; the others are solid dots');
  ok(/box plot: minimum 2, lower quartile 4, median 5, upper quartile 9, maximum 10/.test(draw(INTER.dataExplorer, false)), 'in a question the data explorer becomes the box plot of the same data');
} finally {
  await server.close();
}

if (failures.length) {
  console.error(`DIAGRAM PACK STATS: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures.slice(0, 60)) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`DIAGRAM PACK STATS: PASS — ${pass}/${pass} checks — exact binomial, Pascal, pie and dice values; a reproducible seeded simulator that converges; helpful validators; accessible, in-bounds figures in English and Hindi`);
