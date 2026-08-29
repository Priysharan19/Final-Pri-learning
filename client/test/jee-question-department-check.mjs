import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  asJeePyqPayload,
  buildJeePyqBank,
  hasJeePyqGenerator,
  jeePyqCatalogSnapshot
} from '../src/engine/generators/jee-pyq-runtime.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.resolve(here, '../../tools/jee-question-department/source-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.chapters.length, 26);
assert.equal(manifest.chapters[0].bookPageStart, 1);
assert.equal(manifest.chapters.at(-1).bookPageEnd, 598);
assert.equal(manifest.appendices[0].pdfPageStart, 608);
assert.equal(manifest.appendices[0].pdfPageEnd, 625);
for (let i = 0; i < manifest.chapters.length; i++) {
  const ch = manifest.chapters[i];
  assert.equal(ch.number, i + 1);
  assert.ok(ch.bookPageStart <= ch.answerPage && ch.answerPage <= ch.bookPageEnd);
  if (i) assert.equal(ch.bookPageStart, manifest.chapters[i - 1].bookPageEnd + 1);
  assert.ok(Array.isArray(ch.targets) && ch.targets.length > 0);
}

const common = {
  sourceChapter: 'Complex Numbers', sourceTopic: 'Conjugate and Modulus',
  sourceTopicNumber: 2, sourcePage: 2, sourcePdfPage: 11,
  examYear: 2019, examTrack: 'jee-main', difficulty: 3,
  hints: ['Use the geometry of the Argand plane.'],
  steps: [{ h: 'Represent', d: 'Write z = x + iy.' }, { h: 'Conclude', d: 'Apply the required locus condition.' }],
  review: { reviewedBy: 'reviewer-fixture', reviewedAt: '2026-08-29T00:00:00Z' }
};

const mcq = {
  ...common, id: 'fixture-mcq', chapterId: 'c11-complex-numbers', sourceQuestionNumber: 1,
  answerType: 'mcq', prompt: 'Fixture MCQ', mcqOptions: ['A', 'B', 'C', 'D'], answer: { correctIndex: 2 }
};
const multi = {
  ...common, id: 'fixture-multi', chapterId: 'c11-complex-numbers', sourceQuestionNumber: 2,
  examTrack: 'jee-advanced', answerType: 'multi_mcq', prompt: 'Fixture multi', mcqOptions: ['A', 'B', 'C', 'D'], answer: { correctIndices: [0, 2] }
};
const numeric = {
  ...common, id: 'fixture-num', chapterId: 'c12-integrals', sourceQuestionNumber: 3,
  examTrack: 'jee-advanced', answerType: 'numeric', prompt: 'Fixture numeric', answer: { value: 7 }
};
const selfcheck = {
  ...common, id: 'fixture-proof', chapterId: 'c12-integrals', sourceQuestionNumber: 4,
  examTrack: 'jee-advanced', answerType: 'selfcheck', prompt: 'Prove the fixture claim.', answer: null
};

const m = asJeePyqPayload(mcq);
assert.equal(m.answerType, 'mcq');
assert.equal(m.answer.correctIndex, 2);
assert.equal(m.pyq, true);
assert.equal(m.pyqTrack, 'jee-main');
assert.equal(m.archive.sourcePdfPage, 11);
assert.equal(m.steps.length, 2);

const mm = asJeePyqPayload(multi);
assert.equal(mm.answerType, 'set');
assert.deepEqual(mm.answer.values, [1, 3]);
assert.match(mm.prompt, /1\. A/);
assert.match(mm.prompt, /separated by commas/i);

const n = asJeePyqPayload(numeric);
assert.equal(n.answerType, 'numeric');
assert.equal(n.answer.value, 7);

const proof = asJeePyqPayload(selfcheck);
assert.equal(proof.custom, true);
assert.equal(proof.answer.correctIndex, 0);
assert.match(proof.mcqOptions[0], /self-check/i);

assert.throws(() => asJeePyqPayload({ ...mcq, id: 'bad', steps: [] }), /no worked steps/i);
assert.throws(() => asJeePyqPayload({ ...mcq, id: 'bad2', answer: { correctIndex: 9 } }), /invalid answer/i);

const bank = buildJeePyqBank([mcq, multi, numeric, selfcheck]);
assert.equal(typeof bank['jee-main-c11-complex-numbers'], 'function');
assert.equal(typeof bank['jee-advanced-c11-complex-numbers'], 'function');
assert.equal(typeof bank['jee-advanced-c12-integrals'], 'function');
assert.equal(bank['jee-main-c11-complex-numbers'](() => 0, 3).pyqId, 'fixture-mcq');
assert.equal(bank['jee-advanced-c12-integrals'](() => 0.999, 4).pyq, true);

// The committed catalog is intentionally empty until approved source records are
// packed. Empty must be safe: no unreviewed extraction can be selected by the app.
const catalog = jeePyqCatalogSnapshot();
assert.equal(catalog.meta.schemaVersion, 1);
assert.equal(catalog.meta.records, 0);
assert.deepEqual(catalog.coverage, {});
assert.equal(hasJeePyqGenerator('jee-main-c11-complex-numbers'), false);

console.log('JEE question department gate: PASS');
