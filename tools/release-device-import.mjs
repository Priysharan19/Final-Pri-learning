#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · import the Owner Console's device results into the device ledger
//
// The owner works through docs/release/owner-device-script.json on real
// hardware, and the console exports one sitting's results as one file:
//
//   { "format": "pri-device-evidence-export", "version": 1,
//     "sha": "<40-hex>", "tester": "<full name>", "buildKind": "development", "server": "staging",
//     "records": [ { "case": "DM-IPD-05-WRITE", "result": "pass", "device": "…", "os": "…", "pencil": "…" }, … ],
//     "soaks": [ { "device": "…", "os": "…", "minutes": 52, "failures": 0 } ] }
//
// buildKind, server, severity and soaks exist only where the recorder keeps
// them (#737); exportShape() is the shape this checkout accepts.
//
// Every line is written by scripts/device-matrix-record.mjs itself (its
// recordResult and recordSoak), and only after every record has passed the
// recorder's own rules. On top of those rules the importer refuses:
//   · a value that is not text (minutes and failures: a whole number);
//   · a value holding the shape's <placeholder> text;
//   · a field this checkout's recorder would drop instead of recording;
//   · a tester that names an agent, CI or a placeholder, or a simulator
//     device, whatever the result (the recorder checks a pass or fail only);
//   · a case twice, an unknown key, and any option it does not know.
// One bad record refuses the whole file. The records reach the ledger in a
// single append (the soaks in one more, undone if it fails), so a refused or
// failed import leaves the ledger as it was. It adds nothing a person did
// not enter.
//
//   node tools/release-device-import.mjs <export.json> [--ledger <path>]
//
// Exit 0 imported · 2 refused or failed (nothing written).
// ─────────────────────────────────────────────────────────────────────────────
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as recorder from '../scripts/device-matrix-record.mjs';

export const EXPORT_FORMAT = 'pri-device-evidence-export';
const USAGE = 'Usage: node tools/release-device-import.mjs <export.json> [--ledger <path>]';

/** The fields this checkout's recorder writes into a record (buildKind, server and severity arrive with #737). */
const RECORDED = new Set(Object.keys(recorder.buildRecord({})));
/** Whether this checkout's recorder keeps soak records (#737). */
export const SOAKS_RECORDED = ['recordSoak', 'buildSoakRecord', 'soakProblemsWith', 'soakLedgerFor'].every(name => typeof recorder[name] === 'function');

/** What the console collects, in words. `whole` fields are whole numbers; every other field is text. */
const FIELDS = Object.freeze({
  export: {
    sha: { required: true, about: 'the full 40-hex commit of the build on the device' },
    tester: { required: true, about: 'the full name of the person who ran the cases' },
    buildKind: { about: 'development (Part A, from Xcode) or testflight (Part B)' },
    server: { about: 'staging (Part A) or production (Part B)' }
  },
  records: {
    case: { required: true, about: 'a device-matrix item id from the checklist' },
    result: { required: true, about: 'pass, fail or blocked' },
    device: { about: 'the device model as Settings shows it; a pass or fail needs it' },
    os: { about: 'the OS name and version as the device shows it; a pass or fail needs it' },
    pencil: { about: 'the Apple Pencil model; a pass of the iPad WRITE case needs it' },
    severity: { about: 'P0, P1, P2 or P3; a fail needs it, nothing else carries one' },
    notes: { about: 'what the tester saw; a fail or blocked needs at least five characters' },
    build: { about: 'a build label, if any' }
  },
  soaks: {
    device: { about: 'the device model as Settings shows it' },
    os: { about: 'the OS name and version as the device shows it' },
    pencil: { about: 'the Apple Pencil model, on an iPad' },
    minutes: { required: true, whole: true, about: 'minutes of continuous use' },
    failures: { required: true, whole: true, about: 'crashes, hangs, lost work and wrong marks seen, 0 when none' },
    notes: { about: 'each failure, when there were any' },
    build: { about: 'a build label, if any' }
  }
});
const FRAME_KEYS = new Set(['format', 'version', 'records', 'soaks']);
/** Angle brackets mark the shape's placeholder text; a value a person typed never holds them (notes may, unless they are wholly a placeholder). */
const PLACEHOLDER = /[<>]/;
const PLACEHOLDER_NOTES = /^<[^]*>$/;

/** Whether this checkout's recorder records a field; the importer refuses a field it would drop. */
export function recorderKeeps(part, name) {
  if (part === 'soaks') return SOAKS_RECORDED && (name === 'minutes' || name === 'failures' || RECORDED.has(name));
  return RECORDED.has(name);
}

/** The export's shape for the console. Every value is a <placeholder> the importer refuses, so a form filled from it can never be imported. */
export function exportShape() {
  const fill = part => Object.fromEntries(Object.entries(FIELDS[part]).filter(([name]) => recorderKeeps(part, name))
    .map(([name, spec]) => [name, `<${spec.required ? 'required: ' : ''}${spec.about}${spec.whole ? ' (a whole number)' : ''}>`]));
  return { format: EXPORT_FORMAT, version: 1, ...fill('export'), records: [fill('records')], ...(SOAKS_RECORDED ? { soaks: [fill('soaks')] } : {}) };
}

function fieldProblems(part, where, object) {
  const problems = [];
  const fields = FIELDS[part];
  for (const key of Object.keys(object)) if (!Object.hasOwn(fields, key) && !(part === 'export' && FRAME_KEYS.has(key))) problems.push(`${where}unknown key ${JSON.stringify(key)}`);
  for (const [name, spec] of Object.entries(fields)) {
    const value = object[name];
    if (value === undefined || value === null) { if (spec.required) problems.push(`${where}${name} is required`); continue; }
    if (spec.whole) { if (!Number.isInteger(value)) problems.push(`${where}${name} must be a whole number`); continue; }
    if (typeof value !== 'string') { problems.push(`${where}${name} must be text, not ${Array.isArray(value) ? 'a list' : typeof value}`); continue; }
    if ((name === 'notes' ? PLACEHOLDER_NOTES : PLACEHOLDER).test(value.trim())) problems.push(`${where}${name} ${JSON.stringify(value)} is placeholder text, not what a person entered`);
    else if (value.trim() && !recorderKeeps(part, name)) problems.push(`${where}${name} is not recorded by this checkout's scripts/device-matrix-record.mjs (it arrives with #737): refused rather than dropped`);
  }
  return problems;
}

const pick = (part, raw) => Object.fromEntries(Object.keys(FIELDS[part]).filter(name => raw[name] !== undefined && raw[name] !== null).map(name => [name, raw[name]]));

/** The recorder inputs for an export, or the problems that refuse it. */
export function importPlan(exported, { now = Date.now() } = {}) {
  if (!exported || typeof exported !== 'object' || Array.isArray(exported)) return { problems: ['the export must be a JSON object'], inputs: [], soaks: [] };
  const problems = [];
  if (exported.format !== EXPORT_FORMAT) problems.push(`format must be ${JSON.stringify(EXPORT_FORMAT)}`);
  if (exported.version !== 1) problems.push('version must be 1');
  problems.push(...fieldProblems('export', '', exported));
  // The recorder checks the tester and the device on a pass or fail only. An export is one person's results, so every row is held to them.
  if (typeof exported.tester === 'string' && (exported.tester.trim().length < 3 || recorder.NOT_A_HUMAN.test(exported.tester))) problems.push(`tester ${JSON.stringify(exported.tester)} does not name a human (the recorder's rule, applied to every result)`);
  const records = exported.records ?? [];
  const soaks = exported.soaks ?? [];
  if (!Array.isArray(records)) problems.push('records must be a list');
  if (!Array.isArray(soaks)) problems.push('soaks must be a list');
  else if (soaks.length && !SOAKS_RECORDED) problems.push('soaks are not recorded by this checkout\'s scripts/device-matrix-record.mjs (they arrive with #737): refused rather than dropped');
  if ((Array.isArray(records) ? records.length : 0) + (Array.isArray(soaks) ? soaks.length : 0) === 0) problems.push('the export holds no records and no soaks: it needs at least one result');
  const shared = { sha: exported.sha, tester: exported.tester, buildKind: exported.buildKind, server: exported.server };
  const physical = (where, raw) => { if (typeof raw.device === 'string' && recorder.NOT_PHYSICAL.test(raw.device)) problems.push(`${where}: device ${JSON.stringify(raw.device)} is a simulator or emulator (the recorder's rule, applied to every result)`); };

  const seen = new Set();
  const inputs = [];
  for (const [index, raw] of (Array.isArray(records) ? records : []).entries()) {
    const where = `records[${index}]`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { problems.push(`${where} must be an object`); continue; }
    problems.push(...fieldProblems('records', `${where}: `, raw));
    physical(where, raw);
    const input = { ...pick('records', raw), ...shared };
    const record = recorder.buildRecord(input, { now });
    if (seen.has(record.case)) problems.push(`${where}: case ${record.case} appears twice in one export`);
    seen.add(record.case);
    for (const problem of recorder.problemsWith(record)) problems.push(`${where} (${record.case || '?'}): ${problem}`);
    inputs.push(input);
  }
  const soakInputs = [];
  if (SOAKS_RECORDED && Array.isArray(soaks)) for (const [index, raw] of soaks.entries()) {
    const where = `soaks[${index}]`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { problems.push(`${where} must be an object`); continue; }
    problems.push(...fieldProblems('soaks', `${where}: `, raw));
    physical(where, raw);
    const input = { ...pick('soaks', raw), ...shared };
    for (const problem of recorder.soakProblemsWith(recorder.buildSoakRecord(input, { now }))) problems.push(`${where}: ${problem}`);
    soakInputs.push(input);
  }
  return { problems, inputs, soaks: soakInputs };
}

/** Lets the recorder append to a copy of `real`, and keeps exactly the bytes it appended. */
function stage(stages, real, copy, write) {
  const existed = existsSync(real);
  const before = existed ? readFileSync(real) : Buffer.alloc(0);
  writeFileSync(copy, before);
  const written = write();
  const after = readFileSync(copy);
  if (after.length < before.length || !after.subarray(0, before.length).equals(before)) throw Object.assign(new Error(`the recorder changed ${real} instead of appending to it: nothing written`), { exitCode: 2 });
  stages.push({ real, existed, size: before.length, bytes: after.subarray(before.length) });
  return written;
}

/** One append per ledger. If one fails, every ledger already appended to is put back. */
function commit(stages, append) {
  const touched = [];
  try {
    for (const staged of stages.filter(s => s.bytes.length)) {
      mkdirSync(dirname(staged.real), { recursive: true });
      touched.push(staged);
      append(staged.real, staged.bytes);
    }
  } catch (error) {
    for (const staged of touched) {
      try { if (staged.existed) truncateSync(staged.real, staged.size); else rmSync(staged.real, { force: true }); }
      catch { throw Object.assign(new Error(`the import failed (${error.message}) and ${staged.real} could not be put back: cut it to ${staged.size} bytes before anything else`), { exitCode: 2, cause: error }); }
    }
    throw Object.assign(new Error(`the import failed, nothing written: ${error.message}`), { exitCode: 2, cause: error });
  }
}

/** Imports every record and soak, or none. Returns { written, soaks, ledger }. Throws with .problems when refused. */
export function importExport(exported, { ledger = recorder.DEFAULT_LEDGER, now = Date.now(), append = appendFileSync } = {}) {
  const { problems, inputs, soaks } = importPlan(exported, { now });
  if (problems.length) throw Object.assign(new Error(`refused, nothing written:\n  - ${problems.join('\n  - ')}`), { problems, exitCode: 2 });
  const scratch = mkdtempSync(join(tmpdir(), 'pri-device-import-'));
  try {
    const copy = join(scratch, 'results.jsonl');
    const stages = [];
    const written = stage(stages, ledger, copy, () => inputs.map(input => recorder.recordResult(input, { ledger: copy, now })));
    const soakRecords = soaks.length ? stage(stages, recorder.soakLedgerFor(ledger), recorder.soakLedgerFor(copy), () => soaks.map(input => recorder.recordSoak(input, { ledger: copy, now }))) : [];
    commit(stages, append);
    return { written, soaks: soakRecords, ledger };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** One export file and an optional --ledger <path>; anything else is refused. */
export function parseArgs(args) {
  let file = null;
  let ledger = null;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--ledger') {
      const value = args[index + 1];
      if (ledger !== null) return { error: '--ledger is given twice' };
      if (value === undefined || value.startsWith('-')) return { error: '--ledger needs a path' };
      ledger = value;
      index += 1;
    } else if (arg.startsWith('-')) return { error: `unknown option ${arg}` };
    else if (file !== null) return { error: `one export file at a time (${file}, ${arg})` };
    else file = arg;
  }
  if (file === null) return { error: 'no export file given' };
  return { file, ledger: ledger ?? recorder.DEFAULT_LEDGER };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) { console.error(`${parsed.error}\n${USAGE}`); process.exit(2); }
  let exported;
  try { exported = JSON.parse(readFileSync(parsed.file, 'utf8')); } catch (error) { console.error(`${parsed.file}: ${error?.code === 'ENOENT' ? 'no such file' : 'not JSON'}`); process.exit(2); }
  try {
    const { written, soaks } = importExport(exported, { ledger: parsed.ledger });
    for (const record of written) console.log(`  recorded ${record.case} ${record.result.toUpperCase()} — ${record.device || 'no device'} · ${record.sha.slice(0, 12)} · ${record.tester}`);
    for (const soak of soaks) console.log(`  recorded SOAK ${soak.minutes} min, ${soak.failures} failure(s) — ${soak.device} · ${soak.sha.slice(0, 12)} · ${soak.tester}`);
    console.log(`DEVICE IMPORT: ${written.length} record(s)${soaks.length ? ` and ${soaks.length} soak(s)` : ''} written to ${parsed.ledger}`);
  } catch (error) { console.error(error.message); process.exit(error.exitCode || 2); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
