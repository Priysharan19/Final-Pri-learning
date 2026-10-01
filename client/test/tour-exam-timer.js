// Exam clock · a real timed paper driven through its warnings and to zero.
//
// The room counts down one tick at a time and announces the time left in words
// at 10, 5 and 1 minutes. A regression once shadowed the translation function
// inside that tick, so the room threw on exactly those ticks and the paper was
// never auto-submitted at zero. This flow drives the real clock across each
// boundary instead of trusting a static check: Playwright's fake clock moves
// Date forward, the room is reloaded (which re-reads the paper's own start time
// from its draft, the same path a crash recovery takes), and the remaining
// seconds are stepped through tick by tick.
import { pathToFileURL } from 'node:url';

const YEAR = 9;

function secondsLeft(text) {
  const m = /(\d+):(\d\d)/.exec(text || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

async function tick(page, seconds) {
  for (let i = 0; i < seconds; i++) {
    await page.clock.runFor(1000);
    await page.waitForTimeout(15);   // let React commit the tick before the next
  }
}

export const flow = {
  id: 'exam-timer',
  name: 'Exam clock · warnings announced, auto-submit at zero',

  async run({ page, check, goto, createProfile }) {
    await page.clock.install();
    await goto('/');
    await createProfile({ name: 'Ada Clock', year: YEAR });

    await goto('/exams');
    await page.waitForSelector('button:has-text("Start practice paper")', { timeout: 30000 });
    await page.getByRole('button', { name: 'Start practice paper' }).click();
    await page.waitForSelector('.exam-timer', { timeout: 60000 });
    const url = page.url();
    const total = secondsLeft(await page.locator('.exam-timer').innerText());
    if (!await check('the paper starts on a running clock', total > 620, `timer reads ${total}s`)) return;
    await page.waitForTimeout(700);   // the draft (and its start time) is written

    // ── across the ten-minute warning ──────────────────────────────────────
    await page.clock.fastForward((total - 603) * 1000);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.exam-timer', { timeout: 30000 });
    const before = secondsLeft(await page.locator('.exam-timer').innerText());
    await check('a reloaded paper resumes from its own start time', before !== null && before <= 605 && before >= 598, `${before}s left`);
    await tick(page, Math.max(0, before - 599));
    await check('the room survives the ten-minute tick', await page.locator('.exam-timer').count() === 1 && await page.locator('.crash-card').count() === 0);
    await check('ten minutes left is announced in words',
      /10 minutes left/.test(await page.locator('[role="status"][aria-live="assertive"]').innerText()));

    // ── across the one-minute warning ──────────────────────────────────────
    await page.clock.fastForward(Math.max(0, (secondsLeft(await page.locator('.exam-timer').innerText()) - 63)) * 1000);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.exam-timer', { timeout: 30000 });
    const nearMinute = secondsLeft(await page.locator('.exam-timer').innerText());
    await tick(page, Math.max(0, nearMinute - 59));
    await check('the room survives the one-minute tick', await page.locator('.exam-timer').count() === 1 && await page.locator('.crash-card').count() === 0);
    await check('one minute left is announced in words',
      /1 minute left/.test(await page.locator('[role="status"][aria-live="assertive"]').innerText()));
    await check('under five minutes is said in words, not colour alone',
      /under 5 min/.test(await page.locator('.exam-timer').innerText()));

    // ── to zero: the paper submits itself ───────────────────────────────────
    const nearZero = secondsLeft(await page.locator('.exam-timer').innerText());
    await page.clock.fastForward(Math.max(0, nearZero - 3) * 1000);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.exam-timer', { timeout: 30000 });
    await tick(page, 6);
    const marked = await page.waitForSelector('.hero-num', { timeout: 30000 }).then(() => true).catch(() => false);
    await check('at zero the paper is submitted and marked without a press', marked);
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
