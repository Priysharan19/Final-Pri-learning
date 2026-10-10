// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — the clock runs out with handwriting nobody read.
//
// Owner decision (R4): a handwritten exam answer the student never pressed
// "Read my answer" on is not a blank. This flow sits a JEE Main paper with
// Playwright's controllable clock, writes one numerical answer by hand, never
// has it read, and proves in the real room against the real server:
//
//   · while writing and waiting nothing is sent to the reader;
//   · Review and submit names the unread answer, and inside the last five
//     minutes the room warns about it on the page;
//   · every autosave carries the DIGEST of the page's picture to the server
//     and never the picture;
//   · at the deadline the paper submits itself; with the reader down the
//     answer is shown as "not marked yet" — not blank, not wrong — and the
//     result says how many marks are undecided;
//   · when the reader is back, the frozen page is read ONCE and the answer is
//     marked by the server's engine; nothing else on the paper changes.
//
// WHAT IS REAL: the built client, the exam room, the platform server (issue,
// checkpoint, finish, the after-close handwriting route, the marker).
// WHAT IS SYNTHETIC: the handwriting READER — a scripted stand-in that never
// looks at the picture. Only the page clock is moved; the server's clock is
// real, so it sees the automatic submit in time. The one desk step is named
// where it happens. Not real provider, handwriting or device evidence.
//
// Run on its own:  node client/test/tour-exam-unread-handwriting.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { handwrite } from './fakeServerReader.js';

const EVIDENCE = 'SYNTHETIC-READER EVIDENCE';

const storedExam = (page, examId) => page.evaluate(async (examId) => {
  const db = await new Promise((ok, no) => { const r = indexedDB.open('pri-learning'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  const row = await new Promise((ok, no) => { const r = db.transaction('exams').objectStore('exams').get(examId); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  db.close();
  if (!row) return null;
  const pending = (row.detail || []).filter(d => d.pending).map(d => ({ id: d.id, state: d.pendingState, reason: d.pendingReason, given: d.given, awarded: d.awarded, correct: d.correct }));
  return {
    finishedAt: row.finishedAt, score: row.score, total: row.total,
    answers: row.responses?.answers || null, inkKeys: Object.keys(row.responses?.inks || {}),
    pages: Object.fromEntries(Object.entries(row.responses?.pages || {}).map(([k, p]) => [k, { digest: p.digest, picture: /^data:image\/png;base64,/.test(p.image || '') }])),
    pending, heldPages: Object.keys(row.server?.handwriting?.pages || {}),
    lines: (row.detail || []).map(d => ({ id: d.id, given: d.given, awarded: d.awarded, correct: d.correct, unanswered: d.unanswered, pending: d.pending === true, readAfterClose: d.readAfterClose === true }))
  };
}, examId);

export const flow = {
  id: 'exam-unread-handwriting',
  name: 'India exam · unread handwriting at the deadline: warned, frozen, pending, read once',
  online: true,

  async run({ page, base, check, note, goto, createProfile, settle, online }) {
    note(`${EVIDENCE}: "India exam · unread handwriting…" counts requests from the real server's provider module to the scripted stand-in reader. The server, its marker and every mark are real; only the page clock is moved.`);
    const { reader } = online;
    const db = online.platform.h.db;
    const serverRow = scope => {
      const row = db.prepare('SELECT key, response_json FROM idempotency_keys WHERE scope=? AND account_id=? ORDER BY created_at DESC').get(scope, online.account.id);
      return row ? { key: row.key, raw: row.response_json, value: JSON.parse(row.response_json) } : null;
    };
    try {
      await page.clock.install();
      await goto('/');
      await createProfile({ name: 'Meera Iyer', year: 12, course: 'in', track: 'jee-main' });
      await online.signIn({ name: 'Meera Iyer' });
      await page.goto(`${base}/exams`, { waitUntil: 'domcontentloaded' });
      const start = page.getByRole('button', { name: 'Start JEE Main Mathematics simulation' });
      await start.waitFor({ timeout: 30000 });
      await start.click();
      await page.waitForSelector('.exam-timer', { timeout: 60000 });
      const examId = new URL(page.url()).pathname.split('/').pop();

      // ── 1 · one typed-style answer, and one answer written by hand, never read
      await page.locator('.exam-dot').nth(0).click();
      await settle();
      await page.locator('.mcq .mcq-opt').nth(2).click();
      await page.locator('.exam-dot').nth(20).click();
      await settle();
      await page.getByRole('button', { name: '✍ Write by hand' }).click();
      await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
      const box = await page.locator('.ink-canvas-live').boundingBox();
      reader.lines = null; reader.text = '42'; reader.confidence = 0.97;
      const before = reader.requests.length;
      await handwrite(page, box, '42');
      let saved = null;
      for (let i = 0; i < 80; i++) {
        await page.clock.runFor(500);
        saved = await storedExam(page, examId);
        if (saved?.inkKeys?.length === 1 && Object.keys(saved.pages).length === 1) break;
        await page.waitForTimeout(150);
      }
      const inkKey = saved?.inkKeys?.[0];
      await check('the handwriting is kept with the paper, unread: strokes saved, no answer read from them, nothing sent to the reader',
        !!inkKey && !saved.answers?.[inkKey] && Object.keys(saved.answers || {}).length === 1 && reader.requests.length === before &&
          await page.locator('[data-ink-read]').count() === 1,
        `ink keys ${JSON.stringify(saved?.inkKeys)}; answers ${JSON.stringify(saved?.answers)}; reader +${reader.requests.length - before}`);
      await check('and the page is frozen beside it as a picture with its digest',
        /^[0-9a-f]{64}$/.test(saved?.pages?.[inkKey]?.digest || '') && saved.pages[inkKey].picture === true, JSON.stringify(saved?.pages));
      let snapshot = null;
      for (let i = 0; i < 60; i++) {
        await page.clock.runFor(500);
        snapshot = serverRow('exam-answers');
        if (snapshot?.value?.ink && Object.keys(snapshot.value.ink).length === 1) break;
        await page.waitForTimeout(150);
      }
      const sentDigest = Object.values(snapshot?.value?.ink || {})[0];
      await check('the server\'s checkpoint holds that digest — and no picture, no strokes',
        sentDigest === saved?.pages?.[inkKey]?.digest && !/base64|strokes|points/.test(snapshot?.raw || ''), `server ink ${JSON.stringify(snapshot?.value?.ink)}`);

      // ── 2 · the student is told, before submitting and as time runs short ───
      await page.locator('.exam-head').getByRole('button', { name: 'Review and submit' }).click();
      const dialog = page.locator('[role="dialog"]');
      await check('Review and submit says one handwritten answer has not been read, and what will happen to it',
        (await dialog.locator('[data-exam-confirm-unread]').getAttribute('data-exam-confirm-unread')) === '1' &&
          /1 handwritten answer has not been read/.test(await dialog.innerText()) && /not marked until then/.test(await dialog.innerText()),
        (await dialog.innerText()).replace(/\s+/g, ' ').slice(0, 260));
      await dialog.getByRole('button', { name: 'Keep working' }).click();
      await check('with most of the hour left there is no warning on the page yet', await page.locator('[data-exam-unread-warning]').count() === 0);
      await page.clock.fastForward('56:00');
      await page.waitForSelector('[data-exam-unread-warning]', { timeout: 15000 }).catch(() => {});
      const warning = page.locator('[data-exam-unread-warning]');
      await check('inside the last five minutes the room warns, on the page, that a handwritten answer has not been read',
        await warning.count() === 1 && /1 handwritten answer has not been read/.test(await warning.innerText()) && /Press Read my answer/.test(await warning.innerText()),
        await warning.count() ? (await warning.innerText()).replace(/\s+/g, ' ').slice(0, 200) : 'no warning');
      await check('and still nothing has been sent to the reader', reader.requests.length === before, `reader +${reader.requests.length - before}`);

      // ── 3 · the deadline, with the reader down ──────────────────────────────
      reader.down = true;
      await page.clock.fastForward('05:00');
      const marked = await page.waitForSelector('.hero-num', { timeout: 90000 }).then(() => true).catch(() => false);
      await check('the room submits the paper on its own when the deadline passes', marked);
      const provisional = page.locator('[data-exam-provisional]');
      await provisional.waitFor({ timeout: 15000 }).catch(() => {});
      const frozen = await storedExam(page, examId);
      const result1 = serverRow('exam-result')?.value;
      const page1 = Object.values(result1?.handwriting?.pages || {})[0];
      await check('the result says marks are not decided yet, because handwriting was saved and not read',
        await provisional.count() === 1 && /not decided yet/.test(await provisional.innerText()) && Number(await provisional.getAttribute('data-exam-provisional')) > 0,
        await provisional.count() ? (await provisional.innerText()).replace(/\s+/g, ' ') : 'no provisional note');
      await check('the handwritten answer is shown as "Not marked yet" — not blank, not wrong — and says its page was saved as written',
        await page.locator('[data-exam-pending-line="awaiting-reading"]').count() === 1 &&
          /Not marked yet/.test(await page.locator('[data-exam-pending-line]').first().innerText()) &&
          /saved exactly as you left it/.test((await page.locator('main').innerText()).replace(/\s+/g, ' ')),
        `pending tags ${await page.locator('[data-exam-pending-line]').count()}`);
      await check('on the device the answer is pending, its frozen picture is kept, and no mark was invented for it',
        frozen?.pending?.length === 1 && frozen.pending[0].state === 'awaiting-reading' && frozen.pending[0].correct === false && frozen.pending[0].given === '' && frozen.heldPages.length === 1,
        JSON.stringify({ pending: frozen?.pending, held: frozen?.heldPages }));
      await check(`on the server the page is frozen by the same digest and awaiting reading; the one read tried at the deadline failed and was counted [${EVIDENCE}]`,
        page1?.digest === sentDigest && page1.state === 'awaiting-reading' && page1.attempts === 1 && page1.reason === 'reader-unavailable' && result1.finalisedBy === 'deadline',
        JSON.stringify(page1));
      const afterDeadline = reader.requests.length - before;
      // The list of papers says so too: a score with marks still undecided is not shown as final.
      await page.goto(`${base}/exams`, { waitUntil: 'domcontentloaded' });
      const listed = page.locator('[data-exam-provisional]');
      await listed.first().waitFor({ timeout: 30000 }).catch(() => {});
      await check('the list of papers shows that score as provisional: marks "not marked yet" beside it',
        await listed.count() === 1 && Number(await listed.getAttribute('data-exam-provisional')) > 0 && /not marked yet/.test(await listed.innerText()),
        await listed.count() ? await listed.innerText() : 'no provisional marker in the list');
      await page.goto(`${base}/exams/${examId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.hero-num', { timeout: 30000 });
      await check('there is no canvas, no clock and no way to write on the paper any more',
        await page.locator('.ink-canvas-live').count() === 0 && await page.locator('.exam-timer').count() === 0 && await page.locator('[data-ink-read]').count() === 0);

      // ── 4 · the reader comes back: the frozen page is read once ─────────────
      reader.down = false;
      // Desk step (no product route exists for it, and none is used): the
      // server's own backoff before the next attempt is a real minute on the
      // server's real clock; the desk ends that wait in the result row.
      {
        const row = serverRow('exam-result');
        for (const p of Object.values(row.value.handwriting.pages)) p.nextAttemptAt = 0;
        db.prepare("UPDATE idempotency_keys SET response_json=? WHERE scope='exam-result' AND account_id=? AND key=?").run(JSON.stringify(row.value), online.account.id, row.key);
      }
      let settledRow = null;
      for (let i = 0; i < 60; i++) {
        await page.clock.fastForward('00:35');
        await page.waitForTimeout(400);
        settledRow = await storedExam(page, examId);
        if (settledRow && !settledRow.pending.length) break;
      }
      await page.waitForSelector('[data-exam-provisional]', { state: 'detached', timeout: 15000 }).catch(() => {});
      const result2 = serverRow('exam-result')?.value;
      const page2 = Object.values(result2?.handwriting?.pages || {})[0];
      const line = settledRow?.lines.find(l => l.id === frozen?.pending?.[0]?.id);
      const total = reader.requests.length - before;
      await check(`when the reader is back the frozen page is read once and resolved on the server: exactly one more provider call [${EVIDENCE}]`,
        page2?.state === 'resolved' && page2.attempts === 2 && page2.digest === sentDigest && total === afterDeadline + 1, `${JSON.stringify(page2)}; provider calls ${total} (${afterDeadline} at the deadline)`);
      await check('the answer is now marked by the server on what was written ("42"), flagged as read after the paper closed, and its picture is forgotten',
        !!line && line.pending === false && line.given === '42' && line.readAfterClose === true && line.unanswered === false && settledRow.heldPages.length === 0 && settledRow.score === result2.score,
        JSON.stringify({ line, held: settledRow?.heldPages, score: settledRow?.score, server: result2?.score }));
      await check('every other line of the paper is exactly what it was at the deadline',
        JSON.stringify(settledRow?.lines.filter(l => l.id !== line?.id)) === JSON.stringify(frozen?.lines.filter(l => l.id !== line?.id)));
      await check('the page no longer calls the result provisional, and shows the mark',
        await page.locator('[data-exam-provisional]').count() === 0 && await page.locator('[data-exam-pending-line]').count() === 0);
      await check('the frozen submission did not change: same finish time, same digest, same deadline',
        result2?.finishedAt === result1?.finishedAt && result2?.handwriting?.submissionDigest === result1?.handwriting?.submissionDigest && result2?.deadline === result1?.deadline);
      await page.clock.fastForward('03:00');
      await page.waitForTimeout(600);
      await page.goto(`${base}/exams`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.tag', { timeout: 30000 }).catch(() => {});
      await check('and once it is marked the list shows the score with no provisional marker', await page.locator('[data-exam-provisional]').count() === 0);
      await check('and nothing more is ever sent for it', reader.requests.length - before === total, `provider calls ${reader.requests.length - before}`);
      note(`provider calls for the unread handwritten exam answer [${EVIDENCE}]: ${afterDeadline} while the reader was down at the deadline (one bounded read operation), then 1 when it was read`);
      await check('no provider was reached but the scripted reader', reader.refused.length === 0, JSON.stringify(reader.refused));
    } finally {
      reader.down = false; reader.gate = null; reader.lines = null; reader.text = '7'; reader.confidence = 0.6;
    }
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
