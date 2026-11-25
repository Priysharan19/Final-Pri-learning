// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the COMMITTED author question bank (server/content/qbank), every question
//
// The owner's own authored questions, compiled by tools/qbank-import.mjs. For each packed question: the accepted answer is marked correct by
// the engine, each trap is not, the authored marks are what it is worth, it seals final-answer-only with a curriculum identity, no hint or
// hint-ladder rung states the answer, and its public form (what a device is sent) carries none of the key, steps, criteria or trap reasons.
// Then a sample goes through the real /v1 routes. Not evidence about real students; a check that the engine and the pack agree.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import crypto from 'node:crypto';
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
const { checkBankAnswer } = await import('../platform/qbankMarking.js');
const { buildHintLadder, ladderAvailable } = await import('../../client/src/engine/hintLadder.js');
const { leakReason, rungDropReason, isMethodName } = await import('../../tools/qbank-leak.mjs');
const { bankPolicy, sealForEdition, FINAL_ANSWER_MARKING } = await import('../platform/editionBanks.js');
const { marksPossibleFor, markerView, stepEvidence } = await import('../platform/markerOps.js');
const { productPlaceOf } = await import('../platform/qbankDotpoints.js');
const { dotpointById } = await import('../../client/src/engine/curriculum.js');
const { safeQuestion } = await import('../platform/practice.js');
const { acceptedInput, trapInput, hintLeaks, authoredPage } = await import('../../tools/qbank-import.mjs');
const { plausibleWrongs } = await import('../../tools/qbank-manual.mjs');

const c = checks();
const pack = await qb.ensureQbank(process.env, { strict: true });
c.ok(pack && pack.questionCount > 1500 && pack.families.size >= 24, 'the committed pack loads by default on a Prithagoras server');

// ── every packed question ────────────────────────────────────────────────────
const manifest = JSON.parse(fs.readFileSync(path.join(qb.DEFAULT_PACK_DIR, 'manifest.json'), 'utf8'));
const entries = [];
for (const s of manifest.shards) for (const e of JSON.parse(fs.readFileSync(path.join(qb.DEFAULT_PACK_DIR, s.name), 'utf8')).questions) entries.push({ ...e, family: s.name.replace(/^shards\/|\.json$/g, '') });
c.eq(entries.length, pack.questionCount, 'every packed question is visited');
const policy = bankPolicy('prithagoras');
// An exact-form expression key that is a constant (e^2/4, -pi^2) follows the SAME rounding rule as a numeric key (qbankMarking.js): where the question
// asks for no exact form and names no precision, a correct rounding to 3 or more significant figures is accepted as well as the exact form; where it asks
// for an exact value, a decimal stays refused. Never 2 figures, a truncation that is not a rounding, or a value merely near.
{
  const { acceptsRoundedFigures, roundSignificant, typedDecimal } = await import('../platform/qbankMarking.js');
  const { parse, normalize, evaluate, variablesOf } = await import('../../client/src/engine/expr.js');
  const valueOfKey = expr => { try { const ast = parse(normalize(expr)); return [...variablesOf(ast)].some(v => v !== 'e') ? null : evaluate(ast, {}); } catch { return null; } };
  const constants = entries.filter(e => e.answerType === 'expression' && Number.isFinite(valueOfKey(e.answer.expr)));
  const covered = [], exact = [], bad = [];
  // Only what the bank's rule ADDS is judged: a value the engine itself already accepts is the engine's own reading.
  const added = (q, text) => checkBankAnswer(q, text)?.correct === true && checkAnswer(q, text)?.correct !== true;
  for (const e of constants) {
    const q = markerView(qb.qbankEntryQuestion(e.id, 17));
    const value = valueOfKey(e.answer.expr);
    if (!Number.isFinite(value)) continue;
    if (acceptsRoundedFigures(q)) {
      covered.push(e.id);
      const r3 = roundSignificant(value, 3), r4 = roundSignificant(value, 4), r2 = roundSignificant(value, 2);
      const trunc = Math.trunc(value * 1000) / 1000;
      if (checkBankAnswer(q, String(r3))?.correct !== true || checkBankAnswer(q, String(r4))?.correct !== true) bad.push(`${e.id}: a correct rounding is refused`);
      if (added(q, String(r2)) && r2 !== r3) bad.push(`${e.id}: 2 s.f. accepted`);
      if (trunc !== roundSignificant(value, typedDecimal(String(trunc))[1]) && added(q, String(trunc))) bad.push(`${e.id}: a truncation accepted`);
      if (added(q, String(+(value * 1.01).toPrecision(4)))) bad.push(`${e.id}: a near value accepted`);
      if (checkBankAnswer(q, e.answer.expr)?.correct !== true) bad.push(`${e.id}: the exact form is refused`);
    } else {
      exact.push(e.id);
      if (added(q, String(roundSignificant(value, 4)))) bad.push(`${e.id}: a decimal accepted where it is not covered`);
    }
  }
  c.deq(bad, [], 'a constant exact-form key accepts correct roundings only where the rule covers it, and nothing else');
  for (const id of ['A12-C2-201', 'A12-C2-207', 'X12-C2-184']) c.ok(covered.includes(id), `${id}: a prompt with no exact-form wording accepts a correct rounding as well as the exact form`);
  for (const id of ['X12-C2-193', 'X12-C2-214', 'A12-C4-212', 'X12-C3-209']) c.ok(exact.includes(id), `${id}: a prompt asking for an exact value refuses a decimal`);
  console.log(`  constant-valued expression keys: ${constants.length}; the rounding rule covers ${covered.length} (${covered.join(', ')}); exact only ${exact.length}`);
}
// A key DERIVED from his own printed answer (a "find" part with no structured key) is held to more than an authored one: his own form is marked
// correct in every natural way of typing it (the importer's `derivedForms`: as read, brackets taken out, π, a rearrangement, a plain decimal where it
// is one), and at least three plausible wrong values are refused, by the real marker with the question's own answer type.
{
  const derivedQs = entries.filter(e => e.derived === true);
  c.ok(derivedQs.length > 50, `the pack holds derived keys (${derivedQs.length})`);
  const noForms = [], formRefused = [], fewWrongs = [], wrongAccepted = [];
  let forms = 0, wrongs = 0;
  for (const e of derivedQs) {
    const q = markerView(qb.qbankEntryQuestion(e.id, 17));
    if (!Array.isArray(e.derivedForms) || !e.derivedForms.length) { noForms.push(e.id); continue; }
    for (const f of e.derivedForms) { forms++; if (checkBankAnswer(q, f)?.correct !== true) formRefused.push(`${e.id}: ${f}`); }
    const w = plausibleWrongs({ answerType: e.answerType, answer: e.answer }).slice(0, 6);
    if (w.length < 3) fewWrongs.push(e.id);
    for (const t of w) { wrongs++; if (checkBankAnswer(q, t)?.correct === true) wrongAccepted.push(`${e.id}: ${t}`); }
  }
  c.deq(noForms, [], 'every derived key records the typed forms of his answer that were proved');
  c.deq(formRefused, [], `his own answer, as ${forms} natural typed forms, is marked correct on every derived question`);
  c.deq(fewWrongs, [], 'every derived key has at least three plausible wrong values to refuse');
  c.deq(wrongAccepted, [], `and the real marker refuses all ${wrongs} of them`);
}
let rungsShown = 0, rungsTested = 0, authoredHints = 0, withRungs = { 0: 0, 1: 0, 2: 0, 3: 0 }, noLadderNoHints = 0, noNudge = 0, displayed = 0, badDisplay = 0, hinted = 0, hintIsAnswer = 0, crossed = 0, ticked = 0, traps = 0, rungs = 0, accepted = 0, sealed = 0, marksOk = 0, leaks = 0, openers = 0;
const bad = { accepted: [], trap: [], marks: [], seal: [], wire: [], hint: [] };
for (const e of entries) {
  const full = qb.qbankEntryQuestion(e.id, 17);
  const q = markerView(full);   // what the marker is shown
  const given = acceptedInput(e);
  if (checkBankAnswer(q, given)?.correct === true) accepted++; else bad.accepted.push(e.id);
  for (const t of e.traps) {
    const input = trapInput(t);
    if (input === null) continue;
    traps++;
    if (checkBankAnswer(q, input)?.correct === true) bad.trap.push(e.id);
  }
  if (marksPossibleFor(full) === e.marks) marksOk++; else bad.marks.push(e.id);
  const sq = JSON.parse(JSON.stringify(full));
  sq._generator = full.subtopic;
  if (sealForEdition(sq, policy) && sq._marking === FINAL_ANSWER_MARKING && sq._methodScheme === undefined && sq._curriculum?.outcomes?.length) sealed++; else bad.seal.push(e.id);
  if (full.answerDisplay) { displayed++; const m = full.answerDisplay.match(/(-?\d+)\/(\d+)$/); if (!m || Math.abs(Number(m[1]) / Number(m[2]) - e.answer.value) > 1e-9) badDisplay++; }
  if (full.inputHint) { hinted++; if (checkBankAnswer(q, String(full.inputHint).replace(/^e\.g\.\s*/i, ''))?.correct === true) hintIsAnswer++; }
  // Line marking never crosses a true line: the author's own worked steps, typed as a student's working through the marker as the product runs it
  // (the marker's view of the question), are crossed nowhere. A line it cannot judge stays unjudged; there is no page of crosses to hide.
  const page = authoredPage(q);
  if (page.length) {
    const rep = stepEvidence(full, given ?? '', page.join('\n'), checkBankAnswer(q, given))?.stepReport;
    if (rep?.lines?.some(l => l.status === 'break')) crossed++;
    else if (rep?.lines?.some(l => l.status === 'ok')) ticked++;
  }
  // What a device is sent: public fields only, and none of the sealed material in them.
  const wire = JSON.stringify(safeQuestion('00000000-0000-4000-8000-000000000000', full));
  // Every text sealed until the question resolves: a step (its heading and its text), a criterion (its point and its line), a trap (its reason and its
  // answer as text), the title. None is on the wire, in a hint or anywhere else: the hints are sent when the question is issued, so a hint that
  // is, or holds, one of them is a leak of it. Only the prompt (public by design) may restate a text of the solution.
  const secrets = [...e.steps.flatMap(s => [s.d, s.h]), ...e.criteria.flatMap(x => [x.point, x.line]), ...e.traps.flatMap(t => [t.why, typeof t.expr === 'string' ? t.expr : null]), e.title].filter(t => typeof t === 'string' && t.length >= 12 && !e.prompt.includes(t) && !isMethodName(t));
  if (/"(?:answer|steps|criteria|traps|stepcheck|authoredMarks|_bank|seed)"\s*:/.test(wire) || secrets.some(t => wire.includes(t))) { leaks++; bad.wire.push(e.id); }
  // The ladder is his authored hints and nothing else, 0 to 3 of them. The SAME rule that chose them is run again over every rung the server
  // can serve and every hint sent at issue, on the question exactly as it is issued: none states the answer in any form, none is an arithmetic
  // expression that evaluates to it, none is a criterion line or a trap expression or reason, none holds a sealed text, none is empty, a single
  // word, or thin, and none is identical to another field sent at issue (the prompt, the answer box's own hint or label, another rung).
  const ctx = { title: e.title, criteria: e.criteria, steps: e.steps, traps: e.traps };
  const ladder = buildHintLadder(full);
  const served = ladder.filter(r => r.text).map(r => r.text);
  const sent = full.hints;
  authoredHints += 3;
  withRungs[sent.length]++;
  rungsShown += served.length; rungsTested += sent.length + served.length;
  if (JSON.stringify(sent) !== JSON.stringify(e.hints) || JSON.stringify(served) !== JSON.stringify(e.hints) || sent.length > 3) bad.hint.push(`${e.id}:rungs-are-not-the-hints`);
  if (ladderAvailable(full) !== (sent.length > 0)) bad.hint.push(`${e.id}:ladder-offered-with-no-rung-or-withheld-with-one`);
  for (const t of [...sent, ...served]) { const why = rungDropReason(full, t, ctx) || leakReason(full, t); if (why) bad.hint.push(`${e.id}:rung:${t.slice(0, 30)}:${why.slice(0, 40)}`); }
  const wireFields = Object.entries(JSON.parse(wire).question ?? JSON.parse(wire)).filter(([k, v]) => typeof v === 'string' && k !== 'id' && k !== 'hints').map(([, v]) => v.trim().toLowerCase());
  for (const t of sent) if (wireFields.includes(t.trim().toLowerCase())) bad.hint.push(`${e.id}:rung-identical-to-a-field-sent-at-issue`);
  if (new Set(sent.map(t => t.trim().toLowerCase())).size !== sent.length) bad.hint.push(`${e.id}:two-rungs-identical`);
  const hl = hintLeaks(full, ctx);
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
c.deq(bad.hint, [], `every rung of every packed question passes the rung rule again: ${rungs} hints kept of ${authoredHints} authored, ${rungsTested} rung texts tested (sent at issue and served), none states the answer or is sealed text`);
c.eq(withRungs[0] + withRungs[1] + withRungs[2] + withRungs[3], entries.length, 'every question has 0 to 3 rungs');
c.ok(rungs === withRungs[1] + 2 * withRungs[2] + 3 * withRungs[3] && rungs > entries.length, 'the rung counts agree with the hints kept');
console.log(`  rungs kept ${rungs} of ${authoredHints} authored, dropped ${authoredHints - rungs}; questions with 3 rungs ${withRungs[3]}, 2 ${withRungs[2]}, 1 ${withRungs[1]}, 0 ${withRungs[0]}`);
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
      if (typeof sealedQ._bank === 'string') return { question: r.data.question, sealed: sealedQ, e: entries.find(x => x.id === sealedQ._bank), wire: JSON.stringify(r.data) };
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
  // The leak sweep over the routes: 300 bank questions as a student is dealt them. The issue reply holds no step, criterion, trap reason or title, no
  // hint is a sealed text or states the answer, and each rung the hint route serves is one of the hints sent, in order; a question with no rung is
  // refused the hint route (the control is not offered for it).
  {
    const sweepN = Number(process.env.PRI_QBANK_SWEEP || 300);
    let sweepLeaks = 0, rungsServed = 0, refused = 0, swept = 0, figuresSwept = 0;
    const problems = [];
    const seenIds = new Set();
    for (let i = 0; i < sweepN; i++) {
      const d = await draw();
      const e = d.e;
      swept++; seenIds.add(e.id);
      const secrets = [...e.steps.flatMap(s => [s.d, s.h]), ...e.criteria.flatMap(x => [x.point, x.line]), ...e.traps.flatMap(t => [t.why, typeof t.expr === 'string' ? t.expr : null]), e.title].filter(t => typeof t === 'string' && t.length >= 12 && !e.prompt.includes(t) && !isMethodName(t));
      const jsonText = t => JSON.stringify(t).slice(1, -1);
      if (secrets.some(t => d.wire.includes(jsonText(t)))) { sweepLeaks++; problems.push(`${e.id}: a sealed text is in the issue reply`); }
      const sent = d.question.hints;
      if (JSON.stringify(sent) !== JSON.stringify(e.hints)) problems.push(`${e.id}: the hints sent are not the packed ones`);
      const ctx = { title: e.title, criteria: e.criteria, steps: e.steps, traps: e.traps };
      for (const t of sent) { const why = rungDropReason(d.sealed, t, ctx); if (why) problems.push(`${e.id}: a hint sent at issue fails the rung rule (${why.slice(0, 40)})`); }
      for (let k = 0; k < Math.min(sent.length, 3); k++) {
        const hint = await call(`/v1/practice/${d.question.id}/hint`, { rung: ['nudge', 'method', 'worked'][k] });
        if (hint.status !== 200 || hint.data.hint !== sent[k]) problems.push(`${e.id}: rung ${k + 1} served ${JSON.stringify(hint.data?.hint)}, not hint ${k + 1}`); else rungsServed++;
      }
      // A question with a figure: the figure goes to the signed-in account it was issued to and to nobody else, it is the file the pack names, it holds
      // no text a reader could take an answer from (glyphs are paths), and the issue reply carries its text alternative and size only.
      if (e.diagram) {
        figuresSwept++;
        if (JSON.stringify(Object.keys(d.question.diagram || {}).sort()) !== JSON.stringify(['alt', 'h', 'w'])) problems.push(`${e.id}: the issued figure fields are not alt, w, h`);
        const own = await h.request(`/v1/practice/${d.question.id}/figure`, { method: 'GET', jar: a.jar });
        const anon = await h.request(`/v1/practice/${d.question.id}/figure`, { method: 'GET', jar: {} });
        if (own.status !== 200 || !String(own.headers.get('content-type')).startsWith('image/svg+xml') || crypto.createHash('sha256').update(own.text).digest('hex') !== e.diagram.sha256) problems.push(`${e.id}: the signed-in account was not sent the pack's figure`);
        else if (/<text\b|<tspan\b|<script\b/i.test(own.text) || secrets.some(t => own.text.includes(jsonText(t)))) { sweepLeaks++; problems.push(`${e.id}: the figure holds readable text or a sealed text`); }
        if (anon.status === 200 || anon.text.includes('<svg')) { sweepLeaks++; problems.push(`${e.id}: the figure was sent with no session`); }
        if (leakReason(d.sealed, e.diagram.alt)) { sweepLeaks++; problems.push(`${e.id}: the text alternative gives the answer`); }
      }
      if ((d.question.hintsOffered === false) !== (sent.length === 0)) problems.push(`${e.id}: the device is ${d.question.hintsOffered === false ? 'told no hint is offered' : 'not told'} with ${sent.length} rungs`);
      if (!sent.length) {
        const hint = await call(`/v1/practice/${d.question.id}/hint`, { rung: 'nudge' });
        if (hint.status === 409 && hint.data?.error?.code === 'HINT_NOT_AVAILABLE') refused++; else problems.push(`${e.id}: no rung, and the hint route did not refuse (${hint.status})`);
      }
    }
    c.deq(problems.slice(0, 5), [], `${swept} bank questions (${seenIds.size} different) through the routes: no sealed text in an issue reply, every hint passes the rung rule, every rung served is a hint sent`);
    c.eq(sweepLeaks, 0, 'no step, criterion, trap reason or title is in any issue reply');
    c.ok(rungsServed > 100, `${rungsServed} rungs served by the hint route, ${refused} questions with no rung refused it`);
    c.ok(figuresSwept >= 8, `${figuresSwept} of the ${swept} swept have a figure, each fetched signed in and refused with no session`);
    console.log(`  leak sweep: ${swept} issued (${seenIds.size} different, ${figuresSwept} with a figure), ${rungsServed} rungs served, ${refused} with no rung refused the hint route`);
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
