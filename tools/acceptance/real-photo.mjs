// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · real-photo acceptance
//
// EVIDENCE CLASS: a REAL photograph of a student's page (the owner's private
// fixture) · the REAL configured handwriting provider · a real `node
// server/index.js` on LOCALHOST with a local SQLite file. Not staging, not
// production, not a deployed build, not a physical device. The extra pages
// labelled SIMULATED are typeset in a handwriting face by this script and are
// not anybody's handwriting.
//
// The owner's failure (2026-10-10): Class 11 Relations and Functions, D3,
// 3 marks — "Find the least value taken by the real function
// f(x) = (x + 3)² + 6." The photographed page has unrelated set notes at the
// top and the working below. The app copied "least value ⇒ 6." into the
// answer field and could not parse it.
//
// What this drives, and with what:
//   · image preparation — client/src/ink/photoRaster.js, in Chromium;
//   · which lines belong, and the final answer — client/src/photo/transcript.js
//     and client/src/photo/finalAnswer.js, imported, not re-implemented;
//   · refusal naming — client/src/ink/readerFailure.js;
//   · the server's real routes — /v1/handwriting/transcribe,
//     /v1/practice/:id/recognize, /recognition/:receipt/confirm, /submit,
//     /v1/sync/pull — in the order the shipped client uses them.
//
// The fixture is read from PRI_ACCEPT_PHOTO (default: the owner's private
// path). It is sent to the local server's reader and nowhere else; it is never
// copied, saved or logged by this script. With no fixture the run reports
// NOT VERIFIED and exits 3.
//
// This script never holds the provider credential. Run it through
// launch-real-photo.mjs. Exit: 0 met · 1 an expectation failed · 3 nothing
// failed but something is NOT VERIFIED · 2 a dependency is missing.
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO, bytesOf, enrol, localSecrets, makeHttp, openStudio } from './real-photo-support.mjs';

const client = file => import(pathToFileURL(join(REPO, 'client', 'src', file)).href);
const T = await client('photo/transcript.js');
const { proposeFinalAnswer, readsAsAnswer } = await client('photo/finalAnswer.js');
const { classifyReaderFailure } = await client('ink/readerFailure.js');
const { parseNumericInput } = await client('engine/checker-core.js');

const FIXTURE = resolve(process.env.PRI_ACCEPT_PHOTO || join(process.env.HOME || '', 'Developer', 'pri-private-fixtures', 'owner-photo-least-value-2026-10-10.jpg'));
const READS = Math.max(5, Math.min(8, Number(process.env.PRI_ACCEPT_READS) || 5));
const PROVIDER_CALL_BUDGET = 58;
const OWNER = Object.freeze({ generator: 'c11-relations-functions', difficulty: 3, seed: 301 });
const OWNER_PROMPT = 'Find the least value taken by the real function $f(x) = (x + 3)^2 + 6$.';

const checks = [], unverified = [], observations = [], providerCalls = [], reads = [], simulated = [];
const expect = (id, name, ok, detail = '') => { checks.push({ id, name, ok: !!ok, detail: ok ? '' : String(detail) }); return !!ok; };
const one = text => String(text ?? '').replace(/\n/g, ' ⏎ ');

if (!existsSync(FIXTURE)) {
  console.log('══ Pri Learning · real-photo acceptance');
  console.log('NOT VERIFIED: the real photo fixture is not on this machine.');
  console.log('  looked for the file named by PRI_ACCEPT_PHOTO (default: the owner\'s private fixture under ~/Developer/pri-private-fixtures/).');
  console.log('  Nothing was sent to the provider and nothing was substituted for the photo.');
  process.exit(3);
}
const BASE = process.env.PRI_ACCEPT_BASE, DB_PATH = process.env.PRI_ACCEPT_DB;
const SLOW_BASE = process.env.PRI_ACCEPT_TIMEOUT_BASE, SLOW_DB = process.env.PRI_ACCEPT_TIMEOUT_DB;
if (!BASE || !DB_PATH || !process.env.PRI_AUTH_DELIVERY_KEY) {
  console.log('DEPENDENCY MISSING: run this through tools/acceptance/launch-real-photo.mjs (it boots the local servers and passes their addresses).');
  process.exit(2);
}
for (const origin of [BASE, SLOW_BASE].filter(Boolean)) {
  if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(new URL(origin).hostname)) {
    console.log('REFUSED: this acceptance only runs against localhost.');
    process.exit(2);
  }
}
const OUT = process.env.PRI_ACCEPT_OUT ? resolve(process.env.PRI_ACCEPT_OUT) : mkdtempSync(join(tmpdir(), 'pri-real-photo-'));
mkdirSync(OUT, { recursive: true, mode: 0o700 });

const http = makeHttp(BASE);
const secrets = await localSecrets();
const studio = await openStudio();

const spent = () => providerCalls.reduce((n, row) => n + row.cost, 0);
function budget(needed) { if (spent() + needed > PROVIDER_CALL_BUDGET) throw new Error(`provider call budget (${PROVIDER_CALL_BUDGET}) would be exceeded`); }
/** POST /v1/handwriting/transcribe. The body is the picture and nothing else. */
async function transcribe(request, jar, label, image, server = 'main') {
  const body = { image };
  if (Object.keys(body).join(',') !== 'image') throw new Error('acceptance bug: a transcribe body must carry exactly one image');
  budget(2);
  const res = await request('/v1/handwriting/transcribe', { method: 'POST', jar, body });
  const t = res.data?.transcription || null;
  // A read the server escalated is two model calls; an unknown outcome is counted as two.
  providerCalls.push({ label, server, route: 'transcribe', status: res.status, code: res.code, cost: res.status === 200 ? (t?.fallbackAttempted ? 2 : 1) : (res.status >= 500 ? 2 : 0),
    engine: t?.engine ?? null, confidence: t?.confidence ?? null, needsConfirmation: t?.needsConfirmation ?? null, fallback: t?.fallbackAttempted ?? null, latencyMs: t?.latencyMs ?? res.ms, reused: t?.reused ?? res.data?.reused ?? null });
  return { res, t };
}
/** What the card would do with a reading, using the app's own modules. */
function asTheCardWould(t, question) {
  const transcript = T.buildTranscript(t, question);
  const kept = T.includedLines(transcript);
  return { transcript, kept, proposal: proposeFinalAnswer(kept, question) };
}
const isSetNote = text => /^[ab]\s*=\s*\{/.test(String(text).trim()) || /^final\s*:/i.test(String(text).trim());
const inequalityLines = lines => lines.filter(l => /\(\s*[a-z]\s*\+\s*3\s*\)/i.test(l.text) && /(>=|<=|≥|≤|⩾|>|<)/.test(l.text.replace(/=>|->/g, '')) && !/^.{0,6}f\s*\(/.test(l.text.replace(/^(->|→|=>)\s*/, '')));
async function gradedEvents(request, jar, questionId = null) {
  const pull = await request('/v1/sync/pull/0', { jar });
  const events = (pull.data?.events || []).filter(e => e.kind === 'graded-attempt');
  return questionId ? events.filter(e => e.entityId === questionId) : events;
}
const verdict = r => (!r ? '—' : r.invalid ? 'invalid (not an attempt)' : r.correct ? 'correct' : 'incorrect');
const marks = r => (r && Number.isFinite(r.marksEarned) ? `${r.marksEarned}/${r.marksPossible}` : '—');

let fatal = null;
try {
  const student = await enrol(http, DB_PATH, 'main', secrets);
  const { jar } = student;
  observations.push(`account: registered through the server's own routes as a Class 11 student (age basis "${student.ageBasis}"), email verified, guardian consent "${student.consentState}"`);
  const status = await http('/v1/handwriting/status', { jar });
  if (status.data?.configured !== true) { console.log('DEPENDENCY MISSING: the local server reports no handwriting provider configured. Nothing was faked.'); process.exit(2); }
  expect('setup', 'the real provider is configured and usable on the local server', status.data?.usable === true, JSON.stringify({ state: status.data?.state, lastFailureCode: status.data?.lastFailureCode }));
  observations.push(`provider status: state=${status.data?.state} model=${status.data?.model} fallbackModel=${status.data?.fallbackModel} confidenceFloor=${status.data?.confidenceFloor} timeoutMs=${status.data?.timeoutMs}; server release ${String(status.data?.releaseSha || '').slice(0, 8) || 'unknown'}`);

  // ── The owner's question, issued by the server ─────────────────────────────
  // The server chooses every seed and refuses a caller's. To be issued the
  // owner's exact question, a prepared-question token for it is sealed with
  // THIS RUN's local key (the launcher made it; no deployed server has it) and
  // the real server binds it. A production client cannot do this.
  async function issueOwners() {
    const prepared = secrets.encryptDeliveryToken(JSON.stringify({ g: OWNER.generator, d: OWNER.difficulty, s: OWNER.seed, m: 'practice', x: Date.now() + 3600000, n: randomUUID() }), 'practice-prepared-v1');
    const res = await http('/v1/practice/issue', { method: 'POST', jar, body: { prepared, account: String(student.accountId) } });
    if (res.status !== 201) throw new Error(`issue: ${res.status} ${res.code}`);
    return res.data.question;
  }
  const q = await issueOwners();
  const leaked = ['answer', 'correct', 'expected', 'solution', 'solutionText', 'steps', 'traps', 'stepcheck', 'seed'].filter(k => k in q);
  expect('setup', 'the server issued the owner\'s question (least value of f(x) = (x + 3)² + 6), 3 marks, with no answer, solution or seed in it',
    q.prompt === OWNER_PROMPT && q.answerType === 'numeric' && q.criteriaCount === 3 && leaked.length === 0, JSON.stringify({ prompt: q.prompt, criteriaCount: q.criteriaCount, leaked }));
  observations.push(`question: subtopic=${q.subtopic} difficulty=${q.difficulty} criteriaCount=${q.criteriaCount} answerType=${q.answerType} supportsSteps=${q.supportsSteps} (the owner's screen called it Class 12; the generator is the Class 11 Relations and Functions bank). Its seed was chosen by sealing a prepared-question token with this run's local key.`);
  const PUBLIC = { prompt: q.prompt, answerType: q.answerType, answerSuffix: q.answerSuffix };

  // ── The real photo, prepared by the app's own code ─────────────────────────
  const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[extname(FIXTURE).toLowerCase()] || 'image/jpeg';
  const prepared = await studio.preparePhoto(`data:${mime};base64,${readFileSync(FIXTURE).toString('base64')}`);
  if (!prepared) throw new Error('the app\'s photo preparation could not open the fixture');
  observations.push(`the fixture as the app sends it: ${prepared.width}×${prepared.height} JPEG, ${prepared.bytes} bytes, quality ${prepared.quality} (from ${prepared.scaledFrom.width}×${prepared.scaledFrom.height}); it was not saved anywhere by this run`);

  // ── ≥5 real reads of the real photo ────────────────────────────────────────
  for (let i = 0; i < READS; i += 1) {
    const { res, t } = await transcribe(http, jar, `fixture read ${i + 1}`, prepared.dataUrl);
    if (res.status !== 200 || !t?.lines?.length) { reads.push({ n: i + 1, status: res.status, code: res.code, lines: [] }); continue; }
    const card = asTheCardWould(t, PUBLIC);
    const ineq = inequalityLines(card.transcript.lines);
    reads.push({
      n: i + 1, status: 200, engine: t.engine, confidence: t.confidence, needsConfirmation: t.needsConfirmation, fallback: t.fallbackAttempted, latencyMs: t.latencyMs, reused: t.reused ?? null,
      raw: t.lines.map(l => ({ text: l.text, confidence: l.confidence, uncertain: l.uncertain === true, doubt: l.doubt || null, gapBefore: l.gapBefore === true })),
      lines: card.transcript.lines, kept: card.kept, proposal: card.proposal, undecided: card.transcript.undecided,
      notesKept: card.kept.filter(isSetNote), notesRead: card.transcript.lines.filter(l => isSetNote(l.text)).length,
      inequalities: ineq.map(l => ({ text: l.text, weak: /(>=|<=|≥|≤|⩾)/.test(l.text), flagged: l.check, doubt: l.doubt })),
      letterAsN: card.transcript.lines.some(l => /\(\s*n\s*\+\s*3\s*\)/.test(l.text)), letterFlagged: card.transcript.lines.filter(l => /\(\s*n\s*\+\s*3\s*\)/.test(l.text)).every(l => l.check)
    });
  }
  const good = reads.filter(r => r.status === 200 && r.lines.length);
  const first = good[0] || null;
  expect('01 upload accepted', 'the prepared photo is accepted by POST /v1/handwriting/transcribe (200) on every read', reads.length === READS && reads.every(r => r.status === 200), JSON.stringify(reads.map(r => [r.status, r.code || null])));
  expect('02 real provider read it', `the real provider returned a transcript on all ${READS} reads (engine cloud-…, at least the four lines of working)`,
    good.length === READS && good.every(r => /^cloud-/.test(String(r.engine)) && r.lines.length >= 4), JSON.stringify(reads.map(r => [r.engine, r.lines.length])));
  expect('03 unrelated notes not sent', 'by default none of the unrelated set-notation lines is among the lines sent as working — and all of them are still in the transcript',
    good.length > 0 && good.every(r => r.notesKept.length === 0 && r.notesRead >= 4), JSON.stringify(good.map(r => ({ read: r.n, notesRead: r.notesRead, notesKept: r.notesKept }))));
  const allIneq = good.flatMap(r => r.inequalities.map(x => ({ read: r.n, ...x })));
  const strictUnflagged = allIneq.filter(x => !x.weak && !x.flagged);
  expect('04 inequality signs', 'every inequality line of the working is read as ≥ or is flagged for the student to check',
    allIneq.length >= READS && strictUnflagged.length === 0, `${strictUnflagged.length} of ${allIneq.length} inequality lines came back strict and unflagged: ${JSON.stringify(strictUnflagged)}`);
  observations.push(`inequality signs over ${good.length} real reads: ${allIneq.length} inequality lines; read as >= : ${allIneq.filter(x => x.weak).length}; read strict but flagged: ${allIneq.filter(x => !x.weak && x.flagged).length}; read strict and NOT flagged: ${strictUnflagged.length} (rate ${allIneq.length ? (100 * strictUnflagged.length / allIneq.length).toFixed(0) : '—'}%)`);
  const asN = good.filter(r => r.letterAsN);
  observations.push(`the handwritten x: read as "n" in ${asN.length} of ${good.length} reads; in ${asN.filter(r => r.letterFlagged).length} of those every such line is shown as "check this line: x or n" (by the reader's own doubt or by the on-device comparison with the public question); it is never changed for the student`);
  expect('05 extracted answer', `the answer proposed from the kept lines is "6" on all ${READS} reads`, good.length === READS && good.every(r => r.proposal.status === 'proposed' && r.proposal.answer === '6'), JSON.stringify(good.map(r => r.proposal)));
  expect('06 no unparseable phrase', 'what goes into the answer field reads as a number in the typed field\'s own parser; the sentence itself never does',
    good.every(r => { try { return r.proposal.status === 'proposed' && readsAsAnswer(r.proposal.answer, PUBLIC) && Number.isFinite(parseNumericInput(r.proposal.answer).value) && !/[a-z]{3,}|\.$/i.test(r.proposal.answer); } catch { return false; } }),
    JSON.stringify(good.map(r => r.proposal)));
  if (first) {
    const transcript = T.buildTranscript({ lines: first.raw, confidenceFloor: status.data?.confidenceFloor }, PUBLIC);
    const weak = inequalityLines(transcript.lines.filter(l => !l.excluded))[0];
    const target = weak ? transcript.lines.indexOf(weak) : -1;
    const was = target >= 0 ? transcript.lines[target].text : '';
    // The student changes the relation sign on one line (≥ to >, or > to ≥).
    const edited = target >= 0 ? T.editLine(transcript, target, />=/.test(was) ? was.replace('>=', '>') : was.replace('>', '>=')) : transcript;
    const dropped = T.setLineExcluded(transcript, target, true);
    const everything = T.includeAll(transcript);
    expect('07 transcript editable', 'module-level proof (the browser proof is the tour): a line edit changes exactly that line of the working and keeps what was read; a line can be left out and brought back; "include them" restores the notes',
      target >= 0 && T.includedLines(edited).length === T.includedLines(transcript).length && edited.lines[target].read === was && edited.lines[target].edited && edited.lines[target].text !== was &&
        T.includedLines(edited).filter((l, i) => l !== T.includedLines(transcript)[i]).length === 1 &&
        T.includedLines(dropped).length === T.includedLines(transcript).length - 1 && T.includedLines(T.setLineExcluded(dropped, target, false)).join('\n') === T.includedLines(transcript).join('\n') &&
        T.includedLines(everything).length === transcript.lines.length && proposeFinalAnswer(T.includedLines(everything), PUBLIC).answer === '6',
      JSON.stringify({ target, kept: T.includedLines(transcript).length, all: transcript.lines.length }));
  } else expect('07 transcript editable', 'a reading to edit exists', false, 'no successful read');

  // ── Submit, as the shipped client does ─────────────────────────────────────
  if (first && first.proposal.status === 'proposed') {
    const answer = first.proposal.answer;
    const steps = first.kept.join('\n');
    budget(2);
    const recognised = await http(`/v1/practice/${q.id}/recognize`, { method: 'POST', jar, body: { mode: 'photo', image: prepared.dataUrl } });
    providerCalls.push({ label: 'recognize before marking', server: 'main', route: 'recognize(photo)', status: recognised.status, code: recognised.code, cost: recognised.data?.reused === true ? 0 : 2, reused: recognised.data?.reused ?? null,
      confidence: recognised.data?.transcription?.confidence ?? null, needsConfirmation: recognised.data?.transcription?.needsConfirmation ?? null, latencyMs: recognised.ms });
    let receipt = recognised.data?.receipt || null;
    let confirmed = null;
    if (receipt && (recognised.data.transcription.text !== answer || recognised.data.transcription.needsConfirmation === true)) {
      confirmed = await http(`/v1/practice/${q.id}/recognition/${receipt}/confirm`, { method: 'POST', jar, body: { text: answer } });
      receipt = confirmed.data?.receipt || null;
    }
    const before = (await gradedEvents(http, jar)).length;
    const submissionId = `realphoto-${randomBytes(8).toString('hex')}`;
    const payload = { submissionId, answer, mode: 'photo', steps, transcriptionReceipt: receipt, ms: 61000 };
    const graded = receipt ? await http(`/v1/practice/${q.id}/submit`, { method: 'POST', jar, headers: { 'Idempotency-Key': submissionId }, body: payload }) : null;
    const r = graded?.data || null;
    expect('08 server accepts the confirmed answer', 'reading receipt issued (201), the student\'s confirmed answer "6" recorded (201), and the submission is graded (200, authoritative)',
      recognised.status === 201 && (!confirmed || confirmed.status === 201) && graded?.status === 200 && r?.authoritative === true && r.invalid === false,
      JSON.stringify({ recognise: [recognised.status, recognised.code], confirm: confirmed ? [confirmed.status, confirmed.code] : null, submit: graded ? [graded.status, graded.code] : null }));
    expect('09 marks and feedback', 'as the server pays them: correct, 3 of 3, resolved on the first try', r?.correct === true && r.resolved === true && r.marksEarned === 3 && r.marksPossible === 3,
      JSON.stringify({ correct: r?.correct, resolved: r?.resolved, marks: marks(r), feedback: r?.feedback }));
    observations.push(`photo submission, as the server answered it: verdict ${verdict(r)}, marks ${marks(r)}, feedback ${JSON.stringify(r?.feedback ?? null)}, stepReport ${JSON.stringify(r?.stepReport ?? null)}, partial ${JSON.stringify(r?.partial ?? null)}; working sent: ${JSON.stringify(steps)}`);
    expect('10 worked solution present', 'the reply carries the worked solution, and it ends at the least value 6', !!r?.solution && String(r.solution.answerText) === '6' && Array.isArray(r.solution.steps) && r.solution.steps.length >= 3,
      JSON.stringify({ answerText: r?.solution?.answerText, steps: r?.solution?.steps?.length }));
    const mine = await gradedEvents(http, jar, q.id);
    const after = (await gradedEvents(http, jar)).length;
    expect('11 attempt persisted', 'exactly one graded attempt for the account, read back through /v1/sync/pull: correct, 3/3, input mode photo',
      mine.length === 1 && after === before + 1 && mine[0].id === r?.attemptId && mine[0].payload.correct === true && mine[0].payload.marksEarned === 3 && mine[0].payload.inputMode === 'photo',
      JSON.stringify(mine.map(e => e.payload)));
    if (graded?.status === 200) {
      const replay = await http(`/v1/practice/${q.id}/submit`, { method: 'POST', jar, headers: { 'Idempotency-Key': submissionId }, body: payload });
      const fresh = await http(`/v1/practice/${q.id}/submit`, { method: 'POST', jar, body: { submissionId: `realphoto-again-${randomBytes(6).toString('hex')}`, answer, mode: 'typed' } });
      expect('12 replay does not double-credit', 'the same submission replayed returns the same attempt; a new key on the credited question is refused (409); still one graded event',
        replay.status === 200 && replay.data?.attemptId === r.attemptId && JSON.stringify(replay.data) === JSON.stringify(r) && fresh.status === 409 && (await gradedEvents(http, jar)).length === after,
        JSON.stringify({ replay: [replay.status, replay.data?.attemptId === r.attemptId], fresh: [fresh.status, fresh.code] }));
    } else expect('12 replay does not double-credit', 'a graded submission exists to replay', false, 'the submission was not graded');
  } else {
    for (const id of ['08 server accepts the confirmed answer', '09 marks and feedback', '10 worked solution present', '11 attempt persisted', '12 replay does not double-credit']) expect(id, 'a proposed answer exists to submit', false, 'no proposal from the first read');
  }

  // ── What the server pays for (typed route: no reader involved) ─────────────
  const REL = ['f(x) = (x+3)^2 + 6', '(x+3)^2 >= 0', '(x+3)^2 + 6 >= 6', 'least value => 6'];
  const NOTES = ['b = {40,50,60}.', 'b = {100,50,60}.', 'final:', 'a = {10,99,30}.', 'b = {100,50,60}.'];
  const STRICT = REL.map(l => l.replace(/>=/g, '>'));
  async function pay(label, answer, steps, tries = 1) {
    const question = await issueOwners();
    let r = null;
    for (let i = 0; i < tries; i += 1) {
      const id = `realphoto-pay-${randomBytes(6).toString('hex')}`;
      const res = await http(`/v1/practice/${question.id}/submit`, { method: 'POST', jar, headers: { 'Idempotency-Key': id }, body: { submissionId: id, answer, mode: 'typed', ...(steps ? { steps: steps.join('\n') } : {}) } });
      r = res.data;
      if (res.status !== 200 || r?.resolved) break;
    }
    observations.push(`marking · ${label}: ${verdict(r)}, marks ${marks(r)}, resolved ${r?.resolved}, feedback ${JSON.stringify(r?.feedback ?? null)}, trapWhy ${JSON.stringify(r?.trapWhy ?? null)}, stepReport ${JSON.stringify(r?.stepReport ?? null)}, partial ${JSON.stringify(r?.partial ?? null)}`);
    return r;
  }
  const paid = {
    relevant: await pay('answer 6 with the relevant working', '6', REL),
    withNotes: await pay('answer 6 with the unrelated lines left in', '6', [...NOTES, ...REL]),
    wrong: await pay('answer 9 with the correct working (two tries, so it resolves)', '9', REL, 2),
    strict: await pay('answer 6 with strict > where ≥ is right', '6', STRICT),
    strictWrong: await pay('answer 9 with strict > working (two tries)', '9', STRICT, 2),
    sentence: await pay('the sentence "least value => 6." as the answer (what the old build sent)', 'least value => 6.', [...NOTES, ...REL])
  };
  expect('marking', 'recorded, and consistent: a right answer earns 3/3 with or without the notes or the strict sign; a wrong answer earns 0/3 whatever the working; the sentence is refused as unreadable and spends no try',
    [paid.relevant, paid.withNotes, paid.strict].every(r => r?.correct === true && r.marksEarned === 3) && [paid.wrong, paid.strictWrong].every(r => r?.correct === false && r.resolved === true && r.marksEarned === 0) &&
      paid.sentence?.invalid === true && paid.sentence.resolved === false, JSON.stringify(Object.fromEntries(Object.entries(paid).map(([k, r]) => [k, [verdict(r), marks(r)]]))));
  observations.push(`step checking for this question: supportsSteps=${q.supportsSteps}. The server does not check its working: no line is judged, no method mark exists, and neither the unrelated lines nor a strict ">" changes anything it pays. A strict sign the student really wrote is therefore neither corrected nor penalised here.`);

  // ── SIMULATED pages: adversarial shapes through the same pipeline ──────────
  const SIM = [
    { id: 'natural-language final', lines: ['f(x) = (x+3)^2 + 6', '(x+3)^2 >= 0', 'so the minimum value is 6.'], want: c => c.proposal.status === 'proposed' && c.proposal.answer === '6', says: 'proposes 6 from a sentence' },
    { id: 'unrelated notes with larger numbers', lines: ['p = 4500 + 9800', 'q = 2p - 700', '', 'f(x) = (x+3)^2 + 6', '(x+3)^2 >= 0', 'least value = 6'],
      want: c => c.proposal.status === 'proposed' && c.proposal.answer === '6' && !c.kept.some(l => /4500|9800|700/.test(l)), says: 'proposes 6; the notes with 4500 and 9800 are not sent as working' },
    { id: 'notes after the working', lines: ['f(x) = (x+3)^2 + 6', '(x+3)^2 >= 0', 'least value = 6', '', 'p = 4500 + 9800', 'q = 2p - 700'],
      want: c => c.proposal.status !== 'proposed' || c.proposal.answer === '6', says: 'never proposes a number from the notes (6, or nothing and ask)' },
    { id: 'two candidate finals', lines: ['f(x) = (x+3)^2 + 6', 'least value = 6 or 9'], want: c => c.proposal.status === 'ambiguous' || c.proposal.status === 'none', says: 'does not guess: the field stays empty and the student is asked' },
    { id: 'non-numeric answer type (interval)', question: { prompt: 'Solve the inequality $x^2 - 5x + 6 < 0$.', answerType: 'interval' }, lines: ['x^2 - 5x + 6 < 0', '(x - 2)(x - 3) < 0', 'so 2 < x < 3'],
      want: c => c.proposal.status === 'proposed' && /2\s*<\s*x\s*<\s*3/.test(c.proposal.answer), says: 'proposes the interval 2 < x < 3, not a number' }
  ];
  for (const [i, page] of SIM.entries()) {
    const picture = await studio.simulatedPage({ lines: page.lines, seed: 4100 + i });
    writeFileSync(join(OUT, `SIMULATED-page-${i + 1}.jpg`), bytesOf(picture));
    const sent = await studio.preparePhoto(picture);
    const { res, t } = await transcribe(http, jar, `SIMULATED ${page.id}`, sent.dataUrl);
    const card = res.status === 200 && t?.lines?.length ? asTheCardWould(t, page.question || PUBLIC) : null;
    const row = { id: page.id, written: page.lines.filter(Boolean), status: res.status, code: res.code, read: t?.lines?.map(l => l.text) || [], kept: card?.kept || [], proposal: card?.proposal || null, flagged: card?.transcript.lines.filter(l => l.check).length ?? null };
    simulated.push(row);
    expect(`SIMULATED · ${page.id}`, `${page.says}`, !!card && page.want(card), JSON.stringify({ status: res.status, code: res.code, read: row.read, kept: row.kept, proposal: row.proposal }));
  }
  // Pages that cannot be read: an explicit reading problem, never an answer.
  const UNREADABLE = [
    { id: 'blurry page', damage: 'blur' }, { id: 'cropped page (a sliver)', damage: 'crop' }, { id: 'page photographed sideways', quarterTurns: 1 }
  ];
  for (const [i, page] of UNREADABLE.entries()) {
    const picture = await studio.simulatedPage({ lines: ['f(x) = (x+3)^2 + 6', '(x+3)^2 >= 0', '(x+3)^2 + 6 >= 6', 'least value = 6'], seed: 4200 + i, damage: page.damage || null, quarterTurns: page.quarterTurns || 0 });
    writeFileSync(join(OUT, `SIMULATED-unreadable-${i + 1}.jpg`), bytesOf(picture));
    const sent = await studio.preparePhoto(picture);
    const { res, t } = await transcribe(http, jar, `SIMULATED ${page.id}`, sent.dataUrl);
    const card = res.status === 200 && t?.lines?.length ? asTheCardWould(t, PUBLIC) : null;
    const explicit = res.status >= 400 && !!res.code;
    // The card's own test for "this photo could not be read" (retake / retry).
    const empty = res.status === 200 && T.unreadablePage(t);
    const doubted = res.status === 200 && (t?.needsConfirmation === true || (card?.transcript.lines || []).some(l => l.check));
    const readRight = !!card && card.proposal.status === 'proposed' && card.proposal.answer === '6';
    const row = { id: page.id, status: res.status, code: res.code, read: t?.lines?.map(l => l.text) || [], confidence: t?.confidence ?? null, needsConfirmation: t?.needsConfirmation ?? null, proposal: card?.proposal || null,
      outcome: explicit ? `explicit error ${res.code}` : empty ? 'shown as "that photo could not be read" with a retry' : readRight ? (doubted ? 'read correctly, flagged for checking' : 'read correctly') : doubted ? 'reading in doubt' : 'CONFIDENT WRONG READING' };
    simulated.push(row);
    // Honest means: an explicit problem, an empty reading, a reading flagged
    // for the student — or simply the right reading. Never a confident wrong one.
    expect(`SIMULATED · ${page.id}`, 'is an explicit reading problem, an empty or doubted reading, or a correct reading — never a confident wrong answer, and never a verdict',
      (explicit || empty || doubted || readRight) && !('correct' in (res.data || {})) && !('marksEarned' in (res.data || {})), JSON.stringify(row));
    if (explicit) expect(`SIMULATED · ${page.id}`, 'and the app names it as a reading problem with a retry', ['unreachable', 'request'].includes(classifyReaderFailure({ code: res.code, status: res.status }).kind), res.code);
  }

  // ── Upload and provider failures: reading problems, never verdicts ─────────
  const notImage = await http('/v1/handwriting/transcribe', { method: 'POST', jar, body: { image: 'data:text/plain;base64,' + Buffer.from('6').toString('base64') } });
  const tooLarge = await http('/v1/handwriting/transcribe', { method: 'POST', jar, body: { image: 'data:image/jpeg;base64,' + 'A'.repeat(1_010_000) } });
  const leak = await http('/v1/handwriting/transcribe', { method: 'POST', jar, body: { image: prepared.dataUrl, question: OWNER_PROMPT } });
  const anonymous = await http('/v1/handwriting/transcribe', { method: 'POST', body: { image: prepared.dataUrl } });
  const named = [notImage, tooLarge, anonymous].map(r => classifyReaderFailure({ code: r.code, status: r.status }));
  expect('failure · upload', 'a file that is not an image (400), one over the size limit (413) and a request with no session (401) are refused before any read, and the app names them: send again / send again / sign in — no mark, no verdict',
    notImage.status === 400 && notImage.code === 'HANDWRITING_IMAGE_INVALID' && tooLarge.status === 413 && anonymous.status === 401 &&
      named.map(n => n.kind).join() === 'request,request,session' && [notImage, tooLarge, anonymous].every(r => !('correct' in (r.data || {})) && !r.data?.transcription),
    JSON.stringify([[notImage.status, notImage.code], [tooLarge.status, tooLarge.code], [anonymous.status, anonymous.code], named.map(n => n.kind)]));
  expect('answer-blind', 'a transcribe body that carries the question is refused (400 HANDWRITING_NOT_ANSWER_BLIND); every read this run sent was exactly { image }',
    leak.status === 400 && leak.code === 'HANDWRITING_NOT_ANSWER_BLIND' && providerCalls.filter(c => c.route === 'transcribe').length >= READS, `${leak.status} ${leak.code}`);
  if (SLOW_BASE && SLOW_DB) {
    const slowHttp = makeHttp(SLOW_BASE);
    const slow = await enrol(slowHttp, SLOW_DB, 'timeout', secrets);
    const got = await transcribe(slowHttp, slow.jar, 'provider timeout drill (2000 ms budget)', prepared.dataUrl, 'timeout');
    if (got.res.status === 200) unverified.push({ id: 'failure · provider timeout', what: `the provider answered inside the 2000 ms minimum budget (${got.t?.latencyMs} ms), so a timeout from the route was not observed on this run` });
    else {
      const kind = classifyReaderFailure({ code: got.res.code, status: got.res.status });
      expect('failure · provider timeout', 'a provider timeout is an explicit, retryable reading error (504 HANDWRITING_TIMEOUT) that the app names "the reader isn\'t answering" with a bounded automatic retry and a Try again — no reading, no mark',
        got.res.status === 504 && got.res.code === 'HANDWRITING_TIMEOUT' && got.res.data?.error?.retryable === true && kind.kind === 'unreachable' && kind.autoRetry && kind.manualRetry && !got.res.data?.transcription && !('correct' in (got.res.data || {})),
        `${got.res.status} ${got.res.code} → ${kind.kind}`);
      const again = await transcribe(http, jar, 'retry after the timeout (main server)', prepared.dataUrl);
      expect('failure · retry', 'and a retry on a server with the normal budget reads the page', again.res.status === 200 && (again.t?.lines?.length || 0) >= 4, `${again.res.status} ${again.res.code}`);
    }
  } else unverified.push({ id: 'failure · provider timeout', what: 'no timeout server was provided, so the provider-timeout drill did not run' });
} catch (error) {
  fatal = error;
} finally {
  await studio.close().catch(() => {});
}

// ── Report ───────────────────────────────────────────────────────────────────
const pad = (value, n) => String(value ?? '—').padEnd(n).slice(0, n);
console.log('');
console.log('══ Pri Learning · real-photo acceptance ═════════════════════════════════════════════════════');
console.log('EVIDENCE CLASS: real photo (the owner\'s page) · real provider · real localhost server (SQLite)');
console.log('                not staging · not production · not a deployed build · not a physical device');
console.log('                pages labelled SIMULATED are typeset by this script, not handwriting');
console.log('');
console.log('── the real photo, read by the real provider');
for (const r of reads) {
  if (r.status !== 200) { console.log(`read ${r.n}: [${r.status} ${r.code}]`); continue; }
  console.log(`read ${r.n}: engine ${r.engine} · confidence ${r.confidence} · needsConfirmation ${r.needsConfirmation} · fallback ${r.fallback} · ${r.latencyMs} ms${r.reused ? ' · reused' : ''}`);
  for (const [i, l] of r.lines.entries()) {
    console.log(`    ${String(i + 1).padStart(2)} ${l.excluded ? `left out (${l.why})` : 'kept              '} ${l.check ? `CHECK${l.doubt ? ` [${l.doubt}]` : ''}` : '     '}  ${l.text}`);
  }
  console.log(`       → answer field: ${r.proposal.status === 'proposed' ? JSON.stringify(r.proposal.answer) : `EMPTY (${r.proposal.status})`}   working sent: ${JSON.stringify(r.kept.join(' ⏎ '))}`);
}
if (simulated.length) {
  console.log('');
  console.log('── SIMULATED pages (typeset, not handwriting), read by the real provider');
  for (const s of simulated) {
    console.log(`• SIMULATED ${s.id}: ${s.status}${s.code ? ' ' + s.code : ''}${s.outcome ? ` · ${s.outcome}` : ''}`);
    if (s.written) console.log(`    written  ${one(s.written.join('\n'))}`);
    console.log(`    read     ${one(s.read.join('\n')) || '—'}`);
    if (s.kept?.length) console.log(`    kept     ${one(s.kept.join('\n'))}`);
    console.log(`    answer   ${s.proposal ? (s.proposal.status === 'proposed' ? JSON.stringify(s.proposal.answer) : `EMPTY (${s.proposal.status}${s.proposal.candidates ? ': ' + s.proposal.candidates.join(' / ') : ''})`) : '—'}`);
  }
}
console.log('');
console.log('── every request that reached the reader');
for (const c of providerCalls) console.log(`${pad(c.label, 44)} ${pad(c.server, 8)} ${pad(c.route, 16)} ${pad(c.status, 4)} conf ${pad(c.confidence, 5)} needsConf ${pad(c.needsConfirmation, 5)} fallback ${pad(c.fallback ?? 'n/r', 5)} ${pad(c.latencyMs, 6)} ms  ${c.code || ''}`);
console.log(`reader requests: ${providerCalls.length}; provider model calls, upper bound (a reported fallback, a recognise and a failed read each counted as two): ${spent()}; budget ${PROVIDER_CALL_BUDGET}`);
console.log('');
console.log('── recorded, not judged');
for (const line of observations) console.log(`• ${line}`);
const failed = checks.filter(c => !c.ok);
console.log('');
console.log(`── expectations: ${checks.length - failed.length}/${checks.length} met`);
for (const c of checks) console.log(`${c.ok ? '✓' : '✗'} [${c.id}] ${c.name}${c.ok ? '' : `\n      ${c.detail}`}`);
if (unverified.length) { console.log(''); console.log('── NOT VERIFIED'); for (const u of unverified) console.log(`? [${u.id}] ${u.what}`); }
if (fatal) console.log(`\n✗ the run stopped early: ${fatal?.message || fatal}`);
console.log(`\nSIMULATED pages and report.json (transcripts only; the real photo is not in it): ${OUT}`);
writeFileSync(join(OUT, 'report.json'), JSON.stringify({
  evidenceClass: 'real photo + real provider + real localhost server (SQLite); not staging, not deployed, not a physical device; SIMULATED pages are typeset',
  generatedAt: new Date().toISOString(), reads, simulated, providerCalls, checks, unverified, observations, fatal: fatal ? String(fatal.message || fatal) : null
}, null, 2));
process.exit(fatal || failed.length ? 1 : unverified.length ? 3 : 0);
