// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the teacher workspace (classroom.js), R4
//
// A real paper is issued, sat and marked by the server's own engine; the
// student hands it in; the teacher reviews it. Proves:
//   · isolation: a teacher reaches only their own class, only its active,
//     consented members; another teacher, a student, a non-member get 404/403;
//   · privacy: no teacher response carries a student's private notes, AI/tutor
//     conversations, practice transcripts or email address;
//   · removal and consent: a removed student, or one whose guardian consent is
//     not in place, disappears from every teacher read at once;
//   · the teacher-mark audit trail: append-only rows (who, when, criterion,
//     engine mark at the time, superseded row), audit_log entries, capped
//     awards, history in order; UPDATE refused;
//   · separation: the stored exam result and every graded-attempt event are
//     byte-identical before and after teacher marks; results reconcile
//     (engine score = stored score; teacher total = sum of effective awards);
//   · the CSV keeps engine and teacher marks in separate columns and neutralises
//     formula cells.
//
//   node server/test/classroom-check.mjs
//   node scripts/with-postgres.mjs node server/test/classroom-check.mjs --engine=postgres
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
process.env.NODE_ENV = 'test';
delete process.env.PRI_METHOD_MARKS;
(await import('../platform/indiaBanks.js')).allowBanksOutsideIndiaForTests();

const { startApp, registerAccount, verifyEmail, promoteRole, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { stepMetaFor } = await import('../platform/practice.js');
const { checkAnswer } = await import('../../client/src/engine/checker.js');
const { loadAllBanks } = await import('../../client/src/engine/generators/index.js');
const { subtopicsForYear } = await import('../../client/src/engine/curriculum.js');
const { multipartForYear } = await import('../../client/src/engine/generators/multipart.js');
const { reviewEvidence, REVIEW_LINE_STATUSES } = await import('../platform/markerOps.js');
const { csvCell, reviewCap, criteriaFor, TEACHER_VISIBILITY } = await import('../platform/classroom.js');
const { validatePaperAssignment, resultMatchesTemplate } = await import('../platform/paperAssignments.js');

const c = checks();
const h = await startApp({ engine: requestedEngine() });
const db = h.db;
await loadAllBanks();

// ── Pure pieces ──────────────────────────────────────────────────────────────
c.eq(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"', 'a formula cell is neutralised and quoted');
c.eq(csvCell('+1'), "'+1", 'a leading + is neutralised');
c.eq(csvCell('Asha, R'), '"Asha, R"', 'a comma is quoted');
c.eq(reviewCap({ correct: false, markingScheme: 'final-answer', marks: 3, awarded: 0, working: '2x=4' }), 2, 'a wrong 3-mark answer leaves at most 2 for a teacher');
c.eq(reviewCap({ correct: true, markingScheme: 'final-answer', marks: 3, awarded: 3, working: 'x' }), 0, 'a right answer leaves nothing');
c.eq(reviewCap({ correct: false, markingScheme: 'step-marked', marks: 3, awarded: 1, working: 'x' }), 0, 'an answer the engine step-marked is not a teacher\'s');
c.eq(reviewCap({ correct: false, markingScheme: 'final-answer', marks: 1, awarded: 0, working: 'x' }), 0, 'a one-mark question has no method mark');
c.eq(reviewCap({ correct: false, markingScheme: 'final-answer', marks: 3, awarded: 0, working: '  ' }), 0, 'no working, nothing to judge');
c.eq(reviewCap({ correct: false, markingScheme: 'final-answer', marks: 3, awarded: 0, working: 'x', pending: true }), 0, 'handwriting not read yet is not judged');
c.deq(criteriaFor({ lines: ['ok', 'break', 'unsure'], firstBreak: 1 }), ['method', 'follow-through'], 'a verified line before the break and a line after it');
c.deq(criteriaFor({ lines: ['break'], firstBreak: 0 }), [], 'nothing verified, nothing after: no criterion');
const fault = reviewEvidence(null, ['x=1']);
c.deq(fault, { lines: ['unsure'], firstBreak: -1, verifiedLines: 0, diagnosis: null }, 'the review op fails closed without a question');
c.deq(REVIEW_LINE_STATUSES, ['ok', 'break', 'unsure'], 'line statuses are a closed set');
c.ok(TEACHER_VISIBILITY.never.includes('notes') && TEACHER_VISIBILITY.never.includes('tutor-and-ai-chats') && TEACHER_VISIBILITY.never.includes('email'),
  'the visibility list says notes, AI chats and email are never seen');
c.eq(validatePaperAssignment({ kind: 'paper', paper: { kind: 'practice-paper', year: 7, minutes: 30 }, timed: false }).ok, false, 'an untimed paper is refused (untimed work is a practice set)');
c.eq(validatePaperAssignment({ kind: 'paper', paper: { kind: 'practice-paper', year: 7, minutes: 30 }, extra: 1 }).ok, false, 'unknown keys are refused');
c.ok(resultMatchesTemplate({ kind: 'practice-paper', paper: { year: 7, minutes: 30, pathway: null } }, { kind: 'practice-paper', year: 7, minutes: 30, pathway: null }), 'a matching result');
c.ok(!resultMatchesTemplate({ kind: 'practice-paper', paper: { year: 8, minutes: 30, pathway: null } }, { kind: 'practice-paper', year: 7, minutes: 30, pathway: null }), 'another year does not match');

// ── Static: no model, and no engine mark is ever written here ──────────────
{
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../platform/classroom.js', import.meta.url), 'utf8');
  const imports = [...src.matchAll(/from '([^']+)'/g)].map(m => m[1]);
  c.ok(!imports.some(i => /openai|tutor|workingProvider|handwritingProvider|questionPhotoProvider|aiAllowance/i.test(i)), 'classroom.js imports no model provider or tutor');
  c.ok(!/INSERT INTO learning_events|UPDATE learning_events|scope='exam-result'.*UPDATE|UPDATE idempotency_keys|INSERT INTO idempotency_keys/.test(src), 'classroom.js writes no learning event and no exam or practice record');
  c.ok(!/UPDATE teacher_marks|DELETE FROM teacher_marks/.test(src), 'classroom.js never edits or deletes a teacher mark');
}

// ── People ───────────────────────────────────────────────────────────────────
async function person(email, name, role) {
  const r = await registerAccount(h, { email, name, deviceId: `dev-${email}` });
  c.eq(r.status, 201, `${name} registers`);
  await verifyEmail(h, r.account.id);
  if (role !== 'student') await promoteRole(h, r.jar, r.account.id, role);
  return { id: r.account.id, jar: r.jar, email, name };
}
const T1 = await person('t1.class@example.test', 'Ms Rao', 'teacher');
const T2 = await person('t2.class@example.test', 'Mr Lee', 'teacher');
const S1 = await person('s1.class@example.test', '=HYPERLINK("http://evil")', 'student');
const S2 = await person('s2.class@example.test', 'Ben', 'student');
const S3 = await person('s3.class@example.test', 'Cara', 'student');
const req = (who, path, opts = {}) => h.request(path, { ...opts, jar: who.jar });

const c1 = await req(T1, '/v1/classes', { method: 'POST', body: { name: 'Year 7 Maths' } });
const c2 = await req(T2, '/v1/classes', { method: 'POST', body: { name: 'Year 7 Other' } });
c.deq([c1.status, c2.status], [201, 201], 'two teachers each create a class');
const C1 = c1.data.class.id, C2 = c2.data.class.id;
for (const [s, code] of [[S1, c1.data.joinCode], [S2, c1.data.joinCode], [S3, c2.data.joinCode]]) {
  c.eq((await req(s, '/v1/classes/join', { method: 'POST', body: { code } })).status, 200, `${s.email} joins by code`);
}

// ── A paper assignment ───────────────────────────────────────────────────────
const PAPER = { kind: 'practice-paper', year: 7, minutes: 30 };
const bad = await req(T1, `/v1/classes/${C1}/assignments`, { method: 'POST', body: { title: 'Paper', specification: { kind: 'paper', paper: { kind: 'nowhere' } } } });
c.eq(bad.status, 400, 'a paper this edition does not set is refused');
const asg = await req(T1, `/v1/classes/${C1}/assignments`, { method: 'POST', body: { title: 'Week 4 paper', specification: { kind: 'paper', paper: PAPER }, dueAt: Date.now() + 86400000 } });
c.eq(asg.status, 201, 'a paper is assigned');
c.deq(asg.data.assignment.specification, { kind: 'paper', paper: { ...PAPER, pathway: null }, timed: true }, 'stored as a template: which paper, never which questions');
const A1 = asg.data.assignment.id;

// ── The student sits the server's paper ──────────────────────────────────────
const Y7 = subtopicsForYear(7).map(s => s.id);
const Y7_OTHER = Y7.find(id => id !== 'y7-equations');
const ladder = (i, n) => { const t = i / n; return t < 0.2 ? 1 : t < 0.6 ? 2 : t < 0.9 ? 3 : 4; };
const spec = { kind: 'practice-paper', paper: { year: 7, minutes: 30 },
  slots: [...Array.from({ length: 10 }, (_, i) => ({ generator: i % 2 ? 'y7-equations' : Y7_OTHER, difficulty: ladder(i, 10) })), { multipart: multipartForYear(7, 'advanced')[0] }] };
let keySeq = 0;
async function sit(student) {
  await db.run('DELETE FROM rate_limits');
  const created = await h.request('/v1/exams', { method: 'POST', jar: student.jar, body: spec, headers: { 'Idempotency-Key': `classroom-${++keySeq}-${Date.now().toString(36)}` } });
  c.eq(created.status, 201, `${student.name}: a paper is issued`);
  const id = created.data.exam.id;
  const sealed = JSON.parse((await db.get("SELECT response_json FROM idempotency_keys WHERE scope='exam-paper' AND key=?", [id])).response_json);
  const answers = {}, workings = {};
  let judged = 0;
  for (const sq of sealed.questions) {
    const q = sq.payload;
    if (q.multipart) continue;
    const meta = stepMetaFor(q);
    const root = meta?.kind === 'equation' && meta.solutions?.length === 1 ? Number(meta.solutions[0]) : NaN;
    const wrong = String(root + 3);
    let isRight = false; try { isRight = checkAnswer(q, wrong).correct === true; } catch { isRight = true; }
    if (Number(sq.marking.correct) >= 2 && Number.isFinite(root) && !isRight) {
      const v = meta.variable || 'x';
      // A sound first line, a wrong line (the break), then a line that follows from it.
      workings[sq.id] = `2${v} = ${2 * root}\n${v} = ${root + 3}\n${v} + 1 = ${root + 4}`;
      answers[sq.id] = wrong;
      judged++;
    }
  }
  const done = await h.request(`/v1/exams/${id}/finish`, { method: 'POST', jar: student.jar, body: { answers, workings } });
  c.eq(done.status, 200, `${student.name}: the paper is finalised by the server`);
  return { id, judged, result: done.data };
}

const early = await sit(S2);
const p1 = await sit(S1);
c.ok(p1.judged >= 1, `S1 has at least one wrong written answer worth 2+ marks (${p1.judged})`);
const p3 = await sit(S3);

// One answer was handwritten: its page was read and resolved, and the server
// froze the page's SHA-256 with the paper (exams.js handwriting.pages).
const INK = 'ab'.repeat(32);
const inkKey = p1.result.detail.find(d => !d.parts && !d.correct && d.working)?.id;
{
  const row = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='exam-result' AND key=?", [S1.id, p1.id]);
  const r = JSON.parse(row.response_json);
  r.handwriting = { pages: { [inkKey]: { key: inkKey, questionId: inkKey, digest: INK, state: 'resolved' } } };
  await db.run("UPDATE idempotency_keys SET response_json=? WHERE account_id=? AND scope='exam-result' AND key=?", [JSON.stringify(r), S1.id, p1.id]);
}

// The original-ink lane stores the original and names it on the graded-attempt event.
const ORIGINAL = { id: 'orig_abc123', sha256: 'ef'.repeat(32), kind: 'strokes', origin: 'ink' };
const origLine = p1.result.detail.filter(d => !d.parts && !d.correct && d.working)[0];
{
  const ev = await db.get('SELECT payload_json FROM learning_events WHERE account_id=? AND id=?', [S1.id, origLine.attemptId]);
  await db.run('UPDATE learning_events SET payload_json=? WHERE account_id=? AND id=?', [JSON.stringify({ ...JSON.parse(ev.payload_json), original: ORIGINAL }), S1.id, origLine.attemptId]);
}

// Snapshot everything the engine wrote, to prove it never changes.
const engineState = async who => ({
  result: (await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='exam-result'", [who.id]))?.response_json,
  events: (await db.all("SELECT id,payload_json FROM learning_events WHERE account_id=? AND device_id='server-grader' ORDER BY server_cursor", [who.id])).map(r => `${r.id}:${r.payload_json}`)
});
const s1Before = await engineState(S1);
c.ok(s1Before.result && s1Before.events.length > 0, 'the engine wrote a result and graded-attempt events');

// ── Hand-in ──────────────────────────────────────────────────────────────────
const handin = (who, cls, asn, examId) => req(who, `/v1/classroom/classes/${cls}/assignments/${asn}/hand-in`, { method: 'POST', body: { examId } });
// S2's paper was started before the assignment existed? No: all after. Make one that predates it.
await db.run("UPDATE idempotency_keys SET response_json=REPLACE(response_json, '\"startedAt\":', '\"startedAt\":1,\"_was\":') WHERE account_id=? AND scope='exam-paper' AND key=?", [S2.id, early.id]);
c.eq((await handin(S2, C1, A1, early.id)).status, 409, 'a paper started before the assignment was set is refused');
c.eq((await handin(S1, C1, A1, p3.id)).status, 404, 'another student\'s paper cannot be handed in');
c.eq((await handin(S3, C1, A1, p3.id)).status, 404, 'a non-member cannot hand in to the class');
c.eq((await handin(T1, C1, A1, p1.id)).status, 403, 'a teacher does not hand in');
const hi = await handin(S1, C1, A1, p1.id);
c.eq(hi.status, 201, 'S1 hands in the paper');
c.ok(hi.data.handin.reviewItems >= 1, `review items are created for the teacher (${hi.data.handin.reviewItems})`);
c.eq((await handin(S1, C1, A1, p1.id)).status, 409, 'a paper is handed in once');
// The same paper cannot be handed in to a second assignment (409, not a 500).
const asg2 = await req(T1, `/v1/classes/${C1}/assignments`, { method: 'POST', body: { title: 'Same paper again', specification: { kind: 'paper', paper: PAPER } } });
const again = await handin(S1, C1, asg2.data.assignment.id, p1.id);
c.deq([again.status, again.data?.error?.code], [409, 'HANDIN_EXAM_USED'], 'one paper is handed in to one assignment');
// A paper assignment is submitted only by hand-in, and its template is frozen once handed in.
c.deq((await req(S1, `/v1/classes/${C1}/assignments/${A1}/submission`, { method: 'PATCH', body: { state: 'submitted', summary: { questionsAnswered: 10, correct: 10 } } })).data?.error?.code, 'ASSIGNMENT_IS_A_PAPER', 'a device summary cannot submit a paper');
const practice = await req(T1, `/v1/classes/${C1}/assignments`, { method: 'POST', body: { title: 'Set', specification: { kind: 'practice', questionCount: 5 } } });
c.deq((await req(T1, `/v1/classes/${C1}/assignments/${practice.data.assignment.id}`, { method: 'PATCH', body: { specification: { kind: 'paper', paper: PAPER } } })).data?.error?.code, 'ASSIGNMENT_KIND_CHANGE', 'a practice set cannot be turned into a paper');
c.deq((await req(T1, `/v1/classes/${C1}/assignments/${A1}`, { method: 'PATCH', body: { specification: { kind: 'paper', paper: { kind: 'practice-paper', year: 8, minutes: 30 } } } })).data?.error?.code, 'ASSIGNMENT_HANDED_IN', 'a handed-in paper cannot be retargeted');
c.eq((await db.get('SELECT state FROM assignment_submissions WHERE assignment_id=? AND student_account_id=?', [A1, S1.id])).state, 'submitted', 'the submission is submitted');

// Handwriting that can still be read blocks hand-in; a page past its window does not.
{
  const asgC2 = await req(T2, `/v1/classes/${C2}/assignments`, { method: 'POST', body: { title: 'Paper', specification: { kind: 'paper', paper: PAPER } } });
  const S4 = await person('s4.class@example.test', 'Dev', 'student');
  await req(S4, '/v1/classes/join', { method: 'POST', body: { code: c2.data.joinCode } });
  const p4 = await sit(S4);
  const row = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='exam-result' AND key=?", [S4.id, p4.id]);
  const r = JSON.parse(row.response_json);
  const setPages = async (handwriting) => db.run("UPDATE idempotency_keys SET response_json=? WHERE account_id=? AND scope='exam-result' AND key=?", [JSON.stringify({ ...r, handwriting }), S4.id, p4.id]);
  const page = { key: 'k', digest: 'cd'.repeat(32), state: 'needs-review', reason: 'uncertain', attempts: 1, autoUsed: true, nextAttemptAt: 0 };
  await setPages({ windowEndsAt: Date.now() + 86400000, pages: { k: page } });
  c.deq((await handin(S4, C2, asgC2.data.assignment.id, p4.id)).data?.error?.code, 'HANDIN_HANDWRITING_PENDING', 'a page that can still be read (tries left, in its window) is refused');
  await setPages({ windowEndsAt: Date.now() - 1000, pages: { k: { ...page, state: 'awaiting-reading' } } });
  c.eq((await handin(S4, C2, asgC2.data.assignment.id, p4.id)).status, 201, 'a page whose reading window has closed is final: the paper may be handed in');
}

// ── Private data a teacher must never see ────────────────────────────────────
await db.run('INSERT INTO sync_entities(account_id,kind,entity_id,version,server_cursor,body_json,tombstone,updated_at) VALUES (?,?,?,?,?,?,?,?)',
  [S1.id, 'note', 'n1', 1, 1, JSON.stringify({ text: 'S1-PRIVATE-NOTE' }), 0, Date.now()]);
await db.run('INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
  [990001, 'tut-1', S1.id, 'dev-s1', 99, 'tutor-message', 't1', Date.now(), JSON.stringify({ text: 'S1-AI-CHAT' }), Date.now()]);
await db.run('INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,?,?,?,?,?,?)',
  [S1.id, 'practice-recognition', 'rc-1', JSON.stringify({ text: 'S1-PRACTICE-TRANSCRIPT' }), 'd', Date.now(), Date.now() + 86400000]);
const teacherTexts = [];
const t = async (who, path, opts) => { const r = await req(who, path, opts); teacherTexts.push(r.text || JSON.stringify(r.data)); return r; };

// ── Isolation ────────────────────────────────────────────────────────────────
const queue = await t(T1, `/v1/classroom/classes/${C1}/review`);
c.eq(queue.status, 200, 'T1 reads the review queue');
c.ok(queue.data.items.length >= 1 && queue.data.items.every(i => i.student.id === S1.id), 'every item is S1\'s');
const inked = queue.data.items.filter(i => i.question.key === inkKey);
c.ok(inked.length >= 1 && inked.every(i => i.evidence.inputMode === 'ink' && i.evidence.ink?.digest === INK), 'a handwritten answer carries the digest of the original page the teacher judges');
c.ok(queue.data.items.filter(i => i.question.key !== inkKey).every(i => i.evidence.inputMode === 'typed' && i.evidence.ink === null), 'typed answers carry no ink');
const item = inked[0] || queue.data.items[0];
c.ok(queue.data.items.some(i => i.question.key === origLine.id), 'the answer with a stored original has a review item');
c.ok(queue.data.items.filter(i => i.question.key === origLine.id).every(i => JSON.stringify(i.evidence.original) === JSON.stringify(ORIGINAL))
  && queue.data.items.filter(i => i.question.key !== origLine.id).every(i => i.evidence.original === null), 'the stored original the teacher judges is named on its item, and only there');
// The input mode is the server's record of the marked answer, never an autosave's.
c.ok(queue.data.items.filter(i => i.question.key !== inkKey).every(i => i.evidence.inputMode === 'typed'), 'typed answers are typed by the graded-attempt record');
c.ok(item.evidence.reading.length >= 2 && item.evidence.lineStatuses.length === item.evidence.reading.length, 'the teacher sees the working as read and a verdict per line');
c.ok(item.evidence.lineStatuses.every(s => REVIEW_LINE_STATUSES.includes(s)), 'line verdicts are the closed set');
c.ok(item.engineAwarded + item.available < item.marksPossible, 'the cap never reaches full marks for a wrong answer');
c.eq(item.teacherMark, null, 'nothing is decided yet');
c.ok(!('suggestedMark' in item) && !JSON.stringify(item).includes('suggest'), 'no suggested mark of any kind');
c.eq((await req(T2, `/v1/classroom/classes/${C1}/review`)).status, 404, 'another teacher cannot read the queue');
c.eq((await req(T2, `/v1/classroom/classes/${C2}/review/${item.id}`, { method: 'POST', body: { decision: 'award', marks: 1 } })).status, 404, 'another teacher cannot mark the item through their own class');
c.eq((await req(T2, `/v1/classroom/classes/${C1}/review/${item.id}`, { method: 'POST', body: { decision: 'award', marks: 1 } })).status, 404, 'nor through the owner\'s class');
c.eq((await req(S1, `/v1/classroom/classes/${C1}/review`)).status, 403, 'a student cannot read the queue');
c.eq((await req(S1, `/v1/classroom/classes/${C1}/review/${item.id}`, { method: 'POST', body: { decision: 'award', marks: 1 } })).status, 403, 'a student cannot mark');
c.eq((await req(T2, `/v1/classroom/classes/${C1}/assignments/${A1}/results`)).status, 404, 'another teacher cannot read results');
c.eq((await req(T2, `/v1/classroom/classes/${C1}/assignments/${A1}/results.csv`)).status, 404, 'nor export them');
const t2queue = await req(T2, `/v1/classroom/classes/${C2}/review`);
c.ok(t2queue.data.items.every(i => i.student.id !== S1.id && i.student.id !== S2.id) && t2queue.data.items.every(i => !queue.data.items.some(x => x.id === i.id)), 'T2\'s own queue holds nothing of T1\'s class');

// ── Teacher marks: the audit trail ───────────────────────────────────────────
const post = body => t(T1, `/v1/classroom/classes/${C1}/review/${item.id}`, { method: 'POST', body });
c.eq((await post({ decision: 'award', marks: item.available + 1 })).status, 400, 'an award over the cap is refused');
c.eq((await post({ decision: 'award', marks: 1, suggested: true })).status, 400, 'unknown fields are refused');
c.eq((await post({ decision: 'decline', marks: 1 })).status, 400, 'a decline carries no marks');
const first = await post({ decision: 'award', marks: 1, comment: 'Sound first step.' });
c.eq(first.status, 201, 'T1 awards one teacher mark');
c.deq([first.data.mark.label, first.data.mark.criterion, first.data.mark.marks, first.data.mark.teacherId], ['teacher', item.criterion, 1, T1.id], 'labelled teacher, with the criterion, marks and who');
c.eq((await post({ decision: 'award', marks: 1, comment: 'Sound first step.' })).status, 200, 'the same decision again changes nothing');
const second = await post({ decision: 'decline', comment: 'On reflection, no.' });
c.eq(second.status, 201, 'T1 changes their mind');
const history = await t(T1, `/v1/classroom/classes/${C1}/review/${item.id}/history`);
c.deq(history.data.history.map(m => [m.decision, m.marks, m.supersedes]), [['award', 1, null], ['decline', 0, first.data.mark.id]], 'the history keeps both, in order, the second superseding the first');
const rows = await db.all('SELECT * FROM teacher_marks WHERE review_item_id=? ORDER BY created_at,id', [item.id]);
c.deq(rows.map(r => [r.teacher_account_id, r.criterion, r.decision, Number(r.engine_awarded)]), [[T1.id, item.criterion, 'award', item.engineAwarded], [T1.id, item.criterion, 'decline', item.engineAwarded]],
  'each row records who, which criterion and the engine mark at the time');
c.ok(rows.every(r => Number(r.created_at) > 0), 'and when');
c.ok(rows.every(r => r.ink_digest === INK) && first.data.mark.inkDigest === INK, 'and which ink version the teacher reviewed');
const audits = await db.all("SELECT action,metadata_json FROM audit_log WHERE target_id=? AND action LIKE 'teacher-mark.%' ORDER BY id", [item.id]);
c.deq(audits.map(a => [a.action, JSON.parse(a.metadata_json).criterion]), [['teacher-mark.award', item.criterion], ['teacher-mark.decline', item.criterion]], 'every decision is in the audit log');
let refused = false;
try { await db.run('UPDATE teacher_marks SET marks=2 WHERE id=?', [rows[0].id]); } catch { refused = true; }
c.ok(refused, 'a teacher mark cannot be edited in place');
const third = await post({ decision: 'award', marks: 1 });
c.eq(third.status, 201, 'and awarded again');
// The other criterion on the same question shares the cap.
const sibling = queue.data.items.find(i => i.question.key === item.question.key && i.id !== item.id);
c.ok(!!sibling, 'the sound line before the break and the line after it give both criteria on one question');
{
  const rest = item.available - 1;
  const over = await t(T1, `/v1/classroom/classes/${C1}/review/${sibling.id}`, { method: 'POST', body: { decision: 'award', marks: rest + 1 } });
  c.eq(over.status, rest + 1 > sibling.available ? 400 : 409, 'the two criteria of one question share one cap');
}

// ── Engine marks unchanged; results reconcile ────────────────────────────────
c.deq(await engineState(S1), s1Before, 'the stored exam result and every graded-attempt event are byte-identical');
const exam = await req(S1, `/v1/exams/${p1.id}`);
c.eq(exam.data?.result?.score ?? exam.data?.score, p1.result.score, 'the paper still reads back with the engine\'s score');
const results = await t(T1, `/v1/classroom/classes/${C1}/assignments/${A1}/results`);
c.eq(results.status, 200, 'T1 reads the results');
const r1 = results.data.students.find(s => s.student.id === S1.id);
c.eq(r1.engine.score, p1.result.score, 'the engine score is the stored score');
const effective = Number((await db.get(`SELECT COALESCE(SUM(m.marks),0) AS n FROM teacher_marks m WHERE m.student_account_id=? AND m.decision='award'
  AND NOT EXISTS (SELECT 1 FROM teacher_marks s WHERE s.supersedes=m.id)`, [S1.id])).n);
c.eq(r1.teacher.awarded, effective, 'the teacher total is the sum of effective teacher awards');
c.deq([r1.teacher.label, r1.withTeacherMarks.score, r1.withTeacherMarks.label], ['teacher', r1.engine.score + effective, 'engine-plus-teacher'], 'the combined total is labelled as such');
c.ok(r1.questions.every(q => q.engine.awarded === q.awarded && 'teacher' in q), 'per question, engine and teacher marks are separate fields');
c.ok(results.data.questions.length >= 10 && results.data.questions.every(q => Array.isArray(q.commonFirstBreaks)), 'per-question results with common first breaks');
c.ok(!results.data.students.some(s => s.student.id === S3.id), 'a student of another class is not listed');
const csv = await t(T1, `/v1/classroom/classes/${C1}/assignments/${A1}/results.csv`);
c.eq(csv.status, 200, 'the CSV exports');
c.ok(/^student,handed_in,question,outcome,marks,engine_marks,teacher_marks,/.test(csv.text), 'engine and teacher marks are separate columns');
c.ok(csv.text.includes(`"'=HYPERLINK(""http://evil"")"`) && !/\n=HYPERLINK/.test(csv.text), 'a formula in a student name is neutralised');
c.ok(!!(await db.get("SELECT 1 FROM audit_log WHERE action='assignment.results.export' AND target_id=?", [A1])), 'the export is audited');

// ── The student sees what the teacher sees, and their teacher marks ─────────
const mine = await req(S1, '/v1/classroom/mine');
c.eq(mine.status, 200, 'S1 reads what their teacher can see');
c.deq(mine.data.visibility, JSON.parse(JSON.stringify(TEACHER_VISIBILITY)), 'the same list the server enforces');
const myMarks = mine.data.handins[0].teacherMarks.filter(m => m.teacherMark?.id);
c.ok(myMarks.length >= 1 && myMarks.every(m => m.teacherMark.label === 'teacher' && !('teacherId' in m.teacherMark)), 'teacher marks are labelled, without the teacher\'s id');
c.eq((await req(T1, '/v1/classroom/mine')).status, 403, 'a teacher has no student view');

// ── Consent and removal ──────────────────────────────────────────────────────
await db.run("UPDATE accounts SET age_basis='child' WHERE id=?", [S2.id]);
const withheld = await t(T1, `/v1/classroom/classes/${C1}/assignments/${A1}/results`);
c.ok(!withheld.data.students.some(s => s.student.id === S2.id) && withheld.data.withheld === 1, 'a member without guardian consent is withheld (counted, not named)');
c.eq((await req(T1, `/v1/classes/${C1}/students/${S1.id}`, { method: 'DELETE' })).data.removed, true, 'T1 removes S1');
const after = await t(T1, `/v1/classroom/classes/${C1}/review?state=all`);
c.deq(after.data.items, [], 'the removed student\'s items leave the queue');
c.eq((await post({ decision: 'award', marks: 1 })).status, 404, 'and cannot be marked');
c.eq((await req(T1, `/v1/classroom/classes/${C1}/review/${item.id}/history`)).status, 404, 'nor their history read');
const gone = await t(T1, `/v1/classroom/classes/${C1}/assignments/${A1}/results.csv`);
c.ok(!gone.text.includes('HYPERLINK'), 'the removed student is not in the export');
c.eq((await handin(S1, C1, A1, p1.id)).status, 404, 'a removed student cannot hand in');

// ── Nothing private reached a teacher ────────────────────────────────────────
const all = teacherTexts.join('\n');
for (const secret of ['S1-PRIVATE-NOTE', 'S1-AI-CHAT', 'S1-PRACTICE-TRANSCRIPT', S1.email, S2.email, S3.email]) {
  c.ok(!all.includes(secret), `no teacher response carries ${secret.includes('@') ? 'a student email' : secret}`);
}

await h.close();
console.log(`engine: ${h.engine}`);
console.log(`classroom-check (${h.engine}): ${c.count()} checks passed`);
