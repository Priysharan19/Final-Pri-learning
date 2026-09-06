// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a push either happened or said so
//
// The sync outbox on a student's iPad has one failure mode that matters: work
// the device believes is safely on the server and is not. Two ways in:
//
//   · An Idempotency-Key that was only a name. A second push under the same key
//     replayed the first response — HTTP 200, plausible cursor — and dropped
//     everything in the new batch. A settings change from light to dark, gone,
//     with the client told it synced.
//   · A learning-event id the account already holds. The unique index fired,
//     the driver's error had no HTTP status, and the route answered 500 with
//     SQLITE_CONSTRAINT_UNIQUE. Nothing about that is retryable, so the device
//     resent the same batch forever and its outbox never drained again.
//
// Both must be conflicts the client can act on, and no 500 may ever hand a
// driver's error code to a student's iPad.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const names = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN'];
const prior = Object.fromEntries(names.map(name => [name, process.env[name]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-sync-idempotency-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '66'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, checks } = await import('./support/app-harness.mjs');
const { createPlatformDb } = await import('../platform/db.js');

const c = checks();
const db = createPlatformDb(':memory:');
const app = await startApp({ db });
const DEVICE = 'ipad-sync-contract';

try {
  const jar = {};
  const registration = await app.request('/v1/account/register', {
    method: 'POST', jar, body: { email: 'sync.student@example.test', name: 'Sync', password: 'correct-horse-battery', deviceId: DEVICE }
  });
  c.eq(registration.status, 201, 'a student account exists to push from');
  const accountId = registration.data.account.id;
  db.prepare('UPDATE accounts SET email_verified_at=? WHERE id=?').run(Date.now(), accountId);

  const push = (body, key) => app.request('/v1/sync/push', {
    method: 'POST', jar, headers: { 'Idempotency-Key': key },
    body: { schemaVersion: 1, deviceId: DEVICE, ...body }
  });
  const event = (id, deviceSeq, payload) => ({ id, deviceId: DEVICE, deviceSeq, kind: 'practice-attempt', payload });
  const settings = (baseVersion, body) => ({ kind: 'settings', entityId: 'settings1', operation: 'upsert', baseVersion, body });

  // ── 1 · A key answers the request it acknowledged, and no other ────────────
  const first = await push({ entities: [settings(0, { theme: 'light' })] }, 'device-batch-1');
  c.eq(first.status, 200, 'the first push is accepted');
  c.eq(first.data.acceptedEntities[0].version, 1, 'and stores settings version 1');

  const replay = await push({ entities: [settings(0, { theme: 'light' })] }, 'device-batch-1');
  c.eq(replay.status, 200, 'resending the same batch under the same key is still a replay');
  c.eq(JSON.stringify(replay.data), JSON.stringify(first.data), 'and returns the response the key acknowledged');
  c.eq(db.prepare('SELECT COUNT(*) AS n FROM sync_entities WHERE account_id=?').get(accountId).n, 1, 'a replay writes nothing new');

  // The defect: the same key over different content used to answer 200 with the
  // old response while the new write was discarded.
  const reused = await push({ entities: [settings(1, { theme: 'DARK' })] }, 'device-batch-1');
  c.eq(reused.status, 409, 'the same key over a different batch is refused');
  c.eq(reused.data.error.code, 'IDEMPOTENCY_KEY_REUSED', 'and says why, so the client can re-key rather than believe it synced');
  c.eq(JSON.parse(db.prepare("SELECT body_json FROM sync_entities WHERE account_id=? AND entity_id='settings1'").get(accountId).body_json).theme,
    'light', 'the refused push changed nothing');

  const rekeyed = await push({ entities: [settings(1, { theme: 'DARK' })] }, 'device-batch-2');
  c.eq(rekeyed.status, 200, 'the same content under a new key is accepted');
  c.eq(JSON.parse(db.prepare("SELECT body_json FROM sync_entities WHERE account_id=? AND entity_id='settings1'").get(accountId).body_json).theme,
    'DARK', 'and the setting the student changed is what the server now holds');

  const digest = db.prepare("SELECT request_digest FROM idempotency_keys WHERE account_id=? AND key='device-batch-1'").get(accountId)?.request_digest;
  c.ok(typeof digest === 'string' && digest.length === 64, 'the key records a digest of what it acknowledged');

  // ── 2 · A repeated event id is a conflict, never a 500 ────────────────────
  const duplicateInBatch = await push({
    events: [event('same-id', 1, { n: 1 }), event('same-id', 2, { n: 2 })]
  }, 'device-batch-3');
  c.eq(duplicateInBatch.status, 409, 'one id twice in one batch is a conflict');
  c.eq(duplicateInBatch.data.error.code, 'SYNC_EVENT_ID_CONFLICT', 'named so the device can drop the duplicate outbox row');
  c.eq(db.prepare('SELECT COUNT(*) AS n FROM learning_events WHERE account_id=?').get(accountId).n, 0, 'and the batch is not half-applied');

  const stored = await push({ events: [event('evt-1', 10, { n: 1 })] }, 'device-batch-4');
  c.eq(stored.status, 200, 'a first event is stored');
  const sameEventAgain = await push({ events: [event('evt-1', 10, { n: 1 })] }, 'device-batch-5');
  c.eq(sameEventAgain.data.acceptedEvents[0].replayed, true, 'the same event on the same sequence is still an idempotent replay');
  const reusedId = await push({ events: [event('evt-1', 11, { n: 2 })] }, 'device-batch-6');
  c.eq(reusedId.status, 409, 'the same id at a new sequence is a conflict');
  c.eq(reusedId.data.error.code, 'SYNC_EVENT_ID_CONFLICT', 'and not an internal error');
  c.eq(db.prepare('SELECT COUNT(*) AS n FROM learning_events WHERE account_id=?').get(accountId).n, 1, 'exactly one event is stored');

  // ── 3 · An unclaimed failure is INTERNAL, whatever the driver called it ───
  // Deliberate 5xx codes a client acts on (HANDWRITING_UNREACHABLE, BILLING_
  // PROVIDER_NOT_CONFIGURED) still carry their code — see
  // verification-enforcement-check.mjs. What must not survive is a code the
  // server never chose to publish.
  db.exec('DROP TABLE learning_events');
  const broken = await push({ events: [event('evt-2', 20, { n: 3 })] }, 'device-batch-7');
  c.eq(broken.status, 500, 'a genuine server fault is a 500');
  c.eq(broken.data.error.code, 'INTERNAL', 'answered as INTERNAL rather than the driver code');
  c.ok(!/SQLITE|no such table/i.test(broken.text), `no driver internals reach the client (${broken.text.slice(0, 120)})`);
} finally {
  await app.close();
  db.close();
  rmSync(scratch, { recursive: true, force: true });
  for (const name of names) {
    if (prior[name] === undefined) delete process.env[name];
    else process.env[name] = prior[name];
  }
}

console.log(`SYNC IDEMPOTENCY — PASS — ${c.count()}/${c.count()} checks — a key answers only the batch it acknowledged, a repeated event id is a conflict, and no server fault hands out a driver's error code.`);
