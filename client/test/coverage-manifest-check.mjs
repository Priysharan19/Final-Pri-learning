// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Coverage manifest and provenance ledger gate (ledger §5.1, §5.6)
//
// Proves three things about docs/content/coverage-manifest.json, the file the
// public /coverage page is built from:
//
//   1. it is CURRENT — rebuilt in memory from the live curriculum and generator
//      registry, it equals the committed file in everything but the date, so a
//      generator change cannot ship under an old "verified" date;
//   2. it is HONEST — every chapter carries a tier that says "automated", a
//      source citation, a measured sample count that is at most the draws
//      taken, and no text anywhere claims completeness or human review;
//   3. the provenance digests DETECT TAMPERING — a generator whose output for
//      one seed changes (one prompt edited) moves its chapter digest and the
//      release digest, and nothing else's.
//
// Usage: node client/test/coverage-manifest-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { buildCoverageManifest, readCommittedManifest, undated, CLASS_SOURCES, V1_GRADES, SAMPLE_SEEDS } from '../../tools/build-coverage.mjs';
import { IN_CURRICULUM } from '../src/engine/curriculum-in.js';
import { GENERATORS, generateQuestion } from '../src/engine/generators/index.js';
import { generatorDigests } from './content-certify.mjs';
import { chapterDigestOf, releaseDigestOf, verifiedMonthOf, reviewTierOf, chapterGeneratorIds, shortDigest } from '../src/engine/provenance.js';
import { CONTENT_VERSION } from '../src/engine/contentIdentity.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ── 1. Current ───────────────────────────────────────────────────────────────

const committed = readCommittedManifest();
ok(!!committed, 'docs/content/coverage-manifest.json is committed');
const live = await buildCoverageManifest();
eq(undated(committed), live, 'the committed manifest equals a fresh build in everything but the date (run node tools/build-coverage.mjs --write)');
ok(/^\d{4}-\d{2}-\d{2}$/.test(committed?.verifiedAt || ''), 'verifiedAt is a calendar date');
ok(committed?.verifiedAt <= new Date().toISOString().slice(0, 10), 'verifiedAt is not in the future');
eq(committed?.contentVersion, CONTENT_VERSION, 'the manifest is stamped with the current CONTENT_VERSION');
eq(verifiedMonthOf(committed?.verifiedAt), committed?.verifiedAt.slice(0, 7), 'the "verified <month>" label is derived from the ledger date');
eq(verifiedMonthOf('yesterday'), null, 'a malformed date yields no verified label rather than a wrong one');

// ── 2. Honest ────────────────────────────────────────────────────────────────

const manifestText = JSON.stringify(live);
ok(!/complete syllabus|syllabus[- ]complete|teacher[- ]reviewed|human[- ]reviewed|fully covered/i.test(manifestText), 'no entry claims syllabus completeness or human review');
ok(/Automated review only/.test(live.note), 'the manifest note says the review is automated');
eq(live.classes.map(c => c.grade), V1_GRADES, 'exactly Classes 7–12 are published (the olympiad ladder is post-V1 and not advertised)');
for (const grade of V1_GRADES) {
  ok(Array.isArray(CLASS_SOURCES[grade]) && CLASS_SOURCES[grade].length > 0 && CLASS_SOURCES[grade].every(s => s.title), `Class ${grade} cites at least one source document by title`);
}
const spine = Object.fromEntries(IN_CURRICULUM.flatMap(g => g.chapters.map(ch => [ch.id, { ...ch, grade: g.grade }])));
let chapters = 0;
for (const c of live.classes) {
  const expectedIds = IN_CURRICULUM.find(g => g.grade === c.grade).chapters.map(ch => ch.id);
  eq(c.chapters.map(ch => ch.id), expectedIds, `Class ${c.grade} lists every chapter of the spine, in syllabus order`);
  for (const ch of c.chapters) {
    chapters++;
    const s = spine[ch.id];
    ok(ch.covered <= ch.dotpoints && ch.covered >= 0, `${ch.id}: covered ≤ declared dot points`);
    eq(ch.dotpoints, s.dotpoints.length, `${ch.id}: dot-point count is the spine's`);
    ok(/automated/.test(ch.tier) && ch.tier in live.reviewTiers, `${ch.id}: tier is an automated-review tier the manifest defines`);
    eq(ch.tier, reviewTierOf(s), `${ch.id}: tier follows the chapter's native flag`);
    ok(ch.sampleDistinct <= ch.sampleDraws, `${ch.id}: distinct ≤ draws (a sample cannot contain more questions than it drew)`);
    eq(ch.sampleErrors, 0, `${ch.id}: every sampled draw generated`);
    eq(ch.sampleDraws, ch.generators.length ? [...new Set(s.covers.flatMap(cv => cv.diff.map(d => `${cv.gen}@${d}`)))].length * SAMPLE_SEEDS : 0, `${ch.id}: draws = (generator, difficulty) cells × ${SAMPLE_SEEDS}`);
    ok(ch.generators.length > 0 && ch.generators.every(g => GENERATORS[g]), `${ch.id}: every listed generator exists`);
    ok(/^[0-9a-f]{16}$/.test(ch.digest), `${ch.id}: carries a 16-hex chapter digest`);
    ok(ch.examSource === 'cbse-blueprint' ? Number.isFinite(ch.examMarks) : ch.examMarks === null, `${ch.id}: exam marks are shown only where a board blueprint weighs the chapter`);
  }
}
ok(chapters >= 77, `at least 77 chapters published (${chapters})`);

// ── 3. Tamper detection ──────────────────────────────────────────────────────

const victim = spine['c10-quadratic-equations'] || Object.values(spine).find(ch => chapterGeneratorIds(ch).includes('c10-quadratic-roots'));
const gens = chapterGeneratorIds(victim);
const allGens = new Set(Object.values(spine).flatMap(chapterGeneratorIds));
const before = generatorDigests(allGens);
const chapterBefore = chapterDigestOf(victim, before);
const releaseBefore = releaseDigestOf(Object.fromEntries(Object.values(spine).map(ch => [ch.id, chapterDigestOf(ch, before)])), CONTENT_VERSION);
eq(chapterBefore, live.classes.find(c => c.grade === victim.grade).chapters.find(ch => ch.id === victim.id).digest, 'the chapter digest in the manifest is the one the ledger computes');
eq(releaseBefore, live.releaseDigest, 'the release digest in the manifest is the one the ledger computes');
eq(chapterDigestOf(victim, before), chapterBefore, 'the chapter digest is deterministic');

// Tamper: one generator's prompt gains a word for one difficulty. Patched in
// the live registry and restored afterwards.
const target = gens[0];
const original = GENERATORS[target];
try {
  const patched = (rng, d) => { const q = original(rng, d); return d === 2 ? { ...q, prompt: `${q.prompt} (edited)` } : q; };
  Object.assign(patched, original);
  GENERATORS[target] = patched;
  ok(generateQuestion(target, 2, 7).prompt.endsWith('(edited)'), 'the tamper reached the generated question');
  const after = generatorDigests(allGens);
  ok(after[target] !== before[target], 'a tampered question changes its generator digest');
  const chapterAfter = chapterDigestOf(victim, after);
  ok(chapterAfter !== chapterBefore, 'a tampered question changes the chapter digest');
  const releaseAfter = releaseDigestOf(Object.fromEntries(Object.values(spine).map(ch => [ch.id, chapterDigestOf(ch, after)])), CONTENT_VERSION);
  ok(releaseAfter !== releaseBefore, 'a tampered question changes the release digest');
  const untouched = Object.values(spine).filter(ch => !chapterGeneratorIds(ch).includes(target));
  ok(untouched.every(ch => chapterDigestOf(ch, after) === chapterDigestOf(ch, before)), 'chapters that do not use the tampered generator keep their digest');
  ok(shortDigest(releaseAfter) !== shortDigest(releaseBefore), 'the eight-character short digest shown to readers also moves');
} finally {
  GENERATORS[target] = original;
}
eq(chapterDigestOf(victim, generatorDigests(allGens)), chapterBefore, 'restoring the generator restores the chapter digest');
ok(releaseDigestOf({ a: '1' }, '2026.1') !== releaseDigestOf({ a: '1' }, '2026.2'), 'a content-version bump alone changes the release digest');

// The page module must be routed publicly and read the manifest, not re-measure.
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
eq((app.match(/path="\/coverage"/g) || []).length, 2, '/coverage is routed both before and after the profile gate');
const page = readFileSync(new URL('../src/pages/Coverage.jsx', import.meta.url), 'utf8');
ok(/coverage-manifest\.json/.test(page), 'the Coverage page is built from the committed manifest');
ok(!/generateQuestion|loadAllBanks/.test(page), 'the Coverage page never generates questions at runtime');

const total = pass + failures.length;
if (failures.length) {
  for (const f of failures) console.log(`  ✖ ${f}`);
  console.log(`COVERAGE MANIFEST: FAIL — ${pass}/${total} checks`);
  process.exit(1);
}
console.log(`COVERAGE MANIFEST: PASS — ${pass}/${total} checks — ${chapters} chapters across ${V1_GRADES.length} classes, release digest ${live.releaseDigest} verified ${committed.verifiedAt}`);
