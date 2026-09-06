// Pri Learning · India exam paper composer
//
// Turns a source-versioned blueprint (indiaExams.js) plus the authored question
// banks into one sittable paper. It is pure and seedable: the same blueprint,
// chapter scope and seed compose the same paper, which is what the exam flow
// test relies on and what makes a paper reproducible from its stored seed.
//
// Honesty rules the whole module:
//   · a section type the banks cannot produce is filled with the nearest thing
//     the banks CAN produce, and that substitution is written into
//     `reducedPattern` on the paper — never silently;
//   · MCQ distractors come from the generator's own trap machinery first and
//     from deterministic perturbations of the keyed answer second, never from a
//     language model or a hand-typed list;
//   · assertion-reason, multiple-correct and matching-list items are built from
//     generator facts (keyed answers and worked steps) and are labelled as such.
//
// The composer knows nothing about IndexedDB or profiles. local/indiaExamBackend.js
// owns storage, marking and evidence.
import { makeRng } from './qhelpers.js';
import { numsClose } from './expr.js';

export const ASSERTION_REASON_OPTIONS = Object.freeze([
  'Both Assertion (A) and Reason (R) are true, and Reason (R) is the correct explanation of Assertion (A).',
  'Both Assertion (A) and Reason (R) are true, but Reason (R) is not the correct explanation of Assertion (A).',
  'Assertion (A) is true, but Reason (R) is false.',
  'Assertion (A) is false, but Reason (R) is true.'
]);

const PART_KEYS = ['i', 'ii', 'iii', 'iv', 'v'];
const LIST_KEYS = ['P', 'Q', 'R', 'S'];
const MAX_DRAWS_PER_SLOT = 160;

const seededInt = rng => Math.floor(rng() * 0x7fffffff);
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Answers as text ─────────────────────────────────────────────────────────

function decimalsOf(v) {
  const s = String(v);
  const i = s.indexOf('.');
  return i < 0 ? 0 : Math.min(6, s.length - i - 1);
}

function plainNumber(v, decimals) {
  if (Number.isInteger(v)) return String(v);
  return String(Number(v.toFixed(Math.max(decimals, 2))));
}

/** The keyed answer as a student would read it on a marking sheet. */
export function answerText(q) {
  const a = q?.answer;
  if (!a) return '';
  switch (q.answerType) {
    case 'mcq': return q.mcqOptions?.[a.correctIndex] ?? '';
    case 'multi-mcq': return (a.correctIndices || []).map(i => 'ABCD'[i] ?? String(i + 1)).join(', ');
    case 'numeric': {
      if (a.canonicalInput) return a.canonicalInput;
      if (a.simplestFraction) return `${a.simplestFraction.n}/${a.simplestFraction.d}`;
      if (a.surdForm) return `${a.surdForm.k === 1 ? '' : a.surdForm.k}√${a.surdForm.r}`;
      return `${q.answerPrefix ? q.answerPrefix + ' ' : ''}${plainNumber(a.value, decimalsOf(a.value))}${q.answerSuffix ? ' ' + q.answerSuffix : ''}`;
    }
    case 'expression': return a.expr;
    case 'set': return (a.values || []).join(', ');
    case 'point': return `(${a.x}, ${a.y})`;
    case 'ratio': return `${a.a} : ${a.b}`;
    case 'working': return a.canonicalWorking || '';
    default: return '';
  }
}

function formatLike(q, value) {
  return `${q.answerPrefix ? q.answerPrefix + ' ' : ''}${plainNumber(value, decimalsOf(q.answer?.value ?? value))}${q.answerSuffix ? ' ' + q.answerSuffix : ''}`;
}

/** A plain numeric answer: a finite value with no exact-form requirement. */
export function plainNumericAnswer(q) {
  const a = q?.answer;
  return q?.answerType === 'numeric' && a && Number.isFinite(a.value)
    && !a.simplestFraction && !a.surdForm && !a.canonicalInput && !a.requireExact;
}

function convertibleToMcq(q) {
  const a = q?.answer;
  if (q?.answerType !== 'numeric' || !a) return false;
  if (a.simplestFraction) return Number.isInteger(a.simplestFraction.n) && Number.isInteger(a.simplestFraction.d) && a.simplestFraction.d > 0;
  return plainNumericAnswer(q);
}

// ── Distractors ─────────────────────────────────────────────────────────────

/**
 * Wrong answers for a plain numeric question: the generator's own designed
 * traps first (each carries the misconception it stands for), then
 * deterministic perturbations of the keyed value. Never the answer itself,
 * never a duplicate.
 */
export function numericDistractors(q, count = 3) {
  const v = q.answer.value;
  const out = [];
  const seen = [v];
  const push = (cand, why = null) => {
    if (!Number.isFinite(cand) || out.length >= count) return;
    if (seen.some(x => numsClose(x, cand, 1e-9))) return;
    seen.push(cand);
    out.push({ value: cand, why });
  };
  for (const t of q.traps || []) if (t && typeof t.value === 'number') push(t.value, t.why || null);
  const dec = decimalsOf(v);
  const unit = dec ? Math.pow(10, -dec) : 1;
  const step = Math.abs(v) >= 100 ? Math.max(unit, Math.round(Math.abs(v) / 10)) : unit;
  const candidates = Number.isInteger(v)
    ? [v + 1, v - 1, 2 * v, -v, v + 2, v - 2, v + 10, v - 10, 10 * v, Math.trunc(v / 2), v + 5, v - 5]
    : [v + step, v - step, 2 * v, -v, v / 2, v + 2 * step, v - 2 * step, v + 10 * step, 10 * v, v / 10];
  for (const c of candidates) push(Number(c.toFixed(Math.max(dec, 2))));
  return out;
}

function fractionDistractors(q, count = 3) {
  const { n, d } = q.answer.simplestFraction;
  const texts = [];
  const seen = new Set([`${n}/${d}`]);
  const push = (p, r) => {
    if (texts.length >= count || r <= 0 || p === 0) return;
    const t = `${p}/${r}`;
    if (seen.has(t)) return;
    seen.add(t);
    texts.push(t);
  };
  for (const [p, r] of [[n + 1, d], [n - 1, d], [n, d + 1], [n, d - 1], [n + d, d], [2 * n, d], [n, 2 * d], [n + 2, d], [d, n]]) push(p, r);
  return texts.map(text => ({ text, why: null }));
}

/**
 * Rewrite a numeric question as a four-option MCQ. The keyed answer keeps its
 * printed form; distractors are traps/perturbations in the same form. Returns
 * null when fewer than three distinct distractors exist — a two-option
 * "multiple choice" is not an exam item.
 */
export function numericToMcq(q, rng) {
  if (!convertibleToMcq(q)) return null;
  const correct = answerText(q);
  // More candidates than needed, because the dedup below is by rendered text
  // and will discard some of them.
  const distractors = q.answer.simplestFraction
    ? fractionDistractors(q, 8)
    : numericDistractors(q, 8).map(w => ({ text: formatLike(q, w.value), why: w.why }));

  // Deduplicate on the TEXT the student reads, not on the underlying number.
  // numericDistractors already rejects duplicate values, but two different
  // values can print identically once formatLike has rounded them to the
  // answer's precision — 0 and -0, or two probabilities that both render "0".
  // The paper promises one guess in four; a repeated option quietly makes it
  // one in three.
  const distinct = [];
  const seenText = new Set([correct]);
  for (const w of distractors) {
    const text = String(w.text ?? '').trim();
    if (!text || seenText.has(text)) continue;
    seenText.add(text);
    distinct.push({ ...w, text });
    if (distinct.length === 3) break;
  }
  if (distinct.length < 3) return null;
  const all = shuffle(rng, [{ text: correct, ok: true }, ...distinct.slice(0, 3)]);
  const correctIndex = all.findIndex(o => o.ok);
  const optionTraps = {};
  all.forEach((o, i) => { if (o.why) optionTraps[i] = o.why; });
  return {
    ...q,
    answerType: 'mcq',
    mcqOptions: all.map(o => o.text),
    answer: { correctIndex, optionTraps, value: q.answer.value, source: q.answer },
    mcqFrom: 'numeric',
    inputHint: undefined, answerPrefix: undefined, answerSuffix: undefined
  };
}

// ── Draws ───────────────────────────────────────────────────────────────────

/** The (generator, difficulty) cells a chapter declares inside a window. */
export function chapterCells(chapter, { min = 1, max = 4 } = {}) {
  const cells = [];
  for (const c of chapter?.covers || []) for (const d of c.diff || []) cells.push({ generator: c.gen, difficulty: d, pyq: false });
  if (!cells.length) return cells;
  const inside = cells.filter(c => c.difficulty >= min && c.difficulty <= max);
  if (inside.length) return inside;
  const gap = c => Math.min(Math.abs(c.difficulty - min), Math.abs(c.difficulty - max));
  const best = Math.min(...cells.map(gap));
  return cells.filter(c => gap(c) === best);
}

/**
 * A four-option multiple-choice slot needs four DISTINCT options. Some
 * generators author a two- or three-option question (a sign choice, a
 * three-way domain question), which is a fine practice item but not a board or
 * JEE exam item: a student who can eliminate one option should not be handed a
 * one-in-three guess where the paper promises one in four. Such a question is
 * refused for the slot, and the composer draws another.
 */
export function hasFourDistinctOptions(q) {
  const options = q?.mcqOptions;
  if (!Array.isArray(options) || options.length !== 4) return false;
  const texts = options.map(o => String(o?.text ?? o?.label ?? o?.value ?? o).trim());
  return new Set(texts).size === 4 && texts.every(t => t.length > 0);
}

const NEEDS = {
  any: () => true,
  mcq: q => (q.answerType === 'mcq' ? hasFourDistinctOptions(q) : convertibleToMcq(q)),
  written: q => q.answerType !== 'mcq' && q.answerType !== 'working',
  numerical: q => plainNumericAnswer(q) || (q.answerType === 'numeric' && q.answer?.simplestFraction),
  integer99: q => plainNumericAnswer(q) && Number.isInteger(q.answer.value) && q.answer.value >= 0 && q.answer.value <= 99,
  facts: q => plainNumericAnswer(q) && Array.isArray(q.steps) && q.steps.length > 0,
  factsNoFigure: q => plainNumericAnswer(q) && Array.isArray(q.steps) && q.steps.length > 0 && !q.figure
};

function shapeFor(q, need, rng) {
  if (!NEEDS[need]?.(q)) return null;
  if (need === 'mcq' && q.answerType !== 'mcq') {
    const converted = numericToMcq(q, rng);
    // Checked again after conversion, not only before it. NEEDS.mcq can only
    // ask whether a question COULD become an MCQ; whether the MCQ it became is
    // a sound one is a different question, and the answer has to be verified
    // on the finished item or a distractor bug reaches a real paper.
    if (!converted || !hasFourDistinctOptions(converted)) return null;
    return { payload: converted, conversion: 'numeric-to-mcq' };
  }
  return { payload: q, conversion: q.answerType === 'mcq' ? 'native-mcq' : null };
}

/**
 * Draw one question from a chapter that satisfies `need`. Reviewed PYQ cells
 * (`extraCells`) are tried first; the authored cells then fill whatever the
 * archive cannot. Every prompt is deduplicated across the whole paper.
 */
function drawQuestion(ctx, chapter, need, range, extraCells = []) {
  const authored = chapterCells(chapter, range);
  const cells = [...extraCells, ...authored];
  if (!cells.length) return null;
  for (let attempt = 0; attempt < MAX_DRAWS_PER_SLOT; attempt++) {
    const preferPyq = extraCells.length && attempt < extraCells.length * 6;
    const cell = preferPyq ? extraCells[attempt % extraCells.length] : pick(ctx.rng, cells);
    const seed = seededInt(ctx.rng);
    let q;
    try { q = ctx.draw(cell.generator, cell.difficulty, seed); }
    catch (err) { if (err?.bankMissing) throw err; continue; }
    if (!q?.prompt) continue;
    const shaped = shapeFor(q, need, ctx.rng);
    if (!shaped) continue;
    const signature = `${cell.generator}|${String(q.prompt).replace(/\s+/g, ' ').trim()}`;
    if (ctx.seen.has(signature)) continue;
    ctx.seen.add(signature);
    return {
      payload: shaped.payload, generator: cell.generator,
      difficulty: q.difficulty || cell.difficulty, seed, pyq: !!cell.pyq, conversion: shaped.conversion
    };
  }
  return null;
}

/** First need that the chapter can satisfy, in order of preference. */
function fillSlot(ctx, chapter, needs, range, extraCells = []) {
  for (const need of needs) {
    const drawn = drawQuestion(ctx, chapter, need, range, extraCells);
    if (drawn) return { ...drawn, need };
  }
  return null;
}

// ── Composite items built from generator facts ──────────────────────────────

function keyStep(q) {
  const step = (q.steps || []).find(s => s?.d && !/^(check|note|bonus)/i.test(String(s.h || ''))) || (q.steps || [])[0];
  return step?.d ? `${step.h ? `${step.h}: ` : ''}${step.d}` : null;
}

function assertionReason(ctx, chapter, others, range) {
  const main = drawQuestion(ctx, chapter, 'facts', range);
  if (!main) return null;
  const pool = others.filter(c => c.id !== chapter.id);
  const otherChapter = pool.length ? pick(ctx.rng, pool) : chapter;
  const other = drawQuestion(ctx, otherChapter, 'facts', range) || drawQuestion(ctx, chapter, 'facts', range);
  if (!other) return null;
  const qa = main.payload, qo = other.payload;
  const stepA = keyStep(qa), stepO = keyStep(qo);
  if (!stepA) return null;
  const wrongA = numericDistractors(qa, 1)[0], wrongO = numericDistractors(qo, 1)[0];
  const patterns = ['a'];
  if (stepO) patterns.push('b');
  if (wrongO) patterns.push('c');
  if (wrongA) patterns.push('d');
  const pattern = pick(ctx.rng, patterns);
  const claim = (q, text) => `For the problem “${q.prompt}”, the answer is ${text}.`;
  const trueA = claim(qa, answerText(qa));
  let A = trueA, R = stepA, correctIndex = 0;
  if (pattern === 'b') { R = stepO; correctIndex = 1; }
  if (pattern === 'c') { R = claim(qo, formatLike(qo, wrongO.value)); correctIndex = 2; }
  if (pattern === 'd') { A = claim(qa, formatLike(qa, wrongA.value)); correctIndex = 3; }
  const steps = [
    { h: 'Assertion', d: pattern === 'd' ? `False — the answer to that problem is ${answerText(qa)}, not ${formatLike(qa, wrongA.value)}.` : `True — the answer to that problem is ${answerText(qa)}.` },
    { h: 'Reason', d: pattern === 'c' ? `False — the answer to that problem is ${answerText(qo)}, not ${formatLike(qo, wrongO.value)}.` : 'True — it is a correct statement of the method.' },
    { h: 'Link', d: pattern === 'a' ? 'The reason is the step that produces the assertion, so it explains it.' : pattern === 'b' ? 'The reason is true but concerns a different problem, so it does not explain the assertion.' : 'One of the two statements is false.' }
  ];
  return {
    item: 'assertion-reason', generator: main.generator, difficulty: main.difficulty, seed: main.seed, pyq: false, conversion: 'assertion-reason',
    payload: {
      subtopic: qa.subtopic, difficulty: qa.difficulty, dotpoints: qa.dotpoints,
      prompt: `**Assertion (A):** ${A}\n\n**Reason (R):** ${R}\n\nSelect the correct option.`,
      answerType: 'mcq', mcqOptions: [...ASSERTION_REASON_OPTIONS], answer: { correctIndex },
      steps, hints: [], examItem: 'assertion-reason', builtFrom: [main.generator, other.generator]
    }
  };
}

function partFrom(q, key, marks) {
  return {
    key, marks, prompt: q.prompt, answerType: q.answerType, answer: q.answer, mcqOptions: q.mcqOptions,
    steps: q.steps || [], traps: q.traps, inputHint: q.inputHint, answerPrefix: q.answerPrefix, answerSuffix: q.answerSuffix,
    figure: q.figure, subtopic: q.subtopic, difficulty: q.difficulty, dotpoints: q.dotpoints, stepcheck: q.stepcheck
  };
}

function caseStudy(ctx, chapter, section, range, withChoice, composition) {
  const marksList = section.caseStudyParts || [1, 1, 2];
  const parts = [];
  let primary = null;
  for (let i = 0; i < marksList.length; i++) {
    const marks = marksList[i];
    const drawn = fillSlot(ctx, chapter, ['written', 'any'], range);
    if (!drawn) return null;
    if (drawn.need === 'any') composition.writtenAsObjective++;
    primary = primary || drawn;
    const part = partFrom(drawn.payload, PART_KEYS[i], marks);
    if (marks >= 2 && withChoice) {
      const alt = fillSlot(ctx, chapter, ['written', 'any'], range);
      if (alt) part.alt = partFrom(alt.payload, PART_KEYS[i], marks);
    }
    parts.push(part);
  }
  return {
    item: 'case-study', generator: primary.generator, difficulty: primary.difficulty, seed: primary.seed, pyq: false, conversion: 'chaptered-sub-questions',
    payload: {
      multipart: true, title: `Case study · ${chapter.name}`,
      stem: `The parts below are drawn from ${chapter.name}. Answer every part${withChoice ? '; where two versions of a part are shown, attempt either one' : ''}.`,
      parts, totalMarks: marksList.reduce((a, b) => a + b, 0),
      subtopic: parts[0].subtopic, difficulty: parts[0].difficulty || 2,
      examItem: 'case-study', caseStudyMode: 'chaptered-sub-questions'
    }
  };
}

function multiCorrect(ctx, chapter, range) {
  const one = drawQuestion(ctx, chapter, 'factsNoFigure', range);
  const two = drawQuestion(ctx, chapter, 'factsNoFigure', range);
  if (!one || !two) return null;
  const statements = [];
  for (const [label, drawn] of [['I', one], ['II', two]]) {
    const q = drawn.payload;
    const wrongs = numericDistractors(q, 2);
    if (wrongs.length < 1) return null;
    const pool = [
      { text: `In (${label}), the answer is ${answerText(q)}.`, ok: true },
      ...wrongs.map(w => ({ text: `In (${label}), the answer is ${formatLike(q, w.value)}.`, ok: false }))
    ];
    statements.push(...shuffle(ctx.rng, pool).slice(0, 2));
  }
  let options = shuffle(ctx.rng, statements);
  if (!options.some(o => o.ok)) options[0] = { text: `In (I), the answer is ${answerText(one.payload)}.`, ok: true };
  if (options.every(o => o.ok)) {
    const wrong = numericDistractors(two.payload, 1)[0];
    options[options.length - 1] = { text: `In (II), the answer is ${formatLike(two.payload, wrong.value)}.`, ok: false };
  }
  if (new Set(options.map(o => o.text)).size !== options.length) return null;
  const correctIndices = options.map((o, i) => (o.ok ? i : -1)).filter(i => i >= 0);
  const prefixed = (label, q) => (q.steps || []).map(s => ({ h: `(${label}) ${s.h || 'Step'}`, d: s.d }));
  return {
    item: 'multi-correct', generator: one.generator, difficulty: Math.max(one.difficulty, two.difficulty), seed: one.seed, pyq: false, conversion: 'paired-claims',
    payload: {
      subtopic: one.payload.subtopic, difficulty: Math.max(one.difficulty, two.difficulty), dotpoints: one.payload.dotpoints,
      prompt: `Consider the two problems below.\n\n(I) ${one.payload.prompt}\n\n(II) ${two.payload.prompt}\n\nWhich of the following statements is/are correct? Select every correct option.`,
      answerType: 'multi-mcq', mcqOptions: options.map(o => o.text), answer: { correctIndices },
      steps: [...prefixed('I', one.payload), ...prefixed('II', two.payload)], hints: [],
      examItem: 'multi-correct', builtFrom: [one.generator, two.generator]
    }
  };
}

function permutations(base) {
  const swap = (i, j) => { const m = base.slice(); [m[i], m[j]] = [m[j], m[i]]; return m; };
  const rotate = () => [base[1], base[2], base[3], base[0]];
  return [swap(0, 1), swap(2, 3), swap(0, 2), swap(1, 3), rotate(), swap(0, 3), swap(1, 2)];
}

function matrixMatch(ctx, chapter, range) {
  const draws = [];
  for (let i = 0; i < LIST_KEYS.length; i++) {
    const drawn = drawQuestion(ctx, chapter, 'factsNoFigure', range);
    if (!drawn) return null;
    draws.push(drawn);
  }
  const texts = draws.map(d => answerText(d.payload));
  if (new Set(texts).size !== texts.length) return null;
  const extra = numericDistractors(draws[3].payload, 4).map(w => formatLike(draws[3].payload, w.value)).find(t => !texts.includes(t)) || null;
  const right = shuffle(ctx.rng, extra ? [...texts, extra] : texts);
  const correctMap = texts.map(t => right.indexOf(t));
  const mapText = m => m.map((ri, li) => `${LIST_KEYS[li]} → ${ri + 1}`).join(', ');
  const wrongMaps = [];
  for (const m of permutations(correctMap)) {
    const t = mapText(m);
    if (t !== mapText(correctMap) && !wrongMaps.some(w => mapText(w) === t)) wrongMaps.push(m);
    if (wrongMaps.length === 3) break;
  }
  if (wrongMaps.length < 3) return null;
  const options = shuffle(ctx.rng, [{ text: mapText(correctMap), ok: true }, ...wrongMaps.map(m => ({ text: mapText(m), ok: false }))]);
  return {
    item: 'matrix-match', generator: draws[0].generator, difficulty: Math.max(...draws.map(d => d.difficulty)), seed: draws[0].seed, pyq: false, conversion: 'matching-list',
    payload: {
      subtopic: draws[0].payload.subtopic, difficulty: Math.max(...draws.map(d => d.difficulty)), dotpoints: draws[0].payload.dotpoints,
      prompt: 'Match each problem in List-I with its answer in List-II, then choose the option that gives the correct matching.',
      matchList: {
        left: draws.map((d, i) => ({ key: LIST_KEYS[i], text: d.payload.prompt })),
        right: right.map((t, i) => ({ key: String(i + 1), text: t }))
      },
      answerType: 'mcq', mcqOptions: options.map(o => o.text), answer: { correctIndex: options.findIndex(o => o.ok) },
      steps: draws.map((d, i) => ({ h: `${LIST_KEYS[i]} → ${correctMap[i] + 1}`, d: `${d.payload.prompt} — answer ${answerText(d.payload)}` })),
      hints: [], examItem: 'matrix-match', builtFrom: draws.map(d => d.generator)
    }
  };
}

// ── Allocation ──────────────────────────────────────────────────────────────

/**
 * Give every question slot a chapter. With unit weightage (CBSE) the heaviest
 * slots are placed first and each goes to the unit furthest below its target,
 * then to that unit's least-used chapter; without it (JEE, IOQM) chapters are
 * cycled in a seeded order so a paper never leans on one chapter.
 */
export function allocateUnits(spec, chapters, rng) {
  const slots = [];
  for (const section of spec.sections) {
    for (let index = 0; index < section.questions; index++) {
      slots.push({ section, index, marks: Number(section.marksEach ?? section.correct ?? 1) });
    }
  }
  const known = new Set(chapters.map(c => c.id));
  const units = spec.units
    ? spec.units.map(u => ({ ...u, chapters: u.chapters.filter(id => known.has(id)), assigned: 0, uses: {} })).filter(u => u.chapters.length)
    : null;
  if (!units?.length) {
    const order = shuffle(rng, chapters.map(c => c.id));
    slots.forEach((slot, i) => { slot.chapterId = order[i % order.length]; });
    return { slots, units: null };
  }
  const byMarks = slots.map((_, i) => i).sort((a, b) => slots[b].marks - slots[a].marks || a - b);
  for (const i of byMarks) {
    const slot = slots[i];
    let best = null;
    for (const u of shuffle(rng, units)) if (!best || u.marks - u.assigned > best.marks - best.assigned) best = u;
    const chapterId = shuffle(rng, best.chapters).sort((a, b) => (best.uses[a] || 0) - (best.uses[b] || 0))[0];
    slot.chapterId = chapterId;
    best.assigned += slot.marks;
    best.uses[chapterId] = (best.uses[chapterId] || 0) + 1;
  }
  return {
    slots,
    units: units.map(u => ({ id: u.id, name: u.name, target: u.marks, assigned: u.assigned, chapters: u.chapters }))
  };
}

// ── The paper ───────────────────────────────────────────────────────────────

/** What a composer can and cannot honour for a blueprint, before any draw. */
export function composerNotes(spec) {
  const notes = [];
  if (!spec) return notes;
  if (spec.track === 'cbse') {
    notes.push('Assertion-reason items are composed from generator facts (keyed answers and worked steps), not authored statements.');
    notes.push('Section E case studies are chaptered sub-questions without a narrative passage.');
    notes.push('Short- and long-answer questions are marked on the final answer; typed working earns Step Check method marks where the question supports it.');
  }
  if (spec.track === 'jee-main') notes.push('Reviewed previous-year questions are used wherever the archive has them; authored JEE-depth questions fill the rest and are labelled as such.');
  if (spec.track === 'jee-advanced') {
    notes.push('Multiple-correct items pair two problems and ask which claims about their answers hold; matching-list items match four problems to their answers.');
    notes.push('The paper follows one published paper (2024, Paper 1); the live JEE Advanced pattern is paper-specific.');
  }
  if (spec.track === 'olympiad') notes.push('Every answer is an integer from 00 to 99 as in IOQM; difficulty is the authored ladder, not calibrated against past IOQM papers.');
  return notes;
}

function marking(section) {
  return {
    correct: Number(section.marksEach ?? section.correct ?? 1),
    incorrect: Number(section.incorrect ?? 0),
    unanswered: Number(section.unanswered ?? 0),
    partialPerOption: section.partialPerOption == null ? null : Number(section.partialPerOption)
  };
}

function buildItem(ctx, spec, section, slot, chapter, others, range, composition, choice) {
  const sectionRange = section.difficulty ? { min: section.difficulty[0], max: section.difficulty[1] } : range;
  const types = section.types || [section.type];
  const extra = ctx.pyqCellsFor(chapter, sectionRange);

  if (types.includes('case-study')) return caseStudy(ctx, chapter, section, sectionRange, choice, composition);
  if (types.includes('assertion-reason') && slot.index >= section.questions - (section.assertionReason || 0)) {
    // The pattern wants an assertion-reason item here; the allotted chapter is
    // tried first and every other chapter after it before the slot degrades to
    // a plain MCQ (which composeIndiaPaper then reports as a reduction).
    const built = assertionReason(ctx, chapter, others, sectionRange)
      || shuffle(ctx.rng, others.filter(c => c.id !== chapter.id)).reduce((found, c) => found || assertionReason(ctx, c, others, sectionRange), null);
    if (built) return built;
  }
  if (types.includes('mcq') || types.includes('single-correct')) {
    const drawn = fillSlot(ctx, chapter, ['mcq'], sectionRange, extra);
    return drawn && { ...drawn, item: drawn.payload.mcqFrom === 'numeric' ? 'mcq' : 'mcq' };
  }
  if (types.includes('numerical-value')) {
    const drawn = fillSlot(ctx, chapter, ['numerical'], sectionRange, extra);
    return drawn && { ...drawn, item: 'numerical-value' };
  }
  if (types.includes('integer-00-99')) {
    const drawn = fillSlot(ctx, chapter, ['integer99'], sectionRange, extra);
    return drawn && { ...drawn, item: 'integer-00-99' };
  }
  if (types.includes('multi-correct')) return multiCorrect(ctx, chapter, sectionRange);
  if (types.includes('matrix-match')) return matrixMatch(ctx, chapter, sectionRange);
  // very-short / short / long answer
  const drawn = fillSlot(ctx, chapter, ['written', 'any'], sectionRange, extra);
  if (!drawn) return null;
  if (drawn.need === 'any') composition.writtenAsObjective++;
  const item = types[0] || 'written';
  if (choice) {
    const alt = fillSlot(ctx, chapter, ['written', 'any'], sectionRange, extra);
    if (alt) {
      if (alt.need === 'any') composition.writtenAsObjective++;
      drawn.payload = { ...drawn.payload, alt: alt.payload };
      drawn.altSeed = alt.seed;
    }
  }
  return { ...drawn, item };
}

/**
 * Compose a whole paper. `draw(generator, difficulty, seed)` is the engine's
 * synchronous generateQuestion; `chapters` is the track scope for the profile;
 * `pyqCellsFor(chapter, range)` names reviewed-PYQ cells the caller has already
 * loaded (empty when the archive has none).
 */
export function composeIndiaPaper(spec, { seed, draw, chapters, pyqCellsFor = () => [] }) {
  if (!spec?.sections?.length) throw new Error('A paper needs a blueprint with sections.');
  if (!chapters?.length) throw new Error('A paper needs a chapter scope.');
  const rng = makeRng((Number(seed) >>> 0) || 1);
  const ctx = { rng, draw, seen: new Set(), pyqCellsFor };
  const range = { min: spec.difficulty?.min ?? 1, max: spec.difficulty?.max ?? 4 };
  const { slots, units } = allocateUnits(spec, chapters, rng);
  const composition = { pyq: 0, authored: 0, nativeMcq: 0, numericToMcq: 0, assertionReason: 0, caseStudy: 0, multiCorrect: 0, matrixMatch: 0, writtenAsObjective: 0, chapterSubstituted: 0, internalChoice: 0 };
  const reduced = [];
  const chapterOf = id => chapters.find(c => c.id === id);
  const choiceSlots = {};
  for (const section of spec.sections) {
    if (!section.internalChoice) continue;
    choiceSlots[section.id] = new Set(shuffle(rng, [...Array(section.questions).keys()]).slice(0, section.internalChoice));
  }

  const questions = [];
  for (const slot of slots) {
    const section = slot.section;
    const choice = !!choiceSlots[section.id]?.has(slot.index);
    let chapter = chapterOf(slot.chapterId);
    let built = buildItem(ctx, spec, section, slot, chapter, chapters, range, composition, choice);
    if (!built) {
      // The allotted chapter cannot produce this item type: take it from any
      // other chapter in scope and say so, rather than shrinking the paper.
      for (const candidate of shuffle(rng, chapters.filter(c => c.id !== chapter.id))) {
        built = buildItem(ctx, spec, section, slot, candidate, chapters, range, composition, choice);
        if (built) { composition.chapterSubstituted++; reduced.push(`Section ${section.id} question ${slot.index + 1}: ${chapter.name} could not supply a ${section.types?.[0] || section.type} item, so ${candidate.name} was used.`); chapter = candidate; break; }
      }
    }
    if (!built) {
      throw Object.assign(new Error(`The authored banks cannot compose Section ${section.id} (${(section.types || [section.type]).join('/')}) of ${spec.label}.`), { status: 503, code: 'INDIA_EXAM_COMPOSITION_FAILED' });
    }
    if (built.pyq) composition.pyq++; else composition.authored++;
    if (built.conversion === 'native-mcq') composition.nativeMcq++;
    if (built.conversion === 'numeric-to-mcq') composition.numericToMcq++;
    if (built.item === 'assertion-reason') composition.assertionReason++;
    if (built.item === 'case-study') composition.caseStudy++;
    if (built.item === 'multi-correct') composition.multiCorrect++;
    if (built.item === 'matrix-match') composition.matrixMatch++;
    if (built.payload.alt || built.payload.parts?.some(p => p.alt)) composition.internalChoice++;
    questions.push({
      order: questions.length + 1,
      section: section.id, sectionLabel: section.label || `Section ${section.id}`,
      item: built.item, chapterId: chapter.id, chapterName: chapter.name,
      generator: built.generator, difficulty: built.difficulty, seed: built.seed, altSeed: built.altSeed || null,
      pyq: built.pyq, conversion: built.conversion || null,
      marking: marking(section),
      payload: { ...built.payload, examItem: built.item }
    });
  }

  // Assertion-reason slots that fell back to plain MCQ, and choices that could
  // not be paired, are pattern reductions and are said out loud.
  for (const section of spec.sections) {
    const rows = questions.filter(q => q.section === section.id);
    if (section.assertionReason && rows.filter(q => q.item === 'assertion-reason').length < section.assertionReason) {
      reduced.push(`Section ${section.id}: only ${rows.filter(q => q.item === 'assertion-reason').length} of ${section.assertionReason} assertion-reason items could be composed; the rest are plain MCQ.`);
    }
    const paired = rows.filter(q => q.payload.alt || q.payload.parts?.some(p => p.alt)).length;
    if (section.internalChoice && paired < section.internalChoice) {
      reduced.push(`Section ${section.id}: internal choice offered on ${paired} of ${section.internalChoice} questions.`);
    }
  }
  if (composition.assertionReason) reduced.push('Assertion-reason items are composed from generator facts, not authored statements.');
  if (composition.caseStudy) reduced.push('Case studies are chaptered sub-questions without a narrative passage.');
  if (composition.writtenAsObjective) reduced.push(`${composition.writtenAsObjective} written-answer slot(s) were filled with objective items because the chapter has no written-answer generator at this depth.`);
  if (composition.multiCorrect) reduced.push('Multiple-correct items are paired claims about two problems’ answers.');
  if (composition.matrixMatch) reduced.push('Matching-list items match four problems to their answers.');
  if (spec.track === 'jee-main' && composition.pyq === 0) reduced.push('No reviewed previous-year questions are published yet; every question is authored JEE-depth practice.');
  if (units) {
    const off = units.filter(u => Math.abs(u.assigned - u.target) > 2);
    for (const u of off) reduced.push(`Unit weightage: ${u.name} carries ${u.assigned} marks against a target of ${u.target}.`);
  }

  const totalMarks = questions.reduce((n, q) => n + q.marking.correct, 0);
  return { spec, seed: (Number(seed) >>> 0) || 1, questions, units, composition, reducedPattern: reduced, totalMarks };
}
