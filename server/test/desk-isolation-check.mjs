// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the Exam Desk cannot reach the marking path (plan F4a)
//
// The desk (unmarked practice) is safe by construction only while it shares no
// code with marking, exam counting or learning events. This check walks the
// WHOLE static import graph from the desk's modules — every relative import,
// transitively — and fails if any module of the marking path is reachable:
// the exam router, practice, the marker and its pool/worker, marking policy,
// content-seen, recognition and handwriting, the sync/learning-event writer,
// the entitlement and allowance code, the engine's checker/marker, or the
// device exam session's marking helpers. It also proves the exam router and
// the housekeeping sweep never name the desk's table, and that the desk's
// own code names no learning-event, receipt or celebration writer.
//
// A self-test proves the walk is not vacuous: from exams.js it does reach the
// marker.
//
//   node server/test/desk-isolation-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const IMPORT = /(?:^|[\s;])(?:import|export)\s+(?:[^'"`]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gm;
function importsOf(file) {
  const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const out = [];
  for (const m of text.matchAll(IMPORT)) {
    const spec = m[1] || m[2];
    if (!spec.startsWith('.')) continue;
    let target = resolve(dirname(file), spec);
    if (!existsSync(target) && existsSync(`${target}.js`)) target = `${target}.js`;
    if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.js');
    out.push(target);
  }
  return out;
}
/** Every module reachable from the entries, by relative static or dynamic import. */
function reachable(entries, { stopAt = [] } = {}) {
  const stop = new Set(stopAt.map(f => resolve(ROOT, f)));
  const seen = new Set();
  const stack = entries.map(e => resolve(ROOT, e));
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    if (stop.has(file)) continue;
    for (const next of importsOf(file)) stack.push(next);
  }
  return [...seen].map(f => relative(ROOT, f));
}
const filesUnder = dir => {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { recursive: true }).map(f => join(dir, String(f))).filter(f => /\.(m?js|jsx)$/.test(f));
};

// The marking path: none of these may be reachable from the desk.
const FORBIDDEN = [
  /^server\/platform\/exams\.js$/, /^server\/platform\/practice\.js$/, /^server\/platform\/marker(Pool|Ops|Worker)\.js$/,
  /^server\/platform\/markingPolicy\.js$/, /^server\/platform\/markRows\.js$/, /^server\/platform\/contentSeen\.js$/,
  /^server\/platform\/recognitionOps\.js$/, /^server\/platform\/handwriting(Provider)?\.js$/, /^server\/platform\/working(Provider)?\.js$/,
  /^server\/platform\/sync\.js$/,
  /^server\/platform\/finalAttempt\.js$/, /^server\/platform\/tutor/, /^server\/platform\/indiaBanks\.js$/,
  /^client\/src\/engine\/checker/, /^client\/src\/engine\/marker/, /^client\/src\/engine\/marking/, /^client\/src\/engine\/methodMarks/,
  /^client\/src\/engine\/examAllowance\.js$/, /^client\/src\/engine\/generators\//, /^client\/src\/local\/examSession\.js$/,
  /^client\/src\/local\/backend\.js$/
];
// The desk's modules: the router, the two pure engine modules, and (plan F4b) the client desk.
const DESK_ENTRIES = ['server/platform/desk.js', 'client/src/engine/deskClock.js', 'client/src/engine/deskImport.js', ...filesUnder('client/src/desk')];
const graph = reachable(DESK_ENTRIES);
ok(graph.includes('server/platform/desk.js') && graph.includes('client/src/engine/deskClock.js') && graph.includes('client/src/engine/deskImport.js'),
  `the walk starts at the desk's modules (${graph.length} reachable)`);
for (const pattern of FORBIDDEN) {
  const hit = graph.filter(f => pattern.test(f));
  ok(!hit.length, `the desk reaches no marking-path module ${pattern}${hit.length ? ` — reached ${hit.join(', ')}` : ''}`);
}
// The entitlement and allowance code is reachable only through config.js,
// which every router shares to validate the deployment's settings at boot
// (practiceAllowanceConfigProblems). Without that one shared edge the desk
// reaches neither: nothing of the desk counts, reads or spends an allowance.
const ALLOWANCE = [/^server\/platform\/entitlements\.js$/, /^server\/platform\/practiceAllowance\.js$/];
const withoutConfig = reachable(DESK_ENTRIES, { stopAt: ['server/platform/config.js'] });
for (const pattern of ALLOWANCE) ok(!withoutConfig.some(f => pattern.test(f)), `the desk reaches ${pattern} only through the shared boot-time config.js`);
ok(!/practiceAllowance|entitlement|allowance/i.test(readFileSync(join(ROOT, 'server/platform/desk.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '')), 'desk.js calls no allowance or entitlement code');

// The pure modules are pure: they import nothing outside themselves.
ok(reachable(['client/src/engine/deskClock.js']).length === 1, 'deskClock.js imports nothing');
ok(reachable(['client/src/engine/deskImport.js']).sort().join() === ['client/src/engine/deskClock.js', 'client/src/engine/deskImport.js'].join(), 'deskImport.js imports only deskClock.js');

// Self-test: the same walk from the exam router reaches the marker.
const examGraph = reachable(['server/platform/exams.js']);
ok(examGraph.some(f => /^server\/platform\/markerPool\.js$/.test(f)) && examGraph.some(f => /^server\/platform\/contentSeen\.js$/.test(f)),
  'self-test: from exams.js the walk does reach the marker pool and contentSeen');

// What the desk's own source names.
const deskSource = DESK_ENTRIES.map(f => readFileSync(join(ROOT, f), 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');
for (const [label, pattern] of [
  ['learning_events', /learning_events/], ['idempotency_keys (exam/practice receipts)', /idempotency_keys/], ['celebrate(', /celebrate\(/],
  ['nextSyncCursor', /nextSyncCursor/], ['a score field', /\bscore\b/i], ['an awarded field', /\bawarded\b/i]
]) ok(!pattern.test(deskSource), `the desk's code names no ${label}`);

// The marked mode and the sweep never read the desk's table.
for (const f of ['server/platform/exams.js', 'server/platform/housekeeping.js', 'server/platform/practice.js', 'server/platform/entitlements.js', 'server/platform/sync.js']) {
  ok(!/desk_attempts/.test(readFileSync(join(ROOT, f), 'utf8')), `${f} never names desk_attempts`);
}

if (failures.length) {
  console.error(`DESK ISOLATION: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`DESK ISOLATION: PASS — ${pass}/${pass} checks`);
