// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — late cloud results never rewrite an attempt (§09).
//
// The cloud handwriting reader and the cloud working check answer after the
// fact, sometimes seconds later. These stubs stand in for /v1 and hold their
// answers back for as long as each case needs, and the real card is driven
// through the moment where a late answer could do damage:
//
//   1. control — a server reading that arrives BEFORE Submit replaces the
//      on-device reading (so the stub path is really live);
//   2. a server reading that arrives AFTER Submit changes neither the reading
//      on the page nor what was submitted and marked;
//   3. control — a working check that arrives while its question is on screen
//      is shown under that question's working;
//   4. a working check for question A that arrives after the student moved on
//      to question B is not shown on B, and A's recorded mark does not move.
//
// The stubs return only what the real routes return: a transcription of the
// picture, and a per-line verdict on the student's own lines. Neither sees or
// returns an expected answer.
// Run on its own:  node client/test/tour-stale-cloud.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { TEMPLATES } from '../src/ink/templates.js';

const TOPIC = 'y7-equations';
// Whole-number answers with no Step Check metadata: wrong working here is the
// case the on-device checker cannot place, which is when the server is asked.
const UNPLACED_TOPIC = 'y7-integers';
// Every working check the stub answers names itself, so a note on screen says
// which request — and so which question — it came from.
const noteFor = (n) => `STUB-NOTE-${n}`;

async function handwrite(page, box, text, { x = 40, y = 34 } = {}) {
  let ox = box.x + x;
  for (const ch of text) {
    const variant = TEMPLATES[ch]?.[0];
    if (!variant) throw new Error(`no template for ${JSON.stringify(ch)}`);
    for (const stroke of variant) {
      const pts = stroke.map(([px, py]) => [ox + (px / 100) * 58, box.y + y + (py / 100) * 84]);
      await page.mouse.move(pts[0][0], pts[0][1]);
      await page.mouse.down();
      for (const [px, py] of pts) await page.mouse.move(px, py);
      await page.mouse.up();
    }
    ox += 66;
  }
}

// What the page says it read: each reading-panel line as set in maths,
// and the answer the card itself is holding to submit ("submitting: …").
// KaTeX writes maths twice (MathML + glyphs); only the visual copy is read.
const READ = () => {
  const visual = el => {
    const c = el.cloneNode(true);
    for (const m of c.querySelectorAll('.katex-mathml')) m.remove();
    return c.textContent || '';
  };
  const lines = [...document.querySelectorAll('.ink-line .ink-line-math')].map(el => visual(el).replace(/\s+/g, ''));
  const foot = [...document.querySelectorAll('.editor-foot .muted')].map(visual).join(' ').replace(/\s+/g, ' ').trim();
  return { lines, foot: foot.replace(/^.*?:\s*/, '').replace(/\s+/g, '') };
};
const reading = (page) => page.evaluate(READ);
const readsAs = (page, text) => page.waitForFunction(([src, t]) => {
  const r = (0, eval)(`(${src})`)();
  return r.lines.length === 1 && r.lines[0] === t;
}, [READ.toString(), text], { timeout: 15000 }).then(() => true, () => false);

export const flow = {
  id: 'stale-cloud',
  name: 'Cloud · late results never rewrite an attempt',

  async run({ page, ctx, base, check, goto, createProfile, mathText, settle }) {
    const stub = {
      transcribeDelay: 0, transcribed: 0, transcribeAnswered: 0,
      lastSentAt: 0, submittedAt: 0, answeredAfterSubmit: 0,
      checkDelay: 0, checkDelays: {}, checked: 0, checkAnswered: 0, answeredChecks: []
    };
    await page.addInitScript(origin => { window.__PRI_CLOUD_ORIGIN__ = origin; }, base);
    const json = (route, status, value) => route.fulfill({
      status, contentType: 'application/json', body: JSON.stringify(value)
    }).catch(() => { /* the page abandoned the request — exactly the late case */ });
    await ctx.route('**/v1/**', async route => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      if (url.pathname === '/v1/handwriting/status') {
        return json(route, 200, { state: 'ready', configured: true, usable: true, available: true, confidenceFloor: 0.8 });
      }
      if (url.pathname === '/v1/working/status') return json(route, 200, { available: true, configured: true });
      if (url.pathname === '/v1/handwriting/transcribe' && method === 'POST') {
        stub.transcribed++;
        stub.lastSentAt = Date.now();
        await new Promise(r => setTimeout(r, stub.transcribeDelay));
        stub.transcribeAnswered++;
        if (stub.submittedAt && Date.now() > stub.submittedAt) stub.answeredAfterSubmit++;
        return json(route, 200, { transcription: {
          engine: 'stub-reader', confidence: 0.99, needsConfirmation: false,
          lines: [{ text: '7', confidence: 0.99 }]
        } });
      }
      if (url.pathname === '/v1/working/check' && method === 'POST') {
        const n = ++stub.checked;
        await new Promise(r => setTimeout(r, stub.checkDelays[n] ?? stub.checkDelay));
        stub.checkAnswered++;
        stub.answeredChecks.push(n);
        const lines = JSON.parse(route.request().postData() || '{}').lines || [];
        return json(route, 200, { check: {
          engine: 'stub-checker', needsConfirmation: false, firstBreak: lines.length - 1,
          lines: lines.map((_, i) => ({ index: i, status: i === lines.length - 1 ? 'break' : 'ok', why: i === lines.length - 1 ? noteFor(n) : undefined }))
        } });
      }
      return json(route, 404, { error: { code: 'NOT_FOUND', message: url.pathname } });
    });

    await goto('/');
    await createProfile({ name: 'Grace Hopper', year: 7 });

    // Both server features are opt-in, so they are switched on the way a
    // student does: in Settings.
    await page.goto(`${base}/settings`, { waitUntil: 'domcontentloaded' });
    for (const label of ['Also read my handwriting on the server', 'Tell me which line my working went wrong on']) {
      const row = page.locator('.set-row').filter({ hasText: label });
      const button = row.locator('button[aria-pressed]');
      await button.waitFor({ timeout: 20000 });
      await page.waitForFunction(el => !el.disabled, await button.elementHandle(), { timeout: 20000 });
      await button.click();
      await page.waitForFunction(el => el.getAttribute('aria-pressed') === 'true', await button.elementHandle(), { timeout: 20000 });
    }
    await check('both server features are switched on in Settings',
      await page.locator('.set-row button[aria-pressed="true"]').count() >= 2, 'the opt-in toggles did not stick');

    // The prompt as a student reads it (KaTeX's MathML copy dropped).
    const promptChangesFrom = (before) => page.waitForFunction(p => {
      const el = document.querySelector('.q-prompt');
      if (!el) return false;
      const c = el.cloneNode(true);
      for (const m of c.querySelectorAll('.katex-mathml')) m.remove();
      return c.textContent.replace(/\s|\u00a0/g, ' ').replace(/ +/g, ' ').trim() !== p;
    }, before, { timeout: 30000 }).catch(() => null);
    // A fresh question each time, on a clean page.
    const openWriting = async (topic = TOPIC) => {
      await page.goto(`${base}/practice?subtopic=${topic}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.q-prompt', { timeout: 30000 });
      const before = await mathText('.q-prompt');
      await page.locator('.ctx-next').click();
      await promptChangesFrom(before);
      await settle();
      await page.getByRole('button', { name: 'Answer by handwriting' }).click();
      await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
      await page.locator('.ink-tool[title="Clear"]').click();
      await settle();
      return page.locator('.ink-canvas-live').boundingBox();
    };
    const submitInk = async () => {
      await page.locator('.editor-foot button.btn').last().click();
      const confirm = page.getByRole('button', { name: 'That’s what I wrote' });
      if (await confirm.count()) await confirm.click();
    };

    // ── 1 · control: an early server reading is applied ──────────────────────
    let box = await openWriting();
    stub.transcribeDelay = 100;
    await page.waitForTimeout(600);
    await handwrite(page, box, '1');
    await readsAs(page, '7');
    const early = await reading(page);
    if (!await check('control: a server reading that arrives before Submit replaces the on-device one',
      early.lines[0] === '7' && early.foot === '7', `read ${JSON.stringify(early)} after ${stub.transcribeAnswered} server readings`)) return;

    // ── 2 · a server reading that lands after Submit ─────────────────────────
    // Written, the slow server read sent, then submitted while it is still out.
    // A first wrong try reopens the page for a second try (where a new reading
    // is legitimate), so the case is the submit that settles the question.
    stub.transcribeDelay = 3500;
    let lastStrokeAt = 0;
    const writeAndSubmitWhileReading = async (glyph) => {
      await page.locator('.ink-tool[title="Clear"]').click();
      await settle();
      const sentBefore = stub.transcribed;
      await handwrite(page, box, glyph);
      lastStrokeAt = Date.now();
      await readsAs(page, glyph);
      // The read for the finished page goes out after a settle window; wait for
      // it, and for quiet, so nothing is still queued to send.
      const until = Date.now() + 15000;
      while ((stub.lastSentAt < lastStrokeAt || Date.now() - stub.lastSentAt < 1000 || stub.transcribed === sentBefore) && Date.now() < until) {
        await page.waitForTimeout(50);
      }
      stub.submittedAt = Date.now();
      stub.answeredAfterSubmit = 0;
      await submitInk();
      await page.waitForSelector('.verdict-bad, .eval-card', { timeout: 20000 });
      return stub.transcribed > sentBefore;
    };
    let glyph = '4';
    let sent = await writeAndSubmitWhileReading(glyph);
    if (!await page.locator('.eval-card').count()) {
      glyph = '9';
      sent = await writeAndSubmitWhileReading(glyph);
    }
    await page.waitForSelector('.eval-card', { timeout: 20000 });
    await check('the slow server reading was requested before the settling Submit', sent, JSON.stringify(stub));
    const verdictBefore = (await page.locator('.eval-card').innerText()).replace(/\s+/g, ' ');
    const settled = Date.now() + 12000;
    while ((stub.transcribeAnswered < stub.transcribed || !stub.answeredAfterSubmit) && Date.now() < settled) await page.waitForTimeout(100);
    await page.waitForTimeout(800);
    await check('the late server reading did arrive after Submit (the case really happened)',
      stub.answeredAfterSubmit > 0 && stub.transcribeAnswered === stub.transcribed && stub.lastSentAt < stub.submittedAt, JSON.stringify(stub));
    const late = await reading(page);
    await check('a server reading that lands after Submit does not rewrite the reading panel',
      JSON.stringify(late.lines) === JSON.stringify([glyph]), `read ${JSON.stringify(late)}`);
    await check('nor the answer the card holds for the attempt', late.foot === glyph, `read ${JSON.stringify(late)}`);
    const verdictAfter = (await page.locator('.eval-card').innerText()).replace(/\s+/g, ' ');
    await check('nor the verdict on the answer that was submitted', verdictAfter === verdictBefore,
      `before ${JSON.stringify(verdictBefore.slice(0, 120))} after ${JSON.stringify(verdictAfter.slice(0, 120))}`);

    // ── 3 · control: a working check for the question on screen is shown ───
    // Two lines, wrong, twice: resolved wrong with working the on-device
    // checker cannot place, which is when the server is asked.
    // Two lines on the question on screen, submitted until it resolves.
    const writeTwoLinesAndResolve = async () => {
      stub.transcribeDelay = 60000;   // keep the on-device reading on the page
      if (await page.getByRole('button', { name: 'Answer by handwriting' }).count()) {
        await page.getByRole('button', { name: 'Answer by handwriting' }).click();
      }
      await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
      await page.locator('.ink-tool[title="Clear"]').click();
      await settle();
      box = await page.locator('.ink-canvas-live').boundingBox();
      await handwrite(page, box, '1');
      await handwrite(page, box, '2', { y: 230 });
      await page.waitForFunction(() => document.querySelectorAll('.ink-line').length === 2, null, { timeout: 15000 }).catch(() => null);
      await submitInk();
      await page.waitForSelector('.verdict-bad, .eval-card', { timeout: 20000 });
      if (!await page.locator('.eval-card').count()) {
        await submitInk();
        await page.waitForSelector('.eval-card', { timeout: 20000 });
      }
      return (await page.locator('.eval-card').innerText()).replace(/\s+/g, ' ');
    };
    const resolveWrongWithTwoLines = async () => {
      // "2" is only wrong for most of these questions; one it is right for is
      // skipped, so the case is always a wrong answer the server is asked about.
      for (let tries = 0; tries < 6; tries++) {
        await openWriting(UNPLACED_TOPIC);
        const evaluation = await writeTwoLinesAndResolve();
        if (!/\b(\d+) \/ \1 marks/.test(evaluation)) return evaluation;
      }
      throw new Error('every question served had 2 as its answer');
    };
    stub.checkDelay = 100;
    const checkedBefore = stub.checked;
    await resolveWrongWithTwoLines();
    const controlNote = noteFor(stub.checked);
    await page.waitForFunction(note => document.body.innerText.includes(note), controlNote, { timeout: 15000 }).catch(() => null);
    if (!await check('control: a working check for the question on screen is shown under its working',
      stub.checked > checkedBefore && (await page.locator('body').innerText()).includes(controlNote),
      `${stub.checked - checkedBefore} checks asked for`)) return;

    // ── 4 · a working check for A that lands after the move to B ─────────────
    // A's check is slow; the student moves on with Next (no reload) and
    // resolves B, whose own check never comes back. A's answer then lands.
    const askedBeforeA = stub.checked;
    stub.checkDelays[askedBeforeA + 1] = 9000;     // A
    stub.checkDelays[askedBeforeA + 2] = 120000;   // B, if it is asked
    stub.checkDelay = 120000;
    let evalA = null;
    for (let tries = 0; tries < 6 && !evalA; tries++) {
      await openWriting(UNPLACED_TOPIC);
      const e = await writeTwoLinesAndResolve();
      // A right answer asks for no check, so the delays still line up.
      if (!/\b(\d+) \/ \1 marks/.test(e)) evalA = e;
    }
    const promptA = await mathText('.q-prompt');
    const aId = stub.checked;
    const waitAsk = Date.now() + 10000;
    while (stub.checked < aId && Date.now() < waitAsk) await page.waitForTimeout(50);
    await check('the slow working check for A was requested', !!evalA && aId > askedBeforeA, `checks ${stub.checked}`);
    await page.locator('.ctx-next').click();
    await promptChangesFrom(promptA);
    await check('the student is on question B', await mathText('.q-prompt') !== promptA, 'still on A');
    await writeTwoLinesAndResolve();
    const settleA = Date.now() + 15000;
    while (!stub.answeredChecks.includes(aId) && Date.now() < settleA) await page.waitForTimeout(100);
    await page.waitForTimeout(1000);
    await check('A\u2019s late working check did arrive (the case really happened)', stub.answeredChecks.includes(aId), JSON.stringify(stub.answeredChecks));
    const onB = await page.locator('body').innerText();
    await check('A\u2019s late working check is not shown on B', !onB.includes(noteFor(aId)), 'the note for A appeared on B');

    // A's row in History: found by its prompt, still marked wrong.
    await page.goto(`${base}/history`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hist-row', { timeout: 30000 });
    const rowA = await page.evaluate(prompt => {
      const visual = el => { const c = el.cloneNode(true); for (const m of c.querySelectorAll('.katex-mathml')) m.remove(); return (c.textContent || '').replace(/\s+/g, ' ').trim(); };
      const row = [...document.querySelectorAll('.hist-row')].find(r => visual(r.querySelector('.hist-prompt') || r) === prompt);
      if (!row) return null;
      const v = row.querySelector('.hist-verdict');
      return { bad: v?.classList.contains('bad') === true, good: v?.classList.contains('good') === true };
    }, promptA);
    await check('A\u2019s recorded mark is unchanged in History: still wrong',
      !!rowA && rowA.bad && !rowA.good && /\b0 \/ \d+ marks/.test(evalA), `row ${JSON.stringify(rowA)}, evaluation ${JSON.stringify(evalA.slice(0, 80))}`);
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
