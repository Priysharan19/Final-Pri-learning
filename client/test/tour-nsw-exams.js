// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · an NSW HSC-style paper, sat in the browser (plan G4)
//
// Builds the client for Prithagoras with PRI_FEATURE_NSW_EXAMS=1, serves it
// from the real platform server running as Prithagoras with PRI_NSW_EXAMS=on,
// signs a Year 12 NSW student in and sits a paper end to end:
//
//   · the Exams page lists the five blueprints with their time and marks; on
//     G3's pool Extension 1 and 2 release as PARTIAL papers ("Practice paper —
//     N of M Year 12 outcomes", marks and time scaled, omissions named) and a
//     refused paper says how much it covers and what it lacks, with no start;
//   · the test paper (PRI_NSW_EXAMS_TEST_BLUEPRINT=on, honoured only under
//     NODE_ENV=test; one minute of reading) releases partially on G3's real
//     pool and starts; its start screen and result name what it omits;
//   · READING TIME: the room shows the paper and a reading-time notice, every
//     answer control is disabled, nothing is sent to the server, and the
//     reading state passes an accessibility check on Chrome's own tree;
//   · WORKING TIME: the controls open, an answer is typed, the paper is
//     submitted and marked by the server;
//   · the result says "Answer-checked practice paper" and that only final
//     answers were checked, and shows no band, ATAR, HSC mark or prediction.
//
// WHAT IS REAL: the built Prithagoras client, the platform server and its
// SQLite database, the account, G3's approved NSW forms and the server's
// marking. WHAT IS SYNTHETIC: the test paper (a short blueprint that cites no
// NESA specification and says so) and the student. The released Extension
// papers are listed, not sat: their ten minutes of reading would only slow
// the tour; the HTTP suite seals both.
//
// Run:  node client/test/tour-nsw-exams.js
// ─────────────────────────────────────────────────────────────────────────────
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
const TEST_PAPER = 'nsw-test-extension-1-short';
const HSC_PAPERS = ['nsw-hsc-standard-1-2027', 'nsw-hsc-standard-2-2027', 'nsw-hsc-advanced-2027', 'nsw-hsc-extension-1-2027', 'nsw-hsc-extension-2-2027'];
const en = (await import('../src/i18n/strings.en.js')).default;
const BANDISH = /\bband\s*\d|\bATAR\b|\bHSC mark\b|\bpredicted\b|\bstate (mean|average)\b/i;

let pass = 0;
const failures = [];
const check = (name, condition, detail = '') => {
  if (condition) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`  ${condition ? '✓' : '✗'} ${name}${condition || !detail ? '' : ` — ${detail}`}`);
};

function build() {
  const out = mkdtempSync(join(tmpdir(), 'pri-nsw-exams-'));
  const vite = join(CLIENT, 'node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: CLIENT, encoding: 'utf8', env: { ...process.env, PRI_EDITION: EDITION, PRI_FEATURE_NSW_EXAMS: '1' } });
  if (result.status !== 0 || !existsSync(join(out, 'index.html'))) throw new Error(`the ${EDITION} build failed:\n${result.stdout || ''}${result.stderr || ''}`);
  return out;
}

const visibleText = (page, selector) => page.evaluate(sel => [...document.querySelectorAll(sel)]
  .filter(el => el.getClientRects().length > 0).map(el => el.innerText).join(' ').replace(/\s+/g, ' ').trim(), selector);

/** Interactive nodes on Chrome's accessibility tree with no usable name. */
async function unnamedControls(page) {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  await cdp.detach();
  const ROLES = new Set(['button', 'textbox', 'link', 'combobox', 'checkbox', 'radio', 'switch', 'tab', 'menuitem', 'spinbutton', 'slider']);
  return nodes.filter(n => !n.ignored && ROLES.has(n.role?.value)).filter(n => {
    const name = (n.name?.value || '').trim();
    const used = (n.name?.sources || []).find(s => s.value?.value && !s.superseded && !s.invalid);
    return !name || used?.attribute === 'title' || !/[\p{L}\p{N}]/u.test(name);
  }).map(n => `${n.role.value}:${(n.name?.value || '').slice(0, 30)}`);
}

let dist = null;
let platform = null;
let browser = null;
try {
  dist = build();
  const features = JSON.parse(readFileSync(join(dist, 'features.json'), 'utf8'));
  check('the build under test is the Prithagoras build with NSW papers on', features.edition === EDITION && features.nswExams === true, JSON.stringify(features));
  platform = await startOnlinePlatform({ dist, allowSeededPractice: true, env: { PRI_EDITION: EDITION, PRI_NSW_EXAMS: 'on', PRI_NSW_EXAMS_TEST_BLUEPRINT: 'on' } });
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await ctx.newPage();
  const answerWrites = [];
  page.on('response', response => {
    const url = new URL(response.url());
    if (/^\/v1\/exams\/[^/]+\/(answers|finish)$/.test(url.pathname)) answerWrites.push({ at: Date.now(), path: url.pathname, status: response.status() });
  });

  await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.auth-wrap, .shell', { timeout: 30000 });
  await createVerifiedProfile(page, platform, { name: 'NSW Paper Student', year: 12, fromPicker: await page.getByTestId('picker-create-account').count() > 0 });
  await switchSyllabus(page, platform, { course: 'nsw', year: 12 });

  // ── The list ──────────────────────────────────────────────────────────────
  await page.goto(`${platform.origin}/exams`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-nsw-papers] [data-nsw-paper]', { timeout: 30000 });
  const listed = await page.locator('[data-nsw-paper]').evaluateAll(els => els.map(el => [el.getAttribute('data-nsw-paper'), el.getAttribute('data-released')]));
  check('the Exams page lists the five HSC-style papers and the test paper', HSC_PAPERS.every(id => listed.some(([x]) => x === id)) && listed.some(([x]) => x === TEST_PAPER), JSON.stringify(listed));
  const state = id => listed.find(([x]) => x === id)?.[1];
  check('on G3\'s pool Extension 1 and 2 release as partial papers; Standard and Advanced are refused; the test paper releases',
    state('nsw-hsc-extension-1-2027') === 'yes' && state('nsw-hsc-extension-2-2027') === 'yes' && ['nsw-hsc-standard-1-2027', 'nsw-hsc-standard-2-2027', 'nsw-hsc-advanced-2027'].every(id => state(id) === 'no') && state(TEST_PAPER) === 'yes', JSON.stringify(listed));
  const adv = await visibleText(page, '[data-nsw-paper="nsw-hsc-advanced-2027"]');
  check('a refused paper says how much it covers and names what it lacks, and has no start', adv.includes('4 of 8 Year 12 outcomes') && adv.includes('Financial mathematics')
    && await page.locator('[data-nsw-paper="nsw-hsc-advanced-2027"] [data-nsw-start]').count() === 0, adv);
  const ext1 = await visibleText(page, '[data-nsw-paper="nsw-hsc-extension-1-2027"]');
  check('a partial paper is titled by its coverage, never HSC or trial', ext1.includes('Practice paper — 5 of 6 Year 12 outcomes') && !/HSC paper|trial/i.test(ext1), ext1);
  check('it names what it leaves out', (await visibleText(page, '[data-nsw-paper="nsw-hsc-extension-1-2027"] [data-nsw-omits]')).includes('Further calculus skills'), ext1);
  check('its time and marks are scaled to what it examines', ext1.includes('10 min reading') && ext1.includes('100 min working') && ext1.includes('58 marks'), ext1);
  const intro = await visibleText(page, '[data-nsw-papers]');
  check('the list says these are answer-checked practice papers, final answer only, no band', intro.includes(en['exams.nsw.intro']), intro.slice(0, 200));

  // ── Reading time ──────────────────────────────────────────────────────────
  await page.locator(`[data-nsw-start="${TEST_PAPER}"]`).click();
  await page.waitForURL(/\/exams\/[0-9a-f-]{36}$/, { timeout: 30000 });
  await page.waitForSelector('[data-exam-reading-time]', { timeout: 30000 });
  const startedAt = Date.now();
  const head = await visibleText(page, '.exam-head');
  check('the paper opens under the server\'s title, with its coverage', head.includes('Practice paper — 5 of 6 Year 12 outcomes') && !/HSC paper|trial/i.test(head), head.slice(0, 160));
  check('its start screen names what it leaves out', (await visibleText(page, '[data-exam-reading-time] [data-exam-nsw-omits]')).includes('Further calculus skills'));
  check('a reading-time notice is shown, as a status', (await page.locator('[data-exam-reading-time]').getAttribute('role')) === 'status'
    && (await visibleText(page, '[data-exam-reading-time]')).includes('Reading time'));
  check('the question is there to read', (await visibleText(page, '.exam-body')).length > 40);
  const controls = page.locator('.exam-body input, .exam-body textarea, .exam-body button.btn-sm[aria-pressed], .exam-body .mcq-opt, .exam-head button.btn-ghost');
  const enabled = await controls.evaluateAll(els => els.filter(el => !el.disabled).map(el => el.outerHTML.slice(0, 80)));
  check('every answer control and the submit button are disabled', (await controls.count()) > 0 && enabled.length === 0, JSON.stringify(enabled));
  const unnamed = await unnamedControls(page);
  check('ACCESSIBILITY (reading time): every control is named, never by a tooltip alone', unnamed.length === 0, JSON.stringify(unnamed));
  check('ACCESSIBILITY (reading time): the room has its heading', await page.locator('h1').count() >= 1);
  await page.waitForTimeout(4000);
  check('nothing is written to the server during reading time', answerWrites.length === 0, JSON.stringify(answerWrites));

  // ── Working time ──────────────────────────────────────────────────────────
  await page.waitForSelector('[data-exam-reading-time]', { state: 'detached', timeout: 90000 });
  check('reading time ends after about a minute', Date.now() - startedAt < 75000);
  const input = page.locator('.answer-row input.answer-input').first();
  if (await input.count()) {
    await input.waitFor({ state: 'visible', timeout: 10000 });
    check('the answer box opens when working time starts', await input.isEnabled());
    await input.fill('3');
  } else {
    const option = page.locator('.exam-body button:not([disabled])').first();
    check('the options open when working time starts', await option.count() > 0);
    await option.click();
  }
  await page.waitForTimeout(2500);
  check('the answer is saved to the server in working time', answerWrites.some(w => w.path.endsWith('/answers') && w.status === 200), JSON.stringify(answerWrites));
  await page.locator('.exam-head').getByRole('button', { name: en['exam.reviewSubmit'] }).click();
  await page.locator('[role="dialog"]').getByRole('button', { name: en['exam.submitPaper'] }).click();

  // ── The result ────────────────────────────────────────────────────────────
  await page.waitForSelector('[data-exam-nsw-note]', { timeout: 60000 });
  const result = await visibleText(page, 'main');
  check('the result is an answer-checked practice paper, checked on final answers only', result.includes(en['examRoom.nswMarkingNote']), result.slice(0, 300));
  check('the result gives a score out of the paper\'s 7 kept marks', /of 7\b|\/\s*7\b|out of 7/.test(result), result.slice(0, 300));
  check('the result names what the paper did not include', (await visibleText(page, '[data-exam-nsw-omits]')).includes('Further calculus skills'));
  check('the result shows no band, ATAR, HSC mark or prediction', !BANDISH.test(result.replace(en['examRoom.nswMarkingNote'], '').replace(en['exams.nsw.intro'], '')), (result.match(BANDISH) || [])[0]);
  check('the paper was finished on the server', answerWrites.some(w => w.path.endsWith('/finish') && w.status === 200), JSON.stringify(answerWrites));
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
  console.error(`NSW PAPERS TOUR (G4): FAIL — ${failures.length} failed, ${pass} passed`);
  process.exit(1);
}
console.log(`NSW PAPERS TOUR (G4): PASS — ${pass}/${pass} checks — a Prithagoras student lists the HSC-style papers, sits the test paper through server-owned reading time (inputs disabled, nothing sent, accessible) and working time, and reads an answer-checked result with no band. [SYNTHETIC student and test paper]`);
