// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — the clock runs out on a JEE Main paper.
//
// The exam room submits a paper itself when its stored deadline passes. Nobody
// can wait an hour in CI, so this flow installs Playwright's controllable clock
// before the app loads, sits a JEE Main paper (one multiple-choice answer,
// autosaved), then fast-forwards past the 60-minute deadline and proves:
//
//   · the room submits on its own, without the student pressing anything;
//   · the result says the paper was submitted when time ran out;
//   · the saved answer is what was marked;
//   · the stored record says the deadline, not the student, finalised it;
//   · a reload shows the marked paper, never a reopened one.
//
// Run on its own:  node client/test/tour-exam-deadline.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';

const storedExam = (page, examId) => page.evaluate(async (examId) => {
  const db = await new Promise((ok, no) => { const r = indexedDB.open('pri-learning'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  const row = await new Promise((ok, no) => { const r = db.transaction('exams').objectStore('exams').get(examId); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  db.close();
  return row ? {
    deadlineAt: row.deadlineAt, finishedAt: row.finishedAt,
    answers: row.responses?.answers || null,
    final: row.final ? { finalisedBy: row.final.finalisedBy, late: row.final.late, answers: row.final.responses?.answers || null } : null
  } : null;
}, examId);

export const flow = {
  id: 'exam-deadline',
  name: 'India exam · the clock runs out and the paper submits itself',

  async run({ page, base, check, note, goto, createProfile, settle }) {
    await page.clock.install();
    await goto('/');
    await createProfile({ name: 'Kavya Nair', year: 12, course: 'in', track: 'jee-main' });

    await page.goto(`${base}/exams`, { waitUntil: 'domcontentloaded' });
    const start = page.getByRole('button', { name: 'Start JEE Main Mathematics simulation' });
    await start.waitFor({ timeout: 30000 });
    await start.click();
    await page.waitForSelector('.exam-timer', { timeout: 60000 });
    const examId = new URL(page.url()).pathname.split('/').pop();

    await page.locator('.exam-dot').nth(0).click();
    await settle();
    await page.locator('.mcq .mcq-opt').nth(2).click();
    let saved = null;
    for (let i = 0; i < 60; i++) {
      saved = await storedExam(page, examId);
      if (saved?.answers && Object.keys(saved.answers).length === 1) break;
      await page.waitForTimeout(250);
    }
    const [qid, answer] = Object.entries(saved?.answers || {})[0] || [];
    await check('the chosen option is autosaved before time runs out', answer === '2', JSON.stringify(saved?.answers));

    // An hour and a minute later.
    await page.clock.fastForward('01:01:00');
    const marked = await page.waitForSelector('.hero-num', { timeout: 60000 }).then(() => true).catch(() => false);
    await check('the room submits the paper on its own when the deadline passes', marked);
    const head = (await page.locator('.card').first().innerText()).replace(/\s+/g, ' ');
    await check('the result says the paper was submitted when time ran out', /Submitted when time ran out/.test(head), head.slice(0, 200));
    await check('there is no clock left on screen', await page.locator('.exam-timer').count() === 0);
    const done = await storedExam(page, examId);
    await check('the deadline, not the student, finalised the paper', done?.final?.finalisedBy === 'deadline', JSON.stringify(done?.final));
    await check('the saved answer is the answer that was marked', !!qid && done?.final?.answers?.[qid] === '2', JSON.stringify(done?.final?.answers));
    await check('the paper was finalised at or after its deadline', !!done && done.finishedAt >= done.deadlineAt,
      `finished ${done?.finishedAt}, deadline ${done?.deadlineAt}`);
    const review = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    await check('the review shows the saved answer', /Your answer: C/.test(review), review.slice(0, 200));

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hero-num', { timeout: 30000 });
    await check('a reload shows the marked paper, not a reopened one', await page.locator('.exam-timer').count() === 0);
    note(`the deadline finalised the paper ${Math.round((done?.finishedAt - done?.deadlineAt) / 1000)} s after it passed`);
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
