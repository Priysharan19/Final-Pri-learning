// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E journeys — the first mistake, on a photographed page and
// on a handwritten one (issue #430).
//
// The owner's question: "An arithmetic progression has first term 9 and common
// difference 3. Find its 9th term." The owner's page:
//
//   a = 9, d = 3
//   T_n = a + (n - 1)d
//   T_9 = 9 + 8 × 3
//       = 9 + 24
//       = 35
//
// PHOTO: the page is read → every line is shown → before anything is marked
// the card points at the last line ("Recheck 9 + 24") without saying 33 → the
// answer 35 is proposed → Submit → a first wrong try says nothing about any
// line → the second resolves it: four ticks, "First mistake found here" on the
// last line, "9 + 24 = 33, not 35", what was done well, how to improve, and
// the marks the server decided (0 of 1: this question's rubric has one mark).
// INK: the same lines written by hand, the same panel.
//
// WHAT IS REAL: the built client in a browser; the platform server (server/
// app.js) in this process on its own SQLite file; every mark and every line of
// the review was computed by the server's deterministic marker.
//
// WHAT IS SYNTHETIC, and labelled so in the output: the READER. It never looks
// at a picture or a stroke; it returns the lines this flow scripts. The "photo"
// is a 1×1 image and the "handwriting" is a few test glyphs. Nothing here is
// evidence about a real provider, real handwriting, a real or sideways photo,
// an iPad or a Pencil.
//
// WHICH QUESTION: as in tour-photo-answer.js, the test's desk seals a
// prepared-question token for the owner's question and the page's issue request
// is answered by the REAL server binding it. The answer is never given to the page.
//
// Run on its own:  node client/test/tour-first-mistake.js [--no-build]
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { handwrite, pressRead } from './fakeServerReader.js';

const EVIDENCE = 'SYNTHETIC-READER EVIDENCE';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const OWNER = { generator: 'c10-arithmetic-progressions', difficulty: 1, seed: 10931 };
const OWNER_PROMPT = /first term\s*9\s*and common difference\s*3.*9\s*th term/is;
const PAGE = ['a = 9, d = 3', 'T_n = a + (n - 1)d', 'T_9 = 9 + 8 × 3', '= 9 + 24', '= 35'];

const until = async (page, fn, ms = 15000) => {
  for (let waited = 0; waited < ms; waited += 150) { if (await fn()) return true; await page.waitForTimeout(150); }
  return !!(await fn());
};
async function pressSubmit(page) {
  await page.waitForFunction(() => { const b = document.querySelector('.ws-actions .btn-primary'); return !!b && !b.disabled; }, null, { timeout: 20000 });
  await page.locator('.ws-actions .btn-primary').click();
}
async function serveOwnersQuestion(ctx, accountId) {
  const { encryptDeliveryToken } = await import('../../server/platform/deliveryCrypto.js');
  await ctx.route('**/v1/practice/issue', async route => {
    let body = null;
    try { body = route.request().postDataJSON(); } catch { body = null; }
    if (body && body.prepared !== undefined) return route.continue();
    const prepared = encryptDeliveryToken(JSON.stringify({
      g: OWNER.generator, d: OWNER.difficulty, s: OWNER.seed, m: 'practice', x: Date.now() + 60 * 60 * 1000, n: randomUUID()
    }), 'practice-prepared-v1');
    const response = await route.fetch({ postData: JSON.stringify({ prepared, account: String(accountId) }) });
    return route.fulfill({ response });
  });
}
/** The review panel as the student reads it and as a screen reader is given it. */
const panel = page => page.evaluate(() => {
  const root = document.querySelector('[data-working-review]');
  if (!root) return null;
  const text = el => (el ? el.innerText.replace(/\s+/g, ' ').trim() : '');
  // What is drawn on a line, left to right: mark, number, the line, the flag, the reason, the mark earned.
  const visible = el => [...el.querySelectorAll('.wr-mark, .wr-n, .wr-text, .wr-flag, .wr-reason, .wr-credit')].map(n => n.textContent.replace(/\s+/g, ' ').trim()).join(' ');
  return {
    certified: root.getAttribute('data-certified'),
    lines: [...root.querySelectorAll('[data-review-line]')].map(li => ({
      check: li.getAttribute('data-check'), first: li.getAttribute('data-first-mistake') === 'true',
      shown: visible(li), spoken: li.querySelector('.sr-only')?.textContent.trim() || ''
    })),
    card: text(root.querySelector('[data-first-mistake-card]')),
    cardSpoken: root.querySelector('[data-first-mistake-card]')?.getAttribute('aria-label') || '',
    cardClass: root.querySelector('[data-first-mistake-card]')?.getAttribute('data-error-class') || '',
    didWell: text(root.querySelector('[data-review-did-well]')),
    improve: text(root.querySelector('[data-review-improve]')),
    marks: text(root.querySelector('[data-review-marks]')),
    foot: text(root.querySelector('.wr-foot')),
    label: root.getAttribute('aria-label')
  };
});

/** Everything asserted about the resolved card, the same for both modes. */
async function assertReview({ page, check, note, mode, graded, modelCalls }) {
  const v = graded?.json?.workingReview;
  await check(`${mode}: the server resolves it — incorrect, 0 of 1 — and sends the per-line review with the first mistake on the last line`,
    graded?.status === 200 && graded.json?.authoritative === true && graded.json.correct === false && graded.json.resolved === true &&
      graded.json.marksEarned === 0 && graded.json.marksPossible === 1 && v?.firstMistake?.position === 'last' && v.firstMistake.cls === 'arithmetic-slip' &&
      v.firstMistake.correction === '9 + 24 = 33, not 35.' && graded.body?.mode === mode && graded.body.steps === PAGE.join('\n'),
    JSON.stringify({ status: graded?.status, mode: graded?.body?.mode, marks: [graded?.json?.marksEarned, graded?.json?.marksPossible], first: v?.firstMistake }));
  await page.locator('[data-working-review]').waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  const shown = await panel(page);
  if (!await check(`${mode}: the card shows the review panel`, !!shown, 'no [data-working-review] on the page')) return;
  await check(`${mode}: four lines are ticked, each with a short reason, and the last is marked "First mistake found here"`,
    shown.lines.length === 5 && shown.lines.slice(0, 4).every(l => l.check === 'verified' && /^✓/.test(l.shown)) &&
      shown.lines[4].check === 'first-mistake' && shown.lines[4].first && /^✗ 5 = 35 First mistake found here 9 \+ 24 = 33, not 35\.$/.test(shown.lines[4].shown) &&
      /Matches the value given in the question\.$/.test(shown.lines[0].shown) && /Correct formula for this question\.$/.test(shown.lines[1].shown) &&
      /The values are substituted correctly\.$/.test(shown.lines[2].shown) && /Correct arithmetic — both sides come to 33\.$/.test(shown.lines[3].shown),
    JSON.stringify(shown.lines.map(l => l.shown)));
  await check(`${mode}: what went wrong, on the last line: an arithmetic slip in the addition — 9 + 24 = 33, not 35`,
    shown.cardClass === 'arithmetic-slip' && /^What went wrong · last line \(line 5\) Arithmetic slip in the addition\. 9 \+ 24 = 33, not 35\.$/i.test(shown.card), shown.card);
  await check(`${mode}: what was done well and how to improve are said`,
    /What you did well You chose the right formula\. You substituted the values correctly\. Every line before the last one checks out\./i.test(shown.didWell) &&
      /How to improve Work each calculation once more/i.test(shown.improve), JSON.stringify([shown.didWell, shown.improve]));
  await check(`${mode}: the marks are the server's — 0 of 1, and why there is no method mark — and no "every line verified" is claimed`,
    /^Marks: 0 of 1 — this question carries one mark, for the final answer, so there is no separate method mark\.$/.test(shown.marks) && shown.certified === 'false' &&
      await page.locator('[data-review-certified]').count() === 0 && /No AI decided a mark/.test(shown.foot), JSON.stringify([shown.marks, shown.foot]));
  await check(`${mode}: the first mistake is spoken, not only drawn: the line says "First mistake found here" and the card names the place`,
    shown.lines[4].spoken === 'Line 5. First mistake found here.' && shown.lines[0].spoken === 'Line 1. Verified.' &&
      shown.cardSpoken === 'First mistake found on the last line (line 5). Arithmetic slip in the addition.' && shown.label === 'Your working, line by line' &&
      await page.locator('[data-first-mistake-card][role="note"]').count() === 1,
    JSON.stringify([shown.lines[4].spoken, shown.cardSpoken]));
  await check(`${mode}: the review cost no model call: the working provider was never asked`, modelCalls() === 0, `${modelCalls()} request(s) to /v1/working/check`);
  if (process.env.PRI_TOUR_SHOTS) await page.locator('[data-working-review]').screenshot({ path: `${process.env.PRI_TOUR_SHOTS}/first-mistake-${mode}.png` }).catch(() => {});
  note(`${mode} · post-grade panel as shown: ${JSON.stringify({ lines: shown.lines.map(l => l.shown), card: shown.card, didWell: shown.didWell, improve: shown.improve, marks: shown.marks, foot: shown.foot })}`);
}

async function openOwnersQuestion({ page, ctx, base, check, goto, createProfile, mathText, online, name }) {
  await goto('/');
  await createProfile({ name, course: 'in', year: 10 });
  const account = await online.signIn({ name });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await serveOwnersQuestion(ctx, account.id);
  await page.goto(`${base}/practice?subtopic=${OWNER.generator}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
  const prompt = await mathText('.q-prompt');
  const steered = OWNER_PROMPT.test(prompt);
  if (!await check('the server issued the owner\'s question: first term 9, common difference 3, the 9th term', steered, prompt)) return null;
  return { account, prompt };
}

export const photoFlow = {
  id: 'first-mistake-photo',
  online: true,
  name: 'First mistake · Photo: the owner\'s page — a key-free hint, then four ticks and the first mistake on "= 35"',

  async run(env) {
    const { page, check, note, online, browserName } = env;
    note(`${EVIDENCE}: "First mistake · Photo" [${browserName || 'chromium'}] uses a 1×1 test image and the scripted stand-in reader, which returns the owner's five lines (it never looks at a picture). The marks and the review are the real server's.`);
    const { reader } = online;
    reader.lines = PAGE.map(text => ({ text })); reader.confidence = 0.95; reader.down = false;
    let model = 0;
    page.on('request', r => { if (/\/v1\/working\/check/.test(r.url())) model += 1; });
    const opened = await openOwnersQuestion({ ...env, name: 'First Mistake Photo' });
    if (!opened) return;

    await page.getByRole('button', { name: /answer with a photo/i }).click();
    await page.locator('.editor-body input[type="file"]').setInputFiles({ name: 'page.png', mimeType: 'image/png', buffer: PNG });
    if (!await page.locator('[data-photo-lines]').waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false)) {
      // Read on request: the photo is read when the student asks.
      await page.locator('[data-photo-read]').click().catch(() => {});
      await page.locator('[data-photo-lines]').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    }
    const lines = await page.evaluate(() => [...document.querySelectorAll('[data-photo-line] input')].map(i => i.value));
    await check('all five lines of the page are shown, in order, the continuation lines beginning with "="',
      JSON.stringify(lines) === JSON.stringify(PAGE), JSON.stringify(lines));
    await check('a "Turn the photo" control is offered for a page photographed sideways',
      await page.locator('[data-photo-rotate]').isVisible() && /quarter turn/i.test(await page.locator('[data-photo-rotate]').getAttribute('aria-label')));

    // ── before anything is marked ────────────────────────────────────────────
    const hint = page.locator('[data-working-hint]');
    const hintText = (await hint.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    await check('before submission the card points at the last line — "Line 5: Recheck 9 + 24." — as a check of the student\'s own arithmetic',
      await hint.getAttribute('data-working-hint') === 'recheck' && await hint.getAttribute('data-hint-line') === '4' &&
        hintText === 'Line 5: Recheck 9 + 24. A check of your own arithmetic — nothing has been marked.' && await hint.getAttribute('role') === 'status', hintText);
    await check('the hint does not state 33, and nothing on the page does',
      !/33/.test(hintText) && !/\b33\b/.test(await page.locator('.qpage').first().innerText()));
    await check('the hint made no request: nothing was recognised, graded or sent to a model',
      (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/(recognize|submit)/)).length === 0 && model === 0);
    note(`photo · pre-submit hint as shown: ${JSON.stringify(hintText)}`);
    const answer = page.locator('[data-final-answer]');
    await check('the answer field holds 35 — taken from the last line', await answer.inputValue() === '35', await answer.inputValue().catch(() => ''));

    // A corrected line draws no hint; putting the slip back brings it back.
    const last = page.locator('[data-photo-line="4"] input');
    await last.fill('= 33');
    await check('correcting the line to "= 33" removes the hint', await until(page, async () => await page.locator('[data-working-hint]').count() === 0, 4000));
    await last.fill('= 35');
    await check('and the slip written again brings it back', await until(page, async () => await page.locator('[data-working-hint="recheck"]').count() === 1, 4000));
    await answer.fill('35');

    // ── first try: wrong, and silent about the lines ─────────────────────────
    await pressSubmit(page);
    await page.waitForSelector('.verdict-bad, .eval-card', { timeout: 40000 }).catch(() => {});
    const firstTry = (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).at(-1);
    await check('the first wrong try leaves the question open and carries no review, no step report and no solution',
      firstTry?.status === 200 && firstTry.json?.resolved === false && firstTry.json.workingReview === null && firstTry.json.stepReport === null && !('solution' in firstTry.json) &&
        await page.locator('[data-working-review]').count() === 0 && !/\b33\b/.test(await page.locator('.qpage').first().innerText()),
      JSON.stringify({ status: firstTry?.status, resolved: firstTry?.json?.resolved, review: firstTry?.json?.workingReview }));

    // ── second try resolves it ───────────────────────────────────────────────
    await pressSubmit(page);
    await page.waitForSelector('.eval-card', { timeout: 40000 }).catch(() => {});
    const graded = (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).at(-1);
    await assertReview({ page, check, note, mode: 'photo', graded, modelCalls: () => model });
    await check('photo: the reader was asked once for the page, answer-blind, and never again for marking',
      reader.requests.length === 1 && reader.requests.every(r => !/arithmetic progression|common difference/i.test(JSON.stringify((r.input || []).flatMap(m => m.content || []).filter(p => p.type !== 'input_image')))),
      `${reader.requests.length} provider request(s)`);
  }
};

export const inkFlow = {
  id: 'first-mistake-ink',
  online: true,
  name: 'First mistake · Ink: the same five lines by hand — the same hint and the same panel',

  async run(env) {
    const { page, check, note, online, browserName, settle } = env;
    note(`${EVIDENCE}: "First mistake · Ink" [${browserName || 'chromium'}] writes a few test glyphs with the mouse; the scripted stand-in reader returns the owner's five lines whatever was written. The marks and the review are the real server's.`);
    const { reader } = online;
    reader.lines = PAGE.map(text => ({ text })); reader.confidence = 0.97; reader.down = false;
    let model = 0;
    page.on('request', r => { if (/\/v1\/working\/check/.test(r.url())) model += 1; });
    const opened = await openOwnersQuestion({ ...env, name: 'First Mistake Ink' });
    if (!opened) return;
    await settle?.();
    await page.getByRole('button', { name: 'Answer by handwriting' }).click();
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    const canvas = await page.locator('.ink-canvas-live').boundingBox();
    for (const [i, glyph] of ['1', '7', '1', '7', '1'].entries()) await handwrite(page, canvas, glyph, { x: 40 + i * 100 });
    await pressRead(page);
    await page.waitForFunction(() => document.querySelectorAll('.ink-line').length === 5 && !document.querySelector('[data-ink-stale]'), null, { timeout: 20000 }).catch(() => {});

    const hint = page.locator('[data-working-hint]');
    await hint.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    const hintText = (await hint.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    await check('ink: before submission the same hint — "Line 5: Recheck 9 + 24." — and no 33',
      hintText === 'Line 5: Recheck 9 + 24. A check of your own arithmetic — nothing has been marked.' && !/33/.test(hintText), hintText);
    note(`ink · pre-submit hint as shown: ${JSON.stringify(hintText)}`);

    const submits = () => online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/);
    // A handwritten reading is confirmed by the student before it is sent
    // ("Confirm reading", then "Submit"): press until one more submission has
    // been answered by the server.
    const submit = async () => {
      const before = (await submits()).length;
      for (let press = 0; press < 3 && (await submits()).length === before; press += 1) {
        await page.waitForFunction(() => { const b = document.querySelector('.ws-actions .btn-primary'); return !!b && !b.disabled; }, null, { timeout: 20000 }).catch(() => {});
        await page.locator('.ws-actions .btn-primary').click();
        await until(page, async () => (await submits()).length > before, 6000);
      }
      await page.waitForSelector('.eval-card, .verdict-bad', { timeout: 40000 }).catch(() => {});
      await page.waitForTimeout(600);
    };
    await submit();
    const firstTry = (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).at(-1);
    await check('ink: the first wrong try carries no review and shows none',
      firstTry?.status === 200 && firstTry.json?.resolved === false && firstTry.json.workingReview === null && await page.locator('[data-working-review]').count() === 0,
      JSON.stringify({ status: firstTry?.status, body: firstTry?.body?.answer, resolved: firstTry?.json?.resolved }));
    await submit();
    const graded = (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).at(-1);
    await assertReview({ page, check, note, mode: 'ink', graded, modelCalls: () => model });
  }
};

export const flows = [photoFlow, inkFlow];

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runFlows } = await import('./e2e.mjs');
  process.exit(await runFlows(flows) ? 1 : 0);
}
