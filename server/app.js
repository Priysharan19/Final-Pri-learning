// Pri Learning HTTP application assembly.
//
// index.js is the process entry (database, workers, listen); this module builds
// the Express app so tests can drive the exact production middleware chain
// in-process against an in-memory database. In production the legacy /api
// Express stack is never imported: the modules are loaded lazily and only for
// local development, and the container image does not ship them at all.
import express from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureBillingSchema } from './platform/billingSchema.js';
import { createAppleBilling } from './platform/appleBilling.js';
import { createRazorpayBilling } from './platform/razorpay.js';
import { createPlatformRouter } from './platform/router.js';
import { trustedProxyHops } from './platform/config.js';
import { securityHeaders } from './platform/headers.js';

const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DIST = join(here, '..', 'client', 'dist');
const REQUEST_ID = /^[A-Za-z0-9._:-]{1,80}$/;
/**
 * The one transport limit every route lives inside. Anything that quotes a
 * larger ceiling of its own is quoting a limit the body parser will reach first
 * — see MAX_IMAGE_BYTES in platform/handwritingProvider.js.
 */
export const JSON_BODY_LIMIT = '1mb';
export const JSON_BODY_LIMIT_BYTES = 1024 * 1024;

export function requestLogger(log = line => console.log(JSON.stringify(line))) {
  return (req, res, next) => {
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const requestId = req.get('x-pri-request-id');
      // Method, route path, status and latency only: no query strings, bodies,
      // cookies, IPs, user agents or account identifiers ever reach the log.
      log({
        ts: new Date().toISOString(),
        method: req.method,
        path: String(req.originalUrl || req.url || '').split('?', 1)[0].slice(0, 200),
        status: res.statusCode,
        ms: Number(process.hrtime.bigint() - started) / 1e6,
        ...(requestId && REQUEST_ID.test(requestId) ? { requestId } : {})
      });
    });
    next();
  };
}

export async function createServerApp(db, {
  production = process.env.NODE_ENV === 'production',
  dist = DEFAULT_DIST,
  legacy = !production,
  requestLog = true,
  log
} = {}) {
  const app = express();
  // How much of X-Forwarded-For to believe is deployment configuration with no
  // default, because req.ip is the identity the anonymous rate limiters count
  // against: trusting one hop too many lets a client pick its own identity and
  // walk past them, one too few puts every user in one bucket. Production will
  // not start without PRI_TRUSTED_PROXY_HOPS; development trusts nothing.
  if (production) app.set('trust proxy', trustedProxyHops());
  app.disable('x-powered-by');
  app.use(securityHeaders({ production }));
  if (requestLog) app.use(requestLogger(log));
  app.use(compression());
  app.use(express.json({
    limit: JSON_BODY_LIMIT,
    verify(req, res, buffer) {
      // Provider-specific billing webhook verifiers require the exact bytes. This
      // copy lives only for the request lifetime and is never logged/persisted.
      req.rawBody = Buffer.from(buffer);
    }
  }));
  app.use(cookieParser());

  ensureBillingSchema(db);
  const webBilling = createRazorpayBilling(db);
  const appleBilling = createAppleBilling(db);
  app.use('/v1', createPlatformRouter(db, {
    billingVerifiers: { ...webBilling.verifiers, ...appleBilling.verifiers },
    billingCheckout: webBilling.checkout,
    billingNative: appleBilling.native,
    billingLifecycle: webBilling.lifecycle
  }));

  if (legacy && !production) {
    // Local development only: the historical account API that predates /v1.
    const [{ authRouter }, { api }] = await Promise.all([import('./auth.js'), import('./routes/api.js')]);
    app.use('/api/auth', authRouter);
    app.use('/api', api);
  } else {
    app.use('/api', (req, res) => {
      res.status(410).json({ error: { code: 'LEGACY_API_REMOVED', message: 'The legacy API is not available. Use /v1.' } });
    });
  }

  app.use((err, req, res, next) => {
    console.error('server_error', { method: req.method, path: req.path, status: err?.status || 500, code: err?.code || 'INTERNAL' });
    if (res.headersSent) return next(err);
    // An over-large body dies in the parser before any route sees it, so this is
    // the only place that can say so. It gets a real code: "shrink the picture
    // and send it again" is something the iPad can act on, and it is a different
    // instruction from "the server broke", which is what an uncoded 413 reads as.
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({
        error: { code: 'REQUEST_BODY_TOO_LARGE', message: `The request body is larger than the ${JSON_BODY_LIMIT} limit.` }
      });
    }
    res.status(err?.status || 500).json({ error: 'Something went wrong on the server.' });
  });

  if (dist && existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^(?!\/(?:api|v1)).*/, (req, res) => res.sendFile(join(dist, 'index.html')));
  }

  return app;
}
