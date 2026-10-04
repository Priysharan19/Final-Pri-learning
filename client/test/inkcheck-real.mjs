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
//   node client/test/inkcheck-real.mjs --gate            # fail below handwriting/v17/real-ink-floor.json
//   node client/test/inkcheck-real.mjs --write-floor     # person-only ratchet of that floor (refused in CI)
//   node client/test/inkcheck-real.mjs --gate --floor /path/to/floor.json
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { recognize } from '../src/ink/recognizer.js';
import {
  DEFAULT_FLOOR_PATH, compareToFloor, ratchetFloor, readFloor, runningInCi, writeFloor
} from './ink-real-floor.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(HERE, 'ink-corpus');
const STRICT = process.argv.includes('--strict');
const GATE = process.argv.includes('--gate');
const WRITE_FLOOR = process.argv.includes('--write-floor');
const floorIndex = process.argv.indexOf('--floor');
const FLOOR_PATH = floorIndex >= 0 && process.argv[floorIndex + 1] ? process.argv[floorIndex + 1] : DEFAULT_FLOOR_PATH;
// An empty or unscored corpus is a red gate, never a quiet pass.
const EMPTY_EXIT = (STRICT || GATE || WRITE_FLOOR) ? 1 : 0;
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
  process.exit(EMPTY_EXIT);
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
  process.exit(EMPTY_EXIT);
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
  process.exit(EMPTY_EXIT);
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

// ── regression floor (ratchet) ───────────────────────────────────────────────
if (GATE || WRITE_FLOOR) {
  const measured = {
    split: chosenSplit || 'legacy',
    writers: perWriter.length,
    lines,
    exactLines: exact,
    exactPct,
    charPct,
    worstWriterExactPct: worstExact
  };
  let floor = null;
  try { floor = readFloor(FLOOR_PATH); }
  catch (err) { console.log(`\nREAL-INK FLOOR GATE — FAIL\n  FAIL ${err.message}`); process.exit(1); }

  if (WRITE_FLOOR) {
    if (runningInCi()) {
      console.log('\nREAL-INK FLOOR — REFUSED: the floor is never written in CI. Run --write-floor locally after a reviewed improvement.');
      process.exit(1);
    }
    let commit = null;
    try { commit = execSync('git rev-parse HEAD', { cwd: HERE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* no git */ }
    const { floor: next, lowered } = ratchetFloor(floor, measured, { commit });
    if (lowered.length) {
      console.log('\nREAL-INK FLOOR — REFUSED: the ratchet only turns upward');
      for (const l of lowered) console.log(`  FAIL ${l}`);
      process.exit(1);
    }
    writeFloor(next, FLOOR_PATH);
    console.log(`\nREAL-INK FLOOR — WRITTEN ${FLOOR_PATH}`);
    console.log(`  ${next.split} split · ${next.writers} writer(s) · ${next.lines} lines · exact ${next.exactPct}% · chars ${next.charPct}% · worst ${next.worstWriterExactPct}%`);
  }

  if (GATE) {
    const verdict = compareToFloor(measured, floor);
    if (!verdict.ok) {
      console.log('\nREAL-INK FLOOR GATE — FAIL');
      for (const f of verdict.failures) console.log(`  FAIL ${f}`);
      console.log('  Do not lower the floor. Fix the recogniser or restore the evidence.');
      process.exit(1);
    }
    console.log(`\nREAL-INK FLOOR GATE — PASS (floor ${floor.split}: exact ${floor.exactPct}%, chars ${floor.charPct}%, worst ${floor.worstWriterExactPct}% · measured exact ${exactPct.toFixed(2)}%, chars ${charPct.toFixed(2)}%, worst ${worstExact.toFixed(2)}%)`);
  }
}
