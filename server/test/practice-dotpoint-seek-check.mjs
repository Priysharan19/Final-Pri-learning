// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a requested dot point is never answered with another one
//
// server/platform/practice.js seekQuestion draws seeds in one cell until one is
// fresh. A cell can draw the form of a SIBLING dot point (y12-financial.2 at D1
// drew its own dot point 261 times in 1,000), so a student who chose a dot point
// was sometimes dealt another. The seek now passes over a question that does not
// carry the requested dot point, and sought it for at least 120 draws.
//
//   IDENTITY  with NO dot point requested the picker is untouched: 2,000
//             requests across 30 cells, each with a recently-seen list, return
//             the (generator, difficulty, seed) of a reference copy of the seek
//             as it was before this change, request for request;
//   NARROWS   with a dot point, every issue across every issued cell (the seven
//             cells that used to leak included) is on that dot point;
//   REFUSES   a dot point nothing issued carries is refused 422-style
//             (PRACTICE_CONTENT_UNSUPPORTED), never answered with a topic
//             question; a dot point whose forms are all in the recently-seen
//             list is served a flagged repeat OF THAT DOT POINT.
// SYNTHETIC: generated questions only.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import assert from 'node:assert/strict';

process.env.NODE_ENV ??= 'test';
const { loadAllBanks, generateQuestion } = await import('../../client/src/engine/generators/index.js');
const { SUBTOPICS } = await import('../../client/src/engine/curriculum.js');
const { nswIssuedLevels } = await import('../../client/src/engine/nswOffer.js');
const { chooseQuestion, ensureBanks, seekBudget, opaqueContentHash } = await import('../platform/practice.js');
const { bankPolicy } = await import('../platform/editionBanks.js');
await loadAllBanks();
await ensureBanks();
const banks = bankPolicy('prithagoras');

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const lcg = a => () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a; };
const req = (generator, difficulty, extra = {}) => ({ generator, difficulty, mode: 'practice', avoid: new Set(), dotpoint: undefined, trap: null, written: false, band: null, ...extra });

// The seek as it stood before the dot point clause: draw, skip what the edition does not issue, take the first fresh
// question, else the best of what was drawn (unresolved over resolved, not avoided over avoided, earliest first).
function reference(request, draw) {
  const { generator, difficulty, avoid } = request;
  let fallback = null;
  for (let drawn = 0; drawn < seekBudget(avoid.size); drawn++) {
    const q = generateQuestion(generator, difficulty, draw(), request.dotpoint, null);
    if (banks.admits && !banks.admits(q, generator)) continue;
    if (q.answerType === 'graph-sketch' && (request.mode === 'rush' || request.mode === 'match')) continue;
    const avoided = avoid.has(opaqueContentHash(q.contentHash));
    if (!avoided) return { q, repeat: false };
    const rank = avoided ? 0 : 1;
    if (!fallback || rank > fallback.rank) fallback = { q, rank };
  }
  return { q: fallback.q, repeat: true };
}

// ── IDENTITY ─────────────────────────────────────────────────────────────────
const cells = [];
for (const s of SUBTOPICS) for (const d of nswIssuedLevels(s.id)) cells.push([s.id, d]);
const thirty = Array.from({ length: 30 }, (_, i) => cells[Math.floor(i * cells.length / 30)]);
let compared = 0, differences = 0;
for (const [i, [generator, difficulty]] of thirty.entries()) {
  const recent = [];
  for (let r = 0; r < 67; r++) {
    const seed = i * 1000 + r + 1;
    const avoid = new Set(recent.slice(-(r % 5 === 0 ? 40 : 6)));
    const a = chooseQuestion(req(generator, difficulty, { avoid }), null, { draw: lcg(seed), banks });
    const b = reference(req(generator, difficulty, { avoid }), lcg(seed));
    compared++;
    if (a.q.seed !== b.q.seed || a.q.difficulty !== b.q.difficulty || a.q.subtopic !== b.q.subtopic || a.repeat !== b.repeat) differences++;
    recent.push(opaqueContentHash(a.q.contentHash));
  }
}
eq(thirty.length, 30, 'thirty cells');
ok(compared >= 2000, `${compared} requests compared`);
eq(differences, 0, 'with no dot point requested the issued (generator, difficulty, seed) is unchanged on every request');

// ── NARROWS ──────────────────────────────────────────────────────────────────
const LEAK_CELLS = [['y12-financial', 'y12-financial.1', 1], ['y12-financial', 'y12-financial.2', 1], ['me11-poly', 'me11-poly.3', 4], ['me11-functions', 'me11-functions.2', 2],
  ['me11-comb', 'me11-comb.3', 4], ['me12-induction', 'me12-induction.1', 4], ['me12-induction', 'me12-induction.3', 4]];
const credited = q => (q.dotpoints?.length ? q.dotpoints : q.dotpoint ? [q.dotpoint] : []);
for (const [generator, dotpoint, level] of LEAK_CELLS) {
  const avoid = new Set();
  let off = 0;
  let refusedHere = 0;
  for (let i = 0; i < 300; i++) {
    // A level the dot point shares with a sibling in one cell is refused (nothing exact answers it), never answered with the sibling.
    let q;
    try { ({ q } = chooseQuestion(req(generator, level, { dotpoint, avoid }), null, { draw: lcg(level * 31 + i), banks })); } catch (e) { if (e.code !== 'PRACTICE_CONTENT_UNSUPPORTED') throw e; refusedHere++; continue; }
    if (!credited(q).includes(dotpoint) || q.dotpointExact !== true) off++;
    if (i % 3 === 0) avoid.add(opaqueContentHash(q.contentHash));
  }
  eq(off, 0, `${dotpoint}@D${level}: 300 requests, none answered by another dot point's question (${refusedHere} refused)`);
}

// ── REFUSES ──────────────────────────────────────────────────────────────────
// Every dot point of the catalogue has a form, so the case is made by an edition that issues none of one: its
// admits() refuses every question carrying y12-diff.2. The topic is still issued; the dot point is refused, where
// the seek used to hand back a y12-diff question of another dot point.
const noneOfIt = { ...banks, admits: (q, g) => banks.admits(q, g) && !credited(q).includes('y12-diff.2') };
assert.throws(() => chooseQuestion(req('y12-diff', 3, { dotpoint: 'y12-diff.2' }), null, { draw: lcg(5), banks: noneOfIt }),
  e => e.code === 'PRACTICE_CONTENT_UNSUPPORTED', 'refused');
n++;
ok(chooseQuestion(req('y12-diff', 1), null, { draw: lcg(5), banks: noneOfIt }).q, 'the topic itself is still issued');
ok(chooseQuestion(req('y12-diff', 1, { dotpoint: 'y12-diff.3' }), null, { draw: lcg(5), banks: noneOfIt }).q, 'and a sibling dot point is still issued');
// Everything of the dot point seen: a flagged repeat of the dot point, not a fresh question of a sibling.
{
  const [generator, dotpoint, level] = ['y12-financial', 'y12-financial.2', 1];
  // A seed stream of only twelve seeds: the dot point's questions among them are all in the recently-seen list, and
  // the sibling's are not. (Before: the first fresh sibling question was served.)
  const seeds = Array.from({ length: 12 }, (_, i) => 1000 + 977 * i);
  const avoid = new Set();
  for (const sd of seeds) { const q = generateQuestion(generator, level, sd, dotpoint); if (credited(q).includes(dotpoint)) avoid.add(opaqueContentHash(q.contentHash)); }
  ok(avoid.size > 0 && avoid.size < 12, 'the twelve seeds carry the dot point and the sibling');
  let at = 0;
  const got = chooseQuestion(req(generator, level, { dotpoint, avoid }), null, { draw: () => seeds[at++ % seeds.length], banks, tries: 40 });
  ok(credited(got.q).includes(dotpoint), 'a cell whose dot point is all seen is served a repeat of that dot point');
  eq(got.repeat, true, 'flagged a repeat');
}

console.log(`  ${compared} no-dot-point requests compared with the reference seek: ${differences} differences`);
console.log(`PRACTICE DOT POINT SEEK: PASS — ${n} checks`);
