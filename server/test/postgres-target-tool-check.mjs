// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the cutover verification tool says PASS only when it should
//
// server/tools/postgres-target-check.mjs is what the operator runs against
// Supabase staging before Railway is pointed at it (docs/operations/
// postgres-cutover.md). Here it runs, as a real process with the app's login
// role, against: a freshly migrated database (must PASS); one whose policy was
// narrowed to SELECT and one missing the cursor-sequence migration (must FAIL,
// for those reasons); and it must never print the URL.
//
// Run through scripts/with-postgres.mjs (npm run test:platform:pg).
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scratchDatabase, serverRoleUrl } from './support/postgres.mjs';

const tool = join(dirname(fileURLToPath(import.meta.url)), '..', 'tools', 'postgres-target-check.mjs');
let checks = 0;
const ok = (cond, label) => { assert.ok(cond, label); checks++; };

async function runAgainst(label, drift) {
  const db = await scratchDatabase(label);
  try {
    if (drift) await db.client.query(drift);
    const url = await serverRoleUrl(db.name);
    const env = { ...process.env, PRI_DATABASE_URL: url };
    delete env.NODE_ENV; // the throwaway cluster has no TLS
    const result = spawnSync(process.execPath, [tool], { env, encoding: 'utf8', timeout: 120_000 });
    const output = `${result.stdout || ''}${result.stderr || ''}`;
    ok(!output.includes(db.name) && !output.includes('postgres://') && !output.includes('pri_app_test'), `${label}: the tool prints nothing of the URL`);
    return { status: result.status, output };
  } finally {
    await db.drop();
  }
}

const clean = await runAgainst('target_clean');
ok(clean.status === 0 && /POSTGRES TARGET: PASS/.test(clean.output), `a freshly migrated database passes (${clean.output.trim().split('\n').pop()})`);
ok(/✓ live schema gate: (\d+)\/\1 catalog checks/.test(clean.output), 'including every live schema gate check');
ok(/✓ write smoke/.test(clean.output), 'and the rolled-back write smoke');

const narrowed = await runAgainst('target_policy', 'drop policy pri_server_all on pri.accounts; create policy pri_server_all on pri.accounts as permissive for select to pri_server using (true);');
ok(narrowed.status === 1 && /accounts: policy pri_server_all is for SELECT, not ALL/.test(narrowed.output), 'a SELECT-only policy fails the target check, naming it');

const unmigrated = await runAgainst('target_seq', 'drop sequence pri.sync_cursor_seq;');
ok(unmigrated.status === 1 && /PLATFORM_DB_SCHEMA_MISMATCH/.test(unmigrated.output), 'a database missing a migration fails as the server would: PLATFORM_DB_SCHEMA_MISMATCH');

console.log(`POSTGRES TARGET TOOL: PASS — ${checks}/${checks} checks — the cutover verification passes a migrated database, fails a narrowed policy and a missing migration, and never prints the URL.`);
