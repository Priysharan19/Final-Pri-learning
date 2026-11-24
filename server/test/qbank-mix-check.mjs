// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the author question bank inside the practice of the subtopics and dot points
//
// A Prithagoras student never asks for "the author's bank": they open a topic or one of its dot points and a level, and some of the
// questions they are dealt are the author's. This check holds the three things that make that safe, on the COMMITTED pack:
//
//   · THE TABLE   every dot point of the pack is placed in a product subtopic (server/platform/qbankDotpoints.js); every subtopic exists,
//                 is one Prithagoras issues, belongs to the author's course and carries his topic code (three named exceptions); every
//                 numbered dot point exists; no row is stale. The dot points placed at topic level only are listed, not hidden.
//   · THE MIX     a seed's turn is decided by the seed alone; the share is what the rule says; across a session of requests an authored
//                 question is never served twice while a fresh one exists, the pool is used, and a generator answers once it has run dry;
//                 a timed paper (bank: false) and a picked item never draw from the bank; a dot point asked for is answered by a question
//                 numbered to it.
//   · ACCOUNTING  over the real routes: the question's attempt record is the generator's own shape, in the product subtopic and dot point,
//                 with only the opaque content id; the same authored question again is a repeat and earns nothing.
// SYNTHETIC: none; these are the owner's questions run against the engine. Not evidence about real students.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const keys = ['NODE_ENV', 'PRI_OFFERING', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_FREE_PRACTICE_PER_DAY', 'PRI_EDITION', 'PRI_QBANK_DIR'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'pri-qbank-mix-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = path.join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'c5'.repeat(32);
process.env.PRI_FREE_PRACTICE_PER_DAY = '1000000';
process.env.PRI_EDITION = 'prithagoras';
process.env.PRI_OFFERING = 'catalogue';
delete process.env.PRI_QBANK_DIR;

const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const qb = await import('../platform/qbankPack.js');
const { QBANK_DOTPOINTS, productPlaceOf } = await import('../platform/qbankDotpoints.js');
const { SUBTOPIC_BY_ID, dotpointById } = await import('../../client/src/engine/curriculum.js');
const { LEGACY_CROSSWALK } = await import('../../client/src/engine/curriculum-nsw/index.js');
const { nswBank } = await import('../platform/nswBanks.js');
const { bankPolicy } = await import('../platform/editionBanks.js');
const { chooseQuestion, ensureBanks, opaqueContentHash } = await import('../platform/practice.js');
const { acceptedInput } = await import('../../tools/qbank-import.mjs');

const c = checks();
const pack = await qb.ensureQbank(process.env, { strict: true });
await ensureBanks();
const policy = bankPolicy('prithagoras');
const all = qb.qbankEntries();

// ── THE TABLE ────────────────────────────────────────────────────────────────
const packDots = new Set(all.map(x => `${x.family}.${x.entry.dp}`));
c.eq(packDots.size, 112, 'the committed pack holds 112 author dot points');
c.deq([...packDots].filter(id => { const i = id.lastIndexOf('.', id.lastIndexOf('.') - 1); return !productPlaceOf(id.slice(0, i), id.slice(i + 1)); }), [], 'every one is placed in a product subtopic');
c.deq(Object.entries(QBANK_DOTPOINTS).flatMap(([family, row]) => Object.keys(row).map(code => `${family}.${code}`)).filter(id => !packDots.has(id)), [], 'and the table holds no dot point the pack does not');
// Where the author's topic code is not the subtopic's: his questions practised in the nearest product subtopic of the same skill.
const CROSS_TOPIC = new Set(['qb-a11-ma-s1.S1.2a', 'qb-a12-ma-c2.C2.2b', 'qb-x12-me-c3.C3.2c']);
const crosswalkOf = new Map(LEGACY_CROSSWALK.map(r => [r.subtopicId, r]));
const problems = [];
let numbered = 0, topicOnly = 0;
const topicOnlyList = [];
for (const [family, row] of Object.entries(QBANK_DOTPOINTS)) {
  const course = family.startsWith('qb-a') ? 'advanced' : 'extension1';
  const topic = family.split('-').slice(2).join('-').toUpperCase();   // MA-C1
  for (const [code, [sub, n]] of Object.entries(row)) {
    const id = `${family}.${code}`;
    const st = SUBTOPIC_BY_ID[sub];
    if (!st || !nswBank(sub)) { problems.push(`${id}: ${sub} is not an issued subtopic`); continue; }
    if (!String(crosswalkOf.get(sub)?.syllabus).includes(course)) problems.push(`${id}: ${sub} is not in the ${course} syllabus`);
    if (!CROSS_TOPIC.has(id) && !String(st.code).split('/').some((_, i, parts) => `${parts[0].split('-')[0]}-${parts[i].replace(/^.*-/, '')}` === topic)) problems.push(`${id}: ${sub} is ${st.code}, not ${topic}`);
    if (n === undefined) { topicOnly++; topicOnlyList.push(id); } else { numbered++; if (!dotpointById(`${sub}.${n}`)) problems.push(`${id}: ${sub}.${n} does not exist`); }
  }
}
c.deq(problems, [], 'every subtopic exists, is issued, is the author\'s course and carries his topic code (three named exceptions), and every numbered dot point exists');
c.eq(numbered + topicOnly, 112, `${numbered} author dot points are numbered to a product dot point and ${topicOnly} are practised through their subtopic only`);
c.ok(all.every(x => policy.admits && qb.qbankServes(x.place.subtopic)), 'every question is served from a subtopic Prithagoras issues');
console.log(`  numbered ${numbered}, subtopic only ${topicOnly}: ${topicOnlyList.join(' ')}`);

// ── THE MIX ──────────────────────────────────────────────────────────────────
let large = 0, small = 0;
for (let seed = 1; seed <= 4000; seed++) { if (qb.bankTurn(8, seed, 'k')) large++; if (qb.bankTurn(3, seed, 'k')) small++; }
c.ok(Math.abs(large - 3000) < 160 && Math.abs(small - 2000) < 160, `an authored turn is 3 in 4 for a pool of six or more and 1 in 2 for a smaller one (${large} and ${small} of 4000)`);
c.ok(!qb.bankTurn(0, 5, 'k') && qb.bankTurn(8, 7, 'k') === qb.bankTurn(8, 7, 'k'), 'an empty pool is never a turn, and a seed always decides the same');
const pools = new Map();
for (const { entry, place } of all) { const k = `${place.subtopic}|${entry.level}`; pools.set(k, [...(pools.get(k) || []), entry.id]); }
// A cell with a mid-sized pool, to watch it used up.
const [cellKey, cellIds] = [...pools.entries()].filter(([, v]) => v.length >= 4 && v.length <= 9).sort((a, b) => (a[0] < b[0] ? -1 : 1))[0];
const [cellSub, cellLevel] = [cellKey.split('|')[0], Number(cellKey.split('|')[1])];
const lcg = a => () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a & 0x7fffffff; };
const request = (generator, difficulty, extra = {}) => ({ generator, difficulty, mode: 'practice', avoid: new Set(), dotpoint: undefined, trap: null, written: false, band: null, ...extra });
{
  const avoid = new Set(), served = [];
  const draw = lcg(2026);
  for (let i = 0; i < 80; i++) {
    const { q, repeat } = chooseQuestion(request(cellSub, cellLevel, { avoid }), null, { draw, banks: policy });
    c.ok(q.subtopic === cellSub && q.difficulty === cellLevel && !repeat, `request ${i + 1}: the cell's own question, not a repeat`);
    avoid.add(opaqueContentHash(q.contentHash));
    served.push(q._bank || null);
  }
  const bank = served.filter(Boolean);
  c.eq(new Set(bank).size, bank.length, 'an authored question is never served twice in a session');
  c.deq([...new Set(bank)].sort(), [...cellIds].sort(), `the whole pool of ${cellIds.length} is used (${cellKey})`);
  const lastBank = served.lastIndexOf(served.filter(Boolean).at(-1));
  c.ok(served.slice(lastBank + 1).length > 20 && served.slice(lastBank + 1).every(x => x === null), 'and once it has run dry the generators answer, to the end');
  c.ok(served.slice(0, 12).filter(Boolean).length >= 3, 'authored questions come first while they are fresh');
}
{
  // A dot point asked for is answered by a question numbered to it, and only that dot point's.
  const [sub, n] = ['y12-integration', 2];
  const dpId = `${sub}.${n}`;
  const avoid = new Set(), seen = [];
  const draw = lcg(77);
  for (let i = 0; i < 40; i++) {
    const { q } = chooseQuestion(request(sub, dotpointById(dpId).forms[0], { avoid, dotpoint: dpId }), null, { draw, banks: policy });
    c.ok(q.dotpoints.includes(dpId) && q.dotpointRequested === dpId, `dot point request ${i + 1}: carries the dot point asked for`);
    if (q._bank) seen.push(q._bank);
    avoid.add(opaqueContentHash(q.contentHash));
  }
  c.ok(seen.length > 5 && new Set(seen).size === seen.length, 'a dot point asked for is dealt authored questions, each once');
  c.ok(seen.every(id => { const e = all.find(x => x.entry.id === id); return e.place.subtopic === sub && e.place.ordinal === n - 1; }), 'and every one is numbered to that dot point');
}
{
  const draw = lcg(5);
  let bankDrawn = 0;
  for (let i = 0; i < 400; i++) if (chooseQuestion(request(cellSub, cellLevel, { bank: false }), null, { draw, banks: policy }).q._bank) bankDrawn++;
  c.eq(bankDrawn, 0, 'a request that names bank: false (a timed paper) never draws an authored question');
}
{
  const draw = lcg(9);
  let bankDrawn = 0;
  for (const mode of ['rush', 'match']) for (let i = 0; i < 200; i++) if (chooseQuestion(request(cellSub, cellLevel, { mode }), null, { draw, banks: policy }).q._bank) bankDrawn++;
  c.eq(bankDrawn, 0, 'Rush and Match, one-line timed rounds, never deal an authored question');
}
c.ok(!policy.issues('qb-a11-ma-c1') && policy.issues(cellSub), 'a bank family is no request; the subtopic is');

// ── ACCOUNTING ───────────────────────────────────────────────────────────────
const h = await startApp({ engine: requestedEngine() });
try {
  const a = await registerAccount(h, { email: 'qbank.mix@example.test', deviceId: 'ipad-qbank-mix' });
  await verifyEmail(h, a.account.id);
  const issue = body => h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body: { curriculum: 'nsw', ...body } });
  const submit = (qid, id, answer) => h.request(`/v1/practice/${qid}/submit`, { method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': id }, body: { submissionId: id, answer, mode: 'typed' } });
  const sealedOf = async qid => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=?", [a.account.id, qid])).response_json);
  const attemptOf = async attemptId => JSON.parse((await h.db.get("SELECT payload_json FROM learning_events WHERE account_id=? AND id=? AND kind='graded-attempt'", [a.account.id, attemptId])).payload_json);
  // one numbered question (asked for through its dot point) and one generator question of the same dot point
  const target = all.find(x => x.place.ordinal !== null && dotpointById(`${x.place.subtopic}.${x.place.ordinal + 1}`).forms.includes(x.entry.level) && x.entry.answerType === 'numeric');
  const dp = `${target.place.subtopic}.${target.place.ordinal + 1}`;
  let seed = 500, bankQ = null, genQ = null;
  while (!bankQ || !genQ) {
    const r = await issue({ generator: target.place.subtopic, difficulty: target.entry.level, dotpoint: dp, seed: (seed += 13) });
    c.eq(r.status, 201, 'issue');
    const sealed = await sealedOf(r.data.question.id);
    if (sealed._bank === target.entry.id && !bankQ) bankQ = { r, sealed };
    else if (!sealed._bank && !genQ) genQ = { r, sealed };
    if (seed > 20000) throw new Error('no draw');
  }
  const doneBank = await submit(bankQ.r.data.question.id, 'mix-bank-1-xxxx', acceptedInput(target.entry));
  c.deq([doneBank.data.correct, doneBank.data.resolved, doneBank.data.marksEarned], [true, true, target.entry.marks], 'the authored question is marked and paid its authored marks');
  const genAnswer = String(genQ.sealed.answer?.value ?? genQ.sealed.answer?.expr ?? '');
  const doneGen = await submit(genQ.r.data.question.id, 'mix-gen-1-xxxx', genAnswer);
  const attBank = await attemptOf(doneBank.data.attemptId), attGen = await attemptOf(doneGen.data.attemptId);
  c.deq([attBank.subtopic, attBank.dotpoint, attBank.difficulty], [target.place.subtopic, dp, target.entry.level], 'its attempt is in the product subtopic, dot point and level');
  c.ok(/^srv:/.test(attBank.contentId) && !JSON.stringify(attBank).includes(target.entry.id) && !JSON.stringify(attBank).includes('qbank'), 'it carries only the opaque content id: the author\'s id is on no student record');
  const shape = o => Object.keys(o).filter(k => !['attemptId', 'questionId', 'contentId', 'marksEarned', 'marksPossible', 'creditedMarks', 'ms', 'markWeight', 'answerTyped', 'trap', 'misconception', 'hintsUsed'].includes(k)).sort().join();
  c.eq(shape(attBank), shape(attGen), 'and the attempt record has the same fields as a generator question\'s');
  c.eq(attBank.marksPossible, target.entry.marks, 'and records the authored marks it was worth');
  // the same authored question again is a repeat, and earns nothing
  let again = null;
  for (let i = 0; i < 400 && !again; i++) {
    const r = await issue({ generator: target.place.subtopic, difficulty: target.entry.level, dotpoint: dp, seed: (seed += 13) });
    const sealed = await sealedOf(r.data.question.id);
    if (sealed._bank === target.entry.id) again = { r, sealed };
  }
  c.ok(again && again.sealed._repeat === true, 'the same authored question, drawn again, is sealed as a repeat');
  const repeatDone = await submit(again.r.data.question.id, 'mix-bank-2-xxxx', acceptedInput(target.entry));
  c.ok(repeatDone.data.repeat === true && repeatDone.data.correct === true, 'and is marked as a repeat, which progress does not count (as a generator\'s repeat is)');
} finally {
  await h.close();
  for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
  fs.rmSync(scratch, { recursive: true, force: true });
}
console.log(`QBANK MIX: PASS — ${c.count()}/${c.count()} checks`);
process.exit(0);
