import { Router } from 'express';
import { nextSyncCursor } from './db.js';
import { id, rateLimit, requireSession } from './security.js';

const SCHEMA = 1;
const MAX_PUSH = 100;
const MAX_PULL = 500;
const ID = /^[A-Za-z0-9._:-]{1,160}$/;
const CLIENT_ENTITY = new Set(['profile', 'settings', 'bookmark', 'favorite', 'task', 'custom-question']);
const APPEND_EVENT = new Set(['practice-progress', 'practice-attempt', 'exam-attempt', 'rush-history', 'match-history', 'task-completion', 'mastery-observation']);

function plain(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function parseJson(value, fallback = {}) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function cleanEvent(raw, deviceId) {
  if (!plain(raw) || !ID.test(String(raw.id || '')) || !ID.test(String(raw.kind || '')) || !APPEND_EVENT.has(raw.kind)) throw Object.assign(new Error('Invalid learning event.'), { status: 400, code: 'SYNC_EVENT_INVALID' });
  if (String(raw.deviceId || '') !== deviceId) throw Object.assign(new Error('Event device does not match sync device.'), { status: 400, code: 'SYNC_DEVICE_MISMATCH' });
  if (!Number.isSafeInteger(raw.deviceSeq) || raw.deviceSeq <= 0) throw Object.assign(new Error('Event sequence is invalid.'), { status: 400, code: 'SYNC_SEQUENCE_INVALID' });
  if (raw.entityId != null && !ID.test(String(raw.entityId))) throw Object.assign(new Error('Event entity id is invalid.'), { status: 400, code: 'SYNC_EVENT_INVALID' });
  if (!plain(raw.payload || {})) throw Object.assign(new Error('Event payload is invalid.'), { status: 400, code: 'SYNC_EVENT_INVALID' });
  const payload = JSON.stringify(raw.payload || {});
  if (Buffer.byteLength(payload) > 256 * 1024) throw Object.assign(new Error('Event payload is too large.'), { status: 413, code: 'SYNC_EVENT_TOO_LARGE' });
  return { id: String(raw.id), deviceId, deviceSeq: raw.deviceSeq, kind: raw.kind, entityId: raw.entityId == null ? null : String(raw.entityId), occurredAt: Number.isFinite(raw.occurredAt) ? Math.max(0, Math.floor(raw.occurredAt)) : null, payload };
}

function cleanEntity(raw) {
  if (!plain(raw) || !CLIENT_ENTITY.has(raw.kind) || !ID.test(String(raw.entityId || ''))) throw Object.assign(new Error('Invalid sync entity.'), { status: 400, code: 'SYNC_ENTITY_INVALID' });
  if (!['upsert', 'delete'].includes(raw.operation)) throw Object.assign(new Error('Invalid entity operation.'), { status: 400, code: 'SYNC_ENTITY_INVALID' });
  if (!Number.isSafeInteger(raw.baseVersion) || raw.baseVersion < 0) throw Object.assign(new Error('Invalid entity base version.'), { status: 400, code: 'SYNC_VERSION_INVALID' });
  let body = null;
  if (raw.operation === 'upsert') {
    if (!plain(raw.body || {})) throw Object.assign(new Error('Invalid entity body.'), { status: 400, code: 'SYNC_ENTITY_INVALID' });
    body = JSON.stringify(raw.body || {});
    if (Buffer.byteLength(body) > 512 * 1024) throw Object.assign(new Error('Entity body is too large.'), { status: 413, code: 'SYNC_ENTITY_TOO_LARGE' });
  }
  return { kind: raw.kind, entityId: String(raw.entityId), operation: raw.operation, baseVersion: raw.baseVersion, body };
}

function conflictPayload(row) {
  return row ? {
    kind: row.kind, entityId: row.entity_id, version: row.version, serverCursor: row.server_cursor,
    tombstone: !!row.tombstone, body: row.tombstone ? null : parseJson(row.body_json, {})
  } : null;
}

export function syncPullPage(db, accountId, cursor = 0, limit = MAX_PULL) {
  const startCursor = Math.max(0, Math.floor(Number(cursor) || 0));
  const pageLimit = Math.max(1, Math.min(MAX_PULL, Math.floor(Number(limit) || MAX_PULL)));
  const eventRows = db.prepare(`SELECT server_cursor,id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at
    FROM learning_events WHERE account_id=? AND server_cursor>? ORDER BY server_cursor LIMIT ?`).all(accountId, startCursor, pageLimit);
  const entityRows = db.prepare(`SELECT server_cursor,kind,entity_id,version,body_json,tombstone,updated_at
    FROM sync_entities WHERE account_id=? AND server_cursor>? ORDER BY server_cursor LIMIT ?`).all(accountId, startCursor, pageLimit);
  const merged = [
    ...eventRows.map(row => ({ type: 'event', cursor: row.server_cursor, row })),
    ...entityRows.map(row => ({ type: 'entity', cursor: row.server_cursor, row }))
  ].sort((a, b) => a.cursor - b.cursor).slice(0, pageLimit);
  const cutoff = merged.length ? merged[merged.length - 1].cursor : startCursor;
  const events = merged.filter(x => x.type === 'event').map(({ row }) => ({
    serverCursor: row.server_cursor, id: row.id, deviceId: row.device_id, deviceSeq: row.device_seq, kind: row.kind,
    entityId: row.entity_id, occurredAt: row.occurred_at, payload: parseJson(row.payload_json, {}), createdAt: row.created_at
  }));
  const entities = merged.filter(x => x.type === 'entity').map(({ row }) => ({
    serverCursor: row.server_cursor, kind: row.kind, entityId: row.entity_id, version: row.version,
    tombstone: !!row.tombstone, body: row.tombstone ? null : parseJson(row.body_json, {}), updatedAt: row.updated_at
  }));

  // The global cursor is only an allocation mechanism. Pagination is an account-
  // scoped contract: another student's newer rows must never keep this account in
  // a permanent hasMore loop or reveal anything about another tenant's activity.
  const hasMoreEvent = db.prepare('SELECT 1 FROM learning_events WHERE account_id=? AND server_cursor>? LIMIT 1').get(accountId, cutoff);
  const hasMoreEntity = db.prepare('SELECT 1 FROM sync_entities WHERE account_id=? AND server_cursor>? LIMIT 1').get(accountId, cutoff);
  return { schemaVersion: SCHEMA, cursor: cutoff, hasMore: !!(hasMoreEvent || hasMoreEntity), events, entities };
}

export function createSyncRouter(db) {
  const router = Router();
  router.use(requireSession(db));

  router.post('/push', rateLimit(db, 'sync-push', { limit: 120, windowMs: 60 * 1000 }), (req, res) => {
    const body = req.body || {};
    if (body.schemaVersion !== SCHEMA) return res.status(409).json({ error: { code: 'SYNC_SCHEMA_UNSUPPORTED', message: `Expected sync schema ${SCHEMA}.` } });
    const deviceId = String(body.deviceId || '');
    if (!ID.test(deviceId) || deviceId !== req.platformSession.device_id) return res.status(400).json({ error: { code: 'SYNC_DEVICE_MISMATCH', message: 'Sync device does not match this session.' } });
    const eventsRaw = Array.isArray(body.events) ? body.events : [];
    const entitiesRaw = Array.isArray(body.entities) ? body.entities : [];
    if (eventsRaw.length + entitiesRaw.length > MAX_PUSH) return res.status(413).json({ error: { code: 'SYNC_BATCH_TOO_LARGE', message: `At most ${MAX_PUSH} sync items are accepted per push.` } });
    const events = eventsRaw.map(item => cleanEvent(item, deviceId));
    const entities = entitiesRaw.map(cleanEntity);
    const accountId = req.platformSession.account_id;
    const idem = String(req.get('idempotency-key') || '').slice(0, 160);
    if (!ID.test(idem)) return res.status(400).json({ error: { code: 'IDEMPOTENCY_REQUIRED', message: 'A valid Idempotency-Key is required.' } });

    const prior = db.prepare(`SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='sync-push' AND key=? AND expires_at>?`).get(accountId, idem, Date.now());
    if (prior) return res.json(parseJson(prior.response_json, { ok: true, replayed: true }));

    try {
      const response = db.transaction(() => {
        const acceptedEvents = [];
        const acceptedEntities = [];
        for (const event of events) {
          const priorSeq = db.prepare('SELECT id,payload_json,kind,entity_id,occurred_at,server_cursor FROM learning_events WHERE account_id=? AND device_id=? AND device_seq=?')
            .get(accountId, deviceId, event.deviceSeq);
          if (priorSeq) {
            const same = priorSeq.id === event.id && priorSeq.payload_json === event.payload && priorSeq.kind === event.kind && (priorSeq.entity_id || null) === event.entityId && (priorSeq.occurred_at || null) === event.occurredAt;
            if (!same) throw Object.assign(new Error(`Device sequence ${event.deviceSeq} was already committed with different content.`), { status: 409, code: 'SYNC_SEQUENCE_CONFLICT' });
            acceptedEvents.push({ id: event.id, serverCursor: priorSeq.server_cursor, replayed: true });
            continue;
          }
          const cursor = nextSyncCursor(db);
          db.prepare(`INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)`).run(cursor, event.id, accountId, deviceId, event.deviceSeq, event.kind, event.entityId, event.occurredAt, event.payload, Date.now());
          acceptedEvents.push({ id: event.id, serverCursor: cursor, replayed: false });
        }

        for (const entity of entities) {
          const current = db.prepare('SELECT * FROM sync_entities WHERE account_id=? AND kind=? AND entity_id=?').get(accountId, entity.kind, entity.entityId);
          const currentVersion = current?.version || 0;
          if (currentVersion !== entity.baseVersion) {
            throw Object.assign(new Error(`Sync conflict for ${entity.kind}:${entity.entityId}.`), { status: 409, code: 'SYNC_ENTITY_CONFLICT', conflict: conflictPayload(current) });
          }
          const cursor = nextSyncCursor(db);
          const version = currentVersion + 1;
          db.prepare(`INSERT INTO sync_entities(account_id,kind,entity_id,version,server_cursor,body_json,tombstone,updated_at)
            VALUES (?,?,?,?,?,?,?,?)
            ON CONFLICT(account_id,kind,entity_id) DO UPDATE SET version=excluded.version,server_cursor=excluded.server_cursor,body_json=excluded.body_json,tombstone=excluded.tombstone,updated_at=excluded.updated_at`)
            .run(accountId, entity.kind, entity.entityId, version, cursor, entity.body, entity.operation === 'delete' ? 1 : 0, Date.now());
          acceptedEntities.push({ kind: entity.kind, entityId: entity.entityId, version, serverCursor: cursor });
        }

        const cursor = db.prepare('SELECT value FROM sync_cursors WHERE id=1').get()?.value || 0;
        const out = { schemaVersion: SCHEMA, cursor, acceptedEvents, acceptedEntities, fullRescanAccepted: !!body.fullRescan };
        db.prepare(`INSERT INTO idempotency_keys(account_id,scope,key,response_json,created_at,expires_at)
          VALUES (?,'sync-push',?,?,?,?)`).run(accountId, idem, JSON.stringify(out), Date.now(), Date.now() + 24 * 60 * 60 * 1000);
        return out;
      })();
      res.json(response);
    } catch (err) {
      if (err?.status) return res.status(err.status).json({ error: { code: err.code || 'SYNC_FAILED', message: err.message, conflict: err.conflict || undefined } });
      throw err;
    }
  });

  router.get('/pull/:cursor', rateLimit(db, 'sync-pull', { limit: 180, windowMs: 60 * 1000 }), (req, res) => {
    const accountId = req.platformSession.account_id;
    const page = syncPullPage(db, accountId, req.params.cursor, MAX_PULL);
    res.set('Cache-Control', 'no-store');
    res.json(page);
  });

  return router;
}
