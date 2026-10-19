import { asyncRouter } from './asyncRouter.js';
import { asStore, sqliteHandle } from './store.js';
import { id, rateLimit, requireSession } from './security.js';
import { captureError } from './errorSink.js';
import { recordClientError } from './metrics.js';
import { logEvent } from './observability.js';
import { releaseShaForLogs } from './releaseIdentity.js';

const EVENTS = new Set([
  'client-error', 'sync-failure', 'api-failure', 'recognition-failure',
  'bad-question-opened', 'exam-completed', 'feature-used', 'trial-started',
  'subscription-state', 'performance-sample'
]);
const META_KEYS = new Set([
  'code', 'surface', 'feature', 'track', 'grade', 'questionType', 'mode',
  'durationMs', 'status', 'provider', 'network', 'version', 'build', 'scope'
]);
const MAX_BATCH = 30;
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

// ── Crash reports (ledger 1.7) ───────────────────────────────────────────────
// POST /v1/telemetry/error is what the web ErrorBoundary and the native shells
// send when a render or the shell itself fails. It is a CODED report: the
// platform, a surface slug the client chose from its own route names, a
// closed error code, a scope and a short hex fingerprint the client computed
// from the error — never the message, the stack, the URL, the component tree
// or anything typed. Any other field is dropped; a report that carries free
// text in a known field is refused as a whole (TELEMETRY_ERROR_INVALID).
// Gated like the rest of telemetry: a session, guardian consent for a child's
// account (router.js), and the device's own crash-report preference (client).
export const CLIENT_PLATFORMS = Object.freeze(['web', 'ios-shell', 'android-shell']);
export const ERROR_SCOPES = Object.freeze(['app', 'route', 'shell', 'worker']);
export const ERROR_REPORT_RATE_LIMIT = Object.freeze({ limit: 20, windowMs: 10 * 60 * 1000 });
const ERROR_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;
const SURFACE = /^[a-z][a-z0-9-]{0,39}$/;
const FINGERPRINT = /^[a-f0-9]{8,32}$/;
const RELEASE = /^[0-9a-f]{7,40}$/;

/** The validated report, or a coded refusal. Exported for the contract test. */
export function cleanErrorReport(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, code: 'TELEMETRY_ERROR_INVALID', message: 'An error report must be an object.' };
  const platform = String(raw.platform || '');
  const code = String(raw.code || '');
  const surface = String(raw.surface || '');
  const scope = String(raw.scope || 'route');
  const fingerprint = raw.fingerprint == null ? null : String(raw.fingerprint);
  const release = raw.release == null ? null : String(raw.release).toLowerCase();
  if (!CLIENT_PLATFORMS.includes(platform)) return { ok: false, code: 'TELEMETRY_ERROR_INVALID', message: 'platform must be web, ios-shell or android-shell.' };
  if (!ERROR_CODE.test(code)) return { ok: false, code: 'TELEMETRY_ERROR_INVALID', message: 'code must be an upper-case error code.' };
  if (!SURFACE.test(surface)) return { ok: false, code: 'TELEMETRY_ERROR_INVALID', message: 'surface must be a short lower-case slug.' };
  if (!ERROR_SCOPES.includes(scope)) return { ok: false, code: 'TELEMETRY_ERROR_INVALID', message: 'scope must be app, route, shell or worker.' };
  if (fingerprint !== null && !FINGERPRINT.test(fingerprint)) return { ok: false, code: 'TELEMETRY_ERROR_INVALID', message: 'fingerprint must be 8-32 hex characters.' };
  if (release !== null && !RELEASE.test(release)) return { ok: false, code: 'TELEMETRY_ERROR_INVALID', message: 'release must be a commit SHA.' };
  const at = Number.isFinite(Number(raw.at)) ? Math.max(now - 7 * 24 * 60 * 60 * 1000, Math.min(now + 5 * 60 * 1000, Number(raw.at))) : now;
  return { ok: true, report: { platform, code, surface, scope, fingerprint, release, at } };
}

function ensureTable(db) {
  // SQLite builds its schema at boot; Postgres is migrated (supabase/migrations).
  const raw = sqliteHandle(db);
  if (!raw) return;
  raw.exec(`CREATE TABLE IF NOT EXISTS operational_events (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    surface TEXT,
    metadata_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_operational_events_account_time ON operational_events(account_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_operational_events_type_time ON operational_events(event_type, created_at);`);
}

function scalar(value) {
  if (value == null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return value.slice(0, 120);
  return undefined;
}

function cleanMetadata(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!META_KEYS.has(key)) continue;
    const safe = scalar(value);
    if (safe !== undefined) out[key] = safe;
  }
  return out;
}

function cleanEvent(raw, now) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Object.assign(new Error('Telemetry event must be an object.'), { status: 400, code: 'TELEMETRY_INVALID' });
  const type = String(raw.type || '');
  if (!EVENTS.has(type)) throw Object.assign(new Error('Telemetry event type is not allowed.'), { status: 400, code: 'TELEMETRY_EVENT_UNSUPPORTED' });
  const surface = raw.surface == null ? null : String(raw.surface).slice(0, 80);
  const at = Number.isFinite(Number(raw.at)) ? Math.max(now - 7 * 24 * 60 * 60 * 1000, Math.min(now + 5 * 60 * 1000, Number(raw.at))) : now;
  const metadata = cleanMetadata(raw.metadata);
  return { id: id('op'), type, surface, at, metadata };
}

export function createTelemetryRouter(db) {
  db = asStore(db);
  ensureTable(db);
  const router = asyncRouter();
  router.use(requireSession(db));

  router.post('/', rateLimit(db, 'telemetry', { limit: 120, windowMs: 60 * 1000 }), async (req, res) => {
    const list = Array.isArray(req.body?.events) ? req.body.events : [req.body?.event].filter(Boolean);
    if (!list.length || list.length > MAX_BATCH) return res.status(400).json({ error: { code: 'TELEMETRY_BATCH_INVALID', message: `Send between 1 and ${MAX_BATCH} events.` } });
    const now = Date.now();
    const events = list.map(raw => cleanEvent(raw, now));
    await db.transaction(async () => {
      for (const event of events) {
        await db.run(`INSERT INTO operational_events(id,account_id,event_type,surface,metadata_json,created_at) VALUES (?,?,?,?,?,?)`,
          [event.id, req.platformSession.account_id, event.type, event.surface, JSON.stringify(event.metadata), event.at]);
      }
      // Retention is enforced continuously rather than relying on an external
      // cron job that may never be configured on a small deployment.
      await db.run('DELETE FROM operational_events WHERE created_at < ?', [now - RETENTION_MS]);
    });
    res.status(202).json({ accepted: events.length });
  });

  router.post('/error', rateLimit(db, 'telemetry-error', ERROR_REPORT_RATE_LIMIT), async (req, res) => {
    const checked = cleanErrorReport(req.body, Date.now());
    if (!checked.ok) return res.status(400).json({ error: { code: checked.code, message: checked.message } });
    const { report } = checked;
    const accountId = req.platformSession.account_id;
    await db.transaction(async () => {
      await db.run(`INSERT INTO operational_events(id,account_id,event_type,surface,metadata_json,created_at) VALUES (?,?,?,?,?,?)`,
        [id('op'), accountId, 'client-error', report.surface, JSON.stringify({
          code: report.code, scope: report.scope, platform: report.platform,
          ...(report.fingerprint ? { fingerprint: report.fingerprint } : {}),
          ...(report.release ? { build: report.release.slice(0, 12) } : {})
        }), report.at]);
      await db.run('DELETE FROM operational_events WHERE created_at < ?', [Date.now() - RETENTION_MS]);
    });
    recordClientError(report.platform, report.code);
    // The report, as a coded line and as a sink event: request id, the
    // SERVER release that received it, the route template, the code, the
    // platform, the surface and the fingerprint. The client's own release is
    // kept in the stored row (build), not on the log line, where `release`
    // is this server's SHA by contract.
    const fields = {
      requestId: req.requestId, release: releaseShaForLogs(), route: '/v1/telemetry/error', method: 'POST',
      code: report.code, source: 'client', platform: report.platform, surface: report.surface,
      ...(report.fingerprint ? { fingerprint: report.fingerprint } : {})
    };
    logEvent('warn', 'client_error', fields);
    captureError(fields);
    res.status(202).json({ accepted: 1 });
  });

  return router;
}

export const TELEMETRY_EVENT_TYPES = Object.freeze([...EVENTS]);
