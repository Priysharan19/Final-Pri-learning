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
import { handwrite, markWorking, readingIsNotShown, turnOnServerReading } from './fakeServerReader.js';
import { SYNTHETIC_EVIDENCE } from './support/online-session.mjs';

const TOPIC = 'c7-finding-unknown-current';
const MAX_QUESTIONS = 8;

// What the page may send with a read: the picture, and — so the server can bind
// its read receipt to the issued question — that question's own opaque id (a
// UUID). Nothing about the question's content, and nothing else at all. What
// the PROVIDER is sent is checked separately and is the picture alone.
const onlyPictureAndQuestionId = body => !!body && Object.keys(body).every(k => ['image', 'mode', 'questionId'].includes(k)) &&
  (body.questionId === undefined || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(body.questionId)));

export const flow = {
  id: 'ink',
  name: 'Ink · handwriting on the real canvas',
  online: true,

  async run({ page, ctx, base, check, note, goto, createProfile, mathText, settle, online }) {
    // These flows pin the press-to-read behaviour: automatic reading (owner decision, 18 Nov 2026) is switched off on this device, as a student can in Settings. Auto mode has its own flow, tour-auto-read.js.
    await page.context().addInitScript(() => { try { localStorage.setItem('pri.autoRead', 'off'); } catch { /* none */ } });
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

    // ── 3 · one press reads and marks; writing and pausing sends nothing ─────
    // Owner decision, 19 Nov 2026: the reading is not shown; one press of "Mark my working" marks the working on the student's
    // own page. The device preference is off here, so the page is read only by that press; auto mode is pinned in tour-auto-read.js.
    reader.text = answer;
    const callsBeforeWriting = reader.requests.length;
    await handwrite(page, box, answer);
    await page.waitForTimeout(2600);
    const markButton = page.getByRole('button', { name: /^Mark my working/ });
    const readCalls = async () => (await online.practiceCalls(/^\/v1\/(?:handwriting\/transcribe|practice\/[^/]+\/recognize)$/));
    const submitCalls = () => online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/);
    const hiddenBefore = await readingIsNotShown(page, [answer.length >= 3 ? answer : '']);
    await check('after writing and pausing, no read was sent and none is shown: no request, no transcript, no Read button, and "Mark my working" is the one primary action, enabled',
      reader.requests.length === callsBeforeWriting && hiddenBefore.structure.length === 0 && await page.locator('[data-ink-read]').count() === 0 &&
        await markButton.count() === 1 && await markButton.isEnabled() && await page.locator('[data-submit-reason="ink.submitReadFirst"]').count() === 0,
      `${reader.requests.length - callsBeforeWriting} request(s); ${JSON.stringify(hiddenBefore)}`);
    await markButton.focus();
    await page.keyboard.press('Enter');     // reachable and operable from the keyboard
    await page.waitForSelector('.eval-card, [data-marked-page]', { timeout: 30000 }).catch(() => {});
    // Answer-blind at both hops: what the page sent the server, and what the
    // server's provider module sent on to the (stand-in) reader.
    const pageSent = (await readCalls()).at(-1);
    const sent = reader.requests.at(-1);
    const sentParts = (sent?.input || []).flatMap(m => m.content || []);
    await check('the request is the picture of the ink and nothing else — answer-blind',
      !!pageSent && onlyPictureAndQuestionId(pageSent.body) && /^data:image\//.test(pageSent.body?.image || '') &&
        sentParts.filter(part => part.type === 'input_image').length === 1 &&
        !JSON.stringify(sentParts.filter(part => part.type !== 'input_image')).includes(prompt.slice(0, 24)),
      `page sent ${JSON.stringify(pageSent && Object.keys(pageSent.body || {}))} to ${pageSent?.path}; provider request keys ${JSON.stringify(sent && Object.keys(sent))}`);
    const inkGrades = await submitCalls();
    await check('one press, one read, one mark: a single page request, a single provider call, a single server grade — authoritative, resolved on this one attempt (CTO ruling, 19 Nov 2026)',
      (await readCalls()).length === 1 && reader.requests.length === callsBeforeWriting + 1 && inkGrades.length === 1 && inkGrades[0].status === 200 &&
        inkGrades[0].json?.authoritative === true && inkGrades[0].json.correct === true && inkGrades[0].json.resolved === true && inkGrades[0].body?.mode === 'ink' &&
        /^data:image\//.test(inkGrades[0].body?.image || '') && inkGrades[0].body?.answer === answer,
      JSON.stringify({ reads: (await readCalls()).length, provider: reader.requests.length - callsBeforeWriting, grades: inkGrades.map(c => [c.status, c.json?.correct, c.json?.resolved, c.body?.mode]) }));
    const hiddenAfter = await readingIsNotShown(page, []);
    await check('the typed reading is still not on screen after marking: it is on demand only', hiddenAfter.structure.length === 0, JSON.stringify(hiddenAfter));
    const notAnswer = reader.requests.every(r => !JSON.stringify(r).includes(`"${answer}"`) || false);
    await check('no request ever carried the expected answer', notAnswer);
    const marked = (await page.locator('.eval-card, [data-marked-page]').first().innerText()).replace(/\s+/g, ' ');
    await check('the handwritten answer is marked correct by the server, and it is not told what was expected instead',
      await page.locator('[data-marked-page], .eval-card[data-outcome="correct"]').count() >= 1 && !/Expected:/.test(marked), `evaluation reads ${JSON.stringify(marked.slice(0, 200))}`);
    const provenance = (await page.locator('.eval-card .eval-provenance').innerText().catch(() => '')) || '';
    await check('the verdict, when it carries a provenance line, says who read it and who marked it, readable to assistive technology',
      (provenance === '' || /Read by AI, marked by Pri’s engine/.test(provenance)) && await page.locator('.eval-card .eval-provenance[aria-hidden="true"]').count() === 0, JSON.stringify(provenance));
    const inkRow = await online.shownRow();
    await check('the server completed that question exactly once, and nothing calls it a device mark',
      online.ledger(inkRow?.serverQuestionId).thisDone === 1 && !/marked on this device/i.test(await page.locator('.qpage').innerText()),
      JSON.stringify(online.ledger(inkRow?.serverQuestionId)));

    // ── 4 · the writing was kept with the attempt ────────────────────────────
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
    await page.goto(`${base}/history`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hist-row', { timeout: 30000 });
    const histRow = page.locator(`.hist-row[data-question-id="${inkRow?.id}"]`);
    await check('History holds that attempt once, marked correct and labelled as handwritten',
      await page.locator('.hist-row').count() === 1 && await histRow.count() === 1 &&
        (await histRow.locator('.hist-verdict .sr-only').innerText()) === 'Correct' &&
        await histRow.locator('[data-history-via="ink"] .sr-only').count() >= 1,
      (await page.locator('.hist-row').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').slice(0, 80)).join(' | '));

    // ── 5 · a fresh question: offline keeps the ink, nothing is read or marked; the reader down; a flapping connection ──
    const freshWriting = async () => {
      await page.goto(`${base}/practice?subtopic=${TOPIC}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.q-prompt', { timeout: 30000 });
      for (let asked2 = 0; asked2 < MAX_QUESTIONS; asked2++) {
        if (await typeTab.count()) await typeTab.click();
        await settle();
        const known = await online.answerOf().catch(() => null);
        const tried = (await online.shownRow())?.serverQuestionId ? (await online.practiceCalls(new RegExp(`^/v1/practice/${(await online.shownRow()).serverQuestionId}/submit$`))).length : 0;
        if (await answerBox.count() === 1 && known?.kind === 'text' && /^\d{1,3}$/.test(String(known.text)) && !tried) {
          await page.getByRole('button', { name: 'Answer by handwriting' }).click();
          await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
          return { right: String(known.text), b: await page.locator('.ink-canvas-live').boundingBox() };
        }
        const leaving = (await online.shownRow())?.id;
        await page.locator('.ctx-next').click();
        await page.waitForFunction(id => { const el = document.querySelector('.qpage[data-question-id]'); return el && el.getAttribute('data-question-id') !== id && el.querySelector('.q-prompt'); }, leaving, { timeout: 30000 });
      }
      return null;
    };
    const second = await freshWriting();
    if (!await check('a second question with a short whole-number answer was found for the offline and recovery scenarios', !!second)) return;
    const prompt2 = await mathText('.q-prompt');
    reader.text = second.right;
    await ctx.setOffline(true);
    const earlierImages = new Set((await readCalls()).map(call => call.body?.image).filter(Boolean));
    const gradesBeforeOffline = (await submitCalls()).length;
    await page.waitForTimeout(500);                         // the offline banner moves the canvas down
    second.b = await page.locator('.ink-canvas-live').boundingBox();
    await handwrite(page, second.b, second.right);
    await page.waitForSelector('.ink-status', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(700);
    const offlineNote = (await page.locator('.ink-status').innerText().catch(() => '')) || '';
    await check('offline, nothing is read or marked, no reading is shown, and the student is told why',
      (await readingIsNotShown(page, [])).structure.length === 0 && await page.locator('.eval-card, [data-marked-page]').count() === 0 && /needs a connection/.test(offlineNote),
      `status ${JSON.stringify(offlineNote)}`);
    const callsOffline = reader.requests.length;
    const pressed = await markWorking(page);
    await page.waitForTimeout(1200);
    await check('pressing Mark my working offline sends nothing, reads nothing and marks nothing: the work stays where it is',
      reader.requests.length === callsOffline && (await submitCalls()).length === gradesBeforeOffline && await page.locator('.eval-card, [data-marked-page]').count() === 0,
      `pressed ${pressed}; provider +${reader.requests.length - callsOffline}`);
    // The kept page is a row in the inkDrafts IndexedDB store (sealed when the profile has a password), and nothing of it is in localStorage.
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

    // The app goes away mid-offline; the page comes back, still unmarked. The reader is not answering yet.
    reader.down = true;
    await ctx.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForTimeout(1500);
    const requestsBeforeReload = reader.requests.length;
    const readsBeforeReload = (await readCalls()).length;
    await check('coming back online sends no read by itself: the offline note goes and Mark my working is offered',
      reader.requests.length === requestsBeforeReload && await markButton.isEnabled() && !/offline/i.test((await page.locator('.ink-status').innerText().catch(() => '')) || ''));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await check('after the reload the same question is back', await mathText('.q-prompt') === prompt2, `again: ${JSON.stringify(await mathText('.q-prompt'))}`);
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    await page.waitForTimeout(2600);
    await check('the kept strokes were restored and NOT sent to the reader: no page request, no provider call, no reading shown, Mark my working offered',
      (await readCalls()).length === readsBeforeReload && reader.requests.length === requestsBeforeReload && await markButton.isEnabled() && (await readingIsNotShown(page, [])).structure.length === 0,
      `${(await readCalls()).length - readsBeforeReload} page request(s), ${reader.requests.length - requestsBeforeReload} provider call(s) after the reload`);
    await markWorking(page);
    for (let i = 0; i < 60 && reader.requests.length === requestsBeforeReload; i++) await page.waitForTimeout(200);
    await page.waitForTimeout(1500);
    const readsAfter = await readCalls();
    const restoredSent = readsAfter.at(-1);
    await check('offline recovery fixture is a new image, not an earlier cached read',
      !!restoredSent?.body?.image && !earlierImages.has(restoredSent.body.image),
      `had ${earlierImages.size} earlier image(s); cached-image collision ${earlierImages.has(restoredSent?.body?.image)}`);
    const providerCalls = reader.requests.length - requestsBeforeReload;
    // One press, one request. (The server may put that one request to its fallback model when the first answers 5xx.)
    await check('pressing Mark my working offers the restored strokes to the reader once (one request, a picture, nothing else)',
      readsAfter.length === readsBeforeReload + 1 && providerCalls >= 1 && providerCalls <= 2 &&
        onlyPictureAndQuestionId(restoredSent?.body) && /^data:image\//.test(restoredSent?.body?.image || ''),
      `${readsAfter.length - readsBeforeReload} page request(s), ${providerCalls} provider call(s) after the press; page sent ${JSON.stringify(Object.keys(restoredSent?.body || {}))}`);
    await page.waitForSelector('.ink-status', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);
    const downNote = (await page.locator('.ink-status').innerText().catch(() => '')) || '';
    await check('with the reader down the page says so, saved, with a Try again — nothing is marked and it does not retry by itself',
      /isn’t answering/.test(downNote) && /saved/i.test(downNote) && await page.locator('[data-ink-retry-reading]').isVisible() && await page.locator('.eval-card, [data-marked-page]').count() === 0 &&
        (await readCalls()).length === readsBeforeReload + 1 && (await submitCalls()).length === gradesBeforeOffline, JSON.stringify(downNote));
    reader.down = false;
    await ctx.setOffline(true);
    // The connection flaps before it settles. No return reads the kept page by itself; the student asks once, and it is marked exactly once.
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
    // A refusal note from before may still offer Try again; either is the student's own press. Try again only reads (the
    // reader had been down), so when no mark follows the student presses Mark my working once more.
    if (!await markWorking(page, { timeout: 3000 })) await page.locator('[data-ink-retry-reading]').click();
    for (let i = 0; i < 40 && reader.requests.length === callsAfterFlaps; i++) await page.waitForTimeout(150);
    await page.waitForSelector('.eval-card, [data-marked-page]', { timeout: 8000 }).catch(async () => {
      note('Try again read the kept ink without marking it (it only reads); the student pressed Mark my working once more');
      await markWorking(page, { timeout: 5000 });
      await page.waitForSelector('.eval-card, [data-marked-page]', { timeout: 30000 }).catch(() => {});
    });
    await page.waitForTimeout(2500);   // anything still queued would land now
    await check('one press reads the kept ink and marks it: exactly one request to the reader', reader.requests.length === callsAfterFlaps + 1, `${reader.requests.length - callsAfterFlaps}`);
    const attemptRows = await page.evaluate(() => new Promise(ok => {
      const r = indexedDB.open('pri-learning');
      r.onsuccess = () => { const db = r.result; const c = db.transaction('attempts').objectStore('attempts').getAll();
        c.onsuccess = () => { db.close(); ok(c.result.map(a => ({ remote: typeof a.remoteEventId === 'string', server: a.serverAttemptId || a.remoteEventId || null }))); };
        c.onerror = () => { db.close(); ok(null); }; };
      r.onerror = () => ok(null);
    }));
    const flapGrades = (await submitCalls()).filter(c => c.status === 200);
    await check('the kept answer is marked exactly once: one more server grade, one more attempt row on this device, for that server attempt',
      flapGrades.length === gradesBeforeOffline + 1 && !!attemptRows && attemptRows.length === attemptsBefore + 1 && attemptRows.some(a => a.server === flapGrades.at(-1).json?.attemptId),
      `attempts before ${attemptsBefore}; rows ${JSON.stringify(attemptRows)}; ${flapGrades.length} server grade(s)`);
    await check('and it is marked correct by the server, on the written answer', flapGrades.at(-1)?.json?.correct === true && flapGrades.at(-1)?.body?.answer === second.right && flapGrades.at(-1)?.json?.authoritative === true,
      JSON.stringify({ answer: flapGrades.at(-1)?.body?.answer, correct: flapGrades.at(-1)?.json?.correct }));

    // ── 6 · working that ENDS IN AN EQUATION: the value is the answer, never guessed from the reading before marking ──
    // Owner decision, 19 Nov 2026: there is no "proposed final answer" panel any more. The server resolves the answer from the
    // last line when the reading is confident; when it is not, the one sentence and one box appear and nothing is marked.
    const third = await freshWriting();
    if (await check('a third question was found for the equation-ending scenario', !!third)) {
      const v = third.right;
      reader.lines = [{ text: `${v} + 0 = ${v}`, confidence: 0.97 }, { text: `x = ${v}`, confidence: 0.97 }];
      online.forgetKeptReads();
      const gradesBefore3 = (await submitCalls()).length;
      await handwrite(page, third.b, v);
      await handwrite(page, third.b, v, { y: 150 });
      await page.waitForTimeout(2600);
      await check('the equation-ending working is written: nothing is marked or proposed by the writing alone — no grade, no panel',
        (await submitCalls()).length === gradesBefore3 && (await readingIsNotShown(page, [])).structure.length === 0 && await page.locator('[data-photo-answer-note], [data-confirm-reading]').count() === 0);
      await markWorking(page);
      await page.waitForSelector('.eval-card, [data-marked-page], [data-final-answer-sentence]', { timeout: 30000 }).catch(() => {});
      const g3 = (await submitCalls()).at(-1);
      const sentenceShown = await page.locator('[data-final-answer-sentence]').count() === 1;
      await check('one press: the server marks the working that ends in "x = value" — correct, every mark, on the first and only attempt — or asks once for the final answer, sending nothing',
        sentenceShown ? (await submitCalls()).length === gradesBefore3 :
          (await submitCalls()).length === gradesBefore3 + 1 && g3?.json?.authoritative === true && g3.json.correct === true && g3.json.resolved === true && g3.body?.mode === 'ink' &&
            g3.json.marksEarned === g3.json.marksPossible,
        JSON.stringify({ sentenceShown, answer: g3?.body?.answer, steps: g3?.body?.steps, correct: g3?.json?.correct }));
    }
    reader.lines = null;
    reader.confidence = null;
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
