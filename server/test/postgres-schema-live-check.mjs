// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · supabase/migrations applied to a real Postgres, checked against
// the SQLite schema production builds (ADR-0001 phase 2)
//
// The text-level parity suite (postgres-schema-parity-check) reads migration SQL
// as text; it cannot see a missing UNIQUE, a dropped cascade, a narrowed type or
// a table a later migration adds. This one applies every migration, in order,
// to a scratch database and reads the result back from the catalogs: column
// types and nullability, primary/unique keys, foreign keys with their ON DELETE
// action, CHECK placement, secondary indexes, RLS and its policies, every
// privilege of pri_server and of the Supabase client API roles, and the seed
// rows the server needs at boot.
//
// Run through scripts/with-postgres.mjs (npm run test:platform:pg).
// ─────────────────────────────────────────────────────────────────────────────
import { scratchDatabase } from './support/postgres.mjs';
import { compareAccess, compareSchemas, compareSeeds, postgresSchema, sqliteSchema } from './support/pgSchemaParity.mjs';

const db = await scratchDatabase('schema_live');
let total = 0;
const failures = [];
try {
  const sqlite = sqliteSchema();
  for (const result of [
    compareSchemas(sqlite, await postgresSchema(db.client)),
    await compareAccess(db.client),
    await compareSeeds(db.client)
  ]) {
    total += result.checks;
    failures.push(...result.failures);
  }
  if (failures.length) {
    console.error(`POSTGRES SCHEMA LIVE: FAIL — ${failures.length} of ${total} checks\n  · ${failures.join('\n  · ')}`);
    process.exitCode = 1;
  } else {
    console.log(`POSTGRES SCHEMA LIVE: PASS — ${total} checks — ${db.applied} migration(s) applied to Postgres; ${sqlite.size} tables match SQLite in types, keys, foreign keys, CHECKs and indexes; RLS on with pri_server-only policies; client API roles hold nothing.`);
  }
} finally {
  await db.drop();
}
