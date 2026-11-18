// Pri Learning · read an existing account's stored profile before anything local exists
//
// An account that already holds a profile entity must never be asked its class
// again on a device that has no profile, and the placeholder profile that
// device then makes must never stand in for the stored one. This reads the
// account's own stored `profile` entity (the session's own account only; the
// server authorises the pull) so sign-in can build the device profile from it.
// It writes nothing and moves no cursor.

import { cloud } from './cloudTransport.js';
import { get, put } from '../local/idb.js';

/** On a device profile made from a stored one, until the first sync has adopted the server's copy. */
export const RESTORED_MARKER = 'restoredFromAccount';

const clean = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');

/** A stored profile body this device can honour, or null when it is not usable. */
export function usableStoredProfile(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const year = Number(body.year);
  if (!Number.isInteger(year) || year < 7 || year > 12) return null;
  return {
    name: clean(body.name, 80),
    year,
    course: clean(body.course, 30) || 'nsw',
    pathway: clean(body.pathway, 30) || null,
    indiaTrack: clean(body.indiaTrack, 30) || null,
    avatar: clean(body.avatar, 32) || null,
    theme: ['light', 'dark', 'system'].includes(body.theme) ? body.theme : null,
    dailyGoal: Number.isFinite(Number(body.dailyGoal)) ? Math.min(60, Math.max(3, Number(body.dailyGoal))) : null,
    handwriting: body.handwriting !== false
  };
}

/**
 * The account's stored profile, or null when the server truly holds none.
 * A request that fails THROWS: "could not ask" is never "has none".
 */
export async function readStoredAccountProfile(accountId, { pull = cloud.syncPull } = {}) {
  let cursor = 0;
  let found = null;
  for (let page = 0; page < 100; page++) {
    const raw = await pull(cursor, accountId);
    for (const entity of Array.isArray(raw?.entities) ? raw.entities : []) {
      if (entity?.kind !== 'profile' || entity.entityId !== 'self') continue;
      if (!found || Number(entity.version) >= found.version) {
        found = { version: Number(entity.version) || 0, tombstone: !!entity.tombstone, body: entity.body };
      }
    }
    cursor = Number(raw?.cursor) || cursor;
    if (!raw?.hasMore) break;
  }
  return found && !found.tombstone ? usableStoredProfile(found.body) : null;
}

/** Put the stored settings on the freshly made device profile and mark it as a vessel, not an authority. */
export async function applyStoredProfile(pid, stored) {
  const row = await get('profiles', pid);
  if (!row) throw new Error('The device profile is missing.');
  const next = { ...row, [RESTORED_MARKER]: true };
  if (stored.avatar) next.avatar = stored.avatar;
  if (stored.theme) next.theme = stored.theme;
  if (stored.dailyGoal) next.dailyGoal = stored.dailyGoal;
  next.handwriting = stored.handwriting !== false;
  await put('profiles', next);
  return next;
}
