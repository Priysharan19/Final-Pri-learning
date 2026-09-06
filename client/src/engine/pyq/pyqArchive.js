// Pri Learning · the previous-year question archive itself
//
// This module is the demand-loaded half of the layer: it holds every record,
// validates all of them at load, and turns each (track, chapter) group into one
// generator function with the same `(rng, difficulty) => payload` signature as
// every authored bank. The statically-imported half is pyqCoverage.js, which is
// small enough for indiaProduct.js to consult on every practice request without
// pulling the questions themselves into the startup chunk.
//
// Validation happens here rather than in a build step because there is no build
// step: these records are hand-transcribed source, so the file that holds them
// is also the file that must refuse a bad one. A record that breaks the
// contract throws at import, which fails the suite and the build rather than
// shipping a question that lies about where it came from.

import { validatePyqRecord, pyqPayload } from './pyqSchema.js';
import { pyqGeneratorId } from './pyqCoverage.js';
import { JEE_ADVANCED_PYQ_RECORDS } from './records-jee-advanced.js';
import { CBSE_PYQ_RECORDS } from './records-cbse.js';

function validateAll(records) {
  const seen = new Set();
  const out = [];
  for (const raw of records) {
    const rec = validatePyqRecord(raw);
    if (seen.has(rec.id)) throw new Error(`PYQ record ${rec.id}: duplicate id.`);
    seen.add(rec.id);
    out.push(rec);
  }
  // Two records transcribed from the same printed question would double the
  // chance a student meets it and would mean one of the two transcriptions is
  // redundant — either way it is a mistake in the archive, not in a draw.
  const sittings = new Set();
  for (const rec of out) {
    const key = `${rec.examId}|${rec.year}|${rec.paper || ''}|${rec.setCode || ''}|${rec.questionNumber}`;
    if (sittings.has(key)) throw new Error(`PYQ record ${rec.id}: a record for ${key} already exists.`);
    sittings.add(key);
  }
  return Object.freeze(out);
}

/** Every published record, validated. */
export const PYQ_RECORDS = validateAll([...JEE_ADVANCED_PYQ_RECORDS, ...CBSE_PYQ_RECORDS]);

/** The records a generator id serves, in archive order. */
export function pyqRecordsFor(generatorId) {
  const id = String(generatorId || '');
  return PYQ_RECORDS.filter(rec => pyqGeneratorId(rec.track, rec.chapterId) === id);
}

/**
 * Every (track, chapter) group as a bank of generator functions. Each function
 * picks the record whose difficulty is nearest the one asked for — the same
 * nearest-rung rule chapterCells uses — so a D2 board slot never gets a D4 JEE
 * Advanced item merely because the chapter has one.
 */
export function buildPyqBank(records = PYQ_RECORDS) {
  const grouped = new Map();
  for (const rec of records) {
    const id = pyqGeneratorId(rec.track, rec.chapterId);
    if (!grouped.has(id)) grouped.set(id, new Map());
    const byDifficulty = grouped.get(id);
    if (!byDifficulty.has(rec.difficulty)) byDifficulty.set(rec.difficulty, []);
    byDifficulty.get(rec.difficulty).push(rec);
  }
  const bank = {};
  for (const [id, byDifficulty] of grouped) {
    const rungs = [...byDifficulty.keys()].sort((a, b) => a - b);
    bank[id] = (rng, difficulty) => {
      const want = Math.min(4, Math.max(1, Number(difficulty) || 2));
      const rung = rungs.reduce((best, d) => {
        const gap = Math.abs(d - want), bestGap = Math.abs(best - want);
        return gap < bestGap || (gap === bestGap && d < best) ? d : best;
      }, rungs[0]);
      const rows = byDifficulty.get(rung);
      const raw = Number(typeof rng === 'function' ? rng() : Math.random());
      const unit = Number.isFinite(raw) ? Math.max(0, Math.min(0.999999999, raw)) : 0;
      return pyqPayload(rows[Math.floor(unit * rows.length)]);
    };
  }
  return bank;
}

let bankOnce = null;

/** The generator function for one id, or null. The bank is built once. */
export function pyqGenerator(generatorId) {
  if (!bankOnce) bankOnce = buildPyqBank();
  return bankOnce[String(generatorId || '')] || null;
}

/**
 * What the archive actually contains, for the product surfaces and the census.
 * Nothing here is rounded or estimated: every number is a count of records in
 * this file.
 */
export function pyqArchiveSnapshot() {
  const byExam = {};
  const byYear = {};
  const byProvenance = {};
  for (const rec of PYQ_RECORDS) {
    byExam[rec.examId] = (byExam[rec.examId] || 0) + 1;
    byYear[rec.year] = (byYear[rec.year] || 0) + 1;
    byProvenance[rec.provenance] = (byProvenance[rec.provenance] || 0) + 1;
  }
  const generators = [...new Set(PYQ_RECORDS.map(rec => pyqGeneratorId(rec.track, rec.chapterId)))].sort();
  return Object.freeze({
    records: PYQ_RECORDS.length,
    chapters: new Set(PYQ_RECORDS.map(rec => rec.chapterId)).size,
    generators: Object.freeze(generators),
    byExam: Object.freeze(byExam),
    byYear: Object.freeze(byYear),
    byProvenance: Object.freeze(byProvenance)
  });
}
