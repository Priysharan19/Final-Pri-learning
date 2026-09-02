import assert from 'node:assert/strict';
import { IN_CHAPTER_BY_ID } from '../src/engine/curriculum-in.js';
import { indiaChapterEvidence, indiaProgressSummary, indiaProgressCopy } from '../src/engine/indiaProgress.js';

const chapter = IN_CHAPTER_BY_ID['c10-quadratic-equations'];
assert.ok(chapter, 'Class 10 quadratic chapter must exist');
const ids = [...new Set(chapter.covers.map(c => c.gen))];
assert.ok(ids.length > 0);

const ratings = Object.fromEntries(ids.map((id, index) => [id, {
  attempts: 5 + index,
  correct: 4 + index,
  last_at: 1700000000000 + index
}]));
const row = indiaChapterEvidence(chapter, ratings);
assert.ok(row.attempts >= 5);
assert.ok(row.correct <= row.attempts);
assert.ok(row.accuracy >= 0 && row.accuracy <= 100);

const summary = indiaProgressSummary([chapter], ratings);
assert.equal(summary.chapters, 1);
assert.equal(summary.chaptersStarted, 1);
assert.equal(summary.chaptersPractised, 1);
const copy = indiaProgressCopy(summary, { track: 'cbse', grade: 10 });
assert.match(copy.title, /Class 10 CBSE \/ NCERT progress/);
assert.equal(copy.prediction, null, 'India product presentation must not invent an HSC/board predicted mark');
assert.doesNotMatch(`${copy.primary} ${copy.secondary}`, /Band|ATAR|HSC/i);

const empty = indiaProgressCopy(indiaProgressSummary([chapter], {}), { track: 'jee-main', grade: 12 });
assert.equal(empty.prediction, null);
assert.match(empty.title, /JEE Main progress/);

console.log('INDIA PROGRESS PRODUCT — PASS — chapter evidence is curriculum-native and no Australian predicted-band semantics are emitted.');
