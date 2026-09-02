import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IN_CURRICULUM } from '../src/engine/curriculum-in.js';
import { dotpointAvailable, practiceTargetAvailable, topicAvailability } from '../src/engine/curriculumAvailability.js';

const grade10 = IN_CURRICULUM.find(group => group.grade === 10);
assert.ok(grade10, 'Class 10 curriculum must exist');

function decorated(id) {
  const chapter = grade10.chapters.find(row => row.id === id);
  assert.ok(chapter, `missing Class 10 chapter ${id}`);
  return {
    ...chapter,
    dotpoints: chapter.dotpoints.map((text, ordinal) => ({
      text,
      generated: (chapter.covers || []).some(cover => cover.dp.includes(ordinal) && (cover.diff || []).length > 0)
    }))
  };
}

const pairLinear = decorated('c10-pair-linear-equations');
const realNumbers = decorated('c10-real-numbers');
const ap = decorated('c10-arithmetic-progressions');

// All current Class X outcomes are now source-reviewed and authored. These
// assertions replace the old visible-but-unselectable state without weakening
// the generic fail-closed availability contract used by other incomplete grades.
assert.deepEqual(topicAvailability(pairLinear), {
  total: 3, available: 3, missing: 0, selectable: true, complete: true
}, 'Pair of Linear Equations must expose all reviewed current outcomes');
assert.equal(practiceTargetAvailable(pairLinear), true);
for (let i = 0; i < pairLinear.dotpoints.length; i++) assert.equal(practiceTargetAvailable(pairLinear, i), true);

assert.deepEqual(topicAvailability(realNumbers), {
  total: 2, available: 2, missing: 0, selectable: true, complete: true
}, 'Real Numbers must include both FTA and irrationality-proof practice');
assert.equal(practiceTargetAvailable(realNumbers), true);
assert.equal(practiceTargetAvailable(realNumbers, 0), true, 'FTA dot point is authored');
assert.equal(practiceTargetAvailable(realNumbers, 1), true, 'irrationality-proof dot point is authored');
assert.equal(dotpointAvailable(realNumbers.dotpoints[1]), true);

assert.deepEqual(topicAvailability(ap), {
  total: 3, available: 3, missing: 0, selectable: true, complete: true
});
for (let i = 0; i < ap.dotpoints.length; i++) assert.equal(practiceTargetAvailable(ap, i), true);

for (const chapter of grade10.chapters.map(ch => decorated(ch.id))) {
  const state = topicAvailability(chapter);
  assert.equal(state.complete, true, `${chapter.id}: every current Class X dot point should now be available`);
  assert.equal(state.selectable, true, `${chapter.id}: chapter should be selectable`);
  for (let i = 0; i < chapter.dotpoints.length; i++) {
    assert.equal(practiceTargetAvailable(chapter, i), true, `${chapter.id} dot point ${i + 1}: practice target`);
  }
}

const home = readFileSync(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
assert.ok(home.includes("from '../engine/curriculumAvailability.js'"), 'Home must consume the central availability contract');
assert.ok(home.includes('Coming soon'), 'generic incomplete topics must remain visibly labelled rather than disappearing');
assert.ok(home.includes('Question forms coming soon'), 'generic uncovered dot points must tell students why they cannot be selected');
assert.ok(home.includes('disabled={!available}'), 'unavailable topic/dot-point controls must be disabled');
assert.ok(home.includes('disabled={impossibleTarget}'), 'Generate must fail closed for stale impossible selections');

console.log('PASS — all current Class X outcomes are selectable while Home retains fail-closed behavior for genuinely incomplete curriculum targets.');
