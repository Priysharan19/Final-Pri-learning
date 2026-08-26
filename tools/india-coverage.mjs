// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Indian curriculum coverage
//
// Which NCERT dot points this app can set a question on, and which it cannot.
// Run it: `node tools/india-coverage.mjs`
//
// The unit is the dot point, not the chapter. "87 chapters reachable" was the
// first version of this report and it was nearly meaningless — a chapter counts
// as reachable the moment one of its three dot points has a generator. The
// number below counts all 261.
// ─────────────────────────────────────────────────────────────────────────────
import {
  IN_CHAPTERS, IN_CURRICULUM, OLYMPIAD_TOPICS, coverage,
  mappedGenerators, allGenerators, nativeGenerators,
  generatorsFor, coversForDotpoint, uncoveredDotpoints, OWN_GENERATOR
} from '../client/src/engine/curriculum-in.js';
import { SUBTOPIC_BY_ID, SUBTOPICS, DOTPOINTS, difficultiesForDotpoint } from '../client/src/engine/curriculum.js';
import { GENERATORS, loadAllBanks, bankOf } from '../client/src/engine/generators/index.js';

await loadAllBanks();

const c = coverage();
const bad = [];
for (const ch of IN_CHAPTERS) {
  for (const entry of ch.covers) {
    if (!GENERATORS[entry.gen]) bad.push(`${ch.id} names ${entry.gen}, which has no generator`);
    else if (!bankOf(entry.gen)) bad.push(`${ch.id} names ${entry.gen}, which resolves to no bank`);
    else if (!OWN_GENERATOR.test(entry.gen) && !SUBTOPIC_BY_ID[entry.gen]) bad.push(`${ch.id} borrows ${entry.gen}, which is not an NSW subtopic`);
  }
}

const line = (label, n) => `${String(n).padStart(4)}  ${label}`;
console.log('NCERT / CBSE Classes 7–12 plus the olympiad ladder\n');
console.log(line('chapters in the curriculum', c.total));
console.log(line('dot points in the curriculum', c.dotpoints));
console.log(line('dot points with a generator behind them', c.coveredDotpoints));
console.log(line('dot points with nothing behind them', c.uncovered.length));
console.log('');
console.log(line('generators reached in all', allGenerators().length));
console.log(line('reused from the NSW banks', mappedGenerators().length) + ` of ${SUBTOPICS.length}`);
console.log(line('written for this curriculum', nativeGenerators().length));
console.log(line('cover entries — one per (generator, dot point)', IN_CHAPTERS.reduce((n, ch) => n + ch.covers.length, 0)));

console.log('\nBy class — dot points covered');
for (const g of IN_CURRICULUM) {
  const total = g.chapters.length * 3;
  const missing = g.chapters.reduce((n, ch) => n + uncoveredDotpoints(ch).length, 0);
  console.log(`  Class ${String(g.grade).padEnd(3)} ${String(total - missing).padStart(3)}/${total}`);
}
const olyMissing = OLYMPIAD_TOPICS.reduce((n, ch) => n + uncoveredDotpoints(IN_CHAPTERS.find(x => x.id === ch.id)).length, 0);
console.log(`  Olympiad ${String(OLYMPIAD_TOPICS.length * 3 - olyMissing).padStart(3)}/${OLYMPIAD_TOPICS.length * 3}`);

if (c.uncovered.length) {
  console.log('\nDot points with no generator — this is the authoring plan');
  for (const u of c.uncovered) {
    console.log(`  ${(u.chapter.grade ? `Class ${u.chapter.grade}` : 'Olympiad').padEnd(9)} ${u.chapter.name} — dot point ${u.ordinal + 1}`);
    console.log(`            ${u.text}`);
  }
} else {
  console.log('\nDot points with no generator: none.');
}

// Covered is not the same as richly covered. A dot point reachable at one
// difficulty is reachable only at that difficulty, because the picker snaps a
// request to the nearest difficulty that can deliver it.
const thin = [];
for (const ch of IN_CHAPTERS) {
  ch.dotpoints.forEach((text, i) => {
    const diffs = new Set(coversForDotpoint(ch, i).flatMap(x => x.diff));
    if (diffs.size === 1) thin.push({ ch, i, text, d: [...diffs][0] });
  });
}
const nswThin = DOTPOINTS.filter(dp => difficultiesForDotpoint(dp.id).length === 1).length;
console.log(`\nReachable at only one of the four difficulties — ${thin.length}/${c.dotpoints} (${(thin.length / c.dotpoints * 100).toFixed(1)}%)`);
console.log(`  For scale, the NSW curriculum this app already ships: ${nswThin}/${DOTPOINTS.length} (${(nswThin / DOTPOINTS.length * 100).toFixed(1)}%).`);
console.log('  Thin is not broken — the dot point is still reachable — but a request for it forces that difficulty.');
for (const t of thin) console.log(`  · ${t.ch.id} dot point ${t.i + 1} — only D${t.d}`);

if (bad.length) {
  console.log('\nBROKEN COVER ENTRIES');
  for (const b of bad) console.log(`  ${b}`);
  console.log(`\n✖ INDIA COVERAGE FAILED — ${bad.length} entry(ies) name something that does not exist`);
  process.exit(1);
}
console.log(`\n✔ every cover entry resolves — ${c.coveredDotpoints}/${c.dotpoints} dot points (${(c.coveredDotpoints / c.dotpoints * 100).toFixed(1)}%) have a generator behind them`);
console.log('  What that does NOT say: whether the generator asks what its dot point says, or whether the question is pitched at NCERT level. No Indian teacher has read one.');
