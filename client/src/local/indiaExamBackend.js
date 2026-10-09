// Pri Learning · India exam backend
//
// This module is deliberately separate from local/backend.js's HSC-style paper
// generator. Indian profiles are routed here by api.js so an India exam can
// never accidentally append the legacy HSC multipart Section II.
//
// It composes a paper from a source-versioned blueprint (engine/indiaExams.js)
// through engine/indiaExamComposer.js to learn what the banks can supply, and
// sends only the paper's SPEC to the server, which chooses the questions,
// owns the marking grid (CBSE marks, JEE +4/−1/0 with Advanced partial
// marking, IOQM 2/3/5) and marks the paper (server/platform/exams.js; owner
// decision 2026-10-10). The device stores the public paper and the exam id,
// collects answers, and renders the server's result. Evidence for every
// attempted question is recorded through the ordinary path in backend.js so
// progress and the adaptive engine see it.
//
// NOTHING HERE MARKS AN ANSWER. A paper finished by an earlier app version
// still opens in review, labelled as marked by an earlier version; it is never
// shown as server-certified. A paper an earlier version started and did not
// finish cannot be marked at all.
import { get, put, del, byIndex } from './idb.js';
import { indiaScope, indiaChapter, cleanIndiaTrack } from '../engine/indiaProduct.js';
import { pyqAbsenceFor, PYQ_MANIFEST } from '../engine/pyq/pyqCoverage.js';
import { indiaPyqCells } from '../engine/indiaExamCells.js';
import { generateQuestion, loadBanksFor } from '../engine/generators/index.js';
import { sanitizeFigure } from '../lib/sanitize.js';
import {
  JEE_MAIN_MATHEMATICS_2026,
  indiaExamBlueprint,
  indiaExamPaperSpec,
  indiaExamClaim
} from '../engine/indiaExams.js';
import { composeIndiaPaper, composerNotes, answerText, paperSpecOf } from '../engine/indiaExamComposer.js';
import { examStepMeta, recordIndiaExamEvidence, finishIndiaExamEvidence, withExamLock } from './backend.js';
import { assertExamAllowed, examAllowance, recordExamSimulation, requireCapability } from './entitlementGate.js';
import { ENTITLEMENTS } from '../platform/entitlements.js';
import {
  startExamClock, ensureExamClock, saveExamResponses, isReplayOf, examSessionView
} from './examSession.js';
import { analyseExam } from './examAnalysis.js';
import {
  isServerPaper, markedByOf, requireExamAccount, issueServerExam, serverFieldOf, scheduleCheckpoint,
  finishOnServer, reconcileWithServer, noteReconciled, pendingView, localResult, serverFinal, localStartOf, finishedAtOf, fetchRemotePaper
} from './serverExam.js';

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
const objectiveTypes = new Set(['mcq', 'multi-mcq']);

// ── Public views ────────────────────────────────────────────────────────────

function publicSingle(q) {
  return {
    prompt: q.prompt, answerType: q.answerType, mcqOptions: q.mcqOptions || null, matchList: q.matchList || null,
    figure: safeFigure(q.figure), inputHint: q.inputHint || null, answerPrefix: q.answerPrefix || null, answerSuffix: q.answerSuffix || null,
    // A server-issued item says whether working can earn method marks; the
    // device has no step plan to ask. (A paper from an earlier version does.)
    supportsSteps: typeof q.supportsSteps === 'boolean' ? q.supportsSteps : (!objectiveTypes.has(q.answerType) && !!examStepMeta(q))
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
 * Two archives can contribute and both are used (engine/indiaExamCells.js).
 * Authored forms fill whatever the archives cannot, and the composer labels
 * every question with which of the two it was.
 */
async function pyqCellsByChapter(track, chapters) {
  const cells = indiaPyqCells(track, chapters);
  const generators = new Set([...cells.values()].flatMap(list => list.map(cell => cell.generator)));
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

/** The device's row for one server-issued question: the public payload and where it sits on the paper. */
function rowOf(pid, track, examId, sq, now, id = String(sq.id)) {
  return {
    id, pid, subtopic: sq.payload.subtopic || sq.generator, difficulty: sq.difficulty,
    // The public payload only: prompt, options, parts. No answer, step or trap.
    payload: sq.payload,
    india: { chapterId: sq.chapterId, track, dotpointIndex: null },
    mode: 'exam', examId, taskId: null, answered: 0, tries: 0, hintsUsed: 0, createdAt: now,
    indiaExamSection: sq.section, indiaExamSectionLabel: sq.sectionLabel, indiaExamItem: sq.item, examOrder: sq.order,
    examMarking: sq.marking, sourceKind: sq.pyq ? 'reviewed-jee-pyq' : 'authored-generator', conversion: sq.conversion,
    examServer: true
  };
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
  const count = (await byIndex('exams', 'pid', profile.id)).filter(e => e?.indiaExam?.blueprintId === spec.id).length;
  const title = titleFor(spec, count + 1);
  let seed = Number.isFinite(Number(body.seed)) && Number(body.seed) > 0 ? Math.floor(Number(body.seed)) & 0x7fffffff : randomSeed();
  let paper = null;
  let issued = null;
  // A spec the server cannot issue (a recipe whose bank came up short on its
  // own draws) is composed again from a fresh seed, twice, before the student
  // is told. Nothing is ever dropped from a paper to make it fit.
  for (let attempt = 0; attempt < 3 && !issued; attempt++) {
    if (attempt) seed = randomSeed();
    paper = composeIndiaPaper(spec, {
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

    // The device's own draws were only how it learnt what the banks can supply.
    // What goes to the server is the recipe of each item; the server chooses the
    // questions, and no answer to any of them comes back until it has marked.
    try {
      issued = await issueServerExam(profile.id, { ...paperSpecOf(paper, { track, grade, variant }), title },
        `india:${track}:${grade}:${variant}:${body.source === 'reviewed' ? 'reviewed' : 'any'}`,
        { seed, units: paper.units, composition: paper.composition, reducedPattern: paper.reducedPattern });
    } catch (err) {
      if (err?.code !== 'EXAM_CONTENT_UNSUPPORTED' || attempt === 2) throw err;
    }
  }

  const examId = String(issued.id);
  const questionIds = [];
  const created = [];
  const now = Date.now();
  try {
    for (const sq of issued.questions) {
      const row = rowOf(profile.id, track, examId, sq, now);
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

  // What the device knew about the spec the server actually issued from.
  const composed = issued.composed || { seed, units: paper.units, composition: paper.composition, reducedPattern: paper.reducedPattern };
  // What the paper is made of is counted from what the server issued.
  const tally = fn => issued.questions.filter(fn).length;
  const composition = {
    ...composed.composition,
    pyq: tally(q => q.pyq), authored: tally(q => !q.pyq),
    nativeMcq: tally(q => q.conversion === 'native-mcq'), numericToMcq: tally(q => q.conversion === 'numeric-to-mcq'),
    assertionReason: tally(q => q.item === 'assertion-reason'), caseStudy: tally(q => q.item === 'case-study'),
    multiCorrect: tally(q => q.item === 'multi-correct'), matrixMatch: tally(q => q.item === 'matrix-match'),
    internalChoice: tally(q => q.payload.alt || q.payload.parts?.some(part => part.alt))
  };
  const exam = {
    id: examId,
    pid: profile.id,
    year: profile.year,
    pathway: null,
    title,
    durationMin: issued.durationMin,
    questionIds,
    createdAt: now,
    finishedAt: null,
    score: null,
    total: issued.total,
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
      // The seed the device composed the SPEC from. The questions are the
      // server's; no seed on this device reproduces them.
      seed: composed.seed,
      sections: spec.sections.map(s => ({
        id: s.id, label: s.label || `Section ${s.id}`, questions: s.questions, marks: s.marks,
        marksEach: s.marksEach ?? s.correct, negative: Math.abs(Number(s.incorrect || 0)), partialPerOption: s.partialPerOption ?? null,
        types: s.types || [s.type]
      })),
      units: composed.units,
      // What this paper actually drew from the previous-year archive, and what
      // the archive holds. `absent` is present when the student's track is one
      // the archive deliberately carries nothing for, so an empty PYQ count is
      // a stated reason rather than a silence.
      pyq: {
        used: composition.pyq,
        questions: issued.questions.length,
        archive: PYQ_MANIFEST,
        absent: pyqAbsenceFor(track)
      },
      composition,
      reducedPattern: composed.reducedPattern,
      composerNotes: composerNotes(spec),
      sources: (spec.sources || []).map(s => ({ authority: s.authority, title: s.title, url: s.url }))
    },
    // The server's own immutable version of what is asked and how it is marked.
    paperVersion: issued.paperVersion,
    server: serverFieldOf(issued, await requireExamAccount(profile.id).catch(() => null))
  };
  // The clock starts when the paper exists: the room opens straight onto it.
  // The server keeps its own; this one is never later (serverExam.js).
  startExamClock(exam, localStartOf(issued));
  await put('exams', exam);
  noteReconciled(exam.id);
  return { exam: await examView(profile, exam.id) };
}

// ── Reads ───────────────────────────────────────────────────────────────────

async function requireExam(profile, id) {
  const exam = await get('exams', id);
  if (!exam || exam.pid !== profile.id || !exam.indiaExam) throw error('India exam not found.', 404, 'INDIA_EXAM_NOT_FOUND');
  return exam;
}

async function examView(profile, id) {
  let exam = await requireExam(profile, id);
  if (isServerPaper(exam) && exam.server.remote && exam.finishedAt) {
    await hydrateRemote(profile, id);
    exam = await requireExam(profile, id);
  }
  // An open paper the server owns is brought up to date with it first: a
  // queued finish is sent, a result produced on another device is adopted, a
  // newer snapshot replaces the local one. Unreachable server: local state stands.
  if (isServerPaper(exam) && (!exam.finishedAt || exam.server.restored)) {
    await withExamLock(id, async () => {
      const fresh = await requireExam(profile, id);
      if (fresh.finishedAt && !fresh.server.restored) return;
      const out = await reconcileWithServer(fresh, {
        rebuildRow: (sq, localId) => rowOf(profile.id, fresh.indiaExam?.track, fresh.id, sq, fresh.createdAt, localId)
      });
      if (out.result && !fresh.finishedAt) await adoptResult(fresh, out.result);
      else if (out.changed) await put('exams', fresh);
    });
    exam = await requireExam(profile, id);
  }
  // A paper stored before the deadline was recorded gets one now, from when it
  // was created, and keeps it.
  // One reading of the clock for the whole view, so what is stored and what
  // the room is told are the same instant.
  const viewedAt = Date.now();
  if (ensureExamClock(exam, viewedAt)) await put('exams', exam);
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
    analysis: exam.finishedAt && exam.detail ? analyseExam({ detail: exam.detail, indiaExam: exam.indiaExam }) : null,
    session: { ...examSessionView(exam, viewedAt), pending: pendingView(exam) },
    // Who marked a finished paper: the server, or an earlier app version on
    // this device. Only the first is a certified result.
    markedBy: markedByOf(exam),
    serverIssued: isServerPaper(exam),
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
      marked_by: markedByOf(e), pending: !!e.pendingFinish,
      indiaExam: e.indiaExam
    }))
  };
}

// ── Results ─────────────────────────────────────────────────────────────────
// The server marks (server/platform/exams.js). What follows stores its result
// and records the evidence it certifies; no answer is checked on this device.

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

function finalResult(exam, extra = {}) {
  const pct = Math.round(1000 * exam.score / Math.max(1, exam.total)) / 10;
  return {
    score: exam.score, total: exam.total, pct, detail: exam.detail, summary: exam.summary,
    analysis: analyseExam({ detail: exam.detail, indiaExam: exam.indiaExam }),
    final: { submittedAt: exam.final?.submittedAt ?? exam.finishedAt, finalisedBy: exam.final?.finalisedBy ?? null, late: !!exam.final?.late, paperVersion: exam.final?.paperVersion ?? null },
    markedBy: markedByOf(exam),
    indiaExam: exam.indiaExam,
    ...extra
  };
}

async function saveResponses(profile, id, body = {}) {
  const exam = await requireExam(profile, id);
  if (exam.finishedAt) throw error('This paper has been submitted — it can no longer change.', 409, 'INDIA_EXAM_ALREADY_SUBMITTED');
  if (exam.pendingFinish) throw error('This paper has been submitted and is waiting to be marked — it can no longer change.', 409, 'EXAM_SUBMITTED_PENDING');
  const saved = saveExamResponses(exam, body);
  await put('exams', exam);
  // The device copy is saved; the server's follows a moment later and is
  // retried until it lands. It never delays or fails this save.
  if (isServerPaper(exam)) scheduleCheckpoint(exam.id, body.urgent === true ? 0 : undefined);
  return { saved: true, ...saved, checkpoint: isServerPaper(exam) ? { savedRev: exam.server.savedRev || 0, savedAt: exam.server.savedAt || null } : null };
}

/**
 * Store the server's result on the paper and record the evidence it certifies.
 * Every attempt carries the attempt id the server gave it, so recording is
 * exactly-once on this device and is recognised when the same event is pulled
 * back through sync.
 */
async function adoptResult(exam, serverResult, { record = true } = {}) {
  const result = localResult(exam, serverResult);
  const detail = [];
  for (const d of result.detail) {
    const row = await get('questions', d.id);
    const chapter = indiaChapter(row?.india?.chapterId || d.chapterId);
    const out = {
      ...d, figure: safeFigure(d.figure),
      chapterId: chapter?.id || d.chapterId || null, subtopic: chapter?.id || d.subtopic, subtopicName: chapter?.name || d.subtopicName
    };
    if (out.parts) out.parts = out.parts.map(part => ({ ...part, figure: safeFigure(part.figure) }));
    detail.push(out);
    if (!row) continue;
    const q = row.payload || {};
    // `record: false` — a paper sat on another device: its evidence reaches
    // this one through the server's own graded-attempt events, once.
    if (!record) { /* store the solution below; record nothing */ } else if (d.multipart) {
      for (const part of d.parts || []) {
        if (part.unanswered || !part.attemptId) continue;
        const shown = (q.parts || []).find(x => String(x.key) === String(part.key));
        const chosen = part.choiceTaken === 'or' ? shown?.alt : shown;
        const synth = { ...(chosen || {}), prompt: part.prompt, answerType: part.answerType, subtopic: part.subtopic || q.subtopic, difficulty: part.difficulty || q.difficulty || 2 };
        await recordIndiaExamEvidence(row, synth, {
          correct: part.correct, given: part.given, ms: Math.round((d.ms || 0) / Math.max(1, d.parts.length)), feedback: part.feedback,
          evidenceKey: `part:${part.key}`, serverAttemptId: part.attemptId
        });
      }
    } else if (!d.unanswered && d.attemptId) {
      const chosen = d.choiceTaken === 'or' && q.alt ? { ...q.alt, subtopic: q.alt.subtopic || q.subtopic, difficulty: q.alt.difficulty || q.difficulty || 2 } : q;
      await recordIndiaExamEvidence(row, chosen, {
        correct: d.correct, given: d.given, ms: d.ms, feedback: d.feedback, evidenceKey: 'question', serverAttemptId: d.attemptId,
        trapWhy: !d.correct && d.feedback && (d.repairOpportunities || []).includes(d.feedback) ? d.feedback : null
      });
    }
    // The solution the result disclosed now lives with the question, for
    // History and the printable paper.
    const settled = (await get('questions', d.id)) || row;
    settled.answered = 1;
    settled.serverReceipt = d.multipart
      ? { authoritative: true, examId: exam.server.examId, parts: (d.parts || []).map(part => ({ key: part.key, answerText: part.answerText, steps: part.steps || [], attemptId: part.attemptId || null })) }
      : { authoritative: true, examId: exam.server.examId, attemptId: d.attemptId || null, solution: d.solution };
    await put('questions', settled);
  }
  // The server's time, and never earlier than a time this paper has already seen.
  exam.finishedAt = finishedAtOf(exam, result);
  exam.score = result.score;
  exam.total = result.total;
  exam.detail = detail;
  exam.summary = result.summary;
  exam.final = serverFinal(exam, { ...result, detail });
  delete exam.responses;
  delete exam.pendingFinish;
  await put('exams', exam);
  if (!record) return [];
  const pct = Math.round(1000 * exam.score / Math.max(1, exam.total)) / 10;
  return finishIndiaExamEvidence(Math.max(0, pct));
}

/**
 * A paper the server marked on another device reached this one as a result
 * only. Read its public questions and stored result back from the account so
 * it opens in review here. Nothing is marked and no evidence is recorded.
 */
async function hydrateRemote(profile, id) {
  await withExamLock(id, async () => {
    const exam = await requireExam(profile, id);
    const remote = await fetchRemotePaper(exam);
    if (!remote) return;
    const track = exam.indiaExam?.track || cleanIndiaTrack(profile.indiaTrack || 'cbse', Number(profile.year));
    const ids = [];
    for (const sq of remote.paper.questions) {
      const row = rowOf(profile.id, track, exam.id, sq, exam.createdAt);
      await put('questions', row);
      ids.push(row.id);
    }
    exam.questionIds = ids;
    exam.server = { ...exam.server, questionIds: ids.slice(), remote: false };
    exam.durationMin = remote.paper.durationMin;
    exam.paperVersion = remote.paper.paperVersion;
    const kept = exam.finishedAt;
    await adoptResult(exam, remote.result, { record: false });
    // History keeps the time the result event gave this paper.
    if (kept) { exam.finishedAt = kept; await put('exams', exam); }
  });
}

async function submitExam(profile, id, body = {}) {
  const exam = await requireExam(profile, id);
  // The same submission arriving twice — a retried request, a second tap that
  // raced the first — gets the frozen result back rather than a second mark.
  if (isReplayOf(exam, body)) return finalResult(exam, { replayed: true, newBadges: [] });
  if (exam.finishedAt) throw error('Exam already submitted.', 409, 'INDIA_EXAM_ALREADY_SUBMITTED');
  // A paper an earlier version of the app composed holds its answers on the
  // device. Marking is the server's alone now, and the server never issued it.
  if (!isServerPaper(exam)) {
    throw error('This paper was started in an earlier version of the app, so it cannot be marked. Start a new paper to be marked.', 409, 'EXAM_NOT_SERVER_ISSUED');
  }
  const out = await finishOnServer(exam, body, Date.now());
  if (out.pending) {
    // Queued: frozen on the device, unmarked, and no score exists yet.
    await put('exams', exam);
    return { ...out.pending, score: null, total: exam.total, detail: null, newBadges: [] };
  }
  const newBadges = await adoptResult(exam, out.result);
  return { ...finalResult(exam), newBadges };
}

// ── Printable paper ─────────────────────────────────────────────────────────

const printView = q => ({ prompt: q.prompt, answerType: q.answerType, mcqOptions: q.mcqOptions || null, matchList: q.matchList || null, figure: safeFigure(q.figure), answerPrefix: q.answerPrefix || null, answerSuffix: q.answerSuffix || null });

/** A paper from an earlier version holds its own solutions; print them as it always did. */
function printableLegacy(q, marks, marking, finished) {
  return finished ? { ...printView(q), answerText: answerText(q), steps: q.steps || [], criteria: criteriaFor(q, marks, marking) } : printView(q);
}

async function paper(profile, id) {
  const exam = await requireExam(profile, id);
  const finished = !!exam.finishedAt;
  const marked = new Map((exam.detail || []).map(d => [String(d.id), d]));
  const questions = [];
  for (const qid of exam.questionIds || []) {
    const row = await get('questions', qid);
    if (!row) continue;
    const q = row.payload;
    const marking = row.examMarking || { correct: 1, incorrect: 0, unanswered: 0 };
    const chapter = indiaChapter(row.india?.chapterId);
    const marks = Number(marking.correct);
    const base = { section: row.indiaExamSection, sectionLabel: row.indiaExamSectionLabel, item: row.indiaExamItem, marks, negativeMarks: Math.abs(Number(marking.incorrect || 0)), subtopicName: chapter?.name || q.subtopic, difficulty: q.difficulty || row.difficulty };
    // A server-issued paper prints its questions from the public payload and,
    // once marked, its solutions from the server's result — the only place
    // they exist on this device.
    const d = row.examServer ? marked.get(String(qid)) : null;
    if (q.multipart) {
      questions.push({
        ...base, multipart: true, stem: q.stem, title: q.title, figure: safeFigure(q.figure),
        parts: (q.parts || []).map(pt => {
          if (!row.examServer) {
            return {
              key: pt.key, marks: pt.marks, ...printableLegacy(pt, pt.marks, { correct: pt.marks, incorrect: 0, unanswered: 0 }, finished),
              alt: pt.alt ? { key: pt.key, marks: pt.marks, ...printableLegacy(pt.alt, pt.marks, { correct: pt.marks, incorrect: 0, unanswered: 0 }, finished) } : null
            };
          }
          const dp = (d?.parts || []).find(x => String(x.key) === String(pt.key));
          const solved = (which, fallback) => (finished && dp ? { answerText: dp.choices?.[which]?.answerText ?? fallback?.answerText ?? '', steps: dp.choices?.[which]?.steps || fallback?.steps || [] } : {});
          return {
            key: pt.key, marks: pt.marks, ...printView(pt), ...solved('main', dp?.choiceTaken === 'or' ? null : dp),
            alt: pt.alt ? { key: pt.key, marks: pt.marks, ...printView(pt.alt), ...solved('or', dp?.choiceTaken === 'or' ? dp : null) } : null
          };
        }),
        criteria: finished ? (q.parts || []).map(pt => ({ mark: pt.marks, text: `Part (${pt.key})` })) : undefined
      });
      continue;
    }
    if (!row.examServer) {
      questions.push({ ...base, ...printableLegacy(q, marks, marking, finished), choice: q.alt ? printableLegacy(q.alt, marks, marking, finished) : null });
      continue;
    }
    const solved = which => {
      const solution = d?.choices?.[which]?.solution || (which === (d?.choiceTaken === 'or' ? 'or' : 'main') ? d?.solution : null);
      return finished && solution ? { answerText: solution.answerText ?? '', steps: solution.steps || [], criteria: solution.criteria || [] } : {};
    };
    questions.push({ ...base, ...printView(q), ...solved('main'), choice: q.alt ? { ...printView(q.alt), ...solved('or') } : null });
  }
  return {
    title: exam.title,
    year: exam.year,
    durationMin: exam.durationMin,
    course: exam.indiaExam.label,
    questions,
    solutionsAvailable: finished,
    markedBy: markedByOf(exam),
    indiaExam: exam.indiaExam
  };
}

// ── Routing ─────────────────────────────────────────────────────────────────

export function indiaExamRoute(method, path) {
  if (path === '/exams' && (method === 'GET' || method === 'POST')) return true;
  return /^\/exams\/[^/]+(?:\/paper|\/submit|\/responses)?$/.test(path) && (method === 'GET' || method === 'POST');
}

export async function dispatchIndiaExam(profile, method, path, body = {}) {
  if (!profile?.id || profile.course !== 'in') throw error('India exam routing requires an India profile.', 400, 'INDIA_PROFILE_REQUIRED');
  if (path === '/exams' && method === 'GET') return listExams(profile);
  if (path === '/exams' && method === 'POST') {
    // A paper is marked work, so it starts only for a signed-in account: the
    // same refusal a practice check gives (SIGN_IN_TO_CHECK). Whether the
    // server can be reached, and whether the account is eligible, is answered
    // by the server itself when it is asked to issue the paper.
    await requireExamAccount(profile.id);
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

  const m = path.match(/^\/exams\/([^/]+)(?:\/(paper|submit|responses))?$/);
  if (!m) throw error('India exam route not found.', 404, 'INDIA_EXAM_ROUTE_NOT_FOUND');
  const [, id, action] = m;
  if (!action && method === 'GET') return getExam(profile, id);
  if (action === 'paper' && method === 'GET') return paper(profile, id);
  if (action === 'submit' && method === 'POST') return withExamLock(id, () => submitExam(profile, id, body || {}));
  if (action === 'responses' && method === 'POST') return withExamLock(id, () => saveResponses(profile, id, body || {}));
  throw error('India exam method is not allowed.', 405, 'INDIA_EXAM_METHOD_NOT_ALLOWED');
}

export { JEE_MAIN_MATHEMATICS_2026 };
