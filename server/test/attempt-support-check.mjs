// Pri Learning · what help a server-graded attempt had (`support`, v2), over
// real HTTP, decided from the server's own records of the question.
//
//   independent     first try, no help of any kind → independent, hintsUsed 0
//   after-feedback  wrong first try, right second → after-feedback ('retry')
//   supported       a hint rung · tutor help served on the issued question ·
//                   a line check or step-coach reading that ran · a tutor
//                   policy request / shown cause kind (PR #996's scope) · a
//                   repeat of content whose solution was already shown
//   revealed        Show solution, and the ladder's last rung
//   refused help    a tutor request that served nothing records nothing
//   the device      cannot claim a support value (the body is closed); it may
//                   only declare help it showed offline (deviceHelp: true)
//   old records     events without supportVersion are left as written, and
//                   every reader keeps them supported
//   editions        the same derivation on a Priyabhata and a Prithagoras bank
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'pri-attempt-support-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '6b'.repeat(32);
process.env.PRI_FEATURE_TUTOR = '1';
process.env.PRI_FREE_PRACTICE_PER_DAY = '100000';
delete process.env.PRI_HANDWRITING_API_KEY;   // the tutor is on but has no provider: refusals are real
delete process.env.PRI_TUTOR_ENDPOINT;
delete process.env.PRI_PUBLIC_ORIGIN;
(await import('../platform/indiaBanks.js')).allowBanksOutsideIndiaForTests();
// The suite issues questions by (skill, seed) and solves them from the prompt it knows: the skill's direct form
// (client/test/support/direct-forms.mjs). The other forms are marked by the sweeps over all issued questions.
(await import('../../client/src/engine/generators/index.js')).directFormsOnly(true);
const { startApp, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const S = await import('../platform/attemptSupport.js');
const { isSupported } = await import('../../client/src/engine/progressTruth.js');
const { effectiveHelp } = await import('../../client/src/platform/cloudSyncRestore.js');
console.log(`engine: ${requestedEngine()}`);
const h = await startApp({ engine: requestedEngine() });
let count = 0;
const eq = (a, b, name) => { assert.deepEqual(a, b, name); count++; };
const ok = (cond, name) => { assert.ok(cond, name); count++; };
const post = (path, body, jar, headers = {}) => h.request(path, { method: 'POST', jar, body, headers });
const IN = 'c8-linear-equations-both-sides';          // Priyabhata
const AU = 'y7-decimals-perc';                        // Prithagoras (NSW bank)
const issue = (jar, generator, seed) => post('/v1/practice/issue', { generator, difficulty: 2, seed, curriculum: generator === IN ? 'in' : 'nsw' }, jar);
const sealed = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?", [id])).response_json);
const eventOf = async id => { const row = await h.db.get("SELECT payload_json FROM learning_events WHERE kind='graded-attempt' AND entity_id=?", [id]); return row ? JSON.parse(row.payload_json) : null; };
let n = 0;
const grade = (jar, id, answer, extra = {}) => { const sid = `support-${String(++n).padStart(4, '0')}`; return post(`/v1/practice/${id}/submit`, { submissionId: sid, answer: String(answer), mode: 'typed', ...extra }, jar, { 'Idempotency-Key': sid }); };
const view = e => [e.support, e.supportSources, e.supportVersion, e.hintsUsed];
const wrongFor = q => String(Number(q.answer.value) + 7919);

try {
  const a = await registerAccount(h, { email: 'support.a@example.test', deviceId: 'ipad-support-a' });
  eq((await verifyEmail(h, a.account.id)).status, 200, 'a verified account');
  const fresh = async (gen, seed) => { const r = await issue(a.jar, gen, seed); assert.equal(r.status, 201, `issue ${gen} ${seed}`); return { id: r.data.question.id, q: await sealed(r.data.question.id) }; };

  for (const [edition, gen, base] of [['Priyabhata', IN, 9100], ['Prithagoras', AU, 9200]]) {
    // ── independent ────────────────────────────────────────────────────────
    const ind = await fresh(gen, base + 1);
    eq((await grade(a.jar, ind.id, ind.q.answer.value)).data.correct, true, `${edition}: a right first answer`);
    eq(view(await eventOf(ind.id)), ['independent', [], 2, 0], `${edition}: first try, no help → independent, hintsUsed 0`);

    // ── after feedback ─────────────────────────────────────────────────────
    const af = await fresh(gen, base + 2);
    const first = await grade(a.jar, af.id, wrongFor(af.q));
    eq([first.data.correct, first.data.resolved], [false, false], `${edition}: a wrong first try leaves it open`);
    eq((await grade(a.jar, af.id, af.q.answer.value)).data.correct, true, `${edition}: right on the second`);
    eq(view(await eventOf(af.id)), ['after-feedback', ['retry'], 2, 0], `${edition}: re-submitted after a verdict → after-feedback`);

    // ── supported: a hint rung ──────────────────────────────────────────────
    const hinted = await fresh(gen, base + 3);
    await post(`/v1/practice/${hinted.id}/hint`, { rung: 'nudge' }, a.jar);
    await grade(a.jar, hinted.id, hinted.q.answer.value);
    eq(view(await eventOf(hinted.id)), ['supported', ['hint'], 2, 1], `${edition}: a nudge → supported, one help unit`);

    // ── revealed ────────────────────────────────────────────────────────────
    const rev = await fresh(gen, base + 4);
    eq((await post(`/v1/practice/${rev.id}/reveal`, {}, a.jar)).data.revealed, true, `${edition}: Show solution`);
    eq(view(await eventOf(rev.id)).slice(0, 3), ['revealed', ['reveal'], 2], `${edition}: a reveal → revealed`);
  }

  // ── supported: tutor help served on the issued question ────────────────────
  const tut = await fresh(IN, 9301);
  const open = await post('/v1/tutor/help', { context: 'practice', level: 'diagnose', locale: 'en', serverQuestionId: tut.id, studentWork: { lines: ['6m + 5 = m - 10'] } }, a.jar);
  eq(open.status, 200, 'an open-question diagnosis is served (engine only)');
  await grade(a.jar, tut.id, tut.q.answer.value);
  eq(view(await eventOf(tut.id)), ['supported', ['tutor'], 2, 0], 'tutor help served → supported, from the server\'s own marker');

  // A request that served nothing (no provider configured) records nothing.
  const refused = await fresh(IN, 9302);
  const nudge = await post('/v1/tutor/help', { context: 'practice', level: 'nudge', locale: 'en', serverQuestionId: refused.id, studentWork: { lines: [] } }, a.jar);
  eq(nudge.status, 503, 'a nudge with no provider is refused');
  await grade(a.jar, refused.id, refused.q.answer.value);
  eq((await eventOf(refused.id)).support, 'independent', 'refused tutor help is not help');

  // Another account's tutor call cannot mark this account's question.
  const b = await registerAccount(h, { email: 'support.b@example.test', deviceId: 'ipad-support-b' });
  await verifyEmail(h, b.account.id);
  const mine = await fresh(IN, 9303);
  eq((await post('/v1/tutor/help', { context: 'practice', level: 'diagnose', locale: 'en', serverQuestionId: mine.id, studentWork: { lines: ['x'] } }, b.jar)).status, 404, 'another account\'s tutor call on this question is 404');
  await grade(a.jar, mine.id, mine.q.answer.value);
  eq((await eventOf(mine.id)).support, 'independent', 'and marks nothing');

  // ── supported: line check, step coach, tutor-policy request / cause shown ──
  const seed = async (bucket, idx) => { const q = await fresh(IN, 9400 + idx); await h.db.run('INSERT INTO rate_limits(bucket, window_start, count) VALUES (?,?,?)', [bucket(a.account.id, q.id), Date.now(), 1]); return q; };
  const lc = await seed(S.lineCheckBucket, 1);
  await grade(a.jar, lc.id, lc.q.answer.value);
  eq(view(await eventOf(lc.id)), ['supported', ['line-check'], 2, 0], 'a line check that ran → supported');
  const sc = await seed(S.stepCoachBucket, 2);
  await grade(a.jar, sc.id, sc.q.answer.value);
  eq(view(await eventOf(sc.id)), ['supported', ['step-coach'], 2, 0], 'a step-coach reading → supported');
  const hp = await fresh(IN, 9403);
  await h.db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-help-plan',?,?,?,?,?)",
    [a.account.id, hp.id, JSON.stringify({ served: [{ action: 'self-check', level: 'A2', causeShown: true }] }), 'x', Date.now(), Date.now() + 1e9]);
  await grade(a.jar, hp.id, hp.q.answer.value);
  eq(view(await eventOf(hp.id)), ['supported', ['help-plan', 'cause-shown'], 2, 0], 'a tutor-policy request with a shown cause kind → supported (light assistance)');

  // ── durable: bucket rows swept by housekeeping do not erase the help ──────
  const swept = await fresh(IN, 9410);
  await h.db.run('INSERT INTO rate_limits(bucket, window_start, count) VALUES (?,?,?)', [S.lineCheckBucket(a.account.id, swept.id), Date.now(), 1]);
  await S.markHelp(h.db, a.account.id, swept.id, 'line-check');
  await h.db.run('DELETE FROM rate_limits WHERE bucket LIKE ?', ['line-check:%']);
  await grade(a.jar, swept.id, swept.q.answer.value);
  eq(view(await eventOf(swept.id)).slice(0, 2), ['supported', ['line-check']], 'a line check stays on the record after its rate-limit row is swept');
  const sweptCoach = await fresh(IN, 9411);
  await S.markHelp(h.db, a.account.id, sweptCoach.id, 'step-coach');
  await grade(a.jar, sweptCoach.id, sweptCoach.q.answer.value);
  eq(view(await eventOf(sweptCoach.id)).slice(0, 2), ['supported', ['step-coach']], 'and so does a step-coach reading, with no bucket row at all');

  // ── help on one copy follows the content to another copy ──────────────────
  const copyA = await fresh(IN, 9420);
  await post(`/v1/practice/${copyA.id}/hint`, { rung: 'nudge' }, a.jar);
  const copyB = await fresh(IN, 9420);
  eq(copyB.id === copyA.id, false, 'a second copy of the same content is a different question');
  await grade(a.jar, copyB.id, copyB.q.answer.value);
  const evB = await eventOf(copyB.id);
  eq([evB.support, evB.supportSources], ['supported', ['help-on-copy']], 'a hint opened on another copy makes this one supported (help-on-copy)');

  // ── supported: a repeat of content whose solution was already shown ───────
  const shown = await fresh(IN, 9501);
  await post(`/v1/practice/${shown.id}/reveal`, {}, a.jar);
  const again = await fresh(IN, 9501);
  await grade(a.jar, again.id, again.q.answer.value);
  const rep = await eventOf(again.id);
  eq([rep.repeat, rep.support, rep.supportSources], [true, 'supported', ['solution-seen']], 'the same content after its solution was shown → supported');

  // ── revealed beats everything; a ladder reveal keeps its hints ───────────
  const ladder = await fresh(IN, 9601);
  for (const rung of ['nudge', 'method', 'worked', 'solution']) await post(`/v1/practice/${ladder.id}/hint`, { rung }, a.jar);
  eq(view(await eventOf(ladder.id)).slice(0, 3), ['revealed', ['reveal', 'hint'], 2], 'the solution rung → revealed, with the hints it had');

  // ── the device cannot claim support ───────────────────────────────────────
  const claim = await fresh(IN, 9701);
  eq((await grade(a.jar, claim.id, claim.q.answer.value, { support: 'independent' })).status, 400, 'a submission naming support is refused: the body is closed');

  // ── help the device declares (offline tutor fallback): one way only ──────
  const dh = await fresh(IN, 9702);
  await grade(a.jar, dh.id, dh.q.answer.value, { deviceHelp: true });
  eq(view(await eventOf(dh.id)), ['supported', ['device-help'], 2, 0], 'deviceHelp: true → supported (it can only lower the claim)');
  const dhFalse = await fresh(IN, 9703);
  eq((await grade(a.jar, dhFalse.id, dhFalse.q.answer.value, { deviceHelp: false })).status, 400, 'deviceHelp: false is refused — the device can never claim independence');

  // ── old records are left as they are, and read as supported ──────────────
  const old = { correct: true, hintsUsed: 1, support: 'supported', subtopic: IN };
  await h.db.run(`INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at)
    VALUES (?,?,?,'server-grader',?,'graded-attempt',?,?,?,?)`, [999999, '00000000-0000-4000-8000-0000000000aa', a.account.id, 999999, 'old-q', 1, JSON.stringify(old), 1]);
  const kept = JSON.parse((await h.db.get("SELECT payload_json FROM learning_events WHERE id='00000000-0000-4000-8000-0000000000aa'")).payload_json);
  eq(kept, old, 'an event written before support version 2 is not rewritten');
  ok(isSupported(kept) && !('supportVersion' in kept), 'and a reader keeps it supported ("help unknown" was never independent)');

  // ── readers of the four values ────────────────────────────────────────────
  eq(['independent', 'after-feedback', 'supported', 'revealed'].map(support => isSupported({ support, correct: true })), [false, true, true, true], 'only independent is on your own');
  eq(['independent', 'after-feedback', 'supported'].map(support => effectiveHelp({ support, hintsUsed: 0 }).tries), [0, 1, 1], 'restore credits a try to after-feedback as to supported');

  // ── the pure rule ─────────────────────────────────────────────────────────
  eq(S.deriveSupport({}), { support: 'independent', supportSources: [], supportVersion: 2 }, 'nothing → independent');
  eq(S.deriveSupport({ priorTries: 1, hintLevel: 1 }).support, 'supported', 'help outranks a retry');
  eq(S.deriveSupport({ revealed: true }).support, 'revealed', 'a reveal outranks everything');
  eq(S.deriveSupport({ solutionSeen: true }).support, 'supported', 'an exam repeat of seen content is supported');
  eq(S.NOT_INDEPENDENT, ['after-feedback', 'supported', 'revealed'], 'three values are help');

  console.log(`ATTEMPT SUPPORT: PASS — ${count}/${count} checks`);
} finally {
  await h.close?.();
  rmSync(scratch, { recursive: true, force: true });
}
