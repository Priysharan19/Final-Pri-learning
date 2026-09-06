// Teacher invite codes: an admin mints a single-use, expiring code; a new
// registration that presents it is created with role 'teacher'. Only a one-way
// hash and a short display prefix are stored, so a database read cannot
// recover a usable code.

import { randomBytes } from 'node:crypto';
import { id, sha256 } from './security.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GROUPS = 4;
const GROUP_LENGTH = 4;
const CODE = /^PRI-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
export const INVITE_DEFAULT_TTL_DAYS = 14;
export const INVITE_MAX_TTL_DAYS = 90;

function randomGroup() {
  const bytes = randomBytes(GROUP_LENGTH);
  let out = '';
  for (let i = 0; i < GROUP_LENGTH; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function normalizeInviteCode(value) {
  const compact = String(value || '').toUpperCase().replace(/[\s-]+/g, '');
  if (!/^PRI[A-Z2-9]{16}$/.test(compact)) return null;
  const body = compact.slice(3);
  const groups = [];
  for (let i = 0; i < GROUPS; i++) groups.push(body.slice(i * GROUP_LENGTH, (i + 1) * GROUP_LENGTH));
  const code = `PRI-${groups.join('-')}`;
  return CODE.test(code) ? code : null;
}

export function inviteTtlDays(value) {
  if (value === undefined || value === null || value === '') return INVITE_DEFAULT_TTL_DAYS;
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > INVITE_MAX_TTL_DAYS) return null;
  return days;
}

export function mintTeacherInvite(db, { createdBy, ttlDays = INVITE_DEFAULT_TTL_DAYS, now = Date.now() } = {}) {
  const groups = [];
  for (let i = 0; i < GROUPS; i++) groups.push(randomGroup());
  const code = `PRI-${groups.join('-')}`;
  const inviteId = id('inv');
  const expiresAt = now + ttlDays * DAY_MS;
  db.prepare(`INSERT INTO teacher_invites(id, code_hash, code_prefix, created_by, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)`).run(inviteId, sha256(code), code.slice(0, 8), createdBy || null, now, expiresAt);
  return { id: inviteId, code, expiresAt };
}

export function listTeacherInvites(db, limit = 200) {
  return db.prepare(`SELECT id, code_prefix, created_at, expires_at, used_by, used_at FROM teacher_invites
    ORDER BY created_at DESC LIMIT ?`).all(limit).map(row => {
    const item = { id: row.id, code_prefix: row.code_prefix, createdAt: row.created_at, expiresAt: row.expires_at };
    if (row.used_at) {
      item.usedAt = row.used_at;
      item.usedBy = row.used_by || null;
    }
    return item;
  });
}

/** Look up a live (unused, unexpired) invite without consuming it. */
export function findLiveTeacherInvite(db, code, now = Date.now()) {
  const normalized = normalizeInviteCode(code);
  if (!normalized) return null;
  return db.prepare('SELECT id, expires_at FROM teacher_invites WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?')
    .get(sha256(normalized), now) || null;
}

/**
 * Consume a live invite for a newly created account. Returns true when this
 * call was the one that used it; false when it was invalid, expired or already
 * used. Intended to run inside the registration transaction.
 */
export function consumeTeacherInvite(db, code, accountId, now = Date.now()) {
  const normalized = normalizeInviteCode(code);
  if (!normalized) return false;
  const info = db.prepare(`UPDATE teacher_invites SET used_by = ?, used_at = ?
    WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?`).run(accountId, now, sha256(normalized), now);
  return info.changes === 1;
}
