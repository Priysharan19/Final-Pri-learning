// Release-prep tooling (Phase 6): the nomination gate, the scripted staging
// acceptance, the physical-device matrix recorder, the Node PNG rasteriser and
// the documents they point at.
//
// Everything here is hermetic: git and gh are stubs, the "deployed host" is an
// in-process HTTP server, the "human" who reads codes is a function, and the
// "pictures" are byte strings. No network, no provider, no mailbox.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BILLING_SCHEMA_VERSION, SCHEMA_VERSION } from '../server/platform/schemaVersions.js';
import {
  CONTAINER_CONTEXT, DEVICE_FAMILY_WAIVERS, EVIDENCE_REQUIREMENTS, NEVER_WAIVED_FAMILIES, PRODUCTION_ORIGIN, REQUIRED_CONTEXTS, STAGING_ORIGIN, deviceEvidence, evaluateRuns, ghAll, latestCheckRuns, releaseDeviceRows,
  goMarker, loadOverride, nominate, parseArgs as parseNominateArgs, parseSchemaVersions, promotionCommands, readerEvidence, runGroupKey, verifyApproval, waiverMarker,
  READER_FLOORS, RELEASE_CANDIDATE_JOBS, RELEASE_CANDIDATE_WORKFLOW, readerArtifactName, readerFloorProblems, releaseCandidateRun, releaseCandidateTitle
} from '../scripts/release-nominate.mjs';
import { EXTERNAL_GATES, LINE_BREAKS, buildDossier, cell, inline, para, parseArgs as parseDossierArgs, recordProblems, recordTemplate, renderMarkdown } from '../scripts/release-dossier.mjs';
import { approvalLinkShape, dataYesMarker } from '../scripts/release-nominate.mjs';
import {
  BUILD_KINDS, CASES, DEFAULT_LEDGER, FAMILIES, GROUPS, JOURNEY, SEVERITIES, SOAK_MIN_MINUTES, casesMarkdown, problemsWith, readLedger, recordResult, recordSoak, reportMarkdown, soakLedgerFor, soakSummary, summarise, validateLedger
} from '../scripts/device-matrix-record.mjs';
import {
  CONSENT_WITHDRAWN, EVIDENCE, EXPORT_FRESH_MS, SKIPPABLE_STEPS, STATUS, STEPS, STEP_IDS, TARGETS, deriveAddresses, exitCodeFor, expectedFromPrompt, exportedForeignRows, makeHttp, maskEmail,
  parseArgs as parseAcceptanceArgs, plusAddress, returnedAttempts, runAcceptance, withdrawalTokenFrom
} from './acceptance/staging-acceptance.mjs';
import { PNG_SIGNATURE, crc32, encodeGreyPng, pngDimensions, simulatedInkPng, simulatedPhotoPng, toDataUrl } from './acceptance/synthetic-png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let count = 0;
const ok = (value, message) => { assert.ok(value, message); count += 1; };
const eq = (actual, expected, message) => { assert.equal(actual, expected, message); count += 1; };
const read = path => readFileSync(join(ROOT, path), 'utf8');
const DEFAULT_REPO_FOR_TESTS = 'Priysharan19/Final-Pri-learning';
const SHA = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const PROD_POINTER = 'c'.repeat(40);
const escapeRe = text => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ═════════════════════════════════════════════════════════════════════════════
// 1 · release-nominate: the gate, with git, gh, the hosts and the evidence ledgers stubbed
// ═════════════════════════════════════════════════════════════════════════════
const scratch = [];
{
  const schemaSource = `export const SCHEMA_VERSION = ${SCHEMA_VERSION};\nexport const BILLING_SCHEMA_VERSION = ${BILLING_SCHEMA_VERSION};\n`;
  eq(parseSchemaVersions(schemaSource).schemaVersion, SCHEMA_VERSION, 'parseSchemaVersions reads SCHEMA_VERSION');
  eq(parseSchemaVersions(schemaSource).billingSchemaVersion, BILLING_SCHEMA_VERSION, 'parseSchemaVersions reads BILLING_SCHEMA_VERSION');
  assert.throws(() => parseSchemaVersions('export const SCHEMA_VERSION = 12;'), /both versions/, 'a commit without both constants is refused'); count += 1;

  assert.throws(() => parseNominateArgs([]), /40-hex/, 'a SHA is required'); count += 1;
  assert.throws(() => parseNominateArgs([SHA, '--bogus']), /Unknown argument/, 'unknown flags are refused'); count += 1;
  assert.throws(() => parseNominateArgs([SHA, '--production-engine', 'mysql']), /postgres or sqlite/, '--production-engine takes postgres or sqlite only'); count += 1;
  assert.throws(() => parseNominateArgs([SHA, '--override']), /needs a value/, '--override needs a path'); count += 1;
  const parsed = parseNominateArgs([SHA, '--no-fetch', '--staging', 'https://s.example', '--json']);
  ok(parsed.sha === SHA && parsed.fetch === false && parsed.staging === 'https://s.example' && parsed.json === true && parsed.stage === 'release', 'parseArgs reads the SHA and flags; the default stage is release');
  const cand = parseNominateArgs([SHA, '--candidate', '--override', 'x.json', '--production-engine', 'postgres']);
  ok(cand.stage === 'candidate' && cand.override === 'x.json' && cand.productionEngine === 'postgres', 'parseArgs reads --candidate, --override and --production-engine');

  const runs = evaluateRuns([
    { name: 'CI', path: '.github/workflows/ci.yml', event: 'push', status: 'completed', conclusion: 'success' },
    { name: 'Derived apply', path: '.github/workflows/x.yml', event: 'workflow_run', status: 'completed', conclusion: 'skipped' },
    { name: 'dependabot', path: 'dynamic/dependabot/dependabot-updates', event: 'dynamic', status: 'completed', conclusion: 'failure' }
  ]);
  ok(runs.ok && runs.ignored.length === 1 && runs.relevant.length === 2, 'Dependabot version-update runs are listed, not counted; skipped is green');
  ok(!evaluateRuns([{ name: 'CI', path: 'a.yml', status: 'in_progress', conclusion: null }]).ok, 'an in-progress run blocks');
  ok(!evaluateRuns([{ name: 'CI', path: 'a.yml', status: 'completed', conclusion: 'cancelled' }]).ok, 'a cancelled run blocks');
  ok(!evaluateRuns([]).ok, 'no run at all blocks');
  // Dedupe by (workflow, event): the newest run of each decides.
  const health = (conclusion, at, extra = {}) => ({ name: 'Pri App Health Agent', workflow_id: 7, path: '.github/workflows/app-health-agent.yml', event: 'schedule', status: 'completed', conclusion, run_started_at: at, ...extra });
  const flaky = evaluateRuns([health('failure', '2026-10-23T18:15:00Z', { run_number: 40 }), health('success', '2026-10-24T18:15:00Z', { run_number: 41 })]);
  ok(flaky.ok && flaky.superseded.length === 1 && flaky.superseded[0].conclusion === 'failure' && flaky.latest.length === 1, 'a flaky scheduled run superseded by a later green schedule on the same SHA is listed, not counted');
  const genuine = evaluateRuns([health('success', '2026-10-23T18:15:00Z', { run_number: 40 }), health('failure', '2026-10-24T18:15:00Z', { run_number: 41 })]);
  ok(!genuine.ok && genuine.red.length === 1, 'a workflow whose newest run is red still disqualifies the SHA (a genuine failure reproduces)');
  const otherEvent = evaluateRuns([
    { name: 'CI', workflow_id: 2, event: 'push', status: 'completed', conclusion: 'success', run_started_at: '2026-10-23T18:20:00Z' },
    { name: 'CI', workflow_id: 2, event: 'pull_request', status: 'completed', conclusion: 'failure', run_started_at: '2026-10-23T18:15:00Z' }
  ]);
  ok(!otherEvent.ok && otherEvent.latest.length === 2, 'a later run of a different event never supersedes a red run (push does not stand in for pull_request)');
  const stillRunning = evaluateRuns([health('failure', '2026-10-23T18:15:00Z'), { ...health(null, '2026-10-24T18:15:00Z'), status: 'in_progress' }]);
  ok(!stillRunning.ok && stillRunning.pending.length === 1 && stillRunning.superseded.length === 1, 'a newer run still in progress supersedes the red one but blocks until it completes');
  const sameStamp = evaluateRuns([health('failure', '2026-10-23T18:15:00Z', { run_number: 40, run_attempt: 1 }), health('success', '2026-10-23T18:15:00Z', { run_number: 40, run_attempt: 2 })]);
  ok(sameStamp.ok, 'with equal start times the higher attempt wins');
  eq(runGroupKey({ workflow_id: 7, event: 'schedule' }), 'id:7|schedule', 'runs group by workflow id and event');
  eq(runGroupKey({ path: 'a.yml', event: 'push' }), 'path:a.yml|push', 'without a workflow id the path identifies the workflow');
  const latest = latestCheckRuns([
    { name: 'J', status: 'completed', conclusion: 'failure', completed_at: '2026-10-18T10:00:00Z' },
    { name: 'J', status: 'completed', conclusion: 'success', completed_at: '2026-10-18T11:00:00Z' }
  ]);
  eq(latest.get('J').conclusion, 'success', 'a rerun replaces the earlier attempt of the same check');

  // The promotion commands are the ones release-policy.md prints; the verify
  // command takes the engine production serves.
  const policy = read('docs/release/release-policy.md');
  const commands = promotionCommands(SHA, { engine: 'sqlite' });
  for (const generic of ['git merge-base --is-ancestor <approved-sha> origin/main', 'git merge-base --is-ancestor origin/deploy/production <approved-sha>', 'git push origin <approved-sha>:refs/heads/deploy/production']) {
    ok(policy.includes(generic), `release-policy.md still documents: ${generic}`);
    ok(commands.some(line => line.startsWith(generic.replace(/<approved-sha>/g, SHA))), `promotion prints: ${generic.replace(/<approved-sha>/g, '<sha>')}`);
  }
  ok(commands.some(line => line.includes(`${PRODUCTION_ORIGIN}/v1/health`)), 'promotion ends with the production health check');
  ok(commands.some(line => /--engine sqlite --persistent-storage-proven --auth-email-proven$/.test(line)), 'on SQLite the verify command asks for the persistent-storage proof');
  ok(promotionCommands(SHA, { engine: 'postgres' }).some(line => /--engine postgres --auth-email-proven$/.test(line)) && !promotionCommands(SHA, { engine: 'postgres' }).some(line => /persistent-storage/.test(line)), 'on Postgres the verify command names postgres and no storage proof');
  assert.throws(() => promotionCommands(SHA), /production engine/, 'the promotion commands cannot be printed without the engine'); count += 1;

  // ── evidence fixtures: a device ledger and a reader-evaluation directory ──
  // A reader report that clears Gate C's floors (READER_FLOORS), measured inside
  // the fixture Release Candidate run's window (09:00–11:00 on 30 Oct).
  const READER_CORPUS = { writers: 24, samples: 1200, split: 'test' };
  const READER_RESULTS = { exact: 1190, lines: 1200, charPct: 99.8, worstWriterExactPct: 95.0, providerErrors: 0 };
  function evidence({ device = 'complete', reader = 'at-sha', readerFields = {} } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'pri-nominate-evidence-'));
    scratch.push(dir);
    const ledger = join(dir, 'results.jsonl');
    const lines = [];
    if (device !== 'none') {
      for (const kase of CASES) {
        const android = kase.family === 'AND' || kase.family === 'ANT';
        const failing = device === 'one-fail' && kase.id === 'DM-IPH-02-OTP';
        const sha = device === 'other-sha' ? OTHER : SHA;
        const blocked = device === 'all-blocked' || (device === 'android-blocked' && android);
        if (!blocked && android) {
          lines.push(JSON.stringify({ recordedAt: '2026-10-19T01:00:00Z', case: kase.id, result: 'pass', device: kase.family === 'AND' ? 'Pixel 8' : 'Galaxy Tab S9', os: 'Android 15', pencil: kase.family === 'ANT' && kase.pencil ? 'S Pen' : null, build: 'Play internal 4.0 (2)', buildKind: 'play-internal', server: 'staging', sha, tester: 'Priya Example', notes: null, evidenceClass: 'PHYSICAL-HUMAN', recorder: 'scripts/device-matrix-record.mjs' }));
          continue;
        }
        lines.push(JSON.stringify(blocked
          ? { recordedAt: '2026-10-19T01:00:00Z', case: kase.id, result: 'blocked', device: null, os: null, pencil: null, build: null, sha, tester: null, notes: 'no device of this family available', evidenceClass: 'BLOCKED-EXTERNAL', recorder: 'scripts/device-matrix-record.mjs' }
          : { recordedAt: '2026-10-19T01:00:00Z', case: kase.id, result: failing ? 'fail' : 'pass', device: kase.family === 'IPH' ? 'iPhone 16 Pro' : 'iPad Pro 11-inch (4th generation)', os: kase.family === 'IPH' ? 'iOS 26.0.1' : 'iPadOS 26.0.1', pencil: kase.pencil ? 'Apple Pencil Pro' : null, build: 'TestFlight 1.0 (2)', buildKind: 'testflight', server: 'staging', severity: failing ? 'P1' : null, sha, tester: 'Priya Example', notes: failing ? 'the code arrived but the field did not autofill' : null, evidenceClass: 'PHYSICAL-HUMAN', recorder: 'scripts/device-matrix-record.mjs' }));
      }
      if (device === 'one-missing') lines.pop();
    }
    writeFileSync(ledger, lines.length ? lines.join('\n') + '\n' : '');
    const readerDir = join(dir, 'cloud-reader-eval');
    mkdirSync(readerDir);
    if (reader !== 'none') {
      writeFileSync(join(readerDir, '2026-10-30.json'), JSON.stringify({
        format: 'pri-cloud-reader-eval', version: 1, evidenceClass: reader === 'dry-run' ? 'synthetic-dry-run' : 'real-human', measuredAt: '2026-10-30T10:00:00Z',
        releaseSha: reader === 'other-sha' ? OTHER : reader === 'no-sha' ? undefined : SHA, corpus: READER_CORPUS, results: READER_RESULTS, ...readerFields
      }));
    }
    return { dir, ledger, readerDir };
  }
  // Every case of the two Apple families (the matrix grows by group; the counts follow CASES).
  const APPLE_CASES = CASES.filter(c => c.family === 'IPH' || c.family === 'IPD').length;
  {
    const full = evidence();
    eq(validateLedger(full.ledger).length, 0, 'the complete device fixture passes the recorder\'s own validation (it is what a real ledger would hold)');
    const dev = deviceEvidence(SHA, { ledger: full.ledger });
    ok(dev.ok && dev.counts.pass === CASES.length && dev.counts.blocked === 0 && /device-complete/.test(dev.detail), 'deviceEvidence: every case of all four families passed on real hardware is device-complete');
    const androidBlocked = deviceEvidence(SHA, { ledger: evidence({ device: 'android-blocked' }).ledger });
    ok(!androidBlocked.ok && androidBlocked.counts.pass === APPLE_CASES && androidBlocked.counts.blocked === CASES.length - APPLE_CASES && androidBlocked.incompleteFamilies.join(',') === 'AND,ANT' && /never acceptance/.test(androidBlocked.detail),
      'deviceEvidence: Android families blocked for lack of hardware are reported by name and are NOT device-complete (V1 scope §22.1: each device class)');
    const allBlocked = deviceEvidence(SHA, { ledger: evidence({ device: 'all-blocked' }).ledger });
    ok(!allBlocked.ok && allBlocked.counts.pass === 0 && allBlocked.counts.blocked === CASES.length, `deviceEvidence: a matrix of ${CASES.length} blocked rows and no physical pass is not acceptance (Q4 #696 counterexample)`);
    ok(!deviceEvidence(OTHER, { ledger: full.ledger }).ok, 'deviceEvidence: another SHA has no evidence of its own');
    ok(!deviceEvidence(SHA, { ledger: evidence({ device: 'one-fail' }).ledger }).ok, 'deviceEvidence: one fail is incomplete');
    ok(!deviceEvidence(SHA, { ledger: evidence({ device: 'one-missing' }).ledger }).ok, 'deviceEvidence: one not-run case is incomplete');
    const rd = readerEvidence(SHA, { dir: full.readerDir });
    ok(rd.ok && rd.file === '2026-10-30.json' && /24 writer/.test(rd.detail) && /clears Gate C floors/.test(rd.detail), 'readerEvidence: a real-human report naming the SHA and clearing Gate C\'s floors counts');
    // Gate C's floors (Q4 #696 holdout 13: 0/1 exact from 1 writer is not a measurement).
    const C = fields => ({ ...READER_CORPUS, ...fields });
    const R = fields => ({ ...READER_RESULTS, ...fields });
    const floorDrifts = [
      ['the Q4 holdout: 0/1 exact from one writer', { corpus: { writers: 1, samples: 1, split: 'test' }, results: { exact: 0, lines: 1 } }, /1 writer\(s\), floor 20/],
      ['the old fixture: 31/40 from 3 writers', { corpus: C({ writers: 3, samples: 40 }), results: R({ exact: 31, lines: 40 }) }, /3 writer\(s\), floor 20/],
      ['19 writers', { corpus: C({ writers: 19 }) }, /19 writer\(s\), floor 20/],
      ['999 expressions', { results: R({ exact: 999, lines: 999 }) }, /999 expression\(s\) read, floor 1000/],
      ['the train split', { corpus: C({ split: 'train' }) }, /split train, not the writer-disjoint test split/],
      ['no split', { corpus: { writers: 24, samples: 1200 } }, /split \(none\)/],
      ['97.83% exact', { results: R({ exact: 1174 }) }, /exact 97\.83%/],
      ['98% read but 30 provider errors (96.75% of expressions)', { results: R({ exact: 1190, providerErrors: 30 }) }, /exact 96\.75% \(provider errors count as misreads\)/],
      ['characters 99.4%', { results: R({ charPct: 99.4 }) }, /characters 99\.4%, floor 99\.5%/],
      ['no character rate', { results: R({ charPct: null }) }, /characters \?%/],
      ['worst writer 89.9%', { results: R({ worstWriterExactPct: 89.9 }) }, /worst writer 89\.9%, floor 90%/],
      ['no worst-writer rate', { results: R({ worstWriterExactPct: undefined }) }, /worst writer \?%/],
      ['more exact lines than lines (impossible counts)', { results: R({ exact: 1300 }) }, /exact \?%/],
      ['a negative error count', { results: R({ providerErrors: -5 }) }, /providerErrors is not a count/],
      ['writers as text', { corpus: C({ writers: 'many' }) }, /\? writer\(s\)/]
    ];
    for (const [name, fields, pattern] of floorDrifts) {
      const below = readerEvidence(SHA, { dir: evidence({ readerFields: fields }).readerDir });
      ok(!below.ok && pattern.test(below.detail) && /below Gate C floors/.test(below.detail), `readerEvidence: ${name} is named and refused (${below.detail})`);
    }
    ok(readerEvidence(SHA, { dir: evidence({ readerFields: { results: R({ exact: 1176 }) } }).readerDir }).ok, 'readerEvidence: exactly 98.00% exact, 99.5% characters and 90% worst writer at 20 writers and 1,000 expressions is the floor, not below it');
    ok(readerEvidence(SHA, { dir: evidence({ readerFields: { corpus: C({ writers: 20 }), results: R({ exact: 980, lines: 1000, charPct: 99.5, worstWriterExactPct: 90 }) } }).readerDir }).ok, 'readerEvidence: a report exactly at every floor clears it');
    eq(readerFloorProblems({ corpus: READER_CORPUS, results: READER_RESULTS }).length, 0, 'readerFloorProblems: the fixture clears every floor');
    {
      const gate = read('client/test/ink-release-evidence-gate.mjs');
      const num = key => Number(new RegExp(`${key}:\\s*([0-9.]+)`).exec(gate)?.[1]);
      ok(num('minTestWriters') === READER_FLOORS.minWriters && num('minTestExpressions') === READER_FLOORS.minLines && num('minExactPct') === READER_FLOORS.minExactPct
        && num('minCharPct') === READER_FLOORS.minCharPct && num('minWorstWriterExactPct') === READER_FLOORS.minWorstWriterExactPct && READER_FLOORS.split === 'test',
        'the reader floors are Gate C\'s numbers in client/test/ink-release-evidence-gate.mjs: neither copy can drift lower alone');
    }
    ok(!readerEvidence(SHA, { dir: evidence({ reader: 'dry-run' }).readerDir }).ok, 'readerEvidence: a dry run (synthetic) never counts');
    ok(/none records releaseSha/.test(readerEvidence(SHA, { dir: evidence({ reader: 'other-sha' }).readerDir }).detail), 'readerEvidence: a report for another SHA is named, not accepted');
    ok(/NOT MEASURED/.test(readerEvidence(SHA, { dir: join(full.dir, 'absent') }).detail), 'readerEvidence: no directory is NOT MEASURED');
    ok(!readerEvidence(SHA, { dir: evidence({ reader: 'no-sha' }).readerDir }).ok, 'readerEvidence: a report without releaseSha cannot be tied to the SHA');
  }
  const overrideFile = (body, name = 'override.json') => { const dir = mkdtempSync(join(tmpdir(), 'pri-override-')); scratch.push(dir); const file = join(dir, name); writeFileSync(file, typeof body === 'string' ? body : JSON.stringify(body)); return file; };
  const APPROVER = 'Priysharan19';
  const approvalUrl = id => `https://github.com/${DEFAULT_REPO_FOR_TESTS}/issues/686#issuecomment-${id}`;
  const issueUrl = number => `https://github.com/${DEFAULT_REPO_FOR_TESTS}/issues/${number}`;
  const goodOverride = { sha: SHA, scope: 'public-release', waives: ['device-matrix', 'reader-evidence'], by: 'Priya Example', githubLogin: APPROVER, approval: approvalUrl(1001), at: '2026-11-01T09:00:00Z', reason: 'Owner-approved staggered launch: Apple first, Android families follow on a later build (scope change recorded).' };
  eq(loadOverride(overrideFile(goodOverride), SHA).problems.length, 0, 'a complete override by a named human for this SHA is accepted');
  ok(loadOverride(overrideFile({ ...goodOverride, sha: OTHER }), SHA).problems.some(p => /not the nominated/.test(p)), 'an override for another SHA is refused');
  ok(loadOverride(overrideFile({ ...goodOverride, by: 'CI' }), SHA).problems.some(p => /does not name a human/.test(p)), 'an override "by" CI is refused');
  ok(loadOverride(overrideFile({ ...goodOverride, by: 'Claude agent' }), SHA).problems.some(p => /does not name a human/.test(p)), 'an override "by" an agent is refused');
  ok(loadOverride(overrideFile({ ...goodOverride, waives: ['everything'] }), SHA).problems.some(p => /unknown evidence requirement/.test(p)), 'an override may only waive a known requirement by name');
  ok(loadOverride(overrideFile({ ...goodOverride, waives: [] }), SHA).problems.some(p => /waives nothing/.test(p)), 'an override that waives nothing is refused');
  ok(loadOverride(overrideFile({ ...goodOverride, reason: 'because' }), SHA).problems.some(p => /reason/.test(p)), 'an override needs a reason');
  ok(loadOverride(overrideFile({ ...goodOverride, at: 'yesterday' }), SHA).problems.some(p => /ISO date-time/.test(p)), 'an override needs an ISO time');
  ok(loadOverride(overrideFile({ ...goodOverride, scope: undefined }), SHA).problems.some(p => /"scope"/.test(p)), 'an override must say whether it is a public-release waiver or an internal test-track exception');
  ok(loadOverride(overrideFile({ ...goodOverride, githubLogin: '' }), SHA).problems.some(p => /githubLogin/.test(p)), 'an override must name the approver\'s GitHub account');
  ok(loadOverride(overrideFile({ ...goodOverride, approval: undefined }), SHA).problems.some(p => /approval/.test(p)), 'an unsigned override (no approving comment) is refused (Q4 #696 counterexample)');
  ok(loadOverride(overrideFile({ ...goodOverride, approval: 'https://example.com/ok' }), SHA).problems.some(p => /approval/.test(p)), 'an approval that is not a GitHub comment link is refused');
  ok(loadOverride(overrideFile('not json'), SHA).problems.some(p => /not JSON/.test(p)), 'a corrupt override is refused');
  ok(loadOverride(join(tmpdir(), 'pri-no-such-override.json'), SHA).problems.some(p => /no such file/.test(p)), 'a missing override file is refused');
  assert.deepEqual([...EVIDENCE_REQUIREMENTS], ['device-matrix', 'device-matrix:AND', 'device-matrix:ANT', 'reader-evidence'], 'the release-evidence requirements: the whole matrix, the two Android families (D1), the reader'); count += 1;
  assert.deepEqual({ ...DEVICE_FAMILY_WAIVERS }, { 'device-matrix:AND': 'AND', 'device-matrix:ANT': 'ANT' }, 'only the two Android families have a family waiver'); count += 1;
  assert.deepEqual([...NEVER_WAIVED_FAMILIES], ['IPH', 'IPD'], 'iPhone and iPad are never waived'); count += 1;
  ok(Object.values(DEVICE_FAMILY_WAIVERS).every(f => FAMILIES.some(family => family.id === f)) && NEVER_WAIVED_FAMILIES.every(f => FAMILIES.some(family => family.id === f)), 'every family named here is a family of the device matrix');
  for (const apple of ['device-matrix:IPH', 'device-matrix:IPD', 'device-matrix:iph']) {
    ok(loadOverride(overrideFile({ ...goodOverride, waives: [apple] }), SHA).problems.some(p => /no family waiver covers an iPhone or iPad case/.test(p)), `an override waiving ${apple} is refused by name`);
  }
  ok(loadOverride(overrideFile({ ...goodOverride, waives: ['device-matrix', 'device-matrix:AND'] }), SHA).problems.some(p => /the whole device matrix or named Android families, not both/.test(p)), 'an override cannot waive the whole matrix and a family at once');
  eq(loadOverride(overrideFile({ ...goodOverride, waives: ['device-matrix:ANT', 'device-matrix:AND'] }), SHA).problems.length, 0, 'an override waiving the two Android families by name is well-formed');
  eq(waiverMarker(SHA, ['device-matrix:ANT', 'device-matrix:AND', 'reader-evidence']), `Pri-Evidence-Waiver: ${SHA} scope=public-release target=deploy/production waives=device-matrix:AND,device-matrix:ANT,reader-evidence`, 'the approval marker lists family waivers by name, sorted');

  // ── the stubbed world ─────────────────────────────────────────────────────
  function world(evidenceOptions = {}) {
    const ev = evidence(evidenceOptions);
    const w = {
      mainAncestors: new Set([SHA, OTHER]), tip: OTHER, knownCommits: new Set([SHA, OTHER, PROD_POINTER]), prodPointer: PROD_POINTER, ffFromProd: true,
      schemaSource,
      runs: [
        { name: 'CI', workflow_id: 1, path: '.github/workflows/ci.yml', event: 'push', status: 'completed', conclusion: 'success', run_started_at: '2026-10-18T00:10:00Z' },
        { name: 'Release Staging Proof', workflow_id: 9, path: '.github/workflows/release-staging-proof.yml', event: 'workflow_run', status: 'completed', conclusion: 'success', run_started_at: '2026-10-18T00:40:00Z', html_url: 'https://github.com/x/y/actions/runs/1' },
        { id: 77, name: 'Release Candidate', display_title: releaseCandidateTitle(SHA), workflow_id: 12, path: RELEASE_CANDIDATE_WORKFLOW, head_sha: SHA, event: 'workflow_dispatch', status: 'completed', conclusion: 'success', run_started_at: '2026-10-30T09:00:00Z', updated_at: '2026-10-30T11:00:00Z', html_url: 'https://github.com/x/y/actions/runs/77' }
      ],
      rcJobs: RELEASE_CANDIDATE_JOBS.map((name, id) => ({ id, name, status: 'completed', conclusion: 'success' })),
      rcArtifacts: [{ id: 501, name: readerArtifactName(SHA), expired: false }],
      checks: [...REQUIRED_CONTEXTS, CONTAINER_CONTEXT].map(name => ({ name, status: 'completed', conclusion: 'success', completed_at: '2026-10-18T12:00:00Z' })),
      staging: {
        health: { ok: true, service: 'pri-learning-platform', releaseIdentity: { releaseSha: SHA, buildTimestamp: '2026-10-18T00:00:00.000Z' }, schemaVersion: String(SCHEMA_VERSION), billingSchemaVersion: String(BILLING_SCHEMA_VERSION), database: { engine: 'postgres', reachable: true } },
        ready: { ready: true, state: 'ready', failing: [], degraded: [], checks: { database: { state: 'ok', engine: 'postgres', schemaVersion: String(SCHEMA_VERSION), billingSchemaVersion: String(BILLING_SCHEMA_VERSION) } } },
        readyStatus: 200,
        web: { releaseSha: SHA }
      },
      production: { health: { ok: true, releaseIdentity: { releaseSha: PROD_POINTER }, database: { engine: 'sqlite', reachable: true } }, reachable: true },
      ledger: ev.ledger, readerDir: ev.readerDir,
      commitTime: '2026-10-17T00:00:00Z',
      comments: new Map(), issues: new Map(), permissions: new Map([[APPROVER.toLowerCase(), 'admin'], ['someone-else', 'write']]),
      gitCalls: [], ghCalls: []
    };
    // An approving comment on the fake GitHub: { id, body, login, type, created, updated, issue }.
    w.approve = (id, body, { login = APPROVER, type = 'User', created = '2026-11-01T09:00:00Z', updated = created, issue = 686 } = {}) => {
      w.comments.set(String(id), { id, body, user: { login, type }, created_at: created, updated_at: updated, issue_url: `https://api.github.com/repos/${DEFAULT_REPO_FOR_TESTS}/issues/${issue}` });
      return approvalUrl(id);
    };
    // An approving ISSUE (opened from a prefilled link): GraphQL shape, lastEditedAt null unless edited.
    w.approveIssue = (number, body, { login = APPROVER, type = 'User', created = '2026-11-01T09:00:00Z', edited = null, state = 'OPEN', closed = 0 } = {}) => {
      w.issues.set(Number(number), { number: Number(number), author: login === null ? null : { login, __typename: type }, createdAt: created, lastEditedAt: edited, state, timelineItems: { totalCount: closed }, body });
      return issueUrl(number);
    };
    w.ghGraphql = async (query, variables) => {
      w.ghCalls.push(`graphql ${JSON.stringify(variables)}`);
      if (`${variables.owner}/${variables.name}` !== DEFAULT_REPO_FOR_TESTS) return { repository: null };
      return { repository: { issue: w.issues.get(Number(variables.number)) ?? null } };
    };
    w.git = async args => {
      w.gitCalls.push(args.join(' '));
      const [cmd] = args;
      if (cmd === 'fetch') return '';
      if (cmd === 'rev-parse' && args[1] === '--verify') {
        const ref = args[3];
        if (ref === 'origin/deploy/production') { if (w.prodPointer) return w.prodPointer + '\n'; throw new Error('unknown'); }
        const sha = ref.replace(/\^\{commit\}$/, '');
        if (w.knownCommits.has(sha)) return sha + '\n';
        throw new Error('unknown revision');
      }
      if (cmd === 'rev-parse' && args[1] === 'origin/main') return w.tip + '\n';
      if (cmd === 'merge-base') {
        const [, , a, b] = args;
        if (b === 'origin/main') { if (w.mainAncestors.has(a)) return ''; throw new Error('not an ancestor'); }
        if (a === w.prodPointer) { if (w.ffFromProd) return ''; throw new Error('not an ancestor'); }
        throw new Error('not an ancestor');
      }
      if (cmd === 'rev-list') return '1\n';
      if (cmd === 'show' && args[1] === '-s' && args[2] === '--format=%cI') return w.commitTime + '\n';
      if (cmd === 'show') return w.schemaSource;
      throw new Error(`unexpected git ${args.join(' ')}`);
    };
    w.gh = async path => {
      w.ghCalls.push(path);
      let rm = /\/actions\/runs\/(\d+)\/(jobs|artifacts)\?/.exec(path);
      if (rm) return rm[2] === 'jobs' ? { jobs: rm[1] === '77' ? w.rcJobs : [] } : { artifacts: rm[1] === '77' ? w.rcArtifacts : [] };
      if (path.includes('/actions/runs')) return { workflow_runs: path.includes(`head_sha=${SHA}`) ? w.runs : (w.tipRuns || []) };
      if (path.includes('/check-runs')) return { check_runs: w.checks };
      let m = /\/issues\/comments\/(\d+)$/.exec(path);
      if (m) { if (!w.comments.has(m[1])) throw new Error('HTTP 404: Not Found'); return w.comments.get(m[1]); }
      m = /\/collaborators\/([^/]+)\/permission$/.exec(path);
      if (m) return { permission: w.permissions.get(decodeURIComponent(m[1]).toLowerCase()) || 'none' };
      throw new Error(`unexpected gh ${path}`);
    };
    w.fetchImpl = async url => {
      const u = new URL(url);
      const origin = u.origin, path = u.pathname;
      const json = (status, body) => ({ status, json: async () => body });
      if (origin === STAGING_ORIGIN) {
        if (path === '/v1/health') return json(200, w.staging.health);
        if (path === '/v1/ready') return json(w.staging.readyStatus, w.staging.ready);
        if (path === '/release.json') return json(200, w.staging.web);
      }
      if (origin === PRODUCTION_ORIGIN && path === '/v1/health') { if (!w.production.reachable) throw new Error('ECONNREFUSED'); return json(200, w.production.health); }
      return json(404, null);
    };
    return w;
  }
  const run = (w, extra = {}) => nominate({ sha: SHA, git: w.git, gh: w.gh, ghGraphql: w.ghGraphql, fetchImpl: w.fetchImpl, fetchOrigin: true, deviceLedger: w.ledger, readerEvalDir: w.readerDir, ...extra });
  const failed = report => report.results.filter(r => r.ok === false).map(r => r.label);

  const good = world();
  const pass = await run(good);
  ok(pass.ok, `a green, deployed, fast-forwardable SHA with complete evidence is nominated (failed: ${failed(pass).join('; ')})`);
  ok(pass.stage === 'release' && pass.engine === 'sqlite' && pass.overrides.length === 0, 'the default run is the release stage, on the evidence, with the engine production serves');
  ok(pass.promotion.length === promotionCommands(SHA, { engine: 'sqlite' }).length && pass.promotion.some(line => /--engine sqlite --persistent-storage-proven/.test(line)), 'a nomination prints the promotion commands with the deployed engine (SQLite today)');
  ok(pass.results.some(r => r.ok === true && /device matrix complete/.test(r.label)) && pass.results.some(r => r.ok === true && /reader evaluation recorded/.test(r.label)), 'the device matrix and the reader evidence are checks, not reminders');
  ok(good.gitCalls.every(call => !/\bpush\b/.test(call)), 'nominate never runs git push');
  ok(good.gitCalls.some(call => call.startsWith('fetch')), 'nominate fetches origin first');
  ok(good.ghCalls.some(p => p.includes(`head_sha=${SHA}`)), 'nominate asks GitHub for the runs on exactly this SHA');
  {
    // Pagination: a required context on page 2 of 101 check runs is found; a list
    // that never ends is refused, not truncated.
    const pages = [];
    const paged = async path => { const page = Number(new URL(`https://x/${path}`).searchParams.get('page')); pages.push(page); return { check_runs: page === 1 ? Array.from({ length: 100 }, (_, i) => ({ name: `filler-${i}` })) : [{ name: 'the one' }] }; };
    const all = await ghAll(paged, 'repos/r/commits/s/check-runs?per_page=100', 'check_runs');
    ok(all.length === 101 && all.at(-1).name === 'the one' && pages.join(',') === '1,2', 'ghAll follows pages until a short one and keeps every item');
    eq((await ghAll(async () => ({ workflow_runs: [{ name: 'a' }] }), 'p?per_page=100', 'workflow_runs')).length, 1, 'a single short page is one call');
    await assert.rejects(ghAll(async () => ({ check_runs: Array.from({ length: 100 }, () => ({})) }), 'p?per_page=100', 'check_runs'), /truncated/, 'an endless list is refused'); count += 1;
  }
  ok(pass.results.some(r => r.label.startsWith('position on origin/main') && /behind/.test(r.detail)), 'a certified SHA need not be the tip; the position is informational');

  // The deployed engine drives the verify command.
  const pg = world(); pg.production.health.database.engine = 'postgres';
  const pgReport = await run(pg);
  ok(pgReport.ok && pgReport.engine === 'postgres' && pgReport.promotion.some(line => /--engine postgres --auth-email-proven$/.test(line)) && !pgReport.promotion.some(line => /persistent-storage/.test(line)), 'when production serves Postgres the verify command says postgres and drops the SQLite storage proof');
  const cutover = await run(world(), { productionEngine: 'postgres' });
  ok(cutover.ok && cutover.engine === 'postgres' && cutover.results.some(r => /given with --production-engine/.test(r.detail || '')), '--production-engine postgres prints the post-cutover verify command although production serves SQLite now');
  const dark = world(); dark.production.reachable = false;
  const darkReport = await run(dark);
  ok(!darkReport.ok && failed(darkReport).some(l => /engine known/.test(l)), 'an unreachable production with no --production-engine refuses: the verify command would guess');
  ok((await run(dark, { productionEngine: 'sqlite' })).ok, 'an unreachable production is nominated when the engine is given explicitly');
  const noEngine = world(); delete noEngine.production.health.database;
  ok(!(await run(noEngine)).ok, 'a production health without an engine refuses without --production-engine');

  // The candidate stage: everything but the evidence, and no promotion.
  const early = world({ device: 'none', reader: 'none' });
  const earlyReport = await run(early, { stage: 'candidate' });
  ok(earlyReport.ok && earlyReport.stage === 'candidate' && earlyReport.promotion.length === 0, 'the candidate stage passes without evidence and prints no promotion');
  ok(earlyReport.results.some(r => r.ok === null && /release evidence/.test(r.label) && /not checked at the candidate stage/.test(r.detail)), 'the candidate stage says the evidence is not yet required');
  ok(!(await run(early)).ok, 'the same world fails at the release stage');
  await assert.rejects(run(world(), { stage: 'later' }), /stage must be/, 'an unknown stage is refused'); count += 1;

  // The evidence gate at the release stage.
  const evidenceDrifts = [
    ['no device evidence at all', { device: 'none' }, /device matrix complete/],
    ['one device case not run', { device: 'one-missing' }, /device matrix complete/],
    ['one device case failed', { device: 'one-fail' }, /device matrix complete/],
    ['device evidence for another build', { device: 'other-sha' }, /device matrix complete/],
    ['no reader evaluation', { reader: 'none' }, /reader evaluation recorded/],
    ['a dry-run reader evaluation', { reader: 'dry-run' }, /reader evaluation recorded/],
    ['a reader evaluation of another SHA', { reader: 'other-sha' }, /reader evaluation recorded/]
  ];
  for (const [name, options, label] of evidenceDrifts) {
    const report = await run(world(options));
    ok(!report.ok && report.promotion.length === 0 && failed(report).some(l => label.test(l)), `refuses ${name} at the release stage (failed: ${failed(report).join('; ') || 'none'})`);
  }
  {
    // The strict Release Candidate gates on exactly this SHA (Q4 #696 holdout 17
    // and the exact-SHA binding hazard): attributed to the SHA, named after the
    // commit it checked out, completed `success`, both blocking jobs `success`.
    const rcRun = w => w.runs.find(r => r.path === RELEASE_CANDIDATE_WORKFLOW);
    const rcDrifts = [
      ['no Release Candidate run on the SHA (Q4 holdout 17)', w => { w.runs = w.runs.filter(r => r.path !== RELEASE_CANDIDATE_WORKFLOW); }],
      ['a run dispatched with another release_sha (it tested another commit)', w => { rcRun(w).display_title = releaseCandidateTitle(OTHER); }],
      ['a run of a workflow version without the exact-SHA binding (plain run name)', w => { rcRun(w).display_title = 'Release Candidate'; }],
      ['a run attributed to another commit', w => { rcRun(w).head_sha = OTHER; }],
      ['a run of another workflow file that borrows the title', w => { rcRun(w).path = '.github/workflows/ci.yml'; }],
      ['a red Release Candidate run', w => { rcRun(w).conclusion = 'failure'; }],
      ['a cancelled Release Candidate run', w => { rcRun(w).conclusion = 'cancelled'; }],
      ['a skipped Release Candidate run (green to the workflow summary, proof of nothing)', w => { rcRun(w).conclusion = 'skipped'; }],
      ['a Release Candidate run still in progress', w => { Object.assign(rcRun(w), { status: 'in_progress', conclusion: null }); }],
      ['a skipped handwriting-gates job', w => { w.rcJobs[0].conclusion = 'skipped'; }],
      ['a failed release-identity job', w => { w.rcJobs[1].conclusion = 'failure'; }],
      ['a run without the release-identity job', w => { w.rcJobs = w.rcJobs.slice(0, 1); }],
      ['a newer red Release Candidate run after an older green one', w => { w.runs.push({ ...rcRun(w), id: 78, conclusion: 'failure', run_started_at: '2026-10-31T09:00:00Z', updated_at: '2026-10-31T11:00:00Z' }); }]
    ];
    for (const [name, drift] of rcDrifts) {
      const w = world(); drift(w);
      const report = await run(w);
      ok(!report.ok && report.promotion.length === 0 && failed(report).some(l => /Release Candidate/.test(l)), `refuses ${name} (failed: ${failed(report).join('; ')})`);
    }
    const only = world(); only.runs = only.runs.filter(r => r.path !== RELEASE_CANDIDATE_WORKFLOW);
    const onlyReport = await run(only);
    const onlyFailed = failed(onlyReport);
    ok(!onlyReport.ok && onlyFailed.length === 2 && /strict Release Candidate gates passed on exactly this SHA/.test(onlyFailed[0]) && /reader evaluation recorded/.test(onlyFailed[1])
      && onlyReport.results.some(r => r.ok === false && /no passing Release Candidate run on this SHA/.test(r.detail || '')),
      `with every CI context green and the device matrix complete, a missing exact-SHA Release Candidate run alone refuses the release, and the reader report cannot be bound without it (failed: ${onlyFailed.join('; ')})`);
    const onlyCandidate = await run(only, { stage: 'candidate' });
    ok(onlyCandidate.ok && onlyCandidate.promotion.length === 0, 'the candidate stage does not need the Release Candidate run, and prints no promotion');
    const waiveAll = world({ device: 'none', reader: 'none' }); waiveAll.runs = waiveAll.runs.filter(r => r.path !== RELEASE_CANDIDATE_WORKFLOW);
    waiveAll.approve(1009, `${waiverMarker(SHA, ['device-matrix', 'reader-evidence'])}\nApproved.\n`);
    const waiveAllReport = await run(waiveAll, { overridePath: overrideFile({ ...goodOverride, approval: approvalUrl(1009) }) });
    ok(!waiveAllReport.ok && failed(waiveAllReport).some(l => /strict Release Candidate gates/.test(l)), 'an approved waiver of both evidence rows never waives the strict Release Candidate gates');
    const bound = await run(world());
    ok(bound.ok && bound.results.some(r => r.ok === true && /reader evaluation recorded/.test(r.label) && /measured by Release Candidate run 77 \(artifact cloud-reader-eval-a{40}, id 501\)/.test(r.detail)), 'the accepted reader row names the Release Candidate run and artifact that measured it');
    eq(bound.results.filter(r => r.ok === true && /^Release Candidate job passed \(not skipped\): /.test(r.label)).length, RELEASE_CANDIDATE_JOBS.length, 'each blocking Release Candidate job is its own check');
    const unbound = async (name, mutate, pattern, options) => {
      const w = world(options); mutate(w);
      const report = await run(w);
      ok(!report.ok && failed(report).length === 1 && /reader evaluation recorded/.test(failed(report)[0]) && report.results.some(r => r.ok === false && pattern.test(r.detail || '')), `${name} is not release evidence (failed: ${failed(report).join('; ')})`);
    };
    await unbound('a reader report the Release Candidate run did not measure (no artifact)', w => { w.rcArtifacts = []; }, /run 77 has no unexpired artifact cloud-reader-eval-a{40}/);
    await unbound('a reader report whose artifact expired', w => { w.rcArtifacts[0].expired = true; }, /no unexpired artifact/);
    await unbound('a reader report backed only by another commit\'s artifact', w => { w.rcArtifacts[0].name = readerArtifactName(OTHER); }, /no unexpired artifact cloud-reader-eval-a{40}/);
    await unbound('a reader report measured before the Release Candidate run', () => {}, /measuredAt 2026-10-29T10:00:00Z is outside run 77/, { readerFields: { measuredAt: '2026-10-29T10:00:00Z' } });
    await unbound('a reader report measured after the Release Candidate run', () => {}, /is outside run 77/, { readerFields: { measuredAt: '2026-10-30T12:00:00Z' } });
    await unbound('a reader report with no measuredAt', () => {}, /measuredAt \? is outside run 77/, { readerFields: { measuredAt: undefined } });
    eq(releaseCandidateRun([], SHA), null, 'releaseCandidateRun: no runs, no run');
    eq(releaseCandidateRun([{ path: `${RELEASE_CANDIDATE_WORKFLOW}@refs/heads/main`, head_sha: SHA, display_title: releaseCandidateTitle(SHA), id: 5 }], SHA)?.id, 5, 'releaseCandidateRun: a path with a @ref suffix is the same workflow file');
    eq(releaseCandidateRun([{ path: RELEASE_CANDIDATE_WORKFLOW, head_sha: SHA.toUpperCase(), display_title: releaseCandidateTitle(SHA) }], SHA), null, 'releaseCandidateRun: the SHA comparison is exact');
    // The workflow side of the binding: the run name is the checked-out commit, and both jobs prove it.
    const wf = read('.github/workflows/release-candidate.yml');
    ok(/^run-name: Release Candidate · \$\{\{ inputs\.release_sha \|\| github\.sha \}\}$/m.test(wf) && releaseCandidateTitle(SHA) === `Release Candidate · ${SHA}`, 'release-candidate.yml names every run after the commit it checks out, the exact title nominate() accepts');
    eq((wf.match(/^ {10}ref: \$\{\{ inputs\.release_sha \|\| github\.sha \}\}$/gm) || []).length, 2, 'both Release Candidate jobs check out that exact commit, never a moving branch');
    ok(!/ref: \$\{\{[^}]*github\.ref[^}]*\}\}/.test(wf), 'no Release Candidate checkout follows github.ref (a branch can move between dispatch and checkout)');
    eq((wf.match(/EXPECTED: \$\{\{ inputs\.release_sha \|\| github\.sha \}\}/g) || []).length, 2, 'both jobs receive the named commit through the environment, not interpolated into the script');
    eq((wf.match(/\[\[ "\$EXPECTED" =~ \^\[0-9a-f\]\{40\}\$ \]\]/g) || []).length, 2, 'both jobs refuse a release_sha that is not a full 40-hex lowercase SHA');
    eq((wf.match(/\[ "\$sha" = "\$EXPECTED" \] \|\| \{ echo "::error::checked out/g) || []).length, 2, 'both jobs fail when HEAD is not the named commit');
    for (const name of RELEASE_CANDIDATE_JOBS) ok(wf.includes(`    name: ${name}\n`), `the blocking job nominate() requires exists in release-candidate.yml: ${name}`);
    ok(wf.includes('name: cloud-reader-eval-${{ steps.candidate.outputs.sha }}') && readerArtifactName(SHA) === `cloud-reader-eval-${SHA}`, 'the artifact nominate() binds a reader report to is the one release-candidate.yml uploads');
  }
  {
    const approved = (w, override = goodOverride, id = 1001, options = {}) => { w.approve(id, `${waiverMarker(SHA, override.waives)}\nApproved.\n`, options); return w; };
    const waivedWorld = approved(world({ device: 'none', reader: 'none' }));
    const waived = await run(waivedWorld, { overridePath: overrideFile(goodOverride) });
    ok(waived.ok && waived.overrides.length === 2 && waived.overrides.every(o => o.by === 'Priya Example' && o.githubLogin === APPROVER && o.evidenceClass === 'GITHUB-ACCOUNT-AUTHENTICATED') && waived.promotion.length > 0, 'a public-release override approved on GitHub by a repository admin waives both requirements by name and the nomination says so');
    ok(waived.results.filter(r => r.ok === null && /WAIVED by recorded override/.test(r.label)).length === 2, 'each waived requirement is a visible WAIVED row, never silent');
    ok(waived.results.some(r => r.ok === true && /approved on GitHub by a repository admin/.test(r.label)), 'the GitHub approval is its own visible check');
    const staggered = await run(approved(world({ device: 'android-blocked' }), { ...goodOverride, waives: ['device-matrix'] }), { overridePath: overrideFile({ ...goodOverride, waives: ['device-matrix'] }) });
    ok(staggered.ok && staggered.overrides.length === 1 && /AND, ANT not all pass/.test(staggered.overrides[0].state), 'blocked Android families release only through an approved, visible device-matrix waiver that names them');
    ok(!(await run(world({ device: 'android-blocked' }))).ok, 'blocked Android families without a waiver refuse the release stage');

    // ── D1: Android families waived by name; an iPhone or iPad case never ──
    {
      const familyOverride = { ...goodOverride, waives: ['device-matrix:AND', 'device-matrix:ANT', 'reader-evidence'] };
      const appleOnly = await run(approved(world({ device: 'android-blocked', reader: 'none' }), familyOverride), { overridePath: overrideFile(familyOverride) });
      ok(appleOnly.ok && appleOnly.promotion.length > 0 && appleOnly.overrides.map(o => o.requirement).join(',') === 'device-matrix:AND,device-matrix:ANT,reader-evidence',
        `D1: every iPhone and iPad case passed, the two Android families waived by name: the nomination passes and lists both family waivers (failed: ${failed(appleOnly).join('; ')})`);
      ok(appleOnly.results.some(r => r.ok === true && /every family not waived \(every iPhone and iPad case pass/.test(r.label) && /every case passes in IPH, IPD/.test(r.detail)), 'the device row says the Apple families passed case by case');
      ok(appleOnly.results.filter(r => r.ok === null && /device matrix family (AND|ANT) — WAIVED by recorded override/.test(r.label)).length === 2, 'each waived Android family is its own visible WAIVED row');
      ok(appleOnly.overrides.filter(o => o.requirement.startsWith('device-matrix:')).every(o => /blocked \d+/.test(o.state) && o.githubLogin === APPROVER && o.evidenceClass === 'GITHUB-ACCOUNT-AUTHENTICATED'), 'each family override carries the family\'s state and the authenticated approver');
      const appleCase = async (name, extraLine) => {
        const w = approved(world({ device: 'android-blocked', reader: 'none' }), familyOverride);
        writeFileSync(w.ledger, readFileSync(w.ledger, 'utf8') + JSON.stringify(extraLine) + '\n');
        const report = await run(w, { overridePath: overrideFile(familyOverride) });
        ok(!report.ok && report.promotion.length === 0 && !report.overrides.some(o => o.requirement.startsWith('device-matrix')) && failed(report).some(l => /every family not waived/.test(l)),
          `D1: ${name} refuses the release even with both Android families waived`);
      };
      await appleCase('one failed iPhone case', { recordedAt: '2026-10-20T00:00:00Z', case: 'DM-IPH-02-OTP', result: 'fail', device: 'iPhone 16 Pro', os: 'iOS 26.0.1', sha: SHA, tester: 'Priya Example', notes: 'no code', evidenceClass: 'PHYSICAL-HUMAN', recorder: 'scripts/device-matrix-record.mjs' });
      await appleCase('one blocked iPad case', { recordedAt: '2026-10-20T00:00:00Z', case: 'DM-IPD-05-WRITE', result: 'blocked', sha: SHA, notes: 'no Pencil to hand', evidenceClass: 'BLOCKED-EXTERNAL', recorder: 'scripts/device-matrix-record.mjs' });
      {
        // an Apple case never run: drop the iPad Pencil case's pass from the ledger
        const w = approved(world({ device: 'android-blocked', reader: 'none' }), familyOverride);
        writeFileSync(w.ledger, readFileSync(w.ledger, 'utf8').split('\n').filter(line => !line.includes('"DM-IPD-05-WRITE"')).join('\n'));
        const report = await run(w, { overridePath: overrideFile(familyOverride) });
        ok(!report.ok && failed(report).some(l => /every family not waived/.test(l)), 'D1: an iPad case that was never run refuses the release even with both Android families waived');
      }
      const onlyAnd = { ...familyOverride, waives: ['device-matrix:AND', 'reader-evidence'] };
      const andOnly = await run(approved(world({ device: 'android-blocked', reader: 'none' }), onlyAnd), { overridePath: overrideFile(onlyAnd) });
      ok(!andOnly.ok && failed(andOnly).some(l => /every family not waived/.test(l)) && andOnly.results.some(r => /not complete in families that are not waived: ANT/.test(r.detail || '')), 'waiving the Android phone family leaves the Android tablet family required');
      // The approving comment must name the family waivers exactly: a whole-matrix approval does not cover them.
      const mismatched = approved(world({ device: 'android-blocked', reader: 'none' }), { ...goodOverride, waives: ['device-matrix', 'reader-evidence'] });
      const viaWholeApproval = await run(mismatched, { overridePath: overrideFile(familyOverride) });
      ok(!viaWholeApproval.ok && viaWholeApproval.overrides.length === 0, 'an approval comment that names other waivers does not authorise the family waivers');
      const complete = await run(approved(world({ reader: 'none' }), familyOverride), { overridePath: overrideFile(familyOverride) });
      ok(complete.ok && !complete.overrides.some(o => o.requirement.startsWith('device-matrix')) && complete.results.some(r => r.ok === null && /family waivers not needed/.test(r.label)), 'a complete matrix records no family waiver: the waivers waive nothing');
      // deviceEvidence itself refuses to waive an Apple family.
      const ledger = world({ device: 'android-blocked' }).ledger;
      for (const family of ['IPH', 'IPD', 'XYZ']) { assert.throws(() => deviceEvidence(SHA, { ledger, waivedFamilies: [family] }), /cannot be waived/, `deviceEvidence cannot waive ${family}`); count += 1; }
      const scoped = deviceEvidence(SHA, { ledger, waivedFamilies: ['AND', 'ANT'] });
      ok(scoped.ok && scoped.waivedFamilies.join(',') === 'AND,ANT' && /waived by family: AND pass 0 of \d+, ANT pass 0 of \d+/.test(scoped.detail), 'deviceEvidence with both Android families waived reports their state and passes on the Apple families');
      eq(deviceEvidence(SHA, { ledger }).detail, deviceEvidence(SHA, { ledger, waivedFamilies: [] }).detail, 'with nothing waived the detail is exactly what it was');
      // The owner's Apple-only script covers every case the release requires (it drifts with the matrix, or this fails).
      const ownerScript = readFileSync(join(ROOT, 'docs', 'release', 'OWNER-DEVICE-SCRIPT.md'), 'utf8');
      const appleCases = CASES.filter(kase => NEVER_WAIVED_FAMILIES.includes(kase.family));
      const uncovered = appleCases.filter(kase => !ownerScript.includes(kase.id) && !ownerScript.includes(`\`-${kase.seq}-${kase.step}\``)).map(kase => kase.id);
      assert.deepEqual(uncovered, [], `the owner device script names every one of the ${appleCases.length} iPhone and iPad cases`); count += 1;
      ok(!/DM-(AND|ANT)-/.test(ownerScript) && /device-matrix:AND/.test(ownerScript) && /device-matrix:ANT/.test(ownerScript), 'the owner script is Apple-only and points at the two Android family waivers');
      ok(/BLOCKED until billing/.test(ownerScript) && /in-app deletion/i.test(ownerScript) && /largest/.test(ownerScript) && /VoiceOver/.test(ownerScript) && /REINSTALL/.test(ownerScript), 'the owner script covers restore after reinstall, in-app deletion, VoiceOver at the largest text size, and sandbox purchase marked BLOCKED until billing');
      ok(loadOverride(overrideFile({ ...goodOverride, waives: ['device-matrix:AND', 'device-matrix:AND', 'device-matrix:ANT'] }), SHA).problems.some(p => /more than once/.test(p)), 'a waives list naming a family twice is refused (it would otherwise record the family twice)');

      // ── the Owner Console's checklist (docs/release/owner-device-script.json) and its importer ──
      const { ownerDeviceScript, scriptText, SCRIPT_JSON, SOAK_ITEM } = await import('./release-owner-device-script.mjs');
      const { importExport, importPlan, exportShape, parseArgs: parseImportArgs, IMPORT_READY, stageAppend, commitStages } = await import('./release-device-import.mjs');
      eq(readFileSync(SCRIPT_JSON, 'utf8'), scriptText(), 'the committed owner-device-script.json is exactly what the generator makes from the matrix (run --write after a matrix change)');
      const checklist = JSON.parse(readFileSync(SCRIPT_JSON, 'utf8'));
      const matrixItems = checklist.items.filter(item => item.kind === 'device-matrix');
      assert.deepEqual(matrixItems.map(item => item.id), appleCases.map(kase => kase.id), 'the checklist has every iPhone and iPad case once, in the matrix order'); count += 1;
      ok(matrixItems.every(item => { const kase = appleCases.find(k => k.id === item.id); return item.title === kase.title && item.expected === kase.expect && item.family === kase.family; }), 'each case carries the recorder\'s own title and expected result');
      ok(checklist.items.every(item => typeof item.precondition === 'string' && item.precondition && Array.isArray(item.steps) && item.steps.length && Array.isArray(item.evidence) && item.evidence.length && typeof item.billingRequired === 'boolean'), 'every item has a precondition, steps, the evidence to capture and whether billing must come first');
      ok(checklist.items.every(item => !['result', 'tester', 'device', 'os', 'sha', 'recordedAt', 'exportedAt', 'minutes', 'failures', 'matrixStep'].some(key => key in item)), 'nothing is pre-filled: no item carries a result, tester, device, OS, SHA, time or soak figures (nor the generator\'s bookkeeping)');
      ok(!checklist.items.some(item => /^(AND|ANT)$/.test(item.family)), 'the checklist is Apple-only');
      ok(matrixItems.filter(item => item.pencilRequired).map(item => item.id).join(',') === appleCases.filter(k => k.pencil).map(k => k.id).join(','), 'the Pencil case is marked as needing the Pencil model');
      const inMatrix = (family, step) => appleCases.some(kase => kase.family === family && kase.step === step);
      const records = checklist.items.filter(item => item.kind === 'release-record');
      eq(records.map(item => `${item.id}:${item.billingRequired}`).join(','), [!inMatrix('IPH', 'DELETE') && 'REC-IPH-DELETE:false', !inMatrix('IPD', 'DELETE') && 'REC-IPD-DELETE:false', !inMatrix('IPD', 'PURCHASE') && 'REC-IPD-PURCHASE:true', 'REC-IPD-STOREKIT:true'].filter(Boolean).join(','), 'deletion and the sandbox purchase go to the release record until the matrix has cases for them (#737); the StoreKit certification scenarios always do');
      ok(matrixItems.every(item => item.billingRequired === /-(PURCHASE|RESTOREPURCHASE)$/.test(item.id)), 'the matrix\'s purchase cases, and only they, need billing first');
      assert.deepEqual(checklist.items.filter(item => item.kind === 'soak').map(item => item.id), [SOAK_ITEM.id], 'the device soak (A17, B5) is on the checklist'); count += 1;
      const install = checklist.items.find(item => /-01-INSTALL$/.test(item.id));
      ok(/TestFlight build of the candidate/.test(install.precondition) && /staging/.test(install.precondition) && !/development build/i.test(install.precondition), 'the checklist installs the TestFlight build and runs it against staging (#737, the Director\'s 9 Nov decision under D5)');
      ok(checklist.evidenceExport.format === 'pri-device-evidence-export' && /release-device-import\.mjs/.test(checklist.evidenceExport.import), 'the checklist names the export format and the import command');
      const shape = exportShape();
      assert.deepEqual(checklist.evidenceExport.shape, shape, 'the checklist\'s export shape is the importer\'s own'); count += 1;
      assert.deepEqual([Object.keys(shape), Object.keys(shape.records[0]), Object.keys(shape.soaks[0])], [['format', 'version', 'exportedAt', 'sha', 'tester', 'buildKind', 'server', 'records', 'soaks'], ['case', 'result', 'device', 'os', 'pencil', 'severity', 'notes', 'build'], ['device', 'os', 'pencil', 'minutes', 'failures', 'notes', 'build']], 'the export format v1 has a fixed set of fields'); count += 1;
      assert.throws(() => ownerDeviceScript([...appleCases, { ...appleCases[0], id: 'DM-IPH-99-NEW', step: 'NEWSTEP' }]), /no owner steps for matrix step NEWSTEP/); count += 1;

      const exportDir = mkdtempSync(join(tmpdir(), 'pri-device-import-')); scratch.push(exportDir);
      const importLedger = join(exportDir, 'results.jsonl');
      const soakLedger = join(exportDir, 'soak.jsonl');
      const snapshot = () => readdirSync(exportDir).sort().map(name => { try { return `${name}\n${readFileSync(join(exportDir, name), 'utf8')}`; } catch { return `${name}/`; } }).join('\n--\n');
      const pencilCase = appleCases.find(kase => kase.pencil).id;
      const blockedCase = appleCases[1].id;
      const EXPORTED_AT = new Date(Date.now() - 60_000).toISOString();
      const good = { format: 'pri-device-evidence-export', version: 1, exportedAt: EXPORTED_AT, sha: SHA, tester: 'Priya Example', buildKind: 'testflight', server: 'staging',
        records: [{ case: 'DM-IPH-01-INSTALL', result: 'pass', device: 'iPhone 16 Pro Max', os: 'iOS 26.1' }, { case: pencilCase, result: 'pass', device: 'iPad Pro 11-inch (4th generation)', os: 'iPadOS 26.1', pencil: 'Apple Pencil Pro' }] };
      const soak = { device: 'iPad Pro 11-inch (4th generation)', os: 'iPadOS 26.1', pencil: 'Apple Pencil Pro', minutes: 52, failures: 0 };
      const refusedImport = (name, exported, pattern) => {
        const before = snapshot();
        let error = null;
        try { importExport(exported, { ledger: importLedger }); } catch (e) { error = e; }
        ok(error && error.problems.some(p => pattern.test(p)) && snapshot() === before, `the import refuses ${name}, and writes nothing`);
      };
      const ownProblems = exported => importPlan(exported, { ledger: importLedger }).problems.filter(p => !/predates build kinds|is not recorded by this checkout/.test(p));
      // The importer's own refusals, on every checkout.
      refusedImport('an agent as tester', { ...good, tester: 'Claude Code' }, /does not name a human/);
      refusedImport('a simulator', { ...good, records: [{ ...good.records[0], device: 'iPhone 16 Pro Simulator' }] }, /simulator/);
      refusedImport('an unknown case', { ...good, records: [{ ...good.records[0], case: 'DM-IPH-99-NOPE' }] }, /unknown case id/);
      refusedImport('a short SHA', { ...good, sha: 'abc123' }, /40-hex/);
      refusedImport('a Pencil case passed without the Pencil model', { ...good, records: [{ ...good.records[1], pencil: undefined }] }, /Apple Pencil case/);
      refusedImport('a case twice', { ...good, records: [good.records[0], good.records[0]] }, /appears twice/);
      refusedImport('a case twice, once in lower case', { ...good, records: [good.records[0], { ...good.records[0], case: good.records[0].case.toLowerCase() }] }, /appears twice/);
      refusedImport('a good record followed by a bad one (all or nothing)', { ...good, records: [good.records[0], { ...good.records[1], device: 'Xcode simulator' }] }, /simulator/);
      refusedImport('another format', { ...good, format: 'something-else' }, /format must be/);
      refusedImport('another version', { ...good, version: 2 }, /version must be 1/);
      refusedImport('a field the format does not have', { ...good, records: [{ ...good.records[0], result: 'pass', evidenceClass: 'PHYSICAL-HUMAN' }] }, /unknown key/);
      refusedImport('a top-level field the format does not have', { ...good, recordedAt: '2026-11-09T00:00:00Z' }, /unknown key "recordedAt"/);
      eq(importPlan({ ...good, records: [] }).problems.some(p => /no records and no soaks/.test(p)), true, 'an export with no records is refused');
      refusedImport('a tester that is an object', { ...good, tester: { name: 'Priya Example' } }, /tester must be text, not object/);
      refusedImport('a tester that is a number', { ...good, tester: 12345 }, /tester must be text, not number/);
      refusedImport('a tester that is true', { ...good, tester: true }, /tester must be text, not boolean/);
      refusedImport('a device and an OS that are objects', { ...good, records: [{ ...good.records[0], device: {}, os: {} }] }, /device must be text, not object/);
      refusedImport('a case that is a list', { ...good, records: [{ ...good.records[0], case: ['DM-IPH-01-INSTALL'] }] }, /case must be text, not a list/);
      refusedImport('the checklist\'s own shape, imported as it stands', shape, /is placeholder text/);
      for (const name of Object.keys(shape).filter(key => !['format', 'version', 'records', 'soaks'].includes(key))) refusedImport(`the shape's ${name} placeholder in an otherwise good export`, { ...good, [name]: shape[name] }, new RegExp(`^${name} ".*" is placeholder text`));
      for (const name of Object.keys(shape.records[0])) refusedImport(`the shape's ${name} placeholder in an otherwise good record`, { ...good, records: [{ ...good.records[1], [name]: shape.records[0][name] }] }, new RegExp(`^records\\[0\\]: ${name} ".*" is placeholder text`));
      for (const name of Object.keys(shape.soaks[0])) refusedImport(`the shape's ${name} placeholder in an otherwise good soak`, { ...good, records: [], soaks: [{ ...soak, [name]: shape.soaks[0][name] }] }, new RegExp(`^soaks\\[0\\]: ${name} (".*" is placeholder text|must be a whole number)`));
      refusedImport('"<name>" as the tester', { ...good, tester: '<name>' }, /tester "<name>" is placeholder text/);
      refusedImport('a device naming a placeholder inside other text', { ...good, records: [{ ...good.records[0], device: 'iPhone <model>' }] }, /device "iPhone <model>" is placeholder text/);
      refusedImport('the script\'s own TIMED notes example', { ...good, records: [{ case: blockedCase, result: 'blocked', notes: '<minutes> min, <n> handwritten' }] }, /notes ".*" is placeholder text/);
      ok(ownProblems({ ...good, records: [{ case: blockedCase, result: 'blocked', notes: 'the code took > 10 minutes, then x < 5' }] }).length === 0, 'notes may use < or > in what the tester saw; only a <word> placeholder is refused');
      for (const tester of ['Full Name', 'Your Name', 'your full name', 'Name', 'Tester', '​​​', 'Pr​iya Example', 'A1']) refusedImport(`the tester ${JSON.stringify(tester)}`, { ...good, tester }, /does not name a human/);
      refusedImport('an export with no exportedAt', { ...good, exportedAt: undefined }, /exportedAt is required/);
      refusedImport('an exportedAt that is not a date-time', { ...good, exportedAt: 'yesterday' }, /exportedAt must be an ISO date-time/);
      refusedImport('an exportedAt in the future', { ...good, exportedAt: new Date(Date.now() + 3_600_000).toISOString() }, /exportedAt .* is in the future/);
      refusedImport('a development build against production', { ...good, buildKind: 'development', server: 'production' }, /never run against production/);
      refusedImport('a build kind that is not one', { ...good, buildKind: 'simulator' }, IMPORT_READY ? /buildKind must be one of/ : /buildKind is not recorded by this checkout/);
      refusedImport('a build kind of __proto__', { ...good, buildKind: '__proto__' }, IMPORT_READY ? /buildKind must be one of/ : /buildKind is not recorded by this checkout/);
      refusedImport('a server that is not one', { ...good, server: 'localhost' }, IMPORT_READY ? /server must be one of/ : /server is not recorded by this checkout/);
      refusedImport('a severity on a pass', { ...good, records: [{ ...good.records[0], severity: 'P2' }] }, IMPORT_READY ? /only a fail carries a severity/ : /severity is not recorded by this checkout/);
      refusedImport('a blocked row recorded by an agent', { ...good, tester: 'Claude Code', records: [{ case: blockedCase, result: 'blocked', notes: 'no hardware keyboard to hand' }] }, /does not name a human \(the recorder's rule and the importer's, applied to every result\)/);
      refusedImport('a blocked row on a simulator', { ...good, records: [{ case: blockedCase, result: 'blocked', device: 'iPhone 16 Simulator', notes: 'no hardware keyboard to hand' }] }, /simulator or emulator \(the recorder's rule, applied to every result\)/);
      refusedImport('two soaks on one device in one export', { ...good, records: [], soaks: [soak, { ...soak, device: ` ${soak.device.toUpperCase()} ` }] }, /a second soak on/);
      refusedImport('a soak whose minutes are text', { ...good, records: [], soaks: [{ ...soak, minutes: '52' }] }, /minutes must be a whole number/);
      if (!IMPORT_READY) refusedImport('a complete, correct export on a recorder without build kinds (nothing is imported before #737)', good, /predates build kinds, servers, severities and soaks \(#737\)/);
      // Staging and committing, on every checkout: exactly the appended bytes, one append per ledger, everything put back on a failure.
      {
        const stageDir = join(exportDir, 'stage');
        mkdirSync(stageDir);
        const real = join(stageDir, 'real.jsonl');
        writeFileSync(real, 'line1\n');
        assert.throws(() => stageAppend([], real, join(stageDir, 'copy-a.jsonl'), () => writeFileSync(join(stageDir, 'copy-a.jsonl'), 'rewritten\n')), /changed .* instead of appending/, 'a writer that rewrites the ledger instead of appending is refused'); count += 1;
        const staged = [];
        stageAppend(staged, real, join(stageDir, 'copy-b.jsonl'), () => writeFileSync(join(stageDir, 'copy-b.jsonl'), 'line2\n', { flag: 'a' }));
        ok(staged.length === 1 && staged[0].bytes.toString() === 'line2\n' && readFileSync(real, 'utf8') === 'line1\n', 'staging keeps exactly the appended bytes and leaves the real ledger alone');
        const appended = [];
        commitStages(staged, { append: (path, data) => { appended.push(path); writeFileSync(path, data, { flag: 'a' }); } });
        ok(appended.length === 1 && readFileSync(real, 'utf8') === 'line1\nline2\n', 'a ledger receives its new lines in one append');
        const before = readFileSync(real, 'utf8');
        const fresh = join(stageDir, 'made', 'deeper', 'soak.jsonl');
        let error = null;
        try { commitStages([{ real, existed: true, size: Buffer.byteLength(before), bytes: Buffer.from('line3\n') }, { real: fresh, existed: false, size: 0, bytes: Buffer.from('soak line\n') }], { append: (path, data) => { if (path === fresh) { writeFileSync(path, data.subarray(0, 3), { flag: 'a' }); throw new Error('ENOSPC: no space left on device'); } writeFileSync(path, data, { flag: 'a' }); } }); } catch (e) { error = e; }
        ok(error && /nothing written/.test(error.message) && error.exitCode === 2 && readFileSync(real, 'utf8') === before && !existsSync(join(stageDir, 'made')), 'a second ledger that fails part-way puts the first back, removes its own partial file and the directories the import made');
        const other = join(stageDir, 'other.jsonl');
        writeFileSync(other, '');
        error = null;
        try { commitStages([{ real, existed: true, size: Buffer.byteLength(before), bytes: Buffer.from('line4\n') }, { real: other, existed: true, size: 0, bytes: Buffer.from('soak line\n') }], { append: (path, data) => { writeFileSync(path, data.subarray(0, 4), { flag: 'a' }); if (path === other) throw new Error('ENOSPC: no space left on device'); writeFileSync(path, data.subarray(4), { flag: 'a' }); }, restore: s => { if (s.real === other) throw new Error('EACCES'); writeFileSync(s.real, readFileSync(s.real).subarray(0, s.size)); } }); } catch (e) { error = e; }
        ok(error && /could not be put back: .*other\.jsonl \(cut it back to 0 bytes\)/.test(error.message) && !/real\.jsonl/.test(error.message.split('could not be put back')[1]) && readFileSync(real, 'utf8') === before, 'a ledger that cannot be put back is named, and the others are still put back');
        rmSync(stageDir, { recursive: true, force: true });
      }
      if (IMPORT_READY) {
        const appends = [];
        const counting = (path, data) => { appends.push(path); writeFileSync(path, data, { flag: 'a' }); };
        const { written } = importExport(good, { ledger: importLedger, append: counting });
        ok(written.length === 2 && validateLedger(importLedger).length === 0 && readLedger(importLedger).every(r => r.recorder === 'scripts/device-matrix-record.mjs' && r.tester === 'Priya Example' && r.sha === SHA && r.buildKind === 'testflight' && r.server === 'staging'), 'a console export is written through the recorder and the ledger validates');
        assert.deepEqual(appends, [importLedger], 'all of an export\'s records reach the ledger in one append, never one line at a time'); count += 1;
        // Review of 5bdc03594: the same export imported again, or an older one, never replaces a newer result.
        refusedImport('the same export imported twice', good, /after this export was made/);
        recordResult({ case: 'DM-IPH-01-INSTALL', result: 'fail', severity: 'P1', notes: 'the build would not open on the retest', device: 'iPhone 16 Pro Max', os: 'iOS 26.1', sha: SHA, tester: 'Priya Example', buildKind: 'testflight', server: 'staging' }, { ledger: importLedger });
        refusedImport('an older export after a newer fail recorded with the recorder', { ...good, records: [good.records[0]] }, /DM-IPH-01-INSTALL\): the ledger already holds a result for it recorded at .*, after this export was made/);
        ok(importPlan({ ...good, exportedAt: new Date().toISOString(), records: [good.records[0]] }, { ledger: importLedger }).problems.length === 0, 'an export made after the ledger\'s rows for its cases is accepted');
        ok(importPlan({ ...good, server: 'production', records: [good.records[0]] }, { ledger: importLedger }).problems.length === 0, 'rows against another server are other evidence: they never make an export look older');
        appends.length = 0;
        // A second before the import: the soak it writes is then strictly after this export
        // (newer() compares in milliseconds), so a re-import is refused however fast this runs.
        const soakAt = new Date(Date.now() - 1000).toISOString();
        const imported = importExport({ ...good, exportedAt: soakAt, records: [], soaks: [soak] }, { ledger: importLedger, append: counting });
        ok(imported.soaks.length === 1 && readLedger(soakLedger).length === 1 && validateLedger(importLedger).length === 0, 'a soak in the export is written by the recorder\'s recordSoak, and both ledgers validate');
        assert.deepEqual(appends, [soakLedger], 'an export of soaks only appends to the soak ledger, once'); count += 1;
        refusedImport('the same soak imported twice (its minutes would count twice)', { ...good, exportedAt: soakAt, records: [], soaks: [soak] }, /soak ledger already holds a soak on this device recorded at .*, after this export was made/);
        refusedImport('a soak shorter than the recorder allows', { ...good, exportedAt: new Date().toISOString(), records: [], soaks: [{ ...soak, minutes: 5 }] }, /a soak needs --minutes/);
        refusedImport('a soak on a simulator', { ...good, exportedAt: new Date().toISOString(), records: [], soaks: [{ ...soak, device: 'iPad Simulator' }] }, /simulator/);
        const before = snapshot();
        let error = null;
        let calls = 0;
        try { importExport({ ...good, exportedAt: new Date().toISOString(), records: [good.records[0]], soaks: [{ ...soak, device: 'iPhone 16 Pro Max', os: 'iOS 26.1', pencil: undefined }] }, { ledger: importLedger, append: (path, data) => { calls += 1; if (calls === 2) { writeFileSync(path, data.subarray(0, 9), { flag: 'a' }); throw new Error('EACCES: permission denied'); } writeFileSync(path, data, { flag: 'a' }); } }); } catch (e) { error = e; }
        ok(error && /nothing written/.test(error.message) && snapshot() === before, 'when the soaks cannot be written after the records were, both ledgers are put back: nothing written');
      }
      // The command line: one export file and --ledger <path>; any other option is refused before anything is read.
      assert.deepEqual(parseImportArgs(['x.json']), { file: 'x.json', ledger: DEFAULT_LEDGER }, 'one export file imports into the repository ledger'); count += 1;
      assert.deepEqual(parseImportArgs(['--ledger', 'L.jsonl', 'x.json']), { file: 'x.json', ledger: 'L.jsonl' }, '--ledger takes the next word as the ledger, never as the export'); count += 1;
      for (const [args, pattern] of [[['x.json', '--dry-run'], /unknown option --dry-run/], [['--ledger'], /needs a path/], [['--ledger', '--dry-run', 'x.json'], /needs a path/], [['a.json', 'b.json'], /one export file at a time/], [['--ledger', 'a', '--ledger', 'b', 'x.json'], /twice/], [[], /no export file/]]) ok(pattern.test(parseImportArgs(args).error || ''), `the importer refuses the arguments ${JSON.stringify(args)}`);
      const exportFile = join(exportDir, 'export.json');
      const fresh = { ...good, exportedAt: new Date().toISOString(), records: [{ ...good.records[0], case: appleCases[2].id }] };
      writeFileSync(exportFile, JSON.stringify(fresh));
      const { spawnSync } = await import('node:child_process');
      const cliBefore = snapshot();
      const dry = spawnSync(process.execPath, [join(ROOT, 'tools', 'release-device-import.mjs'), exportFile, '--ledger', importLedger, '--dry-run'], { encoding: 'utf8' });
      ok(dry.status === 2 && /unknown option --dry-run/.test(dry.stderr) && snapshot() === cliBefore, 'an option the importer does not know exits 2 and writes nothing');
      const cliLedger = join(exportDir, 'cli', 'results.jsonl');
      const real = spawnSync(process.execPath, [join(ROOT, 'tools', 'release-device-import.mjs'), '--ledger', cliLedger, exportFile], { encoding: 'utf8' });
      if (IMPORT_READY) ok(real.status === 0 && readLedger(cliLedger).length === 1 && validateLedger(cliLedger).length === 0 && /DEVICE IMPORT: 1 record\(s\) written/.test(real.stdout), 'the command line imports an export, --ledger first');
      else ok(real.status === 2 && /predates build kinds/.test(real.stderr) && !existsSync(cliLedger), 'on a recorder without build kinds the command line imports nothing');
      // The release counts store-build rows against staging; a development build never stands in for the store build.
      {
        const kindsLedger = join(exportDir, 'kinds.jsonl');
        const row = (kase, extra) => JSON.stringify({ recordedAt: new Date().toISOString(), case: kase.id, result: 'pass', device: kase.family === 'IPD' ? 'iPad Pro 11-inch (4th generation)' : 'iPhone 16 Pro Max', os: 'iOS 26.1', pencil: kase.pencil ? 'Apple Pencil Pro' : null, build: null, sha: SHA, tester: 'Priya Example', notes: null, evidenceClass: 'PHYSICAL-HUMAN', recorder: 'scripts/device-matrix-record.mjs', ...extra });
        for (const [label, extra, expected] of [
          ['rows from a recorder without build kinds (before #737)', {}, true],
          ['TestFlight rows against staging', { buildKind: 'testflight', server: 'staging' }, true],
          ['development-build rows', { buildKind: 'development', server: 'staging' }, false],
          ['TestFlight rows against production (the short list after promotion)', { buildKind: 'testflight', server: 'production' }, false]
        ]) {
          writeFileSync(kindsLedger, `${CASES.map(kase => row(kase, extra)).join('\n')}\n`);
          const all = deviceEvidence(SHA, { ledger: kindsLedger });
          const apple = deviceEvidence(SHA, { ledger: kindsLedger, waivedFamilies: ['AND', 'ANT'] });
          ok(all.ok === expected && apple.ok === expected && (expected || (/not counted: the release counts store-build rows against staging/.test(all.detail) && /not counted/.test(apple.detail))), `the release ${expected ? 'counts' : 'does not count'} ${label}, with or without the Android family waivers`);
        }
        ok(releaseDeviceRows([{ buildKind: 'play-internal', server: 'staging' }, { buildKind: null, server: 'staging' }, { buildKind: 'testflight', server: null }]).length === 1, 'a row with no build kind or no server, from a recorder that has them, is not counted');
      }
    }
    ok(!(await run(world({ device: 'all-blocked' }))).ok, 'an all-blocked device matrix refuses the release stage (Q4 #696 counterexample)');

    // Authentication negative controls: each leaves the evidence unwaived.
    const refusedWith = async (name, w, override, pattern) => {
      const report = await run(w, { overridePath: overrideFile(override) });
      ok(!report.ok && report.overrides.length === 0 && report.promotion.length === 0 && failed(report).some(l => /device matrix complete/.test(l)) && report.results.some(r => r.ok === false && pattern.test(`${r.label} ${r.detail || ''}`)),
        `${name} waives nothing (failed: ${failed(report).join('; ')})`);
    };
    await refusedWith('a forged override whose approving comment does not exist (Q4 #696 counterexample)', world({ device: 'none', reader: 'none' }), goodOverride, /could not be read from GitHub/);
    await refusedWith('an override whose comment was written by another account', approved(world({ device: 'none', reader: 'none' }), goodOverride, 1001, { login: 'someone-else' }), goodOverride, /written by someone-else, not/);
    {
      // A waiver may be an issue opened from a prefilled link, verified like a comment.
      const issueOverride = { ...goodOverride, waives: ['device-matrix'], approval: issueUrl(1501) };
      eq(loadOverride(overrideFile(issueOverride), SHA).problems.length, 0, 'an override may link an approving issue');
      const w = world({ device: 'android-blocked' });
      w.approveIssue(1501, `${waiverMarker(SHA, ['device-matrix'])}\nApproved.`);
      const viaIssue = await run(w, { overridePath: overrideFile(issueOverride) });
      ok(viaIssue.ok && viaIssue.overrides.length === 1 && /issues\/1501$/.test(viaIssue.overrides[0].approval), 'a waiver approved by an admin\'s unedited issue waives what it names');
      const edited = world({ device: 'android-blocked' });
      edited.approveIssue(1501, waiverMarker(SHA, ['device-matrix']), { edited: '2026-11-02T00:00:00Z' });
      ok(!(await run(edited, { overridePath: overrideFile(issueOverride) })).ok, 'an edited waiver issue waives nothing');
      // Review of 2c35946fe: the line must lead the post, one post approves one thing, and closing an issue withdraws it.
      const waiverRefused = async (name, body, options = {}) => {
        const x = world({ device: 'android-blocked' });
        x.approveIssue(1501, body, options);
        ok(!(await run(x, { overridePath: overrideFile(issueOverride) })).ok, `a waiver issue ${name} waives nothing`);
      };
      await waiverRefused('whose waiver line sits under other text', `Approved.\n${waiverMarker(SHA, ['device-matrix'])}`);
      await waiverRefused('whose waiver line is hidden in an HTML comment', `<!--\n${waiverMarker(SHA, ['device-matrix'])}\n-->`);
      await waiverRefused('whose waiver line is in a code block', `\`\`\`\n${waiverMarker(SHA, ['device-matrix'])}\n\`\`\``);
      await waiverRefused('that also holds the GO line', `${waiverMarker(SHA, ['device-matrix'])}\n${goMarker(SHA)}`);
      await waiverRefused('that was closed', waiverMarker(SHA, ['device-matrix']), { state: 'CLOSED', closed: 1 });
      await waiverRefused('that was closed and reopened', waiverMarker(SHA, ['device-matrix']), { closed: 2 });
      await waiverRefused('whose state GitHub did not report', waiverMarker(SHA, ['device-matrix']), { state: null });
      await waiverRefused('whose closings GitHub did not report', waiverMarker(SHA, ['device-matrix']), { closed: null });
      await waiverRefused('whose waiver line is an indented code block', `    ${waiverMarker(SHA, ['device-matrix'])}`);
      await waiverRefused('whose waiver line follows a tab', `\t${waiverMarker(SHA, ['device-matrix'])}`);
      for (const indent of [' \t', '  \t', '   \t']) await waiverRefused(`whose waiver line follows ${JSON.stringify(indent)} (a tab stop at column 4: a code block)`, `${indent}${waiverMarker(SHA, ['device-matrix'])}`);
      {
        const x = world({ device: 'android-blocked' });
        x.approveIssue(1501, waiverMarker(SHA, ['device-matrix']));
        delete x.issues.get(1501).lastEditedAt;
        ok(!(await run(x, { overridePath: overrideFile(issueOverride) })).ok, 'a waiver issue whose edit time GitHub did not report waives nothing (counted as edited)');
      }
      {
        const x = world({ device: 'android-blocked' });
        x.approveIssue(1501, waiverMarker(SHA, ['device-matrix']), { closed: null });
        const unsaid = await verifyApproval({ approval: issueUrl(1501), githubLogin: APPROVER, sha: SHA, marker: waiverMarker(SHA, ['device-matrix']), repo: DEFAULT_REPO_FOR_TESTS, gh: x.gh, ghGraphql: x.ghGraphql, git: x.git });
        ok(!unsaid.ok && unsaid.problems.some(p => /did not say whether approval issue #1501 was ever closed/.test(p)) && !unsaid.problems.some(p => /closed and reopened/.test(p)), 'an issue whose closings GitHub left out is refused as unknown, not called reopened');
      }
      {
        const x = world({ device: 'android-blocked' });
        x.approveIssue(1501, `  ${waiverMarker(SHA, ['device-matrix'])}\nApproved.`);
        ok((await run(x, { overridePath: overrideFile(issueOverride) })).ok, 'two spaces before the line are not a code block: the line still leads the post');
      }
      const leading = world({ device: 'android-blocked' });
      leading.approve(1001, `   \n\n${waiverMarker(SHA, ['device-matrix'])}\nApproved.`);
      ok((await run(leading, { overridePath: overrideFile({ ...goodOverride, waives: ['device-matrix'] }) })).ok, 'blank lines before the waiver line are not text: the line still leads the post');
    }
    {
      const w = approved(world({ device: 'none', reader: 'none' }), goodOverride, 1001, { login: 'someone-else' });
      await refusedWith('an override approved by a collaborator without admin permission', w, { ...goodOverride, githubLogin: 'someone-else' }, /write permission .*needs a repository admin/);
    }
    await refusedWith('an override approved by a bot account', approved(world({ device: 'none', reader: 'none' }), goodOverride, 1001, { type: 'Bot' }), goodOverride, /Bot account/);
    await refusedWith('an override whose approving comment was edited', approved(world({ device: 'none', reader: 'none' }), goodOverride, 1001, { updated: '2026-11-02T09:00:00Z' }), goodOverride, /edited after it was posted/);
    await refusedWith('an override approved before the commit existed (stale approval)', approved(world({ device: 'none', reader: 'none' }), goodOverride, 1001, { created: '2026-10-16T00:00:00Z' }), goodOverride, /predates the commit/);
    await refusedWith('an override whose comment approves another SHA', (() => { const w = world({ device: 'none', reader: 'none' }); w.approve(1001, waiverMarker(OTHER, goodOverride.waives)); return w; })(), goodOverride, /does not start with the exact line/);
    await refusedWith('an override whose comment approves fewer waivers than the file claims', (() => { const w = world({ device: 'none', reader: 'none' }); w.approve(1001, waiverMarker(SHA, ['reader-evidence'])); return w; })(), goodOverride, /does not start with the exact line/);
    await refusedWith('an override whose comment approves a different target', (() => { const w = world({ device: 'none', reader: 'none' }); w.approve(1001, waiverMarker(SHA, goodOverride.waives).replace('deploy/production', 'deploy/staging')); return w; })(), goodOverride, /does not start with the exact line/);
    await refusedWith('an override whose approval link points at another repository', approved(world({ device: 'none', reader: 'none' })), { ...goodOverride, approval: 'https://github.com/evil/fork/issues/1#issuecomment-1001' }, /is in evil\/fork, not/);
    await refusedWith('an override whose comment id belongs to another issue', approved(world({ device: 'none', reader: 'none' }), goodOverride, 1001, { issue: 999 }), goodOverride, /does not belong to #686/);
    await refusedWith('an internal test-track exception at the release stage', approved(world({ device: 'none', reader: 'none' })), { ...goodOverride, scope: 'internal-test-track' }, /never approval for a public production release/);
    const partial = await run(approved(world({ device: 'none' }), { ...goodOverride, waives: ['reader-evidence'] }), { overridePath: overrideFile({ ...goodOverride, waives: ['reader-evidence'] }) });
    ok(!partial.ok && failed(partial).some(l => /device matrix complete/.test(l)), 'an override that waives only the reader evidence does not waive the device matrix');
    const evidenceWins = await run(approved(world()), { overridePath: overrideFile(goodOverride) });
    ok(evidenceWins.ok && evidenceWins.overrides.length === 0, 'when the evidence exists the override is not used: the nomination stands on the evidence');
    const wrongSha = await run(world({ device: 'none', reader: 'none' }), { overridePath: overrideFile({ ...goodOverride, sha: OTHER }) });
    ok(!wrongSha.ok && failed(wrongSha).some(l => /override is well-formed/.test(l)) && failed(wrongSha).some(l => /device matrix complete/.test(l)), 'an override for another SHA is refused and waives nothing');
    const byCi = await run(world({ device: 'none', reader: 'none' }), { overridePath: overrideFile({ ...goodOverride, by: 'CI' }) });
    ok(!byCi.ok && byCi.overrides.length === 0, 'an override signed by CI is refused and waives nothing');
    const missing = await run(world({ device: 'none', reader: 'none' }), { overridePath: join(tmpdir(), 'pri-no-such-override.json') });
    ok(!missing.ok && failed(missing).some(l => /override is well-formed/.test(l)), 'a missing override file is a failed check, not a silent pass');
  }

  const drifts = [
    ['a SHA that is not on origin/main', w => { w.mainAncestors.delete(SHA); }, /SHA is on origin\/main/],
    ['a workflow still running', w => { w.runs.push({ name: 'Native Ink', workflow_id: 3, path: 'n.yml', event: 'push', status: 'in_progress', conclusion: null }); }, /has completed/],
    ['a red workflow', w => { w.runs.push({ name: 'CodeQL', workflow_id: 4, path: 'c.yml', event: 'push', status: 'completed', conclusion: 'failure' }); }, /failed or was cancelled/],
    ['a required context missing', w => { w.checks = w.checks.filter(c => c.name !== REQUIRED_CONTEXTS[0]); }, new RegExp(`required context green: ${escapeRe(REQUIRED_CONTEXTS[0])}`)],
    ['a required context red', w => { w.checks.find(c => c.name === REQUIRED_CONTEXTS[2]).conclusion = 'failure'; }, new RegExp(`required context green: ${escapeRe(REQUIRED_CONTEXTS[2])}`)],
    ['an unrelated scheduled workflow red on the SHA', w => { w.runs.push({ name: 'Pri App Health Agent', workflow_id: 7, path: '.github/workflows/app-health-agent.yml', event: 'schedule', status: 'completed', conclusion: 'failure', run_started_at: '2026-10-19T18:15:00Z' }); }, /no workflow run on this SHA failed or was cancelled/],
    ['Production Container absent (path-filtered)', w => { w.checks = w.checks.filter(c => c.name !== CONTAINER_CONTEXT); }, /Production Container green/],
    ['staging running another SHA', w => { w.staging.health.releaseIdentity.releaseSha = OTHER; }, /staging runs the nominated SHA/],
    ['staging web bundle from another build', w => { w.staging.web.releaseSha = OTHER; }, /release\.json/],
    ['staging on SQLite', w => { w.staging.health.database.engine = 'sqlite'; }, /engine is postgres/],
    ['staging one schema behind the commit', w => { w.staging.ready.checks.database.schemaVersion = String(SCHEMA_VERSION - 1); }, new RegExp(`schema_version is ${SCHEMA_VERSION}`)],
    ['staging billing schema mismatch', w => { w.staging.ready.checks.database.billingSchemaVersion = String(BILLING_SCHEMA_VERSION - 1); }, new RegExp(`billing_schema_version is ${BILLING_SCHEMA_VERSION}`)],
    ['staging not ready', w => { w.staging.readyStatus = 503; w.staging.ready.ready = false; w.staging.ready.state = 'not_ready'; }, /replica can serve/],
    ['deploy/production not an ancestor (a backwards move)', w => { w.ffFromProd = false; }, /fast-forward/],
    ['a commit this clone does not have', w => { w.knownCommits.delete(SHA); w.mainAncestors.delete(SHA); }, /commit exists/]
  ];
  for (const [name, mutate, label] of drifts) {
    const w = world();
    mutate(w);
    const report = await run(w);
    ok(!report.ok && report.promotion.length === 0 && failed(report).some(l => label.test(l)), `refuses ${name} (failed: ${failed(report).join('; ') || 'none'})`);
    ok(w.gitCalls.every(call => !/\bpush\b/.test(call)), `no git push while refusing ${name}`);
  }
  {
    // A flaky scheduled run that a later schedule passed does not refuse the SHA.
    const w = world();
    w.runs.push({ name: 'Pri App Health Agent', workflow_id: 7, path: '.github/workflows/app-health-agent.yml', event: 'schedule', status: 'completed', conclusion: 'failure', run_started_at: '2026-10-19T18:15:00Z' });
    w.runs.push({ name: 'Pri App Health Agent', workflow_id: 7, path: '.github/workflows/app-health-agent.yml', event: 'schedule', status: 'completed', conclusion: 'success', run_started_at: '2026-10-20T18:15:00Z' });
    const report = await run(w);
    ok(report.ok && report.results.some(r => r.ok === null && /superseded/.test(r.label) && /Pri App Health Agent/.test(r.detail)), 'a superseded flaky scheduled run is listed, not counted');
  }
  const unreachable = world();
  unreachable.fetchImpl = async () => { throw new Error('ECONNREFUSED'); };
  ok(!(await run(unreachable)).ok, 'an unreachable staging refuses the nomination');
  const noFetch = world();
  await run(noFetch, { fetchOrigin: false });
  ok(noFetch.gitCalls.every(call => !call.startsWith('fetch')), '--no-fetch skips the fetch');
  const badSha = await nominate({ sha: 'main', git: good.git, gh: good.gh, fetchImpl: good.fetchImpl });
  ok(!badSha.ok && badSha.results.length === 1, 'a non-40-hex SHA is refused before anything runs');
  const source = read('scripts/release-nominate.mjs');
  ok(!/\[\s*'push'/.test(source) && !/execFile\w*\([^)]*push/.test(source), 'the source never passes "push" to git; the push is only printed');
  ok(!/--engine (sqlite|postgres)\b/.test(source), 'the source never hard-codes the engine of the verify command');
  ok(!/device-matrix\.md\),\n/.test(source) || !/Before promoting:.*device matrix/.test(source), 'the device matrix is no longer printed as a reminder');

  // ═══════════════════════════════════════════════════════════════════════════
  // 1b · release-dossier: one record for one SHA (#686 steps 25, 27, 28, 30)
  // ═══════════════════════════════════════════════════════════════════════════
  assert.throws(() => parseDossierArgs([]), /40-hex/, 'the dossier needs a SHA'); count += 1;
  assert.throws(() => parseDossierArgs([SHA, '--record']), /needs a value/, '--record needs a path'); count += 1;
  const dArgs = parseDossierArgs([SHA.toUpperCase(), '--json', '--no-fetch']);
  ok(dArgs.command === 'build' && dArgs.sha === SHA && dArgs.json && !dArgs.fetch && dArgs.record.endsWith(join('go-no-go', `${SHA}.json`)) && dArgs.out.endsWith(join('go-no-go', `${SHA}.md`)), 'the dossier defaults its record and output to docs/release/evidence/go-no-go/<sha>');
  eq(parseDossierArgs(['template', SHA]).command, 'template', 'template <sha> is the record skeleton command');
  const tpl = recordTemplate(SHA);
  ok(tpl.sha === SHA && tpl.go.decision === null && tpl.go.sha === SHA && EXTERNAL_GATES.every(g => tpl.gates[g.id].status === 'NOT_RECORDED'), 'the template records no GO and every gate NOT_RECORDED');
  eq(recordProblems(tpl, SHA).length, 0, 'the template is well-formed');
  ok(recordProblems({ ...tpl, sha: OTHER }, SHA).some(p => /not/.test(p)), 'a record for another SHA is a problem');
  ok(recordProblems({ ...tpl, go: { ...tpl.go, decision: 'MAYBE' } }, SHA).some(p => /go\.decision/.test(p)), 'go.decision is GO, NO-GO or null');
  ok(recordProblems({ ...tpl, gates: { ...tpl.gates, examiner: { status: 'DONE' } } }, SHA).some(p => /gates\.examiner\.status/.test(p)), 'a gate status outside PASS/BLOCKED/NOT_RECORDED is a problem');
  assert.deepEqual(EXTERNAL_GATES.map(g => g.id), ['examiner', 'counsel', 'security', 'native', 'store', 'data'], 'the six gates only people can close'); count += 1;

  const NOW = Date.parse('2026-11-05T12:00:00Z');
  function fullRecord() {
    const r = recordTemplate(SHA);
    r.candidate = { frozenAt: '2026-11-03T09:00:00Z', by: 'Priya Example', note: 'merge freeze declared' };
    r.stagingProof = { result: 'DEPLOYMENT VERIFIED: PASS — 14/14', runUrl: 'https://github.com/x/y/actions/runs/1', at: '2026-11-03T09:30:00Z' };
    r.soak = { startedAt: '2026-11-03T10:00:00Z', endedAt: '2026-11-04T11:00:00Z', watchedBy: 'Priya Example', incidents: 'none', mergeFreezeDeclaredBy: 'Priya Example' };
    r.acceptance = { result: 'PASS', report: 'tools/acceptance/out/2026-11-03/report.json', tester: 'Priya Example', at: '2026-11-03T12:00:00Z' };
    for (const g of EXTERNAL_GATES) r.gates[g.id] = { status: 'PASS', by: 'Kalp Example', at: '2026-11-04T08:00:00Z', evidence: `signed ${g.id} record` };
    // D27: the owner's authenticated Yes for the data step, here an issue opened from a prefilled link.
    r.gates.data = { ...r.gates.data, githubLogin: APPROVER, approval: issueUrl(3001) };
    r.go = { decision: 'GO', by: 'Priya Example', githubLogin: APPROVER, approval: approvalUrl(2001), at: '2026-11-04T15:00:00Z', sha: SHA, statement: 'GO for exactly this SHA.' };
    return r;
  }
  const dossier = (w, record, extra = {}) => buildDossier({ sha: SHA, record, git: w.git, gh: w.gh, ghGraphql: w.ghGraphql, fetchImpl: w.fetchImpl, fetchOrigin: false, deviceLedger: w.ledger, readerEvalDir: w.readerDir, now: NOW, ...extra });
  const frozen = () => { const w = world(); w.tip = SHA; w.staging.health.releaseIdentity.buildTimestamp = '2026-11-03T09:40:00.000Z'; w.approve(2001, `${goMarker(SHA)}\nGO.`, { created: '2026-11-04T15:00:00Z' }); w.approveIssue(3001, `${dataYesMarker(SHA)}\nYes for the Step 24 window.`, { created: '2026-11-04T07:30:00Z' }); return w; };
  const ready = await dossier(frozen(), fullRecord());
  ok(ready.verdict === 'GO-READY' && ready.reasons.length === 0, `a frozen, soaked, evidenced, signed and GO-recorded SHA is GO-READY (reasons: ${ready.reasons.join('; ')})`);
  ok(ready.rows.find(r => r.step === 28).ok === true && /GO by Priya Example \(Priysharan19, https:\/\/github\.com\/.*issuecomment-2001/.test(ready.rows.find(r => r.step === 28).detail) && ready.rows.find(r => r.step === 28).evidenceClass === 'GITHUB-ACCOUNT-AUTHENTICATED', 'the owner GO row names the person, the approving GitHub comment and its evidence class, and quotes the statement');
  ok(ready.rows.find(r => r.step === 30).ok === null && /not yet/.test(ready.rows.find(r => r.step === 30).detail), 'before the promotion step 30 is informational: not yet');
  ok(/# GO\/NO-GO dossier — `a{40}`/.test(ready.markdown) && /## Verdict: \*\*GO-READY\*\*/.test(ready.markdown) && ready.markdown.includes('git push origin ' + SHA + ':refs/heads/deploy/production'), 'the markdown names the SHA, the verdict and prints step 29 only when GO-READY');
  ok(/PHYSICAL-HUMAN/.test(ready.markdown) && /real-human/.test(ready.markdown) && /pushes nothing, deploys nothing and authorises nothing/.test(ready.markdown), 'the markdown states the evidence classes and that it authorises nothing');
  ok(/\| PASS \| Independent examiner result/.test(ready.markdown) && /Kalp Example/.test(ready.markdown), 'the gate table names who signed each gate');
  ok(frozen().gitCalls.every(call => !/\bpush\b/.test(call)), 'the dossier never runs git push');

  const noGo = async (name, mutateRecord, label, mutateWorld = () => {}) => {
    const w = frozen(); mutateWorld(w);
    const record = fullRecord(); mutateRecord(record);
    const result = await dossier(w, record);
    ok(result.verdict === 'NO-GO' && result.reasons.some(r => label.test(r)) && !result.markdown.includes('git push origin'), `NO-GO when ${name} (reasons: ${result.reasons.join('; ')})`);
  };
  await noGo('the owner has not recorded GO', r => { r.go.decision = null; }, /owner GO for exactly this SHA/);
  await noGo('the owner recorded NO-GO', r => { r.go.decision = 'NO-GO'; r.go.statement = 'wait for counsel'; }, /owner GO for exactly this SHA/);
  await noGo('the GO names another SHA', r => { r.go.sha = OTHER; }, /owner GO for exactly this SHA/);
  await noGo('the GO is signed by an agent', r => { r.go.by = 'Claude agent'; }, /owner GO for exactly this SHA/);
  await noGo('the GO is dated in the future', r => { r.go.at = '2026-11-06T00:00:00Z'; }, /owner GO for exactly this SHA/);
  await noGo('the GO has no GitHub approval link (an unsigned GO)', r => { r.go.approval = ''; }, /owner GO for exactly this SHA/);
  await noGo('the GO approval comment does not exist', r => { r.go.approval = approvalUrl(2999); }, /owner GO for exactly this SHA/);
  await noGo('the GO comment approves another SHA', () => {}, /owner GO for exactly this SHA/, w => { w.approve(2001, goMarker(OTHER), { created: '2026-11-04T15:00:00Z' }); });
  await noGo('the GO comment says NO-GO-style text without the exact marker', () => {}, /owner GO for exactly this SHA/, w => { w.approve(2001, `NO-GO ${SHA}`, { created: '2026-11-04T15:00:00Z' }); });
  await noGo('the GO comment was posted by a non-admin', r => { r.go.githubLogin = 'someone-else'; }, /owner GO for exactly this SHA/, w => { w.approve(2001, goMarker(SHA), { login: 'someone-else', created: '2026-11-04T15:00:00Z' }); });
  await noGo('the GO comment was edited after posting', () => {}, /owner GO for exactly this SHA/, w => { w.approve(2001, goMarker(SHA), { created: '2026-11-04T15:00:00Z', updated: '2026-11-04T16:00:00Z' }); });
  await noGo('the GO comment was posted before the soak ended (stale GO)', () => {}, /owner GO for exactly this SHA/, w => { w.approve(2001, goMarker(SHA), { created: '2026-11-04T10:00:00Z' }); });
  await noGo('the GO comment was posted before the candidate was frozen', r => { r.soak.startedAt = '2026-11-02T00:00:00Z'; r.soak.endedAt = '2026-11-03T01:00:00Z'; }, /owner GO for exactly this SHA/, w => { w.approve(2001, goMarker(SHA), { created: '2026-11-03T08:00:00Z' }); w.staging.health.releaseIdentity.buildTimestamp = '2026-11-01T09:40:00.000Z'; });
  await noGo('the soak is shorter than 24 h', r => { r.soak.endedAt = '2026-11-04T09:59:00Z'; }, /soak window/);
  await noGo('the soak has not ended', r => { r.soak.endedAt = '2026-11-06T10:00:00Z'; }, /soak window/);
  await noGo('an incident is recorded during the soak', r => { r.soak.incidents = ['500 on /v1/sync/push at 03:12Z']; }, /no \/v1 500/);
  await noGo('nobody watched the soak', r => { r.soak.watchedBy = 'automation'; }, /watched by a named person/);
  await noGo('staging built the SHA after the soak began', () => {}, /before the soak began/, w => { w.staging.health.releaseIdentity.buildTimestamp = '2026-11-03T10:30:00.000Z'; });
  await noGo('main moved past the SHA (soak void)', () => {}, /merge freeze held/, w => { w.tip = OTHER; });
  await noGo('the Release Staging Proof never ran on the SHA', () => {}, /Release Staging Proof/, w => { w.runs = w.runs.filter(run => run.name !== 'Release Staging Proof'); });
  await noGo('the Release Staging Proof is red on the SHA', () => {}, /Release Staging Proof/, w => { w.runs.find(run => run.name === 'Release Staging Proof').conclusion = 'failure'; });
  // Found re-running the freeze rehearsal on 63deeb757 (Train 1): Main Integrity failed on the
  // merge, so the chained Release Staging Proof was SKIPPED, and a skipped run counted as green.
  await noGo('the Release Staging Proof was skipped on the SHA (it verified nothing)', () => {}, /Release Staging Proof/, w => { w.runs.find(run => run.name === 'Release Staging Proof').conclusion = 'skipped'; });
  await noGo('a gate is NOT_RECORDED', r => { r.gates.counsel = { status: 'NOT_RECORDED' }; }, /counsel/);
  await noGo('a gate is BLOCKED', r => { r.gates.store = { status: 'BLOCKED', by: 'Kalp Example', at: '2026-11-04T08:00:00Z', evidence: 'Paid Apps Agreement not signed' }; }, /Store readiness/);
  await noGo('a gate PASS is unsigned', r => { r.gates.examiner.by = ''; }, /examiner/);
  await noGo('the acceptance was not run by a named human', r => { r.acceptance.tester = 'CI'; }, /acceptance S0–S8/);
  await noGo('the acceptance failed', r => { r.acceptance.result = 'FAIL'; }, /acceptance S0–S8/);
  await noGo('the candidate was never frozen', r => { r.candidate = { frozenAt: '', by: '' }; }, /candidate SHA frozen/);
  await noGo('the merge freeze was declared by an agent', r => { r.candidate.by = 'L9 agent (Claude Code)'; }, /candidate SHA frozen/);
  {
    // The step-21 row says which half is wrong (found by the 9 Nov 2026 freeze rehearsal on
    // 1d3829103: an agent name read "not recorded", which sends the operator looking for a
    // field that is there).
    const frozenDetail = async mutate => {
      const record = fullRecord(); mutate(record);
      const row = (await dossier(frozen(), record)).rows.find(r => r.step === 21);
      return [row.ok, row.detail];
    };
    assert.deepEqual(await frozenDetail(() => {}), [true, '2026-11-03T09:00:00Z by Priya Example'], 'a freeze declared by a named person at a past time passes and names them'); count += 1;
    assert.deepEqual(await frozenDetail(r => { r.candidate.by = 'L9 agent (Claude Code)'; }), [false, 'candidate.by "L9 agent (Claude Code)" does not name a human (an agent, CI or placeholder name is refused)'], 'an agent declaring the freeze is refused by name, not reported as missing'); count += 1;
    assert.deepEqual(await frozenDetail(r => { r.candidate.by = ''; }), [false, 'candidate.by not recorded'], 'a missing declarer is reported as missing'); count += 1;
    assert.deepEqual(await frozenDetail(r => { r.candidate.frozenAt = ''; }), [false, 'candidate.frozenAt not recorded'], 'a missing freeze time is reported as missing'); count += 1;
    assert.deepEqual(await frozenDetail(r => { r.candidate.frozenAt = 'Monday morning'; }), [false, 'candidate.frozenAt is not an ISO date-time'], 'a freeze time that is not a date is named as such'); count += 1;
    assert.deepEqual(await frozenDetail(r => { r.candidate.frozenAt = '2026-11-06T00:00:00Z'; }), [false, 'candidate.frozenAt 2026-11-06T00:00:00Z is in the future'], 'a freeze dated after the dossier run is refused, with the reason'); count += 1;
  }
  await noGo('the device evidence is missing (the nomination fails)', () => {}, /release-stage nomination/, w => { writeFileSync(w.ledger, ''); });
  await noGo('the record is for another SHA', r => { r.sha = OTHER; }, /operator record/);

  // ── one-click approvals: an issue opened from a prefilled link, and the D27 data Yes ──
  {
    const DATA_GATE = /Production database at this commit/;
    await noGo('the D27 data Yes is missing (typed PASS only)', r => { r.gates.data.approval = ''; }, DATA_GATE);
    await noGo('the data Yes approval issue does not exist', r => { r.gates.data.approval = issueUrl(3999); }, DATA_GATE);
    await noGo('the data Yes issue was edited after it was opened', () => {}, DATA_GATE, w => { w.approveIssue(3001, dataYesMarker(SHA), { created: '2026-11-04T07:30:00Z', edited: '2026-11-04T09:00:00Z' }); });
    await noGo('the data Yes issue was opened by a bot account', () => {}, DATA_GATE, w => { w.approveIssue(3001, dataYesMarker(SHA), { created: '2026-11-04T07:30:00Z', type: 'Bot' }); });
    await noGo('the data Yes issue was opened by a non-admin', r => { r.gates.data.githubLogin = 'someone-else'; }, DATA_GATE, w => { w.approveIssue(3001, dataYesMarker(SHA), { created: '2026-11-04T07:30:00Z', login: 'someone-else' }); });
    await noGo('the data Yes names another SHA', () => {}, DATA_GATE, w => { w.approveIssue(3001, dataYesMarker(OTHER), { created: '2026-11-04T07:30:00Z' }); });
    await noGo('the data Yes carries the GO line instead', () => {}, DATA_GATE, w => { w.approveIssue(3001, goMarker(SHA), { created: '2026-11-04T07:30:00Z' }); });
    await noGo('the data Yes predates the candidate freeze', () => {}, DATA_GATE, w => { w.approveIssue(3001, dataYesMarker(SHA), { created: '2026-11-03T08:00:00Z' }); });
    await noGo('the data Yes is a pull request body (GraphQL has no such issue)', r => { r.gates.data.approval = issueUrl(3002); }, DATA_GATE);
    await noGo('the data Yes links an issue in another repository', r => { r.gates.data.approval = 'https://github.com/someone/fork/issues/3001'; }, DATA_GATE);
    // Review of 2c35946fe.
    await noGo('the data Yes came after the data gate was signed, so after the step it authorises', () => {}, DATA_GATE, w => { w.approveIssue(3001, dataYesMarker(SHA), { created: '2026-11-04T09:00:00Z' }); });
    await noGo('the data Yes issue was closed (withdrawn)', () => {}, DATA_GATE, w => { w.approveIssue(3001, dataYesMarker(SHA), { created: '2026-11-04T07:30:00Z', state: 'CLOSED', closed: 1 }); });
    await noGo('the data Yes issue was closed and reopened', () => {}, DATA_GATE, w => { w.approveIssue(3001, dataYesMarker(SHA), { created: '2026-11-04T07:30:00Z', closed: 2 }); });
    await noGo('the data Yes line sits under other text', () => {}, DATA_GATE, w => { w.approveIssue(3001, `Yes for the window.\n${dataYesMarker(SHA)}`, { created: '2026-11-04T07:30:00Z' }); });
    await noGo('the data Yes line is hidden in an HTML comment', () => {}, DATA_GATE, w => { w.approveIssue(3001, `<!--\n${dataYesMarker(SHA)}\n-->`, { created: '2026-11-04T07:30:00Z' }); });
    await noGo('one issue holds the data Yes and the GO', () => {}, DATA_GATE, w => { w.approveIssue(3001, `${dataYesMarker(SHA)}\n${goMarker(SHA)}`, { created: '2026-11-04T07:30:00Z' }); });
    await noGo('the data Yes hides a second approval inline', () => {}, DATA_GATE, w => { w.approveIssue(3001, `${dataYesMarker(SHA)}\nOK <!-- ${waiverMarker(SHA, ['device-matrix'])} -->`, { created: '2026-11-04T07:30:00Z' }); });
    await noGo('the data Yes link has a leading zero', r => { r.gates.data.approval = r.gates.data.approval.replace('/issues/3001', '/issues/03001'); }, DATA_GATE);
    await noGo('the GO comment buries its line under other text', () => {}, /owner GO for exactly this SHA/, w => { w.approve(2001, `GO.\n${goMarker(SHA)}`, { created: '2026-11-04T15:00:00Z' }); });
    {
      // The data Yes on the gate's own minute still holds: before the step means no later than the sign-off.
      const w = frozen();
      w.approveIssue(3001, dataYesMarker(SHA), { created: '2026-11-04T08:00:00Z' });
      const onTheMinute = await dossier(w, fullRecord());
      ok(onTheMinute.rows.find(row => DATA_GATE.test(row.label))?.ok === true, 'a data Yes posted at the minute the gate was signed still holds');
    }
    {
      const viaIssue = frozen();
      viaIssue.approveIssue(3010, `${goMarker(SHA)}\nGO for exactly this SHA.`, { created: '2026-11-04T15:00:00Z' });
      const record = fullRecord(); record.go.approval = issueUrl(3010);
      const result = await dossier(viaIssue, record);
      ok(result.verdict === 'GO-READY' && /issues\/3010/.test(result.rows.find(r => r.step === 28).detail), `the owner's GO may be an issue opened from a prefilled link (one click), verified like a comment (reasons: ${result.reasons.join('; ')})`);
      const ready2 = await dossier(frozen(), fullRecord());
      const dataRow = ready2.rows.find(r => r.step === 23 && /Production database/.test(r.label));
      ok(dataRow.ok === true && /owner's Yes https:\/\/github\.com\/.*issues\/3001 by Priysharan19/.test(dataRow.detail) && dataRow.evidenceClass === 'GITHUB-ACCOUNT-AUTHENTICATED', 'the data gate names the owner\'s authenticated Yes and its evidence class');
    }
    await noGo('the GO issue was edited', r => { r.go.approval = issueUrl(3011); }, /owner GO for exactly this SHA/, w => { w.approveIssue(3011, goMarker(SHA), { created: '2026-11-04T15:00:00Z', edited: '2026-11-04T16:00:00Z' }); });
    await noGo('the GO issue was opened before the soak ended', r => { r.go.approval = issueUrl(3012); }, /owner GO for exactly this SHA/, w => { w.approveIssue(3012, goMarker(SHA), { created: '2026-11-04T10:00:00Z' }); });
    ok(approvalLinkShape(issueUrl(5)) && approvalLinkShape(approvalUrl(5)) && !approvalLinkShape(`https://github.com/${DEFAULT_REPO_FOR_TESTS}/pull/5`) && !approvalLinkShape('https://example.com/issues/5'), 'an approval links a comment or an issue of a GitHub repository, nothing else');
    ok(!approvalLinkShape(`https://github.com/${DEFAULT_REPO_FOR_TESTS}/issues/0686`) && !approvalLinkShape(`https://github.com/${DEFAULT_REPO_FOR_TESTS}/issues/0`) && !approvalLinkShape(`https://github.com/${DEFAULT_REPO_FOR_TESTS}/issues/686#issuecomment-0123`), 'an approval link names its number the one way GitHub writes it (no leading zero)');
    eq(recordTemplate(SHA).gates.data.approval, '', 'the record template asks for the data Yes approval link');
    eq(dataYesMarker(SHA), `Pri-Production-Data-YES: ${SHA} target=production-postgres`, 'the data Yes line');
    // The owner's one-click links decode to exactly the lines the tools require.
    const approvalsDoc = read('docs/release/OWNER-APPROVALS.md');
    const templates = [...approvalsDoc.matchAll(/`(https:\/\/github\.com\/Priysharan19\/Final-Pri-learning\/issues\/new\?[^`]+)`/g)].map(m => m[1]).filter(t => t.includes('&body='));
    const bodies = templates.map(t => new URL(t.replaceAll('<SHA>', SHA)).searchParams.get('body'));
    assert.deepEqual(bodies, [goMarker(SHA), dataYesMarker(SHA), waiverMarker(SHA, ['device-matrix:ANT', 'device-matrix:AND'])], 'the three prefilled-link templates decode to the GO, data Yes and D1 waiver lines exactly'); count += 1;
    ok(templates.every(t => new URL(t.replaceAll('<SHA>', SHA)).searchParams.get('title')?.includes(SHA)), 'and each title names the SHA');
  }
  {
    // Step 30 after the promotion: production serves the SHA, main moved on, staging serves the tip with a green proof.
    const w = frozen(); w.tip = OTHER; w.mainAncestors.add(OTHER); w.production.health.releaseIdentity.releaseSha = SHA; w.staging.health.releaseIdentity.releaseSha = OTHER; w.staging.web.releaseSha = OTHER;
    w.tipRuns = [{ name: 'Release Staging Proof', workflow_id: 9, event: 'workflow_run', status: 'completed', conclusion: 'success', run_started_at: '2026-11-05T01:00:00Z' }];
    const after = await dossier(w, fullRecord());
    const thirty = after.rows.find(r => r.step === 30);
    ok(/CERTIFIED/.test(thirty.label) && /staging serves b{40}/.test(thirty.detail), 'after the promotion a later merge that reached staging unaided with a green proof certifies step 30');
    w.tipRuns[0].conclusion = 'failure';
    const afterRed = await dossier(w, fullRecord());
    ok(/not yet certified/.test(afterRed.rows.find(r => r.step === 30).label), 'a red proof on the later merge does not certify step 30');
    ok(after.verdict === 'NO-GO' && after.reasons.some(r => /merge freeze held/.test(r)), 'that later state is no longer GO-READY for this SHA (the soak belongs to one SHA), which is correct after a promotion');
  }
  {
    const withOverride = frozen();
    writeFileSync(withOverride.ledger, '');
    withOverride.approve(1002, waiverMarker(SHA, ['device-matrix']));
    const overridePath = overrideFile({ ...goodOverride, waives: ['device-matrix'], approval: approvalUrl(1002) });
    const record = fullRecord(); record.overrides = overridePath;
    const result = await dossier(withOverride, record);
    ok(result.verdict === 'GO-READY' && result.rows.some(r => r.step === 'override' && /device-matrix waived/.test(r.label) && /Priya Example \(Priysharan19, https:/.test(r.detail) && r.evidenceClass === 'GITHUB-ACCOUNT-AUTHENTICATED') && /## Overrides/.test(result.markdown) && /device-matrix waived/.test(result.markdown), 'a recorded override is carried into the dossier by name, person, GitHub approval and reason');
  }
  {
    // Evidence text is untrusted: a detail ending in a backslash before a pipe
    // must not close its cell and forge a PASS column (CodeQL incomplete-escaping).
    const forged = renderMarkdown({ sha: 'a'.repeat(40), verdict: 'NO-GO', reasons: ['x'], rows: [{ step: 25, ok: false, label: 'Staging proof', detail: String.raw`evil\| PASS | forged`, who: 'bot' }], nomination: { results: [] }, generatedAt: 't', recordPath: null }, {});
    const row = forged.split('\n').find(l => l.includes('evil')) || '';
    const boundaries = [...row.matchAll(/(?<!\\)(?:\\\\)*\|/g)].length;
    ok(boundaries === 5, `dossier evidence cannot break out of its table cell (${boundaries} cell boundaries, want 5): ${row}`);
  }
  {
    // Q4 #696 holdout: a bare carriage return survived the old cell(); after
    // CommonMark line-ending normalisation it opened a forged GO heading.
    const render = (detail, extra = {}) => renderMarkdown({ sha: 'a'.repeat(40), verdict: 'NO-GO', reasons: ['x'], rows: [{ step: 25, ok: false, label: 'Staging proof', detail, who: 'fixture' }], nomination: { results: [] }, generatedAt: 't', recordPath: null, ...extra }, {});
    const normalise = text => text.replace(/\r\n?/g, '\n');
    const forgedHeading = text => /^ {0,3}#{1,6}[ \t]+GO CERTIFIED/m.test(normalise(text));
    const q4 = render('not approved\r\r# GO CERTIFIED (FORGED)\r\r');
    ok(!/\r/.test(q4) && !forgedHeading(q4), 'a bare carriage return in evidence cannot open a forged GO heading (Q4 #696 holdout: 4 CRs survived before)');
    for (const [name, sep] of [['\\r', '\r'], ['\\n', '\n'], ['\\r\\n', '\r\n'], ['U+2028', '\u2028'], ['U+2029', '\u2029'], ['U+0085', '\u0085'], ['vertical tab', '\u000b'], ['form feed', '\u000c']]) {
      const md = render(`ok${sep}| PASS | forged | bot |${sep}# GO CERTIFIED`);
      const rows = normalise(md).split('\n').filter(l => l.includes('forged'));
      ok(rows.length === 1 && [...rows[0].matchAll(/(?<!\\)(?:\\\\)*\|/g)].length === 5 && !forgedHeading(md) && !LINE_BREAKS.test(md.replace(/\n/g, '')),
        `a ${name} line break in evidence stays inside its one table row and opens no heading`);
      LINE_BREAKS.lastIndex = 0;
    }
    // Text that starts a Markdown line outside a table: reasons, device, reader, controller.
    const lead = renderMarkdown({ sha: 'a'.repeat(40), verdict: 'NO-GO', reasons: ['# GO CERTIFIED (reason)'],
      rows: [
        { step: 'device', ok: false, label: 'device', detail: '# GO CERTIFIED (device)\r> quoted', evidenceClass: 'PHYSICAL-HUMAN\r# GO CERTIFIED (class)' },
        { step: 'reader', ok: false, label: 'reader', detail: '1. GO CERTIFIED (reader)', evidenceClass: 'real-human' },
        { step: 26, ok: null, label: 'controller', detail: '## GO CERTIFIED (controller)' }
      ], nomination: { results: [] }, generatedAt: 't', recordPath: null }, {});
    ok(!forgedHeading(lead) && !/^ {0,3}>/m.test(normalise(lead)) && !/^ {0,3}1\. GO/m.test(normalise(lead)) && /^- \\# GO CERTIFIED \(reason\)$/m.test(lead) && /^\\# GO CERTIFIED \(device\)/m.test(lead) && /^1\\\. GO CERTIFIED \(reader\)/m.test(lead),
      'untrusted text that starts a line (NO-GO reasons, device, reader and controller details) cannot become a heading, quote or list');
    eq(inline('a\r\nb\rc\nd\u2028e'), 'a b c d e', 'inline() flattens every line ending to one space');
    eq(cell('x\\|y\rz'), 'x\\\\\\|y z', 'cell() flattens line endings, then escapes the backslash before the pipe');
    eq(para('  # h'), '  \\# h', 'para() escapes an indented heading marker');
    eq(para('fine text'), 'fine text', 'para() leaves ordinary text alone');
    // The device-matrix table the dossier embeds holds tester-typed text too.
    const matrix = reportMarkdown({ sha: 'a'.repeat(40), counts: { pass: 1, fail: 0, blocked: 0, 'not run': 0 }, rows: [{ id: 'DM-IPH-01-INSTALL', latest: { result: 'pass', device: 'iPhone | forged', os: 'iOS 26', pencil: null, sha: 'a'.repeat(40), tester: 'Priya\rExample', recordedAt: '2026-10-19T01:00:00Z', notes: String.raw`ok\| PASS |` + '\r\r# GO CERTIFIED (matrix)' } }] });
    const matrixRow = normalise(matrix).split('\n').find(l => l.includes('DM-IPH-01-INSTALL')) || '';
    ok(!/\r/.test(matrix) && !forgedHeading(matrix) && [...matrixRow.matchAll(/(?<!\\)(?:\\\\)*\|/g)].length === 14, `a device-matrix note cannot add a row, a column or a heading to the 13-column matrix table (${matrixRow})`);
  }
  const dossierSource = read('scripts/release-dossier.mjs');
  ok(!/\[\s*'push'/.test(dossierSource) && !/railway|update_ref|deploy\/production'\]/.test(dossierSource.replace(/\/\/.*$/gm, '')), 'the dossier source never pushes, deploys or moves the pointer');
  ok(existsSync(join(ROOT, 'docs/release/evidence/go-no-go/README.md')) && /release-dossier\.mjs/.test(read('docs/release/evidence/go-no-go/README.md')) && /template/.test(read('docs/release/evidence/go-no-go/README.md')), 'the go-no-go directory is committed with a README naming the generator and the template');
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
}

// ═════════════════════════════════════════════════════════════════════════════
// 2 · synthetic-png: a valid PNG from pen strokes, without a browser
// ═════════════════════════════════════════════════════════════════════════════
{
  eq(crc32(Buffer.from('123456789')), 0xCBF43926, 'crc32 matches the PNG/zlib check value');
  const png = encodeGreyPng({ width: 3, height: 2, pixels: Buffer.from([0, 128, 255, 255, 128, 0]) });
  ok(png.subarray(0, 8).equals(PNG_SIGNATURE), 'the encoder writes the PNG signature');
  assert.deepEqual(pngDimensions(png), { width: 3, height: 2, bitDepth: 8, colourType: 0 }, 'IHDR reads back'); count += 1;
  assert.throws(() => encodeGreyPng({ width: 2, height: 2, pixels: Buffer.alloc(3) }), /does not match/, 'a short pixel buffer is refused'); count += 1;
  const ink = simulatedInkPng(['24']);
  ok(ink.label === 'SIMULATED-ink' && ink.strokes > 0 && pngDimensions(ink.png)?.width === ink.width, 'simulated ink is labelled SIMULATED and is a readable PNG');
  const photo = simulatedPhotoPng(['16 + (n-1)(-6) = -122', 'n = 24']);
  ok(photo.label === 'SIMULATED-photo' && photo.width >= 640 && photo.height >= 480, 'the simulated photo is labelled SIMULATED and photo-sized');
  ok(toDataUrl(ink.png).startsWith('data:image/png;base64,'), 'pictures are sent as PNG data URLs');
  const again = simulatedInkPng(['24']);
  ok(again.png.equals(ink.png), 'the same lines and seed draw the same picture (deterministic)');
}

// ═════════════════════════════════════════════════════════════════════════════
// 3 · staging-acceptance: argument policy, then the whole flow against a fake host
// ═════════════════════════════════════════════════════════════════════════════
{
  const a = parseAcceptanceArgs(['--email', 'owner@example.test', '--tester', 'Priya Example']);
  ok(a.target === 'staging' && a.origin === STAGING_ORIGIN && a.cleanup === false && a.maxReads === 4, 'defaults: staging, no cleanup, 4 reads');
  eq(TARGETS.production, PRODUCTION_ORIGIN, 'production target is the Railway production origin');
  assert.throws(() => parseAcceptanceArgs(['--target', 'production', '--email', 'o@example.test']), /needs --sha/, 'production needs --sha'); count += 1;
  assert.throws(() => parseAcceptanceArgs(['--target', 'production', '--sha', SHA, '--no-cleanup']), /refused/, 'production refuses --no-cleanup'); count += 1;
  assert.throws(() => parseAcceptanceArgs(['--target', 'production', '--sha', SHA, '--origin', 'https://elsewhere.example']), /cannot change it/, 'production cannot be pointed elsewhere'); count += 1;
  assert.throws(() => parseAcceptanceArgs(['--target', 'prod']), /staging or production/, 'unknown targets are refused'); count += 1;
  assert.throws(() => parseAcceptanceArgs(['--skip', 'Z']), /unknown step/, 'unknown skip ids are refused'); count += 1;
  assert.deepEqual([...STEP_IDS], ['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'], 'the steps are S0–S8, in run order'); count += 1;
  ok(STEP_IDS.every(id => /^S\d$/.test(id) && typeof STEPS[id] === 'string') && Object.keys(STEPS).length === STEP_IDS.length, 'every step id is S<n> with a title: none is a bare letter that reads as one of issue #686\'s Gates A–D');
  for (const letter of ['A', 'B', 'C', 'D', 'E', 'F', '0']) {
    assert.throws(() => parseAcceptanceArgs(['--skip', letter]), /unknown step/, `the retired id ${letter} is refused by --skip, not mapped`); count += 1;
  }
  assert.throws(() => parseAcceptanceArgs(['--skip', 'S0']), /preflight S0 cannot be/, 'the preflight cannot be skipped'); count += 1;
  assert.deepEqual([...parseAcceptanceArgs(['--skip', 's3, S6']).skip], ['S3', 'S6'], '--skip takes S-ids, case-insensitively'); count += 1;
  assert.deepEqual([...SKIPPABLE_STEPS], STEP_IDS.slice(1), 'every step but S0 can be skipped'); count += 1;
  assert.throws(() => parseAcceptanceArgs(['--origin', 'http://staging.example']), /https/, 'plain http is only for loopback'); count += 1;
  assert.throws(() => parseAcceptanceArgs(['--email', 'not-an-address']), /email/, 'a malformed mailbox is refused'); count += 1;
  assert.throws(() => parseAcceptanceArgs(['--max-reads', '1']), /2 to 10/, '--max-reads 1 is refused: S4 and S5 each reserve 2 reads, so 1 would silently skip both'); count += 1;
  eq(parseAcceptanceArgs(['--max-reads', '2']).maxReads, 2, '--max-reads 2 is the minimum');
  const prod = parseAcceptanceArgs(['--target', 'production', '--sha', SHA.toUpperCase(), '--email', 'o@example.test']);
  ok(prod.cleanup === true && prod.sha === SHA && prod.origin === PRODUCTION_ORIGIN, 'production forces cleanup and normalises the SHA');
  eq(plusAddress('owner@example.test', 'pri-child-ab12'), 'owner+pri-child-ab12@example.test', 'plus-addressing');
  eq(plusAddress('owner+x@example.test', 't'), 'owner+t@example.test', 'an existing tag is replaced');
  eq(maskEmail('owner@example.test'), 'ow…@example.test', 'addresses are masked in reports');
  const addr = deriveAddresses({ email: 'owner@example.test', guardianEmail: 'parent@example.test' }, 'ab12');
  ok(addr.child === 'owner+pri-child-ab12@example.test' && addr.guardian === 'parent@example.test' && addr.isolation === 'owner+pri-iso-ab12@example.test', 'derived addresses honour explicit ones');
  assert.deepEqual(expectedFromPrompt('An AP has first term $16$ and common difference $-6$, which term is equal to $-122$? Give the term number.'), { a: 16, d: -6, term: -122, n: 24 }, 'the expected term number is worked out from the printed question'); count += 1;
  eq(expectedFromPrompt('first term $5$ and common difference $2$, which term is equal to $12$? Give the term number.'), null, 'a non-integer term number is not forced');
  eq(expectedFromPrompt('Solve x^2 = 4'), null, 'another form is not parsed');
  const acceptanceSource = read('tools/acceptance/staging-acceptance.mjs');
  ok(!/x-pri-client/i.test(acceptanceSource), 'the runner never claims to be a native shell');
  ok(/send\.origin = origin/.test(acceptanceSource), 'mutations carry the deployed origin as a browser on it would');

  // ── the fake deployed host ─────────────────────────────────────────────────
  /**
   * A well-behaved deployment, with four defects it can be told to have so the
   * tool's probes are shown to catch them: `skipOwnership` answers practice
   * calls for any verified account's question (no per-account check);
   * `leakExport` puts another account's learning rows into every export;
   * `issueAfterWithdrawal` keeps issuing questions to a child whose guardian
   * withdrew (the consent gate on /practice/issue ignores a withdrawal);
   * `loseAttempt` drops an account's oldest graded attempt when it signs in
   * again (History lost on a returning sign-in).
   *
   * The parent's mailbox gets what the real server sends an email parent:
   * the approval code and, beside it, the "Confirm your child's account" link
   * (`kind: 'link'`, /guardian/consent#action=guardian-consent&token=…) whose
   * token POST /v1/account/guardian/withdraw accepts. `pullPageSize` (state)
   * makes GET /v1/sync/pull/:cursor page.
   */
  function fakeHost({ sha = SHA, schemaVersion = SCHEMA_VERSION, skipOwnership = false, leakExport = false, issueAfterWithdrawal = false, loseAttempt = false } = {}) {
    const state = {
      accounts: new Map(), sessions: new Map(), challenges: new Map(), mailbox: [], questions: new Map(), receipts: new Map(),
      grades: new Map(), reads: new Set(), log: [], transcribeBodies: [], originMisses: 0, csrfMisses: 0, codeSeq: 0,
      links: new Map(), cursorSeq: 0, pullPageSize: 100,
      // One clock for the host and the runner (passed as its `now`), so a test
      // can age student A's session past the export's fresh-proof window.
      clockOffsetMs: 0
    };
    state.now = () => Date.now() + state.clockOffsetMs;
    const NOTICE = 'v3';
    const PROMPT = 'An AP has first term $16$ and common difference $-6$, which term is equal to $-122$? Give the term number.';
    const EXPECTED_N = 24;
    const newCode = () => String(100000 + (++state.codeSeq));
    const parseCookies = header => Object.fromEntries(String(header || '').split(';').map(s => s.trim()).filter(Boolean).map(s => { const i = s.indexOf('='); return [s.slice(0, i), s.slice(i + 1)]; }));
    const decodeLines = dataUrl => { const b64 = String(dataUrl).replace(/^data:image\/png;base64,/, ''); const text = Buffer.from(b64, 'base64').toString('utf8'); return text.startsWith('PNG:') ? text.slice(4) : null; };
    const server = createServer(async (req, res) => {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : null;
      const url = new URL(req.url, 'http://x');
      const path = url.pathname;
      const method = req.method;
      const entry = { method, path, status: null, accountId: null };
      state.log.push(entry);
      const headers = {};
      const send = (status, payload) => { entry.status = status; res.writeHead(status, { 'content-type': 'application/json', ...headers }); res.end(JSON.stringify(payload)); };
      const fail = (status, code) => send(status, { error: { code, message: code } });
      const mutation = !['GET', 'HEAD'].includes(method);
      const myOrigin = `http://127.0.0.1:${server.address().port}`;
      if (mutation && req.headers.origin !== myOrigin) { state.originMisses += 1; return fail(403, 'ORIGIN_REJECTED'); }
      const cookies = parseCookies(req.headers.cookie);
      const session = cookies.pri_cloud_session ? state.sessions.get(cookies.pri_cloud_session) : null;
      if (mutation && cookies.pri_cloud_session) {
        if (req.headers['x-pri-csrf'] !== `csrf-${cookies.pri_cloud_session}` || cookies.pri_csrf !== `csrf-${cookies.pri_cloud_session}`) { state.csrfMisses += 1; return fail(403, 'CSRF_REJECTED'); }
      }
      const account = session ? state.accounts.get(session.accountId) : null;
      entry.accountId = account?.id || null;
      const issueSession = (acct, deviceId) => {
        const token = randomUUID().replace(/-/g, '');
        state.sessions.set(token, { id: `sess-${token.slice(0, 8)}`, accountId: acct.id, deviceId, createdAt: state.now() });
        headers['set-cookie'] = [`pri_cloud_session=${token}; Path=/; HttpOnly`, `pri_csrf=csrf-${token}; Path=/`];
        return token;
      };
      const publicAccount = acct => ({ id: acct.id, email: acct.email, emailVerified: acct.verified, name: acct.name, role: 'student' });
      const consentOf = acct => acct.ageBasis === 'child' ? { required: true, state: acct.consent } : { required: false, state: 'not-required' };
      const requireSession = () => { if (!session || !account) { fail(401, 'AUTH_REQUIRED'); return false; } return true; };
      const requireVerified = () => { if (!account.verified) { fail(403, 'EMAIL_UNVERIFIED'); return false; } return true; };
      // guardianConsent.js consentBlockerCode: pending → GUARDIAN_CONSENT_PENDING, withdrawn → GUARDIAN_CONSENT_WITHDRAWN.
      const blockerOf = acct => acct.ageBasis !== 'child' || acct.consent === 'given' ? null : acct.consent === 'withdrawn' ? 'GUARDIAN_CONSENT_WITHDRAWN' : 'GUARDIAN_CONSENT_PENDING';
      const requireConsent = ({ issuing = false } = {}) => {
        const blocker = blockerOf(account);
        if (!blocker || (issuing && issueAfterWithdrawal && blocker === 'GUARDIAN_CONSENT_WITHDRAWN')) return true;
        fail(403, blocker);
        return false;
      };

      if (method === 'GET' && path === '/v1/health') return send(200, { ok: true, service: 'pri-learning-platform', releaseIdentity: { releaseSha: sha }, schemaVersion: String(schemaVersion), billingSchemaVersion: String(BILLING_SCHEMA_VERSION), database: { engine: 'postgres', reachable: true } });
      if (method === 'GET' && path === '/v1/ready') return send(200, { ready: true, state: 'ready', releaseSha: sha, failing: [], degraded: [], checks: { database: { state: 'ok', engine: 'postgres', schemaVersion: String(schemaVersion), billingSchemaVersion: String(BILLING_SCHEMA_VERSION) }, authEmail: { state: 'ok' }, handwriting: { state: 'ok' } } });
      if (method === 'GET' && path === '/release.json') return send(200, { releaseSha: sha });

      if (method === 'POST' && path === '/v1/account/otp/request') {
        const id = `otp-${randomUUID().slice(0, 8)}`;
        const code = newCode();
        state.challenges.set(id, { code, destination: body.destination, purpose: 'sign-in', consumed: false });
        state.mailbox.push({ to: body.destination, code, purpose: 'sign-in' });
        return send(202, { ok: true, channel: 'email', challengeId: id });
      }
      if (method === 'POST' && path === '/v1/account/otp/verify') {
        const existing = [...state.accounts.values()].find(a => a.email === body.destination);
        const ch = state.challenges.get(body.challengeId);
        if (body.signupTicket) {
          const t = state.challenges.get(body.signupTicket);
          if (!t || t.consumed || t.destination !== body.destination) return fail(400, 'OTP_INVALID');
          t.consumed = true;
        } else {
          if (!ch || ch.consumed || ch.destination !== body.destination || ch.code !== body.code) return fail(400, 'OTP_INVALID');
          if (!existing && !body.profile) {
            ch.consumed = true;
            const ticket = `ticket-${randomUUID().slice(0, 8)}`;
            state.challenges.set(ticket, { code: null, destination: body.destination, purpose: 'sign-in', consumed: false });
            return send(200, { status: 'profile-required', signupTicket: ticket });
          }
          ch.consumed = true;
        }
        if (existing) {
          if (loseAttempt) { const at = existing.events.findIndex(ev => ev.kind === 'graded-attempt'); if (at >= 0) existing.events.splice(at, 1); }
          issueSession(existing, body.deviceId);
          return send(200, { status: 'signed-in', created: false, account: publicAccount(existing), guardianConsent: consentOf(existing) });
        }
        const child = body.profile.isAdult !== true;
        const acct = { id: `acct-${randomUUID().slice(0, 8)}`, email: body.destination, name: body.profile.name, verified: !(state.unverifiedSignups && /pri-iso/.test(body.destination)), ageBasis: child ? 'child' : 'adult', consent: child ? 'pending' : 'not-required', password: null, events: [] };
        state.accounts.set(acct.id, acct);
        issueSession(acct, body.deviceId);
        return send(201, { status: 'signed-in', created: true, account: publicAccount(acct), guardianConsent: consentOf(acct) });
      }
      if (method === 'POST' && path === '/v1/account/register') {
        if ([...state.accounts.values()].some(a => a.email === body.email)) return fail(409, 'EMAIL_EXISTS');
        const acct = { id: `acct-${randomUUID().slice(0, 8)}`, email: body.email, name: body.name, verified: false, ageBasis: body.isAdult === true ? 'adult' : 'child', consent: 'not-required', password: body.password, events: [] };
        state.accounts.set(acct.id, acct);
        issueSession(acct, body.deviceId);
        return send(201, { account: publicAccount(acct), verificationRequired: true });
      }
      if (method === 'POST' && path === '/v1/account/otp/delete-request') {
        const id = `del-${randomUUID().slice(0, 8)}`;
        const code = newCode();
        state.challenges.set(id, { code, destination: body.email, purpose: 'reauth', consumed: false });
        state.mailbox.push({ to: body.email, code, purpose: 'reauth' });
        return send(202, { ok: true, channel: 'email', challengeId: id });
      }
      if (method === 'POST' && path === '/v1/account/otp/delete-confirm') {
        const ch = state.challenges.get(body.challengeId);
        if (!ch || ch.consumed || ch.destination !== body.email || ch.code !== body.code) return fail(400, 'OTP_INVALID');
        ch.consumed = true;
        const acct = [...state.accounts.values()].find(a => a.email === body.email);
        if (!acct) return send(200, { deleted: false, accountFound: false });
        state.accounts.delete(acct.id);
        return send(200, { deleted: true, accountFound: true });
      }
      if (method === 'POST' && path === '/v1/account/otp/guardian/approve') {
        if (body.approve !== true || body.noticeVersion !== NOTICE) return fail(400, 'GUARDIAN_NOTICE_REQUIRED');
        const live = [...state.challenges.entries()].reverse().find(([, c]) => c.purpose === 'guardian-consent' && c.destination === body.destination && !c.consumed);
        if (!live || live[1].code !== body.code) return fail(400, 'OTP_INVALID');
        live[1].consumed = true;
        const acct = state.accounts.get(live[1].accountId);
        acct.consent = 'given';
        return send(200, { ok: true, confirmed: true, childName: acct.name });
      }
      if (method === 'POST' && path === '/v1/account/guardian/withdraw') {
        // accounts.js: no session; the emailed link's token, whatever the consent's state.
        const link = state.links.get(String(body?.token || ''));
        if (!link) return fail(400, 'TOKEN_INVALID');
        const acct = state.accounts.get(link.accountId);
        const withdrawn = !!acct && acct.consent !== 'withdrawn';
        if (acct) acct.consent = 'withdrawn';
        return send(200, { ok: true, withdrawn });
      }

      if (!requireSession()) return;
      if (method === 'GET' && path === '/v1/account/me') return send(200, { account: publicAccount(account) });
      if (method === 'GET' && path === '/v1/account/devices') return send(200, { devices: [...state.sessions.values()].filter(s => s.accountId === account.id).map(s => ({ id: s.id, deviceId: s.deviceId, current: s.id === session.id })) });
      if (method === 'DELETE' && path.startsWith('/v1/account/devices/')) {
        const id = path.split('/').pop();
        const entry = [...state.sessions.entries()].find(([, s]) => s.id === id && s.accountId === account.id);
        if (entry) state.sessions.delete(entry[0]);
        return send(200, { revoked: !!entry, current: id === session.id });
      }
      if (method === 'GET' && path === '/v1/account/export') {
        // The real gate (accounts.js requireRecentAuth): the credential proven
        // inside EXPORT_FRESH_MS, else 401 REAUTH_REQUIRED naming the proofs a
        // code-only account can offer. Nothing of the export leaks on refusal.
        if (state.now() - session.createdAt > EXPORT_FRESH_MS) { headers['cache-control'] = 'no-store'; return send(401, { error: { code: 'REAUTH_REQUIRED', message: 'Confirm it is you before continuing.', proofs: ['otp'], freshMs: EXPORT_FRESH_MS } }); }
        // The real shape (server/platform/accounts.js): rows keyed by SQL column names.
        const own = account.events.map(ev => ({ id: ev.id, device_id: 'd', device_seq: ev.serverCursor, kind: ev.kind, entity_id: ev.entityId, occurred_at: 't', payload_json: '{}', created_at: 't' }));
        const leaked = leakExport ? [...state.accounts.values()].filter(a => a.id !== account.id).flatMap(a => a.events.map(ev => ({ id: ev.id, device_id: 'd', device_seq: ev.serverCursor, kind: ev.kind, entity_id: ev.entityId, occurred_at: 't', payload_json: '{}', created_at: 't' }))) : [];
        return send(200, { format: 'pri-account-export-v1', exportedAt: 't', account: { id: account.id, email: account.email, name: account.name, role: 'student' }, identities: [], learningEvents: [...own, ...leaked], entities: [], classes: [], assignmentSubmissions: [], issueReports: [], guardianConsent: null, entitlements: [] });
      }
      if (method === 'DELETE' && path === '/v1/account') {
        if (!account.password || body?.password !== account.password) return fail(401, 'REAUTH_REQUIRED');
        state.accounts.delete(account.id);
        return send(200, { deleted: true });
      }
      if (method === 'GET' && path === '/v1/account/guardian/state') {
        const blockerCode = blockerOf(account);
        return send(200, { accountId: account.id, required: account.ageBasis === 'child', state: account.ageBasis === 'child' ? account.consent : 'not-required', blockerCode, eligible: blockerCode === null && account.verified, emailVerified: account.verified });
      }
      if (method === 'POST' && path === '/v1/account/otp/guardian/request') {
        if (account.ageBasis !== 'child') return fail(409, 'GUARDIAN_CONSENT_NOT_REQUIRED');
        if (body.destination === account.email) return fail(400, 'GUARDIAN_SAME_AS_STUDENT');
        const id = `g-${randomUUID().slice(0, 8)}`;
        const code = newCode();
        state.challenges.set(id, { code, destination: body.destination, purpose: 'guardian-consent', consumed: false, accountId: account.id });
        state.mailbox.push({ to: body.destination, code, purpose: 'guardian-consent' });
        if (body.channel === 'email') {
          // otp.js queues the parent's link (authDelivery.js buildAuthActionUrl) beside the code.
          const token = randomBytes(32).toString('base64url');
          state.links.set(token, { accountId: account.id, purpose: 'guardian-consent' });
          state.mailbox.push({ to: body.destination, kind: 'link', token, link: `${myOrigin}/guardian/consent#action=guardian-consent&token=${token}`, purpose: 'guardian-consent' });
        }
        return send(202, { ok: true, channel: 'email', noticeVersion: NOTICE, challengeId: id });
      }
      const pull = path.match(/^\/v1\/sync\/pull\/(\d+)$/);
      if (method === 'GET' && pull) {
        if (!requireConsent()) return;
        // sync.js syncPullPage: this account's rows past the cursor, in cursor order, a page at a time.
        const after = Number(pull[1]);
        const rows = account.events.filter(ev => ev.serverCursor > after).sort((x, y) => x.serverCursor - y.serverCursor).slice(0, state.pullPageSize);
        const cursor = rows.length ? rows[rows.length - 1].serverCursor : after;
        return send(200, { schemaVersion: 1, cursor, hasMore: account.events.some(ev => ev.serverCursor > cursor), events: rows, entities: [] });
      }
      if (method === 'POST' && path === '/v1/practice/issue') {
        if (!requireVerified() || !requireConsent({ issuing: true })) return;
        const id = randomUUID();
        state.questions.set(id, { accountId: account.id, expectedN: EXPECTED_N });
        return send(201, { question: { id, prompt: PROMPT, subtopic: 'c10-arithmetic-progressions', difficulty: 3, criteriaCount: 3, supportsSteps: true }, accountId: account.id });
      }
      if (method === 'POST' && path === '/v1/handwriting/transcribe') {
        if (!requireVerified() || !requireConsent()) return;
        state.transcribeBodies.push(body);
        if (Object.keys(body).join(',') !== 'image') return fail(400, 'HANDWRITING_REQUEST_INVALID');
        const text = decodeLines(body.image);
        if (text === null) return fail(400, 'HANDWRITING_IMAGE_INVALID');
        const key = `${account.id}:${body.image}`;
        const reused = state.reads.has(key);
        state.reads.add(key);
        return send(200, { reused, transcription: { engine: 'fake-reader', text, lines: text.split('\n'), confidence: 0.98, needsConfirmation: false, latencyMs: 12 } });
      }
      const practice = path.match(/^\/v1\/practice\/([^/]+)\/(recognize|submit|reveal|repeat|recognition\/([^/]+)\/confirm)$/);
      if (method === 'POST' && practice) {
        if (!requireVerified() || !requireConsent()) return;
        const [, qid, action, sourceReceipt] = practice;
        const q = state.questions.get(qid);
        if (!q || (!skipOwnership && q.accountId !== account.id)) return fail(404, 'QUESTION_NOT_FOUND');
        if (action === 'reveal') return send(200, { questionId: qid, revealed: true });
        if (action === 'repeat') return send(201, { questionId: qid, repeat: true });
        if (action === 'recognize') {
          const text = decodeLines(body.image);
          if (text === null) return fail(400, 'RECOGNITION_IMAGE_INVALID');
          const key = `${account.id}:${body.image}`;
          const reused = state.reads.has(key);
          state.reads.add(key);
          const receipt = randomUUID();
          state.receipts.set(receipt, { qid, mode: body.mode, text, accountId: account.id });
          return send(201, { receipt, questionId: qid, mode: body.mode, reused, transcription: { text, lines: text.split('\n'), confidence: 0.98, needsConfirmation: false } });
        }
        if (action.startsWith('recognition/')) {
          const prior = state.receipts.get(sourceReceipt);
          if (!prior || prior.qid !== qid) return fail(404, 'RECOGNITION_RECEIPT_INVALID');
          const receipt = randomUUID();
          state.receipts.set(receipt, { qid, mode: prior.mode, text: body.text, accountId: account.id, corrected: true });
          return send(201, { receipt, questionId: qid, mode: prior.mode, corrected: true });
        }
        // submit
        const key = `${qid}:${body.submissionId}`;
        if (state.grades.has(key)) return send(200, state.grades.get(key));
        if (body.mode !== 'typed') {
          const proof = state.receipts.get(body.transcriptionReceipt);
          if (!proof) return fail(422, 'RECOGNITION_RECEIPT_INVALID');
          if (proof.mode !== body.mode || proof.text !== body.answer || proof.qid !== qid) return fail(422, 'RECOGNITION_RECEIPT_MISMATCH');
        }
        const final = String(body.answer).replace(/\s+/g, '').replace(/^n=/, '');
        const correct = final === String(q.expectedN);
        const response = { authoritative: true, questionId: qid, submissionId: body.submissionId, attemptId: randomUUID(), correct, invalid: false, resolved: true, marksEarned: correct ? 3 : 0, marksPossible: 3, triesLeft: correct ? 0 : 1 };
        state.grades.set(key, response);
        // practice.js: the server grader's row, keyed by the attempt id, payload carrying the mark.
        account.events.push({ serverCursor: ++state.cursorSeq, id: response.attemptId, deviceId: 'server-grader', kind: 'graded-attempt', entityId: qid,
          payload: { attemptId: response.attemptId, submissionId: body.submissionId, questionId: qid, correct, marksEarned: response.marksEarned, marksPossible: response.marksPossible } });
        return send(200, response);
      }
      return fail(404, 'NOT_FOUND');
    });
    return new Promise(resolveStart => server.listen(0, '127.0.0.1', () => resolveStart({ server, state, origin: `http://127.0.0.1:${server.address().port}` })));
  }
  const fakePictures = {
    ink: lines => ({ png: Buffer.from('PNG:' + lines.join('\n')), label: 'SIMULATED-ink', width: 320, height: 240, strokes: lines.length }),
    photo: lines => ({ png: Buffer.from('PNG:' + lines.join('\n')), label: 'SIMULATED-photo', width: 640, height: 480, strokes: lines.length })
  };
  /**
   * A scripted human at the one shared mailbox: asked at S3, they copy the
   * parent's link; asked anywhere else, they read the oldest unread code.
   */
  const humanFor = state => async question => {
    const wantsLink = /^\[S3\]/.test(String(question ?? ''));
    const item = state.mailbox.find(m => !m.read && (wantsLink ? m.kind === 'link' : m.kind !== 'link'));
    if (!item) return '';
    item.read = true;
    return wantsLink ? item.link : item.code;
  };
  /** Everything a human read or copied from the mailbox: none of it may be printed or saved. */
  const secretsOf = state => state.mailbox.flatMap(m => [m.code, m.link, m.token]).filter(Boolean);
  const baseArgs = (origin, extra = {}) => ({ target: 'staging', origin, sha: SHA, email: 'owner@example.test', childEmail: null, guardianEmail: null, tester: 'Priya Example', nonInteractive: false, skip: new Set(), cleanup: false, out: null, maxReads: 4, json: false, ...extra });

  // ── 3a · the full interactive staging run ─────────────────────────────────
  {
    const { server, state, origin } = await fakeHost();
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    const lines = [];
    const reader = humanFor(state);
    // From S6's sign-in on, the host answers the pull one row per page, so the
    // returning student's walk has to follow hasMore to see both attempts.
    const human = async question => { if (/^\[S6\]/.test(question)) state.pullPageSize = 1; return reader(question); };
    try {
      const report = await runAcceptance(baseArgs(origin), { prompt: human, log: line => lines.push(line), pictures: fakePictures, outDir, now: state.now });
      const status = Object.fromEntries(report.steps.map(s => [s.id, s.status]));
      const failures = report.steps.flatMap(s => s.checks.filter(c => !c.ok).map(c => `${s.id}: ${c.label} (${c.detail || ''})`));
      ok(['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'].every(id => status[id] === STATUS.PASS),
        `steps S0–S7 pass against a well-behaved host (failures: ${failures.join(' | ') || 'none'}; statuses ${JSON.stringify(status)})`);
      assert.deepEqual(report.steps.map(s => s.id), [...STEP_IDS], 'the report lists S0–S8 in run order'); count += 1;
      assert.deepEqual(Object.keys(report.summary), [...STEP_IDS], 'the report summary is keyed S0–S8'); count += 1;
      eq(status.S8, STATUS.SKIPPED, 'cleanup is off on staging unless asked');
      eq(exitCodeFor(report), 0, 'exit 0 when every attempted step passed');
      const humanCount = id => report.humanSteps.filter(h => h.step === id).length;
      ok(humanCount('S1') === 1 && humanCount('S2') === 2 && humanCount('S3') === 1 && humanCount('S6') === 1 && humanCount('S7') === 1 && report.humanSteps.length === 6,
        'S1 names one human step (the code), S2 two (the child\'s code and the parent\'s), S3 one (the parent\'s link), S6 one (A\'s new code), S7 one (the isolation account\'s code): six in all');
      ok(['S1', 'S2', 'S3', 'S6', 'S7'].every(id => lines.some(l => l.startsWith(`HUMAN STEP [${id}]:`))), 'HUMAN STEP lines are printed with the S-id');
      ok(!lines.some(l => /^HUMAN STEP \[[A-F0]\]/.test(l)) && !lines.some(l => /^── [A-F0] · /.test(l)), 'no line names a retired step letter');
      const secrets = secretsOf(state);
      ok(secrets.length >= 7 && lines.every(line => !secrets.some(secret => line.includes(secret))), 'no code, link or link token the human read appears in the output');
      ok(secrets.every(secret => !JSON.stringify(report).includes(secret)), 'no code, link or link token appears in the report');
      ok(!JSON.stringify(report).includes('owner@example.test'), 'the report masks the mailbox address');
      ok(state.transcribeBodies.length === 2 && state.transcribeBodies.every(b => Object.keys(b).join(',') === 'image'), 'every transcribe body was exactly { image }');
      eq(report.providerReads, 2, 'S4 and S5 each spent one provider read; recognize reused it');
      eq(state.originMisses, 0, 'every mutation carried the deployed origin');
      eq(state.csrfMisses, 0, 'every authenticated mutation carried the CSRF pair');
      const stepOf = id => report.steps.find(s => s.id === id);
      ok(stepOf('S4').evidence === EVIDENCE.SYNTHETIC_PICTURE && stepOf('S1').evidence === EVIDENCE.REAL_MAILBOX && stepOf('S3').evidence === EVIDENCE.REAL_MAILBOX_LINK && stepOf('S6').evidence === EVIDENCE.REAL_MAILBOX && stepOf('S7').evidence === EVIDENCE.TEST_ACCOUNTS, 'evidence classes are labelled per step');
      ok(/SYNTHETIC/.test(EVIDENCE.SYNTHETIC_PICTURE) && /REAL mailbox/.test(EVIDENCE.REAL_MAILBOX) && /not a student/i.test(EVIDENCE.REAL_MAILBOX) && /REAL mailbox/.test(EVIDENCE.REAL_MAILBOX_LINK) && /not a student/i.test(EVIDENCE.REAL_MAILBOX_LINK), 'the labels say synthetic vs real and that the accounts are not students');
      const files = readdirSync(outDir);
      ok(files.includes('SIMULATED-ink-S4.png') && files.includes('SIMULATED-photo-S5.png') && files.includes('report.json'), 'pictures are saved under SIMULATED-* names next to the report');
      const c = stepOf('S4');
      ok(c.checks.some(ch => /right term number is marked right/.test(ch.label) && ch.ok), 'S4: the term number worked out from the printed question is marked right');
      ok(c.checks.some(ch => /no double credit/.test(ch.label) && ch.ok), 'S4: the replay returns the same attempt');
      const d = stepOf('S5');
      ok(d.checks.some(ch => /explicit transcript correction/.test(ch.label) && ch.ok), 'S5: a multi-line photo reading goes through the explicit confirmation of the final line');
      ok(d.checks.some(ch => /right term number is marked right/.test(ch.label) && ch.ok), 'S5: the confirmed final line is marked right');
      const accounts = [...state.accounts.values()];
      ok(accounts.length === 3 && accounts.filter(a => a.ageBasis === 'child').length === 1 && accounts.every(a => a.verified === true), 'the run made exactly three test accounts: A (adult), the child, the isolation account — all verified by code (none through /register); S6 made none');
      ok(report.accounts.every(a => a.email && !a.email.includes('owner@')), 'account rows in the report are masked');
      // S3 · the parent withdraws through their page's route; the child is refused.
      const w = stepOf('S3');
      ok(w.checks.length === 4 && w.checks.every(ch => ch.ok), `S3: the link, the withdrawal, the refusal and the state all held (${w.checks.map(ch => ch.label).join('; ')})`);
      ok(w.checks.some(ch => /refused \(403 GUARDIAN_CONSENT_WITHDRAWN\)/.test(ch.label) && /status 403 GUARDIAN_CONSENT_WITHDRAWN/.test(ch.detail)), 'S3: the child\'s next POST /v1/practice/issue was refused 403 GUARDIAN_CONSENT_WITHDRAWN');
      ok(w.checks.some(ch => /state is now withdrawn/.test(ch.label) && /state withdrawn, blocker GUARDIAN_CONSENT_WITHDRAWN/.test(ch.detail)), 'S3: /v1/account/guardian/state says withdrawn');
      const child = accounts.find(a => a.ageBasis === 'child');
      eq(child.consent, 'withdrawn', 'S3: the child\'s consent is withdrawn on the host');
      const withdrawals = state.log.filter(r => r.path === '/v1/account/guardian/withdraw');
      ok(withdrawals.length === 1 && withdrawals[0].status === 200 && withdrawals[0].accountId === null, 'S3: one POST /v1/account/guardian/withdraw, with no session (the parent\'s page holds none)');
      const issuesByChild = state.log.filter(r => r.path === '/v1/practice/issue' && r.accountId === child.id);
      ok(issuesByChild.map(r => r.status).join(',') === '403,201,403', `the child was refused before approval, issued after it, refused after the withdrawal (${issuesByChild.map(r => r.status).join(',')})`);
      // S6 · a fresh session gets both marked attempts back.
      const r6 = stepOf('S6');
      ok(r6.checks.every(ch => ch.ok) && r6.checks.length === 6, `S6: the new code, the same account, a new session, the pull and both attempt checks held (${r6.checks.map(ch => `${ch.label} (${ch.detail || ''})`).join('; ')})`);
      ok(r6.checks.some(ch => /reads History back/.test(ch.label) && /^2 page\(s\), 2 event\(s\)$/.test(ch.detail)), 'S6: the pull followed hasMore across pages (one row per page: two pages for two attempts)');
      ok(r6.checks.some(ch => /comes back, once, by attempt id \(2\)/.test(ch.label) && /^2\/2 back$/.test(ch.detail)), 'S6: both attempts S4 and S5 marked came back by attempt id');
      ok(r6.checks.some(ch => /carries the question, submission and mark/.test(ch.label) && ch.detail === '2 match'), 'S6: and both carry the mark the server gave');
      const aId = report.accounts.find(a => a.role === 'A').accountId;
      const aSessions = [...state.sessions.values()].filter(s => s.accountId === aId);
      ok(aSessions.length === 2 && aSessions.some(s => /^acceptance-S1-/.test(s.deviceId)) && aSessions.some(s => /^acceptance-S6-/.test(s.deviceId)), 'S6 signed A in on its own device session; S1\'s session was left alone');
      // S7 · isolation, unchanged.
      const e = stepOf('S7');
      ok(e.checks.length >= 12 && e.checks.every(ch => ch.ok), `S7: ${e.checks.length} isolation probes all held`);
      const ownership = e.checks.filter(ch => /refused by ownership \(404 QUESTION_NOT_FOUND\)/.test(ch.label));
      ok(ownership.length === 4 && ownership.every(ch => ch.ok && /status 404 QUESTION_NOT_FOUND/.test(ch.detail)), 'S7: all four cross-account question probes (submit, recognize, reveal, repeat) reached the ownership check (404 QUESTION_NOT_FOUND), not EMAIL_UNVERIFIED');
      ok(e.checks.some(ch => /pri-account-export-v1 shape/.test(ch.label) && ch.ok) && e.checks.some(ch => /export holds none of student A/.test(ch.label) && ch.ok && /^1 event\(s\)/.test(ch.detail) === false), 'S7: the export probe read learningEvents[] of the real shape');
      ok(e.checks.some(ch => /inside the fresh-proof window, is student A's/.test(ch.label) && ch.ok && /status 200/.test(ch.detail)), 'S7: a quick run (A signed in moments ago) reads A\'s own export');
      ok(!e.pending, 'S7: no probe was left NOT VERIFIED on a verified isolation account');
      const isoId = report.accounts.find(a => a.role === 'B2 (isolation)').accountId;
      const practiceByIso = state.log.filter(r => /^\/v1\/practice\//.test(r.path) && r.accountId === isoId);
      ok(practiceByIso.length === 4 && practiceByIso.every(r => r.status === 404), 'the fake host saw exactly four practice calls from the isolation account (submit, recognize, reveal, repeat) and refused each with 404');
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
  }

  // ── 3b · non-interactive: HUMAN STEP printed, nothing created, exit 3 ────
  {
    const { server, state, origin } = await fakeHost();
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    const lines = [];
    try {
      const report = await runAcceptance(baseArgs(origin, { nonInteractive: true, tester: null }), { prompt: null, log: line => lines.push(line), pictures: fakePictures, outDir });
      const status = Object.fromEntries(report.steps.map(s => [s.id, s.status]));
      eq(status.S0, STATUS.PASS, 'non-interactive: preflight still runs');
      eq(status.S1, STATUS.NOT_VERIFIED, 'non-interactive: S1 is NOT VERIFIED, not failed');
      ok(status.S4 === STATUS.SKIPPED && status.S5 === STATUS.SKIPPED && status.S6 === STATUS.SKIPPED && status.S7 === STATUS.SKIPPED, 'non-interactive: S4, S5, S6, S7 are skipped for want of a session');
      ok(status.S3 === STATUS.SKIPPED && report.steps.find(s => s.id === 'S3').notes.some(n => /confirmed at S2/.test(n)), 'non-interactive: S3 is skipped: no child was confirmed at S2');
      eq(exitCodeFor(report), 3, 'exit 3 when a human step is open');
      ok(lines.some(l => l.startsWith('HUMAN STEP [S1]:')) && lines.some(l => l.startsWith('HUMAN STEP [S2]:')), 'non-interactive: the human steps are printed');
      eq(state.accounts.size, 0, 'non-interactive: no account was created (no code was ever typed)');
      ok(state.log.filter(r => r.path === '/v1/account/otp/request').length === 2, 'the two codes (S1, the child at S2) were requested so the human can find them');
      eq(state.log.filter(r => r.path === '/v1/account/guardian/withdraw').length, 0, 'non-interactive: nothing was withdrawn');
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
  }

  // ── 3c · a wrong SHA or a drifted schema fails preflight and stops ────────
  {
    const { server, state, origin } = await fakeHost({ sha: OTHER });
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    try {
      const report = await runAcceptance(baseArgs(origin), { prompt: humanFor(state), log: () => {}, pictures: fakePictures, outDir });
      eq(report.steps[0].status, STATUS.FAIL, 'a host running another SHA fails preflight');
      ok(report.steps.slice(1).every(s => s.status === STATUS.SKIPPED), 'nothing else is attempted after a failed preflight');
      eq(exitCodeFor(report), 1, 'exit 1 on a failed check');
      eq(state.accounts.size, 0, 'no account is created on a host that failed preflight');
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
    const drifted = await fakeHost({ schemaVersion: SCHEMA_VERSION - 1 });
    const outDir2 = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    try {
      const report = await runAcceptance(baseArgs(drifted.origin), { prompt: humanFor(drifted.state), log: () => {}, pictures: fakePictures, outDir: outDir2 });
      ok(report.steps[0].status === STATUS.FAIL && report.steps[0].checks.some(c => !c.ok && c.label.includes('schema_version')), 'a host one schema behind this checkout fails preflight');
    } finally { drifted.server.close(); rmSync(outDir2, { recursive: true, force: true }); }
  }

  // ── 3d · production is refused unless nominated; when nominated, it cleans up ──
  {
    const { server, state, origin } = await fakeHost();
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    try {
      let nominateCalls = 0;
      const refusing = async () => { nominateCalls += 1; return { ok: false, results: [{ ok: false, label: 'staging runs the nominated SHA' }] }; };
      await assert.rejects(
        runAcceptance(baseArgs(origin, { target: 'production', cleanup: true }), { prompt: humanFor(state), log: () => {}, pictures: fakePictures, outDir, nominate: refusing }),
        error => error.code === 'NOT_NOMINATED' && error.exitCode === 2 && /Nothing was sent to production/.test(error.message)
      ); count += 1;
      eq(nominateCalls, 1, 'production consults the nomination first');
      eq(state.log.length, 0, 'a refused production run sends nothing to the host');

      const passing = async () => ({ ok: true, results: [] });
      const lines = [];
      const report = await runAcceptance(baseArgs(origin, { target: 'production', cleanup: true }), { prompt: humanFor(state), log: line => lines.push(line), pictures: fakePictures, outDir, nominate: passing });
      const status = Object.fromEntries(report.steps.map(s => [s.id, s.status]));
      const failures = report.steps.flatMap(s => s.checks.filter(c => !c.ok).map(c => `${s.id}: ${c.label} (${c.detail || ''})`));
      ok(STEP_IDS.every(id => status[id] === STATUS.PASS), `a nominated production run passes every step S0–S8 including cleanup (failures: ${failures.join(' | ') || 'none'})`);
      eq(state.accounts.size, 0, 'cleanup deleted every account the run created (the withdrawn child included)');
      ok(report.humanSteps.filter(h => h.step === 'S8').length === 3, 'cleanup names the three deletion codes a human reads (A, the child and the isolation account: all are code accounts)');
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
  }

  // ── 3d′ · a host without the per-account ownership check FAILS S7 ────────
  {
    const { server, state, origin } = await fakeHost({ skipOwnership: true });
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    try {
      const report = await runAcceptance(baseArgs(origin), { prompt: humanFor(state), log: () => {}, pictures: fakePictures, outDir });
      const e = report.steps.find(s => s.id === 'S7');
      eq(e.status, STATUS.FAIL, 'S7 FAILS when a verified second account can act on A\'s question');
      const failed = e.checks.filter(ch => !ch.ok);
      const ownershipFailed = failed.filter(ch => /refused by ownership/.test(ch.label));
      ok(ownershipFailed.length === 4 && ownershipFailed.filter(ch => /status 20[01]/.test(ch.detail)).length === 3 && ownershipFailed.every(ch => !/QUESTION_NOT_FOUND/.test(ch.detail)), `all four ownership probes (submit, recognize, reveal, repeat) failed: submit, reveal and repeat were accepted, none was refused by ownership (${failed.map(ch => ch.detail).join('; ')})`);
      const exportFailed = failed.filter(ch => /export holds none of student A/.test(ch.label));
      ok(failed.length === 5 && exportFailed.length === 1 && /1 of A's/.test(exportFailed[0].detail), 'and the accepted foreign submit then shows up as A\'s row in B2\'s export — the export probe counts real rows');
      ok(['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6'].every(id => report.steps.find(s => s.id === id).status === STATUS.PASS), 'the other steps still pass: the defect is pinned on S7');
      eq(exitCodeFor(report), 1, 'exit 1: a missing ownership check is a failed release gate');
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
  }

  // ── 3d″ · an export that leaks one of A's rows FAILS S7 ──────────────────
  {
    const { server, state, origin } = await fakeHost({ leakExport: true });
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    try {
      const report = await runAcceptance(baseArgs(origin), { prompt: humanFor(state), log: () => {}, pictures: fakePictures, outDir });
      const e = report.steps.find(s => s.id === 'S7');
      eq(e.status, STATUS.FAIL, 'S7 FAILS when student B2\'s export carries one of A\'s learningEvents rows');
      const failed = e.checks.filter(ch => !ch.ok);
      ok(failed.length === 1 && /export holds none of student A/.test(failed[0].label) && /2 of A's/.test(failed[0].detail), `exactly the export-row probe failed and it counted A's rows (${failed[0]?.detail})`);
      eq(exitCodeFor(report), 1, 'exit 1 on a leaking export');
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
  }

  // ── 3d″′ · a slow run: A's session is older than the export's fresh-proof window ──
  // Five human mailbox reads sit between A's S1 sign-in and S7's export, so on
  // staging A's session is usually past EXPORT_FRESH_MS by then. The contract
  // the branch of #521 made (requireRecentAuth) is that the cookie alone is
  // then refused 401 REAUTH_REQUIRED naming otp — S7 PASSES on that refusal and
  // does not report a false FAIL for the old "A exports 200" expectation. S6's
  // fresh sign-in is another session and does not refresh S1's.
  {
    const { server, state, origin } = await fakeHost();
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    const readCodes = humanFor(state);
    // The scripted human takes eleven minutes to find B2's code (S7's read).
    const slowHuman = async question => { if (/^\[S7\]/.test(question)) state.clockOffsetMs += EXPORT_FRESH_MS + 60_000; return readCodes(question); };
    try {
      const report = await runAcceptance(baseArgs(origin), { prompt: slowHuman, log: () => {}, pictures: fakePictures, outDir, now: state.now });
      const e = report.steps.find(s => s.id === 'S7');
      const failures = e.checks.filter(ch => !ch.ok).map(ch => `${ch.label} (${ch.detail})`);
      eq(e.status, STATUS.PASS, `S7 PASSES when A's S1 session has aged past the window (failures: ${failures.join(' | ') || 'none'})`);
      ok(state.clockOffsetMs > EXPORT_FRESH_MS, 'the clock really was advanced past the window before S7\'s export');
      eq(report.steps.find(s => s.id === 'S6').status, STATUS.PASS, 'S6 (before the delay) still passed');
      const refused = e.checks.find(ch => /older session is refused the export/.test(ch.label));
      ok(refused?.ok && /status 401 REAUTH_REQUIRED/.test(refused.detail) && /"otp"/.test(refused.detail), `S7: A's stale cookie was refused 401 REAUTH_REQUIRED naming otp (${refused?.detail})`);
      ok(!e.checks.some(ch => /inside the fresh-proof window/.test(ch.label)), 'S7: the quick-run expectation (A exports 200) was not applied to a stale session');
      ok(e.checks.some(ch => /pri-account-export-v1 shape/.test(ch.label) && ch.ok), 'S7: the shape probe still ran on B2, whose sign-in is fresh');
      const exportsByA = state.log.filter(r => r.path === '/v1/account/export' && r.accountId === report.accounts.find(a => a.role === 'A')?.accountId);
      ok(exportsByA.length === 1 && exportsByA[0].status === 401, `the fake host saw exactly one export call from A and refused it (${JSON.stringify(exportsByA)})`);
      eq(exitCodeFor(report), 0, 'exit 0: a refusal the contract requires is not a failure');
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
  }

  // ── 3d‴ · an unverified second account must not count as an isolation PASS ──
  {
    // A host that signs an OTP account in without marking it verified: the
    // ownership probes are not run and S7 stays NOT VERIFIED (exit 3), never PASS.
    const { server, state, origin } = await fakeHost();
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    try {
      state.unverifiedSignups = true;
      const report = await runAcceptance(baseArgs(origin, { skip: new Set(['S2']) }), { prompt: humanFor(state), log: () => {}, pictures: fakePictures, outDir });
      const e = report.steps.find(s => s.id === 'S7');
      ok(e.checks.some(ch => /mailbox counts as verified/.test(ch.label) && !ch.ok), 'S7 records that the isolation account is not verified');
      ok(!e.checks.some(ch => /refused by ownership/.test(ch.label)), 'S7 does not run the ownership probes on an unverified account (EMAIL_UNVERIFIED proves nothing)');
      ok(e.pending && report.humanSteps.some(h => h.step === 'S7' && /NOT run/.test(h.text)), 'the skipped probes are named as NOT run, for a human');
      ok(e.status !== STATUS.PASS, `S7 is ${e.status}, never PASS, on an unverified isolation account`);
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
  }

  // ── 3d⁗′ · --skip S4,S5 leaves A without a question: S7 must not read PASS ─
  {
    const { server, state, origin } = await fakeHost();
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    try {
      const report = await runAcceptance(baseArgs(origin, { skip: new Set(['S4', 'S5']) }), { prompt: humanFor(state), log: () => {}, pictures: fakePictures, outDir });
      const e = report.steps.find(s => s.id === 'S7');
      ok(!e.checks.some(ch => /refused by ownership/.test(ch.label)), 'S7 runs no ownership probe when A issued no question');
      ok(e.pending && report.humanSteps.some(h => h.step === 'S7' && /NOT run/.test(h.text)), 'the unrun probes are named as NOT run, for a human');
      eq(e.status, STATUS.NOT_VERIFIED, 'S7 is NOT VERIFIED, never PASS, without the ownership probes');
      const r6 = report.steps.find(s => s.id === 'S6');
      ok(r6.status === STATUS.SKIPPED && r6.notes.some(n => /needs an attempt S4 or S5 marked/.test(n)) && !report.humanSteps.some(h => h.step === 'S6'), 'S6 is skipped, asking no code, when S4 and S5 marked nothing');
      eq(exitCodeFor(report), 3, 'exit 3: nothing failed but S7 is open');
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
  }

  // ── 3d⁗ · exportedForeignRows reads the real column names ────────────────
  {
    const A = { questionIds: new Set(['q1']), attemptIds: new Set(['a1']) };
    eq(exportedForeignRows({ learningEvents: [{ id: 'x', entity_id: 'q9' }], entities: [{ entity_id: 'e2' }] }, A).length, 0, 'own rows are not foreign');
    eq(exportedForeignRows({ learningEvents: [{ id: 'a1', entity_id: 'q9' }, { id: 'x', entity_id: 'q1' }], entities: [{ entity_id: 'q1' }] }, A).length, 3, 'rows keyed by A\'s attempt id or question id (entity_id, in learningEvents or entities) are foreign');
    eq(exportedForeignRows({ learningEvents: [{ entityId: 'q1' }] }, A).length, 1, 'a camelCased entityId is read too');
    eq(exportedForeignRows({}, A).length, 0, 'no arrays, no rows (the shape check, not this helper, fails that case)');
  }

  // ── 3e · a pre-existing account is signed in, never deleted ───────────────
  {
    const { server, state, origin } = await fakeHost();
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    try {
      state.accounts.set('acct-owner', { id: 'acct-owner', email: 'owner@example.test', name: 'Owner', verified: true, ageBasis: 'adult', consent: 'not-required', password: null, events: [] });
      const report = await runAcceptance(baseArgs(origin, { cleanup: true, skip: new Set(['S2', 'S7']) }), { prompt: humanFor(state), log: () => {}, pictures: fakePictures, outDir, nominate: async () => ({ ok: true, results: [] }) });
      const status = Object.fromEntries(report.steps.map(s => [s.id, s.status]));
      ok(status.S1 === STATUS.PASS && status.S2 === STATUS.SKIPPED && status.S7 === STATUS.SKIPPED, 'an existing address signs in (no profile needed); --skip is honoured');
      ok(status.S3 === STATUS.SKIPPED && report.steps.find(s => s.id === 'S3').notes.some(n => /confirmed at S2/.test(n)), 'S3 is skipped when S2 is: there is no confirmed child to withdraw');
      eq(status.S6, STATUS.PASS, 'S6: the pre-existing account comes back and gets this run\'s attempts back');
      ok(state.accounts.has('acct-owner'), 'cleanup never deletes an account that existed before the run');
      ok(report.accounts.find(a => a.role === 'A').created === false, 'the report says the account was not created by this run');
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
  }

  // ── 3h · a host that keeps issuing questions after a withdrawal FAILS S3 ──
  {
    const { server, state, origin } = await fakeHost({ issueAfterWithdrawal: true });
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    try {
      const report = await runAcceptance(baseArgs(origin), { prompt: humanFor(state), log: () => {}, pictures: fakePictures, outDir });
      const w = report.steps.find(s => s.id === 'S3');
      eq(w.status, STATUS.FAIL, 'S3 FAILS when the withdrawn child is still issued a question');
      const failed = w.checks.filter(ch => !ch.ok);
      ok(failed.length === 1 && /next question is refused/.test(failed[0].label) && /status 201/.test(failed[0].detail) && /a question was issued/.test(failed[0].detail), `exactly the refusal probe failed, naming the 201 (${failed.map(ch => `${ch.label}: ${ch.detail}`).join('; ')})`);
      ok(w.checks.some(ch => /state is now withdrawn/.test(ch.label) && ch.ok), 'the state probe still held: the defect is the issuance, not the record');
      ok(['S0', 'S1', 'S2', 'S4', 'S5', 'S6', 'S7'].every(id => report.steps.find(s => s.id === id).status === STATUS.PASS), 'the other steps still pass: the defect is pinned on S3');
      eq(exitCodeFor(report), 1, 'exit 1: a child served after withdrawal is a failed release gate');
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
  }

  // ── 3i · a host that loses an attempt on a returning sign-in FAILS S6 ─────
  {
    const { server, state, origin } = await fakeHost({ loseAttempt: true });
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    try {
      const report = await runAcceptance(baseArgs(origin), { prompt: humanFor(state), log: () => {}, pictures: fakePictures, outDir });
      const r6 = report.steps.find(s => s.id === 'S6');
      eq(r6.status, STATUS.FAIL, 'S6 FAILS when the returning student\'s History is missing an attempt S4 marked');
      const s4Attempt = report.steps.find(s => s.id === 'S4').notes.join(' ').match(/attempt ([0-9a-f-]{36})/)?.[1];
      const failed = r6.checks.filter(ch => !ch.ok);
      ok(failed.length === 1 && /comes back, once, by attempt id/.test(failed[0].label) && /^1\/2 back; missing /.test(failed[0].detail) && !!s4Attempt && failed[0].detail.includes(s4Attempt), `exactly the comeback probe failed and it names S4's attempt (${failed[0]?.detail})`);
      ok(r6.checks.some(ch => /carries the question, submission and mark/.test(ch.label) && ch.ok && ch.detail === '1 match'), 'the attempt that did come back still matches its mark');
      ok(['S4', 'S5'].every(id => report.steps.find(s => s.id === id).status === STATUS.PASS), 'S4 and S5 passed: each saw its attempt in History before the returning sign-in');
      ok(['S0', 'S1', 'S2', 'S3', 'S7'].every(id => report.steps.find(s => s.id === id).status === STATUS.PASS), 'the other steps still pass: the defect is pinned on S6');
      eq(exitCodeFor(report), 1, 'exit 1: History lost on a returning sign-in is a failed release gate');
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
  }

  // ── 3j · S3 never withdraws a child account that existed before the run ───
  {
    const { server, state, origin } = await fakeHost();
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    try {
      state.accounts.set('acct-kid', { id: 'acct-kid', email: 'kid@example.test', name: 'Kid', verified: true, ageBasis: 'child', consent: 'pending', password: null, events: [] });
      const report = await runAcceptance(baseArgs(origin, { childEmail: 'kid@example.test', skip: new Set(['S4', 'S5', 'S6', 'S7']) }), { prompt: humanFor(state), log: () => {}, pictures: fakePictures, outDir });
      const status = Object.fromEntries(report.steps.map(s => [s.id, s.status]));
      eq(status.S2, STATUS.PASS, 'S2 approves the pre-existing pending child (the ceremony runs)');
      const w = report.steps.find(s => s.id === 'S3');
      ok(w.status === STATUS.NOT_VERIFIED && w.notes.some(n => /existed before this run/.test(n)), `S3 stays NOT VERIFIED and says why (${w.notes.join(' | ')})`);
      ok(!report.humanSteps.some(h => h.step === 'S3') && state.log.every(r => r.path !== '/v1/account/guardian/withdraw'), 'S3 asked for no link and sent no withdrawal');
      eq(state.accounts.get('acct-kid').consent, 'given', 'the pre-existing child\'s consent is left as the parent gave it');
      eq(exitCodeFor(report), 3, 'exit 3: nothing failed, S3 is open');
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
  }

  // ── 3k · the S3 link reader and the S6 attempt matcher ────────────────────
  {
    const token = randomBytes(32).toString('base64url');
    const parsed = withdrawalTokenFrom(`https://h.example/guardian/consent#action=guardian-consent&token=${token}`);
    ok(parsed.token === token && parsed.origin === 'https://h.example' && parsed.problem === null, 'the approval email\'s link gives its token, read from the fragment');
    eq(withdrawalTokenFrom(`https://h.example/account-action#action=guardian-withdraw&token=${token}`).token, token, 'the later withdrawal link is read too');
    ok(withdrawalTokenFrom(`  ${token}\n`).token === token && withdrawalTokenFrom(token).origin === null, 'a bare token is accepted');
    for (const [label, text] of [
      ['an empty paste', ''], ['a sign-in code', '123456'], ['a verify-email link', `https://h.example/account-action#action=verify-email&token=${token}`],
      ['a consent link on the wrong page', `https://h.example/account-action#action=guardian-consent&token=${token}`], ['a link without a token', 'https://h.example/guardian/consent#action=guardian-consent'],
      ['a token in the query, not the fragment', `https://h.example/guardian/consent?action=guardian-consent&token=${token}`]
    ]) {
      const result = withdrawalTokenFrom(text);
      ok(result.token === null && typeof result.problem === 'string' && !result.problem.includes(token), `${label} gives no token, and the problem never echoes one`);
    }
    const want = [
      { step: 'S4', attemptId: 'a1', questionId: 'q1', submissionId: 's1', marksEarned: 3, marksPossible: 3, correct: true },
      { step: 'S5', attemptId: 'a2', questionId: 'q2', submissionId: 's2', marksEarned: 0, marksPossible: 3, correct: false }
    ];
    const row = (w, extra = {}, payload = {}) => ({ id: w.attemptId, kind: 'graded-attempt', deviceId: 'server-grader', entityId: w.questionId, ...extra,
      payload: { attemptId: w.attemptId, questionId: w.questionId, submissionId: w.submissionId, marksEarned: w.marksEarned, marksPossible: w.marksPossible, correct: w.correct, ...payload } });
    let back = returnedAttempts(want, [row(want[0]), row(want[1])]);
    ok(back.matched.length === 2 && !back.missing.length && !back.mismatched.length && !back.duplicated.length, 'both attempts back with their marks: matched');
    back = returnedAttempts(want, [row(want[0])]);
    ok(back.missing.join() === 'a2' && back.matched.length === 1, 'a lost attempt is missing');
    back = returnedAttempts(want, [row(want[0]), row(want[1], {}, { marksEarned: 3, correct: true })]);
    ok(back.mismatched.map(m => m.attemptId).join() === 'a2', 'a changed mark is a mismatch');
    back = returnedAttempts(want, [row(want[0]), row(want[1], { deviceId: 'device-1' })]);
    ok(back.missing.join() === 'a2', 'a device-written row is not a server mark (the app\'s History skips it too)');
    back = returnedAttempts(want, [row(want[0]), row(want[1], { entityId: 'q9' })]);
    ok(back.missing.join() === 'a2', 'a row whose entityId is not its payload\'s question is skipped, as the app skips it');
    back = returnedAttempts(want, [row(want[0]), row(want[0]), row(want[1])]);
    ok(back.duplicated.join() === 'a1', 'an attempt returned twice is caught');
  }

  // ── 3f · no tester, or a non-human tester, is refused on an interactive run ──
  {
    const { server, state, origin } = await fakeHost();
    const outDir = mkdtempSync(join(tmpdir(), 'pri-accept-test-'));
    try {
      for (const tester of [null, 'Claude agent', 'CI']) {
        await assert.rejects(runAcceptance(baseArgs(origin, { tester }), { prompt: humanFor(state), log: () => {}, pictures: fakePictures, outDir }), error => error.code === 'TESTER_REQUIRED'); count += 1;
      }
      eq(state.accounts.size, 0, 'nothing was created without a named human');
    } finally { server.close(); rmSync(outDir, { recursive: true, force: true }); }
  }

  // ── 3g · makeHttp: cookies absorbed, CSRF header on mutations only ────────
  {
    const seen = [];
    const fetchImpl = async (url, init) => {
      seen.push({ url, init });
      return { status: 200, headers: { getSetCookie: () => ['pri_cloud_session=tok; Path=/', 'pri_csrf=csrf-tok; Path=/'] }, text: async () => '{"ok":true}' };
    };
    const http = makeHttp('https://h.example', { fetchImpl });
    const jar = {};
    await http('/v1/account/otp/verify', { method: 'POST', jar, body: { a: 1 } });
    ok(jar.pri_cloud_session === 'tok' && jar.pri_csrf === 'csrf-tok', 'set-cookie is absorbed into the jar');
    await http('/v1/practice/issue', { method: 'POST', jar, body: {} });
    const mutation = seen[1].init.headers;
    ok(mutation.origin === 'https://h.example' && mutation['x-pri-csrf'] === 'csrf-tok' && /pri_cloud_session=tok/.test(mutation.cookie), 'a mutation carries Origin, the CSRF header and the cookies');
    await http('/v1/account/me', { jar });
    ok(!('origin' in seen[2].init.headers) && !('x-pri-csrf' in seen[2].init.headers), 'a GET carries neither Origin nor the CSRF header');
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 4 · device-matrix-record: stable ids, groups, refusals, the ledgers and the doc
// ═════════════════════════════════════════════════════════════════════════════
{
  eq(FAMILIES.length, 4, 'four device families: iPhone, iPad + Pencil, Android phone, Android tablet');
  eq(JOURNEY.length, 9, 'nine journey steps from install to History');
  const groupSteps = GROUPS.flatMap(g => g.steps);
  eq(GROUPS.map(g => g.id).join(','), 'ACCESSIBILITY,ORIENTATION,RESTORE,EXAM,LIFECYCLE,ACCOUNT,PURCHASE,EXPORT', 'the six groups issue #10 and scope §18 #11 asked for, plus account deletion and the sandbox purchase (§22.4)');
  ok(groupSteps.some(s => s.id === 'VOICEOVERTEXT' && s.families.join() === 'IPH,IPD') && groupSteps.some(s => s.id === 'TALKBACKTEXT' && s.families.join() === 'AND,ANT'), 'the screen reader at the largest text size, on Apple and Android');
  for (const id of ['DELETE', 'PURCHASE', 'RESTOREPURCHASE']) ok(groupSteps.some(s => s.id === id && s.families.length === 4), `${id} applies to every family (iPhone and iPad included)`);
  ok(groupSteps.some(s => s.id === 'VOICEOVER' && s.families.join() === 'IPH,IPD') && groupSteps.some(s => s.id === 'TALKBACK' && s.families.join() === 'AND,ANT'), 'VoiceOver on Apple, TalkBack on Android');
  ok(groupSteps.some(s => s.id === 'KEYBOARD' && s.families.includes('IPH') && s.families.includes('IPD')), 'Full Keyboard Access on iPhone and iPad');
  ok(groupSteps.some(s => s.id === 'TEXTSIZE' && s.families.length === 4 && /1\.12/.test(s.expect) && /360 CSS px/.test(s.expect)), 'the text-size case says what the shell really does (viewport scale capped at 360 CSS px, about 1.12× on iPhone)');
  ok(groupSteps.some(s => s.id === 'ROTATE' && !s.families.includes('IPH')) && groupSteps.some(s => s.id === 'SPLITVIEW' && s.families.join() === 'IPD') && groupSteps.some(s => s.id === 'STAGEMANAGER' && s.families.join() === 'IPD'), 'rotation skips the portrait-only iPhone; Split View and Stage Manager are iPad');
  for (const id of ['REINSTALL', 'TIMED', 'BACKGROUND', 'STORAGE', 'MEMORY', 'EXPORT', 'SHARE']) ok(groupSteps.some(s => s.id === id && s.families.length === 4), `${id} applies to every family`);
  const expectedCases = 36 + groupSteps.reduce((n, s) => n + s.families.length, 0);
  eq(CASES.length, expectedCases, `${expectedCases} stable case ids (36 journey + ${expectedCases - 36} group cases)`);
  eq(CASES.length, 96, '96 cases in all');
  ok(CASES.every(c => /^DM-(IPH|IPD|AND|ANT)-\d{2}-[A-Z]+$/.test(c.id)), 'case ids are DM-<family>-<seq>-<step>');
  eq(new Set(CASES.map(c => c.id)).size, CASES.length, 'case ids are unique');
  ok(['INSTALL', 'OTP', 'GUARDIAN', 'ISSUE', 'WRITE', 'PHOTO', 'TRANSCRIPT', 'MARK', 'HISTORY'].every((step, i) => JOURNEY[i].id === step), 'the journey is §22.2 in order');
  ok(CASES.filter(c => c.pencil).length === 1 && CASES.find(c => c.pencil).id === 'DM-IPD-05-WRITE', 'exactly one case is the Apple Pencil case');
  ok(CASES.filter(c => c.group === 'JOURNEY').length === 36 && CASES.every(c => c.group === 'JOURNEY' || GROUPS.some(g => g.id === c.group)), 'every case belongs to the journey or a named group');
  eq(Object.keys(SEVERITIES).join(','), 'P0,P1,P2,P3', 'four severities');
  eq(BUILD_KINDS.join(','), 'development,testflight,play-internal,play-closed', 'the build kinds a device can run');
  eq(SOAK_MIN_MINUTES, 30, 'a soak is at least 30 minutes');

  const doc = read('docs/release/device-matrix.md');
  const block = doc.split('<!-- device-matrix-cases:start -->')[1]?.split('<!-- device-matrix-cases:end -->')[0]?.trim();
  eq(block, casesMarkdown(), 'docs/release/device-matrix.md carries exactly the generated case table');
  ok(CASES.every(c => doc.includes(`\`${c.id}\``)), 'every case id is in the doc');
  ok(/PHYSICAL-HUMAN/.test(doc) && /never written into this matrix/.test(doc), 'the doc states the evidence class and the simulator rule');
  ok(/PRI_V1_RELEASE_SCOPE\.md.*§22\.2/.test(doc), 'the doc cites the §22.2 journey');
  ok(/results\.jsonl/.test(doc) && /soak\.jsonl/.test(doc) && /device-matrix-record\.mjs/.test(doc), 'the doc names both ledgers and the recorder');
  ok(/## Which server a device build talks to/.test(doc) && /Every store build names exactly `https:\/\/app\.prilearning\.com`/.test(doc) && /Store build → `app\.prilearning\.com` → staging, before GO: the full matrix/.test(doc) &&
    /The same store build → `app\.prilearning\.com` → production, after promotion, store release held: the\s+short list/.test(doc) && /refuses a\s+development build on production/.test(doc),
    'the doc settles which server each build kind tests against (D5: the store build names app.prilearning.com, staging before GO, production after) and keeps the kinds distinct');
  ok(/## Defect severity \(required on every fail\)/.test(doc) && /`P0`/.test(doc) && /`P3`/.test(doc), 'the doc carries the severity taxonomy');
  ok(/## Soak record/.test(doc) && /at least 30 minutes/.test(doc), 'the doc carries the soak record');
  ok(/VoiceOver/.test(doc) && /Full Keyboard Access/.test(doc) && /Stage Manager/.test(doc) && /Split View/.test(doc) && /RESTORE/.test(doc) && /EXAM/.test(doc) && /LIFECYCLE/.test(doc) && /EXPORT/.test(doc), 'the doc names the accessibility, orientation, restore, exam, lifecycle and export groups');
  ok(/NOT_A_HUMAN/.test(doc) && /no\s+override/i.test(doc), 'the doc documents the fail-closed tester word list');
  ok(existsSync(join(ROOT, 'docs/release/evidence/device-matrix/README.md')) && /results\.jsonl/.test(read('docs/release/evidence/device-matrix/README.md')) && /soak\.jsonl/.test(read('docs/release/evidence/device-matrix/README.md')), 'the ledger directory is committed with a README naming both ledgers');

  const dir = mkdtempSync(join(tmpdir(), 'pri-dm-'));
  const ledger = join(dir, 'results.jsonl');
  const base = { case: 'DM-IPH-02-OTP', result: 'pass', device: 'iPhone 16 Pro Max', os: 'iOS 26.0.1', sha: SHA, tester: 'Priya Example', buildKind: 'development', server: 'staging' };
  try {
    const written = recordResult(base, { ledger, now: Date.parse('2026-11-02T01:00:00Z') });
    ok(written.evidenceClass === 'PHYSICAL-HUMAN' && written.recorder === 'scripts/device-matrix-record.mjs' && written.buildKind === 'development' && written.server === 'staging' && written.severity === null, 'a pass by a named human on real hardware is recorded as PHYSICAL-HUMAN with its build kind and server');
    eq(readLedger(ledger).length, 1, 'one line appended');
    const refusals = [
      ['a pass without a tester', { ...base, tester: undefined }, /named human/],
      ['a pass by an agent', { ...base, tester: 'Claude agent' }, /does not name a human/],
      ['a pass by "CI"', { ...base, tester: 'CI' }, /does not name a human/],
      ['a placeholder tester', { ...base, tester: 'tester' }, /does not name a human/],
      ['a real surname that is a refused word (fail-closed, the word is named)', { ...base, tester: 'Anita Tester' }, /the word "Tester" marks/],
      ['a simulator device', { ...base, device: 'iPhone 16 Pro Simulator' }, /simulator\/emulator/],
      ['an emulator device', { ...base, case: 'DM-AND-02-OTP', device: 'Pixel 6 emulator (API 36)' }, /simulator\/emulator/],
      ['a missing OS', { ...base, os: '' }, /needs --os/],
      ['a short SHA', { ...base, sha: 'e3f9cabe1' }, /40-hex/],
      ['an unknown case', { ...base, case: 'DM-IPH-99-NOPE' }, /unknown case id/],
      ['a case that does not apply to the family (Split View on iPhone)', { ...base, case: 'DM-IPH-14-SPLITVIEW' }, /unknown case id/],
      ['an unknown result', { ...base, result: 'maybe' }, /result must be one of/],
      ['the Pencil case without a Pencil', { ...base, case: 'DM-IPD-05-WRITE', device: 'iPad Pro 11-inch (4th generation)', os: 'iPadOS 26.0.1' }, /needs --pencil/],
      ['a blocked row without a reason', { case: 'DM-AND-01-INSTALL', result: 'blocked', sha: SHA }, /needs --notes/],
      ['a fail without a tester', { ...base, result: 'fail', tester: null, severity: 'P1', notes: 'the code never arrived' }, /named human/],
      ['a pass without a build kind', { ...base, buildKind: undefined }, /needs --build-kind/],
      ['a pass without a server', { ...base, server: undefined }, /needs --server/],
      ['a development build on production', { ...base, server: 'production' }, /development build is not run against production/],
      ['a fail without a severity', { ...base, result: 'fail', notes: 'the code arrived but the field did not autofill' }, /needs --severity P0\|P1\|P2\|P3/],
      ['a fail with an unknown severity', { ...base, result: 'fail', severity: 'P9', notes: 'the code arrived but the field did not autofill' }, /needs --severity/],
      ['a fail without notes', { ...base, result: 'fail', severity: 'P2' }, /a fail needs --notes/],
      ['a pass carrying a severity', { ...base, severity: 'P2' }, /only a fail carries a severity/]
    ];
    for (const [name, input, pattern] of refusals) {
      assert.throws(() => recordResult(input, { ledger }), error => error.exitCode === 2 && error.problems.some(p => pattern.test(p)), `refuses ${name}`); count += 1;
    }
    eq(readLedger(ledger).length, 1, 'a refusal writes nothing');
    // D5: the store build names app.prilearning.com, which fronts staging before GO and production after.
    eq(problemsWith({ ...base, buildKind: 'testflight', build: 'TestFlight 1.0 (3)' }).length, 0, 'a store build against staging (app.prilearning.com before GO) is accepted: the full matrix runs on the binary the store receives');
    eq(problemsWith({ ...base, buildKind: 'play-internal', server: 'production', device: 'Pixel 8', os: 'Android 15', case: 'DM-AND-02-OTP' }).length, 0, 'the same kind of build against production (after promotion) is accepted too');
    const pencil = recordResult({ ...base, case: 'DM-IPD-05-WRITE', device: 'iPad Pro 11-inch (4th generation)', os: 'iPadOS 26.0.1', pencil: 'Apple Pencil Pro' }, { ledger, now: Date.parse('2026-11-02T01:01:00Z') });
    ok(pencil.pencil === 'Apple Pencil Pro', 'the Pencil case records the Pencil model');
    const blocked = recordResult({ case: 'DM-AND-01-INSTALL', result: 'blocked', sha: SHA, notes: 'no Android device available' }, { ledger, now: Date.parse('2026-11-02T01:02:00Z') });
    ok(blocked.evidenceClass === 'BLOCKED-EXTERNAL' && blocked.tester === null, 'a blocked row needs no tester and is BLOCKED-EXTERNAL, never physical evidence');
    const failed = recordResult({ ...base, result: 'fail', severity: 'p1', notes: 'code arrived but the field did not autofill' }, { ledger, now: Date.parse('2026-11-02T02:00:00Z') });
    eq(failed.severity, 'P1', 'a fail records its severity (normalised to upper case)');
    recordResult({ ...base, case: 'DM-IPH-12-TEXTSIZE', result: 'fail', severity: 'P2', notes: 'at AX5 the page scaled 1.12x and the mode switch clipped' }, { ledger, now: Date.parse('2026-11-02T02:01:00Z') });
    const store = recordResult({ ...base, case: 'DM-IPH-01-INSTALL', buildKind: 'testflight', server: 'production', build: 'TestFlight 1.0 (3)' }, { ledger, now: Date.parse('2026-11-02T03:00:00Z') });
    ok(store.buildKind === 'testflight' && store.server === 'production', 'a store-build row names production');
    const summary = summarise(readLedger(ledger), { sha: SHA });
    eq(summary.rows.find(r => r.id === 'DM-IPH-02-OTP').latest.result, 'fail', 'the latest record per case wins');
    ok(summary.counts.pass === 2 && summary.counts.fail === 2 && summary.counts.blocked === 1 && summary.counts['not run'] === CASES.length - 5, `the summary counts pass, fail, blocked and not run (${JSON.stringify(summary.counts)})`);
    ok(summary.bySeverity.P1 === 1 && summary.bySeverity.P2 === 1 && summary.releaseBlocking === 1, 'open defects are counted by severity and P0/P1 are release-blocking');
    ok(summary.byBuildKind.development.pass === 2 && summary.byBuildKind.development.fail === 2 && summary.byBuildKind.testflight.pass === 1, 'rows are counted per build kind');
    const devOnly = summarise(readLedger(ledger), { sha: SHA, buildKind: 'development' });
    const storeOnly = summarise(readLedger(ledger), { sha: SHA, buildKind: 'testflight' });
    ok(devOnly.rows.find(r => r.id === 'DM-IPH-01-INSTALL').latest === null && storeOnly.counts.pass === 1 && storeOnly.counts.fail === 0 && storeOnly.counts['not run'] === CASES.length - 1, 'a report for one build kind never shows the other kind\'s rows');
    eq(summarise(readLedger(ledger), { sha: OTHER }).counts['not run'], CASES.length, 'another build has no evidence of its own');
    const md = reportMarkdown(summary, soakSummary([], { sha: SHA }));
    ok(md.includes('`DM-IPH-02-OTP` | JOURNEY | FAIL | P1') && md.includes('Priya Example') && md.includes('not run') && /PHYSICAL-HUMAN/.test(md) && /1 RELEASE-BLOCKING/.test(md) && /development pass 2 \/ fail 2/.test(md) && /testflight pass 1/.test(md), 'the markdown report names the tester, the result, the severity, the build kinds and the evidence class');
    eq(validateLedger(ledger).length, 0, 'the ledger the recorder wrote validates');

    // Soak records: a separate ledger with the same human/hardware/build rules.
    const soakBase = { device: 'iPad Pro 11-inch (4th generation)', os: 'iPadOS 26.0.1', pencil: 'Apple Pencil Pro', sha: SHA, tester: 'Priya Example', buildKind: 'development', server: 'staging', minutes: '45', failures: '0', notes: '30-min timed paper, 6 handwritten answers' };
    const soak = recordSoak(soakBase, { ledger, now: Date.parse('2026-11-02T04:00:00Z') });
    ok(soak.kind === 'soak' && soak.minutes === 45 && soak.failures === 0 && soak.evidenceClass === 'PHYSICAL-HUMAN' && existsSync(soakLedgerFor(ledger)), 'a soak is recorded beside the case ledger as PHYSICAL-HUMAN');
    const soakRefusals = [
      ['a soak under 30 minutes', { ...soakBase, minutes: '29' }, /integer >= 30/],
      ['a soak with no failure count', { ...soakBase, failures: undefined }, /needs --failures/],
      ['a soak with failures and no notes', { ...soakBase, failures: '2', notes: '' }, /with failures needs --notes/],
      ['a soak by an agent', { ...soakBase, tester: 'QA bot' }, /does not name a human/],
      ['a soak on a simulator', { ...soakBase, device: 'iPad Pro (M4) Simulator' }, /simulator\/emulator/],
      ['a soak on a development build against production', { ...soakBase, server: 'production' }, /development build is not run against production/],
      ['a soak with no build kind', { ...soakBase, buildKind: undefined }, /needs --build-kind/]
    ];
    for (const [name, input, pattern] of soakRefusals) {
      assert.throws(() => recordSoak(input, { ledger }), error => error.exitCode === 2 && error.problems.some(p => pattern.test(p)), `refuses ${name}`); count += 1;
    }
    eq(readLedger(soakLedgerFor(ledger)).length, 1, 'a refused soak writes nothing');
    const soaks = soakSummary(readLedger(soakLedgerFor(ledger)), { sha: SHA });
    ok(soaks.soaks.length === 1 && soaks.minutes === 45 && soaks.failures === 0, 'the soak summary totals minutes and failures');
    ok(/Soak: 1 record\(s\), 45 min in total, 0 failure\(s\)/.test(reportMarkdown(summary, soaks)), 'the markdown report carries the soak');
    eq(validateLedger(ledger).length, 0, 'both ledgers validate');

    writeFileSync(ledger, readFileSync(ledger, 'utf8') + JSON.stringify({ recordedAt: '2026-11-02T05:00:00Z', case: 'DM-IPD-08-MARK', result: 'pass', device: 'iPad Pro', os: 'iPadOS 26', sha: SHA, tester: null, buildKind: 'development', server: 'staging', evidenceClass: 'PHYSICAL-HUMAN', recorder: 'scripts/device-matrix-record.mjs' }) + '\n');
    ok(validateLedger(ledger).some(e => /named human/.test(e)), 'a hand-written pass without a tester is caught by validate');
    writeFileSync(ledger, readFileSync(ledger, 'utf8') + JSON.stringify({ recordedAt: '2026-11-02T05:01:00Z', case: 'DM-IPD-08-MARK', result: 'fail', device: 'iPad Pro', os: 'iPadOS 26', sha: SHA, tester: 'Priya Example', buildKind: 'development', server: 'staging', notes: 'the mark never came', evidenceClass: 'PHYSICAL-HUMAN', recorder: 'scripts/device-matrix-record.mjs' }) + '\n');
    ok(validateLedger(ledger).some(e => /needs --severity/.test(e)), 'a hand-written fail without a severity is caught by validate');
    writeFileSync(ledger, readFileSync(ledger, 'utf8') + JSON.stringify({ recordedAt: '2026-11-02T05:02:00Z', case: 'DM-IPD-08-MARK', result: 'pass', device: 'iPad Pro', os: 'iPadOS 26', sha: SHA, tester: 'Priya Example', evidenceClass: 'PHYSICAL-HUMAN', recorder: 'scripts/device-matrix-record.mjs' }) + '\n');
    ok(validateLedger(ledger).some(e => /needs --build-kind/.test(e)), 'a hand-written row with no build kind is caught by validate');
    writeFileSync(soakLedgerFor(ledger), readFileSync(soakLedgerFor(ledger), 'utf8') + JSON.stringify({ ...soak, minutes: 10 }) + '\n');
    ok(validateLedger(ledger).some(e => /soak line 2: .*integer >= 30/.test(e)), 'a hand-written short soak is caught by validate');
    writeFileSync(ledger, readFileSync(ledger, 'utf8') + 'not json\n');
    ok(validateLedger(ledger).some(e => /not JSON/.test(e)), 'a corrupt line is caught by validate');
    eq(recordResult({ ...base, evidenceClass: 'SIMULATOR' }, { ledger }).evidenceClass, 'PHYSICAL-HUMAN', 'the recorder derives the evidence class from the result; a caller cannot set it');
    writeFileSync(ledger, readFileSync(ledger, 'utf8') + JSON.stringify({ recordedAt: '2026-11-02T06:00:00Z', case: 'DM-IPH-01-INSTALL', result: 'pass', device: 'iPhone 16', os: 'iOS 26', sha: SHA, tester: 'Priya Example', buildKind: 'development', server: 'staging', evidenceClass: 'SIMULATOR', recorder: 'scripts/device-matrix-record.mjs' }) + '\n');
    ok(validateLedger(ledger).some(e => /evidenceClass/.test(e)), 'a stored line with a smuggled evidence class is caught by validate');
  } finally { rmSync(dir, { recursive: true, force: true }); }
  if (existsSync(DEFAULT_LEDGER)) eq(validateLedger(DEFAULT_LEDGER).length, 0, 'the committed ledger validates');
  else ok(true, 'no committed ledger yet (no physical run has been recorded)');
  eq(problemsWith({ case: 'DM-IPH-01-INSTALL', result: 'pass', device: 'iPhone 16', os: 'iOS 26', sha: SHA, tester: 'Priya Example', buildKind: 'development', server: 'staging' }).length, 0, 'a complete pass has no problems');
}

// ═════════════════════════════════════════════════════════════════════════════
// 5 · the documents these tools implement
// ═════════════════════════════════════════════════════════════════════════════
{
  const cutover = read('docs/operations/postgres-cutover.md');
  ok(cutover.includes(`\`schema_version\` = **${SCHEMA_VERSION}** and \`billing_schema_version\` = **${BILLING_SCHEMA_VERSION}**`), 'the cutover runbook states the schema versions of schemaVersions.js');
  ok(/### Schema versions and the migrations that set them/.test(cutover) && /20261016000000_rls_fail_closed\.sql/.test(cutover) && /RLS deny-by-default/.test(cutover), 'the runbook has the schema table ending at schema 12 (RLS deny-by-default)');
  ok(!/`schema_version` 11 \/ `billing_schema_version` 6/.test(cutover), 'the target-check bullet no longer says schema 11');
  ok(cutover.includes(`(today ${SCHEMA_VERSION} / ${BILLING_SCHEMA_VERSION}`), 'the rollback rule names the current versions');
  ok(/### 4\.6 Staging → production promotion order/.test(cutover) && /24 h soak/.test(cutover) && /release-nominate\.mjs/.test(cutover) && /deploy\/production/.test(cutover), 'the runbook has the promotion order with the 24 h soak gate');
  ok(/staging-acceptance\.mjs/.test(cutover) && /device-matrix/.test(cutover), 'the promotion order names the acceptance runner and the device matrix');
  const sections = ['Nominate', 'Verify staging', 'Staging acceptance', 'Device matrix', '24 h soak', 'Production database', 'Promote', 'Verify production', 'Rollback stance'];
  const order = sections.map(s => cutover.indexOf(`**${s}`));
  ok(order.every(i => i > 0) && order.every((i, k) => k === 0 || i > order[k - 1]), 'the promotion steps appear in order: nominate → verify → acceptance → devices → soak → database → promote → verify → rollback stance');
  ok(cutover.indexOf('**24 h soak') < cutover.indexOf('**Promote'), 'the soak gate comes before the promotion');

  const authority = read('docs/architecture/repository-authority.md');
  ok(authority.includes(STAGING_ORIGIN) && authority.includes(PRODUCTION_ORIGIN), 'repository-authority.md names the canonical staging and production origins');
  ok(/pri-learning-staging\.vercel\.app/.test(authority) && /retired/i.test(authority) && /Pri-Learning-India/.test(authority) && /#427/.test(authority), 'repository-authority.md records the retired Pri-Learning-India host (#427)');
  ok(/non-authoritative/.test(authority.split('### Retired host')[1] || ''), 'the retired host is classified non-authoritative');

  const checklist = read('docs/release/production-cutover-checklist.md');
  ok(/release-nominate\.mjs/.test(checklist) && /staging-acceptance\.mjs/.test(checklist) && /device-matrix\.md/.test(checklist), 'the cutover checklist points at the three tools');
  // The fake host of §3 mirrors these two server contracts; this pins them to the
  // source so a renamed field or a reordered guard shows up here, not on staging.
  const accountsSrc = read('server/platform/accounts.js');
  ok(/format:\s*'pri-account-export-v1'/.test(accountsSrc) && /learningEvents:\s*events/.test(accountsSrc) && /\bentities\b/.test(accountsSrc) && !/^\s*events,\s*$/m.test(accountsSrc.split("router.get('/export'")[1] || ''), 'GET /v1/account/export answers { format: pri-account-export-v1, learningEvents, entities } — the keys S7 reads');
  ok(/SELECT id,device_id,device_seq,kind,entity_id,/.test(accountsSrc), 'export learningEvents rows carry entity_id (the column S7 filters on)');
  ok(/requireSession\(db\), requireRecentAuth\(db\)/.test(accountsSrc.split("router.get('/export'")[1] || ''), 'GET /v1/account/export is behind requireRecentAuth — the fresh-proof contract S7 holds A\'s export to');
  const securitySrc = read('server/platform/security.js');
  const serverWindow = securitySrc.match(/export const REAUTH_FRESH_MS = ([^;]+);/)?.[1];
  eq(serverWindow && Function(`return (${serverWindow})`)(), EXPORT_FRESH_MS, `the runner's EXPORT_FRESH_MS equals the server's REAUTH_FRESH_MS (${serverWindow})`);
  ok(/let at = Number\(session\?\.created_at\) \|\| 0;/.test(securitySrc), 'fresh proof is per session (its own created_at): S6\'s new sign-in does not refresh S1\'s session for S7\'s export');
  const practiceSrc = read('server/platform/practice.js');
  ok(/router\.use\(requireSession\(db\), requireVerifiedEmail, requireRole\('student'\)\)/.test(practiceSrc), 'the practice router refuses unverified accounts before any ownership lookup (why S7 signs B2 up by code)');
  ok(/404, 'QUESTION_NOT_FOUND', 'This question does not belong to this account\.'/.test(practiceSrc), 'the ownership refusal is 404 QUESTION_NOT_FOUND — what S7 asserts');
  for (const route of ['/:id/recognize', '/:id/repeat', '/:id/reveal', '/:id/submit']) ok(practiceSrc.includes(`router.post('${route}'`), `${route} is a practice route (the four ownership probes of S7)`);
  const syncSrc = read('server/platform/sync.js');
  ok(/return \{ schemaVersion: SCHEMA, cursor: cutoff, hasMore: [^}]*, events, entities \};/.test(syncSrc), 'GET /v1/sync/pull answers { …, events, entities } — the key S7 reads from B2\'s pull');
  // S3 · the withdrawal route, its refusal and the parent's link, pinned to the source the fake mirrors.
  const withdrawRoute = accountsSrc.split("router.post('/guardian/withdraw'")[1]?.split("router.get('/guardian/state'")[0] || '';
  ok(withdrawRoute.length > 0 && !/requireSession/.test(withdrawRoute) && /purpose = 'guardian-consent'/.test(withdrawRoute) && /res\.json\(\{ ok: true, withdrawn \}\)/.test(withdrawRoute),
    'POST /v1/account/guardian/withdraw takes no session, accepts the approval link\'s guardian-consent token and answers { ok, withdrawn } — what S3 drives and checks');
  const stateRoute = accountsSrc.split("router.get('/guardian/state'")[1]?.split('router.post(')[0] || '';
  ok(/state: state\.state,/.test(stateRoute) && /\bblockerCode,/.test(stateRoute), 'GET /v1/account/guardian/state answers state and blockerCode — what S3 reads after the withdrawal');
  const consentSrc = read('server/platform/guardianConsent.js');
  ok(consentSrc.includes(`if (state.state === 'withdrawn') return '${CONSENT_WITHDRAWN.code}';`) && consentSrc.includes(`return res.status(${CONSENT_WITHDRAWN.status}).json({ error: { code, message } });`),
    `a withdrawn consent is refused ${CONSENT_WITHDRAWN.status} ${CONSENT_WITHDRAWN.code} (guardianConsent.js) — the refusal S3 asserts`);
  ok(read('server/platform/router.js').includes("router.use('/practice', requireGuardianConsent(db), createPracticeRouter(db));"), 'the consent gate stands in front of /v1/practice, so the child\'s next /practice/issue meets it');
  ok(read('server/platform/otp.js').includes("if (channel === 'email') await queueAccountToken(db, accountId, destination, 'guardian-consent', now);"), 'an email parent is sent the approval link beside the code (the link S3 asks the human to copy)');
  const deliverySrc = read('server/platform/authDelivery.js');
  ok(deliverySrc.includes("kind === 'guardian-consent' ? '/guardian/consent' : '/account-action'") && deliverySrc.includes('url.hash = new URLSearchParams({ action: kind, token }).toString();'), 'the parent\'s link opens /guardian/consent with action and token in the fragment — the shape withdrawalTokenFrom reads');
  ok(read('client/src/pages/GuardianConsent.jsx').includes('else await cloud.guardianWithdraw(linkToken);') && read('client/src/platform/cloudTransport.js').includes("guardianWithdraw: token => cloudRequest('/v1/account/guardian/withdraw', { method: 'POST', body: { token } })"),
    'the parent\'s own page withdraws through the same route with the link\'s token — S3 drives the product\'s path, not a test-only one');
  // S6 · the graded-attempt row and the app's History filter.
  ok(/'server-grader', COALESCE\(MAX\(device_seq\), 0\) \+ 1, 'graded-attempt'/.test(practiceSrc) && /attemptId, submissionId, questionId: qid, correct: response\.correct,\s*marksEarned: response\.marksEarned, marksPossible: response\.marksPossible,/.test(practiceSrc),
    'a resolved submit writes the server-grader graded-attempt row whose payload carries attemptId, submissionId, questionId, correct and the marks — what S6 matches');
  ok(/serverCursor: row\.server_cursor, id: row\.id, deviceId: row\.device_id, deviceSeq: row\.device_seq, kind: row\.kind,\s*entityId: row\.entity_id, occurredAt: row\.occurred_at, payload: parseJson\(row\.payload_json, \{\}\)/.test(syncSrc),
    'GET /v1/sync/pull events carry id, deviceId, kind, entityId and payload — the fields S6 reads');
  const workerSrc = read('client/src/platform/syncWorker.js');
  ok(/row\.kind !== 'graded-attempt' \|\| row\.deviceId !== 'server-grader' \|\|\s*row\.eventId !== row\.payload\?\.attemptId \|\|\s*row\.entityId !== row\.payload\?\.questionId/.test(workerSrc) && /eventId: event\.id/.test(workerSrc),
    'the app\'s History counts only server-grader graded-attempt rows keyed by their attempt and question — the filter returnedAttempts mirrors');
  ok(/const raw = await cloud\.syncPull\(cursor\);/.test(workerSrc) && /if \(!raw\.hasMore\) break;/.test(workerSrc) && /for \(let page = 0; page < 100; page\+\+\)/.test(workerSrc), 'the app pulls from its cursor while hasMore, at most 100 pages — the walk S6 makes');
  const readme = read('tools/acceptance/README.md');
  ok(/# Staging acceptance S0–S8/.test(readme) && /HUMAN STEP/.test(readme) && /SYNTHETIC/.test(readme), 'tools/acceptance/README.md documents the staging acceptance and its evidence classes');
  ok(!/acceptance A–[DF]|steps 0, A/.test(readme) && /Gates A–D/.test(readme), 'the README names the steps S0–S8, never by letter, and says why (issue #686\'s Gates A–D)');
  ok(STEP_IDS.every(id => readme.includes(`| ${id} |`)), 'the README\'s step table has a row for every step S0–S8');
  ok(/QUESTION_NOT_FOUND/.test(readme) && /EMAIL_UNVERIFIED/.test(readme) && !/needs no action/.test(readme), 'the README says S7 uses a verified code account and asserts the ownership refusal, not merely non-success');
  ok(/GUARDIAN_CONSENT_WITHDRAWN/.test(readme) && /\/v1\/account\/guardian\/withdraw/.test(readme) && /sync\/pull/.test(readme), 'the README documents S3\'s withdrawal and refusal and S6\'s History read');
  ok(/takeover|pre-registration/i.test(readme), 'the README warns about the unverified-password-account takeover on S1');
  for (const doc of ['scripts/release-dossier.mjs', 'scripts/release-nominate.mjs', 'docs/release/production-cutover-checklist.md', 'docs/release/PERMANENT-DEPLOYMENT-AUTOMATION.md', 'docs/release/device-matrix.md', 'docs/operations/postgres-cutover.md']) {
    const text = read(doc);
    ok(!/acceptance A–[DF]|staging-acceptance\.mjs`? A–F|steps? 0,? (and )?A–[EF]/.test(text), `${doc} no longer names the acceptance steps by letter`);
  }
  const pkg = JSON.parse(read('package.json'));
  ok(pkg.scripts['test:release:prep']?.includes('tools/release-prep.test.mjs') && pkg.scripts['test:release:prep'].includes('device-matrix-record.mjs validate'), 'test:release:prep runs this file and the ledger validation');
  ok(pkg.scripts['test:release:prep'].includes('node client/test/q4-release-negative-controls.mjs') && pkg.scripts['test:release:prep'].includes('node client/test/release-source-policy-consistency-check.mjs'),
    'test:release:prep also runs Q4\'s independent release holdout (17 negative controls) and the production-source policy check, so CI keeps both');
  ok(pkg.scripts.test.includes('npm run test:release:prep'), 'npm test (the CI deterministic suite) runs test:release:prep');
}

console.log(`RELEASE PREP: PASS — ${count}/${count} checks`);
