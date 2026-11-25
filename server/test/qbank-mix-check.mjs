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
await qb.ensureQbank(process.env, { strict: true });
await ensureBanks();
const policy = bankPolicy('prithagoras');
const all = qb.qbankEntries();

// ── THE TABLE ────────────────────────────────────────────────────────────────
const packDots = new Set([...all, ...qb.qbankManualEntries()].map(x => `${x.family}.${x.entry.dp}`));
c.eq(packDots.size, 117, 'the committed pack holds 117 author dot points (marked and worked-solution questions)');
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
c.eq(numbered + topicOnly, 117, `${numbered} author dot points are numbered to a product dot point and ${topicOnly} are practised through their subtopic only`);
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
{
  // The placement check is a diagnostic composed from the generators alone, as Rush, Match and a timed paper are.
  const draw = lcg(31);
  for (const mode of ['placement', 'rush', 'match', 'practice']) {
    let bankDrawn = 0;
    for (let i = 0; i < 300; i++) if (chooseQuestion(request(cellSub, cellLevel, { mode }), null, { draw, banks: policy }).q._bank) bankDrawn++;
    if (mode === 'practice') c.ok(bankDrawn > 100, `practice mode deals the author's questions (${bankDrawn} of 300), so the three counts above are the mode's doing`);
    else c.eq(bankDrawn, 0, `${mode} mode never draws an authored question`);
  }
  // A fixed seed (a test suite's) is the same rule: placement is never an authored question's turn.
  let seeded = 0;
  for (let seed = 1; seed <= 300; seed++) if (chooseQuestion(request(cellSub, cellLevel, { mode: 'placement' }), seed, { banks: policy }).q._bank) seeded++;
  c.eq(seeded, 0, 'and a placement request with a fixed seed is a generator\'s too');
}
{
  // Once the pool of a cell is used (the device's avoid list holds every authored question of it) the generators answer, and the answer is
  // not a repeat: an authored question already served is never dealt again while a fresh question can be found.
  const poolHashes = new Set(cellIds.map(id => opaqueContentHash(qb.qbankEntryQuestion(id, 3).contentHash)));
  const draw = lcg(71);
  let bankServed = 0, repeats = 0;
  for (let i = 0; i < 400; i++) {
    const { q, repeat } = chooseQuestion(request(cellSub, cellLevel, { avoid: new Set(poolHashes) }), null, { draw, banks: policy });
    if (q._bank) bankServed++;
    if (repeat) repeats++;
  }
  c.deq([bankServed, repeats], [0, 0], `with the whole authored pool of a cell already served (${cellIds.length} questions), 400 requests are all generators' and none is a repeat`);
  // A seek that has already found some of the pool stale does not draw those again: with one authored question fresh, only it is ever dealt.
  const fresh = cellIds[0];
  const stale = new Set(cellIds.slice(1).map(id => opaqueContentHash(qb.qbankEntryQuestion(id, 3).contentHash)));
  const served = [];
  for (let i = 0; i < 300; i++) { const { q } = chooseQuestion(request(cellSub, cellLevel, { avoid: new Set(stale) }), null, { draw, banks: policy }); if (q._bank) served.push(q._bank); }
  c.ok(served.length > 20 && served.every(id => id === fresh), `with all but one authored question served, only that one is dealt (${served.length} times)`);
  // The tie-break: when a budget of one draw finds only an authored question already served, it is a repeat of it; a generator's, if drawn, wins a tie.
  const tied = chooseQuestion(request(cellSub, cellLevel, { avoid: new Set(poolHashes) }), null, { draw: lcg(3), banks: policy, tries: 40 });
  c.ok(!tied.q._bank, 'a generator\'s question is preferred to an authored one already served');
}
{
  // The two questions the author tagged under a title they are not about are practised where they belong.
  const place = id => { const x = all.find(e => e.entry.id === id); return x && `${x.entry.dp}`; };
  c.deq([place('A11-T1-074'), place('X12-V1-116')], ['T1.2b', 'V1.1c'], 'A11-T1-074 (a sector\'s fraction of a circle) and X12-V1-116 (a ratio on a line, by vectors) sit under the dot points they are about');
  c.ok(!all.some(x => ['X11-C1-041', 'A11-T2-092'].includes(x.entry.id)), 'the two questions held for the owner (a trap that does not match its reason; a trap reason that is a hint) are not in the pack');
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
  // A session over the real routes: every question the account is dealt is answered (resolved). Each authored question of the cell is
  // dealt once, and when the pool is used the generators take over, with no repeat.
  {
    const dealt = [];
    for (let i = 0; i < cellIds.length + 80; i++) {   // the last fresh authored question is found at about 1 issue in 7 once it is nearly alone: 80 spare issues make a miss about 1 in 10000
      const r = await issue({ generator: cellSub, difficulty: cellLevel });
      c.eq(r.status, 201, `session issue ${i + 1}`);
      const sealed = await sealedOf(r.data.question.id);
      // A worked-solution question (no key, no mark) is dealt on its own turn, never twice in a row: its solution is asked for and that is all.
      const worked = sealed.answerType === 'manual';
      dealt.push({ bank: worked ? null : (sealed._bank ?? null), worked: worked ? sealed._bank : null, repeat: sealed._repeat === true });
      if (worked) { const shown = await h.request(`/v1/practice/${r.data.question.id}/solution`, { method: 'POST', jar: a.jar, body: {} }); c.eq(shown.status, 200, `session solution ${i + 1}`); continue; }
      const wrong = sealed.answerType === 'point' ? '(100, 100)' : sealed.answerType === 'set' ? '99' : sealed.answerType === 'interval' ? 'x > 100' : sealed.answerType === 'equation' ? 'y = 99*x' : sealed.answerType === 'expression' ? 'x + 987' : '12345.678';
      for (let t = 0; t < 2; t++) { const sid = `sess-${i}-${t}-xxxxxx`; const d = await submit(r.data.question.id, sid, wrong); if (d.data.resolved) break; }
    }
    const banks = dealt.map(d => d.bank).filter(Boolean);
    c.ok(new Set(banks).size === banks.length && banks.length === cellIds.length && dealt.every(d => !d.repeat), `a session answers each of the cell's ${cellIds.length} authored questions once and no question is a repeat (${banks.length} authored, ${dealt.filter(d => d.worked).length} worked-solution, ${dealt.filter(d => !d.bank && !d.worked).length} generators')`);
    const workedIds = dealt.map(d => d.worked).filter(Boolean);
    c.ok(new Set(workedIds).size === workedIds.length, 'no worked-solution question is dealt twice in the session');
    c.ok(dealt.every((d, i) => !(d.worked && dealt[i - 1]?.worked)), 'and never two in a row');
    const last = dealt.map(d => d.bank).lastIndexOf(dealt.map(d => d.bank).filter(Boolean).pop());
    c.ok(dealt.slice(last + 1).length >= 5 && dealt.slice(last + 1).every(d => d.bank === null), 'and once the pool is used, the generators answer to the end of the session');
  }
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
  // A bank question that was issued and then REVEALED, or ABANDONED, is as seen as one that was answered: y12-integration, level 3, 90 issues, none answered.
  {
    const ask = (acct, extra = {}) => h.request('/v1/practice/issue', { method: 'POST', jar: acct.jar, body: { curriculum: 'nsw', generator: 'y12-integration', difficulty: 3, ...extra } });
    const sealedFor = async (acct, qid) => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=?", [acct.account.id, qid])).response_json);
    const scenarios = [
      ['each revealed as soon as it is dealt', 'reveal'],
      ['each revealed through the ladder\'s solution rung', 'solution-rung'],
      ['all 90 dealt, and only then revealed', 'reveal-after'],
      ['never answered, never revealed (abandoned)', 'abandon']
    ];
    let n = 0;
    for (const [what, mode] of scenarios) {
      const acct = await registerAccount(h, { email: `qbank.rep${++n}@example.test`, deviceId: `ipad-qbank-rep-${n}` });
      await verifyEmail(h, acct.account.id);
      const dealt = [];
      for (let i = 0; i < 90; i++) {
        const r = await ask(acct);
        if (r.status !== 201) throw new Error(`issue ${i}: ${r.status}`);
        const sealed = await sealedFor(acct, r.data.question.id);
        const worked = sealed.answerType === 'manual';   // a worked-solution question has its own solution route (and no reveal, no solution rung)
        dealt.push({ id: r.data.question.id, bank: worked ? null : (sealed._bank ?? null), worked, repeat: sealed._repeat === true });
        if (worked && mode !== 'abandon' && mode !== 'reveal-after') { await h.request(`/v1/practice/${r.data.question.id}/solution`, { method: 'POST', jar: acct.jar, body: {} }); continue; }
        if (mode === 'reveal') await h.request(`/v1/practice/${r.data.question.id}/reveal`, { method: 'POST', jar: acct.jar, body: {} });
        if (mode === 'solution-rung' && !worked) for (const rung of ['nudge', 'method', 'worked', 'solution']) { const x = await h.request(`/v1/practice/${r.data.question.id}/hint`, { method: 'POST', jar: acct.jar, body: { rung } }); if (x.status !== 200 && !(rung !== 'solution' && x.status === 409)) throw new Error(`hint ${rung}: ${x.status}`); if (x.status === 409) break; }
      }
      if (mode === 'reveal-after') for (const d of dealt) await h.request(`/v1/practice/${d.id}/${d.worked ? 'solution' : 'reveal'}`, { method: 'POST', jar: acct.jar, body: {} });
      const banks = dealt.map(d => d.bank).filter(Boolean);
      const dupes = banks.length - new Set(banks).size;
      c.deq([dupes, dealt.filter(d => d.bank && d.repeat).length], [0, 0], `${what}: ${banks.length} authored questions in 90 deals, ${dupes} dealt twice, none a repeat`);
      c.ok(banks.length > 20, `${what}: the authored pool is used (${new Set(banks).size} different)`);
    }
  }
} finally {
  await h.close();
  for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
  fs.rmSync(scratch, { recursive: true, force: true });
}
console.log(`QBANK MIX: PASS — ${c.count()}/${c.count()} checks`);
process.exit(0);
