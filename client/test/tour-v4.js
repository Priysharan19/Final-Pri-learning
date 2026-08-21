// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — the exam room, and the shell around it.
//
// An exam is the one screen where an hour of a student's work exists as React
// state and nothing else until they press submit. It generates a paper, holds
// answers for eleven questions across a clock, and then marks the lot in a
// single pass. Nothing outside a browser can drive that.
//
// HOW A CORRECT EXAM ANSWER IS KNOWN. The app already publishes it: every paper
// can be printed with its marking criteria and worked solutions behind it, and
// that sheet is a real feature students use. So this flow prints the paper it
// was just given, reads the stated answers off the sheet, types them back into
// the room, and requires them to be marked right — which is exactly the claim
// the printed sheet makes. One question is answered with nonsense on purpose,
// so the flow proves the marker can say no as well as yes, and the arithmetic
// of the final score is checked against the per-question marks rather than
// taken on trust.
//
// Run on its own:  node client/test/tour-v4.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';

const YEAR = 9;
const LENGTH = 10;
const NONSENSE = 'zzz-not-an-answer';
const ANSWER_WITH_SOLUTION = 6;   // how many questions to answer from the printed sheet

// Every route in the sidebar, with the title the shell is supposed to set for
// it. A page that renders the wrong route still renders; the title is what says
// which one it thinks it is.
const ROUTES = [
  ['/', 'Home'],
  ['/tasks', 'Tasks'],
  ['/match', 'Match'],
  ['/progress', 'Progress'],
  ['/favorites', 'Favorites'],
  ['/exams', 'Exams'],
  ['/classes', 'Classes'],
  ['/history', 'History'],
  ['/settings', 'Settings']
];

// A page has arrived when it has put something of its own on the screen — a
// card, a heading, or the empty state a screen with no data shows instead.
const RENDERED = '.card, .locked-card, .qpage, .home-greet, h1';

/** The answers the printed paper states, keyed by question number. */
const paperAnswers = (page) => page.evaluate(() => {
  const best = new Map();
  for (const el of document.querySelectorAll('.paper-sheet div')) {
    const clone = el.cloneNode(true);
    for (const m of clone.querySelectorAll('.katex-mathml')) m.remove();
    const text = (clone.textContent || '').replace(/\s+/g, ' ').trim();
    const found = /^Question (\d+) — answer:\s*(.+)$/.exec(text);
    if (!found) continue;
    const n = Number(found[1]);
    const answer = found[2].trim();
    // Both the wrapper and the line itself match; the shorter one is the line.
    if (!best.has(n) || answer.length < best.get(n).length) best.set(n, answer);
  }
  return [...best.entries()];
});

/** The printed answer, less whatever the answer row already prints around the box. */
async function stripFurniture(page, mathText, stated) {
  let typed = stated;
  const prefix = (await page.locator('.answer-row .answer-prefix').count())
    ? (await mathText('.answer-row .answer-prefix')) || '' : '';
  const suffix = (await page.locator('.answer-row .answer-suffix').count())
    ? (await page.locator('.answer-row .answer-suffix').innerText()).trim() : '';
  if (prefix && typed.startsWith(prefix)) typed = typed.slice(prefix.length).trim();
  if (suffix && typed.endsWith(suffix)) typed = typed.slice(0, -suffix.length).trim();
  return typed || stated;
}

/** Every marked question in the review, as {n, awarded, marks, given}. */
const reviewRows = (page) => page.evaluate(() => {
  const rows = [];
  for (const card of document.querySelectorAll('.card')) {
    const meta = card.querySelector('.q-meta');
    if (!meta) continue;
    const label = meta.innerText.replace(/\s+/g, ' ');
    const q = /Q(\d+)\b/.exec(label);
    const marks = /(\d+)\/(\d+) marks/.exec(label);
    if (!q || !marks) continue;
    const body = card.innerText.replace(/\s+/g, ' ');
    const given = /Your answer:\s*(.*?)\s*Correct answer:/.exec(body);
    rows.push({ n: Number(q[1]), awarded: Number(marks[1]), marks: Number(marks[2]), given: given ? given[1] : null });
  }
  return rows;
});

export const flow = {
  id: 'exam',
  name: 'Exam · a paper generated, sat and marked',

  async run({ page, base, check, note, goto, createProfile, mathText, settle }) {
    await goto('/');
    await createProfile({ name: 'Emmy Noether', year: YEAR });

    // ── 1 · every screen in the shell renders ────────────────────────────────
    // Cheap, and it is the difference between "the exam room broke" and "the
    // app broke": a route that throws is caught by the boundary and looks like
    // a page until somebody reads it.
    for (const [route, title] of ROUTES) {
      await page.goto(base + route, { waitUntil: 'domcontentloaded' });
      const rendered = await page.waitForSelector(RENDERED, { timeout: 20000 }).then(() => true).catch(() => false);
      await check(`${route} renders its own page`, rendered, `nothing matching ${RENDERED} appeared`);
      await check(`${route} knows which page it is`, await page.title() === `${title} · Pri Learning`,
        `the tab reads ${JSON.stringify(await page.title())}, expected ${JSON.stringify(title + ' · Pri Learning')}`);
      await check(`${route} did not fall to the error boundary`,
        await page.locator('.crash-card').count() === 0);
    }

    // ── 2 · a paper is generated ─────────────────────────────────────────────
    await page.goto(`${base}/exams`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button:has-text("Start exam")', { timeout: 30000 });
    await page.locator('.card').first().locator('select').nth(1).selectOption(String(LENGTH));
    await page.getByRole('button', { name: 'Start exam' }).click();
    await page.waitForSelector('.exam-timer', { timeout: 60000 });
    const examId = new URL(page.url()).pathname.split('/').pop();

    const dots = await page.locator('.exam-dot').count();
    await check('a paper of the asked-for length is generated, plus Section II',
      dots === LENGTH + 1, `${dots} questions on the paper, expected ${LENGTH} + 1 structured`);
    await page.locator('.exam-dot').nth(dots - 1).click();
    await settle();
    await check('Section II is a structured question',
      (await page.locator('.q-meta').innerText()).includes('Structured'),
      `the last question reads ${JSON.stringify((await page.locator('.q-meta').innerText()).replace(/\s+/g, ' '))}`);
    const parts = await page.locator('.answer-row input.answer-input, .mcq').count();
    await check('the structured question takes an answer for each of its parts', parts >= 2,
      `${parts} answer controls on a multi-part question`);
    await page.locator('.exam-dot').nth(0).click();
    await settle();
    await check('the clock is running',
      /\d+:\d\d/.test(await page.locator('.exam-timer').innerText()),
      `timer reads ${JSON.stringify(await page.locator('.exam-timer').innerText())}`);
    await check('nothing is answered yet',
      /\b0\/\d+ answered/.test(await page.locator('.exam-head').innerText()),
      `head reads ${JSON.stringify(await page.locator('.exam-head').innerText())}`);

    // ── 3 · the paper prints with its own solutions ──────────────────────────
    await page.goto(`${base}/exams`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.prio-item', { timeout: 30000 });
    await check('an unfinished paper is listed as in progress',
      (await page.locator('.prio-item').first().innerText()).includes('In progress'));
    await page.locator('.prio-item button[title*="printable"]').first().click();
    await page.waitForSelector('.paper-sheet', { timeout: 30000 });
    const stated = new Map(await paperAnswers(page));
    await check('the printed paper states an answer for every single question',
      stated.size === LENGTH, `${stated.size} stated answers for ${LENGTH} single questions`);
    await page.getByRole('button', { name: 'Close' }).click();

    // ── 4 · the paper is sat ─────────────────────────────────────────────────
    await page.goto(`${base}/exams/${examId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.exam-timer', { timeout: 30000 });

    const answerBox = page.locator('.answer-row input.answer-input');
    const answered = [];
    let nonsenseAt = null;
    for (let i = 0; i < dots && answered.length < ANSWER_WITH_SOLUTION; i++) {
      await page.locator('.exam-dot').nth(i).click();
      await settle();
      const meta = await page.locator('.q-meta').innerText();
      if (meta.includes('Structured')) continue;
      if (await answerBox.count() !== 1) continue;      // multiple choice or full working
      const n = i + 1;
      const say = stated.get(n);
      if (!say) continue;
      // The printed sheet states the whole answer — "θ = 29 °", "6 % p.a." —
      // but the room already prints the prefix and the unit either side of the
      // box, so what a student types into it is the part in between. Typing the
      // unit back in as well is a different question (whether the checker
      // tolerates it) and not the one this flow is asking.
      const typed = await stripFurniture(page, mathText, say);
      await answerBox.fill(typed);
      answered.push({ n, typed });
    }
    for (let i = dots - 1; i >= 0 && nonsenseAt === null; i--) {
      if (answered.some(a => a.n === i + 1)) continue;
      await page.locator('.exam-dot').nth(i).click();
      await settle();
      if ((await page.locator('.q-meta').innerText()).includes('Structured')) continue;
      if (await answerBox.count() !== 1) continue;
      await answerBox.fill(NONSENSE);
      nonsenseAt = i + 1;
    }

    if (!await check(`${ANSWER_WITH_SOLUTION} questions were answered from the printed solutions`,
      answered.length === ANSWER_WITH_SOLUTION,
      `only ${answered.length} of the ${dots} questions took a typed answer the sheet had stated`)) return;
    if (!await check('one question was answered with nonsense on purpose', nonsenseAt !== null)) return;

    await check('the paper counts what has been answered',
      new RegExp(`\\b${answered.length + 1}/${dots} answered`).test(await page.locator('.exam-head').innerText()),
      `head reads ${JSON.stringify(await page.locator('.exam-head').innerText())}`);

    // ── 5 · marks come back ──────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Submit paper' }).click();
    await page.waitForSelector('.hero-num', { timeout: 60000 });
    const headline = (await page.locator('.hero-num').innerText()).replace(/\s+/g, ' ').trim();
    const shown = /(\d{1,3})\s*%/.exec(headline);
    await check('the paper is marked and scored', !!shown,
      `headline reads ${JSON.stringify(headline)}`);
    const summary = await page.locator('.card').first().innerText();
    const scored = /(\d+) of (\d+) marks/.exec(summary.replace(/\s+/g, ' '));
    if (!await check('the result is stated in marks, not just a percentage', !!scored,
      `summary reads ${JSON.stringify(summary.replace(/\s+/g, ' ').slice(0, 160))}`)) return;
    const [, score, total] = scored.map(Number);

    const rows = await reviewRows(page);
    await check('every question comes back marked', rows.length === dots,
      `${rows.length} marked questions in the review, expected ${dots}`);

    // ── 6 · the marking is right, question by question ───────────────────────
    for (const { n, typed } of answered) {
      const row = rows.find(r => r.n === n);
      await check(`Q${n} answered from the paper's own solution (${JSON.stringify(typed)}) is marked correct`,
        !!row && row.awarded === row.marks && row.marks >= 1,
        row ? `awarded ${row.awarded} of ${row.marks} marks` : 'no review row for that question');
    }
    const bad = rows.find(r => r.n === nonsenseAt);
    await check(`Q${nonsenseAt} answered with nonsense earns nothing`,
      !!bad && bad.awarded === 0, bad ? `awarded ${bad.awarded} of ${bad.marks}` : 'no review row');
    await check('the review shows back what was actually submitted',
      !!bad && (bad.given || '').includes(NONSENSE),
      `review says the answer given was ${JSON.stringify(bad?.given)}`);

    // ── 7 · the totals add up ────────────────────────────────────────────────
    const sumAwarded = rows.reduce((n, r) => n + r.awarded, 0);
    const sumMarks = rows.reduce((n, r) => n + r.marks, 0);
    await check('the score is the sum of the marks awarded', score === sumAwarded,
      `paper says ${score}, the questions add to ${sumAwarded}`);
    await check('the total is the sum of the marks available', total === sumMarks,
      `paper says ${total}, the questions add to ${sumMarks}`);
    await check('the headline percentage is the marks it was given',
      !!shown && Number(shown[1]) === Math.round(100 * score / total),
      `headline says ${JSON.stringify(shown && shown[1])}%, ${score}/${total} is ${Math.round(100 * score / total)}%`);
    await check('answering correctly is what earned those marks', score > 0,
      'a paper with correct answers on it scored zero');
    const unanswered = rows.filter(r => r.n !== nonsenseAt && !answered.some(a => a.n === r.n));
    await check('questions left blank earn nothing',
      unanswered.every(r => r.awarded === 0),
      `blank questions were awarded ${JSON.stringify(unanswered.filter(r => r.awarded).map(r => `Q${r.n}:${r.awarded}`))}`);
    note(`the paper scored ${score}/${total} with ${answered.length} of ${dots} questions answered from its own solutions`);

    // ── 8 · the finished paper is filed ──────────────────────────────────────
    await page.goto(`${base}/exams`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.prio-item', { timeout: 30000 });
    await check('the finished paper is filed with its score',
      (await page.locator('.prio-item').first().innerText()).includes(`${score}/${total}`),
      `row reads ${JSON.stringify((await page.locator('.prio-item').first().innerText()).replace(/\s+/g, ' '))}`);
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
