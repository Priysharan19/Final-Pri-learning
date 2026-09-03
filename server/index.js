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
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authRouter } from './auth.js';
import { api } from './routes/api.js';
import { platformDb } from './platform/db.js';
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
  billingNative: appleBilling.native
}));

// Verification/reset tokens are persisted only as one-way hashes plus an
// AES-GCM delivery envelope. The worker decrypts a token only at the send
// boundary, uses provider idempotency, and never logs destinations or tokens.
startAuthDeliveryWorker(platformDb);

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
app.listen(PORT, () => console.log(`Pri Learning server running on port ${PORT}`));