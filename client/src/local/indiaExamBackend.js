// Pri Learning · India exam backend
//
// This module is deliberately separate from local/backend.js's HSC-style paper
// generator. Indian profiles are routed here by api.js so an India exam can
// never accidentally append the legacy HSC multipart Section II.
//
// It composes a paper from a source-versioned blueprint (engine/indiaExams.js)
// through engine/indiaExamComposer.js, stores it, serves it to the exam room in
// the same {exam} envelope the room already reads, marks it under the
// blueprint's own grid (CBSE marks, JEE +4/−1/0 with Advanced partial marking,
// IOQM 2/3/5), and records every attempted question through the ordinary
// evidence path in backend.js so progress and the adaptive engine see it.
import { get, put, del, byIndex, uuid } from './idb.js';
import { indiaScope, indiaChapter, cleanIndiaTrack, resolveIndiaTarget } from '../engine/indiaProduct.js';
import { pyqCellsFor, pyqAbsenceFor, PYQ_MANIFEST } from '../engine/pyq/pyqCoverage.js';
import { generateQuestion, loadBanksFor } from '../engine/generators/index.js';
import { checkAnswer, stepCheck } from '../engine/checker.js';
import { sanitizeFigure } from '../lib/sanitize.js';
import {
  JEE_MAIN_MATHEMATICS_2026,
  indiaExamBlueprint,
  indiaExamPaperSpec,
  indiaExamClaim,
  markObjective,
  markMultiCorrect
} from '../engine/indiaExams.js';
import { composeIndiaPaper, composerNotes, answerText } from '../engine/indiaExamComposer.js';
import { examStepMeta, recordIndiaExamEvidence, finishIndiaExamEvidence } from './backend.js';
import { assertExamAllowed, examAllowance, recordExamSimulation, requireCapability } from './entitlementGate.js';
import { ENTITLEMENTS } from '../platform/entitlements.js';

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

const safeFigure = v => sanitizeFigure(typeof v === 'string' ? v : '') || null;
const blank = v => v === undefined || v === null || String(v).trim() === '';
const objectiveTypes = new Set(['mcq', 'multi-mcq']);

// ── Public views ────────────────────────────────────────────────────────────

function publicSingle(q) {
  return {
    prompt: q.prompt, answerType: q.answerType, mcqOptions: q.mcqOptions || null, matchList: q.matchList || null,
    figure: safeFigure(q.figure), inputHint: q.inputHint || null, answerPrefix: q.answerPrefix || null, answerSuffix: q.answerSuffix || null,
    supportsSteps: !objectiveTypes.has(q.answerType) && !!examStepMeta(q)
  };
}

function publicPart(pt) {
  return {
    key: pt.key, marks: pt.marks, ...publicSingle(pt),
    alt: pt.alt ? { key: pt.key, marks: pt.marks, ...publicSingle(pt.alt) } : null
  };
}

function publicQuestion(row) {
  const q = row.payload || {};
  const chapter = indiaChapter(row.india?.chapterId);
  const marking = row.examMarking || { correct: 1, incorrect: 0, unanswered: 0 };
  const base = {
    id: row.id, order: row.examOrder, section: row.indiaExamSection, sectionLabel: row.indiaExamSectionLabel || `Section ${row.indiaExamSection}`,
    item: row.indiaExamItem, marks: Number(marking.correct), negativeMarks: Math.abs(Number(marking.incorrect || 0)),
    partialPerOption: marking.partialPerOption ?? null,
    subtopic: chapter?.id || q.subtopic, subtopicName: chapter?.name || q.subtopic, chapterId: chapter?.id || null,
    difficulty: q.difficulty || row.difficulty || 2, diffLabel: `D${q.difficulty || row.difficulty || 2}`,
    // A past-paper question says so on the card, with the sitting it came from
    // and the documents it was transcribed from. A student practising PYQs is
    // asking for exactly that label, so it travels with the question.
    sourceKind: row.sourceKind,
    pyq: !!q.pyq || row.sourceKind === 'reviewed-jee-pyq',
    pyqSource: q.pyqSource || null,
    pyqYear: q.pyqYear || null,
    pyqExam: q.pyqExam || null,
    pyqArchive: q.archive || null
  };
  if (q.multipart) {
    return { ...base, multipart: true, title: q.title, stem: q.stem, figure: safeFigure(q.figure), parts: (q.parts || []).map(publicPart) };
  }
  return { ...base, ...publicSingle(q), choice: q.alt ? publicSingle(q.alt) : null };
}

// ── Composition ─────────────────────────────────────────────────────────────

function titleFor(spec, n) {
  if (spec.track === 'jee-main') return `JEE Main 2026 · Mathematics Section ${n}`;
  if (spec.track === 'jee-advanced') return `JEE Advanced · Paper 1 Mathematics (2024 pattern) · Paper ${n}`;
  if (spec.track === 'olympiad') return `IOQM · Paper ${n}`;
  return `${spec.label.replace(/\s*·\s*reference pattern$/, '').replace(/\s*·\s*school-style pattern$/, '')} · Paper ${n}`;
}

/**
 * Previous-year cells for every chapter in scope, once their banks are loaded.
 * Two archives can contribute and both are used: the reviewed JEE department
 * catalog for JEE tracks, and the source-cited archive (engine/pyq) for any
 * track it publishes — which today is CBSE Classes 10 and 12 and JEE Advanced.
 * Authored forms fill whatever the archives cannot, and the composer labels
 * every question with which of the two it was.
 */
async function pyqCellsByChapter(track, chapters) {
  const cells = new Map();
  const generators = new Set();
  for (const chapter of chapters) {
    const list = [];
    if (track === 'jee-main' || track === 'jee-advanced') {
      for (const difficulty of [3, 4]) {
        const target = resolveIndiaTarget(chapter, { track, grade: 12, difficulty, random: () => 0 });
        if (target?.pyqArchive !== 'jee-question-department') continue;
        if (list.some(c => c.generator === target.generator && c.difficulty === target.difficulty)) continue;
        list.push({ generator: target.generator, difficulty: target.difficulty, pyq: true });
      }
    }
    // Every rung the source-cited archive actually publishes for this chapter.
    // buildItem narrows them to the section's own window before drawing.
    for (const cell of pyqCellsFor(track, chapter.id)) list.push(cell);
    if (!list.length) continue;
    for (const cell of list) generators.add(cell.generator);
    cells.set(chapter.id, list);
  }
  if (generators.size) await loadBanksFor([...generators]);
  return cells;
}

/** Cells inside a difficulty window, or the nearest rungs to it when none are. */
function narrowCells(cells, { min = 1, max = 4 } = {}) {
  if (!cells.length) return cells;
  const inside = cells.filter(c => c.difficulty >= min && c.difficulty <= max);
  if (inside.length) return inside;
  const gap = c => Math.min(Math.abs(c.difficulty - min), Math.abs(c.difficulty - max));
  const best = Math.min(...cells.map(gap));
  return cells.filter(c => gap(c) === best);
}

async function createIndiaExam(profile, body = {}) {
  const grade = Number(profile.year);
  const track = cleanIndiaTrack(profile.indiaTrack || 'cbse', grade);
  const variant = body.variant === 'basic' ? 'basic' : 'standard';
  const blueprint = indiaExamBlueprint({ track, grade, variant });
  const spec = indiaExamPaperSpec({ track, grade, variant });
  if (!spec) {
    const claim = indiaExamClaim(blueprint);
    throw error(claim?.reason || 'An authentic exam blueprint has not been released for this India selection.', 409, 'INDIA_EXAM_NOT_RELEASED');
  }
  const chapters = indiaScope(track, grade);
  if (!chapters.length) throw error('The curriculum scope for this track is unavailable.', 503, 'INDIA_SCOPE_UNAVAILABLE');
  await loadBanksFor([...new Set(chapters.flatMap(c => (c.covers || []).map(x => x.gen)))]);
  const pyqCells = await pyqCellsByChapter(track, chapters);
  const seed = Number.isFinite(Number(body.seed)) && Number(body.seed) > 0 ? Math.floor(Number(body.seed)) & 0x7fffffff : randomSeed();

  const paper = composeIndiaPaper(spec, {
    seed, draw: generateQuestion, chapters,
    // The section's own difficulty window narrows the chapter's archive cells,
    // by the same nearest-rung rule chapterCells uses for authored ones: a
    // one-mark Section A slot should not be handed a D4 JEE Advanced item just
    // because the chapter has one, but a chapter whose only past-paper question
    // sits a rung outside the window is still better than no past paper at all.
    pyqCellsFor: (chapter, range) => narrowCells(pyqCells.get(chapter.id) || [], range)
  });
  if (body.source === 'reviewed' && paper.composition.pyq < paper.questions.length) {
    throw error(
      'The reviewed JEE PYQ archive cannot currently supply enough unique questions for a reviewed-only Mathematics-section simulation.',
      503,
      'JEE_REVIEWED_BANK_INSUFFICIENT'
    );
  }

  const examId = uuid();
  const questionIds = [];
  const created = [];
  const now = Date.now();
  try {
    for (const q of paper.questions) {
      const row = {
        id: uuid(), pid: profile.id, subtopic: q.payload.subtopic, difficulty: q.difficulty, payload: q.payload,
        india: { chapterId: q.chapterId, track, dotpointIndex: null },
        mode: 'exam', examId, taskId: null, answered: 0, tries: 0, hintsUsed: 0, createdAt: now,
        indiaExamSection: q.section, indiaExamSectionLabel: q.sectionLabel, indiaExamItem: q.item, examOrder: q.order,
        examMarking: q.marking, sourceKind: q.pyq ? 'reviewed-jee-pyq' : 'authored-generator', conversion: q.conversion
      };
      await put('questions', row);
      created.push(row.id);
      questionIds.push(row.id);
    }
  } catch (err) {
    // Exam generation is atomic from the student's perspective: never leave a
    // half-paper in the question store.
    await Promise.all(created.map(id => del('questions', id).catch(() => {})));
    throw err;
  }

  const count = (await byIndex('exams', 'pid', profile.id)).filter(e => e?.indiaExam?.blueprintId === spec.id).length;
  const exam = {
    id: examId,
    pid: profile.id,
    year: profile.year,
    pathway: null,
    title: titleFor(spec, count + 1),
    durationMin: spec.durationMinutes || spec.recommendedSectionMinutes || 60,
    questionIds,
    createdAt: now,
    finishedAt: null,
    score: null,
    total: paper.totalMarks,
    detail: null,
    summary: null,
    indiaExam: {
      blueprintId: spec.id,
      claimBlueprintId: blueprint?.id || spec.id,
      label: spec.label,
      track, variant, grade,
      authenticity: spec.authenticity,
      sourceSession: spec.sourceSession,
      fullPaper: track === 'cbse' || track === 'olympiad',
      sectionTimerOfficial: !!spec.sectionTimerIsOfficial,
      fullPaperDurationMinutes: spec.fullPaperDurationMinutes || spec.durationMinutes || null,
      seed,
      sections: spec.sections.map(s => ({
        id: s.id, label: s.label || `Section ${s.id}`, questions: s.questions, marks: s.marks,
        marksEach: s.marksEach ?? s.correct, negative: Math.abs(Number(s.incorrect || 0)), partialPerOption: s.partialPerOption ?? null,
        types: s.types || [s.type]
      })),
      units: paper.units,
      // What this paper actually drew from the previous-year archive, and what
      // the archive holds. `absent` is present when the student's track is one
      // the archive deliberately carries nothing for, so an empty PYQ count is
      // a stated reason rather than a silence.
      pyq: {
        used: paper.composition.pyq,
        questions: paper.questions.length,
        archive: PYQ_MANIFEST,
        absent: pyqAbsenceFor(track)
      },
      composition: paper.composition,
      reducedPattern: paper.reducedPattern,
      composerNotes: composerNotes(spec),
      sources: (spec.sources || []).map(s => ({ authority: s.authority, title: s.title, url: s.url }))
    }
  };
  await put('exams', exam);
  return { exam: await examView(profile, exam.id) };
}

// ── Reads ───────────────────────────────────────────────────────────────────

async function requireExam(profile, id) {
  const exam = await get('exams', id);
  if (!exam || exam.pid !== profile.id || !exam.indiaExam) throw error('India exam not found.', 404, 'INDIA_EXAM_NOT_FOUND');
  return exam;
}

async function examView(profile, id) {
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
    summary: exam.summary || null,
    indiaExam: exam.indiaExam
  };
}

async function getExam(profile, id) {
  return { exam: await examView(profile, id) };
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

// ── Marking ─────────────────────────────────────────────────────────────────

function criteriaFor(q, marks, marking) {
  if (objectiveTypes.has(q.answerType) || (marking.incorrect || 0) < 0) {
    const negative = Math.abs(Number(marking.incorrect || 0));
    return [{ mark: marks, text: `Correct response +${marks}${negative ? ` · incorrect response −${negative}` : ''} · unanswered ${marking.unanswered || 0}` }];
  }
  const key = (q.steps || []).filter(s => s?.h && !/^(check|note|bonus)/i.test(s.h)).slice(0, marks);
  if (!key.length) return [{ mark: marks, text: 'Correct final answer' }];
  return key.map((s, i) => ({
    mark: i === key.length - 1 ? marks - (key.length - 1) : 1,
    text: i === key.length - 1 ? `${s.h} — leading to the correct answer` : s.h
  }));
}

function parseIndices(given) {
  return String(given).split(/[,\s]+/).map(s => s.trim()).filter(Boolean).map(Number).filter(Number.isInteger);
}

/**
 * Mark one response under a marking grid. Written answers that are wrong but
 * come with typed working go through Step Check for method marks (capped one
 * below full marks), exactly as the legacy paper does; objective and
 * negative-marking items never earn method marks.
 */
function markResponse(q, given, working, marking) {
  const marks = Number(marking.correct);
  if (blank(given)) {
    return { unanswered: true, correct: false, awarded: markObjective(marking, { unanswered: true }), feedback: 'Not attempted.', partial: null, markingScheme: objectiveTypes.has(q.answerType) ? 'objective' : 'final-answer' };
  }
  if (q.answerType === 'multi-mcq') {
    const chosen = parseIndices(given);
    const r = markMultiCorrect(marking, chosen, q.answer?.correctIndices || []);
    const note = r.outcome === 'partial'
      ? `+${r.awarded}: every option you chose is correct, but not all correct options were chosen.`
      : r.outcome === 'wrong' ? `${r.awarded}: at least one chosen option is wrong.` : '';
    return { unanswered: false, correct: r.outcome === 'full', awarded: r.awarded, feedback: note, partial: r.outcome === 'partial' ? { awarded: r.awarded, note } : null, markingScheme: 'objective-partial', outcome: r.outcome };
  }
  let result;
  try { result = checkAnswer(q, given); } catch { result = { correct: false }; }
  const correct = !!result.correct;
  let awarded = markObjective(marking, { unanswered: false, correct });
  let feedback = result.feedback || '';
  if (!feedback && q.answerType === 'mcq' && q.answer?.optionTraps) feedback = q.answer.optionTraps[Number(given)] || '';
  let partial = null;
  let markingScheme = objectiveTypes.has(q.answerType) || (marking.incorrect || 0) < 0 || marks <= 1 ? 'objective' : 'final-answer';
  if (!correct && markingScheme === 'final-answer' && !blank(working)) {
    const meta = examStepMeta(q);
    if (meta) {
      try {
        const rep = stepCheck(meta, String(working));
        const okLines = (rep?.lines || []).filter(l => l.status === 'ok').length;
        if (okLines > 0) {
          awarded = Math.min(marks - 1, okLines);
          partial = { okLines, awarded, note: `${awarded} method mark${awarded === 1 ? '' : 's'} — the final answer was wrong, but ${okLines} line${okLines === 1 ? '' : 's'} of your working checked out.` };
        }
        markingScheme = 'step-marked';
      } catch { /* final-answer marks stand */ }
    }
  }
  return { unanswered: false, correct, awarded, feedback, partial, markingScheme };
}

function solutionFor(q, marks, marking) {
  return { steps: q.steps || [], answerText: answerText(q), criteria: criteriaFor(q, marks, marking) };
}

async function submitExam(profile, id, body = {}) {
  const exam = await requireExam(profile, id);
  if (exam.finishedAt) throw error('Exam already submitted.', 409, 'INDIA_EXAM_ALREADY_SUBMITTED');
  const answers = body.answers || {};
  const workings = body.workings || {};
  const times = body.times || {};
  const totalMs = Math.max(0, Number(body.ms) || 0);
  const nQ = Math.max(1, (exam.questionIds || []).length);
  const now = Date.now();

  let score = 0;
  let total = 0;
  const detail = [];
  const sections = new Map();
  const chapters = new Map();
  const schemes = {};
  let negativeMarks = 0;
  const bump = (map, key, seed, fn) => { const row = map.get(key) || seed(); fn(row); map.set(key, row); };
  const sectionSeed = row => () => ({ id: row.indiaExamSection, label: row.indiaExamSectionLabel || `Section ${row.indiaExamSection}`, questions: 0, attempted: 0, correct: 0, incorrect: 0, partial: 0, unanswered: 0, marks: 0, awarded: 0, negative: 0, ms: 0 });
  const chapterSeed = (chapter, row) => () => ({ id: chapter?.id || row.subtopic, label: chapter?.name || row.subtopic, questions: 0, attempted: 0, correct: 0, incorrect: 0, partial: 0, unanswered: 0, marks: 0, awarded: 0, negative: 0, ms: 0 });
  const tally = (agg, out) => {
    agg.questions++; agg.marks += out.marks; agg.awarded += out.awarded; agg.ms += out.ms;
    if (out.unanswered) agg.unanswered++; else { agg.attempted++; if (out.correct) agg.correct++; else if (out.awarded > 0) agg.partial++; else agg.incorrect++; }
    if (out.awarded < 0) agg.negative += -out.awarded;
  };

  for (const qid of exam.questionIds || []) {
    const row = await get('questions', qid);
    if (!row) continue;
    const q = row.payload;
    const marking = row.examMarking || { correct: 1, incorrect: 0, unanswered: 0 };
    const chapter = indiaChapter(row.india?.chapterId);
    const ms = Math.max(0, Number(times[qid]) || 0) || Math.round(totalMs / nQ);
    const base = {
      id: qid, order: row.examOrder, section: row.indiaExamSection, sectionLabel: row.indiaExamSectionLabel || `Section ${row.indiaExamSection}`,
      item: row.indiaExamItem, chapterId: chapter?.id || null, subtopic: chapter?.id || q.subtopic, subtopicName: chapter?.name || q.subtopic,
      difficulty: q.difficulty || row.difficulty || 2, ms, sourceKind: row.sourceKind
    };

    let out;
    if (q.multipart) {
      const partsOut = [];
      let qMarks = 0, qAwarded = 0, allCorrect = true, anyAnswered = false;
      for (const part of q.parts || []) {
        const mainGiven = answers[`${qid}::${part.key}`];
        const useAlt = blank(mainGiven) && part.alt && !blank(answers[`${qid}::${part.key}::or`]);
        const chosen = useAlt ? part.alt : part;
        const given = useAlt ? answers[`${qid}::${part.key}::or`] : mainGiven;
        const working = useAlt ? workings[`${qid}::${part.key}::or`] : workings[`${qid}::${part.key}`];
        const synth = { ...chosen, subtopic: chosen.subtopic || q.subtopic, difficulty: chosen.difficulty || q.difficulty || 2 };
        const partMarking = { correct: part.marks, incorrect: 0, unanswered: 0 };
        const r = markResponse(synth, given, working, partMarking);
        qMarks += part.marks; qAwarded += r.awarded;
        if (!r.correct) allCorrect = false;
        if (!r.unanswered) {
          anyAnswered = true;
          await recordIndiaExamEvidence(row, synth, { correct: r.correct, given, ms: Math.round(ms / (q.parts.length || 1)), feedback: r.feedback });
        }
        schemes[r.markingScheme] = (schemes[r.markingScheme] || 0) + 1;
        partsOut.push({
          key: part.key, prompt: chosen.prompt, answerType: chosen.answerType, mcqOptions: chosen.mcqOptions || null, figure: safeFigure(chosen.figure),
          choiceTaken: useAlt ? 'or' : (part.alt ? 'main' : null),
          given: blank(given) ? '' : String(given), correct: r.correct, unanswered: r.unanswered, marks: part.marks, awarded: r.awarded,
          feedback: r.feedback, partial: r.partial, markingScheme: r.markingScheme, answerText: answerText(chosen), steps: chosen.steps || []
        });
      }
      if (!row.answered) { row.answered = 1; await put('questions', row); }
      out = {
        ...base, multipart: true, title: q.title, stem: q.stem, figure: safeFigure(q.figure),
        marks: qMarks, awarded: qAwarded, correct: allCorrect && anyAnswered, unanswered: !anyAnswered, parts: partsOut, markingScheme: 'final-answer'
      };
    } else {
      const mainGiven = answers[qid];
      const useAlt = blank(mainGiven) && q.alt && !blank(answers[`${qid}::or`]);
      const chosen = useAlt ? { ...q.alt, subtopic: q.alt.subtopic || q.subtopic, difficulty: q.alt.difficulty || q.difficulty || 2 } : q;
      const given = useAlt ? answers[`${qid}::or`] : mainGiven;
      const working = useAlt ? workings[`${qid}::or`] : workings[qid];
      const r = markResponse(chosen, given, working, marking);
      if (!r.unanswered) {
        await recordIndiaExamEvidence(row, chosen, { correct: r.correct, given, ms, feedback: r.feedback });
      } else if (!row.answered) {
        row.answered = 1;
        await put('questions', row);
      }
      schemes[r.markingScheme] = (schemes[r.markingScheme] || 0) + 1;
      out = {
        ...base, prompt: chosen.prompt, answerType: chosen.answerType, mcqOptions: chosen.mcqOptions || null, matchList: chosen.matchList || null,
        figure: safeFigure(chosen.figure), choiceTaken: useAlt ? 'or' : (q.alt ? 'main' : null),
        given: blank(given) ? '' : String(given), correct: r.correct, unanswered: r.unanswered, feedback: r.feedback,
        marks: Number(marking.correct), negativeMarks: Math.abs(Number(marking.incorrect || 0)), awarded: r.awarded, partial: r.partial,
        working: blank(working) ? null : String(working), markingScheme: r.markingScheme, outcome: r.outcome || (r.unanswered ? 'unanswered' : r.correct ? 'correct' : 'wrong'),
        solution: solutionFor(chosen, Number(marking.correct), marking)
      };
    }

    score += out.awarded;
    total += out.marks;
    if (out.awarded < 0) negativeMarks += -out.awarded;
    bump(sections, row.indiaExamSection, sectionSeed(row), agg => tally(agg, out));
    bump(chapters, chapter?.id || row.subtopic, chapterSeed(chapter, row), agg => tally(agg, out));
    detail.push(out);
  }

  const pct = Math.round(1000 * score / Math.max(1, total)) / 10;
  const summary = {
    sections: [...sections.values()],
    chapters: [...chapters.values()].sort((a, b) => a.label.localeCompare(b.label)),
    negativeMarks,
    totalMs: totalMs || detail.reduce((n, d) => n + (d.ms || 0), 0),
    markingSchemes: schemes
  };
  exam.finishedAt = now;
  exam.score = score;
  exam.total = total;
  exam.detail = detail;
  exam.summary = summary;
  await put('exams', exam);
  const newBadges = await finishIndiaExamEvidence(Math.max(0, pct));
  return { score, total, pct, detail, summary, newBadges, indiaExam: exam.indiaExam };
}

// ── Printable paper ─────────────────────────────────────────────────────────

function printableSingle(q, marks, marking, finished) {
  const view = { prompt: q.prompt, answerType: q.answerType, mcqOptions: q.mcqOptions || null, matchList: q.matchList || null, figure: safeFigure(q.figure), answerPrefix: q.answerPrefix || null, answerSuffix: q.answerSuffix || null };
  return finished ? { ...view, answerText: answerText(q), steps: q.steps || [], criteria: criteriaFor(q, marks, marking) } : view;
}

async function paper(profile, id) {
  const exam = await requireExam(profile, id);
  const finished = !!exam.finishedAt;
  const questions = [];
  for (const qid of exam.questionIds || []) {
    const row = await get('questions', qid);
    if (!row) continue;
    const q = row.payload;
    const marking = row.examMarking || { correct: 1, incorrect: 0, unanswered: 0 };
    const chapter = indiaChapter(row.india?.chapterId);
    const marks = Number(marking.correct);
    const base = { section: row.indiaExamSection, sectionLabel: row.indiaExamSectionLabel, item: row.indiaExamItem, marks, negativeMarks: Math.abs(Number(marking.incorrect || 0)), subtopicName: chapter?.name || q.subtopic, difficulty: q.difficulty || row.difficulty };
    if (q.multipart) {
      questions.push({
        ...base, multipart: true, stem: q.stem, title: q.title, figure: safeFigure(q.figure),
        parts: (q.parts || []).map(pt => ({
          key: pt.key, marks: pt.marks, ...printableSingle(pt, pt.marks, { correct: pt.marks, incorrect: 0, unanswered: 0 }, finished),
          alt: pt.alt ? { key: pt.key, marks: pt.marks, ...printableSingle(pt.alt, pt.marks, { correct: pt.marks, incorrect: 0, unanswered: 0 }, finished) } : null
        })),
        criteria: finished ? (q.parts || []).map(pt => ({ mark: pt.marks, text: `Part (${pt.key})` })) : undefined
      });
      continue;
    }
    questions.push({
      ...base, ...printableSingle(q, marks, marking, finished),
      choice: q.alt ? printableSingle(q.alt, marks, marking, finished) : null
    });
  }
  return {
    title: exam.title,
    year: exam.year,
    durationMin: exam.durationMin,
    course: exam.indiaExam.label,
    questions,
    solutionsAvailable: finished,
    indiaExam: exam.indiaExam
  };
}

// ── Routing ─────────────────────────────────────────────────────────────────

export function indiaExamRoute(method, path) {
  if (path === '/exams' && (method === 'GET' || method === 'POST')) return true;
  return /^\/exams\/[^/]+(?:\/paper|\/submit)?$/.test(path) && (method === 'GET' || method === 'POST');
}

export async function dispatchIndiaExam(profile, method, path, body = {}) {
  if (!profile?.id || profile.course !== 'in') throw error('India exam routing requires an India profile.', 400, 'INDIA_PROFILE_REQUIRED');
  if (path === '/exams' && method === 'GET') return listExams(profile);
  if (path === '/exams' && method === 'POST') {
    // A JEE Advanced paper is JEE Advanced content, so it meets the track's own
    // gate before the free-simulation window is even consulted: a free profile
    // on that track is told the track is Premium, which is the true reason, and
    // not that it has used up a simulation it was never entitled to. The paper
    // is composed from `profile.indiaTrack`, so that — not the request — is what
    // decides. createIndiaExam() resolves the track the same way.
    if (cleanIndiaTrack(profile.indiaTrack || 'cbse', Number(profile.year)) === 'jee-advanced') {
      await requireCapability(profile, ENTITLEMENTS.JEE_ADVANCED);
    }
    // The free tier allows one exam simulation per 30 days; Premium lifts it.
    // Nothing is counted until a paper has actually been composed.
    await assertExamAllowed(profile);
    const created = await createIndiaExam(profile, body || {});
    await recordExamSimulation(profile);
    return { ...created, allowance: await examAllowance(profile) };
  }

  const m = path.match(/^\/exams\/([^/]+)(?:\/(paper|submit))?$/);
  if (!m) throw error('India exam route not found.', 404, 'INDIA_EXAM_ROUTE_NOT_FOUND');
  const [, id, action] = m;
  if (!action && method === 'GET') return getExam(profile, id);
  if (action === 'paper' && method === 'GET') return paper(profile, id);
  if (action === 'submit' && method === 'POST') return submitExam(profile, id, body || {});
  throw error('India exam method is not allowed.', 405, 'INDIA_EXAM_METHOD_NOT_ALLOWED');
}

export { JEE_MAIN_MATHEMATICS_2026 };
