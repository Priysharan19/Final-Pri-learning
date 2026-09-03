// Pri Learning · India exam backend
//
// This module is deliberately separate from local/backend.js's HSC-style paper
// generator. Indian profiles are routed here by api.js so an India exam can
// never accidentally append the legacy HSC multipart Section II.

import { get, put, del, byIndex, uuid } from './idb.js';
import { indiaScope, resolveIndiaTarget } from '../engine/indiaProduct.js';
import { generateQuestion, loadBanksFor } from '../engine/generators/index.js';
import { checkAnswer } from '../engine/checker.js';
import {
  JEE_MAIN_MATHEMATICS_2026,
  indiaExamBlueprint,
  indiaExamClaim
} from '../engine/indiaExams.js';

const MAX_GENERATION_ATTEMPTS_PER_SLOT = 180;

function error(message, status = 400, code = 'INDIA_EXAM_ERROR') {
  return Object.assign(new Error(message), { status, code });
}

function randomSeed() {
  try {
    const a = new Uint32Array(1);
    globalThis.crypto?.getRandomValues?.(a);
    if (a[0]) return a[0] & 0x7fffffff;
  } catch { /* fallback below */ }
  return Math.floor(Math.random() * 0x7fffffff);
}

function publicQuestion(row) {
  const q = row.payload || {};
  return {
    id: row.id,
    prompt: q.prompt,
    difficulty: q.difficulty || row.difficulty || 3,
    subtopic: q.subtopic || row.subtopic,
    answerType: q.answerType,
    mcqOptions: q.mcqOptions || null,
    figure: q.figure || null,
    inputHint: q.inputHint || null,
    section: row.indiaExamSection,
    marks: Number(row.examMarking?.correct || 4),
    negativeMarks: Math.abs(Number(row.examMarking?.incorrect || -1))
  };
}

function displayAnswer(q) {
  if (!q) return '';
  if (q.answerType === 'mcq') return q.mcqOptions?.[q.answer?.correctIndex] ?? '';
  if (q.answer?.simplestFraction) return `${q.answer.simplestFraction.n}/${q.answer.simplestFraction.d}`;
  if (q.answer?.value !== undefined) return `${q.answerPrefix || ''}${q.answer.value}${q.answerSuffix || ''}`;
  if (q.answer?.text !== undefined) return String(q.answer.text);
  return '';
}

function questionMatches(q, type) {
  if (type === 'mcq') return q?.answerType === 'mcq';
  return q && q.answerType !== 'mcq' && ['numeric', 'fraction', 'integer'].includes(String(q.answerType || 'numeric'));
}

async function generateReviewedJeeQuestion(type, seen) {
  const chapters = indiaScope('jee-main', 12);
  if (!chapters.length) throw error('JEE Main curriculum scope is unavailable.', 503, 'JEE_SCOPE_UNAVAILABLE');

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS_PER_SLOT; attempt++) {
    const chapter = chapters[Math.floor(Math.random() * chapters.length)];
    const target = resolveIndiaTarget(chapter, {
      track: 'jee-main', grade: 12, difficulty: 3 + (Math.random() > 0.5 ? 1 : 0), random: Math.random
    });
    // Authentic JEE exam mode uses the reviewed PYQ archive only. Authored school
    // fallback remains excellent practice, but it is not silently promoted to a
    // previous-year-question exam claim.
    if (!target?.pyq) continue;
    await loadBanksFor([target.generator]);
    const seed = randomSeed();
    const q = generateQuestion(target.generator, target.difficulty, seed);
    if (!questionMatches(q, type)) continue;
    const signature = `${target.generator}|${String(q.prompt || '').replace(/\s+/g, ' ').trim()}`;
    if (!q.prompt || seen.has(signature)) continue;
    seen.add(signature);
    return { q, target, seed };
  }
  throw error(
    `The reviewed JEE PYQ archive cannot currently supply enough unique ${type === 'mcq' ? 'MCQ' : 'numerical'} questions for an authentic 2026 Mathematics-section simulation.`,
    503,
    'JEE_REVIEWED_BANK_INSUFFICIENT'
  );
}

async function createJeeMainSection(profile) {
  const blueprint = JEE_MAIN_MATHEMATICS_2026;
  const examId = uuid();
  const questionIds = [];
  const created = [];
  const seen = new Set();

  try {
    for (const section of blueprint.sections) {
      for (let i = 0; i < section.questions; i++) {
        const made = await generateReviewedJeeQuestion(section.type, seen);
        const row = {
          id: uuid(), pid: profile.id, subtopic: made.target.generator,
          difficulty: made.q.difficulty || made.target.difficulty, payload: made.q,
          mode: 'exam', examId, taskId: null, answered: 0, tries: 0, hintsUsed: 0,
          createdAt: Date.now(), indiaExamSection: section.id,
          examMarking: { correct: section.correct, incorrect: section.incorrect, unanswered: section.unanswered },
          sourceKind: 'reviewed-jee-pyq'
        };
        await put('questions', row);
        created.push(row.id);
        questionIds.push(row.id);
      }
    }
  } catch (err) {
    // Exam generation is atomic from the student's perspective. Never leave a
    // half-paper in the question store if reviewed coverage cannot fill it.
    await Promise.all(created.map(id => del('questions', id).catch(() => {})));
    throw err;
  }

  const count = (await byIndex('exams', 'pid', profile.id)).filter(e => e?.indiaExam?.blueprintId === blueprint.id).length;
  const exam = {
    id: examId,
    pid: profile.id,
    year: profile.year,
    pathway: null,
    title: `JEE Main 2026 · Mathematics Section ${count + 1}`,
    durationMin: blueprint.recommendedSectionMinutes,
    questionIds,
    createdAt: Date.now(),
    finishedAt: null,
    score: null,
    total: blueprint.totalMarks,
    detail: null,
    indiaExam: {
      blueprintId: blueprint.id,
      track: 'jee-main',
      authenticity: blueprint.authenticity,
      fullPaper: false,
      sectionTimerOfficial: false,
      fullPaperDurationMinutes: blueprint.fullPaperDurationMinutes,
      sourceSession: blueprint.sourceSession
    }
  };
  await put('exams', exam);
  return { exam: await getExam(profile, exam.id) };
}

async function requireExam(profile, id) {
  const exam = await get('exams', id);
  if (!exam || exam.pid !== profile.id || !exam.indiaExam) throw error('India exam not found.', 404, 'INDIA_EXAM_NOT_FOUND');
  return exam;
}

async function getExam(profile, id) {
  const exam = await requireExam(profile, id);
  const questions = [];
  for (const qid of exam.questionIds || []) {
    const row = await get('questions', qid);
    if (row) questions.push(publicQuestion(row));
  }
  return {
    id: exam.id,
    title: exam.title,
    year: exam.year,
    durationMin: exam.durationMin,
    createdAt: exam.createdAt,
    finishedAt: exam.finishedAt,
    score: exam.score,
    total: exam.total,
    questions,
    detail: exam.detail || null,
    indiaExam: exam.indiaExam
  };
}

async function listExams(profile) {
  const rows = (await byIndex('exams', 'pid', profile.id))
    .filter(e => e?.indiaExam)
    .sort((a, b) => b.createdAt - a.createdAt);
  return {
    exams: rows.map(e => ({
      id: e.id, title: e.title, year: e.year, duration_min: e.durationMin,
      created_at: e.createdAt, finished_at: e.finishedAt, score: e.score, total: e.total,
      indiaExam: e.indiaExam
    }))
  };
}

async function submitExam(profile, id, body = {}) {
  const exam = await requireExam(profile, id);
  if (exam.finishedAt) throw error('Exam already submitted.', 409, 'INDIA_EXAM_ALREADY_SUBMITTED');
  const answers = body.answers || {};
  let score = 0;
  let total = 0;
  const detail = [];

  for (const qid of exam.questionIds || []) {
    const row = await get('questions', qid);
    if (!row) continue;
    const q = row.payload;
    const given = answers[qid];
    const unanswered = given === undefined || given === null || String(given).trim() === '';
    const result = unanswered ? { correct: false } : checkAnswer(q, given);
    const marking = row.examMarking || { correct: 4, incorrect: -1, unanswered: 0 };
    const awarded = unanswered ? marking.unanswered : result.correct ? marking.correct : marking.incorrect;
    score += awarded;
    total += marking.correct;
    row.answered = 1;
    await put('questions', row);
    detail.push({
      id: qid,
      section: row.indiaExamSection,
      given: unanswered ? '' : String(given),
      correct: !!result.correct,
      unanswered,
      awarded,
      marks: marking.correct,
      feedback: result.feedback || (unanswered ? 'Not attempted.' : ''),
      answerText: displayAnswer(q),
      steps: q.steps || []
    });
  }

  exam.finishedAt = Date.now();
  exam.score = score;
  exam.total = total;
  exam.detail = detail;
  await put('exams', exam);
  return { score, total, pct: Math.round(1000 * score / Math.max(1, total)) / 10, detail };
}

async function paper(profile, id) {
  const exam = await requireExam(profile, id);
  const questions = [];
  for (const qid of exam.questionIds || []) {
    const row = await get('questions', qid);
    if (!row) continue;
    const q = row.payload;
    const base = publicQuestion(row);
    questions.push(exam.finishedAt ? {
      ...base,
      answerText: displayAnswer(q),
      steps: q.steps || [],
      criteria: [{ mark: Number(row.examMarking?.correct || 4), text: 'Correct response under the JEE Main 2026 section marking scheme' }]
    } : base);
  }
  return {
    title: exam.title,
    year: exam.year,
    durationMin: exam.durationMin,
    course: 'JEE Main 2026 · Mathematics section simulation',
    questions,
    solutionsAvailable: !!exam.finishedAt,
    indiaExam: exam.indiaExam
  };
}

export function indiaExamRoute(method, path) {
  if (path === '/exams' && (method === 'GET' || method === 'POST')) return true;
  return /^\/exams\/[^/]+(?:\/paper|\/submit)?$/.test(path) && (method === 'GET' || method === 'POST');
}

export async function dispatchIndiaExam(profile, method, path, body = {}) {
  if (!profile?.id || profile.course !== 'in') throw error('India exam routing requires an India profile.', 400, 'INDIA_PROFILE_REQUIRED');
  if (path === '/exams' && method === 'GET') return listExams(profile);
  if (path === '/exams' && method === 'POST') {
    const track = profile.indiaTrack || 'cbse';
    const blueprint = indiaExamBlueprint({ track, grade: profile.year });
    if (track === 'jee-main' && blueprint?.id === JEE_MAIN_MATHEMATICS_2026.id) return createJeeMainSection(profile);
    const claim = indiaExamClaim(blueprint);
    throw error(
      claim?.reason || 'An authentic exam blueprint has not been released for this India selection.',
      409,
      'INDIA_EXAM_NOT_RELEASED'
    );
  }

  const m = path.match(/^\/exams\/([^/]+)(?:\/(paper|submit))?$/);
  if (!m) throw error('India exam route not found.', 404, 'INDIA_EXAM_ROUTE_NOT_FOUND');
  const [, id, action] = m;
  if (!action && method === 'GET') return getExam(profile, id);
  if (action === 'paper' && method === 'GET') return paper(profile, id);
  if (action === 'submit' && method === 'POST') return submitExam(profile, id, body);
  throw error('India exam method is not allowed.', 405, 'INDIA_EXAM_METHOD_NOT_ALLOWED');
}
