import { Router } from 'express';
import { id, rateLimit, requireSession } from './security.js';

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

function ensureTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS operational_events (
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
  ensureTable(db);
  const router = Router();
  router.use(requireSession(db));

  router.post('/', rateLimit(db, 'telemetry', { limit: 120, windowMs: 60 * 1000 }), (req, res) => {
    const list = Array.isArray(req.body?.events) ? req.body.events : [req.body?.event].filter(Boolean);
    if (!list.length || list.length > MAX_BATCH) return res.status(400).json({ error: { code: 'TELEMETRY_BATCH_INVALID', message: `Send between 1 and ${MAX_BATCH} events.` } });
    const now = Date.now();
    const events = list.map(raw => cleanEvent(raw, now));
    db.transaction(() => {
      const insert = db.prepare(`INSERT INTO operational_events(id,account_id,event_type,surface,metadata_json,created_at) VALUES (?,?,?,?,?,?)`);
      for (const event of events) {
        insert.run(event.id, req.platformSession.account_id, event.type, event.surface, JSON.stringify(event.metadata), event.at);
      }
      // Retention is enforced continuously rather than relying on an external
      // cron job that may never be configured on a small deployment.
      db.prepare('DELETE FROM operational_events WHERE created_at < ?').run(now - RETENTION_MS);
    })();
    res.status(202).json({ accepted: events.length });
  });

  return router;
}

export const TELEMETRY_EVENT_TYPES = Object.freeze([...EVENTS]);
