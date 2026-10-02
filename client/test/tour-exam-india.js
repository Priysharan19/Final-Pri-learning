// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — a JEE Main paper, sat by hand, survives a reload.
//
// The India exam room is where an hour of a student's work is most exposed:
// a timed paper, answered partly by Apple Pencil, on a device that may reload,
// background or relaunch at any moment. This flow drives the real room the way
// a JEE Main student does (doc §15):
//
//   · starts the JEE Main Mathematics simulation and reads the clock;
//   · answers a multiple-choice question with its native control;
//   · switches a numerical question to handwriting and writes the answer on the
//     real canvas, stroke by stroke (the same template geometry tour-ink uses),
//     proving the reading fills the answer and that nothing is ticked, crossed
//     or hinted while the paper is open;
//   · waits for the autosave and RELOADS mid-paper: the same deadline, no extra
//     time, the same answers, and the handwriting itself redrawn and re-read;
//   · submits, and reads the per-pattern section analysis — Section A / B,
//     +4/−1 negative marking — which must agree with the marked questions;
//   · reloads the finalised paper, which must come back marked, not reopened.
//
// Run on its own:  node client/test/tour-exam-india.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { TEMPLATES } from '../src/ink/templates.js';

const GLYPH_W = 58;
const GLYPH_H = 84;
const ADVANCE = 66;

async function handwrite(page, box, text, { x = 40, y = 34 } = {}) {
  let ox = box.x + x;
  for (const ch of text) {
    const variant = TEMPLATES[ch]?.[0];
    if (!variant) throw new Error(`no template for ${JSON.stringify(ch)}`);
    for (const stroke of variant) {
      const pts = stroke.map(([px, py]) => [ox + (px / 100) * GLYPH_W, box.y + y + (py / 100) * GLYPH_H]);
      await page.mouse.move(pts[0][0], pts[0][1]);
      await page.mouse.down();
      for (const [px, py] of pts) await page.mouse.move(px, py);
      await page.mouse.up();
    }
    ox += ADVANCE;
  }
  await page.waitForTimeout(700);
}

const reading = (page) => page.locator('.ink-line .ink-syms').allInnerTexts()
  .then(lines => lines.map(l => l.replace(/\s+/g, '')));

const secondsOn = (text) => {
  const m = /(\d+):(\d\d)(?::(\d\d))?/.exec(text || '');
  if (!m) return null;
  return m[3] !== undefined ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : Number(m[1]) * 60 + Number(m[2]);
};

/** The stored exam row, read from the device's own store. */
const storedExam = (page, examId) => page.evaluate(async (examId) => {
  const db = await new Promise((ok, no) => { const r = indexedDB.open('pri-learning'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  const row = await new Promise((ok, no) => { const r = db.transaction('exams').objectStore('exams').get(examId); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  db.close();
  return row ? {
    deadlineAt: row.deadlineAt, startedAt: row.startedAt, finishedAt: row.finishedAt,
    answers: row.responses?.answers || null,
    inkKeys: Object.keys(row.responses?.inks || {}),
    inkPoints: Object.values(row.responses?.inks || {}).reduce((n, v) => n + (v.strokes || []).reduce((m, s) => m + s.points.length, 0), 0),
    final: row.final ? { finalisedBy: row.final.finalisedBy, inkKeys: Object.keys(row.final.inks || {}), paperVersion: row.final.paperVersion } : null
  } : null;
}, examId);

const waitSaved = (page) => page.waitForSelector('.exam-save[data-state="saved"]', { timeout: 15000 }).then(() => true).catch(() => false);

export const flow = {
  id: 'exam-india',
  name: 'India exam · JEE Main handwritten, reloaded, analysed',

  async run({ page, base, check, note, goto, createProfile, settle }) {
    await goto('/');
    await createProfile({ name: 'Chitra Rao', year: 12, course: 'in', track: 'jee-main' });

    // ── 1 · the paper starts, with a clock read off a stored deadline ────────
    await page.goto(`${base}/exams`, { waitUntil: 'domcontentloaded' });
    const start = page.getByRole('button', { name: 'Start JEE Main Mathematics simulation' });
    await start.waitFor({ timeout: 30000 });
    await start.click();
    await page.waitForSelector('.exam-timer', { timeout: 60000 });
    const examId = new URL(page.url()).pathname.split('/').pop();
    const dots = await page.locator('.exam-dot').count();
    await check('the JEE Main paper has 25 questions', dots === 25, `${dots} on the paper`);
    const deadline = Number(await page.locator('.exam-timer').getAttribute('data-deadline'));
    const stored = await storedExam(page, examId);
    await check('the room counts down to the deadline the backend stored', !!stored && deadline === stored.deadlineAt,
      `room ${deadline}, stored ${stored?.deadlineAt}`);
    await check('the stored deadline is the start plus 60 minutes', !!stored && stored.deadlineAt - stored.startedAt === 3600000,
      `${stored && (stored.deadlineAt - stored.startedAt)} ms`);
    const t0 = secondsOn(await page.locator('.exam-timer').innerText());
    await check('the clock shows the time left', t0 !== null && t0 <= 3600 && t0 > 3500, `timer reads ${t0}s`);

    // ── 2 · a multiple-choice answer, with its native control ────────────────
    await page.locator('.exam-dot').nth(0).click();
    await settle();
    await check('a multiple-choice question offers no write/type switch — its options are the control',
      await page.getByRole('button', { name: '✍ Write by hand' }).count() === 0);
    const optionB = page.locator('.mcq .mcq-opt').nth(1);
    await optionB.click();
    await check('choosing an option marks it as chosen', (await optionB.getAttribute('aria-pressed')) === 'true');

    // ── 3 · a numerical answer, written by hand ──────────────────────────────
    await page.locator('.exam-dot').nth(20).click();
    await settle();
    const metaB = (await page.locator('.q-meta').innerText()).replace(/\s+/g, ' ');
    await check('question 21 is in Section B (numerical value)', /Section B/.test(metaB), `meta reads ${JSON.stringify(metaB)}`);
    await check('a numerical-entry question keeps its keyboard entry by default',
      await page.locator('.answer-row input.answer-input').count() === 1
      && (await page.getByRole('button', { name: '⌨ Type' }).getAttribute('aria-pressed')) === 'true');
    await page.getByRole('button', { name: '✍ Write by hand' }).click();
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    const canvas = page.locator('.ink-canvas-live');
    const box = await canvas.boundingBox();
    await check('the writing space mounts in the exam room', !!box && box.width > 200 && box.height > 150, JSON.stringify(box));
    await handwrite(page, box, '42');
    const read = await reading(page);
    await check('the handwriting is read as 42', read.length === 1 && read[0] === '42', `read ${JSON.stringify(read)}`);
    const filled = await page.locator('.answer-row input.answer-input').inputValue();
    await check('the reading becomes the answer that will be marked', filled === '42', `answer box holds ${JSON.stringify(filled)}`);
    await check('the ink is not ticked or crossed while the paper is open',
      await page.locator('.ink-verdict, .ink-linebox, .ink-note').count() === 0);
    const helpControls = await page.locator('main').getByRole('button', { name: /hint|explain|solution|reveal|tutor|check my/i }).count();
    const solutionPanels = await page.locator('main details, main .steps, main .eval-card').count();
    const open = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    await check('no hint, explanation or solution is offered mid-paper',
      helpControls === 0 && solutionPanels === 0 && !/Correct answer/i.test(open),
      `${helpControls} help controls, ${solutionPanels} solution panels`);
    await check('the paper counts both answers', /\b2\/25 answered/.test(await page.locator('.exam-head').innerText()),
      await page.locator('.exam-head').innerText());

    // ── 4 · autosave, then a reload mid-paper ────────────────────────────────
    // Saved means the device store holds the handwritten answer, not merely
    // that the indicator once said so.
    let saved = null;
    for (let i = 0; i < 60; i++) {
      saved = await storedExam(page, examId);
      if (saved?.answers && Object.values(saved.answers).includes('42') && saved.inkKeys?.length) break;
      await page.waitForTimeout(250);
    }
    await check('the paper autosaves to the device', await waitSaved(page), 'the save indicator never said saved');
    await check('the saved paper holds both answers', !!saved?.answers && Object.values(saved.answers).includes('42') && Object.keys(saved.answers).length === 2,
      JSON.stringify(saved?.answers));
    await check('the saved paper holds the handwriting strokes', saved?.inkKeys?.length === 1 && saved.inkPoints > 10,
      `${saved?.inkKeys?.length} ink keys, ${saved?.inkPoints} points`);
    const before = secondsOn(await page.locator('.exam-timer').innerText());

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.exam-timer', { timeout: 30000 });
    await settle();
    const after = secondsOn(await page.locator('.exam-timer').innerText());
    await check('a reload keeps the same deadline', Number(await page.locator('.exam-timer').getAttribute('data-deadline')) === deadline);
    await check('a reload gives no extra time', after !== null && before !== null && after <= before, `before ${before}s, after ${after}s`);
    await check('the room says it picked the paper back up', /picked up where you left off/.test(await page.locator('.exam-head').innerText()));
    await check('both answers survive the reload', /\b2\/25 answered/.test(await page.locator('.exam-head').innerText()),
      await page.locator('.exam-head').innerText());
    await page.locator('.exam-dot').nth(0).click();
    await settle();
    await check('the chosen option is still chosen', (await page.locator('.mcq .mcq-opt').nth(1).getAttribute('aria-pressed')) === 'true');
    await page.locator('.exam-dot').nth(20).click();
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    await page.waitForSelector('.ink-line', { timeout: 15000 }).catch(() => {});
    const reread = await reading(page);
    await check('the handwriting is redrawn and re-read after the reload', reread.length === 1 && reread[0] === '42', `read ${JSON.stringify(reread)}`);
    await check('the handwritten answer is still the answer', (await page.locator('.answer-row input.answer-input').inputValue()) === '42');

    // ── 5 · submit, and the section analysis ─────────────────────────────────
    // Formal submission is confirmed: the bar opens a review of what is unanswered.
    await page.locator('.exam-head').getByRole('button', { name: 'Review and submit' }).click();
    await page.locator('[role="dialog"]').getByRole('button', { name: 'Submit paper' }).click();
    await page.waitForSelector('.hero-num', { timeout: 60000 });
    const analysis = page.locator('.exam-analysis');
    await check('the marked paper carries a section analysis', await analysis.count() === 1);
    const text = (await analysis.innerText()).replace(/\s+/g, ' ');
    await check('the analysis states what was attempted', /Attempted 2 of 25/.test(text), text.slice(0, 200));
    const rows = await analysis.locator('tbody tr th').allInnerTexts();
    await check('the analysis has Section A and Section B', rows.length === 2 && /Section A/i.test(rows[0]) && /Section B/i.test(rows[1]), JSON.stringify(rows));
    await check('the analysis explains negative marking', /Negative marking/.test(text), text.slice(0, 300));
    const scoreLine = (await page.locator('.card').first().innerText()).replace(/\s+/g, ' ');
    const scored = /(-?\d+) of (\d+) marks/.exec(scoreLine);
    const net = /net (-?\d+)/.exec(text);
    await check('the analysis net agrees with the paper score', !!scored && !!net && scored[1] === net[1],
      `score ${scored?.[1]}, analysis net ${net?.[1]}`);
    const review = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    await check('the handwritten answer is what was marked', /Your answer: 42/.test(review), review.slice(0, 200));
    const done = await storedExam(page, examId);
    await check('finalisation froze the handwriting with the paper', done?.final?.inkKeys?.length === 1 && !!done.final.paperVersion,
      JSON.stringify(done?.final));

    // ── 6 · a finalised paper reopens marked ─────────────────────────────────
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hero-num', { timeout: 30000 });
    await check('a reload of a finalised paper shows the result, not the paper', await page.locator('.exam-timer').count() === 0);
    await check('and the analysis is still there', await page.locator('.exam-analysis').count() === 1);
    note(`JEE Main paper scored ${scored?.[1]}/${scored?.[2]} with one MCQ and one handwritten numerical answer`);
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
