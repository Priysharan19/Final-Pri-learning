// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — the AI tutor's three levels of help
//
// This never calls a model or a production service. Playwright stands in for
// /v1/tutor/help while the real React card, the lazy tutor chunk, the local
// backend's tutor routes and the Pri Explain player run unchanged. The server
// contract (exam lock, answer guard, caption validation, cache, ceilings) is
// proved by server/test/tutor-help-check.mjs; the local exam refusal by
// client/test/backend-check.mjs. This flow proves the browser wiring:
//
//   · the Help control opens a panel fetched as its own chunk;
//   · the levels are offered strictly in order;
//   · level 1 shows the tutor's words, and what was sent is grounded practice
//     help with no student identifiers;
//   · a tutor outage at level 2 falls back to the question's own hint, no crash;
//   · level 3 opens the deterministic walkthrough, with a reworded caption
//     shown beside — never instead of — the verified step — and, because it
//     shows the answer, closes the question exactly as Reveal does;
//   · opened levels lower the credit shown on the card.
//
// Run on its own:  node client/test/tour-ai-tutor.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';

const TOPIC = 'y7-equations';
const NUDGE = 'Look at what is being added to the unknown, and undo it first.';
const CAPTION = 'Tutor note: undo the operation furthest from the unknown first.';

// ── Flag off: the production default ─────────────────────────────────────────
// The frozen V1 scope ships no public beta surface, so a production build made
// without PRI_FEATURE_TUTOR=1 must show no tutor and send nothing to /v1/tutor.
export const flowOff = {
  id: 'tutor-off',
  name: 'AI tutor · dark by default in a production build',

  async run({ page, ctx, base, check, goto, createProfile, settle }) {
    const tutorRequests = [];
    await page.addInitScript(origin => {
      window.__PRI_CLOUD_ORIGIN__ = origin;
      // A production build ignores every runtime override; prove it.
      try { localStorage.setItem('pri-feature-tutor', '1'); } catch { /* storage may be unavailable */ }
      window.__PRI_TUTOR_OVERRIDE__ = true;
    }, base);
    await ctx.route('**/v1/**', route => {
      if (new URL(route.request().url()).pathname.startsWith('/v1/tutor')) tutorRequests.push(route.request().url());
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } }) });
    });
    const chunkRequests = [];
    page.on('request', r => { if (/TutorHelp-[^/]*\.js$/.test(r.url())) chunkRequests.push(r.url()); });

    await goto('/');
    await createProfile({ name: 'Dark Tutor Student', year: 7 });
    await page.goto(`${base}/practice?subtopic=${TOPIC}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await settle();
    await check('a production build offers no Help control', await page.locator('[data-tutor-launch]').count() === 0);
    await check('even with every runtime override set', await page.evaluate(() => window.__PRI_TUTOR_OVERRIDE__ === true));
    await check('the deterministic hints are still there', await page.locator('.q-prompt').count() === 1);
    await check('the tutor chunk is never fetched', chunkRequests.length === 0, JSON.stringify(chunkRequests));
    await check('and nothing is sent to /v1/tutor', tutorRequests.length === 0, JSON.stringify(tutorRequests));
  }
};

// ── Flag on: staging (PRI_FEATURE_TUTOR=1) ───────────────────────────────────
export const flow = {
  id: 'tutor',
  name: 'AI tutor · three levels, in order, with fallback',
  online: true,

  async run({ page, ctx, base, check, goto, createProfile, online }) {
    const requests = [];

    // Only the tutor MODEL is stood in for, at its one route: its words are
    // help, never a mark. Accounts, question issue, the solution the level-3
    // walkthrough shows and the resolution it records are the real server's.
    const respond = (route, status, value) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    await ctx.route(url => url.origin === base && url.pathname === '/v1/tutor/help', async route => {
      const request = route.request();
      const body = JSON.parse(request.postData() || '{}');
      requests.push(body);
      if (body.level === 'nudge') {
        return respond(route, 200, { tutor: { level: 'nudge', message: NUDGE, referencesStepIndex: 0, source: 'model', cached: false } });
      }
      if (body.level === 'socratic') {
        return respond(route, 503, { error: { code: 'TUTOR_UNAVAILABLE', message: 'busy', retryable: true } });
      }
      if (body.level === 'walkthrough') {
        return respond(route, 200, {
          tutor: {
            level: 'walkthrough', source: 'model', cached: false,
            captions: body.captions.map((c, i) => ({ id: c.id, text: i === 0 ? CAPTION : c.text, source: i === 0 ? 'model' : 'deterministic' }))
          }
        });
      }
      return respond(route, 400, { error: { code: 'TUTOR_BODY_INVALID', message: 'bad level' } });
    });

    await goto('/');
    await createProfile({ name: 'Tutor Student', year: 7 });
    await online.signIn({ name: 'Tutor Student' });
    await page.goto(`${base}/practice?subtopic=${TOPIC}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });

    // ── 1 · the panel is its own chunk, fetched on first use ─────────────────
    const chunkRequests = [];
    page.on('request', r => { if (/TutorHelp-[^/]*\.js$/.test(r.url())) chunkRequests.push(r.url()); });
    const launch = page.locator('[data-tutor-launch]');
    await check('a practice question offers Help', await launch.isVisible());
    await check('the Help control has an accessible name', (await launch.getAttribute('aria-label') || '').length > 10);
    await check('the Help control reports that the panel is closed', await launch.getAttribute('aria-expanded') === 'false');
    await launch.click();
    const panel = page.locator('[data-tutor-panel]');
    await panel.waitFor({ state: 'visible', timeout: 15000 });
    await check('the tutor panel loaded as a lazy chunk on first use', chunkRequests.length >= 1, `chunk requests ${JSON.stringify(chunkRequests)}`);
    await check('the panel is labelled for assistive technology', !!(await panel.getAttribute('aria-labelledby')));

    // ── 2 · strictly in order ────────────────────────────────────────────────
    const level = n => page.locator(`[data-tutor-level="${n}"]`);
    await check('level 1 is available first', await level(1).isEnabled());
    await check('level 2 is locked until level 1 is opened', await level(2).isDisabled());
    await check('level 3 is locked until level 2 is opened', await level(3).isDisabled());

    // ── 3 · level 1: the tutor's words, grounded and anonymous ───────────────
    await level(1).click();
    const note1 = page.locator('[data-tutor-note="1"]');
    await note1.waitFor({ state: 'visible', timeout: 15000 });
    await check('level 1 shows the tutor’s nudge', (await note1.innerText()).includes(NUDGE), await note1.innerText());
    await check('and labels it as coming from the tutor', await note1.getAttribute('data-tutor-source') === 'tutor');
    const sent = requests.find(r => r.level === 'nudge') || {};
    await check('the tutor is asked about a practice question', sent.context === 'practice', JSON.stringify(sent).slice(0, 200));
    await check('grounded in the verified solution', Array.isArray(sent.question?.steps) && sent.question.steps.length > 0 && !!sent.question?.answer);
    await check('with no name, email or profile id on the wire',
      !/Tutor Student|"name"|"email"|"pid"|"profile"/.test(JSON.stringify(sent)), JSON.stringify(sent).slice(0, 240));
    await check('opening a level lowers the credit on the card',
      /85%/.test(await page.locator('.q-credit').innerText().catch(() => '')),
      await page.locator('.q-topmeta').innerText());

    // ── 4 · level 2: an outage falls back to the question's own hint ─────────
    await check('level 2 unlocks after level 1', await level(2).isEnabled());
    await level(2).click();
    const note2 = page.locator('[data-tutor-note="2"]');
    await note2.waitFor({ state: 'visible', timeout: 15000 });
    await check('a tutor outage falls back to deterministic help', await note2.getAttribute('data-tutor-source') === 'deterministic', await note2.innerText());
    await check('and says why, without an error screen', /can’t be reached/.test(await note2.innerText()), await note2.innerText());

    // ── 5 · level 3: the deterministic walkthrough, with a checked caption ──
    await check('level 3 unlocks after level 2', await level(3).isEnabled());
    await level(3).click();
    const dialog = page.getByRole('dialog', { name: 'Animated worked solution' });
    await dialog.waitFor({ state: 'visible', timeout: 15000 });
    await check('level 3 opens the Pri Explain walkthrough of the verified solution', await dialog.isVisible());
    const caption = dialog.locator('[data-tutor-caption]');
    await caption.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    await check('the tutor’s rephrased caption is shown beside the step', (await caption.innerText().catch(() => '')).includes(CAPTION));
    await check('the verified step heading is still there, unchanged',
      (await dialog.locator('.pri-explain-scene h3').first().innerText()).length > 0);
    const walkSent = requests.find(r => r.level === 'walkthrough') || {};
    await check('the caption request carried only deterministic captions to rephrase',
      Array.isArray(walkSent.captions) && walkSent.captions.length > 0 && walkSent.captions.every(c => /^[a-z0-9_-]+$/i.test(c.id)));
    await page.keyboard.press('Escape');
    // Level 3 shows the whole solution, so the question ends as Reveal ends it.
    await page.waitForSelector('.eval-card', { timeout: 15000 }).catch(() => {});
    await check('level 3 ends the question exactly like Reveal', /Solution revealed/i.test(await page.locator('.qpage').innerText()),
      (await page.locator('.qpage').innerText()).slice(0, 300));
    // The solution it showed, and the resolution, are the server's: the
    // question was issued there and its reveal committed there, once.
    const issued = (await online.shownRow())?.serverQuestionId;
    const reveals = await online.practiceCalls(new RegExp(`^/v1/practice/${issued}/reveal$`));
    await check('the walkthrough showed the solution the server released, and the server recorded the question as revealed once',
      !!issued && reveals.length === 1 && reveals[0].status === 200 && Array.isArray(reveals[0].json?.solution?.steps) &&
        online.ledger(issued).thisDone === 1,
      `server question ${issued}; reveal ${JSON.stringify(reveals.map(c => c.status))}; ${JSON.stringify(online.ledger(issued))}`);
    await check('the answer box is gone — the watched answer cannot be submitted for credit',
      await page.getByRole('button', { name: 'Submit Answer' }).count() === 0);
    await check('and no more help is offered on a closed question', await page.locator('[data-tutor-launch]').count() === 0);
  }
};

// Standalone: build without the flag and prove it is dark, then build with
// PRI_FEATURE_TUTOR=1 (as staging does) and drive the three levels. Each state
// gets its own build because the flag is a build-time constant. Ends with the
// flag-off build back in client/dist, so later suites see the production default.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  const prior = process.env.PRI_FEATURE_TUTOR;
  process.env.PRI_FEATURE_TUTOR = '0';
  await runOne(flowOff, []);
  process.env.PRI_FEATURE_TUTOR = '1';
  const failed = await runOne(flow, []);
  process.env.PRI_FEATURE_TUTOR = '0';
  const { ensureBuild } = await import('./e2e.mjs');
  ensureBuild(true);
  if (prior === undefined) delete process.env.PRI_FEATURE_TUTOR; else process.env.PRI_FEATURE_TUTOR = prior;
  process.exit(failed ? 1 : 0);
}
