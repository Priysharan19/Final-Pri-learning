// PRI Ink real-writer release evidence gate.
//
// This is intentionally separate from ink-corpus-audit.mjs. The corpus audit
// answers "is this data trustworthy enough to use?"; this gate answers
// "is there enough writer-disjoint real-Pencil evidence to satisfy the
// measurable parts of Gate C in handwriting/v12/PRODUCTION_STANDARD.md?"
//
// It MUST fail on an undersized corpus. A green synthetic benchmark or one
// familiar writer is not release evidence.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recognize } from '../src/ink/recognizer.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(HERE, 'ink-corpus');
const TEST_SPLIT = 'test';

// Keep these aligned with handwriting/v12/PRODUCTION_STANDARD.md. Do not lower
// them to make a release pass.
const POLICY = Object.freeze({
  minTestWriters: 20,
  minTestExpressions: 1000,
  minExactPct: 98.0,
  minCharPct: 99.5,
  minWorstWriterExactPct: 90.0,
  minCriticalStructureExactPct: 99.5
});

const normalize = value => String(value ?? '').replace(/\s+/g, '');

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

// The recognizer's canonical strings preserve these layout-bearing constructs.
// This is deliberately conservative: if we cannot identify a sample as
// structure-bearing from its ground truth, it does not inflate this metric.
function isCriticalStructure(target) {
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

// Re-prove writer isolation here rather than trusting a prior command. Release
// evidence should be safe even when this script is invoked directly.
const writerSplits = new Map();
const seenFingerprints = new Map();
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

const testCorpora = corpora.filter(corpus => String(corpus.split || corpus.writer?.split || '') === TEST_SPLIT);
const writerStats = new Map();
let expressions = 0;
let exact = 0;
let chars = 0;
let charErrors = 0;
let critical = 0;
let criticalExact = 0;
let nonPencil = 0;
const misreads = [];

for (const corpus of testCorpora) {
  const writerId = String(corpus.writer?.id || '').trim();
  if (!writerId) continue;
  const row = writerStats.get(writerId) || { writerId, expressions: 0, exact: 0 };

  for (const [sampleIndex, sample] of (corpus.samples || []).entries()) {
    if (!sample?.strokes?.length || !normalize(sample.target)) continue;
    expressions++;
    row.expressions++;
    if (sample.pen !== true) nonPencil++;

    const want = normalize(sample.target);
    let result;
    let got = '';
    try {
      result = recognize(sample.strokes);
      got = normalize(result?.text);
    } catch (error) {
      got = `<threw:${error?.message || 'unknown'}>`;
    }

    const correct = got === want;
    if (correct) {
      exact++;
      row.exact++;
    } else if (misreads.length < 25) {
      misreads.push(`${writerId} ${corpus.file}#${sampleIndex}: want "${want}" got "${got}"`);
    }

    chars += want.length;
    charErrors += editDistance(want, got);
    if (isCriticalStructure(want)) {
      critical++;
      if (correct) criticalExact++;
    }
  }

  writerStats.set(writerId, row);
}

const perWriter = [...writerStats.values()].map(row => ({
  ...row,
  exactPct: row.expressions ? 100 * row.exact / row.expressions : 0
}));
const exactPct = expressions ? 100 * exact / expressions : 0;
const charPct = chars ? 100 * (1 - charErrors / chars) : 0;
const worstWriterExactPct = perWriter.length ? Math.min(...perWriter.map(row => row.exactPct)) : 0;
const criticalStructureExactPct = critical ? 100 * criticalExact / critical : 0;

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
if (!critical) {
  failures.push('no critical-structure test expressions were scored');
} else if (criticalStructureExactPct < POLICY.minCriticalStructureExactPct) {
  failures.push(`critical-structure exact ${criticalStructureExactPct.toFixed(2)}% < ${POLICY.minCriticalStructureExactPct.toFixed(1)}%`);
}

console.log('\nPRI Ink · real-writer test evidence\n');
console.log(`  test writers: ${perWriter.length}`);
console.log(`  scored test expressions: ${expressions}`);
console.log(`  exact expression accuracy: ${expressions ? exactPct.toFixed(2) : 'n/a'}%`);
console.log(`  character accuracy: ${chars ? charPct.toFixed(2) : 'n/a'}%`);
console.log(`  worst-writer exact: ${perWriter.length ? worstWriterExactPct.toFixed(2) : 'n/a'}%`);
console.log(`  critical-structure exact: ${critical ? criticalStructureExactPct.toFixed(2) : 'n/a'}% (${criticalExact}/${critical})`);
console.log(`  duplicate ink fingerprints: ${Math.max(0, [...failures].filter(f => f.startsWith('duplicate/derived')).length)}`);

if (misreads.length) {
  console.log('\nfirst misreads:');
  for (const misread of misreads) console.log(`  ${misread}`);
}

// Gate C also requires auto-mark precision among readings declared safe. This
// JS real-ink runner does not model the full native consensus/confirmation path,
// so it must never manufacture that number. The release standard remains
// partially unverified until native consensus evidence supplies it.
console.log('\n  auto-mark precision: NOT MEASURED HERE (requires native consensus/confirmation evidence)');

failList('release-evidence blockers:', failures);
if (failures.length) {
  console.log(`\nPRI INK REAL-WRITER RELEASE EVIDENCE — FAIL (${failures.length} blocker${failures.length === 1 ? '' : 's'})`);
  process.exit(1);
}

console.log('\nPRI INK REAL-WRITER RELEASE EVIDENCE — PASS (measurable Gate C subset)');
console.log('Native auto-mark precision must still be demonstrated before a production-ready claim.');
