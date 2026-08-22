// ─────────────────────────────────────────────────────────────────────────────
// REAL-INK suite — handwriting produced by people, never synthetic templates.
//
// V2 evidence rules:
// - sessions are aggregated by stable anonymous writer id
// - one writer may belong to exactly one split
// - train/validation data are never used as the default headline score
// - final-holdout is only shown when explicitly requested
// - legacy v1 files remain readable but are labelled identity-unverified
//
// Usage:
//   node client/test/inkcheck-real.mjs [--strict] [--split test]
//   node client/test/inkcheck-real.mjs --split final-holdout
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recognize } from '../src/ink/recognizer.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(HERE, 'ink-corpus');
const STRICT = process.argv.includes('--strict');
const splitIndex = process.argv.indexOf('--split');
const REQUESTED_SPLIT = splitIndex >= 0 ? process.argv[splitIndex + 1] : null;
const VALID_SPLITS = new Set(['train', 'validation', 'test', 'final-holdout']);
if (REQUESTED_SPLIT && !VALID_SPLITS.has(REQUESTED_SPLIT)) {
  throw new Error(`unknown split ${REQUESTED_SPLIT}; use ${[...VALID_SPLITS].join(', ')}`);
}

const editDistance = (a, b) => {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
};

function loadCorpora() {
  if (!existsSync(CORPUS_DIR)) return [];
  return readdirSync(CORPUS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => {
      const raw = JSON.parse(readFileSync(join(CORPUS_DIR, f), 'utf8'));
      if (raw.format !== 'pri-ink-corpus') {
        throw new Error(`${f} is not a pri-ink-corpus file (format: ${raw.format})`);
      }
      return { file: f, ...raw };
    });
}

const allCorpora = loadCorpora();
if (!allCorpora.length) {
  console.log('\nReal-ink suite — no corpus recorded yet.\n');
  console.log('There is NO measured real-handwriting accuracy for this engine.');
  console.log('Use tools/ink-collect-v2/index.html, save the JSON files into');
  console.log('client/test/ink-corpus/, then run npm run test:ink:corpus first.\n');
  console.log('REAL-INK SCORE — none (no corpus)');
  process.exit(STRICT ? 1 : 0);
}

// Prove writer separation before scoring anything.
const writerSplits = new Map();
const integrityErrors = [];
for (const c of allCorpora) {
  const id = String(c.writer?.id || '').trim();
  if (!id) { integrityErrors.push(`${c.file}: missing writer.id`); continue; }
  const split = c.version >= 2 ? String(c.split || c.writer?.split || '').trim() : 'legacy-unverified';
  const set = writerSplits.get(id) || new Set();
  set.add(split);
  writerSplits.set(id, set);
}
for (const [id, splits] of writerSplits) {
  if (splits.size > 1) integrityErrors.push(`writer ${id} appears in multiple splits: ${[...splits].join(', ')}`);
}
if (integrityErrors.length) {
  console.log('\nREAL-INK SCORE — REFUSED: corpus integrity failed');
  for (const e of integrityErrors) console.log(`  FAIL ${e}`);
  process.exit(1);
}

const v2 = allCorpora.filter(c => Number(c.version || 1) >= 2);
let chosenSplit = REQUESTED_SPLIT;
if (!chosenSplit && v2.length) {
  const available = new Set(v2.map(c => c.split));
  // Test is the default evidence split. Validation is for threshold selection;
  // train is for fitting; final holdout must be requested intentionally so it
  // cannot become a dashboard people inspect after every tuning change.
  if (available.has('test')) chosenSplit = 'test';
  else if (available.has('validation')) chosenSplit = 'validation';
  else if (available.has('train')) chosenSplit = 'train';
}

let corpora;
if (chosenSplit) {
  corpora = allCorpora.filter(c => c.split === chosenSplit);
} else {
  corpora = allCorpora.filter(c => Number(c.version || 1) < 2);
}

if (!corpora.length) {
  console.log(`\nREAL-INK SCORE — none (no ${chosenSplit || 'legacy'} corpus files)`);
  process.exit(STRICT ? 1 : 0);
}

if (chosenSplit === 'train') {
  console.log('\nWARNING: scoring TRAIN data. This number is diagnostic only and must not be quoted as generalisation accuracy.');
}
if (chosenSplit === 'validation') {
  console.log('\nNOTE: scoring VALIDATION data. This may guide thresholds but is not final product evidence.');
}
if (chosenSplit === 'final-holdout') {
  const unlocked = corpora.filter(c => c.holdoutLocked !== true);
  if (unlocked.length) throw new Error(`final-holdout contains unlocked files: ${unlocked.map(c => c.file).join(', ')}`);
  console.log('\nFINAL HOLDOUT OPENED — do not tune the recognizer to these errors afterwards.');
}

let exact = 0, lines = 0, chars = 0, errs = 0;
const writerStats = new Map();
const misreads = [];
let fingerSamples = 0;
let timedPoints = 0, points = 0;

for (const c of corpora) {
  const writerId = String(c.writer?.id || 'unknown');
  const row = writerStats.get(writerId) || { id: writerId, exact: 0, lines: 0, chars: 0, errs: 0, pencil: 0, samples: 0 };

  for (const s of c.samples || []) {
    if (!s.strokes?.length) continue;
    const want = String(s.target).replace(/\s+/g, '');
    let got;
    try { got = recognize(s.strokes).text.replace(/\s+/g, ''); }
    catch (err) { got = `<threw:${err.message}>`; }

    lines++; row.lines++; row.samples++;
    if (s.pen === true) row.pencil++; else fingerSamples++;
    if (got === want) { exact++; row.exact++; }
    else if (misreads.length < 20) misreads.push(`${writerId} want "${want}"  got "${got}"`);

    chars += want.length; row.chars += want.length;
    const d = editDistance(want, got);
    errs += d; row.errs += d;

    for (const stroke of s.strokes) for (const p of stroke.points || []) {
      points++;
      if (Number.isFinite(p.t)) timedPoints++;
    }
  }
  writerStats.set(writerId, row);
}

if (!lines) {
  console.log('\nREAL-INK SCORE — none (selected corpus contains no strokes)');
  process.exit(STRICT ? 1 : 0);
}

const perWriter = [...writerStats.values()].map(w => ({
  ...w,
  exactPct: w.lines ? 100 * w.exact / w.lines : 0,
  charPct: w.chars ? 100 * (1 - w.errs / w.chars) : 0
})).sort((a, b) => a.id.localeCompare(b.id));

console.log(`\nReal ink · ${chosenSplit || 'legacy identity-unverified'} split\n`);
for (const p of perWriter) {
  console.log(`  ${p.id.padEnd(12)} ${String(p.exact).padStart(3)}/${String(p.lines).padEnd(3)} exact  chars ${p.charPct.toFixed(1)}%  pencil ${p.pencil}/${p.samples}`);
}

const exactPct = 100 * exact / lines;
const charPct = 100 * (1 - errs / chars);
const worstExact = Math.min(...perWriter.map(p => p.exactPct));
console.log(`\n  REAL INK   exact ${exact}/${lines} (${exactPct.toFixed(1)}%)   chars ${charPct.toFixed(1)}%`);
console.log(`  stable writers: ${perWriter.length}   worst writer: ${worstExact.toFixed(1)}% exact`);
console.log(`  timing coverage: ${points ? (100 * timedPoints / points).toFixed(1) : '0.0'}%`);
if (fingerSamples) console.log(`  finger-written samples: ${fingerSamples} — report separately from Apple Pencil evidence`);

if (misreads.length) {
  console.log('\nsample misreads:');
  for (const m of misreads) console.log('  ' + m);
}

console.log(`\nREAL-INK SCORE — ${exactPct.toFixed(1)}% lines, ${charPct.toFixed(1)}% chars, worst writer ${worstExact.toFixed(1)}%`);
if (perWriter.length < 8) {
  console.log(`\nNOTE: ${perWriter.length} stable writer(s) is too few for a product accuracy claim; target 8+ at minimum, substantially more for release evidence.`);
}
if (!v2.length) {
  console.log('\nWARNING: only legacy v1 corpora are present. Session-random ids cannot prove writer separation.');
}
