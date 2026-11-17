// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the CLASS board (teacher workspace)
//
//   GET /v1/classroom/classes/:classId/board?course=<id>[&node=<code>]
//
// The syllabus board (client/src/engine/syllabusBoard.js, one student) read for
// every visible student of a class, and counted: per outcome, how many
// students are in each evidence state. A count is a shape and a word on the
// device, never a colour alone and never a percentage of mastery.
//
//   · Evidence is the server grader's own record only: 'graded-attempt' events
//     written by device 'server-grader'. A device-written event never counts.
//   · An attempt counts towards an outcome only through the dot point the
//     server issued it under (the NSW crosswalk NSW_DOTPOINT_OUTCOMES); an
//     attempt without one is credited to no outcome. Nothing is guessed.
//   · Visible students only (classroom.js visibleStudents): active members of
//     a class this teacher owns, whose guardian consent is in place.
//   · Drill-down (`node`) names the students behind each state for ONE outcome.
//   · Re-teach: an outcome where several students' wrong answers carry the SAME
//     misconception-registry id, as the deterministic engine diagnosed it (an
//     authored trap or a high-confidence Step Check). The floor — at least
//     RETEACH_MIN_STUDENTS students and RETEACH_MIN_SHARE of the visible class,
//     within RETEACH_WINDOW_DAYS — is a product choice for a useful prompt, not
//     a research threshold, and the suggestion says how many students it rests on.
//
// Prithagoras first: an NSW course from the board catalogue. Priyabhata answers
// do not yet carry their chapter dot point on the server, so a Priyabhata class
// board would show every outcome as not started; it is refused with that reason
// rather than shown wrong.
// ─────────────────────────────────────────────────────────────────────────────
import { asStore } from './store.js';
import { bankPolicy } from './editionBanks.js';
import { visibleStudents } from './classroom.js';
import { NODE_STATES, nswBoardGroups, syllabusBoard } from '../../client/src/engine/syllabusBoard.js';
import { NSW_BOARD_COURSES, NSW_DOTPOINT_OUTCOMES } from '../../client/src/engine/nswBoardCatalogue.js';
import { resolveMisconceptionId } from '../../client/src/engine/misconceptions.js';

export const RETEACH_MIN_STUDENTS = 3;
export const RETEACH_MIN_SHARE = 0.25;
export const RETEACH_WINDOW_DAYS = 42;
const SCAN = 2000;
const DAY_MS = 86400000;

/** The courses a class board can be drawn for in this edition. */
export function boardCourses(policy = bankPolicy()) {
  if (policy.curriculum !== 'nsw') return [];
  return Object.values(NSW_BOARD_COURSES).map(c => ({ id: c.key, name: c.name, syllabus: c.syllabus, version: c.version }));
}

/** A stored graded-attempt payload as the board engine reads an attempt. */
export function attemptRow(row) {
  let p;
  try { p = JSON.parse(row.payload_json); } catch { return null; }
  if (!p || typeof p !== 'object') return null;
  const dotpoints = typeof p.dotpoint === 'string' && p.dotpoint ? [p.dotpoint] : [];
  return { ...p, dotpoints, createdAt: Number(row.occurred_at) || Number(p.createdAt) || 0 };
}

async function attemptsOf(db, studentId) {
  const rows = await db.all("SELECT occurred_at,payload_json FROM learning_events WHERE account_id=? AND device_id='server-grader' AND kind='graded-attempt' ORDER BY server_cursor DESC LIMIT ?",
    [studentId, SCAN]);
  return rows.map(attemptRow).filter(Boolean);
}

/**
 * Count per outcome and state over per-student boards. Pure.
 * `boards`: [{ student: { id, name }, board, attempts }]. Returns the groups
 * with per-node `counts`, the students behind each state (by id), and the
 * re-teach suggestions.
 */
export function aggregateBoards(groups, boards, { now = Date.now(), located = NSW_DOTPOINT_OUTCOMES } = {}) {
  const empty = () => Object.fromEntries(NODE_STATES.map(s => [s, 0]));
  const byNode = new Map();
  for (const g of groups) for (const n of g.nodes) byNode.set(n.id, { counts: empty(), students: Object.fromEntries(NODE_STATES.map(s => [s, []])) });
  for (const { student, board } of boards) {
    for (const g of board.groups) for (const n of g.nodes) {
      const slot = byNode.get(n.id);
      if (!slot) continue;
      slot.counts[n.state]++;
      slot.students[n.state].push(student.id);
    }
  }
  // Re-teach: distinct students per (outcome, misconception) in the window.
  const since = now - RETEACH_WINDOW_DAYS * DAY_MS;
  const shared = new Map();
  for (const { student, attempts } of boards) {
    for (const a of attempts) {
      if (a.correct === true || a.revealed === true || a.repeat === true || !(a.createdAt >= since)) continue;
      const id = resolveMisconceptionId(a.misconception);
      if (!id) continue;
      for (const dp of a.dotpoints) for (const code of (Object.hasOwn(located, dp) ? located[dp] : [])) {
        if (!byNode.has(code)) continue;
        const key = `${code}|${id}`;
        (shared.get(key) || shared.set(key, new Set()).get(key)).add(student.id);
      }
    }
  }
  const visible = boards.length;
  const floor = Math.max(RETEACH_MIN_STUDENTS, Math.ceil(RETEACH_MIN_SHARE * visible));
  const reteach = [...shared.entries()].map(([key, set]) => {
    const [node, misconception] = key.split('|');
    return { node, misconception, students: set.size, of: visible };
  }).filter(r => r.students >= floor).sort((a, b) => b.students - a.students || a.node.localeCompare(b.node) || a.misconception.localeCompare(b.misconception));
  return {
    groups: groups.map(g => ({ id: g.id, name: g.name, nodes: g.nodes.map(n => ({ id: n.id, code: n.code, counts: byNode.get(n.id).counts })) })),
    studentsByNode: byNode,
    reteach, reteachFloor: floor
  };
}

/**
 * The class board for one course, or { status, code, message } when it cannot
 * be drawn here. `node` (an outcome code) adds the named students behind each
 * state of that outcome.
 */
export async function classBoard(db, { classId, course, node = null, now = Date.now(), policy = bankPolicy() }) {
  db = asStore(db);
  if (policy.curriculum !== 'nsw') {
    return { status: 409, code: 'CLASS_BOARD_NOT_YET', message: 'The class board needs each answer\'s syllabus dot point on the server. Priyabhata answers do not carry it yet, so the board would show every outcome as not started.' };
  }
  const c = typeof course === 'string' && Object.hasOwn(NSW_BOARD_COURSES, course) ? NSW_BOARD_COURSES[course] : null;
  if (!c) return { status: 400, code: 'CLASS_BOARD_COURSE', message: 'Choose a course for the board.' };
  const groups = nswBoardGroups(c);
  const { students, withheld } = await visibleStudents(db, classId);
  const boards = [];
  for (const s of students) {
    const attempts = await attemptsOf(db, s.id);
    boards.push({ student: s, attempts, board: syllabusBoard(groups, attempts, { located: NSW_DOTPOINT_OUTCOMES, now }) });
  }
  const agg = aggregateBoards(groups, boards, { now });
  const out = {
    course: { id: c.key, name: c.name, syllabus: c.syllabus, version: c.version },
    states: NODE_STATES, students: students.length, withheld,
    groups: agg.groups, reteach: agg.reteach,
    reteachRule: { minStudents: RETEACH_MIN_STUDENTS, minShare: RETEACH_MIN_SHARE, windowDays: RETEACH_WINDOW_DAYS, floor: agg.reteachFloor }
  };
  if (node !== null && node !== undefined) {
    const slot = agg.studentsByNode.get(String(node));
    if (!slot) return { status: 404, code: 'CLASS_BOARD_NODE', message: 'That outcome is not on this course.' };
    const names = new Map(students.map(s => [s.id, s.name]));
    out.drill = { node: String(node), states: Object.fromEntries(NODE_STATES.map(st => [st, slot.students[st].map(id => ({ id, name: names.get(id) }))])) };
  }
  return out;
}
