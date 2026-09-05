#!/usr/bin/env node
// Operator CLI: run one housekeeping pass on the configured platform database
// and print the purge summary as JSON.
//
//   PRI_PLATFORM_DB=/data/pri-learning-platform.db node server/tools/housekeeping.mjs
import { platformDb } from '../platform/db.js';
import { runHousekeeping } from '../platform/housekeeping.js';

try {
  console.log(JSON.stringify(runHousekeeping(platformDb)));
} finally {
  platformDb.close();
}
