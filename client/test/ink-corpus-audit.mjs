// ─────────────────────────────────────────────────────────────────────────────
// PRI real-ink corpus integrity audit
//
// Writer identity is anonymous and explicit; handwriting is never used to infer
// identity. Strict mode is the evidence gate for foundation-model training and
// release evaluation: consent, deterministic split assignment, Pencil-only
// samples, timing/dynamics and writer/session isolation all have to hold.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, 'ink-corpus');
const STRICT = process.argv.includes('--strict');
const SPLITS = new Set(['train', 'validation', 'test', 'final-holdout']);
const SPLIT_ALGORITHM = 'fnv1a32-v1:70/10/10/10';

const files = existsSync(DIR)
  ? readdirSync(DIR).filter(f => f.endsWith('.json')).sort()
  : [];

if (!files.length) {
  console.log('\nINK CORPUS AUDIT — no real corpus recorded yet.');
  console.log('No writer-separated accuracy claim can be made.\n');
  process.exit(STRICT ? 1 : 0);
}

const errors = [];
const warnings = [];
const writers = new Map();
const sessions = new Set();
let samples = 0, points = 0, timedPoints = 0, dynamicPoints = 0, pencilSamples = 0;
let consentFiles = 0, deterministicFiles = 0;

const err = (file, message) => errors.push(`${file}: ${message}`);
const warn = (file, message) => warnings.push(`${file}: ${message}`);
const canonicalWriter = s => String(s || '').trim().toUpperCase();
function fnv1a(text) { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
function assignedSplit(id) { const b = fnv1a('pri-ink-split-v1:' + canonicalWriter(id)) % 100; return b < 70 ? 'train' : b < 80 ? 'validation' : b < 90 ? 'test' : 'final-holdout'; }

for (const file of files) {
  let corpus;
  try { corpus = JSON.parse(readFileSync(join(DIR, file), 'utf8')); }
  catch (e) { err(file, `invalid JSON (${e.message})`); continue; }

  if (corpus.format !== 'pri-ink-corpus') { err(file, `format must be pri-ink-corpus, got ${JSON.stringify(corpus.format)}`); continue; }

  const version = Number(corpus.version || 1);
  const writerId = canonicalWriter(corpus.writer?.id);
  const sessionId = String(corpus.writer?.sessionId || corpus.session?.id || '').trim();
  const split = String(corpus.split || corpus.writer?.split || '').trim();

  if (!writerId) err(file, 'missing anonymous stable writer.id');
  if (writerId && /@|\s|\.(COM|EDU|ORG)$/i.test(writerId)) err(file, 'writer.id looks like personal/contact information; use an anonymous participant code');
  if (version < 2) { warn(file, 'legacy corpus v1 cannot prove stable identity across sessions'); if (STRICT) err(file, 'strict evidence requires corpus version >= 2'); }

  if (version >= 2) {
    if (!sessionId) err(file, 'v2 corpus requires a unique writer.sessionId');
    if (!split || !SPLITS.has(split)) err(file, `v2 corpus split must be one of ${[...SPLITS].join(', ')}`);
    if (split === 'final-holdout' && corpus.holdoutLocked !== true) err(file, 'final-holdout corpus must set holdoutLocked:true');
    if (corpus.predictedTouchesStored === true) err(file, 'predicted touches must never be stored as ground truth');

    const consent = corpus.consent;
    if (consent?.granted === true && typeof consent.version === 'string' && consent.version) consentFiles++;
    else if (STRICT) err(file, 'strict evidence requires versioned participant consent metadata');
    else warn(file, 'no versioned consent record; do not use this file for model release evidence');

    const assignment = corpus.splitAssignment;
    if (assignment?.deterministic === true && assignment.algorithm === SPLIT_ALGORITHM) {
      deterministicFiles++;
      const expected = assignedSplit(writerId);
      if (split !== expected) err(file, `deterministic split mismatch: writer maps to ${expected}, file says ${split}`);
    } else if (STRICT) {
      err(file, `strict evidence requires deterministic split assignment ${SPLIT_ALGORITHM}`);
    } else {
      warn(file, 'legacy manual split assignment; cross-device collection can conflict');
    }
  }

  if (sessionId) { if (sessions.has(sessionId)) err(file, `duplicate session id ${sessionId}`); sessions.add(sessionId); }
  if (writerId) {
    const row = writers.get(writerId) || { splits: new Set(), files: [], samples: 0 };
    if (split) row.splits.add(split); row.files.push(file); row.samples += Array.isArray(corpus.samples) ? corpus.samples.length : 0; writers.set(writerId, row);
  }

  if (!Array.isArray(corpus.samples) || !corpus.samples.length) { warn(file, 'contains no recorded samples'); continue; }

  for (const [sampleIndex, sample] of corpus.samples.entries()) {
    if (!String(sample.target ?? '').trim()) err(file, `sample ${sampleIndex} has no target`);
    if (!Array.isArray(sample.strokes) || !sample.strokes.length) { err(file, `sample ${sampleIndex} has no strokes`); continue; }
    samples++;
    if (sample.pen === true) pencilSamples++;
    else if (STRICT) err(file, `sample ${sampleIndex} is not Pencil-labelled; strict real-Pencil evidence is Pencil-only`);

    for (const [strokeIndex, stroke] of sample.strokes.entries()) {
      if (!Array.isArray(stroke.points) || !stroke.points.length) { err(file, `sample ${sampleIndex} stroke ${strokeIndex} has no points`); continue; }
      let lastT = -Infinity;
      for (const [pointIndex, point] of stroke.points.entries()) {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) { err(file, `sample ${sampleIndex} stroke ${strokeIndex} point ${pointIndex} has invalid x/y`); continue; }
        points++;
        if (Number.isFinite(point.t)) { timedPoints++; if (point.t < lastT) err(file, `sample ${sampleIndex} stroke ${strokeIndex} time goes backwards`); lastT = point.t; }
        if (Number.isFinite(point.p) || Number.isFinite(point.force) || Number.isFinite(point.azimuth) || Number.isFinite(point.altitude) || Number.isFinite(point.tiltX) || Number.isFinite(point.tiltY)) dynamicPoints++;
      }
    }
  }
}

for (const [writerId, row] of writers) if (row.splits.size > 1) errors.push(`writer ${writerId} leaks across splits: ${[...row.splits].join(', ')} (${row.files.join(', ')})`);

const timingCoverage = points ? timedPoints / points : 0;
const dynamicsCoverage = points ? dynamicPoints / points : 0;
if (STRICT && timingCoverage < 0.98) errors.push(`strict evidence requires >=98% point timing coverage; measured ${(100 * timingCoverage).toFixed(1)}%`);
if (STRICT && dynamicsCoverage < 0.98) errors.push(`strict evidence requires >=98% Pencil dynamics coverage; measured ${(100 * dynamicsCoverage).toFixed(1)}%`);
if (STRICT && pencilSamples !== samples) errors.push(`strict evidence is Pencil-only; ${pencilSamples}/${samples} samples are Pencil-labelled`);

console.log('\nReal-ink corpus integrity\n');
console.log(`  files: ${files.length}`);
console.log(`  stable writer ids observed: ${writers.size}`);
console.log(`  sessions: ${sessions.size}`);
console.log(`  samples: ${samples}`);
console.log(`  points: ${points}`);
console.log(`  timing coverage: ${(100 * timingCoverage).toFixed(1)}%`);
console.log(`  dynamics coverage: ${(100 * dynamicsCoverage).toFixed(1)}%`);
console.log(`  Pencil-labelled samples: ${pencilSamples}/${samples}`);
console.log(`  consent metadata: ${consentFiles}/${files} files`);
console.log(`  deterministic split metadata: ${deterministicFiles}/${files} files`);

if (warnings.length) { console.log('\nwarnings:'); for (const message of warnings) console.log(`  WARN ${message}`); }
if (errors.length) {
  console.log('\nerrors:'); for (const message of errors) console.log(`  FAIL ${message}`);
  console.log(`\nINK CORPUS AUDIT — FAIL (${errors.length} integrity error${errors.length === 1 ? '' : 's'})`); process.exit(1);
}
console.log('\nINK CORPUS AUDIT — PASS: consent, Pencil provenance and writer/session split isolation are valid');
