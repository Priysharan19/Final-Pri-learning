// ───────────────────────────────────────────────────────────────────────────────
// Pri Learning · the lines Pri proves true are DISPLAY ONLY over the real submit path (R4)
//
// Boots the shipped /v1 app as Prithagoras with the generic step-mark rule approved IN THIS PROCESS ONLY and method marks on, issues a Year 11 question
// and submits a wrong final answer with true working that carries lines the proved-line pass ticks (a solution list, a labelled substitution): the reply's
// page shows those lines ticked, and the mark, the criteria and the lines they point at are exactly what the deterministic report (proved lines
// switched off) pays.
//
//   node server/test/proved-lines-http-check.mjs
// SYNTHETIC: generated questions and a scripted client. Not evidence about real students.
// ────────────────────────────────────────────────────────────────────────�
import './support/hermetic.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_OFFERING', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_FREE_PRACTICE_PER_DAY', 'PRI_EDITION', 'PRI_METHOD_MARKS', 'PRI_METHOD_MARKS_EXAMINER_RESULT'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-generic-http-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'c4'.repeat(32);
process.env.PRI_FREE_PRACTICE_PER_DAY = '100000';
delete process.env.PRI_METHOD_MARKS;
process.env.PRI_EDITION = 'prithagoras';
process.env.PRI_OFFERING = 'catalogue';
delete process.env.PRI_METHOD_MARKS_EXAMINER_RESULT;
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const G = await import('../../client/src/engine/generators/index.js');
const { approveSchemeTypesForTests } = await import('../platform/schemeAward.js');
const { GENERIC_ID, genericDigest } = await import('../platform/genericSteps.js');
await G.loadAllBanks();
const G2 = G;
const CASES = [
  { gen: 'me11-poly', d: 2, seed: 5, lines: ['P(x) = x^3 + ax^2 + bx - 1', 'P(1) = 0: 1 + a + b - 1 = 0', 'a + b = 0'], tick: 1 },
  { gen: 'y11-trig-ident', d: 2, seed: 11, lines: ['cosθ = √2/2', 'θ = 45°, -45°'], tick: 1 }
];
const { stepEvidence, marksPossibleFor, practiceMarksEarned } = await import('../platform/markerOps.js');
const { schemePay } = await import('../platform/schemeAward.js');
const { checkAnswer } = await import('../../client/src/engine/checker.js');
const { genericEligible } = await import('../platform/genericSteps.js');
const c = checks();
approveSchemeTypesForTests([{ typeId: GENERIC_ID, digest: genericDigest() }]);
process.env.PRI_METHOD_MARKS = 'on';
const h = await startApp({ engine: requestedEngine() });
try {
  const a = await registerAccount(h, { email: 'proved.http@example.test', deviceId: 'ipad-proved-http' });
  c.eq((await verifyEmail(h, a.account.id)).status, 200, 'a verified student');
  const issue = body => h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body: { curriculum: 'nsw', ...body } });
  const submit = (qid, id, answer, steps) => h.request(`/v1/practice/${qid}/submit`, { method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': id }, body: { submissionId: id, answer, mode: 'typed', steps } });
  let shownTicks = 0;
  for (const k of CASES) {
    const q0 = G2.generateQuestion(k.gen, k.d, k.seed);
    const r = await issue({ generator: k.gen, difficulty: k.d, seed: k.seed });
    c.eq(r.status, 201, `${k.gen}: issued`);
    const qid = r.data.question.id;
    const one = await submit(qid, `${k.gen}-1`, '99991', k.lines.join('\n'));
    const two = one.data.resolved ? one : await submit(qid, `${k.gen}-2`, '99991', k.lines.join('\n'));
    const reply = two.data;
    c.eq(reply.resolved, true, `${k.gen}: resolved`);
    const shown = reply.stepReport && reply.stepReport.lines && reply.stepReport.lines[k.tick];
    if (shown && shown.status === 'ok') shownTicks++;
    c.ok(shown && shown.status !== 'break', `${k.gen}: the true line is never crossed on the page`);
    // what the deterministic report (the proved lines switched off) pays for the same page
    const q = { ...q0, _methodScheme: genericEligible(q0) ? GENERIC_ID : undefined };
    const result = checkAnswer(q, '99991');
    const ev = stepEvidence(q, '99991', k.lines.join('\n'), result, { slipWarnings: true, proved: false });
    const N = marksPossibleFor(q);
    const pay = schemePay({ q, report: ev.stepReport || null, topic: ev.topicTicks ?? null, correct: false, marksPossible: N, env: { PRI_METHOD_MARKS: 'on', PRI_EDITION: 'prithagoras' }, list: [{ typeId: GENERIC_ID, digest: genericDigest() }] });
    const expected = q._methodScheme && pay.paid ? practiceMarksEarned(q, result, { ...ev, partial: pay.partial }, N) : 0;
    c.eq(reply.marksEarned, expected, `${k.gen}: the mark is what the report without the proved lines pays (${expected})`);
    if (reply.methodCriteria) c.ok(reply.methodCriteria.items.every(i => i.lines.every(n => ev.stepReport.lines[n - 1]?.status === 'ok')), `${k.gen}: every earned criterion points at a line the deterministic report ticks`);
  }
  c.ok(shownTicks >= 1, `the page shows a proved line ticked over HTTP (${shownTicks} of ${CASES.length})`);
} finally {
  await h.close();
}
rmSync(scratch, { recursive: true, force: true });
for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
console.log(`PROVED LINES OVER HTTP: PASS: ${c.count()}/${c.count()} checks`);
