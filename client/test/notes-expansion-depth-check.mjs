// Notes expansion regression: keep the 2026-10 educational additions visible,
// maintain the original chapter spine, and do not confuse numerical variants
// with genuinely new authored worked examples.
import assert from 'node:assert/strict';
import { IN_CURRICULUM } from '../src/engine/curriculum-in.js';
import { loadNotesForGrade } from '../src/notes/notesIndex.js';

const expectedByGrade = Object.freeze({ 7: 15, 8: 13, 9: 8, 10: 14, 11: 14, 12: 13 });
let count = 0;
for (const group of IN_CURRICULUM) {
  const notes = await loadNotesForGrade(group.grade);
  assert.equal(group.chapters.length, expectedByGrade[group.grade], `unexpected grade ${group.grade} spine`);
  assert.equal(Object.keys(notes).length, group.chapters.length, `grade ${group.grade} notes missing`);
  for (const chapter of group.chapters) {
    const n = notes[chapter.id];
    assert.ok(n, `missing notes for ${chapter.id}`);
    assert.ok(n.concepts.length >= 2, `concept enrichment missing: ${chapter.id}`);
    assert.ok(n.points.length >= 2, `recall enrichment missing: ${chapter.id}`);
    assert.ok(n.mistakes.length >= 2, `misconception enrichment missing: ${chapter.id}`);
    assert.ok(n.examples.length >= 3, `worked-example enrichment missing: ${chapter.id}`);
    const questions = n.examples.map(x => String(x.question).replace(/\\s+/g, ' ').trim());
    assert.equal(new Set(questions).size, questions.length, `duplicate worked example in ${chapter.id}`);
    for (const item of n.examples) {
      assert.ok(item.verify, `worked example lacks deterministic check: ${chapter.id}`);
    }
    count++;
  }
}
const c11 = await loadNotesForGrade(11);
assert.equal(c11['c11-complex-numbers'].examples.length, 10, 'Complex Numbers should have 2 existing + 8 supplemental examples');
assert.equal(c11['c11-complex-numbers'].examples.filter(x => x.question.startsWith('Optional JEE')).length, 8, 'JEE extension labels are required');
assert.equal(count, 77, 'total chapter count changed unexpectedly');
console.log(`Notes expansion breadth PASS: ${count}/77 existing chapters, >=3 examples per chapter, 8 labelled JEE bridge studies`);
