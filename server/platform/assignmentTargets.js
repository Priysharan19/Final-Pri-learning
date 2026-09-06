// Cloud assignments on the India syllabus.
//
// A teacher's assignment names what to practise — a track, chapters, at most
// one dot point, a difficulty and a question count — and the server is the
// authority on whether that target exists. The curriculum spine the client
// serves questions from is the same module the production image ships
// (Dockerfile copies client/src/engine beside the server), so an assignment
// can never point at a chapter, dot point or difficulty no student can reach.
//
// Class analytics are aggregated here from the aggregate-only submission
// summaries: per student, per assignment and per targeted chapter, with the
// intervention flags a teacher acts on and the plain-language reason for each.
// No answer, prompt, working or handwriting ever exists in this data.
import { IN_CHAPTER_BY_ID, IN_TRACKS } from '../../client/src/engine/curriculum-in.js';
import { sanitizeAssignmentSummary } from './assignmentProgress.js';

const ID = /^[A-Za-z0-9._-]{1,80}$/;
const MAX_TARGET_CHAPTERS = 20;
const MAX_INSTRUCTIONS = 4000;
const MAX_QUESTIONS = 50;
const DAY = 86_400_000;
export const INACTIVE_DAYS = 7;
export const DROP_WINDOW = 20;
export const DROP_POINTS = 15;

function plain(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function invalid(message) {
  return { ok: false, code: 'ASSIGNMENT_SPEC_INVALID', message };
}

function chapterGrade(chapter) {
  return Number.isFinite(chapter?.grade) ? chapter.grade : null;
}

function integer(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

/**
 * Validate and normalise an assignment specification. Unknown keys are dropped
 * — the specification is teacher-authored metadata, never a carrier for
 * student data — and every India target is checked against the curriculum.
 * Returns {ok:true, spec} or {ok:false, code, message}.
 */
export function validateAssignmentSpecification(input) {
  if (!plain(input)) return invalid('Assignment specification must be an object.');
  const spec = { kind: 'practice' };
  if (input.kind !== undefined && input.kind !== 'practice') return invalid('Only practice assignments are supported.');

  if (input.instructions !== undefined && input.instructions !== null) {
    if (typeof input.instructions !== 'string') return invalid('Instructions must be text.');
    const text = input.instructions.trim();
    if (text.length > MAX_INSTRUCTIONS) return invalid(`Instructions must be ${MAX_INSTRUCTIONS} characters or fewer.`);
    if (text) spec.instructions = text;
  }

  const count = input.questionCount === undefined || input.questionCount === null ? 10 : integer(input.questionCount);
  if (count === null || count < 1 || count > MAX_QUESTIONS) return invalid(`Question count must be a whole number from 1 to ${MAX_QUESTIONS}.`);
  spec.questionCount = count;

  let track = null;
  if (input.track !== undefined && input.track !== null && input.track !== '') {
    if (typeof input.track !== 'string' || !IN_TRACKS[input.track]) return invalid('Track must be one of cbse, jee-main, jee-advanced or olympiad.');
    track = input.track;
  }

  const rawIds = [];
  if (input.subtopics !== undefined && input.subtopics !== null) {
    if (!Array.isArray(input.subtopics) || input.subtopics.length > MAX_TARGET_CHAPTERS) return invalid(`Choose at most ${MAX_TARGET_CHAPTERS} chapters.`);
    rawIds.push(...input.subtopics);
  }
  if (input.subtopic !== undefined && input.subtopic !== null && input.subtopic !== '') rawIds.unshift(input.subtopic);
  const ids = [];
  for (const raw of rawIds) {
    if (typeof raw !== 'string' || !ID.test(raw)) return invalid('A chapter id is malformed.');
    if (!IN_CHAPTER_BY_ID[raw]) return invalid(`"${raw}" is not a chapter on the India syllabus.`);
    if (!ids.includes(raw)) ids.push(raw);
  }
  const chapters = ids.map(id => IN_CHAPTER_BY_ID[id]);

  if (track) {
    for (const chapter of chapters) {
      const grade = chapterGrade(chapter);
      if (track === 'olympiad' && grade !== null) return invalid(`${chapter.name} is a Class ${grade} chapter, not an olympiad topic.`);
      if (track !== 'olympiad' && grade === null) return invalid(`${chapter.name} is an olympiad topic; choose the olympiad track.`);
      if ((track === 'jee-main' || track === 'jee-advanced') && grade < 11) return invalid(`${chapter.name} is a Class ${grade} chapter; JEE tracks cover Classes 11–12.`);
    }
  } else if (chapters.length) {
    const olympiad = chapters.every(ch => chapterGrade(ch) === null);
    const graded = chapters.every(ch => chapterGrade(ch) !== null);
    if (!olympiad && !graded) return invalid('An assignment cannot mix olympiad topics with class chapters.');
    track = olympiad ? 'olympiad' : 'cbse';
  }
  if (track) spec.track = track;
  if (ids.length) {
    spec.subtopics = ids;
    if (ids.length === 1) spec.subtopic = ids[0];
  }

  if (input.dotpoint !== undefined && input.dotpoint !== null && input.dotpoint !== '') {
    const dp = integer(input.dotpoint);
    if (dp === null || dp < 0) return invalid('Dot point must be a whole number.');
    if (chapters.length !== 1) return invalid('A dot point can only be chosen for a single chapter.');
    if (dp >= chapters[0].dotpoints.length) return invalid(`${chapters[0].name} has ${chapters[0].dotpoints.length} dot points.`);
    spec.dotpoint = dp;
  }

  if (input.difficulty !== undefined && input.difficulty !== null && input.difficulty !== '') {
    const d = integer(input.difficulty);
    const ceiling = track ? IN_TRACKS[track].difficultyCeiling : 4;
    if (d === null || d < 1 || d > ceiling) return invalid(`Difficulty must be a whole number from 1 to ${ceiling}${track ? ` on ${IN_TRACKS[track].name}` : ''}.`);
    spec.difficulty = d;
  }
  return { ok: true, spec };
}

function parseObject(raw) {
  try {
    const value = JSON.parse(raw || '{}');
    return plain(value) ? value : {};
  } catch { return {}; }
}

const accuracyOf = (correct, answered) => (answered ? Math.round(100 * correct / answered) : null);

function targetOf(spec) {
  const subtopics = Array.isArray(spec.subtopics) ? spec.subtopics.filter(id => IN_CHAPTER_BY_ID[id]) : spec.subtopic && IN_CHAPTER_BY_ID[spec.subtopic] ? [spec.subtopic] : [];
  return {
    track: spec.track || null,
    subtopics,
    chapters: subtopics.map(id => ({ id, name: IN_CHAPTER_BY_ID[id].name, grade: chapterGrade(IN_CHAPTER_BY_ID[id]) })),
    dotpoint: Number.isInteger(spec.dotpoint) ? spec.dotpoint : null,
    difficulty: Number.isInteger(spec.difficulty) ? spec.difficulty : null,
    questionCount: Number.isInteger(spec.questionCount) ? spec.questionCount : 10
  };
}

/**
 * Intervention flags from aggregate submissions. Cloud analytics see
 * assignments, not questions, so "the last 20 attempts" is read off the most
 * recent assignments that together cover about twenty answered questions.
 * Misconception flags need per-question evidence and stay on the device.
 */
function studentFlags({ joinedAt, assignments, submissions, now }) {
  const flags = [];
  const activity = submissions.map(s => s.updatedAt || s.startedAt || 0).filter(Boolean);
  const lastActivityAt = activity.length ? Math.max(...activity) : null;
  const anchor = lastActivityAt || joinedAt || null;
  const idle = anchor ? Math.floor((now - anchor) / DAY) : null;
  if (assignments.length) {
    if (!submissions.length) {
      if (idle == null || idle >= INACTIVE_DAYS) flags.push({ code: 'inactive', label: 'Not started', reason: idle == null ? 'Has not started any assignment.' : `Has not started any assignment in the ${idle} days since joining.` });
    } else if (idle != null && idle >= INACTIVE_DAYS) {
      flags.push({ code: 'inactive', label: `Inactive ${idle}d`, reason: `Last worked on an assignment ${idle} days ago.` });
    }
  }
  const overdue = assignments.filter(a => a.dueAt && a.dueAt < now).filter(a => {
    const sub = submissions.find(s => s.assignmentId === a.id);
    return !sub || sub.state !== 'submitted';
  });
  if (overdue.length) {
    flags.push({
      code: 'overdue', label: `${overdue.length} overdue`,
      reason: `Past due and not submitted: ${overdue.map(a => a.title).join(', ')}.`
    });
  }
  const ordered = submissions.filter(s => s.answered > 0).sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
  let recentAnswered = 0;
  let recentCorrect = 0;
  let cut = ordered.length;
  while (cut > 0 && recentAnswered < DROP_WINDOW) {
    cut--;
    recentAnswered += ordered[cut].answered;
    recentCorrect += ordered[cut].correct;
  }
  const earlier = ordered.slice(0, cut);
  const earlierAnswered = earlier.reduce((n, s) => n + s.answered, 0);
  const earlierCorrect = earlier.reduce((n, s) => n + s.correct, 0);
  if (earlierAnswered >= 10 && recentAnswered >= 10) {
    const before = accuracyOf(earlierCorrect, earlierAnswered);
    const after = accuracyOf(recentCorrect, recentAnswered);
    if (before - after >= DROP_POINTS) {
      flags.push({ code: 'accuracy-drop', label: `Accuracy −${before - after}`, reason: `Accuracy fell from ${before}% on earlier assignments to ${after}% across the most recent ${recentAnswered} answered questions.` });
    }
  }
  return { flags, lastActivityAt };
}

/** Aggregated analytics for one class: students, assignments, chapters, attention. */
export function classAnalytics(db, classId, now = Date.now()) {
  const members = db.prepare(`SELECT a.id,a.name,cm.joined_at FROM class_members cm JOIN accounts a ON a.id=cm.student_account_id
    WHERE cm.class_id=? AND cm.removed_at IS NULL AND a.deleted_at IS NULL ORDER BY a.name COLLATE NOCASE,a.id`).all(classId);
  const assignmentRowsRaw = db.prepare(`SELECT id,title,specification_json,due_at,created_at FROM assignments
    WHERE class_id=? AND archived_at IS NULL ORDER BY created_at,id`).all(classId);
  const submissionsRaw = db.prepare(`SELECT s.assignment_id,s.student_account_id,s.state,s.summary_json,s.started_at,s.submitted_at,s.updated_at,
      f.feedback_json,f.returned_at
    FROM assignment_submissions s
    JOIN assignments a ON a.id=s.assignment_id
    LEFT JOIN assignment_feedback f ON f.assignment_id=s.assignment_id AND f.student_account_id=s.student_account_id
    WHERE a.class_id=? AND a.archived_at IS NULL`).all(classId);

  const assignments = assignmentRowsRaw.map(row => ({
    id: row.id, title: row.title, dueAt: row.due_at || null, createdAt: row.created_at,
    target: targetOf(parseObject(row.specification_json))
  }));
  const submissions = submissionsRaw.map(row => {
    const summary = sanitizeAssignmentSummary(parseObject(row.summary_json));
    return {
      assignmentId: row.assignment_id, studentId: row.student_account_id, state: row.state,
      answered: summary.questionsAnswered, correct: summary.correct, summary,
      startedAt: row.started_at || null, submittedAt: row.submitted_at || null, updatedAt: row.updated_at || null,
      feedback: row.feedback_json ? parseObject(row.feedback_json) : null, returnedAt: row.returned_at || null
    };
  });

  const studentRows = members.map(m => {
    const mine = submissions.filter(s => s.studentId === m.id);
    const answered = mine.reduce((n, s) => n + s.answered, 0);
    const correct = mine.reduce((n, s) => n + s.correct, 0);
    const { flags, lastActivityAt } = studentFlags({ joinedAt: m.joined_at, assignments, submissions: mine, now });
    const by = state => mine.filter(s => s.state === state).length;
    return {
      id: m.id, name: m.name, joinedAt: m.joined_at,
      assigned: assignments.length, started: by('started'), submitted: by('submitted'), returned: by('returned'),
      notStarted: Math.max(0, assignments.length - mine.length),
      questionsAnswered: answered, correct, accuracy: accuracyOf(correct, answered),
      lastActivityAt, flags
    };
  });

  const assignmentRows = assignments.map(a => {
    const rows = submissions.filter(s => s.assignmentId === a.id);
    const answered = rows.reduce((n, s) => n + s.answered, 0);
    const correct = rows.reduce((n, s) => n + s.correct, 0);
    const by = state => rows.filter(s => s.state === state).length;
    return {
      id: a.id, title: a.title, dueAt: a.dueAt, createdAt: a.createdAt, overdue: !!a.dueAt && a.dueAt < now,
      target: a.target,
      notStarted: Math.max(0, members.length - rows.length), started: by('started'), submitted: by('submitted'), returned: by('returned'),
      questionsAnswered: answered, correct, accuracy: accuracyOf(correct, answered)
    };
  });

  // Chapter evidence: a multi-chapter assignment's questions are shared evenly
  // across the chapters it targeted, so accuracy is exact and the attempt
  // count is the fair share. Chapters nobody has answered on are not listed.
  const chapterAgg = new Map();
  for (const a of assignments) {
    const n = a.target.chapters.length;
    if (!n) continue;
    const rows = submissions.filter(s => s.assignmentId === a.id);
    const answered = rows.reduce((t, s) => t + s.answered, 0) / n;
    const correct = rows.reduce((t, s) => t + s.correct, 0) / n;
    for (const ch of a.target.chapters) {
      const agg = chapterAgg.get(ch.id) || { id: ch.id, name: ch.name, grade: ch.grade, assignments: 0, answered: 0, correct: 0 };
      agg.assignments++; agg.answered += answered; agg.correct += correct;
      chapterAgg.set(ch.id, agg);
    }
  }
  const chapters = [...chapterAgg.values()]
    .filter(c => c.answered > 0)
    .map(c => ({ id: c.id, name: c.name, grade: c.grade, assignments: c.assignments, questionsAnswered: Math.round(c.answered), correct: Math.round(c.correct), accuracy: accuracyOf(c.correct, c.answered) }))
    .sort((a, b) => a.accuracy - b.accuracy || b.questionsAnswered - a.questionsAnswered || a.name.localeCompare(b.name));
  const weakestChapters = chapters.filter(c => c.questionsAnswered >= 5).slice(0, 3);
  const attention = studentRows.filter(s => s.flags.length).map(s => ({ id: s.id, name: s.name, flags: s.flags }));

  return {
    classId, generatedAt: now,
    students: members.length, assignments: assignments.length,
    startedSubmissions: submissions.length,
    submitted: submissions.filter(s => s.state === 'submitted').length,
    returned: submissions.filter(s => s.state === 'returned').length,
    studentRows, assignmentRows, chapters, weakestChapters, attention,
    submissionRows: submissions.map(s => ({
      assignmentId: s.assignmentId, studentId: s.studentId, state: s.state,
      summary: s.summary, submittedAt: s.submittedAt, updatedAt: s.updatedAt,
      feedback: s.feedback, returnedAt: s.returnedAt
    }))
  };
}
