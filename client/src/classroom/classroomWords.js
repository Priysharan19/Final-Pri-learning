// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the teacher workspace's shared words (client side)
//
// Small pure helpers both the teacher's and the student's screens use: how a
// paper assignment is described, a misconception's registry name, and the
// keys of every coded refusal a hand-in can meet. Explicit maps (never
// template keys), so the i18n suites see every key.
// ─────────────────────────────────────────────────────────────────────────────
import { misconceptionById } from '../engine/misconceptions.js';
import { PATHWAYS } from '../engine/curriculum.js';

/** A misconception registry id as the teacher reads it: its registry name, or null. */
export function misconceptionName(t, id) {
  const m = misconceptionById(id);
  return m ? t(m.name) : null;
}

/** The engine's line verdicts (server REVIEW_LINE_STATUSES): word keys. */
export const LINE_WORD = { ok: 'tw.line.ok', break: 'tw.line.break', unsure: 'tw.line.unsure' };

export const CRITERION_WORD = { method: 'tw.criterion.method', 'follow-through': 'tw.criterion.followThrough' };
export const CRITERION_HELP = { method: 'tw.criterion.methodHelp', 'follow-through': 'tw.criterion.followThroughHelp' };

/** What a student meets when a hand-in is refused, by the server's code. */
export const HANDIN_ERROR = {
  HANDIN_WRONG_PAPER: 'tw.handin.err.wrongPaper',
  HANDIN_ALREADY: 'tw.handin.err.already',
  HANDIN_HANDWRITING_PENDING: 'tw.handin.err.handwritingPending',
  HANDIN_EXAM_USED: 'tw.handin.err.examUsed',
  EXAM_NOT_FOUND: 'tw.handin.err.examNotFound',
  ASSIGNMENT_NOT_FOUND: 'tw.handin.err.assignmentNotFound',
  HANDIN_INVALID: 'tw.handin.err.invalid'
};

/** What a teacher can see, item by item (classroom.js TEACHER_VISIBILITY). */
export const SEES_WORD = {
  name: 'tw.sees.name', membership: 'tw.sees.membership', 'evidence-states': 'tw.sees.evidenceStates',
  'common-mistakes': 'tw.sees.commonMistakes', 'handed-in-papers': 'tw.sees.handedInPapers', 'handed-in-handwriting': 'tw.sees.handedInHandwriting', 'teacher-marks': 'tw.sees.teacherMarks'
};
export const NEVER_WORD = {
  email: 'tw.never.email', guardian: 'tw.never.guardian', plan: 'tw.never.plan', notes: 'tw.never.notes',
  'tutor-and-ai-chats': 'tw.never.tutorChats', 'practice-working': 'tw.never.practiceWorking',
  'photos-and-practice-handwriting': 'tw.never.photos', 'papers-not-handed-in': 'tw.never.papersNotHandedIn', 'other-classes': 'tw.never.otherClasses'
};

/** The India paper choices a teacher can set (server paperAssignments.js india template). */
export const INDIA_PAPERS = Object.freeze([
  { id: 'cbse-10-standard', track: 'cbse', grade: 10, variant: 'standard', key: 'tw.paper.cbse10Standard' },
  { id: 'cbse-10-basic', track: 'cbse', grade: 10, variant: 'basic', key: 'tw.paper.cbse10Basic' },
  { id: 'cbse-11', track: 'cbse', grade: 11, variant: 'standard', key: 'tw.paper.cbse11' },
  { id: 'cbse-12', track: 'cbse', grade: 12, variant: 'standard', key: 'tw.paper.cbse12' },
  { id: 'jee-main-12', track: 'jee-main', grade: 12, variant: 'standard', key: 'tw.paper.jeeMain' },
  { id: 'jee-advanced-12', track: 'jee-advanced', grade: 12, variant: 'standard', key: 'tw.paper.jeeAdvanced' }
]);

export const PAPER_MINUTES = Object.freeze([15, 20, 30, 45, 60]);

/** Pathway names come from the curriculum (the course names are the syllabus's own). */
export const pathwaysForYear = year => Object.entries(PATHWAYS).filter(([, p]) => p.years.includes(Number(year))).map(([id, p]) => ({ id, name: p.name }));

/** One line describing a paper template, e.g. "Practice paper · Year 9 · 30 minutes". */
export function paperLabel(t, paper, nswTitles = {}) {
  if (!paper || typeof paper !== 'object') return t('tw.paper.unknown');
  if (paper.kind === 'nsw') return nswTitles[paper.blueprint] || t('tw.paper.nswNamed', { id: paper.blueprint });
  if (paper.kind === 'practice-paper') {
    const pw = paper.pathway && PATHWAYS[paper.pathway] ? PATHWAYS[paper.pathway].name : null;
    return pw ? t('tw.paper.practiceWithPathway', { year: paper.year, minutes: paper.minutes, pathway: pw })
      : t('tw.paper.practice', { year: paper.year, minutes: paper.minutes });
  }
  if (paper.kind === 'india') {
    const hit = INDIA_PAPERS.find(p => p.track === paper.track && p.grade === paper.grade && p.variant === (paper.variant || 'standard'));
    return hit ? t(hit.key) : t('tw.paper.indiaOther', { grade: paper.grade });
  }
  return t('tw.paper.unknown');
}

export const isPaperAssignment = row => row?.specification?.kind === 'paper' && !!row.specification.paper;

/** A question's place on the paper: "3" or "3(b)". */
export const questionLabel = q => (q?.part ? `${q.order}(${q.part})` : String(q?.order ?? ''));

/** The first eight characters of an ink digest: which frozen page a teacher is deciding on. */
export const inkShort = digest => (typeof digest === 'string' && /^[0-9a-f]{8,}$/i.test(digest) ? digest.slice(0, 8).toLowerCase() : null);
