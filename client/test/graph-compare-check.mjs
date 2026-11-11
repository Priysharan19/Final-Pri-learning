// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a confirmed sketch is compared with the ENGINE's graph
//
// client/src/engine/graphCompare.js: the truth side comes from plot.js on the
// function the question states; the student side only from a confirmed set.
// "What went wrong?" names the feature while the attempt is open and gives
// values only once it is resolved. It never sets a mark. Synthetic inputs.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareGraphFeatures, graphDiagnosis, graphTruth } from '../src/engine/graphCompare.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const C = f => ({ confirmedByStudent: true, intercepts: { x: [], y: [] }, turning: [], asymptotes: [], ...f });

// ── the engine's graph ───────────────────────────────────────────────────────
const parab = graphTruth('(x+2)*(x-3)/2');
eq(parab.intercepts, { x: [-2, 3], y: [-3] }, 'parabola intercepts from the engine');
eq(parab.turning, [{ x: 0.5, y: -3.125, kind: 'min' }], 'its minimum');
const hyp = graphTruth('1/(x-1)+2');
eq(hyp.asymptotes, [{ axis: 'x', value: 1 }, { axis: 'y', value: 2 }], 'hyperbola asymptotes x = 1, y = 2');
eq(hyp.turning, [], 'no false turning point beside a vertical asymptote');
eq(graphTruth('x^2 +'), null, 'an expression the engine cannot read has no truth');

// ── comparing ────────────────────────────────────────────────────────────────
const right = C({ intercepts: { x: [-2, 3], y: [-3] }, turning: [{ x: 0.5, y: -3, kind: 'min' }] });
ok(compareGraphFeatures(right, parab).every(v => v.ok), 'a sketch within half a unit matches on every feature');
eq(graphDiagnosis(compareGraphFeatures(right, parab)), null, 'and has nothing to diagnose');
eq(compareGraphFeatures({ ...right, confirmedByStudent: false }, parab), null, 'an unconfirmed set is never compared');
const offTurn = C({ intercepts: { x: [-2, 3], y: [-3] }, turning: [{ x: 2, y: -3, kind: 'min' }] });
const v = compareGraphFeatures(offTurn, parab);
eq(v.filter(x => !x.ok).map(x => x.feature), ['turning'], 'only the turning point is off');

// ── what went wrong ──────────────────────────────────────────────────────────
const open = graphDiagnosis(v, { resolved: false });
ok(open.feature === 'turning' && /turning point/.test(open.wentWrong) && !/\d/.test(open.wentWrong), `open: names the feature, gives no value ("${open.wentWrong}")`);
const done = graphDiagnosis(v, { resolved: true });
eq(done.wentWrong, "Your turning point is at x = 2, but the function's minimum is at x = 0.5.", 'resolved: both values');
const missX = graphDiagnosis(compareGraphFeatures(C({ intercepts: { x: [-2], y: [-3] }, turning: [{ x: 0.5, y: -3 }] }), parab), { resolved: true });
ok(missX.feature === 'intercepts.x' && /x = 3/.test(missX.wentWrong), `a missing x-intercept is named (${missX.wentWrong})`);
const openX = graphDiagnosis(compareGraphFeatures(C({ intercepts: { x: [-2, 4], y: [-3] } }), parab), { resolved: false });
ok(!/\d/.test(openX.wentWrong.replace(/x-axis|y-axis/g, '')), `open intercept wording has no number (${openX.wentWrong})`);
const asym = graphDiagnosis(compareGraphFeatures(C({ intercepts: { x: [0.5], y: [1] }, asymptotes: [{ axis: 'x', value: -1 }, { axis: 'y', value: 2 }] }), hyp), { resolved: true });
ok(asym.feature === 'asymptotes.x' && /x = −1/.test(asym.wentWrong) && /x = 1/.test(asym.wentWrong), `a wrong vertical asymptote is named with both values (${asym.wentWrong})`);

// ── the diagnose route uses it, deterministically ────────────────────────────
const backend = readFileSync(join(ROOT, 'client/src/local/backend.js'), 'utf8');
const handler = backend.slice(backend.indexOf("'POST /practice/:id/tutor/diagnose'"), backend.indexOf("'POST /practice/:id/tutor/line-check'"));
ok(/graphWork\(q, solution, body\?\.work\?\.graph, \{ resolved: resolvedRow \}\)/.test(handler) && /source: 'deterministic'/.test(handler), 'the diagnose route answers a confirmed sketch from the engine, resolved or not');
ok(/raw\.confirmedByStudent !== true\) return null/.test(backend), 'only a confirmed set is compared');
const src = readFileSync(join(ROOT, 'client/src/engine/graphCompare.js'), 'utf8').replace(/\/\/.*$/gm, '');
ok(!/\bmark\s*[:=]|score\s*[:=]|correct\s*[:=]/.test(src), 'the comparison sets no mark');

if (failures.length) {
  console.error(`GRAPH COMPARE: FAIL — ${failures.length} of ${pass + failures.length} checks`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`GRAPH COMPARE: PASS — ${pass}/${pass} checks — engine truth, confirmed sets only, open attempts name the feature not the value.`);
