// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the student never sees the typed reading before marking.
//
// OWNER DECISION, 19 November 2026 (ADR-0001 amendment, supersedes the confirm step #999 / #1016):
// "i don't like the app showing the conversion of handwriting to text; it should automatically show it in the app."
// The student writes, one press of "Mark my working" marks, and their OWN page comes back with a mark and a comment
// on every line. The typed reading is on demand only ("See how Pri read this line"), and a line the reader was not
// sure of is never judged (the reading floor, server-enforced) and is shown as not checked.
//
// What this flow pins, in a real browser, on a real canvas, against the real platform server:
//   1  three written lines, one press: no reading text anywhere in what the student can see, before or after; the
//      marked page comes back; "See how Pri read this line" reveals that line, the page link reveals all of it;
//   2  a line read below the floor is shown as not checked, never ticked or crossed, and is not in the mark;
//   3  an unreadable final answer: the sentence and one box, nothing sent, no attempt, no try spent; typing the answer
//      marks it (as typed), and that request says the answer was typed;
//   4  a confident misread corrected through "See how Pri read this line" is marked again, on the same question issued
//      again, with no further provider read;
//   5  answer-blind: every read was the picture and nothing else.
//
// EVIDENCE CLASS. A real browser, the real canvas and the real platform server. The reader's provider hop is a scripted
// stand-in that returns the lines this flow sets, each at a set confidence, and never looks at the picture. Not real
// handwriting, a real provider or a real device.
//
// Run on its own:  node client/test/tour-no-preview.js   [--shots=<dir>]
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { handwrite, markWorking, readingIsNotShown, readLines, turnOnServerReading } from './fakeServerReader.js';
import { SYNTHETIC_EVIDENCE } from './support/online-session.mjs';

// A "Prove that ..." item of the Class 10 trigonometry chapter (a working-type question, identityProofs.js): its working is
// several expression lines, so the engine produces a line-by-line report and the marked page has lines to speak about.
// The lines the student "writes" are the sealed item's own canonical working, read at the test's desk (never from the device);
// the scripted reader returns them, and the canvas is drawn with the letter x, since the reader never looks at the picture.
const CHAPTER = 'c10-trigonometry';
const SENTENCE = 'Pri couldn’t read your final answer. Rewrite that line or type it here.';
const shotsDir = (process.argv.find(a => a.startsWith('--shots=')) || '').slice(8);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

export const flow = {
  id: 'no-preview',
  name: 'Marking · the typed reading is never shown before marking',
  online: true,

  async run({ page, ctx, base, check, note, goto, createProfile, mathText, settle, online }) {
    const reader = online.reader;
    Object.assign(reader, { text: '1', lines: null, confidence: 0.97, down: false });
    note(`${SYNTHETIC_EVIDENCE}: the handwriting reader in "Marking · the typed reading is never shown before marking" is a scripted stand-in (it returns the lines this flow sets, each at a set confidence). The canvas, the server routes, the receipts and every mark are real. Not real-handwriting, real-provider or real-device evidence.`);
    await goto('/');
    await createProfile({ name: 'Ada Byron', year: 10, course: 'in' });
    await online.signIn({ name: 'Ada Byron' });
    await check('server reading is on for this signed-in profile', await turnOnServerReading(page, base));

    // The proof items are pinned by seed (the test server accepts a seed ONLY in test, never deployed): difficulty 4 seeds 49, 54 and 56 of
    // the Class 10 trigonometry bank are "Prove that" items with a worked proof (found and pinned by server/test/reading-floor-http-check.mjs).
    let pinProofs = true, issued = 0;
    await page.route(/\/v1\/practice\/issue(?:\?.*)?$/, async route => {
      if (!pinProofs) { await route.continue(); return; }
      const original = route.request().postDataJSON() || {};
      const seed = [49, 54, 56][issued++ % 3];
      await route.fulfill({ response: await route.fetch({ postData: JSON.stringify({ ...original, generator: 'c10-trigonometry-current', difficulty: 4, curriculum: 'in', seed }) }) });
    });
    const front = () => page.locator('.qpage[data-question-id]');
    const sealedWorking = async () => {
      const shown = await online.shownRow();
      if (!shown?.serverQuestionId) return null;
      const row = online.platform.h.db.prepare("SELECT response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?").get(shown.serverQuestionId);
      const q = row ? JSON.parse(row.response_json) : null;
      return q?.answerType === 'working' && typeof q.answer?.canonicalWorking === 'string' ? q.answer.canonicalWorking.split('\n').filter(Boolean) : null;
    };
    // The next "Prove that" item the server issues.
    async function proofQuestion() {
      for (let n = 0; n < 6; n++) {
        const typeTab = page.getByRole('button', { name: 'Answer by typing' });
        if (await typeTab.count()) await typeTab.click();
        await settle();
        const lines = await sealedWorking();
        if (lines && lines.length >= 4) return lines;
        const before = await front().getAttribute('data-question-id');
        await page.locator('.ctx-next').click();
        await page.waitForFunction(id => { const el = document.querySelector('.qpage[data-question-id]'); return el && el.getAttribute('data-question-id') !== id && !!el.querySelector('.q-prompt'); }, before, { timeout: 30000 });
      }
      return null;
    }
    // A question whose answer is a short whole number, found with the test's own oracle (never read off the device).
    async function numericQuestion() {
      const answerBox = page.locator('.editor-body input.answer-input');
      for (let asked = 0; asked < 8; asked++) {
        const typeTab = page.getByRole('button', { name: 'Answer by typing' });
        if (await typeTab.count()) await typeTab.click();
        await settle();
        if (await answerBox.count() === 1) {
          const known = await online.answerOf();
          if (known.kind === 'text' && /^\d{1,3}$/.test(String(known.text))) return String(known.text);
        }
        const leaving = (await online.shownRow())?.id;
        await page.locator('.ctx-next').click();
        await page.waitForFunction(id => { const el = document.querySelector('.qpage[data-question-id]'); return el && el.getAttribute('data-question-id') !== id && el.querySelector('.q-prompt'); }, leaving, { timeout: 30000 });
      }
      return null;
    }
    // The same question again: the card's own "Redo question" (the server's repeat), after a marked result.
    async function redo() {
      const before = await front().getAttribute('data-question-id');
      await page.getByRole('button', { name: 'Redo question' }).click();
      await page.waitForFunction(id => { const el = document.querySelector('.qpage[data-question-id]'); return el && el.getAttribute('data-question-id') !== id && !!el.querySelector('.q-prompt') && !document.querySelector('[data-marked-page], .eval-card'); }, before, { timeout: 30000 });
    }
    // Four written lines, a hand's width apart, one under the other.
    const writePage = async (box, lines) => { let y = 10; for (let i = 0; i < lines.length; i++) { await handwrite(page, box, 'xxxx', { x: 30, y }); y += 112; } };
    async function openCanvas() {
      await page.getByRole('button', { name: 'Answer by handwriting' }).click();
      await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
      const box = await page.locator('.ink-canvas-live').boundingBox();
      return box;
    }
    const gradeCalls = () => online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/);
    const shot = async (name, states = true) => {
      if (!shotsDir) return;
      const original = page.viewportSize();
      for (const [size, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
        for (const scheme of ['light', 'dark']) {
          if (!states && scheme === 'dark' && size === 'phone') { /* all four are wanted */ }
          await page.setViewportSize(viewport);
          await page.emulateMedia({ colorScheme: scheme });
          await page.waitForTimeout(450);
          await page.screenshot({ path: `${shotsDir}/${name}-${size}-${scheme}.png`, fullPage: true });
        }
      }
      await page.emulateMedia({ colorScheme: 'light' });
      if (original) await page.setViewportSize(original);
    };

    await page.goto(`${base}/practice?subtopic=${CHAPTER}`, { waitUntil: 'domcontentloaded' });
    await front().locator('.q-prompt').waitFor({ timeout: 30000 });
    await settle();

    // ── 1 · three lines, one press ───────────────────────────────────────────
    const proof = await proofQuestion();
    if (!await check('the real server issued a "Prove that" item with a worked proof', !!proof)) return;
    // Four lines of the proof: the starting expression, two steps, the end.
    const picked = [proof[0], proof[1], proof[2], proof[proof.length - 1]];
    let box = await openCanvas();
    const [L1, L2, L3, L4] = picked;
    reader.lines = picked.map((text, i) => ({ text, confidence: 0.95 + i / 1000 }));
    const readsBefore = reader.requests.length;
    await writePage(box, picked);
    await page.waitForTimeout(3200);   // the page is read in the background once the pen has rested
    const primary = page.getByRole('button', { name: /^Mark my working/ });
    await check('before marking the page offers one primary action, "Mark my working", enabled as soon as there is ink',
      await primary.count() === 1 && await primary.isEnabled() && await page.locator('[data-ink-read]').count() === 0 && await page.locator('[data-confirm-reading]').count() === 0,
      `buttons ${JSON.stringify(await page.locator('.ws-actions .btn-primary').allInnerTexts())}`);
    const longLines = picked.filter(l => l.length >= 6);   // a one-character line ("1") is in every page's text
    const hidden = await readingIsNotShown(page, longLines);
    await check('four lines written, nothing marked: the typed reading is not anywhere in what the student can see (no list, no chips, no confirm panel, no text)',
      hidden.structure.length === 0 && hidden.leaked.length === 0 && await page.locator('.ink-line').count() === 0,
      JSON.stringify(hidden));
    await shot('before-mark');
    const submitsBefore = (await gradeCalls()).length;
    await primary.click();
    await page.waitForSelector('[data-marked-page]', { timeout: 30000 });
    const grade = (await gradeCalls()).at(-1);
    await check('one press marked it on the server, once: the request carries the picture and every line as read (the working is the answer), and says nothing was typed',
      (await gradeCalls()).length === submitsBefore + 1 && grade?.status === 200 && grade.json?.correct === true && grade.json?.resolved === true &&
        /^data:image\//.test(grade.body?.image || '') && String(grade.body?.answer || '').split('\n').length === 4 && !('answerTyped' in (grade.body || {})) &&
        grade.json?.reading?.studentConfirmed === false && Array.isArray(grade.json?.reading?.excludedLines) && grade.json.reading.excludedLines.length === 0,
      JSON.stringify({ status: grade?.status, keys: Object.keys(grade?.body || {}), reading: grade?.json?.reading }));
    await check('the marked page is the student\'s own page with a mark and one comment per line, in line order',
      await page.locator('[data-mp-mark]').count() === 1 && await page.locator('[data-mp-card]').count() >= 3 && await page.locator('ol.mp-comments[aria-label]').count() === 1,
      `${await page.locator('[data-mp-card]').count()} comments`);
    const after = await readingIsNotShown(page, longLines);
    await check('and still no typed reading is visible: the reading is on demand only', after.structure.length === 0 && after.leaked.length === 0, JSON.stringify(after));
    // One panel for the selected line (the first line, with no cross): choose line 2 from the list, then its reading is on offer.
    await page.locator('[data-mp-pick="2"]').click();
    const seeLine = page.locator('[data-mp-see-line="2"]');
    await check('the selected line offers a quiet text action, "See how Pri read this line", reachable from the keyboard',
      await seeLine.count() === 1 && /^See how Pri read this line$/.test((await seeLine.innerText()).trim()) && await seeLine.evaluate(el => el.tabIndex >= 0 && el.tagName === 'BUTTON'));
    await seeLine.focus();
    await page.keyboard.press('Enter');
    await check('pressing it reveals that line\'s reading, typeset, with Edit',
      (await page.locator('[data-mp-reading="2"]').getAttribute('data-text')) === L2 && await page.locator('[data-mp-edit-line="2"]').isVisible() && await page.locator('[data-mp-reading]').count() === 1);
    const all = await readLines(page);
    await check('one link, "See how Pri read your page", reveals every line', JSON.stringify(all) === JSON.stringify(picked), JSON.stringify(all));
    await shot('marked');
    await check('answer-blind: every read the provider saw was the picture and nothing else',
      reader.requests.length > readsBefore && reader.requests.slice(readsBefore).every(r => (r.input || []).flatMap(m => m.content || []).filter(p => p.type === 'input_image').length === 1 &&
        !JSON.stringify((r.input || []).flatMap(m => m.content || []).filter(p => p.type !== 'input_image')).includes(L2)));

    // ── 2 · a line read below the floor is not checked, and is in no verdict ─
    await redo();
    box = await openCanvas();
    const FALSE_LINE = `${L2} + 7`;
    reader.lines = [{ text: L1, confidence: 0.97 }, { text: FALSE_LINE, confidence: 0.41 }, { text: L3, confidence: 0.95 }, { text: L4, confidence: 0.95 }];
    await writePage(box, picked);
    await page.waitForTimeout(3200);
    await markWorking(page);
    await page.waitForSelector('[data-marked-page]', { timeout: 30000 });
    const g2 = (await gradeCalls()).at(-1);
    await check('a line read below the reader\'s floor is excluded by the server and named by its index',
      g2?.json?.reading?.studentConfirmed === false && JSON.stringify(g2.json.reading.excludedLines) === '[1]' && JSON.stringify(g2.json.reading.lineStates) === '["judged","not-read","judged","judged"]',
      JSON.stringify(g2?.json?.reading));
    await page.locator('[data-mp-pick="2"]').click();
    const unreadCard = page.locator('[data-mp-detail="2"]');
    await check('the page shows it as Not checked, in the panel for that line, with "Rewrite it, or type it."',
      await unreadCard.count() === 1 && /Not checked/.test(await unreadCard.innerText()) && /wasn’t checked: Pri couldn’t read it\./.test(await unreadCard.innerText()) && /Rewrite it, or type it\./.test(await unreadCard.innerText()) && await unreadCard.getAttribute('data-mp-status') === 'unread',
      await unreadCard.innerText().catch(() => 'none'));
    await check('and it is neither ticked nor crossed: no first error, and its text is in no verdict',
      await page.locator('[data-mp-status="first-error"]').count() === 0 && await page.locator('[data-mp-card="2"][data-mp-status="checked"]').count() === 0 && !JSON.stringify(g2?.json?.stepReport || {}).includes('+ 7') && !JSON.stringify(g2?.json?.stepReport || {}).includes('+7'),
      JSON.stringify((g2?.json?.stepReport?.lines || []).map(l => [l.text, l.status])));
    await shot('marked-with-unread-line');

    // ── 4 · a confident misread, corrected from the marked page, marks again ─
    await redo();
    const picked2 = picked;
    const MISREAD = `${picked2[1]} + 7`;
    box = await openCanvas();
    reader.lines = [{ text: picked2[0], confidence: 0.97 }, { text: MISREAD, confidence: 0.97 }, { text: picked2[2], confidence: 0.96 }, { text: picked2[3], confidence: 0.95 }];
    await writePage(box, picked2);
    await page.waitForTimeout(3200);
    await markWorking(page);
    // CTO ruling 19 Nov 2026: written working is ONE authoritative attempt. A wrong first Mark my working still resolves the
    // question and shows the full marked page at once; there is no open "Not quite, try again" for a written page.
    await page.waitForSelector('[data-marked-page]', { timeout: 30000 });
    await check('a wrong written page resolves on the first press: the full marked page is shown, with no "one more go"',
      (await gradeCalls()).at(-1)?.json?.resolved === true && await page.locator('.verdict-bad').count() === 0 && !/one more go/i.test(await page.locator('body').innerText()));
    const g4 = (await gradeCalls()).at(-1);
    await check('the confident misread was judged as read: line 2 is the first error on the page',
      await page.locator('[data-mp-card="2"][data-mp-status="first-error"]').count() === 1, JSON.stringify((g4?.json?.stepReport?.lines || []).map(l => [l.text, l.status])));
    const providerBeforeFix = reader.requests.length;
    const row4 = (await front().getAttribute('data-question-id'));
    await page.locator('[data-mp-see-line="2"]').click();
    await check('"See how Pri read this line" shows the misread, so the student can see where it went wrong',
      (await page.locator('[data-mp-reading="2"]').getAttribute('data-text')) === MISREAD);
    await page.locator('[data-mp-edit-line="2"]').click();
    await page.locator('[data-mp-edit-input="2"]').fill(picked2[1]);
    await page.locator('[data-mp-mark-again]').click();
    await page.waitForFunction(id => { const el = document.querySelector('.qpage[data-question-id]'); return el && el.getAttribute('data-question-id') !== id; }, row4, { timeout: 30000 });
    await page.waitForSelector('[data-marked-page]', { timeout: 40000 });
    const g5 = (await gradeCalls()).at(-1);
    await check('the corrected page was marked again on the question issued again: a new server attempt, line 2 judged as the student corrected it, no longer an error',
      g5?.json?.attemptId !== g4?.json?.attemptId && await page.locator('[data-mp-card="2"][data-mp-status="first-error"]').count() === 0 && (g5?.body?.answer || '').split('\n')[1] === picked2[1],
      JSON.stringify({ answer: g5?.body?.answer, repeat: g5?.json?.repeat }));
    await check('re-marking cost no further read: no provider call', reader.requests.length === providerBeforeFix, `${reader.requests.length - providerBeforeFix} provider call(s)`);

    // ── 3 · an unreadable final answer: say so, send nothing, spend nothing ──
    // A question with a final answer beside its working (a short whole number), from the same Class 7 chapter tour-ink uses.
    pinProofs = false;
    await page.goto(`${base}/practice?subtopic=c7-finding-unknown-current`, { waitUntil: 'domcontentloaded' });
    await front().locator('.q-prompt').waitFor({ timeout: 30000 });
    const numeric = await numericQuestion();
    if (!await check('a question with a short whole-number answer was found', !!numeric)) return;
    box = await openCanvas();
    const W1 = '2+3=5';
    reader.lines = [{ text: W1, confidence: 0.97 }, { text: numeric, confidence: 0.4 }];
    await writePage(box, [W1, numeric]);
    await page.waitForTimeout(3200);
    const callsBeforeUnreadable = (await gradeCalls()).length;
    await markWorking(page);
    await page.waitForSelector('[data-final-answer-sentence]', { timeout: 20000 });
    await check('the final answer line was read below the floor: the one sentence is shown, with one box to type it',
      (await page.locator('[data-final-answer-sentence]').innerText()).trim() === SENTENCE && await page.locator('[data-ink-final-answer]').count() === 1);
    await check('nothing was sent, no verdict, no mark: the question is exactly as it was',
      (await gradeCalls()).length === callsBeforeUnreadable && await page.locator('.eval-card').count() === 0 && await page.locator('[data-marked-page]').count() === 0);
    await shot('final-answer-unreadable');
    await page.locator('[data-ink-final-answer]').fill(numeric);
    await markWorking(page);
    await page.waitForSelector('.eval-card, [data-marked-page]', { timeout: 30000 });
    const g3 = (await gradeCalls()).at(-1);
    await check('typing the answer marks it, and the request says the answer was typed',
      (await gradeCalls()).length === callsBeforeUnreadable + 1 && g3?.status === 200 && g3.body?.answerTyped === true && g3.json?.correct === true,
      JSON.stringify({ n: (await gradeCalls()).length - callsBeforeUnreadable, typed: g3?.body?.answerTyped, correct: g3?.json?.correct }));

  }
};

export default flow;
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { onlinePlatform } = await import('./support/online-session.mjs');
  await onlinePlatform({ allowSeededPractice: true });
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
