// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — handwriting, through the real canvas.
//
// This is the assertion the project has been missing. Five suites measure the
// recogniser — 40 trials a symbol, held-out writers, whole lines of working —
// and every one of them calls recognize() directly in Node. None of them mounts
// the canvas. So the entire path between a pen and a mark is untested: pointer
// capture, the 1€ filter, coalesced-event accumulation, the stroke buffer, the
// 240 ms debounce, the reading panel, the confidence gate that can hold a
// submit back, and the answer the card finally posts. A regression anywhere in
// there would leave all five ink suites green and the app unusable.
//
// So this flow writes an answer by hand — real pointer events, one stroke at a
// time, from the same template geometry the recogniser suites are scored on —
// and follows it all the way to a mark — the SERVER's mark, on a question the
// server issued, for a profile signed in to the real platform server this suite
// boots. It knows what the answer is from the test's own oracle (see
// support/online-session.mjs), never from the device.
//
// Run on its own:  node client/test/tour-ink.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { handwrite, pressRead, readLines, turnOnServerReading } from './fakeServerReader.js';
import { SYNTHETIC_EVIDENCE } from './support/online-session.mjs';

const TOPIC = 'y7-equations';
const MAX_QUESTIONS = 8;

const SUBMIT = { name: 'Submit Answer' };

/** What the reading panel says it read, line by line. */
const reading = (page) => readLines(page);
const readingArrives = (page) => page.waitForSelector('.ink-line', { timeout: 15000 }).catch(() => {});

export const flow = {
  id: 'ink',
  name: 'Ink · handwriting on the real canvas',
  online: true,

  async run({ page, ctx, base, check, note, goto, createProfile, mathText, settle, online }) {
    // Handwriting is read only by the server reader (owner decision), and only
    // the server marks. The profile is signed in to the real platform server;
    // the one synthetic part is the reader's provider hop, a stand-in that
    // returns what this flow scripts and never looks at the picture.
    const reader = online.reader;
    Object.assign(reader, { text: '1', confidence: 0.97, down: false });
    reader.requests.length = 0;
    note(`${SYNTHETIC_EVIDENCE}: the handwriting reader in "Ink · handwriting on the real canvas" is a scripted stand-in (it returns the text this flow sets, at a set confidence). The canvas, the server routes, the receipts and every mark are real. Not real-handwriting, real-provider or real-device evidence.`);
    await goto('/');
    await createProfile({ name: 'Ada Byron', year: 7 });
    await online.signIn({ name: 'Ada Byron' });
    await check('server reading is on for this signed-in profile', await turnOnServerReading(page, base));

    // ── 1 · a question worth writing ─────────────────────────────────────────
    // Only a short whole number is hand-written here. Every glyph the flow draws
    // has to come from the template set, and an answer of "3/8" or "12.5 cm"
    // would be testing the layout engine's fraction stacking rather than the
    // path from a stroke to a mark. The answer is the oracle's: regenerated at
    // the test's desk from the generator, difficulty and seed the page asked
    // the server to issue (support/online-session.mjs) — never read off the
    // device, which holds no key for a server-issued question.
    await page.goto(`${base}/practice?subtopic=${TOPIC}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });

    const typeTab = page.getByRole('button', { name: 'Answer by typing' });
    const answerBox = page.locator('.editor-body input.answer-input');
    let answer = null;
    let asked = 0;
    for (; asked < MAX_QUESTIONS && !answer; asked++) {
      if (await typeTab.count()) await typeTab.click();
      await settle();
      if (await answerBox.count() === 1) {
        const known = await online.answerOf();
        if (known.kind === 'text' && /^\d{1,3}$/.test(String(known.text))) { answer = String(known.text); break; }
      }
      const leaving = (await online.shownRow())?.id;
      await page.locator('.ctx-next').click();
      await page.waitForFunction(id => {
        const el = document.querySelector('.qpage[data-question-id]');
        return el && el.getAttribute('data-question-id') !== id && el.querySelector('.q-prompt');
      }, leaving, { timeout: 30000 });
    }
    if (!await check('a question with a short whole-number answer was found', !!answer,
      `${asked} questions from ${TOPIC} and none had an answer worth hand-writing`)) return;

    const prompt = await mathText('.q-prompt');

    // ── 2 · the canvas mounts ────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Answer by handwriting' }).click();
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    const canvas = page.locator('.ink-canvas-live');
    const box = await canvas.boundingBox();
    await check('the handwriting canvas mounts with a drawable area',
      !!box && box.width > 200 && box.height > 200,
      `canvas box ${JSON.stringify(box)}`);
    await check('an empty canvas is reading nothing',
      await page.locator('.ink-preview').count() === 0,
      'the reading panel was up before a single stroke was drawn');

    // ── 3 · strokes drawn with the pointer go to the reader ─────────────────
    reader.text = '1';
    const callsBeforeWriting = reader.requests.length;
    await handwrite(page, box, '1');
    // Read on request (owner decision): writing is saved, and NOTHING is read
    // until the student asks. A pause used to send a paid read after 1.1 s.
    await page.waitForTimeout(2600);
    const readButton = page.locator('[data-ink-read="first"]');
    const submitBefore = page.getByRole('button', SUBMIT);
    await check('after writing and pausing, no read was sent: no request, no transcript, and an obvious "Read my answer" beside the work',
      reader.requests.length === callsBeforeWriting && (await page.locator('.ink-line').count()) === 0 &&
        await readButton.isVisible() && (await readButton.innerText()).trim() === 'Read my answer' && await readButton.evaluate(el => el.classList.contains('btn-primary')),
      `${reader.requests.length - callsBeforeWriting} request(s); ${await page.locator('.ink-line').count()} line(s)`);
    await check('Submit is not available for handwriting that has not been read, and says why: "Read your answer first"',
      await submitBefore.isDisabled() && /Read your answer first/.test(await page.locator('[data-submit-reason="ink.submitReadFirst"]').innerText().catch(() => '')) &&
        await page.locator('.ws-actions .status-line').getAttribute('data-work-state') === 'awaiting-reading',
      `state ${await page.locator('.ws-actions .status-line').getAttribute('data-work-state')}`);
    await readButton.focus();
    await page.keyboard.press('Enter');     // reachable and operable from the keyboard
    await readingArrives(page);
    await check('a stroke drawn with the pointer is sent and read back',
      (await reading(page)).length === 1 && reader.requests.length >= 1,
      `${reader.requests.length} requests; read ${JSON.stringify(await reading(page))}`);
    // Answer-blind at both hops: what the page sent the server, and what the
    // server's provider module sent on to the (stand-in) reader.
    const readCalls = async () => (await online.practiceCalls(/^\/v1\/(?:handwriting\/transcribe|practice\/[^/]+\/recognize)$/));
    const pageSent = (await readCalls()).at(-1);
    const sent = reader.requests.at(-1);
    const sentParts = (sent?.input || []).flatMap(m => m.content || []);
    await check('the request is the picture of the ink and nothing else — answer-blind',
      !!pageSent && Object.keys(pageSent.body || {}).every(k => ['image', 'mode'].includes(k)) && /^data:image\//.test(pageSent.body?.image || '') &&
        sentParts.filter(part => part.type === 'input_image').length === 1 &&
        !JSON.stringify(sentParts.filter(part => part.type !== 'input_image')).includes(prompt.slice(0, 24)),
      `page sent ${JSON.stringify(pageSent && Object.keys(pageSent.body || {}))} to ${pageSent?.path}; provider request keys ${JSON.stringify(sent && Object.keys(sent))}`);

    await check('the footer says the server read it',
      /Read by Pri’s server reader/.test(await page.locator('.editor-foot').innerText().catch(() => '')));
    // One read of one picture is one provider call; more ink is a different
    // picture and is read afresh — exactly one more call.
    const firstRead = (await readCalls()).at(-1);
    await check('that first read was a provider read, not a reused one', firstRead?.status === 200 && firstRead.json?.reused === false,
      JSON.stringify({ status: firstRead?.status, reused: firstRead?.json?.reused }));
    const callsBeforeRewrite = reader.requests.length;
    const pageReadsBeforeRewrite = (await readCalls()).length;
    reader.text = '17';
    await handwrite(page, box, '7', { x: 150 });
    await page.waitForTimeout(2600);
    // The ink changed after it was read: the transcript stays, labelled as
    // from earlier writing; it cannot be submitted; nothing was re-read.
    await check('editing the ink after a read marks the transcript stale: still shown, labelled, Submit unavailable with the reason, "Read again" offered — and no read sent',
      (await reading(page))[0] === '1' && await page.locator('[data-ink-stale]').isVisible() && /earlier writing/i.test(await page.locator('[data-ink-stale]').innerText()) &&
        await page.getByRole('button', SUBMIT).isDisabled() && await page.locator('[data-submit-reason="ink.submitReadAgain"]').isVisible() &&
        (await page.locator('[data-ink-read="again"]').innerText()).trim() === 'Read again' &&
        reader.requests.length === callsBeforeRewrite && (await readCalls()).length === pageReadsBeforeRewrite,
      `read ${JSON.stringify(await reading(page))}; provider calls +${reader.requests.length - callsBeforeRewrite}`);
    await pressRead(page);
    for (let i = 0; i < 60 && (await reading(page))[0] !== '17'; i++) await page.waitForTimeout(150);
    await page.waitForTimeout(1500);
    const rewriteRead = (await readCalls()).at(-1);
    await check('reading the rewritten ink costs exactly one more provider read: one page request, one provider call, not reused, and the transcript is current again',
      (await reading(page))[0] === '17' && await page.locator('[data-ink-stale]').count() === 0 && reader.requests.length === callsBeforeRewrite + 1 && (await readCalls()).length === pageReadsBeforeRewrite + 1 && rewriteRead?.json?.reused === false,
      `provider calls +${reader.requests.length - callsBeforeRewrite}; page requests +${(await readCalls()).length - pageReadsBeforeRewrite}; reused ${rewriteRead?.json?.reused}; read ${JSON.stringify(await reading(page))}`);

    await page.locator('.ink-tool[title="Clear"]').click();
    await settle();
    await check('Clear empties the canvas', await page.locator('.ink-preview').count() === 0,
      `${await page.locator('.ink-line').count()} lines survived a Clear`);

    // ── 3b · offline: no reading, the ink is kept, and it is read on reconnect
    reader.text = answer;
    await ctx.setOffline(true);
    await handwrite(page, box, answer);
    await page.waitForSelector('.ink-status', { timeout: 10000 }).catch(() => {});
    const offlineNote = (await page.locator('.ink-status').innerText().catch(() => '')) || '';
    await check('offline, nothing is read or offered for marking, and the student is told why',
      await page.locator('.ink-preview').count() === 0 && /needs a connection/.test(offlineNote),
      `status ${JSON.stringify(offlineNote)}; ${await page.locator('.ink-line').count()} lines shown`);
    // The save claim is the card's (an IndexedDB readback), so the sentence may
    // carry "Saved." only once that readback has landed.
    const savedOfflineNote = await page.waitForFunction(() => /^Saved\. /.test((document.querySelector('.ink-status')?.innerText || '').trim()), null, { timeout: 8000 }).then(() => page.locator('.ink-status').innerText(), () => offlineNote);
    await check('and told plainly that it is saved and what to do: "Saved. … When you are back online, press Read my answer." — with no "Read my answer" button that could not work',
      /^Saved\. /.test(savedOfflineNote.trim()) && /When you are back online, press Read my answer\./.test(savedOfflineNote) && await page.locator('[data-ink-read]').count() === 0, JSON.stringify(savedOfflineNote));
    // The kept page is a row in the inkDrafts IndexedDB store (sealed when the
    // profile has a password), and nothing of it is in localStorage.
    await page.waitForTimeout(700);   // the store coalesces pen-lifts into one write
    const keptRows = await page.evaluate(() => new Promise(ok => {
      const r = indexedDB.open('pri-learning');
      r.onsuccess = () => {
        const db = r.result;
        let req;
        try { req = db.transaction('inkDrafts').objectStore('inkDrafts').getAll(); } catch (e) { db.close(); return ok({ error: String(e) }); }
        req.onsuccess = () => { db.close(); ok(req.result.map(row => ({ id: String(row.id), strokes: Array.isArray(row.strokes) ? row.strokes.length : (row.sealed ? 'sealed' : 0) }))); };
        req.onerror = () => { db.close(); ok({ error: 'read failed' }); };
      };
      r.onerror = () => ok({ error: 'open failed' });
    }));
    await check('the kept page is one row in the sealed inkDrafts store',
      Array.isArray(keptRows) && keptRows.length === 1 && (keptRows[0].strokes === 'sealed' || keptRows[0].strokes > 0), JSON.stringify(keptRows));
    const plaintextInk = await page.evaluate(() => Object.keys(localStorage).filter(k => /\.ink\./.test(k) || /"strokes"/.test(String(localStorage.getItem(k)))));
    await check('and no handwriting sits in localStorage', plaintextInk.length === 0, JSON.stringify(plaintextInk));

    // ── 3c · the app goes away mid-offline; the page comes back, still unread ─
    // Online again, but the reader is not answering yet: the kept page must be
    // restored from the store, offered to the reader (which proves the strokes
    // came back), and go on waiting — no mark, nothing lost.
    reader.down = true;
    await ctx.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForTimeout(1500);
    const requestsBeforeReload = reader.requests.length;
    const readsBeforeReload = (await readCalls()).length;
    await check('coming back online sends no read by itself: the offline note goes and "Read my answer" is offered',
      reader.requests.length === requestsBeforeReload && await page.locator('[data-ink-read]').isVisible() && !/offline/i.test((await page.locator('.ink-status').innerText().catch(() => '')) || ''));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await check('after the reload the same question is back', await mathText('.q-prompt') === prompt,
      `again: ${JSON.stringify(await mathText('.q-prompt'))}`);
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    const canvasAfter = await page.locator('.ink-canvas-live').boundingBox();
    await check('and the card came back to the pen by itself', !!canvasAfter && canvasAfter.width > 200);
    await page.locator('[data-ink-read]').waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2600);
    // Restoring is not reading: the kept strokes are back (the Read action is
    // offered for them) and not one request has been sent.
    await check('the kept strokes were restored and NOT sent to the reader: no page request, no provider call, "Read my answer" offered',
      (await readCalls()).length === readsBeforeReload && reader.requests.length === requestsBeforeReload && await page.locator('[data-ink-read="first"]').isVisible(),
      `${(await readCalls()).length - readsBeforeReload} page request(s), ${reader.requests.length - requestsBeforeReload} provider call(s) after the reload`);
    await pressRead(page);
    for (let i = 0; i < 60 && reader.requests.length === requestsBeforeReload; i++) await page.waitForTimeout(200);
    await page.waitForTimeout(1500);
    const readsAfter = await readCalls();
    const restoredSent = readsAfter.at(-1);
    const providerCalls = reader.requests.length - requestsBeforeReload;
    // One press, one request. (The server may put that one request to its
    // fallback model when the first answers 5xx, so the provider can see two.)
    await check('pressing Read my answer offers the restored strokes to the reader once (one request, a picture, nothing else)',
      readsAfter.length === readsBeforeReload + 1 && providerCalls >= 1 && providerCalls <= 2 &&
        Object.keys(restoredSent?.body || {}).every(k => ['image', 'mode'].includes(k)) && /^data:image\//.test(restoredSent?.body?.image || ''),
      `${readsAfter.length - readsBeforeReload} page request(s), ${providerCalls} provider call(s) after the press; page sent ${JSON.stringify(Object.keys(restoredSent?.body || {}))}`);
    await page.waitForSelector('.ink-status', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);
    const downNote = (await page.locator('.ink-status').innerText().catch(() => '')) || '';
    await check('with the reader down the page says so, saved, with a Try again — and does not retry by itself',
      /isn’t answering/.test(downNote) && /saved/i.test(downNote) && await page.locator('[data-ink-retry-reading]').isVisible() && await page.locator('.eval-card').count() === 0 &&
        (await readCalls()).length === readsBeforeReload + 1, JSON.stringify(downNote));
    reader.down = false;
    await ctx.setOffline(true);
    // The connection flaps before it settles. No return reads the kept page by
    // itself; the student asks once, and the answer is marked exactly once.
    const attemptCount = () => page.evaluate(() => new Promise(ok => {
      const r = indexedDB.open('pri-learning');
      r.onsuccess = () => { const db = r.result; const c = db.transaction('attempts').objectStore('attempts').count();
        c.onsuccess = () => { db.close(); ok(c.result); }; c.onerror = () => { db.close(); ok(-1); }; };
      r.onerror = () => ok(-1);
    }));
    const attemptsBefore = await attemptCount();
    const flapReadsBefore = (await readCalls()).length, flapCallsBefore = reader.requests.length;
    for (let flap = 0; flap < 4; flap++) {
      await ctx.setOffline(false);
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
      await page.waitForTimeout(40 + flap * 30);
      await ctx.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));
      await page.waitForTimeout(60);
    }
    await ctx.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForTimeout(1500);
    const callsAfterFlaps = reader.requests.length;
    await check('a flapping connection sends no read at all', (await readCalls()).length === flapReadsBefore && reader.requests.length === flapCallsBefore,
      `${(await readCalls()).length - flapReadsBefore} page request(s) across the flaps`);
    // A refusal note from before may still offer Try again; either is the student's own press.
    if (!await pressRead(page, { timeout: 3000 })) await page.locator('[data-ink-retry-reading]').click();
    await readingArrives(page);
    await check('one press reads the kept ink: exactly one request', reader.requests.length === callsAfterFlaps + 1, `${reader.requests.length - callsAfterFlaps}`);

    // ── 4 · the answer, written by hand, is read back ────────────────────────
    const lines = await reading(page);
    await check('back online, the kept ink is read as one line when asked', lines.length === 1,
      `read ${lines.length} lines: ${JSON.stringify(lines)}`);
    if (!await check(`the server reading ${JSON.stringify(answer)} is what the card will mark`,
      lines[0] === answer, `read ${JSON.stringify(lines[0])}`)) return;
    const notAnswer = reader.requests.every(r => !JSON.stringify(r).includes(`"${answer}"`) || false);
    await check('no request ever carried the expected answer', notAnswer);

    const asMaths = await mathText('.ink-line-math');
    await check('the reading is set as maths, not as loose characters',
      !!asMaths && asMaths.length > 0, `reading panel renders ${JSON.stringify(asMaths)}`);

    // ── 5 · the kept answer is read and waits; the student's Submit marks it ──
    // The student was told it "will be read when you are back online". Nothing
    // is sent to be marked by the reading arriving: the card shows the reading
    // and the mark comes from a press of Submit. A doubtful reading asks first.
    const confirm = page.getByRole('button', { name: 'That’s what I wrote' });
    await page.waitForTimeout(2500);
    const markedByItself = await page.locator('.eval-card').count();
    const callsBeforeSubmit = reader.requests.length;
    await page.getByRole('button', SUBMIT).click();
    await page.waitForSelector('.eval-card', { timeout: 20000 }).catch(async () => {
      if (await confirm.count()) {
        note('the reading was doubtful enough to ask first, so the flow confirmed it — the designed path');
        await confirm.click();
        await page.waitForSelector('.eval-card', { timeout: 20000 });
      }
    });
    await check('back online, the kept handwriting is read and waits: nothing is marked until Submit is pressed, and then it is',
      markedByItself === 0 && await page.locator('.eval-card').count() === 1, `${markedByItself} verdict(s) before the press`);
    await page.waitForTimeout(2500);   // anything still queued would land now
    // Exactly once, on the server and on the device: one grade, ONE attempt
    // row, and that row carries the server's attempt id.
    const attemptRows = await page.evaluate(() => new Promise(ok => {
      const r = indexedDB.open('pri-learning');
      r.onsuccess = () => { const db = r.result; const c = db.transaction('attempts').objectStore('attempts').getAll();
        c.onsuccess = () => { db.close(); ok(c.result.map(a => ({ remote: typeof a.remoteEventId === 'string', server: a.serverAttemptId || a.remoteEventId || null }))); };
        c.onerror = () => { db.close(); ok(null); }; };
      r.onerror = () => ok(null);
    }));
    const flapGrades = (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).filter(c => c.status === 200);
    await check('a flapping connection marks the kept answer exactly once: one server grade, one attempt row on this device, for that server attempt',
      attemptsBefore === 0 && flapGrades.length === 1 && !!attemptRows && attemptRows.length === 1 && !attemptRows[0].remote &&
        attemptRows[0].server === flapGrades[0].json?.attemptId,
      `attempts before ${attemptsBefore}; rows ${JSON.stringify(attemptRows)}; ${flapGrades.length} server grade(s)`);
    const marked = (await page.locator('.eval-card').innerText()).replace(/\s+/g, ' ');
    const marks = (await page.locator('.eval-marks').innerText()).replace(/\s+/g, ' ').trim();
    await check('the handwritten answer is marked correct — every mark awarded',
      /^(\d+(?:\.\d)?) \/ \1 marks\b/.test(marks), `marks read ${JSON.stringify(marks)}`);
    const provenance = (await page.locator('.eval-card .eval-provenance').innerText().catch(() => '')) || '';
    await check('the verdict says who read it and who marked it: "Read by AI, marked by Pri’s engine"',
      /Read by AI, marked by Pri’s engine/.test(provenance), `provenance reads ${JSON.stringify(provenance)}`);
    await check('and that line is readable, not hidden from assistive technology',
      await page.locator('.eval-card .eval-provenance[aria-hidden="true"]').count() === 0);
    await check('and it is not told what was expected instead',
      !/Expected:/.test(marked), `evaluation reads ${JSON.stringify(marked.slice(0, 200))}`);
    await check('the read line is ticked in the reading panel',
      await page.locator('.ink-line-verdict.good').count() >= 1,
      'the marker drew no ✓ beside the student’s reading');
    await check('and on the ink itself — the server line is placed on the written line',
      await page.locator('.ink-verdict.good').count() >= 1,
      'no ✓ drawn on the student’s own writing');

    // ── 5b · and the mark was the server's ───────────────────────────────────
    const inkRow = await online.shownRow();
    // The receipt the server takes at Submit is of the picture it has just
    // read for the transcript: the kept read is reused, and no second provider
    // call is paid for the same unchanged ink.
    const submitReceipts = await online.practiceCalls(new RegExp(`^/v1/practice/${inkRow?.serverQuestionId}/recognize$`));
    await check('Submit after an unchanged read costs no further provider read: one receipt, reused: true, +0 provider calls',
      submitReceipts.length === 1 && submitReceipts[0].status === 201 && submitReceipts[0].json?.reused === true && reader.requests.length === callsBeforeSubmit,
      `recognize ${JSON.stringify(submitReceipts.map(c => [c.status, c.json?.reused]))}; provider calls +${reader.requests.length - callsBeforeSubmit}`);
    const inkGrades = await online.practiceCalls(new RegExp(`^/v1/practice/${inkRow?.serverQuestionId}/submit$`));
    await check('the handwritten answer was marked by the server, once, against its own reading receipt',
      inkGrades.length === 1 && inkGrades[0].status === 200 && inkGrades[0].json?.authoritative === true &&
        inkGrades[0].json.correct === true && inkGrades[0].json.resolved === true && inkGrades[0].body?.mode === 'ink' &&
        typeof inkGrades[0].body?.transcriptionReceipt === 'string' && !('answer' in inkGrades[0].body && inkGrades[0].body.answer === undefined),
      JSON.stringify(inkGrades.map(c => ({ status: c.status, mode: c.body?.mode, receipt: typeof c.body?.transcriptionReceipt, json: c.json })).slice(0, 2)).slice(0, 400));
    await check('the server completed that question exactly once, and nothing calls it a device mark',
      online.ledger(inkRow?.serverQuestionId).thisDone === 1 && !/marked on this device/i.test(await page.locator('.qpage').innerText()),
      JSON.stringify(online.ledger(inkRow?.serverQuestionId)));

    // ── 6 · the writing was kept with the attempt ────────────────────────────
    // Read back from the device's own store (the `inks` row is filed under the
    // question's id), from the History row, and from the row's own detail.
    const keptInk = await page.evaluate(id => new Promise(ok => {
      const r = indexedDB.open('pri-learning');
      r.onsuccess = () => {
        const db = r.result;
        let req;
        try { req = db.transaction('inks').objectStore('inks').get(id); } catch (e) { db.close(); return ok({ error: String(e) }); }
        req.onsuccess = () => { db.close(); const row = req.result; ok(row ? { strokes: Array.isArray(row.strokes) ? row.strokes.length : (row.sealed ? 'sealed' : 0), recognized: row.recognized ?? null, sealed: !!row.sealed } : null); };
        req.onerror = () => { db.close(); ok({ error: 'read failed' }); };
      };
      r.onerror = () => ok({ error: 'open failed' });
    }), inkRow?.id);
    await check('the strokes themselves were kept with the attempt',
      !!keptInk && (keptInk.strokes === 'sealed' || keptInk.strokes > 0), JSON.stringify(keptInk));
    await check('and the reading was kept beside them',
      !!keptInk && (keptInk.sealed || keptInk.recognized === answer), JSON.stringify(keptInk));
    await page.goto(`${base}/history`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hist-row', { timeout: 30000 });
    const histRow = page.locator(`.hist-row[data-question-id="${inkRow?.id}"]`);
    await check('History holds that attempt once, marked correct and labelled as handwritten',
      await page.locator('.hist-row').count() === 1 && await histRow.count() === 1 &&
        (await histRow.locator('.hist-verdict .sr-only').innerText()) === 'Correct' &&
        await histRow.locator('.tag .sr-only').count() >= 1,
      (await page.locator('.hist-row').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').slice(0, 80)).join(' | '));

    await histRow.locator('.hist-main').click();
    await page.waitForSelector('.hist-detail', { timeout: 20000 }).catch(() => {});
    const detail = ((await page.locator('.hist-detail').innerText().catch(() => '')) || '').replace(/\s+/g, ' ');
    await check('and its History detail opens with the handwriting and the reading beside it',
      detail.includes('Your handwriting') && detail.includes(`read as \u201c${answer}\u201d`), `detail reads ${JSON.stringify(detail.slice(0, 200))}`);

    // ── 7 · a doubtful line: highlighted, corrected in one tap, no second read ─
    // The reader is unsure of what it read. The line is marked as doubtful, the
    // student says what they wrote, and that goes to the engine — the reader is
    // not asked again, and nothing is marked until the student has spoken.
    await page.goto(`${base}/practice?subtopic=${TOPIC}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await settle();
    const writeTab = page.getByRole('button', { name: 'Answer by handwriting' });
    if (await writeTab.count()) await writeTab.click();
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    const box2 = await page.locator('.ink-canvas-live').boundingBox();
    // The stand-in is re-scripted here to misread a "1" this account has
    // already had read (as "1", confidently) earlier in this flow. A real
    // reader does not change its answer for an identical picture, and the
    // server would rightly hand back the reading it kept. So the desk says
    // "this is a different reader now" — a test-harness reset of the kept
    // reads (support/online-session.mjs), not a product path.
    const keptBefore = online.keptReads();
    const forgotten = online.forgetKeptReads();
    await check('the server was keeping this account\'s earlier reads, and the desk reset them for the re-scripted reader', keptBefore >= 1 && forgotten === keptBefore && online.keptReads() === 0,
      `kept ${keptBefore}, forgotten ${forgotten}`);
    reader.text = '7';
    reader.confidence = 0.4;            // under the 0.82 floor: a doubtful read
    const callsBeforeDoubt = reader.requests.length;
    await handwrite(page, box2, '1');   // what the student actually wrote
    await pressRead(page);
    await readingArrives(page);
    await page.waitForTimeout(1200);
    const doubtRead = (await readCalls()).at(-1);
    await check('the transcript read is one provider call, and the doubtful reading it returns is kept with its doubt',
      reader.requests.length === callsBeforeDoubt + 1 && doubtRead?.json?.reused === false && doubtRead.json?.transcription?.needsConfirmation === true &&
        doubtRead.json.transcription.confidence === 0.4 && online.keptReads() === 1,
      `provider calls +${reader.requests.length - callsBeforeDoubt}; ${JSON.stringify({ reused: doubtRead?.json?.reused, t: doubtRead?.json?.transcription && { c: doubtRead.json.transcription.confidence, n: doubtRead.json.transcription.needsConfirmation } })}; kept ${online.keptReads()}`);
    const doubtful = page.locator('.ink-line.ink-line-low');
    await check('a line the reader was unsure of is highlighted as doubtful',
      await doubtful.count() === 1 && (await doubtful.first().getAttribute('data-confidence')) === '0.4',
      `${await doubtful.count()} doubtful line(s); confidence ${await page.locator('.ink-line').first().getAttribute('data-confidence')}`);
    await check('no mark is given from it: the card is not auto-marked and Submit asks to check the reading first',
      await page.locator('.eval-card, .verdict-bad').count() === 0 && await page.getByRole('button', { name: 'Check this reading first' }).count() === 1);
    const readsBeforeCorrection = reader.requests.length;
    const iWrote = page.getByRole('button', { name: /Correct line 1/ });
    await check('a one-tap "I wrote…" control is offered on that line', await iWrote.count() === 1);
    await iWrote.click();
    const field = page.getByLabel('What you wrote on line 1');
    await field.fill('1');
    await page.getByRole('button', { name: 'Use this' }).click();
    await settle();
    const correctedLine = page.locator('.ink-line[data-corrected="true"]');
    await check('the line now reads what the student wrote and is marked as corrected by them',
      await correctedLine.count() === 1 && (await correctedLine.getAttribute('data-text')) === '1' && await page.locator('.ink-line.ink-line-low').count() === 0,
      `corrected ${await correctedLine.count()}, text ${JSON.stringify(await correctedLine.getAttribute('data-text'))}`);
    await check('the correction did not go back to the reader — no second provider call', reader.requests.length === readsBeforeCorrection,
      `${reader.requests.length - readsBeforeCorrection} extra request(s)`);
    await check('Submit is now a plain submit: the engine marks what the student wrote',
      await page.getByRole('button', SUBMIT).count() === 1 && await page.getByRole('button', { name: 'Check this reading first' }).count() === 0);
    await page.getByRole('button', SUBMIT).click();
    await page.waitForSelector('.eval-card, .verdict-bad', { timeout: 20000 });
    // Who decides: the server's deterministic engine, on what the STUDENT said
    // they wrote. To grade handwriting the server takes its own receipt of the
    // picture (one reading, answer-blind) and records the student's correction
    // on top of it; the doubtful "7" is never what gets marked.
    const doubtRow = await online.shownRow();
    const of = suffix => online.practiceCalls(new RegExp(`^/v1/practice/${doubtRow?.serverQuestionId}/${suffix}$`));
    const [receipts, confirms, doubtGrades] = [await of('recognize'), await of('recognition/[^/]+/confirm'), await of('submit')];
    await check('a verdict comes from the server\u2019s deterministic engine on the corrected line: one receipt reading, the correction confirmed as "1", one grade',
      receipts.length === 1 && receipts[0].status === 201 && confirms.length === 1 && confirms[0].status < 300 && confirms[0].body?.text === '1' &&
        doubtGrades.length === 1 && doubtGrades[0].json?.authoritative === true && doubtGrades[0].body?.mode === 'ink',
      `recognize ${receipts.map(c => c.status)}, confirm ${JSON.stringify(confirms.map(c => c.body))}, grades ${doubtGrades.length}`);
    // The receipt read is of the same unchanged picture: the server reuses the
    // read it kept — doubt and all — and pays for nothing more.
    await check('the receipt read at Submit reused the kept doubtful read: reused: true, still flagged for confirmation, +0 provider calls since the transcript',
      receipts[0]?.json?.reused === true && receipts[0].json.transcription?.needsConfirmation === true && receipts[0].json.transcription.text === '7' &&
        reader.requests.length === readsBeforeCorrection,
      `reused ${receipts[0]?.json?.reused}; receipt reading ${JSON.stringify(receipts[0]?.json?.transcription)}; provider reads +${reader.requests.length - readsBeforeCorrection}`);
    const anyProvenance = (await page.locator('.eval-provenance').first().innerText().catch(() => '')) || '';
    await check('and whichever way it went, the handwritten verdict carries the honesty line',
      /Read by AI, marked by Pri’s engine/.test(anyProvenance), JSON.stringify(anyProvenance));
    reader.confidence = null;

    // ── 8 · working that ENDS IN AN EQUATION: the answer is proposed, shown ──
    // Owner case A3 (real reader, 2026-10-10): three lines of working ending
    // "38.5 - 24.5 = 14" were transcribed correctly, the last line was sent
    // verbatim as the answer, and the numeric parser refused it — "I couldn't
    // read that as a maths answer". The value after the "=" is now proposed by
    // the same key-less module Photo uses, shown in an editable field, and
    // sent only by the student's Submit, with the lines as working.
    const openFresh = async () => {
      await page.goto(`${base}/practice?subtopic=${TOPIC}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.q-prompt', { timeout: 30000 });
      await settle();
      // A question that already had a try (section 7 leaves one open after a
      // wrong first answer) is not a fresh one: move on to the next.
      for (let moved = 0; moved < 4; moved++) {
        const row = await online.shownRow();
        const tried = row?.serverQuestionId ? await online.practiceCalls(new RegExp(`^/v1/practice/${row.serverQuestionId}/submit$`)) : [];
        if (!tried.length) break;
        const leaving = await page.locator('.qpage').first().getAttribute('data-question-id');
        await page.locator('.ctx-next').click();
        await page.waitForFunction(id => {
          const el = document.querySelector('.qpage[data-question-id]');
          return el && el.getAttribute('data-question-id') !== id && el.querySelector('.q-prompt');
        }, leaving, { timeout: 30000 });
        await settle();
      }
      const tab = page.getByRole('button', { name: 'Answer by handwriting' });
      if (await tab.count()) await tab.click();
      await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
      return page.locator('.ink-canvas-live').boundingBox();
    };
    const workingEndingIn = value => {
      const n = Number(value);
      const top = Number.isFinite(n) ? String(Math.round((n + 24.5) * 10) / 10) : '38.5';
      return Number.isFinite(n) ? [top, '24.5', `${top}-24.5=${value}`] : ['38.5', '24.5', `1*(${value})=${value}`];
    };
    const proposalCase = async ({ label, glyphs, wrongBy }) => {
      const canvas = await openFresh();
      const right = await online.answerOf();
      if (!await check(`${label}: a numeric question is on the card and its answer is known only at the desk`,
        right.answerType === 'numeric' && Number.isFinite(Number(right.text)), JSON.stringify({ type: right.answerType, kind: right.kind }))) return null;
      const final = wrongBy ? String(Number(right.text) + wrongBy) : right.text;
      const written = workingEndingIn(final);
      online.forgetKeptReads();           // re-scripted stand-in: a different reader now (desk only)
      reader.lines = written.map(text => ({ text }));
      reader.confidence = 0.97;
      const callsBefore = reader.requests.length;
      await handwrite(page, canvas, glyphs);
      await pressRead(page);
      await page.waitForFunction(n => document.querySelectorAll('.ink-line').length === n, 3, { timeout: 20000 }).catch(() => {});
      const shown = await reading(page);
      await check(`${label}: the three lines of working are read and shown, the last one an equation [SYNTHETIC-READER EVIDENCE]`,
        shown.length === 3 && shown[2] === written[2] && reader.requests.length === callsBefore + 1, JSON.stringify(shown));
      const field = page.locator('[data-ink-final-answer]');
      const noteText = (await page.locator('.ink-final-answer [role="status"]').innerText().catch(() => '')).replace(/\s+/g, ' ');
      await check(`${label}: the value after "=" is proposed in an editable Final answer field, and the student is told where it came from`,
        await field.inputValue().catch(() => null) === final && await field.isEditable() &&
          await page.locator('[data-ink-answer-proposal="proposed"]').count() === 1 && noteText.includes(`Pri took ${final} as your answer from line 3`) && /Change it here/.test(noteText),
        `field ${JSON.stringify(await field.inputValue().catch(() => null))}; note ${JSON.stringify(noteText)}`);
      await check(`${label}: nothing is marked by the reading or the proposal — no recognise, no grade, no verdict before Submit`,
        await page.locator('.eval-card, .verdict-bad').count() === 0 &&
          (await online.practiceCalls(new RegExp(`^/v1/practice/${right.serverQuestionId}/(recognize|submit)$`))).length === 0);
      return { right, final, written, field };
    };

    // 8a · the proposal is right: Submit as it stands.
    {
      const made = await proposalCase({ label: 'equation last line', glyphs: '717' });
      if (made) {
        const { right, final, written } = made;
        const callsBeforeSubmit = reader.requests.length;
        await page.getByRole('button', SUBMIT).click();
        await page.waitForSelector('.eval-card, .verdict-bad', { timeout: 30000 }).catch(() => {});
        const of = suffix => online.practiceCalls(new RegExp(`^/v1/practice/${right.serverQuestionId}/${suffix}$`));
        const [receipts, confirms, grades] = [await of('recognize'), await of('recognition/[^/]+/confirm'), await of('submit')];
        await check('equation last line: Submit sends the proposed value as the answer and all three recognised lines as working, in ink mode',
          grades.length === 1 && grades[0].body?.answer === final && grades[0].body.mode === 'ink' && grades[0].body.steps === written.join('\n') &&
            typeof grades[0].body.transcriptionReceipt === 'string', JSON.stringify(grades.map(g => g.body)));
        await check('equation last line: the answer goes through the same confirm path as a hand-corrected line — one reused receipt read, one confirm of the value, +0 provider calls',
          receipts.length === 1 && receipts[0].status === 201 && receipts[0].json?.reused === true && confirms.length === 1 && confirms[0].status < 300 &&
            confirms[0].body?.text === final && reader.requests.length === callsBeforeSubmit,
          `recognize ${JSON.stringify(receipts.map(c => [c.status, c.json?.reused]))}; confirm ${JSON.stringify(confirms.map(c => c.body))}; provider +${reader.requests.length - callsBeforeSubmit}`);
        await check('equation last line: the server marks it correct with every mark, on the first try — not "I couldn\'t read that"',
          grades[0]?.status === 200 && grades[0].json?.authoritative === true && grades[0].json.invalid === false && grades[0].json.correct === true &&
            grades[0].json.resolved === true && grades[0].json.marksEarned === grades[0].json.marksPossible && await page.locator('.eval-card').count() === 1,
          JSON.stringify({ status: grades[0]?.status, invalid: grades[0]?.json?.invalid, correct: grades[0]?.json?.correct, marks: [grades[0]?.json?.marksEarned, grades[0]?.json?.marksPossible] }));
      }
    }
    // 8b · the proposal is not what the student meant: they change it first.
    {
      const made = await proposalCase({ label: 'proposal changed', glyphs: '171', wrongBy: 1 });
      if (made) {
        const { right, final, written, field } = made;
        await field.fill(right.text);
        await check('proposal changed: the field takes the student\'s own answer and says it is theirs',
          await field.inputValue() === right.text && await page.locator('[data-ink-answer-proposal="student"]').count() === 1);
        // Durable: the transcript and the answer typed over the proposal are
        // kept with the ink. A reload brings both back — it does not read the
        // page again, and it does not bring back the proposal that was overridden.
        const status = page.locator('.ws-actions .status-line');
        await page.waitForFunction(() => /Saved on this device/.test(document.querySelector('.ws-actions .status-line')?.innerText || ''), null, { timeout: 10000 }).catch(() => {});
        const callsBeforeReload = reader.requests.length;
        const readsBeforeReload = (await readCalls()).length;
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
        await page.waitForFunction(n => document.querySelectorAll('.ink-line').length === n, 3, { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(2600);
        const restoredField = page.locator('[data-ink-final-answer]');
        await check('after a reload the three-line transcript is back as it was read, current (not stale), with no read sent',
          JSON.stringify(await reading(page)) === JSON.stringify(written) && await page.locator('[data-ink-stale]').count() === 0 &&
            reader.requests.length === callsBeforeReload && (await readCalls()).length === readsBeforeReload && await page.locator('[data-ink-read]').count() === 0,
          `${JSON.stringify(await reading(page))}; provider calls +${reader.requests.length - callsBeforeReload}`);
        await check('and the answer the student typed over the proposal is restored — the overridden proposal does not come back',
          await restoredField.inputValue().catch(() => null) === right.text && await restoredField.inputValue().catch(() => null) !== final &&
            await page.locator('[data-ink-answer-proposal="student"]').count() === 1,
          `field ${JSON.stringify(await restoredField.inputValue().catch(() => null))}; proposed was ${JSON.stringify(final)}`);
        await check('the save line says saved again only after its own readback', await page.waitForFunction(() => /Saved on this device/.test(document.querySelector('.ws-actions .status-line')?.innerText || ''), null, { timeout: 10000 }).then(() => true, () => false),
          await status.innerText().catch(() => ''));
        await page.getByRole('button', SUBMIT).click();
        await page.waitForSelector('.eval-card, .verdict-bad', { timeout: 30000 }).catch(() => {});
        const of = suffix => online.practiceCalls(new RegExp(`^/v1/practice/${right.serverQuestionId}/${suffix}$`));
        const [confirms, grades] = [await of('recognition/[^/]+/confirm'), await of('submit')];
        await check('proposal changed: what is sent and marked is the student\'s answer, not the proposed one; the working is still attached; marked correct',
          grades.length === 1 && grades[0].body?.answer === right.text && grades[0].body.answer !== final && grades[0].body.steps === written.join('\n') &&
            confirms.length === 1 && confirms[0].body?.text === right.text && grades[0].json?.correct === true && grades[0].json.resolved === true,
          JSON.stringify({ sent: grades[0]?.body?.answer, proposed: final, confirm: confirms.map(c => c.body), correct: grades[0]?.json?.correct }));
      }
    }
    // 8c · no confirmed answer: Submit is not available, and says why.
    {
      const canvas = await openFresh();
      const right = await online.answerOf();
      online.forgetKeptReads();           // re-scripted stand-in (desk only)
      reader.lines = [{ text: '2 + 3 = 5' }, { text: 'so x = 1 or x = 2' }];
      reader.confidence = 0.97;
      await handwrite(page, canvas, '17');
      await pressRead(page);
      await page.waitForFunction(n => document.querySelectorAll('.ink-line').length === n, 2, { timeout: 20000 }).catch(() => {});
      const field = page.locator('[data-ink-final-answer]');
      const submit = page.getByRole('button', SUBMIT);
      const reason = page.locator('[data-submit-reason="verdict.submitNeedsAnswer"]');
      await check('two candidate answers on the last line: nothing is guessed — the Final answer field is empty and names both',
        await field.inputValue().catch(() => null) === '' && await page.locator('[data-ink-answer-proposal="ambiguous"]').count() === 1 &&
          /more than one possible final answer \(1, 2\)/.test(await page.locator('.ink-final-answer [role="status"]').innerText().catch(() => '')),
        JSON.stringify(await field.inputValue().catch(() => null)));
      await check('Submit is disabled with the reason shown — "Type your final answer first." — so no attempt can be spent on a guess',
        await submit.isDisabled() && await reason.isVisible() && /Type your final answer first/.test(await reason.innerText()) &&
          (await submit.getAttribute('aria-describedby')) === await reason.getAttribute('id') &&
          (await online.practiceCalls(new RegExp(`^/v1/practice/${right.serverQuestionId}/(recognize|submit)$`))).length === 0,
        `disabled ${await submit.isDisabled()}; reason ${JSON.stringify(await reason.innerText().catch(() => ''))}`);
      if (right.answerType === 'numeric' && right.text) {
        await field.fill(right.text);
        await check('typing the answer enables Submit and the reason goes', await submit.isEnabled() && await reason.count() === 0);
        await submit.click();
        await page.waitForSelector('.eval-card, .verdict-bad', { timeout: 30000 }).catch(() => {});
        const graded = (await online.practiceCalls(new RegExp(`^/v1/practice/${right.serverQuestionId}/submit$`))).at(-1);
        await check('and the student\'s typed answer is what the server marks, correct, with the two lines as working',
          graded?.body?.answer === right.text && graded.body.steps === '2 + 3 = 5\nso x = 1 or x = 2' && graded.json?.correct === true,
          JSON.stringify({ body: graded?.body, correct: graded?.json?.correct }));
      }
    }
    reader.lines = null;
    reader.confidence = null;
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
