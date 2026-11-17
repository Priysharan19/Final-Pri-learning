// Pri Learning · the tutor policy over real HTTP (POST /v1/practice/:id/help-plan)
//
//   dark          404 unless PRI_FEATURE_TUTOR_POLICY=1
//   credit        the same question, the same rungs and the same answer give
//                 byte-identical marks, credit and receipt fields with the
//                 policy and its experiment on and off; asking for a plan
//                 charges nothing and opens no rung
//   experiment    the control arm gets plan: null and spends no line check;
//                 each graded attempt carries the account's arm, recomputable
//                 from the definition; with no experiment active the event has
//                 no experiment field at all
//   recognition   an unconfirmed reading is answered "confirm the reading",
//                 and no line check runs on it
//   provenance    a served plan is recorded on the graded attempt
//                 (policyAssistance), so it is never read as independent
//   boundaries    another account's question 404, a completed one 409, a
//                 closed body
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'pri-tutor-policy-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '6b'.repeat(32);
process.env.PRI_FEATURE_LINE_CHECK = '1';
delete process.env.PRI_FEATURE_TUTOR_POLICY;
delete process.env.PRI_EXPERIMENTS;
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { assignArm, experimentById } = await import('../platform/experiments.js');
const { causeFromWork, buildHelpPlan, helpPlanBodyError } = await import('../platform/helpPlan.js');
console.log(`engine: ${requestedEngine()}`);
const h = await startApp({ engine: requestedEngine() });
let count = 0;
const eq = (a, b, name) => { assert.deepEqual(a, b, name); count++; };
const ok = (cond, name) => { assert.ok(cond, name); count++; };
const post = (path, body, jar, headers = {}) => h.request(path, { method: 'POST', jar, body, headers });
const issue = (jar, seed) => post('/v1/practice/issue', { generator: LINEAR, difficulty: 2, seed, curriculum: 'in' }, jar);
const sealed = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?", [id])).response_json);
const eventOf = async id => { const row = await h.db.get("SELECT payload_json FROM learning_events WHERE kind='graded-attempt' AND entity_id=?", [id]); return row ? JSON.parse(row.payload_json) : null; };
const plan = (jar, id, body = {}) => post(`/v1/practice/${id}/help-plan`, body, jar);
const hint = (jar, id, rung) => post(`/v1/practice/${id}/hint`, { rung }, jar);
const hintLevelRow = async id => h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='practice-hints' AND key=?", [id]);
const lineChecks = async () => Number((await h.db.get("SELECT count(*) AS n FROM rate_limits WHERE bucket LIKE 'line-check:%'")).n);
let n = 0;
const grade = (jar, id, answer) => { const sid = `tutor-policy-${String(++n).padStart(4, '0')}`; return post(`/v1/practice/${id}/submit`, { submissionId: sid, answer: String(answer), mode: 'typed', ms: 42000 }, jar, { 'Idempotency-Key': sid }); };
const LINEAR = 'c8-linear-equations-both-sides';
const TUTOR = experimentById('tutor-first-help-v1');
// The receipt and event fields that are the mark and the credit.
const RECEIPT = r => ({ correct: r.correct, resolved: r.resolved, marksEarned: r.marksEarned, marksPossible: r.marksPossible, hintLevel: r.hintLevel, markWeight: r.markWeight, creditedMarks: r.creditedMarks, triesLeft: r.triesLeft });
const VOLATILE = new Set(['attemptId', 'submissionId', 'questionId', 'serverAcknowledgedAt', 'createdAt', 'contentId']);
const shapeOf = o => Object.keys(o).filter(k => !VOLATILE.has(k)).sort();
const marksOf = e => ({ correct: e.correct, marksEarned: e.marksEarned, marksPossible: e.marksPossible, hintLevel: e.hintLevel, hintRungs: e.hintRungs, markWeight: e.markWeight, creditedMarks: e.creditedMarks, hintsUsed: e.hintsUsed, hintHelpUnits: e.hintHelpUnits, support: e.support, mode: e.mode, subtopic: e.subtopic, difficulty: e.difficulty });

// One run: issue seed, open `rungs` rungs (asking for a plan before each when
// `asks`), answer correctly. Returns the receipt and the event.
async function run(jar, seed, { rungs = 1, asks = false } = {}) {
  const q = await issue(jar, seed);
  assert.equal(q.status, 201, `issue ${seed}`);
  const id = q.data.question.id;
  const key = await sealed(id);
  const plans = [];
  for (let i = 0; i < rungs; i++) {
    if (asks) plans.push((await plan(jar, id, { helpRequested: true, offered: plans.map(p => p.data.plan?.action).filter(Boolean) })));
    await hint(jar, id, ['nudge', 'method', 'worked'][i]);
  }
  const r = await grade(jar, id, key.answer.value);
  return { id, receipt: r.data, event: await eventOf(id), plans };
}

try {
  // Accounts until there is one in each arm of the tutor experiment.
  const accounts = [];
  for (let i = 0; i < 40 && !(accounts.some(a => a.arm === 'control') && accounts.filter(a => a.arm === 'policy').length >= 2); i++) {
    const a = await registerAccount(h, { email: `policy.${i}@example.test`, deviceId: `ipad-policy-${i}` });
    assert.equal((await verifyEmail(h, a.account.id)).status, 200);
    accounts.push({ ...a, arm: assignArm(TUTOR, a.account.id) });
  }
  const P = accounts.find(a => a.arm === 'policy');
  const C = accounts.find(a => a.arm === 'control');
  const O = accounts.find(a => a !== P && a !== C) || await (async () => { const a = await registerAccount(h, { email: 'policy.other@example.test', deviceId: 'ipad-policy-other' }); await verifyEmail(h, a.account.id); return a; })();
  const P2 = accounts.find(a => a.arm === 'policy' && a !== P);
  ok(P && C && P2, 'an account in the control arm and two in the policy arm');

  // ── Dark by default ──────────────────────────────────────────────────────
  const q0 = await issue(P.jar, 4100);
  const dark = await plan(P.jar, q0.data.question.id, { helpRequested: true });
  eq([dark.status, dark.data.error?.code], [404, 'NOT_FOUND'], 'with PRI_FEATURE_TUTOR_POLICY unset the route is 404');
  process.env.PRI_FEATURE_TUTOR_POLICY = 'true';
  eq((await plan(P.jar, q0.data.question.id, {})).status, 404, 'only an explicit 1 turns it on');
  delete process.env.PRI_FEATURE_TUTOR_POLICY;

  // ── Credit with everything off (the baseline) ────────────────────────────
  const off = await run(P.jar, 4242, { rungs: 2 });
  eq([off.receipt.correct, off.receipt.hintLevel, off.receipt.markWeight], [true, 2, 0.7], 'baseline: correct, two rungs, 70% weight');
  ok(!('experiment' in off.event) && !('policyAssistance' in off.event), 'baseline event has no experiment or policy field');

  // ── Everything on: the flag and the experiment ───────────────────────────
  process.env.PRI_FEATURE_TUTOR_POLICY = '1';
  process.env.PRI_EXPERIMENTS = 'tutor-first-help-v1';
  // The same content for another account in the policy arm would be fresh
  // work; use a twin account in the same arm if there is one, else a new seed
  // of the same generator on P with the same rungs: the credit rule is per
  // question, so the comparison is between the two receipts' mark fields.
  const on = await run(P.jar, 4343, { rungs: 2, asks: true });
  eq(RECEIPT(on.receipt), { ...RECEIPT(off.receipt), marksEarned: on.receipt.marksPossible, marksPossible: on.receipt.marksPossible, creditedMarks: Math.round(on.receipt.marksPossible * 0.7 * 100) / 100 },
    'policy on: the same rungs give the same weight and credit rule');
  eq(shapeOf(on.receipt), shapeOf(off.receipt), 'the submit receipt has exactly the same fields');
  eq(marksOf({ ...on.event, marksEarned: off.event.marksEarned, marksPossible: off.event.marksPossible, creditedMarks: off.event.creditedMarks }), marksOf(off.event), 'the graded event carries the same ladder evidence');
  eq(shapeOf(on.event).filter(k => k !== 'experiment' && k !== 'policyAssistance'), shapeOf(off.event), 'the event differs only by the experiment and policy fields');
  eq(on.plans.map(p => [p.status, p.data.plan?.action, p.data.plan?.rung, p.data.plan?.charges]), [[200, 'nudge', 'nudge', true], [200, 'method', 'method', true]], 'the plans pointed at the next rung each time');
  eq(on.event.experiment, { assignments: [{ id: 'tutor-first-help-v1', version: 1, arm: 'policy' }], family: LINEAR, ms: 42000 }, 'the event carries the arm, the item family and the time');
  eq(on.event.policyAssistance, [{ action: 'nudge', level: 'A3' }, { action: 'method', level: 'A4' }], 'and the offers, so it is assisted evidence');
  const reqRow = await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='practice-help-plan' AND key=?", [on.id]);
  ok(!!reqRow, 'the offers are kept under the account\'s practice-help-plan scope');

  // Same seed, same rungs, same answer on two fresh accounts: identical marks.
  {
    delete process.env.PRI_FEATURE_TUTOR_POLICY; delete process.env.PRI_EXPERIMENTS;
    const a = await run(P2.jar, 5555, { rungs: 1 });
    process.env.PRI_FEATURE_TUTOR_POLICY = '1'; process.env.PRI_EXPERIMENTS = 'tutor-first-help-v1';
    const b = await run(P.jar, 5555, { rungs: 1, asks: true });
    eq(RECEIPT(b.receipt), RECEIPT(a.receipt), 'one seed, one rung: byte-identical mark fields, flag off vs on');
  }

  // Asking for a plan charges nothing and opens no rung.
  const q1 = await issue(P.jar, 4444);
  const id1 = q1.data.question.id;
  const p1 = await plan(P.jar, id1, { helpRequested: true });
  eq([p1.status, p1.data.plan.action, p1.data.plan.level, p1.data.experiment], [200, 'nudge', 'A3', { id: 'tutor-first-help-v1', arm: 'policy' }], 'a plan: the next rung, with its level and arm');
  eq(await hintLevelRow(id1), undefined, 'asking for a plan opens no rung');
  ok(!('hint' in p1.data) && !('markWeight' in p1.data.plan), 'and serves no hint text and states no weight');
  eq(p1.data.plan.reason.key, 'tutorPolicy.reason.unseen.rung', 'with its plain reason, claiming nothing about working it has not seen');
  ok(!('envelope' in p1.data.plan), 'the envelope (with its cause class) stays on the server');
  const nudge1 = await hint(P.jar, id1, 'nudge');
  eq([nudge1.data.level, nudge1.data.markWeight], [1, 0.9], 'the rung is charged by the hint route, exactly as before');

  // Escalation, then the spent ladder.
  eq((await plan(P.jar, id1, { helpRequested: true, offered: ['nudge'] })).data.plan.action, 'method', 'asked again: one step up');
  await hint(P.jar, id1, 'method'); await hint(P.jar, id1, 'worked');
  const spent = await plan(P.jar, id1, { helpRequested: true, offered: ['nudge', 'method', 'worked'] });
  eq([spent.data.plan.action, spent.data.plan.reason.key], ['keep-going', 'tutorPolicy.reason.ladderSpent'], 'with only the solution left the plan never offers it');

  // Recognition: confirm the reading, no line check.
  const before = await lineChecks();
  const q2 = await issue(P.jar, 4545);
  const rec = await plan(P.jar, q2.data.question.id, { helpRequested: true, recognition: 'unconfirmed', lines: ['6m + 5 = m - 10'] });
  eq([rec.data.plan.action, rec.data.plan.rung, rec.data.plan.charges, rec.data.plan.prompt.key, rec.data.lineCheckSpent], ['confirm-reading', null, false, 'tutorPolicy.prompt.confirmReading', false], 'an unconfirmed reading: confirm it, no maths hint');
  eq(await lineChecks(), before, 'and no line check runs on an unconfirmed reading');

  // A final-answer attempt in the lines: the policy cannot verify it and says so.
  const fin = await plan(P.jar, q2.data.question.id, { helpRequested: true, lines: ['6m + 5 = m - 10', 'm = -3'] });
  eq([fin.data.plan.action, fin.data.plan.reason.key, fin.data.lineCheckSpent], ['nudge', 'tutorPolicy.reason.unverified', false], 'final-answer lines: unverified, the question\'s own hint, nothing charged');

  // The line check's guards apply to the plan's lines: the per-question cap
  // and the daily tutor allowance, peeked before any check runs.
  {
    const { sha256 } = await import('../platform/security.js');
    const qa = await issue(P.jar, 5050);
    const ida = qa.data.question.id;
    await h.db.run('INSERT INTO rate_limits(bucket, window_start, count) VALUES (?,?,?)', [`line-check:${sha256(`${P.account.id}:${ida}`).slice(0, 32)}`, Date.now(), 2]);
    const capped = await plan(P.jar, ida, { helpRequested: true, lines: ['6m + 5 = m - 10', '5m + 5 = -10'] });
    eq([capped.data.plan.reason.key, capped.data.lineCheckSpent], ['tutorPolicy.reason.unverified', false], 'two line checks used: the plan cannot check, says so, spends nothing');
    const lc = await post('/v1/practice/' + ida + '/hint', { rung: 'nudge', lines: ['6m + 5 = m - 10'] }, P.jar);
    eq(lc.data.work, { status: 'limit' }, 'and the nudge\'s line check is still capped');
    const qb = await issue(P.jar, 5151);
    const dayBucket = `tutor-day:${sha256(P.account.id).slice(0, 24)}`;
    const before2 = await lineChecks();
    await h.db.run('INSERT INTO rate_limits(bucket, window_start, count) VALUES (?,?,?) ON CONFLICT(bucket) DO UPDATE SET window_start=excluded.window_start, count=excluded.count', [dayBucket, Date.now(), 100000]);
    const spentDay = await plan(P.jar, qb.data.question.id, { helpRequested: true, lines: ['6m + 5 = m - 10', '5m + 5 = -10'] });
    eq([spentDay.data.plan.reason.key, spentDay.data.lineCheckSpent, await lineChecks()], ['tutorPolicy.reason.unverified', false, before2], 'the daily tutor allowance spent: no check runs and none is charged');
    await h.db.run('DELETE FROM rate_limits WHERE bucket = ?', [dayBucket]);
  }

  // ── The control arm ──────────────────────────────────────────────────────
  const checksBefore = await lineChecks();
  const qc = await issue(C.jar, 4646);
  const pc = await plan(C.jar, qc.data.question.id, { helpRequested: true, lines: ['6m + 5 = m - 10', '5m + 5 = -10'] });
  eq([pc.status, pc.data.plan, pc.data.experiment], [200, null, { id: 'tutor-first-help-v1', arm: 'control' }], 'control arm: no plan — today\'s ladder');
  eq(await lineChecks(), checksBefore, 'and no line check is spent for it');
  const ctrl = await run(C.jar, 4747, { rungs: 1, asks: true });
  eq(ctrl.event.experiment.assignments, [{ id: 'tutor-first-help-v1', version: 1, arm: 'control' }], 'the control account\'s attempts carry its arm');
  eq(ctrl.event.policyAssistance, [{ action: null, level: null }], 'and the help REQUEST is recorded in the control arm too (so the outcome exclusion is the same in both arms)');
  eq(ctrl.receipt.markWeight, 0.9, 'and the ladder charges as always');

  // ── Flag on, experiment off: everyone gets the plan, events are unstamped ─
  delete process.env.PRI_EXPERIMENTS;
  const qn = await issue(C.jar, 4848);
  const pn = await plan(C.jar, qn.data.question.id, { helpRequested: true });
  eq([pn.data.experiment, pn.data.plan.action], [null, 'nudge'], 'no experiment: the plan for every account, no arm');
  const free = await run(C.jar, 4949, { rungs: 0 });
  ok(!('experiment' in free.event), 'and no experiment field on the event');

  // ── Boundaries ───────────────────────────────────────────────────────────
  const foreign = await plan(O.jar, qn.data.question.id, { helpRequested: true });
  eq([foreign.status, foreign.data.error?.code], [404, 'QUESTION_NOT_FOUND'], 'another account\'s question is 404');
  eq((await plan(C.jar, '00000000-0000-4000-8000-000000000000', {})).status, 404, 'an unknown question is 404');
  eq((await plan(C.jar, free.id, { helpRequested: true })).data.error?.code, 'QUESTION_ALREADY_GRADED', 'a completed question is 409');
  for (const [body, why] of [[{ rung: 'nudge' }, 'an unknown field'], [{ offered: ['solution'] }, 'an action off the menu'], [{ lines: Array(41).fill('x') }, 'too many lines'],
    [{ recognition: 'maybe' }, 'a bad recognition state'], [{ helpRequested: 'yes' }, 'a non-boolean flag']]) {
    eq((await plan(C.jar, qn.data.question.id, body)).data.error?.code, 'HELP_PLAN_INVALID', `400 for ${why}`);
  }

  // ── The cause from the server's own line check ───────────────────────────
  eq(causeFromWork({ charge: true, code: 'arithmetic-slip', reply: { status: 'break', verifiedLines: 1, line: 2 } }, { linesSent: true }), { class: 'arithmetic', line: 2, confidence: 'high' }, 'a Step Check arithmetic slip → arithmetic at its line');
  eq(causeFromWork({ charge: true, code: 'sign-on-transfer', reply: { status: 'break', verifiedLines: 0, line: 1 } }, { linesSent: true }).class, 'concept', 'a named misconception → concept');
  eq(causeFromWork({ charge: true, code: 'counterexample', reply: { status: 'break', verifiedLines: 0, line: 1 } }, { linesSent: true }).class, 'unverified', 'a bare counterexample → unverified');
  eq(causeFromWork({ charge: true, code: null, reply: { status: 'break', verifiedLines: 0, line: 3 } }, { linesSent: true }).class, 'unverified', 'a break with no code → unverified');
  eq(causeFromWork({ charge: true, lineCount: 2, reply: { status: 'held', verifiedLines: 2 } }, { linesSent: true }).class, 'none', 'every line held → no break');
  eq(causeFromWork({ charge: true, lineCount: 3, reply: { status: 'held', verifiedLines: 2 } }, { linesSent: true }).class, 'unverified', 'some lines held, not all → unverified, never "holds"');
  eq(['limit', 'unchecked', 'final', 'unread'].map(status => causeFromWork({ status }, { linesSent: true }).class), ['unverified', 'unverified', 'unverified', 'unverified'], 'a check that did not run or could not judge → unverified');
  eq(causeFromWork(null, { linesSent: true, checkRan: false }).class, 'unverified', 'lines with the line check switched off → unverified');
  eq(causeFromWork(null, { linesSent: false }).class, 'unseen', 'no lines → unseen: nothing claimed');
  eq(causeFromWork({ charge: true, code: 'sign-on-transfer', reply: { status: 'break', line: 1 } }, { recognition: 'low-confidence', linesSent: true }).class, 'recognition', 'a doubtful reading outranks any diagnosis');

  // ── The see-why view: only for a break on a line the device can draw ─────
  const concept = { class: 'concept', line: 3, confidence: 'high' };
  const pick = body => buildHelpPlan({ q: { subtopic: LINEAR, _practiceMode: 'practice' }, hintLevel: 0, attempts: [], cause: concept, body }).plan.action;
  eq(pick({ mistakeGraph: true, drawable: [3] }), 'mistake-graph', 'the break\'s line is drawable: the picture');
  eq(pick({ mistakeGraph: true, drawable: [2, 4] }), 'nudge', 'another line is drawable, not the break\'s: no picture');
  eq(pick({ mistakeGraph: true }), 'nudge', 'no drawable list: no picture');
  eq(pick({ mistakeGraph: false, drawable: [3] }), 'nudge', 'the view not on: no picture');
  eq([helpPlanBodyError({ drawable: [1] }), helpPlanBodyError({ drawable: ['3'] }), helpPlanBodyError({ drawable: [2, 41] }), helpPlanBodyError({ drawable: [2, 3] })].map(Boolean), [true, true, true, false], 'drawable is a list of line numbers 2–40');
  eq((await plan(C.jar, qn.data.question.id, { drawable: [1] })).data.error?.code, 'HELP_PLAN_INVALID', 'and a bad list is 400 over HTTP');

  console.log(`TUTOR POLICY HTTP: PASS — ${count}/${count} checks`);
} finally {
  delete process.env.PRI_FEATURE_TUTOR_POLICY;
  delete process.env.PRI_EXPERIMENTS;
  await h.close?.();
  rmSync(scratch, { recursive: true, force: true });
}
