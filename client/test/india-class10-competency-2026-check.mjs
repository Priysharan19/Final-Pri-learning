// Independent, answer-blind audit for original CBSE Class X 2026–27 forms.
// Parse only the student-visible prompt; never trust the generator's hidden
// instance metadata or answer key as the mathematical oracle.
import assert from 'node:assert/strict';
import { makeRng } from '../src/engine/qhelpers.js';
import { indiaClass10 as originalBank } from '../src/engine/generators/india-class10-base.js';
import { indiaClass10 } from '../src/engine/generators/india-class10.js';
import { indiaClass10Core } from '../src/engine/generators/india-class10-core.js';
import { currentQuadraticContext } from '../src/engine/generators/india-class10-quadratic-context.js';
import { loadAllBanks, generateQuestion } from '../src/engine/generators/index.js';
import { checkAnswer } from '../src/engine/checker.js';
import { inspect } from '../../server/test/selfcheck.mjs';
import { IN_CHAPTERS } from '../src/engine/curriculum-in.js';
await loadAllBanks();

const families = [
  { id: 'c10-arithmetic-progressions', family: 'original-cbse-x-2026-inverse-ap' },
  { id: 'c10-linear-pair-methods', family: 'original-cbse-x-2026-ticket-system' },
  { id: 'c10-quadratic-context', family: 'original-cbse-x-2026-triangle-quadratic' }
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

for (const { id, family } of families) {
  const prompts = new Set();
  let found = 0;
  for (let seed = 1; seed <= 1600; seed++) {
    const q = generateQuestion(id, 4, seed * 311 + 17);
    assert.equal(q.subtopic, id);
    assert.equal(q.difficulty, 4);
    assert.ok(IN_CHAPTERS.some(ch => ch.grade === 10 && ch.covers.some(c => c.gen === id && c.diff.includes(4))), 'generator belongs to live Class X curricular coverage');
    if (q.contentFamily !== family) continue;
    found++;
    prompts.add(q.prompt);
    const oracle = independentAnswer(q);
    assert.equal(q.answer.value, oracle, `independently solved ${id} seed ${seed}`);
    assert.deepEqual(inspect(q), [], `question inspection ${id} seed ${seed}`);
    assert.equal(checkAnswer(q, String(oracle)).correct, true, 'real checker accepts oracle');
    assert.equal(checkAnswer(q, String(oracle + 1)).correct, false, 'real checker rejects +1');
    assert.equal(checkAnswer(q, String(oracle - 1)).correct, false, 'real checker rejects -1');
    assert.equal(checkAnswer(q, String(-oracle)).correct, false, 'real checker rejects sign error');
    const replay = generateQuestion(id, 4, seed * 311 + 17);
    assert.deepEqual(q, replay, 'same seed yields same complete item');
    for (const hint of q.hints) {
      assert.ok(!hint.includes(`$${oracle}$`) && !hint.endsWith(`=${oracle}$`), 'hint does not give final answer');
    }
    allAnswers.push(q.answer.value);
    newDraws++;
    assertions += 13;
  }
  assert.ok(found > 600 && found < 1000, `extra content is served alongside the old questions (${id} got ${found})`);
  assert.ok(prompts.size > 150, `meaningful variation in ${id}: ${prompts.size}`);
  unique[id] = { newlyServed: found, distinctPrompts: prompts.size };
}

// No regression in the D1–D3 generator output (same seeded RNG/unchanged raw q).
const original = {
  'c10-arithmetic-progressions': originalBank['c10-arithmetic-progressions'],
  'c10-linear-pair-methods': indiaClass10Core['c10-linear-pair-methods'],
  'c10-quadratic-context': currentQuadraticContext
};
for (const { id } of families) {
  for (const diff of [1, 2, 3]) {
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
console.log(JSON.stringify({ assertions, independentlyAuditedNewDraws: newDraws, lowerDifficultyRegressions: 900, families: unique }, null, 2));
