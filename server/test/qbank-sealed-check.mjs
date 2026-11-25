// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the author question bank is sealed final-answer-only, whatever the method-mark lists say
//
// The author approved step marks for named generator question types and for the generic solution-step rule. He has not approved them for
// his own bank's questions. With PRI_METHOD_MARKS=on and EVERY scheme (and the generic rule) approved, no packed question is stamped with
// a per-type scheme or the generic rule, and a wrong answer on one, even with the author's own worked lines as the working, earns 0.
// Not evidence about real students.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const keys = ['NODE_ENV', 'PRI_OFFERING', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_FREE_PRACTICE_PER_DAY', 'PRI_EDITION', 'PRI_QBANK_DIR', 'PRI_METHOD_MARKS'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'pri-qbank-sealed-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = path.join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'c5'.repeat(32);
process.env.PRI_FREE_PRACTICE_PER_DAY = '1000000';
process.env.PRI_EDITION = 'prithagoras';
process.env.PRI_OFFERING = 'catalogue';
process.env.PRI_METHOD_MARKS = 'on';
delete process.env.PRI_QBANK_DIR;

const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const qb = await import('../platform/qbankPack.js');
const { bankPolicy, sealForEdition, FINAL_ANSWER_MARKING } = await import('../platform/editionBanks.js');
const { SCHEMES, schemeDigest, approvedSchemeTypes, approveSchemeTypesForTests } = await import('../platform/schemeAward.js');
const { GENERIC_ID, genericDigest } = await import('../platform/genericSteps.js');
const { BANK_ID, bankDigest, bankEligible, bankAuthoredLines } = await import('../platform/bankSteps.js');
const { productPlaceOf } = await import('../platform/qbankDotpoints.js');
const { dotpointById } = await import('../../client/src/engine/curriculum.js');
const { acceptedInput, trapInput, authoredPage } = await import('../../tools/qbank-import.mjs');

const c = checks();
const pack = await qb.ensureQbank(process.env, { strict: true });
c.ok(pack && pack.questionCount > 1500, 'the committed pack loads');
const manifest = JSON.parse(fs.readFileSync(path.join(qb.DEFAULT_PACK_DIR, 'manifest.json'), 'utf8'));
const entries = [];
for (const s of manifest.shards) for (const e of JSON.parse(fs.readFileSync(path.join(qb.DEFAULT_PACK_DIR, s.name), 'utf8')).questions) entries.push({ ...e, family: s.name.replace(/^shards\/|\.json$/g, '') });

const repoList = approvedSchemeTypes();
const everything = [...SCHEMES.map(s => ({ typeId: s.id, digest: schemeDigest(s) })), { typeId: GENERIC_ID, digest: genericDigest() }];
c.ok(repoList.length > 0, `the repository's own approved list is in force (${repoList.length} types)`);
const lists = [['the repository list', repoList], ['every scheme and the generic rule approved', everything]];
for (const [name, list] of lists) {
  let stamped = 0, sealed = 0, noMarking = 0;
  for (const e of entries) {
    const q = JSON.parse(JSON.stringify(qb.qbankEntryQuestion(e.id, 17)));
    q._generator = q.subtopic;
    const ok = sealForEdition(q, { ...bankPolicy('prithagoras'), methodSchemeTypes: list });
    if (!ok) { noMarking++; continue; }
    if (q._methodScheme !== undefined) stamped++;
    if (q._marking === FINAL_ANSWER_MARKING) sealed++;
  }
  c.eq(noMarking, 0, `${name}: every packed question seals`);
  c.eq(stamped, 0, `${name}: none of the ${entries.length} packed questions is stamped with a scheme or the generic rule`);
  c.eq(sealed, entries.length, `${name}: every one is sealed final-answer-only`);
}

// The bank rule (bankSteps.js, approval id `bank-author-criteria`) is the ONE rule that may pay a bank question, and only once the author files his own
// record for it. Unapproved (the repository default) nothing above changes. Approved in this test list alone, exactly the parts that passed its
// import-time proof are stamped with it; every other part, and every worked-solution question, is still sealed final-answer-only.
{
  const bankList = [{ typeId: BANK_ID, digest: bankDigest() }];
  let stamped = 0, sealedRest = 0, stampedNotEligible = 0, refused = 0;
  for (const e of entries) {
    const q = JSON.parse(JSON.stringify(qb.qbankEntryQuestion(e.id, 17)));
    q._generator = q.subtopic;
    if (!sealForEdition(q, { ...bankPolicy('prithagoras'), methodSchemeTypes: bankList })) refused++;
    if (q._methodScheme === BANK_ID) { stamped++; if (!bankEligible(q)) stampedNotEligible++; if (q._marking !== undefined) stampedNotEligible++; }
    else if (q._marking === FINAL_ANSWER_MARKING && q._methodScheme === undefined) sealedRest++;
  }
  c.eq(refused, 0, 'every bank question seals with the bank rule approved');
  c.eq(stampedNotEligible, 0, 'the bank rule stamps only a part that passed its proof, and never also seals it');
  c.eq(stamped + sealedRest, entries.length, 'with the bank rule approved every packed question is stamped with it or sealed final-answer-only');
  c.ok(stamped > 0 && stamped < entries.length, `with the bank rule approved ${stamped} of ${entries.length} are stamped`);
  const stale = [{ typeId: BANK_ID, digest: '0'.repeat(64) }];
  let staleStamped = 0;
  for (const e of entries) { const q = JSON.parse(JSON.stringify(qb.qbankEntryQuestion(e.id, 17))); q._generator = q.subtopic; sealForEdition(q, { ...bankPolicy('prithagoras'), methodSchemeTypes: stale }); if (q._methodScheme !== undefined) staleStamped++; }
  c.eq(staleStamped, 0, 'the bank rule at a stale digest stamps nothing');
}

// Over the real routes, every scheme approved: a wrong answer, with the author's own worked lines as the working, earns nothing.
approveSchemeTypesForTests(everything);
const h = await startApp({ engine: requestedEngine() });
try {
  let a = null, used = 0, acct = 0;
  const fresh = async () => { acct++; a = await registerAccount(h, { email: `qbank.sealed${acct}@example.test`, deviceId: `ipad-qbank-sealed-${acct}` }); await verifyEmail(h, a.account.id); used = 0; };
  await fresh();
  let seed = 5000;
  const call = async (p, body, headers = {}) => { if (p.endsWith('/issue')) used++; return h.request(p, { method: 'POST', jar: a.jar, headers, body }); };
  const wrongable = entries.filter(e => e.traps.some(t => trapInput(t) !== null));
  let tested = 0, zero = 0, schemeless = 0;
  for (let i = 0; tested < 40 && i < 4000; i++) {
    if (used >= 80) await fresh();
    const pick = wrongable[(i * 37) % wrongable.length];
    const place = productPlaceOf(pick.family, pick.dp);
    if (!place) continue;
    const dp = place.ordinal === null ? null : dotpointById(`${place.subtopic}.${place.ordinal + 1}`);
    const asked = dp && dp.forms.includes(pick.level) ? { dotpoint: dp.id } : {};
    const r = await call('/v1/practice/issue', { curriculum: 'nsw', generator: place.subtopic, difficulty: pick.level, ...asked, seed: (seed += 7919) % 0x7fffffff });
    if (r.status !== 201) continue;
    const row = await h.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=?", [a.account.id, r.data.question.id]);
    const sealedQ = JSON.parse(row.response_json);
    if (typeof sealedQ._bank !== 'string') continue;
    const e = entries.find(x => x.id === sealedQ._bank);
    const t = e.traps.find(x => trapInput(x) !== null);
    if (!t) continue;
    tested++;
    if (sealedQ._methodScheme === undefined && sealedQ._marking === FINAL_ANSWER_MARKING) schemeless++;
    const lines = authoredPage(qb.qbankEntryQuestion(e.id, 17));
    const w = await call(`/v1/practice/${r.data.question.id}/submit`, { submissionId: `sealed-${i}-a`, answer: trapInput(t), steps: lines, mode: 'typed' }, { 'Idempotency-Key': `sealed-${i}-a` });
    const w2 = await call(`/v1/practice/${r.data.question.id}/submit`, { submissionId: `sealed-${i}-b`, answer: trapInput(t), steps: lines, mode: 'typed' }, { 'Idempotency-Key': `sealed-${i}-b` });
    if (w.data.correct === false && (w.data.marksEarned ?? 0) === 0 && (w2.data.marksEarned ?? 0) === 0 && w2.data.correct === false) zero++;
  }
  c.eq(tested, 40, 'forty bank questions drawn through the real routes with every scheme approved');
  c.eq(schemeless, tested, 'each is stored final-answer-only with no scheme');
  c.eq(zero, tested, 'a wrong answer with the author\'s own worked lines earns 0 on each');
  // The bank rule approved in this process alone: a stamped, eligible part pays his criteria over the real routes; a wrong answer is never N.
  approveSchemeTypesForTests([{ typeId: BANK_ID, digest: bankDigest() }]);
  let paid = 0, drawn = 0;
  const eligibleEntries = entries.filter(e => e.marks >= 2 && bankEligible(qb.qbankEntryQuestion(e.id, 17)));
  c.ok(eligibleEntries.length > 100, `the pack holds ${eligibleEntries.length} parts that pass the bank rule's proof`);
  for (let i = 0; paid < 6 && i < 3000 && used < 78; i++) {
    const pick = eligibleEntries[(i * 53) % eligibleEntries.length];
    const place = productPlaceOf(pick.family, pick.dp);
    if (!place || pick.marks < 2) continue;
    const dp = place.ordinal === null ? null : dotpointById(`${place.subtopic}.${place.ordinal + 1}`);
    const asked = dp && dp.forms.includes(pick.level) ? { dotpoint: dp.id } : {};
    // a seed whose draw is this very part (the mix rule is the seed's alone, qbankPack.qbankDraw)
    let found = null;
    for (let t = 0; t < 600 && found === null; t++) { const s2 = (seed += 7919) % 0x7fffffff; if (qb.qbankDraw(place.subtopic, pick.level, s2 >>> 0, asked.dotpoint ?? null)?._bank === pick.id) found = s2; }
    if (found === null) continue;
    const r = await call('/v1/practice/issue', { curriculum: 'nsw', generator: place.subtopic, difficulty: pick.level, ...asked, seed: found });
    if (r.status !== 201) continue;
    const row = await h.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=?", [a.account.id, r.data.question.id]);
    const sealedQ = JSON.parse(row.response_json);
    if (sealedQ._methodScheme !== BANK_ID) continue;
    drawn++;
    const qq = qb.qbankEntryQuestion(sealedQ._bank, 17);
    const lines = bankAuthoredLines(qq).map(l => l.text);
    const go = k => call(`/v1/practice/${r.data.question.id}/submit`, { submissionId: `bank-sealed-${i}-${k}`, answer: '99991', steps: lines.join('\n'), mode: 'typed' }, { 'Idempotency-Key': `bank-sealed-${i}-${k}` });
    const first = await go(1);
    const w = first.data.resolved ? first : await go(2);
    c.eq(w.data.correct, false, 'a wrong answer on a bank question stamped with the bank rule is wrong');
    c.ok((w.data.marksEarned ?? 0) < w.data.marksPossible, 'and never earns full marks');
    if (w.data.methodScheme?.paid === true) {
      paid++;
      c.eq(w.data.methodCriteria.typeId, BANK_ID, 'the reply names the bank rule');
      c.eq(w.data.methodCriteria.digest, bankDigest(), 'at the digest the code computes');
      c.deq(w.data.methodCriteria.items.map(x => x.text), qq.criteria.map(x => x.point), 'its table lists his criteria in his words');
      c.eq(w.data.methodCriteria.items.reduce((n, x) => n + (x.awarded ? x.marks : 0), 0), w.data.marksEarned, 'the table equals the marks');
    }
  }
  c.ok(drawn > 0 && paid > 0, `the bank rule paid ${paid} of ${drawn} eligible parts drawn through the real routes`);
} finally {
  await h.close();
  for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
  fs.rmSync(scratch, { recursive: true, force: true });
}
console.log(`QBANK SEALED: PASS — ${c.count()}/${c.count()} checks over ${entries.length} questions`);
process.exit(0);
