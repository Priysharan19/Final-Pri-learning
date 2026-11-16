// PRI Ink real-writer release evidence gate (Gate C, server reader).
//
// This is intentionally separate from ink-corpus-audit.mjs. The corpus audit
// answers "is this data trustworthy enough to use?"; this gate answers
// "is there enough writer-disjoint real-Pencil evidence that the reader that
// SHIPS satisfies the measurable parts of Gate C in
// handwriting/v12/PRODUCTION_STANDARD.md?"
//
// The reader that ships is the server reader (client/src/ink/cloudReader.js →
// /v1/handwriting/transcribe → server/platform/handwritingProvider.js). It is
// scored by tools/ink-cloud-reader-eval.mjs, which draws every committed real
// Pencil sample with the production painter, sends the picture to the real
// provider, and writes a record under handwriting/v17/cloud-reader-eval/ with
// one row per read. This gate re-derives the Gate C figures from those rows
// and the committed corpus; it never calls a provider and never scores the
// retired on-device recogniser (owner decision 2026-10-02; default D16).
//
// It MUST fail on an undersized corpus, on a missing or synthetic record, and
// on a record about samples the corpus does not hold. A green synthetic
// benchmark, a dry run or one familiar writer is not release evidence.
//
// Usage:
//   node client/test/ink-release-evidence-gate.mjs
//   node client/test/ink-release-evidence-gate.mjs --corpus <dir> --eval-dir <dir>

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const argAfter = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback; };
const CORPUS_DIR = resolve(argAfter('--corpus', join(HERE, 'ink-corpus')));
const EVAL_DIR = resolve(argAfter('--eval-dir', join(HERE, '../../handwriting/v17/cloud-reader-eval')));
const TEST_SPLIT = 'test';
export const EVAL_FORMAT = 'pri-cloud-reader-eval';

// Keep these aligned with handwriting/v12/PRODUCTION_STANDARD.md. Do not lower
// them to make a release pass.
export const POLICY = Object.freeze({
  minTestWriters: 20,
  minTestExpressions: 1000,
  minExactPct: 98.0,
  minCharPct: 99.5,
  minWorstWriterExactPct: 90.0,
  minCriticalStructureExactPct: 99.5,
  // Auto-mark precision among reads the server declares safe (not flagged for
  // confirmation and at or above the provider confidence floor), over at least
  // this many such decisions before the number means anything.
  minSafeAutoDecisions: 1000,
  minSafeAutoPrecisionPct: 99.9
});

const normalize = value => String(value ?? '').normalize('NFKC').replace(/[−–—]/g, '-').replace(/\s+/g, '');

function editDistance(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[n];
}

// Canonical prompt strings preserve these layout-bearing constructs. This is
// deliberately conservative: if we cannot identify a sample as
// structure-bearing from its ground truth, it does not inflate this metric.
export function isCriticalStructure(target) {
  return /\^\(|sqrt\(|\)\/\(|<=|>=|!=|=|∫|Σ|\b(?:sin|cos|tan|log|ln)\b/.test(target);
}

function sampleFingerprint(sample) {
  // Detect copied/derived samples without treating two genuine attempts at the
  // same prompt as duplicates. Coordinates are rounded only past sensor-level
  // noise; stroke order and point order remain part of the identity.
  const canonical = {
    target: normalize(sample.target),
    strokes: (sample.strokes || []).map(stroke => (stroke.points || []).map(p => [
      Number.isFinite(p.x) ? Math.round(p.x * 1000) / 1000 : null,
      Number.isFinite(p.y) ? Math.round(p.y * 1000) / 1000 : null
    ]))
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function loadCorpora() {
  if (!existsSync(CORPUS_DIR)) return [];
  return readdirSync(CORPUS_DIR)
    .filter(name => name.endsWith('.json'))
    .sort()
    .map(file => ({ file, ...JSON.parse(readFileSync(join(CORPUS_DIR, file), 'utf8')) }));
}

function loadEvaluations() {
  if (!existsSync(EVAL_DIR)) return [];
  return readdirSync(EVAL_DIR)
    .filter(name => name.endsWith('.json') && !name.startsWith('.'))
    .sort()
    .map(file => {
      try { return { file, ...JSON.parse(readFileSync(join(EVAL_DIR, file), 'utf8')) }; }
      catch (error) { return { file, parseError: error.message }; }
    });
}

function failList(title, failures) {
  if (!failures.length) return;
  console.log(`\n${title}`);
  for (const failure of failures) console.log(`  FAIL ${failure}`);
}

const corpora = loadCorpora();
const failures = [];

if (!corpora.length) {
  console.log('\nPRI INK REAL-WRITER RELEASE EVIDENCE — FAIL');
  console.log('  No real Apple Pencil corpus is committed.');
  process.exit(1);
}

// ── 1 · the corpus: writer isolation and no derived ink ─────────────────────
// Re-prove writer isolation here rather than trusting a prior command. Release
// evidence should be safe even when this script is invoked directly.
const writerSplits = new Map();
const seenFingerprints = new Map();
const testWriterIds = new Set();
const testSamplesByWriter = new Map();   // writer → Map(index key → sample)
for (const corpus of corpora) {
  if (corpus.format !== 'pri-ink-corpus') {
    failures.push(`${corpus.file}: unexpected format ${JSON.stringify(corpus.format)}`);
    continue;
  }
  const writerId = String(corpus.writer?.id || '').trim();
  const split = String(corpus.split || corpus.writer?.split || '').trim();
  if (!writerId) failures.push(`${corpus.file}: missing writer.id`);
  if (writerId) {
    const splits = writerSplits.get(writerId) || new Set();
    splits.add(split);
    writerSplits.set(writerId, splits);
    if (split === TEST_SPLIT) {
      testWriterIds.add(writerId);
      const byIndex = testSamplesByWriter.get(writerId) || new Map();
      for (const [sampleIndex, sample] of (corpus.samples || []).entries()) {
        if (!sample?.strokes?.length || !normalize(sample.target)) continue;
        byIndex.set(`${corpus.file}#${sampleIndex}`, sample);
      }
      testSamplesByWriter.set(writerId, byIndex);
    }
  }

  for (const [sampleIndex, sample] of (corpus.samples || []).entries()) {
    if (!sample?.strokes?.length) continue;
    const fingerprint = sampleFingerprint(sample);
    const previous = seenFingerprints.get(fingerprint);
    const current = `${corpus.file}#${sampleIndex} (${writerId || 'unknown'}/${split || 'unknown'})`;
    if (previous) {
      failures.push(`duplicate/derived ink detected: ${previous} and ${current}`);
    } else {
      seenFingerprints.set(fingerprint, current);
    }
  }
}

for (const [writerId, splits] of writerSplits) {
  if (splits.size > 1) failures.push(`writer ${writerId} leaks across splits: ${[...splits].join(', ')}`);
}

const committedTestExpressions = [...testSamplesByWriter.values()].reduce((n, m) => n + m.size, 0);

// ── 2 · the server-reader evaluation record on the test split ───────────────
const evaluations = loadEvaluations();
for (const record of evaluations) {
  if (record.parseError) failures.push(`${record.file}: invalid JSON (${record.parseError})`);
  else if (record.evidenceClass !== 'real-human') failures.push(`${record.file}: evidenceClass ${JSON.stringify(record.evidenceClass)} may not live under the real-human evaluation directory`);
  else if (record.format !== EVAL_FORMAT) failures.push(`${record.file}: unexpected format ${JSON.stringify(record.format)}`);
  else if (/fake/i.test(String(record.provider?.kind || ''))) failures.push(`${record.file}: a fake provider is not evidence`);
}
const candidates = evaluations.filter(r => !r.parseError && r.format === EVAL_FORMAT && r.evidenceClass === 'real-human'
  && !/fake/i.test(String(r.provider?.kind || '')) && String(r.corpus?.split || '') === TEST_SPLIT);
candidates.sort((a, b) => String(a.measuredAt || '').localeCompare(String(b.measuredAt || '')));
const record = candidates[candidates.length - 1] || null;

let expressions = 0;
let exact = 0;
let chars = 0;
let charErrors = 0;
let critical = 0;
let criticalExact = 0;
let nonPencil = 0;
let providerErrors = 0;
let safe = 0;
let safeExact = 0;
const writerStats = new Map();
const misreads = [];

if (!record) {
  failures.push(`no server-reader evaluation of the ${TEST_SPLIT} split under ${EVAL_DIR} (run tools/ink-cloud-reader-eval.mjs with the server's key; the result is real-human evidence only when the corpus is)`);
} else {
  const rows = Array.isArray(record.rows) ? record.rows : null;
  if (!rows) failures.push(`${record.file}: carries no per-sample rows; re-run tools/ink-cloud-reader-eval.mjs (summary-only records cannot be re-scored)`);
  const floor = Number(record.provider?.confidenceFloor);
  if (!Number.isFinite(floor) || floor <= 0 || floor > 1) failures.push(`${record.file}: provider.confidenceFloor must be the server's floor in (0, 1]`);
  for (const file of record.corpus?.files || []) {
    if (!corpora.some(c => c.file === file)) failures.push(`${record.file}: scores ${file}, which is not a committed corpus file`);
  }
  const seenRows = new Set();
  for (const [i, row] of (rows || []).entries()) {
    const writerId = String(row?.writer || '').trim();
    if (!testWriterIds.has(writerId)) {
      failures.push(`${record.file}: row ${i} is by writer ${JSON.stringify(writerId)}, who is not a committed ${TEST_SPLIT}-split writer`);
      continue;
    }
    const key = `${writerId}:${row.file ?? ''}#${row.index ?? i}`;
    if (seenRows.has(key)) { failures.push(`${record.file}: row ${i} repeats ${key}; a read cannot be counted twice`); continue; }
    seenRows.add(key);
    const want = normalize(row.want);
    if (!want) continue;
    // The record must describe ink the corpus holds: the same prompt text for
    // the same writer's sample.
    const committed = row.file != null && row.index != null ? testSamplesByWriter.get(writerId)?.get(`${row.file}#${row.index}`) : null;
    if (committed && normalize(committed.target) !== want) {
      failures.push(`${record.file}: row ${i} target "${want}" differs from the committed sample ${row.file}#${row.index} ("${normalize(committed.target)}")`);
      continue;
    }
    if (committed && committed.pen !== true) nonPencil++;
    else if (!committed && row.pen !== true) nonPencil++;
    const stats = writerStats.get(writerId) || { writerId, expressions: 0, exact: 0 };
    expressions++;
    stats.expressions++;
    const got = row.error ? '' : normalize(row.got);
    if (row.error) providerErrors++;
    const correct = !row.error && got === want;
    if (correct) { exact++; stats.exact++; }
    else if (misreads.length < 25) misreads.push(`${writerId} ${row.file ?? '?'}#${row.index ?? i}: want "${want}" got "${row.error ? `<error:${row.error}>` : got}"`);
    chars += want.length;
    charErrors += editDistance(want, got);
    if (isCriticalStructure(want)) {
      critical++;
      if (correct) criticalExact++;
    }
    // Reads the server would hand to the marker without asking the student.
    if (!row.error && row.needsConfirmation !== true && Number(row.confidence) >= floor) {
      safe++;
      if (correct) safeExact++;
    }
    writerStats.set(writerId, stats);
  }
  // A record that silently dropped committed test samples would inflate every
  // figure above: every committed test expression must have a row.
  if (rows && expressions < committedTestExpressions) {
    failures.push(`${record.file}: scores ${expressions} of the ${committedTestExpressions} committed ${TEST_SPLIT} expressions; a partial run is not release evidence`);
  }
}

const perWriter = [...writerStats.values()].map(row => ({
  ...row,
  exactPct: row.expressions ? 100 * row.exact / row.expressions : 0
}));
const exactPct = expressions ? 100 * exact / expressions : 0;
const charPct = chars ? 100 * (1 - charErrors / chars) : 0;
const worstWriterExactPct = perWriter.length ? Math.min(...perWriter.map(row => row.exactPct)) : 0;
const criticalStructureExactPct = critical ? 100 * criticalExact / critical : 0;
const safePrecisionPct = safe ? 100 * safeExact / safe : 0;

if (perWriter.length < POLICY.minTestWriters) {
  failures.push(`test writers ${perWriter.length}/${POLICY.minTestWriters} minimum`);
}
if (expressions < POLICY.minTestExpressions) {
  failures.push(`test expressions ${expressions}/${POLICY.minTestExpressions} minimum`);
}
if (nonPencil > 0) failures.push(`${nonPencil} scored test expression(s) are not Pencil-labelled`);
if (expressions && exactPct < POLICY.minExactPct) failures.push(`exact ${exactPct.toFixed(2)}% < ${POLICY.minExactPct.toFixed(1)}%`);
if (chars && charPct < POLICY.minCharPct) failures.push(`character accuracy ${charPct.toFixed(2)}% < ${POLICY.minCharPct.toFixed(1)}%`);
if (perWriter.length && worstWriterExactPct < POLICY.minWorstWriterExactPct) {
  failures.push(`worst-writer exact ${worstWriterExactPct.toFixed(2)}% < ${POLICY.minWorstWriterExactPct.toFixed(1)}%`);
}
if (record && !critical) {
  failures.push('no critical-structure test expressions were scored');
} else if (critical && criticalStructureExactPct < POLICY.minCriticalStructureExactPct) {
  failures.push(`critical-structure exact ${criticalStructureExactPct.toFixed(2)}% < ${POLICY.minCriticalStructureExactPct.toFixed(1)}%`);
}
if (record && safe < POLICY.minSafeAutoDecisions) {
  failures.push(`safe-auto precision requires >=${POLICY.minSafeAutoDecisions} reads the server declared safe; measured ${safe}`);
} else if (safe && safePrecisionPct < POLICY.minSafeAutoPrecisionPct) {
  failures.push(`safe-auto precision ${safePrecisionPct.toFixed(3)}% < ${POLICY.minSafeAutoPrecisionPct.toFixed(1)}%`);
}

console.log('\nPRI Ink · real-writer test evidence · server reader\n');
console.log(`  evaluation record: ${record ? `${record.file} (${record.provider?.kind || 'provider'} ${record.provider?.primaryModel || ''}, measured ${record.measuredAt || '?'})` : 'none'}`);
console.log(`  test writers: ${perWriter.length}`);
console.log(`  scored test expressions: ${expressions}${providerErrors ? ` (${providerErrors} provider error(s), counted as misreads)` : ''}`);
console.log(`  exact expression accuracy: ${expressions ? exactPct.toFixed(2) : 'n/a'}%`);
console.log(`  character accuracy: ${chars ? charPct.toFixed(2) : 'n/a'}%`);
console.log(`  worst-writer exact: ${perWriter.length ? worstWriterExactPct.toFixed(2) : 'n/a'}%`);
console.log(`  critical-structure exact: ${critical ? criticalStructureExactPct.toFixed(2) : 'n/a'}% (${criticalExact}/${critical})`);
console.log(`  safe-auto precision: ${safe ? safePrecisionPct.toFixed(3) : 'n/a'}% (${safeExact}/${safe} reads at/above the server floor, not flagged)`);
console.log(`  duplicate ink fingerprints: ${Math.max(0, [...failures].filter(f => f.startsWith('duplicate/derived')).length)}`);

if (misreads.length) {
  console.log('\nfirst misreads:');
  for (const misread of misreads) console.log(`  ${misread}`);
}

failList('release-evidence blockers:', failures);
if (failures.length) {
  console.log(`\nPRI INK REAL-WRITER RELEASE EVIDENCE — FAIL (${failures.length} blocker${failures.length === 1 ? '' : 's'})`);
  process.exit(1);
}

console.log('\nPRI INK REAL-WRITER RELEASE EVIDENCE — PASS (measurable Gate C subset, server reader)');
console.log('Physical-device auto-mark precision and server-read latency are measured by ink-physical-release-evidence.mjs --strict.');
