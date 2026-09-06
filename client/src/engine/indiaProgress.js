// Pri Learning · India progress presentation model
//
// This is intentionally a PRODUCT aggregation layer, not a new adaptive engine.
// It consumes the rating/attempt rows already produced by the learning system and
// presents evidence in India curriculum terms. It does not manufacture HSC bands,
// ATAR-style marks or a fake CBSE/JEE score prediction from sparse practice data.
//
// Evidence for an Indian chapter is keyed by the chapter id (one rating row per
// chapter, with dot points underneath it). Rows written before that — one per
// generator — are still read, as an aggregate, so a device that holds a term of
// older work keeps showing it.

import { generatorsFor } from './curriculum-in.js';

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** The public label for each reason tag a recommendation can carry. */
export const INDIA_REASON_LABEL = Object.freeze({
  'review-due': 'Spaced review',
  'weak-spot': 'Weak spot',
  misconception: 'Repeated slip',
  'new-ground': 'New ground',
  interleave: 'Interleaving'
});

export const INDIA_REASON_TAGS = Object.freeze(Object.keys(INDIA_REASON_LABEL));

export function indiaReasonLabel(tag) {
  return INDIA_REASON_LABEL[String(tag || '')] || null;
}

export function indiaChapterEvidence(chapter, ratings = {}) {
  const ids = generatorsFor(chapter);
  const own = chapter?.id ? ratings?.[chapter.id] : null;
  if (own && typeof own === 'object') {
    const a = Math.max(0, finite(own.attempts));
    const c = Math.max(0, Math.min(a, finite(own.correct)));
    const last = finite(own.last_at, 0);
    return Object.freeze({
      chapterId: chapter.id,
      generatorCount: ids.length,
      ratedGenerators: a > 0 ? ids.length : 0,
      attempts: a,
      correct: c,
      accuracy: a ? Math.round(1000 * c / a) / 10 : null,
      latestAt: last > 0 ? last : null,
      keyedByChapter: true
    });
  }

  let attempts = 0;
  let correct = 0;
  let latestAt = null;
  let ratedGenerators = 0;

  for (const id of ids) {
    const row = ratings?.[id];
    if (!row) continue;
    const a = Math.max(0, finite(row.attempts));
    const c = Math.max(0, Math.min(a, finite(row.correct)));
    attempts += a;
    correct += c;
    if (a > 0) ratedGenerators++;
    const last = finite(row.last_at, 0);
    if (last > 0) latestAt = latestAt == null ? last : Math.max(latestAt, last);
  }

  return Object.freeze({
    chapterId: chapter?.id || null,
    generatorCount: ids.length,
    ratedGenerators,
    attempts,
    correct,
    accuracy: attempts ? Math.round(1000 * correct / attempts) / 10 : null,
    latestAt,
    keyedByChapter: false
  });
}

function summarise(evidence, extra = {}) {
  const attempts = evidence.reduce((n, row) => n + row.evidence.attempts, 0);
  const correct = evidence.reduce((n, row) => n + row.evidence.correct, 0);
  const started = evidence.filter(row => row.evidence.attempts > 0).length;
  const practised = evidence.filter(row => row.evidence.attempts >= 5).length;
  const chaptersWithAccuracyEvidence = evidence.filter(row => row.evidence.attempts >= 5 && row.evidence.accuracy != null);
  const strongEvidence = chaptersWithAccuracyEvidence.filter(row => row.evidence.accuracy >= 80).length;

  return Object.freeze({
    chapters: evidence.length,
    chaptersStarted: started,
    chaptersPractised: practised,
    chaptersWithStrongEvidence: strongEvidence,
    attempts,
    correct,
    accuracy: attempts ? Math.round(1000 * correct / attempts) / 10 : null,
    ...extra,
    chapterRows: Object.freeze(evidence.map(({ chapter, evidence: row }) => Object.freeze({
      id: chapter.id,
      name: chapter.name,
      strand: chapter.strand,
      dotpoints: Object.freeze([...(chapter.dotpoints || [])]),
      ...row
    })))
  });
}

export function indiaProgressSummary(chapters = [], ratings = {}) {
  const evidence = chapters.map(chapter => ({ chapter, evidence: indiaChapterEvidence(chapter, ratings) }));
  return summarise(evidence);
}

/**
 * The same summary built from the rows GET /curriculum already decorates for an
 * Indian profile — attempts, correct, mastery, band, due and dot points — so
 * the page renders the model the CI suite checks rather than a copy of it.
 */
export function indiaProgressFromCurriculum(rows = []) {
  const evidence = (rows || []).map(row => {
    const attempts = Math.max(0, finite(row.attempts));
    const correct = Math.max(0, Math.min(attempts, finite(row.correct)));
    const dotpoints = Array.isArray(row.dotpoints) ? row.dotpoints : [];
    return {
      chapter: {
        id: row.id, name: row.name || row.title, strand: row.strand || null,
        dotpoints: dotpoints.map(dp => (typeof dp === 'string' ? dp : dp?.text || ''))
      },
      evidence: Object.freeze({
        chapterId: row.id,
        attempts, correct,
        accuracy: attempts ? Math.round(1000 * correct / attempts) / 10 : null,
        mastery: Math.max(0, Math.min(100, finite(row.mastery))),
        band: attempts ? String(row.band || 'emerging') : 'unseen',
        due: !!row.due,
        ahead: !!row.ahead,
        smart: row.smart !== false,
        year: row.year ?? null,
        dotpointRows: Object.freeze(dotpoints.map((dp, i) => Object.freeze(typeof dp === 'string'
          ? { key: String(i), text: dp, mastery: 0, band: 'unseen', attempts: 0, generated: true }
          : {
            key: String(dp?.key ?? i), text: dp?.text || '',
            mastery: Math.max(0, Math.min(100, finite(dp?.mastery))),
            band: finite(dp?.attempts) > 0 ? String(dp?.band || 'emerging') : 'unseen',
            attempts: Math.max(0, finite(dp?.attempts)), generated: dp?.generated !== false
          })))
      })
    };
  });
  const chaptersDue = evidence.filter(row => row.evidence.due).length;
  const chaptersMastered = evidence.filter(row => row.evidence.band === 'mastered').length;
  const dotpointsSeen = evidence.reduce((n, row) => n + row.evidence.dotpointRows.filter(dp => dp.attempts > 0).length, 0);
  const dotpointsTotal = evidence.reduce((n, row) => n + row.evidence.dotpointRows.length, 0);
  return summarise(evidence, { chaptersDue, chaptersMastered, dotpointsSeen, dotpointsTotal });
}

export function indiaProgressCopy(summary, { track = 'cbse', grade = null } = {}) {
  const scope = track === 'jee-main' ? 'JEE Main' : track === 'jee-advanced' ? 'JEE Advanced' : track === 'olympiad' ? 'Olympiad' : grade ? `Class ${grade} CBSE / NCERT` : 'India curriculum';
  if (!summary?.attempts) {
    return Object.freeze({
      title: `${scope} progress`,
      primary: 'No practice evidence yet',
      secondary: 'Start solving questions to build chapter-level evidence.',
      prediction: null
    });
  }
  return Object.freeze({
    title: `${scope} progress`,
    primary: `${summary.chaptersStarted}/${summary.chapters} chapters started`,
    secondary: `${summary.attempts} attempts · ${summary.accuracy}% demonstrated accuracy`,
    prediction: null
  });
}
