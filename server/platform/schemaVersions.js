// The /v1 schema versions this server build is written against.
//
// One module with no imports, so the SQLite schema builders (db.js,
// billingSchema.js) and the Postgres store (store.js) read the same numbers
// without an import cycle. SQLite writes them into platform_meta when it builds
// its schema; on Postgres supabase/migrations writes them and the store refuses
// to boot unless they match exactly (PLATFORM_DB_SCHEMA_MISMATCH).
export const SCHEMA_VERSION = 6;
export const BILLING_SCHEMA_VERSION = 3;
