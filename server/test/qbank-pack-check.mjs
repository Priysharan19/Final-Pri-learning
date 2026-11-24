// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the author question bank, served from a content pack outside the repository
//
// SYNTHETIC: a twelve-question bank written for this test (server/test/support/qbank-fixture.mjs), compiled by the importer into a pack in a
// temporary directory and loaded by the real server. None of the owner's questions is in this repository (it is public).
//
// What this proves:
//   · the importer compiles only what passes every check (a manual part, a hint that is the answer, a diagram and layout TeX are
//     rejected with a reason) and compiles the same bytes twice;
//   · the loader refuses a pack whose file, version, index or size is not the manifest's, whole: the bank then does not exist, and a
//     server pointed at it does not start;
//   · PRI_QBANK_DIR unset means no bank, and everything else is what it was: the curriculum response is byte-identical to main's
//     (pinned digest), no bank family is issuable, Priyabhata never issues one, a generator question's marks are unchanged;
//   · over the real /v1 routes: issuance sends public fields only (no answer, step, criterion or trap), the question is sealed
//     final-answer-only with its curriculum identity and never carries a method scheme, even with the generic rule approved; the engine
//     marks correct, incorrect and trap answers; the authored marks are what is earned; his `why` is shown for a trap; the worked solution
//     only after the question resolves; the hint ladder serves a rung that is not the answer.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const keys = ['NODE_ENV', 'PRI_OFFERING', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_FREE_PRACTICE_PER_DAY', 'PRI_EDITION', 'PRI_QBANK_DIR'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'pri-qbank-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = path.join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'c5'.repeat(32);
process.env.PRI_FREE_PRACTICE_PER_DAY = '100000';
process.env.PRI_EDITION = 'prithagoras';
process.env.PRI_OFFERING = 'catalogue';
process.env.PRI_QBANK_DIR = 'off';

const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { PUBLIC_QUESTION_FIELDS } = await import('../../client/src/engine/publicQuestion.js');
const { compilePack, memorySource, acceptedInput, trapInput } = await import('../../tools/qbank-import.mjs');
const { fixtureArchive } = await import('./support/qbank-fixture.mjs');
const qb = await import('../platform/qbankPack.js');
const { bankPolicy, sealForEdition, FINAL_ANSWER_MARKING } = await import('../platform/editionBanks.js');
const { nswCurriculumResponse } = await import('../platform/nswBanks.js');
const { marksPossibleFor } = await import('../platform/markerOps.js');
const { approveSchemeTypesForTests } = await import('../platform/schemeAward.js');
const { GENERIC_ID, genericDigest } = await import('../platform/genericSteps.js');
const { generateQuestion, loadAllBanks } = await import('../../client/src/engine/generators/index.js');

const c = checks();
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
// The curriculum response of a server with no pack, as origin/main served it (digest taken before this change).
const MAIN_CURRICULUM_SHA = 'cfa357fe3b7337213c7225b34f0cd9914213d786e14dced8c7c0cbf242bbc378';

const writePack = (dir, files) => { for (const [name, text] of files) { const f = path.join(dir, name); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); } };

// ── the importer's pack, from the fixture ────────────────────────────────────
const compiled = compilePack(fixtureArchive());
const again = compilePack(fixtureArchive());
c.ok([...compiled.files].every(([name, text]) => again.files.get(name) === text) && compiled.files.size === again.files.size, 'the importer compiles the same bytes twice');
c.eq(compiled.summary.questions, 9, 'nine fixture parts pass every check');
c.deq(compiled.summary.reasons, { diagram: 1, 'hint:leak': 1, 'latex:command-outside-math:\\leavevmode': 1, manual: 1 }, 'four are rejected, each with its reason');
c.deq(compiled.rejects.map(r => r.id), ['TQ-009', 'TQ-010', 'TQ-011', 'TQ-012'], 'the rejected ids are the manual, leaking-hint, diagram and layout-TeX parts');
c.deq(compiled.summary.byCourse, { A11: 8, X11: 1 }, 'the questions are counted by course');
const manifest = JSON.parse(compiled.files.get('manifest.json'));
c.deq(manifest.shards.map(s => s.name), ['shards/qb-a11-ma-c1.json', 'shards/qb-x11-me-a1.json'], 'one shard per course and topic');
c.ok(manifest.shards.every(s => s.sha256 === sha(compiled.files.get(s.name)) && s.bytes === Buffer.byteLength(compiled.files.get(s.name))), 'the manifest holds each shard\'s sha256 and size');
const shard = JSON.parse(compiled.files.get('shards/qb-a11-ma-c1.json'));
const q2 = shard.questions.find(q => q.id === 'TQ-002');
c.deq([q2.authored, q2.level, q2.marks], [5, 4, 3], 'authored difficulty 5 is served at level 4 and the authored number is kept');
c.ok(!compiled.files.get('rejects.json').includes('Prove that') && JSON.parse(compiled.files.get('rejects.json')).rejects.every(r => Object.keys(r).join() === 'id,reasons'), 'the rejects report holds ids and reasons only, no content');

// ── the loader ───────────────────────────────────────────────────────────────
const dir = path.join(scratch, 'pack');
writePack(dir, compiled.files);
const pack = await qb.loadPack(qb.directorySource(dir));
c.deq([pack.questionCount, pack.families.size, pack.version], [9, 2, manifest.packVersion], 'the pack loads whole');
c.deq(qb.indexOf(pack.families).map(f => [f.family, f.requestable]), [['qb-a11-ma-c1', [1, 2, 3, 4]], ['qb-x11-me-a1', [2]]], 'the picker view is what the shards hold');

const tampered = async (mutate, expect, message) => {
  const copy = path.join(scratch, `t-${crypto.randomBytes(4).toString('hex')}`);
  writePack(copy, compiled.files);
  mutate(copy);
  await c.rejects(() => qb.loadPack(qb.directorySource(copy)), expect, message);
};
await tampered(d => fs.appendFileSync(path.join(d, 'shards/qb-a11-ma-c1.json'), ' '), /does not match the manifest/, 'a shard that gained one byte is refused');
await tampered(d => { const f = path.join(d, 'shards/qb-a11-ma-c1.json'); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('"value":6', '"value":7')); }, /does not match the manifest/, 'a shard with a changed answer of the same size is refused');
await tampered(d => fs.writeFileSync(path.join(d, 'index.json'), compiled.files.get('index.json').replace('"requestable":[1,2,3,4]', '"requestable":[1,2,3]')), /does not match the manifest/, 'a changed index is refused');
await tampered(d => { const f = path.join(d, 'manifest.json'); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(manifest.packVersion, '000000000000')); }, /pack version is not the digest/, 'a manifest naming another pack version is refused');
await tampered(d => fs.unlinkSync(path.join(d, 'shards/qb-x11-me-a1.json')), /is missing/, 'a missing shard is refused');
await tampered(d => fs.writeFileSync(path.join(d, 'manifest.json'), '{"format":"other"}'), /format is not/, 'a manifest of another format is refused');
// A shard rebuilt WITH a matching manifest but a malformed question is still refused (the loader checks shapes, not only hashes).
{
  const bad = new Map(compiled.files);
  const s = JSON.parse(bad.get('shards/qb-x11-me-a1.json'));
  s.questions[0].marks = 9;
  const text = JSON.stringify(s) + '\n';
  bad.set('shards/qb-x11-me-a1.json', text);
  const m = JSON.parse(bad.get('manifest.json'));
  const e = m.shards.find(x => x.name === 'shards/qb-x11-me-a1.json');
  e.bytes = Buffer.byteLength(text); e.sha256 = sha(text);
  m.packVersion = sha(Buffer.from([m.index.sha256, ...m.shards.map(x => `${x.name}:${x.sha256}`)].join('\n'))).slice(0, 12);
  bad.set('manifest.json', JSON.stringify(m) + '\n');
  await c.rejects(() => qb.loadPack(memorySource(bad)), /marks/, 'a consistent pack holding a malformed question is refused');
}
c.eq((await qb.loadPack(memorySource(compiled.files))).questionCount, 9, 'a pack loads from any source with the same read function (memory here, a directory above)');

// ── no pack: nothing exists, nothing changes ─────────────────────────────────
qb.resetQbank();
const PRI = { PRI_EDITION: 'prithagoras' };
c.eq(await qb.ensureQbank({ ...PRI, PRI_QBANK_DIR: 'off' }), null, 'with PRI_QBANK_DIR=off nothing is loaded');
c.deq([qb.qbankStatus().configured, qb.qbankStatus().loaded], [false, false], 'and the status says so');
c.ok(!qb.isQbankFamily('qb-a11-ma-c1') && qb.qbankFamilies().length === 0, 'no bank family exists');
c.eq(sha(JSON.stringify(nswCurriculumResponse())), MAIN_CURRICULUM_SHA, 'the curriculum response is byte-identical to main\'s');
c.ok(!bankPolicy('prithagoras').issues('qb-a11-ma-c1') && !bankPolicy('priyabhata').issues('qb-a11-ma-c1'), 'neither edition issues a bank family');
await loadAllBanks();
const g = generateQuestion('y11-diff', 2, 5);
c.ok(g.authoredMarks === undefined && marksPossibleFor(g) === Math.max(1, Math.min(Math.min(4, g.difficulty), g.steps.length)), 'a generator question has no authored marks and keeps its marks rule');
const broken = path.join(scratch, 'broken');
writePack(broken, compiled.files);
fs.appendFileSync(path.join(broken, 'shards/qb-a11-ma-c1.json'), ' ');
c.eq(await qb.ensureQbank({ ...PRI, PRI_QBANK_DIR: broken }), null, 'a refused pack leaves no bank');
c.ok(qb.qbankStatus().configured && !qb.qbankStatus().loaded && /does not match/.test(qb.qbankStatus().error), 'and the status says why');
c.ok(!qb.isQbankFamily('qb-a11-ma-c1'), 'so no family exists');
qb.resetQbank();
// The committed pack is the default on a Prithagoras server and never on another edition.
c.eq(await qb.ensureQbank({ PRI_EDITION: 'priyabhata' }), null, 'on Priyabhata no bank is loaded, even by default');
c.ok(!qb.qbankStatus().configured && !qb.isQbankFamily('qb-a11-ma-c1'), 'and none exists');
c.eq(qb.packDirFor({ PRI_EDITION: 'priyabhata', PRI_QBANK_DIR: dir }), null, 'nor from a named directory');
c.eq(qb.packDirFor({ ...PRI }), qb.DEFAULT_PACK_DIR, 'on Prithagoras the default source is the committed pack');
const committed = await qb.ensureQbank({ ...PRI }, { strict: true });
c.ok(committed.questionCount > 1000 && committed.version === JSON.parse(fs.readFileSync(path.join(qb.DEFAULT_PACK_DIR, 'manifest.json'), 'utf8')).packVersion, 'the committed pack loads by default');
qb.resetQbank();
await c.rejects(() => qb.ensureQbank({ ...PRI, PRI_QBANK_DIR: broken }, { strict: true }), /does not match/, 'strict loading (the server\'s start) throws on a refused pack');
qb.resetQbank();

// ── a loaded pack, below the routes ──────────────────────────────────────────
qb.installPack(pack);
c.ok(qb.isQbankFamily('qb-a11-ma-c1') && !bankPolicy('priyabhata').issues('qb-a11-ma-c1') && bankPolicy('prithagoras').issues('qb-a11-ma-c1'), 'a loaded pack is issued by Prithagoras and never by Priyabhata');
c.ok(!bankPolicy('prithagoras').issues('qb-a11-ma-zz'), 'a family the pack does not hold is not issued');
const a1 = qb.qbankGenerate('qb-a11-ma-c1', 2, 1234), a2 = qb.qbankGenerate('qb-a11-ma-c1', 2, 1234);
c.ok(JSON.stringify(a1) === JSON.stringify(a2), 'the same family, level and seed draw the same question');
let thrown = 0;
for (const f of [() => qb.qbankGenerate('qb-x11-me-a1', 1, 1), () => qb.qbankGenerate('qb-a11-ma-c1', 2, 1, 'qb-a11-ma-c1.C9.9z'), () => qb.qbankGenerate('qb-zz', 1, 1)]) { try { f(); } catch { thrown++; } }
c.eq(thrown, 3, 'a level, dot point or family with no question is not drawn');
const idq = qb.qbankGenerate('qb-x11-me-a1', 2, 1);
const sealedHere = JSON.parse(JSON.stringify(idq));
c.ok(sealForEdition(sealedHere, bankPolicy('prithagoras')) && sealedHere._marking === FINAL_ANSWER_MARKING && sealedHere._curriculum.outcomes.some(o => o.code === 'ME1-11-05'), 'a bank question is sealed final-answer-only with the outcomes its topic is located at');
// The generic step rule, approved, must never be stamped on a bank question (this phase pays no step marks).
approveSchemeTypesForTests([{ typeId: GENERIC_ID, digest: genericDigest() }]);
const withApproval = JSON.parse(JSON.stringify(qb.qbankGenerate('qb-a11-ma-c1', 2, 1)));
c.ok(sealForEdition(withApproval, bankPolicy('prithagoras')) && withApproval._methodScheme === undefined && withApproval._marking === FINAL_ANSWER_MARKING, 'even with the generic step rule approved, a bank question is sealed final-answer-only');
approveSchemeTypesForTests([]);
c.ok(marksPossibleFor(withApproval) === withApproval.authoredMarks && withApproval.authoredMarks >= 1, 'the authored marks are what the question is worth');
qb.resetQbank();

// ── the routes, no pack ──────────────────────────────────────────────────────
const sealedOf = async (h, accountId, qid) => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=?", [accountId, qid])).response_json);
{
  const h = await startApp({ engine: requestedEngine() });
  try {
    const a = await registerAccount(h, { email: 'qbank.none@example.test', deviceId: 'ipad-qbank-none' });
    await verifyEmail(h, a.account.id);
    const r = await h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body: { generator: 'qb-a11-ma-c1', difficulty: 2, seed: 7, curriculum: 'nsw' } });
    c.deq([r.status, r.data.error.code], [422, 'PRACTICE_BANK_OUTSIDE_CURRICULUM'], 'with no pack a bank family is refused as outside the curriculum');
    const cur = await h.request('/v1/curriculum', { jar: a.jar });
    c.eq(sha(JSON.stringify(cur.data)), MAIN_CURRICULUM_SHA, 'the served curriculum is main\'s, byte for byte');
    const own = await h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body: { generator: 'y11-diff', difficulty: 2, seed: 7, curriculum: 'nsw' } });
    c.eq(own.status, 201, 'a generator question is issued as before');
  } finally { await h.close(); }
}

// ── the server refuses to start on a damaged pack ────────────────────────────
process.env.PRI_QBANK_DIR = broken;
qb.resetQbank();
await c.rejects(() => startApp({ engine: requestedEngine() }), /does not match/, 'a server pointed at a damaged pack does not start');

// ── the routes, with the pack ────────────────────────────────────────────────
process.env.PRI_QBANK_DIR = dir;
qb.resetQbank();
const h = await startApp({ engine: requestedEngine() });
const PRIVATE_KEYS = /"(?:answer|steps|criteria|traps|stepcheck|authoredMarks|authoredDifficulty|_bank|seed|solution|key)"\s*:/;
try {
  const a = await registerAccount(h, { email: 'qbank.pack@example.test', deviceId: 'ipad-qbank' });
  c.eq((await verifyEmail(h, a.account.id)).status, 200, 'a verified student exists');
  const issue = body => h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body: { curriculum: 'nsw', ...body } });
  const submit = (qid, id, answer) => h.request(`/v1/practice/${qid}/submit`, { method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': id }, body: { submissionId: id, answer, mode: 'typed' } });

  const cur = await h.request('/v1/curriculum', { jar: a.jar });
  const fam = cur.data.authorBank?.families.find(f => f.family === 'qb-a11-ma-c1');
  c.ok(cur.data.authorBank?.version === manifest.packVersion && cur.data.authorBank.questions === 9 && fam?.requestable.join() === '1,2,3,4' && fam.outcomes.includes('MAV-11-06'), 'the curriculum response lists the loaded bank under one key, with the outcomes its topic is located at');
  c.ok(fam.dotpoints.some(d => d.id === 'qb-a11-ma-c1.C1.3a'), 'and its dot points');
  const { authorBank, ...rest } = cur.data;
  c.eq(sha(JSON.stringify(rest)), MAIN_CURRICULUM_SHA, 'every other entry of the response is main\'s, byte for byte');
  c.ok(!/Differentiate|gradient|Fixture/.test(JSON.stringify(authorBank)), 'and it carries no question text');

  /** The next issue of exactly this pack question: the dot point and level name its pool, a fixed seed draws from it. */
  let seed = 100;
  const drawn = new Map();
  const issueExact = async entry => {
    for (let i = 0; i < 300; i++) {
      const r = await issue({ generator: `qb-${entry.course}`, difficulty: entry.level, dotpoint: `qb-${entry.course}.${entry.dp}`, seed: (seed += 11) });
      c.ok(r.status === 201, `issue ${entry.id}`);
      const sealed = await sealedOf(h, a.account.id, r.data.question.id);
      if (sealed._bank === entry.id) return { question: r.data.question, sealed, wire: JSON.stringify(r.data) };
    }
    throw new Error(`never drew ${entry.id}`);
  };
  const entries = [];
  for (const s of manifest.shards) for (const q of JSON.parse(fs.readFileSync(path.join(dir, s.name), 'utf8')).questions) entries.push({ ...q, course: s.name.replace(/^shards\/qb-|\.json$/g, '') });
  c.eq(entries.length, 9, 'the nine pack questions are all drawn below');
  const allowed = new Set([...PUBLIC_QUESTION_FIELDS, 'id', 'supportsSteps', 'criteriaCount']);

  for (const e of entries) {
    const { question, sealed, wire } = await issueExact(e);
    const tag = e.id;
    drawn.set(e.id, question.id);
    c.deq(Object.keys(question).filter(k => !allowed.has(k)), [], `${tag}: the issued question holds public fields only`);
    c.ok(!PRIVATE_KEYS.test(wire), `${tag}: no private field name is on the wire`);
    const secrets = [e.steps.map(s => s.d), e.criteria.map(x => x.point), e.traps.map(t => t.why), e.title].flat();
    c.ok(secrets.every(t => !wire.includes(t)), `${tag}: no step, criterion, trap reason or title is on the wire`);
    const keyText = acceptedInput(e);
    c.ok(!wire.includes(JSON.stringify(e.answer)) && !(e.answerType === 'expression' && wire.includes(e.answer.expr)), `${tag}: the key is not on the wire`);
    c.deq([question.criteriaCount, question.supportsSteps === true || question.supportsSteps === false], [e.marks, true], `${tag}: the device is told the authored marks and nothing more`);
    c.ok(question.hints.length === 3 && question.hints.every(t => !keyText || t !== keyText), `${tag}: the three authored hints are served`);
    c.ok(question.dotpoint === `qb-${e.course}.${e.dp}` && question.difficulty === e.level && question.subtopic === `qb-${e.course}`, `${tag}: it is the dot point and level asked for`);
    c.deq([sealed._marking, sealed._methodScheme, sealed.authoredMarks, sealed.criteria.length > 0], [FINAL_ANSWER_MARKING, undefined, e.marks, true], `${tag}: sealed final-answer-only, with its authored marks and criteria held server-side`);
    c.ok(sealed._curriculum.outcomes.length > 0 && sealed._curriculum.jurisdiction === 'NSW', `${tag}: sealed with a curriculum identity`);
  }

  // marking: a wrong answer, a trap (his reason shown when the question resolves), and the right answer, each on a fresh issue
  let trapsNamed = 0, rights = 0;
  for (const e of entries) {
    const right = await issueExact(e);
    const done = await submit(right.question.id, `right-${e.id}`.replace(/\W/g, '-').padEnd(10, 'x'), acceptedInput(e));
    c.deq([done.data.correct, done.data.resolved, done.data.marksEarned, done.data.marksPossible], [true, true, e.marks, e.marks], `${e.id}: the right answer is marked correct for the authored marks`);
    c.ok(done.data.solution?.steps?.length === e.steps.length && done.data.solution.steps[0].d === e.steps[0].d, `${e.id}: the worked solution is shown once it resolves`);
    rights++;
    const wrong = await issueExact(e);
    const bad = e.answerType === 'point' ? '(100, 100)' : e.answerType === 'set' ? '99' : e.answerType === 'interval' ? 'x > 100' : e.answerType === 'equation' ? 'y = 99*x' : '987654';
    const w1 = await submit(wrong.question.id, `wrong1-${e.id}`.replace(/\W/g, '-').padEnd(10, 'x'), bad);
    c.deq([w1.data.correct, w1.data.resolved, w1.data.marksEarned], [false, false, 0], `${e.id}: a wrong answer is not marked correct and leaves the question open`);
    c.ok(!('solution' in w1.data) && !JSON.stringify(w1.data).includes(e.steps[0].d), `${e.id}: an open try reveals no solution`);
    for (const [i, t] of e.traps.entries()) {
      if (trapInput(t) === null) continue;
      const trap = await issueExact(e);
      const t1 = await submit(trap.question.id, `trap1-${e.id}-${i}`.replace(/\W/g, '-').padEnd(10, 'x'), trapInput(t));
      const t2 = await submit(trap.question.id, `trap2-${e.id}-${i}`.replace(/\W/g, '-').padEnd(10, 'x'), trapInput(t));
      c.ok(t1.data.correct === false && t2.data.correct === false && t2.data.resolved === true, `${e.id}: trap ${i} is never marked correct`);
      if (t.value !== undefined || t.expr !== undefined || t.region !== undefined) { c.eq(t2.data.trapWhy, t.why, `${e.id}: his reason for trap ${i} is shown`); trapsNamed++; }
    }
  }
  c.ok(rights === 9 && trapsNamed >= 4, 'every question was marked, and four traps are named by the engine (set, equation and point traps are refused unnamed)');

  // the hint ladder serves a rung, and it is not the answer
  const hq = await issueExact(entries.find(e => e.id === 'TQ-001'));
  const nudge = await h.request(`/v1/practice/${hq.question.id}/hint`, { method: 'POST', jar: a.jar, body: { rung: 'nudge' } });
  c.ok(nudge.status === 200 && typeof nudge.data.hint === 'string' && nudge.data.hint.length > 0 && !/\b6\b/.test(nudge.data.hint.replace(/\$[^$]*\$/g, '')), 'the existing hint path serves the authored nudge');

  // a bank question is never offered to Priyabhata's request shape, and an unknown dot point is refused
  const off = await issue({ generator: 'qb-a11-ma-c1', difficulty: 2, dotpoint: 'qb-a11-ma-c1.C9.9z', seed: 5 });
  c.eq(off.status, 422, 'a dot point the family does not hold is refused');
  const lvl = await issue({ generator: 'qb-x11-me-a1', difficulty: 4, seed: 5 });
  c.eq(lvl.status, 422, 'a level the family does not hold is refused');
  const unsigned = await h.request('/v1/practice/prepare', { method: 'POST', body: { generator: 'qb-a11-ma-c1', difficulty: 2, curriculum: 'nsw' } });
  c.ok(unsigned.status === 200 && !PRIVATE_KEYS.test(JSON.stringify(unsigned.data)), 'a signed-out preparation carries public fields only');
} finally {
  await h.close();
  for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
  fs.rmSync(scratch, { recursive: true, force: true });
}
console.log(`QBANK PACK: PASS — ${c.count()}/${c.count()} checks`);
process.exit(0);
