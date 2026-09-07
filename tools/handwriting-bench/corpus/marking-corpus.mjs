// ─────────────────────────────────────────────────────────────────────────────
// The marking corpus · schema, validator, loader
//
// The existing corpus (client/test/ink-corpus, format `pri-ink-corpus` v2) is a
// RECOGNITION corpus: strokes plus the expression the writer was asked to copy.
// It cannot score marking, because it has no question, no mark scheme and no
// human marks. This is the second corpus, and it is what the architecture
// decision actually rests on.
//
// One constraint discovered from the code rather than assumed: Architecture B
// scores through Pri's deterministic marker, and `stepCheck` needs the Pri
// question `meta` object — not just prompt text. An item whose question exists
// only as a PDF scan of a JEE paper can be marked by Architecture A and by the
// humans, but NOT by Architecture B. Such items are allowed (they measure
// something real) and are reported separately, so Architecture B is never
// scored on a subset that flatters it.
//
// Split assignment is not made here. It is derived from the writer id with the
// same deterministic hash production already uses, so a writer cannot drift
// between the recognition and marking corpora — which would leak test writers
// into training and quietly invalidate both.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { assignedEvidenceSplit, canonicalEvidenceWriter } from '../../../client/src/ink/productionEvidence.js';

export const FORMAT = 'pri-marking-corpus';
export const VERSION = 1;

/** Everything an item must carry before it can be scored at all. */
const REQUIRED = ['itemId', 'writerId', 'source', 'prompt', 'marks', 'markScheme', 'markerA', 'markerB'];

export function validateItem(item, { index = 0 } = {}) {
  const errors = [];
  const where = item?.itemId || `#${index}`;
  const fail = message => errors.push(`${where}: ${message}`);

  for (const field of REQUIRED) {
    if (item?.[field] === undefined || item?.[field] === null) fail(`missing ${field}`);
  }
  if (errors.length) return errors;

  const writer = canonicalEvidenceWriter(item.writerId);
  if (!/^P\d{4}$/.test(writer)) fail(`writer id must be an anonymous code like P0031, got ${item.writerId}`);
  if (item.split && item.split !== assignedEvidenceSplit(writer)) {
    fail(`split ${item.split} contradicts the deterministic assignment ${assignedEvidenceSplit(writer)} — splits are derived, never chosen`);
  }
  if (!['strokes', 'photo'].includes(item.source)) fail(`source must be "strokes" or "photo", got ${item.source}`);
  if (item.source === 'strokes' && !Array.isArray(item.strokes)) fail('source "strokes" requires a strokes array');
  if (item.source === 'photo' && !item.imagePath) fail('source "photo" requires imagePath');
  if (!Number.isFinite(Number(item.marks)) || Number(item.marks) < 1) fail('marks must be a positive number');
  if (!Array.isArray(item.markScheme) || !item.markScheme.length) fail('markScheme must be a non-empty array');

  for (const marker of ['markerA', 'markerB']) {
    const m = item[marker];
    if (!Number.isFinite(Number(m?.awarded))) fail(`${marker}.awarded must be a number`);
    else if (Number(m.awarded) > Number(item.marks)) fail(`${marker}.awarded exceeds the marks available`);
    if (!m?.markerId) fail(`${marker}.markerId is required — two named markers, or the agreement number means nothing`);
  }
  if (item.markerA?.markerId && item.markerA.markerId === item.markerB?.markerId) {
    fail('markerA and markerB are the same person; independent double-marking is the point');
  }

  const disagree = Number(item.markerA?.awarded) !== Number(item.markerB?.awarded);
  if (disagree && !item.adjudicated) {
    fail('markers disagree and the item is not adjudicated — resolve it or drop it, never average');
  }
  if (item.humanMark && !Number.isFinite(Number(item.humanMark.awarded))) fail('humanMark.awarded must be a number');
  return errors;
}

/** The agreed ground truth: both markers where they agree, the adjudication where they did not. */
export function groundTruth(item) {
  const agreed = Number(item.markerA.awarded) === Number(item.markerB.awarded);
  const awarded = agreed ? Number(item.markerA.awarded) : Number(item.adjudicated?.awarded);
  return {
    awarded,
    criteria: item.adjudicated?.criteria || item.markerA.criteria || null,
    firstBreak: item.adjudicated?.firstBreak ?? item.markerA.firstBreak ?? null,
    errorCarriedForward: item.errorCarriedForward === true,
    alternativeMethod: item.alternativeMethod === true,
    agreed
  };
}

/**
 * Load every marking-corpus file in a directory.
 *
 * Returns `{ items, errors, stats }`. A malformed item is dropped and named
 * rather than silently skipped: a corpus that quietly shrinks is how a
 * benchmark ends up reporting a confident number over forty samples.
 */
export function loadMarkingCorpus(dir, { split = 'test' } = {}) {
  if (!existsSync(dir)) return { items: [], errors: [], stats: { files: 0, present: false } };
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  const items = [];
  const errors = [];
  let rejected = 0;

  for (const file of files) {
    let parsed;
    try { parsed = JSON.parse(readFileSync(join(dir, file), 'utf8')); }
    catch (error) { errors.push(`${file}: unreadable — ${error.message}`); continue; }
    if (parsed?.format !== FORMAT) { errors.push(`${file}: not a ${FORMAT} file`); continue; }

    for (const [index, raw] of (parsed.items || []).entries()) {
      const problems = validateItem(raw, { index });
      if (problems.length) { errors.push(...problems.map(p => `${file} ${p}`)); rejected++; continue; }
      const writer = canonicalEvidenceWriter(raw.writerId);
      const assigned = assignedEvidenceSplit(writer);
      if (split && assigned !== split) continue;
      items.push({ ...raw, writerId: writer, split: assigned, humanMark: groundTruth(raw), sourceFile: file });
    }
  }

  const writers = new Set(items.map(i => i.writerId));
  return {
    items,
    errors,
    stats: {
      present: true,
      files: files.length,
      items: items.length,
      rejected,
      writers: writers.size,
      // Architecture B can only be scored where a Pri question object exists.
      markableByPriEngine: items.filter(i => i.meta).length,
      photoItems: items.filter(i => i.source === 'photo').length,
      strokeItems: items.filter(i => i.source === 'strokes').length
    }
  };
}

/** The floors this study needs before any architecture claim is defensible. */
export const CORPUS_FLOORS = Object.freeze({
  writers: 30,
  solutions: 300,
  markedByTwoHumans: 300,
  strokeItems: 60,
  photoItems: 60
});
