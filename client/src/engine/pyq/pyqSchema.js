// Pri Learning · previous-year question record contract
//
// One record is one question from one sitting of one exam. This module decides
// whether a record may exist at all, and turns a record that may into the
// ordinary question payload the rest of the engine already understands — the
// same `{ prompt, answerType, answer, mcqOptions, steps }` shape a generator
// returns, so checker.js marks a 2025 board question with the code that marks
// everything else and no second marker is introduced.
//
// The rules below are the whole point of the module. A record is refused, at
// module load, when:
//
//   · it does not name the sitting (exam, year, paper/set, question number);
//   · its prompt or its answer is not traceable to a document in pyqSources.js;
//   · it claims `pastPaper` at a provenance rung that does not establish that;
//   · its chapter id is not a chapter of the live India curriculum;
//   · its answer contract is one checker.js cannot mark;
//   · it is a four-option MCQ whose four options are not four distinct texts.
//
// That last one is not theoretical. hasFourDistinctOptions in
// indiaExamComposer.js exists because a three-distinct-option question reached
// a JEE Main slot and turned a promised one-in-four guess into one in three;
// a transcription that drops an option would do exactly the same thing, so the
// archive refuses it at the door rather than downstream.

import { IN_CHAPTER_BY_ID } from '../curriculum-in.js';
import { PYQ_PROVENANCE, PYQ_PUBLISHABLE, pyqExam, pyqSource } from './pyqSources.js';

/** Answer contracts the archive can carry, and checker.js can mark. */
export const PYQ_ANSWER_TYPES = Object.freeze(['mcq', 'numeric']);

/**
 * Worked steps in this archive are Pri Learning's own explanation of an
 * authentic question. The question and the keyed answer come from the exam
 * authority; the reasoning between them does not, and every payload says so
 * rather than letting a student read a house explanation as an official one.
 */
export const PYQ_STEPS_AUTHORSHIP = 'Worked solution written by Pri Learning. The question and the keyed answer are transcribed from the recorded sources.';

const isText = v => typeof v === 'string' && v.trim().length > 0;
const asList = v => (Array.isArray(v) ? v : v == null ? [] : [v]);

function fail(rec, why) {
  throw new Error(`PYQ record ${rec?.id || '<unknown>'}: ${why}`);
}

function checkSources(rec, field) {
  const ids = asList(rec[field]);
  if (!ids.length) fail(rec, `names no ${field}. A past-paper question must say which document its ${field === 'promptSource' ? 'prompt' : 'answer'} was read from.`);
  for (const id of ids) {
    if (!pyqSource(id)) fail(rec, `names ${field} "${id}", which is not a document in pyqSources.js.`);
  }
  return ids;
}

/**
 * Refuse anything that is not a complete, markable, attributed past-paper
 * question. Returns the record frozen; throws with a message naming the record
 * and the rule it broke.
 */
export function validatePyqRecord(rec) {
  if (!rec || typeof rec !== 'object') throw new Error('PYQ record: not an object.');
  if (!isText(rec.id)) fail(rec, 'has no id.');

  const exam = pyqExam(rec.examId);
  if (!exam) fail(rec, `names exam "${rec.examId}", which is not a sitting in pyqSources.js.`);
  if (!Number.isInteger(rec.year) || rec.year < 1990 || rec.year > 2100) fail(rec, `has year ${JSON.stringify(rec.year)}; a past-paper question must carry the year it was set.`);
  if (!isText(rec.paper) && !isText(rec.setCode)) fail(rec, 'names neither a paper nor a set code, so the sitting cannot be identified.');
  if (!Number.isInteger(rec.questionNumber) || rec.questionNumber < 1) fail(rec, 'has no printed question number.');

  const chapter = IN_CHAPTER_BY_ID[String(rec.chapterId || '')];
  if (!chapter) fail(rec, `is routed to chapter "${rec.chapterId}", which is not in the live India curriculum.`);

  if (!PYQ_PUBLISHABLE.includes(rec.provenance)) {
    fail(rec, `has provenance ${JSON.stringify(rec.provenance)}, which is not a publishable rung. Publishable rungs are: ${PYQ_PUBLISHABLE.join(', ')}.`);
  }
  // `pastPaper` is the claim a student reads on the card. It is only allowed
  // where the sources establish it, which is exactly the publishable rungs —
  // so it is required to be true here rather than merely permitted.
  if (rec.pastPaper !== true) fail(rec, 'does not declare pastPaper: true. Every record in this archive is a real past-paper question or it is not in this archive.');

  checkSources(rec, 'promptSource');
  const answerSources = checkSources(rec, 'answerSource');
  if (rec.provenance === PYQ_PROVENANCE.OFFICIAL_PAPER_AND_KEY) {
    const official = answerSources.some(id => {
      const kind = pyqSource(id)?.kind;
      return kind === 'official-final-answer-key' || kind === 'official-marking-scheme';
    });
    if (!official) fail(rec, 'claims an official key but names no official answer key or marking scheme as its answer source.');
  }

  if (!isText(rec.prompt)) fail(rec, 'has no prompt.');
  if (!Number.isInteger(rec.difficulty) || rec.difficulty < 1 || rec.difficulty > 4) fail(rec, `has difficulty ${JSON.stringify(rec.difficulty)}; it must be an integer 1-4.`);
  if (!Array.isArray(rec.steps) || !rec.steps.length) fail(rec, 'has no worked steps. A PYQ a student gets wrong with no explanation is worse than no PYQ.');
  for (const step of rec.steps) {
    if (!isText(step?.h) || !isText(step?.d)) fail(rec, 'has a worked step missing its heading or its detail.');
  }

  if (!PYQ_ANSWER_TYPES.includes(rec.answerType)) {
    fail(rec, `has answerType ${JSON.stringify(rec.answerType)}; this archive carries ${PYQ_ANSWER_TYPES.join(' and ')} only, because those are the contracts it can prove checker.js marks.`);
  }

  if (rec.answerType === 'mcq') {
    const options = rec.mcqOptions;
    if (!Array.isArray(options) || options.length !== 4) fail(rec, 'is an MCQ without exactly four options.');
    const texts = options.map(o => String(o ?? '').trim());
    if (texts.some(t => !t)) fail(rec, 'is an MCQ with an empty option.');
    if (new Set(texts).size !== 4) fail(rec, 'is an MCQ whose four options are not four distinct texts — a transcription that repeats an option turns a one-in-four guess into a one-in-three.');
    const i = rec.answer?.correctIndex;
    if (!Number.isInteger(i) || i < 0 || i > 3) fail(rec, `is an MCQ with correctIndex ${JSON.stringify(i)}.`);
  }

  if (rec.answerType === 'numeric') {
    const value = rec.answer?.value;
    if (!Number.isFinite(value)) fail(rec, 'is a numeric question with no finite keyed value.');
    const tol = rec.answer?.tol;
    if (tol !== undefined && !(Number.isFinite(tol) && tol >= 0)) fail(rec, `has tolerance ${JSON.stringify(tol)}, which is not a non-negative number.`);
    // JEE Advanced keys some numerical-value answers as a band ("2.35 to 2.45").
    // Where a record quotes one, the band it quotes has to contain the value it
    // keys, or the archive is contradicting its own source.
    const band = rec.answer?.officialRange;
    if (band !== undefined) {
      if (!Array.isArray(band) || band.length !== 2 || !band.every(Number.isFinite) || band[0] > band[1]) {
        fail(rec, 'quotes an officialRange that is not a [low, high] pair.');
      }
      if (value < band[0] || value > band[1]) fail(rec, `keys ${value}, which is outside the official accepted range [${band[0]}, ${band[1]}].`);
      // A record that quotes a band and then keys a different tolerance is
      // marking to a rule the exam did not use, in one direction or the other.
      if (tol !== undefined && Math.abs(tol - (band[1] - band[0]) / 2) > 1e-9) {
        fail(rec, `quotes the official range [${band[0]}, ${band[1]}] but keys tolerance ${tol}, which is not its half-width.`);
      }
    }
  }

  return Object.freeze({ ...rec, chapterName: chapter.name, track: exam.track });
}

/** The human label a student reads on the card: exam, year, sitting, number. */
export function pyqLabel(rec) {
  const exam = pyqExam(rec.examId);
  return exam ? exam.labelFor(rec) : `${rec.examId} ${rec.year}`;
}

/**
 * The archive metadata carried on every payload. `citations` is what a student
 * (or an auditor) follows to check the question against the exam authority's
 * own document, which is the point of the whole layer.
 */
function archiveMeta(rec) {
  const cite = id => {
    const src = pyqSource(id);
    return { id, authority: src.authority, title: src.title, kind: src.kind, url: src.url, file: src.file || null, archivedAt: src.archivedAt || null, retrieved: src.retrieved };
  };
  const ids = [...new Set([...asList(rec.promptSource), ...asList(rec.answerSource)])];
  return Object.freeze({
    recordId: rec.id,
    exam: rec.examId,
    examLabel: pyqExam(rec.examId).label,
    authority: pyqExam(rec.examId).authority,
    year: rec.year,
    paper: rec.paper || null,
    setCode: rec.setCode || null,
    session: rec.session || null,
    section: rec.section || null,
    questionNumber: rec.questionNumber,
    chapterId: rec.chapterId,
    provenance: rec.provenance,
    citations: Object.freeze(ids.map(cite)),
    stepsAuthorship: PYQ_STEPS_AUTHORSHIP
  });
}

/**
 * One record as an engine question payload. The shape is deliberately the shape
 * a generator returns, so nothing downstream — composer, marker, Pri Explain,
 * the exam room — needs a special case for a past-paper question. The extra
 * `pyq*` fields are additive labels, and local/backend.js and
 * local/indiaExamBackend.js pass them through to the card.
 */
export function pyqPayload(rec) {
  const base = {
    subtopic: rec.chapterId,
    difficulty: rec.difficulty,
    prompt: rec.prompt,
    hints: Array.isArray(rec.hints) ? rec.hints.map(String) : [],
    steps: rec.steps.map(s => ({ h: String(s.h), d: String(s.d) })),
    pyq: true,
    pyqId: rec.id,
    pyqExam: rec.examId,
    pyqTrack: rec.track,
    pyqYear: rec.year,
    pyqSource: pyqLabel(rec),
    archive: archiveMeta(rec)
  };
  if (rec.answerType === 'mcq') {
    return { ...base, answerType: 'mcq', mcqOptions: rec.mcqOptions.map(String), answer: { correctIndex: rec.answer.correctIndex } };
  }
  const answer = { value: rec.answer.value };
  if (rec.answer.tol !== undefined) answer.tol = rec.answer.tol;
  if (rec.answer.officialRange) {
    // The exam accepts the whole band, endpoints included. Half the band width
    // around the keyed value is the same rule — except that binary floating
    // point puts |3.9 − 4| a hair above 0.1, which would mark a value the exam
    // accepted as wrong. The guard below is one part in a billion: it cannot
    // let in anything the band does not already contain.
    const [lo, hi] = rec.answer.officialRange;
    answer.tol = ((hi - lo) / 2) * (1 + 1e-9) + 1e-12;
  }
  return {
    ...base,
    answerType: 'numeric',
    answer,
    inputHint: rec.inputHint || 'Enter the numerical value'
  };
}
