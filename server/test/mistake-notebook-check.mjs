// Pri Learning · the mistake notebook (D22: "the notebook ... ships").
//
// One pure definition (client/src/engine/mistakeNotebook.js) that the server
// builds GET /v1/practice/notebook from. Deterministically, then over real
// HTTP on either engine:
//   · every wrong resolution is filed — a diagnosed slip under its
//     misconception, an undiagnosed one under its topic alone; a revealed
//     solution and a correct answer are not;
//   · a wrong answer with working carries the first broken line and the
//     examiner's note exactly as the deterministic step check reported them,
//     and the mark is the marker's, unchanged;
//   · any filed mistake can be retried with a twin; a right twin fixes it;
//   · an unfixed mistake comes due 1, 3, 7, 14 then 30 days after its last
//     attempt;
//   · the notebook is the same on every plan, the builds already installed
//     still get their `entries`, and another account sees nothing.
import './support/hermetic.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'pri-mistake-notebook-'));
process.env.NODE_ENV = 'test'; // fixed seeds: the same content on demand
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '4e'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, registerAccount, verifyEmail, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { solveLinearPrompt } = await import('./support/linear-equation.mjs');
const { buildNotebook, firstErrorOf, isMistake, reviewFor, REVIEW_INTERVALS_DAYS, UNCLASSIFIED } = await import('../../client/src/engine/mistakeNotebook.js');
const h = await startApp({ engine: requestedEngine() });
const c = checks();
const DAY = 24 * 60 * 60 * 1000;
const LINEAR = 'c8-linear-equations-both-sides';
const PERCENT = 'y7-decimals-perc'; // seed 4242: 30% of 90; the trap answer 3 divides by 30
const post = (path, body, jar, headers = {}) => h.request(path, { method: 'POST', jar, body, headers });
const get = (path, jar) => h.request(path, { method: 'GET', jar });
const issue = (jar, generator, seed, difficulty = 2) => post('/v1/practice/issue', { generator, difficulty, seed, curriculum: 'in' }, jar);
const sealed = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?", [id])).response_json);
const eventOf = async id => { const row = await h.db.get("SELECT id,payload_json FROM learning_events WHERE kind='graded-attempt' AND entity_id=?", [id]); return row ? { eventId: row.id, ...JSON.parse(row.payload_json) } : null; };
let n = 0;
const submit = (jar, id, answer, steps) => { const sid = `notebook-${String(++n).padStart(4, '0')}`; return post(`/v1/practice/${id}/submit`, { submissionId: sid, answer: String(answer), mode: 'typed', ...(steps ? { steps } : {}) }, jar, { 'Idempotency-Key': sid }); };
const notebookOf = async jar => (await get('/v1/practice/notebook', jar)).data;
const itemOf = (book, id) => book.groups.flatMap(g => g.items).find(i => i.id === id) || null;

try {
  // ── the pure definition ────────────────────────────────────────────────────
  const T = Date.UTC(2026, 10, 1, 6, 0, 0);
  c.deq(REVIEW_INTERVALS_DAYS, [1, 3, 7, 14, 30], 'the review schedule widens 1, 3, 7, 14, 30 days');
  const base = { attemptId: 'a1', subtopic: 'c8-linear-equations-both-sides', mode: 'practice', correct: false, at: T };
  c.ok(isMistake(base), 'a wrong resolution in a practice mode is a mistake');
  c.ok(!isMistake({ ...base, correct: true }) && !isMistake({ ...base, revealed: true }) && !isMistake({ ...base, resolved: false }),
    'a right answer, a revealed solution and an open try are not');
  c.ok(!isMistake({ ...base, mode: 'rush' }) && !isMistake({ ...base, mode: 'placement' }) && !isMistake({ ...base, subtopic: '' }) && !isMistake({ ...base, attemptId: '' }),
    'nor are Rush, the placement check, or an attempt with no topic or id');
  c.deq(firstErrorOf({ lines: [{ text: 'x - 14 = -5', status: 'ok' }, { text: 'x = 8', status: 'break', note: 'Adding 14 to both sides gives 9.' }], firstBreak: 1 }),
    { firstError: { line: 2, text: 'x = 8', note: 'Adding 14 to both sides gives 9.' } }, 'the first broken line is reported 1-based with the examiner\'s note');
  c.deq([firstErrorOf({ lines: [{ text: 'x = 9', status: 'ok' }], firstBreak: -1 }), firstErrorOf(null), firstErrorOf({ lines: [{ text: 'a', status: 'note' }], firstBreak: 0 })], [{}, {}, {}],
    'no break, no report, or a line that is not a break gives nothing');
  for (const [failed, days] of [[0, 1], [1, 3], [2, 7], [3, 14], [4, 30], [7, 30]]) {
    const retries = Array.from({ length: failed }, (_, i) => ({ correct: false, at: T + (i + 1) * DAY }));
    const r = reviewFor({ answeredAt: T, retries, fixed: false, now: T });
    c.eq(r.dueAt, (failed ? T + failed * DAY : T) + days * DAY, `after ${failed} failed retr${failed === 1 ? 'y' : 'ies'} it is due ${days} days after the last attempt`);
  }
  c.deq(reviewFor({ answeredAt: T, retries: [], fixed: true, now: T }), { stage: null, dueAt: null, due: false }, 'a fixed mistake is never due');
  const book = buildNotebook([
    { ...base, attemptId: 'm1', misconception: 'pct-divides', misconceptionSource: 'trap', at: T - 3 * DAY },
    { ...base, attemptId: 'm2', at: T - DAY, firstError: { line: 2, text: 'x = 8', note: 'n' } },
    { ...base, attemptId: 'r1', twinOf: 'm1', correct: false, at: T - 2 * DAY },
    { ...base, attemptId: 'r2', twinOf: 'm2', correct: true, at: T - DAY / 2 },
    { ...base, attemptId: 'ok', correct: true, at: T }
  ], { now: T });
  c.deq([book.total, book.entries.map(e => e.id)], [3, ['m2', 'r1', 'm1']], 'every wrong resolution is filed, newest first — a failed retry included');
  const m1 = book.entries.find(e => e.id === 'm1');
  const m2 = book.entries.find(e => e.id === 'm2');
  c.deq([m1.fixed, m1.retries, m1.review.dueAt], [false, 1, T - 2 * DAY + 3 * DAY], 'a mistake whose retry failed is open and due 3 days after that retry');
  c.deq([m2.fixed, m2.fixedAt, m2.review.due, m2.firstError], [true, T - DAY / 2, false, { line: 2, text: 'x = 8', note: 'n' }], 'a mistake whose twin was right is fixed, never due, and keeps its first broken line');
  c.deq(book.groups.map(g => g.key).sort(), [`${base.subtopic}::pct-divides`, `${base.subtopic}::${UNCLASSIFIED}`], 'grouped by topic and misconception; an undiagnosed slip is filed under its topic alone');
  c.eq(buildNotebook(Array.from({ length: 5 }, (_, i) => ({ ...base, attemptId: `x${i}`, at: T + i })), { now: T, limit: 2 }).entries.map(e => e.id).join(), 'x4,x3', 'a response carries the newest entries up to its limit');

  // ── over HTTP ──────────────────────────────────────────────────────────────
  const a = await registerAccount(h, { email: 'mistakes.a@example.test', deviceId: 'ipad-mistakes-a' });
  const p = await registerAccount(h, { email: 'mistakes.premium@example.test', deviceId: 'ipad-mistakes-p' });
  const o = await registerAccount(h, { email: 'mistakes.other@example.test', deviceId: 'ipad-mistakes-o' });
  for (const who of [a, p, o]) c.eq((await verifyEmail(h, who.account.id)).status, 200, 'a verified account');
  await h.db.run(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,product_id,current_period_end,source_version,updated_at) VALUES (?,?,?,?,?,?,1,?)
    ON CONFLICT(account_id) DO UPDATE SET plan=excluded.plan,status=excluded.status,provider=excluded.provider,product_id=excluded.product_id,current_period_end=excluded.current_period_end,source_version=excluded.source_version,updated_at=excluded.updated_at`,
  [p.account.id, 'premium', 'active', 'apple', 'com.prilearning.app.premium.annual', Date.now() + 30 * DAY, Date.now()]);
  c.deq((await notebookOf(a.jar)).notebook, { total: 0, shown: 0, dueCount: 0, nextDueAt: null, groups: [] }, 'an empty notebook to begin with');

  // A wrong answer with working whose second line breaks.
  const lq = (await issue(a.jar, LINEAR, 104729)).data.question; // $3x - 14=2x - 5$, root 9
  const { root, variable } = solveLinearPrompt(lq.prompt);
  c.eq(root, 9, 'the issued equation is the fixed one');
  const steps = [`${variable} - 14 = -5`, `${variable} = 8`];
  await submit(a.jar, lq.id, 8, steps);
  const resolvedWrong = await submit(a.jar, lq.id, 8, steps);
  c.deq([resolvedWrong.status, resolvedWrong.data.resolved, resolvedWrong.data.correct], [200, true, false], 'resolved wrong on the second try');
  const report = resolvedWrong.data.stepReport;
  const ev = await eventOf(lq.id);
  c.deq(ev.firstError, { line: report.firstBreak + 1, text: report.lines[report.firstBreak].text, note: report.lines[report.firstBreak].note || '' },
    'the graded attempt carries the first broken line and the note exactly as the step check reported them');
  c.eq(ev.firstError.text, `${variable} = 8`, 'which is the student\'s own second line');
  c.deq([ev.marksEarned, ev.marksPossible], [resolvedWrong.data.marksEarned, resolvedWrong.data.marksPossible], 'and the marks are the marker\'s, unchanged');

  c.ok(ev.misconception === undefined || ev.misconceptionSource === 'step', 'a slip the step check names is filed under it; nothing else is inferred');

  // A wrong typed answer with no working and no authored trap: undiagnosed.
  const uq = (await issue(a.jar, LINEAR, 654321)).data.question; // $6t - 1=-t - 22$, root -3
  const wrongU = solveLinearPrompt(uq.prompt).root + 100;
  await submit(a.jar, uq.id, wrongU);
  await submit(a.jar, uq.id, wrongU);
  const uev = await eventOf(uq.id);
  c.deq([uev.correct, 'misconception' in uev, 'firstError' in uev], [false, false, false], 'a wrong typed answer with nothing diagnosed carries no misconception and no first error');

  // A diagnosed slip.
  const tq = (await issue(a.jar, PERCENT, 4242)).data.question;
  const trap = (await sealed(tq.id)).traps.find(x => x.value !== undefined);
  await submit(a.jar, tq.id, trap.value);
  await submit(a.jar, tq.id, trap.value);
  const tev = await eventOf(tq.id);
  c.ok(typeof tev.misconception === 'string' && tev.misconception && !('firstError' in tev), 'a typed trap answer is filed under its misconception, with no working to report');

  // A revealed solution and a right answer are not filed.
  const rq = (await issue(a.jar, LINEAR, 2)).data.question;
  c.eq((await post(`/v1/practice/${rq.id}/reveal`, {}, a.jar)).status, 200, 'a solution is revealed');
  const cq = (await issue(a.jar, LINEAR, 3)).data.question;
  c.eq((await submit(a.jar, cq.id, solveLinearPrompt(cq.prompt).root)).data.correct, true, 'and another answered right');

  const book1 = (await notebookOf(a.jar)).notebook;
  c.deq([book1.total, !!itemOf(book1, ev.eventId), !!itemOf(book1, uev.eventId), !!itemOf(book1, tev.eventId)], [3, true, true, true], 'the notebook files exactly the three wrong resolutions');
  const lin = itemOf(book1, ev.eventId);
  c.deq([lin.prompt, lin.canTwin, lin.firstError], [lq.prompt, true, ev.firstError], 'the one with working shows its prompt and its first broken line');
  const und = itemOf(book1, uev.eventId);
  c.deq([und.prompt, und.misconception, und.firstError], [uq.prompt, null, null], 'the undiagnosed one is filed under its topic alone');
  c.deq([und.review.stage, und.review.dueAt, und.review.due, und.fixed], [0, und.answeredAt + DAY, false, false], 'and is first due a day after it was answered');
  const legacy = (await notebookOf(a.jar)).entries;
  c.ok(Array.isArray(legacy) && legacy.some(g => g.key === tev.misconception) && !legacy.some(g => g.items.some(i => i.id === uev.eventId)),
    'builds already installed still get their misconception `entries`, unchanged: diagnosed slips only');

  // A twin of the undiagnosed mistake, answered right, fixes it.
  const twin = await post(`/v1/practice/notebook/${uev.eventId}/twin`, {}, a.jar);
  c.deq([twin.status, twin.data.twin?.of, twin.data.twin?.misconception], [201, uev.eventId, null], 'an undiagnosed mistake can be retried with a twin');
  c.eq((await sealed(twin.data.question.id))._twinOf, uev.eventId, 'the twin is sealed with the mistake it retries');
  c.ok(!('_twinOf' in twin.data.question) && !('twinOf' in twin.data.question), 'and the device is not told it as a field of the question');
  const twinRoot = solveLinearPrompt(twin.data.question.prompt).root;
  c.eq((await submit(a.jar, twin.data.question.id, twinRoot)).data.correct, true, 'the twin is answered right');
  c.eq((await eventOf(twin.data.question.id)).twinOf, uev.eventId, 'its graded attempt names the mistake it retried');
  const book2 = (await notebookOf(a.jar)).notebook;
  const fixed = itemOf(book2, uev.eventId);
  c.deq([fixed.fixed, fixed.retries, fixed.review.dueAt], [true, 1, null], 'and the mistake is fixed: no longer scheduled');
  c.eq(book2.total, 3, 'a right twin is not itself a mistake');
  c.eq((await post('/v1/practice/notebook/not-a-uuid/twin', {}, a.jar)).status, 404, 'a malformed entry id is not found');
  c.eq((await post(`/v1/practice/notebook/${(await eventOf(cq.id)).eventId}/twin`, {}, a.jar)).status, 404, 'a right answer has no twin: it is not in the notebook');

  // Every plan, every account its own.
  const pq = (await issue(p.jar, PERCENT, 4242)).data.question;
  const ptrap = (await sealed(pq.id)).traps.find(x => x.value !== undefined);
  await submit(p.jar, pq.id, ptrap.value);
  await submit(p.jar, pq.id, ptrap.value);
  const pbook = await notebookOf(p.jar);
  c.deq([pbook.notebook.total, Object.keys(pbook).sort(), Object.keys(pbook.notebook).sort()], [1, ['entries', 'notebook'], ['dueCount', 'groups', 'nextDueAt', 'shown', 'total']],
    'Premium gets the same notebook, in the same shape: no plan field, nothing held back on either plan');
  c.deq((await notebookOf(o.jar)).notebook.total, 0, 'another account sees nothing of these');
  c.eq((await post(`/v1/practice/notebook/${uev.eventId}/twin`, {}, o.jar)).status, 404, 'nor can it draw a twin of them');

  // The Postgres runner only counts a suite that says which engine it ran on.
  console.log(`engine: ${h.engine}`);
  console.log(`MISTAKE NOTEBOOK: PASS — ${c.count()}/${c.count()} checks — every wrong resolution is filed with the step check's first broken line, any mistake can be retried, a right twin fixes it, review widens 1-3-7-14-30 days, and the notebook is the same on every plan.`);
} catch (error) {
  console.error(error);
  console.log('MISTAKE NOTEBOOK: FAIL');
  process.exitCode = 1;
} finally {
  await h.close();
}
