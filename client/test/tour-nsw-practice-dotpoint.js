// Pri Learning · a Prithagoras student narrows practice to one syllabus dot point.
//
// Builds the Prithagoras client, serves it from the real platform server on
// PRI_EDITION=prithagoras, signs a Year 12 student up on the card and proves in
// Chromium, at 1280x800 and at 375x812:
//   · the practice page has a labelled "Syllabus dot point" control listing "All dot points"
//     and exactly the dot points of the topic that an issued question stands behind;
//   · choosing one writes `dotpoint=<n>` to the URL, the next question is issued by the server FROM that
//     dot point (the issue request names it), the chip and the header show it, and the change is
//     announced in the live region;
//   · the chip's clear button removes it; All dot points does too;
//   · a link to a dot point nothing is issued for says so in one sentence and offers All dot points;
//   · choosing and clearing never move the writing area, and no width scrolls sideways.
// With PRI_DOTPOINT_SHOTS=<dir> it also saves the screenshots (closed, focused, active) of both widths.
//
// Usage: node client/test/tour-nsw-practice-dotpoint.js
import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startOnlinePlatform } from './support/online-session.mjs';
import { createVerifiedProfile, switchSyllabus } from './support/verified-onboarding.mjs';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EDITION = 'prithagoras';
const CHAPTER = 'y12-diff';
const SHOTS = process.env.PRI_DOTPOINT_SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

let pass = 0;
const failures = [];
const check = (name, condition, detail = '') => {
  if (condition) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`  ${condition ? '✓' : '✗'} ${name}${condition || !detail ? '' : ` — ${detail}`}`);
};

function build() {
  const out = mkdtempSync(join(tmpdir(), 'pri-nsw-dotpoint-'));
  const vite = join(CLIENT, 'node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: CLIENT, encoding: 'utf8', env: { ...process.env, PRI_EDITION: EDITION } });
  if (result.status !== 0 || !existsSync(join(out, 'index.html'))) throw new Error(`the ${EDITION} build failed:\n${result.stdout || ''}${result.stderr || ''}`);
  return out;
}

const SRC = pathToFileURL(join(CLIENT, 'src')).href + '/';
const { dotpointsFor } = await import(`${SRC}engine/curriculum.js`);
const { nswIssuedForms } = await import(`${SRC}engine/nswOffer.js`);
const expected = dotpointsFor(CHAPTER).filter(d => nswIssuedForms(CHAPTER, d.forms).length > 0);

let dist = null, platform = null, browser = null, stage = 'build';
const STALL_MS = 300000;
const stall = setTimeout(() => { console.log(`NSW DOT POINT TOUR: FAIL — stalled for ${STALL_MS / 1000}s at "${stage}" (${pass} checks passed)`); process.exit(1); }, STALL_MS);
stall.unref();
try {
  dist = build();
  platform = await startOnlinePlatform({ dist, env: { PRI_EDITION: EDITION } });
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  const online = platform.session(ctx, page);
  const issued = [];
  page.on('request', r => {
    if (r.method() === 'POST' && new URL(r.url()).pathname === '/v1/practice/issue') { try { issued.push(JSON.parse(r.postData() || '{}')); } catch { /* ignore */ } }
  });
  stage = 'sign in';
  await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.auth-wrap, .shell', { timeout: 30000 });
  await createVerifiedProfile(page, platform, { name: 'Dot Point Student', year: 12, fromPicker: await page.getByTestId('picker-create-account').count() > 0 });
  await switchSyllabus(page, platform, { course: 'nsw', year: 12 });

  const qid = () => page.locator('.qpage[data-question-id]').first().getAttribute('data-question-id');
  const nextQuestion = async before => {
    await page.waitForFunction(id => { const el = document.querySelector('.qpage[data-question-id]'); return el && el.getAttribute('data-question-id') !== id && el.querySelector('.q-prompt'); }, before, { timeout: 30000 });
    await online.settled();
  };
  const metrics = () => page.evaluate(() => {
    const pick = document.querySelector('[data-dotpoint-picker]');
    const q = document.querySelector('.qpage');
    const r = el => { const b = el?.getBoundingClientRect(); return b ? { top: Math.round(b.top), height: Math.round(b.height), width: Math.round(b.width) } : null; };
    return { pick: r(pick), select: r(pick?.querySelector('select')), q: r(q), scrollX: document.documentElement.scrollWidth - window.innerWidth };
  });
  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: join(SHOTS, name) }); };

  for (const [label, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 375, height: 812 }]]) {
    stage = `${label}: open practice`;
    await page.setViewportSize(size);
    await page.goto(`${platform.origin}/practice?subtopic=${CHAPTER}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
    await online.settled();
    const select = page.getByLabel('Syllabus dot point');
    check(`${label}: a control labelled "Syllabus dot point" is on the page`, await select.count() === 1 && await select.evaluate(el => el.tagName === 'SELECT'));
    const options = await select.locator('option').allTextContents();
    check(`${label}: it lists All dot points and exactly the topic's issued dot points`,
      JSON.stringify(options) === JSON.stringify(['All dot points', ...expected.map(d => d.text)]), JSON.stringify(options).slice(0, 200));
    check(`${label}: nothing is chosen and no chip shows`, await select.inputValue() === '' && await page.locator('[data-dotpoint-chip]').count() === 0);
    await page.waitForTimeout(900);   // the page's own entrance settles before anything is measured
    const before = await metrics();
    check(`${label}: the page does not scroll sideways`, before.scrollX <= 0, String(before.scrollX));
    await shot(`dotpoint-${label}-1-closed.png`);
    await select.focus();
    await shot(`dotpoint-${label}-2-focused.png`);

    stage = `${label}: choose a dot point`;
    const target = expected[1] || expected[0];
    const ordinal = dotpointsFor(CHAPTER).findIndex(d => d.id === target.id);
    const was = await qid();
    issued.length = 0;
    await select.selectOption(String(ordinal));
    await nextQuestion(was);
    check(`${label}: the URL carries dotpoint=${ordinal}`, new URL(page.url()).searchParams.get('dotpoint') === String(ordinal) && new URL(page.url()).searchParams.get('subtopic') === CHAPTER, page.url());
    check(`${label}: the server was asked for that dot point`, issued.some(b => b?.dotpoint === target.id), JSON.stringify(issued.map(b => b?.dotpoint)));
    const chip = page.locator('[data-dotpoint-chip]');
    check(`${label}: the chip names it`, await chip.count() === 1 && (await chip.innerText()).includes('Dot point:'), await chip.allInnerTexts().then(x => x.join('|')));
    check(`${label}: the question header names it`, await page.locator('[data-served-dotpoint]').count() === 1 && (await page.locator('[data-served-dotpoint]').innerText()).includes(target.text.slice(0, 20)));
    await page.waitForFunction(() => (document.querySelector('[data-dotpoint-picker] [data-shell-announce]')?.textContent || '').length > 0, null, { timeout: 5000 }).catch(() => {});
    const live = await page.locator('[data-dotpoint-picker] [data-shell-announce]').textContent();
    check(`${label}: the change was announced`, live.includes(target.text.slice(0, 20)), live);
    await page.waitForTimeout(900);
    const during = await metrics();
    check(`${label}: choosing did not change the control's size or position`, JSON.stringify(during.pick) === JSON.stringify(before.pick), `${JSON.stringify(before.pick)} -> ${JSON.stringify(during.pick)}`);
    check(`${label}: the writing area did not shift sideways or scroll the page`, during.q.width === before.q.width && during.scrollX <= 0, `${before.q.width} -> ${during.q.width}`);
    await shot(`dotpoint-${label}-3-active.png`);

    stage = `${label}: clear the chip`;
    await page.locator('[data-dotpoint-clear]').click();
    // The question on the desk is unfinished work and stays: All dot points resumes it, it is never discarded.
    await page.waitForFunction(() => !new URL(location.href).searchParams.has('dotpoint') && !document.querySelector('[data-dotpoint-chip]'), null, { timeout: 30000 });
    await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
    await online.settled();
    await page.waitForTimeout(900);
    check(`${label}: the chip's clear button removes dotpoint from the URL`, !new URL(page.url()).searchParams.has('dotpoint') && new URL(page.url()).searchParams.get('subtopic') === CHAPTER, page.url());
    check(`${label}: the control is back on All dot points`, await select.inputValue() === '' && await page.locator('[data-dotpoint-chip]').count() === 0);
    const after = await metrics();
    check(`${label}: clearing did not move the control`, JSON.stringify(after.pick) === JSON.stringify(before.pick));

    stage = `${label}: a dot point nothing is issued for`;
    await page.goto(`${platform.origin}/practice?subtopic=${CHAPTER}&dotpoint=99`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-dotpoint-none]', { timeout: 30000 });
    check(`${label}: it says so in one plain sentence and offers All dot points`,
      /no questions yet/.test(await page.locator('[data-dotpoint-none]').innerText()) && await page.locator('[data-dotpoint-none] [data-dotpoint-all]').count() === 1);
    check(`${label}: no chip claims a dot point it cannot issue`, await page.locator('[data-dotpoint-chip]').count() === 0);
    await page.locator('[data-dotpoint-none] [data-dotpoint-all]').click();
    await page.waitForFunction(() => !new URL(location.href).searchParams.has('dotpoint'));
    check(`${label}: All dot points clears the link's dot point`, !new URL(page.url()).searchParams.has('dotpoint'));
  }

  stage = 'keyboard';
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${platform.origin}/practice?subtopic=${CHAPTER}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
  const sel = page.getByLabel('Syllabus dot point');
  await sel.focus();
  const was3 = await qid();
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => new URL(location.href).searchParams.has('dotpoint'), null, { timeout: 30000 });
  await page.waitForFunction(id => { const el = document.querySelector('.qpage[data-question-id]'); return el && el.getAttribute('data-question-id') !== id; }, was3, { timeout: 30000 });
  check('the keyboard alone chooses a dot point (arrow keys on the focused select)', new URL(page.url()).searchParams.has('dotpoint'), page.url());
  check('focus stays on the control after the choice', await sel.evaluate(el => el === document.activeElement));
} catch (err) {
  failures.push(`the tour stopped at "${stage}": ${String(err.stack || err.message).split('\n').slice(0, 4).join(' | ')}`);
} finally {
  clearTimeout(stall);
  await browser?.close().catch(() => {});
  await platform?.close?.().catch?.(() => {});
  if (dist) rmSync(dist, { recursive: true, force: true });
}
const total = pass + failures.length;
if (failures.length) { console.log(`NSW DOT POINT TOUR: FAIL — ${failures.length} of ${total} checks failed\n  · ${failures.join('\n  · ')}`); process.exit(1); }
console.log(`NSW DOT POINT TOUR: PASS — ${pass}/${total} checks — the dot point control lists the topic's issued dot points, choosing one narrows what the server issues, and it never moves the writing area`);
process.exit(0);
