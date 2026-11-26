// Pri Learning · "practise this topic" deals the author's questions no more often than it did (launch QA 26 Nov 2026, review of #1122).
//
// The device aims every topic request at one of the topic's dot points (an `aimed` request: not a dot point the student chose). The server answers
// an aimed request as it always did, from the dot point's own pool, so the author's bank turn there is the small-pool one. Holding aimed requests to
// exact, content-vouched questions (right for a dot point the student CHOSE) emptied the generated forms and sent most of the draws to the bank:
// 33 of 60 questions of one topic against 9 of 60 before, and with them most of the step-marked questions (the bank pays no step marks until its
// rule is approved). This pins the share, over every Year 11 and 12 cell the aim can fall on and fixed draws, to the number origin/main dealt
// (counted by running this same script on origin/main, where the request carries no `aimed` and the seek is the old one).
// SYNTHETIC: generated and authored questions only.
import './support/hermetic.mjs';
import assert from 'node:assert/strict';

process.env.NODE_ENV ??= 'test';
process.env.PRI_EDITION = 'prithagoras';
const { loadAllBanks } = await import('../../client/src/engine/generators/index.js');
const { SUBTOPICS, formDotpoints } = await import('../../client/src/engine/curriculum.js');
const { NSW_ISSUED_CELLS } = await import('../../client/src/engine/nswIssuedCells.js');
const { chooseQuestion, ensureBanks } = await import('../platform/practice.js');
const { ensureQbank } = await import('../platform/qbankPack.js');
const { bankPolicy } = await import('../platform/editionBanks.js');
await loadAllBanks();
await ensureBanks();
await ensureQbank(process.env, { strict: true });
const banks = bankPolicy('prithagoras');
const lcg = a => () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a; };

// What origin/main dealt for these requests (d599df4e5), counted by this script there.
const MAIN = { questions: 2244, bank: 255, refused: 0 };
let questions = 0, bank = 0, refused = 0;
for (const s of SUBTOPICS) {
  if (s.year < 11 || !NSW_ISSUED_CELLS[s.id]) continue;
  for (const level of NSW_ISSUED_CELLS[s.id]) for (const dp of formDotpoints(s.id, level)) for (let i = 0; i < 6; i++) {
    try {
      const { q } = chooseQuestion({ generator: s.id, difficulty: level, mode: 'practice', avoid: new Set(), dotpoint: dp.id, aimed: true, trap: null, written: false, band: null },
        null, { draw: lcg(level * 7919 + i * 131 + dp.ordinal), banks });
      questions++; if (typeof q._bank === 'string') bank++;
    } catch (e) { if (e.code !== 'PRACTICE_CONTENT_UNSUPPORTED') throw e; refused++; }
  }
}
console.log(JSON.stringify({ questions, bank, refused, share: +(bank / questions).toFixed(4) }));
if (process.env.PRI_COUNT_ONLY) process.exit(0);
assert.deepEqual({ questions, bank, refused }, MAIN, 'an aimed topic request deals exactly the questions, bank questions and refusals origin/main dealt');
console.log(`TOPIC AIM BANK SHARE: PASS — ${questions} aimed requests over every Year 11 and 12 cell, ${bank} the author's (${(100 * bank / questions).toFixed(1)}%), ${refused} refused: the same as origin/main`);
