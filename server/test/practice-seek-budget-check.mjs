// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the question picker's seek budget (issue #540)
//
// The server picks a question by drawing random seeds inside ONE cell — a
// generator at a difficulty — until one is not in the student's recently-seen
// list (server/platform/practice.js, chooseQuestion). The budget used to be a
// flat twelve draws whatever was being avoided, so on a cell whose pool is
// small the picker gave up on a FRESH item it could still have found and the
// student was handed a flagged repeat: Class X Quadratic Equations at D2 is
// three cells of about 1,200, 144 and 12 items, drawn with equal probability,
// and about one sitting in sixty-five hit that miss.
//
// The budget now grows with the avoided list (seekBudget). This suite drives
// the real picker on the real chapter with a SEEDED draw, so every number
// below is the same on every run and a change in the picker is a change in
// these numbers:
//   1. the budget's floor, its growth, and the bound it puts on the product's
//      repeat contract (a pool of at least 1.5× the window never repeats
//      inside the window)
//   2. over N seeded sittings, the new budget never returns a repeat while the
//      cell still had a fresh item — a repeat is only ever a cell whose whole
//      pool is already in the window — while the old flat budget did (the
//      deterministic #540 reproduction)
//
// Usage: node server/test/practice-seek-budget-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import assert from 'node:assert/strict';

process.env.NODE_ENV ??= 'test';
const { loadAllBanks, generateQuestion } = await import('../../client/src/engine/generators/index.js');
const { IN_CHAPTER_BY_ID } = await import('../../client/src/engine/curriculum-in.js');
const { resolveIndiaTarget } = await import('../../client/src/engine/indiaProduct.js');
const { chooseQuestion, ensureBanks, seekBudget, opaqueContentHash } = await import('../platform/practice.js');
await loadAllBanks();
await ensureBanks();

let n = 0;
const failures = [];
const ok = (condition, message) => { if (condition) n++; else failures.push(message); };
const eq = (actual, expected, message) => ok(JSON.stringify(actual) === JSON.stringify(expected), `${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// The device's repeat window (client/src/local/backend.js CONTENT_WINDOW; pinned
// by content-certify.mjs REPEAT_WINDOW) and the product's repeat contract.
const WINDOW = 20;
const CONTRACT_POOL = 1.5 * WINDOW;
const OLD_FLAT_BUDGET = 12;

// ── 1. The budget ───────────────────────────────────────────────────────────
// While a fresh item exists the pool holds at least k + 1 for k avoided, so a
// draw finds one with chance at least 1 / (k + 1): fourteen draws per such
// chance miss a surviving fresh item below once in a million, whatever the
// pool size.
eq(seekBudget(0), 14, 'with nothing to avoid: fourteen draws (above the old flat twelve, which stays the floor for seeking a trap or a written form)');
eq(seekBudget(1), 28, 'one avoided item: two chances of fourteen');
eq(seekBudget(WINDOW - 1), 280, 'a full window less the item being replaced: 14 × 20');
eq(seekBudget(-4), 14, 'the budget never drops below its floor');
eq(seekBudget(2.9), 42, 'a non-integer count is truncated, never rounded up into extra draws');
eq(seekBudget(60), 300, 'the server accepts at most 60 avoided items; the budget is capped at ~5 ms of drawing');
ok(seekBudget(WINDOW) < 300, `the shipped client's window (${WINDOW}) never reaches the cap (${seekBudget(WINDOW)} draws)`);
const bound = k => Math.pow(k / (k + 1), seekBudget(k));
ok([1, 5, 11, 19, 20].every(k => bound(k) < 1e-6), `a surviving fresh item is missed below once in a million for every window size (worst ${Math.max(...[1, 5, 11, 19, 20].map(bound)).toExponential(1)})`);
// The case a seed sweep caught on the old 12 + 3k budget: the last of twelve
// items, eleven avoided — 45 draws at one chance in twelve missed it once in
// fifty sittings. And the contract's edge — a pool of 1.5× the window with 19
// of 30 blocked — where the old flat budget missed once in ~240 seeks.
ok(Math.pow(11 / 12, 12 + 3 * 11) > 1 / 60, `12 + 3k missed the last of twelve items once in ${Math.round(1 / Math.pow(11 / 12, 12 + 3 * 11))} seeks`);
ok(bound(11) < 1e-6, `the budget misses the last of twelve below once in a million (${bound(11).toExponential(1)})`);
const worst = (WINDOW - 1) / CONTRACT_POOL;
ok(Math.pow(worst, OLD_FLAT_BUDGET) > 1e-3, `the old flat budget missed at the contract's edge once in ${Math.round(1 / Math.pow(worst, OLD_FLAT_BUDGET))} seeks`);
ok(Math.pow(worst, seekBudget(WINDOW - 1)) < 1e-12, `the new budget misses at the contract's edge below once in 10^12 seeks (${Math.pow(worst, seekBudget(WINDOW - 1)).toExponential(1)})`);

// ── 2. Seeded sittings on the real chapter ──────────────────────────────────
const CHAPTER = 'c10-quadratic-equations';
const DIFFICULTY = 2;
const chapter = IN_CHAPTER_BY_ID[CHAPTER];
assert.ok(chapter, `${CHAPTER} is an India chapter`);

// Every cell a chapter-level request can land on, and each cell's real pool.
const cells = new Map();
for (let i = 0; i < 3000; i++) {
  const t = resolveIndiaTarget(chapter, { difficulty: DIFFICULTY, track: 'cbse', grade: 10, random: () => i / 3000 });
  if (t) cells.set(t.generator, t);
}
const poolOf = new Map();
for (const [generator, t] of cells) {
  const seen = new Set();
  for (let s = 0; s < 6000; s++) seen.add(generateQuestion(t.generator, t.difficulty, s).contentHash);
  poolOf.set(generator, seen);
}
const pools = [...poolOf.entries()].map(([g, s]) => `${g}: ${s.size}`).join(', ');
ok(cells.size >= 3, `the chapter resolves to several cells at D${DIFFICULTY} (${cells.size}: ${pools})`);
ok([...poolOf.values()].some(s => s.size < WINDOW), 'one of them is smaller than the window — what made #540 reproduce');
ok([...poolOf.values()].some(s => s.size >= 2 * WINDOW), 'and the chapter as a whole is large');

/**
 * One sitting as the device drives it: WINDOW chapter-level requests, each
 * resolved to a cell with the device's (seeded) randomness, each answered by
 * the real picker drawing (seeded) seeds inside that cell against the device's
 * window. Returns every repeat the picker returned, classified: `exhausted`
 * when the cell's whole pool was already in the window (no budget can help),
 * `missed` when a fresh item existed and the picker gave up on it.
 */
function sitting(seed, tries) {
  const choose = mulberry32(seed);
  const dice = mulberry32(seed ^ 0x9e3779b9);
  const draw = () => Math.floor(dice() * 0x80000000);
  const recent = [];
  const repeats = [];
  for (let i = 0; i < WINDOW; i++) {
    const t = resolveIndiaTarget(chapter, { difficulty: DIFFICULTY, track: 'cbse', grade: 10, random: choose });
    const avoid = new Set(recent.map(opaqueContentHash));
    const { q, repeat } = chooseQuestion({ generator: t.generator, difficulty: t.difficulty, avoid, trap: null }, null, tries === null ? { draw } : { draw, tries });
    if (repeat) {
      const pool = poolOf.get(t.generator);
      const exhausted = [...pool].every(h => recent.includes(h));
      repeats.push({ seed, at: i, cell: t.generator, pool: pool.size, avoided: avoid.size, kind: exhausted ? 'exhausted' : 'missed' });
    }
    const h = q.contentHash;
    const idx = recent.indexOf(h);
    if (idx >= 0) recent.splice(idx, 1);
    recent.unshift(h);
    if (recent.length > WINDOW) recent.length = WINDOW;
  }
  return repeats;
}

const SITTINGS = 600;
const sweep = tries => {
  const all = [];
  for (let seed = 1; seed <= SITTINGS; seed++) all.push(...sitting(seed, tries));
  return { missed: all.filter(r => r.kind === 'missed'), exhausted: all.filter(r => r.kind === 'exhausted') };
};
const before = sweep(OLD_FLAT_BUDGET);
const after = sweep(null);
ok(before.missed.length > 0, `the old flat budget gave up on a fresh item it could have found: ${before.missed.length} of ${SITTINGS} seeded sittings (e.g. ${JSON.stringify(before.missed[0])})`);
ok(before.missed.every(r => r.pool < WINDOW), 'every such miss was on the cell smaller than the window, with items of it still fresh');
eq(after.missed, [], `with the seek budget the picker never returns a repeat while the cell still has a fresh item (${SITTINGS} seeded sittings)`);
ok(after.exhausted.every(r => r.pool < WINDOW && r.avoided >= r.pool), `the repeats that remain are cells whose whole pool is in the window — ${after.exhausted.length} of ${SITTINGS} sittings, none avoidable by drawing more`);
console.log(`seeded sittings: ${SITTINGS} · old flat budget: ${before.missed.length} missed, ${before.exhausted.length} exhausted · seek budget: ${after.missed.length} missed, ${after.exhausted.length} exhausted`);
// What the picker cannot do is the device's job: a request that lands on a
// spent cell is re-asked on another cell of the same terms
// (client/src/local/retargetOnRepeat.js; content-certification-check.mjs).

if (failures.length) {
  console.log('\nfailures:');
  for (const f of failures) console.log('  ' + f);
  console.log(`\nSEEK BUDGET: FAIL — ${n}/${n + failures.length} checks`);
  process.exit(1);
}
console.log(`SEEK BUDGET: PASS — ${n}/${n} checks`);
