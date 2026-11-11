// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · JEE difficulty bands for official past questions (F7)
//
// A band is computed from what each archived JEE question actually records,
// and nothing else:
//
//   · its chapter — the topic the record is filed under (the record's own
//     chapterId; NTA and the JEE Advanced IITs publish no topic of their own,
//     so this is Pri's filing, checked by india-pyq-check.mjs), and
//   · the number of steps in its recorded worked solution.
//
// The band is a length-of-working band: "short" (up to 3 recorded steps),
// "standard" (4) and "long" (5 or more). It is NOT a rank, a percentile, a
// predicted score or a measured difficulty — no candidate data, no response
// statistics and no model is consulted, and nothing here may be presented as
// one. A longer recorded solution is the only thing "long" means.
//
// Pure: it takes the records it is given and imports no archive, so it never
// pulls the past-paper archive into the install (vite.config.js ON_DEMAND).
// ─────────────────────────────────────────────────────────────────────────────

export const JEE_BANDS = Object.freeze([
  Object.freeze({ id: 'short', label: 'Short working', rule: 'up to 3 recorded steps', min: 1, max: 3 }),
  Object.freeze({ id: 'standard', label: 'Standard working', rule: '4 recorded steps', min: 4, max: 4 }),
  Object.freeze({ id: 'long', label: 'Long working', rule: '5 or more recorded steps', min: 5, max: Infinity })
]);
export const JEE_BAND_IDS = Object.freeze(JEE_BANDS.map(b => b.id));
export const JEE_BAND_TRACKS = Object.freeze(['jee-main', 'jee-advanced']);

const isJee = rec => JEE_BAND_TRACKS.includes(rec?.track);

/** The recorded step count of a record (or payload), or 0 when it records none. */
export function recordedSteps(rec) {
  return Array.isArray(rec?.steps) ? rec.steps.length : 0;
}

/** The band id of one JEE record, or null (not JEE, or no recorded steps). */
export function jeeBandOf(rec) {
  if (!isJee(rec)) return null;
  const n = recordedSteps(rec);
  if (n < 1) return null;
  return JEE_BANDS.find(b => n >= b.min && n <= b.max)?.id ?? null;
}

/** The records of one generator (pyq-<track>-<chapter>) in one band. */
export function jeeBandRecords(records, generatorId, band) {
  const id = String(generatorId || '');
  return (records || []).filter(rec => isJee(rec) && `pyq-${rec.track}-${rec.chapterId}` === id && jeeBandOf(rec) === band);
}

/**
 * What can be practised by band on one track: for each chapter, how many
 * official questions sit in each band. Counts of records only.
 */
export function jeeBandCatalog(records, track) {
  if (!JEE_BAND_TRACKS.includes(track)) return null;
  const chapters = new Map();
  for (const rec of records || []) {
    if (rec?.track !== track) continue;
    const band = jeeBandOf(rec);
    if (!band) continue;
    if (!chapters.has(rec.chapterId)) chapters.set(rec.chapterId, Object.fromEntries(JEE_BAND_IDS.map(id => [id, 0])));
    chapters.get(rec.chapterId)[band] += 1;
  }
  return Object.freeze({
    track,
    basis: 'recorded-steps',
    bands: JEE_BANDS.map(({ id, label, rule }) => ({ id, label, rule })),
    chapters: [...chapters.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([chapterId, counts]) => ({ chapterId, generator: `pyq-${track}-${chapterId}`, counts }))
  });
}
