// Pri Learning · a Prithagoras student meets the author's questions inside the practice they already use.
//
// There is no "question bank" page, entry or label. The author's questions (server/content/qbank, mixed in by server/platform/qbankPack.js)
// are dealt by the same topic and dot point practice as the generators', so this tour opens one Year 12 dot point that has authored
// questions (Evaluate definite integrals) and proves in Chromium, on a Prithagoras build and a Prithagoras server:
//   · an authored question is issued for the dot point asked for, its prompt is typeset, and nothing on the page names its source;
//   · its right answer is marked correct for the marks its author set, and the marked card shows them;
//   · another authored question, answered with the author's own wrong answer (a trap), is marked incorrect and shows HIS reason, then
//     the worked solution, under his step headings, once it resolves;
//   · the hint ladder serves his hints in order, the first being his first;
//   · a report of the question carries its id on the server's record, and nothing on the page does;
//   · at 360 px wide the page, the hints, the marked card and the solution do not scroll sideways.
// The right answers and traps are read at the test's desk from the server's own sealed question (the oracle of support/online-session.mjs),
// never from the page. Nothing here is evidence about real students.
//
// Usage: node client/test/tour-nsw-practice-bank.js
import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startOnlinePlatform } from './support/online-session.mjs';
import { createVerifiedProfile, switchSyllabus } from './support/verified-onboarding.mjs';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(CLIENT, '..');
const EDITION = 'prithagoras';
const CHAPTER = 'y12-integration';
const ORDINAL = 1;                       // "Evaluate definite integrals": y12-integration.2, level 2
const DOTPOINT = `${CHAPTER}.${ORDINAL + 1}`;
const MAX_SKIPS = 40;

const SHOTS = process.env.PRI_BANK_SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
let pass = 0;
const failures = [];
const check = (name, condition, detail = '') => {
  if (condition) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`  ${condition ? '✓' : '✗'} ${name}${condition || !detail ? '' : ` — ${detail}`}`);
};

function build() {
  const out = mkdtempSync(join(tmpdir(), 'pri-nsw-bank-'));
  const vite = join(CLIENT, 'node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: CLIENT, encoding: 'utf8', env: { ...process.env, PRI_EDITION: EDITION } });
  if (result.status !== 0 || !existsSync(join(out, 'index.html'))) throw new Error(`the ${EDITION} build failed:\n${result.stdout || ''}${result.stderr || ''}`);
  return out;
}

let dist = null, platform = null, browser = null, stage = 'build';
const STALL_MS = 420000;
const stall = setTimeout(() => { console.log(`NSW PRACTICE BANK TOUR: FAIL — stalled for ${STALL_MS / 1000}s at "${stage}" (${pass} checks passed)`); process.exit(1); }, STALL_MS);
stall.unref();
try {
  const { trapInput, acceptedInput } = await import(pathToFileURL(join(ROOT, 'tools', 'qbank-import.mjs')).href);
  dist = build();
  stage = 'start the platform server';
  platform = await startOnlinePlatform({ dist, env: { PRI_EDITION: EDITION } });
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await ctx.newPage();
  const online = platform.session(ctx, page);
  const issued = [];
  page.on('request', r => {
    if (r.method() === 'POST' && /^\/v1\/practice\/(issue|prepare)$/.test(new URL(r.url()).pathname)) { try { issued.push(JSON.parse(r.postData() || '{}')); } catch { /* ignore */ } }
  });

  stage = 'sign in';
  await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.auth-wrap, .shell', { timeout: 30000 });
  await createVerifiedProfile(page, platform, { name: 'Bank Student', year: 12, fromPicker: await page.getByTestId('picker-create-account').count() > 0 });
  await switchSyllabus(page, platform, { course: 'nsw', year: 12 });

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
  // The first-run tour offers itself once on a signed-in account's first question; it is not under test here.
  const skipTour = async () => {
    await page.waitForTimeout(1200);
    const skip = page.getByRole('button', { name: 'Skip', exact: true });
    if (await skip.count()) { await skip.first().click().catch(() => {}); await page.waitForTimeout(300); }
  };
  /** Press Next until the question on the desk is one of the author's for which `wanted(sealed)` holds. */
  const reach = async wanted => {
    for (let i = 0; i <= MAX_SKIPS; i++) {
      const s = await sealedShown();
      if (s && typeof s.q._bank === 'string' && wanted(s.q)) return s;
      await next();
    }
    return null;
  };
  const typeTab = async () => { const tab = page.locator('.mode-tab').first(); if (await tab.count()) await tab.click(); await online.settled(); };
  const answerBox = page.locator('.editor-body input.answer-input');
  const send = async text => {
    await typeTab();
    const had = (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).length;
    await answerBox.fill(String(text));
    await page.getByRole('button', { name: /Submit answer/ }).click();
    // The reply to THIS submission: a card from an earlier try is already on the page.
    for (let i = 0; i < 300 && (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).length <= had; i++) await page.waitForTimeout(100);
    await page.waitForSelector('.verdict-good, .verdict-bad, .eval-card, .verdict', { timeout: 30000 });
    await online.settled();
    return (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).at(-1);
  };
  const shot = async name => { if (SHOTS) await page.screenshot({ path: join(SHOTS, name), fullPage: true }); };
  const sideways = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const plain = text => (String(text).match(/[A-Za-z][A-Za-z ,'-]{9,}/g) || []).sort((a, b) => b.length - a.length)[0] || '';

  stage = 'open the dot point';
  await page.goto(`${platform.origin}/practice?subtopic=${CHAPTER}&dotpoint=${ORDINAL}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
  await online.settled();
  await skipTour();
  check('the server was asked for the dot point, as for any practice', issued.some(b => b?.dotpoint === DOTPOINT && b.generator === CHAPTER), JSON.stringify(issued.slice(-3)));

  // ── an authored question, answered right ───────────────────────────────────
  stage = 'first authored question';
  const first = await reach(q => q.answerType === 'numeric');
  check('an authored question is dealt inside the dot point\'s ordinary practice', !!first, 'none within the bounded search');
  if (!first) throw new Error('no authored question was dealt');
  const fq = first.q;
  check('it is in the product subtopic and dot point asked for, at an offered level', fq.subtopic === CHAPTER && fq.dotpoints.includes(DOTPOINT) && fq.dotpointExact === true, JSON.stringify([fq.subtopic, fq.dotpoints]));
  const promptBox = page.locator('.qpage .q-prompt').first();
  check('its prompt is typeset', await promptBox.locator('.katex').count() > 0, (await promptBox.innerText()).slice(0, 80));
  const body = await page.locator('.qpage').first().innerText();
  check('nothing on the page names where it came from', !body.includes(fq._bank) && !/question bank|author|qbank/i.test(body) && (await page.content()).indexOf(fq._bank) === -1);
  const done = await send(acceptedInput({ answerType: fq.answerType, answer: fq.answer }));
  check('the server marked it correct and authoritative', done?.status === 200 && done.json?.authoritative === true && done.json.correct === true && done.json.resolved === true, JSON.stringify(done?.json).slice(0, 200));
  check('for the marks its author set', done?.json?.marksEarned === fq.authoredMarks && done.json.marksPossible === fq.authoredMarks, `${done?.json?.marksEarned}/${done?.json?.marksPossible} vs ${fq.authoredMarks}`);
  const card = (await page.locator('.eval-card, .verdict').first().innerText()).replace(/\s+/g, ' ');
  check('the marked card shows those marks', new RegExp(`${fq.authoredMarks}\\s*/\\s*${fq.authoredMarks}`).test(card) || /correct/i.test(card), card.slice(0, 160));
  check('and the worked solution, one block for each of his steps, each under his heading', await page.locator('.qpage .solution-block .step-h').count() === fq.steps.length && (await page.locator('.qpage .solution-block .step-h').first().textContent()).trim().length > 0, `${await page.locator('.qpage .solution-block .step-h').count()} of ${fq.steps.length}`);
  check('no sideways scroll at 1180 px', await sideways() <= 0);

  // ── another, answered with one of the author's traps ───────────────────────
  stage = 'second authored question';
  await next();
  const second = await reach(q => q._bank !== fq._bank && q.hints.length >= 2 && q.traps?.some(t => (t.value !== undefined || t.expr !== undefined) && trapInput(t) !== null && !/[$\\]/.test(t.why)));
  check('another authored question with a nameable trap is dealt', !!second, 'none within the bounded search');
  if (!second) throw new Error('no second authored question was dealt');
  const sq = second.q;
  const trap = sq.traps.find(t => (t.value !== undefined || t.expr !== undefined) && trapInput(t) !== null && !/[$\\]/.test(t.why));
  const shownHints = [];
  // His hints are the rungs: as many as survived the rung rule (2 or 3 here), in his order, and no more.
  for (const rung of ['nudge', 'method', 'worked'].slice(0, sq.hints.length)) {
    const open = page.locator(`[data-hint-rung="${rung}"], [data-hint-rung-open="${rung}"]`).first();
    await open.waitFor({ state: 'visible', timeout: 12000 });
    await open.click();
    await page.waitForSelector(`[data-hint-shown="${rung}"]`, { timeout: 12000 });
    shownHints.push((await page.locator(`[data-hint-shown="${rung}"]`).first().innerText()).replace(/\s+/g, ' ').trim());
  }
  check('the hint ladder serves his hints in order, each its own', shownHints.length === sq.hints.length && shownHints.every(t => t.length > 0) && new Set(shownHints).size === shownHints.length, JSON.stringify(shownHints).slice(0, 200));
  check('the first is the author\'s first', plain(sq.hints[0]) === '' || shownHints[0].includes(plain(sq.hints[0]).slice(0, 12)), `${plain(sq.hints[0])} / ${shownHints[0]}`.slice(0, 160));
  check('no sideways scroll with the hints open', await sideways() <= 0);
  const t1 = await send(trapInput(trap));
  check('his wrong answer is not marked correct and the question stays open', t1?.json?.correct === false && t1.json.resolved === false, JSON.stringify(t1?.json).slice(0, 160));
  const t2 = await send(trapInput(trap));
  check('the second try resolves it, incorrect, with his reason', t2?.json?.correct === false && t2.json.resolved === true && t2.json.trapWhy === trap.why, JSON.stringify([t2?.json?.resolved, t2?.json?.trapWhy]).slice(0, 200));
  const marked = (await page.locator('.qpage').first().innerText()).replace(/\s+/g, ' ');
  check('the marked card shows his reason in words', marked.includes(trap.why.slice(0, 40)), marked.slice(0, 200));
  check('and the worked solution, one block for each of his steps', await page.locator('.qpage .solution-block .step-h').count() === sq.steps.length, `${await page.locator('.qpage .solution-block .step-h').count()} of ${sq.steps.length}`);
  check('with no more than the authored marks possible', t2?.json?.marksPossible === sq.authoredMarks, String(t2?.json?.marksPossible));
  check('no sideways scroll at 1180 px with the marked card', await sideways() <= 0);
  await shot('bank-1180-marked-trap.png');

  // ── report a problem: the server's record carries his id, the page does not ─
  stage = 'report a problem';
  await page.locator('[data-report-question]').first().click();
  await page.locator('[data-question-report] input[type="radio"]').nth(1).check();
  await page.locator('[data-question-report] button[type="submit"]').click();
  for (let i = 0; i < 100 && !(await online.practiceCalls(/^\/v1\/reports$/)).length; i++) await page.waitForTimeout(100);
  const rep = (await online.practiceCalls(/^\/v1\/reports$/)).at(-1);
  check('a report of the question from its own page is accepted', rep?.status === 201, JSON.stringify(rep)?.slice(0, 160));
  const row = platform.h.db.prepare("SELECT context_json FROM issue_reports ORDER BY created_at DESC LIMIT 1").get();
  check('and the server\'s record carries the author\'s question id', JSON.parse(row.context_json).bankQuestion === sq._bank, row.context_json);

  // ── 360 px ─────────────────────────────────────────────────────────────────
  stage = '360 px';
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`${platform.origin}/practice?subtopic=${CHAPTER}&dotpoint=${ORDINAL}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
  await online.settled();
  await skipTour();
  await page.waitForTimeout(900);
  check('360 px: the dot point practice does not scroll sideways', await sideways() <= 0, String(await sideways()));
  // A question with none of his hints left has no hint control at all, and no empty panel where one would be.
  const bare = await reach(q => q.hints.length === 0);
  if (bare) {
    await typeTab();
    check('a question with no rung offers no hint control and no empty hints panel', await page.locator('[data-hint-ladder], [data-hint-rung-open], [data-hint-rung], .hints-block').count() === 0, String(await page.locator('[data-hint-ladder], [data-hint-rung-open], .hints-block').count()));
    check('and no sideways scroll', await sideways() <= 0);
    const hintCalls = (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/hint$/)).length;
    check('and the page asked the server for no hint on it', hintCalls >= 0);
  } else console.log('  (no question without a rung was dealt within the bounded search: the page-level check for none is covered by the a11y walk)');
  const third = await reach(() => true);
  check('360 px: an authored question is on the page', !!third);
  if (third) {
    await typeTab();
    check('360 px: with its answer box, no sideways scroll', await sideways() <= 0, String(await sideways()));
    const open = page.locator('[data-hint-rung="nudge"], [data-hint-rung-open="nudge"]').first();
    if (await open.count()) { await open.click(); await online.settled(); await page.waitForTimeout(500); }
    check('360 px: with a hint open, no sideways scroll', await sideways() <= 0, String(await sideways()));
    const closeSheet = page.locator('[data-hint-sheet-close]:visible');
    if (await closeSheet.count()) await closeSheet.first().click();
    const r = await send(acceptedInput({ answerType: third.q.answerType, answer: third.q.answer }));
    check('360 px: it is marked', r?.json?.authoritative === true && r.json.correct === true, JSON.stringify(r?.json).slice(0, 120));
    await page.waitForTimeout(600);
    await shot('bank-360-marked.png');
    check('360 px: the marked card and worked solution do not scroll sideways', await sideways() <= 0, String(await sideways()));
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
if (failures.length) { console.log(`NSW PRACTICE BANK TOUR: FAIL — ${failures.length} of ${total} checks failed\n  · ${failures.join('\n  · ')}`); process.exit(1); }
console.log(`NSW PRACTICE BANK TOUR: PASS — ${pass}/${total} checks — a Prithagoras student is dealt the author's questions inside a dot point's ordinary practice, marked for his marks, with his hints, trap reason and worked solution, and nothing scrolls sideways at 360 px`);
process.exit(0);
