// Shared support for suites that need a real Postgres.
//
// They run under scripts/with-postgres.mjs, which provides PRI_TEST_PG_ADMIN_URL:
// a superuser connection to a throwaway server (a local initdb cluster, or CI's
// service container). Each suite creates its own scratch database, applies
// supabase/migrations to it exactly as Supabase would, and drops it at the end.
//
// The Supabase client API roles (anon, authenticated) and pri_server are created
// first when missing, so the migration's revoke branch runs here the way it will on
// Supabase. They are NOLOGIN; no credential is ever involved.

import { randomBytes } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(here, '..', '..', '..', 'supabase', 'migrations');

export function adminUrl() {
  const url = String(process.env.PRI_TEST_PG_ADMIN_URL || '').trim();
  if (!url) {
    console.error('This suite needs a throwaway Postgres. Run it through `node scripts/with-postgres.mjs …` (npm run test:platform:pg).');
    process.exit(1);
  }
  return url;
}

export async function pgModule() {
  const { default: pg } = await import('pg');
  return pg;
}

export function migrationFiles(dir = MIGRATIONS_DIR) {
  return readdirSync(dir).filter(name => name.endsWith('.sql')).sort()
    .map(name => ({ name, sql: readFileSync(join(dir, name), 'utf8') }));
}

function withDatabase(url, database) {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

// Roles are cluster-wide. Created here, before any migration runs, so suites
// migrating scratch databases in parallel do not race the migration's own
// `create role pri_server` (pri_server is NOLOGIN either way). A concurrent
// creator winning the race is fine.
async function ensureClusterRoles(admin) {
  for (const role of ['anon', 'authenticated', 'pri_server']) {
    try {
      await admin.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN CREATE ROLE ${role} NOLOGIN; END IF;
      END $$;`);
    } catch (error) {
      if (error?.code !== '23505' && error?.code !== '42710') throw error;
    }
  }
}

/**
 * A fresh database with the given migrations applied (default: the repository's
 * supabase/migrations, in filename order, each in its own transaction as the
 * Supabase CLI applies them). Returns a superuser client on it, its URL, and
 * drop() to remove it.
 */
export async function scratchDatabase(label, { migrations = migrationFiles() } = {}) {
  const pg = await pgModule();
  const base = adminUrl();
  const name = `pri_${String(label).replace(/[^a-z0-9_]/gi, '_').toLowerCase()}_${randomBytes(4).toString('hex')}`;
  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  try {
    await ensureClusterRoles(admin);
    await admin.query(`CREATE DATABASE ${name}`);
  } finally {
    await admin.end();
  }
  const url = withDatabase(base, name);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  let applied = 0;
  try {
    for (const migration of migrations) {
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw Object.assign(new Error(`migration ${migration.name} failed: ${error.message}`), { code: error.code, migration: migration.name });
      }
      applied++;
    }
  } catch (error) {
    await client.end().catch(() => {});
    await dropDatabase(name);
    throw error;
  }
  return {
    name,
    url,
    client,
    applied,
    async drop() {
      await client.end().catch(() => {});
      await dropDatabase(name);
    }
  };
}

async function dropDatabase(name) {
  const pg = await pgModule();
  const admin = new pg.Client({ connectionString: adminUrl() });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  } finally {
    await admin.end();
  }
}

/**
 * A LOGIN role that is only a member of pri_server — what the Railway service
 * connects as in production — and a URL for it on the given database. Proves
 * the /v1 server works with exactly the grants the migration gives it.
 * Trust authentication: the throwaway cluster needs no password.
 */
export async function serverRoleUrl(database) {
  const pg = await pgModule();
  const admin = new pg.Client({ connectionString: adminUrl() });
  await admin.connect();
  try {
    try {
      await admin.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pri_app_test') THEN CREATE ROLE pri_app_test LOGIN; END IF;
      END $$;`);
    } catch (error) {
      if (error?.code !== '23505' && error?.code !== '42710') throw error;
    }
    await admin.query('GRANT pri_server TO pri_app_test');
  } finally {
    await admin.end();
  }
  const parsed = new URL(withDatabase(adminUrl(), database));
  parsed.username = 'pri_app_test';
  parsed.password = '';
  return parsed.toString();
}
