// Pri Learning — server-authoritative examination papers.
//
// Owner decision 2026-10-10: every student-facing mark is decided on the
// server, examination papers included. This router owns one paper from the
// moment it exists until its result is read back years later:
//
//   POST /v1/exams              the device sends a paper SPEC (which blueprint,
//                               which authored cells, in which order). The
//                               server validates it against its own copy of the
//                               blueprint and the track's authored cells,
//                               chooses every question itself with seeds the
//                               device never learns, and seals the questions,
//                               the marking grid, the start time and the
//                               deadline under a new exam id owned by the
//                               account. Only the public paper is returned.
//   PUT  /v1/exams/:id/answers  durable answer collection: the latest snapshot
//                               of what the student has entered, stamped with
//                               the server's time. Refused once the paper is
//                               finalised or its time (plus grace) has passed.
//   POST /v1/exams/:id/finish   exactly-once finalisation, in one transaction:
//                               every question is marked by the deterministic
//                               engine, one immutable result is written with
//                               one exam-level learning event and one
//                               graded-attempt event per attempted question.
//                               A replay returns the stored result unchanged.
//   GET  /v1/exams/:id          the owner reads the public paper and the saved
//                               snapshot while it is open, or the stored
//                               result once it is finished.
//
// THE DEADLINE. `deadline = startedAt + duration`, both the server's clock. A
// finish that arrives by `deadline + FINISH_GRACE_MS` (two minutes: the
// automatic submit at the bell, a slow connection, a device a little behind)
// is marked on the answers it carries. A finish that arrives later is marked
// ONLY on the last snapshot the server saved — which cannot be newer than
// `deadline + FINISH_GRACE_MS`, because saves are refused after it — and the
// result says `late: true`. A device that was offline at the bell keeps every
// answer it had checkpointed and can add none afterwards.
//
// WHAT NEVER LEAVES BEFORE FINALISATION. Answers, worked steps, traps,
// distractor explanations, step-check plans, seeds and marking criteria.
// `publicPayload()` is an allow-list; nothing else of a question is sent.
//
// A model never sets a mark here: there is no model in this file.
//
// Storage is the existing account-scoped idempotency_keys table (no schema
// change), under four scopes:
//   exam-create   Idempotency-Key → { examId }      a retried create
//   exam-paper    examId → the sealed paper          immutable
//   exam-answers  examId → the latest snapshot       replaced by each save
//   exam-result   examId → the immutable result      written once
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { asyncRouter } from './asyncRouter.js';
import { asStore } from './store.js';
import { nextSyncCursor, syncLockKey } from './db.js';
import { requireSession, requireVerifiedEmail, requireRole, rateLimit } from './security.js';
import { ensureBanks, chooseQuestion, stepMetaFor, answerTextFor } from './practice.js';
import { loadBanksFor } from '../../client/src/engine/generators/index.js';
import { generateMultipart } from '../../client/src/engine/generators/multipart.js';
import { checkAnswer, methodMarks } from '../../client/src/engine/checker.js';
import { makeRng } from '../../client/src/engine/qhelpers.js';
import { indiaExamPaperSpec, markObjective, markMultiCorrect } from '../../client/src/engine/indiaExams.js';
import { indiaIssuableCells } from '../../client/src/engine/indiaExamCells.js';
import {
  issueIndiaItem, recipeFitsSection, recipeCells, marking as sectionMarking, answerText as examAnswerText
} from '../../client/src/engine/indiaExamComposer.js';
import { stampExamItem } from '../../client/src/engine/contentIdentity.js';

/** How long after the deadline a finish may still carry its own answers. */
export const FINISH_GRACE_MS = 2 * 60 * 1000;
// A result is history a student returns to; it is kept well past a school year.
const RECORD_TTL = 5 * 365 * 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID = /^[a-zA-Z0-9_-]{8,100}$/;
const AUTHORED_BANK = /^[a-z][a-z0-9]{0,11}-[a-z0-9][a-z0-9-]{1,95}$/;
const MULTIPART_ID = /^[a-z][a-z0-9-]{1,60}$/;
const CHAPTER_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,95}$/;
const SECTION_ID = /^[A-Za-z0-9]{1,8}$/;
const PART_KEY = /^[a-z0-9]{1,8}$/i;
const TRACKS = ['cbse', 'jee-main', 'jee-advanced', 'olympiad'];
const NEEDS = ['mcq', 'numerical', 'integer99', 'written', 'any', 'facts', 'factsNoFigure'];
const PRACTICE_LENGTHS = [10, 15, 20];
const ISSUE_TRIES = 6;
const MAX_ANSWER = 4000;
const MAX_WORKING = 8000;
const MAX_KEYS = 400;
const MAX_MS = 24 * 60 * 60 * 1000;
const OBJECTIVE = new Set(['mcq', 'multi-mcq']);

const CREATE_FIELDS = new Set(['kind', 'title', 'blueprint', 'paper', 'slots']);
const SNAPSHOT_FIELDS = new Set(['answers', 'workings', 'times', 'modes', 'cur', 'rev']);
const FINISH_FIELDS = new Set(['answers', 'workings', 'times', 'modes', 'ms', 'reason', 'submissionKey']);

const digest = input => createHash('sha256').update(typeof input === 'string' ? input : JSON.stringify(input)).digest('hex');
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const unknown = (value, allowed) => Object.keys(value).filter(key => !allowed.has(key));
const limitedText = (s, n) => typeof s === 'string' && s.length <= n && !/[\u0000-\u0008\u000b\u000e-\u001f]/.test(s);
const blank = v => v === undefined || v === null || String(v).trim() === '';
const refusal = (status, code, message) => ({ refused: [status, code, message] });
const reject = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const notFound = res => reject(res, 404, 'EXAM_NOT_FOUND', 'This paper does not belong to this account.');

// ── The public paper ─────────────────────────────────────────────────────────

function publicSingle(q) {
  const out = { supportsSteps: !OBJECTIVE.has(q.answerType) && !!stepMetaFor(q) };
  for (const k of ['prompt', 'answerType', 'mcqOptions', 'options', 'matchList', 'figure', 'inputHint', 'answerPrefix', 'answerSuffix',
    'subtopic', 'difficulty', 'dotpoint', 'dotpoints', 'pyq', 'pyqSource', 'pyqYear', 'pyqExam', 'archive']) {
    if (q[k] !== undefined && q[k] !== null) out[k] = q[k];
  }
  return out;
}

/** Everything of a sealed question a student may see before the paper is marked. */
function publicPayload(q) {
  const identity = {};
  for (const k of ['contentId', 'contentVersion', 'contentHash', 'examItem']) if (q[k] !== undefined && q[k] !== null) identity[k] = q[k];
  if (q.multipart) {
    return {
      ...identity, multipart: true, title: q.title, stem: q.stem, ...(q.figure ? { figure: q.figure } : {}),
      totalMarks: q.totalMarks, subtopic: q.subtopic, difficulty: q.difficulty,
      ...(q.multipartId ? { multipartId: q.multipartId } : {}),
      ...(q.caseStudyMode ? { caseStudyMode: q.caseStudyMode } : {}),
      parts: (q.parts || []).map(part => ({
        key: part.key, marks: part.marks, ...publicSingle(part),
        alt: part.alt ? { key: part.key, marks: part.marks, ...publicSingle(part.alt) } : null
      }))
    };
  }
  return { ...identity, ...publicSingle(q), ...(q.alt ? { alt: publicSingle(q.alt) } : {}) };
}

function publicQuestion(sq) {
  return {
    id: sq.id, order: sq.order, section: sq.section, sectionLabel: sq.sectionLabel, item: sq.item,
    chapterId: sq.chapterId, chapterName: sq.chapterName, marking: sq.marking, marks: sq.marks,
    pyq: sq.pyq, conversion: sq.conversion, generator: sq.generator, difficulty: sq.difficulty,
    payload: publicPayload(sq.payload)
  };
}

function publicPaper(paper, now) {
  return {
    id: paper.id, kind: paper.kind, title: paper.title, durationMin: paper.durationMin,
    startedAt: paper.startedAt, deadline: paper.deadline, graceMs: FINISH_GRACE_MS,
    now, remainingMs: Math.max(0, paper.deadline - now),
    blueprint: paper.blueprint, paper: paper.paper, paperVersion: paper.paperVersion, total: paper.total,
    questions: paper.questions.map(publicQuestion)
  };
}

// ── Reading a paper spec ─────────────────────────────────────────────────────

function cleanCell(cell) {
  if (!plain(cell) || unknown(cell, new Set(['generator', 'difficulty', 'need'])).length) return null;
  if (typeof cell.generator !== 'string' || !AUTHORED_BANK.test(cell.generator)) return null;
  if (!Number.isInteger(cell.difficulty) || cell.difficulty < 1 || cell.difficulty > 4) return null;
  if (!NEEDS.includes(cell.need)) return null;
  return { generator: cell.generator, difficulty: cell.difficulty, need: cell.need };
}

function cleanRecipe(recipe) {
  if (!plain(recipe)) return null;
  if (recipe.kind === 'single') {
    if (unknown(recipe, new Set(['kind', 'cell', 'alt'])).length) return null;
    const cell = cleanCell(recipe.cell);
    const alt = recipe.alt == null ? null : cleanCell(recipe.alt);
    return cell && (recipe.alt == null || alt) ? { kind: 'single', cell, alt } : null;
  }
  if (recipe.kind === 'case-study') {
    if (unknown(recipe, new Set(['kind', 'choice', 'parts'])).length || !Array.isArray(recipe.parts) || recipe.parts.length > 6) return null;
    if (recipe.choice !== undefined && typeof recipe.choice !== 'boolean') return null;
    const parts = [];
    for (const part of recipe.parts) {
      if (!plain(part) || unknown(part, new Set(['cell', 'alt'])).length) return null;
      const cell = cleanCell(part.cell);
      const alt = part.alt == null ? null : cleanCell(part.alt);
      if (!cell || (part.alt != null && !alt)) return null;
      parts.push({ cell, alt });
    }
    return { kind: 'case-study', choice: recipe.choice === true, parts };
  }
  if (['assertion-reason', 'multi-correct', 'matrix-match'].includes(recipe.kind)) {
    if (unknown(recipe, new Set(['kind', 'cells'])).length || !Array.isArray(recipe.cells) || recipe.cells.length > 4) return null;
    const cells = recipe.cells.map(cleanCell);
    return cells.every(Boolean) ? { kind: recipe.kind, cells } : null;
  }
  return null;
}

const INVALID = (message = 'This paper specification is not valid.') => refusal(400, 'EXAM_SPEC_INVALID', message);

function readIndiaSpec(body) {
  if (body.paper !== undefined) return INVALID();
  const b = body.blueprint;
  if (!plain(b) || unknown(b, new Set(['track', 'grade', 'variant'])).length) return INVALID('Name the track, class and variant of the paper.');
  if (!TRACKS.includes(b.track) || !Number.isInteger(b.grade) || b.grade < 6 || b.grade > 12 || !['standard', 'basic'].includes(b.variant ?? 'standard')) {
    return INVALID('Name the track, class and variant of the paper.');
  }
  const variant = b.variant ?? 'standard';
  const spec = indiaExamPaperSpec({ track: b.track, grade: b.grade, variant });
  // A blueprint is released for one track; a selection that resolves to
  // another track's paper (a Class 9 "JEE" paper) is not that paper.
  if (!spec || spec.track !== b.track) return refusal(409, 'EXAM_BLUEPRINT_NOT_RELEASED', 'No examination blueprint is released for this selection.');
  const cells = indiaIssuableCells(b.track, b.grade);
  if (!cells) return refusal(409, 'EXAM_BLUEPRINT_NOT_RELEASED', 'No curriculum scope is released for this selection.');
  const expected = spec.sections.flatMap(section => Array.from({ length: section.questions }, () => section));
  if (!Array.isArray(body.slots) || body.slots.length !== expected.length) {
    return INVALID(`This paper has ${expected.length} questions.`);
  }
  const chapters = new Map(cells.chapters.map(chapter => [chapter.id, chapter]));
  const perSection = new Map();
  const slots = [];
  for (let i = 0; i < body.slots.length; i++) {
    const raw = body.slots[i];
    const section = expected[i];
    if (!plain(raw) || unknown(raw, new Set(['section', 'chapter', 'recipe'])).length) return INVALID(`Slot ${i + 1} is not valid.`);
    if (typeof raw.section !== 'string' || !SECTION_ID.test(raw.section) || raw.section !== String(section.id)) {
      return INVALID(`Slot ${i + 1} is not in the blueprint's section order.`);
    }
    if (typeof raw.chapter !== 'string' || !CHAPTER_ID.test(raw.chapter) || !chapters.has(raw.chapter)) {
      return INVALID(`Slot ${i + 1} names a chapter outside this track and class.`);
    }
    const recipe = cleanRecipe(raw.recipe);
    if (!recipe || !recipeFitsSection(section, recipe)) return INVALID(`Slot ${i + 1} is not an item this section sets.`);
    // Authored cells of this track and class only — never an arbitrary generator.
    if (!recipeCells(recipe).every(cell => cells.has(cell))) {
      return INVALID(`Slot ${i + 1} draws from a question bank outside this track and class.`);
    }
    const tally = perSection.get(section.id) || { assertionReason: 0, choice: 0 };
    if (recipe.kind === 'assertion-reason') tally.assertionReason++;
    if (recipe.alt || (recipe.parts || []).some(part => part.alt)) tally.choice++;
    perSection.set(section.id, tally);
    if (tally.assertionReason > (section.assertionReason || 0) || tally.choice > (section.internalChoice || 0)) {
      return INVALID(`Section ${section.id} does not set that many items of this kind.`);
    }
    slots.push({ section, chapter: chapters.get(raw.chapter), recipe });
  }
  return {
    kind: 'india', spec, cells, slots,
    durationMin: Number(spec.durationMinutes || spec.recommendedSectionMinutes || 60),
    blueprint: { id: spec.id, label: spec.label, track: b.track, grade: b.grade, variant },
    defaultTitle: spec.label
  };
}

function readPracticeSpec(body) {
  if (body.blueprint !== undefined) return INVALID();
  const p = body.paper;
  if (!plain(p) || unknown(p, new Set(['year', 'minutes', 'pathway'])).length) return INVALID('Name the year and length of the paper.');
  if (!Number.isInteger(p.year) || p.year < 7 || p.year > 12 || !Number.isInteger(p.minutes) || p.minutes < 10 || p.minutes > 90) {
    return INVALID('A practice paper is for Years 7–12 and runs 10–90 minutes.');
  }
  if (p.pathway !== undefined && p.pathway !== null && (typeof p.pathway !== 'string' || !/^[a-z0-9-]{1,24}$/.test(p.pathway))) return INVALID();
  if (!Array.isArray(body.slots) || body.slots.length < PRACTICE_LENGTHS[0] || body.slots.length > PRACTICE_LENGTHS.at(-1) + 1) {
    return INVALID('A practice paper has 10, 15 or 20 questions and at most one structured question.');
  }
  const slots = [];
  let structured = 0;
  for (let i = 0; i < body.slots.length; i++) {
    const raw = body.slots[i];
    if (!plain(raw)) return INVALID(`Slot ${i + 1} is not valid.`);
    if (raw.multipart !== undefined) {
      // The structured question closes the paper, as Section II.
      if (unknown(raw, new Set(['multipart'])).length || typeof raw.multipart !== 'string' || !MULTIPART_ID.test(raw.multipart)
          || i !== body.slots.length - 1 || ++structured > 1) return INVALID(`Slot ${i + 1} is not valid.`);
      slots.push({ multipart: raw.multipart });
      continue;
    }
    if (unknown(raw, new Set(['generator', 'difficulty'])).length || typeof raw.generator !== 'string' || !AUTHORED_BANK.test(raw.generator)
        || !Number.isInteger(raw.difficulty) || raw.difficulty < 1 || raw.difficulty > 4) return INVALID(`Slot ${i + 1} is not valid.`);
    slots.push({ generator: raw.generator, difficulty: raw.difficulty });
  }
  if (!PRACTICE_LENGTHS.includes(slots.length - structured)) return INVALID('A practice paper has 10, 15 or 20 questions and at most one structured question.');
  return {
    kind: 'practice-paper', slots, durationMin: p.minutes,
    paper: { year: p.year, minutes: p.minutes, pathway: p.pathway ?? null, length: slots.length - structured },
    defaultTitle: `Year ${p.year} Practice Paper`
  };
}

function readSpec(body) {
  if (!plain(body) || unknown(body, CREATE_FIELDS).length) return INVALID();
  if (body.title !== undefined && (!limitedText(body.title, 120) || !body.title.trim())) return INVALID('The paper title is not valid.');
  const read = body.kind === 'india' ? readIndiaSpec(body) : body.kind === 'practice-paper' ? readPracticeSpec(body) : INVALID('Name the kind of paper.');
  if (read.refused) return read;
  return { ...read, title: body.title ? body.title.trim() : read.defaultTitle };
}

// ── Issuing ──────────────────────────────────────────────────────────────────

const UNSUPPORTED = at => refusal(422, 'EXAM_CONTENT_UNSUPPORTED',
  `Question ${at} of this paper cannot be issued from the authored banks right now. Nothing was started.`);

/** A practice-rubric mark count: the authored key steps, at most four. */
function practiceMarks(q) {
  const keySteps = (q.steps || []).filter(step => !/^(check|note|bonus)/i.test(step.h));
  return Math.max(1, Math.min(Math.min(4, Math.max(1, Number(q.difficulty) || 1)), keySteps.length || 1));
}

async function issueQuestions(read) {
  await ensureBanks();
  const nonce = randomInt(0x7fffffff);
  const questions = [];
  const seal = (extra, payload) => {
    const order = questions.length + 1;
    questions.push({
      id: randomUUID(), order, ...extra,
      payload: stampExamItem(payload, { blueprintId: read.blueprint?.id || 'practice-paper', paperSeed: nonce, order })
    });
  };
  // The server chooses every question: the same chooser practice uses, with no
  // seed from the caller.
  const draw = (generator, difficulty) => chooseQuestion({ generator, difficulty, avoid: new Set(), trap: null }).q;

  if (read.kind === 'india') {
    // Reviewed previous-year banks are loaded on demand, by generator.
    try { await loadBanksFor([...new Set(read.slots.flatMap(slot => recipeCells(slot.recipe).map(cell => cell.generator)))]); }
    catch { return UNSUPPORTED(1); }
    const ctx = { rng: makeRng(randomInt(0x7fffffff) || 1), draw, seen: new Set(), isPyq: read.cells.isPyq };
    for (const slot of read.slots) {
      let built = null;
      for (let attempt = 0; attempt < ISSUE_TRIES && !built; attempt++) {
        try { built = issueIndiaItem(slot.section, slot.recipe, ctx, { chapterName: slot.chapter.name }); }
        catch { built = null; }
      }
      if (!built) return UNSUPPORTED(questions.length + 1);
      const grid = sectionMarking(slot.section);
      seal({
        section: String(slot.section.id), sectionLabel: slot.section.label || `Section ${slot.section.id}`, item: built.item,
        chapterId: slot.chapter.id, chapterName: slot.chapter.name, marking: grid, marks: grid.correct,
        pyq: built.pyq === true, conversion: built.conversion || null, generator: built.generator, difficulty: built.difficulty
      }, { ...built.payload, examItem: built.item });
    }
    return { questions };
  }

  for (const slot of read.slots) {
    if (slot.multipart) {
      let mp;
      try { mp = generateMultipart(slot.multipart, randomInt(0x7fffffff)); } catch { return UNSUPPORTED(questions.length + 1); }
      const parts = (mp.parts || []).map(part => ({ ...part, marks: Math.max(1, Number(part.marks) || 1) }));
      if (!parts.length) return UNSUPPORTED(questions.length + 1);
      const total = parts.reduce((n, part) => n + part.marks, 0);
      seal({
        section: 'II', sectionLabel: 'Section II', item: 'structured', chapterId: null, chapterName: mp.title || null,
        marking: { correct: total, incorrect: 0, unanswered: 0, partialPerOption: null }, marks: total,
        pyq: false, conversion: null, generator: slot.multipart, difficulty: 3
      }, { ...mp, parts, multipart: true, totalMarks: total, subtopic: mp.subtopic || slot.multipart, examItem: 'structured' });
      continue;
    }
    let q;
    try { q = draw(slot.generator, slot.difficulty); } catch { return UNSUPPORTED(questions.length + 1); }
    if (!q?.prompt) return UNSUPPORTED(questions.length + 1);
    const marks = practiceMarks(q);
    seal({
      section: 'I', sectionLabel: 'Section I', item: 'question', chapterId: null, chapterName: null,
      marking: { correct: marks, incorrect: 0, unanswered: 0, partialPerOption: null }, marks,
      pyq: q.pyq === true, conversion: null, generator: slot.generator, difficulty: q.difficulty || slot.difficulty
    }, { ...q, examItem: 'question' });
  }
  return { questions };
}

// ── Reading answers ──────────────────────────────────────────────────────────

/** Which answer keys a paper owns: `qid`, `qid::or`, `qid::part`, `qid::part::or`. */
function answerKeysOf(paper) {
  const keys = new Set();
  for (const sq of paper.questions) {
    const q = sq.payload;
    if (q.multipart) {
      for (const part of q.parts || []) {
        keys.add(`${sq.id}::${part.key}`);
        if (part.alt) keys.add(`${sq.id}::${part.key}::or`);
      }
    } else {
      keys.add(sq.id);
      if (q.alt) keys.add(`${sq.id}::or`);
    }
  }
  return keys;
}

/** A text map over the paper's own keys, or null when it is not one. */
function readTextMap(map, keys, max) {
  if (map === undefined || map === null) return {};
  if (!plain(map)) return null;
  const entries = Object.entries(map);
  if (entries.length > MAX_KEYS) return null;
  const out = {};
  for (const [key, value] of entries) {
    if (!keys.has(key)) return null;
    if (value === null || value === undefined || value === '') continue;
    if (!limitedText(value, max)) return null;
    out[key] = value;
  }
  return out;
}

function readTimes(map, paper) {
  if (map === undefined || map === null) return {};
  if (!plain(map)) return null;
  const ids = new Set(paper.questions.map(sq => sq.id));
  const out = {};
  for (const [key, value] of Object.entries(map)) {
    if (!ids.has(key) || typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
    out[key] = Math.min(Math.round(value), MAX_MS);
  }
  return out;
}

function readModes(map, keys) {
  if (map === undefined || map === null) return {};
  if (!plain(map) || Object.keys(map).length > MAX_KEYS) return null;
  const out = {};
  for (const [key, value] of Object.entries(map)) {
    if (!keys.has(key) || (value !== 'ink' && value !== 'type')) return null;
    out[key] = value;
  }
  return out;
}

/** What a snapshot or a finish carries, cleaned; null when any of it is malformed. */
function readResponses(body, paper) {
  const keys = answerKeysOf(paper);
  const answers = readTextMap(body.answers, keys, MAX_ANSWER);
  const workings = readTextMap(body.workings, keys, MAX_WORKING);
  const times = readTimes(body.times, paper);
  const modes = readModes(body.modes, keys);
  return answers && workings && times && modes ? { answers, workings, times, modes } : null;
}

// ── Marking ──────────────────────────────────────────────────────────────────

function criteriaFor(q, marks, grid) {
  if (OBJECTIVE.has(q.answerType) || (grid.incorrect || 0) < 0) {
    const negative = Math.abs(Number(grid.incorrect || 0));
    return [{ mark: marks, text: `Correct response +${marks}${negative ? ` · incorrect response −${negative}` : ''} · unanswered ${grid.unanswered || 0}` }];
  }
  const key = (q.steps || []).filter(s => s?.h && !/^(check|note|bonus)/i.test(s.h)).slice(0, marks);
  if (!key.length) return [{ mark: marks, text: 'Correct final answer' }];
  return key.map((s, i) => ({
    mark: i === key.length - 1 ? marks - (key.length - 1) : 1,
    text: i === key.length - 1 ? `${s.h} — leading to the correct answer` : s.h
  }));
}

const keyedAnswer = q => (q.answerType === 'multi-mcq' ? examAnswerText(q) : (answerTextFor(q) || examAnswerText(q)));
const solutionOf = (q, marks, grid) => ({ steps: q.steps || [], answerText: keyedAnswer(q), criteria: criteriaFor(q, marks, grid) });

/**
 * Mark one response under a marking grid, with the deterministic engine only.
 * Blank earns the grid's unanswered mark. A wrong written answer that comes
 * with working earns method marks by the same rule practice uses
 * (methodMarks: a restated question earns nothing; capped one below full
 * marks). Objective and negatively marked items never earn method marks.
 */
export function markResponse(q, given, working, grid) {
  const marks = Number(grid.correct);
  const objective = OBJECTIVE.has(q.answerType);
  if (blank(given)) {
    return { unanswered: true, correct: false, awarded: markObjective(grid, { unanswered: true }), feedback: 'Not attempted.', partial: null,
      markingScheme: objective ? 'objective' : 'final-answer', outcome: 'unanswered' };
  }
  if (q.answerType === 'multi-mcq') {
    const chosen = String(given).split(/[,\s]+/).map(s => s.trim()).filter(Boolean).map(Number).filter(Number.isInteger);
    const r = markMultiCorrect(grid, chosen, q.answer?.correctIndices || []);
    const note = r.outcome === 'partial'
      ? `+${r.awarded}: every option you chose is correct, but not all correct options were chosen.`
      : r.outcome === 'wrong' ? `${r.awarded}: at least one chosen option is wrong.` : '';
    return { unanswered: false, correct: r.outcome === 'full', awarded: r.awarded, feedback: note,
      partial: r.outcome === 'partial' ? { awarded: r.awarded, note } : null, markingScheme: 'objective-partial',
      outcome: r.outcome === 'full' ? 'correct' : r.outcome };
  }
  let result;
  try { result = checkAnswer(q, given); } catch { result = { correct: false }; }
  const correct = result.correct === true;
  let awarded = markObjective(grid, { unanswered: false, correct });
  let feedback = String(result.feedback || '');
  if (!correct && q.answerType === 'mcq' && q.answer?.optionTraps?.[Number(given)]) feedback = String(q.answer.optionTraps[Number(given)]);
  let partial = null;
  let markingScheme = objective || (grid.incorrect || 0) < 0 || marks <= 1 ? 'objective' : 'final-answer';
  if (!correct && markingScheme === 'final-answer' && !blank(working)) {
    const meta = stepMetaFor(q);
    if (meta) {
      try {
        const method = methodMarks({ meta, working: String(working), marks, prompt: q.prompt });
        if (method && method.awarded > 0) {
          awarded = Math.max(0, Math.min(marks - 1, method.awarded));
          partial = { okLines: method.okLines, awarded, note: method.note };
        }
        markingScheme = 'step-marked';
      } catch { /* the final-answer mark stands */ }
    }
  }
  return { unanswered: false, correct, awarded, feedback: feedback.slice(0, 3000), partial, markingScheme,
    outcome: correct ? 'correct' : 'wrong' };
}

/** Mark the whole paper. Pure: the sealed paper and the responses in, the result body out. */
export function markPaper(paper, responses, { now, totalMs }) {
  const { answers, workings, times, modes } = responses;
  const timed = Object.keys(times).length > 0;
  const nQ = Math.max(1, paper.questions.length);
  const detail = [];
  const attempts = [];
  const sections = new Map();
  const chapters = new Map();
  const schemes = {};
  let score = 0, total = 0, negativeMarks = 0;
  const seed = (id, label) => ({ id, label, questions: 0, attempted: 0, correct: 0, incorrect: 0, partial: 0, unanswered: 0, marks: 0, awarded: 0, negative: 0, ms: 0 });
  const tally = (map, key, label, out) => {
    const agg = map.get(key) || seed(key, label);
    agg.questions++; agg.marks += out.marks; agg.awarded += out.awarded; agg.ms += out.ms;
    if (out.unanswered) agg.unanswered++;
    else { agg.attempted++; if (out.correct) agg.correct++; else if (out.awarded > 0) agg.partial++; else agg.incorrect++; }
    if (out.awarded < 0) agg.negative += -out.awarded;
    map.set(key, agg);
  };
  const inputMode = key => (modes[key] === 'ink' ? 'ink' : 'typed');
  const attempt = (sq, q, r, extra) => {
    const attemptId = randomUUID();
    attempts.push({
      attemptId, questionId: sq.id, examId: paper.id, correct: r.correct === true,
      marksEarned: r.awarded, marksPossible: extra.marks,
      contentId: q.contentId || sq.payload.contentId || null,
      subtopic: q.subtopic || sq.payload.subtopic || sq.generator, difficulty: Number(q.difficulty || sq.difficulty) || 2,
      ...(sq.chapterId ? { chapterId: sq.chapterId } : {}),
      ...(extra.part ? { part: extra.part } : {}),
      mode: 'exam', inputMode: extra.inputMode, ms: extra.ms,
      // An examination paper has no hint, tutor or second try on the server:
      // nothing here can have helped, so the evidence is independent.
      hintsUsed: 0, support: 'independent', createdAt: now, serverAcknowledgedAt: now
    });
    return attemptId;
  };

  for (const sq of paper.questions) {
    const q = sq.payload;
    const ms = timed ? Math.max(0, Number(times[sq.id]) || 0) : Math.round(totalMs / nQ);
    const base = {
      id: sq.id, order: sq.order, section: sq.section, sectionLabel: sq.sectionLabel, item: sq.item,
      chapterId: sq.chapterId, subtopic: sq.chapterId || q.subtopic, subtopicName: sq.chapterName || q.title || q.subtopic,
      generator: sq.generator, difficulty: q.difficulty || sq.difficulty || 2, ms, timed,
      sourceKind: sq.pyq ? 'reviewed-jee-pyq' : 'authored-generator', contentId: q.contentId || null
    };
    let out;
    if (q.multipart) {
      const partsOut = [];
      let qMarks = 0, qAwarded = 0, allCorrect = true, anyAnswered = false;
      const parts = q.parts || [];
      for (const part of parts) {
        const mainKey = `${sq.id}::${part.key}`;
        const useAlt = blank(answers[mainKey]) && part.alt && !blank(answers[`${mainKey}::or`]);
        const key = useAlt ? `${mainKey}::or` : mainKey;
        const chosen = useAlt ? part.alt : part;
        const synth = { ...chosen, subtopic: chosen.subtopic || q.subtopic, difficulty: chosen.difficulty || q.difficulty || 2 };
        const grid = { correct: part.marks, incorrect: 0, unanswered: 0 };
        const r = markResponse(synth, answers[key], workings[key], grid);
        qMarks += part.marks; qAwarded += r.awarded;
        if (!r.correct) allCorrect = false;
        let attemptId = null;
        if (!r.unanswered) {
          anyAnswered = true;
          // A blueprint case study is chaptered sub-questions: each part is its
          // own evidence. A structured Section II question is one piece of work
          // with no single subtopic, so it is recorded on the paper only.
          if (paper.kind === 'india') {
            attemptId = attempt(sq, synth, r, { marks: part.marks, part: String(part.key), inputMode: inputMode(key), ms: Math.round(ms / Math.max(1, parts.length)) });
          }
        }
        schemes[r.markingScheme] = (schemes[r.markingScheme] || 0) + 1;
        partsOut.push({
          key: part.key, prompt: chosen.prompt, answerType: chosen.answerType, mcqOptions: chosen.mcqOptions || null,
          figure: chosen.figure || null, choiceTaken: useAlt ? 'or' : (part.alt ? 'main' : null),
          given: blank(answers[key]) ? '' : String(answers[key]), correct: r.correct, unanswered: r.unanswered,
          marks: part.marks, awarded: r.awarded, feedback: r.feedback, partial: r.partial, markingScheme: r.markingScheme,
          working: blank(workings[key]) ? null : String(workings[key]),
          answerText: keyedAnswer(chosen), steps: chosen.steps || [], subtopic: synth.subtopic, difficulty: synth.difficulty, attemptId
        });
      }
      out = {
        ...base, multipart: true, title: q.title, stem: q.stem, figure: q.figure || null,
        marks: qMarks, awarded: qAwarded, correct: allCorrect && anyAnswered, unanswered: !anyAnswered, parts: partsOut,
        markingScheme: 'final-answer', outcome: !anyAnswered ? 'unanswered' : allCorrect ? 'correct' : 'wrong'
      };
    } else {
      const useAlt = blank(answers[sq.id]) && q.alt && !blank(answers[`${sq.id}::or`]);
      const key = useAlt ? `${sq.id}::or` : sq.id;
      const chosen = useAlt ? { ...q.alt, subtopic: q.alt.subtopic || q.subtopic, difficulty: q.alt.difficulty || q.difficulty || 2 } : q;
      const r = markResponse(chosen, answers[key], workings[key], sq.marking);
      const marks = Number(sq.marking.correct);
      const attemptId = r.unanswered ? null : attempt(sq, chosen, r, { marks, inputMode: inputMode(key), ms });
      schemes[r.markingScheme] = (schemes[r.markingScheme] || 0) + 1;
      out = {
        ...base, prompt: chosen.prompt, answerType: chosen.answerType, mcqOptions: chosen.mcqOptions || null, matchList: chosen.matchList || null,
        figure: chosen.figure || null, choiceTaken: useAlt ? 'or' : (q.alt ? 'main' : null),
        given: blank(answers[key]) ? '' : String(answers[key]), correct: r.correct, unanswered: r.unanswered, feedback: r.feedback,
        marks, negativeMarks: Math.abs(Number(sq.marking.incorrect || 0)), awarded: r.awarded, partial: r.partial,
        working: blank(workings[key]) ? null : String(workings[key]), markingScheme: r.markingScheme, outcome: r.outcome,
        solution: solutionOf(chosen, marks, sq.marking), attemptId,
        // Authored distractor explanations, disclosed only now: the device
        // derives misconception identity from these, never from an answer key.
        repairOpportunities: [...new Set([
          ...(Array.isArray(chosen.traps) ? chosen.traps : []).map(t => t?.why),
          ...Object.values(chosen.answer?.optionTraps || {})
        ].filter(why => typeof why === 'string' && why))].slice(0, 40)
      };
    }
    score += out.awarded; total += out.marks;
    if (out.awarded < 0) negativeMarks += -out.awarded;
    tally(sections, sq.section, sq.sectionLabel, out);
    tally(chapters, sq.chapterId || q.subtopic || sq.generator, sq.chapterName || q.title || q.subtopic || sq.generator, out);
    detail.push(out);
  }
  return {
    score, total, pct: Math.round(1000 * score / Math.max(1, total)) / 10, detail, attempts,
    summary: {
      sections: [...sections.values()],
      chapters: [...chapters.values()].sort((a, b) => String(a.label).localeCompare(String(b.label))),
      negativeMarks, totalMs: totalMs || detail.reduce((n, d) => n + (d.ms || 0), 0), markingSchemes: schemes
    }
  };
}

// ── Router ───────────────────────────────────────────────────────────────────

const SELECT = "SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope=? AND key=? AND expires_at>?";
const INSERT = 'INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,?,?,?,?,?,?)';

export function createExamRouter(db) {
  db = asStore(db);
  const router = asyncRouter();
  router.use(requireSession(db), requireVerifiedEmail, requireRole('student'));
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  const read = async (accountId, scope, key, now) => {
    const row = await db.get(SELECT, [accountId, scope, key, now]);
    return row ? JSON.parse(row.response_json) : null;
  };

  router.post('/', rateLimit(db, 'exam-create', { limit: 30, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const idem = String(req.get('idempotency-key') || '');
    if (!ID.test(idem)) return reject(res, 400, 'IDEMPOTENCY_KEY_REQUIRED', 'Starting a paper needs a stable idempotency key.');
    const spec = readSpec(req.body);
    if (spec.refused) return reject(res, ...spec.refused);
    const accountId = req.platformSession.account_id;
    const requestDigest = digest(req.body);
    const before = await db.get("SELECT response_json,request_digest FROM idempotency_keys WHERE account_id=? AND scope='exam-create' AND key=? AND expires_at>?",
      [accountId, idem, Date.now()]);
    const replay = async row => {
      if (row.request_digest !== requestDigest) return reject(res, 409, 'IDEMPOTENCY_KEY_REUSED', 'This key already started a different paper.');
      const now = Date.now();
      const paper = await read(accountId, 'exam-paper', JSON.parse(row.response_json).examId, now);
      if (!paper) return notFound(res);
      return res.status(201).json({ exam: publicPaper(paper, now), accountId: String(accountId), replayed: true });
    };
    if (before) return replay(before);

    // Questions are chosen before the transaction: no generator runs while a
    // database lock is held.
    const issued = await issueQuestions(spec);
    if (issued.refused) return reject(res, ...issued.refused);
    const id = randomUUID();
    const startedAt = Date.now();
    const paper = {
      v: 1, id, kind: spec.kind, title: spec.title, durationMin: spec.durationMin,
      startedAt, deadline: startedAt + spec.durationMin * 60000,
      blueprint: spec.blueprint || null, paper: spec.paper || null,
      total: issued.questions.reduce((n, sq) => n + Number(sq.marks), 0),
      questions: issued.questions
    };
    // The immutable version of what is asked and how it is marked.
    paper.paperVersion = `sv1-${digest(issued.questions.map(sq => [sq.payload, sq.marking])).slice(0, 24)}-${issued.questions.length}`;
    const sealed = JSON.stringify(paper);
    const outcome = await db.transaction(async () => {
      const raced = await db.get("SELECT response_json,request_digest FROM idempotency_keys WHERE account_id=? AND scope='exam-create' AND key=? AND expires_at>?",
        [accountId, idem, startedAt]);
      if (raced) return { raced };
      await db.run(INSERT, [accountId, 'exam-paper', id, sealed, digest(sealed), startedAt, startedAt + RECORD_TTL]);
      await db.run(INSERT, [accountId, 'exam-create', idem, JSON.stringify({ examId: id }), requestDigest, startedAt, startedAt + RECORD_TTL]);
      return {};
    }, { accountScope: accountId, lock: 'exam-create:' + accountId });
    if (outcome.raced) return replay(outcome.raced);
    return res.status(201).json({ exam: publicPaper(paper, startedAt), accountId: String(accountId) });
  });

  router.put('/:id/answers', rateLimit(db, 'exam-answers', { limit: 1800, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const id = String(req.params.id || '');
    if (!UUID.test(id)) return notFound(res);
    const accountId = req.platformSession.account_id;
    const body = req.body;
    const outcome = await db.transaction(async () => {
      const now = Date.now();
      const paper = await read(accountId, 'exam-paper', id, now);
      if (!paper) return { status: 404 };
      if (!plain(body) || unknown(body, SNAPSHOT_FIELDS).length || !Number.isSafeInteger(body.rev) || body.rev < 0
          || (body.cur !== undefined && (!Number.isInteger(body.cur) || body.cur < 0 || body.cur > 500))) {
        return { status: 400, code: 'EXAM_ANSWERS_INVALID', message: 'Send the current answers, working and times for this paper only.' };
      }
      const responses = readResponses(body, paper);
      if (!responses) return { status: 400, code: 'EXAM_ANSWERS_INVALID', message: 'Send the current answers, working and times for this paper only.' };
      if (await db.get("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='exam-result' AND key=?", [accountId, id])) {
        return { status: 409, code: 'EXAM_FINALISED', message: 'This paper has been submitted — it can no longer change.' };
      }
      if (now > paper.deadline + FINISH_GRACE_MS) {
        return { status: 409, code: 'EXAM_DEADLINE_PASSED', message: 'Time is up on this paper — nothing more can be saved to it.' };
      }
      const prior = await read(accountId, 'exam-answers', id, now);
      const timing = { now, deadline: paper.deadline, remainingMs: Math.max(0, paper.deadline - now) };
      // A retried older save must never replace a newer one.
      if (prior && Number(prior.rev) >= body.rev) return { reply: { saved: false, stale: true, rev: prior.rev, savedAt: prior.savedAt, ...timing } };
      const snapshot = { ...responses, cur: body.cur ?? 0, rev: body.rev, savedAt: now };
      const json = JSON.stringify(snapshot);
      await db.run(INSERT + ' ON CONFLICT(account_id,scope,key) DO UPDATE SET response_json=excluded.response_json, request_digest=excluded.request_digest',
        [accountId, 'exam-answers', id, json, digest(json), now, now + RECORD_TTL]);
      return { reply: { saved: true, rev: body.rev, savedAt: now, ...timing } };
    }, { accountScope: accountId, lock: syncLockKey(accountId) });
    if (outcome.status === 404) return notFound(res);
    if (outcome.status) return reject(res, outcome.status, outcome.code, outcome.message);
    return res.status(200).json(outcome.reply);
  });

  router.post('/:id/finish', rateLimit(db, 'exam-finish', { limit: 120, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const id = String(req.params.id || '');
    if (!UUID.test(id)) return notFound(res);
    const accountId = req.platformSession.account_id;
    const body = req.body ?? {};
    const outcome = await db.transaction(async () => {
      const now = Date.now();
      const paper = await read(accountId, 'exam-paper', id, now);
      if (!paper) return { status: 404 };
      // Replay first: the reply to a finish that committed before a timeout
      // stays available, whatever the retry carries.
      const stored = await read(accountId, 'exam-result', id, now);
      if (stored) return { result: stored };
      if (!plain(body) || unknown(body, FINISH_FIELDS).length
          || (body.reason !== undefined && body.reason !== 'student' && body.reason !== 'deadline')
          || (body.submissionKey !== undefined && !(typeof body.submissionKey === 'string' && ID.test(body.submissionKey)))
          || (body.ms !== undefined && (typeof body.ms !== 'number' || !Number.isFinite(body.ms) || body.ms < 0))) {
        return { status: 400, code: 'EXAM_FINISH_INVALID', message: 'Send the answers for this paper only.' };
      }
      const carried = readResponses(body, paper);
      if (!carried) return { status: 400, code: 'EXAM_FINISH_INVALID', message: 'Send the answers for this paper only.' };
      const snapshot = await read(accountId, 'exam-answers', id, now);
      const inTime = now <= paper.deadline + FINISH_GRACE_MS;
      const saved = snapshot
        ? { answers: snapshot.answers || {}, workings: snapshot.workings || {}, times: snapshot.times || {}, modes: snapshot.modes || {} }
        : { answers: {}, workings: {}, times: {}, modes: {} };
      // In time: what the request carries, falling back to the snapshot for
      // anything it left out. Late: only what the server had already saved.
      const responses = inTime ? {
        answers: body.answers === undefined || body.answers === null ? saved.answers : carried.answers,
        workings: body.workings === undefined || body.workings === null ? saved.workings : carried.workings,
        times: body.times === undefined || body.times === null ? saved.times : carried.times,
        modes: body.modes === undefined || body.modes === null ? saved.modes : carried.modes
      } : saved;
      const elapsed = Math.max(0, Math.min(now, paper.deadline) - paper.startedAt);
      const totalMs = inTime && body.ms > 0 ? Math.min(Math.round(body.ms), MAX_MS) : elapsed;
      const marked = markPaper(paper, responses, { now, totalMs });
      const result = {
        authoritative: true, examId: id, kind: paper.kind, title: paper.title,
        blueprint: paper.blueprint, paper: paper.paper, paperVersion: paper.paperVersion,
        startedAt: paper.startedAt, deadline: paper.deadline, finishedAt: now, serverAcknowledgedAt: now,
        late: !inTime, finalisedBy: inTime ? (body.reason === 'deadline' ? 'deadline' : 'student') : 'deadline',
        inputSource: inTime ? 'submission' : 'server-snapshot-before-deadline',
        snapshotSavedAt: snapshot?.savedAt ?? null,
        submissionKey: typeof body.submissionKey === 'string' ? body.submissionKey : null,
        score: marked.score, total: marked.total, pct: marked.pct, detail: marked.detail, summary: marked.summary
      };
      const json = JSON.stringify(result);
      await db.run(INSERT, [accountId, 'exam-result', id, json, digest(json), now, now + RECORD_TTL]);
      // Progress is committed in the same transaction as the immutable result.
      const last = await db.get("SELECT MAX(device_seq) AS n FROM learning_events WHERE account_id=? AND device_id='server-grader'", [accountId]);
      let seq = Number(last?.n || 0);
      const event = async (eventId, kind, entityId, payload) => {
        const cursor = await nextSyncCursor(db, accountId);
        await db.run("INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at) VALUES (?,?,?, 'server-grader',?,?,?,?,?,?)",
          [cursor, eventId, accountId, ++seq, kind, entityId, now, JSON.stringify(payload), now]);
      };
      for (const a of marked.attempts) await event(a.attemptId, 'graded-attempt', a.questionId, a);
      await event(id, 'exam-attempt', id, {
        state: 'finished', examId: id, serverMarked: true, kind: paper.kind, title: paper.title,
        year: paper.blueprint?.grade ?? paper.paper?.year ?? null,
        score: marked.score, total: marked.total, late: !inTime,
        createdAt: paper.startedAt, finishedAt: now, serverAcknowledgedAt: now,
        blueprint: paper.blueprint, questions: paper.questions.length, attempted: marked.attempts.length
      });
      return { result };
    }, { accountScope: accountId, lock: syncLockKey(accountId) });
    if (outcome.status === 404) return notFound(res);
    if (outcome.status) return reject(res, outcome.status, outcome.code, outcome.message);
    return res.status(200).json(outcome.result);
  });

  router.get('/:id', rateLimit(db, 'exam-read', { limit: 600, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const id = String(req.params.id || '');
    if (!UUID.test(id)) return notFound(res);
    const accountId = req.platformSession.account_id;
    const now = Date.now();
    const paper = await read(accountId, 'exam-paper', id, now);
    if (!paper) return notFound(res);
    const result = await read(accountId, 'exam-result', id, now);
    const exam = publicPaper(paper, now);
    if (result) return res.status(200).json({ state: 'finished', exam, result, accountId: String(accountId) });
    const snapshot = await read(accountId, 'exam-answers', id, now);
    return res.status(200).json({
      state: 'open', exam, snapshot: snapshot || null,
      // Past the deadline and its grace: a finish now is marked on `snapshot`.
      expired: now > paper.deadline + FINISH_GRACE_MS, accountId: String(accountId)
    });
  });

  return router;
}
