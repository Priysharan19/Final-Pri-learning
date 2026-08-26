// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Indian curriculum coverage
//
// Which NCERT chapters this app can actually set a question on today, and which
// it cannot. Run it: `node tools/india-coverage.mjs`
//
// The number that matters is the last one. A chapter with no generator is a
// chapter a student can select and get nothing from, so the list of those is
// the authoring plan and is printed in full rather than summarised.
// ─────────────────────────────────────────────────────────────────────────────
import { IN_CHAPTERS, IN_CURRICULUM, OLYMPIAD_TOPICS, coverage, mappedGenerators, allGenerators, generatorFor } from '../client/src/engine/curriculum-in.js';
import { SUBTOPIC_BY_ID, SUBTOPICS } from '../client/src/engine/curriculum.js';
import { GENERATORS, loadAllBanks } from '../client/src/engine/generators/index.js';

await loadAllBanks();

const c = coverage();
const bad = [];
for (const ch of IN_CHAPTERS) {
  const gid = generatorFor(ch);
  if (!gid) continue;
  if (!GENERATORS[gid]) bad.push(`${ch.id} resolves to ${gid}, which has no generator`);
  else if (!ch.native && !SUBTOPIC_BY_ID[gid]) bad.push(`${ch.id} maps to ${gid}, which is not a subtopic`);
}

const line = (label, n) => `${String(n).padStart(3)}  ${label}`;
console.log('NCERT / CBSE Classes 7–12 plus the olympiad ladder\n');
console.log(line('chapters in the curriculum', c.total));
console.log(line('with a generator behind the whole chapter', c.full.length));
console.log(line('with a generator behind part of it', c.partial.length));
console.log(line('with no generator at all', c.none.length));
console.log(line('existing NSW generators reused', mappedGenerators().length) + ` of ${SUBTOPICS.length}`);
console.log(line('generators written for this curriculum', c.native.length));
console.log(line('generators reached in all', allGenerators().length));

console.log('\nBy class');
for (const g of IN_CURRICULUM) {
  const full = g.chapters.filter(x => generatorFor(x) && !x.partial).length;
  const part = g.chapters.filter(x => generatorFor(x) && x.partial).length;
  const none = g.chapters.filter(x => !generatorFor(x)).length;
  console.log(`  Class ${String(g.grade).padEnd(3)} ${String(g.chapters.length).padStart(2)} chapters — ${full} full, ${part} partial, ${none} none`);
}
console.log(`  Olympiad  ${String(OLYMPIAD_TOPICS.length).padStart(2)} topics   — 0 full, 0 partial, ${OLYMPIAD_TOPICS.length} none`);

console.log('\nChapters with no generator — this is the authoring plan');
for (const ch of c.none) {
  console.log(`  ${(ch.grade ? `Class ${ch.grade}` : 'Olympiad').padEnd(9)} ${ch.name}`);
}

console.log('\nChapters covered only in part — what is missing, chapter by chapter');
for (const ch of c.partial) {
  console.log(`  ${(ch.grade ? `Class ${ch.grade}` : 'Olympiad').padEnd(9)} ${ch.name}`);
  console.log(`            via ${ch.maps} — ${ch.partial}`);
}

if (bad.length) {
  console.log('\nBROKEN MAPPINGS');
  for (const b of bad) console.log(`  ${b}`);
  console.log(`\n✖ INDIA COVERAGE FAILED — ${bad.length} mapping(s) name something that does not exist`);
  process.exit(1);
}
const reach = c.full.length + c.partial.length;
console.log(`\n✔ every mapping resolves — ${reach}/${c.total} chapters (${(reach / c.total * 100).toFixed(1)}%) can be practised today, ${c.none.length} cannot`);
