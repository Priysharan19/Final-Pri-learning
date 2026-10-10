// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — late cloud results never rewrite an attempt (§09).
//
// The cloud handwriting reader and the cloud working check answer after the
// fact, sometimes seconds later. These stubs stand in for /v1 and hold their
// answers back for as long as each case needs, and the real card is driven
// through the moment where a late answer could do damage:
//
//   1. control — the server reading is the reading the card shows and will
//      mark (handwriting is read only by the server: owner decision);
//   2. while a server reading is still out, nothing can be submitted — the
//      page carries no reading at all — so no reading can land after a Submit
//      and rewrite what was marked;
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
import { pressRead } from './fakeServerReader.js';
import { pathToFileURL } from 'node:url';
import { TEMPLATES } from '../src/ink/templates.js';
import { SYNTHETIC_EVIDENCE } from './support/online-session.mjs';

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
// Polled from the test: the real server's Content-Security-Policy forbids
// eval in the page, as it does in production.
const readsAs = async (page, text) => {
  const until = Date.now() + 15000;
  while (Date.now() < until) {
    const r = await reading(page);
    if (r.lines.length === 1 && r.lines[0] === text) return true;
    await page.waitForTimeout(100);
  }
  return false;
};

export const flow = {
  id: 'stale-cloud',
  name: 'Cloud · late results never rewrite an attempt',
  online: true,

  async run({ page, ctx, base, check, goto, createProfile, settle, online, note }) {
    const reader = online.reader;
    Object.assign(reader, { text: '7', confidence: 0.99, down: false });
    note(`${SYNTHETIC_EVIDENCE}: in "Cloud · late results…" the handwriting reader behind the real server is a scripted stand-in, and the working check (/v1/working/check) is a labelled stub that returns only per-line notes. Every mark is the real server's.`);
    const stub = {
      transcribeDelay: 0, transcribed: 0, transcribeAnswered: 0,
      // What the stand-in reader will "see": scripted on the server's provider hop.
      get text() { return reader.text; }, set text(value) { reader.text = value; },
      lastSentAt: 0, submittedAt: 0, answeredAfterSubmit: 0,
      checkDelay: 0, checkDelays: {}, checked: 0, checkAnswered: 0, answeredChecks: []
    };
    const json = (route, status, value) => route.fulfill({
      status, contentType: 'application/json', body: JSON.stringify(value)
    }).catch(() => { /* the page abandoned the request — exactly the late case */ });
    // Two things are held at the network layer, and nothing else: the real
    // server's reading is DELAYED (the request is passed on to the server and
    // its own answer is returned late), and the working check — an after-the-
    // fact note on the student's lines, never a mark — is answered by a stub.
    // Accounts, question issue and every grade go straight to the real server.
    await ctx.route(url => url.origin === base && /^\/v1\/(?:handwriting\/transcribe|working\/(?:status|check))$/.test(url.pathname), async route => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      if (url.pathname === '/v1/working/status') return json(route, 200, { available: true, configured: true });
      if (url.pathname === '/v1/handwriting/transcribe' && method === 'POST') {
        stub.transcribed++;
        stub.lastSentAt = Date.now();
        await new Promise(r => setTimeout(r, stub.transcribeDelay));
        const response = await route.fetch().catch(() => null);
        stub.transcribeAnswered++;
        if (stub.submittedAt && Date.now() > stub.submittedAt) stub.answeredAfterSubmit++;
        if (!response) return route.abort().catch(() => {});
        return route.fulfill({ response }).catch(() => { /* abandoned: the late case */ });
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
      return route.continue();
    });

    await goto('/');
    await createProfile({ name: 'Grace Hopper', year: 7 });
    await online.signIn({ name: 'Grace Hopper' });

    // Both server features are opt-in, so they are switched on the way a
    // student does: in Settings.
    await page.goto(`${base}/settings`, { waitUntil: 'domcontentloaded' });
    for (const label of ['Read my handwriting and photos on the server', 'Tell me which line my working went wrong on']) {
      const row = page.locator('.set-row').filter({ hasText: label });
      const button = row.locator('button[aria-pressed]');
      await button.waitFor({ timeout: 20000 });
      await page.waitForFunction(el => !el.disabled, await button.elementHandle(), { timeout: 20000 });
      // Server reading is already on for a signed-in account; a tap would turn it off.
      if (await button.getAttribute('aria-pressed') !== 'true') await button.click();
      await page.waitForFunction(el => el.getAttribute('aria-pressed') === 'true', await button.elementHandle(), { timeout: 20000 });
    }
    await check('both server features are switched on in Settings',
      await page.locator('.set-row button[aria-pressed="true"]').count() >= 2, 'the opt-in toggles did not stick');

    // Questions are told apart by their opaque id, never by prompt text: a
    // generator can write the same prompt twice.
    const shownId = () => page.locator('.qpage').first().getAttribute('data-question-id');
    const questionChangesFrom = (before) => page.waitForFunction(id => {
      const el = document.querySelector('.qpage[data-question-id]');
      return el && el.getAttribute('data-question-id') !== id && el.querySelector('.q-prompt');
    }, before, { timeout: 30000 }).catch(() => null);
    // A fresh question each time, on a clean page.
    const openWriting = async (topic = TOPIC) => {
      await page.goto(`${base}/practice?subtopic=${topic}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
      const before = await shownId();
      await page.locator('.ctx-next').click();
      await questionChangesFrom(before);
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

    // ── 1 · control: the server reading is the reading ───────────────────────
    let box = await openWriting();
    stub.transcribeDelay = 100;
    stub.text = '7';
    await handwrite(page, box, '1');
    await pressRead(page);   // reading is asked for
    await readsAs(page, '7');
    const early = await reading(page);
    if (!await check('control: the server reading is what the card shows and will submit',
      early.lines[0] === '7' && early.foot === '7', `read ${JSON.stringify(early)} after ${stub.transcribeAnswered} server readings`)) return;

    // ── 2 · nothing can be submitted while a reading is still out ────────────
    stub.transcribeDelay = 3500;
    await page.locator('.ink-tool[title="Clear"]').click();
    await settle();
    let glyph = '4';
    online.forgetKeptReads();   // re-scripted stand-in (desk only)
    stub.text = glyph;
    const sentBefore = stub.transcribed;
    await handwrite(page, box, glyph);
    await pressRead(page);   // reading is asked for
    const until = Date.now() + 15000;
    while (stub.transcribed === sentBefore && Date.now() < until) await page.waitForTimeout(50);
    const inFlight = await reading(page);
    const submitDisabled = await page.locator('.editor-foot button.btn').last().isDisabled();
    await check('the slow server reading was requested', stub.transcribed > sentBefore, JSON.stringify(stub));
    await check('while it is out, the page shows no reading and Submit is unavailable',
      inFlight.lines.length === 0 && submitDisabled, `read ${JSON.stringify(inFlight)}, submit disabled ${submitDisabled}`);
    await readsAs(page, glyph);
    stub.submittedAt = Date.now();
    await submitInk();
    await page.waitForSelector('.verdict-bad, .eval-card', { timeout: 20000 });
    if (!await page.locator('.eval-card').count()) {
      await page.locator('.ink-tool[title="Clear"]').click();
      await settle();
      glyph = '9';
      online.forgetKeptReads();   // re-scripted stand-in (desk only)
      stub.text = glyph;
      await handwrite(page, box, glyph);
      await pressRead(page);   // reading is asked for
      await readsAs(page, glyph);
      await submitInk();
    }
    await page.waitForSelector('.eval-card', { timeout: 20000 });
    const verdictBefore = (await page.locator('.eval-card').innerText()).replace(/\s+/g, ' ');
    await page.waitForTimeout(800);
    const late = await reading(page);
    await check('after Submit the reading panel still shows what was marked',
      JSON.stringify(late.lines) === JSON.stringify([glyph]), `read ${JSON.stringify(late)}`);
    await check('nor does the answer the card holds for the attempt change', late.foot === glyph, `read ${JSON.stringify(late)}`);
    const verdictAfter = (await page.locator('.eval-card').innerText()).replace(/\s+/g, ' ');
    await check('nor the verdict on the answer that was submitted', verdictAfter === verdictBefore,
      `before ${JSON.stringify(verdictBefore.slice(0, 120))} after ${JSON.stringify(verdictAfter.slice(0, 120))}`);

    // ── 3 · control: a working check for the question on screen is shown ───
    // Two lines, wrong, twice: resolved wrong with working the on-device
    // checker cannot place, which is when the server is asked.
    // Two lines on the question on screen, submitted until it resolves.
    const writeTwoLinesAndResolve = async () => {
      stub.transcribeDelay = 100;
      // Re-scripted stand-in: earlier in this flow a lone "1" was scripted to
      // read as "7". The server keeps a read per account and picture, so the
      // desk says "a different reader now" (harness-only; online-session.mjs).
      online.forgetKeptReads();
      stub.text = '1\n2';
      if (await page.getByRole('button', { name: 'Answer by handwriting' }).count()) {
        await page.getByRole('button', { name: 'Answer by handwriting' }).click();
      }
      await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
      await page.locator('.ink-tool[title="Clear"]').click();
      await settle();
      box = await page.locator('.ink-canvas-live').boundingBox();
      await handwrite(page, box, '1');
      await handwrite(page, box, '2', { y: 230 });
      await pressRead(page);   // reading is asked for
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
    const idA = await shownId();
    const aId = stub.checked;
    const waitAsk = Date.now() + 10000;
    while (stub.checked < aId && Date.now() < waitAsk) await page.waitForTimeout(50);
    await check('the slow working check for A was requested', !!evalA && aId > askedBeforeA, `checks ${stub.checked}`);
    await page.locator('.ctx-next').click();
    await questionChangesFrom(idA);
    await check('the student is on question B', !!idA && await shownId() !== idA, 'still on A');
    await writeTwoLinesAndResolve();
    const settleA = Date.now() + 15000;
    while (!stub.answeredChecks.includes(aId) && Date.now() < settleA) await page.waitForTimeout(100);
    await page.waitForTimeout(1000);
    await check('A\u2019s late working check did arrive (the case really happened)', stub.answeredChecks.includes(aId), JSON.stringify(stub.answeredChecks));
    const onB = await page.locator('body').innerText();
    await check('A\u2019s late working check is not shown on B', !onB.includes(noteFor(aId)), 'the note for A appeared on B');

    // A's row in History: found by its id, still marked wrong.
    await page.goto(`${base}/history`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hist-row', { timeout: 30000 });
    const rowA = await page.evaluate(id => {
      const row = document.querySelector(`.hist-row[data-question-id="${CSS.escape(id)}"]`);
      if (!row) return null;
      const v = row.querySelector('.hist-verdict');
      return { bad: v?.classList.contains('bad') === true, good: v?.classList.contains('good') === true };
    }, idA);
    await check('A\u2019s recorded mark is unchanged in History: still wrong',
      !!rowA && rowA.bad && !rowA.good && /\b0 \/ \d+ marks/.test(evalA), `row ${JSON.stringify(rowA)}, evaluation ${JSON.stringify(evalA.slice(0, 80))}`);
    // Every verdict above was the server's, and the late results changed
    // nothing there either: one completion per resolved question, no more.
    const graded = await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/);
    const resolvedOnServer = new Set(graded.filter(c => c.json?.resolved === true).map(c => c.path));
    const ledger = online.ledger();
    await check('every mark in this flow was the server\u2019s, and it completed each resolved question exactly once',
      graded.length >= 4 && graded.every(c => c.status === 200 && c.json?.authoritative === true && c.body?.mode === 'ink') &&
        ledger.completions === resolvedOnServer.size,
      `${graded.length} grades, ${resolvedOnServer.size} resolved, ledger ${JSON.stringify(ledger)}`);
    await check('nothing in this flow tried to reach a real provider', reader.refused.length === 0, JSON.stringify(reader.refused));
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
