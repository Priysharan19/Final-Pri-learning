// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Extension 1 practice papers on the Prithagoras Exams page
//
// Builds the client for Prithagoras, serves it from the real platform server
// running as Prithagoras, signs a Year 12 NSW student in and checks the
// "Extension 1 practice papers" section:
//
//   · an Extension 1 Year 12 profile on the FREE plan sees the section, the
//     not-NESA line and thirteen rows (Practice Paper 01-13). Paper 01 is
//     the free sample and downloads; Paper 02 is locked with the Premium
//     prompt and no download button;
//   · every control has an accessible name on Chrome's own tree, and the page
//     does not scroll sideways at 360 px;
//   · once the server's own entitlement row says Premium, all thirteen unlock and a
//     non-sample paper and its guidelines download byte for byte;
//   · the same student on the Advanced pathway, and on Year 10, sees nothing.
//
// WHAT IS REAL: the built Prithagoras client, the platform server and its
// SQLite database, the owner's PDFs. WHAT IS SYNTHETIC: the student and the
// Premium entitlement row (written straight to the test database).
//
// Run:  node client/test/tour-ext1-papers.js
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startOnlinePlatform } from './support/online-session.mjs';
import { createVerifiedProfile, switchSyllabus } from './support/verified-onboarding.mjs';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAPERS = join(CLIENT, '..', 'server', 'content', 'papers', 'nsw-ext1');
const EDITION = 'prithagoras';
const en0 = (await import('../src/i18n/strings.en.js')).default;
// owner decision, 19 Nov 2026: the Prithagoras screen names the paid tier "HSC Pass" (its en-AU overrides), so the text it shows is read from them.
const { AU_STRINGS } = await import('../src/i18n/strings.au.js');
const en = { ...en0, ...AU_STRINGS };
const manifest = JSON.parse(readFileSync(join(PAPERS, 'manifest.json'), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const DAY = 86_400_000;

let pass = 0;
const failures = [];
const check = (name, condition, detail = '') => {
  if (condition) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`  ${condition ? '✓' : '✗'} ${name}${condition || !detail ? '' : ` — ${detail}`}`);
};

function build() {
  const out = mkdtempSync(join(tmpdir(), 'pri-ext1-papers-'));
  const vite = join(CLIENT, 'node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: CLIENT, encoding: 'utf8', env: { ...process.env, PRI_EDITION: EDITION } });
  if (result.status !== 0 || !existsSync(join(out, 'index.html'))) throw new Error(`the ${EDITION} build failed:\n${result.stdout || ''}${result.stderr || ''}`);
  return out;
}

/** Interactive nodes on Chrome's accessibility tree with no usable name. */
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

async function openExams(platform, page) {
  await page.goto(`${platform.origin}/exams`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.grid.cols-2', { timeout: 30000 });
}

let dist = null;
let platform = null;
let browser = null;
try {
  dist = build();
  const features = JSON.parse(readFileSync(join(dist, 'features.json'), 'utf8'));
  check('the build under test is the Prithagoras build', features.edition === EDITION, JSON.stringify(features));
  platform = await startOnlinePlatform({ dist, allowSeededPractice: true, env: { PRI_EDITION: EDITION } });
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, acceptDownloads: true });
  const page = await ctx.newPage();

  await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.auth-wrap, .shell', { timeout: 30000 });
  const made = await createVerifiedProfile(page, platform, { name: 'Ext One Student', year: 12, fromPicker: await page.getByTestId('picker-create-account').count() > 0 });
  await switchSyllabus(page, platform, { course: 'nsw', year: 12 });

  // ── The Advanced pathway sees nothing ───────────────────────────────────────
  await openExams(platform, page);
  await page.waitForTimeout(1500);
  check('an NSW Year 12 Advanced profile has no Extension 1 papers section', await page.locator('[data-ext1-papers]').count() === 0);

  // ── Extension 1, Year 12, free plan ─────────────────────────────────────────
  await setProfile(platform, page, { year: 12, pathway: 'Extension 1' });
  await openExams(platform, page);
  await page.waitForSelector('[data-ext1-papers] [data-ext1-paper]', { timeout: 30000 });
  const section = page.locator('[data-ext1-papers]');
  check('the section is titled "Extension 1 practice papers"', (await section.locator('h2').textContent()) === en['papers.ext1.heading']);
  check('it says the papers are original, not NESA examinations, and marked with the guidelines', (await section.locator('[data-ext1-papers-note]').innerText()).trim() === 'Original practice papers written for Prithagoras. Not NESA examinations. Printed papers are marked by you or your teacher with the marking guidelines.');
  const ids = await page.locator('[data-ext1-paper]').evaluateAll(els => els.map(el => el.getAttribute('data-ext1-paper')));
  check('a row for every paper, in order', JSON.stringify(ids) === JSON.stringify(manifest.papers.map(p => p.id)), JSON.stringify(ids));
  const sampleP = manifest.papers[0];
  const lockedP = manifest.papers[1];
  check('the manifest ships Practice Papers 01-13, Paper 01 the only sample',
    JSON.stringify(manifest.papers.map(p => p.id)) === JSON.stringify(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13'].map(n => `ext1-2027-p${n}`))
    && JSON.stringify(manifest.papers.filter(p => p.sample).map(p => p.id)) === JSON.stringify([sampleP.id]));
  const rowText = async p => (await page.locator(`[data-ext1-paper="${p.id}"]`).textContent()).replace(/\s+/g, ' ');
  const sampleText = await rowText(sampleP);
  check('the Paper 01 row says "70 marks · 2 hours · 19 pages"', sampleText.includes('70 marks · 2 hours · 19 pages'), sampleText);
  check('on the free plan Paper 01 is unlocked with both buttons and the other twelve are locked',
    await page.locator(`[data-ext1-paper="${sampleP.id}"]`).getAttribute('data-locked') === 'no'
    && await page.locator('[data-ext1-paper][data-locked="no"]').count() === 1 && await page.locator('[data-ext1-paper][data-locked="yes"]').count() === 12
    && await page.getByRole('button', { name: 'Download Practice Paper 01, paper (PDF)' }).count() === 1
    && await page.getByRole('button', { name: 'Download Practice Paper 01, marking guidelines (PDF)' }).count() === 1
    && await page.locator('[data-ext1-papers] button').count() === 2);
  check('a locked row (Paper 02) shows the Premium prompt, a link to Premium and no download button',
    await page.locator(`[data-ext1-paper="${lockedP.id}"] button`).count() === 0
    && await page.locator('[data-premium-gate="ext1-papers"]').count() >= 1 && await page.getByRole('link', { name: en['papers.ext1.seePremium'] }).count() >= 1);
  const [freePaper] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator(`[data-ext1-download="${sampleP.id}:paper"]`).click()]);
  check('the free account downloads Paper 01, byte for byte', sha(readFileSync(await freePaper.path())) === sampleP.paper.sha256 && freePaper.suggestedFilename() === 'Prithagoras-Ext1-Practice-Paper-01.pdf', freePaper.suggestedFilename());
  check('ACCESSIBILITY: every control on the page has a name', (await unnamedControls(page)).length === 0, JSON.stringify(await unnamedControls(page)));

  // ── 360 px ──────────────────────────────────────────────────────────────────
  await page.setViewportSize({ width: 360, height: 780 });
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('at 360 px the page does not scroll sideways', overflow <= 0, `overflow ${overflow}px`);
  const clipped = await page.locator('[data-ext1-papers] button').evaluateAll(els => els.filter(el => { const r = el.getBoundingClientRect(); return r.right > window.innerWidth + 0.5 || r.left < -0.5; }).length);
  check('at 360 px no button runs off the screen', clipped === 0, `${clipped} clipped`);
  await page.setViewportSize({ width: 1180, height: 820 });

  // ── Premium ─────────────────────────────────────────────────────────────────
  const now = Date.now();
  platform.h.db.prepare("INSERT INTO entitlement_snapshots(account_id,plan,status,provider,current_period_end,updated_at) VALUES (?,'premium','active','web',?,?) ON CONFLICT(account_id) DO UPDATE SET plan='premium',status='active',provider='web',current_period_end=excluded.current_period_end")
    .run(made.accountId, now + 30 * DAY, now);
  await openExams(platform, page);
  await page.waitForSelector('[data-ext1-paper]', { timeout: 30000 });
  const listed = await page.locator('[data-ext1-paper]').evaluateAll(els => els.map(el => [el.getAttribute('data-ext1-paper'), el.getAttribute('data-locked')]));
  check('with Premium all thirteen papers are listed and unlocked, with no Premium prompt',
    listed.length === 13 && listed.every(([, l]) => l === 'no') && await page.locator('[data-premium-gate="ext1-papers"]').count() === 0
    && await page.locator('[data-ext1-papers] button').count() === 26, JSON.stringify(listed));
  const first = manifest.papers.find(p => p.id === 'ext1-2027-p13');
  check('Paper 13 offers both buttons with the catalogue\'s names', await page.getByRole('button', { name: 'Download Practice Paper 13, paper (PDF)' }).count() === 1
    && await page.getByRole('button', { name: 'Download Practice Paper 13, marking guidelines (PDF)' }).count() === 1);
  check('the visible button text is the catalogue\'s', (await page.locator(`[data-ext1-download="${first.id}:paper"]`).innerText()) === en['papers.ext1.paper']
    && (await page.locator(`[data-ext1-download="${first.id}:guidelines"]`).innerText()) === en['papers.ext1.guidelines']);
  const [paid] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator(`[data-ext1-download="${first.id}:paper"]`).click()]);
  check('a non-sample paper downloads, byte for byte', sha(readFileSync(await paid.path())) === first.paper.sha256 && paid.suggestedFilename() === 'Prithagoras-Ext1-Practice-Paper-13.pdf', paid.suggestedFilename());
  const [guide] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator(`[data-ext1-download="${first.id}:guidelines"]`).click()]);
  check('and its marking guidelines', sha(readFileSync(await guide.path())) === first.guidelines.sha256 && guide.suggestedFilename().endsWith('-Marking-Guidelines.pdf'));
  check('ACCESSIBILITY (Premium): every control on the page has a name', (await unnamedControls(page)).length === 0, JSON.stringify(await unnamedControls(page)));

  // ── Advanced sees nothing, in either offered year ───────────────────────────
  // (owner decision, 19 Nov 2026: Prithagoras offers Years 11 and 12 only, so Year 10 is no longer a choice.)
  await setProfile(platform, page, { year: 11, pathway: 'Advanced' });
  await openExams(platform, page);
  await page.waitForTimeout(1500);
  check('an NSW Year 11 Advanced profile has no Extension 1 papers section', await page.locator('[data-ext1-papers]').count() === 0);
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
  console.error(`EXT1 PAPERS TOUR: FAIL — ${failures.length} failed, ${pass} passed`);
  process.exit(1);
}
console.log(`EXT1 PAPERS TOUR: PASS — ${pass}/${pass} checks — a Prithagoras Extension 1 Year 12 student sees thirteen practice papers (Paper 01 free, the rest locked on the free plan, all unlocked on Premium), downloads the owner's PDFs, and other pathways see nothing. [SYNTHETIC student and entitlement]`);
