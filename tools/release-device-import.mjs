#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · import the Owner Console's device results into the device ledger
//
// The owner works through docs/release/owner-device-script.json on real
// hardware, and the console exports one sitting's results as one file
// (format v1; exportShape() below is its every field):
//
//   { "format": "pri-device-evidence-export", "version": 1, "exportedAt": "<ISO time>",
//     "sha": "<40-hex>", "tester": "<full name>", "buildKind": "testflight", "server": "staging",
//     "records": [ { "case": "DM-IPD-05-WRITE", "result": "pass", "device": "…", "os": "…", "pencil": "…" }, … ],
//     "soaks": [ { "device": "…", "os": "…", "minutes": 52, "failures": 0 } ] }
//
// Every line is written by scripts/device-matrix-record.mjs itself (its
// recordResult and recordSoak), and only after every record has passed the
// recorder's own rules. It needs the recorder of #737 (build kinds, servers,
// severities, soaks): rows imported before it would fail that recorder's
// ledger check, so on an older recorder nothing is imported. On top of the
// recorder's rules the importer refuses:
//   · a value that is not text (minutes and failures: a whole number);
//   · a value holding the shape's <placeholder> text, or a generic name;
//   · a build kind or server the recorder does not know, or development on
//     production, whatever the results;
//   · a tester that names an agent, CI or a placeholder, or a simulator
//     device, whatever the result (the recorder checks a pass or fail only);
//   · an export older than a row already in the ledger for one of its cases
//     (same SHA, build kind and server) or soaks: an older export, or the
//     same export imported twice, never replaces a newer result;
//   · a case twice, two soaks on one device, an unknown key or option.
// One bad record refuses the whole file. The records reach the ledger in a
// single append (the soaks in one more), and a failed write is put back, so
// a refused or failed import leaves the ledgers as they were. It adds
// nothing a person did not enter.
//
//   node tools/release-device-import.mjs <export.json> [--ledger <path>]
//
// Exit 0 imported · 2 refused or failed (nothing written).
// ─────────────────────────────────────────────────────────────────────────────
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, rmdirSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as recorder from '../scripts/device-matrix-record.mjs';

export const EXPORT_FORMAT = 'pri-device-evidence-export';
const USAGE = 'Usage: node tools/release-device-import.mjs <export.json> [--ledger <path>]';

/** The fields this checkout's recorder writes into a record. */
const RECORDED = new Set(Object.keys(recorder.buildRecord({})));
/** Whether this checkout's recorder is #737's: build kinds, servers, severities and soak records. Before it, nothing is imported. */
export const IMPORT_READY = ['buildKind', 'server', 'severity'].every(name => RECORDED.has(name))
  && Array.isArray(recorder.BUILD_KINDS) && Array.isArray(recorder.SERVERS)
  && ['recordSoak', 'buildSoakRecord', 'soakProblemsWith', 'soakLedgerFor'].every(name => typeof recorder[name] === 'function');

/** What the console collects, in words. `whole` fields are whole numbers, `time` an ISO date-time; every other field is text. */
const FIELDS = Object.freeze({
  export: {
    exportedAt: { required: true, time: true, about: 'when the console made this export, as an ISO date-time' },
    sha: { required: true, about: 'the full 40-hex commit of the build on the device' },
    tester: { required: true, about: 'the full name of the person who ran the cases' },
    buildKind: { required: true, about: 'testflight: the store build (Parts A and B); development only for an earlier, optional Xcode run, which never replaces store-build rows' },
    server: { required: true, about: 'staging (Part A, before GO) or production (Part B, after promotion)' }
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
    device: { required: true, about: 'the device model as Settings shows it' },
    os: { about: 'the OS name and version as the device shows it' },
    pencil: { about: 'the Apple Pencil model, on an iPad' },
    minutes: { required: true, whole: true, about: 'minutes of continuous use' },
    failures: { required: true, whole: true, about: 'crashes, hangs, lost work and wrong marks seen, 0 when none' },
    notes: { about: 'each failure, when there were any' },
    build: { about: 'a build label, if any' }
  }
});
const FRAME_KEYS = new Set(['format', 'version', 'records', 'soaks']);
const RECORD_KEY = { exportedAt: null, minutes: null, failures: null };
/** Angle brackets mark the shape's placeholder text; a value a person typed never holds them. Notes may use < and >, but not a <word…> placeholder. */
const PLACEHOLDER = /[<>]/;
const PLACEHOLDER_NOTES = /<[A-Za-z][^<>\n]{0,200}>/;
/** A tester's name: no invisible or control characters, at least two letters, and not a generic placeholder name. */
const INVISIBLE = /[\p{Cc}\p{Cf}\u2028\u2029]/u;
const GENERIC_NAME = /^(?:(?:your|my|the|full|first|last|tester'?s?|owner'?s?)\s+)*(?:full\s+)?name$|^(?:owner|tester|me|myself|someone|anonymous|anon|user|person)$/i;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Whether this checkout's recorder records a field; the importer refuses a field it would drop. */
export function recorderKeeps(part, name) {
  if (Object.hasOwn(RECORD_KEY, name)) return name === 'exportedAt' || IMPORT_READY;
  return RECORDED.has(name);
}

/** The v1 export's shape for the console. Every value is a <placeholder> the importer refuses, so a form filled from it can never be imported. */
export function exportShape() {
  const fill = part => Object.fromEntries(Object.entries(FIELDS[part])
    .map(([name, spec]) => [name, `<${spec.required ? 'required: ' : ''}${spec.about}${spec.whole ? ' (a whole number)' : ''}>`]));
  return { format: EXPORT_FORMAT, version: 1, ...fill('export'), records: [fill('records')], soaks: [fill('soaks')] };
}

function fieldProblems(part, where, object, now) {
  const problems = [];
  const fields = FIELDS[part];
  for (const key of Object.keys(object)) if (!Object.hasOwn(fields, key) && !(part === 'export' && FRAME_KEYS.has(key))) problems.push(`${where}unknown key ${JSON.stringify(key)}`);
  for (const [name, spec] of Object.entries(fields)) {
    const value = object[name];
    if (value === undefined || value === null) { if (spec.required) problems.push(`${where}${name} is required`); continue; }
    if (spec.whole) { if (!Number.isInteger(value)) problems.push(`${where}${name} must be a whole number`); continue; }
    if (typeof value !== 'string') { problems.push(`${where}${name} must be text, not ${Array.isArray(value) ? 'a list' : typeof value}`); continue; }
    if (name === 'notes' ? PLACEHOLDER_NOTES.test(value) : PLACEHOLDER.test(value)) { problems.push(`${where}${name} ${JSON.stringify(value)} is placeholder text, not what a person entered`); continue; }
    if (spec.time) {
      const at = Date.parse(value);
      if (!ISO_TIME.test(value.trim()) || !Number.isFinite(at)) problems.push(`${where}${name} must be an ISO date-time`);
      else if (at > now) problems.push(`${where}${name} ${value} is in the future`);
      continue;
    }
    if (value.trim() && !recorderKeeps(part, name)) problems.push(`${where}${name} is not recorded by this checkout's scripts/device-matrix-record.mjs: refused rather than dropped`);
  }
  return problems;
}

const pick = (part, raw) => Object.fromEntries(Object.keys(FIELDS[part]).filter(name => name !== 'exportedAt' && raw[name] !== undefined && raw[name] !== null).map(name => [name, raw[name]]));
const kindOf = row => `${row.buildKind ?? null}|${row.server ?? null}`;

/** The recorder inputs for an export, or the problems that refuse it. `ledger` is read to refuse an export older than what it already holds. */
export function importPlan(exported, { now = Date.now(), ledger = recorder.DEFAULT_LEDGER } = {}) {
  if (!exported || typeof exported !== 'object' || Array.isArray(exported)) return { problems: ['the export must be a JSON object'], inputs: [], soaks: [] };
  const problems = [];
  if (!IMPORT_READY) problems.push('this checkout\'s scripts/device-matrix-record.mjs predates build kinds, servers, severities and soaks (#737): rows imported now would fail its ledger check, so nothing is imported before it lands');
  if (exported.format !== EXPORT_FORMAT) problems.push(`format must be ${JSON.stringify(EXPORT_FORMAT)}`);
  if (exported.version !== 1) problems.push('version must be 1');
  problems.push(...fieldProblems('export', '', exported, now));
  // The recorder checks the tester, the device and the build on a pass or fail only. An export is one person's results on one build, so every row is held to them.
  const tester = typeof exported.tester === 'string' ? exported.tester : null;
  if (tester !== null && !PLACEHOLDER.test(tester)) {
    const letters = (tester.match(/\p{L}/gu) || []).length;
    if (INVISIBLE.test(tester) || letters < 2 || tester.trim().length < 3 || GENERIC_NAME.test(tester.trim()) || recorder.NOT_A_HUMAN.test(tester)) problems.push(`tester ${JSON.stringify(tester)} does not name a human (the recorder's rule and the importer's, applied to every result)`);
  }
  if (IMPORT_READY && typeof exported.buildKind === 'string' && !recorder.BUILD_KINDS.includes(exported.buildKind)) problems.push(`buildKind must be one of ${recorder.BUILD_KINDS.join(', ')}`);
  if (IMPORT_READY && typeof exported.server === 'string' && !recorder.SERVERS.includes(exported.server)) problems.push(`server must be one of ${recorder.SERVERS.join(', ')}`);
  if (exported.buildKind === 'development' && exported.server === 'production') problems.push('a development build is never run against production');
  const records = exported.records ?? [];
  const soaks = exported.soaks ?? [];
  if (!Array.isArray(records)) problems.push('records must be a list');
  if (!Array.isArray(soaks)) problems.push('soaks must be a list');
  if ((Array.isArray(records) ? records.length : 0) + (Array.isArray(soaks) ? soaks.length : 0) === 0) problems.push('the export holds no records and no soaks: it needs at least one result');
  const shared = { sha: exported.sha, tester: exported.tester, buildKind: exported.buildKind, server: exported.server };
  const physical = (where, raw) => { if (typeof raw.device === 'string' && recorder.NOT_PHYSICAL.test(raw.device)) problems.push(`${where}: device ${JSON.stringify(raw.device)} is a simulator or emulator (the recorder's rule, applied to every result)`); };

  // An export never replaces a newer result: the ledger rows of the same SHA, build kind and server, written after it was made.
  const exportedAt = typeof exported.exportedAt === 'string' ? Date.parse(exported.exportedAt) : NaN;
  const sha = String(exported.sha || '').trim().toLowerCase();
  const newer = (rows, matches) => Number.isFinite(exportedAt) ? rows.filter(row => !row.parseError && String(row.sha || '').toLowerCase() === sha && kindOf(row) === kindOf(shared) && Date.parse(row.recordedAt || '') > exportedAt && matches(row)) : [];
  const ledgerRows = recorder.readLedger(ledger);
  const soakRows = IMPORT_READY ? recorder.readLedger(recorder.soakLedgerFor(ledger)) : [];

  const seen = new Set();
  const inputs = [];
  for (const [index, raw] of (Array.isArray(records) ? records : []).entries()) {
    const where = `records[${index}]`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { problems.push(`${where} must be an object`); continue; }
    problems.push(...fieldProblems('records', `${where}: `, raw, now));
    physical(where, raw);
    const input = { ...pick('records', raw), ...shared };
    const record = recorder.buildRecord(input, { now });
    if (seen.has(record.case)) problems.push(`${where}: case ${record.case} appears twice in one export`);
    seen.add(record.case);
    for (const problem of recorder.problemsWith(record)) problems.push(`${where} (${record.case || '?'}): ${problem}`);
    const later = newer(ledgerRows, row => row.case === record.case);
    if (later.length) problems.push(`${where} (${record.case}): the ledger already holds a result for it recorded at ${later.at(-1).recordedAt}, after this export was made (${exported.exportedAt}); an older export, or the same one twice, never replaces it: export again`);
    inputs.push(input);
  }
  const soakInputs = [];
  const soakDevices = new Set();
  for (const [index, raw] of (Array.isArray(soaks) ? soaks : []).entries()) {
    const where = `soaks[${index}]`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { problems.push(`${where} must be an object`); continue; }
    problems.push(...fieldProblems('soaks', `${where}: `, raw, now));
    physical(where, raw);
    const device = typeof raw.device === 'string' ? raw.device.trim().toLowerCase() : '';
    if (device && soakDevices.has(device)) problems.push(`${where}: a second soak on ${raw.device} in one export (one soak per device per sitting)`);
    soakDevices.add(device);
    const input = { ...pick('soaks', raw), ...shared };
    if (IMPORT_READY) {
      for (const problem of recorder.soakProblemsWith(recorder.buildSoakRecord(input, { now }))) problems.push(`${where}: ${problem}`);
      const later = newer(soakRows, row => String(row.device || '').trim().toLowerCase() === device);
      if (later.length) problems.push(`${where}: the soak ledger already holds a soak on this device recorded at ${later.at(-1).recordedAt}, after this export was made (${exported.exportedAt}); an older export, or the same one twice, never adds to it: export again`);
    }
    soakInputs.push(input);
  }
  return { problems, inputs, soaks: soakInputs };
}

/** Lets `write` append to a copy of `real`, and keeps exactly the bytes it appended. Refuses a writer that rewrote instead of appending. */
export function stageAppend(stages, real, copy, write) {
  const existed = existsSync(real);
  const before = existed ? readFileSync(real) : Buffer.alloc(0);
  mkdirSync(dirname(copy), { recursive: true });
  writeFileSync(copy, before);
  const written = write();
  const after = readFileSync(copy);
  if (after.length < before.length || !after.subarray(0, before.length).equals(before)) throw Object.assign(new Error(`the recorder changed ${real} instead of appending to it: nothing written`), { exitCode: 2 });
  stages.push({ real, existed, size: before.length, bytes: after.subarray(before.length) });
  return written;
}

/** Puts one ledger back as it was before the import. */
function restoreLedger(staged) {
  if (staged.existed) truncateSync(staged.real, staged.size); else rmSync(staged.real, { force: true });
}

/** One append per ledger. If one fails, every ledger touched is put back (each one tried), and directories the import made are removed again. */
export function commitStages(stages, { append = appendFileSync, restore = restoreLedger } = {}) {
  const touched = [];
  let failure = null;
  for (const staged of stages.filter(s => s.bytes.length)) {
    try {
      const created = mkdirSync(dirname(staged.real), { recursive: true });
      touched.push({ ...staged, created });
      append(staged.real, staged.bytes);
    } catch (error) { failure = error; break; }
  }
  if (!failure) return;
  const stuck = [];
  for (const staged of [...touched].reverse()) {
    try { restore(staged); } catch { stuck.push(`${staged.real} (cut it back to ${staged.size} bytes)`); continue; }
    if (staged.created) for (let dir = dirname(staged.real); ; dir = dirname(dir)) { try { rmdirSync(dir); } catch { break; } if (dir === staged.created) break; }
  }
  if (stuck.length) throw Object.assign(new Error(`the import failed (${failure.message}) and could not be put back: ${stuck.join('; ')}; fix that before anything else`), { exitCode: 2, cause: failure });
  throw Object.assign(new Error(`the import failed, nothing written: ${failure.message}`), { exitCode: 2, cause: failure });
}

/** Imports every record and soak, or none. Returns { written, soaks, ledger }. Throws with .problems when refused. */
export function importExport(exported, { ledger = recorder.DEFAULT_LEDGER, now = Date.now(), append = appendFileSync } = {}) {
  const { problems, inputs, soaks } = importPlan(exported, { now, ledger });
  if (problems.length) throw Object.assign(new Error(`refused, nothing written:\n  - ${problems.join('\n  - ')}`), { problems, exitCode: 2 });
  const scratch = mkdtempSync(join(tmpdir(), 'pri-device-import-'));
  try {
    const copy = join(scratch, 'results.jsonl');
    const stages = [];
    const written = stageAppend(stages, ledger, copy, () => inputs.map(input => recorder.recordResult(input, { ledger: copy, now })));
    const soakRecords = soaks.length ? stageAppend(stages, recorder.soakLedgerFor(ledger), recorder.soakLedgerFor(copy), () => soaks.map(input => recorder.recordSoak(input, { ledger: copy, now }))) : [];
    commitStages(stages, { append });
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
    for (const record of written) console.log(`  recorded ${record.case} ${record.result.toUpperCase()} — ${record.device || 'no device'} · ${record.buildKind} → ${record.server} · ${record.sha.slice(0, 12)} · ${record.tester}`);
    for (const soak of soaks) console.log(`  recorded SOAK ${soak.minutes} min, ${soak.failures} failure(s) — ${soak.device} · ${soak.sha.slice(0, 12)} · ${soak.tester}`);
    console.log(`DEVICE IMPORT: ${written.length} record(s)${soaks.length ? ` and ${soaks.length} soak(s)` : ''} written to ${parsed.ledger}`);
  } catch (error) { console.error(error.message); process.exit(error.exitCode || 2); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
