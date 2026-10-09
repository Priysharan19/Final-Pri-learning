// Pri Learning · one question, once per paper.
//
// CI's content certification once failed with "the same question appears twice
// in one paper" on a JEE Advanced paper. Two things were wrong, and both are
// pinned here without depending on which paper a random layout happens to give:
//
//   1. A matching-list item keeps its question in its two lists. Its prompt is
//      the same sentence on every such item and its options are only codes, and
//      the engine's content hash covered neither list — so two DIFFERENT
//      matching items that shared a code set had one hash (9 papers in 4000 on
//      the JEE Advanced Class 12 blueprint). The hash now covers the lists, and
//      the hash of every other question is unchanged.
//   2. The composer told drawn questions apart by generator AND prompt, so two
//      cells with different generator ids that reached one question could both
//      place it. A drawn question is now known by its text alone — on the
//      device's composer and on the server's issuing path, which share it.
//
// Usage: node client/test/india-exam-duplicate-check.mjs
import assert from 'node:assert/strict';
import { contentHashOf, matchListOf } from '../src/engine/contentIdentity.js';
import { makeRng } from '../src/engine/qhelpers.js';
import { loadAllBanks, generateQuestion } from '../src/engine/generators/index.js';
import { composeIndiaPaper, issueIndiaItem, recipeFitsSection } from '../src/engine/indiaExamComposer.js';
import { indiaExamPaperSpec } from '../src/engine/indiaExams.js';
import { indiaScope } from '../src/engine/indiaProduct.js';

let count = 0;
const ok = (cond, name) => { assert.ok(cond, name); count++; };
const eq = (actual, expected, name) => { assert.deepEqual(actual, expected, name); count++; };

await loadAllBanks();

// ── 1. The content hash of a matching-list item covers its lists ─────────────
const matching = (left, right) => ({
  subtopic: 'c11-binomial-theorem', difficulty: 4,
  prompt: 'Match each problem in List-I with its answer in List-II, then choose the option that gives the correct matching.',
  matchList: { left: left.map((text, i) => ({ key: 'PQRS'[i], text })), right: right.map((text, i) => ({ key: String(i + 1), text })) },
  answerType: 'mcq', answer: { correctIndex: 1 },
  mcqOptions: ['P → 1, Q → 2, R → 3, S → 4', 'P → 2, Q → 1, R → 4, S → 3', 'P → 2, Q → 1, R → 3, S → 4', 'P → 1, Q → 2, R → 4, S → 3']
});
const first = matching(['Find $\\binom{5}{2}$.', 'Find $\\binom{6}{1}$.', 'Find $\\binom{4}{4}$.', 'Find $\\binom{7}{2}$.'], ['6', '10', '21', '1']);
const other = matching(['Find $3!$.', 'Find $2^3$.', 'Find $5 - 3$.', 'Find $\\sqrt{49}$.'], ['8', '6', '7', '2']);
ok(contentHashOf(first) !== contentHashOf(other), 'two different matching-list items with the same code options are two questions');
eq(contentHashOf(first), contentHashOf(JSON.parse(JSON.stringify(first))), 'the same matching-list item is one question');
eq(contentHashOf(first), contentHashOf({ ...first, matchList: { left: first.matchList.left.map(r => ({ ...r, text: `  ${r.text}  ` })), right: first.matchList.right } }), 'whitespace in a list entry is not a difference');
const swapped = { ...first, matchList: { left: first.matchList.left, right: [...first.matchList.right].reverse().map((r, i) => ({ key: String(i + 1), text: r.text })) } };
ok(contentHashOf(first) !== contentHashOf(swapped), 'List-II in another order under the same codes is a different question (the codes mean something else)');
eq([matchListOf({ prompt: 'x' }), matchListOf({ matchList: { left: 'no' } }), matchListOf(null)], [null, null, null], 'a question without two lists has no list substance');
// Nothing else moved: an ordinary question's hash is exactly what it was
// before the lists joined the substance (docs/content/content-digest.json is
// the bank-wide pin; this is the same statement on fixed items).
const PINNED = [['c10-real-numbers', 1, 12345], ['c11-binomial-theorem', 2, 777], ['c12-matrices', 3, 4242]];
for (const [generator, difficulty, seed] of PINNED) {
  const q = generateQuestion(generator, difficulty, seed);
  eq([q.contentHash, 'matchList' in q], [contentHashOf(q), false], `${generator} D${difficulty}: an ordinary question still hashes to the hash it was stamped with`);
  eq(contentHashOf({ ...q, matchList: undefined }), q.contentHash, `${generator} D${difficulty}: and an absent list changes nothing`);
}

// ── 2. Two cells that reach one question place it once ───────────────────────
// A stub `draw` that answers EVERY cell with the same question, whatever
// generator the cell names: the second item can only be a duplicate.
const one = generateQuestion('c10-real-numbers', 2, 2024);
const sameForAll = () => ({ ...one });
const single = generator => ({ kind: 'single', cell: { generator, difficulty: 2, need: 'any' } });
const written = { id: 'B', type: 'written', questions: 2, marksEach: 2 };
ok(recipeFitsSection(written, single('c10-real-numbers')) && recipeFitsSection(written, single('c10-polynomial-zeroes')), 'both recipes are ones the section can hold');
{
  const ctx = { rng: makeRng(7), draw: sameForAll, seen: new Set(), isPyq: () => false };
  const a = issueIndiaItem(written, single('c10-real-numbers'), ctx);
  ok(a?.payload?.prompt === one.prompt, 'the first cell places the question');
  eq(issueIndiaItem(written, single('c10-polynomial-zeroes'), ctx), null, 'a second cell with ANOTHER generator id that reaches the same question places nothing');
  eq(issueIndiaItem(written, single('c10-real-numbers'), ctx), null, 'nor does the same cell again');
  eq(issueIndiaItem(written, { kind: 'single', cell: { generator: 'c10-real-numbers', difficulty: 2, need: 'any' }, alt: { generator: 'c10-polynomial-zeroes', difficulty: 2, need: 'any' } },
    { rng: makeRng(7), draw: sameForAll, seen: new Set(), isPyq: () => false }), null, 'and an internal choice is never the question it is the alternative to');
}
// A draw that knows two questions gives a two-question paper section exactly two different ones.
{
  const two = generateQuestion('c10-real-numbers', 2, 99);
  ok(two.prompt !== one.prompt, 'the stub holds two different questions');
  let calls = 0;
  const ctx = { rng: makeRng(11), draw: () => ({ ...(calls++ % 3 === 2 ? two : one) }), seen: new Set(), isPyq: () => false };
  const a = issueIndiaItem(written, single('c10-real-numbers'), ctx);
  const b = issueIndiaItem(written, single('c10-polynomial-zeroes'), ctx);
  eq([a.payload.prompt, b?.payload?.prompt], [one.prompt, two.prompt], 'the second cell skips the question already placed and takes the other');
}

// ── 3. The device's composer, with a bank where every generator shares its questions ──
// Every generator id answers from ONE shared pool (a chapter generator and an
// archetype that draws from it, taken to the limit). A composed paper must
// still hold no drawn question twice — across items, alternatives and parts.
{
  const spec = indiaExamPaperSpec({ track: 'cbse', grade: 10, variant: 'standard' });
  const chapters = indiaScope('cbse', 10);
  const pool = (generator, difficulty, seed) => generateQuestion('c10-real-numbers', difficulty, seed % 4000);
  for (const seed of [1, 2, 3]) {
    const paper = composeIndiaPaper(spec, { seed, draw: pool, chapters });
    const units = paper.questions.flatMap(question => {
      const p = question.payload || question;
      const parts = Array.isArray(p.parts) ? p.parts : [];
      const sources = p.matchList ? p.matchList.left.map(row => ({ prompt: row.text })) : [];
      return [p, p.alt, ...parts, ...parts.map(part => part?.alt), ...sources].filter(Boolean);
    });
    // The shared sentence of a composed item (matching list, case-study stem)
    // is not a drawn question; its drawn questions are its lists and parts.
    const drawn = units.filter(u => !u.matchList && !u.multipart && !Array.isArray(u.parts)).map(u => String(u.prompt).replace(/\s+/g, ' ').trim());
    eq(drawn.length - new Set(drawn).size, 0, `seed ${seed}: a paper composed from one shared pool holds no drawn question twice (${drawn.length} drawn)`);
    const hashes = paper.questions.map(question => contentHashOf(question.payload || question));
    eq(hashes.length - new Set(hashes).size, 0, `seed ${seed}: and no two of its ${hashes.length} items share a content hash`);
  }
}

console.log(`INDIA EXAM DUPLICATES: PASS — ${count}/${count} checks — a question is placed once per paper, and a matching-list item is known by its lists.`);
