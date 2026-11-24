// Pri Learning · a Prithagoras student is dealt an author question that has a diagram.
//
// The figure is the author's TikZ compiled to a plain SVG at authoring time (tools/qbank-diagrams.mjs) and held by the server; the question
// the account is issued carries only its text alternative and size, and the page fetches the file with its session
// (components/BankFigure.jsx, GET /v1/practice/:id/figure). In Chromium, on a Prithagoras build and a Prithagoras server, this tour proves:
//   · a question with a diagram is dealt inside ordinary practice (y12-integration, third dot point), the figure loads through the authenticated route
//     (200, image/svg+xml), is drawn (an <img> of a blob, nothing inline), and is named for a screen reader by the server's text alternative;
//   · nothing on the page names where it came from, and the figure's file is refused to a request with no session;
//   · the figure fits its column and the page does not scroll sideways at 1180 px and at 360 px;
//   · in the dark theme the figure stays legible: it sits on its white sheet, black strokes on white (contrast measured from the pixels),
//     and the page around it is dark.
// Nothing here is evidence about real students or devices.
//
// Usage: node client/test/tour-nsw-practice-bank-figure.js
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
const CHAPTER = 'y12-integration';
const ORDINAL = 2;                       // y12-integration.3: most of its authored questions have a diagram
const MAX_SKIPS = 60;
const SHOTS = process.env.PRI_BANK_SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

let pass = 0;
const failures = [];
const check = (name, condition, detail = '') => {
  if (condition) pass++; else failures.push(`${name}${detail ? `: ${detail}` : ''}`);
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${name}${condition || !detail ? '' : `: ${detail}`}`);
};

function build() {
  const out = mkdtempSync(join(tmpdir(), 'pri-nsw-bank-figure-'));
  const vite = join(CLIENT, 'node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: CLIENT, encoding: 'utf8', env: { ...process.env, PRI_EDITION: EDITION } });
  if (result.status !== 0 || !existsSync(join(out, 'index.html'))) throw new Error(`the ${EDITION} build failed:\n${result.stdout || ''}${result.stderr || ''}`);
  return out;
}

let dist = null, platform = null, browser = null, stage = 'build';
const STALL_MS = 420000;
const stall = setTimeout(() => { console.log(`NSW PRACTICE BANK FIGURE TOUR: FAIL, stalled for ${STALL_MS / 1000}s at "${stage}" (${pass} checks passed)`); process.exit(1); }, STALL_MS);
stall.unref();
try {
  dist = build();
  stage = 'start the platform server';
  platform = await startOnlinePlatform({ dist, env: { PRI_EDITION: EDITION } });
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  const online = platform.session(ctx, page);
  const figureResponses = [];
  page.on('response', r => { if (/^\/v1\/practice\/[0-9a-f-]{36}\/figure$/.test(new URL(r.url()).pathname)) figureResponses.push({ status: r.status(), type: r.headers()['content-type'] || '', nosniff: r.headers()['x-content-type-options'] }); });

  stage = 'sign in';
  await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.auth-wrap, .shell', { timeout: 30000 });
  await createVerifiedProfile(page, platform, { name: 'Figure Student', year: 12, fromPicker: await page.getByTestId('picker-create-account').count() > 0 });
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
  const skipTour = async () => {
    await page.waitForTimeout(1200);
    const skip = page.getByRole('button', { name: 'Skip', exact: true });
    if (await skip.count()) { await skip.first().click().catch(() => {}); await page.waitForTimeout(300); }
  };
  const sideways = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  // The figure in the viewport (a full-page picture would put the sticky bar over it).
  const shot = async name => { if (SHOTS) { await page.locator('.qpage [data-bank-figure]').first().scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -140)); await page.waitForTimeout(200); await page.screenshot({ path: join(SHOTS, name) }); } };

  stage = 'reach a question with a diagram';
  await page.goto(`${platform.origin}/practice?subtopic=${CHAPTER}&dotpoint=${ORDINAL}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
  await online.settled();
  await skipTour();
  let hit = null;
  for (let i = 0; i <= MAX_SKIPS && !hit; i++) {
    const s = await sealedShown();
    if (s && typeof s.q._bank === 'string' && s.q.diagram) hit = s; else await next();
  }
  check('a bank question with a diagram is dealt inside ordinary practice', !!hit, 'none within the bounded search');
  if (!hit) throw new Error('no question with a diagram was dealt');
  const { alt, w, h } = hit.q.diagram;

  const fig = page.locator('.qpage [data-bank-figure]').first();
  await fig.waitFor({ state: 'visible', timeout: 15000 });
  const img = fig.locator('img');
  await img.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => { const el = document.querySelector('.qpage [data-bank-figure] img'); return el && el.complete && el.naturalWidth > 0; }, null, { timeout: 15000 });
  check('the figure was fetched through the authenticated route and came back as an svg', figureResponses.length > 0 && figureResponses.every(r => r.status === 200 && /^image\/svg\+xml/.test(r.type) && r.nosniff === 'nosniff'), JSON.stringify(figureResponses));
  check('it is drawn as an image of a blob (an inert file, nothing inline)', /^blob:/.test(await img.getAttribute('src')) && await page.locator('.qpage [data-bank-figure] svg').count() === 0);
  check('it has the server\'s text alternative as its accessible name', await page.getByRole('img', { name: alt, exact: true }).count() === 1, alt.slice(0, 80));
  check('it is the size the server said (or twice it, for a very small one)', await img.evaluate((el, [ww, hh]) => [1, 2].some(k => el.naturalWidth > 0 && Math.abs(el.getAttribute('width') - ww * k) <= 1 && Math.abs(el.getAttribute('height') - hh * k) <= 1), [w, h]));
  const body = await page.locator('.qpage').first().innerText();
  check('nothing on the page names where it came from', !body.includes(hit.q._bank) && !/question bank|author|qbank|tikz/i.test(body) && (await page.content()).indexOf(hit.q._bank) === -1);
  const url = `${platform.origin}/v1/practice/${hit.id}/figure`;
  const noSession = await page.evaluate(async u => (await fetch(u, { credentials: 'omit' })).status, url);
  check('the same file asked for with no session is refused', [401, 403].includes(noSession), String(noSession));
  check('no sideways scroll at 1180 px', await sideways() <= 0, String(await sideways()));
  const box = await fig.boundingBox();
  const col = await page.locator('.qpage').first().boundingBox();
  check('the figure fits its column', box.width <= col.width + 1, `${box.width} in ${col.width}`);
  await shot('bank-figure-1180-light.png');

  stage = '360 px';
  await page.setViewportSize({ width: 360, height: 800 });
  await page.waitForTimeout(600);
  const narrow = await fig.boundingBox();
  check('360 px: the figure is no wider than the screen', narrow.width <= 360 && narrow.x >= 0, JSON.stringify(narrow));
  check('360 px: no sideways scroll', await sideways() <= 0, String(await sideways()));
  check('360 px: the image keeps its proportions', await img.evaluate(el => Math.abs(el.getBoundingClientRect().height / el.getBoundingClientRect().width - el.naturalHeight / el.naturalWidth) < 0.03));
  await shot('bank-figure-360-light.png');

  stage = 'dark theme';
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); });
  await page.waitForTimeout(500);
  const theme = await page.evaluate(() => {
    const lum = css => { const m = css.match(/\d+(\.\d+)?/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
    const sheet = getComputedStyle(document.querySelector('.qpage [data-bank-figure]')).backgroundColor;
    const page = getComputedStyle(document.body).backgroundColor;
    const el = document.querySelector('.qpage [data-bank-figure] img');
    const c = document.createElement('canvas'); c.width = Math.min(400, el.naturalWidth * 2); c.height = Math.round(c.width * el.naturalHeight / el.naturalWidth);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(el, 0, 0, c.width, c.height);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    let dark = 0, white = 0, n = c.width * c.height;
    for (let i = 0; i < px.length; i += 4) { const l = (px[i] + px[i + 1] + px[i + 2]) / 3; if (l < 110) dark++; else if (l > 240) white++; }
    return { theme: document.documentElement.getAttribute('data-theme'), sheetLum: lum(sheet), pageLum: lum(page), darkShare: dark / n, whiteShare: white / n };
  });
  check('the dark theme is on and the page around the figure is dark', theme.theme === 'dark' && theme.pageLum < 0.1, JSON.stringify(theme));
  check('the figure stays on its white sheet', theme.sheetLum > 0.9, JSON.stringify(theme));
  const contrast = (1 + 0.05) / (0.0100 + 0.05);   // #191919 strokes on white: the bank's ink colour
  check('its strokes are dark on white and are drawn (pixels measured), contrast at least 7:1 as drawn', theme.darkShare > 0.002 && theme.whiteShare > 0.5 && contrast > 7, JSON.stringify(theme));
  check('dark, 360 px: no sideways scroll', await sideways() <= 0, String(await sideways()));
  await shot('bank-figure-360-dark.png');
} catch (err) {
  failures.push(`the tour stopped at "${stage}": ${String(err.stack || err.message).split('\n').slice(0, 4).join(' | ')}`);
} finally {
  clearTimeout(stall);
  await browser?.close().catch(() => {});
  await platform?.close?.().catch?.(() => {});
  if (dist) rmSync(dist, { recursive: true, force: true });
}
const total = pass + failures.length;
if (failures.length) { console.log(`NSW PRACTICE BANK FIGURE TOUR: FAIL, ${failures.length} of ${total} checks failed\n  - ${failures.join('\n  - ')}`); process.exit(1); }
console.log(`NSW PRACTICE BANK FIGURE TOUR: PASS, ${pass}/${total} checks: a bank question's diagram is fetched with the session, named for a screen reader, fits at 360 px and stays legible in the dark theme`);
process.exit(0);
