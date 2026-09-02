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

assert.deepEqual(topicAvailability(pairLinear), {
  total: 3, available: 0, missing: 3, selectable: false, complete: false
}, 'a current chapter with no audited production forms must be visible-but-unselectable');
assert.equal(practiceTargetAvailable(pairLinear), false, 'fully unavailable chapter cannot generate a dead Practice request');

assert.deepEqual(topicAvailability(realNumbers), {
  total: 2, available: 1, missing: 1, selectable: true, complete: false
}, 'partially authored Real Numbers must remain usable without hiding the current proof gap');
assert.equal(practiceTargetAvailable(realNumbers), true, 'chapter-level Real Numbers can use its authored FTA forms');
assert.equal(practiceTargetAvailable(realNumbers, 0), true, 'FTA dot point is authored');
assert.equal(practiceTargetAvailable(realNumbers, 1), false, 'irrationality-proof dot point must not route to a substitute generator');
assert.equal(dotpointAvailable(realNumbers.dotpoints[1]), false);

assert.deepEqual(topicAvailability(ap), {
  total: 3, available: 3, missing: 0, selectable: true, complete: true
});
for (let i = 0; i < ap.dotpoints.length; i++) assert.equal(practiceTargetAvailable(ap, i), true);

const home = readFileSync(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
assert.ok(home.includes("from '../engine/curriculumAvailability.js'"), 'Home must consume the central availability contract');
assert.ok(home.includes('Coming soon'), 'fully unavailable topics must remain visibly labelled rather than disappearing');
assert.ok(home.includes('Question forms coming soon'), 'uncovered dot points must tell students why they cannot be selected');
assert.ok(home.includes('disabled={!available}'), 'unavailable topic/dot-point controls must be disabled');
assert.ok(home.includes('disabled={impossibleTarget}'), 'Generate must fail closed for stale impossible selections');

console.log('PASS — India Home keeps missing syllabus outcomes visible, disables dead targets, and preserves partial authored practice.');
