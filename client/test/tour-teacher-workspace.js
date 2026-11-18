// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · render tour — the teacher workspace (board, papers, review)
//
// Builds the client for one edition (PRI_EDITION, unset = Priyabhata) with
// PRI_FEATURE_SYLLABUS_BOARD=1, serves it from the real platform server
// (support/online-session.mjs), and drives it in Chromium:
//
//   TEACHER  a teacher device profile signed in to a teacher account → /teach
//            → the class → class board → a count's drill-down → Papers →
//            results → (when the build has it) the review queue's first item
//   STUDENT  a student signed in → Settings → the paper in class work and
//            "What your teacher can see" with the teacher marks
//
// Screenshots go to artifacts/teacher-workspace/<edition>/.
//
// WHAT IS THE TEST'S DESK (never a product path), labelled where it happens:
//   · the accounts are made at the server's own routes; the teacher role is
//     granted in the database, as the bootstrap/CLI does (an invite code in
//     production);
//   · the students sit a server-issued practice paper over HTTP with written
//     working that breaks on line 2 (as server/test/classroom-check.mjs does)
//     and hand it in at the real hand-in route;
//   · the class board's evidence is written as the server grader's own
//     graded-attempt rows (as server/test/class-board-check.mjs does);
//   · banks outside the India covers are allowed for this process only, so a
//     Priyabhata server can issue the NSW-generator practice paper.
// The students and their work are SYNTHETIC. No real teacher, student,
// classroom or handwriting evidence is claimed.
//
//   node client/test/tour-teacher-workspace.js
//   PRI_EDITION=prithagoras node client/test/tour-teacher-workspace.js
// ─────────────────────────────────────────────────────────────────────────────
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { startOnlinePlatform } from './support/online-session.mjs';
import { createVerifiedProfile, signInOnCard } from './support/verified-onboarding.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CLIENT = join(ROOT, 'client');
const EDITION = String(process.env.PRI_EDITION || '').trim() || 'priyabhata';
const OUT = join(ROOT, 'artifacts', 'teacher-workspace', EDITION);
const NSW = EDITION === 'prithagoras';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? ` — ${detail}` : ''}`); };

function build() {
  const out = mkdtempSync(join(tmpdir(), 'pri-tw-dist-'));
  const vite = join(CLIENT, 'node_modules', 'vite', 'bin', 'vite.js');
  const r = spawnSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: CLIENT, encoding: 'utf8', env: { ...process.env, PRI_FEATURE_SYLLABUS_BOARD: '1', PRI_FEATURE_EXTENDED_TRACKS: '1' } });
  if (r.status !== 0) throw new Error(`build failed:\n${r.stdout}${r.stderr}`);
  return out;
}

async function seed(platform) {
  const { registerAccount, verifyEmail, promoteRole } = await import('../../server/test/support/app-harness.mjs');
  // TEST DESK: banks outside the India covers, this process only (see the head).
  (await import('../../server/platform/indiaBanks.js')).allowBanksOutsideIndiaForTests();
  const { stepMetaFor } = await import('../../server/platform/practice.js');
  const { checkAnswer } = await import('../src/engine/checker.js');
  const { loadAllBanks } = await import('../src/engine/generators/index.js');
  const { subtopicsForYear } = await import('../src/engine/curriculum.js');
  const { multipartForYear } = await import('../src/engine/generators/multipart.js');
  await loadAllBanks();
  const h = platform.h;
  const stamp = Date.now().toString(36);
  async function person(name, role) {
    h.db.prepare("DELETE FROM rate_limits WHERE bucket LIKE 'register%' OR bucket LIKE 'login%'").run();
    const email = `tw.${role}.${name.toLowerCase().replace(/\W+/g, '')}.${stamp}@example.test`;
    const r = await registerAccount(h, { email, name, deviceId: `tw-desk-${name}` });
    if (r.status !== 201) throw new Error(`register ${name}: ${r.status} ${r.text}`);
    await verifyEmail(h, r.account.id);
    if (role !== 'student') await promoteRole(h, r.jar, r.account.id, role);
    return { id: r.account.id, jar: r.jar, email, name };
  }
  const req = (who, path, opts = {}) => h.request(path, { ...opts, jar: who.jar });
  const T = await person('Ms Rao', 'teacher');
  const S = [];
  for (const n of ['Asha Patel', 'Ben Nguyen', 'Cara Singh', 'Dev Kumar']) S.push(await person(n, 'student'));
  const cls = await req(T, '/v1/classes', { method: 'POST', body: { name: NSW ? '7MA Mathematics' : 'Class 7 Mathematics' } });
  if (cls.status !== 201) throw new Error(`class: ${cls.status} ${cls.text}`);
  const C = cls.data.class.id;
  for (const s of S) await req(s, '/v1/classes/join', { method: 'POST', body: { code: cls.data.joinCode } });

  const PAPER = { kind: 'practice-paper', year: 7, minutes: 30 };
  const asg = await req(T, `/v1/classes/${C}/assignments`, { method: 'POST', body: { title: 'Week 4 paper', specification: { kind: 'paper', paper: PAPER }, dueAt: Date.now() + 3 * 86400000 } });
  if (asg.status !== 201) throw new Error(`assignment: ${asg.status} ${asg.text}`);
  const A = asg.data.assignment.id;

  // The students sit the server's paper with working that breaks on line 2.
  const Y7 = subtopicsForYear(7).map(s => s.id);
  const other = Y7.find(id => id !== 'y7-equations');
  const ladder = (i, n) => { const t = i / n; return t < 0.2 ? 1 : t < 0.6 ? 2 : t < 0.9 ? 3 : 4; };
  const spec = { kind: 'practice-paper', paper: { year: 7, minutes: 30 },
    slots: [...Array.from({ length: 10 }, (_, i) => ({ generator: i % 2 ? 'y7-equations' : other, difficulty: ladder(i, 10) })), { multipart: multipartForYear(7, 'advanced')[0] }] };
  let reviewItems = 0;
  for (const [i, s] of S.slice(0, 3).entries()) {
    h.db.prepare('DELETE FROM rate_limits').run();
    const made = await h.request('/v1/exams', { method: 'POST', jar: s.jar, body: spec, headers: { 'Idempotency-Key': `tw-${stamp}-${i}` } });
    if (made.status !== 201) throw new Error(`exam: ${made.status} ${made.text}`);
    const id = made.data.exam.id;
    const sealed = JSON.parse(h.db.prepare("SELECT response_json FROM idempotency_keys WHERE scope='exam-paper' AND key=?").get(id).response_json);
    const answers = {}, workings = {};
    for (const sq of sealed.questions) {
      const q = sq.payload;
      if (q.multipart) continue;
      const meta = stepMetaFor(q);
      const root = meta?.kind === 'equation' && meta.solutions?.length === 1 ? Number(meta.solutions[0]) : NaN;
      const wrong = String(root + 3);
      let right = false; try { right = checkAnswer(q, wrong).correct === true; } catch { right = true; }
      if (Number(sq.marking.correct) >= 2 && Number.isFinite(root) && !right) {
        const v = meta.variable || 'x';
        workings[sq.id] = `2${v} = ${2 * root}\n${v} = ${root + 3}\n${v} + 1 = ${root + 4}`;
        answers[sq.id] = wrong;
      } else if (i === 0 && Number.isFinite(root)) answers[sq.id] = String(root);
    }
    const done = await h.request(`/v1/exams/${id}/finish`, { method: 'POST', jar: s.jar, body: { answers, workings } });
    if (done.status !== 200) throw new Error(`finish: ${done.status} ${done.text}`);
    const hi = await req(s, `/v1/classroom/classes/${C}/assignments/${A}/hand-in`, { method: 'POST', body: { examId: id } });
    if (hi.status !== 201) throw new Error(`hand-in: ${hi.status} ${hi.text}`);
    reviewItems += hi.data.handin.reviewItems;
  }

  // The class board's evidence: the server grader's own rows (Prithagoras only draws a board).
  let cursor = 700000, seq = 900000;
  const graded = (s, dotpoint, correct, misconception = null, ago = 3600000) => {
    const at = Date.now() - ago, id = `tw-ga-${++seq}`;
    h.db.prepare('INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(++cursor, id, s.id, 'server-grader', seq, 'graded-attempt', `q-${seq}`, at, JSON.stringify({
        attemptId: id, questionId: `q-${seq}`, correct, marksEarned: correct ? 1 : 0, marksPossible: 1, subtopic: dotpoint.split('.')[0],
        difficulty: 2, dotpoint, mode: 'practice', hintsUsed: 0, support: 'supported', ...(misconception ? { misconception, misconceptionSource: 'step' } : {}),
        createdAt: at, serverAcknowledgedAt: at
      }), at);
  };
  graded(S[0], 'y7-integers.1', true); graded(S[0], 'y7-integers.1', true);
  for (const s of S.slice(1)) graded(s, 'y7-integers.2', false, 'sign-flipped');
  graded(S[0], 'y7-equations.1', true); graded(S[1], 'y7-equations.1', false);
  graded(S[2], 'y7-equations.1', true); graded(S[3], 'y7-fractions.1', false);
  return { T, S, C, A, reviewItems, req };
}

async function shot(page, name, locator = null) {
  const path = join(OUT, `${name}.png`);
  // TEST DESK, pictures only: the sticky bar and the skip link stay out of an element's picture.
  await page.evaluate(() => { for (const el of document.querySelectorAll('body *')) { const p = getComputedStyle(el).position; if (p === 'sticky' || p === 'fixed') el.style.position = 'static'; } document.querySelector('.skip-link')?.style.setProperty('display', 'none'); });
  if (locator) await locator.screenshot({ path });
  else await page.screenshot({ path, fullPage: true });
  console.log(`  shot ${path}`);
  return path;
}

async function openPicker(page) {
  await page.locator('.user-chip').first().click();
  await page.getByRole('menuitem', { name: 'Switch profile' }).click();
  await page.locator('.auth-wrap').waitFor({ timeout: 15000 });
}

/** A teacher device profile from the picker, signed in at the gate to `email` (the wizard, as the a11y walk drives it). */
async function teacherProfile(page, platform, email) {
  await page.getByRole('button', { name: /Add another profile/i }).click();
  await page.waitForSelector('[data-onboarding-step="1"]', { timeout: 15000 });
  await page.getByRole('button', { name: 'Teacher', exact: true }).click();
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="2"]', { timeout: 15000 });
  await page.locator(NSW ? '#signup-year' : '#signup-track').selectOption('10');
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="3"]', { timeout: 15000 });
  await page.locator('#signup-name').fill('Ms Rao');
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="4"]', { timeout: 15000 });
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="5"]', { timeout: 15000 });
  await page.locator('.auth-card .btn-primary').click();
  const card = page.locator('[data-testid="account-activation-gate"] [data-signin-card="inline"]');
  await card.waitFor({ timeout: 30000 });
  await signInOnCard(card, platform, { email, age: 18 });
  await page.locator('.shell').waitFor({ timeout: 60000 });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  console.log(`TEACHER WORKSPACE TOUR — ${EDITION}`);
  const dist = build();
  const platform = await startOnlinePlatform({ dist, allowSeededPractice: true });
  const browser = await chromium.launch();
  const errors = [];
  try {
    const world = await seed(platform);
    check('the desk seeded a class, a paper and three hand-ins', world.reviewItems >= 1, `review items ${world.reviewItems}`);

    // ── Teacher ──────────────────────────────────────────────────────────────
    const tctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const tp = await tctx.newPage();
    tp.on('pageerror', e => errors.push(`teacher: ${e.message}`));
    await tp.goto(`${platform.origin}/`, { waitUntil: 'domcontentloaded' });
    await createVerifiedProfile(tp, platform, { name: 'Tour Helper', year: 9 });
    await openPicker(tp);
    await teacherProfile(tp, platform, world.T.email);
    await tp.goto(`${platform.origin}/teach`, { waitUntil: 'domcontentloaded' });
    const ws = tp.locator('[data-teacher-workspace]');
    await ws.waitFor({ timeout: 60000 });
    check('the teacher workspace opens for the class', await ws.count() === 1);

    if (NSW) {
      await tp.locator('[data-class-board] table').waitFor({ timeout: 30000 });
      await tp.waitForTimeout(400);
      check('the board names its honest note', await tp.locator('[data-board-honest-note]').count() === 1);
      check('the re-teach list names the misconception', ((await tp.locator('[data-reteach]').textContent()) || '').length > 0);
      await shot(tp, '01-class-board', ws);
      const count = tp.locator('[data-drill^="MA4-INT-C-01:"]').first();
      await count.focus();
      await tp.keyboard.press('Enter');
      await tp.locator('[data-board-drill]').waitFor({ timeout: 15000 });
      await tp.waitForTimeout(300);
      check('a count opens the named students (keyboard)', ((await tp.locator('[data-board-drill]').textContent()) || '').match(/Asha|Ben|Cara|Dev/) !== null);
      await shot(tp, '02-board-drill-down', tp.locator('[data-board-drill]'));
    } else {
      await tp.locator('[data-class-board-not-yet]').waitFor({ timeout: 30000 });
      check('Priyabhata says honestly why there is no class board', await tp.locator('[data-class-board-not-yet]').count() === 1);
      await shot(tp, '01-class-board-not-yet', ws);
    }

    await tp.locator('[data-tw-view="papers"]').click();
    await tp.locator('[data-open-results]').first().click();
    await tp.locator('[data-paper-results] table').first().waitFor({ timeout: 30000 });
    await tp.waitForTimeout(400);
    check('results show a separate "Teacher marks" column', await tp.locator('[data-paper-results] th', { hasText: 'Teacher marks' }).count() >= 2);
    await shot(tp, '03-paper-results', tp.locator('[data-paper-results]'));
    await shot(tp, '03b-papers-form', tp.locator('[data-paper-form]'));

    const review = tp.locator('[data-tw-view="review"]');
    if (await review.count()) {
      // TEST DESK, labelled: the desk's students typed their working, so one
      // item is marked as handwritten (inputMode 'ink' and a page digest), to
      // render the handwriting-first layout. No stored page or real handwriting
      // exists behind it; the original-work slot says so.
      const inkRow = platform.h.db.prepare('SELECT id,evidence_json FROM teacher_review_items WHERE student_account_id=? ORDER BY question_order LIMIT 1').get(world.S[1].id);
      if (inkRow) {
        const ev = JSON.parse(inkRow.evidence_json);
        const digest = createHash('sha256').update(`synthetic-page-${inkRow.id}`).digest('hex');
        platform.h.db.prepare('UPDATE teacher_review_items SET evidence_json=? WHERE id=?').run(JSON.stringify({ ...ev, inputMode: 'ink', ink: { digest }, original: null }), inkRow.id);
      }
      await review.click();
      await tp.locator('[data-review-item]').first().waitFor({ timeout: 30000 });
      if (inkRow) {
        await tp.locator(`[data-review-open="${inkRow.id}"]`).click();
        await tp.locator('[data-review-original]').waitFor({ timeout: 15000 });
        await tp.waitForTimeout(400);
        check('a handwritten item shows the original-work slot, the ink version and "What Pri read"',
          await tp.locator('[data-deciding-on]').count() === 1 && /What Pri read/.test((await tp.locator('[data-review-detail]').textContent()) || ''));
        await shot(tp, '04b-review-item-handwritten', tp.locator('[data-review-detail]'));
        await tp.locator(`[data-review-open="${inkRow.id}"]`).click();
      }
      await tp.locator('[data-review-item]').first().waitFor({ timeout: 30000 });
      await tp.locator('[data-review-open]').last().click();
      await tp.locator('[data-review-detail]').waitFor({ timeout: 15000 });
      await tp.waitForTimeout(400);
      check('the review item has no suggested mark', !/suggested|recommended/i.test((await tp.locator('[data-review-detail]').textContent()) || ''));
      await shot(tp, '04-review-item', tp.locator('[data-review-detail]'));
      await tp.locator('[data-review-decision="award"]').check();
      await tp.locator('[data-review-save]').click();
      await tp.locator('[data-review-status]').filter({ hasText: /saved/i }).waitFor({ timeout: 15000 });
      await tp.locator('[data-review-history] li').first().waitFor({ timeout: 15000 });
      await tp.waitForTimeout(300);
      check('the decision is saved and shown in the history', await tp.locator('[data-review-history] li').count() >= 1);
      await shot(tp, '05-review-decided', tp.locator('[data-review-detail]'));
    } else {
      // Without the review queue in this build, a teacher mark is made at the desk so the student view shows one.
      const q = await world.req(world.T, `/v1/classroom/classes/${world.C}/review`);
      const item = q.data?.items?.find(i => i.student.id === world.S[0].id) || q.data?.items?.[0];
      if (item) await world.req(world.T, `/v1/classroom/classes/${world.C}/review/${item.id}`, { method: 'POST', body: { decision: 'award', marks: 1, comment: 'Good first line.' } });
    }
    await tctx.close();

    // ── Student ──────────────────────────────────────────────────────────────
    const decidedFor = platform.h.db.prepare('SELECT student_account_id AS s FROM teacher_marks ORDER BY created_at LIMIT 1').get()?.s;
    const student = world.S.find(s => s.id === decidedFor) || world.S[0];
    const sctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const sp = await sctx.newPage();
    sp.on('pageerror', e => errors.push(`student: ${e.message}`));
    await sp.goto(`${platform.origin}/`, { waitUntil: 'domcontentloaded' });
    await createVerifiedProfile(sp, platform, { name: student.name, email: student.email, year: 7 });
    await sp.goto(`${platform.origin}/settings`, { waitUntil: 'domcontentloaded' });
    const sees = sp.locator('[data-teacher-can-see]');
    await sees.waitFor({ timeout: 60000 });
    await sp.locator('[data-student-handin]').first().waitFor({ timeout: 30000 });
    await sp.waitForTimeout(400);
    check('the student sees what the teacher can see', ((await sees.textContent()) || '').includes('never'));
    check('the teacher mark is labelled "Teacher mark"', await sp.locator('.tw-teacher-tag', { hasText: 'Teacher mark' }).count() >= 1);
    await sp.locator('[data-paper-assignment]').first().scrollIntoViewIfNeeded();
    await shot(sp, '06-student-paper-and-visibility', sp.locator('section[aria-labelledby="assignment-inbox-title"]'));
    await sctx.close();
  } finally {
    await browser.close();
    await platform.close();
    rmSync(dist, { recursive: true, force: true });
  }
  check('nothing threw in the page', errors.length === 0, errors.slice(0, 3).join(' | '));
  const failed = results.filter(r => !r.ok);
  console.log(`TEACHER WORKSPACE TOUR (${EDITION}): ${failed.length ? 'FAIL' : 'PASS'} — ${results.length - failed.length}/${results.length} checks; screenshots in ${OUT}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
