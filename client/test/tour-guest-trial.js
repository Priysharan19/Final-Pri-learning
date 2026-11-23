// Pri Learning · the guest trial, in a real browser, in both editions (ADR-0003).
//
// For each edition this builds the client, serves it from the real platform
// server and drives a visitor with no account through:
//   · the first screen is the question picker (Priyabhata) or a question the
//     server has already drawn, its choices one click away (Prithagoras);
//     "Sign in" top right;
//   · in Prithagoras a reload never spends a second question, and what is typed
//     is typeset on the device with no request;
//   · only chapters and levels with questions are listed; the last choice is
//     remembered across a reload;
//   · choosing "Write by hand" is the calm sign-up prompt and spends nothing;
//   · typed and multiple-choice answers are marked by the SERVER (the right
//     answer is read at the test's desk from the sealed ticket the server sent,
//     never from the page); a wrong one is marked wrong and the answer shown
//     only afterwards;
//   · a wrong answer on a question with worked steps shows the first step and keeps
//     the answer closed; the visitor may try once more (recorded as "after a worked
//     step"), read the next steps one at a time, and is offered "one like it" in
//     a different form; the tally tells right first time, right after help and not yet;
//   · after five questions the sign-up prompt, with no countdown and with the
//     sentence that tried questions are not carried over;
//   · no account, session or handwriting request exists at any point, and no
//     answer key is in any reply before its verdict;
//   · at 390px nothing overflows; "Sign in" reaches the sign-in page.
// Screenshots go to PRI_GUEST_SHOTS (default: the OS temp folder).
//
// Usage: node client/test/tour-guest-trial.js [priyabhata|prithagoras]
import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startOnlinePlatform } from './support/online-session.mjs';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.PRI_GUEST_SHOTS || join(tmpdir(), 'pri-guest-shots');
mkdirSync(SHOTS, { recursive: true });
const editions = process.argv[2] ? [process.argv[2]] : ['priyabhata', 'prithagoras'];

let pass = 0;
const failures = [];
const check = (name, condition, detail = '') => {
  if (condition) pass++; else failures.push(`${name}${detail ? ` - ${detail}` : ''}`);
  console.log(`  ${condition ? '✓' : '✗'} ${name}${condition || !detail ? '' : ` - ${detail}`}`);
};

function build(edition) {
  const out = mkdtempSync(join(tmpdir(), `pri-guest-${edition}-`));
  const vite = join(CLIENT, 'node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: CLIENT, encoding: 'utf8', env: { ...process.env, PRI_EDITION: edition } });
  if (result.status !== 0 || !existsSync(join(out, 'index.html'))) throw new Error(`the ${edition} build failed:\n${result.stdout || ''}${result.stderr || ''}`);
  return out;
}

const stall = setTimeout(() => { console.log('GUEST TRIAL TOUR: FAIL - stalled'); process.exit(1); }, 420000);
stall.unref();

// The server modules run in this process, so the test's desk can read what the
// server sealed: that is the oracle, exactly as online-session.mjs's answerOf.
const { decryptDeliveryToken } = await import('../../server/platform/deliveryCrypto.js');
const { generateQuestion, loadAllBanks } = await import('../../server/../client/src/engine/generators/index.js');
const { answerTextFor } = await import('../../server/platform/practice.js');
await loadAllBanks();
const { guestSteps, closingStepOf } = await import('../../server/platform/guestTrial.js');
const keyOf = sealed => {
  const t = JSON.parse(decryptDeliveryToken(sealed, 'guest-question-v1'));
  const q = generateQuestion(t.g, t.d, t.s, undefined, null);
  q._generator = t.g;
  return { text: answerTextFor(q), mcq: q.answerType === 'mcq', index: q.answer?.correctIndex, steps: guestSteps(q), closeAt: closingStepOf(q), hint: Array.isArray(q.hints) && q.hints.length > 0 };
};

// One question, played as the scenario says. Everything the page claims is read back from the page; the oracle only supplies the right answer.
//   right   - right first time
//   retry   - wrong, the first step, one retry that is right (assisted), then "one like it"
//   reveal  - wrong, every step, the answer; no retry after it
//   hint    - a hint, then right (assisted)
async function play(page, { edition, i, key, scenario, requests, shot }) {
  const label = `${edition} q${i + 1} (${scenario})`;
  const ok = (name, cond, detail) => check(`${label}: ${name}`, cond, detail);
  const fill = async (right, wrongIndex = 0) => {
    if (key.mcq) await page.locator('.gt-option').nth(right ? key.index : (key.index + 1 + wrongIndex) % 4).click();
    else await page.locator('#gt-answer').fill(right ? key.text : String(987650 + wrongIndex));
  };
  const submit = async () => { await page.waitForTimeout(2100); await page.locator('[data-guest-check]').click(); };
  const last = i === 4;
  const advance = async () => {
    if (last) return false;
    await page.locator('[data-guest-like]').click();
    return true;
  };
  if (scenario === 'hint') {
    await page.getByRole('button', { name: 'Show a hint' }).click();
    ok('the hint is shown', await page.locator('.gp-hint, .gt-hint').count() === 1);
    await fill(true); await submit();
    await page.locator('[data-guest-verdict]').waitFor({ timeout: 30000 });
    ok('right after a hint is said so, and is not counted as right first time', await page.locator('[data-guest-verdict]').getAttribute('data-guest-assisted') === 'hint' && /Correct, after a hint\./.test(await page.locator('[data-guest-verdict]').innerText()));
    ok('"one like it" is offered', last || await page.locator('[data-guest-like]').isVisible());
    return { verdict: 'assisted', advanced: await advance() };
  }
  if (scenario === 'right') {
    await fill(true); await submit();
    await page.locator('[data-guest-verdict]').waitFor({ timeout: 30000 });
    const v = await page.locator('[data-guest-verdict]').getAttribute('data-guest-verdict');
    ok('the server marks it right, unassisted', v === 'correct' && await page.locator('[data-guest-verdict]').getAttribute('data-guest-assisted') === null, v);
    ok('the answer is shown only now', /the answer is(?! shown)/i.test(await page.locator('[data-guest-verdict]').innerText()));
    ok('the verdict is said in words, not by colour alone', /Correct\./.test(await page.locator('[data-guest-verdict]').innerText()));
    return { verdict: 'right', advanced: false };
  }
  // retry and reveal begin with a wrong answer on a question that has worked steps
  await fill(false); await submit();
  await page.locator('[data-guest-stage="worked"]').waitFor({ timeout: 30000 });
  const body = async () => page.locator('body').innerText();
  ok('the first wrong answer leaves the question open: the first step, not the answer', await page.locator('[data-guest-step="1"]').isVisible() && await page.locator('[data-guest-step="2"]').count() === 0 && !/the answer is(?! shown)/i.test(await body()), (await body()).match(/.{0,60}The answer is.{0,60}/i)?.[0]);
  ok('it is said in words: "Not this time."', /Not this time\./.test(await page.locator('[data-guest-stage="worked"]').innerText()));
  ok('focus moved to the revealed step', await page.evaluate(() => document.activeElement?.matches('[data-guest-step="1"]')));
  const stepText = (await page.locator('[data-guest-step="1"]').innerText()).replace(/\s+/g, ' ');
  ok('the step is typeset with its heading and working', /Step 1\./.test(stepText) && await page.locator('[data-guest-step="1"] .katex').count() >= 1, stepText.slice(0, 80));
  ok('the answer the visitor gave is kept on the screen', key.mcq ? await page.locator('.gt-option.on, .gp-option.on').count() === 1 : await page.locator('#gt-answer').inputValue() === '987650');
  ok('and cannot be edited until "Try again"', key.mcq ? await page.locator('.gt-options, .gp-options').first().evaluate(e => e.disabled === true) : await page.locator('#gt-answer').evaluate(e => e.readOnly === true));
  ok('"Try again" and "Show the next step" are both offered', await page.locator('[data-guest-retry]').isVisible() && (await page.locator('[data-guest-more]').first().innerText()).trim() === (key.steps.length > 1 ? 'Show the next step' : 'Show the answer'));
  await page.keyboard.press('Tab');
  const ring = await page.evaluate(() => { const e = document.activeElement; const c = getComputedStyle(e); return { on: e.matches('[data-guest-retry], [data-guest-more]'), ring: `${c.outlineStyle} ${c.outlineWidth}` }; });
  ok('Tab goes from the step to the controls, with a visible focus ring', ring.on && /^solid [2-9]/.test(ring.ring), JSON.stringify(ring));
  await page.locator('[data-guest-step="1"]').focus();
  await shot('worked-first-step');
  if (scenario === 'retry') {
    await page.locator('[data-guest-retry]').click();
    ok('"Try again" opens the answer for one more go, with the first answer kept above it', await page.locator('[data-guest-first-answer]').isVisible() && (key.mcq || (await page.locator('#gt-answer').inputValue() === '' && await page.evaluate(() => document.activeElement?.id === 'gt-answer'))));
    ok('the first step is still on the page', await page.locator('[data-guest-step="1"]').isVisible());
    await fill(true); await submit();
    await page.locator('[data-guest-verdict]').filter({ hasText: /Correct/ }).waitFor({ timeout: 30000 });
    ok('the retry is right, recorded as after a worked step', await page.locator('[data-guest-verdict="correct"]').getAttribute('data-guest-assisted') === 'step' && /Correct, after a worked step\./.test(await page.locator('[data-guest-verdict="correct"]').innerText()));
    ok('and there is no second retry', await page.locator('[data-guest-retry]').count() === 0 && await page.locator('[data-guest-check]').count() === 0);
    await shot('retry-assisted');
    const label = last ? 'Create an account' : (key.moreForms ? 'Try one like it' : 'Try another question on this topic');
    ok('"Try one like it" is offered (the same idea; another question on the topic when the skill has one form)', last ? /Create an account/.test(await page.locator('[data-guest-next]').innerText()) : /^Try (one like it|another question on this topic)$/.test((await page.locator('[data-guest-like]').innerText()).trim()), label);
    return { verdict: 'assisted', advanced: await advance() };
  }
  // reveal: read the steps in order; the one that gives the answer (the step after the last, or a step that ends on it) closes the question
  const closing = key.closeAt;
  const stepsOk = [];
  for (let n = 2; n < closing; n++) {
    await page.locator('[data-guest-more]').click();
    await page.locator(`[data-guest-step="${n}"]`).waitFor({ timeout: 15000 });
    stepsOk.push(await page.evaluate(k => document.activeElement?.matches(`[data-guest-step="${k}"]`), n) && !/the answer is(?! shown)/i.test(await body()) && await page.locator('[data-guest-retry]').isVisible());
  }
  ok('each step appears in order and takes focus, the answer stays closed and the retry stays open', stepsOk.every(Boolean), JSON.stringify(stepsOk));
  ok('before the step that gives the answer, the page says it ends the question', /ends this question/.test(await page.locator('[data-guest-retry-note]').innerText()));
  await shot('worked-all-steps');
  await page.locator('[data-guest-more]').click();
  await page.locator('[data-guest-verdict="wrong"]').filter({ hasText: /the answer is/i }).waitFor({ timeout: 15000 });
  ok('showing the answer ends the question: no retry, no editing', await page.locator('[data-guest-retry]').count() === 0 && await page.locator('[data-guest-check]').count() === 0);
  ok('and it is not counted as right', /Not this time\./.test(await page.locator('[data-guest-verdict="wrong"]').innerText()));
  return { verdict: 'wrong', advanced: await advance() };
}

for (const edition of editions) {
  console.log(`\n== ${edition}`);
  const dist = build(edition);
  const platform = await startOnlinePlatform({ dist, env: { PRI_EDITION: edition } });
  const browser = await chromium.launch();
  try {
    // A visitor: a fresh context (its own cookie jar, so its own guest token) with its /v1 requests and issued questions logged.
    const visit = async () => {
      const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
      const page = await ctx.newPage();
      const requests = [];
      const issued = [];
      page.on('request', r => { const u = new URL(r.url()); if (u.pathname.startsWith('/v1/')) requests.push(`${r.method()} ${u.pathname}`); });
      page.on('response', async r => {
        const u = new URL(r.url());
        if (u.pathname === '/v1/guest/question' && r.status() === 201) {
          try { const body = await r.json(); issued.push({ body, text: JSON.stringify(body) }); } catch { /* read below */ }
        }
      });
      return { ctx, page, requests, issued };
    };
    let { ctx, page, requests, issued } = await visit();
    const accounts = () => platform.h.db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n;
    const accountsBefore = accounts();

    if (edition === 'prithagoras') {
      // ── Prithagoras: the first screen is a question the server has already drawn (GuestPage.jsx) ──
      await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
      await page.locator('[data-guest-try]').waitFor({ timeout: 30000 });
      await page.locator('[data-guest-question]').waitFor({ timeout: 30000 });
      check(`${edition}: the first screen is a question, already drawn`, await page.locator('[data-guest-question] .gp-prompt').isVisible() && await page.getByRole('heading', { level: 1 }).count() === 1);
      check(`${edition}: the server issued exactly one question for it`, issued.length === 1, String(issued.length));
      check(`${edition}: on arrival the heading "Question 1 of 5" has the focus, and the answer field is labelled and described by the question`,
        await page.evaluate(() => document.activeElement?.id === 'gp-title' && /1/.test(document.activeElement.textContent) && /5/.test(document.activeElement.textContent) && document.getElementById('gt-answer').labels.length === 1 && document.getElementById('gt-answer').getAttribute('aria-describedby') === 'gp-prompt'));
      const motion = await page.locator('.gp-prompt').evaluate(e => { const c = getComputedStyle(e); return { name: c.animationName, ms: parseFloat(c.animationDuration) * 1000 }; });
      check(`${edition}: the arrival question draws in once, in under 250 ms`, motion.name === 'gp-arrive' && motion.ms > 0 && motion.ms <= 250, JSON.stringify(motion));
      check(`${edition}: "Sign in" is top right, one click`, await page.getByTestId('guest-sign-in').isVisible());
      const bar = await page.locator('.gp-bar').boundingBox();
      const signBox = await page.getByTestId('guest-sign-in').boundingBox();
      check(`${edition}: and it sits at the right of the top bar`, signBox.x + signBox.width > bar.x + bar.width - 80 && signBox.y < 120);
      check(`${edition}: it is question 1 of 5, and four are left today, said once, no countdown`,
        /^Question 1 of 5$/i.test((await page.locator('h1').textContent()).trim()) && /4 questions left today/.test(await page.locator('[data-guest-left]').textContent())
        && (await page.locator('body').textContent()).match(/left today/g).length === 1);
      check(`${edition}: the count drawn is the server's: one open, four to come`, await page.locator('.gp-squares .is-now').count() === 1 && await page.locator('.gp-squares .is-left').count() === 4);
      const copy = (await page.locator('body').innerText());
      check(`${edition}: the copy has no em dash, no emoji, no urgency`, !/—/.test(copy) && !/\p{Extended_Pictographic}/u.test(copy) && !/hurry|last chance|only \d+ left|expires in/i.test(copy));
      check(`${edition}: nothing on the first screen speaks of paying`, !/\$\s?\d|price|pricing|premium|upgrade|subscri|per month|a month|buy\b|purchase|checkout/i.test(copy), copy.match(/\$\s?\d|price|pricing|premium|upgrade|subscri|per month|a month|buy\b|purchase|checkout/i)?.[0]);
      const context = await page.locator('[data-guest-context]').innerText();
      check(`${edition}: a new visitor starts at Year 12 Mathematics Advanced, and the page says which topic and level`, /Year 12 Mathematics Advanced/.test(context) && /Intermediate|Foundation|Advanced|Extension/.test(context), context.replace(/\n/g, ' | '));
      await page.screenshot({ path: join(SHOTS, `${edition}-01-first-screen-desktop.png`) });

      // ── what is typed is set out as maths on the device (notation only), with no request ──
      const before = requests.length;
      await page.locator('#gt-answer').fill('3x^2(x+1)');
      await page.locator('[data-guest-reads] .katex').first().waitFor({ timeout: 10000 });
      check(`${edition}: a typed answer is shown typeset as it is typed`, await page.locator('[data-guest-reads] .katex').count() >= 1);
      check(`${edition}: and nothing was sent to do it`, requests.length === before, requests.slice(before).join(', '));
      await page.locator('#gt-answer').fill('');

      // ── the choices are one click away, and only what has questions is listed ──
      await page.locator('[data-guest-change]').click();
      await page.locator('[data-guest-chooser]').waitFor({ timeout: 10000 });
      const labels = await page.locator('[data-guest-chooser] legend, [data-guest-chooser] label[for]').allTextContents();
      check(`${edition}: every control has a label (${labels.length})`, labels.length >= 5 && labels.every(l => l.trim()), labels.join(' | '));
      const years = await page.locator('[data-pick-year]').evaluateAll(els => els.map(e => e.value));
      // owner decision, 19 Nov 2026: Prithagoras offers Years 11 and 12 only.
      check(`${edition}: two years, 11 and 12`, JSON.stringify(years) === '["11","12"]', JSON.stringify(years));
      const first = await page.evaluate(() => ({ year: document.querySelector('[data-pick-year]:checked')?.value, course: document.querySelector('[data-pick-course]:checked')?.value, courses: [...document.querySelectorAll('[data-pick-course]')].map(o => o.closest('label').textContent) }));
      check('prithagoras: the choices open on Year 12 Mathematics Advanced, Extension 1 one choice away, nothing else', first.year === '12' && first.course === 'advanced' && JSON.stringify(first.courses) === '["Mathematics Advanced","Mathematics Extension 1"]', JSON.stringify(first));
      const levelCount = await page.locator('[data-pick-level]').count();
      check(`${edition}: levels offered are only the chapter's own (${levelCount})`, levelCount >= 1 && levelCount <= 4);
      const wording = (await page.locator('[data-guest-chooser] legend').first().textContent()).trim();
      check(`${edition}: Year is this edition's word, never the other's`, wording === 'Year', wording);
      const pageText = await page.locator('body').innerText();
      check(`${edition}: nothing of the other edition is named`, !/CBSE|NCERT|JEE|Class \d/.test(pageText));
      check(`${edition}: changing says what it costs: one of today's five, and the open question is left unanswered`, /one of today’s 5/.test(await page.locator('[data-guest-change-note]').innerText()));
      check(`${edition}: no language switch is drawn`, await page.locator('.gt-langs').count() === 0);
      await page.screenshot({ path: join(SHOTS, `${edition}-01b-choices.png`) });
      await page.locator('[data-guest-back]').click();
      check(`${edition}: "Back to the question" returns to the same question, unspent`, await page.locator('[data-guest-question]').isVisible() && issued.length === 1);
      await page.locator('[data-guest-change]').click();

      // ── a remembered choice survives a reload, and a reload never spends a second question ──
      const topics = await page.locator('[data-pick-topic] option').evaluateAll(os => os.map(o => ({ v: o.value, t: o.textContent })));
      const chosen = topics[Math.min(2, topics.length - 1)];
      await page.locator('[data-pick-topic]').selectOption(chosen.v);
      const levelNow = await page.locator('[data-pick-level]').last().getAttribute('data-pick-level');
      await page.locator('[data-pick-level]').last().check();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('[data-guest-chooser]').waitFor({ timeout: 30000 });
      check(`${edition}: the last topic is remembered`, await page.locator('[data-pick-topic]').inputValue() === chosen.v);
      check(`${edition}: and the last level`, await page.locator(`[data-pick-level="${levelNow}"]`).isChecked());
      await page.waitForTimeout(800);
      check(`${edition}: a reload spends nothing: still one question issued, and the next would be question 2 of 5`, issued.length === 1 && await page.locator('[data-guest-question]').count() === 0
        && /^Question 2 of 5$/i.test((await page.locator('h1').textContent()).trim()) && /4 questions left today/.test(await page.locator('[data-guest-left]').textContent()));

      // ── keyboard: the choices are reachable and operable without a mouse ──
      await page.locator('[data-pick-year]:checked').focus();
      await page.keyboard.press('Tab');
      check(`${edition}: Tab moves on from the year to the next control that has a choice`, await page.evaluate(() => document.activeElement?.matches('[data-pick-course], [data-pick-topic]')));
      await page.keyboard.press('ArrowRight');
      check(`${edition}: and the arrow keys move within a row`, await page.evaluate(() => document.activeElement?.matches('[data-pick-course="ext1"]:checked')));
      await page.keyboard.press('ArrowLeft');
      const ring = await page.evaluate(() => { const l = document.activeElement.closest('label'); const s = getComputedStyle(l); return `${s.outlineStyle} ${s.outlineWidth}`; });
      check(`${edition}: with a visible focus ring`, /^solid [2-9]/.test(ring), ring);

      // ── handwriting is a sign-up prompt and costs nothing ──
      await page.locator('[data-pick-form="written"]').check();
      await page.locator('[data-guest-begin]').click();
      await page.locator('[data-guest-signup="written"]').waitFor({ timeout: 10000 });
      check(`${edition}: "Write by hand" is the calm sign-up prompt`, /Handwriting and photo checking need an account/.test(await page.locator('[data-guest-signup]').innerText()));
      check(`${edition}: and it says tried questions are not carried over`, /not carried over/.test(await page.locator('[data-guest-signup]').innerText()));
      check(`${edition}: the heading took focus`, await page.evaluate(() => document.activeElement?.id === 'gp-title'));
      check(`${edition}: no question was issued for it`, issued.length === 1);
      await page.locator('[data-guest-leave-prompt]').click();
      check(`${edition}: the prompt has a way back to the choices, still with nothing spent`, await page.locator('[data-guest-chooser]').isVisible() && issued.length === 1);
      await page.locator('[data-guest-begin]').click();
      await page.locator('[data-guest-signup="written"]').waitFor({ timeout: 10000 });
      check(`${edition}: and no handwriting or photo request was made`, !requests.some(r => /handwriting|photo|working/.test(r)));
      await page.screenshot({ path: join(SHOTS, `${edition}-02-written-prompt.png`) });
      await ctx.close();

      // ── a second visitor (a fresh token): five questions, marked by the server, starting from the one drawn on arrival ──
      ({ ctx, page, requests, issued } = await visit());
      await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
      let verdicts = [], retries = 0, advanced = false;
      const needs = ['retry', 'reveal', 'hint'];
      for (let i = 0; i < 5; i++) {
        if (i > 0 && !advanced) await page.locator('[data-guest-next]').click();
        await page.waitForFunction(n => document.querySelector(`[data-guest-question] [data-guest-check]`) && document.querySelector('[data-guest-number]')?.dataset.guestNumber === String(n) || document.querySelector('[data-guest-problem]'), i + 1, { timeout: 30000 });
        if (await page.locator('[data-guest-problem]').count() && !await page.locator('[data-guest-question]').count()) {
          // This chapter has no typed question at this level: the page says so plainly; take a multiple-choice one.
          check(`${edition}: a missing kind is said plainly`, /no question of that kind/.test(await page.locator('[data-guest-problem]').innerText()));
          await page.locator('[data-pick-form="choice"]').check();
          await page.locator('[data-guest-begin]').click();
          await page.locator('[data-guest-question]').waitFor({ timeout: 30000 });
        }
        check(`${edition} q${i + 1}: one question issued per question shown`, issued.length === i + 1, String(issued.length));
        const ticket = issued.at(-1);
        const key = keyOf(ticket.body.sealed);
        const reply = ticket.text;
        check(`${edition} q${i + 1}: no answer key in the issued reply`, !/"(answer|steps|solution|seed|correctIndex)"\s*:/.test(reply) && !reply.includes(JSON.stringify(key.text)));
        if (i === 0) {
          await page.screenshot({ path: join(SHOTS, `${edition}-03-question.png`) });
          await page.setViewportSize({ width: 390, height: 844 });
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          check(`${edition}: 390px question: no sideways scroll`, overflow <= 0, String(overflow));
          const small = await page.evaluate(() => [...document.querySelectorAll('[data-guest-try] button, [data-guest-try] input:not([type=radio])')].filter(e => e.offsetParent).map(e => ({ t: (e.textContent || e.id).trim().slice(0, 24), h: Math.round(e.getBoundingClientRect().height) })).filter(e => e.h < 44));
          check(`${edition}: 390px question: every control is at least 44px tall`, small.length === 0, JSON.stringify(small));
          await page.screenshot({ path: join(SHOTS, `${edition}-04-question-390.png`) });
          await page.setViewportSize({ width: 1180, height: 820 });
        }
        const can = { retry: key.steps.length >= 2, reveal: key.steps.length >= 2, hint: key.hint };
        let scenario = 'right';
        if (i > 0) { const n = needs.find(x => can[x]); if (n) { scenario = n; needs.splice(needs.indexOf(n), 1); } }
        if (scenario === 'retry') retries++;
        const played = await play(page, { edition, i, key, scenario, requests, shot: name => page.screenshot({ path: join(SHOTS, `${edition}-q${i + 1}-${name}.png`) }) });
        verdicts.push(played.verdict); advanced = played.advanced;
        if (scenario !== 'right') {
          if (page.viewportSize().width > 800) await page.screenshot({ path: join(SHOTS, `${edition}-05-${scenario}.png`) });
          await page.setViewportSize({ width: 390, height: 844 });
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          check(`${edition} q${i + 1} (${scenario}): 390px: no sideways scroll`, overflow <= 0, String(overflow));
          await page.setViewportSize({ width: 1180, height: 820 });
        }
        if (i === 0) {
          check(`${edition}: the count shows one right first time, as the server marked it`, await page.locator('.gp-squares .is-right').count() === 1 && await page.locator('.gp-squares .is-left').count() === 4);
          check(`${edition}: a marked answer cannot be edited or sent again`, await page.locator('#gt-answer, .gp-options').first().evaluate(e => e.readOnly === true || e.disabled === true) && await page.locator('[data-guest-check]').count() === 0);
        }
      }
      const want = { right: verdicts.filter(v => v === 'right').length, assisted: verdicts.filter(v => v === 'assisted').length, wrong: verdicts.filter(v => v === 'wrong').length };
      check(`${edition}: all three helped scenarios were played (retry, reveal, hint)`, needs.length === 0, `left: ${needs.join(',')}`);
      const tally = (await page.locator('[data-guest-tally]').innerText()).replace(/\s+/g, ' ');
      check(`${edition}: the tally states right first time, right after a hint or a worked step, and not yet, in words`, tally.includes(`${want.right} right first time`) && tally.includes(`${want.assisted} right after a hint or a worked step`) && (want.wrong === 0 || tally.includes(`${want.wrong} not yet`)), `${tally} vs ${JSON.stringify(want)}`);
      check(`${edition}: and the squares agree: outlined for after help`, await page.locator('.gp-squares .is-right').count() === want.right && await page.locator('.gp-squares .is-assisted').count() === want.assisted && await page.locator('.gp-squares .is-wrong').count() === want.wrong);
      await page.screenshot({ path: join(SHOTS, `${edition}-05-tally.png`) });
      check(`${edition}: five verdicts, each from the server`, verdicts.length === 5 && requests.filter(r => r === 'POST /v1/guest/answer').length === 5 + retries && requests.filter(r => r === 'POST /v1/guest/question').length === 5, JSON.stringify(verdicts));
    } else {
      await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
      await page.locator('[data-guest-try]').waitFor({ timeout: 30000 });
      check(`${edition}: the first screen is the question picker`, await page.locator('[data-question-picker]').isVisible() && await page.getByRole('heading', { level: 1 }).count() === 1);
      check(`${edition}: "Sign in" is top right, one click`, await page.getByTestId('guest-sign-in').isVisible());
      const bar = await page.locator('.gt-bar').boundingBox();
      const signBox = await page.getByTestId('guest-sign-in').boundingBox();
      check(`${edition}: and it sits at the right of the top bar`, signBox.x + signBox.width > bar.x + bar.width - 80 && signBox.y < 120);
      await page.waitForFunction(() => /left today/.test(document.querySelector('[data-guest-left]')?.textContent || ''));
      check(`${edition}: five left today, said once, no countdown`, /5 questions left today/.test(await page.locator('[data-guest-left]').innerText()));
      const copy = (await page.locator('body').innerText());
      check(`${edition}: the copy has no em dash, no emoji, no urgency`, !/—/.test(copy) && !/\p{Extended_Pictographic}/u.test(copy) && !/hurry|last chance|only \d+ left|expires in/i.test(copy));
      await page.screenshot({ path: join(SHOTS, `${edition}-01-first-screen-desktop.png`) });

      // ── only what has questions is listed; the picker is labelled ──
      const labels = await page.locator('[data-question-picker] label, [data-question-picker] legend').allInnerTexts();
      check(`${edition}: every control has a label (${labels.length})`, labels.length >= 6, labels.join(' | '));
      const yearOptions = await page.locator('[data-picker-year] option').count();
      // owner decision, 19 Nov 2026: Prithagoras offers Years 11 and 12 only; India keeps its six classes.
      check(`${edition}: ${edition === 'prithagoras' ? 'two years, 11 and 12' : 'six years or classes'}`, yearOptions === (edition === 'prithagoras' ? 2 : 6), String(yearOptions));
      if (edition === 'prithagoras') {
        const first = await page.evaluate(() => ({ year: document.querySelector('[data-picker-year]').value, course: document.querySelector('[data-picker-course]').selectedOptions[0].textContent, courses: [...document.querySelectorAll('[data-picker-course] option')].map(o => o.textContent) }));
        check('prithagoras: a new visitor starts at Year 12 Mathematics Advanced, Extension 1 one choice away', first.year === '12' && first.course === 'Advanced' && first.courses.includes('Extension 1'), JSON.stringify(first));
      }
      const levelCount = await page.locator('[data-picker-level]').count();
      check(`${edition}: levels offered are only the chapter's own (${levelCount})`, levelCount >= 1 && levelCount <= 4);
      const wording = await page.locator('label[for="gt-year"]').innerText();
      check(`${edition}: ${edition === 'priyabhata' ? 'Class' : 'Year'} is this edition's word, never the other's`, wording === (edition === 'priyabhata' ? 'Class' : 'Year'), wording);
      const pageText = await page.locator('body').innerText();
      check(`${edition}: nothing of the other edition is named`, edition === 'priyabhata' ? !/NSW|Year 1\d|HSC/.test(pageText) : !/CBSE|NCERT|JEE|Class \d/.test(pageText));

      // ── a remembered choice survives a reload ──
      const topics = await page.locator('[data-picker-topic] option').evaluateAll(os => os.map(o => ({ v: o.value, t: o.textContent })));
      const chosen = topics[Math.min(2, topics.length - 1)];
      await page.locator('[data-picker-topic]').selectOption(chosen.v);
      const levelNow = await page.locator('[data-picker-level]').last().getAttribute('data-picker-level');
      await page.locator('[data-picker-level]').last().check();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('[data-guest-try]').waitFor();
      check(`${edition}: the last topic is remembered`, await page.locator('[data-picker-topic]').inputValue() === chosen.v);
      check(`${edition}: and the last level`, await page.locator(`[data-picker-level="${levelNow}"]`).isChecked());

      // ── keyboard: the picker is reachable and Start is operable without a mouse ──
      await page.locator('[data-picker-year]').focus();
      await page.keyboard.press('Tab');
      // A single course is a disabled select (nothing to choose), so Tab goes on to the topic.
      const afterTab = await page.evaluate(() => document.activeElement?.matches('[data-picker-course], [data-picker-topic]'));
      check(`${edition}: Tab moves on from the year to the next control that has a choice`, afterTab);

      // ── Hindi where the edition has it (Priyabhata); none in Prithagoras ──
      if (edition === 'priyabhata') {
        await page.locator('.gt-langs button[lang="hi"]').click();
        await page.waitForFunction(() => /आज़माएँ/.test(document.querySelector('h1')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
        const hiH1 = await page.locator('h1').innerText(), hiStart = await page.locator('[data-picker-start]').innerText();
        check(`${edition}: the first screen reads in Hindi`, /एक प्रश्न आज़माएँ/.test(hiH1) && /शुरू करें/.test(hiStart), `${hiH1} | ${hiStart}`);
        check(`${edition}: and says plainly that questions stay in English`, await page.locator('[data-lang-note]').count() === 1);
        await page.screenshot({ path: join(SHOTS, `${edition}-02b-hindi.png`) });
        await page.locator('.gt-langs button[lang="en"]').click();
      } else check(`${edition}: no language switch is drawn`, await page.locator('.gt-langs').count() === 0);

      // ── handwriting is a sign-up prompt and costs nothing ──
      await page.locator('[data-picker-form="written"]').check();
      await page.locator('[data-picker-start]').click();
      await page.locator('[data-guest-signup="written"]').waitFor({ timeout: 10000 });
      check(`${edition}: "Write by hand" is the calm sign-up prompt`, /Handwriting and photo checking need an account/.test(await page.locator('[data-guest-signup]').innerText()));
      check(`${edition}: and it says tried questions are not carried over`, /not carried over/.test(await page.locator('[data-guest-signup]').innerText()));
      check(`${edition}: the heading took focus`, await page.evaluate(() => document.activeElement?.id === 'gt-signup-title'));
      check(`${edition}: no question was issued for it`, issued.length === 0);
      await page.screenshot({ path: join(SHOTS, `${edition}-02-written-prompt.png`) });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('[data-guest-try]').waitFor();
      await page.locator('[data-picker-form="typed"]').check();

      // ── five questions, marked by the server ──
      let verdicts = [], retries = 0, advanced = false;
      const needs = ['retry', 'reveal', 'hint'];
      for (let i = 0; i < 5; i++) {
        if (i === 0 || !advanced) await page.locator(i === 0 ? '[data-picker-start]' : '[data-guest-next]').click();
        await page.locator('[data-guest-question], [data-guest-problem]').first().waitFor({ timeout: 30000 });
        if (await page.locator('[data-guest-problem]').count() && !await page.locator('[data-guest-question]').count()) {
          // This chapter has no typed question at this level: the picker says so plainly; take a multiple-choice one.
          check(`${edition}: a missing kind is said plainly`, /no question of that kind/.test(await page.locator('[data-guest-problem]').innerText()));
          await page.locator('[data-picker-form="choice"]').check();
          await page.locator('[data-picker-start]').click();
          await page.locator('[data-guest-question]').waitFor({ timeout: 30000 });
        }
        const ticket = issued.at(-1);
        const key = keyOf(ticket.body.sealed);
        const reply = ticket.text;
        check(`${edition} q${i + 1}: no answer key in the issued reply`, !/"(answer|steps|solution|seed|correctIndex)"\s*:/.test(reply) && !reply.includes(JSON.stringify(key.text)));
        if (i === 0) {
          await page.screenshot({ path: join(SHOTS, `${edition}-03-question.png`) });
          await page.setViewportSize({ width: 390, height: 844 });
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          check(`${edition}: 390px question: no sideways scroll`, overflow <= 0, String(overflow));
          await page.screenshot({ path: join(SHOTS, `${edition}-04-question-390.png`) });
          await page.setViewportSize({ width: 1180, height: 820 });
        }
        const can = { retry: key.steps.length >= 2, reveal: key.steps.length >= 2, hint: key.hint };
        let scenario = 'right';
        if (i > 0) { const n = needs.find(x => can[x]); if (n) { scenario = n; needs.splice(needs.indexOf(n), 1); } }
        if (scenario === 'retry') retries++;
        const played = await play(page, { edition, i, key, scenario, requests, shot: name => page.screenshot({ path: join(SHOTS, `${edition}-q${i + 1}-${name}.png`) }) });
        verdicts.push(played.verdict); advanced = played.advanced;
        if (scenario !== 'right') await page.screenshot({ path: join(SHOTS, `${edition}-05-${scenario}.png`) });
      }
      check(`${edition}: all three helped scenarios were played (retry, reveal, hint)`, needs.length === 0, `left: ${needs.join(',')}`);
      check(`${edition}: five verdicts' worth of answers, each from the server`, verdicts.length === 5 && requests.filter(r => r === 'POST /v1/guest/answer').length === 5 + retries, JSON.stringify(verdicts));
    }
    check(`${edition}: after the fifth, the button leads to sign-up`, /Create an account/.test(await page.locator('[data-guest-next]').innerText()));
    await page.locator('[data-guest-next]').click();
    await page.locator('[data-guest-signup="limit"]').waitFor();
    const prompt = await page.locator('[data-guest-signup]').innerText();
    check(`${edition}: the sign-up prompt after five is calm and states what is not carried over`, /5 free questions/.test(prompt) && /not carried over/.test(prompt) && !/—/.test(prompt) && !/hurry|last chance|expires|timer/i.test(prompt));
    await page.screenshot({ path: join(SHOTS, `${edition}-06-signup-after-five.png`) });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(SHOTS, `${edition}-07-signup-390.png`) });
    check(`${edition}: 390px sign-up prompt: no sideways scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await page.setViewportSize({ width: 1180, height: 820 });

    // a sixth, asked directly by this very page's cookie, is refused by the server
    const sixth = await page.evaluate(async () => {
      const start = await (await fetch('/v1/guest/session', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json();
      return { remaining: start.remaining };
    });
    check(`${edition}: the server agrees: none left`, sixth.remaining === 0, JSON.stringify(sixth));

    // ── nothing it should not have touched ──
    check(`${edition}: no account, session or handwriting request, and no account row`, accounts() === accountsBefore
      && !requests.some(r => /\/v1\/(account|sync|handwriting|questions|billing|exams|practice)\b/.test(r)), requests.filter(r => !/guest/.test(r)).join(', '));
    const cookies = (await ctx.cookies()).map(c => c.name);
    check(`${edition}: only the guest cookie exists (no session, no CSRF pair)`, cookies.every(n => n === 'pri_guest'), cookies.join(','));
    const guestCookie = (await ctx.cookies()).find(c => c.name === 'pri_guest');
    check(`${edition}: the guest cookie is HttpOnly and SameSite=Strict`, guestCookie?.httpOnly === true && guestCookie?.sameSite === 'Strict');

    // ── Sign in reaches the sign-in page ──
    await page.getByTestId('guest-sign-in').click();
    await page.locator('[data-signin-card="page"]').waitFor({ timeout: 30000 });
    check(`${edition}: "Sign in" reaches the sign-in page`, new URL(page.url()).pathname === '/signin' && await page.locator('.hero-title').isVisible());
    check(`${edition}: ${edition === 'prithagoras' ? 'the sign-in page offers the way back to a question' : 'the sign-in page is unchanged: no way-back link'}`, await page.getByTestId('hero-try-first').count() === (edition === 'prithagoras' ? 1 : 0));
    await page.screenshot({ path: join(SHOTS, `${edition}-08-sign-in-page.png`) });

    // ── the same picker is the signed-in Home's quick start ──
    const { createVerifiedProfile } = await import('./support/verified-onboarding.mjs');
    await createVerifiedProfile(page, platform, { name: 'Guest Then Student', year: 9 });
    const quick = page.locator('[data-instrument-quickstart]');
    await quick.waitFor({ timeout: 30000 });
    check(`${edition}: signed-in Home has the picker as its quick start`, await quick.locator('[data-question-picker]').isVisible());
    check(`${edition}: it offers no answer type (the practice page lets a student type or write)`, await quick.locator('[data-picker-form]').count() === 0);
    check(`${edition}: and no guest copy, count or sign-in button`, await page.locator('[data-guest-try], [data-guest-left]').count() === 0);
    await quick.scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(SHOTS, `${edition}-09-home-quick-start.png`) });
    await page.setViewportSize({ width: 390, height: 844 });
    await quick.scrollIntoViewIfNeeded();
    check(`${edition}: 390px Home: no sideways scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await page.screenshot({ path: join(SHOTS, `${edition}-10-home-quick-start-390.png`) });
    await page.setViewportSize({ width: 1180, height: 820 });
    const wantChapter = await quick.locator('[data-picker-topic]').inputValue();
    await quick.locator('[data-picker-start]').click();
    await page.waitForURL(/\/practice\?/, { timeout: 30000 });
    const dest = new URL(page.url());
    check(`${edition}: Start opens Practice on the chosen chapter and level`, dest.searchParams.get('subtopic') === wantChapter && /^[1-4]$/.test(dest.searchParams.get('difficulty') || ''), page.url());
    check(`${edition}: ${edition === 'priyabhata' ? 'with its track' : 'with no India track'}`, edition === 'priyabhata' ? dest.searchParams.get('track') === 'cbse' : !dest.searchParams.has('track'), page.url());
  } finally {
    await browser.close();
    await platform.close?.();
  }
}
clearTimeout(stall);
console.log(failures.length ? `GUEST TRIAL TOUR: FAIL - ${failures.length} of ${pass + failures.length}\n${failures.join('\n')}` : `GUEST TRIAL TOUR: PASS - ${pass} checks (${editions.join(', ')})`);
process.exit(failures.length ? 1 : 0);
