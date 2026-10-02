// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — a submission the app was killed in the middle of.
//
// §09: one action creates at most one authoritative attempt, and an interrupted
// submission recovers without data loss or "did it submit?" ambiguity. The
// interruption is simulated the only deterministic way a browser allows: the
// card's own pending-submission record (written synchronously before a request
// leaves) is placed in storage exactly as a kill would leave it, and the page
// is reloaded. Everything after that is the shipped code path.
//
//   1. killed before the request landed → the relaunch marks it, without a tap
//   2. killed after it landed (same key again) → the relaunch shows the same
//      verdict and does NOT spend the student's second try
//   3. killed after a resolving submission → the relaunch brings back that
//      answered question with its evaluation, not a fresh question
//   4. handwriting on an unanswered question survives a reload
//
// Run on its own:  node client/test/tour-submit-lifecycle.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { TEMPLATES } from '../src/ink/templates.js';

const TOPIC = 'y7-equations';
const WRONG_1 = '-987654';
const WRONG_2 = '-9876541';
const MAX_QUESTIONS = 8;

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

/** The ids the typed-answer draft is filed under: pri.draft.<pid>.question.<qid>. */
const draftIds = (page) => page.evaluate(() => {
  for (let i = 0; i < localStorage.length; i++) {
    const m = /^pri\.draft\.([^.]+)\.question\.(.+)$/.exec(localStorage.key(i) || '');
    if (m) return { pid: m[1], qid: m[2] };
  }
  return null;
});

/** Leave storage exactly as a kill between "sent" and "answered" leaves it. */
const plantPending = (page, pid, qid, submissionId, answer) => page.evaluate(({ pid, qid, submissionId, answer }) => {
  localStorage.setItem(`pri.draft.${pid}.submit.${qid}`, JSON.stringify({
    v: 1, scope: 'submit', id: qid, label: '', note: 'Answer being marked', path: '/practice', savedAt: Date.now(),
    data: { submissionId, answer, viaInk: false, ms: 1500, lines: null }
  }));
}, { pid, qid, submissionId, answer });

/** The opaque id of the question on screen — identity, not prompt text. */
const shownId = (page) => page.locator('.qpage').first().getAttribute('data-question-id');

/** Wait until a draft of this kind exists in storage (the real write, not a delay). */
const draftWritten = (page, pattern) => page.waitForFunction(src => {
  const re = new RegExp(src);
  for (let i = 0; i < localStorage.length; i++) if (re.test(localStorage.key(i) || '')) return true;
  return false;
}, pattern.source, { timeout: 15000 }).then(() => true, () => false);

const pendingLeft = (page) => page.evaluate(() => {
  for (let i = 0; i < localStorage.length; i++) if (/\.submit\./.test(localStorage.key(i) || '')) return true;
  return false;
});

export const flow = {
  id: 'submit-lifecycle',
  name: 'Submission · interruption recovery and one attempt',

  async run({ page, base, check, goto, createLegacyProfile, mathText, settle }) {
    await goto('/');
    await createLegacyProfile({ name: 'Rosalind Franklin', year: 7 });
    const practice = `${base}/practice?subtopic=${TOPIC}`;
    const reopen = async () => {
      await page.goto(practice, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
    };
    await reopen();

    // A question with a single typed answer box, and its ids from the draft
    // the card writes as the student types.
    const typeTab = page.getByRole('button', { name: 'Answer by typing' });
    const answerBox = page.locator('.editor-body input.answer-input');
    let ids = null;
    for (let asked = 0; asked < MAX_QUESTIONS && !ids; asked++) {
      if (await typeTab.count()) await typeTab.click();
      // An answer box, if this question has one (an MCQ has none).
      await answerBox.first().waitFor({ timeout: 3000 }).catch(() => null);
      if (await answerBox.count() === 1) {
        await answerBox.fill(WRONG_1);
        await draftWritten(page, /^pri\.draft\.[^.]+\.question\./);
        ids = await draftIds(page);
        if (ids) break;
      }
      const leaving = await shownId(page);
      await page.locator('.ctx-next').click();
      await page.waitForFunction(id => {
        const el = document.querySelector('.qpage[data-question-id]');
        return el && el.getAttribute('data-question-id') !== id;
      }, leaving, { timeout: 30000 });
    }
    if (!await check('a typed-answer question was served and its draft names it',
      !!ids && ids.qid === await shownId(page), `draft ${JSON.stringify(ids)}, on screen ${await shownId(page)}`)) return;

    // ── 1 · killed before the request landed ─────────────────────────────────
    await plantPending(page, ids.pid, ids.qid, 'sub_e2e_first_try_0001', WRONG_1);
    await reopen();
    await page.waitForSelector('.verdict-bad', { timeout: 20000 }).catch(() => null);
    await check('after a relaunch the cut-off submission is marked without a tap',
      await page.locator('.verdict-bad').count() >= 1 && await shownId(page) === ids.qid,
      `verdict-bad ${await page.locator('.verdict-bad').count()}, question ${await shownId(page)} (want ${ids.qid})`);
    await check('a wrong first try leaves the second try open', await page.locator('.eval-card').count() === 0,
      'the question resolved on its first try');
    await check('the pending record is cleared once answered', !(await pendingLeft(page)), 'a pending record survived its answer');

    // ── 2 · killed after it landed: the same key is replayed ─────────────────
    await plantPending(page, ids.pid, ids.qid, 'sub_e2e_first_try_0001', WRONG_1);
    await reopen();
    await page.waitForSelector('.verdict-bad', { timeout: 20000 }).catch(() => null);
    await settle();
    await check('replaying the same submission shows the same verdict',
      await page.locator('.verdict-bad').count() >= 1, 'no verdict after the replay');
    await check('and does not spend the second try (one tap, one attempt)',
      await page.locator('.eval-card').count() === 0,
      'the replay was marked as a second attempt and resolved the question');

    // ── 3 · killed after a resolving submission ──────────────────────────────
    await plantPending(page, ids.pid, ids.qid, 'sub_e2e_second_try_002', WRONG_2);
    await reopen();
    await page.waitForSelector('.eval-card', { timeout: 20000 }).catch(() => null);
    await check('the second, resolving submission is marked on relaunch',
      await page.locator('.eval-card').count() === 1, 'no evaluation after the resolving replay');
    await plantPending(page, ids.pid, ids.qid, 'sub_e2e_second_try_002', WRONG_2);
    await reopen();
    await page.waitForSelector('.eval-card', { timeout: 20000 }).catch(() => null);
    await check('a relaunch after the verdict was recorded brings back that question and its verdict',
      await page.locator('.eval-card').count() === 1 && await shownId(page) === ids.qid,
      `eval-card ${await page.locator('.eval-card').count()}, question ${await shownId(page)} (want ${ids.qid})`);
    await reopen();
    // Identity, not prompt text: a generator can write the same prompt twice,
    // which is what made this check flaky when it compared prompts (PR #263).
    await check('with nothing pending, the answered question is not served again',
      await shownId(page) !== ids.qid,
      `question ${await shownId(page)} is the resolved ${ids.qid}`);

    // ── 4 · handwriting survives a reload ────────────────────────────────────
    await page.getByRole('button', { name: 'Answer by handwriting' }).click();
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    const inkId = await shownId(page);
    const box = await page.locator('.ink-canvas-live').boundingBox();
    await handwrite(page, box, '1');
    await page.waitForFunction(() => document.querySelectorAll('.ink-line').length === 1, null, { timeout: 15000 }).catch(() => null);
    const before = await page.locator('.ink-line').count();
    // Question ids are opaque [A-Za-z0-9-] tokens, safe inside a pattern.
    const kept = await draftWritten(page, new RegExp(`\\.ink\\.${inkId}$`));
    await check('the handwriting is kept in storage before the reload', kept, 'no ink draft was written');
    await reopen();
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 }).catch(() => null);
    await page.waitForFunction(() => document.querySelectorAll('.ink-line').length >= 1, null, { timeout: 15000 }).catch(() => null);
    await check('the same unanswered question comes back after the reload', await shownId(page) === inkId,
      `before ${inkId} after ${await shownId(page)}`);
    await check('its handwriting is back on the page and read again',
      before === 1 && await page.locator('.ink-line').count() === 1,
      `lines before ${before}, after ${await page.locator('.ink-line').count()}`);
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
