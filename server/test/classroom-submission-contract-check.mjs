import assert from 'node:assert/strict';
import { openTestStore } from './support/engine.mjs';
import {
  returnStudentSubmission, studentSubmissionTransitionAllowed, writeStudentSubmission
} from '../platform/classes.js';

// SQLite by default; `--engine=postgres` runs it on a migrated Postgres.
const testStore = await openTestStore(undefined, { label: 'classroom_submission' });
const db = testStore.store;
const now = 1_900_000_000_000;

for (const [id, email, role] of [
  ['teacher-1', 'teacher@example.test', 'teacher'],
  ['student-1', 'student@example.test', 'student']
]) {
  await db.run(`INSERT INTO accounts(id,email,name,role,created_at,updated_at) VALUES (?,?,?,?,?,?)`, [id, email, id, role, now, now]);
}
await db.run(`INSERT INTO classes(id,teacher_account_id,name,join_code_hash,created_at)
  VALUES ('class-1','teacher-1','Class 10','hash-code',?)`, [now]);
await db.run(`INSERT INTO class_members(class_id,student_account_id,joined_at) VALUES ('class-1','student-1',?)`, [now]);
await db.run(`INSERT INTO assignments(id,class_id,teacher_account_id,title,specification_json,created_at)
  VALUES ('assignment-1','class-1','teacher-1','Quadratics','{}',?)`, [now]);

assert.equal(studentSubmissionTransitionAllowed(null, 'started'), true);
assert.equal(studentSubmissionTransitionAllowed(null, 'submitted'), true);
assert.equal(studentSubmissionTransitionAllowed('started', 'submitted'), true);
assert.equal(studentSubmissionTransitionAllowed('submitted', 'started'), false);
assert.equal(studentSubmissionTransitionAllowed('returned', 'started'), true);
assert.equal(studentSubmissionTransitionAllowed('returned', 'submitted'), true);

const started = await writeStudentSubmission(db, {
  assignmentId: 'assignment-1', studentId: 'student-1', state: 'started',
  summary: { kind: 'practice', questionsAnswered: 2, correct: 1, xp: 10, targetQuestions: 10 }, now: now + 10
});
assert.equal(started.state, 'started');
const submitted = await writeStudentSubmission(db, {
  assignmentId: 'assignment-1', studentId: 'student-1', state: 'submitted',
  summary: { kind: 'practice', questionsAnswered: 10, correct: 8, xp: 80, targetQuestions: 10 }, now: now + 20
});
assert.equal(submitted.state, 'submitted');

await assert.rejects(async () => writeStudentSubmission(db, {
  assignmentId: 'assignment-1', studentId: 'student-1', state: 'started',
  summary: {}, now: now + 30
}), error => error?.code === 'SUBMISSION_TRANSITION_INVALID');

const returned = await returnStudentSubmission(db, {
  assignmentId: 'assignment-1', studentId: 'student-1', teacherId: 'teacher-1',
  feedback: { note: 'Rework factorisation in question 4.' }, now: now + 40
});
assert.equal(returned.state, 'returned');
assert.equal((await db.get(`SELECT state FROM assignment_submissions WHERE assignment_id='assignment-1' AND student_account_id='student-1'`)).state, 'returned');
const feedback = (await db.get(`SELECT teacher_account_id,feedback_json,returned_at FROM assignment_feedback
  WHERE assignment_id='assignment-1' AND student_account_id='student-1'`));
assert.equal(feedback.teacher_account_id, 'teacher-1');
assert.equal(JSON.parse(feedback.feedback_json).note, 'Rework factorisation in question 4.');
assert.equal(feedback.returned_at, now + 40);

const revised = await writeStudentSubmission(db, {
  assignmentId: 'assignment-1', studentId: 'student-1', state: 'started',
  summary: { kind: 'practice', questionsAnswered: 0, correct: 0, xp: 0, targetQuestions: 10 }, now: now + 50
});
assert.equal(revised.state, 'started');
const resubmitted = await writeStudentSubmission(db, {
  assignmentId: 'assignment-1', studentId: 'student-1', state: 'submitted',
  summary: { kind: 'practice', questionsAnswered: 10, correct: 9, xp: 90, targetQuestions: 10 }, now: now + 60
});
assert.equal(resubmitted.submittedAt, now + 60);

await assert.rejects(async () => returnStudentSubmission(db, {
  assignmentId: 'assignment-1', studentId: 'student-1', teacherId: 'teacher-1',
  feedback: { blob: 'x'.repeat(40 * 1024) }, now: now + 70
}), error => error?.code === 'FEEDBACK_TOO_LARGE');

const audit = (await db.all(`SELECT action,target_id FROM audit_log WHERE action='assignment.return'`));
assert.deepEqual(audit, [{ action: 'assignment.return', target_id: 'assignment-1' }]);

// ── The privacy guarantee is a property of the writer, not of a path ─────────
//
// Express routes `.../submission/` to the same handler as `.../submission`, so a
// middleware matching the exact path let a trailing slash carry answers and raw
// ink into the classroom control plane while the write still succeeded. Both
// spellings, and the function itself, must strip.
const forbidden = {
  kind: 'practice', questionsAnswered: 3, correct: 2, xp: 10,
  answers: ['x = 42 (the student wrote this)'], ink: 'RAW-HANDWRITING-STROKES', studentNote: 'private free text'
};
const { startApp } = await import('./support/app-harness.mjs');
const http = await startApp({ db });
try {
  const jar = {};
  const registration = await http.request('/v1/account/register', {
    method: 'POST', jar, body: { email: 'slash.student@example.test', name: 'Slash', password: 'correct-horse-battery', deviceId: 'ipad-slash', isAdult: true }
  });
  assert.equal(registration.status, 201);
  const studentId = registration.data.account.id;
  await db.run("UPDATE accounts SET email_verified_at=? WHERE id=?", [now + 80, studentId]);
  await db.run(`INSERT INTO class_members(class_id,student_account_id,joined_at) VALUES ('class-1',?,?)`, [studentId, now + 80]);

  for (const path of [
    `/v1/classes/class-1/assignments/assignment-1/submission`,
    `/v1/classes/class-1/assignments/assignment-1/submission/`
  ]) {
    const response = await http.request(path, { method: 'PATCH', jar, body: { state: 'started', summary: forbidden } });
    assert.equal(response.status, 200, `${path} is the same route`);
    const row = (await db.get(`SELECT summary_json FROM assignment_submissions
      WHERE assignment_id='assignment-1' AND student_account_id=?`, [studentId])).summary_json;
    assert.deepEqual(JSON.parse(row), { kind: 'practice', questionsAnswered: 3, correct: 2, xp: 10 }, `${path} stores metrics only`);
    assert.ok(!/answers|ink|studentNote|wrote this/.test(row), `${path} stores no answer, ink or free text`);
    await db.run(`DELETE FROM assignment_submissions WHERE assignment_id='assignment-1' AND student_account_id=?`, [studentId]);
  }
} finally {
  await http.close();
}

await testStore.close();
console.log(`engine: ${testStore.engine}`);
console.log('PASS — classroom submissions cannot be silently unsubmitted; teacher returns are bounded, persisted and auditable; and no spelling of the submission route can store an answer or ink.');
