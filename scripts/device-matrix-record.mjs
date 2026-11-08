#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · physical-device matrix: the case list and the result ledgers
//
// docs/release/device-matrix.md is the human-readable protocol; this file is
// its single source of truth for the case ids (the doc's table is generated
// from here and a test keeps them equal) and the only writer of the ledgers
// docs/release/evidence/device-matrix/results.jsonl (cases) and soak.jsonl
// (soak records).
//
// The matrix is the cross-device V1 journey of PRI_V1_RELEASE_SCOPE.md §22.2
// on the four device families of §22.1, plus the groups issue #10 and scope
// §18 #11 asked for and the first ledger did not carry: ACCESSIBILITY
// (VoiceOver / TalkBack, Full Keyboard Access, text size), ORIENTATION
// (rotation, Split View, Stage Manager), RESTORE, EXAM, LIFECYCLE and EXPORT.
// Every record names the device, its OS, the build SHA, the kind of build
// (a development build pointed at staging, or the store build pointed at
// production — the two are never mixed in a report), and the named human
// who ran it. A fail carries a severity from the taxonomy below. Simulator,
// emulator and agent evidence is refused here by construction: it belongs to
// CI, and AGENTS.md forbids fabricating physical-device or human evidence.
//
//   node scripts/device-matrix-record.mjs cases [--markdown]
//   node scripts/device-matrix-record.mjs record --case DM-IPD-05-WRITE --result pass \
//     --device "iPad Pro 11-inch (4th generation)" --os "iPadOS 26.0.1" --pencil "Apple Pencil Pro" \
//     --sha <40-hex> --tester "Full Name" --build-kind development --server staging \
//     [--build "Xcode run 1.0 (3)"] [--notes "…"] [--ledger <path>]
//   node scripts/device-matrix-record.mjs record --case DM-IPH-08-MARK --result fail --severity P1 … --notes "what failed"
//   node scripts/device-matrix-record.mjs soak --device "iPad Pro 11-inch (4th generation)" --os "iPadOS 26.0.1" \
//     --sha <40-hex> --tester "Full Name" --build-kind testflight --server production \
//     --minutes 45 --failures 0 [--pencil "Apple Pencil Pro"] [--notes "30-min timed paper, 6 handwritten answers"] [--ledger <path>]
//   node scripts/device-matrix-record.mjs report [--sha <40-hex>] [--build-kind development|testflight|play-internal|play-closed] [--ledger <path>] [--markdown]
//   node scripts/device-matrix-record.mjs validate [--ledger <path>]
//
// Exit 0 done · 1 validate found a bad record · 2 refused (nothing written).
// ─────────────────────────────────────────────────────────────────────────────
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_LEDGER = join(ROOT, 'docs', 'release', 'evidence', 'device-matrix', 'results.jsonl');
/** The soak ledger sits beside the case ledger: <dir>/soak.jsonl. */
export const soakLedgerFor = ledger => join(dirname(ledger), 'soak.jsonl');
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

/**
 * The groups beyond the journey (issue #10; scope §18 #11 and §22.4). Each
 * step names the families it applies to; a step that does not apply to a
 * family has no case there (iPhone is portrait-only, Split View and Stage
 * Manager are iPad). `expect` says what the tester must see, including what
 * the product really does today (the iPhone text-size cap), so a pass is a
 * statement about the shipped behaviour and not a wish.
 */
export const GROUPS = Object.freeze([
  { id: 'ACCESSIBILITY', title: 'Accessibility', steps: [
    { seq: '10', id: 'VOICEOVER', families: ['IPH', 'IPD'], title: 'VoiceOver', expect: 'With VoiceOver on, the student can sign in, open Practice, reach the answer box and the mode switch, press "Read my answer", hear the transcript line by line, submit, and hear the mark and its feedback; every control has a name; focus never lands on an unlabelled element; the writing surface is announced.' },
    { seq: '10', id: 'TALKBACK', families: ['AND', 'ANT'], title: 'TalkBack', expect: 'With TalkBack on, the student can sign in, open Practice, reach the answer box and the mode switch, press "Read my answer", hear the transcript line by line, submit, and hear the mark and its feedback; every control has a name; focus never lands on an unlabelled element.' },
    { seq: '11', id: 'KEYBOARD', families: ['IPH', 'IPD', 'ANT'], title: 'Full Keyboard Access / hardware keyboard', expect: 'With Full Keyboard Access on (iPhone/iPad: Settings → Accessibility → Keyboards) or a hardware keyboard attached (Android tablet), Tab reaches every control of the sign-in card and the question card in order, Space/Return activates it, focus is visible, and nothing traps focus.' },
    { seq: '12', id: 'TEXTSIZE', families: ['IPH', 'IPD', 'AND', 'ANT'], title: 'Largest text size', expect: 'At the largest accessibility text size the app stays usable with nothing clipped and no sideways scroll. What to expect today: on iPhone and iPad the WHOLE PAGE scales through the viewport, capped so the layout never drops below 360 CSS px wide (about 1.12× on a 402 pt iPhone, up to 1.5× on iPad); on Android the WebView follows the system font scale. Record the scale you saw; a pass is "usable at that scale", not "text reflowed like a native app".' }
  ] },
  { id: 'ORIENTATION', title: 'Orientation and multitasking', steps: [
    { seq: '13', id: 'ROTATE', families: ['IPD', 'AND', 'ANT'], title: 'Rotate mid-attempt', expect: 'Rotating the device with ink, a typed answer and a transcript on the page keeps all three; the writing surface stays aligned with the ruled paper after rotation and after scrolling; nothing is re-issued or lost. (iPhone is portrait-only by design and has no case.)' },
    { seq: '14', id: 'SPLITVIEW', families: ['IPD'], title: 'Split View', expect: 'With Pri in Split View beside another app (half and a third of the screen), the question card, the writing surface and the mode switch fit without sideways scroll; Pencil ink lands where the pen touches; resizing the split keeps the ink aligned.' },
    { seq: '15', id: 'STAGEMANAGER', families: ['IPD'], title: 'Stage Manager', expect: 'With Stage Manager on, a resized Pri window keeps the question card, the writing surface and the mode switch usable; dragging the window and resizing it mid-attempt keeps the ink aligned with the paper and loses nothing.' }
  ] },
  { id: 'RESTORE', title: 'Restore', steps: [
    { seq: '16', id: 'REINSTALL', families: ['IPH', 'IPD', 'AND', 'ANT'], title: 'Sign out, delete the app, reinstall, sign in', expect: 'After signing out, deleting the app, reinstalling the same build and signing in, History holds every earlier attempt with its marks and feedback, Progress is unchanged, and the next question continues from the same place. Nothing is duplicated.' }
  ] },
  { id: 'EXAM', title: 'Exam', steps: [
    { seq: '17', id: 'TIMED', families: ['IPH', 'IPD', 'AND', 'ANT'], title: 'Timed paper with handwriting', expect: 'A timed paper of at least 30 minutes is started, at least six answers are handwritten (and read) across it, the clock runs correctly through a lock-and-unlock, submission at the end records every answer, and the analysis shows them. Record the duration and the number of handwritten answers in --notes.' }
  ] },
  { id: 'LIFECYCLE', title: 'Lifecycle', steps: [
    { seq: '18', id: 'BACKGROUND', families: ['IPH', 'IPD', 'AND', 'ANT'], title: 'Background and return', expect: 'With an unsent handwritten answer and typed working on the page, switch to another app for at least two minutes, take a call or a notification, and return: the ink, the working and any transcript are exactly as left, and submitting then marks them.' },
    { seq: '19', id: 'STORAGE', families: ['IPH', 'IPD', 'AND', 'ANT'], title: 'Low storage', expect: 'With the device under 500 MB free, an attempt can be written, read, submitted and found in History; the app says so plainly if a photo cannot be kept; nothing crashes and nothing already recorded is lost.' },
    { seq: '20', id: 'MEMORY', families: ['IPH', 'IPD', 'AND', 'ANT'], title: 'Low-memory recovery', expect: 'After the system reclaims the app in the background (open several heavy apps, or on Android force the process with the developer "background process limit"), reopening Pri restores the unsent draft, the transcript and the session without a sign-in; nothing marked is lost.' }
  ] },
  { id: 'EXPORT', title: 'Export and share', steps: [
    { seq: '21', id: 'EXPORT', families: ['IPH', 'IPD', 'AND', 'ANT'], title: 'Account export', expect: 'The account export produces a file through the system share sheet (Files, AirDrop, Drive…) that opens as JSON and contains this account\'s attempts and no other account\'s data.' },
    { seq: '22', id: 'SHARE', families: ['IPH', 'IPD', 'AND', 'ANT'], title: 'Share and print', expect: 'A paper or progress page shares through the system sheet and prints (or saves as PDF) with every question, answer and mark legible; the share holds nothing from another profile.' }
  ] }
]);

export const RESULTS = Object.freeze(['pass', 'fail', 'blocked']);
export const EVIDENCE_CLASS = Object.freeze({ pass: 'PHYSICAL-HUMAN', fail: 'PHYSICAL-HUMAN', blocked: 'BLOCKED-EXTERNAL' });

/**
 * Which build was on the device and which server it talked to. The first
 * full matrix runs on a DEVELOPMENT build (an Xcode / Gradle run of the frozen
 * SHA, DEBUG, pointed at staging, the only build that may talk to staging);
 * the store build (TestFlight / Play internal) talks to production only
 * (scripts/check-native-archive.mjs refuses a staging origin) and is re-run
 * after promotion with store release held. A report never mixes the two.
 */
export const BUILD_KINDS = Object.freeze(['development', 'testflight', 'play-internal', 'play-closed']);
export const SERVERS = Object.freeze(['staging', 'production']);
export const STORE_BUILD_KINDS = Object.freeze(['testflight', 'play-internal', 'play-closed']);

/**
 * Defect severity, required on every fail. P0 and P1 block the release
 * (V1_DECISIONS D6: zero unresolved P0 and P1 at the candidate SHA; every
 * lower defect triaged with a reason recorded).
 */
export const SEVERITIES = Object.freeze({
  P0: 'data loss, a wrong or missing mark, a security or privacy breach, or a crash that stops the journey',
  P1: 'a journey step cannot be completed on this device and there is no workaround',
  P2: 'the step completes with a workaround, or a visible defect that misleads',
  P3: 'cosmetic: wording, spacing or alignment with no effect on what the student can do'
});

const journeyCases = FAMILIES.flatMap(family => JOURNEY.map(step => ({
  id: `DM-${family.id}-${step.seq}-${step.id}`, group: 'JOURNEY', groupTitle: 'Journey (§22.2)', family: family.id, familyLabel: family.label,
  seq: step.seq, step: step.id, title: step.title, expect: step.expect, pencil: family.id === 'IPD' && step.id === 'WRITE'
})));
const groupCases = GROUPS.flatMap(group => group.steps.flatMap(step => FAMILIES.filter(f => step.families.includes(f.id)).map(family => ({
  id: `DM-${family.id}-${step.seq}-${step.id}`, group: group.id, groupTitle: group.title, family: family.id, familyLabel: family.label,
  seq: step.seq, step: step.id, title: step.title, expect: step.expect, pencil: false
}))));
export const CASES = Object.freeze([...journeyCases, ...groupCases].map(c => Object.freeze(c)));
const CASE_BY_ID = new Map(CASES.map(c => [c.id, c]));

/** Words that mark a "tester" as not a named human, or a "device" as not physical hardware. */
export const NOT_A_HUMAN = /\b(agent|claude|gpt|llm|bot|automation|automated|script|ci|pipeline|simulator|emulator|unknown|nobody|none|n\/a|tbd|todo|test(er)?)\b/i;
export const NOT_PHYSICAL = /simulator|emulator|playwright|headless|xcode|avd|virtual|genymotion|browserstack|appetize/i;

/** The checks a pass or fail shares: a named human, real hardware, its OS, the build. */
function humanAndHardwareProblems(record, what) {
  const problems = [];
  const tester = String(record?.tester || '').trim();
  if (!tester) problems.push(`a ${what} needs --tester "<the named human who ran it>"; it is refused without one (no fabricated evidence)`);
  else if (NOT_A_HUMAN.test(tester)) problems.push(`--tester ${JSON.stringify(tester)} does not name a human: the word ${JSON.stringify(tester.match(NOT_A_HUMAN)[0])} marks an agent, CI, simulator or placeholder name and is refused whole-word, case-insensitively, with no override (docs/release/device-matrix.md "Recording a result")`);
  else if (tester.length < 3) problems.push(`--tester ${JSON.stringify(tester)} is too short to name a human`);
  const device = String(record?.device || '').trim();
  if (device.length < 3) problems.push(`a ${what} needs --device "<the physical device model>"`);
  else if (NOT_PHYSICAL.test(device)) problems.push(`--device ${JSON.stringify(device)} is a simulator/emulator; that evidence belongs to CI, never to this matrix`);
  if (String(record?.os || '').trim().length < 3) problems.push(`a ${what} needs --os "<OS name and version as the device shows it>"`);
  if (!BUILD_KINDS.includes(record?.buildKind)) problems.push(`a ${what} needs --build-kind ${BUILD_KINDS.join('|')}: a development build and a store build are different evidence and are never mixed`);
  if (!SERVERS.includes(record?.server)) problems.push(`a ${what} needs --server ${SERVERS.join('|')}: which server the build talked to`);
  if (STORE_BUILD_KINDS.includes(record?.buildKind) && record?.server === 'staging') problems.push(`a ${record.buildKind} build cannot have talked to staging (the signed build carries a production origin; scripts/check-native-archive.mjs refuses a staging one)`);
  if (record?.buildKind === 'development' && record?.server === 'production') problems.push('a development build is not run against production: the first matrix runs on staging, the store build re-runs on production (docs/release/device-matrix.md "Which server a device build talks to")');
  return problems;
}

/** Returns the list of reasons a record is refused; empty when it may be written. */
export function problemsWith(record) {
  const problems = [];
  const kase = CASE_BY_ID.get(String(record?.case || ''));
  if (!kase) problems.push(`unknown case id ${JSON.stringify(record?.case ?? null)}; run "cases" for the list`);
  if (!RESULTS.includes(record?.result)) problems.push(`result must be one of ${RESULTS.join(', ')}`);
  if (!SHA.test(String(record?.sha || ''))) problems.push('sha must be the full 40-hex build commit');
  if (record?.evidenceClass !== undefined && record.evidenceClass !== EVIDENCE_CLASS[record?.result]) problems.push(`evidenceClass for ${record?.result} is ${EVIDENCE_CLASS[record?.result]}, not ${record.evidenceClass}`);
  if (record?.result === 'pass' || record?.result === 'fail') {
    problems.push(...humanAndHardwareProblems(record, record.result));
    if (kase?.pencil && record.result === 'pass' && String(record?.pencil || '').trim().length < 3) problems.push(`${kase.id} is the Apple Pencil case: a pass needs --pencil "<Pencil model>"`);
  }
  if (record?.result === 'fail') {
    if (!Object.hasOwn(SEVERITIES, String(record?.severity || ''))) problems.push(`a fail needs --severity ${Object.keys(SEVERITIES).join('|')} (${Object.entries(SEVERITIES).map(([k, v]) => `${k}: ${v}`).join('; ')})`);
    if (String(record?.notes || '').trim().length < 5) problems.push('a fail needs --notes "<what the tester saw>"');
  } else if (record?.severity) {
    problems.push('only a fail carries a severity');
  }
  if (record?.result === 'blocked' && String(record?.notes || '').trim().length < 5) problems.push('a blocked case needs --notes "<what is missing: the device, the account, the build…>"');
  return problems;
}

export function buildRecord(input, { now = Date.now() } = {}) {
  const record = {
    recordedAt: new Date(now).toISOString(),
    case: String(input.case || '').trim().toUpperCase(),
    result: String(input.result || '').trim().toLowerCase(),
    severity: input.severity ? String(input.severity).trim().toUpperCase() : null,
    device: input.device ? String(input.device).trim() : null,
    os: input.os ? String(input.os).trim() : null,
    pencil: input.pencil ? String(input.pencil).trim() : null,
    build: input.build ? String(input.build).trim() : null,
    buildKind: input.buildKind ? String(input.buildKind).trim().toLowerCase() : (input['build-kind'] ? String(input['build-kind']).trim().toLowerCase() : null),
    server: input.server ? String(input.server).trim().toLowerCase() : null,
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

// ── soak records ─────────────────────────────────────────────────────────────
/** A soak is at least this long, on one device, one build, by one person. */
export const SOAK_MIN_MINUTES = 30;

export function soakProblemsWith(record) {
  const problems = [];
  if (!SHA.test(String(record?.sha || ''))) problems.push('sha must be the full 40-hex build commit');
  problems.push(...humanAndHardwareProblems(record, 'soak'));
  const minutes = record?.minutes === null || record?.minutes === undefined || record?.minutes === '' ? NaN : Number(record.minutes);
  if (!Number.isInteger(minutes) || minutes < SOAK_MIN_MINUTES) problems.push(`a soak needs --minutes <integer >= ${SOAK_MIN_MINUTES}> (the time the app was in continuous use)`);
  const failures = record?.failures === null || record?.failures === undefined || record?.failures === '' ? NaN : Number(record.failures);
  if (!Number.isInteger(failures) || failures < 0) problems.push('a soak needs --failures <integer >= 0> (crashes, hangs, lost work and wrong marks seen during it)');
  if (failures > 0 && String(record?.notes || '').trim().length < 5) problems.push('a soak with failures needs --notes describing each one (and a fail row per case where one applies)');
  if (record?.evidenceClass !== undefined && record.evidenceClass !== 'PHYSICAL-HUMAN') problems.push(`evidenceClass of a soak is PHYSICAL-HUMAN, not ${record.evidenceClass}`);
  return problems;
}

export function buildSoakRecord(input, { now = Date.now() } = {}) {
  const base = buildRecord({ ...input, case: 'SOAK', result: 'pass' }, { now });
  const { case: _case, result: _result, severity: _severity, evidenceClass: _ec, ...rest } = base;
  return {
    ...rest,
    kind: 'soak',
    minutes: input.minutes !== undefined && input.minutes !== null && input.minutes !== '' && Number.isFinite(Number(input.minutes)) ? Number(input.minutes) : null,
    failures: input.failures !== undefined && input.failures !== null && input.failures !== '' && Number.isFinite(Number(input.failures)) ? Number(input.failures) : null,
    evidenceClass: 'PHYSICAL-HUMAN'
  };
}

export function recordSoak(input, { ledger = DEFAULT_LEDGER, now = Date.now() } = {}) {
  const record = buildSoakRecord(input, { now });
  const problems = soakProblemsWith(record);
  if (problems.length) throw Object.assign(new Error(`refused:\n  - ${problems.join('\n  - ')}`), { problems, exitCode: 2 });
  const path = soakLedgerFor(ledger);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(record) + '\n');
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
  const soak = soakLedgerFor(path);
  readLedger(soak).forEach((record, index) => {
    if (record.parseError) { errors.push(`soak line ${record.line}: not JSON`); return; }
    const problems = soakProblemsWith(record);
    if (record.kind !== 'soak') problems.push('kind must be soak');
    if (record.recorder !== 'scripts/device-matrix-record.mjs') problems.push('recorder must be scripts/device-matrix-record.mjs');
    if (!Number.isFinite(Date.parse(record.recordedAt || ''))) problems.push('recordedAt must be an ISO timestamp');
    for (const problem of problems) errors.push(`soak line ${index + 1}: ${problem}`);
  });
  return errors;
}

/**
 * Latest record per case (optionally for one SHA and one build kind), plus the
 * cases with no record. Development-build and store-build rows never share a
 * summary: a report is for one kind, and `byBuildKind` says what each holds.
 */
export function summarise(records, { sha = null, buildKind = null } = {}) {
  const latest = new Map();
  const byBuildKind = Object.fromEntries(BUILD_KINDS.map(k => [k, { pass: 0, fail: 0, blocked: 0 }]));
  const openDefects = [];
  for (const record of records) {
    if (record.parseError || !CASE_BY_ID.has(record.case)) continue;
    if (sha && record.sha !== sha) continue;
    if (record.buildKind && byBuildKind[record.buildKind]) byBuildKind[record.buildKind][record.result] += 1;
    if (buildKind && record.buildKind !== buildKind) continue;
    const prior = latest.get(record.case);
    if (!prior || Date.parse(record.recordedAt) >= Date.parse(prior.recordedAt)) latest.set(record.case, record);
  }
  const rows = CASES.map(kase => ({ ...kase, latest: latest.get(kase.id) || null }));
  const counts = { pass: 0, fail: 0, blocked: 0, 'not run': 0 };
  for (const row of rows) {
    counts[row.latest ? row.latest.result : 'not run'] += 1;
    if (row.latest?.result === 'fail') openDefects.push({ case: row.id, severity: row.latest.severity, notes: row.latest.notes });
  }
  const bySeverity = Object.fromEntries(Object.keys(SEVERITIES).map(s => [s, openDefects.filter(d => d.severity === s).length]));
  const releaseBlocking = bySeverity.P0 + bySeverity.P1;
  return { rows, counts, sha, buildKind, byBuildKind, openDefects, bySeverity, releaseBlocking };
}

export function soakSummary(records, { sha = null, buildKind = null } = {}) {
  const soaks = records.filter(r => !r.parseError && r.kind === 'soak' && (!sha || r.sha === sha) && (!buildKind || r.buildKind === buildKind));
  return { soaks, minutes: soaks.reduce((n, s) => n + (Number(s.minutes) || 0), 0), failures: soaks.reduce((n, s) => n + (Number(s.failures) || 0), 0) };
}

export function casesMarkdown() {
  const lines = ['| Case | Group | Family | Step | What the tester must see |', '|---|---|---|---|---|'];
  for (const kase of CASES) lines.push(`| \`${kase.id}\` | ${kase.group} | ${kase.familyLabel} | ${kase.seq} ${kase.title}${kase.pencil ? ' (Apple Pencil)' : ''} | ${kase.expect} |`);
  return lines.join('\n');
}

// Ledger fields are free text typed by a tester (or edited by hand): flatten
// every line ending and escape backslashes before pipes so a note can never add
// a forged row or column to the matrix table the GO/NO-GO dossier embeds.
function mdCell(text) { return String(text ?? '').replace(/\r\n|[\r\n\u000b\u000c\u0085\u2028\u2029]/g, ' ').replace(/\\/g, '\\\\').replace(/\|/g, '\\|'); }

export function reportMarkdown(summary, soak = { soaks: [], minutes: 0, failures: 0 }) {
  // A summary built by hand (the dossier's own tests, an older caller) may
  // lack the severity and build-kind tallies: they read as zero, never crash.
  const bySeverity = { P0: 0, P1: 0, P2: 0, P3: 0, ...(summary.bySeverity || {}) };
  const byBuildKind = Object.fromEntries(BUILD_KINDS.map(k => [k, { pass: 0, fail: 0, blocked: 0, ...(summary.byBuildKind?.[k] || {}) }]));
  const scope = `${summary.sha ? `build ${summary.sha}` : 'all builds'}${summary.buildKind ? ` · ${summary.buildKind} builds` : ' · every build kind (development and store rows are listed, never merged into one verdict)'}`;
  const lines = [
    `Physical-device matrix — ${scope} — pass ${summary.counts.pass} · fail ${summary.counts.fail} · blocked ${summary.counts.blocked} · not run ${summary.counts['not run']} of ${summary.rows.length} — open defects P0 ${bySeverity.P0} · P1 ${bySeverity.P1} · P2 ${bySeverity.P2} · P3 ${bySeverity.P3}${summary.releaseBlocking ? ` — ${summary.releaseBlocking} RELEASE-BLOCKING` : ''}`,
    '',
    `Rows by build kind: ${BUILD_KINDS.map(k => `${k} pass ${byBuildKind[k].pass} / fail ${byBuildKind[k].fail} / blocked ${byBuildKind[k].blocked}`).join(' · ')}`,
    `Soak: ${soak.soaks.length} record(s), ${soak.minutes} min in total, ${soak.failures} failure(s)${soak.soaks.length ? ` — ${soak.soaks.map(s => `${mdCell(s.device)} (${mdCell(s.os)}, ${mdCell(s.buildKind)} → ${mdCell(s.server)}) ${mdCell(s.minutes)} min by ${mdCell(s.tester)}, ${mdCell(s.failures)} failure(s)`).join('; ')}` : ''}`,
    '',
    '| Case | Group | Result | Severity | Device | OS | Pencil | Build | Server | Build SHA | Tester | Recorded | Notes |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|'
  ];
  for (const row of summary.rows) {
    const r = row.latest;
    lines.push(r
      ? `| \`${mdCell(row.id)}\` | ${mdCell(row.group)} | ${mdCell(String(r.result).toUpperCase())} | ${mdCell(r.severity || '—')} | ${mdCell(r.device || '—')} | ${mdCell(r.os || '—')} | ${mdCell(r.pencil || '—')} | ${mdCell(r.buildKind || '—')} | ${mdCell(r.server || '—')} | \`${mdCell(String(r.sha).slice(0, 12))}\` | ${mdCell(r.tester || '—')} | ${mdCell(String(r.recordedAt).slice(0, 10))} | ${mdCell(r.notes || '')} |`
      : `| \`${row.id}\` | ${row.group} | not run | — | — | — | — | — | — | — | — | — | |`);
  }
  lines.push('', 'Every PASS/FAIL row is PHYSICAL-HUMAN evidence recorded by the named tester on real hardware, on the build kind and server it names. Simulator/emulator results are never written here (CI holds them). "not run" rows are open until a human records them. A release needs zero open P0 and P1 on the store build against production.');
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
    '  node scripts/device-matrix-record.mjs record --case <id> --result pass|fail|blocked --device "<model>" --os "<os>" --sha <40-hex> --tester "<name>" --build-kind development|testflight|play-internal|play-closed --server staging|production [--severity P0|P1|P2|P3 (fail)] [--pencil "<model>"] [--build "<label>"] [--notes "<text>"] [--ledger <path>]',
    '  node scripts/device-matrix-record.mjs soak --device "<model>" --os "<os>" --sha <40-hex> --tester "<name>" --build-kind <kind> --server <server> --minutes <n> --failures <n> [--pencil "<model>"] [--notes "<text>"] [--ledger <path>]',
    '  node scripts/device-matrix-record.mjs report [--sha <40-hex>] [--build-kind <kind>] [--ledger <path>] [--markdown]',
    '  node scripts/device-matrix-record.mjs validate [--ledger <path>]'
  ].join('\n');
  let parsed;
  try { parsed = parseCli(process.argv.slice(2)); } catch (error) { console.error(`${error.message}\n${usage}`); process.exit(2); }
  const { command, options } = parsed;
  const ledger = options.ledger || DEFAULT_LEDGER;
  if (command === 'cases') {
    if (options.markdown) console.log(casesMarkdown());
    else for (const kase of CASES) console.log(`${kase.id.padEnd(24)} ${kase.group.padEnd(14)} ${kase.familyLabel.padEnd(20)} ${kase.seq} ${kase.title}`);
    return;
  }
  if (command === 'record') {
    try {
      const record = recordResult({ ...options, buildKind: options['build-kind'] }, { ledger });
      console.log(`recorded ${record.case} ${record.result.toUpperCase()}${record.severity ? ` ${record.severity}` : ''} — ${record.device || 'no device'} · ${record.os || 'no OS'} · ${record.buildKind || '?'} → ${record.server || '?'} · ${record.sha.slice(0, 12)} · ${record.tester || 'no tester'} → ${ledger}`);
      return;
    } catch (error) { console.error(error.message); process.exit(error.exitCode || 2); }
  }
  if (command === 'soak') {
    try {
      const record = recordSoak({ ...options, buildKind: options['build-kind'] }, { ledger });
      console.log(`recorded SOAK ${record.minutes} min, ${record.failures} failure(s) — ${record.device} · ${record.os} · ${record.buildKind} → ${record.server} · ${record.sha.slice(0, 12)} · ${record.tester} → ${soakLedgerFor(ledger)}`);
      return;
    } catch (error) { console.error(error.message); process.exit(error.exitCode || 2); }
  }
  if (command === 'report') {
    if (options.sha && !SHA.test(options.sha.toLowerCase())) { console.error('--sha must be a full 40-hex commit'); process.exit(2); }
    const buildKind = options['build-kind'] || null;
    if (buildKind && !BUILD_KINDS.includes(buildKind)) { console.error(`--build-kind must be one of ${BUILD_KINDS.join(', ')}`); process.exit(2); }
    const sha = options.sha ? options.sha.toLowerCase() : null;
    const summary = summarise(readLedger(ledger), { sha, buildKind });
    const soak = soakSummary(readLedger(soakLedgerFor(ledger)), { sha, buildKind });
    if (options.markdown) console.log(reportMarkdown(summary, soak));
    else {
      for (const row of summary.rows) {
        const r = row.latest;
        console.log(`${row.id.padEnd(24)} ${(r ? `${r.result.toUpperCase()}${r.severity ? ` ${r.severity}` : ''}` : 'not run').padEnd(10)} ${r ? `${r.device} · ${r.os}${r.pencil ? ` · ${r.pencil}` : ''} · ${r.buildKind || '?'} → ${r.server || '?'} · ${r.sha.slice(0, 12)} · ${r.tester || '—'} · ${r.recordedAt.slice(0, 10)}` : ''}`);
      }
      console.log(`\nDEVICE MATRIX: pass ${summary.counts.pass} · fail ${summary.counts.fail} · blocked ${summary.counts.blocked} · not run ${summary.counts['not run']} of ${summary.rows.length}${summary.sha ? ` — build ${summary.sha}` : ''}${summary.buildKind ? ` — ${summary.buildKind} builds` : ''} — open defects P0 ${summary.bySeverity.P0} · P1 ${summary.bySeverity.P1} · P2 ${summary.bySeverity.P2} · P3 ${summary.bySeverity.P3}`);
      console.log(`SOAK: ${soak.soaks.length} record(s) · ${soak.minutes} min · ${soak.failures} failure(s)`);
    }
    return;
  }
  if (command === 'validate') {
    const errors = validateLedger(ledger);
    for (const error of errors) console.error(`  ✗ ${error}`);
    console.log(`DEVICE MATRIX LEDGER: ${errors.length ? 'FAIL' : 'PASS'} — ${readLedger(ledger).length} case record(s), ${readLedger(soakLedgerFor(ledger)).length} soak record(s), ${errors.length} problem(s) — ${ledger}`);
    process.exit(errors.length ? 1 : 0);
  }
  console.error(usage);
  process.exit(2);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
