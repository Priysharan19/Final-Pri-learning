// ─────────────────────────────────────────────────────────────────────────────
// Pri Ink · real-ink regression floor (ratchet, upward only)
//
// handwriting/v17/real-ink-floor.json records the real-handwriting accuracy
// the committed corpus actually measured on a reviewed commit. The floor is a
// regression guard, NOT a quality claim: 64% of lines on one writer is not
// product evidence, but it must never silently become 60% either.
//
// Rules:
//   - inkcheck-real.mjs --gate fails when a run scores below any recorded value
//     or when the corpus split/size shrinks underneath the floor;
//   - the file is only ever written by a person running --write-floor locally
//     after a reviewed improvement, never by CI (refused when CI/GITHUB_ACTIONS
//     is set);
//   - a write that would lower any value is refused: the ratchet only turns up.
//
// The comparison/ratchet logic is pure and exported so it can be regression
// tested without re-running the 35-second recogniser pass.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_FLOOR_PATH = join(HERE, '../../handwriting/v17/real-ink-floor.json');
export const FLOOR_FORMAT = 'pri-real-ink-floor';
const EPS = 1e-9;

/** Metrics the floor records and the gate compares. Higher is better for all. */
export const FLOOR_METRICS = Object.freeze(['exactPct', 'charPct', 'worstWriterExactPct']);
/** Corpus-size fields that may grow but never shrink underneath the floor. */
export const FLOOR_SIZES = Object.freeze(['writers', 'lines']);

const round2Down = v => Math.floor(Number(v) * 100 + EPS) / 100;

export function readFloor(path = DEFAULT_FLOOR_PATH) {
  if (!existsSync(path)) return null;
  const floor = JSON.parse(readFileSync(path, 'utf8'));
  if (floor?.format !== FLOOR_FORMAT) throw new Error(`${path} is not a ${FLOOR_FORMAT} file`);
  for (const key of [...FLOOR_METRICS, ...FLOOR_SIZES]) {
    if (!Number.isFinite(Number(floor[key]))) throw new Error(`${path}: ${key} must be a finite number`);
  }
  if (typeof floor.split !== 'string' || !floor.split) throw new Error(`${path}: split must be recorded`);
  return floor;
}

/**
 * measured: { split, writers, lines, exactPct, charPct, worstWriterExactPct }
 * Returns { ok, failures: string[] }. Any failure means the gate is red.
 */
export function compareToFloor(measured, floor) {
  const failures = [];
  if (!floor) return { ok: false, failures: ['no real-ink floor is recorded (handwriting/v17/real-ink-floor.json missing)'] };
  if (String(measured.split) !== String(floor.split)) {
    failures.push(`floor was recorded on the ${floor.split} split; this run scored ${measured.split}. Comparison refused.`);
    return { ok: false, failures };
  }
  for (const key of FLOOR_SIZES) {
    if (Number(measured[key]) < Number(floor[key])) {
      failures.push(`${key} ${measured[key]} < recorded ${floor[key]} (real evidence was removed)`);
    }
  }
  for (const key of FLOOR_METRICS) {
    if (Number(measured[key]) + EPS < Number(floor[key])) {
      failures.push(`${key} ${Number(measured[key]).toFixed(2)}% < floor ${Number(floor[key]).toFixed(2)}%`);
    }
  }
  return { ok: failures.length === 0, failures };
}

/**
 * Build the next floor from a measurement. Refuses (returns lowered list) when
 * any metric or size would go down relative to the previous floor.
 */
export function ratchetFloor(previous, measured, { measuredAt = new Date().toISOString(), commit = null } = {}) {
  const next = {
    format: FLOOR_FORMAT,
    version: 1,
    evidenceClass: 'real-human',
    ratchet: 'upward-only. Written by a person with `node client/test/inkcheck-real.mjs --write-floor` after a reviewed improvement; never written in CI; never lowered.',
    split: String(measured.split),
    writers: Number(measured.writers),
    lines: Number(measured.lines),
    exactLines: Number(measured.exactLines),
    exactPct: round2Down(measured.exactPct),
    charPct: round2Down(measured.charPct),
    worstWriterExactPct: round2Down(measured.worstWriterExactPct),
    measuredAt,
    commit,
    note: 'Regression floor only. One writer on the train split is diagnostic evidence, not a product accuracy claim (Gate C needs >= 20 writer-disjoint test writers and >= 1,000 expressions).'
  };
  const lowered = [];
  if (previous) {
    if (previous.split !== next.split) lowered.push(`split ${previous.split} -> ${next.split}`);
    for (const key of [...FLOOR_SIZES, ...FLOOR_METRICS]) {
      if (Number(next[key]) + EPS < Number(previous[key])) lowered.push(`${key} ${previous[key]} -> ${next[key]}`);
    }
  }
  return { floor: next, lowered };
}

export function writeFloor(floor, path = DEFAULT_FLOOR_PATH) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(floor, null, 2) + '\n');
}

export function runningInCi(env = process.env) {
  return String(env.CI || '').trim() !== '' || String(env.GITHUB_ACTIONS || '').trim() !== '';
}
