// Pri Learning · a Prithagoras Extension 1 student sees ONE entry per syllabus topic.
//
// Builds the Prithagoras client (or serves PRI_TOUR_DIST) and serves it from the real platform server on PRI_EDITION=prithagoras,
// signs a Year 12 Extension 1 student up on the card and proves in Chromium, at 1280x800 and at 375x812:
//   · the topic chooser (Home, "Choose a topic", Extension 1) lists each topic once, under its own name: no name says
//     "Original Forms" and no two entries share a name;
//   · a topic that has extra question forms lists the dot points of both generators, and the last one is issued by the
//     companion generator (the issue request names it);
//   · an old link naming the `-forms` id lands on the same entry and the same dot point;
//   · the page does not scroll sideways.
// With PRI_TOPIC_SHOTS=<dir> it also saves the screenshots.
//
// Usage: node client/test/tour-nsw-topic-entries.js
import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startOnlinePlatform } from './support/online-session.mjs';
import { createVerifiedProfile } from './support/verified-onboarding.mjs';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EDITION = 'prithagoras';
const SHOTS = process.env.PRI_TOPIC_SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
function build() {
  const out = mkdtempSync(join(tmpdir(), 'pri-nsw-entries-'));
  const vite = join(CLIENT, 'node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: CLIENT, encoding: 'utf8', env: { ...process.env, PRI_EDITION: EDITION, VITE_PRI_EDITION: EDITION } });
  if (result.status !== 0 || !existsSync(join(out, 'index.html'))) throw new Error(`the ${EDITION} build failed:\n${result.stdout || ''}${result.stderr || ''}`);
  return out;
}
const DIST = process.env.PRI_TOUR_DIST || build();

let pass = 0;
const failures = [];
const check = (name, condition, detail = '') => {
  if (condition) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`  ${condition ? '✓' : '✗'} ${name}${condition || !detail ? '' : ` — ${detail}`}`);
};

const SRC = pathToFileURL(join(CLIENT, 'src')).href + '/';
const T = await import(`${SRC}engine/curriculum.js`);
const { SUBTOPIC_BY_ID, dotpointsFor } = await import(`${SRC}engine/curriculum.js`);
const { nswIssuedForms } = await import(`${SRC}engine/nswOffer.js`);
// A different paired topic at each width: an unfinished question is resumed for any dot point it credits, not issued again.
const PICK = Object.fromEntries([['desktop', 'me12-induction'], ['phone', 'me12-binomial']].map(([label, base]) => {
  const pair = T.entryPairs().find(p => p.base === base);
  const entryDps = T.entryDotpoints(base);
  const dp = entryDps.filter(d => d.subtopic === pair.companion && nswIssuedForms(d.subtopic, d.forms).length > 0).at(-1);
  return [label, { pair, entryDps, dp, name: SUBTOPIC_BY_ID[base].name, ordinal: entryDps.findIndex(d => d.id === dp.id), issuable: entryDps.filter(d => nswIssuedForms(d.subtopic, d.forms).length > 0) }];
}));

let platform = null, browser = null, stage = 'start';
const STALL_MS = 300000;
const stall = setTimeout(() => { console.log(`NSW TOPIC ENTRIES TOUR: FAIL — stalled for ${STALL_MS / 1000}s at "${stage}" (${pass} checks passed)`); process.exit(1); }, STALL_MS);
stall.unref();
try {
  platform = await startOnlinePlatform({ dist: DIST, env: { PRI_EDITION: EDITION } });
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  const online = platform.session(ctx, page);
  const issued = [];
  page.on('request', r => {
    if (r.method() === 'POST' && /^\/v1\/practice\/(issue|prepare)$/.test(new URL(r.url()).pathname)) { try { issued.push(JSON.parse(r.postData() || '{}')); } catch { /* ignore */ } }
  });
  stage = 'sign in';
  await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.auth-wrap, .shell', { timeout: 30000 });
  await createVerifiedProfile(page, platform, { name: 'Entry Student', year: 12, fromPicker: await page.getByTestId('picker-create-account').count() > 0 });
  // Extension 1: the pathway is a setting of the profile.
  await page.goto(`${platform.origin}/settings`, { waitUntil: 'domcontentloaded' });
  const card = page.locator('.card', { has: page.getByRole('heading', { name: 'Profile Information' }) });
  await card.waitFor({ timeout: 30000 });
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#set-course').waitFor({ timeout: 15000 });
  await page.locator('#set-course').selectOption('nsw');
  await page.locator('#set-year').selectOption('12');
  await page.locator('.pathway-pick', { hasText: /^Extension 1/ }).first().click();
  await card.getByRole('button', { name: 'Save changes' }).click();
  await page.locator('#set-course').waitFor({ state: 'detached', timeout: 15000 });

  const skipTour = async () => {
    await page.waitForTimeout(1200);
    const skip = page.getByRole('button', { name: 'Skip', exact: true });
    if (await skip.count()) { await skip.first().click().catch(() => {}); await page.waitForTimeout(300); }
  };
  const shot = async name => { if (SHOTS) await page.screenshot({ path: join(SHOTS, name) }); };

  // Companion rows the way an older version recorded them: ratings, a due review, a live slip and a restored attempt,
  // written straight into the device store (the synthetic platform has no seeding route, so this is the seam).
  const seeded = await page.evaluate(async ({ pairs }) => {
    const pid = localStorage.getItem('pri-current-profile');
    const db = await new Promise((res, rej) => { const r = indexedDB.open('pri-learning'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const put = (store, value) => new Promise((res, rej) => { const tx = db.transaction(store, 'readwrite'); (store === 'attempts' ? tx.objectStore(store).add(value) : tx.objectStore(store).put(value)); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    const now = Date.now(), DAY = 86400000;
    for (const [i, base] of pairs.entries()) {
      const g = `${base}-forms`;
      await put('ratings', { key: `${pid}:${g}`, pid, subtopic: g, rating: 1180, attempts: 6, correct: 3, last_at: now - 5 * DAY, recent: [1, 0, 1], dp: {}, traps: { [`slip-${g}`]: { n: 3, s: 3, label: 'a repeated slip', dotpoint: `${g}.1`, lastAt: now - DAY, credit: 0 } } });
      await put('ratings', { key: `${pid}:${base}`, pid, subtopic: base, rating: 1120, attempts: 4, correct: 3, last_at: now - 6 * DAY, recent: [1, 1], dp: {}, traps: {} });
      await put('reviews', { key: `${pid}:${g}`, pid, subtopic: g, dueAt: now - DAY, lastAt: now - 8 * DAY, stability: 2, difficulty: 5, reps: 1, lapses: 0, intervalDays: 2 });
      await put('attempts', { pid, subtopic: g, difficulty: 2, correct: true, createdAt: now - 3600000 * (i + 1), mode: 'practice', questionId: `seed-q-${i}`, remoteEventId: `seed-ev-${i}` });
    }
    db.close();
    return pid;
  }, { pairs: T.entryPairs().map(p => p.base) });
  check('companion rows were seeded under the generator ids', !!seeded);
  const RAW = /\b(me|ms|mex|y)\d+-[a-z][a-z0-9-]+\b/;
  const pageChecks = async (label, path, countIn) => {
    await page.goto(`${platform.origin}${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
    await skipTour();
    const text = await page.locator('body').innerText();
    check(`${label} ${path}: no "Original Forms" and no raw generator id`, !/original\s+forms/i.test(text) && !RAW.test(text), (text.match(RAW) || [''])[0]);
    for (const { base } of T.entryPairs()) {
      const name = SUBTOPIC_BY_ID[base].name;
      const n = await countIn(name);
      check(`${label} ${path}: "${name}" is one row (${n})`, n <= 1, String(n));
    }
    check(`${label} ${path}: does not scroll sideways`, await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 0);
  };
  const rowsNamed = sel => async name => page.locator(sel).evaluateAll((els, n) => els.filter(e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim().startsWith(n)).length, name);

  for (const [label, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 375, height: 812 }]]) {
    const { pair: PAIR, dp: lastDp, ordinal: lastOrdinal, name: NAME, issuable } = PICK[label];
    stage = `${label}: the chooser`;
    await page.setViewportSize(size);
    await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="choose-topic"]', { timeout: 30000 });
    await online.settled();
    await skipTour();
    await page.getByTestId('choose-topic').click();
    await page.getByRole('tab', { name: /^course/i }).click();   // the chooser reopens where it was left
    const course = page.locator('.gen-opt', { hasText: /^Extension 1/ }).first();
    await course.waitFor({ timeout: 15000 });
    await course.click();
    await page.waitForSelector('#gen-pane .gen-sub-head', { timeout: 15000 });
    const labels = await page.locator('#gen-pane .gen-opt').evaluateAll(els => els.map(e => (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim()));
    check(`${label}: the Extension 1 chooser lists topics (${labels.length})`, labels.length >= 7, JSON.stringify(labels).slice(0, 200));
    check(`${label}: no entry says "Original Forms"`, labels.every(l => !/original\s+forms/i.test(l)), labels.filter(l => /original\s+forms/i.test(l)).join(' | '));
    check(`${label}: no two entries share a name`, new Set(labels).size === labels.length, labels.filter((l, i, a) => a.indexOf(l) !== i).join(' | '));
    for (const { base } of T.entryPairs()) {
      const name = SUBTOPIC_BY_ID[base].name;
      check(`${label}: "${name}" is listed exactly once`, labels.filter(l => l === name || l.startsWith(`${name} `)).length === 1, JSON.stringify(labels.filter(l => l.includes(name.split(' ')[0]))));
    }
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`${label}: the chooser does not scroll sideways`, sideways <= 0, String(sideways));
    await shot(`entries-${label}-1-chooser.png`);

    stage = `${label}: dot points`;
    await page.locator('#gen-pane .gen-opt', { hasText: NAME }).first().click();
    await page.getByRole('tab', { name: /dot point/i }).click();
    const dots = await page.locator('#gen-pane .gen-opt').allTextContents();
    check(`${label}: ${NAME} offers the dot points of both generators (${issuable.length})`, dots.length >= issuable.length && issuable.every(dp => dots.some(t => t.includes(dp.text.slice(0, 25)))), JSON.stringify(dots).slice(0, 300));
    await shot(`entries-${label}-2-dotpoints.png`);
    await page.locator('#gen-pane .gen-opt', { hasText: lastDp.text.slice(0, 25) }).first().click();
    await page.getByRole('button', { name: /^Generate/ }).first().click();
    await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
    await online.settled();
    const url = new URL(page.url());
    check(`${label}: the practice link names the topic and the merged dot point`, url.searchParams.get('subtopic') === PAIR.base && url.searchParams.get('dotpoint') === String(lastOrdinal), page.url());
    // Issued by the companion generator, or the unfinished question for that dot point resumed (then the page names it).
    const named = async () => (await page.locator('[data-served-dotpoint]').allInnerTexts()).join(' ').includes(lastDp.text.slice(0, 20));
    check(`${label}: the companion generator answered that dot point (issue request, or its unfinished question resumed)`, issued.some(b => b?.generator === lastDp.subtopic && b?.dotpoint === lastDp.id) || await named(), JSON.stringify(issued.map(b => [b?.generator, b?.dotpoint])));
    check(`${label}: the page names the topic, not a generator`, !/original\s+forms/i.test(await page.locator('body').innerText()) && (await page.title()).includes(NAME), await page.title());
    await skipTour();
    await shot(`entries-${label}-3-practice.png`);

    stage = `${label}: an old link`;
    await page.goto(`${platform.origin}/practice?subtopic=${PAIR.companion}&dotpoint=${lastDp.ordinal}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
    await online.settled();
    const select = page.getByLabel('Syllabus dot point');
    check(`${label}: the old link lands on the entry's dot point list at the same dot point`, await select.count() === 1 && await select.inputValue() === String(lastOrdinal), await select.count() ? await select.inputValue() : 'no picker');
    check(`${label}: the practice page does not scroll sideways`, await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 0);

    stage = `${label}: pages with seeded companion rows`;
    await pageChecks(label, '/paper-generator', rowsNamed('.pg-topics li'));
    await pageChecks(label, '/progress', async name => (await page.locator('body').innerText()).split('\n').filter(l => l.trim() === name).length);
    await pageChecks(label, '/plan', async name => page.locator('[data-plan-day]').evaluateAll((days, n) => Math.max(0, ...days.map(d => [...d.querySelectorAll('[data-plan-session]')].filter(s => s.innerText.includes(n)).length)), name));
    await pageChecks(label, '/review', async name => (await page.locator('body').innerText()).split('\n').filter(l => l.trim() === name).length);
  }
} catch (err) {
  failures.push(`the tour stopped at "${stage}": ${err.stack || err.message}`);
} finally {
  await browser?.close().catch(() => {});
  await platform?.close?.().catch(() => {});
}
const total = pass + failures.length;
if (failures.length) {
  console.log(`NSW TOPIC ENTRIES TOUR: FAIL — ${failures.length} of ${total} checks failed\n  · ${failures.join('\n  · ')}`);
  process.exit(1);
}
console.log(`NSW TOPIC ENTRIES TOUR: PASS — ${pass}/${total} checks at 1280x800 and 375x812: one entry per topic, no "Original Forms", both generators' dot points, old links land on the entry. [SYNTHETIC]`);
process.exit(0);
