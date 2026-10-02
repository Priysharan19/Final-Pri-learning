// ─────────────────────────────────────────────────────────────────────────────
// Pri Ink · real-ink regression floor — regression check
//
// Proves the ratchet: the committed floor matches the committed corpus, a run
// below any recorded value fails the gate, a split mismatch is refused, the
// floor can never be written lower, and it is never written in CI.
//
// The pure comparison/ratchet functions are unit tested first (instant); then
// inkcheck-real.mjs is spawned twice against the real corpus (≈35 s each) so
// the exit codes of the real command are what is asserted.
// ─────────────────────────────────────────────────────────────────────────────
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_FLOOR_PATH, FLOOR_FORMAT, compareToFloor, ratchetFloor, readFloor, runningInCi } from './ink-real-floor.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'inkcheck-real.mjs');
let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

// ── 1 · the committed floor file ─────────────────────────────────────────────
ok(existsSync(DEFAULT_FLOOR_PATH), 'handwriting/v17/real-ink-floor.json exists');
const floor = readFloor(DEFAULT_FLOOR_PATH);
ok(floor.format === FLOOR_FORMAT && floor.evidenceClass === 'real-human', 'floor is labelled real-human');
ok(floor.split === 'train' && floor.writers === 1 && floor.lines === 50, 'floor records the one committed train-split writer (50 lines)');
ok(floor.exactPct === 64 && floor.charPct === 87.02 && floor.worstWriterExactPct === 64, `floor records the measured 64% / 87.02% / 64% (got ${floor.exactPct}/${floor.charPct}/${floor.worstWriterExactPct})`);
ok(/upward-only/.test(floor.ratchet) && /never written in CI/.test(floor.ratchet), 'floor states its own ratchet rule');
ok(/not a product accuracy claim/.test(floor.note), 'floor disclaims product-accuracy status');

// ── 2 · comparison ───────────────────────────────────────────────────────────
const measured = { split: 'train', writers: 1, lines: 50, exactLines: 32, exactPct: 64, charPct: 87.02, worstWriterExactPct: 64 };
ok(compareToFloor(measured, floor).ok, 'an equal measurement passes');
ok(compareToFloor({ ...measured, exactPct: 66, charPct: 88, worstWriterExactPct: 66 }, floor).ok, 'a better measurement passes');
for (const [key, value] of [['exactPct', 63.99], ['charPct', 87.01], ['worstWriterExactPct', 62]]) {
  const v = compareToFloor({ ...measured, [key]: value }, floor);
  ok(!v.ok && v.failures.some(f => f.startsWith(key)), `${key} below the floor fails`);
}
for (const [key, value] of [['writers', 0], ['lines', 49]]) {
  const v = compareToFloor({ ...measured, [key]: value }, floor);
  ok(!v.ok && v.failures.some(f => /real evidence was removed/.test(f)), `${key} shrinking underneath the floor fails`);
}
{
  const v = compareToFloor({ ...measured, split: 'test' }, floor);
  ok(!v.ok && /Comparison refused/.test(v.failures[0]), 'a different split is refused rather than compared');
  ok(!compareToFloor(measured, null).ok, 'a missing floor is a red gate');
}

// ── 3 · ratchet ──────────────────────────────────────────────────────────────
{
  const up = ratchetFloor(floor, { ...measured, exactPct: 70, charPct: 90.123, worstWriterExactPct: 70 }, { measuredAt: 't', commit: 'c' });
  ok(up.lowered.length === 0 && up.floor.exactPct === 70 && up.floor.charPct === 90.12, 'an improvement ratchets upward (rounded down to 2 dp)');
  const down = ratchetFloor(floor, { ...measured, charPct: 80 }, { measuredAt: 't' });
  ok(down.lowered.length === 1 && /charPct/.test(down.lowered[0]), 'a lower value is refused by the ratchet');
  const fewer = ratchetFloor(floor, { ...measured, lines: 40 }, { measuredAt: 't' });
  ok(fewer.lowered.some(l => /lines/.test(l)), 'fewer lines is refused by the ratchet');
  const first = ratchetFloor(null, measured, { measuredAt: 't' });
  ok(first.lowered.length === 0 && first.floor.format === FLOOR_FORMAT, 'first floor can be written from nothing');
  ok(runningInCi({ CI: 'true' }) && runningInCi({ GITHUB_ACTIONS: 'true' }) && !runningInCi({}), 'CI detection');
}

// ── 4 · the real command ─────────────────────────────────────────────────────
const tmp = mkdtempSync(join(tmpdir(), 'pri-real-floor-'));
try {
  const env = { ...process.env };
  delete env.CI; delete env.GITHUB_ACTIONS;

  // --write-floor is refused in CI before any file is touched.
  const ciFloor = join(tmp, 'ci-floor.json');
  const ci = spawnSync(process.execPath, [SCRIPT, '--write-floor', '--floor', ciFloor], { encoding: 'utf8', env: { ...env, CI: 'true' } });
  ok(ci.status === 1 && /never written in CI/.test(ci.stdout), `--write-floor under CI is refused (exit ${ci.status})`);
  ok(!existsSync(ciFloor), 'no floor file was written in CI');

  // A floor demanding more than the corpus delivers must fail the gate.
  const inflated = join(tmp, 'inflated.json');
  writeFileSync(inflated, JSON.stringify({ ...floor, exactPct: 99.5, charPct: 99.9, worstWriterExactPct: 99.5 }));
  const red = spawnSync(process.execPath, [SCRIPT, '--gate', '--floor', inflated], { encoding: 'utf8', env });
  ok(red.status === 1, `--gate below an inflated floor exits 1 (got ${red.status})`);
  ok(/REAL-INK FLOOR GATE — FAIL/.test(red.stdout) && /exactPct .* < floor 99\.50%/.test(red.stdout), 'gate names the metric that fell short');
  ok(/Do not lower the floor/.test(red.stdout), 'gate tells the reader not to lower the floor');
  ok(/REAL-INK SCORE — 64\.0% lines, 87\.0% chars, worst writer 64\.0%/.test(red.stdout), 'the score line still prints the measured numbers');

  // The committed floor against the committed corpus passes.
  const green = spawnSync(process.execPath, [SCRIPT, '--gate'], { encoding: 'utf8', env });
  ok(green.status === 0, `--gate against the committed floor exits 0 (got ${green.status})\n${green.stdout.slice(-600)}`);
  ok(/REAL-INK FLOOR GATE — PASS/.test(green.stdout), 'committed floor gate prints PASS');
  ok(JSON.stringify(readFloor(DEFAULT_FLOOR_PATH)) === JSON.stringify(floor), 'the gate never rewrites the floor');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (failures.length) {
  console.log(`INK REAL-INK FLOOR: FAIL — ${pass}/${pass + failures.length} checks`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`INK REAL-INK FLOOR: PASS — ${pass}/${pass} checks`);
