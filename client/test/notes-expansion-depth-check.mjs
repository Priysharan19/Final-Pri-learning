// Notes expansion regression: keep the 2026-10 educational additions visible,
// maintain the original chapter spine, and do not confuse numerical variants
// with genuinely new authored worked examples.
import assert from 'node:assert/strict';
import { IN_CURRICULUM } from '../src/engine/curriculum-in.js';
import { loadNotesForGrade } from '../src/notes/notesIndex.js';

const expectedByGrade = Object.freeze({ 7: 15, 8: 13, 9: 8, 10: 14, 11: 14, 12: 13 });
let count = 0;
let totalWorked = 0;
const gradeWorked = new Map();
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
    assert.ok(n.examples.length >= (group.grade >= 10 ? 4 : 5), `worked-example enrichment missing: ${chapter.id}`);
    totalWorked += n.examples.length;
    gradeWorked.set(group.grade, (gradeWorked.get(group.grade) || 0) + n.examples.length);
    const questions = n.examples.map(x => String(x.question).replace(/\s+/g, ' ').trim());
    assert.equal(new Set(questions).size, questions.length, `duplicate worked example in ${chapter.id}`);
    for (const item of n.examples) {
      assert.ok(item.verify, `worked example lacks deterministic check: ${chapter.id}`);
    }
    count++;
  }
}
const c11 = await loadNotesForGrade(11);
assert.equal(c11['c11-complex-numbers'].examples.length, 30, 'Complex Numbers should retain 26 former examples and 4 new Argand-angle diagrams');
assert.equal(c11['c11-complex-numbers'].examples.filter(x => x.question.startsWith('Optional JEE')).length, 8, 'JEE extension labels are required');
assert.ok(c11['c11-complex-numbers'].examples.slice(10,26).every(x => x.question.startsWith('Optional ')), 'Previously-authored 16 optional studies must remain distinct');
assert.ok(c11['c11-complex-numbers'].examples.slice(-4).every(x => x.question.startsWith('Optional Argand rotation')), 'Additional complex plane rotation figures must remain labelled optional');
assert.deepEqual(Object.fromEntries(gradeWorked), { 7: 242, 8: 276, 9: 255, 10: 319, 11: 373, 12: 386 }, 'Class-by-class authored depth must be retained');
assert.equal(totalWorked, 1851, 'expected 1,251 prior notes plus 600 original visual investigations');
assert.equal(count, 77, 'total chapter count changed unexpectedly');
console.log(`Notes expansion breadth PASS: ${count}/77 existing chapters, at least 5 examples for Class 7–9 and 4 for Class 10–12, 8 JEE bridges and 16 deeper Complex Numbers studies`);
