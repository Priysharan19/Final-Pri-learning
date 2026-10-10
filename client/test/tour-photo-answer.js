// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E journeys — a photographed page becomes an answer, and a
// reader that has reached its usage limit says so.
//
// 1. THE OWNER'S PAGE (2026-10-10). "Find the least value taken by the real
//    function f(x) = (x + 3)² + 6." A photo of ruled paper with unrelated set
//    notes at the top and the working below. The app listed every line as the
//    working, showed strict ">" where the page has "⩾", copied the sentence
//    "least value ⇒ 6." into the answer field, could not parse it, and kept the
//    photo in memory only. Here the reader is scripted to return EXACTLY that
//    transcript — the unrelated lines and the strict signs included — and the
//    journey is: photo → every line shown → the notes left out by default and
//    brought back with one action → a line corrected from > to ≥ → the answer
//    proposed as 6 → a reload restores the photo, the edits and the answer
//    without a second read → Submit → the server marks it correct.
//
// 2. THE USAGE LIMIT (production, 2026-10-10). Every read answered 503
//    PAID_CAPACITY_REACHED; the page said "the reader isn't answering … will be
//    tried again shortly" and re-sent the read. With the server's own ceiling
//    set to one paid call an hour: the first read works, the second is named
//    as the usage limit with the time it reopens, nothing is re-sent over ten
//    seconds, "Try again" sends exactly one request, and a typed answer is
//    still submitted and marked by the server.
//
// WHAT IS REAL: the built client in a browser; the platform server (server/
// app.js) in this process on its own SQLite file — sessions, practice issue /
// recognise / confirm / grade, the paid-call ceiling, the handwriting route
// and provider module. Every mark below was committed by the server.
//
// WHAT IS SYNTHETIC, and labelled so in the output: the handwriting READER
// (support/online-session.mjs). It never looks at the picture; it returns the
// lines this flow scripts. Nothing here is evidence about a real provider,
// real handwriting, a real photo, an iPad or a Pencil.
//
// WHICH QUESTION. The server chooses every question and refuses a caller's
// seed. To put the owner's exact question on the card, the test's desk seals a
// prepared-question token for it with this run's own local key and the page's
// issue request is answered by the REAL server binding that token. The answer
// is never given to the page.
//
// Run on its own:  node client/test/tour-photo-answer.js [--browser=webkit]
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { handwrite } from './fakeServerReader.js';

const EVIDENCE = 'SYNTHETIC-READER EVIDENCE';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const OWNER = { generator: 'c11-relations-functions', difficulty: 3, seed: 301 };
const OWNER_PROMPT = /least value taken by the real function/i;
// What the app showed the owner: every line of the page, the inequalities strict.
const OWNER_TRANSCRIPT = [
  { text: 'b = {40,50,60}.' },
  { text: 'b = {100,50,60}.' },
  { text: 'final:' },
  { text: 'a = {10,99,30}.' },
  { text: 'b = {100,50,60}.' },
  { text: 'f(x) = (x+3)^2 + 6', gap_before: true },
  // One strict sign the reader owns up to doubting, one it does not.
  { text: '(x+3)^2 > 0', uncertain: true, doubt: '>= or >' },
  { text: '(x+3)^2 + 6 > 6' },
  { text: 'least value => 6.' }
];
const NOTES = OWNER_TRANSCRIPT.slice(0, 5).map(l => l.text);

const shownId = page => page.locator('.qpage').first().getAttribute('data-question-id');
async function pressSubmit(page) {
  await page.waitForFunction(() => { const b = document.querySelector('.ws-actions .btn-primary'); return !!b && !b.disabled; }, null, { timeout: 20000 });
  await page.locator('.ws-actions .btn-primary').click();
}
const until = async (page, fn, ms = 15000) => {
  for (let waited = 0; waited < ms; waited += 150) { if (await fn()) return true; await page.waitForTimeout(150); }
  return !!(await fn());
};
/** The photo drafts this device holds, read straight from IndexedDB (ids and sizes only). */
const photoRows = page => page.evaluate(() => new Promise(done => {
  const open = indexedDB.open('pri-learning');
  open.onerror = () => done(null);
  open.onsuccess = () => {
    const db = open.result;
    const req = db.transaction('inkDrafts').objectStore('inkDrafts').getAll();
    req.onsuccess = () => { db.close(); done(req.result.filter(r => String(r.id).includes(':photo:')).map(r => ({ id: String(r.id), pid: String(r.pid), clearKeys: Object.keys(r).sort() }))); };
    req.onerror = () => { db.close(); done(null); };
  };
}));
const webStorageText = page => page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]))) + JSON.stringify(Object.fromEntries(Object.keys(sessionStorage).map(k => [k, sessionStorage.getItem(k)]))));
const lineState = page => page.evaluate(() => [...document.querySelectorAll('[data-photo-line]')].map(li => ({
  text: li.querySelector('input')?.value ?? '', out: li.getAttribute('data-excluded') === 'true',
  check: li.getAttribute('data-check') === 'true', edited: li.getAttribute('data-edited') === 'true',
  note: li.querySelector('.photo-line-note')?.innerText?.trim() || ''
})));

/** The page's own issue request, answered by the real server binding the desk's sealed token. */
async function serveOwnersQuestion(ctx, online, accountId) {
  const { encryptDeliveryToken } = await import('../../server/platform/deliveryCrypto.js');
  await ctx.route('**/v1/practice/issue', async route => {
    let body = null;
    try { body = route.request().postDataJSON(); } catch { body = null; }
    // WebKit does not always expose a fetch body to the harness. The profile
    // is signed in before the page asks, so every issue request in this flow
    // is a direct one; only a request seen to be binding a token is left alone.
    if (body && body.prepared !== undefined) return route.continue();
    const prepared = encryptDeliveryToken(JSON.stringify({
      g: OWNER.generator, d: OWNER.difficulty, s: OWNER.seed, m: 'practice', x: Date.now() + 60 * 60 * 1000, n: randomUUID()
    }), 'practice-prepared-v1');
    const response = await route.fetch({ postData: JSON.stringify({ prepared, account: String(accountId) }) });
    return route.fulfill({ response });
  });
}

export const ownerPageFlow = {
  id: 'photo-owner-page',
  online: true,
  name: 'Photo · the owner\'s page: notes left out, a sign corrected, answer 6 proposed, restored after reload, server-marked',

  async run({ page, ctx, base, check, goto, createProfile, mathText, note, online, browserName }) {
    note(`${EVIDENCE}: "Photo · the owner's page" [${browserName || 'chromium'}] uses a 1×1 test image and the scripted stand-in reader, which returns the owner's recorded transcript (it never looks at a picture). The server, its SQLite database, sign-in, issue / recognise / confirm / grade and every mark are real. Not real-photo, real-provider or real-device evidence — that is tools/acceptance/real-photo.mjs.`);
    const { reader } = online;
    try {
      reader.lines = OWNER_TRANSCRIPT; reader.confidence = 0.88; reader.down = false;
      await goto('/');
      await createProfile({ name: 'Photo Page', course: 'in', year: 11 });
      const account = await online.signIn({ name: 'Photo Page' });
      // Let the account panel's own requests finish before leaving Settings:
      // WebKit reports a fetch cut off by a navigation as a page error.
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await serveOwnersQuestion(ctx, online, account.id);
      await page.goto(`${base}/practice?subtopic=${OWNER.generator}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
      const prompt = await mathText('.q-prompt');
      const steered = OWNER_PROMPT.test(prompt) && /f\(x\)=\(x\+3\)\^?2\+6/.test(prompt.replace(/\s+/g, '').replace(/²/g, '2'));
      if (!steered && browserName === 'webkit') {
        // In WebKit the page's requests do not pass through this harness's
        // route (the same limit tour-write-sign-in.js records), so the desk
        // cannot put the owner's question on the card. What does not depend on
        // WHICH question it is still runs, on the question the server chose.
        note('NOT VERIFIED in WebKit: the owner\'s exact question could not be placed on the card (the harness route is not reached by WebKit\'s requests), so the default exclusion of the notes and the server\'s "correct, 3/3" are Chromium-only evidence. The WebKit run below covers reading, per-line doubt, manual exclusion, editing, the proposed answer, the sealed draft, restore after reload and an authoritative server reply, on a server-chosen question.');
        await webkitGeneric({ page, check, mathText, online, reader, account, prompt });
        return;
      }
      if (!await check('the server issued the owner\'s question: the least value of f(x) = (x + 3)² + 6', steered, prompt)) return;
      const qid = await shownId(page);
      const readsBefore = reader.requests.length;

      // ── the photo is attached and read ─────────────────────────────────────
      await page.getByRole('button', { name: /answer with a photo/i }).click();
      await page.locator('.editor-body input[type="file"]').setInputFiles({ name: 'page.png', mimeType: 'image/png', buffer: PNG });
      await page.locator('[data-photo-lines]').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
      const thumb = await page.locator('.photo-thumb img').getAttribute('src').catch(() => null);
      const sent = reader.requests.slice(readsBefore);
      await check(`the photo is read once, answer-blind: one request, one picture, nothing of the question [${EVIDENCE}]`,
        sent.length === 1 && sent.every(r => {
          const parts = (r.input || []).flatMap(m => m.content || []);
          const words = JSON.stringify(parts.filter(p => p.type !== 'input_image'));
          return parts.filter(p => p.type === 'input_image').length === 1 && !words.includes(prompt.slice(0, 24)) && !/real function|\(x ?\+ ?3\)/i.test(words);
        }), `${sent.length} provider request(s)`);
      let lines = await lineState(page);
      await check('every line the reader returned is on screen, in order — nothing is discarded',
        lines.length === 9 && NOTES.every((text, i) => lines[i].text === text) && /least value ⇒ 6\./.test(lines[8].text), JSON.stringify(lines.map(l => l.text)));
      await check('the five lines of set notes above the restated question are left out by default: struck through, labelled, still visible',
        lines.slice(0, 5).every(l => l.out && /left out/i.test(l.note)) && lines.slice(5).every(l => !l.out) &&
          await page.locator('[data-photo-left-out="5"]').isVisible() && /5 lines were left out because they look like other work/i.test(await page.locator('[data-photo-left-out]').innerText()),
        JSON.stringify(lines.map(l => l.out)));
      await check('the strict signs are shown as the reader returned them — ">" is not turned into "≥" for the student',
        lines[6].text === '(x+3)² > 0' && lines[7].text === '(x+3)² + 6 > 6' && !/≥/.test(lines[6].text + lines[7].text), JSON.stringify([lines[6].text, lines[7].text]));
      await check('the line the reader doubted says "Check this line" as a doubt about the reading (≥ or >), not about the maths',
        lines[6].check && /Check this line: the reader was not sure \(≥ or >\)/.test(lines[6].note) && !lines[7].check &&
          /doubt about how the page was read, not about your maths/i.test(await page.locator('[data-photo-reading-doubt]').innerText().catch(() => '')),
        JSON.stringify(lines[6]));
      const answerField = page.locator('[data-final-answer]');
      await check('the answer field holds "6" — the mathematics of the last line, not the sentence "least value ⇒ 6."',
        await answerField.inputValue() === '6' && await answerField.isEditable() &&
          await page.locator('[data-photo-answer-note="proposed"]').isVisible() && /taken from line 9/i.test(await page.locator('[data-photo-answer-note]').innerText()),
        JSON.stringify(await answerField.inputValue()));
      await check('reading marks nothing: no question recognised or graded until Submit is pressed',
        (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/(recognize|submit)/)).length === 0 && await page.locator('.eval-card, .verdict-bad').count() === 0);
      const status = page.locator('.ws-actions .status-line');
      await check('the status line says the photo and its reading are saved on this device — after the readback, and it is true',
        await until(page, async () => /Photo and reading saved on this device/.test(await status.innerText())) && (await photoRows(page))?.length === 1,
        `${JSON.stringify(await status.innerText())} rows ${JSON.stringify(await photoRows(page))}`);
      const rows = await photoRows(page);
      await check('the draft is one row bound to this profile and question; the photo is in no web storage',
        rows?.length === 1 && rows[0].id.endsWith(`:photo:${qid}`) && rows[0].id.startsWith(`${rows[0].pid}:`) &&
          !/data:image|least value|40,50,60/.test(await webStorageText(page)), JSON.stringify(rows));

      // ── bring the notes back, then leave them out again ────────────────────
      await page.locator('[data-photo-include-all]').click();
      lines = await lineState(page);
      await check('"Include them" brings all five back in one action, and the answer is still 6 (not a number from the notes)',
        lines.every(l => !l.out) && await answerField.inputValue() === '6' && await page.locator('[data-photo-left-out]').count() === 0, JSON.stringify(lines.map(l => l.out)));
      for (let i = 0; i < 5; i += 1) await page.locator(`[data-photo-line="${i}"] [data-photo-line-toggle]`).click();
      lines = await lineState(page);
      await check('each line can be left out again by the student, one tap each',
        lines.slice(0, 5).every(l => l.out) && lines.slice(5).every(l => !l.out) && await answerField.inputValue() === '6', JSON.stringify(lines.map(l => l.out)));

      // ── the student corrects > to ≥ on one line ────────────────────────────
      const seventh = page.locator('[data-photo-line="6"] input');
      await seventh.fill('(x+3)^2 >= 0');
      await page.locator('[data-final-answer]').focus();
      lines = await lineState(page);
      await check('line 7 is corrected from > to ≥ by the student: shown as ≥, marked "Corrected by you", no longer asking',
        lines[6].text === '(x+3)² ≥ 0' && lines[6].edited && !lines[6].check && /Corrected by you/.test(lines[6].note) && lines[7].text === '(x+3)² + 6 > 6', JSON.stringify(lines[6]));
      await until(page, async () => /Photo and reading saved on this device/.test(await status.innerText()));

      // ── reload mid-way ─────────────────────────────────────────────────────
      const readsBeforeReload = reader.requests.length;
      await page.waitForTimeout(600);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.q-prompt', { timeout: 30000 });
      await page.locator('[data-photo-lines]').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
      lines = await lineState(page);
      await check('after a reload: the same question, the same photo, Photo mode',
        await shownId(page) === qid && await mathText('.q-prompt') === prompt && await page.locator('.photo-thumb img').getAttribute('src').catch(() => null) === thumb &&
          await page.locator('[data-photo-restored]').isVisible());
      await check('the corrected line, the five exclusions and the answer 6 are all restored',
        lines.length === 9 && lines[6].text === '(x+3)² ≥ 0' && lines[6].edited && lines.slice(0, 5).every(l => l.out) && lines.slice(5).every(l => !l.out) &&
          await page.locator('[data-final-answer]').inputValue() === '6', JSON.stringify(lines.map(l => [l.text, l.out, l.edited])));
      await page.waitForTimeout(1500);
      await check('restoring costs no read: the reader was not asked again',
        reader.requests.length === readsBeforeReload, `${reader.requests.length - readsBeforeReload} provider request(s) after the reload`);
      await check('and the status line says saved again only after its own readback',
        await until(page, async () => /Photo and reading saved on this device/.test(await page.locator('.ws-actions .status-line').innerText())));

      // ── Submit ─────────────────────────────────────────────────────────────
      const ledgerBefore = online.platform.ledger(account.id);
      const callsBeforeSubmit = reader.requests.length;
      await pressSubmit(page);
      await page.waitForSelector('.eval-card', { timeout: 40000 }).catch(() => {});
      const graded = (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).at(-1);
      // Submit is one request: it carries the picture, and the receipt the
      // server takes is of the same picture — it reuses the read it kept, with
      // every per-line doubt intact, and pays nothing. (No separate /recognize
      // request is made; the kept read and the receipts are the server's own
      // records.)
      const kept = online.platform.keptReadLines(account.id).at(-1) || [];
      const readerReceipt = online.platform.readingReceipts(graded?.json?.questionId).find(r => r.correctedByStudent !== true);
      await check('the receipt read at Submit reuses the kept read — +0 provider calls — and the kept read still carries each line\'s doubt, layout gap and confidence',
        graded?.json?.reading?.reused === true && (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/recogni/)).length === 0 &&
          reader.requests.length === callsBeforeSubmit && kept.length === 9 &&
          kept[6].text === '(x+3)^2 > 0' && kept[6].uncertain === true && kept[6].doubt === '>= or >' && kept[7].uncertain === false && kept[7].doubt === null &&
          kept[5].gapBefore === true && kept[4].gapBefore === false && kept.every(l => l.confidence === 0.88) && readerReceipt?.providerNeedsConfirmation === true &&
          graded.json.reading.corrected === true,
        JSON.stringify({ reading: graded?.json?.reading, calls: reader.requests.length - callsBeforeSubmit, l6: kept[6], l5: kept[5], readerReceipt: readerReceipt && { needs: readerReceipt.providerNeedsConfirmation } }));
      await check('Submit sends the answer "6" in Photo mode with the four kept lines as working — the corrected line, and none of the set notes',
        graded?.body?.answer === '6' && graded.body.mode === 'photo' &&
          graded.body.steps === 'f(x) = (x+3)^2 + 6\n(x+3)^2 >= 0\n(x+3)^2 + 6 > 6\nleast value => 6.' && !/40,50,60|final:/.test(graded.body.steps),
        JSON.stringify(graded?.body));
      await check('the server marks it: correct, 3 of 3, resolved, with the worked solution',
        graded?.status === 200 && graded.json?.authoritative === true && graded.json.correct === true && graded.json.resolved === true &&
          graded.json.marksEarned === 3 && graded.json.marksPossible === 3 && !!graded.json.solution, JSON.stringify({ status: graded?.status, correct: graded?.json?.correct, marks: [graded?.json?.marksEarned, graded?.json?.marksPossible] }));
      const ledger = online.platform.ledger(account.id, graded?.json?.questionId);
      await check('one attempt is recorded for the account, and the card shows it as marked',
        ledger.completions === ledgerBefore.completions + 1 && ledger.thisDone === 1 && await page.locator('.eval-card').isVisible() &&
          await page.locator('.ws-actions .status-line').getAttribute('data-work-state') === 'submitted');
      await check('once marked, nothing of the photo stays on the device',
        await until(page, async () => (await photoRows(page))?.length === 0), JSON.stringify(await photoRows(page)));
      await check('no provider was reached but the scripted reader', reader.refused.length === 0, JSON.stringify(reader.refused));
    } finally {
      reader.lines = null;
    }
  }
};

/** The parts of the photo journey that do not depend on which question is on the card. */
async function webkitGeneric({ page, check, mathText, online, reader, account, prompt }) {
  const qid = await shownId(page);
  if ((await page.locator('.qpage').first().getAttribute('data-mode')) === 'mcq' || !await page.getByRole('button', { name: /answer with a photo/i }).count()) {
    await check('a written-answer question is on the card', false, 'the server chose a multiple-choice question; run again');
    return;
  }
  const readsBefore = reader.requests.length;
  await page.getByRole('button', { name: /answer with a photo/i }).click();
  await page.locator('.editor-body input[type="file"]').setInputFiles({ name: 'page.png', mimeType: 'image/png', buffer: PNG });
  await page.locator('[data-photo-lines]').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  let lines = await lineState(page);
  await check(`the photo is read once and every line is on screen, strict signs as returned [${EVIDENCE}]`,
    reader.requests.length === readsBefore + 1 && lines.length === 9 && lines[6].text === '(x+3)² > 0' && lines[8].text === 'least value ⇒ 6.', JSON.stringify(lines.map(l => l.text)));
  await check('the doubted line says "Check this line" as a doubt about the reading', lines[6].check && /reader was not sure \(≥ or >\)/.test(lines[6].note), JSON.stringify(lines[6]));
  const answerField = page.locator('[data-final-answer]');
  await check('the answer field holds "6", not the sentence', await answerField.inputValue() === '6', JSON.stringify(await answerField.inputValue()));
  for (let i = 0; i < 5; i += 1) await page.locator(`[data-photo-line="${i}"] [data-photo-line-toggle]`).click();
  await page.locator('[data-photo-line="6"] input').fill('(x+3)^2 >= 0');
  await answerField.focus();
  lines = await lineState(page);
  await check('lines are left out one tap each, and a line is corrected from > to ≥',
    lines.slice(0, 5).every(l => l.out) && lines.slice(5).every(l => !l.out) && lines[6].text === '(x+3)² ≥ 0' && lines[6].edited, JSON.stringify(lines.map(l => [l.text, l.out])));
  const status = page.locator('.ws-actions .status-line');
  await check('saved on this device, by readback: one sealed row, no photo in web storage',
    await until(page, async () => /Photo and reading saved on this device/.test(await status.innerText())) && (await photoRows(page))?.length === 1 && !/data:image/.test(await webStorageText(page)));
  const thumb = await page.locator('.photo-thumb img').getAttribute('src').catch(() => null);
  const readsBeforeReload = reader.requests.length;
  await page.waitForTimeout(600);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.q-prompt', { timeout: 30000 });
  await page.locator('[data-photo-lines]').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  lines = await lineState(page);
  await page.waitForTimeout(1200);
  await check('after a reload: the same question and photo, the corrected line, the exclusions and the answer, with no second read',
    await shownId(page) === qid && await mathText('.q-prompt') === prompt && await page.locator('.photo-thumb img').getAttribute('src').catch(() => null) === thumb &&
      lines.length === 9 && lines[6].text === '(x+3)² ≥ 0' && lines.slice(0, 5).every(l => l.out) && await page.locator('[data-final-answer]').inputValue() === '6' &&
      reader.requests.length === readsBeforeReload, JSON.stringify({ lines: lines.map(l => [l.text, l.out]), reads: reader.requests.length - readsBeforeReload }));
  await pressSubmit(page);
  await until(page, async () => (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).length > 0, 40000);
  const graded = (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).at(-1);
  await check('Submit sends "6" in Photo mode with the four kept lines, and the server answers authoritatively (this is not the owner\'s question, so the verdict itself is not asserted)',
    graded?.body?.answer === '6' && graded.body.mode === 'photo' && graded.body.steps === 'f(x) = (x+3)^2 + 6\n(x+3)^2 >= 0\n(x+3)^2 + 6 > 6\nleast value => 6.' &&
      graded.status === 200 && graded.json?.authoritative === true && typeof graded.json.correct === 'boolean', JSON.stringify({ body: graded?.body, status: graded?.status }));
  void account;
}

export const usageLimitFlow = {
  id: 'reader-usage-limit',
  online: true,
  name: 'Reader · usage limit reached: named with its reopening time, no request storm, Try again sends one, typing still marked',

  async run({ page, base, check, goto, createProfile, settle, note, online, browserName }) {
    note(`${EVIDENCE}: "Reader · usage limit reached" [${browserName || 'chromium'}] runs the real server with its own paid-call ceiling set to 1 an hour (PRI_PAID_CALLS_PER_HOUR=1); the refusals are the server's. The reader behind the first read is the scripted stand-in.`);
    const { reader } = online;
    const db = online.platform?.h?.db;
    const saved = { hour: process.env.PRI_PAID_CALLS_PER_HOUR, day: process.env.PRI_PAID_CALLS_PER_DAY };
    const transcribes = [];
    page.on('request', request => { if (request.method() === 'POST' && /\/v1\/handwriting\/transcribe$/.test(new URL(request.url()).pathname)) transcribes.push(Date.now()); });
    const refusals = [];
    page.on('response', async response => {
      if (!/\/v1\/handwriting\/transcribe$/.test(new URL(response.url()).pathname) || response.status() !== 503) return;
      refusals.push({ status: 503, body: await response.json().catch(() => null), reset: response.headers()['ratelimit-reset'] || null });
    });
    try {
      reader.lines = null; reader.text = '7'; reader.confidence = 0.97; reader.down = false;
      await goto('/');
      await createProfile({ name: 'Limit Journey', course: 'in', year: 10 });
      const account = await online.signIn({ name: 'Limit Journey' });
      // Let the account panel's own requests finish before leaving Settings:
      // WebKit reports a fetch cut off by a navigation as a page error.
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      // The deployment-wide ceiling, as the server reads it on every paid call.
      db.prepare("DELETE FROM rate_limits WHERE bucket LIKE 'paid-provider:%'").run();
      process.env.PRI_PAID_CALLS_PER_HOUR = '1';
      process.env.PRI_PAID_CALLS_PER_DAY = '50';
      await page.goto(`${base}/practice?subtopic=c10-arithmetic-progressions`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
      for (let skips = 0; skips < 14; skips += 1) {
        if (await page.locator('.qpage').first().getAttribute('data-mode') !== 'mcq' && await page.getByRole('button', { name: 'Answer by handwriting' }).count()) break;
        const leaving = await shownId(page);
        await page.locator('.ctx-next').click();
        await page.waitForFunction(id => document.querySelector('.qpage[data-question-id]')?.getAttribute('data-question-id') !== id, leaving, { timeout: 30000 });
        await settle();
      }
      await page.getByRole('button', { name: 'Answer by handwriting' }).click();
      await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
      const status = page.locator('.ws-actions .status-line');

      // ── first read: inside the ceiling ─────────────────────────────────────
      await handwrite(page, await page.locator('.ink-canvas-live').boundingBox(), '7');
      await check(`the first read works: one request, and the reading is shown [${EVIDENCE}]`,
        await until(page, async () => await page.locator('.ink-preview .ink-line').count() === 1, 20000) && transcribes.length === 1 && refusals.length === 0,
        `${transcribes.length} request(s), ${refusals.length} refusal(s)`);

      // ── second read: the server's ceiling ──────────────────────────────────
      await handwrite(page, await page.locator('.ink-canvas-live').boundingBox(), '1', { x: 160 });
      const inkStatus = page.locator('.ink-status-line');
      await check('the second read is refused by the server\'s own ceiling: 503 PAID_CAPACITY_REACHED, with when it resets',
        await until(page, async () => refusals.length === 1, 20000) && refusals[0].body?.error?.code === 'PAID_CAPACITY_REACHED' &&
          (Number(refusals[0].reset) * 1000 > Date.now() || Number(refusals[0].body?.error?.resetAt) > Date.now()) &&
          !/on your device|on-device/i.test(refusals[0].body?.error?.message || ''), JSON.stringify(refusals[0] || null));
      const said = (await inkStatus.innerText().catch(() => '')).replace(/\s+/g, ' ');
      await check('the student is told it is a usage limit, that the work is still here, that typing works, and the time to try again',
        /Handwriting checking has reached its usage limit for now\. Your work is still here\. You can type your answer, or try again at \d{1,2}:\d{2}/.test(said) &&
          !/isn.t answering|tried again shortly|on.device/i.test(said), said);
      await check('one work state for it — "usage-limit" — and the save line still says only what the readback proved',
        await until(page, async () => await status.getAttribute('data-work-state') === 'usage-limit') && /^Saved on this device/.test((await status.innerText()).trim()),
        `${await status.getAttribute('data-work-state')} · ${JSON.stringify(await status.innerText())}`);
      await check('nothing was marked and no try was spent by the refusal',
        (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/(recognize|submit)/)).length === 0 && await page.locator('.eval-card, .verdict-bad').count() === 0 && online.platform.ledger(account.id).completions === 0);

      // ── no request storm ───────────────────────────────────────────────────
      const sentAtRefusal = transcribes.length;
      await page.waitForTimeout(5000);
      await handwrite(page, await page.locator('.ink-canvas-live').boundingBox(), '1', { x: 280 });   // more writing must not re-send either
      await page.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForTimeout(5500);
      await check('over ten seconds — with more writing and a return to the tab — not one more read is sent',
        transcribes.length === sentAtRefusal && sentAtRefusal === 2, `${transcribes.length - sentAtRefusal} extra request(s); ${transcribes.length} in all`);
      await check('and the page still says usage limit, not "reading" and not a wrong answer',
        /usage limit/.test(await inkStatus.innerText()) && await page.locator('.verdict-bad').count() === 0);

      // ── Try again sends exactly one ────────────────────────────────────────
      const retry = page.locator('[data-ink-retry-reading][data-reader-block="capacity"]');
      await check('a "Try again" button is offered', await retry.isVisible());
      await retry.click();
      await until(page, async () => refusals.length === 2, 15000);
      await page.waitForTimeout(2500);
      await check('pressing it sends exactly one new request, which the server refuses again, and the page waits again',
        transcribes.length === sentAtRefusal + 1 && refusals.length === 2 && /usage limit/.test(await inkStatus.innerText()), `${transcribes.length - sentAtRefusal} request(s) after the press`);

      // ── and typing is still checked by the server ──────────────────────────
      await page.locator('[data-type-instead]').first().click();
      const right = await online.answerOf();
      if (!await check('"Type your answer instead" opens the typed field; the right answer is known only at the test\'s desk',
        await page.locator('[data-final-answer]').isVisible() && typeof right.text === 'string' && right.text.length > 0, JSON.stringify({ kind: right.kind }))) return;
      await page.locator('[data-final-answer]').fill(right.text);
      await pressSubmit(page);
      await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
      const graded = (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).at(-1);
      await check('the typed answer is marked by the server on the first try, with full marks: the refusals spent nothing',
        graded?.status === 200 && graded.body?.mode === 'typed' && graded.json?.authoritative === true && graded.json.correct === true && graded.json.resolved === true &&
          graded.json.marksEarned === graded.json.marksPossible && online.platform.ledger(account.id).completions === 1,
        JSON.stringify({ status: graded?.status, mode: graded?.body?.mode, correct: graded?.json?.correct, marks: [graded?.json?.marksEarned, graded?.json?.marksPossible] }));
      await check('typing needed no read: the request count did not move', transcribes.length === sentAtRefusal + 1, `${transcribes.length}`);
      await check('no provider was reached but the scripted reader, and only once', reader.refused.length === 0, JSON.stringify(reader.refused));
    } finally {
      for (const [name, value] of [['PRI_PAID_CALLS_PER_HOUR', saved.hour], ['PRI_PAID_CALLS_PER_DAY', saved.day]]) {
        if (value === undefined) delete process.env[name]; else process.env[name] = value;
      }
      try { db.prepare("DELETE FROM rate_limits WHERE bucket LIKE 'paid-provider:%'").run(); } catch { /* the platform is closing */ }
    }
  }
};

export const flows = [ownerPageFlow, usageLimitFlow];

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runFlows } = await import('./e2e.mjs');
  process.exit(await runFlows(flows) ? 1 : 0);
}
