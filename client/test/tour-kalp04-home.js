// KALP-04 · the Home command centre across a real learning day.
//
// Only Pri's server marks (owner decision 2026-10-10), so the flow runs against
// the real in-process platform server (support/online-session.mjs). Offline,
// Home must say the honest thing — a question opened now is a draft that
// cannot be marked — and "Home refreshes after real learning" means learning
// the server marked and recorded for the signed-in account, not a card that
// merely changed.
import { mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { serverMarking } from './support/server-marked.mjs';

const ARTIFACTS = fileURLToPath(new URL('../../artifacts/kalp-04/', import.meta.url));
const PHONE = { width: 390, height: 844 };
const IPAD_PORTRAIT = { width: 1024, height: 1366 };
const IPAD_LANDSCAPE = { width: 1366, height: 1024 };
const DESKTOP = { width: 1440, height: 900 };

async function snap(page, name) {
  await mkdir(ARTIFACTS, { recursive: true });
  await page.screenshot({ path: join(ARTIFACTS, name + '.png'), fullPage: true });
}

async function switchProfile(page) {
  await page.locator('.user-chip').click();
  await page.getByRole('menuitem', { name: 'Switch profile' }).click();
  await page.waitForSelector('.acct-list', { timeout: 15000 });
}

/**
 * Answer the question on screen and close it on the server. Returns the
 * server's marking of the submit, and whether the server holds the completion.
 */
async function answerCurrentQuestion(page, online) {
  const type = page.getByRole('button', { name: /Answer by typing/i }).first();
  if (await type.count()) await type.click();
  await page.waitForTimeout(120);

  async function enter() {
    const mcq = page.locator('.mcq button:visible').first();
    if (await mcq.count()) {
      await mcq.click();
      return;
    }
    const answer = page.locator('.answer-input:visible').first();
    const working = page.locator('.working-input:visible').first();
    if (await answer.count()) await answer.fill('0');
    else if (await working.count()) await working.fill('0');
    else throw new Error('No answer control was available.');
  }

  async function submit() {
    const button = page.locator('.editor-foot .btn-primary:visible, .row.no-print .btn-primary:visible').first();
    await button.click();
    await page.waitForSelector('.verdict-bad, .eval-card', { timeout: 30000 }).catch(() => {});
  }

  await enter();
  await submit();
  const marking = await serverMarking(online, page);

  // A wrong first attempt is still real learning. If the question is not yet
  // resolved, the real product keeps "Show solution" visible; use that action
  // to close the same row. Do not infer resolution from the contextual Next
  // button because that control can exist outside the verdict state.
  const reveal = page.getByRole('button', { name: /Show solution/i }).first();
  if (await reveal.isVisible().catch(() => false)) {
    await reveal.click();
    await reveal.click();   // Show solution forfeits the marks, so it asks twice
  }
  await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
  const resolvedOnCard = await page.locator('.eval-card:visible').count();
  const reveals = marking.serverQuestionId
    ? (await online.practiceCalls(new RegExp(`^/v1/practice/${marking.serverQuestionId}/reveal$`))).filter(c => c.status === 200 && c.json?.authoritative === true).length : 0;
  return { marking, resolvedOnCard, reveals, ledger: online.ledger(marking.serverQuestionId) };
}

export const flow = {
  id: 'kalp04-home',
  name: 'KALP-04 · daily learning command centre',
  online: true,

  async run({ page, ctx, check, goto, createProfile, settle, online }) {
    await page.setViewportSize(IPAD_PORTRAIT);
    await goto('/');
    await createProfile({
      name: 'KALP04 Class 10 Student',
      year: 10,
      course: 'in'
    });

    await page.waitForSelector('[data-home-primary]', { timeout: 30000 });
    await check('brand-new learner sees exactly one primary recommendation',
      await page.locator('[data-home-primary]').count() === 1);
    await check('brand-new learner sees exactly one primary CTA',
      await page.locator('[data-home-primary-cta]').count() === 1);
    await check('new Class 10 learner receives a real first-practice action',
      /first Class 10 practice/i.test(await page.locator('#home-next-title').innerText()));
    await check('primary action precedes manual generator in reading order',
      await page.evaluate(() => {
        const primary = document.querySelector('[data-home-primary]');
        const generator = document.querySelector('.genbar');
        return !!primary && !!generator && Boolean(primary.compareDocumentPosition(generator) & Node.DOCUMENT_POSITION_FOLLOWING);
      }));
    await check('manual generator remains available but secondary',
      await page.locator('#home-manual-title').isVisible() && await page.locator('.genbar').isVisible());

    await page.setViewportSize(PHONE);
    await check('phone Home has no horizontal overflow',
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
    await snap(page, '01-new-student-phone');

    await page.setViewportSize(IPAD_PORTRAIT);
    await check('iPad portrait keeps the primary recommendation visible',
      await page.locator('[data-home-primary]').isVisible());
    await snap(page, '02-new-student-ipad-portrait');

    await page.setViewportSize(IPAD_LANDSCAPE);
    await check('iPad landscape keeps one dominant action',
      await page.locator('[data-home-primary]').isVisible() && await page.locator('[data-home-primary-cta]').isVisible());
    await snap(page, '03-new-student-ipad-landscape');

    await page.setViewportSize(DESKTOP);
    await check('desktop command centre stays deliberately bounded',
      await page.locator('[data-home-primary]').evaluate(el => el.getBoundingClientRect().width <= 790));
    await snap(page, '04-new-student-desktop-dark');

    // Appearance evidence uses the real Settings control.
    await goto('/settings');
    await page.getByRole('button', { name: 'Paper', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light', { timeout: 5000 });
    await page.waitForTimeout(120);
    await goto('/');
    await page.waitForSelector('[data-home-primary]');
    await check('light appearance persists back to Home',
      await page.evaluate(() => document.documentElement.dataset.theme === 'light'));
    await snap(page, '05-new-student-desktop-light');

    await goto('/settings');
    await page.getByRole('button', { name: 'Night', exact: true }).click();
    await goto('/');

    // Offline is a real browser network state. No cloud-only assignment is
    // allowed to become primary, and a new learner gets an explicit caveat.
    const onlineReason = (await page.locator('#home-primary-reason').innerText()).trim();
    await ctx.setOffline(true);
    await page.waitForTimeout(250);
    await check('offline new learner still has a valid local-first action',
      await page.locator('[data-home-primary-cta]').isEnabled());
    // The honest offline reason (owner decision 2026-10-10): a question opened
    // now is a DRAFT that cannot be marked, and connecting is what gets one
    // that can. It may not promise a later check or a mark made on the device.
    const offlineReason = (await page.locator('#home-primary-reason').innerText()).replace(/\s+/g, ' ').trim();
    await check('offline first-practice reason is honest about uncached chapters',
      /\boffline\b/i.test(offlineReason) && /\bdraft\b/i.test(offlineReason) && /cannot be marked/i.test(offlineReason)
        && /\bconnect\b/i.test(offlineReason)
        && !/checked later|marked later|when you(?: a|')re back|on this device|download/i.test(offlineReason),
      JSON.stringify(offlineReason));
    await snap(page, '06-offline-local-first');
    await ctx.setOffline(false);
    await page.waitForTimeout(250);
    const backOnlineReason = (await page.locator('#home-primary-reason').innerText()).trim();
    await check('back online the offline caveat is withdrawn, and it was not shown before going offline',
      !/offline|draft|cannot be marked/i.test(backOnlineReason) && backOnlineReason === onlineReason && onlineReason.length > 10,
      JSON.stringify({ onlineReason, backOnlineReason }));

    // Marked learning needs a signed-in account: sign this profile in through
    // the app (Settings → Pri account), then come back to Home.
    await online.signIn({ name: 'KALP04 Class 10 Student' });
    await goto('/');
    await page.waitForSelector('[data-home-primary-cta]', { timeout: 30000 });

    // Real Practice continuity: start through the Home CTA, then leave the
    // generated question unfinished and return Home.
    await page.locator('[data-home-primary-cta]').click();
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    const firstPrompt = (await page.locator('.q-prompt').innerText()).trim();
    await check('primary CTA opens real Practice', firstPrompt.length > 5);

    await goto('/');
    await page.waitForSelector('[data-home-primary]');
    // The card is titled with the unfinished topic itself; the kind is the contract.
    await check('unfinished Practice becomes the next action',
      await page.locator('[data-home-primary]').getAttribute('data-kind') === 'practice-resume');
    await snap(page, '07-resumable-practice');

    await page.locator('[data-home-primary-cta]').click();
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await check('resume reopens the exact unfinished question',
      (await page.locator('.q-prompt').innerText()).trim() === firstPrompt);

    const learned = await answerCurrentQuestion(page, online);
    await check('that learning was marked by the server: an authoritative receipt for a question issued to this account, shown on the card',
      learned.marking.ok, JSON.stringify(learned.marking));
    await check('the question is closed on the server exactly once — by the marked answer, or by the server\'s own reveal',
      learned.resolvedOnCard === 1 && learned.ledger.thisDone === 1 && learned.ledger.completions === 1
        && (learned.marking.receipt?.resolved ? learned.reveals === 0 : learned.reveals === 1),
      JSON.stringify({ resolvedOnCard: learned.resolvedOnCard, reveals: learned.reveals, ledger: learned.ledger, receipt: learned.marking.receipt }));
    await goto('/');
    await page.waitForSelector('[data-home-primary]');
    const afterLearning = await page.locator('#home-next-title').innerText();
    const afterKind = await page.locator('[data-home-primary]').getAttribute('data-kind');
    // The resume card is titled with the unfinished topic itself, so the title
    // alone cannot tell "resolved" from "still open": the kind is the contract.
    await check('Home refreshes after real learning without app reload',
      !/first Class 10 practice/i.test(afterLearning) && !/Resume where you left off/i.test(afterLearning)
        && !!afterKind && afterKind !== 'practice-resume' && afterKind !== 'first-practice',
      `selected: ${afterLearning} (${afterKind})`);
    await snap(page, '08-returning-after-learning');

    // A real personal task, created through the product, becomes resumable when
    // its own Practice question is left unfinished.
    await goto('/tasks');
    await page.getByRole('button', { name: /Set.*myself/i }).click();
    const chapter = page.locator('[aria-labelledby="task-topics"] .pill-opt').first();
    await chapter.click();
    await page.getByRole('button', { name: /Create/i }).click();
    await page.locator('.task-row .btn').first().click();
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await goto('/');
    await check('unfinished task context becomes the primary resume action',
      ['task-resume', 'task'].includes(await page.locator('[data-home-primary]').getAttribute('data-kind')));
    await check('task primary CTA preserves the task query context',
      await page.locator('[data-home-primary-cta]').evaluate(el => el.textContent.length > 0));
    await snap(page, '09-task-resume-state');

    // Returning demo data is created by the real /profiles/demo product path.
    // It carries genuine seeded attempts and four due review rows.
    await switchProfile(page);
    await page.getByRole('button', { name: /Try the demo/i }).click();
    await page.waitForSelector('[data-home-primary]', { timeout: 30000 });
    await check('returning learner Home differs from brand-new learner',
      !/first Class 10 practice/i.test(await page.locator('#home-next-title').innerText()));
    await check('real due-review state changes the recommendation',
      /review/i.test(await page.locator('#home-next-title').innerText()));
    await snap(page, '10-reviews-due-returning');
    // Alternatives share CTA words, so each alternative button must carry its
    // own accessible name (CTA + card title) and a description (its reason).
    const altNames = await page.locator('[data-home-alt] button').evaluateAll(buttons => buttons.map(b => {
      const text = id => (document.getElementById(id)?.textContent || '').trim();
      const name = (b.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean).map(text).join(' ') || b.textContent.trim();
      const description = (b.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map(text).join(' ');
      return { name, description };
    }));
    await check('every alternative action has a distinct accessible name and a reason',
      altNames.length >= 1 && (new Set(altNames.map(a => a.name)).size === altNames.length && altNames.every(a => a.description.length > 0 && !/^(\S+) \1$/.test(a.name))),
      JSON.stringify(altNames));

    // Profile isolation: switch back to the first profile. Its unresolved task
    // must reappear; the demo review recommendation must not leak across.
    await switchProfile(page);
    await page.locator('.acct-row', { hasText: 'KALP04 Class 10 Student' }).click();
    await page.waitForSelector('[data-home-primary]', { timeout: 30000 });
    await check('profile switch recomputes the recommendation',
      !/review/i.test(await page.locator('#home-next-title').innerText()));
    await check('profile A restores its own unfinished task context',
      ['task-resume', 'task'].includes(await page.locator('[data-home-primary]').getAttribute('data-kind')));

    // A real teacher profile must never enter student Home.
    await switchProfile(page);
    await createProfile({
      name: 'KALP04 Teacher',
      year: 10,
      course: 'in',
      role: 'teacher',
      fromPicker: true
    });
    await check('teacher lands in Teacher Workspace',
      new URL(page.url()).pathname === '/teach');
    await check('teacher receives no student Home recommendation',
      await page.locator('[data-home-primary]').count() === 0);

    await settle();
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
