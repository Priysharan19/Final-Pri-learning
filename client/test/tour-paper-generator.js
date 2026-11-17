// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the Paper Generator, in the browser, in both editions
//
// For each edition (Priyabhata, Prithagoras): builds that edition's client,
// serves it from the real platform server running as that edition, signs a
// verified student in and drives the one screen — keyboard and mouse:
//
//   · the Exams page offers the generator;
//   · a topic is chosen with the keyboard (Tab to the checkbox, Space), more
//     with the mouse; the length, by marks or by time, and the mix are chosen;
//   · the live summary reads "N marks · about M min · about Q questions
//     across …" and the server says whether its approved banks can fill it;
//   · every control has a name; the phone layout leads with the summary;
//   · "Start timed paper" opens the paper in the Exam Desk's room, the paper is
//     submitted and marked by the server, and only then is the marking guide
//     offered and downloaded as a PDF; "Download printable paper" gives a PDF.
//
// Screenshots of each edition go to $PRI_SHOTS (default /tmp/pri-paper-generator-shots).
// WHAT IS REAL: the built client, the platform server and database, the
// edition's approved banks and the server's marking. WHAT IS SYNTHETIC: the
// student and the email delivery.
//
// Run:  node client/test/tour-paper-generator.js
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startOnlinePlatform } from './support/online-session.mjs';
import { createVerifiedProfile, switchSyllabus } from './support/verified-onboarding.mjs';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.PRI_SHOTS || '/tmp/pri-paper-generator-shots';
mkdirSync(SHOTS, { recursive: true });
const en = (await import('../src/i18n/strings.en.js')).default;

let pass = 0;
const failures = [];
const check = (name, condition, detail = '') => {
  if (condition) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`  ${condition ? '✓' : '✗'} ${name}${condition || !detail ? '' : ` — ${detail}`}`);
};

function build(edition) {
  const out = mkdtempSync(join(tmpdir(), `pri-paper-generator-${edition}-`));
  const vite = join(CLIENT, 'node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: CLIENT, encoding: 'utf8', env: { ...process.env, PRI_EDITION: edition } });
  if (result.status !== 0 || !existsSync(join(out, 'index.html'))) throw new Error(`the ${edition} build failed:\n${result.stdout || ''}${result.stderr || ''}`);
  return out;
}

const visibleText = (page, selector) => page.evaluate(sel => [...document.querySelectorAll(sel)]
  .filter(el => el.getClientRects().length > 0).map(el => el.innerText).join(' ').replace(/\s+/g, ' ').trim(), selector);

async function unnamedControls(page) {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  await cdp.detach();
  const ROLES = new Set(['button', 'textbox', 'link', 'combobox', 'checkbox', 'radio', 'switch', 'tab', 'menuitem']);
  return nodes.filter(n => !n.ignored && ROLES.has(n.role?.value)).filter(n => !(n.name?.value || '').trim()).map(n => `${n.role.value}`);
}

async function tour(edition) {
  const label = edition === 'prithagoras' ? 'Prithagoras' : 'Priyabhata';
  console.log(`\n${label}`);
  const dist = build(edition);
  const platform = await startOnlinePlatform({ dist, allowSeededPractice: true, env: { PRI_EDITION: edition } });
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1180, height: 860 }, acceptDownloads: true });
    const page = await ctx.newPage();
    const writes = [];
    page.on('pageerror', e => console.log('  pageerror:', String(e.message).slice(0, 300)));
    page.on('response', r => { if (r.status() >= 400) console.log('  http', r.status(), new URL(r.url()).pathname); });
    page.on('response', r => { const u = new URL(r.url()); if (/^\/v1\/exams\/[^/]+\/finish$/.test(u.pathname)) writes.push(r.status()); });
    await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.auth-wrap, .shell', { timeout: 30000 });
    await createVerifiedProfile(page, platform, { name: `${label} Paper Student`, year: 10, fromPicker: await page.getByTestId('picker-create-account').count() > 0 });
    if (edition === 'prithagoras') await switchSyllabus(page, platform, { course: 'nsw', year: 9 });

    await page.goto(`${platform.origin}/exams`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-paper-generator-entry]', { timeout: 30000 });
    check(`${label}: the Exams page offers the paper generator`, (await visibleText(page, '[data-paper-generator-entry]')).toLowerCase().includes(en['gen.entry.title'].toLowerCase()));
    await page.locator('[data-paper-generator-entry] button').click();
    await page.waitForURL(/\/paper-generator$/, { timeout: 15000 });
    await page.waitForSelector('[data-paper-generator]', { timeout: 30000 }).catch(async e => { console.log('  on screen:', (await visibleText(page, 'main')).slice(0, 300)); throw e; });
    check(`${label}: the screen has its heading`, await page.locator('h1').count() === 1);
    check(`${label}: nothing is chosen, so it says to choose a topic`, (await visibleText(page, '[data-gen-summary]')).includes(en['gen.chooseTopics']));

    // Keyboard: Tab onto the first topic, Space chooses it.
    const first = page.locator('[data-topic]').first();
    await first.focus();
    await page.keyboard.press('Space');
    check(`${label}: Space on a focused topic chooses it`, await first.isChecked());
    await page.locator('[data-topic]').nth(1).check();
    // Length by time, and the mix.
    await page.getByRole('radio', { name: en['gen.byMinutes'] }).click();
    await page.getByLabel(en['gen.lenMinutes'].replace('{n}', '60')).check();
    await page.getByLabel(en['gen.mix.exam']).check();
    await page.waitForSelector('[data-gen-fit="ready"], [data-gen-fit="short"]', { timeout: 30000 });
    const summary = await visibleText(page, '[data-gen-summary]');
    check(`${label}: the live summary has the marks, the minutes, an estimate and the topics`, /40 marks · about 60 min · about \d+ questions across /.test(summary), summary);
    const fit = await page.locator('[data-gen-fit]').getAttribute('data-gen-fit');
    check(`${label}: the server says its banks can fill it`, fit === 'ready', fit);
    check(`${label}: the guide is not offered before a paper is submitted`, (await visibleText(page, '.pg')).includes(en['gen.guideNote']));
    const unnamed = await unnamedControls(page);
    check(`${label}: every control is named`, unnamed.length === 0, JSON.stringify(unnamed));
    await page.screenshot({ path: join(SHOTS, `${edition}-desktop.png`), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`${label}: the phone layout does not scroll sideways`, overflow <= 1, String(overflow));
    check(`${label}: on a phone the summary comes before the choices`, await page.evaluate(() => { const s = document.querySelector('.pg-summary').getBoundingClientRect().top; const c = document.querySelector('.pg-choices').getBoundingClientRect().top; return s < c; }));
    await page.screenshot({ path: join(SHOTS, `${edition}-phone.png`), fullPage: true });
    await page.setViewportSize({ width: 1180, height: 860 });

    // The printable paper.
    const download = page.waitForEvent('download', { timeout: 30000 });
    await page.locator('[data-gen-print]').click();
    const file = await download;
    check(`${label}: the printable paper downloads as a PDF`, /\.pdf$/.test(file.suggestedFilename()));

    // Sit it, submit it, then the guide.
    await page.locator('[data-gen-start]').click();
    await page.waitForURL(/\/exams\/[0-9a-f-]{36}$/, { timeout: 60000 });
    await page.waitForSelector('.exam-nav, .exam-head', { timeout: 60000 }).catch(async e => { console.log('  on screen:', (await visibleText(page, 'body')).slice(0, 400)); throw e; });
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(SHOTS, `${edition}-sitting.png`) });
    await page.locator('.exam-head').getByRole('button', { name: en['exam.reviewSubmit'] }).click();
    await page.locator('[role="dialog"]').getByRole('button', { name: en['exam.submitPaper'] }).click();
    await page.waitForSelector('[data-exam-guide]', { timeout: 60000 });
    check(`${label}: submitted, marked by the server, and only then is the guide offered`, writes.includes(200));
    const guide = page.waitForEvent('download', { timeout: 30000 });
    await page.locator('[data-exam-guide] button').click();
    check(`${label}: the marking guide downloads as a PDF`, /guide\.pdf$/.test((await guide).suggestedFilename()));
    await page.screenshot({ path: join(SHOTS, `${edition}-result.png`) });
  } finally {
    await browser.close().catch(() => {});
    await platform?.close?.().catch(() => {});
    rmSync(dist, { recursive: true, force: true });
  }
}

try {
  for (const edition of (process.env.PRI_EDITIONS || 'priyabhata,prithagoras').split(',')) await tour(edition);
} catch (error) {
  failures.push(`the tour stopped: ${error.message.split('\n')[0]}`);
  console.error(error);
}
if (failures.length) {
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(`PAPER GENERATOR TOUR: FAIL — ${failures.length} failed, ${pass} passed`);
  process.exit(1);
}
console.log(`PAPER GENERATOR TOUR: PASS — ${pass}/${pass} checks — in both editions a verified student chooses topics by keyboard and mouse, sees the live summary and the server's answer, downloads a printable paper, sits and submits a paper in the Exam Desk, and only then downloads the marking guide. [SYNTHETIC student]`);
