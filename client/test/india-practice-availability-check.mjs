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
const triangles = decorated('c10-triangles');
const trig = decorated('c10-trigonometry');
const heights = decorated('c10-trig-applications');
const ap = decorated('c10-arithmetic-progressions');

assert.deepEqual(topicAvailability(pairLinear), {
  total: 4, available: 2, missing: 2, selectable: true, complete: false
}, 'safe algebraic/system forms stay usable while graphical and solution-count gaps remain visible');
assert.equal(practiceTargetAvailable(pairLinear), true);
assert.equal(practiceTargetAvailable(pairLinear, 0), false, 'graphical consistency has no audited current form');
assert.equal(practiceTargetAvailable(pairLinear, 1), false, 'algebraic number-of-solutions condition has no audited current form');
assert.equal(practiceTargetAvailable(pairLinear, 2), true, 'substitution/elimination is safely authored');
assert.equal(practiceTargetAvailable(pairLinear, 3), true, 'simple situational systems are safely authored');

assert.deepEqual(topicAvailability(realNumbers), {
  total: 2, available: 1, missing: 1, selectable: true, complete: false
}, 'partially authored Real Numbers must remain usable without hiding the current proof gap');
assert.equal(practiceTargetAvailable(realNumbers), true, 'chapter-level Real Numbers can use its current-safe FTA forms');
assert.equal(practiceTargetAvailable(realNumbers, 0), true, 'FTA dot point retains only the safe prime-factor/HCF-LCM difficulties');
assert.equal(practiceTargetAvailable(realNumbers, 1), false, 'irrationality-proof dot point must not route to a substitute generator');
assert.equal(dotpointAvailable(realNumbers.dotpoints[1]), false);

assert.deepEqual(topicAvailability(triangles), {
  total: 2, available: 0, missing: 2, selectable: false, complete: false
}, 'generic similarity/scale questions must not masquerade as current BPT or similarity-theorem practice');
assert.equal(practiceTargetAvailable(triangles), false);

assert.deepEqual(topicAvailability(trig), {
  total: 4, available: 2, missing: 2, selectable: true, complete: false
}, 'acute-ratio and special-angle practice can remain live while broad upper-year trig forms are withheld');
assert.equal(practiceTargetAvailable(trig, 0), true);
assert.equal(practiceTargetAvailable(trig, 1), true);
assert.equal(practiceTargetAvailable(trig, 2), false, '0°/90° and ratio-relationship outcome needs a bounded Class X form');
assert.equal(practiceTargetAvailable(trig, 3), false, 'identity practice needs a bounded Class X declaration');

assert.deepEqual(topicAvailability(heights), {
  total: 1, available: 0, missing: 1, selectable: false, complete: false
}, 'arbitrary-angle/bearing generators must not feed the prescribed 30°/45°/60° Class X outcome');
assert.equal(practiceTargetAvailable(heights), false);

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

console.log('PASS — India Home keeps current Class 10 gaps visible, blocks stale borrowed routes, and preserves only source-safe partial practice.');
