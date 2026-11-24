// ───────────────────────────────────────────────────────────────────────────────
// Pri Learning · method marks paid by a scheme, over the real submit path (R4)
//
// Boots the shipped /v1 app as Prithagoras (switch off in phase 1, on in phase 2), approves the seven types IN THIS TEST PROCESS ONLY, and
// issues, submits and reads real replies:
//
//   PHASE 1  the switch OFF (PRI_METHOD_MARKS unset; Prithagoras stays in editionMarking.js UNCERTIFIED_EDITIONS throughout): a listed
//            type's question is stamped with its scheme, and nothing is paid: the reply is main's reply (the final answer only), shows no scheme criteria,
//            no method row, no scheme field and no reason code.
//   PHASE 2  the switch ON, author-approved tier (owner decision 24 Nov 2026; no certifyEditionForTests, no examiner variable):
//            · a listed question whose marks are the scheme's marks is paid by the scheme, from the lines the page ticks, and says so
//            · a listed question whose marks are NOT the scheme's (y12-explogcalc: 3 marks) is sealed final-answer-only at issue, so
//              the generic rubric never runs on it: 0 where the control (the generic rubric, run on the same question) would pay
//   Every listed type, every difficulty, seeds 1..60: each question is either stamped with its scheme (marks equal) or sealed
//   final-answer-only, never neither.
//
//   node server/test/method-marks-scheme-http-check.mjs
// SYNTHETIC: generated questions and a scripted client. Not evidence about real students or an examiner.
// ───────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_OFFERING', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_FREE_PRACTICE_PER_DAY', 'PRI_EDITION', 'PRI_METHOD_MARKS', 'PRI_METHOD_MARKS_EXAMINER_RESULT', 'PRI_QBANK_DIR'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-scheme-http-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'c3'.repeat(32);
process.env.PRI_FREE_PRACTICE_PER_DAY = '100000';
delete process.env.PRI_METHOD_MARKS;
process.env.PRI_EDITION = 'prithagoras';
process.env.PRI_OFFERING = 'catalogue';
process.env.PRI_QBANK_DIR = 'off';   // this suite is about the generator types' schemes; the author bank is sealed final-answer-only (qbank-sealed-check.mjs)
delete process.env.PRI_METHOD_MARKS_EXAMINER_RESULT;
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const G = await import('../../client/src/engine/generators/index.js');
const { nswCell } = await import('../platform/nswBanks.js');
const { SCHEMES, schemeDigest, schemeMarks, schemeTypeOf, approveSchemeTypesForTests } = await import('../platform/schemeAward.js');
const { editionMarkingPolicy } = await import('../platform/editionMarking.js');
const { sealForEdition, bankPolicy, FINAL_ANSWER_MARKING } = await import('../platform/editionBanks.js');
const { marksPossibleFor, MARKER_OPS } = await import('../platform/markerOps.js');
const { TYPES } = await import('../../tools/method-marks-drafts.mjs');
const R = await import('../../tools/method-marks-ready.mjs');
await G.loadAllBanks();

const LIST = SCHEMES.map(s => ({ typeId: s.id, digest: schemeDigest(s) }));
approveSchemeTypesForTests(LIST);
const c = checks();
const finalOf = lines => { const l = lines[lines.length - 1] || ''; return l.includes('=') ? l.slice(l.lastIndexOf('=') + 1).trim() : l.trim(); };

// ── every listed type is stamped or sealed, never neither ─────────────────────────────────────────────────────────
{
  let n = 0, stamped = 0, sealedFinal = 0, neither = 0, mismatchStamped = 0;
  for (const s of SCHEMES) for (const fam of s.families) for (let d = 1; d <= 4; d++) for (let seed = 1; seed <= 60; seed++) {
    let q; try { q = G.generateQuestion(fam, d, seed); } catch { continue; }
    if (!q || schemeTypeOf(q, fam) !== s.id || !nswCell(fam, d)) continue;
    const copy = JSON.parse(JSON.stringify({ ...q, _generator: fam }));
    if (!sealForEdition(copy, bankPolicy('prithagoras'), fam)) continue;
    n++;
    if (copy._methodScheme) { stamped++; if (marksPossibleFor(copy) !== schemeMarks(s)) mismatchStamped++; }
    if (copy._marking === FINAL_ANSWER_MARKING) sealedFinal++;
    if (!copy._methodScheme && copy._marking !== FINAL_ANSWER_MARKING) neither++;
  }
  c.ok(n >= 150 && stamped > 0 && sealedFinal > 0, `${n} issued questions of the seven types: ${stamped} stamped with their scheme, ${sealedFinal} sealed final-answer-only`);
  c.eq(neither, 0, 'no listed question is left for the generic rubric (neither stamped nor sealed): 0');
  c.eq(mismatchStamped, 0, 'no question is stamped with a scheme whose marks are not its marks: 0');
}

// ── pick one question that pays and one that does not, of listed types the server issues ──────────────────────────
const pick = async match => {
  for (const s of SCHEMES) {
    const type = TYPES.find(t => t.id === s.id);
    for (const fam of s.families) for (let d = 1; d <= 4; d++) for (let seed = 1; seed <= 60; seed++) {
      let q; try { q = G.generateQuestion(fam, d, seed); } catch { continue; }
      if (!q || schemeTypeOf(q, fam) !== s.id || !nswCell(fam, d) || (marksPossibleFor(q) === schemeMarks(s)) !== match || (!match && marksPossibleFor(q) < 3)) continue;
      const pages = await R.pagesFor(type, q);
      for (const page of pages) {
        const answer = page.answer ?? finalOf(page.lines);
        if (match) { if (page.source === 'draft-partial') return { scheme: s, generator: fam, difficulty: d, seed, lines: page.lines, answer }; continue; }
        // A page the generic rubric, switched on, would pay: what the seal must prevent.
        const generic = MARKER_OPS.practice({ q, answer, working: page.lines.join('\n'), evidenceIfWrong: true, policy: { methodMarks: true, scheme: 'method-marks' } }, () => {});
        if (generic.result.correct === false && generic.evidence?.partial?.awarded >= 1) return { scheme: s, generator: fam, difficulty: d, seed, lines: page.lines, answer };
      }
    }
  }
  return null;
};
const paying = await pick(true);
const sealedOne = (await pick(false));
c.ok(paying && sealedOne, `a paying question (${paying?.generator} D${paying?.difficulty} seed ${paying?.seed}) and a non-paying one (${sealedOne?.generator} D${sealedOne?.difficulty} seed ${sealedOne?.seed}) exist`);

const h = await startApp({ engine: requestedEngine() });
try {
  const a = await registerAccount(h, { email: 'scheme.http@example.test', deviceId: 'ipad-scheme-http' });
  c.eq((await verifyEmail(h, a.account.id)).status, 200, 'a verified student');
  const issue = body => h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body: { curriculum: 'nsw', ...body } });
  const submit = (qid, id, answer, steps) => h.request(`/v1/practice/${qid}/submit`, { method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': id }, body: { submissionId: id, answer, mode: 'typed', steps } });
  const sealedOf = async qid => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=?", [a.account.id, qid])).response_json);
  const run = async (p, tag) => {
    const r = await issue({ generator: p.generator, difficulty: p.difficulty, seed: p.seed });
    c.eq(r.status, 201, `${tag}: issued`);
    const qid = r.data.question.id;
    const sealed = await sealedOf(qid);
    const one = await submit(qid, `${tag}-1`, p.answer, p.lines.join('\n'));
    const two = one.data.resolved ? one : await submit(qid, `${tag}-2`, p.answer, p.lines.join('\n'));
    return { sealed, reply: two.data, qid };
  };
  const final = reply => JSON.stringify(reply.solution?.criteria) === JSON.stringify([{ mark: reply.marksPossible, text: 'Correct final answer' }]);
  const clean = reply => !reply.methodCriteria && !reply.methodScheme && !('reason' in (reply.methodScheme || {})) && !JSON.stringify(reply).includes('criteria-count') && !JSON.stringify(reply).includes('type-not-approved') && !JSON.stringify(reply).includes('MARKER_POLICY');

  // PHASE 1: uncertified
  c.eq(editionMarkingPolicy(process.env).methodMarks, false, 'phase 1: Prithagoras is uncertified: the edition policy is final answer only, with the switch off');
  const p1 = await run(paying, 'phase1-pay');
  c.eq(p1.sealed._methodScheme, paying.scheme.id, 'phase 1: the question is stamped with its scheme (listed, marks equal)');
  c.ok(p1.sealed._marking === undefined, 'phase 1: and not sealed final-answer-only');
  c.deq([p1.reply.resolved, p1.reply.marksEarned, p1.reply.partial ?? null], [true, 0, null], 'phase 1: nothing is paid (the final answer is wrong)');
  c.ok(clean(p1.reply) && final(p1.reply) && !p1.reply.markRows?.method, 'phase 1: no scheme criteria, no method row, no scheme field, no reason code; the solution states one criterion');

  // PHASE 2: certified (test hook)
  process.env.PRI_METHOD_MARKS = 'on';
  c.eq(editionMarkingPolicy(process.env).methodMarks, false, 'phase 2: the generic method rubric stays off on Prithagoras even with the switch on (no certification)');
  const p2 = await run(paying, 'phase2-pay');
  const credited = p2.reply.methodCriteria;
  c.ok(credited && credited.typeId === paying.scheme.id && credited.digest === schemeDigest(paying.scheme) && credited.items.length === paying.scheme.criteria.length, 'phase 2: the reply carries the scheme\'s criteria');
  c.ok(p2.reply.marksEarned === credited.items.reduce((n, i) => n + (i.awarded ? i.marks : 0), 0) && p2.reply.marksEarned < p2.reply.marksPossible, `phase 2: the mark is the table's total (${p2.reply.marksEarned} of ${p2.reply.marksPossible}) and a wrong answer is not full`);
  c.ok(credited.items.filter(i => i.awarded && i.basis === 'lines').every(i => i.lines.length > 0 && i.lines.every(n => p2.reply.stepReport.lines[n - 1]?.status === 'ok')), 'phase 2: every criterion earned by lines points at lines the page ticks');
  c.deq(p2.reply.methodScheme, { typeId: paying.scheme.id, paid: true }, 'phase 2: the reply says the scheme paid, and nothing more');
  c.deq(p2.reply.solution.criteria, credited.items.map(i => ({ mark: i.marks, text: i.text })), 'phase 2: the solution shows the scheme criteria, because the scheme paid');
  c.ok(!JSON.stringify(p2.reply).includes('reason":"criteria-count'), 'phase 2: no reason code reaches the client');
  const p3 = await run(sealedOne, 'phase2-sealed');
  c.eq(p3.sealed._marking, FINAL_ANSWER_MARKING, 'phase 2: a listed type whose marks are not the scheme\'s is sealed final-answer-only at issue');
  c.ok(p3.sealed._methodScheme === undefined, 'phase 2: and carries no scheme');
  c.deq([p3.reply.resolved, p3.reply.marksEarned, p3.reply.partial ?? null], [true, 0, null], 'phase 2: it earns nothing for a wrong answer, however good the working');
  c.ok(clean(p3.reply) && final(p3.reply) && !p3.reply.markRows?.method, 'phase 2: main\'s reply exactly: one criterion, no method row, no scheme field');
  // CONTROL: the generic rubric, switched on, WOULD have paid that same question (it is what the seal prevents)
  const bare = { ...p3.sealed }; delete bare._marking; delete bare._methodScheme;
  const control = MARKER_OPS.practice({ q: bare, answer: sealedOne.answer, working: sealedOne.lines.join('\n'), evidenceIfWrong: true, policy: { methodMarks: true, scheme: 'method-marks' } }, () => {});
  c.ok(control.result.correct === false && control.evidence.partial?.awarded >= 1, `control: the same answer is wrong, and the generic rubric WOULD pay ${control.evidence.partial?.awarded ?? 0} for the same working (${sealedOne.generator} D${sealedOne.difficulty}): the seal is what prevents it`);
} finally {
  await h.close();
}
rmSync(scratch, { recursive: true, force: true });
for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
console.log(`engine: ${h.engine}`);
console.log(`METHOD MARKS SCHEME OVER HTTP: PASS: ${c.count()}/${c.count()} checks`);
