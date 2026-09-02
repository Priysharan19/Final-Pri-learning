// Pri Learning · offline-first cloud sync worker
//
// Local learning commits first. This worker consumes ONLY the profile-scoped
// cloud outbox, re-reads authorised local state, sends bounded idempotent batches,
// and acknowledges sequence numbers only after the server confirms the commit.
// A cloud outage therefore never blocks local practice and retries never repeat
// non-idempotent learning facts.

import { all, byIndex, del, get, put } from '../local/idb.js';
import {
  acknowledgeProfileMutations, pendingProfileMutations, profileOutboxStats
} from './profileOutbox.js';
import { cloud } from './cloudTransport.js';
import { cloudAccountLink, cloudDeviceId, markCloudSynced, verifyCloudSession } from './cloudAccount.js';
import {
  MAX_PUSH_ITEMS, createPushEnvelope, syncPolicyFor, SYNC_POLICY, validatePullEnvelope
} from './syncContract.js';

const STATE_PREFIX = 'pri-cloud-sync-state-v1:';
const REMOTE_EVENT_PREFIX = 'pri-cloud-remote-event-v1:';
const MAX_REMOTE_EVENT_CACHE = 2000;
const HISTORIC_OLD_ATTEMPT_BASE = 4_000_000_000_000_000;
const HISTORIC_NEW_ATTEMPT_BASE = 5_000_000_000_000_000;
const HISTORIC_FALLBACK_BASE = 6_000_000_000_000_000;

// Generic user sync deliberately stays small. Networked classes/assignments and
// teacher-authored content use their own server-authorised APIs; copying shared
// local task records through a student's generic replica would be a privacy bug.
const CLIENT_ENTITY_KINDS = new Set(['profile', 'bookmark', 'favorite']);

const stateId = pid => `${STATE_PREFIX}${pid}`;
const eventCacheId = (pid, id) => `${REMOTE_EVENT_PREFIX}${pid}:${id}`;

function plain(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function safeInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : fallback;
}

function safeProfile(row) {
  if (!row) return null;
  return {
    name: String(row.name || '').slice(0, 80),
    year: Math.min(12, Math.max(7, Number(row.year) || 9)),
    course: String(row.course || 'nsw').slice(0, 30),
    pathway: row.pathway ? String(row.pathway).slice(0, 30) : null,
    indiaTrack: row.indiaTrack ? String(row.indiaTrack).slice(0, 30) : null,
    avatar: String(row.avatar || '🙂').slice(0, 32),
    theme: row.theme === 'light' ? 'light' : 'dark',
    dailyGoal: Math.min(60, Math.max(3, Number(row.dailyGoal) || 10)),
    handwriting: row.handwriting !== false
  };
}

function attemptPayload(attempt, fallbackAt = Date.now()) {
  return {
    subtopic: attempt?.subtopic || null,
    difficulty: Number(attempt?.difficulty) || 2,
    correct: !!attempt?.correct,
    ms: Math.max(0, Number(attempt?.ms) || 0),
    hintsUsed: Math.max(0, Number(attempt?.hintsUsed) || 0),
    mode: String(attempt?.mode || 'practice').slice(0, 30),
    viaInk: !!attempt?.viaInk,
    ratingBefore: Number.isFinite(Number(attempt?.ratingBefore)) ? Number(attempt.ratingBefore) : null,
    ratingAfter: Number.isFinite(Number(attempt?.ratingAfter)) ? Number(attempt.ratingAfter) : null,
    createdAt: Number(attempt?.createdAt) || fallbackAt
  };
}

async function loadState(pid) {
  const row = await get('device', stateId(pid)).catch(() => null);
  return {
    id: stateId(pid),
    cursor: safeInt(row?.cursor),
    entityVersions: plain(row?.entityVersions) ? { ...row.entityVersions } : {},
    accountId: row?.accountId || null,
    lastSyncAt: Number(row?.lastSyncAt) || null,
    lastError: row?.lastError || null
  };
}

async function saveState(pid, state) {
  await put('device', {
    id: stateId(pid), cursor: safeInt(state.cursor),
    entityVersions: { ...(state.entityVersions || {}) }, accountId: state.accountId || null,
    lastSyncAt: state.lastSyncAt || null,
    lastError: state.lastError ? String(state.lastError).slice(0, 300) : null
  });
}

const versionKey = (kind, entityId) => `${kind}:${entityId}`;

async function exactAttempt(pid, item) {
  if (item.sourceId !== null && item.sourceId !== undefined) {
    const row = await get('attempts', item.sourceId).catch(() => null);
    if (row?.pid === pid && row?.questionId === item.entityId) return row;
  }
  const rows = (await byIndex('attempts', 'pid', pid).catch(() => []))
    .filter(row => row?.questionId === item.entityId)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  return rows[0] || null;
}

async function eventForOutbox(item, pid, deviceId) {
  const common = {
    id: `evt-${deviceId}-${item.seq}`,
    deviceId,
    deviceSeq: item.seq,
    entityId: item.entityId === 'self' ? null : item.entityId,
    occurredAt: Number(item.at || item.firstAt || Date.now())
  };

  if (item.kind === 'practice-progress') {
    const attempt = await exactAttempt(pid, item);
    if (!attempt) return null;
    return { ...common, kind: 'practice-progress', payload: attemptPayload(attempt, common.occurredAt) };
  }

  if (item.kind === 'exam') {
    const exam = await get('exams', item.entityId).catch(() => null);
    if (!exam || exam.pid !== pid) return null;
    return {
      ...common,
      kind: 'exam-attempt',
      payload: {
        state: exam.finishedAt ? 'finished' : 'started',
        year: Number(exam.year) || null,
        title: String(exam.title || '').slice(0, 120),
        score: exam.score == null ? null : Number(exam.score),
        total: exam.total == null ? null : Number(exam.total),
        createdAt: Number(exam.createdAt) || common.occurredAt,
        finishedAt: Number(exam.finishedAt) || null,
        indiaExam: plain(exam.indiaExam) ? { ...exam.indiaExam } : null
      }
    };
  }

  if (item.kind === 'rush-history' || item.kind === 'match-history') {
    const store = item.kind === 'rush-history' ? 'rushRuns' : 'matchRuns';
    let run = item.sourceId != null ? await get(store, item.sourceId).catch(() => null) : null;
    if (!run || run.pid !== pid) {
      const runs = await byIndex(store, 'pid', pid).catch(() => []);
      run = [...runs].sort((a, b) => Number(b.createdAt || b.finishedAt || 0) - Number(a.createdAt || a.finishedAt || 0))[0];
    }
    if (!run) return null;
    const allowed = item.kind === 'rush-history'
      ? ['score', 'correct', 'total', 'bestCombo', 'createdAt']
      : ['won', 'playerScore', 'rivalScore', 'rival', 'ms', 'createdAt'];
    const payload = {};
    for (const key of allowed) if (run[key] !== undefined) payload[key] = run[key];
    return { ...common, kind: item.kind, payload };
  }

  return null;
}

async function entityForOutbox(item, pid, state) {
  const kind = item.kind;
  if (!CLIENT_ENTITY_KINDS.has(kind)) return null;
  const entityId = kind === 'profile' ? 'self' : item.entityId;
  const baseVersion = safeInt(state.entityVersions[versionKey(kind, entityId)]);
  if (item.operation === 'delete') return { kind, entityId, operation: 'delete', baseVersion };

  let body = null;
  if (kind === 'profile') body = safeProfile(await get('profiles', pid));
  else if (kind === 'bookmark' || kind === 'favorite') body = { present: true, questionId: String(item.entityId) };
  if (!body) return null;
  return { kind, entityId, operation: 'upsert', baseVersion, body };
}

async function buildNormalBatch(items, pid, deviceId, state) {
  const events = [];
  const entities = [];
  const represented = [];
  const blocked = [];

  for (const item of items) {
    if (events.length + entities.length >= MAX_PUSH_ITEMS) break;
    const policy = syncPolicyFor(item.kind === 'exam' ? 'exam-attempt' : item.kind);
    try {
      if (policy === SYNC_POLICY.APPEND_ONLY || item.kind === 'exam') {
        const event = await eventForOutbox(item, pid, deviceId);
        if (event) { events.push(event); represented.push(item.seq); }
        else blocked.push({ seq: item.seq, kind: item.kind, reason: 'local-source-missing' });
      } else if (CLIENT_ENTITY_KINDS.has(item.kind)) {
        const entity = await entityForOutbox(item, pid, state);
        if (entity) { entities.push(entity); represented.push(item.seq); }
        else blocked.push({ seq: item.seq, kind: item.kind, reason: 'local-source-missing' });
      } else {
        blocked.push({ seq: item.seq, kind: item.kind, reason: 'not-client-syncable' });
      }
    } catch (error) {
      blocked.push({ seq: item.seq, kind: item.kind, reason: error?.code || error?.message || 'build-failed' });
    }
  }
  return { events, entities, represented, blocked };
}

async function fullRescanEntities(pid, state) {
  const entities = [];
  const profile = safeProfile(await get('profiles', pid));
  if (profile) entities.push({
    kind: 'profile', entityId: 'self', operation: 'upsert',
    baseVersion: safeInt(state.entityVersions['profile:self']), body: profile
  });

  for (const row of await byIndex('bookmarks', 'pid', pid).catch(() => [])) {
    const questionId = row?.questionId || String(row?.key || '').split(':').slice(1).join(':');
    if (!questionId) continue;
    entities.push({
      kind: 'bookmark', entityId: questionId, operation: 'upsert',
      baseVersion: safeInt(state.entityVersions[`bookmark:${questionId}`]),
      body: { present: true, questionId }
    });
  }
  entities.sort((a, b) => `${a.kind}:${a.entityId}`.localeCompare(`${b.kind}:${b.entityId}`));
  return entities;
}

function historicAttemptSeq(attempt, fallbackIndex) {
  if (Number.isSafeInteger(attempt?.id) && attempt.id > 0) return HISTORIC_OLD_ATTEMPT_BASE + attempt.id;
  const match = String(attempt?.id || '').match(/:(\d{1,12})$/);
  if (match) return HISTORIC_NEW_ATTEMPT_BASE + Number(match[1]);
  return HISTORIC_FALLBACK_BASE + fallbackIndex + 1;
}

async function historicalAttemptEvents(pid, deviceId) {
  const rows = await byIndex('attempts', 'pid', pid).catch(() => []);
  rows.sort((a, b) => {
    const ta = Number(a.createdAt || 0), tb = Number(b.createdAt || 0);
    if (ta !== tb) return ta - tb;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
  return rows.map((attempt, index) => {
    const source = String(attempt.id ?? index + 1).replace(/[^A-Za-z0-9._:-]/g, '_').slice(0, 80);
    return {
      id: `hist:${deviceId}:${source}`.slice(0, 160),
      deviceId,
      deviceSeq: historicAttemptSeq(attempt, index),
      kind: 'practice-progress',
      entityId: attempt.questionId || null,
      occurredAt: Number(attempt.createdAt) || null,
      payload: attemptPayload(attempt)
    };
  });
}

async function cacheRemoteEvent(pid, event) {
  await put('device', {
    id: eventCacheId(pid, event.id), eventId: event.id, serverCursor: event.serverCursor,
    deviceId: event.deviceId, kind: event.kind, entityId: event.entityId || null,
    occurredAt: event.occurredAt || null, payload: plain(event.payload) ? event.payload : {}, cachedAt: Date.now()
  });
}

async function trimRemoteEventCache(pid) {
  const prefix = `${REMOTE_EVENT_PREFIX}${pid}:`;
  const rows = (await all('device')).filter(row => String(row?.id || '').startsWith(prefix));
  if (rows.length <= MAX_REMOTE_EVENT_CACHE) return;
  rows.sort((a, b) => Number(b.serverCursor || 0) - Number(a.serverCursor || 0));
  await Promise.all(rows.slice(MAX_REMOTE_EVENT_CACHE).map(row => del('device', row.id).catch(() => {})));
}

async function applyRemoteEntity(pid, entity, state) {
  const key = versionKey(entity.kind, entity.entityId);
  state.entityVersions[key] = Math.max(safeInt(state.entityVersions[key]), safeInt(entity.version));

  if (entity.kind === 'profile' && entity.entityId === 'self' && !entity.tombstone && plain(entity.body)) {
    const local = await get('profiles', pid).catch(() => null);
    if (local) {
      const allowed = ['name', 'year', 'course', 'pathway', 'indiaTrack', 'avatar', 'theme', 'dailyGoal', 'handwriting'];
      const next = { ...local };
      for (const field of allowed) if (entity.body[field] !== undefined) next[field] = entity.body[field];
      await put('profiles', next);
    }
    return;
  }

  if ((entity.kind === 'bookmark' || entity.kind === 'favorite') && entity.entityId) {
    const keyId = `${pid}:${entity.entityId}`;
    if (entity.tombstone || entity.body?.present === false) await del('bookmarks', keyId).catch(() => {});
    else await put('bookmarks', { key: keyId, pid, questionId: entity.entityId, createdAt: entity.updatedAt || Date.now() });
  }
}

async function pullAll(pid, deviceId, state) {
  let cursor = safeInt(state.cursor);
  let pulledEvents = 0;
  let pulledEntities = 0;
  for (let page = 0; page < 100; page++) {
    const raw = await cloud.syncPull(cursor);
    validatePullEnvelope(raw);
    for (const event of raw.events) {
      if (event.deviceId !== deviceId) {
        await cacheRemoteEvent(pid, event);
        pulledEvents++;
      }
    }
    for (const entity of raw.entities) {
      await applyRemoteEntity(pid, entity, state);
      pulledEntities++;
    }
    cursor = raw.cursor;
    state.cursor = cursor;
    if (!raw.hasMore) break;
    if (page === 99) throw new Error('Sync pull exceeded the safety page limit');
  }
  await trimRemoteEventCache(pid);
  return { pulledEvents, pulledEntities };
}

function rescanKey(prefix, deviceId, index, chunk) {
  const first = chunk[0]?.entityId || chunk[0]?.id || 'none';
  const last = chunk[chunk.length - 1]?.entityId || chunk[chunk.length - 1]?.id || 'none';
  const clean = value => String(value).replace(/[^A-Za-z0-9._:-]/g, '_').slice(0, 36);
  return `${prefix}-${clean(deviceId)}-${index}-${chunk.length}-${clean(first)}-${clean(last)}`.slice(0, 160);
}

async function pushFullRescan(pid, deviceId, marker, state) {
  const entities = await fullRescanEntities(pid, state);
  const historical = await historicalAttemptEvents(pid, deviceId);
  let pushedEntities = 0;
  let pushedEvents = 0;

  for (let offset = 0; offset < entities.length; offset += MAX_PUSH_ITEMS) {
    const chunk = entities.slice(offset, offset + MAX_PUSH_ITEMS);
    const envelope = createPushEnvelope({ deviceId, baseCursor: state.cursor, entities: chunk, fullRescan: true });
    const result = await cloud.syncPush(envelope, rescanKey('rescan-ent', deviceId, offset / MAX_PUSH_ITEMS, chunk));
    for (const row of result.acceptedEntities || []) {
      state.entityVersions[versionKey(row.kind, row.entityId)] = row.version;
      pushedEntities++;
    }
  }

  for (let offset = 0; offset < historical.length; offset += MAX_PUSH_ITEMS) {
    const chunk = historical.slice(offset, offset + MAX_PUSH_ITEMS);
    const envelope = createPushEnvelope({ deviceId, baseCursor: state.cursor, events: chunk, fullRescan: true });
    const result = await cloud.syncPush(envelope, rescanKey('rescan-hist', deviceId, offset / MAX_PUSH_ITEMS, chunk));
    pushedEvents += (result.acceptedEvents || []).length;
  }

  await acknowledgeProfileMutations(pid, [marker.seq]);
  return { pushedEvents, pushedEntities, acknowledged: 1, blocked: [] };
}

export async function syncNow(pid) {
  const link = await cloudAccountLink(pid);
  if (!link?.accountId) throw Object.assign(new Error('Connect this local profile to a cloud account before syncing.'), { code: 'CLOUD_ACCOUNT_NOT_LINKED' });
  const session = await verifyCloudSession(pid);
  if (!session.connected) throw Object.assign(new Error('Sign in to the linked cloud account before syncing.'), { code: 'CLOUD_SIGN_IN_REQUIRED' });
  if (session.account?.id !== link.accountId) throw Object.assign(new Error('The signed-in cloud account does not match this local profile link.'), { code: 'CLOUD_ACCOUNT_MISMATCH' });

  const deviceId = await cloudDeviceId();
  const state = await loadState(pid);
  if (state.accountId && state.accountId !== link.accountId) {
    throw Object.assign(new Error('Sync state belongs to a different cloud account. Disconnect before relinking.'), { code: 'SYNC_ACCOUNT_MISMATCH' });
  }
  state.accountId = link.accountId;

  try {
    const pending = await pendingProfileMutations(pid, MAX_PUSH_ITEMS);
    let push = { pushedEvents: 0, pushedEntities: 0, acknowledged: 0, blocked: [] };
    let prePull = { pulledEvents: 0, pulledEntities: 0 };
    const rescan = pending.find(item => item.kind === 'full-rescan');

    // On first link to an existing cloud account, learn authoritative entity
    // versions before trying to publish local state. This turns the initial
    // reconciliation into a merge/union rather than a blind version-0 overwrite.
    if (rescan) {
      prePull = await pullAll(pid, deviceId, state);
      push = await pushFullRescan(pid, deviceId, rescan, state);
    } else if (pending.length) {
      const batch = await buildNormalBatch(pending, pid, deviceId, state);
      if (batch.events.length || batch.entities.length) {
        const envelope = createPushEnvelope({ deviceId, baseCursor: state.cursor, events: batch.events, entities: batch.entities });
        const first = Math.min(...batch.represented);
        const last = Math.max(...batch.represented);
        const result = await cloud.syncPush(envelope, `sync-${deviceId}-${first}-${last}`);
        for (const row of result.acceptedEntities || []) state.entityVersions[versionKey(row.kind, row.entityId)] = row.version;
        await acknowledgeProfileMutations(pid, batch.represented);
        push = {
          pushedEvents: (result.acceptedEvents || []).length,
          pushedEntities: (result.acceptedEntities || []).length,
          acknowledged: batch.represented.length,
          blocked: batch.blocked
        };
      } else push.blocked = batch.blocked;
    }

    // Pull from the previous canonical cursor after the push as well. That catches
    // mutations another device committed between the pre-pull and this commit.
    const postPull = await pullAll(pid, deviceId, state);
    state.lastSyncAt = Date.now();
    state.lastError = null;
    await saveState(pid, state);
    await markCloudSynced(pid, state.lastSyncAt);
    const after = await profileOutboxStats(pid);
    return {
      ...push,
      pulledEvents: prePull.pulledEvents + postPull.pulledEvents,
      pulledEntities: prePull.pulledEntities + postPull.pulledEntities,
      cursor: state.cursor,
      pending: after.pending,
      requiresFullRescan: after.requiresFullRescan,
      lastSyncAt: state.lastSyncAt
    };
  } catch (error) {
    state.lastError = error?.code || error?.message || 'sync-failed';
    await saveState(pid, state).catch(() => {});
    throw error;
  }
}

export async function cloudSyncStatus(pid) {
  const [link, state, outbox] = await Promise.all([
    cloudAccountLink(pid), loadState(pid), profileOutboxStats(pid)
  ]);
  return {
    linked: !!link?.accountId,
    accountId: link?.accountId || null,
    cursor: state.cursor,
    pending: outbox.pending,
    requiresFullRescan: outbox.requiresFullRescan,
    lastSyncAt: state.lastSyncAt || link?.lastSyncAt || null,
    lastError: state.lastError || null
  };
}

export async function remoteLearningSummary(pid) {
  const deviceId = await cloudDeviceId();
  const prefix = `${REMOTE_EVENT_PREFIX}${pid}:`;
  const rows = (await all('device')).filter(row => String(row?.id || '').startsWith(prefix) && row.deviceId !== deviceId);
  let attempts = 0;
  let correct = 0;
  const bySubtopic = {};
  for (const row of rows) {
    if (row.kind !== 'practice-progress') continue;
    const subtopic = row.payload?.subtopic;
    if (!subtopic) continue;
    attempts++;
    if (row.payload?.correct) correct++;
    const bucket = bySubtopic[subtopic] || (bySubtopic[subtopic] = { attempts: 0, correct: 0 });
    bucket.attempts++;
    if (row.payload?.correct) bucket.correct++;
  }
  return { attempts, correct, bySubtopic, cachedEvents: rows.length };
}
