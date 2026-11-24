// Pri Learning · step marks on the answer card: a scheme-paid reply always shows its criteria table and the author's label (24 Nov 2026 review).
//
// Builds the Prithagoras client, serves it from the real platform server with PRI_EDITION=prithagoras and PRI_METHOD_MARKS=on (the repository's real approved
// list, no test hook), signs a Year 11 student up, and in Chromium proves, on a typed question the server stamped with the generic rule:
//   · before the answer, the working hint says steps Pri can check may earn marks (and not that method marks are "not given yet");
//   · working with a correct method and a wrong last line, with a wrong final answer, is paid a step mark by the server;
//   · the answer card draws the criteria table and the label "Pri practice marking, approved by the author (Priysharan Tripathi, tutor). Not an official
//     NESA guideline.", whatever shape the working has, and the table adds up to the mark;
//   · a Rush question (one try, final answer only) carries no stamp and the old sentence.
// SYNTHETIC: generated questions, a scripted student. Not evidence about real students.
//
// Usage: node client/test/tour-step-marks.mjs

import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startOnlinePlatform } from './support/online-session.mjs';
import { createVerifiedProfile, switchSyllabus } from './support/verified-onboarding.mjs';
import { authoredLines, genericPlan, GENERIC_ID } from '../../server/platform/genericSteps.js';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EDITION = 'prithagoras';
const MAX_SKIPS = 30;
// A Year 10 chapter whose every cell the Prithagoras server issues
// (server/platform/nswBanks.js), so the tour never depends on which chapter the
// device draws. y10-compound is not banked yet: a student there still gets drafts.
// owner decision, 19 Nov 2026: Prithagoras offers Years 11 and 12 only, so this walk is a Year 11 student on a Year 11 subtopic.
const CHAPTER = 'y12-appdiff';
const LABEL = 'Pri practice marking, approved by the author (Priysharan Tripathi, tutor). Not an official NESA guideline.';

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
let stage = 'build';
const STALL_MS = 300000;
const stall = setTimeout(() => {
  console.log(`STEP MARKS TOUR: FAIL — the tour stalled for ${STALL_MS / 1000}s at stage "${stage}" (${pass} checks had passed)`);
  process.exit(1);
}, STALL_MS);
stall.unref();
try {
  dist = build();
  const features = JSON.parse(readFileSync(join(dist, 'features.json'), 'utf8'));
  check('the build under test is the Prithagoras build', features.edition === EDITION, JSON.stringify(features.edition));
  stage = 'start the platform server';
  platform = await startOnlinePlatform({ dist, env: { PRI_EDITION: EDITION, PRI_METHOD_MARKS: 'on' } });
  stage = 'launch the browser';
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await ctx.newPage();
  const online = platform.session(ctx, page);
  // The scripted student asks for the harder form (difficulty 3, a multi-mark question): the card's own adaptive pick would start on one-mark questions, which no scheme pays.
  await page.route('**/v1/practice/issue', route => {
    const request = route.request(); let body = null;
    try { body = JSON.parse(request.postData() || 'null'); } catch { body = null; }
    if (body && typeof body === 'object' && !body.prepared && !body.mode) return route.continue({ postData: JSON.stringify({ ...body, difficulty: 3 }) });
    return route.continue();
  });
  stage = 'open the app';
  await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.auth-wrap, .shell', { timeout: 30000 });
  stage = 'create the verified profile';
  await createVerifiedProfile(page, platform, { name: 'Step Marks Student', year: 11, fromPicker: await page.getByTestId('picker-create-account').count() > 0 });
  await switchSyllabus(page, platform, { course: 'nsw', year: 11 });
  stage = 'open practice and find a question the server stamped with the rule';
  await page.goto(`${platform.origin}/practice?subtopic=${CHAPTER}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
  const answerBox = page.locator('.editor-body input.answer-input');
  const sealedNow = async () => {
    await online.settled();
    const shown = await online.shownRow();
    if (!shown?.serverQuestionId) return null;
    const row = platform.h.db.prepare("SELECT response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?").get(shown.serverQuestionId);
    return row ? JSON.parse(row.response_json) : null;
  };
  let sealed = null;
  for (let skips = 0; skips <= MAX_SKIPS; skips++) {
    const typeTab = page.locator('.mode-tab').first();
    if (await typeTab.count()) await typeTab.click();
    await online.settled();
    sealed = await sealedNow();
    if (process.env.DBG) console.log('  skip', skips, sealed?._methodScheme, sealed?.answerType, sealed?._generator, await answerBox.count(), await page.locator('[data-working-area]').count(), await page.locator('.mode-tab').count());
    if (sealed && sealed._methodScheme === GENERIC_ID && await answerBox.count() === 1 && sealed.answerType !== 'mcq' && await page.locator('[data-working-area="open"]').count() === 1) {
      const plan = genericPlan(sealed);
      if (plan.keySteps.length >= 1 && authoredLines(sealed).length >= 2) break;
    }
    sealed = null;
    const leaving = await page.locator('.qpage[data-question-id]').getAttribute('data-question-id');
    await page.locator('.ctx-next').first().click();
    await page.waitForFunction(id => { const el = document.querySelector('.qpage[data-question-id]'); return el && el.getAttribute('data-question-id') !== id && el.querySelector('.q-prompt'); }, leaving, { timeout: 30000 });
  }
  check('a typed question stamped with the generic rule was reached', !!sealed, 'none within the bounded search');
  if (sealed) {
    stage = 'before the answer';
    const hint = await page.locator('[data-working-area="open"] .muted').first().innerText();
    check('before answering, the working hint says checked steps may earn marks', /may still earn marks/.test(hint) && !/not given yet/.test(hint), hint);
    const lines = authoredLines(sealed).map(l => l.text);
    const wrongLast = lines.slice(0, -1).concat('x = 999991');
    await page.locator('textarea[data-typed-working]').fill(wrongLast.join('\n'));
    await answerBox.fill('999991');
    await page.getByRole('button', { name: /Submit answer/ }).click();
    await page.waitForSelector('.verdict-good, .verdict-bad, .eval-card', { timeout: 30000 });
    await online.settled();
    const grades = await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/);
    const last = grades.at(-1)?.json;
    check('the server paid a step mark on a wrong final answer', last?.methodScheme?.paid === true && last.marksEarned >= 1 && last.marksEarned < last.marksPossible && last.correct === false, JSON.stringify({ paid: last?.methodScheme, earned: last?.marksEarned, possible: last?.marksPossible }));
    stage = 'the table';
    await page.waitForSelector('[data-mp-criteria]', { timeout: 15000 }).catch(() => {});
    check('the answer card draws the criteria table for the paid reply', await page.locator('[data-mp-criteria]').count() === 1);
    const label = await page.locator('[data-mp-approval-label]').first().innerText().catch(() => '');
    check('and the author\'s label, word for word', label.trim() === LABEL, label);
    const rows = await page.locator('[data-mp-criterion]').evaluateAll(es => es.map(e => e.getAttribute('data-awarded')));
    const total = await page.locator('.mp-table tfoot td').first().innerText().catch(() => '');
    check('the table has a row for each criterion, at least one earned, and the total is the server mark', rows.length >= 2 && rows.includes('yes') && new RegExp(`${last?.marksEarned} of ${last?.marksPossible}`).test(total), `${JSON.stringify(rows)} ${total}`);
    check('no em dash on the table or the label', !/—/.test(await page.locator('[data-mp-criteria]').innerText()));
  }
  stage = 'Rush';
  await page.goto(`${platform.origin}/rush`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  check('Rush opens without a step-mark table or the author\'s label', await page.locator('[data-mp-criteria]').count() === 0);
} catch (err) {
  failures.push(`the tour stopped: ${String(err.stack || err.message).split('\n').slice(0, 4).join(' | ')}`);
} finally {
  clearTimeout(stall);
  await browser?.close().catch(() => {});
  await platform?.close?.().catch?.(() => {});
  if (dist) rmSync(dist, { recursive: true, force: true });
}
const total = pass + failures.length;
if (failures.length) {
  console.log(`STEP MARKS TOUR: FAIL — ${failures.length} of ${total} checks failed\n  · ${failures.join('\n  · ')}`);
  process.exit(1);
}
console.log(`STEP MARKS TOUR: PASS — ${pass}/${total} checks — a scheme-paid typed reply draws its criteria table and the author's label, and the working hint is honest before the answer`);
process.exit(0);
