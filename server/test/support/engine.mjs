// One test store on either engine.
//
//   node server/test/<suite>.mjs                    → SQLite (in memory)
//   node server/test/<suite>.mjs --engine=postgres  → Postgres (scripts/with-postgres.mjs)
//
// On Postgres the suite gets its own scratch database with supabase/migrations
// applied, and connects as a LOGIN role that is only a member of pri_server —
// exactly the privileges the Railway service has — so a handler that needs a
// grant the migration does not give fails here, not in production.

import { createPlatformDb } from '../../platform/db.js';
import { ensureBillingSchema } from '../../platform/billingSchema.js';
import { ensureAuthDeliverySchema } from '../../platform/authDelivery.js';
import { asStore, createPostgresStore } from '../../platform/store.js';

export function requestedEngine(argv = process.argv) {
  const flag = argv.find(arg => arg.startsWith('--engine='));
  const engine = flag ? flag.slice('--engine='.length) : 'sqlite';
  if (!['sqlite', 'postgres'].includes(engine)) throw new Error(`Unknown engine ${engine}`);
  return engine;
}

export async function openTestStore(engine = requestedEngine(), { label = 'suite', max } = {}) {
  if (engine === 'sqlite') {
    const raw = createPlatformDb(':memory:');
    ensureAuthDeliverySchema(raw);
    ensureBillingSchema(raw);
    const store = asStore(raw);
    return { engine, store, raw, url: null, async close() { if (raw.open) raw.close(); } };
  }
  const { scratchDatabase, serverRoleUrl } = await import('./postgres.mjs');
  const scratch = await scratchDatabase(label);
  const url = await serverRoleUrl(scratch.name);
  let store;
  try {
    store = await createPostgresStore(url, { max });
  } catch (error) {
    await scratch.drop();
    throw error;
  }
  return {
    engine,
    store,
    raw: null,
    url,
    scratch,
    async close() {
      await store.close();
      await scratch.drop();
    }
  };
}
