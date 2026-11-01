import assert from 'node:assert/strict';
import { IN_CURRICULUM } from '../src/engine/curriculum-in.js';
import { indiaProductSections } from '../src/engine/indiaProduct.js';
import { NCERT_CLASS7_2026_27_IDS, NCERT_CLASS7_2026_27_SOURCE } from '../src/engine/ncert/class7-2026-27-production.js';
import { NCERT_CLASS7_PART2_2026_27_IDS, NCERT_CLASS7_PART2_2026_27_SOURCE } from '../src/engine/ncert/class7-part2-2026-27-production.js';
import { CBSE_CLASS10_2026_27_REVIEWED_IDS } from '../src/engine/ncert/class10-2026-27-production.js';
import {
  INDIA_CONTENT_QUALITY,
  INDIA_RELEASE_STATE,
  indiaProductionCensus,
  indiaProductionStatus,
  indiaProductionSummary
} from '../src/engine/indiaProductionMeta.js';

const chapters = IN_CURRICULUM.flatMap(group => group.chapters.map(ch => ({ ...ch, grade: group.grade })));
const census = indiaProductionCensus();
const summary = indiaProductionSummary();
const class7Part1 = new Set(NCERT_CLASS7_2026_27_IDS);
const class7Part2 = new Set(NCERT_CLASS7_PART2_2026_27_IDS);

assert.equal(census.length, chapters.length, 'census must include every live Class 7–12 chapter exactly once');
assert.equal(summary.total, chapters.length);
assert.equal(Object.values(summary.byQuality).reduce((a, b) => a + b, 0), chapters.length);

const ids = new Set();
for (const row of census) {
  assert.ok(row.chapterId && !ids.has(row.chapterId), `duplicate chapter in census: ${row.chapterId}`);
  ids.add(row.chapterId);
  assert.ok(['A', 'B', 'C', 'D'].includes(row.quality), `${row.chapterId} has invalid quality`);
  assert.ok(row.releaseState, `${row.chapterId} is missing release state`);
}

for (const chapter of chapters) {
  const status = indiaProductionStatus(chapter, chapter.grade);
  if (chapter.grade === 7) {
    const part1 = class7Part1.has(chapter.id);
    const part2 = class7Part2.has(chapter.id);
    assert.ok(part1 || part2, `${chapter.id} must belong to one current Ganita Prakash part`);
    const source = part2 ? NCERT_CLASS7_PART2_2026_27_SOURCE : NCERT_CLASS7_2026_27_SOURCE;
    assert.equal(status.quality, INDIA_CONTENT_QUALITY.SOURCE_AUTHORED, `${chapter.id} must be source-authored`);
    assert.equal(status.releaseState, INDIA_RELEASE_STATE.AGENT_AUDITED, `${chapter.id} must expose reviewed source evidence`);
    assert.equal(status.agentAudited, true, `${chapter.id} must expose agent-audit evidence`);
    assert.equal(status.humanReviewed, false, `${chapter.id} must not claim a human review`);
    assert.equal(status.source?.edition, source.curriculumVersion);
    assert.equal(status.source?.isbn, source.isbn);
    assert.equal(status.source?.ncertTextbook, source.prelims);
    continue;
  }

  if (chapter.grade === 8 || chapter.grade === 9) {
    assert.equal(status.quality, INDIA_CONTENT_QUALITY.SOURCE_AUTHORED, `${chapter.id} must retain source-authored status`);
    assert.equal(status.releaseState, INDIA_RELEASE_STATE.AGENT_AUDITED, `${chapter.id} must retain reviewed release state`);
    assert.equal(status.agentAudited, true, `${chapter.id} must expose agent-audit evidence`);
    assert.equal(status.humanReviewed, false, `${chapter.id} must not claim a human review`);
    assert.ok(status.source?.edition, `${chapter.id} must name its source edition`);
    continue;
  }

  if (chapter.grade === 10 && CBSE_CLASS10_2026_27_REVIEWED_IDS.has(chapter.id)) {
    assert.equal(status.quality, INDIA_CONTENT_QUALITY.REVIEWED_MAPPING, `${chapter.id} should be a reviewed mapping, not source-authored content`);
    assert.equal(status.releaseState, INDIA_RELEASE_STATE.AGENT_AUDITED);
    assert.equal(status.agentAudited, true);
    assert.equal(status.humanReviewed, false);
    assert.equal(status.source?.edition, 'CBSE-2026-27');
    assert.ok(status.source?.cbseMathematicsPdf?.includes('Maths_SecP1X_2026-27.pdf'));
    continue;
  }

  if (status.generatorComplete) {
    assert.equal(status.quality, INDIA_CONTENT_QUALITY.WEAK_MAPPING, `${chapter.id} must remain C until review evidence is recorded`);
    assert.equal(status.releaseState, INDIA_RELEASE_STATE.UNREVIEWED);
    assert.equal(status.agentAudited, false);
  }
}

const product = indiaProductSections();
for (const section of product.years) {
  assert.equal(section.chapters.length, section.production.totalChapters);
  assert.equal(section.production.auditedChapters, section.chapters.filter(ch => ch.production?.agentAudited).length, `${section.key} audit count must be derived from chapter metadata`);
  assert.equal(section.production.humanReviewedChapters, 0, `${section.key} claims no human-reviewed chapter`);
  for (const chapter of section.chapters) assert.ok(chapter.production, `${chapter.id} must expose production metadata to product surfaces`);
}

const grade7 = product.years.find(section => section.year === 7);
const grade8 = product.years.find(section => section.year === 8);
const grade9 = product.years.find(section => section.year === 9);
const grade10 = product.years.find(section => section.year === 10);
const grade11 = product.years.find(section => section.year === 11);
const grade12 = product.years.find(section => section.year === 12);

for (const section of [grade7, grade8, grade9]) {
  assert.equal(section.production.auditedChapters, section.production.totalChapters, `${section.key} must be fully agent-audited`);
  assert.equal(section.production.reviewState, 'agent-audited');
  assert.match(section.label, /software-checked, no examiner review yet/);
}
assert.equal(grade7.production.totalChapters, 15, 'current Grade 7 Ganita Prakash Parts I–II have fifteen live chapters');

assert.equal(CBSE_CLASS10_2026_27_REVIEWED_IDS.size, 14, 'Class 10 promotion requires every chapter to be reviewed');
assert.equal(grade10.production.auditedChapters, grade10.production.totalChapters);
assert.equal(grade10.production.auditedChapters, 14);
assert.equal(grade10.production.reviewState, 'agent-audited');
assert.match(grade10.label, /software-checked, no examiner review yet/,
  'fully agent-audited Class 10 says so in the track picker, and never claims an examiner review');

for (const section of [grade11, grade12]) {
  assert.equal(section.production.auditedChapters, 0, `${section.key} must not claim an audit before evidence is committed`);
  assert.equal(section.production.reviewState, 'agent-audit-pending');
  assert.match(section.label, /source mapping not yet checked/,
    `${section.key} must not present weak mappings as indistinguishable from reviewed CBSE/NCERT coverage`);
}

console.log(`PASS — India production provenance census: ${summary.total} chapters; A=${summary.byQuality.A}, B=${summary.byQuality.B}, C=${summary.byQuality.C}, D=${summary.byQuality.D}.`);
console.log(`PASS — Classes 7–9 are source-authored; Class 7 includes both Ganita Prakash parts; ${grade10.production.auditedChapters}/${grade10.production.totalChapters} Class 10 chapters are agent-audited mappings; 0 chapters claim a human review.`);
console.log('PASS — CBSE track labels disclose a software check or a pending mapping, never an examiner review.');
