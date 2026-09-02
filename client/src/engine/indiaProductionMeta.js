// Pri Learning · India production coverage truth layer
//
// Generator reachability and curriculum review are deliberately separate.
// A chapter can have excellent maths generators while still being an unreviewed
// mapping to the current Indian curriculum. Product surfaces must use this file
// when describing provenance/readiness so we never turn "a generator exists"
// into "NCERT source-reviewed" by accident.

import { IN_CURRICULUM, uncoveredDotpoints } from './curriculum-in.js';

export const INDIA_CONTENT_QUALITY = Object.freeze({
  SOURCE_AUTHORED: 'A',
  REVIEWED_MAPPING: 'B',
  WEAK_MAPPING: 'C',
  MISSING: 'D'
});

export const INDIA_RELEASE_STATE = Object.freeze({
  REVIEWED: 'published-reviewed',
  UNREVIEWED: 'published-unreviewed',
  PARTIAL: 'published-partial',
  MISSING: 'missing'
});

const CLASS8_SOURCE_IDS = Object.freeze(new Set([
  'c8-rational-numbers',
  'c8-linear-equations',
  'c8-quadrilaterals',
  'c8-data-handling',
  'c8-squares-roots',
  'c8-cubes-roots',
  'c8-comparing-quantities',
  'c8-algebraic-identities',
  'c8-mensuration',
  'c8-exponents',
  'c8-proportions',
  'c8-factorisation',
  'c8-graphs'
]));

// Ganita Manjari Grade 9 Part I (2026–27) is represented atomically by the
// source-oriented Class 9 module. Keep this set derived from the live curriculum
// so a future textbook revision cannot silently retain an obsolete id list.
const CLASS9_SOURCE_IDS = Object.freeze(new Set(
  (IN_CURRICULUM.find(group => group.grade === 9)?.chapters || []).map(ch => ch.id)
));

const SOURCES = Object.freeze({
  class8: Object.freeze({
    kind: 'ncert-textbook-and-answer-key',
    edition: 'NCERT Mathematics Class 8 Reprint 2024–25',
    evidence: 'Source-authored modules preserve exercise/source audit metadata and dedicated mastery generators.',
    reviewState: 'source-audited-in-repository'
  }),
  class9: Object.freeze({
    kind: 'ncert-textbook',
    edition: 'Ganita Manjari Grade 9 Part I, 2026–27',
    evidence: 'The Grade 9 curriculum is replaced atomically by the dedicated source-oriented eight-chapter implementation.',
    reviewState: 'source-audited-in-repository'
  })
});

function sourceRecord(chapter) {
  if (CLASS8_SOURCE_IDS.has(chapter.id)) return SOURCES.class8;
  if (CLASS9_SOURCE_IDS.has(chapter.id)) return SOURCES.class9;
  return null;
}

export function indiaProductionStatus(chapter, grade = chapter?.grade ?? null) {
  if (!chapter) {
    return Object.freeze({
      quality: INDIA_CONTENT_QUALITY.MISSING,
      releaseState: INDIA_RELEASE_STATE.MISSING,
      selectable: false,
      sourceReviewed: false,
      generatorComplete: false,
      reason: 'Chapter is absent from the live India curriculum.'
    });
  }

  const missing = uncoveredDotpoints(chapter);
  const generatorComplete = missing.length === 0;
  const source = sourceRecord(chapter);

  if (source && generatorComplete) {
    return Object.freeze({
      quality: INDIA_CONTENT_QUALITY.SOURCE_AUTHORED,
      releaseState: INDIA_RELEASE_STATE.REVIEWED,
      selectable: true,
      sourceReviewed: true,
      generatorComplete: true,
      source,
      reason: 'Dedicated source-oriented production implementation is present for every product dot point.'
    });
  }

  if (!generatorComplete) {
    return Object.freeze({
      quality: INDIA_CONTENT_QUALITY.MISSING,
      releaseState: missing.length === chapter.dotpoints.length ? INDIA_RELEASE_STATE.MISSING : INDIA_RELEASE_STATE.PARTIAL,
      selectable: missing.length < chapter.dotpoints.length,
      sourceReviewed: false,
      generatorComplete: false,
      missingDotpoints: Object.freeze([...missing]),
      reason: 'One or more declared product outcomes have no generator behind them.'
    });
  }

  // A complete generator mapping is not automatically a current-curriculum
  // review. Classes 7/10/11/12 remain C until a source review promotes them.
  return Object.freeze({
    quality: INDIA_CONTENT_QUALITY.WEAK_MAPPING,
    releaseState: INDIA_RELEASE_STATE.UNREVIEWED,
    selectable: true,
    sourceReviewed: false,
    generatorComplete: true,
    source: null,
    grade,
    reason: 'Generator-complete mapping exists, but current source review/provenance has not yet been recorded.'
  });
}

export function indiaProductionCensus() {
  const rows = [];
  for (const group of IN_CURRICULUM) {
    for (const chapter of group.chapters) {
      const status = indiaProductionStatus(chapter, group.grade);
      rows.push(Object.freeze({
        grade: group.grade,
        chapterId: chapter.id,
        chapter: chapter.name,
        quality: status.quality,
        releaseState: status.releaseState,
        sourceReviewed: status.sourceReviewed,
        generatorComplete: status.generatorComplete,
        missingDotpoints: status.missingDotpoints || Object.freeze([])
      }));
    }
  }
  return Object.freeze(rows);
}

export function indiaProductionSummary() {
  const rows = indiaProductionCensus();
  const byQuality = { A: 0, B: 0, C: 0, D: 0 };
  const byGrade = {};
  for (const row of rows) {
    byQuality[row.quality] += 1;
    const bucket = byGrade[row.grade] ||= { total: 0, reviewed: 0, unreviewed: 0, missing: 0 };
    bucket.total += 1;
    if (row.quality === 'A' || row.quality === 'B') bucket.reviewed += 1;
    else if (row.quality === 'D') bucket.missing += 1;
    else bucket.unreviewed += 1;
  }
  return Object.freeze({ total: rows.length, byQuality: Object.freeze(byQuality), byGrade: Object.freeze(byGrade) });
}

export function attachIndiaProductionStatus(chapter, grade = chapter?.grade ?? null) {
  return chapter ? { ...chapter, production: indiaProductionStatus(chapter, grade) } : chapter;
}
