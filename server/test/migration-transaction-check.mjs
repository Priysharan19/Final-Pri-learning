// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · every Supabase migration is its own transaction
//
// `supabase db push` sends a migration file's statements one by one and does
// NOT wrap the file in a transaction. Found on staging (2026-10-02): the
// sync-cursor migration opened with `lock table …`, which Postgres refuses
// outside a transaction block (25P01), and a failure part-way through any
// unwrapped file would have left it half-applied. So every file under
// supabase/migrations must:
//   · open with `begin;` as its first statement and close with `commit;` as its
//     last, with no other top-level transaction control in between;
//   · avoid statements that cannot run inside a transaction (CONCURRENTLY,
//     VACUUM, CREATE/DROP DATABASE, ALTER SYSTEM).
// The Postgres test harness applies each file as-is (no wrapper), so a file that
// relies on an outer transaction fails there too.
//
// Run: node server/test/migration-transaction-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url));
let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

/** Top-level statements: comments, quoted strings and dollar-quoted bodies removed. */
export function topLevelStatements(sql) {
  let out = '';
  for (let i = 0; i < sql.length;) {
    if (sql.startsWith('--', i)) { const e = sql.indexOf('\n', i); i = e < 0 ? sql.length : e; continue; }
    if (sql.startsWith('/*', i)) { const e = sql.indexOf('*/', i + 2); i = e < 0 ? sql.length : e + 2; continue; }
    const dollar = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
    if (dollar) { const e = sql.indexOf(dollar[0], i + dollar[0].length); out += ' $body$ '; i = e < 0 ? sql.length : e + dollar[0].length; continue; }
    if (sql[i] === "'") { let j = i + 1; while (j < sql.length && !(sql[j] === "'" && sql[j + 1] !== "'")) j += sql[j] === "'" ? 2 : 1; out += " 'str' "; i = j + 1; continue; }
    out += sql[i++];
  }
  return out.split(';').map(s => s.replace(/\s+/g, ' ').trim().toLowerCase()).filter(Boolean);
}

export function checkMigration(name, sql) {
  const problems = [];
  const stmts = topLevelStatements(sql);
  if (stmts[0] !== 'begin') problems.push(`${name}: first statement must be "begin;" (found "${(stmts[0] || '').slice(0, 40)}")`);
  if (stmts[stmts.length - 1] !== 'commit') problems.push(`${name}: last statement must be "commit;"`);
  const control = stmts.slice(1, -1).filter(s => /^(begin|commit|rollback|end|start transaction|abort)\b/.test(s));
  if (control.length) problems.push(`${name}: transaction control inside the file: ${control.join(', ')}`);
  const forbidden = stmts.filter(s => /\bconcurrently\b|^vacuum\b|^(create|drop) database\b|^alter system\b/.test(s));
  if (forbidden.length) problems.push(`${name}: cannot run inside a transaction: ${forbidden.map(s => s.slice(0, 50)).join(', ')}`);
  return problems;
}

const files = readdirSync(DIR).filter(f => f.endsWith('.sql')).sort();
ok(files.length >= 2, 'the repository has Supabase migrations to check');
for (const f of files) {
  const problems = checkMigration(f, readFileSync(join(DIR, f), 'utf8'));
  ok(problems.length === 0, problems.join('; ') || f);
}

// The checker itself must catch the defect it exists for.
const staged = '-- header\nlock table pri.sync_cursors in exclusive mode;\ncreate sequence s;\n';
ok(checkMigration('unwrapped', staged).length > 0, 'an unwrapped file opening with LOCK TABLE is refused (the staging defect)');
ok(checkMigration('nocommit', 'begin;\ncreate table t(a int);\n').length > 0, 'a file without a final commit is refused');
ok(checkMigration('midcommit', 'begin;\ncreate table t(a int);\ncommit;\nbegin;\ncreate table u(a int);\ncommit;\n').length > 0, 'a second transaction inside one file is refused');
ok(checkMigration('concurrently', 'begin;\ncreate index concurrently i on t(a);\ncommit;\n').length > 0, 'CREATE INDEX CONCURRENTLY is refused');
ok(checkMigration('dollar', "begin;\ndo $$ begin perform 1; end $$;\ncomment on table t is 'a; commit; b';\ncommit;\n").length === 0, 'begin/commit inside a DO body or a string literal is not mistaken for transaction control');

if (failures.length) {
  console.error(`MIGRATION TRANSACTIONS: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`MIGRATION TRANSACTIONS: PASS — ${pass}/${pass} checks — every Supabase migration opens and commits its own transaction, as \`supabase db push\` requires.`);
