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
// Captions set in client/src/engine/curriculum-in.js, which lane L1 (marking)
// holds for wave 1 (#686 lock map). Their honest wording — Class 9 "8 of the
// 15 chapters in the CBSE 2026–27 list", Class 10 "mapping checked by software,
// not yet by an examiner" — is the held L5 commit that lands after L1's train,
// and that commit deletes this map. Each entry pins today's exact text, so any
// other edit to a held caption fails here instead of passing unseen.
const HELD_CAPTIONS = new Map([
  [10, 'CBSE/NCERT Class X Mathematics 2026–27 — current rationalised outcomes with source-reviewed production coverage']
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
    const heldCaption = section.track === 'cbse' && HELD_CAPTIONS.get(section.year) === section.caption;
    surfaces.push([`${section.key} label`, section.label], [`${section.key} title`, section.title]);
    if (!heldCaption) surfaces.push([`${section.key} caption`, section.caption]);
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
  // The Class 9 caption ("8 of the 15 chapters") is held with curriculum-in.js;
  // the chapter count it will state is already pinned.
  ok(grade9.chapters.length === 8, `Class 9 has 8 live chapters (${grade9.chapters.length}), the count its held caption states`);
}

// ── 3. The curriculum captions and the provenance module ────────────────────
for (const group of IN_CURRICULUM) {
  if (HELD_CAPTIONS.has(group.grade)) {
    ok(group.caption === HELD_CAPTIONS.get(group.grade), `Class ${group.grade} caption is the held text exactly (${group.caption}); fix it in the held commit and delete HELD_CAPTIONS`);
    continue;
  }
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

const total = pass + failures.length;
if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`CONTENT HONESTY: FAIL — ${pass}/${total} checks`);
  process.exit(1);
}
console.log(`CONTENT HONESTY: PASS — ${pass}/${total} checks — no student surface claims a review a human never did; Class 8 carries its coverage label; ${HELD_CAPTIONS.size} caption held with curriculum-in.js`);
