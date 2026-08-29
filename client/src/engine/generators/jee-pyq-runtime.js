// Pri Learning · reviewed JEE PYQ runtime
//
// Important boundary: this module never parses a PDF and never trusts extraction
// output. Only records that passed tools/jee-question-department/audit.py
// --publish are packed into the generated catalog. An empty catalog is a valid
// production state and means "no reviewed PYQs are published yet".
import { JEE_PYQ_PARTS, JEE_PYQ_COVERAGE, JEE_PYQ_META } from './jee-pyq-data/catalog.js';

const RATING_SUBTOPIC = Object.freeze({
  'c11-complex-numbers': 'mex-complex',
  'c11-sequences-series': 'y12-series',
  'c11-permutations-combinations': 'me11-comb',
  'c11-binomial-theorem': 'c11-binomial-theorem',
  'c11-relations-functions': 'y11-functions',
  'c12-relations-functions': 'me11-functions',
  'c11-probability': 'y11-probability',
  'c12-probability': 'y10-probability',
  'c12-matrices': 'c12-matrices',
  'c12-determinants': 'c12-determinants',
  'c11-limits-derivatives': 'y11-diff',
  'c12-continuity-differentiability': 'c12-continuity-mvt',
  'c12-applications-derivatives': 'y12-appdiff',
  'c12-integrals': 'mex-integration',
  'c12-applications-integrals': 'c12-applications-integrals',
  'c12-differential-equations': 'c12-differential-equations',
  'c11-straight-lines': 'y11-lines',
  'c11-conic-sections': 'c11-conic-sections',
  'c11-trig-functions': 'y11-trigfunc',
  'c12-inverse-trigonometric': 'me11-inversetrig',
  'c11-3d-introduction': 'c11-3d-introduction',
  'c12-vector-algebra': 'c12-vector-algebra',
  'c12-3d-geometry': 'c12-3d-geometry'
});

function sourceLabel(rec) {
  const exam = rec.examTrack === 'jee-main' ? 'JEE Main' : 'JEE Advanced / IIT-JEE';
  return [rec.examYear ? `${exam} ${rec.examYear}` : exam, rec.sourceChapter, rec.sourceTopic].filter(Boolean).join(' · ');
}

function archiveMeta(rec) {
  return {
    id: rec.id,
    book: '41 Years IIT JEE Mathematics',
    edition: '2019–1979',
    chapter: rec.sourceChapter,
    topic: rec.sourceTopic || '',
    topicNumber: rec.sourceTopicNumber,
    questionNumber: rec.sourceQuestionNumber,
    sourcePage: rec.sourcePage,
    sourcePdfPage: rec.sourcePdfPage,
    examYear: rec.examYear,
    track: rec.examTrack,
    reviewedBy: rec.review?.reviewedBy || null,
    reviewedAt: rec.review?.reviewedAt || null,
    solutionAuthorship: 'Reviewed transcription from the project-owner-provided source'
  };
}

function stepsOf(rec) {
  if (!Array.isArray(rec.steps) || !rec.steps.length) {
    throw new Error(`Reviewed JEE record ${rec.id || '<unknown>'} has no worked steps.`);
  }
  return rec.steps.map(step => ({ h: String(step?.h || 'Step'), d: String(step?.d || '') }));
}

export function asJeePyqPayload(rec) {
  if (!rec || !rec.id || !rec.chapterId || !rec.examTrack) throw new Error('Invalid reviewed JEE record.');
  const steps = stepsOf(rec);
  const base = {
    subtopic: RATING_SUBTOPIC[rec.chapterId] || rec.chapterId,
    difficulty: Math.min(4, Math.max(1, Number(rec.difficulty) || 2)),
    prompt: String(rec.prompt || ''),
    hints: Array.isArray(rec.hints) ? rec.hints.map(String) : [],
    steps,
    solutionText: steps.map(step => [step.h, step.d].filter(Boolean).join(': ')).join('\n'),
    pyq: true,
    pyqId: rec.id,
    pyqTrack: rec.examTrack,
    pyqYear: rec.examYear || null,
    pyqSource: sourceLabel(rec),
    archive: archiveMeta(rec)
  };

  if (rec.answerType === 'mcq') {
    const options = Array.isArray(rec.mcqOptions) ? rec.mcqOptions.map(String) : [];
    const correctIndex = Number(rec.answer?.correctIndex);
    if (options.length < 2 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      throw new Error(`Reviewed JEE MCQ ${rec.id} has an invalid answer.`);
    }
    return { ...base, answerType: 'mcq', answer: { correctIndex }, mcqOptions: options };
  }

  if (rec.answerType === 'multi_mcq') {
    const options = Array.isArray(rec.mcqOptions) ? rec.mcqOptions.map(String) : [];
    const indices = Array.isArray(rec.answer?.correctIndices) ? rec.answer.correctIndices.map(Number) : [];
    if (options.length < 2 || !indices.length || indices.some(i => !Number.isInteger(i) || i < 0 || i >= options.length)) {
      throw new Error(`Reviewed JEE multiple-correct question ${rec.id} has an invalid answer.`);
    }
    // Pri's existing set checker is exact and unordered. Students enter 1-based
    // option numbers; no parallel marking implementation is introduced here.
    const legend = options.map((option, i) => `${i + 1}. ${option}`).join('\n');
    return {
      ...base,
      prompt: `${base.prompt}\n\n${legend}\n\nSelect every correct option and enter its number(s), separated by commas.`,
      answerType: 'set',
      answer: { values: indices.map(i => i + 1) },
      inputHint: 'Example: 1,3'
    };
  }

  if (rec.answerType === 'numeric') {
    const value = Number(rec.answer?.value);
    if (!Number.isFinite(value)) throw new Error(`Reviewed JEE numeric question ${rec.id} has an invalid answer.`);
    return { ...base, answerType: 'numeric', answer: { value }, inputHint: 'Enter the numerical value' };
  }

  if (rec.answerType === 'selfcheck') {
    // Descriptive / proof / legacy formats are intentionally ungraded so they
    // cannot fabricate Elo/mastery evidence from a one-button acknowledgement.
    return {
      ...base,
      custom: true,
      customName: `${rec.sourceChapter} · JEE PYQ`,
      answerType: 'mcq',
      answer: { correctIndex: 0 },
      mcqOptions: ['I have finished — reveal and self-check'],
      hints: base.hints.length ? base.hints : ['Complete the problem fully before revealing the reviewed worked solution.']
    };
  }

  throw new Error(`Reviewed JEE record ${rec.id} has unsupported answerType ${rec.answerType}.`);
}

function generatorId(rec) {
  return `${rec.examTrack}-${rec.chapterId}`;
}

export function buildJeePyqBank(records) {
  const grouped = new Map();
  for (const rec of records || []) {
    const id = generatorId(rec);
    let byDiff = grouped.get(id);
    if (!byDiff) grouped.set(id, byDiff = new Map());
    const d = Math.min(4, Math.max(1, Number(rec.difficulty) || 2));
    let rows = byDiff.get(d);
    if (!rows) byDiff.set(d, rows = []);
    rows.push(rec);
  }

  const bank = {};
  for (const [id, byDiff] of grouped) {
    bank[id] = (rng, difficulty) => {
      const available = [...byDiff.keys()].sort((a, b) => a - b);
      if (!available.length) throw new Error(`Reviewed JEE generator ${id} has no records.`);
      const want = Math.min(4, Math.max(1, Number(difficulty) || 2));
      const d = available.reduce((best, value) => {
        const gap = Math.abs(value - want), bestGap = Math.abs(best - want);
        return gap < bestGap || (gap === bestGap && value < best) ? value : best;
      }, available[0]);
      const rows = byDiff.get(d);
      const raw = Number(typeof rng === 'function' ? rng() : Math.random());
      const unit = Number.isFinite(raw) ? Math.max(0, Math.min(0.999999999, raw)) : 0;
      return asJeePyqPayload(rows[Math.floor(unit * rows.length)]);
    };
  }
  return bank;
}

function base64Bytes(text) {
  const compact = String(text || '').replace(/\s+/g, '');
  const binary = atob(compact);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function decodePart(part) {
  const loaders = JEE_PYQ_PARTS[part];
  if (!loaders?.length) throw Object.assign(new Error(`No reviewed JEE PYQ part named ${part}.`), { code: 'JEE_PYQ_PART_UNPUBLISHED' });
  if (typeof DecompressionStream !== 'function') {
    throw Object.assign(new Error('This browser cannot open Pri Learning’s compressed JEE archive. Update Safari/iPadOS and try again.'), { code: 'JEE_PYQ_GZIP_UNSUPPORTED' });
  }
  const pieces = await Promise.all(loaders.map(async load => {
    if (typeof load !== 'function') throw new Error(`Reviewed JEE part ${part} has an invalid local asset loader.`);
    const text = await load();
    if (typeof text !== 'string') throw new Error(`Reviewed JEE part ${part} did not decode to local text.`);
    return text;
  }));
  const encoded = pieces.join('');
  const stream = new Blob([base64Bytes(encoded)]).stream().pipeThrough(new DecompressionStream('gzip'));
  const records = JSON.parse(await new Response(stream).text());
  if (!Array.isArray(records)) throw new Error(`Reviewed JEE part ${part} is not an array.`);
  return records;
}

const partCache = new Map();
export function loadJeePyqPartRecords(part) {
  let job = partCache.get(part);
  if (!job) {
    job = decodePart(part).catch(error => {
      partCache.delete(part);
      throw error;
    });
    partCache.set(part, job);
  }
  return job;
}

export async function loadJeePyqPart(part) {
  return buildJeePyqBank(await loadJeePyqPartRecords(part));
}

function coverageParts(generatorId) {
  const raw = JEE_PYQ_COVERAGE[String(generatorId || '')];
  return Array.isArray(raw) ? raw.filter(Boolean) : (raw ? [raw] : []);
}

export function hasJeePyqGenerator(generatorId) {
  return coverageParts(generatorId).length > 0;
}

const generatorCache = new Map();
export function loadJeePyqGenerator(generatorId) {
  const id = String(generatorId || '');
  const parts = coverageParts(id);
  if (!parts.length) return Promise.resolve(null);
  let job = generatorCache.get(id);
  if (!job) {
    job = Promise.all(parts.map(loadJeePyqPartRecords))
      .then(groups => buildJeePyqBank(groups.flat())[id] || null)
      .catch(error => { generatorCache.delete(id); throw error; });
    generatorCache.set(id, job);
  }
  return job;
}

export function jeePyqCatalogSnapshot() {
  return {
    meta: { ...JEE_PYQ_META },
    coverage: { ...JEE_PYQ_COVERAGE },
    parts: Object.keys(JEE_PYQ_PARTS)
  };
}
