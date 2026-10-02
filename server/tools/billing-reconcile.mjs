#!/usr/bin/env node
// Operator CLI: recompute one account's App Store entitlement from the
// Apple-signed data the server stored, and report drift. Read-only; it never
// writes to the database and never contacts Apple.
//
//   PRI_PLATFORM_DB=/data/pri-learning-platform.db node server/tools/billing-reconcile.mjs --account <account id> [--unbound]
//   PRI_DATABASE_URL=postgres://… node server/tools/billing-reconcile.mjs --account <account id> [--unbound]
//   … --evidence apple-history.json   (owner-fetched Apple signed data, see the runbook)
//
// --evidence takes a JSON file { "signedTransactions": [...], "signedPayloads": [...] }
// holding what the owner fetched from the App Store Server API (Get Transaction
// History, Get Notification History). It is verified and replayed with the
// stored data for the report only; this tool still writes nothing.
//
// Needs the same Apple trust configuration as the server (PRI_APPLE_ROOT_CA_PEM
// or PRI_APPLE_ROOT_CA_FILE, PRI_APPLE_BUNDLE_ID, PRI_APPLE_APP_ID, product ids
// and environments) so every stored JWS is re-verified, not trusted.
// Exit status: 0 no drift, 2 drift found, 1 the tool could not run.
// See docs/operations/billing-reconciliation.md.
import { closePlatformStore } from '../platform/db.js';
import { openPlatformStore } from '../platform/store.js';
import { readFileSync } from 'node:fs';
import { reconcileAppleAccount } from '../platform/billingReconcile.js';

const args = process.argv.slice(2);
const at = args.indexOf('--account');
const accountId = at >= 0 ? String(args[at + 1] || '') : '';
if (!accountId) {
  console.error('usage: node server/tools/billing-reconcile.mjs --account <account id> [--unbound] [--evidence <file.json>]');
  process.exit(1);
}

let store;
try {
  const ev = args.indexOf('--evidence');
  const evidence = ev >= 0 ? JSON.parse(readFileSync(String(args[ev + 1] || ''), 'utf8')) : null;
  store = await openPlatformStore();
  const report = await reconcileAppleAccount(store, accountId, { includeUnbound: args.includes('--unbound'), evidence });
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ok ? 0 : 2;
} catch (error) {
  console.error(JSON.stringify({ ok: false, code: error?.code || 'RECONCILE_FAILED', message: error?.message || String(error) }));
  process.exitCode = 1;
} finally {
  if (store) await closePlatformStore(store);
}
