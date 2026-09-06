// Pri Learning server entry.
//
// The shipped learning experience remains local-first and can run without this
// process. `/v1` is the production cloud control plane for optional identity,
// sync, entitlements, classrooms, content publishing and support. The older
// `/api` routes are development-only reference code: app.js mounts them lazily
// outside production and the container image does not include them.
//
// This file owns the process: database, background workers, listening socket
// and shutdown. app.js owns the HTTP middleware chain, so tests can drive the
// exact production stack in-process.
import { writeSync } from 'node:fs';
import { closePlatformDb, platformDb } from './platform/db.js';
import { startAuthDeliveryWorker } from './platform/authDelivery.js';
import { startHousekeeping } from './platform/housekeeping.js';
import { createServerApp } from './app.js';

const app = await createServerApp(platformDb);

// The legacy /api store is development-only and is not shipped in the
// production image (see the Dockerfile and production-runtime-image-check),
// so it is resolved lazily and only outside production. Shutdown closes it
// when it exists; in production there is nothing to close.
let legacyDb = null;
if (process.env.NODE_ENV !== 'production') {
  try { ({ db: legacyDb } = await import('./db.js')); } catch { legacyDb = null; }
}

// Verification/reset tokens are persisted only as one-way hashes plus an
// AES-GCM delivery envelope. The worker decrypts a token only at the send
// boundary, uses provider idempotency, and never logs destinations or tokens.
const deliveryWorker = startAuthDeliveryWorker(platformDb);

// Expired sessions, tokens, idempotency keys, rate buckets and nonces are
// purged at startup and every six hours; /v1/health reports the last run.
startHousekeeping(platformDb);

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => console.log(`Pri Learning server running on port ${server.address().port}`));

// Graceful shutdown for the single-writer SQLite volume: stop taking requests,
// let in-flight responses finish, checkpoint the WAL into the main file and
// close the handle so backups see one complete database file. Container
// orchestrators send SIGTERM before SIGKILL; a hard deadline guarantees exit.
const SHUTDOWN_DEADLINE_MS = Number(process.env.PRI_SHUTDOWN_DEADLINE_MS) || 10_000;
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('platform_shutdown', { signal, deadlineMs: SHUTDOWN_DEADLINE_MS });
  deliveryWorker.stop();
  let finished = false;
  const finish = reason => {
    if (finished) return;
    finished = true;
    let exitCode = 0;
    // Written synchronously: process.exit() may drop buffered async stdout/stderr
    // writes on pipes, and this line is the operator's evidence of a clean stop.
    try {
      const result = closePlatformDb(platformDb);
      writeSync(1, `platform_db_closed ${JSON.stringify({ reason, closed: result.closed, checkpoint: result.checkpoint })}\n`);
    } catch (error) {
      exitCode = 1;
      writeSync(2, `platform_db_close_failed ${JSON.stringify({ reason, code: error?.code || 'CLOSE_FAILED' })}\n`);
    }
    try { if (legacyDb?.open) legacyDb.close(); } catch { /* legacy store is best-effort */ }
    process.exit(exitCode);
  };
  const deadline = setTimeout(() => finish('deadline'), SHUTDOWN_DEADLINE_MS);
  deadline.unref();
  server.closeIdleConnections?.();
  server.close(() => finish('drained'));
}
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
