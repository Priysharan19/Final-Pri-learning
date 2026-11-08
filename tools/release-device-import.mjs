#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · import the Owner Console's device results into the device ledger
//
// The owner works through docs/release/owner-device-script.json on real
// hardware, and the console exports the results as one file:
//
//   { "format": "pri-device-evidence-export", "version": 1,
//     "sha": "<40-hex>", "tester": "<full name>", "buildKind": "development", "server": "staging",
//     "records": [ { "case": "DM-IPD-05-WRITE", "result": "pass", "device": "…", "os": "…", "pencil": "…" }, … ] }
//
// This writes those results to docs/release/evidence/device-matrix/results.jsonl
// ONLY through scripts/device-matrix-record.mjs (its recordResult), and it
// checks every record with the recorder's own rules FIRST: one bad record (an
// agent or placeholder tester, a simulator, an unknown case, a short SHA, a
// missing Pencil on the iPad writing case, a duplicate case) refuses the whole
// file and nothing is written. It adds nothing a person did not enter.
//
//   node tools/release-device-import.mjs <export.json> [--ledger <path>]
//
// Exit 0 imported · 2 refused (nothing written).
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { DEFAULT_LEDGER, buildRecord, problemsWith, recordResult } from '../scripts/device-matrix-record.mjs';

export const EXPORT_FORMAT = 'pri-device-evidence-export';
const EXPORT_KEYS = new Set(['format', 'version', 'sha', 'tester', 'buildKind', 'server', 'records']);
const RECORD_KEYS = new Set(['case', 'result', 'device', 'os', 'pencil', 'severity', 'notes', 'build']);

/** The recorder inputs for an export, or { problems } when anything in it would be refused. */
export function importPlan(exported, { now = Date.now() } = {}) {
  const problems = [];
  if (!exported || typeof exported !== 'object' || Array.isArray(exported)) return { problems: ['the export must be a JSON object'], inputs: [] };
  for (const key of Object.keys(exported)) if (!EXPORT_KEYS.has(key)) problems.push(`unknown key ${JSON.stringify(key)}`);
  if (exported.format !== EXPORT_FORMAT) problems.push(`format must be ${JSON.stringify(EXPORT_FORMAT)}`);
  if (exported.version !== 1) problems.push('version must be 1');
  if (!Array.isArray(exported.records) || exported.records.length === 0) problems.push('records must be a non-empty array');
  const seen = new Set();
  const inputs = [];
  for (const [index, raw] of (Array.isArray(exported.records) ? exported.records : []).entries()) {
    const where = `records[${index}]`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { problems.push(`${where} must be an object`); continue; }
    for (const key of Object.keys(raw)) if (!RECORD_KEYS.has(key)) problems.push(`${where}: unknown key ${JSON.stringify(key)}`);
    const id = String(raw.case || '').trim().toUpperCase();
    if (seen.has(id)) problems.push(`${where}: case ${id} appears twice in one export`);
    seen.add(id);
    const input = {
      case: raw.case, result: raw.result, device: raw.device, os: raw.os, pencil: raw.pencil, build: raw.build, notes: raw.notes,
      severity: raw.severity, sha: exported.sha, tester: exported.tester, buildKind: exported.buildKind, 'build-kind': exported.buildKind, server: exported.server
    };
    // The recorder's own rules, applied to the record it would write.
    for (const problem of problemsWith(buildRecord(input, { now }))) problems.push(`${where} (${id || '?'}): ${problem}`);
    inputs.push(input);
  }
  return { problems, inputs };
}

/** Imports every record, or none. Returns { written: [records], ledger }. Throws with .problems when refused. */
export function importExport(exported, { ledger = DEFAULT_LEDGER, now = Date.now() } = {}) {
  const { problems, inputs } = importPlan(exported, { now });
  if (problems.length) throw Object.assign(new Error(`refused, nothing written:\n  - ${problems.join('\n  - ')}`), { problems, exitCode: 2 });
  const written = inputs.map(input => recordResult(input, { ledger, now }));
  return { written, ledger };
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find(arg => !arg.startsWith('--'));
  const at = args.indexOf('--ledger');
  const ledger = at >= 0 ? args[at + 1] : DEFAULT_LEDGER;
  if (!file || (at >= 0 && !ledger)) { console.error('Usage: node tools/release-device-import.mjs <export.json> [--ledger <path>]'); process.exit(2); }
  let exported;
  try { exported = JSON.parse(readFileSync(file, 'utf8')); } catch (error) { console.error(`${file}: ${error?.code === 'ENOENT' ? 'no such file' : 'not JSON'}`); process.exit(2); }
  try {
    const { written } = importExport(exported, { ledger });
    for (const record of written) console.log(`  recorded ${record.case} ${record.result.toUpperCase()} — ${record.device || 'no device'} · ${record.sha.slice(0, 12)} · ${record.tester || '—'}`);
    console.log(`DEVICE IMPORT: ${written.length} record(s) written to ${ledger}`);
  } catch (error) { console.error(error.message); process.exit(error.exitCode || 2); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
