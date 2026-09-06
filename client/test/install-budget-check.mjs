// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what a first install costs a phone, and what it must still do
//
// The median Indian secondary student meets this app on a budget Android phone
// on metered data, not on the iPad it was designed against. A performance win
// nobody measures is gone within a month — some new static import creeps back
// onto the boot path, some chunk quietly rejoins the install — so the budget is
// pinned here rather than described in a commit message.
//
// This suite reads the manifests the pri-precache plugin writes into
// dist/sw.js and asserts four things about them:
//
//   1. the install stays under a stated byte ceiling, raw and gzipped, because
//      the second is what the student's data pack actually pays;
//   2. the named heavy things — the handwriting weights, the PDF renderer, the
//      other five years' question banks, the scripts nobody here writes in —
//      are not in it;
//   3. the app can still render from the install alone. Every file the built
//      index.html blocks on has to be in the install, or a first run on a
//      flaky link paints nothing;
//   4. offline-first is intact. Every file the build emits is accounted for by
//      one of the manifests or by a documented on-demand rule, so a new chunk
//      cannot fall out of offline cover without this failing.
//
// It then reads the worker itself for its half of the contract, and drives
// offlineWarm.js — the module that asks the worker to finish the job — against
// fake windows, because the decision that module makes (do we spend 0.9 MB on
// the recogniser?) is the one place a mistake costs a student money.
//
// Usage:  node client/test/install-budget-check.mjs [--no-build]
// A fresh build is made first unless --no-build, so this can never be green
// about a dist somebody left behind three commits ago.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, statSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { optionalWarmAllowed, warmOfflineBuild } from '../src/local/offlineWarm.js';
import { ON_DEMAND, PRECACHE_SKIP } from '../vite.config.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DIST = join(ROOT, 'client', 'dist');

// ── The budget ───────────────────────────────────────────────────────────────
// Measured on the build these numbers were set against: 1,159 kB raw / 509 kB
// gzipped in the install, 1,948 kB / 761 kB by the time the warm pass has
// finished. Before this work the install alone was 3,792 kB raw / 1,776 kB
// gzipped. The ceilings sit roughly 10% above what was measured — enough that
// an honest feature can land, tight enough that the boot path rejoining the
// install cannot. Raising one is a decision, and it should read like one in the
// diff.

const INSTALL_RAW_CEILING = 1_300_000;
const INSTALL_GZIP_CEILING = 560_000;
const FIRST_VISIT_RAW_CEILING = 2_150_000;
const FIRST_VISIT_GZIP_CEILING = 850_000;

// Things that must never be in the install again, and what each one costs.
const BANNED_FROM_INSTALL = [
  [/(^|\/)ink-model-/, 'the 799 kB handwriting model'],
  [/(^|\/)ink-engine-/, 'the handwriting recogniser'],
  [/(^|\/)pdf(\.worker)?-/, 'the PDF renderer'],
  [/(^|\/)year(7|8|9|10|11|12)-/, 'a whole year of question bank'],
  [/(^|\/)streams-(standard|ext)-/, 'a senior stream question bank'],
  [/(^|\/)india-(algebra|calculus|class10|coordinate|foundation|junior-overlay|olympiad|senior)-/, 'an Indian question bank'],
  [/(^|\/)inter-(cyrillic|greek|vietnamese)/, 'an Inter subset for a script this app never paints'],
  [/(^|\/)KaTeX_(Fraktur|Script|Caligraphic|Typewriter|SansSerif)-/, 'a KaTeX face no generator here emits']
];

// The on-demand rules are read from the build config rather than copied here.
// A second copy would agree with the first exactly until the day it mattered.
const onDemandReason = (file) => ON_DEMAND.find(([re]) => re.test(file))?.[1] || null;

// ── Assertions ───────────────────────────────────────────────────────────────

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(Object.is(a, b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const kb = (n) => `${(n / 1024).toFixed(0)} kB`;

// ── A build to measure ───────────────────────────────────────────────────────

if (!process.argv.includes('--no-build')) {
  const built = spawnSync('npx', ['vite', 'build'], { cwd: join(ROOT, 'client'), encoding: 'utf8' });
  if (built.status !== 0) {
    console.log(`INSTALL BUDGET: FAIL — the client did not build\n${built.stderr || built.stdout}`);
    process.exit(1);
  }
}
if (!existsSync(join(DIST, 'sw.js'))) {
  console.log('INSTALL BUDGET: FAIL — no client/dist/sw.js to measure. Run `npm run build` first, or drop --no-build.');
  process.exit(1);
}

const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
const manifest = (name) => {
  const m = sw.match(new RegExp(`^const ${name} = (.*);$`, 'm'));
  return m ? JSON.parse(m[1]) : null;
};
const PRECACHE = manifest('PRECACHE');
const WARM = manifest('WARM');
const OPTIONAL = manifest('OPTIONAL');

ok(Array.isArray(PRECACHE) && PRECACHE.length > 1, 'the build wrote an install manifest into the worker');
ok(Array.isArray(WARM) && WARM.length > 0, 'and a warm manifest for what the install no longer carries');
ok(Array.isArray(OPTIONAL) && OPTIONAL.length > 0, 'and an optional one for the recogniser');
if (!PRECACHE || !WARM || !OPTIONAL) {
  console.log(`INSTALL BUDGET: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`);
  process.exit(1);
}

const fileOf = (url) => (url === '/' ? 'index.html' : url.slice(1));
const raw = (url) => { try { return statSync(join(DIST, fileOf(url))).size; } catch { return NaN; } };
const gzip = (url) => { try { return gzipSync(readFileSync(join(DIST, fileOf(url))), { level: 9 }).length; } catch { return NaN; } };
const total = (urls, of) => urls.reduce((sum, url) => sum + of(url), 0);

// ── 1 · The ceiling ──────────────────────────────────────────────────────────

const missing = PRECACHE.filter(url => Number.isNaN(raw(url)));
eq(missing.length, 0, `every file the install names was actually emitted (${JSON.stringify(missing.slice(0, 4))})`);

const installRaw = total(PRECACHE, raw);
const installGzip = total(PRECACHE, gzip);
ok(installRaw <= INSTALL_RAW_CEILING,
  `the install is ${kb(installRaw)} raw, over the ${kb(INSTALL_RAW_CEILING)} ceiling`);
ok(installGzip <= INSTALL_GZIP_CEILING,
  `the install is ${kb(installGzip)} gzipped, over the ${kb(INSTALL_GZIP_CEILING)} ceiling — this is the number a metered data pack pays`);

const firstVisit = [...PRECACHE, ...WARM];
const firstVisitRaw = total(firstVisit, raw);
const firstVisitGzip = total(firstVisit, gzip);
ok(firstVisitRaw <= FIRST_VISIT_RAW_CEILING,
  `install plus warm is ${kb(firstVisitRaw)} raw, over the ${kb(FIRST_VISIT_RAW_CEILING)} ceiling`);
ok(firstVisitGzip <= FIRST_VISIT_GZIP_CEILING,
  `install plus warm is ${kb(firstVisitGzip)} gzipped, over the ${kb(FIRST_VISIT_GZIP_CEILING)} ceiling`);

// The split is the point: an install that has quietly re-absorbed the warm tier
// meets the ceiling above and still blocks the first paint behind everything.
ok(PRECACHE.length < firstVisit.length,
  'the install is a proper subset of the offline build — something has folded the warm tier back into it');

// ── 2 · What is not in it ────────────────────────────────────────────────────

for (const [pattern, what] of BANNED_FROM_INSTALL) {
  const found = PRECACHE.filter(url => pattern.test(url));
  eq(found.length, 0, `${what} is not in the install (${JSON.stringify(found)})`);
}

// The recogniser is not merely absent — it is somewhere a stylus device can
// still be given it in advance, rather than left to fetch it mid-question.
ok(OPTIONAL.some(url => /ink-model-/.test(url)), 'the handwriting model is in the optional tier, not simply dropped');
ok(OPTIONAL.some(url => /ink-engine-/.test(url)), 'and so is the recogniser that reads it');
ok(!OPTIONAL.some(url => /(^|\/)pdf/.test(url)), 'the PDF renderer stays fully on demand — nothing warms 2.7 MB speculatively');

// ── 3 · The install can still paint the app ──────────────────────────────────
// A student whose link dies right after install must get a working first
// screen, so everything index.html blocks on has to have been written by it.

const shell = readFileSync(join(DIST, 'index.html'), 'utf8');
const blocking = [...shell.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map(m => m[1]);
ok(blocking.length > 5, `index.html was read for what it blocks on (${blocking.length} references)`);
const absent = blocking.filter(url => !PRECACHE.includes(url));
eq(absent.length, 0, `every file the first paint blocks on is in the install (${JSON.stringify(absent)})`);

ok(PRECACHE.includes('/') && PRECACHE.includes('/index.html'),
  'the shell is installed under both the names a navigation can arrive at');
ok(PRECACHE.some(url => /inter-latin-wght-normal/.test(url)),
  'the Latin Inter subset is installed — it paints every word of the interface');
ok(PRECACHE.some(url => /KaTeX_Main-Regular/.test(url)) && PRECACHE.some(url => /KaTeX_Math-Italic/.test(url)),
  'and the KaTeX faces a rendered question is set in');
ok(PRECACHE.includes('/manifest.webmanifest'), 'the web manifest is installed, so the app can be added to a home screen offline');

// ── 4 · Nothing has fallen out of offline cover ──────────────────────────────

function emitted(dir = DIST, base = '') {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...emitted(join(dir, entry.name), rel));
    else if (!PRECACHE_SKIP.test(rel)) out.push(`/${rel}`);
  }
  return out;
}

ok(ON_DEMAND.length >= 5 && ON_DEMAND.every(([re, why]) => re instanceof RegExp && typeof why === 'string' && why.length > 3),
  'every on-demand rule the build applies carries a written reason');

const held = new Set([...PRECACHE, ...WARM, ...OPTIONAL]);
const orphans = emitted().filter(url => !held.has(url) && !onDemandReason(url.slice(1)));
eq(orphans.length, 0,
  `every emitted file is installed, warmed, optional or covered by a documented on-demand rule — these are in none of those and would be unreachable offline: ${JSON.stringify(orphans)}`);

const duplicated = PRECACHE.filter(url => WARM.includes(url));
eq(duplicated.length, 0, `no file is in both the install and the warm pass (${JSON.stringify(duplicated)})`);

// ── 5 · The worker's half of the contract ────────────────────────────────────
// Read as text: sw.js runs in a worker global this suite has no way to mount.

ok(/const VERSION = 'pri-[0-9a-f]{12}'/.test(sw), 'the cache is named after a digest of this exact build');
ok(/'pri-warm'/.test(sw), 'the worker answers the warm request the app sends');
ok(/cache: hashed\(url\) \? 'default' : 'reload'/.test(sw),
  'hashed files are fetched through the HTTP cache and only the shell forces a reload — forcing it for everything made the phone download the boot path twice');

// ── 6 · Who pays for the recogniser ──────────────────────────────────────────
// 0.9 MB warmed on a metered link is real money to the student this budget is
// for, so the rule is asserted rather than trusted.

ok(optionalWarmAllowed({ __PRI_NATIVE__: true }),
  'the native iPad shell warms the recogniser — its assets are local files and cost nothing');
ok(optionalWarmAllowed({ navigator: { connection: { effectiveType: '4g', saveData: false } } }),
  'an unmetered 4G browser warms it too');
ok(!optionalWarmAllowed({ navigator: { connection: { effectiveType: '4g', saveData: true } } }),
  'Data Saver means no, even on 4G — the student has said what they want');
ok(!optionalWarmAllowed({ navigator: { connection: { effectiveType: '3g', saveData: false } } }),
  'a 3G link does not spend 0.9 MB on a feature the student has not asked for');
ok(!optionalWarmAllowed({ navigator: { connection: { effectiveType: '2g', saveData: false } } }), 'and neither does 2G');
ok(!optionalWarmAllowed({ navigator: {} }),
  'a browser that reports no connection at all is treated as expensive rather than guessed at');

// ── 7 · Asking for the warm pass ─────────────────────────────────────────────

const fakeWorker = (reply) => {
  const sent = [];
  return {
    sent,
    scope: {
      navigator: { serviceWorker: { controller: { postMessage: (msg, transfer) => { sent.push(msg); reply?.(transfer?.[0], msg); } } } }
    }
  };
};

const noWorker = await warmOfflineBuild({ scope: { navigator: {} } });
eq(noWorker, null, 'with no worker in control, asking to warm resolves to nothing rather than throwing');

const answered = fakeWorker((port) => { port.postMessage({ type: 'pri-warmed', warmed: 7, of: 7 }); });
const result = await warmOfflineBuild({ scope: { ...answered.scope, __PRI_NATIVE__: true } });
eq(result?.warmed, 7, 'a worker that answers reports how much of the offline build it now holds');
eq(answered.sent[0]?.type, 'pri-warm', 'the request is the message the worker listens for');
eq(answered.sent[0]?.optional, true, 'and it carries the optional decision the page made, not one the worker guessed');

const metered = fakeWorker((port) => { port.postMessage({ type: 'pri-warmed', warmed: 3, of: 3 }); });
metered.scope.navigator.connection = { effectiveType: '2g', saveData: true };
await warmOfflineBuild({ scope: metered.scope });
eq(metered.sent[0]?.optional, false, 'on a metered 2G link the recogniser is left out of the request');

const silent = fakeWorker();
const timedOut = await warmOfflineBuild({ scope: silent.scope, timeoutMs: 30 });
eq(timedOut, null, 'a worker that never answers resolves rather than leaving the page waiting on it forever');

// ── Report ───────────────────────────────────────────────────────────────────

console.log(failures.length
  ? `INSTALL BUDGET: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `INSTALL BUDGET: PASS — ${pass}/${pass} checks — install ${kb(installRaw)} raw / ${kb(installGzip)} gzip under ${kb(INSTALL_RAW_CEILING)}/${kb(INSTALL_GZIP_CEILING)}, whole offline build ${kb(firstVisitRaw)} raw / ${kb(firstVisitGzip)} gzip, ${PRECACHE.length} files installed and ${WARM.length} warmed, nothing emitted left uncovered.`);
process.exit(failures.length ? 1 : 0);
