export const BILLING_SCHEMA_VERSION = 1;

/**
 * Billing is an optional deployment subsystem, so its schema is versioned
 * independently from the core account/sync database. The migration is
 * idempotent and runs before any provider adapter is constructed.
 */
export function ensureBillingSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS billing_subscriptions (
      provider TEXT NOT NULL CHECK(provider IN ('apple','google','web')),
      provider_subscription_id TEXT NOT NULL,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      cadence TEXT CHECK(cadence IN ('monthly','annual') OR cadence IS NULL),
      trial_claimed INTEGER NOT NULL DEFAULT 0 CHECK(trial_claimed IN (0,1)),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_effective_at INTEGER NOT NULL DEFAULT 0,
      last_event_rank INTEGER NOT NULL DEFAULT 0,
      last_event_id TEXT,
      PRIMARY KEY(provider, provider_subscription_id)
    );
    CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_account
      ON billing_subscriptions(account_id, provider, created_at);

    -- One row is the server-side authority for introductory trial eligibility.
    -- A provider request with an ambiguous outcome keeps its reservation: it is
    -- safer to require support to release one trial than to manufacture two.
    CREATE TABLE IF NOT EXISTS billing_trial_claims (
      account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK(provider IN ('apple','google','web')),
      provider_subscription_id TEXT NOT NULL,
      claimed_at INTEGER NOT NULL
    );
  `);
  db.prepare("INSERT OR REPLACE INTO platform_meta(key,value) VALUES ('billing_schema_version',?)")
    .run(String(BILLING_SCHEMA_VERSION));
  return BILLING_SCHEMA_VERSION;
}
