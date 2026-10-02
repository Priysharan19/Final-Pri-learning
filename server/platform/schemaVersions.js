// The /v1 schema versions this server build is written against.
//
// One module with no imports, so the SQLite schema builders (db.js,
// billingSchema.js) and the Postgres store (store.js) read the same numbers
// without an import cycle. SQLite writes them into platform_meta when it builds
// its schema; on Postgres supabase/migrations writes them and the store refuses
// to boot unless they match exactly (PLATFORM_DB_SCHEMA_MISMATCH).
// 7: sync cursors on Postgres come from pri.sync_cursor_seq and the server can
//    no longer write pri.sync_cursors (supabase/migrations/20261002000000).
//    No SQLite structural change: SQLite still allocates from sync_cursors.
// 8: tutor_cache, the 24-hour AI tutor reply cache
//    (supabase/migrations/20261002010000_tutor_cache.sql). SQLite creates the
//    same table in tutor.js, as it does every lazily built table.
export const SCHEMA_VERSION = 8;
// Billing 4: billing_payments keeps its row when the account is deleted
//    (ON DELETE SET NULL, account_id nullable) — the payment ledger is retained
//    pseudonymously (supabase/migrations/20261003000000, billingSchema.js).
// Billing 5: per-subscription lifecycle state on billing_subscriptions and the
//    verified Apple signed-data ledger billing_apple_signed_events
//    (supabase/migrations/20261003010000_storekit_entitlement_state.sql).
export const BILLING_SCHEMA_VERSION = 5;
