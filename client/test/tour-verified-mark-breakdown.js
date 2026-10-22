// Task 02: mounted, real-browser/server acceptance of the V1 grading panel.
// Server grading and account mutations are REAL (isolated in-memory test DB).
// Only the issue SEED is pinned to a previously certified regression (# repeat
// credit), and the explicit stale/unresolved probes mutate browser HTTP
// responses TEST-ONLY to prove fail-closed rendering. Never production evidence.
import { pathToFileURL } from 'node:url';

const PAIR = { generator: 'c10-linear-pair-methods', difficulty: 2, curriculum: 'in', seed: 7 };
const ELIMINATION = '12x + 6y = -120\n12x - 3y = -66\n9y = -54';
const BAD = '5';
const SHOW = '[data-verified-step-marks="pri-practice-verified-aggregate-v1"]';
const POST_GRADE = /\/v1\/practice\/[^/]+\/submit(?:\?.*)?$/;
const POST_ISSUE = /\/v1\/practice\/issue(?:\?.*)?$/;
const front = page => page.locator('.qpage[data-question-id]');

async function openPractice({ page, base, settle }) {
  await page.goto(`${base}/practice?subtopic=c10-linear-pair-methods`, { waitUntil: 'domcontentloaded' });
  await front(page).locator('.q-prompt').waitFor({ timeout: 30000 });
  await settle();
}

async function submit(page) {
  await page.locator('.ws-actions .btn-primary').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('.ws-actions .btn-primary').click();
}

export const flow = {
  id: 'verified-mark-breakdown',
  inspectNetwork: true,
  name: 'Verified marks · real resolved method credit, hints, stale/unresolved suppression',
  online: true,
  async run({ page, base, goto, createProfile, online, check, note, settle }) {
    await goto('/');
    await createProfile({ name: 'Verified Step Marks Student', year: 10, course: 'in' });
    await online.signIn({ name: 'Verified Step Marks Student' });

    // A fixed test seed yields the exact question already independently
    // certified by server/test/practice-repeat-credit-check.mjs. The client
    // NEVER sees the key or the seed; the real server still issues and marks.
    let issued = 0;
    let issuedResult = null;
    await page.route(POST_ISSUE, async route => {
      issued++;
      const original = route.request().postDataJSON() || {};
      const response = await route.fetch({ postData: JSON.stringify({ ...original, ...PAIR, seed: issued === 1 ? 7 : 8 }) });
      issuedResult = { status: response.status(), body: (await response.text()).slice(0, 900), original };
      await route.fulfill({ response });
    });
    await openPractice({ page, base, settle });
    let known = await online.answerOf();
    // Some browsers restore an unanswered question created during onboarding
    // before the route interception was installed. Ask for a *new* question,
    // rather than passing on a different question or changing its response.
    for (let n = 0; n < 4 && !(known.kind === 'text' && known.text === '-6' &&
      known.prompt?.includes('Solve by elimination')); n++) {
      const before = await front(page).getAttribute('data-question-id');
      await page.locator('.ctx-next').click();
      await page.waitForFunction(id => {
        const next = document.querySelector('.qpage[data-question-id]');
        return next && next.getAttribute('data-question-id') !== id && !!next.querySelector('.q-prompt');
      }, before, { timeout: 30000 });
      known = await online.answerOf();
    }
    if (!await check('the real server issued the pinned two-mark elimination question',
      issued > 0 && known.kind === 'text' && known.text === '-6' &&
      known.prompt.includes('Solve by elimination'), JSON.stringify({ known, issuedResult }).slice(0, 1500))) return;
    const questionId = await front(page).getAttribute('data-question-id');
    await page.getByRole('button', { name: 'Answer by typing' }).click();
    await page.locator('[data-final-answer]').fill(BAD);
    const work = page.locator('[data-typed-working]');
    await work.waitFor({ state: 'visible', timeout: 10000 });
    await work.fill(ELIMINATION);

    // Inject a *forged browser-only presentation field* into the real first
    // unRESOLVED response. It must not appear as a marks panel, regardless of
    // claims the wire's optional field makes. The actual marker is unmodified.
    let openGrade = null;
    let openProbe = false;
    const unresolvedProbe = async route => {
      const reply = await route.fetch();
      const data = await reply.json();
      openGrade = data;
      if (data.authoritative === true && data.resolved === false) {
        openProbe = true;
        data.markRows = {
          scheme: 'pri-practice-verified-aggregate-v1', attribution: 'aggregate-only',
          identity: { attemptId: data.attemptId, submissionId: data.submissionId },
          totals: { earned: 0, possible: data.marksPossible },
          finalAnswer: 'not-accepted', method: { awarded: 0, attribution: 'aggregate-only' }
        };
      }
      await route.fulfill({ response: reply, json: data });
    };
    await page.route(POST_GRADE, unresolvedProbe);
    await submit(page);
    await page.locator('.verdict, .eval-card').first().waitFor({ timeout: 30000 });
    await check('unresolved first try is a real server grade, with no panel despite injected aggregate',
      openProbe && openGrade?.resolved === false && await page.locator(SHOW).count() === 0 &&
      await page.locator('.eval-card').count() === 0,
      `receipt ${JSON.stringify(openGrade).slice(0, 310)}`);
    await page.unroute(POST_GRADE, unresolvedProbe);

    // The hint ladder is authoritative too. It reduces account credit, not
    // the deterministic method-mark award. A resolving second wrong try is
    // the established 1/2 method-credit regression, not a browser mock.
    const hint = page.locator('[data-hint-rung="nudge"]');
    await hint.waitFor({ state: 'visible', timeout: 12000 });
    await hint.click();
    await page.waitForSelector('[data-hint-shown="nudge"]', { timeout: 12000 });
    const second = page.waitForResponse(r => POST_GRADE.test(new URL(r.url()).pathname) && r.request().method() === 'POST');
    await submit(page);
    const response = await second;
    const grade = await response.json();
    await page.locator(SHOW).waitFor({ state: 'visible', timeout: 30000 });
    const panelText = await page.locator(SHOW).innerText();
    const header = await page.locator('.eval-marks').innerText();
    await check('mounted QuestionCard displays server-certified aggregate method 1/2',
      grade.authoritative === true && grade.resolved === true && grade.correct === false &&
      grade.marksEarned === 1 && grade.marksPossible === 2 && grade.partial?.awarded === 1 &&
      grade.markRows?.method?.awarded === 1 &&
      await page.locator('[data-method-credit="aggregate"]').count() === 1 &&
      /1 method mark/i.test(panelText) && /1 \/ 2 marks?/.test(header) &&
      await page.locator(SHOW + ' .set-row').count() === 0,
      `server ${JSON.stringify(grade).slice(0, 630)}; displayed ${panelText}`);
    await check('hint-weighted credit is distinct from the original mark',
      grade.creditedMarks > 0 && grade.creditedMarks < grade.marksEarned &&
      grade.markRows?.totals?.creditedAfterHints === grade.creditedMarks &&
      panelText.includes(`With hints used: ${grade.creditedMarks} of ${grade.marksEarned}`) &&
      /before hint deductions/i.test(header),
      `credited ${grade.creditedMarks}; header ${header}; panel ${panelText}`);
    await check('completed row belongs to the submitted attempt and question',
      grade.markRows?.identity?.attemptId === grade.attemptId &&
      grade.markRows?.identity?.submissionId === grade.submissionId &&
      await front(page).getAttribute('data-question-id') === questionId);

    // A NEW real server-issued question and server grading receipt, but one
    // deliberately stale OPTIONAL markRows identity on the HTTP response.
    // The legitimate numerical grade must still render; the explanatory panel
    // must not. There is no modification to the grading result itself.
    await page.locator('.ctx-next').click();
    await page.waitForFunction(id => {
      const el = document.querySelector('.qpage[data-question-id]');
      return !!el && el.getAttribute('data-question-id') !== id && !!el.querySelector('.q-prompt');
    }, questionId, { timeout: 30000 });
    const secondAnswer = await online.answerOf();
    if (!await check('next question is independently issued and answerable by the server',
      secondAnswer.kind === 'text' && !!secondAnswer.text && secondAnswer.serverQuestionId !== known.serverQuestionId,
      JSON.stringify(secondAnswer).slice(0, 360))) return;
    await page.locator('[data-final-answer]').fill(secondAnswer.text);
    let staleProbe = false;
    const staleRoute = async route => {
      const reply = await route.fetch();
      const data = await reply.json();
      if (data.authoritative === true && data.resolved === true && data.correct === true && data.markRows?.identity) {
        staleProbe = true;
        data.markRows.identity.submissionId = 'deliberately-stale-submission-id';
      }
      await route.fulfill({ response: reply, json: data });
    };
    await page.route(POST_GRADE, staleRoute);
    await submit(page);
    await page.locator('.eval-card').waitFor({ state: 'visible', timeout: 30000 });
    await check('stale bound breakdown rejected, legitimate server grade remains',
      staleProbe && await page.locator(SHOW).count() === 0 &&
      /\d+\s*\/\s*\d+ marks?/i.test(await page.locator('.eval-marks').innerText()));
    await page.unroute(POST_GRADE, staleRoute);
    note('The stale/unresolved network probes above are synthetic mutations of the *browser response only*. The resolving 1/2 award and hint credit came unchanged from the real deterministic server. No physical-iPad or handwriting-provider claim.');
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { onlinePlatform } = await import('./support/online-session.mjs');
  // The preselected seed is accepted ONLY by the test server, never deployed.
  await onlinePlatform({ allowSeededPractice: true });
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
