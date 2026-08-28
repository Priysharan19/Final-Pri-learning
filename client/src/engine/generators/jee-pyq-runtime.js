// Pri Learning · Arihant 41 Years JEE PYQ runtime
// Source records are stored as gzip assets and decoded only when a JEE chapter
// first asks for one. The ordinary Pri generators stay untouched.

const PART_URLS = Object.freeze({
  algebra: [
    new URL('./jee-pyq-data/algebra-00.b64', import.meta.url),
    new URL('./jee-pyq-data/algebra-01.b64', import.meta.url),
    new URL('./jee-pyq-data/algebra-02.b64', import.meta.url)
  ],
  'probability-matrix': [
    new URL('./jee-pyq-data/probability-matrix-00.b64', import.meta.url),
    new URL('./jee-pyq-data/probability-matrix-01.b64', import.meta.url)
  ],
  'calculus-a': [
    new URL('./jee-pyq-data/calculus-a-00.b64', import.meta.url),
    new URL('./jee-pyq-data/calculus-a-01.b64', import.meta.url)
  ],
  'calculus-b': [
    new URL('./jee-pyq-data/calculus-b-00.b64', import.meta.url),
    new URL('./jee-pyq-data/calculus-b-01.b64', import.meta.url)
  ],
  coordinate: [
    new URL('./jee-pyq-data/coordinate-00.b64', import.meta.url),
    new URL('./jee-pyq-data/coordinate-01.b64', import.meta.url),
    new URL('./jee-pyq-data/coordinate-02.b64', import.meta.url)
  ],
  'trig-vector': [
    new URL('./jee-pyq-data/trig-vector-00.b64', import.meta.url),
    new URL('./jee-pyq-data/trig-vector-01.b64', import.meta.url),
    new URL('./jee-pyq-data/trig-vector-02.b64', import.meta.url)
  ]
});

// Rating subtopics already exist in Pri's adaptive model. Archive questions use
// them for history/review labels; descriptive self-check questions are marked
// custom below so they never fabricate mastery evidence.
const RATING_SUBTOPIC = Object.freeze({
  'c11-complex-numbers': 'mex-complex',
  'c11-sequences-series': 'y12-series',
  'c11-permutations-combinations': 'me11-comb',
  'c11-binomial-theorem': 'c11-binomial-theorem',
  'c11-relations-functions': 'y11-functions',
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
  'c12-vector-algebra': 'c12-vector-algebra',
  'c12-3d-geometry': 'c12-3d-geometry'
});

function sourceLabel(rec) {
  const bits = [rec.examLabel, rec.sourceChapter, rec.sourceTopic].filter(Boolean);
  return bits.join(' · ');
}

function archiveMeta(rec) {
  return {
    id: rec.id,
    book: 'Arihant 41 Years IIT JEE Mathematics',
    edition: '2019–1979',
    chapter: rec.sourceChapter,
    topic: rec.sourceTopic,
    topicNumber: rec.sourceTopicNumber,
    questionNumber: rec.sourceQuestionNumber,
    sourcePage: rec.sourcePage,
    examYear: rec.examYear,
    track: rec.examTrack,
    label: rec.examLabel,
    authorship: rec.solutionAuthorship || 'Source-derived from the printed worked solution'
  };
}

function asPayload(rec) {
  const base = {
    subtopic: RATING_SUBTOPIC[rec.chapterId] || rec.chapterId,
    difficulty: rec.difficulty,
    prompt: rec.prompt,
    hints: Array.isArray(rec.hints) ? rec.hints : [],
    steps: Array.isArray(rec.steps) && rec.steps.length ? rec.steps : [{ h: 'Source solution', d: 'Review the printed solution.' }],
    solutionText: (rec.steps || []).map(step => [step.h, step.d].filter(Boolean).join(': ')).join('\n'),
    pyq: true,
    pyqId: rec.id,
    pyqTrack: rec.examTrack,
    pyqYear: rec.examYear,
    pyqSource: sourceLabel(rec),
    archive: archiveMeta(rec)
  };

  if (rec.answerType === 'mcq' && rec.answer?.correctIndex != null && Array.isArray(rec.mcqOptions) && rec.mcqOptions.length >= 2) {
    return { ...base, answerType: 'mcq', answer: { correctIndex: Number(rec.answer.correctIndex) }, mcqOptions: rec.mcqOptions.slice(0, 4) };
  }

  if (rec.answerType === 'numeric' && rec.answer && Number.isFinite(Number(rec.answer.value))) {
    return { ...base, answerType: 'numeric', answer: { ...rec.answer, value: Number(rec.answer.value) }, inputHint: rec.inputHint || 'Enter the numerical value' };
  }

  // Pri's existing `set` checker gives exact unordered matching, so historical
  // multiple-correct questions need no second marking implementation. Students
  // enter option numbers, e.g. 1,3 for A and C.
  if (rec.answerType === 'multi_mcq' && Array.isArray(rec.answer?.correctIndices) && rec.answer.correctIndices.length) {
    const legend = (rec.mcqOptions || []).slice(0, 4).map((o, i) => `${i + 1}. ${o}`).join('\n');
    return {
      ...base,
      prompt: `${rec.prompt}${legend ? `\n\n${legend}` : ''}\n\nSelect every correct option and enter its number(s), separated by commas.`,
      answerType: 'set',
      answer: { values: rec.answer.correctIndices.map(i => Number(i) + 1) },
      inputHint: 'Example: 1,3'
    };
  }

  // Legacy descriptive, passage/match or source answers that cannot be safely
  // auto-normalised are intentionally ungraded. `custom` keeps them out of Pri's
  // Elo/mastery update; revealing the source-derived steps is the assessment.
  return {
    ...base,
    custom: true,
    customName: `${rec.sourceChapter} · JEE PYQ`,
    answerType: 'mcq',
    answer: { correctIndex: 0 },
    mcqOptions: ['I have finished — reveal and self-check'],
    hints: Array.isArray(rec.hints) && rec.hints.length ? rec.hints : ['Complete the problem fully before revealing the source-derived solution.']
  };
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
      const want = Math.min(4, Math.max(1, Number(difficulty) || 2));
      const d = available.reduce((best, x) => Math.abs(x - want) < Math.abs(best - want) ? x : best, available[0]);
      const rows = byDiff.get(d);
      const pick = rows[Math.min(rows.length - 1, Math.floor(rng() * rows.length))];
      return asPayload(pick);
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
  const urls = PART_URLS[part];
  if (!urls) throw new Error(`Unknown JEE PYQ bank part ${part}`);
  if (typeof DecompressionStream !== 'function') {
    throw Object.assign(new Error('This browser cannot open Pri Learning’s compressed JEE PYQ archive. Update Safari/iPadOS and try again.'), { code: 'JEE_PYQ_GZIP_UNSUPPORTED' });
  }
  const responses = await Promise.all(urls.map(url => fetch(url)));
  for (const response of responses) {
    if (!response.ok) throw new Error(`Could not load JEE PYQ archive (${response.status || 'offline'}).`);
  }
  const encoded = (await Promise.all(responses.map(response => response.text()))).join('');
  const bytes = base64Bytes(encoded);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}

const cache = new Map();
export function loadJeePyqPart(part) {
  let job = cache.get(part);
  if (!job) {
    job = decodePart(part).then(buildJeePyqBank, err => { cache.delete(part); throw err; });
    cache.set(part, job);
  }
  return job;
}
