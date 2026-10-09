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
import { handwrite, readLines, turnOnServerReading } from './fakeServerReader.js';
import { SYNTHETIC_EVIDENCE } from './support/online-session.mjs';

const TOPIC = 'y7-equations';
const SURELY_WRONG = '-987654';
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
    await handwrite(page, box, '1');
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
    await check('and told plainly: "Saved. It will be read when you are back online."',
      /Saved\. It will be read when you are back online\./.test(offlineNote), JSON.stringify(offlineNote));
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
    const requestsBeforeReload = reader.requests.length;
    reader.down = true;
    await ctx.setOffline(false);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await check('after the reload the same question is back', await mathText('.q-prompt') === prompt,
      `again: ${JSON.stringify(await mathText('.q-prompt'))}`);
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    const canvasAfter = await page.locator('.ink-canvas-live').boundingBox();
    await check('and the card came back to the pen by itself', !!canvasAfter && canvasAfter.width > 200);
    for (let i = 0; i < 60 && reader.requests.length === requestsBeforeReload; i++) await page.waitForTimeout(200);
    const restoredSent = (await readCalls()).at(-1);
    await check('the kept strokes were restored and offered to the reader (one request, a picture, nothing else)',
      reader.requests.length === requestsBeforeReload + 1 &&
        Object.keys(restoredSent?.body || {}).every(k => ['image', 'mode'].includes(k)) && /^data:image\//.test(restoredSent?.body?.image || ''),
      `${reader.requests.length - requestsBeforeReload} request(s) after the reload; page sent ${JSON.stringify(Object.keys(restoredSent?.body || {}))}`);
    await page.waitForSelector('.ink-status', { timeout: 10000 }).catch(() => {});
    const downNote = (await page.locator('.ink-status').innerText().catch(() => '')) || '';
    await check('with the reader down the page waits, saved, and says so', /saved/i.test(downNote) && await page.locator('.eval-card').count() === 0, JSON.stringify(downNote));
    reader.down = false;
    await ctx.setOffline(true);
    // The connection flaps before it settles: every return re-reads the kept
    // page, but the answer must be submitted for marking exactly once.
    const attemptCount = () => page.evaluate(() => new Promise(ok => {
      const r = indexedDB.open('pri-learning');
      r.onsuccess = () => { const db = r.result; const c = db.transaction('attempts').objectStore('attempts').count();
        c.onsuccess = () => { db.close(); ok(c.result); }; c.onerror = () => { db.close(); ok(-1); }; };
      r.onerror = () => ok(-1);
    }));
    const attemptsBefore = await attemptCount();
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
    await readingArrives(page);

    // ── 4 · the answer, written by hand, is read back ────────────────────────
    const lines = await reading(page);
    await check('back online, the kept ink is read by itself as one line', lines.length === 1,
      `read ${lines.length} lines: ${JSON.stringify(lines)}`);
    if (!await check(`the server reading ${JSON.stringify(answer)} is what the card will mark`,
      lines[0] === answer, `read ${JSON.stringify(lines[0])}`)) return;
    const notAnswer = reader.requests.every(r => !JSON.stringify(r).includes(`"${answer}"`) || false);
    await check('no request ever carried the expected answer', notAnswer);

    const asMaths = await mathText('.ink-line-math');
    await check('the reading is set as maths, not as loose characters',
      !!asMaths && asMaths.length > 0, `reading panel renders ${JSON.stringify(asMaths)}`);

    // ── 5 · the kept answer is marked by itself once it is read ─────────────
    // The student was told it "will be read and marked when you're back
    // online": no second tap. A doubtful reading would still ask first.
    const confirm = page.getByRole('button', { name: 'That’s what I wrote' });
    await page.waitForSelector('.eval-card', { timeout: 20000 }).catch(async () => {
      if (await confirm.count()) {
        note('the reading was doubtful enough to ask first, so the flow confirmed it — the designed path');
        await confirm.click();
        await page.waitForSelector('.eval-card', { timeout: 20000 });
      }
    });
    await check('back online, the kept handwriting is marked without another tap', await page.locator('.eval-card').count() === 1);
    await page.waitForTimeout(2500);   // anything still queued would land now
    const attemptsAfter = await attemptCount();
    await check('a flapping connection marks the kept answer exactly once',
      attemptsBefore >= 0 && attemptsAfter - attemptsBefore === 1, `attempts ${attemptsBefore} → ${attemptsAfter}`);
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
    // question's id) and from the History row. Opening the History detail is
    // not asserted here: it does not open for a server-marked attempt — see
    // known-red-online-history-detail.mjs.
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
    reader.text = '7';
    reader.confidence = 0.4;            // under the 0.82 floor: a doubtful read
    await handwrite(page, box2, '1');   // what the student actually wrote
    await readingArrives(page);
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
        doubtGrades.length === 1 && doubtGrades[0].json?.authoritative === true && doubtGrades[0].body?.mode === 'ink' &&
        reader.requests.length === readsBeforeCorrection + 1,
      `recognize ${receipts.map(c => c.status)}, confirm ${JSON.stringify(confirms.map(c => c.body))}, grades ${doubtGrades.length}, provider reads +${reader.requests.length - readsBeforeCorrection}`);
    const anyProvenance = (await page.locator('.eval-provenance').first().innerText().catch(() => '')) || '';
    await check('and whichever way it went, the handwritten verdict carries the honesty line',
      /Read by AI, marked by Pri’s engine/.test(anyProvenance), JSON.stringify(anyProvenance));
    reader.confidence = null;
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
