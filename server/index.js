// Pri Learning server entry.
//
// The shipped learning experience remains local-first and can run without this
// process. `/v1` is the production cloud control plane for optional identity,
// sync, entitlements, classrooms, content publishing and support. The older
// `/api` routes are development-only reference code: app.js mounts them lazily
// outside production and the container image does not include them.
import { platformDb } from './platform/db.js';
import { startAuthDeliveryWorker } from './platform/authDelivery.js';
import { startHousekeeping } from './platform/housekeeping.js';
import { createServerApp } from './app.js';

const app = await createServerApp(platformDb);

// Verification/reset tokens are persisted only as one-way hashes plus an
// AES-GCM delivery envelope. The worker decrypts a token only at the send
// boundary, uses provider idempotency, and never logs destinations or tokens.
startAuthDeliveryWorker(platformDb);

// Expired sessions, tokens, idempotency keys, rate buckets and nonces are
// purged at startup and every six hours; /v1/health reports the last run.
startHousekeeping(platformDb);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Pri Learning server running on port ${PORT}`));
