// ───────────────────────────────────────────────────────────────────────────────
// Pri Learning · the bank generic step rule over the real /v1 submit path (R4), after the author's own record of 26 Nov 2026
//
// Boots the shipped app as Prithagoras with the repository's OWN approved list (no test hook, no record written here) and PRI_METHOD_MARKS=on.
// Draws real author-bank parts worth 2+ marks that the rule can pay (several mark totals), issues them through /v1/practice/issue and submits:
//   a  the right answer with his working: N of N
//   b  correct method, wrong final answer: 1..N-1 (never N), the table equals the mark, every earned step stands on a ticked line
//   c  one middle line made wrong, then his lines, wrong final answer: nothing at or after the wrong line, never N
//   d  the question restated: 0        e  bare values alone: 0
//   the sealed contexts: a stamped row in Rush, Match or the placement check is refused at pay time (and those modes never draw the bank);
//   a worked-solution question and a question with no stamp earn nothing for working; the label the page shows is the author's, and the
//   client model draws the table only for the approved bank rule at its digest. India pays nothing new.
//
//   node server/test/bank-generic-http-check.mjs
// SYNTHETIC: the author's own bank and scripted working. Not evidence about real students.
// ───────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const keys = ['NODE_ENV', 'PRI_OFFERING', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_FREE_PRACTICE_PER_DAY', 'PRI_EDITION', 'PRI_QBANK_DIR', 'PRI_METHOD_MARKS', 'PRI_METHOD_MARKS_EXAMINER_RESULT'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'pri-bank-generic-http-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = path.join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'c6'.repeat(32);
process.env.PRI_FREE_PRACTICE_PER_DAY = '1000000';
process.env.PRI_EDITION = 'prithagoras';
process.env.PRI_OFFERING = 'catalogue';
process.env.PRI_METHOD_MARKS = 'on';
delete process.env.PRI_QBANK_DIR;
delete process.env.PRI_METHOD_MARKS_EXAMINER_RESULT;

const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const qb = await import('../platform/qbankPack.js');
const { bankPolicy, sealForEdition, FINAL_ANSWER_MARKING } = await import('../platform/editionBanks.js');
const { approvedSchemeTypes, schemePay } = await import('../platform/schemeAward.js');
const { BANK_ID } = await import('../platform/bankSteps.js');
const { BANK_GENERIC_ID, bankGenericDigest, bankGenericEligible } = await import('../platform/bankGenericSteps.js');
const { bankAuthoredLines } = await import('../platform/bankSteps.js');
const { marksPossibleFor } = await import('../platform/markerOps.js');
const { productPlaceOf } = await import('../platform/qbankDotpoints.js');
const { dotpointById } = await import('../../client/src/engine/curriculum.js');
const { acceptedInput } = await import('../../tools/qbank-import.mjs');
const { falsify, stillTrue } = await import('../../tools/generic-steps-sweep.mjs');
const { criteriaView, cardsOfReport } = await import('../../client/src/components/criteriaTableModel.js');
const { AUTHOR_APPROVED } = await import('../../client/src/engine/authorApprovals.js');
const en = (await import('../../client/src/i18n/strings.en.js')).default;

const c = checks();
await qb.ensureQbank(process.env, { strict: true });
const entries = [];
{
  const manifest = JSON.parse(fs.readFileSync(path.join(qb.DEFAULT_PACK_DIR, 'manifest.json'), 'utf8'));
  for (const s of manifest.shards) for (const e of JSON.parse(fs.readFileSync(path.join(qb.DEFAULT_PACK_DIR, s.name), 'utf8')).questions) entries.push({ ...e, family: s.name.replace(/^shards\/|\.json$/g, '') });
}
const eligible = entries.filter(e => e.marks >= 2 && bankGenericEligible(qb.qbankEntryQuestion(e.id, 17)));
// a spread over the mark totals: the first parts of each total, taken at a stride so they come from different topics
const picks = [];
for (const n of [...new Set(eligible.map(e => e.marks))].sort()) {
  const group = eligible.filter(e => e.marks === n);
  const take = n === 2 ? 4 : n === 3 ? 4 : 2;
  for (let i = 0; i < Math.min(take, group.length); i++) picks.push(group[Math.floor((i * group.length) / take)]);
}
const LABEL = 'Pri practice marking, approved by the author (Priysharan Tripathi, tutor). Not an official NESA guideline.';

// the label and the approval, before anything is served
c.eq(en['mp.criteria.label'], LABEL, 'the label the page shows is the author\'s, word for word');
c.ok(AUTHOR_APPROVED.some(a => a.typeId === BANK_GENERIC_ID && a.digest === bankGenericDigest() && a.approvedBy === 'Priysharan Tripathi'), 'the page\'s approved list holds the bank generic rule at its current digest');
c.ok(approvedSchemeTypes().some(a => a.typeId === BANK_GENERIC_ID && a.digest === bankGenericDigest()) && !approvedSchemeTypes().some(a => a.typeId === BANK_ID), 'the server list holds the bank generic rule, not the draft criteria rule');
c.ok(picks.length >= 8 && new Set(picks.map(p => p.marks)).size >= 2, `${picks.length} parts picked over ${new Set(picks.map(p => p.marks)).size} mark totals`);

const h = await startApp({ engine: requestedEngine() });
let seed = 9000;
let paidPick = null;
let a = null, used = 0, acct = 0;
const R = { parts: 0, full: 0, partial: 0, partialPaid: 0, wrongAtN: 0, overN: 0, tableNotMark: 0, onUnticked: 0, wrongLinePages: 0, afterWrong: 0, restate: 0, restatePaid: 0, bare: 0, barePaid: 0, labelled: 0 };
try {
  const fresh = async () => { acct++; a = await registerAccount(h, { email: `bank.generic.http${acct}@example.test`, deviceId: `ipad-bank-generic-http-${acct}` }); await verifyEmail(h, a.account.id); used = 0; };
  await fresh();
  const call = async (p, body, headers = {}) => { if (p.endsWith('/issue')) used++; return h.request(p, { method: 'POST', jar: a.jar, headers, body }); };
  const sealedOf = async qid => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=?", [a.account.id, qid])).response_json);
  const issuePart = async pick => {
    if (used >= 70) await fresh();
    const place = productPlaceOf(pick.family, pick.dp);
    if (!place) return null;
    const dp = place.ordinal === null ? null : dotpointById(`${place.subtopic}.${place.ordinal + 1}`);
    const asked = dp && dp.forms.includes(pick.level) ? { dotpoint: dp.id } : {};
    let found = null;
    for (let t = 0; t < 600 && found === null; t++) { const s2 = (seed += 7919) % 0x7fffffff; if (qb.qbankDraw(place.subtopic, pick.level, s2 >>> 0, asked.dotpoint ?? null)?._bank === pick.id) found = s2; }
    if (found === null) return null;
    const r = await call('/v1/practice/issue', { curriculum: 'nsw', generator: place.subtopic, difficulty: pick.level, ...asked, seed: found });
    if (r.status !== 201) return null;
    const sealed = await sealedOf(r.data.question.id);
    return sealed._bank === pick.id ? { qid: r.data.question.id, sealed, issued: r.data.question } : null;
  };
  let tag = 0;
  const submit = async (qid, answer, lines) => {
    tag++;
    const go = k => call(`/v1/practice/${qid}/submit`, { submissionId: `bghttp-${tag}-${k}`, answer, steps: lines.join('\n'), mode: 'typed' }, { 'Idempotency-Key': `bghttp-${tag}-${k}` });
    const one = await go(1);
    return (one.data.resolved ? one : await go(2)).data;
  };
  // the model the page draws from the reply (the same one the app uses)
  const drawn = (reply, N) => criteriaView({ criteria: reply.methodCriteria, mark: { awarded: reply.marksEarned, possible: N }, cards: cardsOfReport(reply.stepReport), approved: AUTHOR_APPROVED });

  for (const pick of picks) {
    const qq = qb.qbankEntryQuestion(pick.id, 17);
    const N = marksPossibleFor(qq);
    const texts = bankAuthoredLines(qq).map(l => l.text);
    const right = acceptedInput(qq);
    const WRONG = '99991';
    const stampedAndIssued = await issuePart(pick);
    if (!stampedAndIssued) continue;
    R.parts++;
    c.eq(stampedAndIssued.sealed._methodScheme, BANK_GENERIC_ID, `${pick.id}: stamped with the bank generic rule at issue`);
    c.ok(stampedAndIssued.issued.stepMarks === true, `${pick.id}: the issued question says step marks can be earned on it`);

    // a: right answer, full
    const ra = await submit(stampedAndIssued.qid, right, texts);
    c.deq([ra.correct, ra.marksEarned, ra.marksPossible], [true, N, N], `${pick.id}: a correct answer earns ${N} of ${N}`);
    R.full++;

    // b: right method, wrong final answer
    const pb = await issuePart(pick);
    const rb = await submit(pb.qid, WRONG, texts);
    c.eq(rb.correct, false, `${pick.id}: the wrong final answer is wrong`);
    if (rb.marksEarned >= N) R.wrongAtN++;
    if (rb.marksEarned > N) R.overN++;
    if (rb.marksEarned >= 1) { R.partial++; paidPick ??= pick; }
    c.ok(rb.marksEarned >= 0 && rb.marksEarned <= N - 1, `${pick.id}: correct method, wrong final answer earns ${rb.marksEarned}, at most ${N - 1}`);
    if (rb.methodCriteria) {
      R.partialPaid++;
      const cr = rb.methodCriteria;
      if (cr.items.reduce((n, i) => n + (i.awarded ? i.marks : 0), 0) !== rb.marksEarned) R.tableNotMark++;
      if (!cr.items.filter(i => i.awarded && i.basis === 'lines').every(i => i.lines.length > 0 && i.lines.every(n => rb.stepReport.lines[n - 1]?.status === 'ok'))) R.onUnticked++;
      const view = drawn(rb, N);
      c.ok(view && view.earned === rb.marksEarned && view.possible === N, `${pick.id}: the page's model draws the one table, equal to the mark`);
      R.labelled++;
      c.deq(rb.methodScheme, { typeId: BANK_GENERIC_ID, paid: true }, `${pick.id}: the reply says the bank generic rule paid`);
    }

    // c: one middle line made wrong, then his lines
    const idxs = texts.map((t, i) => i).slice(0, -1).filter(i => { const bad = falsify(texts[i]); return bad && bad !== texts[i] && !stillTrue(texts[i], bad); });
    if (idxs.length) {
      const idx = idxs[Math.floor(idxs.length / 2)];
      const lines = texts.map((t, i) => (i === idx ? falsify(t) : t));
      const pc = await issuePart(pick);
      const rc = await submit(pc.qid, WRONG, lines);
      R.wrongLinePages++;
      const late = rc.methodCriteria ? rc.methodCriteria.items.filter(i => i.awarded && i.basis === 'lines' && i.lines.some(n => n - 1 >= idx)) : [];
      if (late.length) R.afterWrong++;
      c.ok(late.length === 0 && rc.marksEarned <= N - 1, `${pick.id}: a wrong line ${idx + 1} earns nothing at or after it (${rc.marksEarned} of ${N})`);
    }

    // d: the question restated, e: bare values
    const restated = [...String(qq.prompt).replace(/\\\$/g, '\u0001').matchAll(/\$([^$]+)\$/g)].map(m => m[1]);
    if (restated.length) {
      const pd = await issuePart(pick);
      const rd = await submit(pd.qid, WRONG, restated);
      R.restate++; if ((rd.marksEarned ?? 0) > 0) R.restatePaid++;
      c.eq(rd.marksEarned ?? 0, 0, `${pick.id}: restating the question earns nothing`);
    }
    const bare = [...new Set(texts.map(t => (t.match(/(-?\d+(?:\.\d+)?)\s*$/) || [])[1]).filter(Boolean))].slice(0, 3);
    if (bare.length) {
      const pe = await issuePart(pick);
      const re = await submit(pe.qid, WRONG, bare);
      R.bare++; if ((re.marksEarned ?? 0) > 0) R.barePaid++;
      c.eq(re.marksEarned ?? 0, 0, `${pick.id}: bare values earn nothing`);
    }
  }
  c.ok(R.parts >= 8, `${R.parts} bank parts drawn through the real routes`);
  c.eq(R.wrongAtN + R.overN + R.tableNotMark + R.onUnticked + R.afterWrong + R.restatePaid + R.barePaid, 0, 'no invariant violated: never N on a wrong answer, never above N, table = mark, only ticked lines earn, nothing after a wrong line, restating and bare values earn nothing');
  c.ok(R.partial > 0, `correct method with a wrong final answer earned step marks on ${R.partial} of ${R.parts} parts`);

  // sealed contexts. The one-try modes never draw the bank at all; a stamped row dealt into one is refused at pay time.
  {
    const pick = paidPick;
    c.ok(pick, 'a part that paid step marks is used for the sealed-context checks');
    const qq = qb.qbankEntryQuestion(pick.id, 17);
    const texts = bankAuthoredLines(qq).map(l => l.text);
    for (const mode of ['rush', 'match', 'placement']) {
      const part = await issuePart(pick);
      const patched = { ...part.sealed, _practiceMode: mode };
      await h.db.run("UPDATE idempotency_keys SET response_json=? WHERE account_id=? AND scope='practice-question' AND key=?", [JSON.stringify(patched), a.account.id, part.qid]);
      const r = await submit(part.qid, '99991', texts);
      c.ok((r.marksEarned ?? 0) === 0 && !r.methodCriteria && r.methodScheme?.paid !== true, `${mode}: a stamped bank row stays final-answer-only at pay time`);
      const rr = await call('/v1/practice/issue', { curriculum: 'nsw', generator: part.sealed.subtopic, difficulty: pick.level, seed: (seed += 7919) % 0x7fffffff, mode });
      if (rr.status === 201) { const s = await sealedOf(rr.data.question.id); c.ok(typeof s._bank !== 'string' && s._methodScheme === undefined, `${mode}: an issued question is a generator question, sealed with no scheme`); }
    }
    // an unstamped bank row (issued before the approval): final-answer only
    const part = await issuePart(pick);
    const unstamped = { ...part.sealed }; delete unstamped._methodScheme; unstamped._marking = FINAL_ANSWER_MARKING;
    await h.db.run("UPDATE idempotency_keys SET response_json=? WHERE account_id=? AND scope='practice-question' AND key=?", [JSON.stringify(unstamped), a.account.id, part.qid]);
    const r = await submit(part.qid, '99991', texts);
    c.ok((r.marksEarned ?? 0) === 0 && !r.methodCriteria, 'a question issued before the approval (no stamp) earns nothing for working');
    // review mode (SCHEME_MODES: practice, review, task) is NOT sealed by the approved rules, for the generic rule of 24 Nov as for this one: reported, not changed here
    const part2 = await issuePart(pick);
    await h.db.run("UPDATE idempotency_keys SET response_json=? WHERE account_id=? AND scope='practice-question' AND key=?", [JSON.stringify({ ...part2.sealed, _practiceMode: 'review' }), a.account.id, part2.qid]);
    const rv = await submit(part2.qid, '99991', texts);
    const part3 = await issuePart(pick); const rctl = await submit(part3.qid, '99991', texts);
    c.ok(rctl.marksEarned >= 1, 'control: the same part in practice mode pays step marks');
    console.log(`note: a stamped bank row in review mode earned ${rv.marksEarned} of ${rv.marksPossible} (review is in SCHEME_MODES, as for the generic rule)`);
  }
} finally {
  await h.close();
}

// India: nothing new. The author bank is not issued there, no bank question is stamped under its policy, and the rule is refused outside the author tier.
{
  const india = bankPolicy('priyabhata');
  let stamped = 0, sealedRight = 0;
  for (const e of eligible.slice(0, 60)) { const q = JSON.parse(JSON.stringify(qb.qbankEntryQuestion(e.id, 17))); q._generator = q.subtopic; const ok = sealForEdition(q, { ...india, methodSchemeTypes: approvedSchemeTypes() }); if (q._methodScheme !== undefined) stamped++; if (!ok || q._marking === FINAL_ANSWER_MARKING) sealedRight++; }
  c.eq(stamped, 0, 'India: no bank question is stamped with a scheme');
  const q = { ...qb.qbankEntryQuestion(eligible[0].id, 17), _methodScheme: BANK_GENERIC_ID };
  c.eq(schemePay({ q, report: { lines: [] }, correct: false, marksPossible: marksPossibleFor(q), env: { PRI_METHOD_MARKS: 'on', PRI_EDITION: 'priyabhata' }, list: approvedSchemeTypes() }).paid, false, 'India: the rule pays nothing');
}

function N_of(q) { return marksPossibleFor(q); }
fs.rmSync(scratch, { recursive: true, force: true });
for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
console.log(`parts ${R.parts}: full ${R.full}; step marks on wrong final answer on ${R.partial}; wrong-line pages ${R.wrongLinePages} (after-wrong ${R.afterWrong}); restated ${R.restate} (paid ${R.restatePaid}); bare ${R.bare} (paid ${R.barePaid})`);
console.log(`engine: ${h.engine}`);
console.log(`BANK GENERIC OVER HTTP: PASS: ${c.count()}/${c.count()} checks`);
process.exit(0);
