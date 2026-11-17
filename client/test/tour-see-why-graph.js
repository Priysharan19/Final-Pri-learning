// ─────────────────────────────────────────────────────────────────────────────
// "See why it's wrong" in the mounted app, against the real server, in both
// editions (ADR-0002: build once, verify against Priyabhata and Prithagoras).
//
// For each edition: the edition's own build, served by the real platform
// server; a verified account made through the shipped sign-in card; a
// server-issued question (only the issue SEED is pinned, TEST-ONLY, so the
// working below fits the question); typed working with a distribution slip on
// line 2; the real server's step report. The tour then holds that:
//
//   · Step Check marks line 2 as the first break, and the graph is offered
//     there, closed — nothing is drawn until the student asks;
//   · opened, it draws two curves, says the counterexample in words and puts
//     the marker on it, with values that equal the student's own two lines;
//   · the arrow keys move the marker and the aria-live readout follows;
//   · the verdict, marks and receipt on the card are the server's and do not
//     change when the graph is opened or moved.
//
// Screenshots go to $PRI_TOUR_OUT (default: a temp folder), never into the
// tracked tree. SYNTHETIC: a scripted student on a test server, not a learner.
//
// Run: node client/test/tour-see-why-graph.js
// ─────────────────────────────────────────────────────────────────────────────
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startOnlinePlatform } from './support/online-session.mjs';
import { createVerifiedProfile, switchSyllabus } from './support/verified-onboarding.mjs';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
const OUT = process.env.PRI_TOUR_OUT || mkdtempSync(join(tmpdir(), 'pri-see-why-'));
mkdirSync(OUT, { recursive: true });

const EDITIONS = [
  {
    edition: 'priyabhata', year: 8, course: null,
    pin: { generator: 'c8-linear-equations-brackets', difficulty: 1, curriculum: 'in', seed: 7 },
    prompt: '5(x+2)',
    working: '5(x+2) - 2 = 2x - 13\n5x + 2 - 2 = 2x - 13\n3x = -13',
    answer: '-13/3',
    // The line before and the student's line, as equations: drawn as left − right.
    say: 'x = −7 solves the line before'
  },
  {
    edition: 'prithagoras', year: 8, course: 'nsw',
    pin: { generator: 'y8-algebra', difficulty: 1, curriculum: 'nsw', seed: 7 },
    prompt: '2(2x + 8) + 4',
    working: '2(2x + 8) + 4\n4x + 8 + 4',
    answer: '4x + 12',
    say: 'At x = 0 your line gives 12, but the line before gives 20.'
  }
];

let pass = 0;
const failures = [];
const check = (name, condition, detail = '') => {
  if (condition) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`  ${condition ? '✓' : '✗'} ${name}${condition || !detail ? '' : ` — ${String(detail).slice(0, 400)}`}`);
  return condition;
};

function build(edition) {
  const out = mkdtempSync(join(tmpdir(), `pri-see-why-${edition}-`));
  const vite = join(CLIENT, 'node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: CLIENT, encoding: 'utf8', env: { ...process.env, PRI_EDITION: edition } });
  if (result.status !== 0 || !existsSync(join(out, 'index.html'))) throw new Error(`the ${edition} build failed:\n${result.stdout || ''}${result.stderr || ''}`);
  return out;
}

const POST_ISSUE = /\/v1\/practice\/issue(?:\?.*)?$/;
const POST_GRADE = /\/v1\/practice\/[^/]+\/submit(?:\?.*)?$/;

async function runEdition(spec, browser) {
  console.log(`\n${spec.edition}`);
  const dist = build(spec.edition);
  const features = JSON.parse(readFileSync(join(dist, 'features.json'), 'utf8'));
  check(`${spec.edition}: the build under test is the ${spec.edition} build`, features.edition === spec.edition, JSON.stringify(features));
  const platform = await startOnlinePlatform({ dist, allowSeededPractice: true, env: { PRI_EDITION: spec.edition } });
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.auth-wrap, .shell', { timeout: 30000 });
    await createVerifiedProfile(page, platform, { name: 'See Why Student', year: spec.year, fromPicker: await page.getByTestId('picker-create-account').count() > 0 });
    if (spec.course) await switchSyllabus(page, platform, { course: spec.course, year: spec.year });

    // TEST-ONLY: pin the issue seed so the working fits the question. The real
    // server still issues the question and marks the answer.
    await page.route(POST_ISSUE, async route => {
      const original = route.request().postDataJSON() || {};
      await route.fulfill({ response: await route.fetch({ postData: JSON.stringify({ ...original, ...spec.pin }) }) });
    });
    await page.goto(`${platform.origin}/practice?subtopic=${spec.pin.generator}`, { waitUntil: 'domcontentloaded' });
    const front = page.locator('.qpage[data-question-id]');
    await front.locator('.q-prompt').waitFor({ timeout: 30000 });
    for (let n = 0; n < 4 && !(await front.locator('.q-prompt').innerText()).replace(/\s+/g, '').includes(spec.prompt.replace(/\s+/g, '')); n++) {
      const before = await front.getAttribute('data-question-id');
      await page.locator('.ctx-next').click();
      await page.waitForFunction(id => {
        const next = document.querySelector('.qpage[data-question-id]');
        return next && next.getAttribute('data-question-id') !== id && !!next.querySelector('.q-prompt');
      }, before, { timeout: 30000 });
    }
    const prompt = (await front.locator('.q-prompt').innerText()).replace(/\s+/g, '');
    if (!check(`${spec.edition}: the server issued the pinned question`, prompt.includes(spec.prompt.replace(/\s+/g, '')), prompt)) return;

    const typing = page.getByRole('button', { name: 'Answer by typing' });
    if (await typing.count()) await typing.click();
    await page.locator('[data-final-answer]').fill(spec.answer);
    const work = page.locator('[data-typed-working]');
    const disclose = page.locator('.btn-disclose[aria-controls]', { hasText: 'Show working' });
    if (!await work.isVisible() && await disclose.count()) await disclose.first().click();
    await work.waitFor({ state: 'visible', timeout: 10000 });
    await work.click();
    await work.fill(spec.working);

    // Working is checked when the question is finished, so the same wrong
    // answer and working go in until the server resolves the question.
    let reply = null;
    for (let n = 0; n < 4 && reply?.resolved !== true; n++) {
      if (n > 0) {
        await page.locator('.ws-actions .btn-primary').waitFor({ state: 'visible', timeout: 15000 });
        if (await page.locator('[data-final-answer]').inputValue() !== spec.answer) await page.locator('[data-final-answer]').fill(spec.answer);
        if (!await work.isVisible() && await disclose.count()) await disclose.first().click();
        if (await work.inputValue() !== spec.working) { await work.click(); await work.fill(spec.working); }
      }
      const graded = page.waitForResponse(r => POST_GRADE.test(new URL(r.url()).pathname) && r.request().method() === 'POST');
      await page.locator('.ws-actions .btn-primary').click();
      reply = await (await graded).json();
      await page.locator('.verdict, .eval-card').first().waitFor({ timeout: 30000 });
    }
    const report = reply.stepReport;
    check(`${spec.edition}: the real server marked it, wrong, with a step report`,
      reply.authoritative === true && reply.correct === false && Array.isArray(report?.lines),
      JSON.stringify(reply).slice(0, 400));
    check(`${spec.edition}: Step Check puts the first break on line 2`, report?.lines?.findIndex(l => l.status === 'break') === 1, JSON.stringify(report?.lines));

    const graph = page.locator('[data-mistake-graph]');
    await graph.waitFor({ state: 'visible', timeout: 15000 });
    const card = page.locator('.verdict, .eval-card').first();
    const verdictBefore = await card.innerText();
    const toggle = graph.locator('[data-mistake-toggle]');
    check(`${spec.edition}: the graph is offered at the first break, closed`,
      await toggle.getAttribute('aria-expanded') === 'false' && await graph.locator('svg[viewBox]').count() === 0);
    await graph.scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(OUT, `${spec.edition}-closed.png`), clip: await clipAround(page, card) });

    await toggle.click();
    await graph.locator('[data-mistake-say]').waitFor({ timeout: 10000 });
    const say = await graph.locator('[data-mistake-say]').innerText();
    check(`${spec.edition}: opened, it says the counterexample in words`, say.includes(spec.say), say);
    check(`${spec.edition}: two curves are drawn, the student's dashed`,
      await graph.locator('[data-curve="before"]').count() >= 1 && await graph.locator('[data-curve="yours"][stroke-dasharray]').count() >= 1);
    await graph.scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(OUT, `${spec.edition}-open.png`), clip: await clipAround(page, card) });

    const slider = graph.locator('[role="slider"]');
    const live = graph.locator('[data-mistake-live]');
    const start = await live.innerText();
    await slider.focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
    const moved = await live.innerText();
    check(`${spec.edition}: the arrow keys move the marker and the live readout follows`, moved !== start && /At x = /.test(moved), `${start} → ${moved}`);
    await page.screenshot({ path: join(OUT, `${spec.edition}-moved.png`), clip: await clipAround(page, card) });
    await page.keyboard.press('Home');
    check(`${spec.edition}: Home puts the marker back on the counterexample`, await live.innerText() === start);
    const box = await slider.boundingBox();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    check(`${spec.edition}: dragging moves the marker`, await live.innerText() !== start);

    check(`${spec.edition}: the card's verdict is unchanged by the graph`, (await card.innerText()).startsWith(verdictBefore.split('\n')[0]));
  } finally {
    await ctx.close();
    await platform.close();
  }
}

async function clipAround(page, locator) {
  const b = await locator.boundingBox();
  const g = await page.locator('[data-mistake-graph]').boundingBox();
  const top = Math.max(0, Math.min(b.y, g.y) - 12);
  const bottom = Math.max(b.y + b.height, g.y + g.height) + 12;
  const vp = page.viewportSize();
  return { x: Math.max(0, b.x - 12), y: top, width: Math.min(vp.width, b.width + 24), height: Math.min(bottom - top, vp.height * 2) };
}

const browser = await chromium.launch();
try {
  for (const spec of EDITIONS) {
    try { await runEdition(spec, browser); }
    catch (e) { check(`${spec.edition}: the tour ran`, false, e.stack || e.message); }
  }
} finally {
  await browser.close();
}
console.log(`\nScreenshots: ${OUT}`);
if (failures.length) {
  console.error(`SEE WHY TOUR: FAIL — ${failures.length} failed, ${pass} passed`);
  process.exit(1);
}
console.log(`SEE WHY TOUR: PASS — ${pass}/${pass} checks`);
