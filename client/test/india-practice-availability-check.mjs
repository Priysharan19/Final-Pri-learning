import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IN_CURRICULUM } from '../src/engine/curriculum-in.js';
import { practiceTargetAvailable, topicAvailability } from '../src/engine/curriculumAvailability.js';

const grade10 = IN_CURRICULUM.find(group => group.grade === 10);
assert.ok(grade10);
function decorated(source) {
  return {
    ...source,
    dotpoints: source.dotpoints.map((text, ordinal) => ({
      text,
      generated: (source.covers || []).some(cover => cover.dp.includes(ordinal) && (cover.diff || []).length > 0)
    }))
  };
}
for (const source of grade10.chapters) {
  const chapter = decorated(source);
  const state = topicAvailability(chapter);
  assert.equal(state.complete, true, `${chapter.id}: every current outcome should be authored`);
  assert.equal(state.selectable, true, `${chapter.id}: reviewed chapter should be selectable`);
  assert.equal(state.available, state.total);
  for (let i = 0; i < chapter.dotpoints.length; i++) {
    assert.equal(practiceTargetAvailable(chapter, i), true, `${chapter.id} dot point ${i + 1}`);
  }
}
const home = readFileSync(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
assert.ok(home.includes("from '../engine/curriculumAvailability.js'"));
assert.ok(home.includes('Coming soon'), 'incomplete curriculum outside reviewed Class X must still fail closed');
assert.ok(home.includes('Question forms coming soon'));
assert.ok(home.includes('disabled={!available}'));
assert.ok(home.includes('disabled={impossibleTarget}'));
console.log('PASS — every current Class X target is selectable while incomplete curriculum elsewhere still fails closed.');
