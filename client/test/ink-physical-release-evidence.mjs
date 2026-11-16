#!/usr/bin/env node
// Pri Ink · physical Apple Pencil production evidence gate (server reader)
//
// This file scores results captured from the ACTUAL production reading and
// authority path on physical iPads: PencilKit strokes on the device, the
// picture read by the SERVER reader (client/src/ink/cloudReader.js →
// /v1/handwriting/transcribe), the confirmation boundary the card applies, and
// the round-trip time InkAnswer measured for that read. It does not
// manufacture handwriting data. With no result files, normal mode reports NOT
// MEASURED and strict mode fails.
//
// The on-device readers (Vision, Core ML foundation, the JS recogniser) are
// retired from the shipped path (owner decision 2026-10-02, confirmed as
// default D16 on 2026-11-01). A sample whose engine names one of them is not
// production evidence and is refused here.
//
// Usage:
//   node client/test/ink-physical-release-evidence.mjs
//   node client/test/ink-physical-release-evidence.mjs --strict
//   node client/test/ink-physical-release-evidence.mjs --strict --split final-holdout
//   node client/test/ink-physical-release-evidence.mjs --dir /path/to/results

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.resolve(HERE, '../../handwriting/v12/evidence/physical');
const STRICT = process.argv.includes('--strict');

function argAfter(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const RESULTS_DIR = path.resolve(argAfter('--dir', DEFAULT_DIR));
const SPLIT = argAfter('--split', 'test');
const VALID_SPLITS = new Set(['train', 'validation', 'test', 'final-holdout']);
if (!VALID_SPLITS.has(SPLIT)) throw new Error(`invalid --split ${SPLIT}`);

/** The evidence schema this scorer accepts. Version 1 described the retired
 * on-device consensus reader and its 500 ms on-device latency; no version-1
 * file was ever collected, and none is accepted. */
export const PHYSICAL_EVIDENCE_SCHEMA_VERSION = 2;
/** Engine labels the server reader returns start with this
 * (client/src/ink/cloudReader.js CLOUD_ENGINE_PREFIX, pinned by
 * client/test/ink-production-evidence-capture-check.mjs). */
export const SERVER_ENGINE_PREFIX = 'cloud';
/** Labels of readers no student reaches. Evidence from them is refused. */
export const RETIRED_READER = /vision|foundation|native-rescue|native-primary|pri-js|consensus|pri-ink-v|line-stroke-fusion/i;

export const PHYSICAL_RELEASE_FLOORS = Object.freeze({
  writers: 20,
  expressions: 1000,
  exact: 0.98,
  char: 0.995,
  worstWriter: 0.90,
  criticalExact: 0.995,
  // A single lucky auto-mark is not evidence of 99.9% precision. The release
  // gate therefore requires at least the same order of authority decisions as
  // the overall expression corpus before quoting the auto-mark number.
  autoMarkDecisions: 1000,
  autoMarkPrecision: 0.999,
  criticalExpressions: 200,
  deviceModels: 2,
  // Server read, device to device: the round trip InkAnswer measures from the
  // press of "Read my answer" to the transcription landing, on the device's own
  // network. This replaces the retired on-device target of 500 ms, which a
  // network reader can never meet. 4 000 ms is the product's existing
  // end-to-end latency budget (docs/operations/alerts.md §2a: ink submitted →
  // mark shown under 4 s at p95; HANDWRITING_LATENCY_P95 warns at 4 s).
  // Recorded as a default pending the owner's confirmation
  // (V1_DECISIONS_2026-11-01.md D16 addendum); it may be tightened, never
  // loosened, without a recorded decision.
  serverReadP95Ms: 4000
});

const errors = [];
const warnings = [];
const fail = msg => errors.push(msg);
const warn = msg => warnings.push(msg);
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = v => Number.isFinite(Number(v));
const canonicalWriter = s => String(s || '').trim().toUpperCase();

function normalizeMath(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[−–—]/g, '-')
    .replace(/\s+/g, '');
}

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

function p95(values) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return Infinity;
  return clean[Math.max(0, Math.ceil(0.95 * clean.length) - 1)];
}

function looksCritical(target) {
  const t = normalizeMath(target);
  return /\^|\/|sqrt\(|[=<>]|!=|<=|>=|\n/.test(t);
}

/** Why a sample's engine is not the shipped server reader, or null. */
export function engineProblem(engine) {
  const label = String(engine || '').trim();
  if (!label) return 'missing production engine label';
  if (RETIRED_READER.test(label)) return `engine "${label}" is a retired on-device reader, not the shipped server reader`;
  if (!label.toLowerCase().startsWith(SERVER_ENGINE_PREFIX)) return `engine "${label}" is not a server-reader label (expected "${SERVER_ENGINE_PREFIX}…")`;
  return null;
}

function validateRun(raw, file) {
  const label = path.basename(file);
  if (!isObj(raw)) { fail(`${label}: root must be an object`); return null; }
  if (raw.schemaVersion !== PHYSICAL_EVIDENCE_SCHEMA_VERSION) {
    fail(`${label}: schemaVersion must be ${PHYSICAL_EVIDENCE_SCHEMA_VERSION} (server-reader evidence); got ${JSON.stringify(raw.schemaVersion)}`);
  }
  if (raw.physicalHardware !== true) fail(`${label}: physicalHardware must be true`);
  if (raw.reader !== 'server') fail(`${label}: reader must be "server" (the only reader in the student path)`);
  if (typeof raw.runId !== 'string' || !raw.runId.trim()) fail(`${label}: missing runId`);
  if (typeof raw.recordedAt !== 'string' || Number.isNaN(Date.parse(raw.recordedAt))) fail(`${label}: recordedAt must be ISO-8601`);

  if (!isObj(raw.build) || !/^[0-9a-f]{7,40}$/i.test(raw.build?.commit || '')) {
    fail(`${label}: build.commit must be a Git commit SHA`);
  }
  if (!isObj(raw.device)) fail(`${label}: missing device`);
  for (const key of ['model', 'osVersion', 'pencil']) {
    if (typeof raw.device?.[key] !== 'string' || !raw.device[key].trim()) fail(`${label}: missing device.${key}`);
  }
  const hardware = `${raw.device?.model || ''} ${raw.device?.pencil || ''}`.toLowerCase();
  if (hardware.includes('simulator')) fail(`${label}: simulator data cannot be physical-Pencil evidence`);

  if (!isObj(raw.writer)) fail(`${label}: missing writer object`);
  const writerId = canonicalWriter(raw.writer?.id);
  if (!writerId) fail(`${label}: missing anonymous writer.id`);
  if (/@|\s|\.(com|edu|org)$/i.test(writerId)) fail(`${label}: writer.id looks like personal/contact information`);
  const split = String(raw.writer?.split || '').trim();
  if (!VALID_SPLITS.has(split)) fail(`${label}: writer.split must be train/validation/test/final-holdout`);
  if (split === 'final-holdout' && raw.writer?.holdoutLocked !== true) {
    fail(`${label}: final-holdout evidence must set writer.holdoutLocked:true`);
  }

  if (!Array.isArray(raw.samples) || !raw.samples.length) fail(`${label}: samples must be a non-empty array`);
  const seen = new Set();
  for (const [i, s] of (raw.samples || []).entries()) {
    const prefix = `${label}: sample ${i}`;
    if (!isObj(s)) { fail(`${prefix} must be an object`); continue; }
    if (typeof s.id !== 'string' || !s.id.trim()) fail(`${prefix}: missing id`);
    if (seen.has(s.id)) fail(`${prefix}: duplicate id ${s.id}`);
    seen.add(s.id);
    if (typeof s.target !== 'string' || !s.target.trim()) fail(`${prefix}: missing target`);
    if (typeof s.recognized !== 'string') fail(`${prefix}: recognized must be a string (empty only for abstain)`);
    if (!['auto', 'confirm', 'abstain'].includes(s.authority)) fail(`${prefix}: authority must be auto/confirm/abstain`);
    if (s.authority === 'auto' && !String(s.recognized || '').trim()) fail(`${prefix}: auto authority cannot have an empty reading`);
    if (s.pencil !== true) fail(`${prefix}: physical release evidence is Apple Pencil-only`);
    if (s.reader !== 'server') fail(`${prefix}: reader must be "server"`);
    if (!finite(s.recognitionMs) || Number(s.recognitionMs) < 0) fail(`${prefix}: recognitionMs (server read round trip) must be a non-negative number`);
    const engine = engineProblem(s.engine);
    if (engine) fail(`${prefix}: ${engine}`);
    if (s.researchOnly === true) fail(`${prefix}: researchOnly readings cannot count as production evidence`);
    if (s.productionReady === false) fail(`${prefix}: productionReady:false cannot count as production evidence`);
  }

  return { ...raw, writer: { ...raw.writer, id: writerId, split } };
}

let files = [];
if (fs.existsSync(RESULTS_DIR)) {
  files = fs.readdirSync(RESULTS_DIR)
    .filter(name => name.endsWith('.json') && !name.startsWith('.'))
    .map(name => path.join(RESULTS_DIR, name))
    .sort();
}

if (!files.length) {
  console.log(`\nPRI INK PHYSICAL RELEASE EVIDENCE — NOT MEASURED`);
  console.log(`No physical result JSON files found in ${RESULTS_DIR}`);
  console.log('Collect anonymised real Apple Pencil runs of the server reader using handwriting/v12/REAL_PENCIL_RELEASE_EVIDENCE.md.\n');
  process.exit(STRICT ? 1 : 0);
}

const runs = [];
for (const file of files) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const run = validateRun(raw, file);
    if (run) runs.push(run);
  } catch (e) {
    fail(`${path.basename(file)}: invalid JSON (${e.message})`);
  }
}

// Writer leakage and repeated-sample checks are global, not per file.
const writerSplits = new Map();
const sampleKeys = new Set();
const runIds = new Set();
for (const run of runs) {
  if (runIds.has(run.runId)) fail(`duplicate runId ${run.runId}`);
  runIds.add(run.runId);
  const ws = writerSplits.get(run.writer.id) || new Set();
  ws.add(run.writer.split);
  writerSplits.set(run.writer.id, ws);
  for (const s of run.samples || []) {
    const key = `${run.writer.id}:${String(s.id || '').trim()}`;
    if (sampleKeys.has(key)) fail(`duplicate physical sample ${key}; repeated evidence cannot be counted twice`);
    sampleKeys.add(key);
  }
}
for (const [writer, splits] of writerSplits) {
  if (splits.size > 1) fail(`writer ${writer} leaks across splits: ${[...splits].join(', ')}`);
}

const selected = runs.filter(r => r.writer.split === SPLIT);
const writers = new Map();
const devices = new Set();
let total = 0, exact = 0, chars = 0, charErrors = 0;
let critical = 0, criticalExact = 0;
let auto = 0, autoCorrect = 0, confirm = 0, abstain = 0;
const latencies = [];

for (const run of selected) {
  devices.add(String(run.device.model).trim());
  const w = writers.get(run.writer.id) || { total: 0, exact: 0 };
  for (const s of run.samples || []) {
    const want = normalizeMath(s.target);
    const got = normalizeMath(s.recognized);
    const ok = got === want;
    total++; w.total++;
    if (ok) { exact++; w.exact++; }
    chars += want.length;
    charErrors += editDistance(want, got);
    const isCritical = s.critical === true || looksCritical(s.target);
    if (isCritical) { critical++; if (ok) criticalExact++; }
    if (s.authority === 'auto') { auto++; if (ok) autoCorrect++; }
    else if (s.authority === 'confirm') confirm++;
    else abstain++;
    latencies.push(Number(s.recognitionMs));
  }
  writers.set(run.writer.id, w);
}

const ratio = (a, b) => b ? a / b : 0;
const exactRate = ratio(exact, total);
const charRate = chars ? 1 - charErrors / chars : 0;
const worstWriter = writers.size ? Math.min(...[...writers.values()].map(w => ratio(w.exact, w.total))) : 0;
const criticalRate = ratio(criticalExact, critical);
const autoPrecision = ratio(autoCorrect, auto);
const autoCoverage = ratio(auto, total);
const latencyP95 = p95(latencies);

console.log(`\nPri Ink physical Apple Pencil evidence · server reader · ${SPLIT}\n`);
console.log(`  runs: ${selected.length}`);
console.log(`  writers: ${writers.size}`);
console.log(`  device models: ${devices.size}`);
console.log(`  expressions: ${total}`);
console.log(`  exact expression: ${(100 * exactRate).toFixed(2)}% (${exact}/${total})`);
console.log(`  character accuracy: ${(100 * charRate).toFixed(3)}%`);
console.log(`  worst writer exact: ${(100 * worstWriter).toFixed(2)}%`);
console.log(`  critical structure: ${(100 * criticalRate).toFixed(3)}% (${criticalExact}/${critical})`);
console.log(`  authority: auto ${auto}, confirm ${confirm}, abstain ${abstain}`);
console.log(`  auto-mark precision: ${(100 * autoPrecision).toFixed(3)}% (${autoCorrect}/${auto})`);
console.log(`  auto-mark coverage: ${(100 * autoCoverage).toFixed(2)}%`);
console.log(`  server read p95: ${Number.isFinite(latencyP95) ? latencyP95.toFixed(1) : 'n/a'} ms (device round trip)`);

if (STRICT) {
  const f = PHYSICAL_RELEASE_FLOORS;
  if (writers.size < f.writers) fail(`release requires >=${f.writers} writer-disjoint ${SPLIT} writers; measured ${writers.size}`);
  if (total < f.expressions) fail(`release requires >=${f.expressions} scored expressions; measured ${total}`);
  if (devices.size < f.deviceModels) fail(`release requires >=${f.deviceModels} physical iPad model classes; measured ${devices.size}`);
  if (exactRate < f.exact) fail(`exact expression ${(100 * exactRate).toFixed(2)}% < ${(100 * f.exact).toFixed(1)}%`);
  if (charRate < f.char) fail(`character accuracy ${(100 * charRate).toFixed(3)}% < ${(100 * f.char).toFixed(1)}%`);
  if (worstWriter < f.worstWriter) fail(`worst writer ${(100 * worstWriter).toFixed(2)}% < ${(100 * f.worstWriter).toFixed(1)}%`);
  if (critical < f.criticalExpressions) fail(`release requires >=${f.criticalExpressions} critical-structure expressions; measured ${critical}`);
  if (criticalRate < f.criticalExact) fail(`critical structure ${(100 * criticalRate).toFixed(3)}% < ${(100 * f.criticalExact).toFixed(1)}%`);
  if (auto < f.autoMarkDecisions) fail(`safe-auto precision requires >=${f.autoMarkDecisions} actual auto-mark decisions; measured ${auto}`);
  if (autoPrecision < f.autoMarkPrecision) fail(`auto-mark precision ${(100 * autoPrecision).toFixed(3)}% < ${(100 * f.autoMarkPrecision).toFixed(1)}%`);
  if (!(latencyP95 <= f.serverReadP95Ms)) fail(`server read p95 ${latencyP95.toFixed(1)} ms > ${f.serverReadP95Ms} ms`);
}

for (const w of warnings) console.warn(`WARN ${w}`);
if (errors.length) {
  console.log('\nrelease evidence failures:');
  for (const e of errors) console.log(`  FAIL ${e}`);
  console.log(`\nPRI INK PHYSICAL RELEASE EVIDENCE — FAIL (${errors.length})\n`);
  process.exit(1);
}

console.log(`\nPRI INK PHYSICAL RELEASE EVIDENCE — ${STRICT ? 'PASS' : 'VALID'}\n`);
