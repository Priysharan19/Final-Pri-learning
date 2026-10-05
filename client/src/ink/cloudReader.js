// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · asking a server to read the ink
//
// The on-device reader has 58 classes and no comma, so a line like
// "−1, 0, 1, 2, 4" cannot come back right however well it is written. This is
// the other route, and it runs only when the student has turned it on.
//
// Four rules hold it in place:
//
//   1. On by default only where it can work and may lawfully run: a signed-in
//      account on a deployment whose /v1/handwriting/status says it is usable
//      (online-first ADR-0001). The server refuses that status to a minor
//      without a confirmed guardian (requireGuardianConsent), so such an account
//      stays off. An explicit "off" in Settings is always respected; a profile
//      that never chose is the only one the default applies to.
//   2. It never replaces a reading the student has corrected by hand. A tap to
//      fix a glyph is the most reliable signal on the page.
//   3. It only supersedes when the server says it is confident. An unconfident
//      server read is offered for confirmation, never marked.
//   4. The local reading is published first and always. The student writes and
//      sees their working immediately; the server read arrives after, or not
//      at all, and the app is usable either way.
//
// The picture is drawn from the student's own strokes by cloudRaster.js. This
// module adds nothing to it, and sends nothing beside it.
// ─────────────────────────────────────────────────────────────────────────────
import { cloud, cloudAvailable } from '../platform/cloudTransport.js';
import { rasterizeInk } from './cloudRaster.js';
import { onCloudSessionChange, onEntitlementChange } from '../platform/cloudSession.js';
import { preparePhoto } from './photoRaster.js';

/** How the returned reading is labelled, so History and evidence can tell. */
export const CLOUD_ENGINE_PREFIX = 'cloud';

const READINESS_TTL_MS = 60_000;
// A non-ready answer is remembered only briefly: an outage, a missing ceiling
// or a 429 must not keep cloud reading off for a full minute (or longer) after
// the deployment has recovered. Errors are never cached at all.
export const UNAVAILABLE_READINESS_TTL_MS = 15_000;
// The cached answer belongs to one account state. A status learned while the
// student was signed out (or before their email was verified) must never be
// served after they sign in on the same page: the cache is keyed by the
// readiness identity below and dropped outright on every session change.
// Production 2026-10-05 (iPad): a student wrote signed out, registered on the
// same device and was told the reader "isn't answering" — no status or
// transcribe request ever left the device after sign-in.
let readinessCache = { expiresAt: 0, value: null, identity: null };

/**
 * Who a readiness answer is for: the local profile, whether it is linked to a
 * cloud account, and the explicit Settings choice. Any change in these is a
 * change in what the server would answer, so a cached answer no longer holds.
 */
export function readinessIdentity(user) {
  return [
    String(user?.id ?? ''),
    user?.cloudLinked === true ? 'linked' : 'unlinked',
    user?.isDemo === true ? 'demo' : 'real',
    cloudReadingChoice(user)
  ].join('|');
}

/** Forget any cached readiness; the next read asks the server again. */
export function clearCloudHandwritingReadiness() {
  readinessCache = { expiresAt: 0, value: null, identity: null };
}
// The server said this account's daily cloud-reading allowance is used up
// (SEC-COMM-01). Until it resets, no doomed request is sent; an entitlement
// change (an upgrade) clears it at once.
let allowanceExhaustedUntil = 0;
export const ALLOWANCE_CODE = 'AI_ALLOWANCE_EXHAUSTED';
export function cloudAllowanceExhausted(now = Date.now()) { return now < allowanceExhaustedUntil; }
export function clearCloudAllowanceExhausted() { allowanceExhaustedUntil = 0; }
function noteAllowance(error, now = Date.now()) {
  if (error?.code !== ALLOWANCE_CODE) return;
  const reset = Number(error.resetAt);
  // Trust a sane reset time from the server; otherwise back off for 30 minutes.
  allowanceExhaustedUntil = Number.isFinite(reset) && reset > now && reset - now <= 25 * 60 * 60 * 1000 ? reset : now + 30 * 60 * 1000;
}
let listening = false;
function listenForAccountChanges() {
  if (listening) return;
  try {
    // An upgrade clears the allowance back-off; signing in, out, registering,
    // switching account or a verification/consent change (all announced as a
    // session change) clears the readiness answer, which was for someone else.
    onEntitlementChange(() => { clearCloudAllowanceExhausted(); clearCloudHandwritingReadiness(); });
    onCloudSessionChange(() => clearCloudHandwritingReadiness());
    listening = typeof globalThis.addEventListener === 'function';
  } catch { /* non-browser runtimes */ }
}
const diagnosticState = {
  localNativeAvailable: null,
  cloudAvailable: false,
  selectedEngine: null,
  lastLatencyMs: null,
  lastFailureCode: null,
  fallbackOccurred: false,
  releaseSha: null
};

function safeFailureCode(value, fallback = null) {
  const code = String(value || '');
  return /^[A-Z0-9_:-]{1,96}$/.test(code) ? code : fallback;
}

/**
 * A refusal whose body carried no code is still a refusal of a known kind:
 * 401 is "sign in", 403 is "this account may not". Only an unknown failure is
 * the transport fallback.
 */
function statusFailureCode(error, fallback) {
  const status = Number(error?.status);
  if (status === 401) return 'AUTH_REQUIRED';
  if (status === 403) return 'FORBIDDEN';
  return fallback;
}

function safeReleaseSha(value) {
  const sha = String(value || '');
  return /^[0-9a-f]{40}$/.test(sha) ? sha : null;
}

function publishDiagnostics() {
  const value = Object.freeze({ ...diagnosticState });
  try { globalThis.__PRI_HANDWRITING_DIAGNOSTICS__ = value; } catch { /* support diagnostics are best-effort */ }
  return value;
}

export function handwritingDiagnostics() {
  return Object.freeze({ ...diagnosticState });
}

export function recordLocalHandwritingDiagnostics({ nativeAvailable, engine = null, releaseSha = null } = {}) {
  if (typeof nativeAvailable === 'boolean') diagnosticState.localNativeAvailable = nativeAvailable;
  if (engine) diagnosticState.selectedEngine = String(engine).slice(0, 160);
  const sha = safeReleaseSha(releaseSha);
  if (sha) diagnosticState.releaseSha = sha;
  return publishDiagnostics();
}

function recordCloudDiagnostics({
  available,
  engine = null,
  latencyMs = null,
  failureCode = null,
  fallbackOccurred = false,
  releaseSha = null
} = {}) {
  if (typeof available === 'boolean') diagnosticState.cloudAvailable = available;
  if (engine) diagnosticState.selectedEngine = String(engine).slice(0, 160);
  diagnosticState.lastLatencyMs = Number.isFinite(Number(latencyMs)) ? Math.max(0, Math.round(Number(latencyMs))) : null;
  diagnosticState.lastFailureCode = safeFailureCode(failureCode);
  diagnosticState.fallbackOccurred = fallbackOccurred === true;
  const sha = safeReleaseSha(releaseSha);
  if (sha) diagnosticState.releaseSha = sha;
  return publishDiagnostics();
}

/** 'on' / 'off' when the student chose in Settings, 'default' when they never did. */
export function cloudReadingChoice(user) {
  if (user?.cloudHandwriting === true) return 'on';
  if (user?.cloudHandwriting === false) return 'off';
  return 'default';
}

/**
 * Whether this profile wants server reading. An explicit choice wins either
 * way; a profile that never chose gets it only when it is signed in to a cloud
 * account (and is not the demo profile). Whether the deployment can actually
 * serve it — including the guardian-consent refusal — is the readiness check.
 */
export function cloudReadingWanted(user) {
  const choice = cloudReadingChoice(user);
  if (choice !== 'default') return choice === 'on';
  return user?.cloudLinked === true && user?.isDemo !== true;
}

/**
 * Two separate conditions, kept separate on purpose: the student wants it, and
 * this deployment actually has somewhere to send it. `available` is injectable
 * so the contract can be tested without a configured origin.
 */
export function cloudReadingEnabled(user, { available = cloudAvailable, readiness = null } = {}) {
  if (!cloudReadingWanted(user)) return false;
  try {
    if (available() !== true) return false;
    return readiness == null ? true : readiness?.usable === true;
  } catch { return false; }
}

export async function cloudHandwritingReadiness({
  user,
  transport = cloud,
  available = cloudAvailable,
  signal = null,
  now = Date.now(),
  cache = true,
  // A refresh bypasses only the cache read. Its server answer still replaces
  // the cached value for this identity so the next normal stroke sees it too.
  refresh = false
} = {}) {
  if (!cloudReadingWanted(user)) {
    return { usable: false, state: 'disabled', lastFailureCode: null, releaseSha: null };
  }
  try {
    if (available() !== true) {
      recordCloudDiagnostics({ available: false, failureCode: 'CLOUD_DISABLED' });
      return { usable: false, state: 'unavailable', lastFailureCode: 'CLOUD_DISABLED', releaseSha: null };
    }
  } catch {
    recordCloudDiagnostics({ available: false, failureCode: 'CLOUD_DISABLED' });
    return { usable: false, state: 'unavailable', lastFailureCode: 'CLOUD_DISABLED', releaseSha: null };
  }

  listenForAccountChanges();
  const identity = readinessIdentity(user);
  if (cache && !refresh && readinessCache.value && readinessCache.identity === identity && readinessCache.expiresAt > now) {
    return readinessCache.value;
  }
  if (typeof transport?.handwritingStatus !== 'function') {
    const value = Object.freeze({ usable: false, state: 'unavailable', lastFailureCode: 'HANDWRITING_STATUS_UNAVAILABLE', releaseSha: null });
    recordCloudDiagnostics({ available: false, failureCode: value.lastFailureCode });
    return value;
  }

  try {
    const status = await transport.handwritingStatus({ signal });
    const state = ['ready', 'degraded', 'unavailable'].includes(status?.state) ? status.state : 'unavailable';
    const value = Object.freeze({
      configured: status?.configured === true,
      usable: status?.usable === true && status?.available === true,
      degraded: status?.degraded === true,
      state,
      model: typeof status?.model === 'string' ? status.model.slice(0, 160) : null,
      fallbackModel: typeof status?.fallbackModel === 'string' ? status.fallbackModel.slice(0, 160) : null,
      confidenceFloor: Number.isFinite(Number(status?.confidenceFloor)) ? Number(status.confidenceFloor) : null,
      timeoutMs: Number.isFinite(Number(status?.timeoutMs)) ? Number(status.timeoutMs) : null,
      lastFailureCode: safeFailureCode(status?.lastFailureCode),
      lastLatencyMs: Number.isFinite(Number(status?.lastLatencyMs)) ? Number(status.lastLatencyMs) : null,
      releaseSha: safeReleaseSha(status?.releaseSha)
    });
    recordCloudDiagnostics({ available: value.usable, latencyMs: value.lastLatencyMs, failureCode: value.lastFailureCode, releaseSha: value.releaseSha });
    if (cache) {
      const ttl = value.usable && value.state === 'ready' ? READINESS_TTL_MS : UNAVAILABLE_READINESS_TTL_MS;
      readinessCache = { expiresAt: now + ttl, value, identity };
    }
    return value;
  } catch (error) {
    const code = error?.name === 'AbortError'
      ? 'HANDWRITING_CANCELLED'
      : error?.name === 'TimeoutError'
        ? 'HANDWRITING_STATUS_TIMEOUT'
        : safeFailureCode(error?.code, statusFailureCode(error, 'HANDWRITING_STATUS_UNREACHABLE'));
    const value = Object.freeze({ usable: false, state: 'unavailable', lastFailureCode: code, releaseSha: null });
    recordCloudDiagnostics({ available: false, failureCode: code });
    return value;
  }
}

/**
 * Turn a server transcription into the reading shape the ink surface publishes.
 *
 * Line geometry comes from the local reading, because the server returns text
 * without coordinates and the ✓/✗ annotations are drawn on the student's own
 * lines. Where the two disagree about how many lines there are, the boxes are
 * dropped rather than guessed: an annotation on the wrong line is worse than
 * none.
 */
export function toReading(transcription, localReading) {
  const lines = (transcription?.lines || []).map(line => ({ text: String(line.text || '') }));
  if (!lines.length) return null;

  const localLines = localReading?.lines || [];
  const alignable = localLines.length === lines.length;
  return {
    lines: lines.map((line, i) => ({
      text: line.text,
      box: alignable ? localLines[i]?.box : undefined,
      conf: transcription.lines[i]?.confidence ?? transcription.confidence ?? 0
    })),
    text: lines.map(l => l.text).join('\n'),
    engine: transcription.engine || `${CLOUD_ENGINE_PREFIX}-unknown`,
    cloud: true,
    confidence: transcription.confidence ?? 0,
    needsConfirmation: transcription.needsConfirmation !== false,
    alignedToLocalLines: alignable
  };
}

/**
 * Read the strokes on the server. Resolves to null whenever the answer is
 * "carry on with the local reading" — not enabled, nothing written, offline,
 * refused, superseded by newer writing. It never throws into the ink surface.
 */
export async function readWithCloud(strokes, {
  user,
  signal = null,
  transport = cloud,
  rasterize = rasterizeInk,
  available = cloudAvailable,
  readiness = cloudHandwritingReadiness,
  // True on the first read after the account changed (signed in, verified,
  // consented): the server is asked again however fresh the cached answer is.
  freshReadiness = false
} = {}) {
  if (!cloudReadingEnabled(user, { available })) return { reason: 'disabled' };
  listenForAccountChanges();
  if (cloudAllowanceExhausted()) return { reason: 'allowance', until: allowanceExhaustedUntil };

  const ready = await readiness({ user, transport, available, signal, refresh: freshReadiness === true });
  if (!cloudReadingEnabled(user, { available, readiness: ready })) {
    return { reason: ready?.lastFailureCode === 'HANDWRITING_CANCELLED' ? 'cancelled' : 'unavailable', readiness: ready };
  }

  let raster = null;
  try { raster = rasterize(strokes); }
  catch {
    recordCloudDiagnostics({ available: true, failureCode: 'HANDWRITING_RASTER_FAILED', releaseSha: ready?.releaseSha });
    return { reason: 'unrenderable', readiness: ready };
  }
  // Null here means the ink could not be drawn small enough to send. That is a
  // different answer from "switched off", and the caller can only say something
  // useful if it can tell them apart.
  if (!raster?.dataUrl) {
    recordCloudDiagnostics({ available: true, failureCode: 'HANDWRITING_IMAGE_TOO_LARGE', releaseSha: ready?.releaseSha });
    return { reason: 'too-large', readiness: ready };
  }

  const started = Date.now();
  try {
    const response = await transport.transcribeHandwriting(raster.dataUrl, { signal });
    const transcription = response?.transcription;
    recordCloudDiagnostics({
      available: true,
      engine: transcription?.engine || null,
      latencyMs: transcription?.latencyMs ?? (Date.now() - started),
      failureCode: transcription?.fallbackFailureCode || null,
      fallbackOccurred: transcription?.fallbackAttempted === true || transcription?.escalated === true,
      releaseSha: ready?.releaseSha
    });
    if (!transcription?.lines?.length) {
      recordCloudDiagnostics({
        available: true,
        engine: transcription?.engine || null,
        latencyMs: transcription?.latencyMs ?? (Date.now() - started),
        failureCode: transcription?.fallbackFailureCode || 'HANDWRITING_EMPTY_RESPONSE',
        fallbackOccurred: transcription?.fallbackAttempted === true || transcription?.escalated === true,
        releaseSha: ready?.releaseSha
      });
      return { reason: 'empty', readiness: ready, diagnostics: handwritingDiagnostics() };
    }
    return {
      transcription,
      raster: { width: raster.width, height: raster.height, bytes: raster.bytes },
      readiness: ready,
      diagnostics: handwritingDiagnostics()
    };
  } catch (error) {
    // A refusal is information for the setting screen, not an error the student
    // should meet mid-question: the local reading is already on screen.
    const code = error?.name === 'AbortError'
      ? 'HANDWRITING_CANCELLED'
      : error?.name === 'TimeoutError'
        ? 'HANDWRITING_TIMEOUT'
        : safeFailureCode(error?.code, statusFailureCode(error, 'HANDWRITING_FAILED'));
    noteAllowance(error);
    recordCloudDiagnostics({ available: true, latencyMs: Date.now() - started, failureCode: code, releaseSha: ready?.releaseSha });
    if (code === ALLOWANCE_CODE) return { reason: 'allowance', until: allowanceExhaustedUntil, readiness: ready, diagnostics: handwritingDiagnostics() };
    const status = Number.isInteger(Number(error?.status)) && Number(error.status) > 0 ? Number(error.status) : undefined;
    return { error: { code, status, message: error?.message || '' }, readiness: ready, diagnostics: handwritingDiagnostics() };
  }
}

/**
 * Should this server reading replace what is on screen?
 *
 * Deliberately conservative. It says no to a reading the student has corrected,
 * no to an unconfident one, and no to one that agrees with the local reading
 * anyway, because replacing a reading with an identical one only makes the
 * screen flicker.
 */
export function shouldSupersede(cloudReading, localReading, { hasManualCorrections = false } = {}) {
  if (!cloudReading || hasManualCorrections) return false;
  if (cloudReading.needsConfirmation) return false;
  if (!cloudReading.text.trim()) return false;
  // A reading that split the page into a different number of lines cannot be
  // applied silently. Its lines carry no boxes, so the ✓/✗ overlay draws
  // nothing, and toReading drops per-glyph symbols, so the tap-to-correct row
  // is empty — the student would be unable to fix a single character of a
  // reading they did not produce. Offer it instead.
  if (cloudReading.alignedToLocalLines !== true) return false;
  const normalise = t => String(t || '').replace(/\s+/g, ' ').trim();
  return normalise(cloudReading.text) !== normalise(localReading?.text);
}

/**
 * Read a photograph of working done on paper.
 *
 * The same route and the same reader as the ink, because to the reader they are
 * both just an image of handwriting. This is the input most students actually
 * have — a page of an exercise book — and until now the browser build could
 * attach a photo and never read it, while the iPad build read it with an OCR
 * engine built for printed text.
 *
 * Returns null for every "carry on without it" case; never throws.
 */
export async function readPhotoWithCloud(dataUrl, {
  user,
  signal = null,
  transport = cloud,
  prepare = preparePhoto,
  available = cloudAvailable,
  readiness = cloudHandwritingReadiness
} = {}) {
  if (!cloudReadingEnabled(user, { available })) return { reason: 'disabled' };
  listenForAccountChanges();
  if (cloudAllowanceExhausted()) return { reason: 'allowance', until: allowanceExhaustedUntil };
  const ready = await readiness({ user, transport, available, signal });
  if (!cloudReadingEnabled(user, { available, readiness: ready })) {
    return { reason: ready?.lastFailureCode === 'HANDWRITING_CANCELLED' ? 'cancelled' : 'unavailable', readiness: ready };
  }

  let prepared = null;
  try { prepared = await prepare(dataUrl); }
  catch {
    recordCloudDiagnostics({ available: true, failureCode: 'HANDWRITING_PHOTO_UNREADABLE', releaseSha: ready?.releaseSha });
    return { reason: 'unreadable', readiness: ready };
  }
  // A photo the browser cannot decode — a HEIC on Android, say — or one that
  // never compresses under the budget. Both are the student's to act on, and
  // neither is "server reading is off".
  if (!prepared?.dataUrl) {
    recordCloudDiagnostics({ available: true, failureCode: 'HANDWRITING_PHOTO_UNREADABLE', releaseSha: ready?.releaseSha });
    return { reason: 'unreadable', readiness: ready };
  }

  const started = Date.now();
  try {
    const response = await transport.transcribeHandwriting(prepared.dataUrl, { signal });
    const transcription = response?.transcription;
    recordCloudDiagnostics({
      available: true,
      engine: transcription?.engine || null,
      latencyMs: transcription?.latencyMs ?? (Date.now() - started),
      failureCode: transcription?.fallbackFailureCode || null,
      fallbackOccurred: transcription?.fallbackAttempted === true || transcription?.escalated === true,
      releaseSha: ready?.releaseSha
    });
    if (!transcription?.lines?.length) return { reason: 'empty', readiness: ready, diagnostics: handwritingDiagnostics() };
    return {
      transcription,
      photo: { width: prepared.width, height: prepared.height, bytes: prepared.bytes, quality: prepared.quality },
      readiness: ready,
      diagnostics: handwritingDiagnostics()
    };
  } catch (error) {
    const code = error?.name === 'AbortError'
      ? 'HANDWRITING_CANCELLED'
      : error?.name === 'TimeoutError'
        ? 'HANDWRITING_TIMEOUT'
        : safeFailureCode(error?.code, statusFailureCode(error, 'HANDWRITING_FAILED'));
    noteAllowance(error);
    recordCloudDiagnostics({ available: true, latencyMs: Date.now() - started, failureCode: code, releaseSha: ready?.releaseSha });
    if (code === ALLOWANCE_CODE) return { reason: 'allowance', until: allowanceExhaustedUntil, readiness: ready, diagnostics: handwritingDiagnostics() };
    const status = Number.isInteger(Number(error?.status)) && Number(error.status) > 0 ? Number(error.status) : undefined;
    return { error: { code, status, message: error?.message || '' }, readiness: ready, diagnostics: handwritingDiagnostics() };
  }
}

const browserOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;

/**
 * The plain-language reason a photo could not be read by the server, as an
 * i18n key. Points at Settings only when Settings is genuinely the fix (the
 * student turned server reading off); otherwise it names the real cause.
 * There is no offline photo queue, so offline means "type it for now".
 */
export function photoReadingBlockedKey(user, { outcome = null, online = browserOnline, available = cloudAvailable } = {}) {
  if (cloudReadingChoice(user) === 'off') return 'verdict.photoReadingTurnedOff';
  let configured = false;
  try { configured = available() === true; } catch { configured = false; }
  if (!configured) return 'verdict.photoReadingNotOnThisInstall';
  let isOnline = true;
  try { isOnline = online() !== false; } catch { isOnline = true; }
  if (!isOnline) return 'verdict.photoReadingOffline';
  if (user?.cloudLinked !== true) return 'verdict.photoReadingSignIn';
  return accountBlockedKey(outcome) || 'verdict.photoReadingServiceDown';
}

/**
 * The precise account-side reason a read was refused, or null when the reason
 * is not the account (the reader itself, the network). The transcribe route's
 * own refusal wins over the status probe's, and a refusal is read from its
 * code first and its HTTP status second (a 401/403 whose body lost its code is
 * still "sign in" / "this account may not", never "the reader is down").
 */
export function accountBlockedKey(outcome = null) {
  const codes = [outcome?.error?.code, outcome?.readiness?.lastFailureCode].map(c => String(c || '')).filter(Boolean);
  const status = Number(outcome?.error?.status);
  for (const code of codes) {
    if (code === 'AUTH_REQUIRED') return 'verdict.photoReadingSignIn';
    if (code.startsWith('GUARDIAN_CONSENT') || code === 'AGE_DECLARATION_REQUIRED') return 'verdict.photoReadingGuardian';
    if (code === 'EMAIL_UNVERIFIED') return 'verdict.photoReadingVerifyEmail';
  }
  if (status === 401) return 'verdict.photoReadingSignIn';
  return null;
}

/** Blockers the student can clear in Account settings (sign in, verify, consent). */
export const ACCOUNT_BLOCKED_KEYS = Object.freeze(new Set([
  'ink.waitingSignIn', 'ink.waitingVerifyEmail', 'ink.waitingGuardian',
  'verdict.photoReadingSignIn', 'verdict.photoReadingVerifyEmail', 'verdict.photoReadingGuardian'
]));

const NOTICE_KEY = 'pri-cloud-reading-notice-v1';
/**
 * True exactly once per device: the first time a photo is read by the server
 * for a student who never chose either way, so the default is never silent.
 * Storage that throws (private window) shows the notice rather than hiding it.
 */
export function takeCloudReadingNotice(user, storage = globalThis.localStorage) {
  if (cloudReadingChoice(user) !== 'default') return false;
  try {
    if (storage?.getItem(NOTICE_KEY)) return false;
    storage?.setItem(NOTICE_KEY, String(Date.now()));
  } catch { /* show it; better twice than never */ }
  return true;
}

/**
 * The same plain-language reasons for ink, phrased for working that stays on
 * the page: it is saved, and it is read by itself once the reason goes away.
 */
const INK_BLOCKED = Object.freeze({
  'verdict.photoReadingTurnedOff': 'ink.waitingTurnedOff',
  'verdict.photoReadingNotOnThisInstall': 'ink.waitingNotOnThisInstall',
  'verdict.photoReadingOffline': 'ink.waitingOffline',
  'verdict.photoReadingSignIn': 'ink.waitingSignIn',
  'verdict.photoReadingGuardian': 'ink.waitingGuardian',
  'verdict.photoReadingVerifyEmail': 'ink.waitingVerifyEmail',
  'verdict.photoReadingServiceDown': 'ink.waitingServiceDown'
});
export function inkReadingBlockedKey(user, options = {}) {
  return INK_BLOCKED[photoReadingBlockedKey(user, options)] || 'ink.waitingServiceDown';
}

/**
 * How long to wait before asking a reader that did not answer again: 20 s,
 * then doubling, never more than five minutes apart, for as long as the page
 * waits. Never gives up while the student's working is still on the page.
 */
export const RETRY_MS = 20_000;
export const RETRY_CAP_MS = 5 * 60_000;
export function retryDelayMs(attempt) {
  return Math.min(RETRY_CAP_MS, RETRY_MS * 2 ** Math.max(0, Math.floor(Number(attempt) || 0)));
}
