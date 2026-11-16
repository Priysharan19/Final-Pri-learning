// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · content honesty: no review a human never did
//
// Classes 7–10 used to show "CBSE / NCERT · source-reviewed", Class 9 said its
// prompts were "independently verified" and two shells carried a "release
// audit" — all of it an in-repository agent audit, never a human reviewer
// (audit item 10, Nov 2026; #499 still open). This suite pins the rule that
// replaced those labels:
//
//   · a student surface may say reviewed / verified / audited without
//     qualification only when a NAMED human signed the chapter;
//   · until then every provenance state is an agent audit and says so, and
//     the track-picker label says "software-checked, no examiner review yet"
//     or "source mapping not yet checked";
//   · Classes 8 and 9 carry their honest coverage labels (decision D24): the
//     earlier NCERT book, and 8 of the 15 CBSE 2026–27 chapters.
//
// It reads the catalogues the app renders from (strings.en.js, strings.hi.js),
// the product sections the track picker renders, the curriculum captions, the
// provenance module and the NCERT shell components, and it proves the label
// gate by mutation: a production record that claims a human review flips the
// label, so the gate is real and not dead wording.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = rel => readFileSync(join(ROOT, rel), 'utf8');

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

// A claim of review by a person that no person made. Each pattern is checked
// against every English and Hindi string value and every product label.
const REVIEW_CLAIMS = [
  [/source[- ]reviewed/i, 'source-reviewed'],
  [/source[- ]audited/i, 'source-audited'],
  [/independently verified/i, 'independently verified'],
  [/release audit/i, 'release audit'],
  [/examiner[- ]reviewed/i, 'examiner-reviewed'],
  [/स्वतंत्र रूप से सत्यापित/, 'स्वतंत्र रूप से सत्यापित'],
  [/रिलीज़ जाँच/, 'रिलीज़ जाँच'],
  [/परीक्षक द्वारा समीक्षित/, 'परीक्षक द्वारा समीक्षित']
];
// Coverage wording the owner's decision D24 rules out of the product itself.
const COVERAGE_CLAIMS = [
  [/complete syllabus/i, 'complete syllabus'],
  [/full syllabus/i, 'full syllabus'],
  [/syllabus[- ]aligned/i, 'syllabus-aligned'],
  [/every chapter\b/i, 'every chapter'],
  [/every topic\b/i, 'every topic'],
  [/like an? (?:real )?examiner/i, 'like an examiner'],
  [/examiner[- ]grade/i, 'examiner-grade'],
  [/unlimited questions/i, 'unlimited questions'],
  [/mark predictor/i, 'mark predictor'],
  [/calibrated to jee/i, 'calibrated to JEE'],
  [/predicted percentile|percentile predict/i, 'predicted percentile']
];
// Strings that mention a phrase only to deny it. Each carries its reason.
const ALLOW = new Map([
  ['verifiedMarks.finalAccepted', 'says full marks do NOT mean every line was independently verified'],
  ['progress.honesty', 'says Pri does NOT predict a percentile or a rank'],
  ['progress.noPercentile', 'the heading of that denial']
]);

const { indiaProductSections, cbseProductLabel } = await import('../src/engine/indiaProduct.js');
const { IN_CURRICULUM } = await import('../src/engine/curriculum-in.js');
const meta = await import('../src/engine/indiaProductionMeta.js');
const en = (await import('../src/i18n/strings.en.js')).default ?? (await import('../src/i18n/strings.en.js')).en;
const hi = (await import('../src/i18n/strings.hi.js')).default ?? (await import('../src/i18n/strings.hi.js')).hi;

function values(catalogue) {
  const out = [];
  for (const [key, value] of Object.entries(catalogue || {})) {
    if (typeof value === 'string') out.push([key, value]);
    else if (value && typeof value === 'object') for (const v of Object.values(value)) if (typeof v === 'string') out.push([key, v]);
  }
  return out;
}

// ── 1. The catalogues ────────────────────────────────────────────────────────
for (const [name, catalogue] of [['strings.en.js', en], ['strings.hi.js', hi]]) {
  const entries = values(catalogue);
  ok(entries.length > 1000, `${name} loaded (${entries.length} values)`);
  for (const [pattern, label] of [...REVIEW_CLAIMS, ...COVERAGE_CLAIMS]) {
    const hits = entries.filter(([key, value]) => pattern.test(value) && !ALLOW.has(key)).map(([key]) => key);
    ok(hits.length === 0, `${name}: no string claims "${label}" (${hits.slice(0, 5).join(', ')})`);
  }
  for (const key of ALLOW.keys()) {
    if (!(key in catalogue)) continue;
    const text = String(catalogue[key]);
    ok(/\bnot\b|\bno\b|does not|नहीं|(?:^|\s)न\s/i.test(text), `${name}: allowlisted ${key} is a denial (${ALLOW.get(key)})`);
  }
}

// ── 2. What the track picker shows ──────────────────────────────────────────
{
  const product = indiaProductSections();
  const surfaces = [];
  for (const section of [...product.years, ...product.streams]) {
    surfaces.push([`${section.key} label`, section.label], [`${section.key} caption`, section.caption], [`${section.key} title`, section.title]);
    // The olympiad entry is outside V1 (flagged off for new profiles) and
    // carries no production record; its wording is still checked above.
    if (!section.production) continue;
    for (const chapter of section.chapters) {
      surfaces.push([`${chapter.id} name`, chapter.name]);
      const p = chapter.production;
      ok(p && typeof p.agentAudited === 'boolean' && p.humanReviewed === false && p.humanReviewer === null,
        `${chapter.id}: production metadata says agent audit only and names no human reviewer`);
      ok(!('sourceReviewed' in (p || {})), `${chapter.id}: the old sourceReviewed field is gone`);
    }
    ok(section.production.humanReviewedChapters === 0, `${section.key}: no chapter is counted as human-reviewed`);
    if (section.track === 'cbse') {
      ok(section.production.reviewState !== 'human-reviewed' && section.production.reviewState !== 'source-reviewed',
        `${section.key}: class review state is ${section.production.reviewState}, never a human or source review`);
      ok(/software-checked, no examiner review yet|source mapping not yet checked/.test(section.label), `${section.key}: label is one of the two honest forms (${section.label})`);
    }
  }
  for (const [where, text] of surfaces) {
    for (const [pattern, label] of [...REVIEW_CLAIMS, ...COVERAGE_CLAIMS]) {
      ok(!pattern.test(String(text ?? '')), `${where} does not claim "${label}" (${text})`);
    }
  }
  const grade8 = product.years.find(s => s.year === 8);
  const grade9 = product.years.find(s => s.year === 9);
  ok(/earlier NCERT book/.test(grade8.caption), `Class 8 caption says it follows the earlier NCERT book (${grade8.caption})`);
  ok(/8 of the 15 chapters/.test(grade9.caption), `Class 9 caption says 8 of the 15 chapters are live (${grade9.caption})`);
  ok(grade9.chapters.length === 8, `Class 9 really has 8 live chapters (${grade9.chapters.length}), so the caption is true`);
}

// ── 3. The curriculum captions and the provenance module ────────────────────
for (const group of IN_CURRICULUM) {
  for (const [pattern, label] of [...REVIEW_CLAIMS, ...COVERAGE_CLAIMS]) {
    ok(!pattern.test(group.caption || ''), `Class ${group.grade} caption does not claim "${label}"`);
  }
}
{
  const states = Object.values(meta.INDIA_RELEASE_STATE);
  ok(!states.some(s => /(?<!un)reviewed/.test(s)), `no release state claims a review (${states.join(', ')})`);
  ok(Object.values(meta.INDIA_REVIEW_STATE).every(s => s.startsWith('agent-audited')), 'every review state names itself an agent audit');
  const census = meta.indiaProductionCensus();
  ok(census.length > 0 && census.every(row => row.humanReviewed === false), 'the census counts 0 human-reviewed chapters');
  ok(/humanReviewed: false, humanReviewer: null/.test(read('client/src/engine/indiaProductionMeta.js')), 'the provenance module hard-codes no human reviewer until one signs');
}

// ── 4. The label gate is real: a signed human review flips it ───────────────
{
  ok(cbseProductLabel({ reviewState: 'agent-audited' }) === 'CBSE / NCERT · software-checked, no examiner review yet', 'agent-audited reads as a software check');
  ok(cbseProductLabel({ reviewState: 'agent-audit-pending' }) === 'CBSE / NCERT · source mapping not yet checked', 'pending reads as not yet checked');
  ok(cbseProductLabel({ reviewState: 'mixed' }) === 'CBSE / NCERT · source mapping not yet checked', 'a partly audited class does not round up');
  ok(cbseProductLabel({ reviewState: 'human-reviewed' }) === 'CBSE / NCERT · examiner-reviewed', 'only a human-reviewed class may say examiner-reviewed');
  ok(cbseProductLabel({ reviewState: 'source-reviewed' }) === 'CBSE / NCERT · source mapping not yet checked', 'the retired source-reviewed state no longer earns a review label');
}

// ── 5. The NCERT shells render from the catalogue, with no hard-coded claim ─
for (const rel of [
  'client/src/components/NcertClass8ChapterSection.jsx',
  'client/src/components/NcertClass9ChapterSection.jsx',
  'client/src/components/LinearEquationsTopperSectionProduction.jsx',
  'client/src/components/RationalNumbersTopperSectionProduction.jsx',
  'client/src/components/Class10NCERTLibrary.jsx',
  'client/src/pages/Home.jsx',
  'client/src/pages/Login.jsx'
]) {
  const src = read(rel);
  for (const [pattern, label] of REVIEW_CLAIMS) {
    // Comments may describe the old defect; rendered text may not carry it.
    const rendered = src.split('\n').filter(line => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
    ok(!pattern.test(rendered), `${rel} renders no "${label}"`);
  }
}

// ── 6. Served Class 8 prompts carry no textbook numbering ───────────────────
{
  const { makeRng } = await import('../src/engine/qhelpers.js');
  const { NCERT_CLASS8_RATIONAL_GENERATORS } = await import('../src/engine/ncert/class8-rational-numbers.js');
  const { NCERT_CLASS8_LINEAR_GENERATORS, NCERT_CLASS8_LINEAR_EXERCISES } = await import('../src/engine/ncert/class8-linear-equations.js');
  const numbering = /\bNCERT\s+(?:Exercise|Example|Try These)\b|\bExercise\s+\d+\.\d+\s*Q\s*\d+|\bTry These\b/i;
  const textbook = new Set(NCERT_CLASS8_LINEAR_EXERCISES.map(item => item.prompt.replace(/\s+/g, '')));
  let drawn = 0, numbered = 0, reproduced = 0;
  for (const bank of [NCERT_CLASS8_RATIONAL_GENERATORS, NCERT_CLASS8_LINEAR_GENERATORS]) {
    for (const [id, gen] of Object.entries(bank)) {
      for (let d = 1; d <= 4; d++) {
        for (let i = 0; i < 60; i++) {
          const q = gen(makeRng(0x8c600000 + d * 1000 + i), d);
          drawn++;
          const shown = [q.prompt, q.stem, ...(q.mcqOptions || []), ...(q.hints || []), ...(q.steps || []).flatMap(s => [s.h, s.d])].filter(Boolean).join('\n');
          if (numbering.test(shown)) { numbered++; if (numbered <= 3) failures.push(`${id}@D${d} carries textbook numbering: ${q.prompt.slice(0, 90)}`); }
          if (textbook.has(String(q.prompt).replace(/\s+/g, ''))) { reproduced++; if (reproduced <= 3) failures.push(`${id}@D${d} reproduces a textbook exercise: ${q.prompt}`); }
        }
      }
    }
  }
  ok(drawn === 15 * 4 * 60, `drew every Class 8 Chapter 1–2 cell 60 times (${drawn})`);
  ok(numbered === 0, `no served Class 8 question carries an NCERT exercise, example or Try These number (${numbered} of ${drawn})`);
  ok(reproduced === 0, `no served Class 8 question is a textbook exercise verbatim (${reproduced} of ${drawn})`);
}

const total = pass + failures.length;
if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`CONTENT HONESTY: FAIL — ${pass}/${total} checks`);
  process.exit(1);
}
console.log(`CONTENT HONESTY: PASS — ${pass}/${total} checks — no student surface claims a review a human never did; Classes 8 and 9 carry their coverage labels; served Class 8 questions carry no textbook numbering`);
