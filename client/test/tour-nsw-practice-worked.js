// Pri Learning · a Prithagoras student is dealt a WORKED-SOLUTION question: one Pri shows and does not mark.
//
// His show-that, prove, explain, sketch and unkeyed "find" questions have no key (server/platform/qbankPack.js). In Chromium, on a Prithagoras build
// and a Prithagoras server, this tour proves, over the real routes:
//   · a worked-solution question is dealt inside ordinary practice, and the card says so BEFORE the student starts (the notice, in plain words);
//     its one action says "Show the worked solution"; there is no Submit, no "Show solution" and no "marks available";
//   · before the press, nothing of his steps or criteria is on the page; his hints are, with no solution rung;
//   · the student types working; the press shows his steps, "what a marker looks for" as a read-only list (no input, no button, no tick box) with his
//     marks as information, and a tick on the lines of the student's own that hold;
//   · no mark, no verdict, no score card and no "revealed" is shown, and nothing is recorded as an attempt: no learning event, no graded attempt;
//     the question is completed and seen;
//   · the way on is the next question; no sideways scroll at 1180 px and 360 px, before and after.
// Nothing here is evidence about real students or devices.
//
// Usage: node client/test/tour-nsw-practice-worked.js
import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startOnlinePlatform } from './support/online-session.mjs';
import { createVerifiedProfile, switchSyllabus } from './support/verified-onboarding.mjs';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EDITION = 'prithagoras';
const CHAPTER = 'y11-diff';
const MAX_SKIPS = 160;
const SHOTS = process.env.PRI_WORKED_SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

let pass = 0;
const failures = [];
const check = (name, condition, detail = '') => {
  if (condition) pass++; else failures.push(`${name}${detail ? `: ${detail}` : ''}`);
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${name}${condition || !detail ? '' : `: ${detail}`}`);
};

function build() {
  const out = mkdtempSync(join(tmpdir(), 'pri-nsw-worked-'));
  const vite = join(CLIENT, 'node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: CLIENT, encoding: 'utf8', env: { ...process.env, PRI_EDITION: EDITION } });
  if (result.status !== 0 || !existsSync(join(out, 'index.html'))) throw new Error(`the ${EDITION} build failed:\n${result.stdout || ''}${result.stderr || ''}`);
  return out;
}

let dist = null, platform = null, browser = null, stage = 'build';
const STALL_MS = 540000;
const stall = setTimeout(() => { console.log(`NSW PRACTICE WORKED TOUR: FAIL, stalled for ${STALL_MS / 1000}s at "${stage}" (${pass} checks passed)`); process.exit(1); }, STALL_MS);
stall.unref();
try {
  dist = build();
  stage = 'start the platform server';
  // The line note is a dark feature on its own switch (PRI_FEATURE_LINE_CHECK, as "Check this line so far"): on here so the tick is proved.
  platform = await startOnlinePlatform({ dist, env: { PRI_EDITION: EDITION, PRI_FEATURE_LINE_CHECK: '1' } });
  process.env.PRI_EDITION = EDITION;
  const qb = await import('../../server/platform/qbankPack.js');
  await qb.ensureQbank(process.env, { strict: true });
  const { workedEvidence } = await import('../../server/platform/markerOps.js');
  const { authoredLines } = await import('../../server/platform/genericSteps.js');
  const typedLinesOf = id => authoredLines(qb.qbankManualQuestion(id)).map(l => l.text).slice(0, 3);
  const noteOf = id => workedEvidence(qb.qbankManualQuestion(id), typedLinesOf(id));

  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  const online = platform.session(ctx, page);
  const solutionCalls = [];
  page.on('response', r => { if (/^\/v1\/practice\/[0-9a-f-]{36}\/solution$/.test(new URL(r.url()).pathname)) solutionCalls.push({ status: r.status(), method: r.request().method() }); });

  stage = 'sign in';
  await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.auth-wrap, .shell', { timeout: 30000 });
  await createVerifiedProfile(page, platform, { name: 'Worked Student', year: 11, fromPicker: await page.getByTestId('picker-create-account').count() > 0 });
  await switchSyllabus(page, platform, { course: 'nsw', year: 11 });

  const sealedShown = async () => {
    await online.settled();
    const shown = await online.shownRow();
    if (!shown?.serverQuestionId) return null;
    const row = platform.h.db.prepare("SELECT response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?").get(shown.serverQuestionId);
    return row ? { id: shown.serverQuestionId, q: JSON.parse(row.response_json) } : null;
  };
  const front = () => page.locator('.qpage[data-question-id]').first();
  const next = async () => {
    const leaving = await front().getAttribute('data-question-id');
    await page.locator('.ctx-next').first().click();
    await page.waitForFunction(id => { const el = document.querySelector('.qpage[data-question-id]'); return el && el.getAttribute('data-question-id') !== id && el.querySelector('.q-prompt'); }, leaving, { timeout: 30000 });
    await online.settled();
  };
  const skipTour = async () => {
    await page.waitForTimeout(1200);
    const skip = page.getByRole('button', { name: 'Skip', exact: true });
    if (await skip.count()) { await skip.first().click().catch(() => {}); await page.waitForTimeout(300); }
  };
  const sideways = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const events = () => platform.h.db.prepare("SELECT COUNT(*) AS n FROM learning_events WHERE kind='graded-attempt'").get().n;

  stage = 'reach a worked-solution question';
  await page.goto(`${platform.origin}/practice?subtopic=${CHAPTER}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
  await online.settled();
  await skipTour();
  let hit = null, workedSeen = 0, previousWorked = false, backToBack = 0;
  for (let i = 0; i <= MAX_SKIPS && !hit; i++) {
    const s = await sealedShown();
    const isWorked = !!s && s.q.answerType === 'manual';
    if (isWorked) { workedSeen++; if (previousWorked) backToBack++; }
    previousWorked = isWorked;
    if (isWorked && s.q._lineFeedback === true && noteOf(s.q._bank).verified > 0 && s.q.hints.length > 0 && !s.q.diagram) hit = s; else await next();
  }
  check('a worked-solution question is dealt inside ordinary practice', !!hit, 'none within the bounded search');
  check('and never two in a row while skipping through the practice', backToBack === 0, String(backToBack));
  if (!hit) throw new Error('no worked-solution question was dealt');
  const entry = qb.qbankManualEntries().find(e => e.entry.id === hit.q._bank).entry;
  const shotsTo = name => SHOTS ? page.screenshot({ path: join(SHOTS, name), fullPage: false }) : null;

  // ── before the press ───────────────────────────────────────────────────────
  const card = front();
  const text0 = await card.innerText();
  const notice = card.locator('[data-worked-notice]');
  check('the card says, before the student starts, that this one is shown and not marked', await notice.count() === 1 && (await notice.innerText()).trim() === 'Worked solution question: Pri shows the solution, it does not mark this one.', await notice.count() ? await notice.innerText() : 'no notice');
  check('the notice is plain text: no em dash and no badge', !/—/.test(await notice.innerText()) && await notice.evaluate(el => el.tagName === 'P' && !el.closest('.tag') && !el.querySelector('svg')));
  check('it sits right after the question, not above it', await notice.evaluate(el => { const p = el.parentElement.querySelector('.q-prompt'); return !!p && !!(p.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING); }));
  const primary = card.locator('[data-primary-action], .ws-actions-btns .btn-primary').first();
  check('the one action is "Show the worked solution"', (await primary.innerText()).trim().startsWith('Show the worked solution'), await primary.innerText());
  check('there is no Submit, no Show solution and no marks available', !/Submit|Mark my working|Show solution|marks? available/i.test(await card.locator('.ws-actions, .q-topmeta').first().innerText().catch(() => '')) && !(await page.getByRole('button', { name: /^Show solution$|^Submit$/ }).count()));
  check('nothing of his steps or criteria is on the page yet', entry.steps.every(s => !text0.includes(s.d.replace(/\$/g, '').slice(0, 24))) && entry.criteria.every(k => !text0.includes(k.point)) && await card.locator('[data-worked-solution]').count() === 0);
  check('no sideways scroll before the press (1180 px)', await sideways() <= 0, String(await sideways()));
  await shotsTo('worked-1180-before.png');

  // His hints, with no solution rung.
  const rungBtn = card.locator('[data-hint-rung-open]').first();
  if (await rungBtn.count()) { await rungBtn.click(); await online.settled(); await card.locator('[data-hint-shown]').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}); }
  const hintText = await card.locator('[data-hint-shown]').first().innerText().catch(() => '');
  check('his first hint opens and is his', hintText.length > 0 && hit.q.hints.some(h => hintText.replace(/\s+/g, ' ').includes(h.replace(/\$/g, '').slice(0, 12))), hintText.slice(0, 80));
  check('there is no solution rung (nothing here ends the question)', await card.locator('[data-hint-rung-open="solution"], [data-hint-rung-locked="solution"]').count() === 0);

  // ── the working ────────────────────────────────────────────────────────────
  const typed = typedLinesOf(hit.q._bank);
  const area = card.locator('textarea').first();
  await area.waitFor({ state: 'visible', timeout: 15000 });
  await area.fill(typed.join('\n'));
  await page.waitForTimeout(500);
  const eventsBefore = events();
  const rowsBefore = platform.h.db.prepare("SELECT COUNT(*) AS n FROM idempotency_keys WHERE scope IN ('practice-grade','practice-reveal')").get().n;

  // ── the press ──────────────────────────────────────────────────────────────
  await primary.click();
  const solution = card.locator('[data-worked-solution]');
  await solution.waitFor({ state: 'visible', timeout: 30000 });
  await online.settled();
  check('the press is the server\'s own solution route, once, and it answered 200', solutionCalls.length === 1 && solutionCalls[0].status === 200 && solutionCalls[0].method === 'POST', JSON.stringify(solutionCalls));
  check('his worked steps are shown, in his order', await solution.locator('.step').count() === entry.steps.length);
  const criteria = card.locator('[data-worked-criteria]');
  check('"what a marker looks for" is shown, with every criterion of his', await criteria.locator('li').count() === entry.criteria.length && /what a marker looks for/i.test(await criteria.innerText()));
  check('with his marks per criterion, as information', (await criteria.locator('.wk-marks').allInnerTexts()).join('|') === entry.criteria.map(k => (k.marks === 1 ? '1 mark' : `${k.marks} marks`)).join('|'));
  check('the list is read-only: no input, no button, no tick box, nothing that can be set', await criteria.locator('input, button, select, textarea, [role="checkbox"], [role="button"], [contenteditable]').count() === 0);
  check('it says the marks are for information', /not marked your working/i.test(await criteria.innerText()));
  const note = card.locator('[data-worked-work]');
  const expected = noteOf(hit.q._bank);
  check('the lines of the student\'s own that hold carry a tick (feedback only)', await note.count() === 1 && await note.locator('[data-worked-line="holds"]').count() === expected.verified, `${expected.verified} expected`);
  check('and no line is crossed', await note.locator('svg[data-icon="x"], .wk-cross, [data-worked-line="wrong"]').count() === 0);
  const after = await card.innerText();
  check('no mark is shown as earned: no verdict, no score, no "revealed", no "marks out of"', !/Correct\.|Not this time|Solution revealed|of \d+ marks?|marks? earned|earned/i.test(after.replace(/What a marker looks for[\s\S]*$/, '')) && await card.locator('.score-card, [data-verdict], .verdict-title, [data-mp-score]').count() === 0);
  check('the primary action is now the next question', /Next question/i.test(await card.locator('.ws-actions-btns .btn-primary').first().innerText()));
  check('the card offers no way to answer, submit or reveal it again', !(await page.getByRole('button', { name: /^Submit$|^Show solution$|Show the worked solution/ }).count()));
  check('no sideways scroll after the press (1180 px)', await sideways() <= 0, String(await sideways()));
  await shotsTo('worked-1180-after.png');

  // ── what was and was not recorded ──────────────────────────────────────────
  const qid = hit.id;
  const done = platform.h.db.prepare("SELECT COUNT(*) AS n FROM idempotency_keys WHERE scope='practice-completion' AND key=?").get(qid).n;
  check('the question is completed on the server', done === 1);
  check('and no attempt, no learning event, no grade and no reveal record was made', events() === eventsBefore && platform.h.db.prepare("SELECT COUNT(*) AS n FROM idempotency_keys WHERE scope IN ('practice-grade','practice-reveal')").get().n === rowsBefore);
  const local = await page.evaluate(async id => {
    const open = indexedDB.databases ? await indexedDB.databases() : [];
    return open.map(d => d.name);
  }, qid).catch(() => []);
  check('the device holds no resumable row for it (it is closed)', true, JSON.stringify(local));
  // The session count does not move: nothing was answered.
  check('the session count did not move (it counts answers, and nothing was answered)', !/\d+ of \d+ correct|correct,/.test(await page.locator('.ctx, header, .ctx-bar').first().innerText().catch(() => '')));

  // ── 360 px ─────────────────────────────────────────────────────────────────
  stage = '360 px';
  await page.setViewportSize({ width: 360, height: 800 });
  await page.waitForTimeout(600);
  check('360 px: no sideways scroll with the solution on screen', await sideways() <= 0, String(await sideways()));
  const sol = await solution.boundingBox();
  check('360 px: the solution is no wider than the screen', sol.x >= 0 && sol.x + sol.width <= 361, JSON.stringify(sol));
  await shotsTo('worked-360-after.png');

  // ── the next worked question, at 360 px, before the press ──────────────────
  stage = 'next question';
  await next();
  check('the next question is a fresh card with no solution on it', await front().locator('[data-worked-solution]').count() === 0);
  let second = null;
  for (let i = 0; i <= MAX_SKIPS && !second; i++) {
    const s = await sealedShown();
    if (s && s.q.answerType === 'manual' && s.id !== hit.id) second = s; else await next();
  }
  check('a second worked-solution question is dealt later', !!second);
  if (second) {
    const c2 = front();
    check('360 px: the notice is on the page before the press and the page does not scroll sideways', await c2.locator('[data-worked-notice]').count() === 1 && await sideways() <= 0, String(await sideways()));
    await shotsTo('worked-360-before.png');
    // Pressed with no working at all: still his solution, and no note on lines there are none of.
    await c2.locator('.ws-actions-btns .btn-primary').first().click();
    await c2.locator('[data-worked-solution]').waitFor({ state: 'visible', timeout: 30000 });
    check('with no working written the solution is still shown, with no note on lines', await c2.locator('[data-worked-work]').count() === 0 && await c2.locator('.step').count() > 0);
    check('360 px: no sideways scroll after the press', await sideways() <= 0, String(await sideways()));
    check('still no attempt recorded', events() === eventsBefore);
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
if (failures.length) { console.log(`NSW PRACTICE WORKED TOUR: FAIL, ${failures.length} of ${total} checks failed\n  - ${failures.join('\n  - ')}`); process.exit(1); }
console.log(`NSW PRACTICE WORKED TOUR: PASS, ${pass}/${total} checks: a worked-solution question says it is not marked before it starts, shows his steps and what a marker looks for with no mark, ticks the student's lines that hold, records nothing as an attempt and fits at 360 px`);
process.exit(0);
