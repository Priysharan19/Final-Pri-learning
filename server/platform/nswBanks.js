// Pri Learning — the NSW question banks the Prithagoras edition issues (plan
// mission G3, first slice; ADR-0002 decision 7). The counterpart of
// indiaBanks.js, and stricter: a bank is not issued because it exists, but
// because every one of these holds.
//
//   1. VERIFIED MAPPING. The G2 crosswalk (client/src/engine/curriculum-nsw/
//      crosswalk.js) marks the generator's subtopic `mapped`: each of its dot
//      points was located in a CURRENT NSW syllabus — Mathematics K–10 (2022)
//      or a Stage 6 (2024) syllabus. A `partial` or `retired` row is not
//      issued, whole: a generator one of whose dot points is in no current
//      syllabus is not Prithagoras content yet.
//   2. A DOT POINT BEHIND THE CELL. A (generator, difficulty) cell is issued
//      only when the registry (curriculum.js DOTPOINT_FORMS) says its authored
//      form assesses at least one dot point. A form that is "real practice
//      but assesses no dot point in the list" has no outcome code to carry, so
//      it is not issued.
//   3. A FINAL ANSWER. Prithagoras marks the final answer only until a human
//      HSC examiner has certified rubrics (plan G6; markingPolicy.js). A
//      question whose answer IS its working (answerType 'working') has no
//      final answer to mark, so it is never issued here, question by question.
//   4. THE QUALITY GATE. server/test/nsw-bank-quality-check.mjs sweeps every
//      issued cell over many seeds: the stored answer is accepted, wrong
//      answers are refused, options are distinct, the prompt renders. A cell or
//      bank that fails is listed in NSW_QUALITY_EXCLUSIONS below with the
//      reason, and is not issued — recorded, never patched over.
//
// EVERY ISSUED QUESTION CARRIES ITS IDENTITY. nswQuestionIdentity() names the
// jurisdiction, the syllabus id and version, and the outcome code(s) the
// question's dot point(s) were located at. practice.js seals it with the
// question (`_curriculum`) and refuses to issue a question it cannot name one
// for. "Located at" is the crosswalk's claim: the outcome where that content
// sits in the current syllabus — not a claim that the question covers the
// outcome, and not NESA's wording (none is stored).
//
// The server decides all of this from its own edition (edition.js,
// PRI_EDITION). No request field can ask for a bank outside it.
import {
  LEGACY_CROSSWALK, NEW_OUTCOME_GAPS, NSW_CURRENT_SYLLABUSES, NSW_OUTCOME_BY_CODE, NSW_SYLLABUS_BY_ID, outcomesOf
} from '../../client/src/engine/curriculum-nsw/index.js';
import { dotpointById, dotpointsFor, formDotpointOrdinals, DIFFICULTIES } from '../../client/src/engine/curriculum.js';
import { qbankCurriculum } from './qbankPack.js';

/** The course id a Prithagoras client names in a practice request. */
export const NSW_COURSE = 'nsw';

/**
 * Cells and banks the quality gate refused, with the reason. Keys are
 * `generator` (the whole bank) or `generator|difficulty` (one cell). The gate
 * fails if an entry names something that is not otherwise issuable, and it
 * re-runs the sweep on each entry and reports what it finds, so an entry that
 * no longer fails is visible.
 */
export const NSW_QUALITY_EXCLUSIONS = Object.freeze({
  // (Every cell recorded here earlier was repaired at its source, not patched over: key formats
  // that the marker could not read (a "% p.a." box, a "Δ =" or "x ≥" prefix, a zero-coefficient
  // key term) now key a plain number or expression; a set of rational solutions prints as
  // fractions (practice.js setValueText); me12-induction D4 now issues the checkable numbers
  // inside an induction (least starting value, the closing constant, the shared divisor), and a
  // written proof stays unissued because it has no final answer to mark. A tolerance wider than
  // the question asks for was fixed in engine/answerBand.js. The gate re-sweeps any new entry.)
});

const currentCode = code => Object.hasOwn(NSW_OUTCOME_BY_CODE, code);
const versionOf = syllabusId => NSW_SYLLABUS_BY_ID[syllabusId]?.version ?? null;

const ROW_BY_GENERATOR = new Map(LEGACY_CROSSWALK.map(row => [row.subtopicId, row]));

/** Why a crosswalk row is not issued at all, or null when it may be. */
function rowRefusal(row) {
  const unmapped = rowUnmapped(row);
  if (unmapped) return unmapped;
  if (Object.hasOwn(NSW_QUALITY_EXCLUSIONS, row.subtopicId)) return `quality gate: ${NSW_QUALITY_EXCLUSIONS[row.subtopicId]}`;
  return null;
}

/** Why a crosswalk row has no place in the bank whatever its quality, or null. */
function rowUnmapped(row) {
  if (row.status !== 'mapped') return `crosswalk status is ${row.status}: not every dot point is in a current NSW syllabus`;
  if (NSW_SYLLABUS_BY_ID[row.syllabus]?.status !== 'current') return 'its syllabus is not a current one';
  if (!row.dotpoints.length || !row.dotpoints.every(codes => codes.length && codes.every(currentCode))) return 'a dot point names no current outcome code';
  return null;
}

/** Why one cell of an issuable row has no place in the bank whatever its quality, or null. */
function cellUnmapped(row, difficulty) {
  if (!formDotpointOrdinals(row.subtopicId, difficulty).length) return 'its authored form assesses no dot point, so it has no outcome code to carry';
  return null;
}

/** Why one cell of an issuable row is not issued, or null when it is. */
function cellRefusal(row, difficulty) {
  const unmapped = cellUnmapped(row, difficulty);
  if (unmapped) return unmapped;
  const key = `${row.subtopicId}|${difficulty}`;
  if (Object.hasOwn(NSW_QUALITY_EXCLUSIONS, key)) return `quality gate: ${NSW_QUALITY_EXCLUSIONS[key]}`;
  return null;
}

/**
 * The whole ledger: one entry per legacy NSW generator the crosswalk
 * describes, saying whether it is issued, at which difficulties, and why not.
 */
export const NSW_BANK_LEDGER = Object.freeze(LEGACY_CROSSWALK.map(row => {
  const refusal = rowRefusal(row);
  const cells = DIFFICULTIES.map(difficulty => {
    const reason = refusal || cellRefusal(row, difficulty);
    return Object.freeze({ difficulty, issued: !reason, reason: reason || null });
  });
  const issued = cells.some(cell => cell.issued);
  return Object.freeze({
    generator: row.subtopicId,
    syllabus: row.syllabus,
    syllabusVersion: versionOf(row.syllabus),
    status: row.status,
    issued,
    reason: issued ? null : (refusal || 'no difficulty has an issuable form'),
    cells: Object.freeze(cells)
  });
}));

const ISSUED_CELLS = new Set(NSW_BANK_LEDGER.flatMap(entry => entry.cells.filter(cell => cell.issued).map(cell => `${entry.generator}|${cell.difficulty}`)));
const ISSUED_BANKS = new Set(NSW_BANK_LEDGER.filter(entry => entry.issued).map(entry => entry.generator));

/** Is this generator one Prithagoras issues from, at some difficulty? */
export function nswBank(generator) {
  return typeof generator === 'string' && ISSUED_BANKS.has(generator);
}

/** Is this (generator, difficulty) cell issued? */
export function nswCell(generator, difficulty) {
  return typeof generator === 'string' && ISSUED_CELLS.has(`${generator}|${Number(difficulty)}`);
}

export const NSW_BANK_COUNT = ISSUED_BANKS.size;
export const NSW_CELL_COUNT = ISSUED_CELLS.size;

/**
 * The curriculum identity of one generated question (ADR-0002 decision 7), or
 * null when it has none — and a question with none is not issued.
 *
 * `outcomes` are the codes the crosswalk located the question's dot point(s)
 * at, each with the syllabus that owns it (a dot point can sit in another
 * course or Stage than Pri's label; the crosswalk says where). `exact` is the
 * generator's own claim (generateQuestion's `dotpoint`): true when the
 * question is pinned to ONE dot point, false when its cell names several and
 * nothing says which this question exercises — the outcomes are then every
 * one the cell may land on.
 */
export function nswQuestionIdentity(q, generator = q?._generator ?? q?.subtopic) {
  return identityIn(q, generator, nswCell);
}

function identityIn(q, generator, cellAdmitted) {
  if (!q || typeof q !== 'object' || !cellAdmitted(generator, q.difficulty)) return null;
  const row = ROW_BY_GENERATOR.get(generator);
  const ids = typeof q.dotpoint === 'string' && q.dotpoint ? [q.dotpoint] : (Array.isArray(q.dotpoints) ? q.dotpoints : []);
  const ordinals = [...new Set(ids.map(id => dotpointById(id)).filter(dp => dp && dp.subtopic === generator).map(dp => dp.ordinal))].sort((a, b) => a - b);
  if (!ordinals.length || ordinals.length !== ids.length) return null;
  const codes = [...new Set(ordinals.flatMap(i => row.dotpoints[i] || []))];
  if (!codes.length || !codes.every(currentCode)) return null;
  const outcomes = codes.map(code => ({ code, syllabus: NSW_OUTCOME_BY_CODE[code].syllabus, syllabusVersion: versionOf(NSW_OUTCOME_BY_CODE[code].syllabus) }));
  // `syllabus` is the syllabus that OWNS the content: the labelled course's
  // when one of the outcomes is in it, otherwise the first outcome's (the
  // crosswalk lists the labelled course's codes first). `labelledSyllabus` is
  // the course Pri's subtopic label points at, which can differ: remainder
  // theorem items are labelled Advanced and are Extension 1 content.
  const owner = outcomes.find(o => o.syllabus === row.syllabus) || outcomes[0];
  return {
    jurisdiction: NSW_SYLLABUS_BY_ID[owner.syllabus].jurisdiction,
    authority: NSW_SYLLABUS_BY_ID[owner.syllabus].authority,
    syllabus: owner.syllabus,
    syllabusVersion: owner.syllabusVersion,
    labelledSyllabus: row.syllabus,
    outcomes,
    dotpoints: ordinals.map(i => `${generator}.${i + 1}`),
    exact: ordinals.length === 1
  };
}

/** May this generated question be issued by Prithagoras? (Rules 1–3 above; 4 is in the ledger.) */
export function nswIssuable(q, generator = q?._generator ?? q?.subtopic) {
  return hasFinalAnswer(q) && nswQuestionIdentity(q, generator) !== null;
}

const hasFinalAnswer = q => !!q && q.answerType !== 'working' && !q.multipart && !q.custom;

/**
 * The quality gate's own view (client/test/nsw-bank-quality-check.mjs): what
 * WOULD be issued if NSW_QUALITY_EXCLUSIONS were empty. The gate sweeps each
 * exclusion through this, so an entry that no longer fails is caught. Nothing
 * on a request path calls it.
 */
export function nswCandidate(q, generator = q?._generator ?? q?.subtopic) {
  const candidateCell = (g, d) => {
    const row = ROW_BY_GENERATOR.get(g);
    return !!row && rowUnmapped(row) === null && cellUnmapped(row, Number(d)) === null;
  };
  return hasFinalAnswer(q) && identityIn(q, generator, candidateCell) !== null;
}

export const BANK_OUTSIDE_NSW = Object.freeze({
  status: 422,
  code: 'PRACTICE_BANK_OUTSIDE_CURRICULUM',
  message: 'This question is not part of the NSW curriculum.'
});

// ── The curriculum response (GET /v1/curriculum on a Prithagoras server) ─────
// Curriculum truth and generator availability are different facts
// (client/src/engine/curriculumAvailability.js). Every outcome of every current
// syllabus is listed; `generated` is true only where an ISSUED cell lands on
// it, and `practice` then names what can be asked for. An outcome the
// crosswalk records as a gap, or reaches only through content that is not
// issued, is listed with `generated: false`. Codes and Pri's own focus-area
// names only: no NESA outcome or dot-point wording is stored or served.
const slug = text => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function practiceTargets() {
  const byCode = new Map();
  for (const entry of NSW_BANK_LEDGER) {
    if (!entry.issued) continue;
    const row = ROW_BY_GENERATOR.get(entry.generator);
    const issuedLevels = new Set(entry.cells.filter(cell => cell.issued).map(cell => cell.difficulty));
    for (const dp of dotpointsFor(entry.generator)) {
      // The levels whose own form exercises this dot point, and are issued.
      const difficulties = dp.forms.filter(d => issuedLevels.has(d));
      if (!difficulties.length) continue;
      for (const code of row.dotpoints[dp.ordinal] || []) {
        if (!byCode.has(code)) byCode.set(code, []);
        byCode.get(code).push({ generator: entry.generator, dotpoint: dp.id, difficulties });
      }
    }
  }
  return byCode;
}

function buildCurriculum(bank = null) {
  const targets = practiceTargets();
  const gapNote = new Map(NEW_OUTCOME_GAPS.map(gap => [gap.outcome, true]));
  let total = 0, generated = 0;
  const syllabuses = NSW_CURRENT_SYLLABUSES.map(syllabus => {
    const groups = new Map();
    for (const outcome of outcomesOf(syllabus)) {
      const id = `${syllabus.id}:${slug(outcome.focusArea)}${outcome.year ? `-y${outcome.year}` : ''}${outcome.course ? `-${slug(outcome.course)}` : ''}`;
      if (!groups.has(id)) {
        groups.set(id, {
          id, name: outcome.focusArea,
          ...(outcome.stage !== undefined ? { stage: outcome.stage, kind: outcome.kind } : {}),
          ...(outcome.year !== undefined ? { year: outcome.year } : {}),
          ...(outcome.course !== undefined ? { course: outcome.course } : {}),
          dotpoints: []
        });
      }
      const practice = targets.get(outcome.code) || [];
      total += 1;
      if (practice.length) generated += 1;
      groups.get(id).dotpoints.push({
        id: outcome.code, key: outcome.code, code: outcome.code,
        generated: practice.length > 0,
        difficulties: [...new Set(practice.flatMap(t => t.difficulties))].sort((a, b) => a - b),
        practice,
        ...(gapNote.has(outcome.code) ? { gap: 'no-generator' } : {})
      });
    }
    const subtopics = [...groups.values()];
    const count = subtopics.reduce((n, s) => n + s.dotpoints.length, 0);
    const available = subtopics.reduce((n, s) => n + s.dotpoints.filter(dp => dp.generated).length, 0);
    return {
      id: syllabus.id, title: syllabus.title, version: syllabus.version, jurisdiction: syllabus.jurisdiction,
      authority: syllabus.authority, years: [...syllabus.years],
      outcomes: { total: count, generated: available, missing: count - available },
      subtopics
    };
  });
  return {
    edition: 'prithagoras', course: NSW_COURSE, country: 'au', jurisdiction: 'NSW',
    marking: 'final-answer-only',
    outcomes: { total, generated, missing: total - generated },
    banks: { issued: NSW_BANK_COUNT, cells: NSW_CELL_COUNT },
    // The author's question bank, when a pack is loaded (qbankPack.js): one extra key; every entry above and below is the generators' own.
    ...(bank ? { authorBank: bank } : {}),
    // What may be OFFERED, by Pri subtopic (the unit the app's selectors show):
    // `requestable` is exactly the difficulties this server issues for the
    // subtopic and for each of its dot points. A subtopic or level absent
    // here is not issued and must not be offered (engine/nswOffer.js holds the
    // device's copy; client/test/nsw-offer-check.mjs holds the two equal).
    subtopics: Object.fromEntries(NSW_BANK_LEDGER.filter(entry => entry.issued).map(entry => {
      const requestable = entry.cells.filter(cell => cell.issued).map(cell => cell.difficulty);
      return [entry.generator, {
        requestable,
        dotpoints: Object.fromEntries(dotpointsFor(entry.generator).map(dp => {
          const levels = dp.forms.filter(d => requestable.includes(d));
          return [dp.id, { requestable: levels, generated: levels.length > 0 }];
        }))
      }];
    })),
    syllabuses
  };
}

let curriculumCache = null;
let bankCurriculumCache = null;
/** The Prithagoras curriculum response. Static for a build; built once (again for each author-bank pack version, when one is loaded). */
export function nswCurriculumResponse() {
  const bank = qbankCurriculum();
  if (bank) {
    if (bankCurriculumCache?.version !== bank.version) bankCurriculumCache = { version: bank.version, response: buildCurriculum(bank) };
    return bankCurriculumCache.response;
  }
  if (!curriculumCache) curriculumCache = buildCurriculum();
  return curriculumCache;
}
