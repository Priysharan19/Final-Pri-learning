// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the public Coverage manifest (ledger §5.1, §5.6)
//
// Builds docs/content/coverage-manifest.json — what the /coverage page shows —
// from the curriculum spine and the generator registry, never by hand. Per
// class and per chapter it records:
//
//   · dot points declared, and how many an authored form reaches;
//   · the generators behind the chapter and whether any was written for NCERT
//     (`native`) or reused from the NSW banks;
//   · a MEASURED question count: distinct questions in a fixed-seed sample
//     (SAMPLE_SEEDS draws per generator per declared difficulty). It is a
//     sample, labelled as one; the page never prints it as the bank's size;
//   · the source the chapter list was authored against (textbook / board
//     document, with the URL where one is published);
//   · the review tier. Every tier is automated review. No entry can say a
//     teacher has read a question, because none has;
//   · the chapter's provenance digest (engine/provenance.js) and the release
//     digest and date the ledger was last verified under.
//
// Usage:
//   node tools/build-coverage.mjs            print the summary, write nothing
//   node tools/build-coverage.mjs --write    refresh the manifest (stamps today
//                                            as verifiedAt)
//   node tools/build-coverage.mjs --check    exit 1 if the committed manifest
//                                            is stale (everything but the date)
//
// client/test/coverage-manifest-check.mjs runs the --check comparison in CI,
// so a generator change that is not re-verified cannot ship under an old date.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
export const MANIFEST_FILE = path.join(ROOT, 'docs/content/coverage-manifest.json');

const { IN_CURRICULUM, uncoveredDotpoints } = await import('../client/src/engine/curriculum-in.js');
const { generateQuestion, loadAllBanks, GENERATORS } = await import('../client/src/engine/generators/index.js');
const { CONTENT_VERSION, contentDigest, contentHashOf } = await import('../client/src/engine/contentIdentity.js');
const { chapterDigestOf, releaseDigestOf, chapterGeneratorIds, reviewTierOf } = await import('../client/src/engine/provenance.js');
const { generatorDigests } = await import('../client/test/content-certify.mjs');
const { INDIA_EXAM_SOURCES } = await import('../client/src/engine/indiaExams.js');
const { NCERT_CLASS7_2026_27_SOURCE } = await import('../client/src/engine/ncert/class7-2026-27-syllabus.js');
const { NCERT_CLASS7_PART2_2026_27_SOURCE } = await import('../client/src/engine/ncert/class7-part2-2026-27-syllabus.js');
const { CBSE_CLASS10_2026_27_SOURCE } = await import('../client/src/engine/ncert/class10-2026-27-production.js');

export const SAMPLE_SEEDS = 12;
export const V1_GRADES = [7, 8, 9, 10, 11, 12];

// ── Source citations ─────────────────────────────────────────────────────────
// One citation per class: the document the chapter list and dot points were
// authored against. Where the repo holds a structured source record it is read
// from there; where it holds only a document (Class 8's supplied NCERT set,
// Class 9's Ganita Manjari header) the citation names that document.

const src = (title, url = null, note = null) => ({ title, url, note });

export const CLASS_SOURCES = Object.freeze({
  7: [
    src(NCERT_CLASS7_2026_27_SOURCE.curriculumVersion, NCERT_CLASS7_2026_27_SOURCE.prelims, `ISBN ${NCERT_CLASS7_2026_27_SOURCE.isbn}; reprint ${NCERT_CLASS7_2026_27_SOURCE.reprint}`),
    src(NCERT_CLASS7_PART2_2026_27_SOURCE.curriculumVersion, NCERT_CLASS7_PART2_2026_27_SOURCE.prelims || null, NCERT_CLASS7_PART2_2026_27_SOURCE.isbn ? `ISBN ${NCERT_CLASS7_PART2_2026_27_SOURCE.isbn}` : null)
  ],
  8: [
    src('NCERT Mathematics Textbook for Class VIII (supplied 2026–27 reprint PDFs and answer section)', 'https://ncert.nic.in/textbook.php?hemh1=0-13', 'docs/ncert-class8-source-files.md records the audit; the PDFs themselves are not stored in the repository')
  ],
  9: [
    src('NCERT Ganita Manjari Grade 9 Part I (2026–27)', 'https://ncert.nic.in/textbook.php', 'client/src/engine/ncert/class9-syllabus.js; eight-chapter 2026–27 structure'),
    src(INDIA_EXAM_SOURCES.cbseSecondaryCurriculum2025_26?.title || 'CBSE Mathematics (Classes IX–X) course structure', INDIA_EXAM_SOURCES.cbseSecondaryCurriculum2025_26?.url || null)
  ],
  10: [
    src(CBSE_CLASS10_2026_27_SOURCE.ncertEdition, CBSE_CLASS10_2026_27_SOURCE.ncertTextbook, `source-reviewed ${CBSE_CLASS10_2026_27_SOURCE.reviewedAt}`),
    src('CBSE Mathematics Class X (041/241) curriculum 2026–27', CBSE_CLASS10_2026_27_SOURCE.cbseMathematicsPdf)
  ],
  11: [
    src(INDIA_EXAM_SOURCES.cbseSeniorSecondaryCurriculum2025_26?.title || 'CBSE Mathematics (Classes XI–XII) course structure', INDIA_EXAM_SOURCES.cbseSeniorSecondaryCurriculum2025_26?.url || null),
    src(INDIA_EXAM_SOURCES.cbse2026_27Curriculum.title, INDIA_EXAM_SOURCES.cbse2026_27Curriculum.url)
  ],
  12: [
    src(INDIA_EXAM_SOURCES.cbseSeniorSecondaryCurriculum2025_26?.title || 'CBSE Mathematics (Classes XI–XII) course structure', INDIA_EXAM_SOURCES.cbseSeniorSecondaryCurriculum2025_26?.url || null),
    src(INDIA_EXAM_SOURCES.cbseClass12Pattern2025_26?.title || 'CBSE Class XII Mathematics sample paper', INDIA_EXAM_SOURCES.cbseClass12Pattern2025_26?.url || null)
  ]
});

// ── Measurement ──────────────────────────────────────────────────────────────

const seedFor = (key, i) => (parseInt(contentDigest(`${key}#${i}`).slice(0, 8), 16) & 0x7fffffff) || 1;

/** Distinct questions in a fixed-seed sample of one chapter's generators. */
function sampleChapter(chapter) {
  const seen = new Set();
  let draws = 0, errors = 0;
  // One cell per (generator, difficulty): a generator two cover entries name
  // at the same difficulty is one source of questions, sampled once.
  const cells = [...new Set(chapter.covers.flatMap(c => c.diff.map(d => `${c.gen}@${d}`)))].sort();
  for (const cell of cells) {
    const [gen, dStr] = cell.split('@');
    const d = Number(dStr);
    if (!GENERATORS[gen]) continue;
    for (let i = 0; i < SAMPLE_SEEDS; i++) {
      draws++;
      try { seen.add(contentHashOf(generateQuestion(gen, d, seedFor(`coverage:${chapter.id}:${gen}:${d}`, i)))); }
      catch { errors++; }
    }
  }
  return { sampleDraws: draws, sampleDistinct: seen.size, sampleErrors: errors };
}

/** The manifest, minus the date (which only --write stamps). */
export async function buildCoverageManifest() {
  await loadAllBanks();
  const groups = IN_CURRICULUM.filter(g => V1_GRADES.includes(g.grade));
  const everyGenerator = new Set(groups.flatMap(g => g.chapters.flatMap(chapterGeneratorIds)));
  const digests = generatorDigests(everyGenerator);
  const chapterDigests = {};
  const classes = groups.map(g => {
    const chapters = g.chapters.map(ch => {
      const digest = chapterDigestOf(ch, digests);
      chapterDigests[ch.id] = digest;
      const generators = chapterGeneratorIds(ch);
      const difficulties = [...new Set(ch.covers.flatMap(c => c.diff))].sort();
      return {
        id: ch.id, name: ch.name, strand: ch.strand,
        dotpoints: ch.dotpoints.length,
        covered: ch.dotpoints.length - uncoveredDotpoints(ch).length,
        generators, native: !!ch.native, difficulties,
        tier: reviewTierOf(ch),
        examSource: ch.examSource || null,
        examMarks: Number.isFinite(ch.examMarks) ? ch.examMarks : null,
        ...sampleChapter(ch),
        digest
      };
    });
    return { grade: g.grade, caption: g.caption, sources: CLASS_SOURCES[g.grade] || [], chapters };
  });
  return {
    contentVersion: CONTENT_VERSION,
    releaseDigest: releaseDigestOf(chapterDigests, CONTENT_VERSION),
    sampleSeeds: SAMPLE_SEEDS,
    reviewTiers: {
      'source-mapped-automated': 'At least one generator written against the NCERT/CBSE source for this chapter; every question machine-checked. No teacher review.',
      'reused-generator-automated': 'Generators reused from the NSW banks, mapped per dot point; every question machine-checked. No teacher review.'
    },
    note: 'Automated review only. Sample counts are distinct questions in a fixed-seed sample, not the size of the bank. Nothing here claims that the syllabus is complete, nor that a person has reviewed any question.',
    classes
  };
}

export function readCommittedManifest() {
  return fs.existsSync(MANIFEST_FILE) ? JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8')) : null;
}

/** Everything but the verification date, for a stale-or-not comparison. */
export const undated = m => { if (!m) return null; const { verifiedAt: _d, ...rest } = m; return rest; };

export function writeManifest(manifest, verifiedAt) {
  fs.mkdirSync(path.dirname(MANIFEST_FILE), { recursive: true });
  const out = { verifiedAt, ...manifest };
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(out, null, 1).replace(/\[\n\s+("[^"\n]*"|[\d.]+)(,\n\s+("[^"\n]*"|[\d.]+))*\n\s+\]/g, m => `[${m.slice(1, -1).split(',').map(x => x.trim()).join(', ')}]`) + '\n');
  return out;
}

async function main(argv) {
  const flags = new Set(argv);
  const manifest = await buildCoverageManifest();
  const committed = readCommittedManifest();
  const stale = JSON.stringify(undated(committed)) !== JSON.stringify(manifest);
  for (const c of manifest.classes) {
    const dots = c.chapters.reduce((n, ch) => n + ch.dotpoints, 0);
    const covered = c.chapters.reduce((n, ch) => n + ch.covered, 0);
    const distinct = c.chapters.reduce((n, ch) => n + ch.sampleDistinct, 0);
    console.log(`Class ${String(c.grade).padEnd(2)} ${String(c.chapters.length).padStart(3)} chapters  ${String(covered).padStart(3)}/${dots} dot points  ${String(distinct).padStart(5)} distinct in sample`);
  }
  console.log(`release digest ${manifest.releaseDigest} under contentVersion ${manifest.contentVersion}`);
  if (flags.has('--write')) {
    const date = committed && !stale && committed.verifiedAt ? committed.verifiedAt : new Date().toISOString().slice(0, 10);
    writeManifest(manifest, date);
    console.log(`wrote ${path.relative(ROOT, MANIFEST_FILE)} (verifiedAt ${date})`);
    return 0;
  }
  if (flags.has('--check')) {
    if (!committed) { console.log('COVERAGE MANIFEST: FAIL — no committed manifest; run node tools/build-coverage.mjs --write'); return 1; }
    if (stale) { console.log('COVERAGE MANIFEST: FAIL — committed manifest is stale; run node tools/build-coverage.mjs --write and re-verify'); return 1; }
    console.log(`COVERAGE MANIFEST: PASS — matches the generators, verified ${committed.verifiedAt}`);
    return 0;
  }
  console.log(stale ? 'committed manifest is STALE (run with --write)' : `committed manifest is current (verified ${committed?.verifiedAt})`);
  return 0;
}

const launched = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (import.meta.url === launched) process.exit(await main(process.argv.slice(2)));
