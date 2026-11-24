// ───────────────────────────────────────────────────────────────────────────────
// Pri Learning · the generic step-mark rule over the real submit path (R4)
//
// Boots the shipped /v1 app as Prithagoras and approves the generic rule IN THIS TEST PROCESS ONLY (approveSchemeTypesForTests; the repository's
// list stays empty and no author record is written). Issues, submits and reads real replies:
//
//   PHASE 1  switch OFF: the question is stamped with the rule at issue and nothing is paid: main's reply, no criteria, no method row, no scheme field
//   PHASE 2  switch ON (author-approved tier, no examiner variable): correct method and a wrong final answer is paid 2 of 3 from the lines the page
//            ticks, the reply carries the criteria table and says the rule paid; a right answer is 3 of 3; the same question issued while the rule is
//            NOT approved is sealed final-answer-only and earns 0
//
//   node server/test/generic-solution-steps-http-check.mjs
// SYNTHETIC: generated questions and a scripted client. Not evidence about real students.
// ───────────────────────────────────────────────────────────────────────────────
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
const { approveSchemeTypesForTests, APPROVED_SCHEME_TYPES } = await import('../platform/schemeAward.js');
const { GENERIC_ID, genericDigest, authoredLines } = await import('../platform/genericSteps.js');
const { FINAL_ANSWER_MARKING } = await import('../platform/editionBanks.js');
await G.loadAllBanks();

const c = checks();
const REPO_LIST = APPROVED_SCHEME_TYPES;
c.ok(!REPO_LIST.some(a => a.typeId === GENERIC_ID), 'the repository\'s own list does not contain the generic rule');
const GEN = 'y12-appdiff', D = 3, SEED = 1;
const q0 = G.generateQuestion(GEN, D, SEED);
const texts = authoredLines(q0).map(l => l.text);
const wrongLines = texts.slice(0, -1).concat('h(6)=1042');
const rightLines = texts;

const h = await startApp({ engine: requestedEngine() });
try {
  const a = await registerAccount(h, { email: 'generic.http@example.test', deviceId: 'ipad-generic-http' });
  c.eq((await verifyEmail(h, a.account.id)).status, 200, 'a verified student');
  const issue = body => h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body: { curriculum: 'nsw', ...body } });
  const submit = (qid, id, answer, steps) => h.request(`/v1/practice/${qid}/submit`, { method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': id }, body: { submissionId: id, answer, mode: 'typed', steps } });
  const sealedOf = async qid => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=?", [a.account.id, qid])).response_json);
  const run = async (lines, answer, tag) => {
    const r = await issue({ generator: GEN, difficulty: D, seed: SEED });
    c.eq(r.status, 201, `${tag}: issued`);
    const qid = r.data.question.id;
    const sealed = await sealedOf(qid);
    const one = await submit(qid, `${tag}-1`, answer, lines.join('\n'));
    const two = one.data.resolved ? one : await submit(qid, `${tag}-2`, answer, lines.join('\n'));
    return { sealed, reply: two.data };
  };
  const clean = reply => !reply.methodCriteria && !reply.methodScheme && !JSON.stringify(reply).includes('criteria-count') && !JSON.stringify(reply).includes('type-not-approved') && !JSON.stringify(reply).includes('generic-');

  // the rule approved in this process only
  approveSchemeTypesForTests([{ typeId: GENERIC_ID, digest: genericDigest() }]);

  // PHASE 1: switch off
  const p1 = await run(wrongLines, '1042', 'phase1');
  c.eq(p1.sealed._methodScheme, GENERIC_ID, 'phase 1: the question is stamped with the rule at issue');
  c.ok(p1.sealed._marking === undefined, 'phase 1: and not sealed final-answer-only');
  c.deq([p1.reply.resolved, p1.reply.marksEarned], [true, 0], 'phase 1: with the switch off nothing is paid');
  c.ok(clean(p1.reply) && !p1.reply.markRows?.method, 'phase 1: no criteria, no method row, no scheme field, no reason code');

  // PHASE 2: switch on
  process.env.PRI_METHOD_MARKS = 'on';
  const p2 = await run(wrongLines, '1042', 'phase2');
  const cr = p2.reply.methodCriteria;
  c.ok(cr && cr.typeId === GENERIC_ID && cr.digest === genericDigest() && cr.items.length === 3, 'phase 2: the reply carries the rule\'s three criteria at its digest');
  c.eq(p2.reply.marksEarned, 2, 'phase 2: correct method, wrong final answer: 2 of 3');
  c.eq(p2.reply.marksPossible, 3, 'phase 2: out of 3');
  c.ok(cr.items.reduce((n, i) => n + (i.awarded ? i.marks : 0), 0) === p2.reply.marksEarned && !cr.items.find(i => i.key === 'answer').awarded, 'phase 2: the mark is the table\'s total and the answer criterion is not earned');
  c.ok(cr.items.filter(i => i.awarded && i.basis === 'lines').every(i => i.lines.length > 0 && i.lines.every(n => p2.reply.stepReport.lines[n - 1]?.status === 'ok')), 'phase 2: every step earned points at lines the page ticks');
  c.deq(p2.reply.methodScheme, { typeId: GENERIC_ID, paid: true }, 'phase 2: the reply says the rule paid, and nothing more');
  c.deq(p2.reply.solution.criteria, cr.items.map(i => ({ mark: i.marks, text: i.text })), 'phase 2: the solution shows the criteria, because the rule paid');
  c.ok(!JSON.stringify(p2.reply).includes('reason":"criteria-count') && !JSON.stringify(p2.reply).includes('generic-no-usable'), 'phase 2: no reason code reaches the client');
  const p3 = await run(rightLines, '147', 'phase2-right');
  c.eq(p3.reply.marksEarned, 3, 'phase 2: a right answer is 3 of 3');
  const p4 = await run([], '1042', 'phase2-none');
  c.eq(p4.reply.marksEarned, 0, 'phase 2: a wrong answer with no working is 0');

  // the same question while the rule is NOT approved: sealed final-answer-only, earns nothing for working
  approveSchemeTypesForTests(REPO_LIST);
  const p5 = await run(wrongLines, '1042', 'phase2-unapproved');
  c.eq(p5.sealed._marking, FINAL_ANSWER_MARKING, 'unapproved: the question is sealed final-answer-only at issue');
  c.ok(p5.sealed._methodScheme === undefined && p5.reply.marksEarned === 0 && clean(p5.reply), 'unapproved: it carries no scheme, earns 0 and shows main\'s reply');
} finally {
  await h.close();
}
rmSync(scratch, { recursive: true, force: true });
for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
console.log(`engine: ${h.engine}`);
console.log(`GENERIC SOLUTION STEPS OVER HTTP: PASS: ${c.count()}/${c.count()} checks`);
