// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a dot point request is answered only by that dot point's own questions
//
// Launch QA 26 Nov 2026 (SHOULD FIX 3): 17 percent of dot point requests came back with a question not on the requested
// dot point, and the page said nothing. A cell that names two dot points cannot say which one a question is
// (`dotpointExact`), and the seek accepted any question that merely credited the dot point.
//
// Over every NSW dot point at every level the server issues for it (the Stage 6 courses are 138 dot points of the 42 topics):
//   OFFERED   a level the curriculum offers for the dot point is answered, over 12 requests with different fresh/avoid
//             states, only by an exact question that carries the dot point, never a sibling's;
//   REFUSED   a level it does not offer is refused (PRACTICE_CONTENT_UNSUPPORTED) or, if anything is served, it is exact;
//             the topic is never substituted;
//   ONE TRUTH the published `requestable` is the generated exact table (tools/nsw-dotpoint-exact.mjs) within the issued cells.
// SYNTHETIC: generated questions only.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import assert from 'node:assert/strict';

process.env.NODE_ENV ??= 'test';
process.env.PRI_EDITION = 'prithagoras';   // the author's question bank is part of what a dot point request is answered with
const { loadAllBanks } = await import('../../client/src/engine/generators/index.js');
const { dotpointsFor } = await import('../../client/src/engine/curriculum.js');
const { NSW_ISSUED_CELLS } = await import('../../client/src/engine/nswIssuedCells.js');
const { nswExactLevels } = await import('../../client/src/engine/nswOffer.js');
const { chooseQuestion, ensureBanks, opaqueContentHash } = await import('../platform/practice.js');
const { ensureQbank } = await import('../platform/qbankPack.js');
const { bankPolicy } = await import('../platform/editionBanks.js');
const { nswCurriculumResponse } = await import('../platform/nswBanks.js');
await loadAllBanks();
await ensureBanks();
await ensureQbank(process.env, { strict: true });
const banks = bankPolicy('prithagoras');
const lcg = a => () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a; };
const req = (generator, difficulty, dotpoint, avoid = new Set()) => ({ generator, difficulty, mode: 'practice', avoid, dotpoint, trap: null, written: false, band: null });

let n = 0, offered = 0, refused = 0, dotpoints = 0, served = 0;
const published = nswCurriculumResponse().subtopics;
for (const [generator, issued] of Object.entries(NSW_ISSUED_CELLS)) {
  for (const dp of dotpointsFor(generator)) {
    dotpoints++;
    const offer = published[generator].dotpoints[dp.id].requestable;
    assert.deepEqual(offer, nswExactLevels(generator, dp.id).filter(d => issued.includes(d)), `${dp.id}: published levels are the exact table`); n++;
    for (const d of issued) {
      const seen = new Set();
      let refusals = 0;
      for (let i = 0; i < 12; i++) {
        try {
          const { q } = chooseQuestion(req(generator, d, dp.id, i % 3 === 0 ? new Set(seen) : new Set()), null, { draw: lcg(i * 131 + d * 17 + dotpoints), banks });
          served++;
          assert.equal(q.dotpointExact, true, `${dp.id}@D${d}: served a question that is not provably on the dot point`); n++;
          if (offer.includes(d)) { assert.equal(Number(q.difficulty), d, `${dp.id}@D${d}: an offered level is answered at that level`); n++; }
          assert.ok((q.dotpoints || []).includes(dp.id) && q.dotpointRequested === dp.id, `${dp.id}@D${d}: served another dot point's question`); n++;
          seen.add(opaqueContentHash(q.contentHash));
        } catch (e) {
          if (e.code !== 'PRACTICE_CONTENT_UNSUPPORTED') throw e;
          refusals++;
        }
      }
      if (offer.includes(d)) { offered++; assert.ok(refusals <= 1, `${dp.id}@D${d} is offered but ${refusals} of 12 requests were refused`); n++; }
      else { refused++; n++; }
    }
  }
}
assert.ok(dotpoints >= 138 && offered >= 300 && served > 3000, `reached the catalogue (${dotpoints} dot points, ${offered} offered levels)`); n++;
console.log(`PRACTICE DOT POINT EXACT: PASS, ${n} checks. ${dotpoints} dot points, ${offered} offered levels answered only by exact questions (${served} issues), ${refused} shared levels never offered, no topic substitution.`);
