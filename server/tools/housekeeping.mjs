#!/usr/bin/env node
// Operator CLI: run one housekeeping pass on the configured platform database
// and print the purge summary as JSON.
//
//   PRI_PLATFORM_DB=/data/pri-learning-platform.db node server/tools/housekeeping.mjs
//   PRI_DATABASE_URL=postgres://… node server/tools/housekeeping.mjs
import { closePlatformStore } from '../platform/db.js';
import { openPlatformStore } from '../platform/store.js';
import { runHousekeeping } from '../platform/housekeeping.js';

const store = await openPlatformStore();
try {
  console.log(JSON.stringify(await runHousekeeping(store)));
} finally {
  await closePlatformStore(store);
}
