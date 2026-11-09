// Q4 independent release-gate holdout. Synthetic evidence fixtures ONLY.
// Run: node client/test/q4-release-negative-controls.mjs
// This file intentionally fails against #696's unsafe nominal release controls.
// It is QA-owned test-only preparation, not an authorisation to merge or deploy.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  nominate, deviceEvidence, readerEvidence, loadOverride,
  REQUIRED_CONTEXTS, CONTAINER_CONTEXT, STAGING_ORIGIN, PRODUCTION_ORIGIN
} from '../../scripts/release-nominate.mjs';
import { CASES, buildRecord, validateLedger } from '../../scripts/device-matrix-record.mjs';
import { SCHEMA_VERSION, BILLING_SCHEMA_VERSION } from '../../server/platform/schemaVersions.js';

const SHA = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const PROD = 'c'.repeat(40);
function isolated(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'pri-q4-release-'));
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}
function matrix(dir, selection = () => 'pass', sha = SHA) {
  const path = join(dir, 'results.jsonl');
  const rows = CASES.map(c => {
    const result = selection(c);
    return buildRecord({
      case: c.id, result, sha, notes: result === 'blocked'
        ? 'Physical-device acceptance has not occurred in this fixture'
        : 'Synthetic test row; no real person or hardware was used',
      ...(result === 'pass' ? {
        tester: 'Fixture Human', device: c.family === 'IPH' ? 'Sample iPhone' : 'Sample Tablet',
        os: 'iOS fixture 26.0', pencil: c.pencil ? 'Sample Pencil' : undefined,
        buildKind: c.family === 'AND' || c.family === 'ANT' ? 'play-internal' : 'testflight', server: 'production'
      } : {})
    }, { now: Date.parse('2026-10-30T00:00:00Z') });
  });
  writeFileSync(path, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  assert.deepEqual(validateLedger(path), [], 'the synthetic fixture is structurally legal');
  return path;
}
function reader(dir, fields = {}, sha = SHA) {
  const path = join(dir, 'readers');
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, 'synthetic-fixture.json'), JSON.stringify({
    format: 'pri-cloud-reader-eval', version: 1,
    evidenceClass: 'real-human', // deliberately claimed without proof; a NEGATIVE CONTROL
    measuredAt: '2026-10-30T00:00:00Z', releaseSha: sha,
    corpus: { writers: 1, samples: 1, split: 'test' },
    results: { exact: 0, lines: 1 },
    ...fields
  }));
  return path;
}
function override(dir, fields = {}) {
  const path = join(dir, 'override.json');
  writeFileSync(path, JSON.stringify({
    sha: SHA, waives: ['device-matrix', 'reader-evidence'],
    by: 'Claimed Human', at: '2026-11-07T00:00:00Z',
    reason: 'Internal-test claim only; NEVER a public production approval.',
    ...fields
  }));
  return path;
}
function world(ledger, readerDir) {
  const calls = { git: [], gh: [], fetch: [] };
  const git = async args => {
    calls.git.push(args);
    if (args[0] === 'fetch') return '';
    if (args[0] === 'rev-parse' && args[1] === '--verify') {
      if (args.includes('origin/deploy/production')) return PROD + '\n';
      return SHA + '\n';
    }
    if (args[0] === 'rev-parse') return SHA + '\n';
    if (args[0] === 'merge-base') return '';
    if (args[0] === 'rev-list') return '0\n';
    if (args[0] === 'show') return 'export const SCHEMA_VERSION = ' + SCHEMA_VERSION +
      ';\nexport const BILLING_SCHEMA_VERSION = ' + BILLING_SCHEMA_VERSION + ';\n';
    throw Error('unexpected git command ' + args.join(' '));
  };
  const gh = async path => {
    calls.gh.push(path);
    if (path.includes('/actions/runs')) return { workflow_runs: [{
      name: 'CI', workflow_id: 1, event: 'push',
      status: 'completed', conclusion: 'success', run_started_at: '2026-11-07T00:00:00Z'
    }] };
    if (path.includes('/check-runs')) return { check_runs: [...REQUIRED_CONTEXTS, CONTAINER_CONTEXT].map(
      name => ({ name, status: 'completed', conclusion: 'success', completed_at: '2026-11-07T00:00:00Z' })
    ) };
    throw Error('unexpected GitHub endpoint ' + path);
  };
  const fetchImpl = async url => {
    calls.fetch.push(url);
    const { origin, pathname } = new URL(url);
    const json = value => ({ status: 200, json: async () => value });
    if (origin === STAGING_ORIGIN) {
      if (pathname === '/v1/health') return json({
        ok: true, service: 'pri-learning-platform',
        releaseIdentity: { releaseSha: SHA, buildTimestamp: '2026-11-07T00:00:00Z' },
        database: { engine: 'postgres' },
        schemaVersion: String(SCHEMA_VERSION), billingSchemaVersion: String(BILLING_SCHEMA_VERSION)
      });
      if (pathname === '/v1/ready') return json({
        ready: true, state: 'ready', failing: [], degraded: [],
        checks: { database: {
          schemaVersion: String(SCHEMA_VERSION), billingSchemaVersion: String(BILLING_SCHEMA_VERSION)
        } }
      });
      if (pathname === '/release.json') return json({ releaseSha: SHA });
    }
    if (origin === PRODUCTION_ORIGIN && pathname === '/v1/health') {
      return json({ ok: true, database: { engine: 'sqlite' }, releaseIdentity: { releaseSha: PROD } });
    }
    throw Error('unexpected endpoint ' + url);
  };
  return {
    calls, nominate: (options = {}) => nominate({
      sha: SHA, git, gh, fetchImpl, fetchOrigin: false,
      deviceLedger: ledger, readerEvalDir: readerDir, ...options
    })
  };
}

async function isolatedAsync(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'pri-q4-release-'));
  try { return await fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

// Positive controls: a negative-only red-team suite must still accept valid cases.
test('positive: all required synthetic device rows are structurally valid', () => isolated(dir => {
  const ledger = matrix(dir);
  const evidence = deviceEvidence(SHA, { ledger });
  assert.equal(evidence.ok, true);
  assert.equal(evidence.counts.pass, CASES.length);
  assert.equal(evidence.counts.blocked, 0);
}));
test('positive: a different SHA cannot borrow device acceptance', () => isolated(dir => {
  const ledger = matrix(dir, () => 'pass', OTHER);
  assert.equal(deviceEvidence(SHA, { ledger }).ok, false);
}));

// Release NO-GO obligations: BLOCKED is never the same as physically PASS.
test('release NO-GO: 36/36 blocked, 0 physical passes', () => isolated(dir => {
  const ledger = matrix(dir, () => 'blocked');
  const e = deviceEvidence(SHA, { ledger });
  assert.equal(e.counts.pass, 0);
  assert.equal(e.counts.blocked, CASES.length);
  assert.equal(e.ok, false, 'complete records are not completed physical verification');
}));
for (const family of ['IPH', 'IPD', 'AND', 'ANT']) {
  test('release NO-GO: missing the entire physical family ' + family, () => isolated(dir => {
    const ledger = matrix(dir, kase => kase.family === family ? 'blocked' : 'pass');
    const e = deviceEvidence(SHA, { ledger });
    assert.equal(e.counts.blocked, CASES.filter(kase => kase.family === family).length);
    assert.equal(e.ok, false);
  }));
}
test('release NO-GO: even one blocked mandatory device case', () => isolated(dir => {
  const ledger = matrix(dir, kase => kase.id === CASES[0].id ? 'blocked' : 'pass');
  assert.equal(deviceEvidence(SHA, { ledger }).ok, false);
}));

// Untrusted local JSON is not an eligible human release signature.
test('reject unsigned self-declared override impersonating a human', () => isolated(dir => {
  const evidence = loadOverride(override(dir), SHA);
  assert.ok(evidence.problems.length > 0, 'a name string does not authenticate approval');
  assert.deepEqual(evidence.waives, []);
}));
test('reject approval asserted in the future', () => isolated(dir => {
  const evidence = loadOverride(override(dir, { at: '2099-01-01T00:00:00Z' }), SHA);
  assert.ok(evidence.problems.length > 0, 'future-dated authorisation is not yet valid');
}));
test('positive: override naming a different SHA cannot transfer to this SHA', () => isolated(dir => {
  const evidence = loadOverride(override(dir, { sha: OTHER }), SHA);
  assert.ok(evidence.problems.length > 0);
  assert.deepEqual(evidence.waives, []);
}));
test('reject internal test-track exception used for public promotion', () => isolated(dir => {
  const evidence = loadOverride(override(dir, { target: 'internal-testing' }), SHA);
  assert.ok(evidence.problems.length > 0, 'internal-only authority cannot qualify a public release');
}));
test('release NO-GO: 0/1 exact reader and 1 alleged writer do not establish the reader accuracy floor', () => isolated(dir => {
  const evidence = readerEvidence(SHA, { dir: reader(dir) });
  assert.equal(evidence.ok, false, 'labelled evidence must be sufficiently measured and floor-verified');
}));

// Full nominator, not only helper functions. ALL other gates are green stubs.
test('positive: evidence-free --candidate may prepare without promotion', async () => isolatedAsync(async dir => {
  const w = world(matrix(dir, () => 'blocked'), join(dir, 'missing-reader'));
  const report = await w.nominate({ stage: 'candidate' });
  assert.equal(report.ok, true);
  assert.deepEqual(report.promotion, []);
}));
test('PUBLIC release NO-GO: all device cases blocked, supposedly real 0/1 reader', async () => isolatedAsync(async dir => {
  const w = world(matrix(dir, () => 'blocked'), reader(dir));
  const report = await w.nominate();
  assert.equal(report.ok, false, 'missing real acceptance cannot produce a release-ready nomination');
  assert.deepEqual(report.promotion, []);
}));
test('PUBLIC release NO-GO: unsigned override + no real reader or device', async () => isolatedAsync(async dir => {
  const w = world(matrix(dir, () => 'blocked'), join(dir, 'missing-reader'));
  const report = await w.nominate({ overridePath: override(dir, { target: 'internal-testing' }) });
  assert.equal(report.ok, false, 'untrusted JSON cannot waive mandatory public gates');
  assert.deepEqual(report.promotion, [], 'no release pointer instructions for an unqualified candidate');
}));

test('PUBLIC release NO-GO: no exact-SHA Release Candidate strict-handwriting workflow result', async () => isolatedAsync(async dir => {
  const evalDir = reader(dir, {
    corpus: { writers: 24, samples: 2000, split: 'test' },
    results: { exact: 2000, lines: 2000 }
  });
  const w = world(matrix(dir), evalDir); // deliberately only CI, not release-candidate.yml
  const report = await w.nominate();
  assert.equal(report.ok, false, 'passing PR checks cannot replace the strict release-candidate workflow');
  assert.deepEqual(report.promotion, [], 'release cannot be nominated before its strict gate');
}));
