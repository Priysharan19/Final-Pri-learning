// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the Exam Desk's device cache (F4 spec §3)
//
// What this device last heard from the server about an attempt, plus the
// student's edits and clock presses the server has not confirmed yet. It
// exists so a reload paints at once, and so notes typed with no connection are
// not lost.
//
// IT IS NOT AUTHORITATIVE. The server's record replaces it on every reply.
// Editing it changes nothing on the server: queued clock presses are sent as
// intents and stamped with the SERVER's time when they arrive, so going
// offline can never buy time.
//
// WHOSE IT IS. One database of its own (`pri-desk-v1`), nothing shared with
// the marked papers' device stores. Each record is keyed
// `desk:v1:<accountId>:<attemptId>`, and the page asks for a record only by
// the account it has established: the server's answer to "who is signed in",
// or — with no connection — the account this device profile is linked to
// (`linkedAccount`, the same link row the activation gate reads). A record of
// any other account is never read into a page. Signing out of, or deleting,
// the account on this device forgets the whole cache (App.jsx), unsent work
// included: it is a deliberate act, like the other account-scoped device state.
//
// AT REST it follows the profile's own protection (local/idb.js): where the
// profile holds a data key — a password-protected profile — the record is
// sealed under that key, like the profile's drafts and handwriting; a record
// that cannot be opened reads as no cache at all. Its key names the account
// and the attempt, nothing of what was written.
//
// Every call fails soft: with no IndexedDB (private mode, a dropped
// connection) the desk still works online, it just cannot paint from cache.
// ─────────────────────────────────────────────────────────────────────────────
import { get, hasDataKey, openField, sealField } from '../local/idb.js';

export const DESK_DB = 'pri-desk-v1';
const STORE = 'attempts';
const LINK_PREFIX = 'pri-cloud-account-link-v1:';
const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;
// Set when the cache was forgotten (sign-out): a save still in flight from the
// page being left must not write the signed-out account's work back.
let forgotten = false;

export const cacheKey = (accountId, attemptId) => `desk:v1:${accountId}:${attemptId}`;

/** The device profile in use (the pointer the local store keeps), or null. Read only. */
const profileId = () => { try { return globalThis.localStorage?.getItem('pri-current-profile') || null; } catch { return null; } };

/**
 * The account this device profile is linked to, read from the device's own
 * link row — who the desk belongs to when the server cannot be asked.
 */
export async function linkedAccount() {
  forgotten = false;
  const pid = profileId();
  if (!pid) return null;
  const row = await get('device', `${LINK_PREFIX}${pid}`).catch(() => null);
  return row?.accountId ? String(row.accountId) : null;
}

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no IndexedDB')); return; }
    const req = indexedDB.open(DESK_DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'key' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
  });
}

async function run(mode, work, fallback) {
  let db = null;
  try {
    db = await open();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result ?? null);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } catch { return fallback; } finally { try { db?.close(); } catch { /* already closed */ } }
}

/** What is kept of an attempt, sealed under the profile's key when it holds one. */
async function pack(body) {
  const pid = profileId();
  if (!pid || !hasDataKey(pid)) return { body };
  const sealed = await sealField(pid, body);
  return sealed ? { pid, sealed } : { body };
}
async function unpack(row) {
  if (row?.sealed) return (row.pid === profileId() ? await openField(row.pid, row.sealed).catch(() => null) : null) || null;
  return row?.body || null;
}

export async function readCache(accountId, attemptId) {
  if (!accountId || !attemptId) return null;
  const row = await run('readonly', s => s.get(cacheKey(accountId, attemptId)), null);
  if (!row || row.accountId !== String(accountId) || row.attemptId !== attemptId) return null;
  const body = await unpack(row);
  return body?.attempt?.id === attemptId ? { accountId: row.accountId, attemptId, at: row.at, ...body } : null;
}

/** Keep what the server last said and what it has not been told yet. */
export async function writeCache(accountId, attemptId, { attempt, serverNow = null, pending = {}, intents = [] }) {
  if (forgotten || !accountId || !attemptId || !attempt) return null;
  const unsent = Object.keys(pending || {}).length > 0 || (intents || []).length > 0;
  const kept = await pack({ attempt, serverNow, pending, intents }).catch(() => null);
  if (!kept || forgotten) return null;
  return run('readwrite', s => s.put({ key: cacheKey(accountId, attemptId), accountId: String(accountId), attemptId, unsent, at: Date.now(), ...kept }), null);
}

export const dropCache = (accountId, attemptId) => run('readwrite', s => s.delete(cacheKey(accountId, attemptId)), null);

/**
 * Housekeeping, run when the desk opens as `accountId`: records past sixty
 * days and other accounts' records with nothing unsent are removed. Returns
 * how many records of OTHER accounts still hold unsent work — those are never
 * read or sent from this account, and are removed only when the student says so.
 */
export async function sweepCache(accountId) {
  const rows = (await run('readonly', s => s.getAll(), [])) || [];
  let others = 0;
  for (const row of rows) {
    const mine = row.accountId === String(accountId);
    const old = Date.now() - Number(row.at || 0) > MAX_AGE_MS;
    if (old || (!mine && row.unsent !== true)) await run('readwrite', s => s.delete(row.key), null);
    else if (!mine) others++;
  }
  return others;
}

/** The student's own choice: remove every other account's records from this device. */
export async function dropOtherAccounts(accountId) {
  const rows = (await run('readonly', s => s.getAll(), [])) || [];
  for (const row of rows) if (row.accountId !== String(accountId)) await run('readwrite', s => s.delete(row.key), null);
}

/** Forget everything the desk keeps on this device (sign-out, account deletion). */
export function clearDeskCache() {
  forgotten = true;
  try { globalThis.indexedDB?.deleteDatabase(DESK_DB); } catch { /* nothing to forget */ }
}
