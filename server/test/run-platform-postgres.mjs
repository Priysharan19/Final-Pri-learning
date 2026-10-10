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
  // The immutable online-issued grading receipts and adversarial account, replay,
  // and awarded-marks checks MUST also pass with real pri_server Postgres.
  'online-marking-authority-check.mjs',
  // Examination papers: sealed paper, answer snapshots, exactly-once
  // finalisation and the deadline rule, account-scoped under Row-Level Security.
  'exam-authority-check.mjs',
  // Method marks need progress and issuing by seed is deterministic and
  // per-account — through the same real HTTP routes, on the Postgres store.
  'method-progress-http-check.mjs',
  'flagship-ap-working-http-check.mjs',
  'practice-seed-reissue-check.mjs',
  // The server chooses the seed and a prepared question is bound once by one
  // account: the one-account claim and the sealed copy must hold on Postgres.
  'practice-server-question-check.mjs',
  'practice-repeat-credit-check.mjs',
  // The marker runs off the request thread under a hard deadline, and a
  // submission is read → marked → committed with the state re-read under the
  // account's lock. The re-check and the exactly-once guarantees under
  // concurrency must hold on SERIALIZABLE Postgres as the pri_server role too.
  'marker-isolation-check.mjs',
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
  'storekit-entitlement-state-machine-check.mjs',
  'tutor-help-check.mjs',
  'tutor-device-journey-check.mjs',
  // The tutor grounded in the server's own escrowed question: the escrow read
  // must be account-scoped under Row-Level Security as pri_server too.
  'tutor-issued-grounding-check.mjs',
  'failure-drills-check.mjs',
  // One paid read per unchanged picture: the ceiling reservation under
  // concurrency (SERIALIZABLE retries), the refund, and the receipt minted from
  // a reused transcript all have to hold on the Postgres store too.
  'recognition-dedupe-check.mjs',
  'security-acceptance-check.mjs',
  'abuse-limits-check.mjs',
  // Staff second factor, identity sign-in age declaration, and the hardening
  // set (session lifetime, sync quota, per-account RLS scope, password policy,
  // join-code encryption, guardian withdrawal credential, health exposure).
  'mfa-check.mjs',
  'oidc-consent-check.mjs',
  'security-hardening-check.mjs'
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
