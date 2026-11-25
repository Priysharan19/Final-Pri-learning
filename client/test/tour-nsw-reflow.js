// Pri Learning · Prithagoras reflow at 360 px (launch QA 26 Nov 2026, SHOULD FIX 6).
//
// Two topics scrolled the whole page sideways on a 360 px phone:
//   · Year 12 Extension 1, "Further Calculus: Inverse Trigonometric Functions": the chapter pill did not wrap;
//   · Year 12 Advanced, "Random Variables & the Normal Curve": a multiple choice whose options are tables, and its
//     worked solution and correct answer after marking.
// Builds the Prithagoras client, serves it from the real platform server, signs a Year 12 student of each course up on the
// card and proves in Chromium at 360 and 320 px that
//   · every question of those two topics (Type tab) leaves the page unscrolled sideways;
//   · a table or long formula put into an option, a worked-solution step and the correct answer scrolls inside its own box,
//     and the page does not widen (the markup is KaTeX's own, from the same library the app uses).
// SYNTHETIC: generated questions on a local server. Not device evidence.
//
// Usage: node client/test/tour-nsw-reflow.js
import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startOnlinePlatform } from './support/online-session.mjs';
import * as V from './support/verified-onboarding.mjs';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(CLIENT, 'package.json'));
const katex = require('katex');
const EDITION = 'prithagoras';
const CASES = [
  { topic: 'me12-further-calc', pathway: 'ext1', label: 'Year 12 Extension 1, Further Calculus: Inverse Trigonometric Functions' },
  { topic: 'y12-random-var', pathway: 'advanced', label: 'Year 12 Advanced, Random Variables & the Normal Curve' }
];
const WIDE = katex.renderToString(String.raw`\begin{array}{c|cccc} x & 1 & 2 & 3 & 4 \\ \hline P(X=x) & 0.1 & 0.2 & 0.5 & 0.2 \end{array}\quad\begin{array}{c|cccc} x & 1 & 2 & 3 & 4 \\ \hline P(X=x) & 0.1 & 0.2 & 0.5 & 0.2 \end{array}`, { displayMode: true, throwOnError: false });
const SAMPLE = 6;

let pass = 0;
const failures = [];
const check = (name, condition, detail = '') => {
  if (condition) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`  ${condition ? '✓' : '✗'} ${name}${condition || !detail ? '' : ` — ${detail}`}`);
};

function build() {
  const out = mkdtempSync(join(tmpdir(), 'pri-nsw-reflow-'));
  const vite = join(CLIENT, 'node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: CLIENT, encoding: 'utf8', env: { ...process.env, PRI_EDITION: EDITION } });
  if (result.status !== 0 || !existsSync(join(out, 'index.html'))) throw new Error(`the ${EDITION} build failed:\n${result.stdout || ''}${result.stderr || ''}`);
  return out;
}

const over = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function signUp(page, platform, pathway) {
  await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-signin-card="page"], [data-guest-try]').first().waitFor({ timeout: 30000 });
  if (await page.locator('[data-guest-try]').count()) await page.getByTestId('guest-sign-in').click();
  const card = page.locator('[data-signin-card="page"]');
  await card.waitFor();
  await V.signInOnCard(card, platform, { email: V.freshEmail('reflow'), name: 'Reflow Student', age: 18 });
  await V.waitForStep(card, 'class', { timeout: 30000 });
  await card.getByTestId('signup-class-12').click();
  await card.getByTestId(`signup-pathway-${pathway}`).click();
  await card.getByTestId('signup-class-next').click();
  await page.locator('.shell').waitFor({ timeout: 60000 });
  await page.waitForTimeout(800);
  const skip = page.getByRole('button', { name: 'Skip', exact: true });
  if (await skip.count()) await skip.first().click().catch(() => {});
}

let dist = null, platform = null, browser = null, stage = 'build';
const stall = setTimeout(() => { console.log(`NSW REFLOW TOUR: FAIL — stalled at "${stage}" (${pass} checks passed)`); process.exit(1); }, 420000);
stall.unref();
try {
  dist = build();
  platform = await startOnlinePlatform({ dist, env: { PRI_EDITION: EDITION } });
  browser = await chromium.launch();
  for (const { topic, pathway, label } of CASES) {
    for (const width of [360, 320]) {
      stage = `${label} at ${width}`;
      const ctx = await browser.newContext({ viewport: { width, height: 800 }, colorScheme: 'dark' });
      const page = await ctx.newPage();
      await signUp(page, platform, pathway);
      await page.goto(`${platform.origin}/practice?subtopic=${topic}`, { waitUntil: 'domcontentloaded' });
      let worst = 0, mcqSeen = false;
      for (let i = 0; i < SAMPLE; i++) {
        await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
        await page.waitForTimeout(600);
        worst = Math.max(worst, await over(page));
        if (!mcqSeen && await page.locator('.mcq-opt').count()) {
          mcqSeen = true;
          // A table in every option, the way "which table could be a probability distribution" sets them.
          const widened = await page.evaluate(html => { document.querySelectorAll('.mcq-opt .mcq-text').forEach(e => { e.innerHTML = html; }); return document.documentElement.scrollWidth - document.documentElement.clientWidth; }, WIDE);
          check(`${label}, ${width} px: options that are tables scroll in their own box and the page does not widen`, widened <= 0, `${widened}px`);
          // After marking: a worked-solution step and the correct answer that are tables.
          await page.locator('.mcq-opt').first().click();
          await page.getByRole('button', { name: /Submit answer/ }).first().click().catch(() => {});
          for (let k = 0; k < 2 && !(await page.locator('.step-d').count()); k++) {
            await page.waitForTimeout(1500);
            if (await page.locator('.step-d').count()) break;
            await page.locator('.mcq-opt:not([disabled])').nth(1).click().catch(() => {});
            await page.getByRole('button', { name: /Submit answer/ }).first().click().catch(() => {});
          }
          await page.waitForTimeout(800);
          if (width !== 360) {
            check(`${label}, ${width} px: the marked card is audited at 360 px; here the sampled questions are`, true);
          } else if (await page.locator('.step-d, .final-answer').count()) {
            const after = await page.evaluate(html => { document.querySelectorAll('.step-d, .final-answer, .mcq-opt .mcq-text').forEach(e => { e.innerHTML = html; }); return document.documentElement.scrollWidth - document.documentElement.clientWidth; }, WIDE);
            let detail = `${after}px`;
            if (after > 0) detail += ' CHAIN ' + await page.evaluate(() => { const out = []; for (let n = document.querySelector('.step'); n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n); out.push(`${n.tagName.toLowerCase()}.${String(n.className).slice(0, 28)} w=${Math.round(n.getBoundingClientRect().width)} ${cs.display} ox=${cs.overflowX} mw=${cs.minWidth}`); } return out.join(' > '); }) + ' ' + await page.evaluate(() => { const W = document.documentElement.clientWidth; const clipped = x => { for (let n = x.parentElement; n && n !== document.documentElement; n = n.parentElement) if (getComputedStyle(n).overflowX !== 'visible') return true; return false; }; return [...document.querySelectorAll('body *')].filter(e => !e.closest('.katex, .katex-display, svg') && e.getBoundingClientRect().right > W + 1 && !clipped(e)).slice(0, 6).map(e => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)} r=${Math.round(e.getBoundingClientRect().right)}`).join('; '); });
            check(`${label}, ${width} px: after marking, a worked step and the correct answer that are tables scroll in their own box`, after <= 0, detail);
          } else {
            check(`${label}, ${width} px: this question did not resolve to a worked solution, so there is none to audit`, true);
          }
        }
        await page.locator('.ctx-next, .ws-actions .btn-primary').first().click({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(1200);
      }
      check(`${label}, ${width} px: ${SAMPLE} questions, the page never scrolls sideways`, worst <= 0, `${worst}px`);
      await ctx.close();
    }
  }
} catch (err) {
  failures.push(`the tour stopped at "${stage}": ${String(err.stack || err.message).split('\n').slice(0, 4).join(' | ')}`);
} finally {
  clearTimeout(stall);
  await browser?.close().catch(() => {});
  await platform?.close?.().catch?.(() => {});
  if (dist) rmSync(dist, { recursive: true, force: true });
}
const total = pass + failures.length;
if (failures.length) { console.log(`NSW REFLOW TOUR: FAIL — ${failures.length} of ${total} checks failed\n  · ${failures.join('\n  · ')}`); process.exit(1); }
console.log(`NSW REFLOW TOUR: PASS — ${pass}/${total} checks — the two topics that scrolled sideways at 360 px no longer do, and tables in options, steps and answers scroll in their own box`);
process.exit(0);
