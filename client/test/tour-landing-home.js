// ─────────────────────────────────────────────────────────────────────────────
// The verified page — public landing and Home — in the mounted app, both
// editions (ADR-0002: build once, verify against Priyabhata and Prithagoras).
//
// For each edition: its own build, served by the real platform server.
//
//   Landing (/welcome, signed out), desktop 1280 × 800 dark and light, phone
//   390 × 844 dark:
//     · the demo reads, then waits for the visitor to confirm u — no line has
//       a status before that;
//     · after the confirmation each line's status in the page equals what the
//       engine returns for the same script in Node (landing/demoScript.js →
//       engine/checker.js), and See why opens at line 4;
//     · the edition's syllabus proof point; no social-proof slot;
//     · phone: no horizontal scroll, every control at least 44 px tall;
//     · reduced motion: every line read at once, the visitor still confirms,
//       then the final state at once; focus follows to the status line.
//   Home (/ signed in, a verified account made through the shipped card):
//     · one primary action; the aside shows nothing it has no evidence for
//       (a new account has no papers and no marked work).
//
// Screenshots go to $PRI_TOUR_OUT (default: a temp folder), never into the
// tracked tree. SYNTHETIC: a scripted student on a test server.
//
// Run: node client/test/tour-landing-home.js
// ─────────────────────────────────────────────────────────────────────────────
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startOnlinePlatform } from './support/online-session.mjs';
import { createVerifiedProfile, switchSyllabus } from './support/verified-onboarding.mjs';
import { runDemo, UNSURE } from '../src/landing/demoScript.js';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
const OUT = process.env.PRI_TOUR_OUT || mkdtempSync(join(tmpdir(), 'pri-landing-home-'));
mkdirSync(OUT, { recursive: true });

const EDITIONS = [
  { edition: 'priyabhata', syllabus: /CBSE syllabus and the NCERT textbooks/, course: null, year: 11 },
  { edition: 'prithagoras', syllabus: /NSW Mathematics Advanced 2024 syllabus, first HSC 2027/, course: 'nsw', year: 12 }
];
const ENGINE = runDemo({ glyph: UNSURE.read }).lines.map(l => l.status);

let pass = 0;
const failures = [];
const check = (name, condition, detail = '') => {
  if (condition) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`  ${condition ? '✓' : '✗'} ${name}${condition || !detail ? '' : ` — ${String(detail).slice(0, 400)}`}`);
  return condition;
};

function build(edition) {
  const out = mkdtempSync(join(tmpdir(), `pri-landing-${edition}-`));
  const vite = join(CLIENT, 'node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: CLIENT, encoding: 'utf8', env: { ...process.env, PRI_EDITION: edition } });
  if (result.status !== 0 || !existsSync(join(out, 'index.html'))) throw new Error(`the ${edition} build failed:\n${result.stdout || ''}${result.stderr || ''}`);
  return out;
}

const statusesIn = page => page.$$eval('[data-demo-line]', els => els.map(el => el.getAttribute('data-status')));

async function landing(spec, browser, platform, { id, viewport, colorScheme, phone = false }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme, reducedMotion: 'no-preference', hasTouch: phone });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(`${platform.origin}/welcome`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-landing-demo][data-demo-state="waiting"]', { timeout: 30000 });
    const before = await statusesIn(page);
    check(`${spec.edition} ${id}: it waits for the visitor to confirm u, and no line has a status yet`, before.every(s => s === 'pending'), JSON.stringify(before));
    await page.screenshot({ path: join(OUT, `${spec.edition}-landing-${id}-waiting.png`) });
    await page.click('[data-demo-confirm]');
    await page.waitForSelector('[data-landing-demo][data-demo-state="done"]', { timeout: 30000 });
    const after = await statusesIn(page);
    check(`${spec.edition} ${id}: every status in the page is the engine's own result`, JSON.stringify(after) === JSON.stringify(ENGINE), `${after} vs ${ENGINE}`);
    check(`${spec.edition} ${id}: See why opens at line 4 with the engine's counterexample`,
      (await page.locator('[data-demo-seewhy] [data-mistake-say]').innerText()).includes('At u = 1 your line gives −0.333'));
    const text = await page.locator('[data-landing]').innerText();
    check(`${spec.edition} ${id}: the edition's syllabus proof point`, spec.syllabus.test(text), text.slice(0, 300));
    check(`${spec.edition} ${id}: no social-proof slot in production`, await page.locator('[data-social-proof], [data-social-slot]').count() === 0);
    if (phone) {
      const fit = await page.evaluate(() => {
        const small = [...document.querySelectorAll('.lp a, .lp button, .lp [role="slider"]')]
          .filter(el => el.offsetParent !== null)
          .map(el => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.height < 44 - 0.5)
          .map(({ el, r }) => `${el.textContent.trim().slice(0, 24) || el.getAttribute('aria-label')} ${Math.round(r.height)}px`);
        return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, small };
      });
      check(`${spec.edition} ${id}: no horizontal scroll at 390`, fit.overflow <= 0, `${fit.overflow}px`);
      check(`${spec.edition} ${id}: every control is at least 44 px tall`, fit.small.length === 0, JSON.stringify(fit.small));
    }
    await page.screenshot({ path: join(OUT, `${spec.edition}-landing-${id}-done.png`), fullPage: phone });
    check(`${spec.edition} ${id}: no page errors`, errors.length === 0, errors.join(' | '));
  } finally {
    await ctx.close();
  }
}

async function reduced(spec, browser, platform) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', colorScheme: 'dark' });
  const page = await ctx.newPage();
  try {
    await page.goto(`${platform.origin}/welcome`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-landing-demo]', { timeout: 30000 });
    const state = await page.getAttribute('[data-landing-demo]', 'data-demo-state');
    check(`${spec.edition}: reduced motion reads every line at once and still waits for the visitor`, state === 'waiting', state);
    await page.click('[data-demo-confirm]');
    await page.waitForSelector('[data-landing-demo][data-demo-state="done"]', { timeout: 2000 });
    check(`${spec.edition}: after confirming, reduced motion shows the final state at once`, true);
    check(`${spec.edition}: focus moves to the status line the confirmation changed`, await page.evaluate(() => document.activeElement?.hasAttribute('data-demo-say')));
    check(`${spec.edition}: and its statuses are the engine's too`, JSON.stringify(await statusesIn(page)) === JSON.stringify(ENGINE));
  } finally {
    await ctx.close();
  }
}

async function home(spec, browser, platform) {
  for (const [id, viewport, colorScheme] of [['desktop-dark', { width: 1280, height: 800 }, 'dark'], ['phone-light', { width: 390, height: 844 }, 'light']]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme });
    const page = await ctx.newPage();
    try {
      await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.auth-wrap, .shell', { timeout: 30000 });
      await createVerifiedProfile(page, platform, { name: 'Home Student', year: spec.course ? 10 : spec.year, fromPicker: await page.getByTestId('picker-create-account').count() > 0 });
      if (spec.course) await switchSyllabus(page, platform, { course: spec.course, year: spec.year });
      await page.goto(platform.origin + '/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-verified-home] [data-home-primary]', { timeout: 30000 });
      check(`${spec.edition} home ${id}: exactly one primary action`, await page.locator('[data-home-primary]').count() === 1);
      check(`${spec.edition} home ${id}: no papers trend without two marked papers`, await page.locator('[data-home-papers]').count() === 0);
      check(`${spec.edition} home ${id}: no marks at stake without hsc-forecast's figures`, await page.locator('[data-home-marks-at-stake]').count() === 0);
      if (viewport.width < 500) {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        check(`${spec.edition} home ${id}: no horizontal scroll`, overflow <= 0, `${overflow}px`);
      }
      await page.screenshot({ path: join(OUT, `${spec.edition}-home-${id}.png`) });
    } finally {
      await ctx.close();
    }
  }
}

async function runEdition(spec, browser) {
  console.log(`\n${spec.edition}`);
  const dist = build(spec.edition);
  const features = JSON.parse(readFileSync(join(dist, 'features.json'), 'utf8'));
  check(`${spec.edition}: the build under test is the ${spec.edition} build`, features.edition === spec.edition, JSON.stringify(features));
  const platform = await startOnlinePlatform({ dist, env: { PRI_EDITION: spec.edition } });
  try {
    await landing(spec, browser, platform, { id: 'desktop-dark', viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
    await landing(spec, browser, platform, { id: 'desktop-light', viewport: { width: 1280, height: 800 }, colorScheme: 'light' });
    await landing(spec, browser, platform, { id: 'phone-dark', viewport: { width: 390, height: 844 }, colorScheme: 'dark', phone: true });
    await reduced(spec, browser, platform);
    await home(spec, browser, platform);
  } finally {
    await platform.close();
  }
}

const browser = await chromium.launch();
try {
  for (const spec of EDITIONS) {
    try { await runEdition(spec, browser); }
    catch (e) { check(`${spec.edition}: the tour ran`, false, e.stack || e.message); }
  }
} finally {
  await browser.close();
}
console.log(`\nScreenshots: ${OUT}`);
if (failures.length) {
  console.error(`LANDING HOME TOUR: FAIL — ${failures.length} failed, ${pass} passed`);
  process.exit(1);
}
console.log(`LANDING HOME TOUR: PASS — ${pass}/${pass} checks`);
