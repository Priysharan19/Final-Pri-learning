// Independent, answer-blind audit for original CBSE Class X 2026–27 forms.
// Parse only the student-visible prompt; never trust the generator's hidden
// instance metadata or answer key as the mathematical oracle.
import assert from 'node:assert/strict';
import { makeRng } from '../src/engine/qhelpers.js';
import { indiaClass10 as originalBank } from '../src/engine/generators/india-class10-base.js';
import { indiaClass10 } from '../src/engine/generators/india-class10.js';
import { indiaClass10Core } from '../src/engine/generators/india-class10-core.js';
import { currentQuadraticContext } from '../src/engine/generators/india-class10-quadratic-context.js';
import { loadAllBanks, generateQuestion, bankOf } from '../src/engine/generators/index.js';
import { checkAnswer, methodMarks, stepCheck } from '../src/engine/checker.js';
import { marksPossibleFor, stepEvidence } from '../../server/platform/markerOps.js';
import { publicQuestionFields } from '../src/engine/publicQuestion.js';
import { inspect } from '../../server/test/selfcheck.mjs';
import { IN_CHAPTERS } from '../src/engine/curriculum-in.js';
import { CBSE_CLASS10_2026_27_CHAPTERS } from '../src/engine/ncert/class10-2026-27-production.js';
import { CBSE_CLASS10_ORIGINAL_COMPETENCY_PROVENANCE, CBSE_CLASS10_ORIGINAL_COMPETENCY_COVERS } from '../src/engine/curriculum-in-competency-covers.js';
await loadAllBanks();
assert.equal(CBSE_CLASS10_ORIGINAL_COMPETENCY_PROVENANCE.humanMathApproved, false);
assert.equal(CBSE_CLASS10_ORIGINAL_COMPETENCY_PROVENANCE.mathReviewStatus, 'pending-independent');
assert.equal(CBSE_CLASS10_ORIGINAL_COMPETENCY_PROVENANCE.boardApproved, false);
for (const [chapterId, covers] of Object.entries(CBSE_CLASS10_ORIGINAL_COMPETENCY_COVERS)) {
  const sourceChapter = CBSE_CLASS10_2026_27_CHAPTERS.find(ch => ch.id === chapterId);
  const liveChapter = IN_CHAPTERS.find(ch => ch.id === chapterId);
  assert.ok(sourceChapter && liveChapter);
  for (const cover of covers) {
    assert.ok(!sourceChapter.covers.some(x => x.gen === cover.gen), 'original additions do not falsely claim historical source review');
    assert.ok(liveChapter.covers.some(x => x.gen === cover.gen && x.dp[0] === cover.dp[0] && x.diff[0] === 3), 'new practice reaches live syllabus independently');
  }
}

const families = [
  { id: 'c10-ap-inverse-competency', family: 'original-cbse-x-2026-inverse-ap' },
  { id: 'c10-linear-ticket-competency', family: 'original-cbse-x-2026-ticket-system' },
  { id: 'c10-quadratic-triangle-competency', family: 'original-cbse-x-2026-triangle-quadratic' }
];
let assertions = 0, newDraws = 0;
const unique = {};
const allAnswers = [];

function numbersInMath(prompt) {
  return [...prompt.matchAll(/\$(-?\d+)\$/g)].map(m => Number(m[1]));
}
function independentAnswer(q) {
  if (q.contentFamily === 'original-cbse-x-2026-inverse-ap') {
    const [first, difference, total] = numbersInMath(q.prompt);
    assert.ok(first > 0 && difference > 0 && total > 0);
    const solutions = [];
    let cumulative = 0;
    for (let n = 1; n <= 150; n++) {
      cumulative += first + (n - 1) * difference;
      if (cumulative === total) solutions.push(n);
    }
    assert.equal(solutions.length, 1, 'inverse AP unique natural-number solution');
    return solutions[0];
  }
  if (q.contentFamily === 'original-cbse-x-2026-ticket-system') {
    const amounts = [...q.prompt.matchAll(/₹(\d+)/g)].map(m => Number(m[1]));
    assert.equal(amounts.length, 3, 'two fares and total revenue all specified');
    const tickets = numbersInMath(q.prompt)[0];
    const [studentFare, adultFare, revenue] = amounts;
    assert.ok(studentFare > 0 && adultFare > studentFare && tickets > 0);
    const pairs = [];
    for (let students = 0; students <= tickets; students++) {
      const adults = tickets - students;
      if (studentFare * students + adultFare * adults === revenue) pairs.push([students, adults]);
    }
    assert.equal(pairs.length, 1, 'ticket system has precisely one nonnegative integer solution');
    return pairs[0][0];
  }
  if (q.contentFamily === 'original-cbse-x-2026-triangle-quadratic') {
    const [area, extra] = numbersInMath(q.prompt);
    assert.ok(area > 0 && extra > 0);
    const solutions = [];
    for (let h = 1; h <= 150; h++) {
      if (h * (h + extra) === 2 * area) solutions.push(h);
    }
    assert.equal(solutions.length, 1, 'triangle has exactly one positive integer height');
    return solutions[0];
  }
  throw new Error(`Unexpected family: ${q.contentFamily}`);
}


function independentlyDerivedWorking(q, oracle) {
  const nums = numbersInMath(q.prompt);
  if (q.contentFamily === 'original-cbse-x-2026-inverse-ap') {
    const [first, difference, total] = nums;
    return {
      source: `${difference}*n^2+${2 * first - difference}*n-${2 * total}=0`,
      working: `${difference}*n^2+${2 * first - difference}*n-${2 * total}=0
(n-${oracle})*(${difference}*n+${2 * first + (oracle - 1) * difference})=0
n=${oracle}`
    };
  }
  if (q.contentFamily === 'original-cbse-x-2026-ticket-system') {
    const [studentFare, adultFare, revenue] = [...q.prompt.matchAll(/₹(\d+)/g)].map(m => Number(m[1]));
    const tickets = nums[0];
    return {
      source: `${studentFare}*x+${adultFare}*(${tickets}-x)=${revenue}`,
      working: `${studentFare}*x+${adultFare}*(${tickets}-x)=${revenue}
${adultFare - studentFare}*x=${adultFare * tickets - revenue}
x=${oracle}`
    };
  }
  const [area, extra] = nums;
  return {
    source: `x*(x+${extra})=${2 * area}`,
    working: `x*(x+${extra})=${2 * area}
x^2+${extra}*x-${2 * area}=0
(x-${oracle})*(x+${oracle + extra})=0
x=${oracle}`
  };
}

for (const { id, family } of families) {
  assert.equal(bankOf(id), 'india-class10-competency', 'new content is lazy loaded outside base Class 10');
  assert.ok(!Object.hasOwn(indiaClass10, id), 'old Class 10 generator remains byte-for-byte unchanged');
  const prompts = new Set();
  let found = 0;
  for (let seed = 1; seed <= 1600; seed++) {
    const q = generateQuestion(id, 3, seed * 311 + 17);
    assert.equal(q.subtopic, id);
    assert.equal(q.difficulty, 3);
    assert.ok(IN_CHAPTERS.some(ch => ch.grade === 10 && ch.covers.some(c => c.gen === id && c.diff.includes(3))), 'generator belongs to live Class X curricular coverage');
    if (q.contentFamily !== family) continue;
    found++;
    prompts.add(q.prompt);
    const oracle = independentAnswer(q);
    assert.equal(q.answer.value, oracle, `independently solved ${id} seed ${seed}`);
    const publicIssue = publicQuestionFields(q);
    assert.ok(!Object.hasOwn(publicIssue, 'answer') && !Object.hasOwn(publicIssue, 'stepcheck') && !Object.hasOwn(publicIssue, 'seed'), 'issued student prompt excludes both the key and server-side marking source');
    assert.deepEqual(inspect(q), [], `question inspection ${id} seed ${seed}`);
    assert.equal(checkAnswer(q, String(oracle)).correct, true, 'real checker accepts oracle');
    assert.equal(checkAnswer(q, String(oracle + 1)).correct, false, 'real checker rejects +1');
    assert.equal(checkAnswer(q, String(oracle - 1)).correct, false, 'real checker rejects -1');
    assert.equal(checkAnswer(q, String(-oracle)).correct, false, 'real checker rejects sign error');
    // Grading is server-authoritative and must credit mathematically valid
    // intermediate algebra when the final answer is wrong, while refusing
    // an isolated final root or a wrong root as "method" work.
    if (seed <= 100) {
      const { source, working } = independentlyDerivedWorking(q, oracle);
      assert.equal(q.stepcheck?.source, source, 'server source equation follows the student-visible prompt');
      assert.ok(!source.includes('undefined'), 'no missing coefficients in the authored source');
      const report = stepCheck(q.stepcheck, working, { prompt: q.prompt });
      assert.ok(report.lines.every(line => line.status === 'ok'), `independent worked solution checked: ${id} seed ${seed}`);
      const marks = marksPossibleFor(q);
      assert.equal(marks, 3, 'D3 should have a genuine three-mark method contract');
      const graded = methodMarks({ meta: q.stepcheck, working, marks, prompt: q.prompt, report });
      assert.equal(graded?.awarded, 2, `two valid method marks with a wrong final answer: ${id} seed ${seed}`);
      const wrongFinal = String(oracle + 1);
      const authority = stepEvidence(q, wrongFinal, working, checkAnswer(q, wrongFinal));
      assert.equal(authority.partial?.awarded, 2, 'server-owned marking must retain credit for verified steps under a wrong final answer');
      assert.equal(authority.stepReport?.firstBreak, -1, 'the verified intermediate method must contain no false step');
      const rootAlone = methodMarks({
        meta: q.stepcheck, working: `${q.stepcheck.variable}=${oracle}`, marks, prompt: q.prompt
      });
      assert.equal(rootAlone?.awarded ?? 0, 0, 'bare correct root must not masquerade as derivation');
      const wrongRoot = methodMarks({
        meta: q.stepcheck, working: `${q.stepcheck.variable}=${oracle + 1}`, marks, prompt: q.prompt
      });
      assert.equal(wrongRoot?.awarded ?? 0, 0, 'incorrect root must not receive method credit');
    }
    const replay = generateQuestion(id, 3, seed * 311 + 17);
    assert.deepEqual(q, replay, 'same seed yields same complete item');
    for (const hint of q.hints) {
      assert.ok(!hint.includes(`$${oracle}$`) && !hint.endsWith(`=${oracle}$`), 'hint does not give final answer');
    }
    allAnswers.push(q.answer.value);
    newDraws++;
    assertions += 13;
  }
  assert.equal(found, 1600, `new standalone Class X bank is always available (${id})`);
  assert.ok(prompts.size > 150, `meaningful variation in ${id}: ${prompts.size}`);
  unique[id] = { newlyServed: found, distinctPrompts: prompts.size };
}

// No regression in ANY existing D1–D4 generator output. New families use
// separate IDs instead of changing old seeded prompts or content identities.
const original = {
  'c10-arithmetic-progressions': originalBank['c10-arithmetic-progressions'],
  'c10-linear-pair-methods': indiaClass10Core['c10-linear-pair-methods'],
  'c10-quadratic-context': currentQuadraticContext
};
for (const id of Object.keys(original)) {
  for (const diff of [1, 2, 3, 4]) {
    for (let seed = 1; seed <= 100; seed++) {
      const s = seed * 83 + diff * 7;
      assert.deepEqual(indiaClass10[id](makeRng(s), diff), original[id](makeRng(s), diff),
        `existing form changed ${id} D${diff} seed ${seed}`);
      assertions++;
    }
  }
}
assert.ok(allAnswers.every(Number.isSafeInteger));
console.log('PASS: Class X original competency families — independently solved, unique, checkable, replayable');
console.log(JSON.stringify({ assertions, independentlyAuditedNewDraws: newDraws, unchangedExistingFormChecks: 1200, families: unique }, null, 2));
