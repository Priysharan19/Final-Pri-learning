// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — Section 7 interface parity (Home and the question
// page), driven the way a student drives it.
//
// Home as a command centre (7.2): the rail is one row of rungs — Class, Track,
// Topics, Dot points, Difficulty, Type — with the summary chip and one
// Generate under it, no screen in between; the rail works from a keyboard.
// The question page (7.18, 7.19): marks badge, a running clock, the hint
// ladder climbed one rung at a time, Text / Pen / Photo, Tab to insert maths,
// undo and redo in the editor header, the provenance line, the footer strip,
// and the shortcuts N / H / S / ⌘Z — never while typing.
//
// Synthetic browser evidence. Nothing here is evidence about a device.
// Run on its own:  node client/test/tour-s7-parity.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';

const SURELY_WRONG = '-987654';
const MAX_SKIPS = 12;

export const flow = {
  id: 's7-parity',
  name: 'Section 7 · Home rail, clock, hint ladder, editor, shortcuts, footer',

  async run({ page, base, check, goto, createProfile, settle }) {
    await goto('/');
    await createProfile({ name: 'Parity Student', year: 10, course: 'in' });
    await page.waitForSelector('[data-gen-rail]', { timeout: 30000 });

    // ── 1 · Home: the rail, the chip and Generate on one screen ──────────────
    const rungs = await page.locator('[data-gen-rail] .gen-rung').allInnerTexts();
    await check('the rail shows every step of the request in one row',
      // innerText carries the label's CSS uppercasing, so match case-insensitively.
      rungs.length === 6 && /class/i.test(rungs[0]) && /track/i.test(rungs[1]) && /topics/i.test(rungs[2])
      && /dot points/i.test(rungs[3]) && /difficulty/i.test(rungs[4]) && /type/i.test(rungs[5]),
      `rungs: ${JSON.stringify(rungs)}`);
    await check('with nothing chosen the summary chip says so',
      /No filters applied/.test(await page.locator('[data-gen-summary]').innerText()));
    await check('Generate is on the same screen as the rail, enabled',
      await page.locator('[data-home-generate]').isEnabled());
    await check('nothing is open until a rung is pressed', await page.locator('#gen-panel').count() === 0);

    // Keyboard: the first rung is the tab stop; arrows move along the rail.
    await page.locator('[data-gen-rail] .gen-rung').first().focus();
    await page.keyboard.press('ArrowRight');
    await settle();
    await check('ArrowRight opens the next rung and moves focus to it',
      await page.evaluate(() => document.activeElement?.id === 'gen-rung-course')
      && await page.locator('#gen-pane').count() === 1);
    await page.keyboard.press('End');
    await settle();
    await check('End reaches the last enabled rung (Type)',
      await page.evaluate(() => document.activeElement?.id === 'gen-rung-type'));
    await check('the Type rung offers only what the backend serves: any question, or past papers only',
      await page.locator('#gen-pane .gen-opt').count() === 2);
    await page.locator('#gen-pane .gen-opt').nth(1).click();
    await settle();
    await check('choosing past papers becomes a chip in the summary',
      /Past papers only/.test(await page.locator('[data-gen-summary]').innerText()));
    await page.locator('#gen-rung-type').click();   // a second press closes the chooser
    await settle();
    await check('pressing the open rung again closes the chooser', await page.locator('#gen-panel').count() === 0);
    // Clear the type filter so the practice below is not held to the archive.
    await page.getByRole('button', { name: 'Remove the Past papers only filter' }).click();
    await settle();

    await page.locator('[data-home-generate]').click();
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await check('Generate opens practice directly', /\/practice/.test(page.url()));

    // ── 2 · The question page furniture ──────────────────────────────────────
    await check('the marks badge leads the meta line', /\b\d+ marks?\b/.test(await page.locator('.q-marks').innerText()));
    await check('the running clock sits in the meta line as a timer',
      await page.locator('.q-topmeta .q-timer[role="timer"]').count() === 1);
    await check('the provenance line is under the question and names the deterministic marker',
      /deterministic marker/.test(await page.locator('.q-provenance').innerText()));
    await check('the footer strip states class, track, difficulty and topic, with a quiet Next',
      await page.locator('[data-ws-foot] .ws-foot-meta > span').count() === 4
      && await page.locator('[data-ws-foot] .ws-foot-next').count() === 1
      && !(await page.locator('[data-ws-foot] .btn-primary').count()));

    // Find a typed-answer question with at least one hint.
    const answerBox = page.locator('.editor-body input.answer-input');
    const textTab = page.getByRole('button', { name: 'Text: answer by typing' });
    let skips = 0;
    for (; ;) {
      if (await textTab.count()) await textTab.click();
      await settle();
      if ((await answerBox.count() === 1 && await page.locator('[data-hint-rail]').count() === 1) || skips++ >= MAX_SKIPS) break;
      await page.locator('.ctx-next').click();
      await page.waitForSelector('.q-prompt', { timeout: 30000 });
    }
    if (!await check('a typed question with hints was served', await answerBox.count() === 1 && await page.locator('[data-hint-rail]').count() === 1,
      `${skips} skips; answer box ${await answerBox.count()}, rail ${await page.locator('[data-hint-rail]').count()}`)) return;

    await check('the answer modes read Text, Pen and Photo',
      JSON.stringify(await page.locator('.mode-tab').allInnerTexts()) === JSON.stringify(['Text', 'Pen', 'Photo']),
      JSON.stringify(await page.locator('.mode-tab').allInnerTexts()));

    // The hint ladder: as many rungs as the question has hints; only the first is live.
    const total = Number(await page.locator('[data-hint-rail]').getAttribute('data-hint-rail'));
    await check('the hint ladder draws one rung per hint the question carries',
      total >= 1 && await page.locator('.hint-rung').count() === total, `total ${total}`);
    await check('only the first rung is live; later rungs wait',
      await page.locator('.hint-rung[data-rung="1"]').isEnabled()
      && (total < 2 || await page.locator('.hint-rung[data-rung="2"]').isDisabled()));

    // H opens the next hint — but not while typing in the field.
    await answerBox.click();
    await page.keyboard.type('h');
    await settle();
    await check('typing h into the answer box does not open a hint',
      await page.locator('.hints-block').count() === 0 && (await answerBox.inputValue()) === 'h');
    await page.keyboard.press('Meta+z');
    await settle();
    await check('⌘Z in the field undoes the last typing', (await answerBox.inputValue()) === '');
    await page.keyboard.type('x');
    await page.locator('.editor-undo').click();
    await settle();
    await check('the editor header’s Undo undoes typing too', (await answerBox.inputValue()) === '');
    await page.locator('.editor-redo').click();
    await settle();
    await check('and Redo brings it back', (await answerBox.inputValue()) === 'x');
    await answerBox.fill('');

    // Tab inside the field opens the symbol palette and moves into it; Escape returns.
    await answerBox.focus();
    await page.keyboard.press('Tab');
    await settle();
    await check('Tab opens the symbol palette and moves focus to its first key',
      await page.locator('.sym-palette').count() === 1
      && await page.evaluate(() => document.activeElement?.classList.contains('sym-key')));
    await page.keyboard.press('Escape');
    await settle();
    await check('Escape closes the palette and returns to the field',
      await page.locator('.sym-palette').count() === 0
      && await page.evaluate(() => document.activeElement?.classList.contains('answer-input')));

    await page.keyboard.press('Tab');       // leave the field: palette opens, focus on the first key
    await page.keyboard.press('Escape');
    await page.locator('.q-prompt').click();  // focus nowhere typeable
    await page.keyboard.press('h');
    await page.waitForSelector('.hints-block', { timeout: 10000 }).catch(() => null);
    await check('H opens hint 1 when focus is not in a field',
      await page.locator('.hints-block .hintbox').count() === 1
      && (await page.locator('.hint-rung[data-rung="1"]').getAttribute('class') || '').includes('is-open'));
    await check('after a hint the ladder reports what was used', await page.locator('[data-hint-rail]').getAttribute('data-hints-used') === '1');

    // S submits a typed answer when focus is not in a field.
    await answerBox.fill(SURELY_WRONG);
    await page.locator('.q-prompt').click();
    await page.keyboard.press('s');
    await page.waitForSelector('.verdict-bad', { timeout: 20000 });
    await check('S submits the answer (a wrong one is marked wrong)', await page.locator('.verdict-bad').count() === 1);

    // N moves on: the question id changes.
    const before = await page.locator('[data-question-id]').getAttribute('data-question-id');
    await page.keyboard.press('n');
    await page.waitForFunction(id => document.querySelector('[data-question-id]')?.getAttribute('data-question-id') !== id, before, { timeout: 30000 }).catch(() => null);
    await check('N serves the next question',
      (await page.locator('[data-question-id]').getAttribute('data-question-id')) !== before);

    // The footer's Next does the same by pointer.
    const before2 = await page.locator('[data-question-id]').getAttribute('data-question-id');
    await page.locator('[data-ws-foot] .ws-foot-next').click();
    await page.waitForFunction(id => document.querySelector('[data-question-id]')?.getAttribute('data-question-id') !== id, before2, { timeout: 30000 }).catch(() => null);
    await check('the footer strip’s Next serves the next question',
      (await page.locator('[data-question-id]').getAttribute('data-question-id')) !== before2);

    // ── 3 · Both themes paint the furniture ──────────────────────────────────
    await goto('/settings');
    await page.getByRole('button', { name: 'Night', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark', { timeout: 5000 });
    await check('the timer setting is in Appearance and is on', (await page.locator('[data-practice-timer-toggle]').getAttribute('aria-pressed')) === 'true');
    // The preference is written to the profile asynchronously; a full
    // navigation that races it would reload the previous theme.
    await page.waitForTimeout(600);
    await page.goto(`${base}/practice`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    const night = await page.evaluate(() => {
      const el = document.querySelector('.q-provenance');
      const c = el && getComputedStyle(el).color;
      return { theme: document.documentElement.dataset.theme, color: c, foot: !!document.querySelector('[data-ws-foot]') };
    });
    await check('at night the provenance line and footer strip are still drawn from tokens',
      night.theme === 'dark' && !!night.color && night.foot, JSON.stringify(night));
    await goto('/settings');
    await page.getByRole('button', { name: 'Paper', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light', { timeout: 5000 });
  }
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { runOne } = await import('./e2e.mjs');
  await runOne(flow);
}
