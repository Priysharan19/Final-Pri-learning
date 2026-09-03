// Pri Learning · India progress presentation model
//
// This is intentionally a PRODUCT aggregation layer, not a new adaptive engine.
// It consumes the rating/attempt rows already produced by the learning system and
// presents evidence in India curriculum terms. It does not manufacture HSC bands,
// ATAR-style marks or a fake CBSE/JEE score prediction from sparse practice data.

import { generatorsFor } from './curriculum-in.js';

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function indiaChapterEvidence(chapter, ratings = {}) {
  const ids = generatorsFor(chapter);
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
    latestAt
  });
}

export function indiaProgressSummary(chapters = [], ratings = {}) {
  const evidence = chapters.map(chapter => ({ chapter, evidence: indiaChapterEvidence(chapter, ratings) }));
  const attempts = evidence.reduce((n, row) => n + row.evidence.attempts, 0);
  const correct = evidence.reduce((n, row) => n + row.evidence.correct, 0);
  const started = evidence.filter(row => row.evidence.attempts > 0).length;
  const practised = evidence.filter(row => row.evidence.attempts >= 5).length;
  const chaptersWithAccuracyEvidence = evidence.filter(row => row.evidence.attempts >= 5 && row.evidence.accuracy != null);
  const strongEvidence = chaptersWithAccuracyEvidence.filter(row => row.evidence.accuracy >= 80).length;

  return Object.freeze({
    chapters: chapters.length,
    chaptersStarted: started,
    chaptersPractised: practised,
    chaptersWithStrongEvidence: strongEvidence,
    attempts,
    correct,
    accuracy: attempts ? Math.round(1000 * correct / attempts) / 10 : null,
    chapterRows: Object.freeze(evidence.map(({ chapter, evidence: row }) => Object.freeze({
      id: chapter.id,
      name: chapter.name,
      strand: chapter.strand,
      dotpoints: Object.freeze([...(chapter.dotpoints || [])]),
      ...row
    })))
  });
}

export function indiaProgressCopy(summary, { track = 'cbse', grade = null } = {}) {
  const scope = track === 'jee-main' ? 'JEE Main' : track === 'jee-advanced' ? 'JEE Advanced' : grade ? `Class ${grade} CBSE / NCERT` : 'India curriculum';
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
