// Pri Learning server entry.
//
// The shipped learning experience remains local-first and can run without this
// process. `/v1` is the production cloud control plane for optional identity,
// sync, entitlements, classrooms, content publishing and support. The older
// `/api` routes are retained temporarily for compatibility/reference and are not
// the specification for the production platform.
import express from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { existsSync, writeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authRouter } from './auth.js';
import { api } from './routes/api.js';
import { db as legacyDb } from './db.js';
import { closePlatformDb, platformDb } from './platform/db.js';
import { ensureBillingSchema } from './platform/billingSchema.js';
import { createAppleBilling } from './platform/appleBilling.js';
import { createRazorpayBilling } from './platform/razorpay.js';
import { createPlatformRouter } from './platform/router.js';
import { startAuthDeliveryWorker } from './platform/authDelivery.js';

const here = dirname(fileURLToPath(import.meta.url));
const app = express();
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(compression());
app.use(express.json({
  limit: '1mb',
  verify(req, res, buffer) {
    // Provider-specific billing webhook verifiers require the exact bytes. This
    // copy lives only for the request lifetime and is never logged/persisted.
    req.rawBody = Buffer.from(buffer);
  }
}));
app.use(cookieParser());

ensureBillingSchema(platformDb);
const webBilling = createRazorpayBilling(platformDb);
const appleBilling = createAppleBilling(platformDb);
app.use('/v1', createPlatformRouter(platformDb, {
  billingVerifiers: { ...webBilling.verifiers, ...appleBilling.verifiers },
  billingCheckout: webBilling.checkout,
  billingNative: appleBilling.native,
  billingLifecycle: webBilling.lifecycle
}));

// Verification/reset tokens are persisted only as one-way hashes plus an
// AES-GCM delivery envelope. The worker decrypts a token only at the send
// boundary, uses provider idempotency, and never logs destinations or tokens.
const deliveryWorker = startAuthDeliveryWorker(platformDb);

// Legacy routes: kept until old tooling no longer needs the historical server.
app.use('/api/auth', authRouter);
app.use('/api', api);

app.use((err, req, res, next) => {
  console.error('server_error', { method: req.method, path: req.path, status: err?.status || 500, code: err?.code || 'INTERNAL' });
  if (res.headersSent) return next(err);
  res.status(err?.status || 500).json({ error: 'Something went wrong on the server.' });
});

const dist = join(here, '..', 'client', 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/(?:api|v1)).*/, (req, res) => res.sendFile(join(dist, 'index.html')));
}

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
    try { if (legacyDb.open) legacyDb.close(); } catch { /* legacy store is best-effort */ }
    process.exit(exitCode);
  };
  const deadline = setTimeout(() => finish('deadline'), SHUTDOWN_DEADLINE_MS);
  deadline.unref();
  server.closeIdleConnections?.();
  server.close(() => finish('drained'));
}
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
