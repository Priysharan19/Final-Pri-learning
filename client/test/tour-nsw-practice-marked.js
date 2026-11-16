// Pri Learning · a Prithagoras NSW student's practice is issued and marked by the server.
//
// The device used to ask every question for the India course, so on a
// Prithagoras server (which issues only NSW) a signed-in NSW student only ever
// got drafts: "opened without a connection to Pri, so it cannot be marked",
// with no Submit. This tour builds the Prithagoras client, serves it from the
// real platform server on PRI_EDITION=prithagoras, signs a student up on the
// card, makes them NSW Year 10, and proves in Chromium:
//   · Practice shows a question the SERVER issued (no draft notice), with Submit;
//   · the issue request named the NSW course;
//   · the right final answer (read from the server's sealed copy at the test's
//     desk) is submitted and the SERVER marks it correct (authoritative).
// The request shape is pinned in Node by practice-course-request-check.mjs.
//
// Usage: node client/test/tour-nsw-practice-marked.js

import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startOnlinePlatform } from './support/online-session.mjs';
import { createVerifiedProfile, switchSyllabus } from './support/verified-onboarding.mjs';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EDITION = 'prithagoras';
const MAX_SKIPS = 12;
// A Year 10 chapter whose every cell the Prithagoras server issues
// (server/platform/nswBanks.js), so the tour never depends on which chapter the
// device draws. y10-compound is not banked yet: a student there still gets drafts.
const CHAPTER = 'y10-simeq';

let pass = 0;
const failures = [];
const check = (name, condition, detail = '') => {
  if (condition) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`  ${condition ? '✓' : '✗'} ${name}${condition || !detail ? '' : ` — ${detail}`}`);
};

function build() {
  const out = mkdtempSync(join(tmpdir(), 'pri-nsw-practice-'));
  const vite = join(CLIENT, 'node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: CLIENT, encoding: 'utf8', env: { ...process.env, PRI_EDITION: EDITION } });
  if (result.status !== 0 || !existsSync(join(out, 'index.html'))) throw new Error(`the ${EDITION} build failed:\n${result.stdout || ''}${result.stderr || ''}`);
  return out;
}

let dist = null;
let platform = null;
let browser = null;
try {
  dist = build();
  const features = JSON.parse(readFileSync(join(dist, 'features.json'), 'utf8'));
  check('the build under test is the Prithagoras build', features.edition === EDITION, JSON.stringify(features.edition));
  platform = await startOnlinePlatform({ dist, env: { PRI_EDITION: EDITION } });
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await ctx.newPage();
  const online = platform.session(ctx, page);
  const issueBodies = [];
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/v1/practice/issue') {
      try { issueBodies.push(JSON.parse(request.postData() || '{}')); } catch { issueBodies.push(null); }
    }
  });

  const issueReplies = [];
  page.on('response', async response => {
    if (response.request().method() === 'POST' && new URL(response.url()).pathname === '/v1/practice/issue') {
      let body = null; try { body = await response.json(); } catch {}
      issueReplies.push({ status: response.status(), code: body?.error?.code || body?.code || null, generator: (() => { try { return JSON.parse(response.request().postData()).generator; } catch { return null; } })() });
    }
  });
  await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.auth-wrap, .shell', { timeout: 30000 });
  await createVerifiedProfile(page, platform, { name: 'NSW Practice Student', year: 10, fromPicker: await page.getByTestId('picker-create-account').count() > 0 });
  await switchSyllabus(page, platform, { course: 'nsw', year: 10 });
  // Before E3 a Prithagoras sign-up starts on the India course; only what the
  // NSW profile asks after the switch is this tour's subject.
  const nswFrom = issueBodies.length;

  await page.goto(`${platform.origin}/practice?subtopic=${CHAPTER}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
  const answerBox = page.locator('.editor-body input.answer-input');
  let known = null;
  for (let skips = 0; skips <= MAX_SKIPS && !known; skips++) {
    const typeTab = page.locator('.mode-tab').first();
    if (await typeTab.count()) await typeTab.click();
    await online.settled();
    if (await answerBox.count() === 1) {
      const k = await online.answerOf();
      if (k.kind === 'text' && k.text !== null) { known = k; break; }
      if (k.kind === 'unissued') break;
    }
    const leaving = await page.locator('.qpage[data-question-id]').getAttribute('data-question-id');
    await page.locator('.ctx-next').first().click();
    await page.waitForFunction(id => {
      const el = document.querySelector('.qpage[data-question-id]');
      return el && el.getAttribute('data-question-id') !== id && el.querySelector('.q-prompt');
    }, leaving, { timeout: 30000 });
  }

  const nswReplies = issueReplies.slice(nswFrom);
  check(`the server issued what the NSW profile asked for (${CHAPTER})`, nswReplies.length > 0 && nswReplies.every(r => r.status === 201), JSON.stringify(nswReplies));
  const shown = await online.shownRow();
  check('practice shows a question the server issued, not a draft', shown?.checkState === 'issued', JSON.stringify(shown));
  check('no "cannot be marked" draft notice is on the card', !/cannot be marked/i.test(await page.locator('.qpage').innerText()));
  check('every issue request named the NSW course', issueBodies.length > nswFrom && issueBodies.slice(nswFrom).every(b => b?.curriculum === 'nsw'), JSON.stringify(issueBodies.slice(nswFrom).map(b => b?.curriculum)));
  const submit = page.getByRole('button', { name: /Submit answer/ });
  check('Submit is offered', await submit.count() === 1);
  check('a typed question the server issued was reached', !!known, 'no issued typed question within the bounded search');

  if (known) {
    await answerBox.fill(String(known.text));
    await submit.click();
    await page.waitForSelector('.verdict-good, .verdict-bad, .eval-card', { timeout: 30000 });
    const grades = await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/);
    const last = grades.at(-1);
    check('the answer was marked by the server (authoritative) and correct', last?.status === 200 && last.json?.authoritative === true && last.json.correct === true,
      JSON.stringify(last ? { status: last.status, authoritative: last.json?.authoritative, correct: last.json?.correct } : null));
    const verdict = await page.evaluate(() => [...document.querySelectorAll('.verdict-good, .verdict-bad, .eval-card, .verdict')]
      .filter(el => el.getClientRects().length > 0).map(el => `${el.className}: ${el.innerText}`).join(' | ').replace(/\s+/g, ' '));
    check('the card shows the server\'s verdict: correct', /correct/i.test(verdict) && !/incorrect|not quite/i.test(verdict), verdict.slice(0, 160));
  }
} catch (err) {
  failures.push(`the tour stopped: ${String(err.stack || err.message).split('\n').slice(0, 4).join(' | ')}`);
} finally {
  await browser?.close().catch(() => {});
  await platform?.close?.().catch?.(() => {});
  if (dist) rmSync(dist, { recursive: true, force: true });
}

const total = pass + failures.length;
if (failures.length) {
  console.log(`NSW PRACTICE MARKED TOUR: FAIL — ${failures.length} of ${total} checks failed\n  · ${failures.join('\n  · ')}`);
  process.exit(1);
}
console.log(`NSW PRACTICE MARKED TOUR: PASS — ${pass}/${total} checks — a Prithagoras NSW Year 10 student is issued a question by the server, Submit is offered, and the server marks the answer`);
process.exit(0);
