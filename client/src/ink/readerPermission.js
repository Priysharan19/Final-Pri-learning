// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the student's permission before anything is read (D17)
//
// Owner default D17 (docs/release/V1_DECISIONS_2026-11-01.md): a one-time
// prompt naming OpenAI appears before the first handwriting read or photo.
// Nothing leaves the device until the student accepts, and declining keeps
// them on typed answers.
//
// This module is the record and the gate; ReaderPermission.jsx is the prompt.
//
//   · The record is per local profile and per wording version, kept on this
//     device. A profile that has not accepted THIS version has not accepted.
//   · askReaderPermission() resolves 'accepted' only when the student pressed
//     the accept button of the prompt (now or before). Every other path —
//     declined, dismissed, no prompt on screen to ask with, storage that
//     cannot be read — is not acceptance, and the caller sends nothing.
//   · The wording is pending counsel (D17). It lives in the string catalogue
//     under `readerPermission.*` (client/src/i18n/strings.en.js and .hi.js).
//     A change that alters what the student is told must bump
//     READER_PERMISSION_VERSION, so every student is asked again.
//
// Nothing here talks to the network.
// ─────────────────────────────────────────────────────────────────────────────

/** Bump when the prompt's wording changes what the student is agreeing to. */
export const READER_PERMISSION_VERSION = 1;

export const READER_PERMISSION_STORAGE_KEY = 'pri-reader-permission-v1';

export const READER_PERMISSION = Object.freeze({
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  UNASKED: 'unasked'
});

/** What a prompt can answer. Only ACCEPTED lets a read go ahead. */
export const PROMPT_ANSWER = Object.freeze({
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  DISMISSED: 'dismissed',
  // No prompt is mounted to ask with (a page outside the app shell, a test
  // runtime with no DOM). Never treated as consent.
  UNAVAILABLE: 'unavailable'
});

/**
 * Dispatched on window when the prompt opens or closes: the native PencilKit
 * surface (drawn above the web view) is laid out again, out of the dialog's
 * way while it is open (native.js modalCoversInk).
 */
export const MODAL_EVENT = 'pri:modal-change';

/** What is being read, so the prompt can say it in the student's terms. */
export const READ_KINDS = Object.freeze(['ink', 'photo', 'question-photo']);

// A device whose storage throws (a private window, a locked-down WebView)
// still gets one honest answer per session: what the student pressed is kept
// in memory, and asked again next launch.
const memory = new Map();

const profileKey = user => `p:${user?.id ?? 'none'}`;

function readAll(storage) {
  const raw = storage?.getItem?.(READER_PERMISSION_STORAGE_KEY);
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

const defaultStorage = () => {
  try { return globalThis.localStorage ?? null; } catch { return null; }
};

/**
 * This profile's answer to the current wording: 'accepted', 'declined' or
 * 'unasked'. An answer to an older version, a malformed record or storage
 * that cannot be read is 'unasked'.
 */
export function readerPermission(user, { storage = defaultStorage() } = {}) {
  const key = profileKey(user);
  let record = memory.get(key) || null;
  try {
    const stored = readAll(storage)[key];
    if (stored) record = stored;
  } catch { /* unreadable storage: only this session's answer counts */ }
  if (!record || record.version !== READER_PERMISSION_VERSION) return READER_PERMISSION.UNASKED;
  if (record.choice === READER_PERMISSION.ACCEPTED) return READER_PERMISSION.ACCEPTED;
  if (record.choice === READER_PERMISSION.DECLINED) return READER_PERMISSION.DECLINED;
  return READER_PERMISSION.UNASKED;
}

/** Keep what the student pressed. Returns the record written. */
export function recordReaderPermission(user, choice, { storage = defaultStorage(), now = Date.now() } = {}) {
  if (choice !== READER_PERMISSION.ACCEPTED && choice !== READER_PERMISSION.DECLINED) {
    throw new TypeError(`reader permission is accepted or declined, not ${JSON.stringify(choice)}`);
  }
  const key = profileKey(user);
  const record = Object.freeze({ choice, version: READER_PERMISSION_VERSION, at: new Date(now).toISOString() });
  memory.set(key, record);
  try {
    const all = readAll(storage);
    all[key] = record;
    storage?.setItem?.(READER_PERMISSION_STORAGE_KEY, JSON.stringify(all));
  } catch { /* kept in memory for this session */ }
  return record;
}

/** Forget this profile's answer (the profile was deleted, or a test resets). */
export function forgetReaderPermission(user, { storage = defaultStorage() } = {}) {
  const key = profileKey(user);
  memory.delete(key);
  try {
    const all = readAll(storage);
    if (key in all) {
      delete all[key];
      storage?.setItem?.(READER_PERMISSION_STORAGE_KEY, JSON.stringify(all));
    }
  } catch { /* nothing more to forget */ }
}

// The prompt on screen. ReaderPermission.jsx registers one while the app is
// mounted; a test registers its own. With none, nobody can be asked.
let prompt = null;
let pending = null;

/** Register the function that shows the prompt; returns the unregister. */
export function setReaderPermissionPrompt(fn) {
  const mine = typeof fn === 'function' ? fn : null;
  prompt = mine;
  return () => { if (prompt === mine) prompt = null; };
}

/** True while a prompt is open and waiting for the student. */
export function readerPermissionPending() { return pending !== null; }

/**
 * Ask, unless this profile already accepted the current wording. Resolves to
 * one of PROMPT_ANSWER; only 'accepted' lets the caller send anything. One
 * prompt at a time: a second caller while it is open waits for the same
 * answer instead of stacking a second sheet.
 */
export async function askReaderPermission(user, { kind = 'ink', storage = defaultStorage(), ask = null } = {}) {
  if (readerPermission(user, { storage }) === READER_PERMISSION.ACCEPTED) return PROMPT_ANSWER.ACCEPTED;
  const show = typeof ask === 'function' ? ask : prompt;
  if (!show) return PROMPT_ANSWER.UNAVAILABLE;
  if (pending) return pending;
  const readKind = READ_KINDS.includes(kind) ? kind : 'ink';
  pending = (async () => {
    let answer;
    try { answer = await show({ kind: readKind, user }); } catch { answer = PROMPT_ANSWER.DISMISSED; }
    if (answer === PROMPT_ANSWER.ACCEPTED) {
      recordReaderPermission(user, READER_PERMISSION.ACCEPTED, { storage });
      return PROMPT_ANSWER.ACCEPTED;
    }
    if (answer === PROMPT_ANSWER.DECLINED) {
      recordReaderPermission(user, READER_PERMISSION.DECLINED, { storage });
      return PROMPT_ANSWER.DECLINED;
    }
    return answer === PROMPT_ANSWER.UNAVAILABLE ? PROMPT_ANSWER.UNAVAILABLE : PROMPT_ANSWER.DISMISSED;
  })();
  try { return await pending; } finally { pending = null; }
}

/** The outcome a read reports when the student has not accepted: nothing was sent. */
export function notPermittedOutcome(answer) {
  return Object.freeze({ reason: answer === PROMPT_ANSWER.DECLINED ? 'declined' : 'not-permitted', permission: answer });
}
