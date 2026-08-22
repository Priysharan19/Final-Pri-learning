// ─────────────────────────────────────────────────────────────────────────────
// PRI real-ink corpus integrity audit
//
// Accuracy is meaningless if one human leaks into multiple dataset partitions.
// This gate validates identity/session/split metadata BEFORE any real-handwriting
// score is treated as evidence. It never infers identity from handwriting.
// Participant ids must be anonymous, stable codes assigned by the collection
// protocol — never names, emails or a new random id on every recording session.
//
// Usage:
//   node client/test/ink-corpus-audit.mjs
//   node client/test/ink-corpus-audit.mjs --strict
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, 'ink-corpus');
const STRICT = process.argv.includes('--strict');
const SPLITS = new Set(['train', 'validation', 'test', 'final-holdout']);

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
let samples = 0;
let points = 0;
let timedPoints = 0;
let dynamicPoints = 0;
let pencilSamples = 0;

const err = (file, message) => errors.push(`${file}: ${message}`);
const warn = (file, message) => warnings.push(`${file}: ${message}`);

for (const file of files) {
  let corpus;
  try {
    corpus = JSON.parse(readFileSync(join(DIR, file), 'utf8'));
  } catch (e) {
    err(file, `invalid JSON (${e.message})`);
    continue;
  }

  if (corpus.format !== 'pri-ink-corpus') {
    err(file, `format must be pri-ink-corpus, got ${JSON.stringify(corpus.format)}`);
    continue;
  }

  const version = Number(corpus.version || 1);
  const writerId = String(corpus.writer?.id || '').trim();
  const sessionId = String(corpus.writer?.sessionId || corpus.session?.id || '').trim();
  const split = String(corpus.split || corpus.writer?.split || '').trim();

  if (!writerId) err(file, 'missing anonymous stable writer.id');
  if (writerId && /@|\s{2,}|\.(com|edu|org)$/i.test(writerId)) {
    err(file, 'writer.id looks like personal/contact information; use an anonymous participant code');
  }

  // The v1 collector generated ids like w8f3k2a on every page load. Those ids
  // cannot prove writer separation, even if they look unique in the directory.
  if (version < 2) {
    warn(file, 'legacy corpus v1 cannot prove stable participant identity across sessions');
    if (STRICT) err(file, 'strict evidence requires corpus version >= 2');
  }

  if (version >= 2) {
    if (!sessionId) err(file, 'v2 corpus requires a unique writer.sessionId');
    if (!split || !SPLITS.has(split)) {
      err(file, `v2 corpus split must be one of ${[...SPLITS].join(', ')}`);
    }
    if (split === 'final-holdout' && corpus.holdoutLocked !== true) {
      err(file, 'final-holdout corpus must set holdoutLocked:true');
    }
    if (corpus.predictedTouchesStored === true) {
      err(file, 'predicted touches must never be stored as recognition/training ground truth');
    }
  }

  if (sessionId) {
    if (sessions.has(sessionId)) err(file, `duplicate session id ${sessionId}`);
    sessions.add(sessionId);
  }

  if (writerId) {
    const row = writers.get(writerId) || { splits: new Set(), files: [], samples: 0 };
    if (split) row.splits.add(split);
    row.files.push(file);
    row.samples += Array.isArray(corpus.samples) ? corpus.samples.length : 0;
    writers.set(writerId, row);
  }

  if (!Array.isArray(corpus.samples) || !corpus.samples.length) {
    warn(file, 'contains no recorded samples');
    continue;
  }

  for (const [sampleIndex, sample] of corpus.samples.entries()) {
    if (!String(sample.target ?? '').trim()) err(file, `sample ${sampleIndex} has no target`);
    if (!Array.isArray(sample.strokes) || !sample.strokes.length) {
      err(file, `sample ${sampleIndex} has no strokes`);
      continue;
    }
    samples++;
    if (sample.pen === true) pencilSamples++;

    for (const [strokeIndex, stroke] of sample.strokes.entries()) {
      if (!Array.isArray(stroke.points) || !stroke.points.length) {
        err(file, `sample ${sampleIndex} stroke ${strokeIndex} has no points`);
        continue;
      }
      let lastT = -Infinity;
      for (const [pointIndex, point] of stroke.points.entries()) {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
          err(file, `sample ${sampleIndex} stroke ${strokeIndex} point ${pointIndex} has invalid x/y`);
          continue;
        }
        points++;
        if (Number.isFinite(point.t)) {
          timedPoints++;
          if (point.t < lastT) {
            err(file, `sample ${sampleIndex} stroke ${strokeIndex} time goes backwards`);
          }
          lastT = point.t;
        }
        if (Number.isFinite(point.p) || Number.isFinite(point.force) ||
            Number.isFinite(point.az) || Number.isFinite(point.alt) ||
            Number.isFinite(point.tiltX) || Number.isFinite(point.tiltY)) {
          dynamicPoints++;
        }
      }
    }
  }
}

for (const [writerId, row] of writers) {
  if (row.splits.size > 1) {
    errors.push(`writer ${writerId} leaks across splits: ${[...row.splits].join(', ')} (${row.files.join(', ')})`);
  }
}

console.log('\nReal-ink corpus integrity\n');
console.log(`  files: ${files.length}`);
console.log(`  stable writer ids observed: ${writers.size}`);
console.log(`  sessions: ${sessions.size}`);
console.log(`  samples: ${samples}`);
console.log(`  points: ${points}`);
console.log(`  timing coverage: ${points ? (100 * timedPoints / points).toFixed(1) : '0.0'}%`);
console.log(`  dynamics coverage: ${points ? (100 * dynamicPoints / points).toFixed(1) : '0.0'}%`);
console.log(`  Pencil-labelled samples: ${pencilSamples}/${samples}`);

if (warnings.length) {
  console.log('\nwarnings:');
  for (const message of warnings) console.log(`  WARN ${message}`);
}

if (errors.length) {
  console.log('\nerrors:');
  for (const message of errors) console.log(`  FAIL ${message}`);
  console.log(`\nINK CORPUS AUDIT — FAIL (${errors.length} integrity error${errors.length === 1 ? '' : 's'})`);
  process.exit(1);
}

console.log('\nINK CORPUS AUDIT — PASS: no writer/session split leakage detected');
