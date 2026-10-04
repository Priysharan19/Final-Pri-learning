#!/usr/bin/env node
// Pri Learning · SQLite → Postgres data export (ADR-0001 phase 2 cutover, docs/operations/postgres-cutover.md §6a)
//
//   node server/tools/sqlite-to-postgres-export.mjs --db /data/backups/pri-learning-platform-<ts>.db \
//        --out ./pri-export-<ts> [--inserts]
//
// Reads a Pri platform SQLite database READ-ONLY and writes, into --out:
//
//   <table>.csv          one COPY-ready CSV per exported table (header row; strings always
//                        quoted; NULL is the empty unquoted field — Postgres CSV semantics)
//   import-copy.sql      a psql script: one transaction that refuses a non-empty or
//                        wrong-version target, \copy's every CSV, lifts pri.sync_cursor_seq
//                        and the audit_log identity, then commits
//   import-inserts.sql   (--inserts) the same import as plain SQL INSERTs, for an SQL
//                        console that has no \copy
//   verify.sql           row-count, version, cursor-sequence and email-case verification
//                        queries; every row of the first result must read `ok`
//   manifest.json        per-table source/exported row counts, columns, SHA-256 of every
//                        file, the cursor lift value — the evidence record for the cutover log
//
// What is NOT exported: platform_meta (the migrations seed the versions and the tool refuses
// a source whose versions differ from this build's) and sync_cursors (pri_server cannot write
// it on Postgres; cursors come from pri.sync_cursor_seq, which the import lifts instead).
//
// Never imports server/platform/db.js: that module opens the live database at import
// (backup.mjs follows the same rule). It reads the Postgres column lists from
// supabase/migrations so a SQLite column Postgres does not have is refused here, not at COPY.
// The table list itself (and the parent-first import order) is derived from the migrations'
// create table / references clauses. Nothing here connects to Postgres; the import is the
// operator's psql step.
import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BILLING_SCHEMA_VERSION, SCHEMA_VERSION } from '../platform/schemaVersions.js';
import { verifyPlatformDatabase } from './backup.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(here, '..', '..', 'supabase', 'migrations');
export const EXPORT_FORMAT = 'pri-sqlite-postgres-export';
export const EXPORT_FORMAT_VERSION = 1;

/**
 * Every `pri` table the import fills, in foreign-key order (parents first) so a
 * single transaction of COPYs satisfies every constraint as it goes. Derived from
 * supabase/migrations (postgresSchema), so a table a new migration adds is
 * exported without a change here — and a table the migrations drop stops being.
 */
export function exportTables(dir = MIGRATIONS_DIR) {
  const schema = postgresSchema(dir);
  const names = [...schema.keys()].filter(name => !SEEDED_TABLES.includes(name));
  const remaining = new Set(names);
  const ordered = [];
  while (remaining.size) {
    const ready = names.filter(name => remaining.has(name) &&
      [...schema.get(name).references].every(parent => parent === name || !remaining.has(parent)));
    if (!ready.length) throw toolError('EXPORT_FK_CYCLE', `foreign keys between ${[...remaining].join(', ')} form a cycle`);
    for (const name of ready) { ordered.push(name); remaining.delete(name); }
  }
  return ordered;
}

/** Seeded by the migrations; verified, never copied. */
export const SEEDED_TABLES = Object.freeze(['platform_meta', 'sync_cursors']);

function toolError(code, message, details = {}) {
  return Object.assign(new Error(message), { code, ...details });
}

export function timestampLabel(now = new Date()) {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

const IDENT = /^[a-z_][a-z0-9_]*$/;
function ident(name) {
  if (!IDENT.test(String(name))) throw toolError('EXPORT_IDENTIFIER_INVALID', `unsafe identifier ${JSON.stringify(name)}`);
  return name;
}

// ── The Postgres side, read from the migrations ─────────────────────────────

const CONSTRAINT_WORDS = new Set(['primary', 'unique', 'foreign', 'check', 'constraint', 'exclude']);

/**
 * Table → { columns, references } of the `pri` schema as supabase/migrations
 * define it: create table bodies plus `alter table … add column`, and every
 * `references pri.<parent>` named in a create/alter statement of that table.
 * Comments are stripped first.
 */
export function postgresSchema(dir = MIGRATIONS_DIR) {
  const files = readdirSync(dir).filter(name => name.endsWith('.sql')).sort();
  const tables = new Map();
  for (const name of files) {
    const sql = readFileSync(join(dir, name), 'utf8').replace(/--[^\n]*/g, '');
    const create = /create\s+table\s+pri\.([a-z_][a-z0-9_]*)\s*\(/gi;
    let match;
    while ((match = create.exec(sql))) {
      const table = match[1];
      let depth = 1;
      let index = create.lastIndex;
      const start = index;
      while (index < sql.length && depth > 0) {
        const ch = sql[index];
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        index++;
      }
      const body = sql.slice(start, index - 1);
      const columns = [];
      for (const rawLine of splitTopLevel(body)) {
        const line = rawLine.trim();
        if (!line) continue;
        const first = line.split(/\s+/)[0].toLowerCase();
        if (CONSTRAINT_WORDS.has(first)) continue;
        columns.push(first);
      }
      tables.set(table, { columns, references: new Set(referencedTables(body)) });
    }
    // alter table pri.x … (add column / add constraint … references …), statement by statement
    const alter = /alter\s+table\s+pri\.([a-z_][a-z0-9_]*)([^;]*);/gi;
    while ((match = alter.exec(sql))) {
      const entry = tables.get(match[1]);
      if (!entry) throw toolError('EXPORT_MIGRATION_PARSE', `${name} alters unknown table pri.${match[1]}`);
      const rest = match[2];
      const add = /add\s+column\s+([a-z_][a-z0-9_]*)/gi;
      let column;
      while ((column = add.exec(rest))) entry.columns.push(column[1].toLowerCase());
      for (const parent of referencedTables(rest)) entry.references.add(parent);
    }
  }
  return tables;
}

function referencedTables(text) {
  return [...String(text).matchAll(/references\s+pri\.([a-z_][a-z0-9_]*)/gi)].map(m => m[1].toLowerCase());
}

/** Table → ordered column names (postgresSchema without the references). */
export function postgresColumns(dir = MIGRATIONS_DIR) {
  return new Map([...postgresSchema(dir)].map(([table, entry]) => [table, entry.columns]));
}

function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(current); current = ''; } else current += ch;
  }
  parts.push(current);
  return parts;
}

// ── Literals ─────────────────────────────────────────────────────────────────

function csvCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw toolError('EXPORT_UNSUPPORTED_VALUE', 'non-finite number in source row');
    return String(value);
  }
  if (typeof value === 'string') return `"${value.replaceAll('"', '""')}"`;
  throw toolError('EXPORT_UNSUPPORTED_TYPE', `unsupported SQLite value type ${Buffer.isBuffer(value) ? 'BLOB' : typeof value}`);
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw toolError('EXPORT_UNSUPPORTED_VALUE', 'non-finite number in source row');
    return String(value);
  }
  if (typeof value === 'string') return `'${value.replaceAll("'", "''")}'`;
  throw toolError('EXPORT_UNSUPPORTED_TYPE', `unsupported SQLite value type ${Buffer.isBuffer(value) ? 'BLOB' : typeof value}`);
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

// ── Export ───────────────────────────────────────────────────────────────────

/**
 * Export one SQLite platform database to COPY-ready CSV + import/verify SQL.
 * Opens the source read-only; writes only inside outDir. Returns the manifest.
 */
export function exportSqliteToPostgres({ dbPath, outDir, inserts = false, now = new Date(), migrationsDir = MIGRATIONS_DIR } = {}) {
  if (!dbPath) throw toolError('USAGE', '--db <platform.db> is required');
  if (!outDir) throw toolError('USAGE', '--out <directory> is required');
  const source = resolve(String(dbPath));
  const dir = resolve(String(outDir));
  if (!existsSync(source)) throw toolError('EXPORT_SOURCE_MISSING', `platform database not found: ${source}`);
  if (existsSync(dir) && readdirSync(dir).length) throw toolError('EXPORT_TARGET_NOT_EMPTY', `output directory is not empty: ${dir}`);

  // 1. The source must be a healthy platform database at exactly this build's versions:
  //    the migrations seed those versions on Postgres, and the server refuses any other.
  const verified = verifyPlatformDatabase(source);
  if (String(verified.schemaVersion) !== String(SCHEMA_VERSION) || String(verified.billingSchemaVersion) !== String(BILLING_SCHEMA_VERSION)) {
    throw toolError('EXPORT_SCHEMA_MISMATCH',
      `source is at schema ${verified.schemaVersion} / billing ${verified.billingSchemaVersion}; this build exports ${SCHEMA_VERSION} / ${BILLING_SCHEMA_VERSION}. ` +
      'Start the current server build once against a COPY of the file (it migrates SQLite in place), then export that copy.',
      { source: { schemaVersion: verified.schemaVersion, billingSchemaVersion: verified.billingSchemaVersion }, expected: { schemaVersion: SCHEMA_VERSION, billingSchemaVersion: BILLING_SCHEMA_VERSION } });
  }

  // 2. The table list and column lists come from the migrations themselves.
  const pgColumns = postgresColumns(migrationsDir);
  const EXPORT_TABLES = exportTables(migrationsDir);
  for (const seeded of SEEDED_TABLES) {
    if (!pgColumns.has(seeded)) throw toolError('EXPORT_MIGRATION_PARSE', `supabase/migrations no longer define pri.${seeded}`);
  }

  const db = new Database(source, { readonly: true, fileMustExist: true });
  db.defaultSafeIntegers(true); // every INTEGER comes back as a BigInt: exported digit-for-digit
  const files = [];
  const tables = [];
  let cursor;
  let auditLogMaxId = 0n;
  let emailsLowercased = 0;
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    // One read transaction: every table is read from the same snapshot.
    db.transaction(() => {
      const present = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => String(row.name)));
      for (const table of EXPORT_TABLES) {
        ident(table);
        const target = pgColumns.get(table);
        if (!present.has(table)) {
          tables.push({ name: table, present: false, sourceRows: 0, exportedRows: 0, columns: [], postgresOnlyColumns: target, file: null, sha256: null });
          continue;
        }
        const columns = db.pragma(`table_info('${table}')`).map(row => String(row.name));
        const unknown = columns.filter(column => !target.includes(column));
        if (unknown.length) throw toolError('EXPORT_COLUMN_UNKNOWN', `${table}.${unknown.join(', ')} exists in SQLite but not in the Postgres schema`);
        columns.forEach(ident);
        const postgresOnlyColumns = target.filter(column => !columns.includes(column));
        const sourceRows = Number(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n);
        const lines = [columns.join(',')];
        let exportedRows = 0;
        const orderBy = table === 'learning_events' ? ' ORDER BY server_cursor' : table === 'audit_log' ? ' ORDER BY id' : '';
        for (const row of db.prepare(`SELECT ${columns.join(',')} FROM ${table}${orderBy}`).iterate()) {
          if (table === 'accounts' && typeof row.email === 'string' && row.email !== row.email.toLowerCase()) {
            // Postgres: CHECK (email = lower(email)). SQLite's UNIQUE COLLATE NOCASE
            // already forbids two case-variants, so lowering cannot collide.
            row.email = row.email.toLowerCase();
            emailsLowercased++;
          }
          if (table === 'audit_log' && typeof row.id === 'bigint' && row.id > auditLogMaxId) auditLogMaxId = row.id;
          lines.push(columns.map(column => csvCell(row[column])).join(','));
          exportedRows++;
        }
        if (exportedRows !== sourceRows) throw toolError('EXPORT_ROW_COUNT_DRIFT', `${table}: counted ${sourceRows} rows, exported ${exportedRows}`);
        const csv = `${lines.join('\n')}\n`;
        const file = `${table}.csv`;
        writeFileSync(join(dir, file), csv, { mode: 0o600 });
        files.push({ file, bytes: Buffer.byteLength(csv), sha256: sha256(csv) });
        tables.push({ name: table, present: true, sourceRows, exportedRows, columns, postgresOnlyColumns, file, sha256: sha256(csv) });
      }
      const big = value => (typeof value === 'bigint' ? value : BigInt(value || 0));
      const sqliteCursor = present.has('sync_cursors') ? big(db.prepare('SELECT value FROM sync_cursors WHERE id = 1').get()?.value) : 0n;
      const maxEvents = present.has('learning_events') ? big(db.prepare('SELECT COALESCE(MAX(server_cursor), 0) AS v FROM learning_events').get().v) : 0n;
      const maxEntities = present.has('sync_entities') ? big(db.prepare('SELECT COALESCE(MAX(server_cursor), 0) AS v FROM sync_entities').get().v) : 0n;
      const liftTo = [sqliteCursor, maxEvents, maxEntities, 1n].reduce((a, b) => (a > b ? a : b));
      cursor = { sqliteValue: sqliteCursor.toString(), maxLearningEvents: maxEvents.toString(), maxSyncEntities: maxEntities.toString(), liftTo: liftTo.toString() };
    })();
  } finally {
    db.close();
  }

  const exportedTables = tables.filter(t => t.present);
  const importCopy = renderImportCopy({ exportedTables, cursor, auditLogMaxId });
  writeFileSync(join(dir, 'import-copy.sql'), importCopy, { mode: 0o600 });
  files.push({ file: 'import-copy.sql', bytes: Buffer.byteLength(importCopy), sha256: sha256(importCopy) });

  if (inserts) {
    const sql = renderImportInserts({ dir, exportedTables, cursor, auditLogMaxId });
    writeFileSync(join(dir, 'import-inserts.sql'), sql, { mode: 0o600 });
    files.push({ file: 'import-inserts.sql', bytes: Buffer.byteLength(sql), sha256: sha256(sql) });
  }

  const verify = renderVerify({ tables, cursor, auditLogMaxId });
  writeFileSync(join(dir, 'verify.sql'), verify, { mode: 0o600 });
  files.push({ file: 'verify.sql', bytes: Buffer.byteLength(verify), sha256: sha256(verify) });

  const manifest = {
    format: EXPORT_FORMAT,
    version: EXPORT_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    source: {
      path: source,
      bytes: statSync(source).size,
      integrity: verified.integrity,
      schemaVersion: String(verified.schemaVersion),
      billingSchemaVersion: String(verified.billingSchemaVersion),
      accounts: verified.accounts
    },
    target: { schema: 'pri', schemaVersion: String(SCHEMA_VERSION), billingSchemaVersion: String(BILLING_SCHEMA_VERSION) },
    tables,
    seededNotExported: [...SEEDED_TABLES],
    totals: {
      tables: EXPORT_TABLES.length,
      tableOrder: EXPORT_TABLES,
      tablesPresent: exportedTables.length,
      tablesAbsent: tables.filter(t => !t.present).map(t => t.name),
      rows: tables.reduce((sum, t) => sum + t.exportedRows, 0)
    },
    syncCursor: cursor,
    auditLogMaxId: auditLogMaxId.toString(),
    normalised: { accountEmailsLowercased: emailsLowercased },
    files
  };
  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  return { ok: true, outDir: dir, ...manifest };
}

// ── Rendering ────────────────────────────────────────────────────────────────

function preflightBlock({ exportedTables }) {
  const emptyChecks = exportedTables.map(t =>
    `  if (select count(*) from pri.${t.name}) <> 0 then raise exception 'IMPORT_TARGET_NOT_EMPTY: pri.${t.name} already holds rows'; end if;`
  ).join('\n');
  return `-- Preflight: the target must be the migrated, EMPTY schema at this build's versions.
do $$
begin
  if (select value from pri.platform_meta where key = 'schema_version') is distinct from '${SCHEMA_VERSION}'
     or (select value from pri.platform_meta where key = 'billing_schema_version') is distinct from '${BILLING_SCHEMA_VERSION}' then
    raise exception 'IMPORT_SCHEMA_MISMATCH: target is not at schema ${SCHEMA_VERSION} / billing ${BILLING_SCHEMA_VERSION}';
  end if;
${emptyChecks}
end $$;
`;
}

function postImportBlock({ cursor, auditLogMaxId }) {
  return `-- Cursor allocator: the sequence must start above every cursor the SQLite server ever handed out.
select setval('pri.sync_cursor_seq', greatest(
  (select case when is_called then last_value else last_value - 1 end from pri.sync_cursor_seq),
  ${cursor.liftTo},
  coalesce((select max(server_cursor) from pri.learning_events), 0),
  coalesce((select max(server_cursor) from pri.sync_entities), 0),
  1), true);
-- audit_log.id is GENERATED BY DEFAULT AS IDENTITY; continue above the imported ids.
select setval(pg_get_serial_sequence('pri.audit_log', 'id'), greatest(coalesce((select max(id) from pri.audit_log), 0), ${auditLogMaxId.toString()}, 1), true);
`;
}

function renderImportCopy({ exportedTables, cursor, auditLogMaxId }) {
  const copies = exportedTables.map(t =>
    `\\copy pri.${t.name} (${t.columns.join(', ')}) from '${t.file}' with (format csv, header true, null '')`
  ).join('\n');
  return `-- ${EXPORT_FORMAT} v${EXPORT_FORMAT_VERSION} · psql import script. Run from the export directory:
--   psql "$PRI_IMPORT_URL" -v ON_ERROR_STOP=1 -f import-copy.sql
-- as the migration owner (Supabase \`postgres\`), never as the server's login role.
-- One transaction: any failure rolls everything back and leaves the target empty.
\\set ON_ERROR_STOP on
begin;
${preflightBlock({ exportedTables })}
${copies}

${postImportBlock({ cursor, auditLogMaxId })}
commit;
`;
}

function renderImportInserts({ dir, exportedTables, cursor, auditLogMaxId }) {
  const out = [`-- ${EXPORT_FORMAT} v${EXPORT_FORMAT_VERSION} · plain-SQL import (no \\copy). Same transaction and preflight as import-copy.sql.`,
    'set standard_conforming_strings = on;', 'begin;', preflightBlock({ exportedTables })];
  for (const t of exportedTables) {
    if (!t.exportedRows) continue;
    const rows = parseCsvFile(join(dir, t.file), t.columns.length);
    for (let start = 0; start < rows.length; start += 500) {
      const chunk = rows.slice(start, start + 500).map(values => `  (${values.map(sqlLiteral).join(', ')})`).join(',\n');
      out.push(`insert into pri.${t.name} (${t.columns.join(', ')}) values\n${chunk};`);
    }
  }
  out.push(postImportBlock({ cursor, auditLogMaxId }), 'commit;', '');
  return out.join('\n');
}

function renderVerify({ tables, cursor, auditLogMaxId }) {
  const expected = tables.map(t => `  ('${t.name}', ${t.exportedRows})`).join(',\n');
  const actual = tables.map(t => `  select '${t.name}', count(*) from pri.${t.name}`).join(' union all\n');
  return `-- ${EXPORT_FORMAT} v${EXPORT_FORMAT_VERSION} · verification. Every row of query 1 must read ok; queries 2–5 must return true.
-- 1. Row counts (tables absent from the source are expected to be empty).
with expected (table_name, expected_rows) as (values
${expected}
), actual (table_name, actual_rows) as (
${actual}
)
select e.table_name, e.expected_rows, a.actual_rows,
       case when e.expected_rows = a.actual_rows then 'ok' else 'MISMATCH' end as result
from expected e join actual a using (table_name)
order by e.table_name;

-- 2. Versions the server build checks at boot.
select (select value from pri.platform_meta where key = 'schema_version') = '${SCHEMA_VERSION}'
   and (select value from pri.platform_meta where key = 'billing_schema_version') = '${BILLING_SCHEMA_VERSION}' as versions_ok;

-- 3. The cursor allocator is above every imported cursor (export saw max ${cursor.liftTo}).
select (case when is_called then last_value else last_value - 1 end) >= greatest(${cursor.liftTo},
         coalesce((select max(server_cursor) from pri.learning_events), 0),
         coalesce((select max(server_cursor) from pri.sync_entities), 0)) as cursor_sequence_ok
from pri.sync_cursor_seq;

-- 4. Every account email satisfies the Postgres CHECK.
select count(*) = 0 as emails_lowercase_ok from pri.accounts where email <> lower(email);

-- 5. audit_log identity continues above the imported ids (export saw max ${auditLogMaxId.toString()}).
select (select case when is_called then last_value else last_value - 1 end from pri.audit_log_id_seq)
       >= coalesce((select max(id) from pri.audit_log), 0) as audit_log_identity_ok;
`;
}

// ── CSV reading back (for --inserts and for the test) ────────────────────────

/**
 * Parse a CSV written by this tool: header + rows. Quoted fields are strings;
 * an unquoted empty field is null; unquoted integers are BigInt, unquoted
 * decimals Number; any other bare token (the header names) is a string.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let wasQuoted = false;
  let index = 0;
  const push = () => {
    row.push(wasQuoted ? field : field === '' ? null : /^-?\d+$/.test(field) ? BigInt(field) : /^-?\d*\.\d+(e[+-]?\d+)?$/i.test(field) ? Number(field) : field);
    field = '';
    wasQuoted = false;
  };
  while (index < text.length) {
    const ch = text[index];
    if (quoted) {
      if (ch === '"') {
        if (text[index + 1] === '"') { field += '"'; index += 2; continue; }
        quoted = false; index++; continue;
      }
      field += ch; index++; continue;
    }
    if (ch === '"') { quoted = true; wasQuoted = true; index++; continue; }
    if (ch === ',') { push(); index++; continue; }
    if (ch === '\n') { push(); rows.push(row); row = []; index++; continue; }
    field += ch; index++;
  }
  if (field !== '' || wasQuoted || row.length) { push(); rows.push(row); }
  return rows;
}

function parseCsvFile(path, width) {
  const rows = parseCsv(readFileSync(path, 'utf8'));
  const [, ...data] = rows;
  for (const row of data) if (row.length !== width) throw toolError('EXPORT_CSV_SHAPE', `${path}: row has ${row.length} fields, expected ${width}`);
  return data;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--db') options.dbPath = argv[++index];
    else if (arg === '--out') options.outDir = argv[++index];
    else if (arg === '--inserts') options.inserts = true;
    else throw toolError('USAGE', `unknown argument ${arg}`);
  }
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = exportSqliteToPostgres(parseArgs(process.argv.slice(2)));
    const summary = {
      ok: true,
      outDir: result.outDir,
      rows: result.totals.rows,
      tablesPresent: result.totals.tablesPresent,
      tablesAbsent: result.totals.tablesAbsent,
      syncCursorLiftTo: result.syncCursor.liftTo,
      accountEmailsLowercased: result.normalised.accountEmailsLowercased,
      files: result.files.map(f => f.file)
    };
    console.log(JSON.stringify(summary));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, code: error?.code || 'EXPORT_FAILED', message: error?.message || String(error) }));
    process.exit(1);
  }
}
