// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a paper the server owns, as the device holds it
//
// Owner decision 2026-10-10: every examination mark is decided on the server
// (server/platform/exams.js). Both exam backends — local/indiaExamBackend.js
// for CBSE/JEE/IOQM papers and local/backend.js for the practice paper — keep
// a paper as one row in the `exams` store exactly as before, with one field
// more: `server`, which names the server's exam and question ids. This module
// is everything the two backends share about that:
//
//   · STARTING. The device composes a spec and the server issues the paper.
//     Without a signed-in eligible account or a connection the start is
//     refused with the same coded errors a practice check uses
//     (checkUnavailable in backend.js): SIGN_IN_TO_CHECK, RECONNECT_TO_CHECK,
//     or the server's own eligibility code. A start whose reply was lost is
//     retried under the same idempotency key, so it is the same paper.
//
//   · THE DEVICE HOLDS NO ANSWER. Question rows keep the public payload only.
//
//   · CHECKPOINTS. Every local autosave is also sent to the server a moment
//     later. A failed send is retried; it never fails or delays the local
//     save. The server refuses an older revision, so a late retry is harmless.
//
//   · FINISHING. The server marks. If it cannot be reached — or the session
//     has lapsed — the submission is queued on the paper (`pendingFinish`), the
//     paper is frozen, and no score exists until the server's result arrives.
//     A queued finish that reaches the server after the paper's time (plus the
//     server's grace) is marked on the last checkpoint the server holds.
//
//   · RECONCILING. Opening a paper asks the server for its state: a result
//     another device produced is adopted, a newer snapshot replaces the local
//     one, and the local deadline is never later than the server's.
//
// Nothing here marks an answer. The engine's checker is not imported.
// ─────────────────────────────────────────────────────────────────────────────
import { get, put, byIndex } from './idb.js';
import { cloud } from '../platform/cloudTransport.js';
import { profileCloudAccountId } from './entitlementGate.js';
import { checkUnavailable, withExamLock } from './backend.js';
import { examMarkingInputs, ensureExamClock } from './examSession.js';

/** How long after a local autosave its checkpoint is sent. */
export const CHECKPOINT_DEBOUNCE_MS = 1500;
const CHECKPOINT_RETRY_MS = [4000, 8000, 15000, 30000, 60000];
const START_RETRY_WINDOW_MS = 10 * 60 * 1000;
const RECONCILE_EVERY_MS = 3000;
// Opening a paper never waits long on a hanging connection: local state stands.
const RECONCILE_TIMEOUT_MS = 6000;
const RECONCILE_FINISH_TIMEOUT_MS = 10000;
// Under continuous typing the server is sent a checkpoint at most this often.
const CHECKPOINT_MIN_INTERVAL_MS = 4000;
const SUBMISSION_KEY = /^[a-zA-Z0-9_-]{8,100}$/;

const monotonic = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

export const isServerPaper = exam => !!exam?.server?.examId;
/**
 * Who a finished paper's marks come from, as far as this device can vouch:
 *   'server'           the server's stored result;
 *   'backup'           a server paper restored from a backup file whose score
 *                      the server has not confirmed yet;
 *   'earlier-version'  marked on the device by an earlier app version.
 * Only the first is a certified result.
 */
export const markedByOf = exam => (!exam?.finishedAt ? null
  : !isServerPaper(exam) ? 'earlier-version'
    : exam.server.restored ? 'backup' : 'server');

function randomKey(prefix) {
  let id = '';
  try { id = globalThis.crypto?.randomUUID?.() || ''; } catch { id = ''; }
  return `${prefix}-${id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`}`;
}

/** Why the server could not be used just now, in checkUnavailable's words — or null for a real refusal. */
export function unavailableKind(cause) {
  const status = Number(cause?.status) || 0;
  if (status === 401) return 'sign-in';
  if (status === 403 || status === 426) return 'refused';
  if (cause?.code === 'CLOUD_DISABLED' || !status || status >= 500 || status === 429) return 'offline';
  return null;
}

/** The account this profile is signed in to, or the sign-in refusal. */
export async function requireExamAccount(pid) {
  const linked = await profileCloudAccountId(pid).catch(() => null);
  if (!linked) throw checkUnavailable('sign-in');
  return linked;
}

// ── Starting ─────────────────────────────────────────────────────────────────

const startRowId = pid => `exam-start:${pid}`;

/**
 * The layout seed the server has set for this account's next paper of a
 * blueprint (POST /v1/exams/layout). The device composes its spec for this
 * seed; the server accepts no other, and returns the same one until a paper is
 * sealed under it. Throws the same refusals a start does when the server
 * cannot be used.
 */
export async function issueExamLayout(pid, blueprint) {
  const linked = await requireExamAccount(pid);
  let out;
  try { out = await cloud.examLayout({ blueprint }); }
  catch (cause) {
    const kind = unavailableKind(cause);
    if (kind) throw checkUnavailable(kind, cause);
    throw Object.assign(new Error(cause?.message || 'This paper could not be started.'), { status: cause?.status || 502, code: cause?.code || 'EXAM_START_FAILED' });
  }
  // The session may belong to another profile's account on a shared iPad.
  if (String(out?.accountId || '') !== linked) throw checkUnavailable('sign-in');
  const seed = Number(out?.layoutSeed);
  if (!Number.isInteger(seed) || seed < 1 || seed > 0x7fffffff) throw checkUnavailable('unavailable');
  return seed;
}

/**
 * Have the server issue a paper from `spec`. `signature` identifies what the
 * student asked for (track, class, length…): a start that failed after the
 * request left is retried with the SAME spec and idempotency key for a few
 * minutes, so a lost reply cannot leave two papers behind. `meta` is whatever
 * the caller wants back alongside the spec that was really sent.
 * Returns the server's public paper, with `composed` = that meta.
 */
export async function issueServerExam(pid, spec, signature, meta = null) {
  const linked = await requireExamAccount(pid);
  const now = Date.now();
  const held = await get('device', startRowId(pid)).catch(() => null);
  const reuse = held && held.signature === signature && held.accountId === linked && now - Number(held.at) < START_RETRY_WINDOW_MS && now >= Number(held.at);
  const attempt = reuse ? held : { id: startRowId(pid), pid, signature, accountId: linked, key: randomKey('exam-start'), spec, meta, at: now };
  if (!reuse) await put('device', attempt).catch(() => {});
  let out;
  try { out = await cloud.createExam(attempt.spec, attempt.key); }
  catch (cause) {
    const kind = unavailableKind(cause);
    // Only an uncertain outcome is worth retrying under the same key.
    if (kind !== 'offline') await put('device', { id: startRowId(pid), pid, signature: null }).catch(() => {});
    if (kind) throw checkUnavailable(kind, cause);
    // The server is the authority on the plan: its refusal (the free
    // simulation is used, or the track is Premium) is shown as it stands, in
    // the shape the paywall already reads, whatever this device had counted.
    if (cause?.status === 402 && (cause.code === 'FREE_CAP_REACHED' || cause.code === 'PREMIUM_REQUIRED')) {
      throw Object.assign(new Error(cause.message), {
        status: 402, code: cause.code, capability: cause.capability || null, reason: 'server-refused', refreshRequired: true,
        ...(cause.nextAt ? { nextAt: cause.nextAt, used: cause.used, limit: cause.limit, windowDays: cause.windowDays } : {})
      });
    }
    // The account already holds its limit of open papers: say which, so the
    // student can carry on with it instead.
    if (cause?.code === 'EXAM_OPEN_PAPER_LIMIT') {
      const exams = await byIndex('exams', 'pid', pid).catch(() => []);
      const local = exams.find(e => e?.server?.examId === cause.openExamId && !e.finishedAt);
      throw Object.assign(new Error(cause.message), { status: 409, code: cause.code, openExamId: local?.id || null, limit: cause.limit ?? null });
    }
    throw Object.assign(new Error(cause?.message || 'This paper could not be started.'), { status: cause?.status || 502, code: cause?.code || 'EXAM_START_FAILED' });
  }
  await put('device', { id: startRowId(pid), pid, signature: null }).catch(() => {});
  // The session may belong to another profile's account on a shared iPad.
  if (String(out?.accountId || '') !== linked) throw checkUnavailable('sign-in');
  const exam = out?.exam;
  if (!exam?.id || !Array.isArray(exam.questions) || !exam.questions.length) throw checkUnavailable('unavailable');
  // `composed` is what the device knew about the spec that was actually sent —
  // the retried one's, when a retry reused it.
  return { ...exam, composed: attempt.meta ?? meta };
}

/**
 * When the paper started, on this device's clock: now, less however long the
 * server says the paper has already been running (nothing for a new paper;
 * minutes for a start that was retried). The local deadline is then the
 * server's, read on this device.
 */
export const localStartOf = (issued, now = Date.now()) => now - Math.max(0, Number(issued.now) - Number(issued.startedAt) || 0);

/** The `server` field a freshly issued paper's row carries. */
export function serverFieldOf(issued, accountId = null) {
  return {
    examId: String(issued.id), kind: issued.kind, accountId,
    questionIds: issued.questions.map(q => String(q.id)),
    startedAt: issued.startedAt, deadline: issued.deadline, graceMs: issued.graceMs,
    savedRev: 0, savedAt: null
  };
}

// ── Answer keys ──────────────────────────────────────────────────────────────
// Local question ids equal the server's when a paper is issued. A restored
// backup re-mints local ids, so the mapping is by position, never assumed.

function idMaps(exam) {
  const toServer = new Map();
  const toLocal = new Map();
  (exam.questionIds || []).forEach((local, i) => {
    const remote = exam.server?.questionIds?.[i];
    if (remote) { toServer.set(String(local), String(remote)); toLocal.set(String(remote), String(local)); }
  });
  return { toServer, toLocal };
}

const rekey = (key, map) => {
  const [qid, ...rest] = String(key).split('::');
  const mapped = map.get(qid);
  return mapped ? [mapped, ...rest].join('::') : null;
};

function rekeyMap(source, map, allowed = null) {
  const out = {};
  for (const [key, value] of Object.entries(source || {})) {
    const next = rekey(key, map);
    if (next && (!allowed || allowed.has(key))) out[next] = value;
  }
  return out;
}

/** Every answer key the paper owns, from the public rows the device holds. */
async function ownKeys(exam) {
  const keys = new Set();
  for (const qid of exam.questionIds || []) {
    const q = (await get('questions', qid).catch(() => null))?.payload;
    if (!q) continue;
    if (q.multipart) {
      for (const part of q.parts || []) { keys.add(`${qid}::${part.key}`); if (part.alt) keys.add(`${qid}::${part.key}::or`); }
    } else { keys.add(String(qid)); if (q.alt) keys.add(`${qid}::or`); }
  }
  return keys;
}

async function wireResponses(exam, responses) {
  const { toServer } = idMaps(exam);
  const keys = await ownKeys(exam);
  const text = map => Object.fromEntries(Object.entries(rekeyMap(map, toServer, keys))
    .filter(([, v]) => typeof v === 'string' && v.trim() !== ''));
  const times = {};
  for (const [qid, ms] of Object.entries(responses?.times || {})) {
    const remote = toServer.get(String(qid));
    if (remote && Number.isFinite(Number(ms)) && Number(ms) >= 0) times[remote] = Math.round(Number(ms));
  }
  // Handwritten pages not read: the digest of each picture, never the picture.
  const ink = {};
  for (const [key, page] of Object.entries(responses?.pages || {})) {
    const remote = rekey(key, toServer);
    if (remote && keys.has(key) && page?.digest && String(responses?.answers?.[key] ?? '').trim() === '') ink[remote] = page.digest;
  }
  return {
    answers: text(responses?.answers), workings: text(responses?.workings), times, modes: rekeyMap(responses?.modes, toServer, keys),
    ...(Object.keys(ink).length ? { ink } : {})
  };
}

// ── Clock ────────────────────────────────────────────────────────────────────

/** The local deadline is never later than the server's: remaining time comes from its clock. */
function clampDeadline(exam, remainingMs) {
  if (!Number.isFinite(Number(remainingMs)) || !Number.isFinite(exam.deadlineAt)) return false;
  ensureExamClock(exam, Date.now());
  const byServer = exam.latestSeenAt + Math.max(0, Number(remainingMs));
  if (byServer + 2000 >= exam.deadlineAt) return false;
  exam.deadlineAt = byServer;
  return true;
}

// ── Checkpoints ──────────────────────────────────────────────────────────────

const checkpoints = new Map();   // local exam id → { timer, failures, running }

function arm(examId, delay) {
  const state = checkpoints.get(examId) || { timer: null, failures: 0, running: null, sentAt: 0 };
  if (state.timer) clearTimeout(state.timer);
  // An urgent send (delay 0: the page is hiding) goes now; anything else keeps
  // its distance from the last one.
  if (delay > 0 && state.sentAt) delay = Math.max(delay, state.sentAt + CHECKPOINT_MIN_INTERVAL_MS - monotonic());
  state.timer = setTimeout(() => { state.timer = null; checkpointNow(examId).catch(() => {}); }, delay);
  // A pending checkpoint never keeps a test process or a closing tab alive.
  state.timer?.unref?.();
  checkpoints.set(examId, state);
}

/** Send this paper's current answers to the server shortly. Never throws. */
export function scheduleCheckpoint(examId, delay = CHECKPOINT_DEBOUNCE_MS) {
  try { arm(String(examId), delay); } catch { /* the local save has already succeeded */ }
}

/**
 * Send the latest local snapshot now. Returns 'saved', 'current' (nothing
 * newer to send), 'closed' (the paper can no longer take answers) or 'retry'.
 */
export async function checkpointNow(examId) {
  const state = checkpoints.get(String(examId)) || { timer: null, failures: 0, running: null };
  checkpoints.set(String(examId), state);
  if (state.running) return state.running;
  state.running = (async () => {
    const exam = await get('exams', examId).catch(() => null);
    if (!isServerPaper(exam) || exam.finishedAt || exam.pendingFinish || exam.server.closed) return 'closed';
    const responses = exam.responses;
    const rev = Number(responses?.rev) || 0;
    if (!responses || rev <= (Number(exam.server.savedRev) || 0)) return 'current';
    let reply;
    try {
      reply = await cloud.saveExamAnswers(exam.server.examId, { ...(await wireResponses(exam, responses)), cur: Number(responses.cur) || 0, rev });
    } catch (cause) {
      if (unavailableKind(cause) || (cause?.status === 404 && cause?.code === 'EXAM_NOT_FOUND')) {
        // Offline, signed out, or briefly refused: keep trying, less often.
        arm(String(examId), CHECKPOINT_RETRY_MS[Math.min(state.failures++, CHECKPOINT_RETRY_MS.length - 1)]);
        return 'retry';
      }
      // Finalised elsewhere, out of time, or a snapshot the server will never
      // take: stop sending. Opening the paper reconciles what happened.
      await withExamLock(examId, async () => {
        const fresh = await get('exams', examId).catch(() => null);
        if (!isServerPaper(fresh) || fresh.finishedAt) return;
        if (cause?.status === 400) fresh.server.savedRev = Math.max(Number(fresh.server.savedRev) || 0, rev);
        else fresh.server.closed = cause?.code || 'closed';
        await put('exams', fresh);
      });
      return 'closed';
    }
    state.failures = 0;
    state.sentAt = monotonic();
    let again = false;
    await withExamLock(examId, async () => {
      const fresh = await get('exams', examId).catch(() => null);
      if (!isServerPaper(fresh) || fresh.finishedAt) return;
      fresh.server.savedRev = Math.max(Number(fresh.server.savedRev) || 0, Number(reply?.rev) || rev);
      if (Number.isFinite(Number(reply?.savedAt))) fresh.server.savedAt = Number(reply.savedAt);
      clampDeadline(fresh, reply?.remainingMs);
      again = (Number(fresh.responses?.rev) || 0) > fresh.server.savedRev;
      await put('exams', fresh);
    });
    if (again) arm(String(examId), CHECKPOINT_DEBOUNCE_MS);
    return 'saved';
  })().finally(() => { state.running = null; });
  return state.running;
}

/** Send every pending checkpoint now (the page is hiding; a suite wants a settled state). */
export async function flushExamCheckpoints() {
  const ids = [...checkpoints.keys()];
  for (const id of ids) {
    const state = checkpoints.get(id);
    if (state?.timer) { clearTimeout(state.timer); state.timer = null; }
    await checkpointNow(id).catch(() => {});
    const after = checkpoints.get(id);
    if (after?.timer) { clearTimeout(after.timer); after.timer = null; }
  }
}

// ── Finishing ────────────────────────────────────────────────────────────────

const QUEUED = {
  offline: 'Your paper is submitted and will be marked when you are back online. It is not marked yet. If you reconnect after the paper’s time is up, the answers last saved to the server are the ones marked.',
  'sign-in': 'Your paper is submitted and will be marked when you sign in again. It is not marked yet. If you sign in after the paper’s time is up, the answers last saved to the server are the ones marked.',
  refused: 'Your paper is submitted, but this account cannot have it marked right now. It is not marked yet.'
};

/** What the room is told about a paper waiting to be marked. Carries no score. */
export function pendingView(exam) {
  const p = exam?.pendingFinish;
  if (!p) return null;
  return { pending: true, code: 'EXAM_FINISH_QUEUED', reason: p.cause, causeCode: p.code || null, queuedAt: p.queuedAt, message: QUEUED[p.cause] || QUEUED.offline };
}

/**
 * Finalise on the server. Returns { result } (the server's stored result) or
 * { pending } when it could not be reached and the submission is now queued on
 * the paper. Throws only for a refusal that retrying cannot change.
 * The caller holds the paper's lock and writes `exam` back.
 */
export async function finishOnServer(exam, body = {}, now = Date.now(), { timeoutMs = undefined } = {}) {
  if (!exam.pendingFinish) {
    // What the device sends is frozen at the first submit: a queued paper can
    // not be edited, and a retry sends exactly the same thing.
    const inputs = examMarkingInputs(exam, body, now);
    exam.pendingFinish = {
      submissionKey: typeof body.submissionKey === 'string' && SUBMISSION_KEY.test(body.submissionKey) ? body.submissionKey : randomKey('exam-finish'),
      // The key the room sent, kept as sent, so its own retry is recognised.
      clientKey: typeof body.submissionKey === 'string' ? body.submissionKey.slice(0, 100) : null,
      reason: inputs.finalisedBy === 'deadline' ? 'deadline' : 'student',
      queuedAt: exam.latestSeenAt || now,
      inputs: {
        answers: inputs.answers, workings: inputs.workings, times: inputs.times, ms: Math.max(0, Math.round(Number(inputs.ms) || 0)), modes: exam.responses?.modes || {},
        // The pictures of handwritten pages not read, frozen with the submit.
        pages: inputs.pages || {}
      },
      // The device's own reading of the paper's clock. Past its deadline it
      // sends only what was autosaved before it, and the paper is late whatever
      // clock the server reads.
      deviceLate: !!inputs.late, clockRolledBack: !!inputs.clockRolledBack,
      cause: null, code: null, attempts: 0
    };
  }
  const queued = exam.pendingFinish;
  queued.attempts = (Number(queued.attempts) || 0) + 1;
  try {
    const result = await cloud.finishExam(exam.server.examId, {
      ...(await wireResponses(exam, queued.inputs)), ms: queued.inputs.ms, reason: queued.reason, submissionKey: queued.submissionKey
    }, queued.submissionKey, timeoutMs);
    if (result?.authoritative !== true || !Array.isArray(result.detail) || !Number.isFinite(Number(result.score)) || !Number.isFinite(Number(result.total))) {
      throw Object.assign(new Error('The server did not return a certified result.'), { status: 502 });
    }
    // Handwriting that was never read is pending in that result, not blank.
    // The frozen pictures are presented now — once each — and whatever is
    // still waiting afterwards is kept on the paper for a later visit.
    return { result: await settleFrozenPages(exam, result, queued.inputs.pages) };
  } catch (cause) {
    // A paper the session's account does not own reads as not found: on a
    // shared iPad that is another profile's session, and signing in fixes it.
    const kind = cause?.status === 404 && cause?.code === 'EXAM_NOT_FOUND' ? 'sign-in' : unavailableKind(cause);
    if (!kind) {
      // The server will never mark this submission (the paper is not this
      // account's any more, or the request was malformed): do not sit on it.
      delete exam.pendingFinish;
      throw Object.assign(new Error(cause?.message || 'This paper could not be submitted.'), { status: cause?.status || 502, code: cause?.code || 'EXAM_FINISH_FAILED' });
    }
    queued.cause = kind;
    queued.code = kind === 'refused' ? (cause?.code || null) : null;
    return { pending: pendingView(exam) };
  }
}

// ── Handwriting not read when the paper closed ───────────────────────────────
// server/platform/exams.js freezes each such page by the digest of its picture
// and leaves its answer PENDING. This device holds the pictures. It presents
// each one to POST /v1/exams/:id/handwriting; the server reads it only if it is
// the frozen picture, at most a fixed number of times, and replaces only that
// answer's line. Nothing here marks, and nothing here can change what is read.

/** How many frozen pages are presented while the student waits on the submit. */
const INLINE_PAGE_READS = 6;
/** How often a finished paper with pages still waiting asks again when it is opened. */
export const HANDWRITING_RECOVERY_EVERY_MS = 60 * 1000;

/** The frozen pictures by the SERVER's answer key. */
function frozenImages(exam, pages) {
  const { toServer } = idMaps(exam);
  const out = {};
  for (const [key, page] of Object.entries(pages || {})) {
    const remote = rekey(key, toServer);
    if (remote && typeof page?.image === 'string') out[remote] = page.image;
  }
  return out;
}

/**
 * Present every frozen page that is waiting and may be asked for now. Returns
 * the latest result the server gave; the one passed in when nothing changed.
 */
export async function resolveFrozenHandwriting(examId, result, images, { now = Date.now(), limit = INLINE_PAGE_READS, transport = cloud } = {}) {
  let latest = result;
  let asked = 0;
  for (const key of Object.keys(result?.handwriting?.pages || {})) {
    const page = latest.handwriting?.pages?.[key];
    if (!page || page.state !== 'awaiting-reading' || !images?.[key] || asked >= limit) continue;
    // The server's own clock decides; this only saves sending a picture early.
    if (Number(page.nextAttemptAt) > now + 5000) continue;
    asked += 1;
    try {
      const reply = await transport.resolveExamHandwriting(examId, { key, image: images[key] });
      if (reply?.result?.authoritative === true && Array.isArray(reply.result.detail)) latest = reply.result;
    } catch (cause) {
      // Offline, signed out or refused for the account: the page stays frozen
      // and pending, and a later visit asks again. Nothing is retried here.
      if (unavailableKind(cause)) break;
    }
  }
  return latest;
}

/**
 * A result has just arrived for a paper whose frozen pages this device holds
 * (`pages`: local answer key → { digest, image }): present the ones that are
 * waiting, keep the pictures of any still waiting, and return the latest result.
 */
async function settleFrozenPages(exam, result, pages) {
  if (!result?.handwriting?.pages) return result;
  const images = frozenImages(exam, pages);
  const settled = await resolveFrozenHandwriting(exam.server.examId, result, images);
  keepFrozenPages(exam, settled, images);
  return settled;
}

/** Keep the pictures of pages that can still be read; forget the rest. */
export function keepFrozenPages(exam, result, images) {
  const waiting = {};
  for (const [key, page] of Object.entries(result?.handwriting?.pages || {})) {
    if (page.state === 'awaiting-reading' && images?.[key]) waiting[key] = images[key];
  }
  if (Object.keys(waiting).length) exam.server.handwriting = { pages: waiting };
  else delete exam.server.handwriting;
}

/**
 * Say, on the device's own detail lines, which answers are pending on
 * handwriting and why. `result` is the server's result with local ids
 * (localResult); `detail` is what the backend is about to store.
 */
export function markPendingLines(result, detail) {
  const pages = result?.handwriting?.pages || {};
  const byId = new Map((result?.detail || []).map(d => [String(d.id), d]));
  const flag = (target, source, key) => {
    delete target.pending; delete target.pendingState; delete target.pendingReason;
    if (source.pending) {
      const page = pages[key];
      target.pending = true;
      target.pendingState = page?.state === 'awaiting-reading' ? 'awaiting-reading' : 'needs-review';
      target.pendingReason = page?.reason || null;
    }
    if (source.readAfterClose) target.readAfterClose = true;
  };
  for (const line of detail || []) {
    const d = byId.get(String(line.id));
    if (!d) continue;
    const remote = d.serverQuestionId || d.id;
    if (d.multipart) {
      for (const part of line.parts || []) {
        const from = (d.parts || []).find(x => String(x.key) === String(part.key));
        if (from) flag(part, from, `${remote}::${from.key}${from.choiceTaken === 'or' ? '::or' : ''}`);
      }
      if ((line.parts || []).some(part => part.pending)) line.pending = true; else delete line.pending;
    } else flag(line, d, `${remote}${d.choiceTaken === 'or' ? '::or' : ''}`);
  }
  return detail;
}

const AMENDED = ['given', 'correct', 'unanswered', 'awarded', 'feedback', 'partial', 'working'];

/**
 * A page was read after the paper was adopted here: take the server's line for
 * each answer that was PENDING on this device, and nothing else. A line that
 * was not pending is never touched, whatever the server sends.
 */
export function applyHandwritingAmendment(exam, serverResult) {
  const result = localResult(exam, serverResult);
  const byId = new Map(result.detail.map(d => [String(d.id), d]));
  const take = (target, source) => {
    for (const field of AMENDED) if (source[field] !== undefined) target[field] = field === 'correct' || field === 'unanswered' ? !!source[field] : source[field];
    return target;
  };
  exam.detail = (exam.detail || []).map(line => {
    const d = byId.get(String(line.id));
    if (!d || !line.pending) return line;
    if (Array.isArray(line.parts)) {
      const parts = line.parts.map(part => {
        const from = (d.parts || []).find(x => String(x.key) === String(part.key));
        return part.pending && from && !from.pending ? take({ ...part }, from) : part;
      });
      return { ...line, parts, awarded: d.awarded, correct: !!d.correct, unanswered: !!d.unanswered };
    }
    return d.pending ? { ...line } : take({ ...line }, d);
  });
  markPendingLines(result, exam.detail);
  exam.score = result.score;
  exam.total = result.total;
  if (exam.summary && result.summary) exam.summary = result.summary;
  return exam;
}

const lastRecovery = new Map();   // local exam id → monotonic ms

/**
 * A finished paper that still holds frozen pages: ask the server how each
 * stands, present the ones it will take, and bring this device's copy up to
 * date. Returns true when the paper changed and must be written back. The
 * caller holds the paper's lock.
 */
export async function recoverHandwriting(exam, { force = false, transport = cloud } = {}) {
  const images = exam?.server?.handwriting?.pages;
  if (!isServerPaper(exam) || !exam.finishedAt || !images || !Object.keys(images).length) return false;
  const key = String(exam.id);
  if (!force && lastRecovery.has(key) && monotonic() - lastRecovery.get(key) < HANDWRITING_RECOVERY_EVERY_MS) return false;
  lastRecovery.set(key, monotonic());
  let remote;
  try { remote = await transport.getExam(exam.server.examId, RECONCILE_TIMEOUT_MS); } catch { return false; }
  if (remote?.state !== 'finished' || remote.result?.authoritative !== true || !Array.isArray(remote.result.detail)) return false;
  const settled = await resolveFrozenHandwriting(exam.server.examId, remote.result, images, { transport });
  const before = JSON.stringify([exam.score, exam.detail, exam.server.handwriting]);
  applyHandwritingAmendment(exam, settled);
  keepFrozenPages(exam, settled, images);
  return JSON.stringify([exam.score, exam.detail, exam.server.handwriting]) !== before;
}

// ── Results ──────────────────────────────────────────────────────────────────

/** The server's result with its question ids turned back into this device's. */
export function localResult(exam, result) {
  const { toLocal } = idMaps(exam);
  return { ...result, detail: (result.detail || []).map(d => ({ ...d, serverQuestionId: d.id, id: toLocal.get(String(d.id)) || String(d.id) })) };
}

/** When the paper was finalised: the server's time, never earlier than the paper's own. */
export const finishedAtOf = (exam, result) => Math.max(Number(result.finishedAt) || 0, Number(exam.latestSeenAt) || 0);

/** The responses the server marked, in the room's own key shape. */
export function markedResponses(detail) {
  const answers = {}, workings = {};
  for (const d of detail || []) {
    const put1 = (key, given, working) => { if (given) answers[key] = given; if (working) workings[key] = working; };
    if (d.multipart) for (const part of d.parts || []) put1(`${d.id}::${part.key}${part.choiceTaken === 'or' ? '::or' : ''}`, part.given, part.working);
    else put1(`${d.id}${d.choiceTaken === 'or' ? '::or' : ''}`, d.given, d.working);
  }
  return { answers, workings };
}

/** The frozen record of a server-marked paper, in the shape examSessionView reads. */
export function serverFinal(exam, result) {
  const inks = exam.responses?.inks || {};
  const marked = markedResponses(result.detail);
  const deviceLate = !!exam.pendingFinish?.deviceLate;
  const late = !!result.late || deviceLate;
  return {
    submittedAt: finishedAtOf(exam, result), serverFinishedAt: result.finishedAt,
    finalisedBy: late ? 'deadline' : result.finalisedBy, late,
    // What was marked: the server's own snapshot when it judged the finish
    // late; otherwise what this device sent — its autosave if its own clock
    // had passed the deadline, the submission's answers if not.
    inputSource: result.late ? result.inputSource : deviceLate ? 'autosave-before-deadline' : result.inputSource,
    clockRolledBack: !!exam.pendingFinish?.clockRolledBack || (Number(exam.clockRollbacks) || 0) > 0,
    markedBy: 'server', serverExamId: exam.server.examId,
    submissionKey: exam.pendingFinish?.clientKey || exam.pendingFinish?.submissionKey || null,
    paperVersion: result.paperVersion, startedPaperVersion: exam.paperVersion || null,
    paperVersionChanged: !!exam.paperVersion && exam.paperVersion !== result.paperVersion,
    deadlineAt: exam.deadlineAt, startedAt: exam.startedAt,
    responses: { answers: marked.answers, workings: marked.workings, times: { ...(exam.pendingFinish?.inputs?.times || exam.responses?.times || {}) } },
    inks: Object.fromEntries(Object.entries(inks).map(([k, v]) => [k, { strokes: v.strokes, lines: v.lines, answerLine: v.answerLine, engine: v.engine }]))
  };
}

// ── A paper sat on another device ────────────────────────────────────────────

/**
 * A finished server paper this device knows only by its result event (restored
 * through sync): the server's public paper and stored result, so History here
 * can show the questions and the marked detail. Null while it cannot be read.
 */
export async function fetchRemotePaper(exam) {
  if (!isServerPaper(exam) || !exam.server.remote) return null;
  let remote;
  try { remote = await cloud.getExam(exam.server.examId, RECONCILE_TIMEOUT_MS); } catch { return null; }
  if (remote?.state !== 'finished' || remote.result?.authoritative !== true || !Array.isArray(remote.exam?.questions)) return null;
  return { paper: remote.exam, result: remote.result };
}

// ── Reconciling ──────────────────────────────────────────────────────────────

const lastReconciled = new Map();   // local exam id → monotonic ms
/** A paper the device has just heard from the server about needs no second ask. */
export function noteReconciled(examId) { lastReconciled.set(String(examId), monotonic()); }

/**
 * Ask the server about an open paper. Returns:
 *   { result }   it is finalised there (this device's queued finish, or another device's)
 *   { pending }  a queued finish is still waiting
 *   { changed }  the local row was updated (deadline clamped, newer snapshot adopted)
 *   {}           nothing to do, or the server could not be reached (local state stands)
 * The caller holds the paper's lock and writes `exam` back when told to.
 */
export async function reconcileWithServer(exam, { force = false, rebuildRow = null } = {}) {
  if (!isServerPaper(exam)) return {};
  if (exam.finishedAt) {
    // A finished paper that came back from a backup file: its score is the
    // file's until the server says what it stored.
    if (!exam.server.restored) return {};
    let remote;
    try { remote = await cloud.getExam(exam.server.examId, RECONCILE_TIMEOUT_MS); } catch { return {}; }
    if (remote?.state !== 'finished' || remote.result?.authoritative !== true) return {};
    exam.score = Number(remote.result.score);
    exam.total = Number(remote.result.total);
    exam.server.restored = false;
    return { changed: true };
  }
  if (exam.pendingFinish) {
    const out = await finishOnServer(exam, {}, Date.now(), { timeoutMs: RECONCILE_FINISH_TIMEOUT_MS }).catch(() => ({ pending: pendingView(exam) }));
    return out.result ? { result: out.result } : { pending: out.pending || null, changed: true };
  }
  const key = String(exam.id);
  // A question row the device has lost (a truncated restore, an interrupted
  // delete) is still on the paper: the server holds it, and it is put back.
  const missing = [];
  if (rebuildRow) {
    for (const [i, qid] of (exam.questionIds || []).entries()) {
      if (!(await get('questions', qid).catch(() => null))) missing.push(i);
    }
  }
  if (!force && !missing.length && !exam.server.restored && lastReconciled.has(key) && monotonic() - lastReconciled.get(key) < RECONCILE_EVERY_MS) return {};
  let remote;
  try { remote = await cloud.getExam(exam.server.examId, RECONCILE_TIMEOUT_MS); } catch { return {}; }
  noteReconciled(key);
  let changed = false;
  for (const i of missing) {
    const sq = (remote?.exam?.questions || []).find(q => String(q.id) === String(exam.server.questionIds?.[i]));
    if (sq) { await put('questions', rebuildRow(sq, exam.questionIds[i])); changed = true; }
  }
  // Finalised elsewhere — by another device, or by the server itself once the
  // paper's time had passed. Handwriting this device froze and the server left
  // pending is presented now, from the pictures saved before the deadline.
  if (remote?.state === 'finished' && remote.result?.authoritative === true) return { result: await settleFrozenPages(exam, remote.result, exam.responses?.pages) };
  if (remote?.state !== 'open') return { changed };
  if (exam.server.restored) { exam.server.restored = false; changed = true; }
  changed = clampDeadline(exam, remote.exam?.remainingMs) || changed;
  const snapshot = remote.snapshot;
  const localRev = Number(exam.responses?.rev) || 0;
  if (snapshot && Number(snapshot.rev) > localRev) {
    // Another device has carried this paper further: its answers are the paper's.
    const { toLocal } = idMaps(exam);
    exam.responses = {
      ...(exam.responses || {}),
      answers: rekeyMap(snapshot.answers, toLocal), workings: rekeyMap(snapshot.workings, toLocal),
      times: rekeyMap(snapshot.times, toLocal), modes: rekeyMap(snapshot.modes, toLocal),
      inks: exam.responses?.inks || {}, cur: Number(snapshot.cur) || 0, rev: Number(snapshot.rev), savedAt: exam.latestSeenAt || Date.now()
    };
    exam.server.savedRev = Number(snapshot.rev);
    exam.server.savedAt = Number(snapshot.savedAt) || null;
    changed = true;
  } else if (snapshot && Number(snapshot.rev) > (Number(exam.server.savedRev) || 0)) {
    exam.server.savedRev = Number(snapshot.rev);
    changed = true;
  }
  // The server holds less than this device does: send it.
  if (localRev > (Number(exam.server.savedRev) || 0) && !remote.expired) scheduleCheckpoint(exam.id, 50);
  return { changed };
}
