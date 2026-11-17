// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the teacher workspace: hand-in, review queue, teacher marks
//
//   /v1/classroom/visibility                          any session: what a teacher can and cannot see
//   /v1/classroom/mine                                student: my classes, what each teacher sees, my teacher marks
//   POST /v1/classroom/classes/:c/assignments/:a/hand-in   student hands in a finished paper
//   GET  /v1/classroom/classes/:c/assignments/:a/results   teacher: per student, per question, common first breaks
//   GET  /v1/classroom/classes/:c/assignments/:a/results.csv
//   GET  /v1/classroom/classes/:c/review              teacher: the human-judgement queue
//   POST /v1/classroom/classes/:c/review/:itemId      teacher awards or declines one criterion
//
// THE THREE RULES (R4)
//
// 1. A teacher sees only students who are ACTIVE members of a class the teacher
//    owns (joined by its code, not removed, account not deleted) and whose
//    account may use the cloud now (guardian consent where the edition's age
//    rule needs it, consentState). A student who leaves, is removed, or whose
//    guardian withdraws disappears from every read here at once: nothing is
//    cached. Every route checks this on the server, and the tables carry
//    RESTRICTIVE account-scope RLS as defence in depth (schema 18).
//
// 2. What a teacher sees is the list in TEACHER_VISIBILITY, served to students
//    as-is (GET /v1/classroom/visibility and /mine), so a student is shown
//    exactly what their teacher can see. Work reaches a teacher only when the
//    student HANDS IN a finished paper for that teacher's assignment. Private
//    notes, tutor and AI conversations, practice working, photos and pictures
//    of handwriting never do: no code here reads sync_entities, the tutor's
//    tables or a recognition receipt.
//
// 3. A TEACHER MARK is a human decision, kept apart from the engine's mark.
//    The engine decides the paper's score exactly as before; the stored exam
//    result and its graded-attempt events are never written here. Where D12
//    leaves marks the engine cannot award (method and follow-through, while
//    examiner sign-off #499 is pending), the student's own teacher may award
//    or decline them per criterion. Each decision is an append-only row in
//    teacher_marks (who, when, which criterion, how many, the engine's mark
//    at the time, the row it supersedes). AI never suggests a teacher mark;
//    nothing here calls a model.
// ─────────────────────────────────────────────────────────────────────────────
import { asyncRouter } from './asyncRouter.js';
import { asStore } from './store.js';
import { id, rateLimit, requireRole, requireSession, requireVerifiedEmail } from './security.js';
import { consentBlockerCode, consentState } from './guardianConsent.js';
import { markerPool } from './markerPool.js';
import { resultMatchesTemplate } from './paperAssignments.js';
import { boardCourses, classBoard } from './classBoard.js';
import { writeStudentSubmission } from './classes.js';
import { pageView } from './exams.js';
import { clipText } from './text.js';
import { resolveMisconceptionId } from '../../client/src/engine/misconceptions.js';

// ── What a teacher can see (served verbatim to students) ────────────────────
export const TEACHER_VISIBILITY = Object.freeze({
  version: 1,
  sees: Object.freeze([
    'name',              // the name on the account (never the email address)
    'membership',        // that the student is in the class, and since when
    'evidence-states',   // per syllabus outcome: the evidence state from server-marked work
    'common-mistakes',   // class counts of the same verified first break (no names attached)
    'handed-in-papers',  // papers the student hands in: score, each question's marks, the working as read, line checks, first break
    'teacher-marks'      // the teacher's own marks and comments
  ]),
  never: Object.freeze([
    // 'photos-and-handwriting-images' is true while no teacher route serves a
    // stored original. When the original-work route (#1018) shows a handed-in
    // answer's ink to its teacher, this entry moves to `sees` as
    // 'handed-in-handwriting' IN THE SAME RELEASE: students are shown this list.
    'email', 'guardian', 'plan', 'notes', 'tutor-and-ai-chats', 'practice-working',
    'photos-and-handwriting-images', 'papers-not-handed-in', 'other-classes'
  ])
});

export const TEACHER_MARK_LABEL = 'teacher';
export const CRITERIA = Object.freeze(['method', 'follow-through']);
const MAX_COMMENT = 1000;
const MAX_REVIEW_LINES = 40;
const plain = v => !!v && typeof v === 'object' && !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const notFound = (res, code = 'CLASS_NOT_FOUND', message = 'Class not found.') => res.status(404).json({ error: { code, message } });
// One bound `?` per id of a list; the ids themselves are always bound.
const IN = list => list.map(() => '?').join(',');
const parse = (raw, fallback) => { try { return JSON.parse(raw); } catch { return fallback; } };

async function audit(db, actor, action, targetKind, targetId, metadata, now) {
  await db.run('INSERT INTO audit_log(actor_account_id,action,target_kind,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?)',
    [actor, action, targetKind, targetId, JSON.stringify(metadata || {}), now]);
}

// ── Who is visible ───────────────────────────────────────────────────────────

/** The class, when this teacher owns it and it is not archived; else null. */
export async function ownedClass(db, teacherId, classId) {
  db = asStore(db);
  return await db.get('SELECT id,name,teacher_account_id,created_at FROM classes WHERE id=? AND teacher_account_id=? AND archived_at IS NULL', [classId, teacherId]) || null;
}

/** May this account's data reach a teacher now? (guardian consent where required) */
export async function cloudAllowed(db, accountId) {
  return consentBlockerCode(await consentState(db, accountId)) === null;
}

/**
 * The students a teacher may see in a class: active members of an active
 * account whose consent state allows the cloud. `withheld` counts the members
 * hidden because consent is not in place (no names: a teacher learns only
 * that some members are waiting on a guardian).
 */
export async function visibleStudents(db, classId) {
  db = asStore(db);
  const rows = await db.all(`SELECT a.id,a.name,cm.joined_at FROM class_members cm JOIN accounts a ON a.id=cm.student_account_id
    WHERE cm.class_id=? AND cm.removed_at IS NULL AND a.deleted_at IS NULL AND a.role='student'
    ORDER BY ${db.nocaseOrder('a.name')},${db.binaryText('a.id')}`, [classId]);
  const students = [];
  let withheld = 0;
  for (const row of rows) {
    if (await cloudAllowed(db, row.id)) students.push({ id: row.id, name: row.name, joinedAt: row.joined_at });
    else withheld++;
  }
  return { students, withheld };
}

/** One student, when visible to the owner of this class; else null. */
export async function visibleStudent(db, classId, studentId) {
  db = asStore(db);
  const row = await db.get(`SELECT a.id,a.name FROM class_members cm JOIN accounts a ON a.id=cm.student_account_id
    WHERE cm.class_id=? AND cm.student_account_id=? AND cm.removed_at IS NULL AND a.deleted_at IS NULL AND a.role='student'`, [classId, studentId]);
  if (!row || !(await cloudAllowed(db, row.id))) return null;
  return row;
}

// ── Hand-in ──────────────────────────────────────────────────────────────────

const RECORD = "SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope=? AND key=? AND expires_at>?";
async function record(db, accountId, scope, key, now) {
  const row = await db.get(RECORD, [accountId, scope, key, now]);
  return row ? parse(row.response_json, null) : null;
}

const linesOf = (working, given) => {
  const lines = String(working || '').split('\n').map(s => s.trim()).filter(Boolean);
  const final = String(given || '').trim();
  if (final && lines[lines.length - 1] !== final) lines.push(final);
  return lines.slice(0, MAX_REVIEW_LINES);
};

/**
 * The marked units of a result: each single question, and each part of a
 * structured one, with the sealed question it was marked against.
 */
export function unitsOf(result, paper) {
  const sealed = new Map((paper?.questions || []).map(sq => [sq.id, sq]));
  const units = [];
  for (const d of Array.isArray(result?.detail) ? result.detail : []) {
    const sq = sealed.get(d.id);
    const q = sq?.payload || null;
    const base = { questionId: d.id, order: d.order, outcomeCode: typeof d.syllabusOutcome === 'string' ? d.syllabusOutcome : null, subtopic: d.subtopic || null };
    if (Array.isArray(d.parts)) {
      for (const part of d.parts) {
        const authored = (q?.parts || []).find(p => String(p.key) === String(part.key)) || null;
        const chosen = authored ? (part.choiceTaken === 'or' && authored.alt ? authored.alt : authored) : null;
        units.push({ ...base, key: `${d.id}::${part.key}`, part: String(part.key), line: part,
          q: chosen ? { ...chosen, subtopic: chosen.subtopic || q?.subtopic, difficulty: chosen.difficulty || q?.difficulty || 2 } : null });
      }
    } else {
      const chosen = q ? (d.choiceTaken === 'or' && q.alt ? { ...q.alt, subtopic: q.alt.subtopic || q.subtopic, difficulty: q.alt.difficulty || q.difficulty || 2 } : q) : null;
      units.push({ ...base, key: d.id, part: null, line: d, q: chosen });
    }
  }
  return units;
}

/**
 * Is this unit one the engine could not finish marking, so a teacher may
 * judge it? Wrong, answered, not pending, marked on the final answer only,
 * worth two or more marks, with working, and with at least one mark the final
 * answer rule leaves on the table (a wrong final answer never reaches full
 * marks: the cap is marks − 1 − what the engine already gave).
 */
export function reviewCap(line) {
  if (!line || line.correct === true || line.unanswered === true || line.pending === true || line.unreadable === true) return 0;
  if (line.markingScheme !== 'final-answer') return 0;
  const marks = Number(line.marks), awarded = Number(line.awarded);
  if (!Number.isInteger(marks) || marks < 2 || !Number.isInteger(awarded) || awarded < 0) return 0;
  if (!String(line.working || '').trim()) return 0;
  return Math.max(0, marks - 1 - awarded);
}

/** The criteria a teacher may judge on one unit, from the engine's line verdicts. */
export function criteriaFor(evidence) {
  const out = [];
  if (!evidence) return out;
  const { lines = [], firstBreak = -1 } = evidence;
  const before = firstBreak >= 0 ? lines.slice(0, firstBreak) : lines;
  if (before.some(s => s === 'ok')) out.push('method');
  if (firstBreak >= 0 && firstBreak < lines.length - 1) out.push('follow-through');
  return out;
}

async function lineEvidence(q, lines, key) {
  if (!q || !lines.length) return null;
  try {
    const outcome = await markerPool().run('review', { q, lines }, { key });
    // A check that did not run (busy, too complex) is no evidence: the answer
    // simply gets no review item, and its engine mark stands.
    return outcome?.ok ? outcome.value?.evidence || null : null;
  } catch { return null; }
}

/**
 * Hand in a finished paper for an assignment. Returns { status, code?, message? }
 * or { handin }. Runs the deterministic line check (feedback only) BEFORE the
 * transaction, then writes the hand-in, its review items and the submission
 * state in one transaction. The exam result is read, never written.
 */
export async function handIn(db, { classId, assignmentId, studentId, examId, now = Date.now() }) {
  db = asStore(db);
  // The class OWNER is the teacher of a hand-in, whoever created the
  // assignment (an admin may create one in any class; only the owner reviews).
  const assignment = await db.get(`SELECT a.id,a.class_id,c.teacher_account_id,a.specification_json,a.created_at FROM assignments a
    JOIN classes c ON c.id=a.class_id JOIN class_members cm ON cm.class_id=c.id AND cm.student_account_id=? AND cm.removed_at IS NULL
    WHERE a.id=? AND a.class_id=? AND a.archived_at IS NULL AND c.archived_at IS NULL`, [studentId, assignmentId, classId]);
  if (!assignment) return { status: 404, code: 'ASSIGNMENT_NOT_FOUND', message: 'Assignment not found.' };
  const spec = parse(assignment.specification_json, {});
  if (spec.kind !== 'paper' || !plain(spec.paper)) return { status: 409, code: 'ASSIGNMENT_NOT_A_PAPER', message: 'This assignment is not a paper.' };
  if (typeof examId !== 'string' || !/^[0-9a-f-]{36}$/i.test(examId)) return { status: 400, code: 'HANDIN_INVALID', message: 'Name the paper you sat.' };
  const result = await record(db, studentId, 'exam-result', examId, now);
  const paper = await record(db, studentId, 'exam-paper', examId, now);
  if (!result || !paper) return { status: 404, code: 'EXAM_NOT_FOUND', message: 'That paper is not finished yet, or is not yours.' };
  if (await db.get('SELECT 1 FROM assignment_handins WHERE student_account_id=? AND exam_id=?', [studentId, examId])) {
    return { status: 409, code: 'HANDIN_EXAM_USED', message: 'That paper has been handed in for another assignment. Sit the paper again for this one.' };
  }
  if (!resultMatchesTemplate(result, spec.paper)) return { status: 409, code: 'HANDIN_WRONG_PAPER', message: 'That is not the paper your teacher set.' };
  if (!(Number(paper.startedAt) >= Number(assignment.created_at))) return { status: 409, code: 'HANDIN_WRONG_PAPER', message: 'That paper was started before this assignment was set.' };
  // Handwriting as it stands NOW (exams.js pageView): a page that can still be
  // read would change the engine's score after hand-in, so it is refused until
  // read; a page past its window or out of tries is final and may be handed in.
  const pages = Object.values(result.handwriting?.pages || {}).map(p => pageView(p, result.handwriting, now));
  if (pages.some(p => p.state !== 'resolved' && p.triesLeft > 0)) {
    return { status: 409, code: 'HANDIN_HANDWRITING_PENDING', message: 'Some of your handwriting has not been read yet. Have it read, then hand the paper in.' };
  }
  if (await db.get('SELECT 1 FROM assignment_handins WHERE assignment_id=? AND student_account_id=?', [assignmentId, studentId])) {
    return { status: 409, code: 'HANDIN_ALREADY', message: 'You have handed this paper in already.' };
  }

  // How each answer was written, and — for handwriting — WHICH ink: the
  // SHA-256 of the page the server froze with the paper (exams.js). A teacher
  // judges the student's own written work; the receipt of what they judged is
  // that digest, recorded on the review item and on every teacher mark.
  // Both come from what the SERVER finally marked, never from an autosave
  // (a finish replaces the snapshot's modes and ink, exams.js): the input mode
  // from the graded-attempt event of that answer, the digest only from a page
  // the server froze with the result. Neither known → null, never a guess.
  const inkOf = key => {
    const digest = result.handwriting?.pages?.[key]?.digest;
    return typeof digest === 'string' && /^[0-9a-f]{64}$/i.test(digest) ? digest.toLowerCase() : null;
  };
  // Line verdicts for every wrong written answer (feedback only), outside any transaction.
  const units = unitsOf(result, paper);
  const attemptIds = units.map(u => u.line?.attemptId).filter(x => typeof x === 'string' && x);
  const modeByAttempt = new Map();
  // The stored original (original-ink lane, #1018): the id the teacher's
  // original-work route serves, and its SHA-256. Copied only when well formed.
  const originalByAttempt = new Map();
  if (attemptIds.length) {
    for (const row of await db.all(`SELECT id,payload_json FROM learning_events WHERE account_id=? AND device_id='server-grader' AND kind='graded-attempt' AND id IN (${IN(attemptIds)})`, [studentId, ...attemptIds])) {
      const payload = parse(row.payload_json, {});
      const mode = payload?.inputMode;
      if (mode === 'ink' || mode === 'typed') modeByAttempt.set(row.id, mode);
      const o = payload?.original;
      if (plain(o) && typeof o.id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(o.id) && typeof o.sha256 === 'string' && /^[0-9a-f]{64}$/i.test(o.sha256)) {
        // #1018's contract: kind 'strokes' | 'image', origin 'ink' | 'photo' | 'pdf-page';
        // sha256 over the canonical bytes. Anything else is not a reference.
        if (['strokes', 'image'].includes(o.kind) && (o.origin === undefined || ['ink', 'photo', 'pdf-page'].includes(o.origin))) {
          originalByAttempt.set(row.id, { id: o.id, sha256: o.sha256.toLowerCase(), kind: o.kind, origin: o.origin ?? null });
        }
      }
    }
  }
  const modeOf = u => (inkOf(u.key) ? 'ink' : modeByAttempt.get(u.line?.attemptId) || null);
  const questions = [];
  const items = [];
  for (const u of units) {
    const line = u.line;
    const wrongWithWorking = line && line.correct !== true && line.unanswered !== true && !line.pending && String(line.working || '').trim();
    const lines = wrongWithWorking ? linesOf(line.working, line.given) : [];
    const evidence = wrongWithWorking ? await lineEvidence(u.q, lines, studentId) : null;
    const misconception = evidence?.diagnosis ? resolveMisconceptionId(evidence.diagnosis) : null;
    questions.push({
      key: u.key, order: u.order, part: u.part, outcomeCode: u.outcomeCode, subtopic: u.subtopic,
      marks: Number(line.marks) || 0, awarded: Number(line.awarded) || 0,
      correct: line.correct === true, unanswered: line.unanswered === true,
      firstBreakLine: evidence && evidence.firstBreak >= 0 ? evidence.firstBreak + 1 : null,
      misconception
    });
    const cap = reviewCap(line);
    if (!cap || !evidence) continue;
    for (const criterion of criteriaFor(evidence)) {
      items.push({
        id: id('rvw'), questionKey: u.key, order: u.order, part: u.part, outcomeCode: u.outcomeCode, subtopic: u.subtopic,
        marksPossible: Number(line.marks), engineAwarded: Number(line.awarded), criterion, available: cap,
        evidence: {
          prompt: clipText(String(line.prompt || u.q?.prompt || ''), 2000),
          // The typeset reading is secondary: "what Pri read". For handwriting,
          // the original page (ink.digest) is the work being judged.
          reading: lines.map(text => clipText(text, 400)),
          inputMode: modeOf(u),
          ink: inkOf(u.key) ? { digest: inkOf(u.key) } : null,
          original: originalByAttempt.get(u.line?.attemptId) || null,
          lineStatuses: evidence.lines,
          firstBreak: evidence.firstBreak >= 0 ? evidence.firstBreak + 1 : null,
          misconception
        }
      });
    }
  }

  const summary = {
    questionsAnswered: Math.min(50, questions.filter(q => !q.unanswered).length),
    correct: Math.min(50, questions.filter(q => q.correct).length), xp: 0
  };
  try {
    await db.transaction(async () => {
      if (await db.get('SELECT 1 FROM assignment_handins WHERE assignment_id=? AND student_account_id=?', [assignmentId, studentId])) {
        throw Object.assign(new Error('You have handed this paper in already.'), { status: 409, code: 'HANDIN_ALREADY' });
      }
      if (await db.get('SELECT 1 FROM assignment_handins WHERE student_account_id=? AND exam_id=?', [studentId, examId])) {
        throw Object.assign(new Error('That paper has been handed in for another assignment. Sit the paper again for this one.'), { status: 409, code: 'HANDIN_EXAM_USED' });
      }
      await db.run(`INSERT INTO assignment_handins(assignment_id,student_account_id,class_id,teacher_account_id,exam_id,paper_kind,score,total,questions_json,handed_in_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)`, [assignmentId, studentId, classId, assignment.teacher_account_id, examId, String(result.kind),
        Math.round(Number(result.score) || 0), Math.round(Number(result.total) || 0), JSON.stringify(questions), now]);
      for (const it of items) {
        await db.run(`INSERT INTO teacher_review_items(id,assignment_id,class_id,student_account_id,teacher_account_id,exam_id,question_key,question_order,outcome_code,subtopic,marks_possible,engine_awarded,criterion,available,evidence_json,created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [it.id, assignmentId, classId, studentId, assignment.teacher_account_id, examId, it.questionKey,
          Number(it.order) || 0, it.outcomeCode, it.subtopic, it.marksPossible, it.engineAwarded, it.criterion, it.available, JSON.stringify(it.evidence), now]);
      }
      await writeStudentSubmission(db, { assignmentId, studentId, state: 'submitted', summary, now });
      await audit(db, studentId, 'assignment.hand-in', 'assignment', assignmentId, { classId, examId, reviewItems: items.length }, now);
    });
  } catch (error) {
    if (error?.status) return { status: error.status, code: error.code, message: error.message };
    throw error;
  }
  return { handin: { assignmentId, examId, handedInAt: now, score: Math.round(Number(result.score) || 0), total: Math.round(Number(result.total) || 0), reviewItems: items.length } };
}

// ── Teacher marks ────────────────────────────────────────────────────────────

/** The current (latest, unsuperseded) teacher mark of each review item, keyed by item id. */
export async function effectiveMarks(db, itemIds) {
  db = asStore(db);
  const out = new Map();
  if (!itemIds.length) return out;
  const rows = await db.all(`SELECT id,review_item_id,teacher_account_id,criterion,decision,marks,comment,engine_awarded,ink_digest,supersedes,created_at
    FROM teacher_marks WHERE review_item_id IN (${IN(itemIds)}) ORDER BY created_at,id`, itemIds);
  const superseded = new Set(rows.map(r => r.supersedes).filter(Boolean));
  for (const r of rows) if (!superseded.has(r.id)) out.set(r.review_item_id, r);
  return out;
}

const publicMark = (r, { withTeacher = true } = {}) => r ? ({
  id: r.id, label: TEACHER_MARK_LABEL, criterion: r.criterion, decision: r.decision, marks: Number(r.marks),
  comment: r.comment || null, decidedAt: Number(r.created_at), engineAwardedAtDecision: Number(r.engine_awarded), inkDigest: r.ink_digest || null,
  ...(withTeacher ? { teacherId: r.teacher_account_id } : {})
}) : null;

export function validateDecision(body) {
  if (!plain(body)) return { ok: false, message: 'Send a decision.' };
  for (const k of Object.keys(body)) if (!['decision', 'marks', 'comment'].includes(k)) return { ok: false, message: `"${clipText(k, 40)}" is not part of a teacher mark.` };
  if (!['award', 'decline'].includes(body.decision)) return { ok: false, message: 'Award or decline.' };
  let marks = 0;
  if (body.decision === 'award') {
    if (!Number.isInteger(body.marks) || body.marks < 1) return { ok: false, message: 'Award a whole number of marks, at least 1.' };
    marks = body.marks;
  } else if (body.marks !== undefined && body.marks !== 0) return { ok: false, message: 'A declined criterion carries no marks.' };
  let comment = null;
  if (body.comment !== undefined && body.comment !== null) {
    if (typeof body.comment !== 'string') return { ok: false, message: 'A comment is text.' };
    const text = body.comment.trim();
    if (text.length > MAX_COMMENT) return { ok: false, message: `A comment is at most ${MAX_COMMENT} characters.` };
    comment = text || null;
  }
  return { ok: true, decision: body.decision, marks, comment };
}

/**
 * Record one teacher decision on one review item. The item must belong to a
 * class this teacher owns and a student still visible in it. The marks
 * awarded across the question's criteria never exceed its cap. Append-only:
 * a change of mind is a new row that supersedes the last.
 */
export async function decide(db, { teacherId, classId, itemId, body, now = Date.now() }) {
  db = asStore(db);
  const checked = validateDecision(body);
  if (!checked.ok) return { status: 400, code: 'TEACHER_MARK_INVALID', message: checked.message };
  if (!(await ownedClass(db, teacherId, classId))) return { status: 404, code: 'CLASS_NOT_FOUND', message: 'Class not found.' };
  const item = await db.get(`SELECT i.* FROM teacher_review_items i JOIN assignments a ON a.id=i.assignment_id
    WHERE i.id=? AND i.class_id=? AND i.teacher_account_id=? AND a.archived_at IS NULL`, [itemId, classId, teacherId]);
  if (!item || !(await visibleStudent(db, classId, item.student_account_id))) return { status: 404, code: 'REVIEW_ITEM_NOT_FOUND', message: 'This item is not in your review queue.' };
  if (checked.marks > Number(item.available)) return { status: 400, code: 'TEACHER_MARK_OVER_CAP', message: `At most ${item.available} mark(s) can be awarded here.` };
  return db.transaction(async () => {
    const siblings = await db.all('SELECT id FROM teacher_review_items WHERE assignment_id=? AND student_account_id=? AND question_key=?',
      [item.assignment_id, item.student_account_id, item.question_key]);
    const current = await effectiveMarks(db, siblings.map(s => s.id));
    const mine = current.get(item.id) || null;
    const others = siblings.filter(s => s.id !== item.id).reduce((n, s) => n + (current.get(s.id)?.decision === 'award' ? Number(current.get(s.id).marks) : 0), 0);
    if (others + checked.marks > Number(item.available)) {
      return { status: 409, code: 'TEACHER_MARK_OVER_CAP', message: `This question can carry at most ${item.available} teacher mark(s) in all; ${others} already awarded on another criterion.` };
    }
    if (mine && mine.decision === checked.decision && Number(mine.marks) === checked.marks && (mine.comment || null) === checked.comment) {
      return { mark: publicMark(mine), unchanged: true };
    }
    const markId = id('tmk');
    // The ink version the teacher was shown (null for typed work).
    const inkDigest = parse(item.evidence_json, {})?.ink?.digest || null;
    await db.run(`INSERT INTO teacher_marks(id,review_item_id,class_id,assignment_id,student_account_id,teacher_account_id,criterion,decision,marks,comment,engine_awarded,ink_digest,supersedes,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [markId, item.id, classId, item.assignment_id, item.student_account_id, teacherId, item.criterion,
      checked.decision, checked.marks, checked.comment, Number(item.engine_awarded), inkDigest, mine?.id || null, now]);
    await audit(db, teacherId, `teacher-mark.${checked.decision}`, 'review-item', item.id,
      { classId, assignmentId: item.assignment_id, studentId: item.student_account_id, criterion: item.criterion, marks: checked.marks, inkDigest, supersedes: mine?.id || null }, now);
    return { mark: publicMark({ id: markId, teacher_account_id: teacherId, criterion: item.criterion, decision: checked.decision, marks: checked.marks, comment: checked.comment, engine_awarded: item.engine_awarded, ink_digest: inkDigest, created_at: now }) };
  });
}

/** The review queue of one class: items of visible students, newest hand-ins first. */
export async function reviewQueue(db, { teacherId, classId, state = 'open' }) {
  db = asStore(db);
  const { students } = await visibleStudents(db, classId);
  const names = new Map(students.map(s => [s.id, s.name]));
  if (!names.size) return { items: [], counts: { open: 0, decided: 0 } };
  const ids = [...names.keys()];
  const rows = await db.all(`SELECT i.*,a.title AS assignment_title FROM teacher_review_items i JOIN assignments a ON a.id=i.assignment_id
    WHERE i.class_id=? AND i.teacher_account_id=? AND a.archived_at IS NULL AND i.student_account_id IN (${IN(ids)})
    ORDER BY i.created_at DESC,i.question_order,i.id`, [classId, teacherId, ...ids]);
  const marks = await effectiveMarks(db, rows.map(r => r.id));
  const all = rows.map(r => ({
    id: r.id, assignmentId: r.assignment_id, assignmentTitle: r.assignment_title, examId: r.exam_id,
    student: { id: r.student_account_id, name: names.get(r.student_account_id) },
    question: { key: r.question_key, order: Number(r.question_order), outcomeCode: r.outcome_code, subtopic: r.subtopic },
    marksPossible: Number(r.marks_possible), engineAwarded: Number(r.engine_awarded),
    criterion: r.criterion, available: Number(r.available), evidence: parse(r.evidence_json, {}),
    handedInAt: Number(r.created_at), teacherMark: publicMark(marks.get(r.id))
  }));
  const counts = { open: all.filter(i => !i.teacherMark).length, decided: all.filter(i => i.teacherMark).length };
  return { items: state === 'all' ? all : all.filter(i => (state === 'decided' ? !!i.teacherMark : !i.teacherMark)), counts };
}

/** The decision history of one item (the audit trail), oldest first. */
export async function markHistory(db, itemId) {
  db = asStore(db);
  const rows = await db.all(`SELECT id,review_item_id,teacher_account_id,criterion,decision,marks,comment,engine_awarded,ink_digest,supersedes,created_at
    FROM teacher_marks WHERE review_item_id=? ORDER BY created_at,id`, [itemId]);
  return rows.map(r => ({ ...publicMark(r), supersedes: r.supersedes || null }));
}

// ── Results ──────────────────────────────────────────────────────────────────

/**
 * Per student and per question for one paper assignment, with the engine's
 * marks and the teacher's marks in separate fields, and the most common
 * verified first breaks on each question. A total "with teacher marks" is the
 * engine's score plus the teacher's awards, and is always labelled so.
 */
export async function assignmentResults(db, { teacherId, classId, assignmentId }) {
  db = asStore(db);
  if (!(await ownedClass(db, teacherId, classId))) return null;
  const assignment = await db.get('SELECT id,title,specification_json,due_at,created_at FROM assignments WHERE id=? AND class_id=? AND archived_at IS NULL',
    [assignmentId, classId]);
  if (!assignment) return null;
  const { students, withheld } = await visibleStudents(db, classId);
  const handins = new Map((await db.all('SELECT * FROM assignment_handins WHERE assignment_id=?', [assignmentId])).map(h => [h.student_account_id, h]));
  const items = await db.all('SELECT id,student_account_id,question_key FROM teacher_review_items WHERE assignment_id=?', [assignmentId]);
  const marks = await effectiveMarks(db, items.map(i => i.id));
  const teacherByStudentKey = new Map();
  for (const i of items) {
    const m = marks.get(i.id);
    if (m?.decision !== 'award') continue;
    const k = `${i.student_account_id}|${i.question_key}`;
    teacherByStudentKey.set(k, (teacherByStudentKey.get(k) || 0) + Number(m.marks));
  }
  const perQuestion = new Map();
  const rows = students.map(s => {
    const h = handins.get(s.id);
    if (!h) return { student: s, handedIn: false };
    const questions = parse(h.questions_json, []).map(q => {
      const teacher = teacherByStudentKey.get(`${s.id}|${q.key}`) || 0;
      const agg = perQuestion.get(q.key.split('::').length > 1 ? `${q.order}::${q.part}` : String(q.order)) || { order: q.order, part: q.part, outcomes: new Set(), marks: 0, answered: 0, correct: 0, engineAwarded: 0, teacherAwarded: 0, sat: 0, breaks: new Map() };
      agg.sat++; agg.marks += q.marks; agg.engineAwarded += q.awarded; agg.teacherAwarded += teacher;
      if (!q.unanswered) agg.answered++;
      if (q.correct) agg.correct++;
      if (q.outcomeCode || q.subtopic) agg.outcomes.add(q.outcomeCode || q.subtopic);
      if (q.misconception) agg.breaks.set(q.misconception, (agg.breaks.get(q.misconception) || 0) + 1);
      perQuestion.set(q.key.split('::').length > 1 ? `${q.order}::${q.part}` : String(q.order), agg);
      return { ...q, engine: { awarded: q.awarded, marks: q.marks }, teacher: { awarded: teacher, label: TEACHER_MARK_LABEL } };
    });
    const teacherTotal = questions.reduce((n, q) => n + q.teacher.awarded, 0);
    return {
      student: s, handedIn: true, examId: h.exam_id, handedInAt: Number(h.handed_in_at),
      engine: { score: Number(h.score), total: Number(h.total) },
      teacher: { awarded: teacherTotal, label: TEACHER_MARK_LABEL },
      withTeacherMarks: { score: Number(h.score) + teacherTotal, total: Number(h.total), label: 'engine-plus-teacher' },
      questions
    };
  });
  const questions = [...perQuestion.values()].sort((a, b) => a.order - b.order || String(a.part).localeCompare(String(b.part))).map(q => ({
    order: q.order, part: q.part, outcomes: [...q.outcomes].sort(), sat: q.sat, answered: q.answered, correct: q.correct,
    marks: q.marks, engineAwarded: q.engineAwarded, teacherAwarded: q.teacherAwarded,
    commonFirstBreaks: [...q.breaks.entries()].map(([misconception, students]) => ({ misconception, students }))
      .sort((a, b) => b.students - a.students || a.misconception.localeCompare(b.misconception)).slice(0, 3)
  }));
  return {
    assignment: { id: assignment.id, title: assignment.title, specification: parse(assignment.specification_json, {}), dueAt: assignment.due_at, createdAt: assignment.created_at },
    students: rows, questions, withheld
  };
}

// RFC 4180 quoting, and a cell that a spreadsheet would run as a formula is
// prefixed with an apostrophe (OWASP CSV injection).
export function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function resultsCsv(results) {
  const header = ['student', 'handed_in', 'question', 'outcome', 'marks', 'engine_marks', 'teacher_marks', 'first_break_line', 'first_break_misconception'];
  const lines = [header.join(',')];
  for (const r of results.students) {
    if (!r.handedIn) { lines.push([r.student.name, 'no', '', '', '', '', '', '', ''].map(csvCell).join(',')); continue; }
    for (const q of r.questions) {
      lines.push([r.student.name, 'yes', q.part ? `${q.order}(${q.part})` : q.order, q.outcomeCode || q.subtopic || '', q.marks,
        q.engine.awarded, q.teacher.awarded, q.firstBreakLine ?? '', q.misconception || ''].map(csvCell).join(','));
    }
    lines.push([r.student.name, 'yes', 'total', '', r.engine.total, r.engine.score, r.teacher.awarded, '', ''].map(csvCell).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

// ── The student's side ───────────────────────────────────────────────────────

export async function studentView(db, studentId) {
  db = asStore(db);
  const classes = await db.all(`SELECT c.id,c.name,cm.joined_at FROM class_members cm JOIN classes c ON c.id=cm.class_id
    WHERE cm.student_account_id=? AND cm.removed_at IS NULL AND c.archived_at IS NULL ORDER BY cm.joined_at DESC`, [studentId]);
  const handins = await db.all(`SELECT h.assignment_id,h.class_id,h.exam_id,h.score,h.total,h.handed_in_at,a.title FROM assignment_handins h
    JOIN assignments a ON a.id=h.assignment_id WHERE h.student_account_id=? ORDER BY h.handed_in_at DESC`, [studentId]);
  const items = await db.all('SELECT id,assignment_id,question_key,question_order,criterion,marks_possible,engine_awarded FROM teacher_review_items WHERE student_account_id=? ORDER BY question_order,id', [studentId]);
  const marks = await effectiveMarks(db, items.map(i => i.id));
  return {
    visibility: TEACHER_VISIBILITY,
    sharing: (await cloudAllowed(db, studentId)) ? 'on' : 'paused-guardian-consent',
    classes: classes.map(c => ({ id: c.id, name: c.name, joinedAt: c.joined_at })),
    handins: handins.map(h => ({
      assignmentId: h.assignment_id, classId: h.class_id, title: h.title, examId: h.exam_id, handedInAt: Number(h.handed_in_at),
      engine: { score: Number(h.score), total: Number(h.total) },
      teacherMarks: items.filter(i => i.assignment_id === h.assignment_id).map(i => ({
        questionKey: i.question_key, order: Number(i.question_order), criterion: i.criterion,
        marksPossible: Number(i.marks_possible), engineAwarded: Number(i.engine_awarded),
        teacherMark: publicMark(marks.get(i.id), { withTeacher: false }) || { label: TEACHER_MARK_LABEL, state: 'awaiting-teacher' }
      }))
    }))
  };
}

// ── Router ───────────────────────────────────────────────────────────────────

export function createClassroomRouter(db) {
  db = asStore(db);
  const router = asyncRouter();
  router.use(requireSession(db));

  router.get('/visibility', (req, res) => res.json({ visibility: TEACHER_VISIBILITY }));

  router.get('/mine', requireRole('student'), async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await studentView(db, req.platformSession.account_id));
  });

  router.post('/classes/:classId/assignments/:assignmentId/hand-in', requireVerifiedEmail, requireRole('student'),
    rateLimit(db, 'classroom-hand-in', { limit: 30, windowMs: 60 * 60 * 1000 }), async (req, res) => {
      const out = await handIn(db, {
        classId: String(req.params.classId || ''), assignmentId: String(req.params.assignmentId || ''),
        studentId: req.platformSession.account_id, examId: req.body?.examId
      });
      if (out.status) return res.status(out.status).json({ error: { code: out.code, message: out.message } });
      res.status(201).json(out);
    });

  router.get('/classes/:classId/assignments/:assignmentId/results', requireRole('teacher'), async (req, res) => {
    const classId = String(req.params.classId || '');
    if (!(await ownedClass(db, req.platformSession.account_id, classId))) return notFound(res);
    const results = await assignmentResults(db, { teacherId: req.platformSession.account_id, classId, assignmentId: String(req.params.assignmentId || '') });
    if (!results) return notFound(res, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
    res.set('Cache-Control', 'no-store');
    res.json(results);
  });

  router.get('/classes/:classId/assignments/:assignmentId/results.csv', requireRole('teacher'),
    rateLimit(db, 'classroom-export', { limit: 60, windowMs: 60 * 60 * 1000 }), async (req, res) => {
      const classId = String(req.params.classId || '');
      const teacherId = req.platformSession.account_id;
      if (!(await ownedClass(db, teacherId, classId))) return notFound(res);
      const assignmentId = String(req.params.assignmentId || '');
      const results = await assignmentResults(db, { teacherId, classId, assignmentId });
      if (!results) return notFound(res, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
      await audit(db, teacherId, 'assignment.results.export', 'assignment', assignmentId, { classId, students: results.students.length }, Date.now());
      res.set('Cache-Control', 'no-store');
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', 'attachment; filename="results.csv"');
      res.send(resultsCsv(results));
    });

  // The class board (classBoard.js): per outcome, students per evidence state.
  router.get('/board/courses', requireRole('teacher'), (req, res) => res.json({ courses: boardCourses() }));

  router.get('/classes/:classId/board', requireRole('teacher'), rateLimit(db, 'classroom-board', { limit: 300, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const classId = String(req.params.classId || '');
    if (!(await ownedClass(db, req.platformSession.account_id, classId))) return notFound(res);
    const out = await classBoard(db, { classId, course: req.query?.course, node: typeof req.query?.node === 'string' ? req.query.node : null });
    if (out.status) return res.status(out.status).json({ error: { code: out.code, message: out.message } });
    res.set('Cache-Control', 'no-store');
    res.json(out);
  });

  router.get('/classes/:classId/review', requireRole('teacher'), async (req, res) => {
    const classId = String(req.params.classId || '');
    const teacherId = req.platformSession.account_id;
    if (!(await ownedClass(db, teacherId, classId))) return notFound(res);
    const state = ['open', 'decided', 'all'].includes(req.query?.state) ? req.query.state : 'open';
    res.set('Cache-Control', 'no-store');
    res.json(await reviewQueue(db, { teacherId, classId, state }));
  });

  router.get('/classes/:classId/review/:itemId/history', requireRole('teacher'), async (req, res) => {
    const classId = String(req.params.classId || '');
    const teacherId = req.platformSession.account_id;
    if (!(await ownedClass(db, teacherId, classId))) return notFound(res);
    const item = await db.get(`SELECT i.id,i.student_account_id FROM teacher_review_items i JOIN assignments a ON a.id=i.assignment_id
      WHERE i.id=? AND i.class_id=? AND i.teacher_account_id=? AND a.archived_at IS NULL`, [String(req.params.itemId || ''), classId, teacherId]);
    if (!item || !(await visibleStudent(db, classId, item.student_account_id))) return notFound(res, 'REVIEW_ITEM_NOT_FOUND', 'This item is not in your review queue.');
    res.set('Cache-Control', 'no-store');
    res.json({ history: await markHistory(db, item.id) });
  });

  router.post('/classes/:classId/review/:itemId', requireVerifiedEmail, requireRole('teacher'),
    rateLimit(db, 'classroom-teacher-mark', { limit: 600, windowMs: 60 * 60 * 1000 }), async (req, res) => {
      const out = await decide(db, {
        teacherId: req.platformSession.account_id, classId: String(req.params.classId || ''),
        itemId: String(req.params.itemId || ''), body: req.body
      });
      if (out.status) return res.status(out.status).json({ error: { code: out.code, message: out.message } });
      res.status(out.unchanged ? 200 : 201).json(out);
    });

  return router;
}
