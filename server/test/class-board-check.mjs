// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the class board (classBoard.js), Prithagoras
//
// Per outcome, students per evidence state, from the server grader's own
// records only; drill-down names only the class's visible students; re-teach
// needs a shared registry misconception above the stated floor; removal and
// consent hide a student at once; another teacher or a student is refused;
// Priyabhata is refused with its reason, never drawn wrong.
//
//   node server/test/class-board-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
process.env.NODE_ENV = 'test';
process.env.PRI_EDITION = 'prithagoras';

const { startApp, registerAccount, verifyEmail, promoteRole, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { aggregateBoards, attemptRow, classBoard, RETEACH_MIN_STUDENTS } = await import('../platform/classBoard.js');
const { NODE_STATES, nswBoardGroups } = await import('../../client/src/engine/syllabusBoard.js');
const { NSW_BOARD_COURSES } = await import('../../client/src/engine/nswBoardCatalogue.js');

const c = checks();
const h = await startApp({ engine: requestedEngine() });
const db = h.db;
const NOW = Date.now();
const COURSE = 'k10-stage4';
const INT = 'MA4-INT-C-01';   // y7-integers.1 → MA4-INT-C-01 (catalogue crosswalk)

async function person(email, name, role) {
  const r = await registerAccount(h, { email, name, deviceId: `dev-${email}` });
  await verifyEmail(h, r.account.id);
  if (role !== 'student') await promoteRole(h, r.jar, r.account.id, role);
  return { id: r.account.id, jar: r.jar, name };
}
const req = (who, path, opts = {}) => h.request(path, { ...opts, jar: who.jar });
const T1 = await person('t1.board@example.test', 'Ms Rao', 'teacher');
const T2 = await person('t2.board@example.test', 'Mr Lee', 'teacher');
const S = [];
for (let i = 0; i < 4; i++) S.push(await person(`s${i}.board@example.test`, `Student ${i}`, 'student'));
const OUT = await person('out.board@example.test', 'Outsider', 'student');
const c1 = await req(T1, '/v1/classes', { method: 'POST', body: { name: 'Year 7' } });
const c2 = await req(T2, '/v1/classes', { method: 'POST', body: { name: 'Other' } });
const C1 = c1.data.class.id, C2 = c2.data.class.id;
for (const s of S) await req(s, '/v1/classes/join', { method: 'POST', body: { code: c1.data.joinCode } });
await req(OUT, '/v1/classes/join', { method: 'POST', body: { code: c2.data.joinCode } });

// The server grader's records, as practice writes them.
let cursor = 500000, seq = 0;
async function graded(student, { dotpoint, correct, misconception = null, device = 'server-grader', at = NOW - 3600000 }) {
  const id = `ga-${++seq}`;
  await db.run('INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [++cursor, id, student.id, device, seq, 'graded-attempt', `q-${seq}`, at, JSON.stringify({
      attemptId: id, questionId: `q-${seq}`, correct, marksEarned: correct ? 1 : 0, marksPossible: 1, subtopic: dotpoint.split('.')[0],
      difficulty: 2, dotpoint, mode: 'practice', hintsUsed: 1, support: 'supported', ...(misconception ? { misconception, misconceptionSource: 'step' } : {}),
      createdAt: at, serverAcknowledgedAt: at
    }), at]);
}
// S0: right (server records every answer as supported); S1, S2, S3: wrong with the same verified misconception.
await graded(S[0], { dotpoint: 'y7-integers.1', correct: true });
for (const s of S.slice(1)) await graded(s, { dotpoint: 'y7-integers.2', correct: false, misconception: 'sign-flipped' });
// A device-written event is never evidence; an outsider's record is not in the class.
await graded(S[0], { dotpoint: 'y7-fractions.1', correct: true, device: 'ipad-s0' });
await graded(OUT, { dotpoint: 'y7-fractions.1', correct: false, misconception: 'sign-flipped' });

// ── Pure ─────────────────────────────────────────────────────────────────────
c.eq(attemptRow({ payload_json: 'not json' }), null, 'a broken payload is no attempt');
c.deq(attemptRow({ occurred_at: 5, payload_json: JSON.stringify({ dotpoint: 'y7-integers.1' }) }).dotpoints, ['y7-integers.1'], 'the issued dot point is the only credit');
c.deq(attemptRow({ occurred_at: 5, payload_json: JSON.stringify({}) }).dotpoints, [], 'no dot point, no outcome');
const groups = nswBoardGroups(NSW_BOARD_COURSES[COURSE]);
const two = aggregateBoards(groups, [1, 2].map(i => ({ student: { id: `x${i}` }, attempts: [{ correct: false, misconception: 'sign-flipped', dotpoints: ['y7-integers.1'], createdAt: NOW }],
  board: { groups: groups.map(g => ({ nodes: g.nodes.map(n => ({ id: n.id, state: 'seen' })) })) } })), { now: NOW });
c.deq(two.reteach, [], `two students are below the re-teach floor (${RETEACH_MIN_STUDENTS})`);

// ── HTTP ─────────────────────────────────────────────────────────────────────
c.deq((await req(T1, '/v1/classroom/board/courses')).data.courses.map(x => x.id).includes(COURSE), true, 'the NSW courses are offered');
const board = await req(T1, `/v1/classroom/classes/${C1}/board?course=${COURSE}`);
c.eq(board.status, 200, 'T1 reads the class board');
c.deq(board.data.states, NODE_STATES, 'the states are the syllabus board\'s own');
c.eq(board.data.students, 4, 'four visible students');
const node = id => board.data.groups.flatMap(g => g.nodes).find(n => n.id === id);
const counts = node(INT).counts;
c.eq(Object.values(counts).reduce((a, b) => a + b, 0), 4, 'every visible student is in exactly one state for an outcome');
c.deq([counts.assisted, counts.seen, counts.independent, counts.retained], [1, 3, 0, 0],
  'a right answer the server records as supported is "with help"; three wrong answers are "seen"');
c.eq(node('MA4-FRC-C-01').counts['not-started'], 4, 'a device-written answer counts for nothing');
c.deq(board.data.reteach.map(r => [r.node, r.misconception, r.students, r.of]), [[INT, 'sign-flipped', 3, 4]], 'three of four students broke at the same verified misconception: re-teach');
c.ok(!/Student \d|Outsider/.test(JSON.stringify(board.data)) && !S.some(s => JSON.stringify(board.data).includes(s.id)), 'the board itself names no student');
const drill = await req(T1, `/v1/classroom/classes/${C1}/board?course=${COURSE}&node=${INT}`);
c.deq(drill.data.drill.states.seen.map(s => s.name).sort(), ['Student 1', 'Student 2', 'Student 3'], 'the drill-down names the students behind a state');
c.ok(!JSON.stringify(drill.data).includes('Outsider'), 'never a student of another class');
c.eq((await req(T1, `/v1/classroom/classes/${C1}/board?course=${COURSE}&node=NOPE`)).status, 404, 'an unknown outcome is refused');
c.eq((await req(T1, `/v1/classroom/classes/${C1}/board?course=nope`)).status, 400, 'an unknown course is refused');
c.eq((await req(T2, `/v1/classroom/classes/${C1}/board?course=${COURSE}`)).status, 404, 'another teacher cannot read the board');
c.eq((await req(S[0], `/v1/classroom/classes/${C1}/board?course=${COURSE}`)).status, 403, 'a student cannot read the board');

// ── Removal and consent ──────────────────────────────────────────────────────
await req(T1, `/v1/classes/${C1}/students/${S[3].id}`, { method: 'DELETE' });
await db.run("UPDATE accounts SET age_basis='child' WHERE id=?", [S[2].id]);
const after = await req(T1, `/v1/classroom/classes/${C1}/board?course=${COURSE}&node=${INT}`);
c.deq([after.data.students, after.data.withheld], [2, 1], 'a removed student leaves; one without consent is withheld (counted, not named)');
c.deq(after.data.drill.states.seen.map(s => s.name), ['Student 1'], 'and neither is named in the drill-down');
c.deq(after.data.reteach, [], 'the re-teach suggestion falls away with them');

// ── Priyabhata: refused with the reason ──────────────────────────────────────
const india = await classBoard(db, { classId: C1, course: COURSE, policy: { curriculum: 'in' } });
c.deq([india.status, india.code], [409, 'CLASS_BOARD_NOT_YET'], 'Priyabhata is refused, not drawn as all not-started');

await h.close();
console.log(`class-board-check (${h.engine}): ${c.count()} checks passed`);
