#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · physical-device matrix: the case list and the result ledger
//
// docs/release/device-matrix.md is the human-readable protocol; this file is
// its single source of truth for the case ids (the doc's table is generated
// from here and a test keeps them equal) and the only writer of the ledger
// docs/release/evidence/device-matrix/results.jsonl.
//
// The matrix is the cross-device V1 journey of PRI_V1_RELEASE_SCOPE.md §22.2
// on the four device families of §22.1. Every record names the device, its OS,
// the build SHA and the named human who ran it. Simulator, emulator and agent
// evidence is refused here by construction: it belongs to CI, and AGENTS.md
// forbids fabricating physical-device or human evidence.
//
//   node scripts/device-matrix-record.mjs cases [--markdown]
//   node scripts/device-matrix-record.mjs record --case DM-IPD-05-WRITE --result pass \
//     --device "iPad Pro 11-inch (4th generation)" --os "iPadOS 26.0.1" --pencil "Apple Pencil Pro" \
//     --sha <40-hex> --tester "Full Name" [--build "TestFlight 4.0 (2)"] [--notes "…"] [--ledger <path>]
//   node scripts/device-matrix-record.mjs report [--sha <40-hex>] [--ledger <path>] [--markdown]
//   node scripts/device-matrix-record.mjs validate [--ledger <path>]
//
// Exit 0 done · 1 validate found a bad record · 2 refused (nothing written).
// ─────────────────────────────────────────────────────────────────────────────
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_LEDGER = join(ROOT, 'docs', 'release', 'evidence', 'device-matrix', 'results.jsonl');
const SHA = /^[0-9a-f]{40}$/;

export const FAMILIES = Object.freeze([
  { id: 'IPH', label: 'iPhone', input: 'finger handwriting; camera photo', track: 'TestFlight, then App Store' },
  { id: 'IPD', label: 'iPad + Apple Pencil', input: 'Apple Pencil handwriting (record the Pencil model); camera photo', track: 'TestFlight, then App Store' },
  { id: 'AND', label: 'Android phone', input: 'finger handwriting; camera photo', track: 'Play internal testing, then closed testing' },
  { id: 'ANT', label: 'Android tablet', input: 'S Pen / USI stylus or finger handwriting; camera photo', track: 'Play internal testing, then closed testing' }
]);

/** The §22.2 journey, in order. `expect` is what the tester must see to record a pass. */
export const JOURNEY = Object.freeze([
  { seq: '01', id: 'INSTALL', title: 'Install and first launch', expect: 'The build installs from its test track and opens to the sign-in card. The release identity shown in the app\'s diagnostics equals the build SHA being recorded.' },
  { seq: '02', id: 'OTP', title: 'Email one-time-code sign-in', expect: 'A 6-digit code reaches a real mailbox on this device; entering it signs in; the session survives closing and reopening the app.' },
  { seq: '03', id: 'GUARDIAN', title: 'Guardian consent for a child account', expect: 'A child account is held at "waiting for your parent" until the parent approves on /guardian/consent on THEIR OWN device with THEIR code; the child screen moves on by itself. Sync and server questions are refused until then.' },
  { seq: '04', id: 'ISSUE', title: 'Server-issued question', expect: 'A question is issued by the server and shown; aeroplane mode shows the offline state and the question is back when the network returns.' },
  { seq: '05', id: 'WRITE', title: 'Handwriting input', expect: 'Writing with this family\'s input (finger / Apple Pencil / stylus) draws without lag or dropped strokes; on tablets the palm does not draw; "Read my answer" sends the picture.' },
  { seq: '06', id: 'PHOTO', title: 'Photo of working', expect: 'The camera or picker captures a page of working; the picture is sent for reading; a photo taken sideways is shown the right way up.' },
  { seq: '07', id: 'TRANSCRIPT', title: 'Transcript shown; explicit correction or confirmation', expect: 'The transcript is shown line by line; a misread line can be corrected; when the reader is unsure the student must confirm before marking.' },
  { seq: '08', id: 'MARK', title: 'Server mark and criterion feedback', expect: 'The mark comes from the server with marks earned / possible and the first-error feedback; a wrong answer gets its second try; a correct answer shows the worked solution.' },
  { seq: '09', id: 'HISTORY', title: 'History and persistent sync', expect: 'The attempt is in History, is still there after the app is closed and reopened, and appears on a second signed-in device after sync.' }
]);

export const RESULTS = Object.freeze(['pass', 'fail', 'blocked']);
export const EVIDENCE_CLASS = Object.freeze({ pass: 'PHYSICAL-HUMAN', fail: 'PHYSICAL-HUMAN', blocked: 'BLOCKED-EXTERNAL' });

export const CASES = Object.freeze(FAMILIES.flatMap(family => JOURNEY.map(step => Object.freeze({
  id: `DM-${family.id}-${step.seq}-${step.id}`, family: family.id, familyLabel: family.label, seq: step.seq, step: step.id, title: step.title, expect: step.expect,
  pencil: family.id === 'IPD' && step.id === 'WRITE'
}))));
const CASE_BY_ID = new Map(CASES.map(c => [c.id, c]));

/** Words that mark a "tester" as not a named human, or a "device" as not physical hardware. */
export const NOT_A_HUMAN = /\b(agent|claude|gpt|llm|bot|automation|automated|script|ci|pipeline|simulator|emulator|unknown|nobody|none|n\/a|tbd|todo|test(er)?)\b/i;
export const NOT_PHYSICAL = /simulator|emulator|playwright|headless|xcode|avd|virtual|genymotion|browserstack|appetize/i;

/** Returns the list of reasons a record is refused; empty when it may be written. */
export function problemsWith(record) {
  const problems = [];
  const kase = CASE_BY_ID.get(String(record?.case || ''));
  if (!kase) problems.push(`unknown case id ${JSON.stringify(record?.case ?? null)}; run "cases" for the list`);
  if (!RESULTS.includes(record?.result)) problems.push(`result must be one of ${RESULTS.join(', ')}`);
  if (!SHA.test(String(record?.sha || ''))) problems.push('sha must be the full 40-hex build commit');
  if (record?.evidenceClass !== undefined && record.evidenceClass !== EVIDENCE_CLASS[record?.result]) problems.push(`evidenceClass for ${record?.result} is ${EVIDENCE_CLASS[record?.result]}, not ${record.evidenceClass}`);
  if (record?.result === 'pass' || record?.result === 'fail') {
    const tester = String(record?.tester || '').trim();
    if (!tester) problems.push(`a ${record.result} needs --tester "<the named human who ran it>"; it is refused without one (no fabricated evidence)`);
    else if (NOT_A_HUMAN.test(tester)) problems.push(`--tester ${JSON.stringify(tester)} does not name a human: the word ${JSON.stringify(tester.match(NOT_A_HUMAN)[0])} marks an agent, CI, simulator or placeholder name and is refused whole-word, case-insensitively, with no override (docs/release/device-matrix.md "Recording a result")`);
    else if (tester.length < 3) problems.push(`--tester ${JSON.stringify(tester)} is too short to name a human`);
    const device = String(record?.device || '').trim();
    if (device.length < 3) problems.push(`a ${record.result} needs --device "<the physical device model>"`);
    else if (NOT_PHYSICAL.test(device)) problems.push(`--device ${JSON.stringify(device)} is a simulator/emulator; that evidence belongs to CI, never to this matrix`);
    if (String(record?.os || '').trim().length < 3) problems.push(`a ${record.result} needs --os "<OS name and version as the device shows it>"`);
    if (kase?.pencil && record.result === 'pass' && String(record?.pencil || '').trim().length < 3) problems.push(`${kase.id} is the Apple Pencil case: a pass needs --pencil "<Pencil model>"`);
  }
  if (record?.result === 'blocked' && String(record?.notes || '').trim().length < 5) problems.push('a blocked case needs --notes "<what is missing: the device, the account, the build…>"');
  return problems;
}

export function buildRecord(input, { now = Date.now() } = {}) {
  const record = {
    recordedAt: new Date(now).toISOString(),
    case: String(input.case || '').trim().toUpperCase(),
    result: String(input.result || '').trim().toLowerCase(),
    device: input.device ? String(input.device).trim() : null,
    os: input.os ? String(input.os).trim() : null,
    pencil: input.pencil ? String(input.pencil).trim() : null,
    build: input.build ? String(input.build).trim() : null,
    sha: String(input.sha || '').trim().toLowerCase(),
    tester: input.tester ? String(input.tester).trim() : null,
    notes: input.notes ? String(input.notes).trim() : null
  };
  record.evidenceClass = EVIDENCE_CLASS[record.result] || null;
  record.recorder = 'scripts/device-matrix-record.mjs';
  return record;
}

export function readLedger(path = DEFAULT_LEDGER) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').map(line => line.trim()).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); } catch { return { parseError: true, line: index + 1 }; }
  });
}

/** Appends one record, or throws with .problems and writes nothing. */
export function recordResult(input, { ledger = DEFAULT_LEDGER, now = Date.now() } = {}) {
  const record = buildRecord(input, { now });
  const problems = problemsWith(record);
  if (problems.length) throw Object.assign(new Error(`refused:\n  - ${problems.join('\n  - ')}`), { problems, exitCode: 2 });
  mkdirSync(dirname(ledger), { recursive: true });
  appendFileSync(ledger, JSON.stringify(record) + '\n');
  return record;
}

/** Every ledger line re-checked against the same rules, so a hand-edited ledger cannot smuggle in fabricated evidence. */
export function validateLedger(path = DEFAULT_LEDGER) {
  const errors = [];
  readLedger(path).forEach((record, index) => {
    if (record.parseError) { errors.push(`line ${record.line}: not JSON`); return; }
    const problems = problemsWith(record);
    if (record.recorder !== 'scripts/device-matrix-record.mjs') problems.push('recorder must be scripts/device-matrix-record.mjs');
    if (!Number.isFinite(Date.parse(record.recordedAt || ''))) problems.push('recordedAt must be an ISO timestamp');
    for (const problem of problems) errors.push(`line ${index + 1} (${record.case || '?'}): ${problem}`);
  });
  return errors;
}

/** Latest record per case (optionally for one SHA), plus the cases with no record. */
export function summarise(records, { sha = null } = {}) {
  const latest = new Map();
  for (const record of records) {
    if (record.parseError || !CASE_BY_ID.has(record.case)) continue;
    if (sha && record.sha !== sha) continue;
    const prior = latest.get(record.case);
    if (!prior || Date.parse(record.recordedAt) >= Date.parse(prior.recordedAt)) latest.set(record.case, record);
  }
  const rows = CASES.map(kase => ({ ...kase, latest: latest.get(kase.id) || null }));
  const counts = { pass: 0, fail: 0, blocked: 0, 'not run': 0 };
  for (const row of rows) counts[row.latest ? row.latest.result : 'not run'] += 1;
  return { rows, counts, sha };
}

export function casesMarkdown() {
  const lines = ['| Case | Family | Step | What the tester must see |', '|---|---|---|---|'];
  for (const kase of CASES) lines.push(`| \`${kase.id}\` | ${kase.familyLabel} | ${kase.seq} ${kase.title}${kase.pencil ? ' (Apple Pencil)' : ''} | ${kase.expect} |`);
  return lines.join('\n');
}

export function reportMarkdown(summary) {
  const lines = [
    `Physical-device matrix — ${summary.sha ? `build ${summary.sha}` : 'all builds'} — pass ${summary.counts.pass} · fail ${summary.counts.fail} · blocked ${summary.counts.blocked} · not run ${summary.counts['not run']} of ${summary.rows.length}`,
    '',
    '| Case | Result | Device | OS | Pencil | Build SHA | Tester | Recorded | Notes |',
    '|---|---|---|---|---|---|---|---|---|'
  ];
  for (const row of summary.rows) {
    const r = row.latest;
    lines.push(r
      ? `| \`${row.id}\` | ${r.result.toUpperCase()} | ${r.device || '—'} | ${r.os || '—'} | ${r.pencil || '—'} | \`${r.sha.slice(0, 12)}\` | ${r.tester || '—'} | ${r.recordedAt.slice(0, 10)} | ${r.notes || ''} |`
      : `| \`${row.id}\` | not run | — | — | — | — | — | — | |`);
  }
  lines.push('', 'Every PASS/FAIL row is PHYSICAL-HUMAN evidence recorded by the named tester on real hardware. Simulator/emulator results are never written here (CI holds them). "not run" rows are open until a human records them.');
  return lines.join('\n');
}

function parseCli(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i += 1) {
    const flag = rest[i];
    if (flag === '--markdown') { options.markdown = true; continue; }
    if (!flag.startsWith('--')) throw Object.assign(new Error(`unexpected argument ${flag}`), { exitCode: 2 });
    const value = rest[i + 1];
    if (value === undefined || value.startsWith('--')) throw Object.assign(new Error(`${flag} needs a value`), { exitCode: 2 });
    options[flag.slice(2)] = value;
    i += 1;
  }
  return { command, options };
}

async function main() {
  const usage = [
    'Usage:',
    '  node scripts/device-matrix-record.mjs cases [--markdown]',
    '  node scripts/device-matrix-record.mjs record --case <id> --result pass|fail|blocked --device "<model>" --os "<os>" --sha <40-hex> --tester "<name>" [--pencil "<model>"] [--build "<label>"] [--notes "<text>"] [--ledger <path>]',
    '  node scripts/device-matrix-record.mjs report [--sha <40-hex>] [--ledger <path>] [--markdown]',
    '  node scripts/device-matrix-record.mjs validate [--ledger <path>]'
  ].join('\n');
  let parsed;
  try { parsed = parseCli(process.argv.slice(2)); } catch (error) { console.error(`${error.message}\n${usage}`); process.exit(2); }
  const { command, options } = parsed;
  const ledger = options.ledger || DEFAULT_LEDGER;
  if (command === 'cases') {
    if (options.markdown) console.log(casesMarkdown());
    else for (const kase of CASES) console.log(`${kase.id.padEnd(22)} ${kase.familyLabel.padEnd(20)} ${kase.seq} ${kase.title}`);
    return;
  }
  if (command === 'record') {
    try {
      const record = recordResult(options, { ledger });
      console.log(`recorded ${record.case} ${record.result.toUpperCase()} — ${record.device || 'no device'} · ${record.os || 'no OS'} · ${record.sha.slice(0, 12)} · ${record.tester || 'no tester'} → ${ledger}`);
      return;
    } catch (error) { console.error(error.message); process.exit(error.exitCode || 2); }
  }
  if (command === 'report') {
    if (options.sha && !SHA.test(options.sha.toLowerCase())) { console.error('--sha must be a full 40-hex commit'); process.exit(2); }
    const summary = summarise(readLedger(ledger), { sha: options.sha ? options.sha.toLowerCase() : null });
    if (options.markdown) console.log(reportMarkdown(summary));
    else {
      for (const row of summary.rows) {
        const r = row.latest;
        console.log(`${row.id.padEnd(22)} ${(r ? r.result.toUpperCase() : 'not run').padEnd(8)} ${r ? `${r.device} · ${r.os}${r.pencil ? ` · ${r.pencil}` : ''} · ${r.sha.slice(0, 12)} · ${r.tester || '—'} · ${r.recordedAt.slice(0, 10)}` : ''}`);
      }
      console.log(`\nDEVICE MATRIX: pass ${summary.counts.pass} · fail ${summary.counts.fail} · blocked ${summary.counts.blocked} · not run ${summary.counts['not run']} of ${summary.rows.length}${summary.sha ? ` — build ${summary.sha}` : ''}`);
    }
    return;
  }
  if (command === 'validate') {
    const errors = validateLedger(ledger);
    for (const error of errors) console.error(`  ✗ ${error}`);
    console.log(`DEVICE MATRIX LEDGER: ${errors.length ? 'FAIL' : 'PASS'} — ${readLedger(ledger).length} record(s), ${errors.length} problem(s) — ${ledger}`);
    process.exit(errors.length ? 1 : 0);
  }
  console.error(usage);
  process.exit(2);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
