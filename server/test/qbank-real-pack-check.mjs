// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the COMMITTED author question bank (server/content/qbank), every question
//
// The owner's own authored questions, compiled by tools/qbank-import.mjs. For each packed question: the accepted answer is marked correct by
// the engine, each trap is not, the authored marks are what it is worth, it seals final-answer-only with a curriculum identity, no hint or
// hint-ladder rung states the answer, and its public form (what a device is sent) carries none of the key, steps, criteria or trap reasons.
// Then a sample goes through the real /v1 routes. Not evidence about real students; a check that the engine and the pack agree.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const keys = ['NODE_ENV', 'PRI_OFFERING', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_FREE_PRACTICE_PER_DAY', 'PRI_EDITION', 'PRI_QBANK_DIR'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'pri-qbank-real-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = path.join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'c5'.repeat(32);
process.env.PRI_FREE_PRACTICE_PER_DAY = '1000000';
process.env.PRI_EDITION = 'prithagoras';
process.env.PRI_OFFERING = 'catalogue';
delete process.env.PRI_QBANK_DIR;   // the committed pack, by default

const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const qb = await import('../platform/qbankPack.js');
const { checkAnswer } = await import('../../client/src/engine/checker.js');
const { bankPolicy, sealForEdition, FINAL_ANSWER_MARKING } = await import('../platform/editionBanks.js');
const { marksPossibleFor, markerView, stepEvidence } = await import('../platform/markerOps.js');
const { productPlaceOf } = await import('../platform/qbankDotpoints.js');
const { dotpointById } = await import('../../client/src/engine/curriculum.js');
const { safeQuestion } = await import('../platform/practice.js');
const { acceptedInput, trapInput, hintLeaks, authoredPage } = await import('../../tools/qbank-import.mjs');

const c = checks();
const pack = await qb.ensureQbank(process.env, { strict: true });
c.ok(pack && pack.questionCount > 1500 && pack.families.size >= 24, 'the committed pack loads by default on a Prithagoras server');

// ── every packed question ────────────────────────────────────────────────────
const manifest = JSON.parse(fs.readFileSync(path.join(qb.DEFAULT_PACK_DIR, 'manifest.json'), 'utf8'));
const entries = [];
for (const s of manifest.shards) for (const e of JSON.parse(fs.readFileSync(path.join(qb.DEFAULT_PACK_DIR, s.name), 'utf8')).questions) entries.push({ ...e, family: s.name.replace(/^shards\/|\.json$/g, '') });
c.eq(entries.length, pack.questionCount, 'every packed question is visited');
const policy = bankPolicy('prithagoras');
let displayed = 0, badDisplay = 0, hinted = 0, hintIsAnswer = 0, crossed = 0, ticked = 0, traps = 0, rungs = 0, accepted = 0, sealed = 0, marksOk = 0, leaks = 0, openers = 0;
const bad = { accepted: [], trap: [], marks: [], seal: [], wire: [], hint: [] };
for (const e of entries) {
  const full = qb.qbankEntryQuestion(e.id, 17);
  const q = markerView(full);   // what the marker is shown
  const given = acceptedInput(e);
  if (checkAnswer(q, given)?.correct === true) accepted++; else bad.accepted.push(e.id);
  for (const t of e.traps) {
    const input = trapInput(t);
    if (input === null) continue;
    traps++;
    if (checkAnswer(q, input)?.correct === true) bad.trap.push(e.id);
  }
  if (marksPossibleFor(full) === e.marks) marksOk++; else bad.marks.push(e.id);
  const sq = JSON.parse(JSON.stringify(full));
  sq._generator = full.subtopic;
  if (sealForEdition(sq, policy) && sq._marking === FINAL_ANSWER_MARKING && sq._methodScheme === undefined && sq._curriculum?.outcomes?.length) sealed++; else bad.seal.push(e.id);
  if (full.answerDisplay) { displayed++; const m = full.answerDisplay.match(/(-?\d+)\/(\d+)$/); if (!m || Math.abs(Number(m[1]) / Number(m[2]) - e.answer.value) > 1e-9) badDisplay++; }
  if (full.inputHint) { hinted++; if (checkAnswer(q, String(full.inputHint).replace(/^e\.g\.\s*/i, ''))?.correct === true) hintIsAnswer++; }
  // Line marking never crosses a true line: the author's own worked steps, typed as a student's working through the marker as the product runs it
  // (the marker's view of the question), are crossed nowhere. A line it cannot judge stays unjudged; there is no page of crosses to hide.
  const page = authoredPage(q);
  if (page.length) {
    const rep = stepEvidence(full, given ?? '', page.join('\n'), checkAnswer(q, given))?.stepReport;
    if (rep?.lines?.some(l => l.status === 'break')) crossed++;
    else if (rep?.lines?.some(l => l.status === 'ok')) ticked++;
  }
  // What a device is sent: public fields only, and none of the sealed material in them.
  const wire = JSON.stringify(safeQuestion('00000000-0000-4000-8000-000000000000', full));
  const secrets = [...e.steps.map(s => s.d), ...e.criteria.map(x => x.point), ...e.traps.map(t => t.why)].filter(t => t.length >= 12 && !e.hints.some(h => h.includes(t) || t.includes(h)) && !e.prompt.includes(t));   // authored hints and the prompt are public by design; a step that restates one is not a leak of the step
  if (/"(?:answer|steps|criteria|traps|stepcheck|authoredMarks|_bank|seed)"\s*:/.test(wire) || secrets.some(t => wire.includes(t))) { leaks++; bad.wire.push(e.id); }
  // The authored hints are public and the ladder serves rungs: none states the answer.
  const hl = hintLeaks(full);
  rungs += e.hints.length;
  if (hl.length) bad.hint.push(`${e.id}:${hl.join('+')}`);
}
c.eq(accepted, entries.length, `every accepted answer is marked correct (${accepted})`);
c.deq(bad.accepted, [], 'no packed key is refused');
c.ok(traps > 1200, `every trap is a wrong answer (${traps} tried)`);
c.deq(bad.trap, [], 'and none is marked correct');
c.eq(marksOk, entries.length, 'every question is worth the marks its author set');
c.eq(sealed, entries.length, 'every question seals final-answer-only with a curriculum identity and no method scheme');
c.eq(crossed, 0, `no line of any authored worked solution is crossed by the step report (${ticked} questions have at least one line ticked)`);
c.ok(ticked > 1000, 'the step report ticks the author\'s lines where it can');
c.ok(hinted > 150 && hintIsAnswer === 0, `a set, interval, equation or point shows the form it is written in (${hinted} do) and no shown form is the answer`);
c.ok(displayed > 50 && badDisplay === 0, `a worked solution states a fraction key as the fraction it is (${displayed} do) and each is the author's value`);
c.eq(leaks, 0, 'no public form carries a key, a step, a criterion or a trap reason');
c.deq(bad.hint, [], `no hint or hint-ladder rung states the answer (${rungs} authored hints)`);
// the loader's own view of the families against the picker
const fams = qb.qbankFamilies();
c.ok(fams.every(f => f.requestable.length > 0 && f.dotpoints.every(d => d.requestable.length > 0)), 'every family and dot point has a question at some level');
c.eq(fams.reduce((n, f) => n + f.questions, 0), entries.length, 'the picker view accounts for every question');
c.eq(qb.qbankEntries().filter(x => !x.place).length, 0, 'every question is placed in a product subtopic');

// ── a sample through the real routes ─────────────────────────────────────────
const h = await startApp({ engine: requestedEngine() });
try {
  let a = null, used = 0, acct = 0, generators = 0;
  const fresh = async () => { acct++; a = await registerAccount(h, { email: `qbank.real${acct}@example.test`, deviceId: `ipad-qbank-real-${acct}` }); await verifyEmail(h, a.account.id); used = 0; };
  await fresh();
  let seed = 1000, rnd = 4242;
  const rand = () => (rnd = (Math.imul(rnd, 1103515245) + 12345) >>> 0) / 2 ** 32;
  const call = async (path_, body, headers = {}) => { if (path_.endsWith('/issue')) used++; return h.request(path_, { method: 'POST', jar: a.jar, headers, body }); };
  const draw = async () => {
    // A student asks for a subtopic (or a dot point) and a level; the mix rule decides whether this draw is an authored question. Ask until it is.
    for (;;) {
      if (used >= 80) await fresh();   // a new account only between questions, never between an issue and its answers
      const pick = entries[Math.floor(rand() * entries.length)];
      const place = productPlaceOf(pick.family, pick.dp);
      const dp = place.ordinal === null ? null : dotpointById(`${place.subtopic}.${place.ordinal + 1}`);
      const asked = dp && dp.forms.includes(pick.level) ? { dotpoint: dp.id } : {};
      const r = await call('/v1/practice/issue', { curriculum: 'nsw', generator: place.subtopic, difficulty: pick.level, ...asked, seed: (seed += 7919) % 0x7fffffff });
      c.eq(r.status, 201, `issue ${place.subtopic} level ${pick.level}`);
      const row = await h.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=?", [a.account.id, r.data.question.id]);
      const sealedQ = JSON.parse(row.response_json);
      if (typeof sealedQ._bank === 'string') return { question: r.data.question, sealed: sealedQ, e: entries.find(x => x.id === sealedQ._bank) };
      generators++;
    }
  };
  const n = Number(process.env.PRI_QBANK_SAMPLE || 60);
  let rightOk = 0, marksEq = 0, trapSent = 0, trapNot = 0, named = 0, matchable = 0;
  for (let i = 0; i < n; i++) {
    const { question, e } = await draw();
    const done = await call(`/v1/practice/${question.id}/submit`, { submissionId: `real-right-${i}-x`, answer: acceptedInput(e), mode: 'typed' }, { 'Idempotency-Key': `real-right-${i}-x` });
    if (done.data.correct === true && done.data.resolved === true) rightOk++;
    if (done.data.marksEarned === e.marks && done.data.marksPossible === e.marks) marksEq++;
  }
  for (let i = 0; i < n; i++) {
    let d = await draw(), guard = 0;
    while (!d.e.traps.some(t => trapInput(t) !== null) && guard++ < 40) d = await draw();
    const usable = d.e.traps.filter(t => trapInput(t) !== null), t = usable[i % usable.length];
    const w1 = await call(`/v1/practice/${d.question.id}/submit`, { submissionId: `real-trap-${i}-a`, answer: trapInput(t), mode: 'typed' }, { 'Idempotency-Key': `real-trap-${i}-a` });
    const w2 = await call(`/v1/practice/${d.question.id}/submit`, { submissionId: `real-trap-${i}-b`, answer: trapInput(t), mode: 'typed' }, { 'Idempotency-Key': `real-trap-${i}-b` });
    trapSent++;
    if (w1.data.correct === false && w2.data.correct === false) trapNot++;
    if (t.value !== undefined || t.expr !== undefined || t.region !== undefined) { matchable++; if (w2.data.trapWhy === t.why || w2.data.feedback) named++; }
  }
  c.eq(rightOk, n, `${n} random bank questions marked correct with the accepted answer`);
  c.eq(marksEq, n, 'each for the authored marks');
  c.eq(trapNot, trapSent, `${trapSent} trap answers, none marked correct`);
  c.ok(named >= matchable - 3, 'a trap the engine can name resolves with feedback');
  c.ok(generators > 0, 'the generators still serve their share of the draws');
  console.log(`  sample: ${n} accepted, ${trapSent} traps, ${generators} generator draws passed over, ${acct} accounts`);
} finally {
  await h.close();
  for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
  fs.rmSync(scratch, { recursive: true, force: true });
}
console.log(`QBANK REAL PACK: PASS — ${c.count()}/${c.count()} checks over ${entries.length} questions`);
process.exit(0);
