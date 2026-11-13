// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the Exam Desk's calls (server/platform/desk.js, /v1/desk)
//
// Every call goes through the audited transport to the desk's own routes and
// nowhere else: nothing here reaches the marked papers, practice, the reader
// or any checking route (server/test/desk-isolation-check.mjs walks this
// folder's imports to prove it).
//
// EVERY REPLY MUST SAY IT IS UNMARKED. The server puts `mode: 'unmarked'` on
// each reply and on each attempt; a reply without it is refused here and never
// drawn, so nothing that is not unmarked practice can appear on a desk screen.
//
// A clock call carries an intent and the attempt's revision. Never a time.
// ─────────────────────────────────────────────────────────────────────────────
import { cloudRequest } from '../platform/cloudTransport.js';
import { EDITIONS } from '../../edition.config.mjs';

/**
 * The public practice-desk website an attempt can be brought in from
 * (engine/deskImport.js), named as its edition is named in
 * client/edition.config.mjs: the string catalogue never spells an edition's
 * name. It is the same site whichever edition this build is.
 */
export const IMPORT_SITE = EDITIONS.prithagoras.brand;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const RESOURCE_ID = /^[a-z0-9][a-z0-9-]{2,119}$/;
export const isAttemptId = id => UUID.test(String(id || ''));
export const INTENTS = Object.freeze(['begin-reading', 'begin-working', 'pause', 'resume', 'finish']);

const refuse = (code, message) => Promise.reject(Object.assign(new Error(message), { code, status: 404 }));
const notFound = () => refuse('DESK_ATTEMPT_NOT_FOUND', 'This practice attempt does not belong to this account.');

/** A reply the desk may draw: it, and any attempt in it, is unmarked practice. */
export function unmarked(data) {
  const attempt = data?.attempt;
  const ok = data?.mode === 'unmarked' && (!attempt || (attempt.mode === 'unmarked' && attempt.kind === 'desk-attempt'))
    && (!Array.isArray(data.attempts) || data.attempts.every(a => a?.mode === 'unmarked' && a?.kind === 'desk-attempt'));
  if (!ok) throw Object.assign(new Error('The desk only shows unmarked practice.'), { code: 'DESK_MODE_INVALID' });
  return data;
}

/** A fresh idempotency key: one per press of Start or Add, kept for its retries. */
export function newKey() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return `desk-${[...bytes].map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

export const deskApi = Object.freeze({
  /** Whose desk this is: the signed-in account's id (the device cache is kept per account). */
  account: () => cloudRequest('/v1/account/me').then(data => String(data?.account?.id || '')),
  start: (resourceId, idempotencyKey) => (RESOURCE_ID.test(String(resourceId || ''))
    ? cloudRequest('/v1/desk/attempts', { method: 'POST', body: { resourceId }, idempotencyKey }).then(unmarked)
    : refuse('DESK_PAPER_NOT_FOUND', 'This paper is not in your library.')),
  list: () => cloudRequest('/v1/desk/attempts').then(unmarked),
  read: id => (isAttemptId(id) ? cloudRequest(`/v1/desk/attempts/${id}`).then(unmarked) : notFound()),
  clock: (id, intent, rev, early = false) => (isAttemptId(id) && INTENTS.includes(intent)
    ? cloudRequest(`/v1/desk/attempts/${id}/clock`, { method: 'POST', body: { intent, rev, ...(early ? { early: true } : {}) } }).then(unmarked)
    : notFound()),
  questions: (id, changes) => (isAttemptId(id)
    ? cloudRequest(`/v1/desk/attempts/${id}/questions`, { method: 'PATCH', body: { changes } }).then(unmarked)
    : notFound()),
  remove: id => (isAttemptId(id) ? cloudRequest(`/v1/desk/attempts/${id}`, { method: 'DELETE', body: { confirm: id } }) : notFound()),
  importPreview: file => cloudRequest('/v1/desk/import/preview', { method: 'POST', body: { export: file } }).then(unmarked),
  importAdd: (file, idempotencyKey) => cloudRequest('/v1/desk/import', { method: 'POST', body: { export: file }, idempotencyKey }).then(unmarked)
});

/**
 * Whether a failed call never reached the server (offline, timed out, no
 * server found): a transport failure carries no HTTP status and no code of
 * ours. A reply the desk itself refused (DESK_MODE_INVALID) is not "offline".
 */
export const unreachable = err => err?.code === 'CLOUD_DISABLED' || (!err?.status && typeof err?.code !== 'string');
