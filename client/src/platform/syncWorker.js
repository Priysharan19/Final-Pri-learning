// Pri Learning · offline-first cloud sync worker
//
// Local learning commits first. This worker reads the existing payload-free
// outbox afterwards, re-reads only the authorised local state it needs, sends a
// bounded idempotent batch, and acknowledges outbox sequence numbers only after
// the server confirms the commit. A cloud outage therefore never blocks local
// practice and a retry never repeats a non-idempotent learning event.

import { all, byIndex, del, get, put } from '../local/idb.js';
import { acknowledgeMutations, outboxStats, pendingMutations } from '../local/outbox.js';
import { cloud } from './cloudTransport.js';
import { cloudAccountLink, cloudDeviceId, markCloudSynced, verifyCloudSession } from './cloudAccount.js';
import {
  MAX_PUSH_ITEMS, createPushEnvelope, syncPolicyFor, SYNC_POLICY, validatePullEnvelope
} from './syncContract.js';

const STATE_PREFIX = 'pri-cloud-sync-state-v1:';
const REMOTE_EVENT_PREFIX = 'pri-cloud-remote-event-v1:';
const MAX_REMOTE_EVENT_CACHE = 2000;
const CLIENT_ENTITY_KINDS = new Set(['profile', 'settings', 'bookmark', 'favorite', 'task', 'custom-question']);

const stateId = pid => `${STATE_PREFIX}${pid}`;
const eventCacheId = (pid, id) => `${REMOTE_EVENT_PREFIX}${pid}:${id}`;

function plain(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
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

function safeTask(row) {
  if (!row) return null;
  return {
    title: String(row.title || '').slice(0, 160),
    classId: row.classId ? String(row.classId).slice(0, 100) : null,
    subtopics: Array.isArray(row.subtopics) ? row.subtopics.map(String).slice(0, 100) : [],
    customIds: Array.isArray(row.customIds) ? row.customIds.map(String).slice(0, 100) : [],
    count: Math.min(100, Math.max(1, Number(row.count) || 1)),
    dueAt: Number.isFinite(Number(row.dueAt)) ? Number(row.dueAt) : null,
    createdAt: Number.isFinite(Number(row.createdAt)) ? Number(row.createdAt) : null
  };
}

function safeCustomQuestion(row) {
  if (!row) return null;
  return {
    name: String(row.name || '').slice(0, 120),
    prompt: String(row.prompt || '').slice(0, 8000),
    answerType: String(row.answerType || 'numeric').slice(0, 40),
    answer: plain(row.answer) ? { ...row.answer } : {},
    difficulty: Math.min(4, Math.max(1, Number(row.difficulty) || 2)),
    solutionText: String(row.solutionText || '').slice(0, 8000),
    hint: String(row.hint || '').slice(0, 1200)
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

async function attemptIndex(pid) {
  const rows = await byIndex('attempts', 'pid', pid).catch(() => []);
  const map = new Map();
  for (const row of rows) {
    if (!row?.questionId) continue;
    const prior = map.get(row.questionId);
    if (!prior || Number(row.createdAt || 0) >= Number(prior.createdAt || 0)) map.set(row.questionId, row);
  }
  return map;
}

async function eventForOutbox(item, pid, deviceId, attempts) {
  const common = {
    id: `evt-${deviceId}-${item.seq}`,
    deviceId,
    deviceSeq: item.seq,
    entityId: item.entityId === 'self' ? null : item.entityId,
    occurredAt: Number(item.at || item.firstAt || Date.now())
  };

  if (item.kind === 'practice-progress') {
    const attempt = attempts.get(item.entityId);
    if (!attempt) return null;
    return {
      ...common,
      kind: 'practice-progress',
      payload: {
        subtopic: attempt.subtopic || null,
        difficulty: Number(attempt.difficulty) || 2,
        correct: !!attempt.correct,
        ms: Math.max(0, Number(attempt.ms) || 0),
        hintsUsed: Math.max(0, Number(attempt.hintsUsed) || 0),
        mode: String(attempt.mode || 'practice').slice(0, 30),
        viaInk: !!attempt.viaInk,
        ratingBefore: Number.isFinite(Number(attempt.ratingBefore)) ? Number(attempt.ratingBefore) : null,
        ratingAfter: Number.isFinite(Number(attempt.ratingAfter)) ? Number(attempt.ratingAfter) : null,
        createdAt: Number(attempt.createdAt) || common.occurredAt
      }
    };
  }

  if (item.kind === 'exam') {
    const exam = await get('exams', item.entityId).catch(() => null);
    if (!exam) return null;
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
    const runs = await byIndex(store, 'pid', pid).catch(() => []);
    const latest = [...runs].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];
    if (!latest) return null;
    const allowed = item.kind === 'rush-history'
      ? ['score', 'correct', 'total', 'bestCombo', 'createdAt']
      : ['won', 'playerScore', 'rivalScore', 'rival', 'ms', 'createdAt'];
    const payload = {};
    for (const key of allowed) if (latest[key] !== undefined) payload[key] = latest[key];
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
  if (kind === 'profile' || kind === 'settings') body = safeProfile(await get('profiles', pid));
  else if (kind === 'bookmark' || kind === 'favorite') body = { present: true, questionId: String(item.entityId) };
  else if (kind === 'task') body = safeTask(await get('tasks', item.entityId));
  else if (kind === 'custom-question') body = safeCustomQuestion(await get('customQs', item.entityId));
  if (!body) return null;
  return { kind, entityId, operation: 'upsert', baseVersion, body };
}

async function buildNormalBatch(items, pid, deviceId, state) {
  const attempts = await attemptIndex(pid);
  const events = [];
  const entities = [];
  const represented = [];
  const blocked = [];

  for (const item of items) {
    if (events.length + entities.length >= MAX_PUSH_ITEMS) break;
    const policy = syncPolicyFor(item.kind === 'exam' ? 'exam-attempt' : item.kind);
    try {
      if (policy === SYNC_POLICY.APPEND_ONLY || item.kind === 'exam') {
        const event = await eventForOutbox(item, pid, deviceId, attempts);
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
  return { events, entities, represented, blocked, fullRescan: false };
}

async function allFullRescanEntities(pid, state) {
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
  for (const row of await all('tasks').catch(() => [])) {
    if (!row?.id) continue;
    const body = safeTask(row);
    if (body) entities.push({ kind: 'task', entityId: row.id, operation: 'upsert', baseVersion: safeInt(state.entityVersions[`task:${row.id}`]), body });
  }
  for (const row of await byIndex('customQs', 'ownerPid', pid).catch(() => [])) {
    if (!row?.id) continue;
    const body = safeCustomQuestion(row);
    if (body) entities.push({ kind: 'custom-question', entityId: row.id, operation: 'upsert', baseVersion: safeInt(state.entityVersions[`custom-question:${row.id}`]), body });
  }
  return entities;
}

async function cacheRemoteEvent(pid, event) {
  const id = eventCacheId(pid, event.id);
  await put('device', {
    id, eventId: event.id, serverCursor: event.serverCursor, deviceId: event.deviceId,
    kind: event.kind, entityId: event.entityId || null, occurredAt: event.occurredAt || null,
    payload: plain(event.payload) ? event.payload : {}, cachedAt: Date.now()
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
      // Our own events are already reflected in the local database. Caching only
      // other devices prevents double-counting in cross-device product summaries.
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

async function pushFullRescan(pid, deviceId, marker, state) {
  const entities = await allFullRescanEntities(pid, state);
  let accepted = 0;
  for (let offset = 0; offset < entities.length; offset += MAX_PUSH_ITEMS) {
    const chunk = entities.slice(offset, offset + MAX_PUSH_ITEMS);
    const envelope = createPushEnvelope({ deviceId, baseCursor: state.cursor, entities: chunk, fullRescan: true });
    const key = `rescan-${deviceId}-${marker.seq}-${Math.floor(offset / MAX_PUSH_ITEMS)}`;
    const result = await cloud.syncPush(envelope, key);
    for (const row of result.acceptedEntities || []) {
      state.entityVersions[versionKey(row.kind, row.entityId)] = row.version;
      accepted++;
    }
  }
  await acknowledgeMutations([marker.seq]);
  return { pushedEvents: 0, pushedEntities: accepted, acknowledged: 1, blocked: [] };
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
    const pending = await pendingMutations(MAX_PUSH_ITEMS);
    let push = { pushedEvents: 0, pushedEntities: 0, acknowledged: 0, blocked: [] };
    const rescan = pending.find(item => item.kind === 'full-rescan');
    if (rescan) {
      push = await pushFullRescan(pid, deviceId, rescan, state);
    } else if (pending.length) {
      const batch = await buildNormalBatch(pending, pid, deviceId, state);
      if (batch.events.length || batch.entities.length) {
        const envelope = createPushEnvelope({
          deviceId, baseCursor: state.cursor, events: batch.events, entities: batch.entities, fullRescan: false
        });
        const first = Math.min(...batch.represented);
        const last = Math.max(...batch.represented);
        const result = await cloud.syncPush(envelope, `sync-${deviceId}-${first}-${last}`);
        for (const row of result.acceptedEntities || []) state.entityVersions[versionKey(row.kind, row.entityId)] = row.version;
        await acknowledgeMutations(batch.represented);
        push = {
          pushedEvents: (result.acceptedEvents || []).length,
          pushedEntities: (result.acceptedEntities || []).length,
          acknowledged: batch.represented.length,
          blocked: batch.blocked
        };
      } else push.blocked = batch.blocked;
    }

    // Pull from the PREVIOUS canonical cursor rather than skipping directly to
    // the push response cursor. That catches mutations another device committed
    // between our last pull and this push.
    const pull = await pullAll(pid, deviceId, state);
    state.lastSyncAt = Date.now();
    state.lastError = null;
    await saveState(pid, state);
    await markCloudSynced(pid, state.lastSyncAt);
    const after = await outboxStats();
    return { ...push, ...pull, cursor: state.cursor, pending: after.pending, requiresFullRescan: after.requiresFullRescan, lastSyncAt: state.lastSyncAt };
  } catch (error) {
    state.lastError = error?.code || error?.message || 'sync-failed';
    await saveState(pid, state).catch(() => {});
    throw error;
  }
}

export async function cloudSyncStatus(pid) {
  const [link, state, outbox] = await Promise.all([
    cloudAccountLink(pid), loadState(pid), outboxStats()
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
