// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the /v1 platform suites on Postgres (ADR-0001 phase 2)
//
//   npm run test:platform:pg
//   (= node scripts/with-postgres.mjs node server/test/run-platform-postgres.mjs)
//
// Needs PRI_TEST_PG_ADMIN_URL (scripts/with-postgres.mjs provides it). Runs:
//   1. the migrations on a real Postgres against the SQLite schema, the
//      mutation proof that this gate fails on real migration mistakes, and the
//      cutover verification tool (server/tools/postgres-target-check.mjs);
//   2. every engine-agnostic platform suite with --engine=postgres. Each gets
//      its own freshly migrated scratch database and connects as a member of
//      pri_server, so a missing grant fails here rather than in production.
// A suite that does not report `engine: postgres` counts as a failure: a run
// that silently fell back to SQLite proves nothing about Postgres.
// ─────────────────────────────────────────────────────────────────────────────
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
if (!process.env.PRI_TEST_PG_ADMIN_URL) {
  console.error('PRI_TEST_PG_ADMIN_URL is not set. Run: npm run test:platform:pg');
  process.exit(1);
}

const SCHEMA = ['postgres-schema-live-check.mjs', 'postgres-schema-mutation-check.mjs', 'postgres-target-tool-check.mjs'];
// Engine-agnostic suites: SQLite by default (npm run test:platform), Postgres here.
export const ENGINE_SUITES = [
  'platform-store-check.mjs',
  'platform-concurrency-check.mjs',
  'platform-sync-burst-check.mjs',
  'platform-startup-check.mjs',
  'platform-http-journeys-check.mjs',
  'sync-idempotency-contract-check.mjs',
  'practice-attempt-sync-check.mjs',
  'account-lifecycle-contract-check.mjs',
  'account-lifecycle-journey-check.mjs',
  'account-deletion-reauth-check.mjs',
  'guardian-consent-lifecycle-check.mjs',
  'verification-enforcement-check.mjs',
  'teacher-invite-check.mjs',
  'login-lockout-check.mjs',
  'oidc-verification-check.mjs',
  'entitlement-admin-grant-check.mjs',
  'content-index-exposure-check.mjs',
  'classroom-submission-contract-check.mjs',
  'assignment-execution-contract-check.mjs',
  'assignment-targeting-check.mjs',
  'billing-cancel-refund-check.mjs',
  'razorpay-billing-check.mjs',
  'apple-billing-check.mjs',
  'google-billing-check.mjs',
  'tutor-help-check.mjs',
  'failure-drills-check.mjs',
  'security-acceptance-check.mjs',
  'abuse-limits-check.mjs'
];

let failed = 0;
const lines = [];
for (const [suite, args] of [...SCHEMA.map(s => [s, []]), ...ENGINE_SUITES.map(s => [s, ['--engine=postgres']])]) {
  const started = Date.now();
  const result = spawnSync(process.execPath, [join(root, 'server', 'test', suite), ...args], { cwd: root, env: process.env, encoding: 'utf8', timeout: 300_000 });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  const summary = (result.stdout || '').trim().split('\n').filter(Boolean).pop() || '';
  const onPostgres = !args.length || /^engine: postgres$/m.test(result.stdout || '');
  const passed = result.status === 0 && onPostgres;
  if (!passed) {
    failed++;
    console.error(`✗ ${suite}${onPostgres ? '' : ' (did not run on Postgres)'}\n${output.split('\n').filter(l => !/^\s+at /.test(l)).slice(-25).join('\n')}`);
  }
  lines.push(`${passed ? '✓' : '✗'} ${suite} (${((Date.now() - started) / 1000).toFixed(1)}s) — ${summary.slice(0, 150)}`);
}
console.log(lines.join('\n'));
const total = SCHEMA.length + ENGINE_SUITES.length;
if (failed) {
  console.error(`PLATFORM ON POSTGRES: FAIL — ${failed} of ${total} suites`);
  process.exit(1);
}
console.log(`PLATFORM ON POSTGRES: PASS — ${total}/${total} suites — migrations match SQLite and catch injected mistakes; ${ENGINE_SUITES.length} platform suites pass on Postgres as the pri_server role.`);
