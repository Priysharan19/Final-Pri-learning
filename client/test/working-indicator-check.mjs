// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the working indicator stays honest (Lit Instrument D6)
//
// client/src/instrument/Working.jsx draws "Construction": three points settle
// into the edition's cut, the line draws, holds and lets go. It may show only
// while real work is in flight. This suite holds:
//
//   1. one component: Working.jsx is the only element that carries
//      .pri-working, and the indicator's motion lives in one CSS block;
//   2. honest call sites: every <Working> passes a pending flag derived from a
//      request or a load (never a literal), or is a Suspense fallback, which is
//      mounted exactly while its chunk is in flight; the sites the brief names
//      are all migrated, and the old status dot and skeleton shimmer are gone
//      from them;
//   3. the clock (fake timers): nothing for 400 ms, then shown; once shown, at
//      least 480 ms; then a 120 ms fade; fast work shows nothing at all;
//   4. (--browser) under prefers-reduced-motion nothing transforms and only the
//      line's opacity breathes; in forced colours nothing moves (Chromium,
//      computed style on the real stylesheet);
//   5. (--dist <dir>, --both) a build carries its own edition's form only: its
//      line path is in the bundle once and the other edition's is absent;
//      --both also builds the other edition into a temporary folder.
//
// Usage: node client/test/working-indicator-check.mjs [--browser] [--dist <dir>] [--both]
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { mock } from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EDITIONS, EDITION_IDS } from '../edition.config.mjs';
import { WORKING_FORMS } from '../src/instrument/workingForms.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CLIENT = join(ROOT, 'client');
const read = rel => readFileSync(join(ROOT, rel), 'utf8');
const args = process.argv.slice(2);
const BROWSER = args.includes('--browser');
const BOTH = args.includes('--both');
const DIST = args.includes('--dist') ? args[args.indexOf('--dist') + 1] : (BOTH ? join(CLIENT, 'dist') : null);

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const walk = (d, base = '') => readdirSync(d).flatMap(n => {
  const p = join(d, n), r = base ? `${base}/${n}` : n;
  return statSync(p).isDirectory() ? walk(p, r) : [r];
});

// ── 1 · one component ────────────────────────────────────────────────────────
const SRC = join(CLIENT, 'src');
const sources = walk(SRC).filter(f => /\.(jsx?|mjs)$/.test(f));
const usesClass = sources.filter(f => /pri-working/.test(readFileSync(join(SRC, f), 'utf8')));
ok(usesClass.length === 1 && usesClass[0] === 'instrument/Working.jsx', `Working.jsx is the only element that carries .pri-working: ${usesClass.join(', ')}`);
const component = read('client/src/instrument/Working.jsx');
ok(/aria-hidden="true"/.test(component) && !/role=/.test(component) && !/aria-live/.test(component), 'the drawing is hidden from assistive technology and adds no live region of its own (the caller\'s region speaks)');
ok(/edition\(\)\.identity\.working/.test(component) && !/WORKING_FORMS/.test(component), 'the form comes from this build\'s edition record, never the table of both forms');
ok(!/setInterval|requestAnimationFrame|\.animate\(/.test(component), 'no JS animation: the motion is CSS');
const instrument = read('client/src/instrument/instrument.css');
const ind = instrument.slice(instrument.indexOf('/* ── UI-IND'));
ok(/\.pri-working \{[^}]*color: var\(--in-tx-2\)/.test(ind), 'its base colour is ink (--in-tx-2), so the instrument skin works without Aurora');
ok(!/--in-(good|bad|slip)|--edition-accent/.test(ind), 'never a verdict colour, and the edition light only through aurora.css');
const keyframes = [...ind.matchAll(/@keyframes (pri-w-[a-z]+) \{([^@]*?\} )\}/g)];
ok(keyframes.length === 4 && keyframes.every(([, , body]) => !/(width|height|left|top|stroke-width|r:)/.test(body)), `motion is transform, opacity and one dash offset only (${keyframes.map(k => k[1]).join(', ')})`);
ok(!/vector-effect/.test(ind), 'no vector-effect: non-scaling-stroke (it breaks the pathLength dash in Chromium)');
ok(/strokeWidth=\{STROKE\[size\]\}/.test(component) && /16: 2\.25, 24: 1\.5, 40: 0\.9/.test(component), 'the stroke is 1.5 px at 16, 24 and 40 px');
const aurora = read('client/src/instrument/aurora.css');
ok(/html\.ui-instrument\.skin-aurora \.pri-working svg \{ color: var\(--au-light\); \}/.test(aurora) && !/\.pri-working \{[^}]*--au-light/.test(aurora), 'under Aurora the drawing is the edition light (D6) and its label stays ink, so the accent is never text here');
const bytes = Buffer.byteLength(component) + Buffer.byteLength(read('client/src/instrument/workingClock.js'));
console.log(`  component + clock source: ${bytes} bytes; CSS block: ${Buffer.byteLength(ind)} bytes (before minification)`);

// ── 2 · honest call sites ────────────────────────────────────────────────────
const SITES = {
  'App.jsx': 1, // RouteLoading, a Suspense fallback
  'components/QuestionCard.jsx': 6, // status line, reading your work, line check, three tutor fallbacks
  'pages/PractisePhoto.jsx': 1,
  'instrument/IndexPage.jsx': 1,
  'instrument/MapPage.jsx': 1,
  'instrument/ReportHead.jsx': 1
};
const sites = [];
for (const f of sources.filter(f => f !== 'instrument/Working.jsx')) {
  const text = readFileSync(join(SRC, f), 'utf8');
  for (const m of text.matchAll(/<Working\b([^>]*)\/>/g)) sites.push({ f, attrs: m[1], line: text.slice(0, m.index).split('\n').length, before: text.slice(Math.max(0, m.index - 400), m.index) });
}
const counts = sites.reduce((c, s) => ({ ...c, [s.f]: (c[s.f] || 0) + 1 }), {});
ok(JSON.stringify(Object.entries(counts).sort()) === JSON.stringify(Object.entries(SITES).sort()), `the indicator is in exactly the migrated sites: ${JSON.stringify(counts)}`);
const app = read('client/src/App.jsx');
for (const s of sites) {
  const expr = s.attrs.match(/pending=\{([^}]+)\}/)?.[1];
  const derived = expr && !/^\s*(true|false|1|0|null|undefined|'[^']*')\s*$/.test(expr);
  const fallback = /\bpending\b(?!=)/.test(s.attrs) && (/fallback=\{<div[^>]*>$/.test(s.before) || (s.f === 'App.jsx' && /function RouteLoading\(\) \{[\s\S]*return <p[^>]*>$/.test(s.before)));
  ok(derived || fallback, `${s.f}:${s.line} passes a pending flag from real work, or is a Suspense fallback: <Working${s.attrs}/>`);
  const size = Number(s.attrs.match(/size=\{(\d+)\}/)?.[1] ?? 16);
  ok([16, 24, 40].includes(size), `${s.f}:${s.line} uses a size of 16, 24 or 40 px`);
}
ok((app.match(/<RouteLoading \/>/g) || []).length >= 1 && (app.match(/<RouteLoading \/>/g) || []).length === (app.match(/fallback=\{<RouteLoading \/>\}/g) || []).length, 'RouteLoading is only ever a Suspense fallback');
const qc = read('client/src/components/QuestionCard.jsx');
ok(/<span className="status-mark" aria-hidden="true"><Working pending=\{statusState === 'working'\} \/>\{statusState !== 'working' && <span className="dot" \/>\}<\/span>/.test(qc), 'the status line shows the indicator, not the pulsing dot, while a check, a cloud read or a save is in flight, in one slot shared with the dot');
ok(/\.status-mark \{[^}]*width: 16px; height: 16px; flex: none;/.test(instrument) && /\.status-mark \.pri-working \+ \.dot \{ visibility: hidden; \}/.test(instrument) && !/:has\(/.test(ind), 'that slot is a fixed 16 px, so the line never shifts, and the dot hides while the indicator holds or fades (a sibling rule every build target reads, not :has())');
ok(/\.skeleton > \.pri-working, p\[role="status"\] > \.pri-working \{ margin-right: 0; \}/.test(ind), 'a lone indicator (a skeleton, RouteLoading) carries no trailing gap, so it sits centred');
// Where the host stays on screen, the indicator is held and fades: those sites take a changing pending flag.
const HELD = sites.filter(x => /pending=\{(statusState === 'working'|lineCheckBusy)\}/.test(x.attrs));
ok(HELD.length === 2, `the status line and the line-check button keep the indicator mounted with a changing pending flag, so its hold and fade apply while the line is not idle (${HELD.length})`);
ok(!/fallback=\{<div className="hintbox"[^>]*><Working[^/]*label=/.test(qc), 'the tutor fallbacks show their text at once (no empty box for the first 400 ms)');
ok(!/@keyframes in-sh\b/.test(instrument) && /html\.ui-instrument \.skeleton \{[^}]*animation: none/.test(instrument), 'the Instrument skeleton no longer shimmers: it is a still placeholder and the indicator is the one moving thing');

// ── 3 · the clock, on fake timers ───────────────────────────────────────────
const { WORK_DELAY, WORK_MIN, WORK_FADE, workingClock } = await import('../src/instrument/workingClock.js');
ok(WORK_DELAY === 400 && WORK_MIN === 480 && WORK_FADE === 120, 'the delay is 400 ms, the minimum 480 ms, the fade 120 ms');
mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
try {
  const run = steps => {
    const seen = [];
    const c = workingClock(v => seen.push([Date.now(), v]));
    // One millisecond at a time, so a timer's callback sees its own moment.
    const until = t => { while (Date.now() < t) mock.timers.tick(1); };
    for (const [at, pending] of steps) { until(at); c.set(pending); }
    until(Date.now() + 3000);
    c.stop();
    mock.timers.setTime(0);
    return seen;
  };
  ok(JSON.stringify(run([[0, true], [399, false]])) === '[]', 'work that ends inside 400 ms shows nothing at all');
  const slow = run([[0, true], [1000, false]]);
  ok(JSON.stringify(slow) === JSON.stringify([[400, true], [1000, 'out'], [1120, false]]), `slow work: shown at 400 ms, fades when it ends, gone 120 ms later (${JSON.stringify(slow)})`);
  const brief = run([[0, true], [450, false]]);
  ok(JSON.stringify(brief) === JSON.stringify([[400, true], [880, 'out'], [1000, false]]), `once shown it stays at least 480 ms even if the work ends at once (${JSON.stringify(brief)})`);
  const again = run([[0, true], [1000, false], [1050, true], [2000, false]]);
  ok(JSON.stringify(again) === JSON.stringify([[400, true], [1000, 'out'], [1050, true], [2000, 'out'], [2120, false]]), `work that resumes during the fade shows again at once, without a second delay (${JSON.stringify(again)})`);
  const never = run([[0, false]]);
  ok(never.length === 0, 'with nothing pending it never shows');
} finally {
  mock.timers.reset();
}

// ── 4 · reduced motion and forced colours, in a real browser ────────────────
if (BROWSER) {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  try {
    const form = WORKING_FORMS.jya;
    const markup = `<span class="pri-working"><svg width="40" height="40" viewBox="0 0 24 24"><path pathLength="1" stroke-width="0.9" d="${form.line}"/>${form.points.map(([x, y, dx, dy]) => `<circle cx="${x}" cy="${y}" r="2" style="--dx:${dx}px;--dy:${dy}px"/>`).join('')}</svg></span>`;
    const probe = async (opts) => {
      const page = await browser.newPage(opts);
      await page.setContent(`<!doctype html><html class="ui-instrument"><head><style>${instrument}</style></head><body>${markup}</body></html>`);
      const r = await page.evaluate(() => {
        const anims = document.getAnimations().map(a => ({ target: a.effect.target.localName, props: a.effect.getKeyframes().flatMap(k => Object.keys(k)).filter(k => !['offset', 'easing', 'composite', 'computedOffset'].includes(k)) }));
        const p = document.querySelector('.pri-working circle');
        return { anims, transform: getComputedStyle(p).transform, color: getComputedStyle(document.querySelector('.pri-working')).color };
      });
      await page.close();
      return r;
    };
    const full = await probe({});
    ok(full.anims.some(a => a.target === 'circle' && a.props.includes('transform')) && full.anims.some(a => a.target === 'path' && a.props.includes('strokeDashoffset')), `full motion: the points gather (transform) and the line draws (dash offset): ${JSON.stringify(full.anims)}`);
    const reduced = await probe({ reducedMotion: 'reduce' });
    ok(!reduced.anims.some(a => a.props.includes('transform')) && reduced.transform === 'none', `reduced motion: nothing transforms (${JSON.stringify(reduced)})`);
    ok(reduced.anims.length >= 1 && reduced.anims.every(a => a.target === 'span' || (a.target === 'path' && a.props.every(k => k === 'opacity'))), 'reduced motion: only the line\'s opacity breathes (beside the 120 ms fade in)');
    const forced = await probe({ forcedColors: 'active' });
    ok(!forced.anims.some(a => a.target !== 'span'), `forced colours: nothing moves (${JSON.stringify(forced.anims)})`);
  } finally {
    await browser.close();
  }
}

// ── 5 · a build carries its own form only ───────────────────────────────────
function checkBuild(dist) {
  const edition = JSON.parse(readFileSync(join(dist, 'features.json'), 'utf8')).edition;
  const other = EDITION_IDS.find(id => id !== edition);
  const own = WORKING_FORMS[EDITIONS[edition].identity.cut].line, theirs = WORKING_FORMS[EDITIONS[other].identity.cut].line;
  const files = walk(dist).filter(r => /\.(js|css|html)$/.test(r)).map(r => [r, readFileSync(join(dist, r), 'utf8')]);
  const withOwn = files.filter(([, t]) => t.includes(own)).map(([r]) => r);
  const withTheirs = files.filter(([, t]) => t.includes(theirs)).map(([r]) => r);
  ok(withOwn.length === 1, `${edition}: its own working form is in exactly one file (${withOwn.join(', ')})`);
  ok(withTheirs.length === 0, `${edition}: the other edition's form is absent (${withTheirs.join(', ')})`);
  return edition;
}
if (DIST) {
  ok(existsSync(join(DIST, 'features.json')), `${DIST} is a build`);
  const first = checkBuild(DIST);
  if (BOTH) {
    const other = EDITION_IDS.find(id => id !== first);
    const out = mkdtempSync(join(tmpdir(), `pri-working-${other}-`));
    try {
      execFileSync('npx', ['vite', 'build', '--outDir', out, '--emptyOutDir'], { cwd: CLIENT, env: { ...process.env, PRI_EDITION: other }, stdio: ['ignore', 'ignore', 'inherit'] });
      checkBuild(out);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }
}

if (failures.length) {
  console.error(`\nWORKING INDICATOR: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`WORKING INDICATOR: PASS — ${pass}/${pass} checks — one component, every site pending on real work, 400 ms in, 480 ms held and 120 ms out where the host stays${BROWSER ? ', still under reduced motion and forced colours' : ''}${DIST ? `, each build carries its own edition's form only${BOTH ? ' (both editions built)' : ''}` : ''}.`);
