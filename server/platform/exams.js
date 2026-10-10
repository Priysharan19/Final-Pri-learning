// Pri Learning — server-authoritative examination papers.
//
// Owner decision 2026-10-10: every student-facing mark is decided on the
// server, examination papers included. This router owns one paper from the
// moment it exists until its result is read back years later:
//
//   POST /v1/exams/layout       a blueprint paper's LAYOUT seed (which chapter
//                               each slot is allotted, which slots offer an
//                               internal choice) is the server's to choose. The
//                               device asks for it, composes its spec against
//                               it, and a create is accepted only under the
//                               seed this account was given for that blueprint.
//                               The same seed is returned until a paper is
//                               sealed under it, so asking again is not a way
//                               to pick a layout.
//   POST /v1/exams              the device sends a paper SPEC (which blueprint,
//                               which authored cells, in which order). The
//                               server validates it against its own copy of the
//                               blueprint and the track's authored cells,
//                               chooses every question itself with seeds the
//                               device never learns, and seals the questions,
//                               the marking grid, the start time and the
//                               deadline under a new exam id owned by the
//                               account. Only the public paper is returned.
//   PUT  /v1/exams/:id/answers  (also PATCH, for the native shells) durable answer collection: the latest snapshot
//                               of what the student has entered, stamped with
//                               the server's time. Refused once the paper is
//                               finalised or its time (plus grace) has passed.
//   POST /v1/exams/:id/finish   exactly-once finalisation, in one transaction:
//                               every question is marked by the deterministic
//                               engine, one immutable result is written with
//                               one exam-level learning event (exam-result) and one
//                               graded-attempt event per attempted question.
//                               A replay returns the stored result unchanged.
//   GET  /v1/exams/:id          the owner reads the public paper and the saved
//                               snapshot while it is open, or the stored
//                               result once it is finished.
//
// AN ABANDONED PAPER IS STILL A SAT PAPER. A paper nobody finishes is finalised
// by the server once `deadline + FINISH_GRACE_MS` has passed, on the last
// snapshot it holds (nothing, if none was saved): exactly the marking a late
// finish gets, written once, with the same events. It happens the next time
// the account starts or reads any paper, and in housekeeping for an account
// that never comes back. A device that finishes afterwards is answered with
// that stored result. So a paper cannot be opened, read and dropped: it leaves
// a result, counts as a sat paper against the free allowance, and its content
// is recorded as seen.
//
// CONTENT ALREADY SEEN. Finalising a paper discloses the solution of every
// question on it, so each one is recorded as seen by the account under the
// key practice uses (contentSeen.js): a practice copy issued later is a
// repeat. And an exam item whose solution the account had ALREADY been shown
// when the paper was finalised (in practice, or in an earlier paper — a
// previous-year question that came round again) is still marked and still
// counts toward the paper's score, which is a true statement of what was
// answered on this paper; but its result line and its graded-attempt event
// carry `repeat: true`, and a repeat earns no XP, rating, review or mastery on
// any device (client/src/local/backend.js resolve(), cloudSyncRestore.js).
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
// HANDWRITING NOT READ WHEN THE PAPER CLOSED (owner decision, R4). During a
// paper a handwritten answer is read only when the student presses "Read my
// answer" (/v1/handwriting/transcribe); what is marked is the transcript they
// then see. A page they never had read is not an empty answer. The device
// sends, with every snapshot and with the finish, the SHA-256 of the picture of
// each such page (`ink`: answer key → digest; never the picture). At
// finalisation an answer key with a digest and no answer is PENDING, not
// blank: it earns the grid's unanswered mark for now, is flagged
// `pending: true` with `outcome: 'pending'`, records no attempt, and the
// result carries `handwriting.pages[key]` — the frozen digest and its state.
//
//   POST /v1/exams/:id/handwriting   { key, image }
//
// reads ONE such page after the paper is finalised. The picture must hash to
// the digest frozen with the paper (a late finish freezes the digests of the
// last snapshot saved before deadline + grace), so nothing written, erased or
// re-photographed afterwards can be read, and there is no transcript to edit:
// the answer is taken from the reading by a fixed rule (the last line; every
// line for a full-working answer) and marked by the same deterministic engine
// in the same worker pool. The read goes through recognitionOps.js, so a
// picture this account has already paid to have read is not paid for again.
//
// Bounded, and owned by the account's result row (it survives a restart and
// is the same on every replica). At most HANDWRITING_MAX_ATTEMPTS reads are
// ever started for one page: ONE automatic read (the device presents the page
// once when the paper closes), and after that only reads the student asks for
// by name (`retry: true`, "Retry checking"). A request without `retry` for a
// page that has already had its automatic read starts nothing, so nothing
// fires silently or repeatedly. Every read is reserved in the row under the
// account's lock BEFORE the reader is asked, never sooner than the backoff
// after the last one, and none after HANDWRITING_RECOVERY_WINDOW_MS. States:
//
//   awaiting-reading   not read yet (not-read) or the last try failed
//                      (reader-unavailable, capacity, marking-busy)
//   resolved           read with confidence and marked; the line is replaced,
//                      the totals recomputed, one graded-attempt event written
//   needs-review       the reading was uncertain or empty (the student may
//                      retry while tries remain), or the tries are spent or
//                      the window closed (retries-exhausted, window-closed:
//                      nothing more can be asked here). The answer stays
//                      preserved and unmarked; no mark is ever invented.
//
// Each page as read back says `triesLeft`, `canRetry` and `retryAt`.
//
// THE RECEIPT. `handwriting.pages[key]` is the server's record that
// handwriting was captured for that answer: the question and answer key, the
// digest of the picture, when the server RECEIVED that digest and on what
// evidence (`submission-in-time`: the finish arrived by deadline + grace on
// the server's clock; `snapshot-before-deadline`: the last checkpoint the
// server saved before it, with its revision), and the status. It never holds
// the picture. The server claims nothing about a page whose digest it did
// not receive in time: such a page is not on the receipt at all.
//
// Every other line of the result, and `handwriting.submissionDigest` (the
// digest of exactly the responses that were finalised), never change.
//
// A model never sets a mark here: the reader proposes a transcript, and only
// the deterministic engine marks it.
//
// Storage is the existing account-scoped idempotency_keys table (no schema
// change), under five scopes of its own, and practice's `practice-content`:
//   exam-layout   blueprint → { layoutSeed }        pending until a paper is sealed under it
//   exam-create   Idempotency-Key → { examId }      a retried create
//   exam-paper    examId → the sealed paper          immutable
//   exam-answers  examId → the latest snapshot       replaced by each save
//   exam-result   examId → the result                written once; only a line
//                                                    pending on handwriting is
//                                                    ever replaced (see above)
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { asyncRouter } from './asyncRouter.js';
import { asStore, isDatabaseOverload } from './store.js';
import { nextSyncCursor, syncLockKey } from './db.js';
import { displaceDeviceEvent } from './sync.js';
import { logEvent, safeCode } from './observability.js';
import { requireSession, requireVerifiedEmail, requireRole, rateLimit } from './security.js';
import { ensureBanks, chooseQuestion, stepMetaFor, answerTextFor, opaqueContentId, opaqueContentHash, consentBlockedNow, authorityAtCommit } from './practice.js';
// The marker runs in worker threads under a hard deadline (markerPool.js); this
// thread never calls checkAnswer or methodMarks. One response is marked by
// markerOps.js `markResponse`, in a worker, in two stages: the answer, then
// the working of a wrong written answer.
import {
  markerPool, markerCooldownUntil, recordMarkerKills,
  MARKING_BUSY, BUSY_MESSAGE, TOO_COMPLEX_MESSAGE, WORKING_NOT_READ_NOTE
} from './markerPool.js';
import { loadBanksFor } from '../../client/src/engine/generators/index.js';
import { generateMultipart } from '../../client/src/engine/generators/multipart.js';
import { makeRng } from '../../client/src/engine/qhelpers.js';
import { indiaExamPaperSpec, markObjective } from '../../client/src/engine/indiaExams.js';
import { indiaIssuableCells, indiaPyqCells, narrowCells, chapterWindowCells, cellKeyOf } from '../../client/src/engine/indiaExamCells.js';
import {
  issueIndiaItem, recipeFitsSection, recipeCells, marking as sectionMarking, answerText as examAnswerText,
  paperLayout, paperRange, sectionRangeOf, buildItem
} from '../../client/src/engine/indiaExamComposer.js';
import { scopeForYear, subtopicsForYear, PATHWAYS } from '../../client/src/engine/curriculum.js';
import { multipartForYear } from '../../client/src/engine/generators/multipart.js';
import { FREE_EXAM_ALLOWANCE } from '../../client/src/engine/examAllowance.js';
import { serverEntitlementCapabilities } from './entitlements.js';
import { stampExamItem, contentHashOf } from '../../client/src/engine/contentIdentity.js';
import { seenKeysOf, examItemsOf, seenAmong, markSeen } from './contentSeen.js';
import { recognitionOpsFor } from './recognitionOps.js';
import { transcribeHandwriting, validateImage } from './handwritingProvider.js';

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
const TRACKS = ['cbse', 'jee-main', 'jee-advanced', 'olympiad'];
const NEEDS = ['mcq', 'numerical', 'integer99', 'written', 'any', 'facts', 'factsNoFigure'];
const PRACTICE_LENGTHS = [10, 15, 20];
const ISSUE_TRIES = 8;
// How many times a practice-paper slot is drawn again to avoid a question the paper already holds.
const PRACTICE_REDRAWS = 24;
// An account may hold this many papers open (sealed and not yet finalised) at once.
export const MAX_OPEN_PAPERS = 3;
const MAX_ANSWER = 4000;
const MAX_WORKING = 8000;
const MAX_KEYS = 400;
const MAX_MS = 24 * 60 * 60 * 1000;
const OBJECTIVE = new Set(['mcq', 'multi-mcq']);

const CREATE_FIELDS = new Set(['kind', 'blueprint', 'paper', 'layoutSeed', 'slots']);
const LAYOUT_FIELDS = new Set(['blueprint']);
const SNAPSHOT_FIELDS = new Set(['answers', 'workings', 'times', 'modes', 'ink', 'cur', 'rev']);
const FINISH_FIELDS = new Set(['answers', 'workings', 'times', 'modes', 'ink', 'ms', 'reason', 'submissionKey']);
const HANDWRITING_FIELDS = new Set(['key', 'image', 'retry']);

// ── Handwriting not read when the paper closed (see the header) ─────────────
/** How many reads are ever started for one frozen page. */
export const HANDWRITING_MAX_ATTEMPTS = 3;
/** The least time between one started read of a page and the next. */
export const HANDWRITING_BACKOFF_MS = [60 * 1000, 15 * 60 * 1000];
/** After this long from finalisation an unread page is left for a person. */
export const HANDWRITING_RECOVERY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const PENDING_MESSAGE = 'Your handwriting for this answer was saved when the paper closed. It has not been read yet, so it has not been marked.';
const MAX_INK_PAGES = 60;
const PAGE_DIGEST = /^[0-9a-f]{64}$/;

const digest = input => createHash('sha256').update(typeof input === 'string' ? input : JSON.stringify(input)).digest('hex');
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const unknown = (value, allowed) => Object.keys(value).filter(key => !allowed.has(key));
const limitedText = (s, n) => typeof s === 'string' && s.length <= n && !/[\u0000-\u0008\u000b\u000e-\u001f]/.test(s);
const blank = v => v === undefined || v === null || String(v).trim() === '';
const refusal = (status, code, message) => ({ refused: [status, code, message] });
const reject = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const notFound = res => reject(res, 404, 'EXAM_NOT_FOUND', 'This paper does not belong to this account.');

// ── The public paper ─────────────────────────────────────────────────────────

// WHAT IS PUBLIC ABOUT A PREVIOUS-YEAR ITEM, AND WHY. The exam room shows a
// student which questions were really set in an exam while they sit them, so
// these travel with the question: `pyq`, `pyqSource`, `pyqYear`, `pyqExam`,
// and `archive` — the exam and its label, the authority, year, paper, set
// code, session, section and QUESTION NUMBER, the chapter, the provenance, the
// citations (the authority's own document: title, url, file, dates) and who
// wrote the worked steps. That is deliberately enough to find the question in
// the authority's published paper; a previous-year item is a fixed, published
// question and its prompt alone already identifies it.
// What does not travel is this product's own handle on the record:
// `archive.recordId` is removed here, `pyqId` is not on the allow-list, and
// the content id (`pyq:<record id>` when sealed) leaves only as a keyed
// digest. Nothing in the client reads the record id before or after a paper
// is marked.
function publicArchive(archive) {
  if (!plain(archive)) return archive;
  const { recordId: _recordId, ...rest } = archive;
  return rest;
}
function publicSingle(q) {
  const out = { supportsSteps: !OBJECTIVE.has(q.answerType) && !!stepMetaFor(q) };
  for (const k of ['prompt', 'answerType', 'mcqOptions', 'options', 'matchList', 'figure', 'inputHint', 'answerPrefix', 'answerSuffix',
    'subtopic', 'difficulty', 'dotpoint', 'dotpoints', 'pyq', 'pyqSource', 'pyqYear', 'pyqExam']) {
    if (q[k] !== undefined && q[k] !== null) out[k] = q[k];
  }
  if (q.archive !== undefined && q.archive !== null) out.archive = publicArchive(q.archive);
  return out;
}

/** Everything of a sealed question a student may see before the paper is marked. */
function publicPayload(q) {
  // The engine's content id names the generator seed (or the archive record)
  // and its content hash is an unkeyed digest that includes the answer: either
  // would let the bundled engine recover the key. What leaves the server is a
  // keyed digest of each (the same ones practice hands out); the real identity
  // stays sealed.
  const identity = {};
  if (q.contentId) identity.contentId = opaqueContentId(q.contentId);
  if (q.contentVersion) identity.contentVersion = q.contentVersion;
  if (q.contentHash) identity.contentHash = opaqueContentHash(q.contentHash);
  if (q.examItem) identity.examItem = q.examItem;
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

// The device composes the recipes of a paper — never a paper the blueprint
// would not have produced, and never a layout of its choosing. So a spec is
// held to the blueprint slot by slot, with the server's own copy of everything
// the composer decides before a question is drawn:
//   · the LAYOUT — which chapter each slot is allotted and which slots offer an
//     internal choice — is recomputed from the layout seed with the composer's
//     own allocation (unit weightage, or the seeded chapter cycle). That seed
//     is the server's: it is handed out by POST /v1/exams/layout and the create
//     route accepts no other, so the device cannot shop among the hundreds of
//     legitimate chapter allocations a blueprint has;
//   · a slot's cells must belong to the chapter the slot names, inside the
//     section's difficulty window (nearest rung when the chapter has none
//     there), exactly as the composer draws them; previous-year cells are that
//     chapter's, narrowed the same way;
//   · a slot names exactly the chapter the layout allots it. Where the device
//     could not fill a slot from that chapter it sends no recipe, and the
//     server composes the slot by the composer's own rule: the allotted
//     chapter first, another chapter in scope only if that one cannot supply.
/** The released blueprint a selection names, with its issuable cells — or the refusal. */
function readBlueprint(b) {
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
  return { spec, cells, variant, track: b.track, grade: b.grade };
}

/** The key an account's pending layout seed is held under: one per blueprint selection. */
const layoutKeyOf = blueprint => `${blueprint.track}:${blueprint.grade}:${blueprint.variant}`;

function readIndiaSpec(body) {
  if (body.paper !== undefined) return INVALID();
  const b = body.blueprint;
  const named = readBlueprint(b);
  if (named.refused) return named;
  const { spec, cells, variant } = named;
  // The seed is the server's (POST /v1/exams/layout); the route checks that it
  // is the one this account was given. Here it only has to be a seed.
  if (!Number.isInteger(body.layoutSeed) || body.layoutSeed < 1 || body.layoutSeed > 0x7fffffff) return INVALID('A blueprint paper names its layout seed.');
  const layout = paperLayout(spec, cells.chapters, body.layoutSeed);
  if (!Array.isArray(body.slots) || body.slots.length !== layout.slots.length) {
    return INVALID(`This paper has ${layout.slots.length} questions.`);
  }
  const chapters = new Map(cells.chapters.map(chapter => [chapter.id, chapter]));
  const pyq = indiaPyqCells(b.track, cells.chapters);
  const windows = new Map();   // `${chapterId}|${min}|${max}` → { authored, any }
  const windowOf = (chapter, range) => {
    const key = `${chapter.id}|${range.min}|${range.max}`;
    if (!windows.has(key)) windows.set(key, chapterWindowCells(chapter, range, pyq));
    return windows.get(key);
  };
  const slots = [];
  for (let i = 0; i < body.slots.length; i++) {
    const raw = body.slots[i];
    const { section, index, chapterId: allottedId } = layout.slots[i];
    const range = sectionRangeOf(spec, section);
    const choice = !!layout.choiceSlots[section.id]?.has(index);
    if (!plain(raw) || unknown(raw, new Set(['section', 'chapter', 'recipe'])).length) return INVALID(`Slot ${i + 1} is not valid.`);
    if (typeof raw.section !== 'string' || !SECTION_ID.test(raw.section) || raw.section !== String(section.id)) {
      return INVALID(`Slot ${i + 1} is not in the blueprint's section order.`);
    }
    if (typeof raw.chapter !== 'string' || !CHAPTER_ID.test(raw.chapter) || !chapters.has(raw.chapter)) {
      return INVALID(`Slot ${i + 1} names a chapter outside this track and class.`);
    }
    // The layout decides the chapter. A slot that names any other is refused:
    // the device cannot move a question, or its evidence, to a chapter of its
    // choosing.
    if (raw.chapter !== allottedId) return INVALID(`Slot ${i + 1} is not the chapter this layout allots it.`);
    const chapter = chapters.get(raw.chapter);
    // No recipe: the device could not fill the slot from its chapter, and the
    // server composes it by the composer's own rule (the chapter first, then
    // another in scope).
    if (raw.recipe === null) { slots.push({ section, index, choice, range, chapter, recipe: null }); continue; }
    const recipe = cleanRecipe(raw.recipe);
    if (!recipe || !recipeFitsSection(section, recipe)) return INVALID(`Slot ${i + 1} is not an item this section sets.`);
    // Assertion-reason items close their section, as the composer places them.
    if (recipe.kind === 'assertion-reason' && index < section.questions - (section.assertionReason || 0)) {
      return INVALID(`Slot ${i + 1} is not where this section sets an assertion-reason item.`);
    }
    // An internal choice exists only on the slots the layout gives one to.
    const offersChoice = recipe.kind === 'single' ? !!recipe.alt
      : recipe.kind === 'case-study' ? (recipe.choice || recipe.parts.some(part => part.alt)) : false;
    if (offersChoice && !choice) return INVALID(`Slot ${i + 1} does not offer an internal choice in this layout.`);
    // The slot's cells are its own chapter's, inside the section's window.
    const own = windowOf(chapter, range);
    const inChapter = (cell, set) => set.has(cellKeyOf(cell));
    let fits;
    if (recipe.kind === 'single') fits = inChapter(recipe.cell, own.any) && (!recipe.alt || inChapter(recipe.alt, own.any));
    else if (recipe.kind === 'case-study') fits = recipe.parts.every(part => inChapter(part.cell, own.authored) && (!part.alt || inChapter(part.alt, own.authored)));
    else if (recipe.kind === 'assertion-reason') {
      // The assertion is the slot's chapter's; the reason may be any chapter's
      // in scope, drawn inside the same window.
      fits = inChapter(recipe.cells[0], own.authored)
        && cells.chapters.some(other => inChapter(recipe.cells[1], windowOf(other, range).authored));
    } else fits = recipe.cells.every(cell => inChapter(cell, own.authored));
    if (!fits || !recipeCells(recipe).every(cell => cells.has(cell))) {
      return INVALID(`Slot ${i + 1} draws from outside its chapter or its section's difficulty range.`);
    }
    slots.push({ section, index, choice, range, chapter, recipe });
  }
  return {
    kind: 'india', spec, cells, pyq, slots, layoutSeed: body.layoutSeed,
    durationMin: Number(spec.durationMinutes || spec.recommendedSectionMinutes || 60),
    blueprint: { id: spec.id, label: spec.label, track: b.track, grade: b.grade, variant },
    defaultTitle: spec.label
  };
}

/** The difficulty a practice paper sets at each position, as the device composes it. */
const practiceDifficulty = (i, length) => { const t = i / length; return t < 0.2 ? 1 : t < 0.6 ? 2 : t < 0.9 ? 3 : 4; };

// A practice paper is held to the year (and pathway) it claims: every question
// comes from a subtopic that year's scope owns, at the difficulty the paper's
// ladder sets for that position, never the same subtopic twice running; the
// structured question is one that year sets.
function readPracticeSpec(body) {
  if (body.blueprint !== undefined || body.layoutSeed !== undefined) return INVALID();
  const p = body.paper;
  if (!plain(p) || unknown(p, new Set(['year', 'minutes', 'pathway'])).length) return INVALID('Name the year and length of the paper.');
  if (!Number.isInteger(p.year) || p.year < 7 || p.year > 12 || !Number.isInteger(p.minutes) || p.minutes < 10 || p.minutes > 90) {
    return INVALID('A practice paper is for Years 7–12 and runs 10–90 minutes.');
  }
  const pathway = p.pathway ?? null;
  if (pathway !== null && (typeof pathway !== 'string' || !/^[a-z0-9-]{1,24}$/.test(pathway))) return INVALID();
  // Years 11–12 sit a pathway's paper; earlier years have none.
  if (p.year >= 11 ? !(pathway && Object.hasOwn(PATHWAYS, pathway) && PATHWAYS[pathway].years.includes(p.year)) : pathway !== null) return INVALID('That pathway is not one this year sits.');
  const scope = new Set((pathway ? scopeForYear(p.year, pathway).own : subtopicsForYear(p.year)).map(sub => sub.id));
  if (!scope.size) return refusal(409, 'EXAM_BLUEPRINT_NOT_RELEASED', 'No practice paper is released for this year.');
  if (!Array.isArray(body.slots) || body.slots.length < PRACTICE_LENGTHS[0] || body.slots.length > PRACTICE_LENGTHS.at(-1) + 1) {
    return INVALID('A practice paper has 10, 15 or 20 questions and at most one structured question.');
  }
  const structured = plain(body.slots.at(-1)) && body.slots.at(-1).multipart !== undefined ? 1 : 0;
  const length = body.slots.length - structured;
  if (!PRACTICE_LENGTHS.includes(length)) return INVALID('A practice paper has 10, 15 or 20 questions and at most one structured question.');
  const setsStructured = multipartForYear(p.year, pathway || 'advanced');
  // The structured question is part of the paper whenever the year sets one.
  if (structured !== (setsStructured.length ? 1 : 0)) return INVALID('This year’s paper does not have that structured question.');
  const slots = [];
  for (let i = 0; i < body.slots.length; i++) {
    const raw = body.slots[i];
    if (!plain(raw)) return INVALID(`Slot ${i + 1} is not valid.`);
    if (i === length) {
      // The structured question closes the paper, as Section II.
      if (unknown(raw, new Set(['multipart'])).length || typeof raw.multipart !== 'string' || !MULTIPART_ID.test(raw.multipart)
          || !setsStructured.includes(raw.multipart)) return INVALID(`Slot ${i + 1} is not a structured question this year sets.`);
      slots.push({ multipart: raw.multipart });
      continue;
    }
    if (unknown(raw, new Set(['generator', 'difficulty'])).length || typeof raw.generator !== 'string' || !AUTHORED_BANK.test(raw.generator)
        || !Number.isInteger(raw.difficulty)) return INVALID(`Slot ${i + 1} is not valid.`);
    if (!scope.has(raw.generator)) return INVALID(`Slot ${i + 1} is not a subtopic this year’s paper covers.`);
    if (raw.difficulty !== practiceDifficulty(i, length)) return INVALID(`Slot ${i + 1} is not at the difficulty this paper sets there.`);
    if (scope.size > 1 && i > 0 && body.slots[i - 1]?.generator === raw.generator) return INVALID(`Slot ${i + 1} repeats the subtopic before it.`);
    slots.push({ generator: raw.generator, difficulty: raw.difficulty });
  }
  return {
    kind: 'practice-paper', slots, durationMin: p.minutes,
    paper: { year: p.year, minutes: p.minutes, pathway, length },
    defaultTitle: `Year ${p.year}${pathway && pathway !== 'advanced' ? ` ${PATHWAYS[pathway].short}` : ''} Practice Paper`
  };
}

function readSpec(body) {
  if (!plain(body) || unknown(body, CREATE_FIELDS).length) return INVALID();
  const read = body.kind === 'india' ? readIndiaSpec(body) : body.kind === 'practice-paper' ? readPracticeSpec(body) : INVALID('Name the kind of paper.');
  if (read.refused) return read;
  // The title of a certified paper is the server's, from the blueprint. A
  // device may call the paper what it likes locally; that name is never here.
  return { ...read, title: read.defaultTitle };
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
  // The last word on "one question, once per paper", at the seal. Every unit a
  // student is asked on an item — the item, its alternative, each part and
  // each part's alternative — is known by its engine content hash, and none
  // may already be on the paper or appear twice inside the item. The composer
  // already keeps one prompt from being drawn twice; this holds whatever path
  // produced the item.
  const onPaper = new Set();
  const unitHashes = payload => examItemsOf(payload).map(contentHashOf);
  const fresh = payload => {
    const hashes = unitHashes(payload);
    return new Set(hashes).size === hashes.length && !hashes.some(hash => onPaper.has(hash));
  };

  if (read.kind === 'india') {
    // Reviewed previous-year banks are loaded on demand, by generator.
    try { await loadBanksFor([...new Set(read.slots.flatMap(slot => recipeCells(slot.recipe).map(cell => cell.generator)))]); }
    catch { return UNSUPPORTED(1); }
    const ctx = {
      rng: makeRng(randomInt(0x7fffffff) || 1), draw, seen: new Set(), isPyq: read.cells.isPyq,
      // For the composer's own builder: it passes a seed, which is ignored — the
      // server chooses.
      pyqCellsFor: (chapter, range) => narrowCells(read.pyq.get(chapter.id) || [], range)
    };
    const paperWide = paperRange(read.spec);
    for (const slot of read.slots) {
      let built = null;
      let chapter = slot.chapter;
      for (let attempt = 0; slot.recipe && attempt < ISSUE_TRIES && !built; attempt++) {
        // Draws that did not make an item are not on the paper: forget them,
        // so a small bank is not used up by attempts that came to nothing.
        const seenBefore = new Set(ctx.seen);
        try { built = issueIndiaItem(slot.section, slot.recipe, ctx, { chapterName: slot.chapter.name }); }
        catch { built = null; }
        if (built && !fresh(built.payload)) built = null;
        if (!built) ctx.seen = seenBefore;
      }
      if (!built) {
        // No recipe, or the recipe's own cells have run dry on this paper (a
        // small bank, already drawn from above). The slot is composed here as
        // the composer would: from its chapter's whole window, and failing
        // that from another chapter in scope — never dropped.
        const order = [slot.chapter, ...read.cells.chapters.filter(c => c.id !== slot.chapter.id)
          .map(c => [ctx.rng(), c]).sort((x, y) => x[0] - y[0]).map(([, c]) => c)];
        for (const candidate of order) {
          const seenBefore = new Set(ctx.seen);
          try { built = buildItem(ctx, read.spec, slot.section, { index: slot.index }, candidate, read.cells.chapters, paperWide, { writtenAsObjective: 0 }, slot.choice); }
          catch { built = null; }
          if (built && !fresh(built.payload)) built = null;
          if (built) { chapter = built.fromChapter || candidate; break; }
          ctx.seen = seenBefore;
        }
      }
      if (!built) return UNSUPPORTED(questions.length + 1);
      for (const hash of unitHashes(built.payload)) onPaper.add(hash);
      const grid = sectionMarking(slot.section);
      seal({
        section: String(slot.section.id), sectionLabel: slot.section.label || `Section ${slot.section.id}`, item: built.item,
        chapterId: chapter.id, chapterName: chapter.name, marking: grid, marks: grid.correct,
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
    // Drawn again while the question is already on this paper. A practice
    // paper may name one subtopic at one level many times; when its bank at
    // that level holds fewer different questions than the paper asks for, the
    // last draw stands rather than the paper being refused.
    let q;
    try {
      for (let attempt = 0; attempt < PRACTICE_REDRAWS; attempt++) {
        q = draw(slot.generator, slot.difficulty);
        if (q?.prompt && fresh(q)) break;
      }
    } catch { return UNSUPPORTED(questions.length + 1); }
    if (!q?.prompt) return UNSUPPORTED(questions.length + 1);
    for (const hash of unitHashes(q)) onPaper.add(hash);
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

/** Answer key → the SHA-256 of the picture of a handwritten page that has not been read. */
function readInk(map, keys) {
  if (map === undefined || map === null) return {};
  if (!plain(map) || Object.keys(map).length > MAX_INK_PAGES) return null;
  const out = {};
  for (const [key, value] of Object.entries(map)) {
    if (!keys.has(key) || typeof value !== 'string' || !PAGE_DIGEST.test(value)) return null;
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
  const ink = readInk(body.ink, keys);
  return answers && workings && times && modes && ink ? { answers, workings, times, modes, ink } : null;
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

// ── A response the marker was stopped on ────────────────────────────────────
// Each part of a paper is one pool operation with the hard deadline; the paper
// as a whole has a marking budget (markerPool.js MARKER_LIMITS). A part that is
// cut off is never given a verdict the engine did not reach:
//
// RULE (the part's ANSWER was not marked in time, or the paper's budget was
// already spent) — the part is UNREADABLE: it earns the grid's unanswered
// mark (never the negative mark of a wrong answer), it is not correct, it has
// no method marks, it says the fixed sentence, it is flagged `unreadable`,
// and NO attempt is recorded for it — it is not evidence of a wrong answer.
// The rest of the paper is marked normally.
const unreadableResponse = (q, grid) => ({
  unanswered: true, correct: false, awarded: markObjective(grid, { unanswered: true }), feedback: TOO_COMPLEX_MESSAGE, partial: null,
  markingScheme: OBJECTIVE.has(q.answerType) ? 'objective' : 'final-answer', outcome: 'unreadable', unreadable: true
});
// RULE (the answer was marked in time, its working was not) — the part is
// marked on what completed: the answer's verdict and final-answer mark stand,
// the working earns NO method marks and is flagged `workingNotRead`. Credit
// is never invented for lines nobody read.
const workingNotReadResponse = answered => ({
  ...answered, feedback: (answered.feedback ? answered.feedback + ' ' : '') + WORKING_NOT_READ_NOTE, workingNotRead: true
});
// RULE (handwriting was captured for the answer and never read) — the part is
// PENDING: it earns the grid's unanswered mark for now, it is not correct and
// not wrong, it carries the fixed sentence and `pending: true`, and no attempt
// is recorded for it. It is not a blank: see "HANDWRITING NOT READ" above.
const pendingResponse = (q, grid) => ({
  unanswered: true, correct: false, awarded: markObjective(grid, { unanswered: true }), feedback: PENDING_MESSAGE, partial: null,
  markingScheme: OBJECTIVE.has(q.answerType) ? 'objective' : 'final-answer', outcome: 'pending', pending: true
});
const cutOffFlags = r => ({
  ...(r.unreadable ? { unreadable: true } : {}), ...(r.workingNotRead ? { workingNotRead: true } : {}), ...(r.pending ? { pending: true } : {})
});
/** A part the marker was stopped on: what completed stands, nothing else is invented. */
const stoppedResponse = (out, job) => {
  const answered = out.partials.find(part => part?.response);
  // A stage-one response that was already final needed no working.
  return answered ? (answered.final ? answered.response : workingNotReadResponse(answered.response)) : unreadableResponse(job.q, job.grid);
};
/** Is this answer key a handwritten page that was captured and never read? */
const unreadInk = (responses, key, q, given) => !!responses.ink?.[key] && blank(given) && !OBJECTIVE.has(q.answerType);

/**
 * Mark every response of a paper in the marker pool. Returns the responses in
 * the exact order markPaper asks for them (it is markPaper itself that
 * enumerates them, so the two cannot drift), how many operations were stopped
 * at the deadline, or `{ busy: true }` when the pool refused one before it ran
 * (then nothing is known and nothing may be committed).
 */
async function markResponsesIsolated(paper, responses, accountId, budgetMs = null) {
  const jobs = [];
  const placeholder = { unanswered: true, correct: false, awarded: 0, feedback: '', partial: null, markingScheme: 'objective', outcome: 'unanswered' };
  markPaper(paper, responses, { now: 0, totalMs: 0, mark: (q, given, working, grid, key) => { jobs.push({ q, given, working, grid, key }); return placeholder; } });
  const pool = markerPool();
  let budget = budgetMs ?? pool.examPaperBudgetMs;
  let kills = 0;
  const results = [];
  for (const job of jobs) {
    // Captured handwriting nobody read: there is nothing for the marker yet.
    if (unreadInk(responses, job.key, job.q, job.given)) { results.push(pendingResponse(job.q, job.grid)); continue; }
    if (budget <= 0) { results.push(unreadableResponse(job.q, job.grid)); continue; }
    const allowed = Math.min(pool.deadlineMs, budget);
    const out = await pool.run('exam', job, { key: accountId, deadlineMs: allowed });
    if (!out.ok && out.code === MARKING_BUSY) return { busy: true, kills };
    // A part that was stopped has used all the time it was allowed.
    budget -= out.ok ? out.ms : Math.max(out.ms, allowed);
    if (out.ok) { results.push(out.value.response); continue; }
    kills++;
    results.push(stoppedResponse(out, job));
  }
  return { results, kills };
}

// ── Totals ───────────────────────────────────────────────────────────────────
// The paper's score and its section/chapter tallies are a function of its
// detail lines and nothing else, so a line that is replaced later (a page of
// handwriting read after the paper closed) is totalled by the same code.
const tallySeed = (id, label) => ({ id, label, questions: 0, attempted: 0, correct: 0, incorrect: 0, partial: 0, unanswered: 0, marks: 0, awarded: 0, negative: 0, ms: 0 });
function tally(map, key, label, out) {
  const agg = map.get(key) || tallySeed(key, label);
  agg.questions++; agg.marks += out.marks; agg.awarded += out.awarded; agg.ms += out.ms;
  if (out.unanswered) agg.unanswered++;
  else { agg.attempted++; if (out.correct) agg.correct++; else if (out.awarded > 0) agg.partial++; else agg.incorrect++; }
  if (out.awarded < 0) agg.negative += -out.awarded;
  map.set(key, agg);
}
function summarise(paper, detail, totalMs) {
  const byId = new Map(paper.questions.map(sq => [sq.id, sq]));
  const sections = new Map();
  const chapters = new Map();
  const schemes = {};
  let score = 0, total = 0, negativeMarks = 0;
  for (const out of detail) {
    const sq = byId.get(out.id);
    const q = sq.payload;
    for (const scheme of out.multipart ? out.parts.map(part => part.markingScheme) : [out.markingScheme]) schemes[scheme] = (schemes[scheme] || 0) + 1;
    score += out.awarded; total += out.marks;
    if (out.awarded < 0) negativeMarks += -out.awarded;
    tally(sections, sq.section, sq.sectionLabel, out);
    tally(chapters, sq.chapterId || q.subtopic || sq.generator, sq.chapterName || q.title || q.subtopic || sq.generator, out);
  }
  return {
    score, total, pct: Math.round(1000 * score / Math.max(1, total)) / 10,
    summary: {
      sections: [...sections.values()],
      chapters: [...chapters.values()].sort((a, b) => String(a.label).localeCompare(String(b.label))),
      negativeMarks, totalMs: totalMs || detail.reduce((n, d) => n + (d.ms || 0), 0), markingSchemes: schemes
    }
  };
}

/**
 * Mark the whole paper. Pure: the sealed paper and the responses in, the result
 * body out. `seen` is the set of content keys (contentSeen.js) this account had
 * already been shown the solution of before this paper was finalised: an item
 * among them is marked and scored like any other, and flagged `repeat: true`
 * on its result line and its attempt, so it earns no progress anywhere.
 *
 * `mark(q, given, working, grid, key)` supplies each response's marking. This
 * function never runs the marker itself: finalise() gives it the responses the
 * marker pool produced (markResponsesIsolated), in the order it asks for them.
 */
export function markPaper(paper, responses, { now, totalMs, seen = null, mark }) {
  const { answers, workings, times, modes } = responses;
  const isRepeat = item => !!seen && seen.size > 0 && seenKeysOf(item).some(key => seen.has(key));
  const timed = Object.keys(times).length > 0;
  const nQ = Math.max(1, paper.questions.length);
  const detail = [];
  const attempts = [];
  // Answer keys left pending on handwriting that was captured and not read.
  const pendingKeys = [];
  // A page of unread handwriting counts as the version of a choice the
  // student took, exactly as a typed answer to it would.
  const inked = key => !!responses.ink?.[key] && blank(answers[key]);
  const inputMode = key => (modes[key] === 'ink' ? 'ink' : 'typed');
  const attempt = (sq, q, r, extra) => {
    const attemptId = randomUUID();
    attempts.push({
      attemptId, questionId: sq.id, examId: paper.id, correct: r.correct === true,
      marksEarned: r.awarded, marksPossible: extra.marks,
      contentId: opaqueContentId(sq.payload.contentId),
      subtopic: q.subtopic || sq.payload.subtopic || sq.generator, difficulty: Number(q.difficulty || sq.difficulty) || 2,
      ...(sq.chapterId ? { chapterId: sq.chapterId } : {}),
      ...(extra.part ? { part: extra.part } : {}),
      ...(extra.repeat ? { repeat: true } : {}),
      mode: 'exam', inputMode: extra.inputMode, ms: extra.ms,
      // The server offers an exam question no hint, tutor or second try, but it
      // cannot see what else was open beside the paper. As with practice, an
      // attempt whose help is unknown is not recorded as independent.
      hintsUsed: 1, support: 'supported', createdAt: now, serverAcknowledgedAt: now
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
      sourceKind: sq.pyq ? 'reviewed-jee-pyq' : 'authored-generator', contentId: opaqueContentId(q.contentId)
    };
    let out;
    if (q.multipart) {
      const partsOut = [];
      let qMarks = 0, qAwarded = 0, allCorrect = true, anyAnswered = false, repeatParts = 0;
      const parts = q.parts || [];
      for (const part of parts) {
        const mainKey = `${sq.id}::${part.key}`;
        const useAlt = blank(answers[mainKey]) && part.alt && (!blank(answers[`${mainKey}::or`]) || (inked(`${mainKey}::or`) && !inked(mainKey)));
        const key = useAlt ? `${mainKey}::or` : mainKey;
        const chosen = useAlt ? part.alt : part;
        const synth = { ...chosen, subtopic: chosen.subtopic || q.subtopic, difficulty: chosen.difficulty || q.difficulty || 2 };
        const grid = { correct: part.marks, incorrect: 0, unanswered: 0 };
        const r = mark(synth, answers[key], workings[key], grid, key);
        if (r.pending) pendingKeys.push(key);
        const repeat = isRepeat(chosen);
        if (repeat) repeatParts++;
        qMarks += part.marks; qAwarded += r.awarded;
        if (!r.correct) allCorrect = false;
        let attemptId = null;
        if (!r.unanswered) {
          anyAnswered = true;
          // A blueprint case study is chaptered sub-questions: each part is its
          // own evidence. A structured Section II question is one piece of work
          // with no single subtopic, so it is recorded on the paper only.
          if (paper.kind === 'india') {
            attemptId = attempt(sq, synth, r, { marks: part.marks, part: String(part.key), repeat, inputMode: inputMode(key), ms: Math.round(ms / Math.max(1, parts.length)) });
          }
        }
        partsOut.push({
          key: part.key, prompt: chosen.prompt, answerType: chosen.answerType, mcqOptions: chosen.mcqOptions || null,
          figure: chosen.figure || null, choiceTaken: useAlt ? 'or' : (part.alt ? 'main' : null),
          given: blank(answers[key]) ? '' : String(answers[key]), correct: r.correct, unanswered: r.unanswered,
          marks: part.marks, awarded: r.awarded, feedback: r.feedback, partial: r.partial, markingScheme: r.markingScheme,
          working: blank(workings[key]) ? null : String(workings[key]),
          answerText: keyedAnswer(chosen), steps: chosen.steps || [], subtopic: synth.subtopic, difficulty: synth.difficulty, attemptId,
          ...(repeat ? { repeat: true } : {}),
          ...cutOffFlags(r),
          // Both versions of a part that offered a choice, now that it is marked.
          ...(part.alt ? { choices: Object.fromEntries([['main', part], ['or', part.alt]].map(([name, it]) => [name, {
            prompt: it.prompt, answerType: it.answerType, mcqOptions: it.mcqOptions || null, figure: it.figure || null,
            answerText: keyedAnswer(it), steps: it.steps || []
          }])) } : {})
        });
      }
      out = {
        ...base, multipart: true, title: q.title, stem: q.stem, figure: q.figure || null,
        marks: qMarks, awarded: qAwarded, correct: allCorrect && anyAnswered, unanswered: !anyAnswered, parts: partsOut,
        markingScheme: 'final-answer', outcome: !anyAnswered ? 'unanswered' : allCorrect ? 'correct' : 'wrong',
        // A part is waiting on handwriting: the question's marks are not final.
        ...(partsOut.some(part => part.pending) ? { pending: true } : {}),
        // The whole question again, or every part of it: nothing on it is new work.
        ...(isRepeat(q) || (parts.length > 0 && repeatParts === parts.length) ? { repeat: true } : {})
      };
    } else {
      const useAlt = blank(answers[sq.id]) && q.alt && (!blank(answers[`${sq.id}::or`]) || (inked(`${sq.id}::or`) && !inked(sq.id)));
      const key = useAlt ? `${sq.id}::or` : sq.id;
      const chosen = useAlt ? { ...q.alt, subtopic: q.alt.subtopic || q.subtopic, difficulty: q.alt.difficulty || q.difficulty || 2 } : q;
      const r = mark(chosen, answers[key], workings[key], sq.marking, key);
      if (r.pending) pendingKeys.push(key);
      const marks = Number(sq.marking.correct);
      // The question answered (the alternative, when that is the one taken).
      const repeat = isRepeat(useAlt ? q.alt : q);
      // A blueprint paper leaves a question it never saw an answer to out of
      // the evidence: not attempted is not wrong. A practice paper has always
      // counted a blank as a wrong attempt, and still does.
      // An answer the marker was stopped on is recorded on no paper as an
      // attempt: unreadable is not wrong. Neither is handwriting not yet read.
      const attemptId = r.unreadable || r.pending || (r.unanswered && paper.kind === 'india') ? null : attempt(sq, chosen, r, { marks, repeat, inputMode: inputMode(key), ms });
      out = {
        ...base, prompt: chosen.prompt, answerType: chosen.answerType, mcqOptions: chosen.mcqOptions || null, matchList: chosen.matchList || null,
        figure: chosen.figure || null, choiceTaken: useAlt ? 'or' : (q.alt ? 'main' : null),
        given: blank(answers[key]) ? '' : String(answers[key]), correct: r.correct, unanswered: r.unanswered, feedback: r.feedback,
        marks, negativeMarks: Math.abs(Number(sq.marking.incorrect || 0)), awarded: r.awarded, partial: r.partial,
        working: blank(workings[key]) ? null : String(workings[key]), markingScheme: r.markingScheme, outcome: r.outcome,
        solution: solutionOf(chosen, marks, sq.marking), attemptId,
        ...(repeat ? { repeat: true } : {}),
        ...cutOffFlags(r),
        // Both questions of an internal choice, now that the paper is marked.
        ...(q.alt ? { choices: Object.fromEntries([['main', q], ['or', q.alt]].map(([name, it]) => [name, {
          prompt: it.prompt, answerType: it.answerType, mcqOptions: it.mcqOptions || null, matchList: it.matchList || null,
          figure: it.figure || null, solution: solutionOf(it, marks, sq.marking)
        }])) } : {}),
        // Authored distractor explanations, disclosed only now: the device
        // derives misconception identity from these, never from an answer key.
        repairOpportunities: [...new Set([
          ...(Array.isArray(chosen.traps) ? chosen.traps : []).map(t => t?.why),
          ...Object.values(chosen.answer?.optionTraps || {})
        ].filter(why => typeof why === 'string' && why))].slice(0, 40)
      };
    }
    detail.push(out);
  }
  return { ...summarise(paper, detail, totalMs), detail, attempts, pendingKeys };
}

// ── Who may start how many papers ────────────────────────────────────────────
// The server's own entitlement record decides (entitlement_snapshots, read the
// way every server-paid operation reads it), and the server counts its own
// sealed papers. A device's counter is a courtesy to the student, not a limit.

const DAY_MS = 24 * 60 * 60 * 1000;
const EXAM_WINDOW_MS = FREE_EXAM_ALLOWANCE.examWindowDays * DAY_MS;

/**
 * Null when this account may start this paper now; otherwise the refusal, in
 * the codes the device's own gate uses (402 FREE_CAP_REACHED / PREMIUM_REQUIRED)
 * so the same paywall copy applies. Reads only; consumes nothing.
 */
async function entitlementRefusal(db, accountId, spec, now) {
  const snapshot = await db.get('SELECT plan,status,current_period_end,grace_until FROM entitlement_snapshots WHERE account_id=?', [accountId]);
  const capabilities = serverEntitlementCapabilities(snapshot, now);
  // JEE Advanced is Premium content: the track's own gate comes first, so a
  // free account is told the track is the reason, not that it used a simulation.
  if (spec.blueprint?.track === 'jee-advanced' && !capabilities.includes('jee-advanced-content')) {
    return { status: 402, code: 'PREMIUM_REQUIRED', capability: 'jee-advanced-content',
      message: 'The JEE Advanced track is part of Pri Learning Premium. JEE Main and the CBSE / NCERT chapters stay on the free plan.' };
  }
  if (capabilities.includes('premium-exams')) return null;
  const recent = await db.all("SELECT created_at FROM idempotency_keys WHERE account_id=? AND scope='exam-paper' AND created_at>? ORDER BY created_at",
    [accountId, now - EXAM_WINDOW_MS]);
  if (recent.length < FREE_EXAM_ALLOWANCE.examsPerWindow) return null;
  const nextAt = Number(recent[0].created_at) + EXAM_WINDOW_MS;
  return { status: 402, code: 'FREE_CAP_REACHED', capability: 'premium-exams', used: recent.length,
    limit: FREE_EXAM_ALLOWANCE.examsPerWindow, windowDays: FREE_EXAM_ALLOWANCE.examWindowDays, nextAt,
    message: `The free plan includes ${FREE_EXAM_ALLOWANCE.examsPerWindow === 1 ? 'one exam simulation' : `${FREE_EXAM_ALLOWANCE.examsPerWindow} exam simulations`} every ${FREE_EXAM_ALLOWANCE.examWindowDays} days. Premium includes unlimited simulations.` };
}

/**
 * The papers this account has sealed and not finalised, oldest first. An
 * abandoned paper does not drop out of this list by being left alone: it stays
 * until it is finalised, which the server does itself once deadline + grace has
 * passed (finaliseExpiredExams, run before every count below).
 */
const UNFINALISED = `SELECT p.account_id AS account_id, p.key AS key, p.response_json AS response_json FROM idempotency_keys p
  WHERE p.scope='exam-paper' AND NOT EXISTS (SELECT 1 FROM idempotency_keys r WHERE r.account_id=p.account_id AND r.scope='exam-result' AND r.key=p.key)`;
async function openPapers(db, accountId) {
  const rows = await db.all(UNFINALISED + ' AND p.account_id=? ORDER BY p.created_at', [accountId]);
  const open = [];
  for (const row of rows) {
    let paper;
    try { paper = JSON.parse(row.response_json); } catch { continue; }
    open.push({ id: row.key, title: paper.title, deadline: paper.deadline });
  }
  return open;
}

/** Null, or the refusal for an account that already holds its limit of open papers. */
async function openPaperRefusal(db, accountId) {
  const open = await openPapers(db, accountId);
  if (open.length < MAX_OPEN_PAPERS) return null;
  return { status: 409, code: 'EXAM_OPEN_PAPER_LIMIT', openExamId: open[0].id, openExamIds: open.map(o => o.id), limit: MAX_OPEN_PAPERS,
    message: `You have ${open.length} papers still open. Finish one, or carry on with it, before starting another.` };
}

const refuseOpenLimit = (res, r) => res.status(r.status).json({ error: { code: r.code, message: r.message, openExamId: r.openExamId, openExamIds: r.openExamIds, limit: r.limit } });

const refuseEntitlement = (res, r) => res.status(r.status).json({ error: {
  code: r.code, message: r.message, capability: r.capability,
  ...(r.nextAt ? { nextAt: r.nextAt, used: r.used, limit: r.limit, windowDays: r.windowDays } : {})
} });

// ── Finalising ───────────────────────────────────────────────────────────────

const SELECT = "SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope=? AND key=? AND expires_at>?";
const INSERT = 'INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,?,?,?,?,?,?)';

async function readRecord(db, accountId, scope, key, now) {
  const row = await db.get(SELECT, [accountId, scope, key, now]);
  return row ? JSON.parse(row.response_json) : null;
}

/** The server grader's own event writer for one account, inside the caller's transaction. */
async function serverEvents(db, accountId, now) {
  const last = await db.get("SELECT MAX(device_seq) AS n FROM learning_events WHERE account_id=? AND device_id='server-grader'", [accountId]);
  let seq = Number(last?.n || 0);
  return async (eventId, kind, entityId, payload) => {
    // The paper's id has been known to the device since the paper was
    // created. /v1/sync/push refuses server-shaped ids now, but a row a
    // device stored on this id before it did must not make this insert —
    // and with it the whole finalisation — fail for ever.
    await displaceDeviceEvent(db, accountId, eventId);
    const cursor = await nextSyncCursor(db, accountId);
    await db.run("INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at) VALUES (?,?,?, 'server-grader',?,?,?,?,?,?)",
      [cursor, eventId, accountId, ++seq, kind, entityId, now, JSON.stringify(payload), now]);
  };
}

/**
 * The one finalisation: the paper is marked in the marker pool with no
 * transaction open, and its result is committed in one transaction under the
 * account's sync lock, which re-reads what was marked before it writes.
 * `body` is a device's finish request, or null when the server is finalising a
 * paper nobody finished (its time and grace have passed): then, and for any
 * finish that arrives late, only the last snapshot the server holds is marked.
 * Whoever gets here second is given the stored result; nothing is marked twice.
 * Returns { result, written? } | { status, code?, message? } | { open: true }
 * (an unattended call on a paper that is still inside its time). `written` is
 * true only for the call that wrote the result. `authorise(consentBlockedBefore)`
 * is the device route's commit-time session/consent recheck; the server's own
 * unattended finalisation has none. A finalisation the pool refused before it
 * could mark answers { status: 503, code: MARKING_BUSY } and writes nothing.
 */
async function finalise(db, accountId, id, body, fixedNow = null, authorise = null) {
  // One instant for the whole finalisation: the moment the request arrived
  // (or the sweep ran). A finish that arrived inside the paper's time is not
  // made late by the time its own marking takes.
  const now = fixedNow ?? Date.now();
  const unattended = body === null;
  // Everything the marking depends on. Called twice: outside any transaction
  // to know what to mark, and again inside the committing transaction, under
  // the account's lock, where it alone decides.
  const read = async () => {
    const paperRow = await db.get(SELECT, [accountId, 'exam-paper', id, now]);
    if (!paperRow) return { status: 404 };
    const paper = JSON.parse(paperRow.response_json);
    // Replay first: the reply to a finish that committed before a timeout
    // stays available, whatever the retry carries.
    const stored = await readRecord(db, accountId, 'exam-result', id, now);
    if (stored) return { result: stored };
    const inTime = now <= paper.deadline + FINISH_GRACE_MS;
    if (unattended && inTime) return { open: true };
    let carried = { answers: {}, workings: {}, times: {}, modes: {}, ink: {} };
    if (!unattended) {
      if (!plain(body) || unknown(body, FINISH_FIELDS).length
          || (body.reason !== undefined && body.reason !== 'student' && body.reason !== 'deadline')
          || (body.submissionKey !== undefined && !(typeof body.submissionKey === 'string' && ID.test(body.submissionKey)))
          || (body.ms !== undefined && (typeof body.ms !== 'number' || !Number.isFinite(body.ms) || body.ms < 0))) {
        return { status: 400, code: 'EXAM_FINISH_INVALID', message: 'Send the answers for this paper only.' };
      }
      carried = readResponses(body, paper);
      if (!carried) return { status: 400, code: 'EXAM_FINISH_INVALID', message: 'Send the answers for this paper only.' };
    }
    const snapshot = await readRecord(db, accountId, 'exam-answers', id, now);
    const saved = snapshot
      ? { answers: snapshot.answers || {}, workings: snapshot.workings || {}, times: snapshot.times || {}, modes: snapshot.modes || {}, ink: snapshot.ink || {} }
      : { answers: {}, workings: {}, times: {}, modes: {}, ink: {} };
    // In time: what the request carries, falling back to the snapshot for
    // anything it left out. Late: only what the server had already saved.
    const responses = inTime ? {
      answers: body.answers === undefined || body.answers === null ? saved.answers : carried.answers,
      workings: body.workings === undefined || body.workings === null ? saved.workings : carried.workings,
      times: body.times === undefined || body.times === null ? saved.times : carried.times,
      modes: body.modes === undefined || body.modes === null ? saved.modes : carried.modes,
      // Which handwritten pages were captured and not read, by the digest of
      // their picture. Late: only the digests saved before deadline + grace.
      ink: body.ink === undefined || body.ink === null ? saved.ink : carried.ink
    } : saved;
    // What was marked: the sealed paper and exactly these responses.
    const marking = digest(paperRow.response_json + '\n' + JSON.stringify(responses));
    return { paper, inTime, snapshot, responses, marking };
  };

  // ── Mark first, with no transaction open; then commit under the lock ──────
  // The marker is awaited work on another thread (markerPool.js) and may not
  // be awaited inside a store transaction. So: read → mark in the pool →
  // open the transaction, READ AGAIN and commit only if what was marked is
  // still exactly what must be marked. A finish that lost a race reads the
  // stored result there and returns it; nothing is marked into the record
  // twice. If a newer answer snapshot arrived in between and changes the
  // responses, nothing is written and the paper is marked again.
  for (let round = 0; round < 3; round++) {
    const forecast = await read();
    if (forecast.status || forecast.result || forecast.open) return forecast;
    // An account that is cooling down after several stopped entries gets one
    // deadline's worth of marking for the paper instead of the whole budget.
    const [consentBlockedBefore, cooling] = await Promise.all([
      authorise ? consentBlockedNow(db, accountId) : null, markerCooldownUntil(db, accountId)]);
    const marked = await markResponsesIsolated(forecast.paper, forecast.responses, accountId, cooling ? markerPool().deadlineMs : null);
    if (marked.kills) await recordMarkerKills(db, accountId, marked.kills);
    // Refused before a part ran: nothing is known about it, so nothing is
    // committed. A device retries; the sweep counts it and comes back.
    if (marked.busy) return { status: 503, code: MARKING_BUSY, message: BUSY_MESSAGE };
    const outcome = await commit(forecast, marked.results, consentBlockedBefore);
    if (!outcome.again) return outcome;
  }
  return { status: 503, code: MARKING_BUSY, message: BUSY_MESSAGE };

  function commit(forecast, results, consentBlockedBefore) { return db.transaction(async () => {
    if (authorise) {
      const refused = await authorise(consentBlockedBefore);
      if (refused) return refused;
    }
    const state = await read();
    if (state.status || state.result || state.open) return state;
    if (state.marking !== forecast.marking) return { again: true };
    const { paper, inTime, snapshot, responses } = state;
    const elapsed = Math.max(0, Math.min(now, paper.deadline) - paper.startedAt);
    const totalMs = inTime && body.ms > 0 ? Math.min(Math.round(body.ms), MAX_MS) : elapsed;
    // What this account had been shown the solution of BEFORE this paper is
    // marked: those items are repeats. Then every item of this paper joins
    // them, because the result below discloses all of its solutions. Read
    // here, under the lock: which items are repeats does not affect any mark,
    // so it needs no second marking.
    const contentKeys = paper.questions.flatMap(sq => examItemsOf(sq.payload).flatMap(seenKeysOf));
    const seen = await seenAmong(db, accountId, contentKeys);
    let next = 0;
    const marked = markPaper(paper, responses, { now, totalMs, seen, mark: () => results[next++] });
    const result = {
      authoritative: true, examId: id, kind: paper.kind, title: paper.title,
      blueprint: paper.blueprint, paper: paper.paper, paperVersion: paper.paperVersion,
      startedAt: paper.startedAt, deadline: paper.deadline, finishedAt: now, serverAcknowledgedAt: now,
      late: !inTime, finalisedBy: inTime ? (body.reason === 'deadline' ? 'deadline' : 'student') : 'deadline',
      inputSource: inTime ? 'submission' : 'server-snapshot-before-deadline',
      // True when no device finished the paper: the server closed it itself.
      ...(unattended ? { unattended: true } : {}),
      snapshotSavedAt: snapshot?.savedAt ?? null,
      submissionKey: !unattended && typeof body.submissionKey === 'string' ? body.submissionKey : null,
      score: marked.score, total: marked.total, pct: marked.pct, detail: marked.detail, summary: marked.summary,
      // Handwriting captured and never read: frozen here by the digest of its
      // picture, pending, and owned by this row from now on (see the header).
      ...(marked.pendingKeys.length ? { handwriting: {
        frozenAt: now, submissionDigest: digest(JSON.stringify(responses)),
        maxAttempts: HANDWRITING_MAX_ATTEMPTS, windowEndsAt: now + HANDWRITING_RECOVERY_WINDOW_MS,
        pages: Object.fromEntries(marked.pendingKeys.map(key => [key, {
          key, questionId: key.split('::')[0], digest: responses.ink[key],
          // When, and on what evidence, the server came to hold this digest.
          evidence: inTime && !(body.ink === undefined || body.ink === null) ? 'submission-in-time' : 'snapshot-before-deadline',
          receivedAt: inTime && !(body.ink === undefined || body.ink === null) ? now : (snapshot?.savedAt ?? null),
          snapshotRev: inTime && !(body.ink === undefined || body.ink === null) ? null : (snapshot?.rev ?? null),
          state: 'awaiting-reading', reason: 'not-read', attempts: 0, lastAttemptAt: null, nextAttemptAt: now, resolvedAt: null
        }]))
      } } : {})
    };
    const json = JSON.stringify(result);
    await db.run(INSERT, [accountId, 'exam-result', id, json, digest(json), now, now + RECORD_TTL]);
    await markSeen(db, accountId, contentKeys, now);
    // Progress is committed in the same transaction as the immutable result.
    const event = await serverEvents(db, accountId, now);
    for (const a of marked.attempts) await event(a.attemptId, 'graded-attempt', a.questionId, a);
    // `exam-result` is a kind only this server writes: /v1/sync/push does not
    // accept it, so no device can publish a paper as server-marked.
    await event(id, 'exam-result', id, {
      state: 'finished', examId: id, serverMarked: true, kind: paper.kind, title: paper.title, durationMin: paper.durationMin,
      year: paper.blueprint?.grade ?? paper.paper?.year ?? null,
      score: marked.score, total: marked.total, late: !inTime,
      createdAt: paper.startedAt, finishedAt: now, serverAcknowledgedAt: now,
      blueprint: paper.blueprint, questions: paper.questions.length, attempted: marked.attempts.length,
      // Answers still waiting on handwriting: the score above is not final.
      ...(marked.pendingKeys.length ? { pendingHandwriting: marked.pendingKeys.length } : {}),
      // What a second device needs to file the paper under its track.
      indiaExam: paper.kind === 'india' ? {
        blueprintId: paper.blueprint.id, label: paper.blueprint.label, track: paper.blueprint.track,
        variant: paper.blueprint.variant, grade: paper.blueprint.grade
      } : null
    });
    return { result, written: true };
  }, { accountScope: accountId, lock: syncLockKey(accountId) }); }
}

// ── Handwriting read after the paper closed ─────────────────────────────────

/** A frozen page as it stands now: past the recovery window it is a person's to resolve. */
function pageView(page, handwriting, now) {
  if (page.state === 'resolved') return { ...page, triesLeft: 0, canRetry: false, retryAt: null };
  const triesLeft = Math.max(0, HANDWRITING_MAX_ATTEMPTS - Number(page.attempts || 0));
  if (now > Number(handwriting.windowEndsAt)) return { ...page, state: 'needs-review', reason: 'window-closed', nextAttemptAt: null, triesLeft: 0, canRetry: false, retryAt: null };
  if (!triesLeft) return { ...page, state: 'needs-review', reason: 'retries-exhausted', nextAttemptAt: null, triesLeft: 0, canRetry: false, retryAt: null };
  // The first read is the automatic one; every later one is the student's own.
  return { ...page, triesLeft, canRetry: Number(page.attempts || 0) >= 1, retryAt: Number(page.nextAttemptAt) > now ? Number(page.nextAttemptAt) : null };
}
/** May a read be started for this page (as viewed) now, by this kind of request? */
const mayAttempt = (page, now, retry) => page.state !== 'resolved' && page.triesLeft > 0 && now >= Number(page.nextAttemptAt || 0)
  && (Number(page.attempts || 0) === 0 || retry === true);

/**
 * The stored result as its owner reads it. A result with no pending
 * handwriting is returned as stored. One with some says so: `provisional`
 * while any page is unresolved, and how many marks are not yet decided.
 */
export function resultView(result, now) {
  const handwriting = result?.handwriting;
  if (!handwriting) return result;
  const pages = Object.fromEntries(Object.entries(handwriting.pages).map(([key, page]) => [key, pageView(page, handwriting, now)]));
  let pendingMarks = 0;
  for (const d of result.detail) {
    if (d.multipart) for (const part of d.parts) { if (part.pending) pendingMarks += Number(part.marks) || 0; }
    else if (d.pending) pendingMarks += Number(d.marks) || 0;
  }
  return { ...result, handwriting: { ...handwriting, pages }, provisional: Object.values(pages).some(page => page.state !== 'resolved'), pendingMarks };
}

/** A marker response rebuilt from a stored line or part: what was decided stands. */
const responseOfLine = d => ({
  unanswered: d.unanswered === true, correct: d.correct === true, awarded: d.awarded, feedback: d.feedback, partial: d.partial ?? null,
  markingScheme: d.markingScheme, outcome: d.outcome, ...cutOffFlags(d)
});

/** The answer key a stored line or part was marked under. */
const keyOfLine = (sq, d, part = null) => (part
  ? `${sq.id}::${part.key}${part.choiceTaken === 'or' ? '::or' : ''}`
  : `${sq.id}${d.choiceTaken === 'or' ? '::or' : ''}`);

/**
 * The responses one stored question line was marked on, with the page that has
 * just been read put in as its answer. Everything else is the frozen line's.
 */
function lineResponses(sq, old, key, given, working) {
  const answers = {}, workings = {}, ink = {};
  const keep = (k, d) => {
    if (!blank(d.given)) answers[k] = String(d.given);
    if (!blank(d.working)) workings[k] = String(d.working);
    if (d.pending) ink[k] = 'pending';
  };
  if (old.multipart) for (const part of old.parts) keep(keyOfLine(sq, old, part), part);
  else keep(keyOfLine(sq, old), old);
  answers[key] = given;
  if (!blank(working)) workings[key] = working; else delete workings[key];
  delete ink[key];
  return { answers, workings, times: old.timed ? { [sq.id]: old.ms } : {}, modes: { [key]: 'ink' }, ink };
}

/** The answer a confident reading states, by the rule the exam room itself uses. */
function answerFromReading(item, lines) {
  if (item.answerType === 'working') return { given: lines.join('\n'), working: undefined };
  const supportsSteps = !OBJECTIVE.has(item.answerType) && !!stepMetaFor(item);
  return { given: lines[lines.length - 1], working: supportsSteps && lines.length > 1 ? lines.join('\n') : undefined };
}

/**
 * Read ONE page of handwriting that was frozen, unread, when the paper was
 * finalised, and mark the answer it states. See "HANDWRITING NOT READ" in the
 * header for the rule; in short: the picture must be the frozen one, a read is
 * reserved in the result row before the reader is asked, at most
 * HANDWRITING_MAX_ATTEMPTS are ever started, and only this one line changes.
 * Returns { result, attempted, retryAt? } | { status, code, message }.
 */
async function resolveHandwriting(db, accountId, id, body, { env, transcribe, requestId = null, authorise = null }) {
  const now = Date.now();
  if (!plain(body) || unknown(body, HANDWRITING_FIELDS).length || typeof body.key !== 'string' || body.key.length > 240 || typeof body.image !== 'string'
      || (body.retry !== undefined && typeof body.retry !== 'boolean')) {
    return { status: 400, code: 'EXAM_HANDWRITING_INVALID', message: 'Send the answer the page belongs to and its picture.' };
  }
  try { validateImage(body.image); }
  catch (error) { return { status: error?.status || 400, code: safeCode(error?.code, 'HANDWRITING_IMAGE_INVALID'), message: 'The picture of this page could not be accepted.' }; }
  const key = body.key;
  const lock = { accountScope: accountId, lock: syncLockKey(accountId) };

  const load = async () => {
    const paperRow = await db.get(SELECT, [accountId, 'exam-paper', id, now]);
    if (!paperRow) return { status: 404 };
    const result = await readRecord(db, accountId, 'exam-result', id, now);
    if (!result) return { status: 409, code: 'EXAM_NOT_FINALISED', message: 'This paper is still open. Read your handwriting on the paper itself.' };
    const stored = result.handwriting?.pages?.[key];
    if (!stored) return { status: 409, code: 'EXAM_HANDWRITING_NOT_PENDING', message: 'No handwriting is waiting to be read for this answer.' };
    return { paper: JSON.parse(paperRow.response_json), result, stored, page: pageView(stored, result.handwriting, now) };
  };
  const asItStands = state => ({
    result: resultView(state.result, now), attempted: false,
    ...(state.page.retryAt ? { retryAt: state.page.retryAt } : {})
  });
  const write = result => {
    const json = JSON.stringify(result);
    return db.run("UPDATE idempotency_keys SET response_json=?, request_digest=? WHERE account_id=? AND scope='exam-result' AND key=?", [json, digest(json), accountId, id]);
  };
  const withPage = (result, page) => ({ ...result, handwriting: { ...result.handwriting, pages: { ...result.handwriting.pages, [key]: page } } });

  const first = await load();
  if (first.status) return first;
  if (first.page.state === 'resolved' || !first.page.triesLeft) return asItStands(first);
  // Only the picture frozen with the paper can be read: not a page written,
  // erased or photographed again afterwards.
  const presented = createHash('sha256').update(Buffer.from(body.image.slice(body.image.indexOf(',') + 1), 'base64')).digest('hex');
  if (presented !== first.page.digest) {
    return { status: 409, code: 'EXAM_HANDWRITING_CHANGED', message: 'This is not the handwriting that was saved when the paper closed. Only that page can be read.' };
  }
  // Not yet allowed, or a second automatic read: nothing starts.
  if (!mayAttempt(first.page, now, body.retry)) return asItStands(first);

  // ── Reserve the read, in the row, before the reader is asked ──────────────
  // Whoever gets here second (a second tap, a second tab, another replica)
  // finds the attempt taken and its backoff running, and starts nothing.
  const reserved = await db.transaction(async () => {
    if (authorise) { const refused = await authorise(); if (refused) return refused; }
    const state = await load();
    if (state.status) return state;
    if (!mayAttempt(state.page, now, body.retry)) return asItStands(state);
    const attempts = Number(state.stored.attempts || 0) + 1;
    await write(withPage(state.result, {
      ...state.stored, attempts, lastAttemptAt: now,
      nextAttemptAt: now + HANDWRITING_BACKOFF_MS[Math.min(attempts, HANDWRITING_BACKOFF_MS.length) - 1]
    }));
    return { attempts, paper: state.paper, result: state.result };
  }, lock);
  if (!reserved.attempts) return reserved;

  // ── One bounded read (a kept read of the same picture is reused, free) ────
  let failure = null, read = null;
  try {
    // The one automatic read reuses a kept read of this picture (free). The
    // student's own Retry checking asks for a new reading, not a replay of
    // the uncertain one.
    read = await recognitionOpsFor(db).read({ db, accountId, image: body.image, env, transcribe, requestId, fresh: body.retry === true && reserved.attempts > 1 });
    if (read.refusal) {
      failure = { reason: 'capacity', code: safeCode(read.refusal.verdict?.code, 'CAPACITY_REFUSED'), retryAt: Number(read.refusal.verdict?.resetAt) || 0 };
    }
  } catch (error) {
    failure = { reason: 'reader-unavailable', code: safeCode(error?.code, 'HANDWRITING_FAILED') };
  }
  const lines = failure ? [] : (Array.isArray(read.result?.lines) ? read.result.lines : []).map(line => String(line?.text ?? '').trim()).filter(Boolean).slice(0, 40);
  // A reading the reader itself doubts is never marked here: there is no
  // student at the page to confirm it. An empty one states no answer.
  const terminal = failure ? null : !lines.length ? 'unreadable' : read.result.needsConfirmation === true ? 'uncertain' : null;

  // ── Mark the one answer, in the pool, with no transaction open ────────────
  let response = null, located = null;
  if (!failure && !terminal) {
    const [qid] = key.split('::');
    const sq = reserved.paper.questions.find(question => question.id === qid);
    const old = reserved.result.detail.find(d => d.id === qid);
    const one = { ...reserved.paper, questions: [sq] };
    const placeholder = { unanswered: true, correct: false, awarded: 0, feedback: '', partial: null, markingScheme: 'objective', outcome: 'unanswered' };
    // The item is found the way markPaper finds it, so the two cannot drift.
    let item = null;
    markPaper(one, lineResponses(sq, old, key, 'x', undefined), { now: 0, totalMs: 0, mark: (q, given, working, grid, k) => { if (k === key) item = { q, grid }; return placeholder; } });
    if (!item) failure = { reason: 'reader-unavailable', code: 'EXAM_HANDWRITING_KEY' };
    else {
      const stated = answerFromReading(item.q, lines);
      const job = { q: item.q, given: stated.given.slice(0, MAX_ANSWER), working: stated.working?.slice(0, MAX_WORKING), grid: item.grid };
      const pool = markerPool();
      const out = await pool.run('exam', job, { key: accountId, deadlineMs: pool.deadlineMs });
      if (!out.ok && out.code === MARKING_BUSY) failure = { reason: 'marking-busy', code: MARKING_BUSY };
      else {
        if (!out.ok) await recordMarkerKills(db, accountId, 1);
        response = out.ok ? out.value.response : stoppedResponse(out, job);
        located = { sq, job };
      }
    }
  }

  // ── Commit under the lock, on what the row says now ───────────────────────
  return db.transaction(async () => {
    if (authorise) { const refused = await authorise(); if (refused) return refused; }
    const state = await load();
    if (state.status) return state;
    // Settled meanwhile, or this is not the attempt the row is waiting on.
    if (state.stored.state === 'resolved' || Number(state.stored.attempts) !== reserved.attempts) return asItStands(state);
    let result = state.result;
    let page;
    if (failure) {
      const spent = reserved.attempts >= HANDWRITING_MAX_ATTEMPTS;
      page = {
        ...state.stored, lastFailure: failure.code,
        state: spent ? 'needs-review' : 'awaiting-reading', reason: spent ? 'retries-exhausted' : failure.reason,
        nextAttemptAt: spent ? null : Math.max(Number(state.stored.nextAttemptAt) || 0, failure.retryAt || 0)
      };
    } else if (terminal) {
      // Kept for the person who resolves it; never marked from here.
      // The student may ask again while tries remain — not before a kept read
      // of this picture has expired, so a retry is a new reading, not a replay.
      page = { ...state.stored, state: 'needs-review', reason: terminal, transcript: lines, reused: read.reused === true,
        nextAttemptAt: now + HANDWRITING_BACKOFF_MS[HANDWRITING_BACKOFF_MS.length - 1] };
    } else {
      const { sq, job } = located;
      const index = result.detail.findIndex(d => d.id === sq.id);
      const old = result.detail[index];
      const partKey = sq.payload.multipart ? key.split('::')[1] : null;
      const oldByKey = new Map(old.multipart ? old.parts.map(part => [keyOfLine(sq, old, part), part]) : [[keyOfLine(sq, old), old]]);
      const rebuilt = markPaper({ ...state.paper, questions: [sq] }, lineResponses(sq, old, key, job.given, job.working), {
        now, totalMs: old.ms, seen: null,
        mark: (q, given, working, grid, k) => (k === key ? response : responseOfLine(oldByKey.get(k) || { unanswered: true, correct: false, awarded: 0, feedback: '', markingScheme: 'final-answer', outcome: 'unanswered' }))
      });
      const fresh = rebuilt.detail[0];
      // Whether this was content the account had already seen was decided when
      // the paper was finalised; it is not decided again now.
      const carry = (line, was) => { const next = { ...line, readAfterClose: true }; delete next.repeat; return was?.repeat ? { ...next, repeat: true } : next; };
      let line, written;
      if (old.multipart) {
        const parts = fresh.parts.map(part => (String(part.key) === partKey ? carry(part, old.parts.find(p => String(p.key) === partKey)) : old.parts.find(p => String(p.key) === String(part.key))));
        line = { ...fresh, parts };
        delete line.repeat;
        if (old.repeat) line.repeat = true;
        written = rebuilt.attempts.filter(a => a.part === partKey).map(a => { const next = { ...a }; delete next.repeat; return old.parts.find(p => String(p.key) === partKey)?.repeat ? { ...next, repeat: true } : next; });
      } else {
        line = carry(fresh, old);
        written = rebuilt.attempts.map(a => { const next = { ...a }; delete next.repeat; return old.repeat ? { ...next, repeat: true } : next; });
      }
      const detail = result.detail.slice();
      detail[index] = line;
      const totals = summarise(state.paper, detail, result.summary.totalMs);
      result = { ...result, score: totals.score, total: totals.total, pct: totals.pct, detail, summary: totals.summary };
      page = { ...state.stored, state: 'resolved', reason: null, nextAttemptAt: null, resolvedAt: now, transcript: lines, reused: read.reused === true };
      const event = await serverEvents(db, accountId, now);
      for (const a of written) await event(a.attemptId, 'graded-attempt', a.questionId, a);
      // The paper's own event says the score as it now is.
      const row = await db.get("SELECT payload_json FROM learning_events WHERE account_id=? AND id=? AND device_id='server-grader' AND kind='exam-result'", [accountId, id]);
      if (row) {
        let payload = null;
        try { payload = JSON.parse(row.payload_json); } catch { payload = null; }
        if (payload) {
          const open = Object.entries(result.handwriting.pages).filter(([k, p]) => k !== key && p.state !== 'resolved').length;
          const next = { ...payload, score: totals.score, total: totals.total, attempted: (Number(payload.attempted) || 0) + written.length };
          if (open) next.pendingHandwriting = open; else delete next.pendingHandwriting;
          await db.run("UPDATE learning_events SET payload_json=? WHERE account_id=? AND id=? AND device_id='server-grader' AND kind='exam-result'", [JSON.stringify(next), accountId, id]);
        }
      }
    }
    result = withPage(result, page);
    await write(result);
    const viewed = resultView(result, now);
    return { result: viewed, attempted: true, ...(viewed.handwriting.pages[key].retryAt ? { retryAt: viewed.handwriting.pages[key].retryAt } : {}) };
  }, lock);
}

/**
 * Finalise every paper whose deadline + grace has passed and that nobody
 * finished: one account's (before it starts or reads a paper) or, with no
 * account, everybody's (housekeeping). Each paper is its own transaction under
 * its account's lock, so this is safe beside a device finishing the same paper
 * at the same moment — one of them writes the result, the other reads it.
 *
 * One paper that cannot be finalised never stops the rest: its failure is
 * counted and logged (a code, never the paper or its answers) and the pass
 * moves on. Only a database that is refusing work altogether ends the pass.
 * Returns { finalised, failed }: how many papers this call finalised, and how
 * many it had to leave.
 */
export async function sweepExpiredExams(db, { accountId = null, now = null, limit = 500 } = {}) {
  db = asStore(db);
  const at = now ?? Date.now();
  // No paper is shorter than ten minutes, so anything younger cannot be due.
  const due = at - FINISH_GRACE_MS - 10 * 60 * 1000;
  const rows = accountId
    ? await db.all(UNFINALISED + ' AND p.created_at<=? AND p.account_id=? ORDER BY p.created_at LIMIT ?', [due, accountId, limit])
    : await db.all(UNFINALISED + ' AND p.created_at<=? ORDER BY p.created_at LIMIT ?', [due, limit]);
  let finalised = 0, failed = 0;
  for (const row of rows) {
    let paper;
    try { paper = JSON.parse(row.response_json); } catch { continue; }
    if (!(at > Number(paper.deadline) + FINISH_GRACE_MS)) continue;
    try {
      const outcome = await finalise(db, String(row.account_id), String(row.key), null, now);
      if (outcome.written) finalised++;
    } catch (error) {
      if (isDatabaseOverload(error)) throw error;
      failed++;
      logEvent('error', 'platform_error', { code: 'EXAM_SWEEP_PAPER_FAILED', dbCode: safeCode(error?.code, 'UNKNOWN') });
    }
  }
  return { finalised, failed };
}

/** As sweepExpiredExams, returning only how many papers were finalised. */
export async function finaliseExpiredExams(db, options = {}) {
  return (await sweepExpiredExams(db, options)).finalised;
}

// ── Router ───────────────────────────────────────────────────────────────────

export function createExamRouter(db, { transcribe = transcribeHandwriting, env = process.env } = {}) {
  db = asStore(db);
  const router = asyncRouter();
  router.use(requireSession(db), requireVerifiedEmail, requireRole('student'));
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  const read = (accountId, scope, key, now) => readRecord(db, accountId, scope, key, now);

  const LAYOUT_SELECT = "SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='exam-layout' AND key=? AND expires_at>?";
  /** The layout seed this account is holding for a blueprint, or null. */
  const pendingLayout = async (accountId, blueprint, now) => {
    const row = await db.get(LAYOUT_SELECT, [accountId, layoutKeyOf(blueprint), now]);
    if (!row) return null;
    try { return Number(JSON.parse(row.response_json).layoutSeed) || null; } catch { return null; }
  };
  const LAYOUT_NOT_ISSUED = { status: 409, code: 'EXAM_LAYOUT_NOT_ISSUED',
    message: 'This paper was not composed for the layout the server set. Ask for the layout again and compose the paper for it.' };

  // The layout of the account's NEXT paper for a blueprint. Chosen here, held
  // until a paper is sealed under it (or the server finds it cannot issue that
  // paper), and returned unchanged to every request in between: there is one
  // layout to take, not a draw to repeat until a favourable one comes up.
  router.post('/layout', rateLimit(db, 'exam-layout', { limit: 120, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const body = req.body;
    if (!plain(body) || unknown(body, LAYOUT_FIELDS).length) return reject(res, 400, 'EXAM_SPEC_INVALID', 'Name the track, class and variant of the paper.');
    const named = readBlueprint(body.blueprint);
    if (named.refused) return reject(res, ...named.refused);
    const accountId = req.platformSession.account_id;
    const blueprint = { track: named.track, grade: named.grade, variant: named.variant };
    const layoutSeed = await db.transaction(async () => {
      const now = Date.now();
      const held = await pendingLayout(accountId, blueprint, now);
      if (held) return held;
      const chosen = 1 + randomInt(0x7ffffffe);
      const json = JSON.stringify({ layoutSeed: chosen });
      // An expired row under the same key is replaced; a live one never is.
      await db.run(INSERT + ' ON CONFLICT(account_id,scope,key) DO UPDATE SET response_json=excluded.response_json, request_digest=excluded.request_digest, created_at=excluded.created_at, expires_at=excluded.expires_at',
        [accountId, 'exam-layout', layoutKeyOf(blueprint), json, digest(json), now, now + RECORD_TTL]);
      return chosen;
    }, { accountScope: accountId, lock: 'exam-create:' + accountId });
    return res.status(200).json({ blueprint, layoutSeed, accountId: String(accountId) });
  });

  router.post('/', rateLimit(db, 'exam-create', { limit: 60, windowMs: 60 * 60 * 1000 }), async (req, res) => {
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
    // A retried create is the same paper: it is answered before, and never
    // counted by, the allowance below.
    if (before) return replay(before);

    // A paper this account abandoned past its time is finalised before anything
    // is counted: it stays an open paper until it has a result, and it has one
    // before the limits below are read.
    await finaliseExpiredExams(db, { accountId });

    // A blueprint paper is composed for the layout the server set, and no other.
    if (spec.kind === 'india' && (await pendingLayout(accountId, spec.blueprint, Date.now())) !== spec.layoutSeed) {
      return reject(res, LAYOUT_NOT_ISSUED.status, LAYOUT_NOT_ISSUED.code, LAYOUT_NOT_ISSUED.message);
    }

    // Refused early so nothing is generated for a paper that cannot start; the
    // authoritative check is repeated inside the transaction that seals it.
    const early = await entitlementRefusal(db, accountId, spec, Date.now());
    if (early) return refuseEntitlement(res, early);
    // Papers cannot be started in bulk and the best one kept: an account holds
    // a few open at most, whatever its plan.
    const tooMany = await openPaperRefusal(db, accountId);
    if (tooMany) return refuseOpenLimit(res, tooMany);

    // Questions are chosen before the transaction: no generator runs while a
    // database lock is held.
    const issued = await issueQuestions(spec);
    if (issued.refused) {
      // The server could not issue this layout's paper from the banks. The
      // layout is retired — by the server, never at the device's asking — so
      // the next request is given another instead of the same dead end.
      if (spec.kind === 'india') {
        await db.run("DELETE FROM idempotency_keys WHERE account_id=? AND scope='exam-layout' AND key=? AND response_json=?",
          [accountId, layoutKeyOf(spec.blueprint), JSON.stringify({ layoutSeed: spec.layoutSeed })]);
      }
      return reject(res, ...issued.refused);
    }
    const id = randomUUID();
    const startedAt = Date.now();
    const paper = {
      v: 1, id, kind: spec.kind, title: spec.title, durationMin: spec.durationMin,
      startedAt, deadline: startedAt + spec.durationMin * 60000,
      blueprint: spec.blueprint || null, paper: spec.paper || null,
      ...(spec.kind === 'india' ? { layoutSeed: spec.layoutSeed } : {}),
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
      // Under the account's create lock: two simultaneous starts cannot both
      // take the last free simulation, and a refused start seals nothing.
      const refused = await entitlementRefusal(db, accountId, spec, startedAt);
      if (refused) return { refused };
      const tooManyOpen = await openPaperRefusal(db, accountId);
      if (tooManyOpen) return { tooManyOpen };
      if (spec.kind === 'india') {
        // The layout is spent by the paper sealed under it, in the same
        // transaction: two simultaneous creates cannot both use one layout.
        if ((await pendingLayout(accountId, spec.blueprint, startedAt)) !== spec.layoutSeed) return { layoutGone: true };
        await db.run("DELETE FROM idempotency_keys WHERE account_id=? AND scope='exam-layout' AND key=?", [accountId, layoutKeyOf(spec.blueprint)]);
      }
      await db.run(INSERT, [accountId, 'exam-paper', id, sealed, digest(sealed), startedAt, startedAt + RECORD_TTL]);
      await db.run(INSERT, [accountId, 'exam-create', idem, JSON.stringify({ examId: id }), requestDigest, startedAt, startedAt + RECORD_TTL]);
      return {};
    }, { accountScope: accountId, lock: 'exam-create:' + accountId });
    if (outcome.raced) return replay(outcome.raced);
    if (outcome.refused) return refuseEntitlement(res, outcome.refused);
    if (outcome.tooManyOpen) return refuseOpenLimit(res, outcome.tooManyOpen);
    if (outcome.layoutGone) return reject(res, LAYOUT_NOT_ISSUED.status, LAYOUT_NOT_ISSUED.code, LAYOUT_NOT_ISSUED.message);
    return res.status(201).json({ exam: publicPaper(paper, startedAt), accountId: String(accountId) });
  });

  // PUT is the contract; PATCH is the same handler, because the native iOS and
  // Android cloud bridges carry GET, POST, PATCH and DELETE only.
  const saveAnswers = async (req, res) => {
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
      const { ink, ...entered } = responses;
      // The digests of handwritten pages not yet read travel with the snapshot,
      // so a paper nobody finishes still knows which answers were written.
      const snapshot = { ...entered, ...(Object.keys(ink).length ? { ink } : {}), cur: body.cur ?? 0, rev: body.rev, savedAt: now };
      const json = JSON.stringify(snapshot);
      await db.run(INSERT + ' ON CONFLICT(account_id,scope,key) DO UPDATE SET response_json=excluded.response_json, request_digest=excluded.request_digest',
        [accountId, 'exam-answers', id, json, digest(json), now, now + RECORD_TTL]);
      return { reply: { saved: true, rev: body.rev, savedAt: now, ...timing } };
    }, { accountScope: accountId, lock: syncLockKey(accountId) });
    if (outcome.status === 404) return notFound(res);
    if (outcome.status) return reject(res, outcome.status, outcome.code, outcome.message);
    return res.status(200).json(outcome.reply);
  };
  router.put('/:id/answers', rateLimit(db, 'exam-answers', { limit: 1800, windowMs: 60 * 60 * 1000 }), saveAnswers);
  router.patch('/:id/answers', rateLimit(db, 'exam-answers', { limit: 1800, windowMs: 60 * 60 * 1000 }), saveAnswers);

  router.post('/:id/finish', rateLimit(db, 'exam-finish', { limit: 120, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const id = String(req.params.id || '');
    if (!UUID.test(id)) return notFound(res);
    const accountId = req.platformSession.account_id;
    // Marking takes time on another thread: the session (and a guardian's
    // consent, if it was in place) is rechecked where the result commits.
    const outcome = await finalise(db, accountId, id, req.body ?? {}, null,
      blockedBefore => authorityAtCommit(db, req, accountId, blockedBefore));
    if (outcome.status === 404) return notFound(res);
    if (outcome.status === 503) res.set('Retry-After', '2');
    if (outcome.status) return reject(res, outcome.status, outcome.code, outcome.message);
    return res.status(200).json(resultView(outcome.result, Date.now()));
  });

  // One page of handwriting that was frozen, unread, when the paper closed.
  // The limit is on requests; how many READS a page can ever start is bounded
  // in the result row itself (HANDWRITING_MAX_ATTEMPTS), whatever is sent here.
  router.post('/:id/handwriting', rateLimit(db, 'exam-handwriting', { limit: 120, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const id = String(req.params.id || '');
    if (!UUID.test(id)) return notFound(res);
    const accountId = req.platformSession.account_id;
    const blockedBefore = await consentBlockedNow(db, accountId);
    const outcome = await resolveHandwriting(db, accountId, id, req.body, {
      env, transcribe, requestId: req.requestId, authorise: () => authorityAtCommit(db, req, accountId, blockedBefore)
    });
    if (outcome.status === 404) return notFound(res);
    if (outcome.status) return reject(res, outcome.status, outcome.code, outcome.message);
    return res.status(200).json({ result: outcome.result, attempted: outcome.attempted === true, ...(outcome.retryAt ? { retryAt: outcome.retryAt } : {}) });
  });

  router.get('/:id', rateLimit(db, 'exam-read', { limit: 600, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const id = String(req.params.id || '');
    if (!UUID.test(id)) return notFound(res);
    const accountId = req.platformSession.account_id;
    // Any paper of this account's that ran out of time unfinished — this one
    // included — is finalised now, on the answers the server already holds.
    await finaliseExpiredExams(db, { accountId });
    const now = Date.now();
    const paper = await read(accountId, 'exam-paper', id, now);
    if (!paper) return notFound(res);
    const result = await read(accountId, 'exam-result', id, now);
    const exam = publicPaper(paper, now);
    if (result) return res.status(200).json({ state: 'finished', exam, result: resultView(result, now), accountId: String(accountId) });
    const snapshot = await read(accountId, 'exam-answers', id, now);
    return res.status(200).json({
      state: 'open', exam, snapshot: snapshot || null,
      // Past the deadline and its grace the paper is finalised above, so an
      // open paper read here is inside its time. The field stays for devices
      // that read it.
      expired: now > paper.deadline + FINISH_GRACE_MS, accountId: String(accountId)
    });
  });

  return router;
}
