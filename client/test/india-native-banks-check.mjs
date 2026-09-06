// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the India curriculum is served by India-native banks
//
// Pri Learning was built against the NSW syllabus and pivoted to India, and
// nineteen of the eighty-four India chapters were still reaching at least one
// of their dot points through a generator written for that older syllabus:
// `y10-simeq` behind Class 10 elimination, `y11-diff` behind Class 11 Limits
// and Derivatives, `y12-appdiff` behind Class 12 Application of Derivatives,
// `me12-binomial` behind the Class 12 random variable, and so on.
//
// Two different things were wrong with that, and this file pins both.
//
// The first is visible: over a sample of those chapters' prompts there were 21
// Australian place references and 9 dollar or cent references, and no rupees
// and no Indian places at all. A Class 11 student in Lucknow was being asked
// about a Sydney commute priced in dollars.
//
// The second is not visible in any single prompt and matters more: an NSW Year
// 11 differentiation bank is not an NCERT Limits and Derivatives bank. NCERT
// opens that chapter with algebraic limits and the derivative from FIRST
// PRINCIPLES and lists the chain rule as formative only; the NSW ladder opens
// with the chain rule and runs on to curve sketching. Neither bank is wrong.
// One of them is a different course. The same is true of Application of
// Derivatives, where the CBSE bullet is rate of change, increasing/decreasing
// and maxima/minima, and of Class 12 probability, where the CBSE chapter is
// conditional probability and Bayes rather than the binomial distribution.
//
// So the checks below are not "does the wording mention rupees". They are:
// no India chapter reaches an NSW generator any more; the NSW generators are
// still there for the Australian courses, which still ship; every question the
// new banks produce is marked correct by the real marker and is well formed;
// every MCQ-convertible question carries designed distractors that are distinct
// AS THE STUDENT READS THEM, which is a stricter test than distinct as numbers;
// and no review state moved, because authoring a generator is not a source
// review and this suite must not be able to launder one into the other.
// ─────────────────────────────────────────────────────────────────────────────
import { IN_CHAPTERS, IN_CHAPTER_BY_ID, OWN_GENERATOR, DIFFICULTIES, mappedGenerators, nativeGenerators } from '../src/engine/curriculum-in.js';
import { INDIA_NATIVE_COVERS, INDIA_NATIVE_COVER_IDS } from '../src/engine/curriculum-in-native-covers.js';
import { SUBTOPIC_BY_ID } from '../src/engine/curriculum.js';
import { GENERATORS, loadAllBanks, generateQuestion, bankOf } from '../src/engine/generators/index.js';
import { checkAnswer } from '../src/engine/checker.js';
import { numericToMcq, hasFourDistinctOptions, plainNumericAnswer } from '../src/engine/indiaExamComposer.js';
import { renderedAs } from '../src/engine/generators/india-native-helpers.js';
import { indiaProductionStatus, INDIA_CONTENT_QUALITY, INDIA_RELEASE_STATE } from '../src/engine/indiaProductionMeta.js';
import { inspect } from '../../server/test/selfcheck.mjs';

await loadAllBanks();

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (got, want, label) => ok(got === want, `${label} — expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);

// The generators the India curriculum used to borrow. Named one by one rather
// than matched by a pattern, so that deleting one of them from the table is a
// visible decision instead of a regex quietly stopping to match.
const BORROWED = [
  'y8-probability', 'y10-simeq', 'y10-quadratics', 'y10-probability', 'y10-stats',
  'y11-functions', 'y11-trigfunc', 'y11-lines', 'y11-diff', 'y11-probability',
  'y12-series', 'y12-diff', 'y12-appdiff', 'y12-integration',
  'me11-comb', 'me11-functions', 'me11-inversetrig', 'me11-trigid',
  'me12-binomial', 'me12-trigeq', 'mex-complex', 'mex-integration', 'mex-vectors'
];

// The generators authored to replace them.
const NATIVE = [
  'c10-linear-pair-methods', 'c10-quadratic-roots', 'c10-probability-classical',
  'c11-relations-functions', 'c11-trig-functions', 'c11-complex-numbers',
  'c11-permutations-combinations', 'c11-sequences-series', 'c11-straight-lines',
  'c11-limits-derivatives', 'c11-probability',
  'c12-functions-onto-inverse', 'c12-inverse-trigonometric', 'c12-differentiation-rules',
  'c12-applications-derivatives', 'c12-integrals-methods', 'c12-definite-integrals',
  'c12-vector-dot-product', 'c12-conditional-probability', 'c12-random-variable'
];

// ── 1 · No India chapter reaches an NSW generator ────────────────────────────
// Derived from the live curriculum rather than from the list above, so a
// chapter that starts borrowing some *other* NSW subtopic tomorrow fails here.
const borrowedEntries = [];
for (const chapter of IN_CHAPTERS) {
  for (const cover of chapter.covers) {
    if (!OWN_GENERATOR.test(cover.gen)) borrowedEntries.push(`${chapter.id} → ${cover.gen}`);
  }
}
eq(borrowedEntries.length, 0, `no India chapter maps to a generator written for another curriculum (${borrowedEntries.slice(0, 6).join(', ')})`);
eq(mappedGenerators().length, 0, 'the India curriculum reuses no NSW generator at all');
ok(nativeGenerators().length >= NATIVE.length, 'every generator the India curriculum reaches was written for it');
for (const gen of BORROWED) {
  ok(!IN_CHAPTERS.some(chapter => chapter.covers.some(cover => cover.gen === gen)), `${gen} no longer serves any India chapter`);
}

// ── 2 · The Australian courses still ship ────────────────────────────────────
// Removing a generator from the India curriculum must not remove it from the
// product. Every borrowed subtopic is still a real NSW subtopic with a working
// generator behind it.
for (const gen of BORROWED) {
  ok(!!SUBTOPIC_BY_ID[gen], `${gen} is still an NSW subtopic`);
  ok(typeof GENERATORS[gen] === 'function', `${gen} still has a generator behind it`);
}

// ── 3 · The native generators are reachable ──────────────────────────────────
for (const gen of NATIVE) {
  ok(OWN_GENERATOR.test(gen), `${gen} is named by this curriculum's own convention`);
  ok(typeof GENERATORS[gen] === 'function', `${gen} is registered`);
  ok(String(bankOf(gen)).startsWith('india-'), `${gen} resolves to an India bank, not an NSW one`);
  ok(IN_CHAPTERS.some(chapter => chapter.covers.some(cover => cover.gen === gen)), `${gen} is actually used by a chapter`);
}
eq(INDIA_NATIVE_COVER_IDS.length, 19, 'nineteen chapters were rewired');
for (const chapterId of INDIA_NATIVE_COVER_IDS) {
  const chapter = IN_CHAPTER_BY_ID[chapterId];
  ok(!!chapter, `${chapterId} is a live chapter`);
  const covers = INDIA_NATIVE_COVERS[chapterId];
  const reached = new Set(covers.flatMap(entry => entry.dp));
  eq(reached.size, chapter.dotpoints.length, `${chapterId}: every dot point still has a generator`);
  ok(covers.every(entry => entry.diff.length > 0 && entry.diff.every(d => DIFFICULTIES.includes(d))), `${chapterId}: every cover entry names real difficulties`);
  ok(covers.every(entry => entry.dp.every(i => i >= 0 && i < chapter.dotpoints.length)), `${chapterId}: every cover entry names real dot points`);
}

// ── 4 · Every question the new banks make is markable and well formed ────────
// The engine self-check already sweeps these cells at 2000 draws a piece; this
// is the same assertion made where the contract lives, so a change to the banks
// that breaks marking fails in the suite that owns them too.
const DRAWS = 80;
const AUSTRALIAN = /\b(Sydney|Melbourne|Brisbane|Perth|Adelaide|Canberra|Hobart|Darwin|Wollongong|Parramatta|Bondi|Australia|Australian|NSW|New South Wales|Queensland|Tasmania|AFL)\b/i;
// `\$` is how the NSW banks write money; a bare `$` is the maths delimiter and
// says nothing about currency, so only the escaped form counts.
const DOLLARS = /\\\$|\bdollars?\b|\bcents?\b/i;
const INDIAN = /₹|\b(Delhi|Mumbai|Chennai|Kolkata|Bengaluru|Hyderabad|Pune|Jaipur|Lucknow|Ahmedabad|Bhopal|Patna|Kochi|Nagpur|Indore|Guwahati|Chandigarh|Surat|Varanasi|Coimbatore|Noida|kirana|cricket|kabaddi|Ludo|Diwali|Holi|Pongal|Onam|Durga Puja|Baisakhi|Eid|dal|basmati|mustard oil)\b/i;

let made = 0, marked = 0, wellFormed = 0, withTraps = 0, convertible = 0, fourOptions = 0, mirrored = 0;
const generatorsWithIndianContext = new Set();
const problems = [];
const note = line => { if (problems.length < 10) problems.push(line); };

/** The string `indiaExamComposer.formatLike` will print for `value`. */
const asComposerPrints = (q, value) =>
  `${q.answerPrefix ? `${q.answerPrefix} ` : ''}${renderedAs(q.answer.value, value)}${q.answerSuffix ? ` ${q.answerSuffix}` : ''}`;

for (const gen of NATIVE) {
  for (const difficulty of DIFFICULTIES) {
    for (let i = 0; i < DRAWS; i++) {
      let q;
      try { q = generateQuestion(gen, difficulty, (difficulty * 90001 + i * 1013 + gen.length * 17) >>> 0); }
      catch (err) { note(`${gen} D${difficulty}: threw ${err.message}`); continue; }
      made++;

      const faults = inspect(q);
      if (faults.length) note(`${gen} D${difficulty}: ${faults[0]}`);
      else wellFormed++;

      if (q.answerType === 'mcq') {
        if (checkAnswer(q, String(q.answer.correctIndex)).correct) marked++;
        else note(`${gen} D${difficulty}: the keyed option is marked wrong by its own marker`);
      } else {
        // The declared answer, in the exact form the payload states it.
        const input = q.answer.simplestFraction
          ? `${q.answer.simplestFraction.n}/${q.answer.simplestFraction.d}`
          : q.answerType === 'point' ? `(${q.answer.x}, ${q.answer.y})`
            : q.answerType === 'set' ? q.answer.values.join(', ')
              : String(q.answer.value);
        const verdict = checkAnswer(q, input);
        if (verdict.correct) marked++;
        else note(`${gen} D${difficulty}: keyed "${input}" is marked wrong by its own marker (${verdict.feedback || ''})`);
      }

      // Text: Indian where there is a context at all, never Australian.
      const text = [q.prompt, ...(q.hints || []), ...(q.steps || []).flatMap(s => [s.h, s.d]), ...(q.mcqOptions || [])].join('\n');
      if (AUSTRALIAN.test(text)) note(`${gen} D${difficulty}: Australian reference "${text.match(AUSTRALIAN)[0]}"`);
      if (DOLLARS.test(text)) note(`${gen} D${difficulty}: money in dollars "${text.match(DOLLARS)[0]}"`);
      if (INDIAN.test(q.prompt)) generatorsWithIndianContext.add(gen);

      // Traps: designed, named, and distinct as rendered text.
      const mcqConvertible = q.answerType === 'numeric' && (plainNumericAnswer(q) || !!q.answer.simplestFraction);
      if (mcqConvertible) {
        convertible++;
        const traps = q.traps || [];
        if (!traps.length) note(`${gen} D${difficulty}: MCQ-convertible but carries no designed distractor`);
        else withTraps++;
        const seen = new Set([renderedAs(q.answer.value, q.answer.value)]);
        for (const trap of traps) {
          if (typeof trap.value !== 'number' || !Number.isFinite(trap.value)) { note(`${gen} D${difficulty}: trap value is not a finite number`); continue; }
          if (!trap.why || String(trap.why).trim().length < 20) note(`${gen} D${difficulty}: trap ${trap.value} does not name a misconception`);
          const printed = renderedAs(q.answer.value, trap.value);
          if (seen.has(printed)) note(`${gen} D${difficulty}: two options both print "${printed}"`);
          seen.add(printed);
        }
      }

      // The composer's own conversion, on the questions it can convert.
      if (plainNumericAnswer(q)) {
        const paper = numericToMcq(q, () => 0.42);
        if (!paper) note(`${gen} D${difficulty}: refuses to become an exam MCQ`);
        else {
          if (hasFourDistinctOptions(paper)) fourOptions++;
          else note(`${gen} D${difficulty}: exam MCQ options are not four distinct strings — ${JSON.stringify(paper.mcqOptions)}`);
          // Where a designed trap became an option, the text the student reads
          // must be the one `renderedAs` predicts. This is what stops the copy
          // of `formatLike` in india-native-helpers.js drifting away from the
          // composer it mirrors without anything noticing.
          let allMirrored = true;
          for (const [index, why] of Object.entries(paper.answer.optionTraps || {})) {
            const trap = (q.traps || []).find(t => t.why === why);
            if (!trap) continue;
            if (paper.mcqOptions[index] !== asComposerPrints(q, trap.value)) {
              allMirrored = false;
              note(`${gen} D${difficulty}: composer printed "${paper.mcqOptions[index]}" where the bank predicts "${asComposerPrints(q, trap.value)}"`);
            }
          }
          if (allMirrored) mirrored++;
        }
      }
    }
  }
}

eq(made, NATIVE.length * DIFFICULTIES.length * DRAWS, 'every native cell produced its questions');
eq(marked, made, 'every question is marked correct by the real marker');
eq(wellFormed, made, 'every question is well formed');
eq(withTraps, convertible, 'every MCQ-convertible question carries a designed distractor');
ok(convertible > made * 0.6, `most of the bank is MCQ-convertible (${convertible} of ${made})`);
ok(fourOptions > 0 && problems.every(p => !p.includes('not four distinct')), 'every plain-numeric question converts to four distinct printed options');
ok(mirrored > 0, 'the bank predicts the option text the composer actually prints');
ok(generatorsWithIndianContext.size >= 7, `the contextual questions are set in India (${generatorsWithIndianContext.size} generators use an Indian context)`);
eq(problems.length, 0, `no defect in the native banks (${problems.slice(0, 4).join(' | ')})`);

// ── 5 · Nothing in the whole India curriculum is priced in dollars ───────────
// The narrow version of this — "the new banks are clean" — is checked above.
// This is the product-level claim: sample every declared cell of every India
// chapter, including the ones this change did not touch, and find no Australian
// place and no dollar anywhere.
const cells = new Set();
for (const chapter of IN_CHAPTERS) for (const cover of chapter.covers) for (const d of cover.diff) cells.add(`${cover.gen}|${d}`);
let sampled = 0;
const strays = [];
for (const cell of cells) {
  const [gen, ds] = cell.split('|');
  for (let i = 0; i < 12; i++) {
    let q;
    try { q = generateQuestion(gen, Number(ds), (i * 7919 + gen.length * 13 + Number(ds) * 101) >>> 0); } catch { continue; }
    sampled++;
    const text = [q.prompt, ...(q.hints || []), ...(q.steps || []).flatMap(s => [s.h, s.d]), ...(q.mcqOptions || [])].join('\n');
    if (AUSTRALIAN.test(text) && strays.length < 5) strays.push(`${gen} D${ds}: ${text.match(AUSTRALIAN)[0]}`);
    if (DOLLARS.test(text) && strays.length < 5) strays.push(`${gen} D${ds}: ${text.match(DOLLARS)[0]}`);
  }
}
ok(sampled > 5000, `the whole India curriculum was sampled (${sampled} questions from ${cells.size} cells)`);
eq(strays.length, 0, `no Australian place and no dollar anywhere in the India curriculum (${strays.join(' | ')})`);

// ── 6 · No review state moved ────────────────────────────────────────────────
// This is the assertion that keeps this change honest. Writing a generator is
// not reading a syllabus, and a suite that let a new bank promote a chapter to
// "source-reviewed" would be manufacturing provenance. Class 11 and 12 stay at
// quality C / published-unreviewed until a real NCERT source review says
// otherwise; the three Class 10 chapters keep the B they already had from the
// 2026–27 overlay, which reviewed their OUTCOMES and is untouched by swapping
// the generator behind one.
const CLASS10_REWIRED = ['c10-pair-linear-equations', 'c10-quadratic-equations', 'c10-probability'];
for (const chapterId of INDIA_NATIVE_COVER_IDS) {
  const chapter = IN_CHAPTER_BY_ID[chapterId];
  const status = indiaProductionStatus(chapter, chapter.grade);
  ok(status.generatorComplete, `${chapterId} has a generator behind every dot point`);
  if (CLASS10_REWIRED.includes(chapterId)) {
    eq(status.quality, INDIA_CONTENT_QUALITY.REVIEWED_MAPPING, `${chapterId} keeps the Class 10 reviewed mapping it already had`);
    eq(status.releaseState, INDIA_RELEASE_STATE.REVIEWED, `${chapterId} keeps its release state`);
  } else {
    eq(status.quality, INDIA_CONTENT_QUALITY.WEAK_MAPPING, `${chapterId} is NOT promoted by authoring a generator`);
    eq(status.releaseState, INDIA_RELEASE_STATE.UNREVIEWED, `${chapterId} stays published-unreviewed until a source review`);
    eq(status.sourceReviewed, false, `${chapterId} makes no source-review claim`);
  }
}

console.log(failures.length
  ? `INDIA NATIVE BANKS: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.slice(0, 20).join('\n  · ')}`
  : `INDIA NATIVE BANKS: PASS — ${pass}/${pass} checks — 19 chapters rewired onto ${NATIVE.length} NCERT-native generators, ${made} questions marked and inspected, ${sampled} sampled across the whole India curriculum with no Australian place and no dollar.`);
process.exit(failures.length ? 1 : 0);
