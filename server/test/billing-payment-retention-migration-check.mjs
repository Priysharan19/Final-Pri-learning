// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · billing schema v3 → v4 on a POPULATED SQLite database
//
// v4 rebuilds billing_payments so a payment outlives its account
// (account_id nullable, ON DELETE SET NULL). SQLite cannot alter a foreign key,
// so ensureBillingSchema copies every row into a new table inside one
// transaction. A rebuild that loses, duplicates or orphans a ledger row is a
// financial-record loss, so this proves on a real file, with real rows:
//   · every row and every column value survives, byte for byte;
//   · the foreign key is now ON DELETE SET NULL and account_id is nullable;
//   · the subscription index is recreated;
//   · a second run is a no-op (no rebuild, rows unchanged);
//   · foreign_key_check and integrity_check are clean;
//   · deleting an account afterwards keeps its payment with account_id NULL,
//     while other tables still cascade.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { createPlatformDb } from '../platform/db.js';
import { ensureBillingSchema, BILLING_SCHEMA_VERSION } from '../platform/billingSchema.js';

let checks = 0;
const check = (condition, message) => { checks++; assert.ok(condition, message); };

const scratch = mkdtempSync(join(tmpdir(), 'pri-billing-v4-'));
const path = join(scratch, 'platform.db');

try {
  // ── A v3 database, exactly as v3 created billing_payments ────────────────
  const v3 = createPlatformDb(path);
  v3.exec(`
    CREATE TABLE billing_payments (
      provider TEXT NOT NULL CHECK(provider IN ('apple','google','web')),
      payment_id TEXT NOT NULL,
      provider_subscription_id TEXT NOT NULL,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL DEFAULT 0,
      currency TEXT,
      status TEXT,
      captured_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(provider, payment_id)
    );
    CREATE INDEX idx_billing_payments_subscription
      ON billing_payments(provider, provider_subscription_id, captured_at);
  `);
  v3.prepare("INSERT OR REPLACE INTO platform_meta(key,value) VALUES ('billing_schema_version','3')").run();
  const addAccount = v3.prepare(`INSERT INTO accounts(id,email,name,password_hash,role,created_at,updated_at)
    VALUES (?,?,?,NULL,'student',1,1)`);
  const addPayment = v3.prepare(`INSERT INTO billing_payments(provider,payment_id,provider_subscription_id,account_id,amount,currency,status,captured_at,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  v3.transaction(() => {
    for (let a = 0; a < 25; a++) {
      addAccount.run(`acct_${a}`, `s${a}@example.test`, `Student ${a}`);
      v3.prepare('INSERT INTO entitlement_snapshots(account_id,plan,status,provider,source_version,updated_at) VALUES (?,\'free\',\'free\',\'none\',0,1)').run(`acct_${a}`);
      for (let p = 0; p < 8; p++) {
        addPayment.run(p % 2 ? 'web' : 'apple', `pay_${a}_${p}`, `sub_${a}`, `acct_${a}`, 99900 + p, p % 3 ? 'INR' : null,
          p % 4 ? 'captured' : null, 1_700_000_000_000 + p, 1_700_000_000_000 + a, 1_700_000_000_100 + p);
      }
    }
  })();
  const before = v3.prepare('SELECT * FROM billing_payments ORDER BY provider, payment_id').all();
  check(before.length === 200, 'fixture: 200 payment rows across 25 accounts');
  const fkBefore = v3.pragma("foreign_key_list('billing_payments')").find(r => r.from === 'account_id');
  check(fkBefore.on_delete === 'CASCADE', 'fixture: v3 cascades payments with the account');
  v3.close();

  // ── Migrate (what boot does) ─────────────────────────────────────────────
  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  check(ensureBillingSchema(db) === BILLING_SCHEMA_VERSION && BILLING_SCHEMA_VERSION === 5, 'ensureBillingSchema reports billing schema 5 (payment retention 4, then Google Play 5)');
  check(db.prepare("SELECT value FROM platform_meta WHERE key='billing_schema_version'").get().value === String(BILLING_SCHEMA_VERSION), 'platform_meta records the current billing schema');

  const after = db.prepare('SELECT * FROM billing_payments ORDER BY provider, payment_id').all();
  check(after.length === before.length, `row count preserved (${after.length})`);
  assert.deepEqual(after, before); checks++;
  const fk = db.pragma("foreign_key_list('billing_payments')").find(r => r.from === 'account_id');
  check(fk && fk.table === 'accounts' && fk.on_delete === 'SET NULL', 'the account foreign key is now ON DELETE SET NULL');
  const accountColumn = db.pragma("table_info('billing_payments')").find(c => c.name === 'account_id');
  check(accountColumn.notnull === 0, 'account_id is nullable');
  const pk = db.pragma("table_info('billing_payments')").filter(c => c.pk > 0).sort((x, y) => x.pk - y.pk).map(c => c.name).join();
  check(pk === 'provider,payment_id', 'the primary key is unchanged');
  const index = db.pragma("index_list('billing_payments')").find(i => i.name === 'idx_billing_payments_subscription');
  check(!!index, 'the subscription index is recreated');
  check(db.pragma("index_info('idx_billing_payments_subscription')").map(c => c.name).join() === 'provider,provider_subscription_id,captured_at', 'with the same columns');
  check(!db.prepare("SELECT 1 FROM sqlite_master WHERE name='billing_payments_v4'").get(), 'no scratch table is left behind');
  check(db.pragma('foreign_key_check').length === 0, 'foreign_key_check is clean');
  check(db.pragma('integrity_check', { simple: true }) === 'ok', 'integrity_check is ok');
  const sqlAfterFirst = db.prepare("SELECT sql FROM sqlite_master WHERE name='billing_payments'").get().sql;

  // ── Re-run is a no-op ─────────────────────────────────────────────────────
  ensureBillingSchema(db);
  check(db.prepare("SELECT sql FROM sqlite_master WHERE name='billing_payments'").get().sql === sqlAfterFirst, 'a second run does not rebuild the table');
  assert.deepEqual(db.prepare('SELECT * FROM billing_payments ORDER BY provider, payment_id').all(), before); checks++;

  // ── Deleting an account keeps its payments, unlinked ──────────────────────
  db.prepare('DELETE FROM accounts WHERE id=?').run('acct_7');
  const kept = db.prepare("SELECT * FROM billing_payments WHERE provider_subscription_id='sub_7'").all();
  check(kept.length === 8 && kept.every(r => r.account_id === null), 'deleting an account keeps its 8 payments with account_id NULL');
  check(kept.every(r => before.some(b => b.payment_id === r.payment_id && b.amount === r.amount)), 'with their amounts intact');
  check(!db.prepare("SELECT 1 FROM entitlement_snapshots WHERE account_id='acct_7'").get(), 'other account tables still cascade');
  check(db.prepare("SELECT COUNT(*) AS n FROM billing_payments WHERE account_id IS NOT NULL").get().n === 192, 'other accounts keep their linked payments');
  check(db.pragma('foreign_key_check').length === 0, 'foreign_key_check is still clean after deletion');
  db.close();

  // ── A fresh v4 database is built SET NULL directly ───────────────────────
  const fresh = createPlatformDb(':memory:');
  ensureBillingSchema(fresh);
  check(fresh.pragma("foreign_key_list('billing_payments')").find(r => r.from === 'account_id').on_delete === 'SET NULL', 'a fresh database starts at SET NULL');
  fresh.close();

  console.log(`BILLING PAYMENT RETENTION MIGRATION: PASS — ${checks}/${checks} checks — a populated v3 SQLite ledger rebuilds to v4 with every row intact, SET NULL, its index, clean integrity, an idempotent re-run, and payments that outlive their account.`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
