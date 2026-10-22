// Pri Learning · the mistake notebook and its free/Premium split are the
// SERVER's, per account, over real HTTP — and its rules are one pure function
// (client/src/engine/mistakeNotebook.js) replayed here deterministically.
//
//   pure     every wrong resolution is filed; a reveal is not. Grouped by
//            topic and misconception. A correct retry (`twinOf`) marks it
//            fixed. Unfixed mistakes come due at 1, 3, 7, 14, 30 days, each
//            failed retry one step further. The free preview returns the
//            newest N in full and the rest as a count only — never the
//            entries themselves.
//   http     a wrong answer's first broken line and the examiner's note are
//            saved with the attempt, exactly as the deterministic step check
//            reported them. A free account sees its newest
//            FREE_NOTEBOOK_PREVIEW mistakes; a hidden entry cannot be retried
//            (402 PREMIUM_REQUIRED); Premium — the server's own record, never a
//            header — sees and retries all. A correct retry marks the mistake
//            fixed. Another account sees nothing.
import './support/hermetic.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'pri-notebook-paywall-'));
delete process.env.NODE_ENV;
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '6e'.repeat(32);
process.env.PRI_AUTH_EMAIL_PROVIDER = 'test';
delete process.env.PRI_PUBLIC_ORIGIN;
// The free plan's 5 marked scripts a day is proven in practice-daily-cap-check.mjs;
// this suite files more mistakes than that on one free account.
process.env.PRI_FREE_MARKED_PER_DAY = '100000';

const { startApp, registerAccount, verifyEmail, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { buildNotebook, isMistake, reviewFor, REVIEW_INTERVALS_DAYS, UNCLASSIFIED } = await import('../../client/src/engine/mistakeNotebook.js');
const { FREE_NOTEBOOK_PREVIEW } = await import('../../client/src/engine/practiceAllowance.js');
const { notebookEvidence } = await import('../platform/practice.js');
const h = await startApp({ engine: requestedEngine() });
const c = checks();
const DAY = 24 * 60 * 60 * 1000;
const REQUEST = { generator: 'c8-linear-equations-both-sides', difficulty: 2, curriculum: 'in', mode: 'practice' };
const post = (path, body, jar = {}, headers = {}) => h.request(path, { method: 'POST', jar, body, headers });
const get = (path, jar = {}, headers = {}) => h.request(path, { jar, headers });
const issue = jar => post('/v1/practice/issue', REQUEST, jar);
let sub = 0;
const grade = (jar, id, answer, steps) => {
  const sid = `notebook-${String(++sub).padStart(4, '0')}`;
  return post(`/v1/practice/${id}/submit`, { submissionId: sid, answer: String(answer), mode: 'typed', ...(steps ? { steps } : {}) }, jar, { 'Idempotency-Key': sid });
};
const sealed = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?", [id])).response_json);
const event = async attemptId => JSON.parse((await h.db.get("SELECT payload_json FROM learning_events WHERE id=? AND kind='graded-attempt'", [attemptId])).payload_json);
const strip = text => String(text).replace(/\$/g, '').trim();

try {
  // ── the pure rules ──────────────────────────────────────────────────────────
  const t0 = Date.UTC(2026, 9, 1);
  const att = (id, extra) => ({ attemptId: id, at: t0, correct: false, subtopic: 'lin', mode: 'practice', marksEarned: 0, marksPossible: 2, ...extra });
  const attempts = [
    att('m1', { at: t0 + 1, misconception: 'sign-flip', firstError: { line: 2, text: '9x + 1 = -20', note: 'Subtract 3x from both sides.' } }),
    att('m2', { at: t0 + 2, misconception: 'sign-flip' }),
    att('m3', { at: t0 + 3 }),
    att('m4', { at: t0 + 4, subtopic: 'frac' }),
    att('r1', { at: t0 + 5, revealed: true }),
    att('ok', { at: t0 + 6, correct: true }),
    att('g1', { at: t0 + 7, mode: 'rush' }),
    // m1 retried wrong once, then right; m2 retried wrong twice.
    { attemptId: 't1', at: t0 + 2 * DAY, correct: false, subtopic: 'lin', mode: 'review', twinOf: 'm1' },
    { attemptId: 't2', at: t0 + 3 * DAY, correct: true, subtopic: 'lin', mode: 'review', twinOf: 'm1' },
    { attemptId: 't3', at: t0 + 1 * DAY, correct: false, subtopic: 'lin', mode: 'review', twinOf: 'm2' },
    { attemptId: 't4', at: t0 + 4 * DAY, correct: false, subtopic: 'lin', mode: 'review', twinOf: 'm2' }
  ];
  c.deq(attempts.filter(isMistake).map(a => a.attemptId), ['m1', 'm2', 'm3', 'm4', 't1', 't3', 't4'],
    'every wrong resolution of a marked practice/review question is a mistake; a reveal, a right answer and a Rush game are not');
  const full = buildNotebook(attempts, { now: t0 + 5 * DAY });
  const byId = Object.fromEntries(full.entries.map(e => [e.id, e]));
  c.deq([byId.m1.fixed, byId.m1.fixedAt, byId.m1.retries, byId.m1.review.due], [true, t0 + 3 * DAY, 2, false], 'a correct retry marks the mistake fixed and ends its reviews');
  c.deq([byId.m2.fixed, byId.m2.review.stage, byId.m2.review.dueAt], [false, 2, t0 + 4 * DAY + REVIEW_INTERVALS_DAYS[2] * DAY], 'two failed retries: third interval, counted from the last');
  c.deq([byId.m3.review.stage, byId.m3.review.dueAt, byId.m3.review.due], [0, t0 + 3 + DAY, true], 'an untouched mistake is due a day after it was made');
  c.deq(byId.m1.firstError, { line: 2, text: '9x + 1 = -20', note: 'Subtract 3x from both sides.' }, 'the first broken line and the examiner\'s note travel with the entry');
  const sign = full.groups.find(g => g.key === 'lin::sign-flip');
  c.deq([sign.count, sign.open, sign.items.map(i => i.id).sort()], [2, 1, ['m1', 'm2']], 'grouped by topic and misconception');
  c.ok(full.groups.some(g => g.key === `lin::${UNCLASSIFIED}` && g.misconception === null), 'an undiagnosed mistake is filed under its topic, with no invented misconception');
  c.ok(full.groups.some(g => g.key === `frac::${UNCLASSIFIED}`), 'each topic has its own group');
  c.deq(buildNotebook(attempts, { now: t0 + 5 * DAY }), full, 'the notebook is a pure function of the attempts');
  c.deq(buildNotebook([...attempts].reverse(), { now: t0 + 5 * DAY }), full, 'whatever order they arrive in');
  const preview = buildNotebook(attempts, { now: t0 + 5 * DAY, preview: 3 });
  c.deq([preview.total, preview.shown, preview.hidden], [7, 3, 4], 'the free preview counts every mistake and shows the newest three');
  c.deq(preview.entries.map(e => e.id), full.entries.slice(0, 3).map(e => e.id), 'newest first');
  c.ok(preview.groups.flatMap(g => g.items).every(i => preview.entries.includes(i)), 'and no group carries a hidden entry');
  c.deq(reviewFor({ answeredAt: 0, retries: Array.from({ length: 9 }, (_, i) => ({ correct: false, at: i })), fixed: false, now: 0 }).stage, REVIEW_INTERVALS_DAYS.length - 1, 'the schedule stops widening at its last interval');
  c.deq(notebookEvidence({ firstBreak: 1, lines: [{ text: 'a', status: 'ok' }, { text: 'b', status: 'break', note: 'n' }] }), { firstError: { line: 2, text: 'b', note: 'n' } }, 'notebook evidence is the step check\'s first break, 1-based');
  c.deq([notebookEvidence(null), notebookEvidence({ firstBreak: -1, lines: [] }), notebookEvidence({ firstBreak: 0, lines: [{ text: 'a', status: 'ok' }] })], [{}, {}, {}], 'and nothing when it reported no break');

  // ── accounts ────────────────────────────────────────────────────────────────
  const free = await registerAccount(h, { email: 'notebook.free@example.test', deviceId: 'ipad-nb-free' });
  const other = await registerAccount(h, { email: 'notebook.other@example.test', deviceId: 'ipad-nb-other' });
  for (const who of [free, other]) c.eq((await verifyEmail(h, who.account.id)).status, 200, 'a verified account');
  const paid = periodEnd => h.db.run(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,product_id,current_period_end,source_version,updated_at) VALUES (?,?,?,?,?,?,1,?)
    ON CONFLICT(account_id) DO UPDATE SET plan=excluded.plan,status=excluded.status,provider=excluded.provider,product_id=excluded.product_id,current_period_end=excluded.current_period_end,source_version=excluded.source_version,updated_at=excluded.updated_at`,
  [free.account.id, 'premium', 'active', 'apple', 'pri-premium-annual', periodEnd, Date.now()]);

  // A wrong answer with working whose second line breaks.
  const first = await issue(free.jar);
  const fq = await sealed(first.data.question.id);
  const lines = fq.steps.slice(0, 4).map(s => strip(s.d));
  const broken = [lines[0], lines[1].replace(/\d+/, n => String(Number(n) + 6)), 'x = 1000'];
  c.ok(broken[1] !== lines[1], `the second line is broken on purpose (${lines[1]} → ${broken[1]})`);
  await grade(free.jar, first.data.question.id, '1000', broken);
  const resolved = await grade(free.jar, first.data.question.id, '1000', broken);
  c.deq([resolved.status, resolved.data.resolved, resolved.data.correct], [200, true, false], 'resolved wrong after two tries');
  const ev = await event(resolved.data.attemptId);
  const reportedBreak = resolved.data.stepReport?.firstBreak;
  c.ok(Number.isInteger(reportedBreak) && reportedBreak >= 0, `the step check reports a broken line (firstBreak ${reportedBreak})`);
  {
    c.deq(ev.firstError, { line: reportedBreak + 1, text: resolved.data.stepReport.lines[reportedBreak].text.slice(0, 400), note: String(resolved.data.stepReport.lines[reportedBreak].note || '').slice(0, 600) },
      'the attempt saves the first broken line and the examiner\'s note exactly as the step check reported them');
  }

  // Four more wrong resolutions: five mistakes in all.
  const ids = [resolved.data.attemptId];
  for (let i = 0; i < 4; i++) {
    const q = await issue(free.jar);
    await grade(free.jar, q.data.question.id, '1000');
    ids.push((await grade(free.jar, q.data.question.id, '1001')).data.attemptId);
  }
  const book = await get('/v1/practice/notebook', free.jar);
  c.deq([book.status, book.data.plan, book.data.preview, book.data.total, book.data.shown, book.data.hidden], [200, 'free', FREE_NOTEBOOK_PREVIEW, 5, FREE_NOTEBOOK_PREVIEW, 5 - FREE_NOTEBOOK_PREVIEW],
    'a free account sees its newest three mistakes and a count of the rest');
  const shownIds = book.data.groups.flatMap(g => g.items.map(i => i.id));
  c.deq(shownIds.sort(), ids.slice(-FREE_NOTEBOOK_PREVIEW).sort(), 'exactly the newest three are sent');
  for (const hidden of ids.slice(0, 5 - FREE_NOTEBOOK_PREVIEW)) c.ok(!JSON.stringify(book.data).includes(hidden), 'a hidden entry is never sent, not even its id');
  c.eq(book.headers.get('cache-control'), 'no-store', 'and the notebook is never cached');
  const claimed = await get('/v1/practice/notebook', free.jar, { 'x-pri-plan': 'premium', 'x-pri-entitlement': 'full-notebook' });
  c.eq(claimed.data.hidden, 5 - FREE_NOTEBOOK_PREVIEW, 'a Premium claim in a header changes nothing');
  const hiddenTwin = await post(`/v1/practice/notebook/${ids[0]}/twin`, {}, free.jar);
  c.deq([hiddenTwin.status, hiddenTwin.data.error?.code, hiddenTwin.data.error?.capability], [402, 'PREMIUM_REQUIRED', 'full-notebook'], 'a hidden entry cannot be retried on the free plan');
  c.deq([(await post(`/v1/practice/notebook/${ids[0]}/twin`, {}, other.jar)).status, (await get('/v1/practice/notebook', other.jar)).data.total], [404, 0], 'another account can neither retry it nor see any of it');

  // A shown entry is retried; a right answer to the retry marks it fixed.
  const newest = ids[ids.length - 1];
  const twin = await post(`/v1/practice/notebook/${newest}/twin`, {}, free.jar);
  c.eq(twin.status, 201, 'a shown entry is retried with a similar question from the same generator');
  const tq = await sealed(twin.data.question.id);
  c.deq([tq._twinOf, tq._generator, tq._practiceMode], [newest, REQUEST.generator, 'review'], 'sealed with the mistake it retries');
  c.ok(!('_twinOf' in twin.data.question), 'and the link stays on the server');
  const fixedReply = await grade(free.jar, twin.data.question.id, String(tq.answer.value));
  c.deq([fixedReply.data.correct, (await event(fixedReply.data.attemptId)).twinOf], [true, newest], 'the right answer records which mistake it retried');
  const after = (await get('/v1/practice/notebook', free.jar)).data;
  const fixedEntry = after.groups.flatMap(g => g.items).find(i => i.id === newest);
  c.deq([fixedEntry.fixed, fixedEntry.review.due, fixedEntry.review.dueAt], [true, false, null], 'the mistake is fixed and leaves the review schedule');

  // Premium — the server's own record — sees and retries every mistake.
  await paid(Date.now() + 30 * DAY);
  const premiumBook = (await get('/v1/practice/notebook', free.jar)).data;
  c.deq([premiumBook.plan, premiumBook.preview, premiumBook.total, premiumBook.hidden], ['premium', null, 5, 0], 'Premium unlocks the full notebook');
  c.eq((await post(`/v1/practice/notebook/${ids[0]}/twin`, {}, free.jar)).status, 201, 'and every entry can be retried');
  await paid(Date.now() - DAY);
  c.eq((await get('/v1/practice/notebook', free.jar)).data.hidden, 5 - FREE_NOTEBOOK_PREVIEW, 'a lapsed period is the free plan again');
  c.eq((await get('/v1/practice/notebook', {})).status, 401, 'signed out, there is no notebook');

  console.log(`engine: ${h.engine}`);
  console.log(`MISTAKE NOTEBOOK: PASS — ${c.count()}/${c.count()} checks — every wrong resolution is filed with its first broken line, grouped by topic and misconception, fixed by a correct retry, scheduled for review, and the free preview is enforced by the server.`);
} catch (error) {
  console.error(error);
  console.log('MISTAKE NOTEBOOK: FAIL');
  process.exitCode = 1;
} finally {
  await h.close();
}
