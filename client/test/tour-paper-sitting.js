// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · sitting Practice Paper 1 in the app (Prithagoras)
//
// Builds the client for Prithagoras, serves it from the real platform server
// running as Prithagoras, signs a Year 12 Extension 1 student in on the FREE
// plan and sits the free sample, Practice Paper 1:
//
//   · Section I: ten multiple-choice questions, answered by click and by
//     keyboard (a radio group), one left blank, one wrong, with the paper's
//     diagram loaded as an image for the questions that have one;
//   · Section II: a final answer typed in a part Pri can check, and a written
//     proof typed in a ruled area (a part only the student can check);
//   · the clock: reading and working time as the paper states, switched off;
//   · autosave and resume: reload, and every answer is back;
//   · NOTHING SECRET BEFORE SUBMIT: every /v1/papers response the page read
//     before Submit is scanned for the key, the marking criteria and the sample
//     answer of every part of the paper;
//   · Submit all names the empty parts and asks once; then the honest totals
//     line, the verdict of each part, the sample answer on demand and "How this
//     is marked" with NO marks beside the criteria (no approval record);
//   · at 390 px nothing scrolls sideways; every control has an accessible name.
//
// WHAT IS REAL: the built Prithagoras client, the platform server and its
// SQLite database, the owner's paper content and its marking by the engine.
// WHAT IS SYNTHETIC: the student.
// Screenshots: $PRI_TOUR_SHOTS (default: a temp folder).
//
// Run:  node client/test/tour-paper-sitting.js
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
const CONTENT = join(CLIENT, '..', 'server', 'content', 'papers', 'nsw-ext1');
const EDITION = 'prithagoras';
const SHOTS = process.env.PRI_TOUR_SHOTS || mkdtempSync(join(tmpdir(), 'pri-paper-shots-'));
mkdirSync(SHOTS, { recursive: true });
const en = (await import('../src/i18n/strings.en.js')).default;
const doc = JSON.parse(readFileSync(join(CONTENT, 'structured', 'ext1-2027-p01.json'), 'utf8'));

let pass = 0;
const failures = [];
const check = (name, condition, detail = '') => {
  if (condition) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`  ${condition ? '✓' : '✗'} ${name}${condition || !detail ? '' : ` — ${detail}`}`);
};

function build() {
  const out = mkdtempSync(join(tmpdir(), 'pri-paper-sitting-'));
  const vite = join(CLIENT, 'node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: CLIENT, encoding: 'utf8', env: { ...process.env, PRI_EDITION: EDITION } });
  if (result.status !== 0 || !existsSync(join(out, 'index.html'))) throw new Error(`the ${EDITION} build failed:\n${result.stdout || ''}${result.stderr || ''}`);
  return out;
}

async function unnamedControls(page) {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  await cdp.detach();
  const ROLES = new Set(['button', 'textbox', 'link', 'combobox', 'checkbox', 'radio', 'switch', 'tab', 'menuitem']);
  return nodes.filter(n => !n.ignored && ROLES.has(n.role?.value)).filter(n => !(n.name?.value || '').trim() || !/[\p{L}\p{N}]/u.test(n.name.value)).map(n => `${n.role.value}:${(n.name?.value || '').slice(0, 30)}`);
}

async function setProfile(platform, page, { year, pathway }) {
  await page.goto(`${platform.origin}/settings`, { waitUntil: 'domcontentloaded' });
  const card = page.locator('.card', { has: page.getByRole('heading', { name: 'Profile Information' }) });
  await card.waitFor({ timeout: 30000 });
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#set-year').waitFor({ timeout: 15000 });
  await page.locator('#set-year').selectOption(String(year));
  if (pathway) await card.locator('.pathway-pick', { hasText: pathway }).first().click();
  await card.getByRole('button', { name: 'Save changes' }).click();
  await page.locator('#set-year').waitFor({ state: 'detached', timeout: 15000 });
}

// The strings that must not reach a student before Submit (keys, criteria, sample answers).
const blocksText = bs => (bs || []).map(b => (b.t ?? (b.items || []).join(' ') ?? '')).join(' ');
const secrets = [];
const walk = parts => parts.forEach(p => {
  if (p.parts) return walk(p.parts);
  if (p.key?.display) secrets.push(p.key.display);
  for (const c of p.criteria) secrets.push(blocksText(c.text).slice(0, 60));
  secrets.push(blocksText(p.sampleAnswer).slice(0, 80));
});
doc.sections.forEach(s => s.questions.forEach(q => walk(q.parts)));
const secretList = [...new Set(secrets.map(s => s.trim()).filter(s => s.length >= 12))];

const KEYS = doc.sections[0].questions.map(q => q.parts[0].key.answer);
const wrongOf = letter => 'ABCD'[('ABCD'.indexOf(letter) + 1) % 4];

let dist = null;
let platform = null;
let browser = null;
try {
  dist = build();
  platform = await startOnlinePlatform({ dist, allowSeededPractice: true, env: { PRI_EDITION: EDITION } });
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const seen = [];
  page.on('response', async r => {
    if (!/\/v1\/papers\//.test(r.url()) || /\/figures\//.test(r.url())) return;
    try { seen.push({ url: r.url(), method: r.request().method(), text: await r.text() }); } catch { /* a redirect */ }
  });

  await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.auth-wrap, .shell', { timeout: 30000 });
  await createVerifiedProfile(page, platform, { name: 'Paper Sitter', year: 12, fromPicker: await page.getByTestId('picker-create-account').count() > 0 });
  await switchSyllabus(page, platform, { course: 'nsw', year: 12 });
  await setProfile(platform, page, { year: 12, pathway: 'Extension 1' });

  // ── Open the free sample from the Papers page ───────────────────────────────
  await page.goto(`${platform.origin}/exams`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-ext1-sit="ext1-2027-p01"]', { timeout: 30000 });
  await page.screenshot({ path: join(SHOTS, '01-papers-page-390.png'), fullPage: false });
  await page.locator('[data-ext1-sit="ext1-2027-p01"]').click();
  await page.waitForSelector('[data-paper-sitting="ext1-2027-p01"]', { timeout: 30000 });
  check('"Sit this paper in the app" opens the sitting of Practice Paper 1', (await page.locator('h1').innerText()).trim() === 'Practice Paper 1');
  check('the page says the paper is 70 marks with the paper\'s working time', (await page.locator('.pp-head').innerText()).includes('70 marks · working time 2 hours'));
  const url = new URL(page.url());
  const attemptId = url.pathname.split('/').pop();
  check('the sitting has its own address', /^[0-9a-f-]{36}$/.test(attemptId));

  // the clock: the paper's reading time first, then it can be switched off
  check('the clock shows the stated reading time (10 minutes)', /Reading time: (9|10):\d\d left/.test(await page.locator('[data-paper-timer]').innerText()));
  await page.getByRole('checkbox', { name: en['paper.timer.show'] }).uncheck();
  check('the clock can be switched off', await page.locator('[data-paper-timer]').count() === 0);

  // a diagram arrives as an image, fetched with the session
  await page.locator('[data-paper-figure="figdodec"] img').waitFor({ timeout: 20000 });
  check('a question\'s diagram loads as an image on a white sheet', await page.locator('[data-paper-figure="figdodec"] img').evaluate(i => i.naturalWidth > 20));
  await page.locator('[data-paper-question="2"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(SHOTS, '02-question-2-figure-390.png') });

  // ── Section I: click and keyboard ───────────────────────────────────────────
  // q1 wrong, q10 left blank, the rest as keyed
  for (let n = 1; n <= 9; n += 1) {
    const letter = n === 1 ? wrongOf(KEYS[0]) : KEYS[n - 1];
    const group = page.locator(`[data-paper-choice="q${n}"]`);
    if (n === 5) { // by keyboard: focus the first radio, arrow to the letter, the group is a real radio group
      await group.locator('input').first().focus();
      for (let i = 0; i < 'ABCD'.indexOf(letter); i += 1) await page.keyboard.press('ArrowDown');
      if (letter === 'A') await page.keyboard.press('Space');
    } else {
      await group.locator('label', { hasText: new RegExp(`^\\s*${letter}`) }).first().click();
    }
  }
  check('keyboard: arrow keys choose within a multiple-choice question', await page.locator('[data-paper-choice="q5"] input:checked').count() === 1);
  check('every chosen option is marked as chosen', await page.locator('.pp-choice .pp-opt.is-on').count() === 9);
  await page.locator('[data-paper-question="1"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(SHOTS, '03-section-1-390.png') });

  // ── Section II: a typed final answer and a written proof ────────────────────
  await page.locator('[data-paper-part="q11a-iii"]').scrollIntoViewIfNeeded();
  check('a part Pri can check says so before the student writes', (await page.locator('[data-paper-part="q11a-iii"] [data-paper-checks]').innerText()).includes('Pri checks the final answer here: 1 of the 3 marks'));
  check('a proof says it is self-checked and earns no automatic mark', (await page.locator('[data-paper-part="q11b-i"] [data-paper-checks]').innerText()).includes('earns no automatic mark'));
  await page.locator('[data-paper-answer="q11a-iii"] [data-final-answer]').fill('162*sqrt(58)-1044');
  await page.locator('[data-paper-answer="q11a-iii"] [data-typed-working]').fill('a^2+b^2+c^2=116 so the hypotenuse is sqrt(58)');
  await page.locator('[data-paper-part="q11b-i"]').scrollIntoViewIfNeeded();
  await page.locator('[data-paper-part="q11b-i"] [data-paper-ruled]').fill('Base case n=1: both sides are 2. Assume true for n=k and multiply both sides by 2(2k+1)/(k+1).');
  await page.screenshot({ path: join(SHOTS, '04-section-2-390.png') });
  // the Type / Write / Photo modes are one tab list, reachable by keyboard
  const typeTab = page.locator('[data-paper-part="q11b-i"] [data-paper-mode="typed"]');
  await typeTab.focus();
  await page.keyboard.press('ArrowRight');
  check('keyboard: arrow keys move between Type, Write and Photo', await page.locator('[data-paper-part="q11b-i"] [data-paper-mode="ink"]').getAttribute('aria-selected') === 'true');
  await page.keyboard.press('ArrowLeft');

  // ── Autosave, then resume ───────────────────────────────────────────────────
  await page.waitForSelector('[data-paper-save="saved"]', { timeout: 15000 });
  check('answers are saved as the student goes', true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-paper-sitting]', { timeout: 30000 });
  check('resume: the multiple-choice answers are back', await page.locator('.pp-choice .pp-opt.is-on').count() === 9);
  check('resume: the typed final answer is back', (await page.locator('[data-paper-answer="q11a-iii"] [data-final-answer]').inputValue()) === '162*sqrt(58)-1044');
  check('resume: the written proof is back', (await page.locator('[data-paper-part="q11b-i"] [data-paper-ruled]').inputValue()).startsWith('Base case n=1'));
  check('resume: the clock stays switched off', await page.locator('[data-paper-timer]').count() === 0);

  // ── Nothing secret reached the page before Submit ───────────────────────────
  const before = seen.filter(r => r.method !== 'POST' || !/\/submit$/.test(r.url));
  const leaked = secretList.filter(s => before.some(r => r.text.includes(JSON.stringify(s).slice(1, -1))));
  check('NETWORK: no key, criterion or sample answer in any response before Submit', before.length >= 4 && leaked.length === 0, `${before.length} responses; leaked: ${JSON.stringify(leaked.slice(0, 2))}`);
  check('NETWORK: the paper as issued has no key, criteria or sample field', !before.some(r => /"key"|"criteria"|"sampleAnswer"/.test(r.text)));

  // ── Submit all: the empty parts are named, once ─────────────────────────────
  await page.locator('[data-paper-submit]').click();
  await page.waitForSelector('[data-paper-confirm-empty]', { timeout: 10000 });
  const emptyText = await page.locator('[data-paper-confirm-empty]').innerText();
  check('Submit all says how many parts are empty and names them', /You have not answered \d+ parts/.test(emptyText) && emptyText.includes('Q10') && emptyText.includes('Q11a(i)'), emptyText.slice(0, 120));
  await page.screenshot({ path: join(SHOTS, '05-submit-confirm-390.png') });
  check('the student can keep working instead', await page.getByRole('button', { name: en['paper.confirm.keepWorking'] }).count() === 1);
  await page.locator('[data-paper-confirm-submit]').click();
  await page.waitForSelector('[data-paper-result]', { timeout: 30000 });

  // ── The result ──────────────────────────────────────────────────────────────
  const totals = (await page.locator('[data-paper-totals]').innerText()).trim();
  check('the honest totals line', totals === 'Marked by Pri: 9 of 20 marks available to automatic marking; 50 marks are self-checked.', totals);
  check('a wrong option is called wrong and a right one right', await page.locator('[data-paper-part="q1"] [data-paper-verdict="incorrect"]').count() === 1 && await page.locator('[data-paper-part="q2"] [data-paper-verdict="correct"]').count() === 1);
  check('the blank question says no answer', await page.locator('[data-paper-part="q10"] [data-paper-verdict="unanswered"]').count() === 1);
  check('a right final answer is marked right, by Pri, for the 1 mark it carries', (await page.locator('[data-paper-part="q11a-iii"] [data-paper-verdict]').innerText()).includes('Final answer right') && (await page.locator('[data-paper-part="q11a-iii"] .pp-verdict').innerText()).includes('1 of 1 marked by Pri'));
  check('a proof is a self-check: no mark claimed', (await page.locator('[data-paper-part="q11b-i"] [data-paper-verdict="self-check"]').innerText()).includes('Check this against the sample answer'));
  check('nothing says a guideline is awaiting approval', !/awaiting|draft|approv/i.test(await page.locator('.pp-page').innerText()));
  await page.locator('[data-paper-part="q11b-i"]').scrollIntoViewIfNeeded();
  await page.locator('[data-paper-show-sample="q11b-i"]').click();
  await page.waitForSelector('[data-paper-solution="q11b-i"]', { timeout: 15000 });
  check('the sample answer appears on demand', (await page.locator('[data-paper-solution="q11b-i"]').innerText()).includes('Sample answer'));
  await page.locator('[data-paper-how="q11b-i"] summary').click();
  await page.waitForSelector('[data-paper-how="q11b-i"] .pp-criteria li', { timeout: 15000 });
  check('"How this is marked" lists the three guideline criteria', await page.locator('[data-paper-how="q11b-i"] .pp-criteria li').count() === 3);
  check('and shows NO marks beside them (no approval record)', await page.locator('[data-paper-how="q11b-i"] .pp-crit-marks').count() === 0);
  await page.screenshot({ path: join(SHOTS, '06-result-part-390.png') });
  await page.locator('[data-paper-result]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(SHOTS, '07-result-top-390.png') });

  // ── Layout and names ────────────────────────────────────────────────────────
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('at 390 px the page does not scroll sideways', overflow <= 0, `overflow ${overflow}px`);
  check('ACCESSIBILITY: every control has a name', (await unnamedControls(page)).length === 0, JSON.stringify(await unnamedControls(page)));
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(SHOTS, '08-result-desktop.png') });
  console.log(`  screenshots: ${SHOTS}`);
} catch (error) {
  failures.push(`the tour stopped: ${error.message.split('\n')[0]}`);
  console.error(error);
} finally {
  await browser?.close().catch(() => {});
  await platform?.close?.().catch(() => {});
  if (dist) rmSync(dist, { recursive: true, force: true });
}

if (failures.length) {
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(`PAPER SITTING TOUR: FAIL — ${failures.length} failed, ${pass} passed`);
  process.exit(1);
}
console.log(`PAPER SITTING TOUR: PASS — ${pass}/${pass} checks — a free Extension 1 student sits Practice Paper 1 in the app: Section I by click and keyboard, a typed final answer and a written proof, autosave and resume, nothing secret before Submit, the honest totals line and per-part feedback. [SYNTHETIC student]`);
