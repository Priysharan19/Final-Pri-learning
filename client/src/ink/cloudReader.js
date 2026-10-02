// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · asking a server to read the ink
//
// The on-device reader has 58 classes and no comma, so a line like
// "−1, 0, 1, 2, 4" cannot come back right however well it is written. This is
// the other route, and it runs only when the student has turned it on.
//
// Four rules hold it in place:
//
//   1. Off by default. Nothing leaves the device until the student says so.
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
import { onEntitlementChange } from '../platform/cloudSession.js';
import { preparePhoto } from './photoRaster.js';

/** How the returned reading is labelled, so History and evidence can tell. */
export const CLOUD_ENGINE_PREFIX = 'cloud';

const READINESS_TTL_MS = 60_000;
// A non-ready answer is remembered only briefly: an outage, a missing ceiling
// or a 429 must not keep cloud reading off for a full minute (or longer) after
// the deployment has recovered. Errors are never cached at all.
export const UNAVAILABLE_READINESS_TTL_MS = 15_000;
let readinessCache = { expiresAt: 0, value: null };
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
function listenForEntitlementChanges() {
  if (listening) return;
  try { onEntitlementChange(() => clearCloudAllowanceExhausted()); listening = typeof globalThis.addEventListener === 'function'; } catch { /* non-browser runtimes */ }
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

/**
 * Two separate conditions, kept separate on purpose: the student opted in, and
 * this deployment actually has somewhere to send it. `available` is injectable
 * so the contract can be tested without a configured origin.
 */
export function cloudReadingEnabled(user, { available = cloudAvailable, readiness = null } = {}) {
  if (user?.cloudHandwriting !== true) return false;
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
  cache = true
} = {}) {
  if (user?.cloudHandwriting !== true) {
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

  if (cache && readinessCache.value && readinessCache.expiresAt > now) return readinessCache.value;
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
      readinessCache = { expiresAt: now + ttl, value };
    }
    return value;
  } catch (error) {
    const code = error?.name === 'AbortError'
      ? 'HANDWRITING_CANCELLED'
      : error?.name === 'TimeoutError'
        ? 'HANDWRITING_STATUS_TIMEOUT'
        : safeFailureCode(error?.code, 'HANDWRITING_STATUS_UNREACHABLE');
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
  readiness = cloudHandwritingReadiness
} = {}) {
  if (!cloudReadingEnabled(user, { available })) return { reason: 'disabled' };
  listenForEntitlementChanges();
  if (cloudAllowanceExhausted()) return { reason: 'allowance', until: allowanceExhaustedUntil };

  const ready = await readiness({ user, transport, available, signal });
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
        : safeFailureCode(error?.code, 'HANDWRITING_FAILED');
    noteAllowance(error);
    recordCloudDiagnostics({ available: true, latencyMs: Date.now() - started, failureCode: code, releaseSha: ready?.releaseSha });
    if (code === ALLOWANCE_CODE) return { reason: 'allowance', until: allowanceExhaustedUntil, readiness: ready, diagnostics: handwritingDiagnostics() };
    return { error: { code, message: error?.message || '' }, readiness: ready, diagnostics: handwritingDiagnostics() };
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
  listenForEntitlementChanges();
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
        : safeFailureCode(error?.code, 'HANDWRITING_FAILED');
    noteAllowance(error);
    recordCloudDiagnostics({ available: true, latencyMs: Date.now() - started, failureCode: code, releaseSha: ready?.releaseSha });
    if (code === ALLOWANCE_CODE) return { reason: 'allowance', until: allowanceExhaustedUntil, readiness: ready, diagnostics: handwritingDiagnostics() };
    return { error: { code, message: error?.message || '' }, readiness: ready, diagnostics: handwritingDiagnostics() };
  }
}
