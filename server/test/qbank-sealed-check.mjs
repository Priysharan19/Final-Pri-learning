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
} finally {
  await h.close();
  for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
  fs.rmSync(scratch, { recursive: true, force: true });
}
console.log(`QBANK SEALED: PASS — ${c.count()}/${c.count()} checks over ${entries.length} questions`);
process.exit(0);
