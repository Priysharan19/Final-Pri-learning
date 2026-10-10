// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · one paid read per picture
//
// Two routes send a student's picture to the paid reader: /v1/handwriting/
// transcribe (to show the transcript) and /v1/practice/:id/recognize (to mint
// the reading receipt when the student submits). They used to call the
// provider independently, so one handwritten answer cost at least two paid
// calls for the same picture, a second try cost two more, and a reload that
// re-sent identical restored strokes cost another.
//
// This module is the single place a read is started. Its invariant:
//
//   An unchanged recognition operation never causes a second paid provider
//   call; a changed one always gets a fresh read.
//
// "Unchanged" is decided HERE, on the server, never from anything the client
// names. The operation identity is an HMAC (server key, derived from the
// delivery key, so it is the same on every replica and after a restart) over:
//
//   · the account id                — results are never shared across accounts;
//   · the declared image type and a SHA-256 of the exact decoded image bytes;
//   · everything in the reader's configuration that can change the result:
//     endpoint, primary and fallback model, reasoning effort, confidence
//     floor, and a digest of the prompt and the response schema.
//
// The question id and the input mode (ink/photo) are deliberately NOT part of
// the identity. The reader is answer-blind and question-blind: it is sent the
// picture and nothing else, so the same picture reads the same whichever
// question it is for. That is what lets the transcript shown by /transcribe be
// the transcript /recognize binds into a receipt — one paid call, not two.
// Nothing about authority moves here: /recognize still re-checks ownership,
// completion, the live session and guardian consent itself, and still mints
// its own receipt per call. This module only answers "what does this picture
// say", and it holds no receipt, no question and no image.
//
// What is kept, where, and for how long:
//
//   · Completed reads: the TRANSCRIPT ONLY, in the existing idempotency_keys
//     table (scope 'recognition-read', key = the keyed digest above), for
//     RECOGNITION_TTL_MS. No schema change: the table is already per-account
//     (primary key account_id, scope, key; Row-Level Security by account on
//     Postgres), already expires rows (housekeeping.js), already cascades on
//     account deletion, and already holds reading receipts with their
//     transcripts for far longer. Being in the database, a completed read
//     survives a restart and is shared by every replica. The image is never
//     stored, and neither is its plain digest: a database reader cannot test
//     whether an account submitted a known picture.
//   · In flight: concurrent equivalent requests (a double click, two tabs, a
//     reload during a slow provider) await the same promise IN THIS PROCESS.
//     One provider call, one deployment-ceiling unit, one daily AI-allowance
//     unit. The read is not tied to the request that started it, so it
//     finishes and is kept even when that client disconnects. Single-flight
//     is per process: two replicas could each start a read of the same new
//     picture at the same instant (docs/operations/recognition-cost.md §7).
//   · Failures are never kept. A timeout, a 5xx, a rejection, a refusal by the
//     ceiling or the allowance, or a read whose fallback attempt failed leaves
//     nothing behind, so an explicit retry really calls the provider again.
//   · An empty or uncertain read IS kept: it is the provider's answer for that
//     exact picture, and it is the most expensive one (a blank page escalates
//     to the fallback model, two units). Re-sending the same blank picture
//     must not buy the same two calls again. A different picture — one more
//     stroke — has a different digest and is read afresh.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { practiceContentKey } from './deliveryCrypto.js';
import { asStore } from './store.js';
import { consumeAiAllowance, refundAiAllowance, refuseAiAllowance } from './aiAllowance.js';
import { refundPaidCall, refusePaidCall, reservePaidCall, spendCeilingMissing } from './spendCeiling.js';
import { recordProviderUsage, recordRecognitionRead } from './metrics.js';
import { logEvent } from './observability.js';
import { timePhase } from './requestTiming.js';
import { SYSTEM_INSTRUCTIONS, TRANSCRIPTION_SCHEMA, providerConfig } from './handwritingProvider.js';

/**
 * How long a completed read is reusable. One attempt at a question is: write,
 * read, check the transcript, submit, see the verdict, perhaps a second try.
 * That is minutes. 15 minutes covers a student who pauses mid-question or
 * reloads, without keeping a transcript of a child's writing in memory for
 * longer than one sitting at one question. A read is a pure function of the
 * picture and the configuration, so the TTL is not about staleness — it bounds
 * how long the text is kept for this purpose.
 */
export const RECOGNITION_TTL_MS = 15 * 60 * 1000;
/** The scope of a kept read in idempotency_keys. */
export const RECOGNITION_SCOPE = 'recognition-read';
/**
 * The largest transcript that is kept. The response schema allows 40 lines of
 * at most 400 + 600 characters, about 45 kB; anything larger is not a
 * transcript this reader can produce and is served without being stored.
 */
export const RECOGNITION_MAX_TRANSCRIPT_BYTES = 64 * 1024;
/** Bump when something that changes a read is not covered by the digest below. */
export const RECOGNITION_OPS_VERSION = 1;

// The prompt and schema, by content. A change to either (they are owned by
// handwritingProvider.js) changes every operation identity without anyone
// remembering to bump a number.
const READER_CONTRACT_DIGEST = createHash('sha256')
  .update(`${RECOGNITION_OPS_VERSION}\n${SYSTEM_INSTRUCTIONS}\n${JSON.stringify(TRANSCRIPTION_SCHEMA)}`)
  .digest('hex');

// Codes for which this server certainly sent the provider nothing. These are
// the ONLY failures that give a paid unit back (see the cost doc §4): for a
// timeout, a 5xx, a dropped connection or a provider rejection the provider
// may have done billable work, and the ceiling exists to bound the bill.
const NEVER_SENT = /^(HANDWRITING_NOT_CONFIGURED|HANDWRITING_PROVIDER_CONFIG_INVALID)$/;

const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

const tokenCount = value => (Number.isInteger(value) && value >= 0 && value <= 100_000_000 ? value : null);

/** The token counts in one provider response, as numbers only. Null when absent. */
export function usageFromProviderPayload(payload) {
  const usage = payload?.usage;
  if (!usage || typeof usage !== 'object') return null;
  const inputTokens = tokenCount(usage.input_tokens);
  const outputTokens = tokenCount(usage.output_tokens);
  if (inputTokens === null && outputTokens === null) return null;
  return {
    inputTokens: inputTokens ?? 0,
    outputTokens: outputTokens ?? 0,
    reasoningTokens: tokenCount(usage.output_tokens_details?.reasoning_tokens) ?? 0,
    cachedInputTokens: tokenCount(usage.input_tokens_details?.cached_tokens) ?? 0,
    // Reported separately by some models; null when the provider does not say.
    imageInputTokens: tokenCount(usage.input_tokens_details?.image_tokens)
  };
}

/**
 * A fetch that also notes each response's `usage` numbers. It reads a CLONE of
 * the response, so the provider adapter still gets the untouched body, and it
 * never looks at the request (the image) or at the transcript.
 */
function meteredFetch(calls, fetchImpl = globalThis.fetch) {
  const pending = [];
  const fetchWithUsage = async (url, init) => {
    const started = Date.now();
    const response = await fetchImpl(url, init);
    const call = { status: Number(response?.status) || 0, usage: null, ms: null, model: null };
    calls.push(call);
    if (response?.ok && typeof response.clone === 'function') {
      let copy = null;
      try { copy = response.clone(); } catch { copy = null; }
      if (copy) {
        pending.push(copy.json()
          .then(payload => {
            call.usage = usageFromProviderPayload(payload);
            call.ms = Date.now() - started;
            // The model the provider says it ran, not the one that was asked for.
            if (typeof payload?.model === 'string' && /^[A-Za-z0-9._:-]{1,80}$/.test(payload.model)) call.model = payload.model;
          })
          .catch(() => {}));
      }
    }
    return response;
  };
  // Usage arrives with the body the adapter is already waiting for; the cap is
  // only so a stuck clone can never hold a finished read.
  const settled = () => Promise.race([
    Promise.allSettled(pending),
    new Promise(resolve => { const t = setTimeout(resolve, 250); t.unref?.(); })
  ]);
  return { fetchWithUsage, settled };
}

function freezeDeep(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) freezeDeep(inner);
  }
  return value;
}

// The same key on every replica and across restarts, so a kept read can be
// found again. Where no delivery key can be derived the key is per process:
// reads kept by another process are then simply not found, and expire.
let derivedKey = null;
function serverKey() {
  if (!derivedKey) {
    try { derivedKey = createHmac('sha256', practiceContentKey()).update('pri-recognition-op-v1').digest(); }
    catch { derivedKey = randomBytes(32); }
  }
  return derivedKey;
}

export function createRecognitionOps({
  ttlMs = RECOGNITION_TTL_MS,
  maxTranscriptBytes = RECOGNITION_MAX_TRANSCRIPT_BYTES,
  now = () => Date.now(),
  key = null
} = {}) {
  const settings = { ttlMs, maxTranscriptBytes, now };
  const inFlight = new Map();  // operation id → Promise<outcome>   (this process only)
  const counters = { providerReads: 0, storedHits: 0, inFlightHits: 0, stored: 0, notStored: 0 };

  function operationId(accountId, image, env) {
    const match = DATA_URL.exec(String(image || ''));
    if (!match) return null;
    const imageDigest = createHash('sha256').update(Buffer.from(match[2], 'base64')).digest('hex');
    const config = providerConfig(env);
    return createHmac('sha256', key || serverKey()).update(JSON.stringify([
      'recognition-op', String(accountId), match[1], imageDigest,
      config.endpoint, config.primaryModel, config.fallbackModel, config.reasoningEffort,
      config.confidenceFloor, READER_CONTRACT_DIGEST
    ])).digest('hex');
  }

  async function remember(db, id, accountId, result) {
    // The transcript only. A failure to keep it never fails the read the
    // student has already been charged a unit for; the next request just reads.
    try {
      const json = JSON.stringify({ v: 1, result });
      if (Buffer.byteLength(json, 'utf8') > settings.maxTranscriptBytes || settings.ttlMs <= 0) { counters.notStored += 1; return; }
      const at = settings.now();
      await db.transaction(async () => {
        // This account's expired reads go now rather than at the next
        // housekeeping pass, so what is kept per account stays small.
        await db.run('DELETE FROM idempotency_keys WHERE account_id=? AND scope=? AND expires_at<=?', [accountId, RECOGNITION_SCOPE, at]);
        await db.run(`INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,?,?,?,?,?,?)
          ON CONFLICT(account_id,scope,key) DO UPDATE SET response_json=excluded.response_json, created_at=excluded.created_at, expires_at=excluded.expires_at`,
          [accountId, RECOGNITION_SCOPE, id, json, null, at, at + settings.ttlMs]);
      }, { accountScope: String(accountId) });
      counters.stored += 1;
    } catch { counters.notStored += 1; }
  }

  async function recall(db, id, accountId) {
    // account_id is in the WHERE clause as well as inside the keyed digest:
    // the same rule stated twice, so no key change can ever cross accounts.
    const row = await db.get('SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope=? AND key=? AND expires_at>?',
      [accountId, RECOGNITION_SCOPE, id, settings.now()]);
    if (!row) return null;
    try {
      const kept = JSON.parse(row.response_json);
      return kept?.v === 1 && kept.result && typeof kept.result === 'object' ? freezeDeep(kept.result) : null;
    } catch { return null; }
  }

  /** The one paid path: allowance, ceiling, provider, refunds. */
  async function paidRead({ db, accountId, image, env, transcribe, requestId }) {
    const allowance = await timePhase('limit', () => consumeAiAllowance(db, { accountId, kind: 'handwriting', env }));
    if (!allowance.allowed) return { refusal: { kind: 'allowance', verdict: allowance } };

    // Counted before anything is sent, so a request can never spend past the
    // ceiling; each fallback escalation is a second unit, counted the same way.
    const first = await timePhase('limit', () => reservePaidCall(db, { env }));
    if (first.verdict) {
      await refundAiAllowance(db, allowance);
      return { refusal: { kind: 'paid', verdict: first.verdict } };
    }
    const reservations = [first];
    const calls = [];
    const meter = meteredFetch(calls);
    const started = Date.now();
    counters.providerReads += 1;
    try {
      const result = await timePhase('provider', () => transcribe(image, {
        env,
        fetchImpl: meter.fetchWithUsage,
        authorizeFallback: async () => {
          const next = await reservePaidCall(db, { env });
          if (!next.verdict) reservations.push(next);
          return next.verdict;
        }
      }));
      await meter.settled();
      reportUsage({ requestId, calls, paidUnits: reservations.length, ms: Date.now() - started });
      return { result, paidUnits: reservations.length, calls: calls.map(describeCall) };
    } catch (error) {
      await meter.settled();
      reportUsage({ requestId, calls, paidUnits: reservations.length, ms: Date.now() - started });
      if (NEVER_SENT.test(String(error?.code || ''))) {
        await refundAiAllowance(db, allowance);
        for (const reservation of reservations) await refundPaidCall(db, reservation);
      }
      // The ceiling refused the fallback model: a refusal, not a provider fault.
      if (error?.paidCallVerdict) return { refusal: { kind: 'paid', verdict: error.paidCallVerdict } };
      throw error;
    }
  }

  /**
   * Read one picture for one account. Resolves to
   *   { result, reused: false }                 a provider read (paid);
   *   { result, reused: true, source }          a kept read, or a read already
   *                                             in flight (free);
   *   { refusal: { kind, verdict } }            allowance or ceiling said no.
   * Rejects with the provider's error; nothing is kept from a failure.
   */
  async function read({ db, accountId, image, env = process.env, transcribe, requestId = null }) {
    db = asStore(db);
    const id = operationId(accountId, image, env);
    // An image this module cannot identify is never deduplicated: the adapter
    // validates it and refuses it by name.
    // Fail closed: a deployment that holds a key and no ceiling may not offer
    // server reading at all, so it is refused by the same guard as ever and is
    // never answered from a kept read.
    if (!id || spendCeilingMissing(env).length) {
      return paidOutcome(await paidRead({ db, accountId, image, env, transcribe, requestId }));
    }

    const running = inFlight.get(id);
    if (running) return joined(await running);

    const kept = await recall(db, id, accountId);
    if (kept) {
      counters.storedHits += 1;
      recordRecognitionRead('cache');
      return { result: kept, reused: true, source: 'cache' };
    }
    // The lookup above awaited: another request for the same picture may have
    // started its read meanwhile. Join it rather than start a second one.
    const startedMeanwhile = inFlight.get(id);
    if (startedMeanwhile) return joined(await startedMeanwhile);

    const flight = paidRead({ db, accountId, image, env, transcribe, requestId })
      .then(async outcome => {
        if (outcome.refusal) return outcome;
        const result = freezeDeep(JSON.parse(JSON.stringify(outcome.result ?? null)));
        // A read whose fallback attempt failed is a partly failed operation:
        // serve it now, but let a retry try the fallback for real.
        if (result && !result.fallbackFailureCode) await remember(db, id, accountId, result);
        return { ...outcome, result };
      })
      .finally(() => { inFlight.delete(id); });
    inFlight.set(id, flight);
    return paidOutcome(await flight);
  }

  function joined(shared) {
    if (shared.refusal) return { refusal: shared.refusal };
    counters.inFlightHits += 1;
    recordRecognitionRead('inflight');
    return { result: shared.result, reused: true, source: 'inflight' };
  }

  function paidOutcome(outcome) {
    if (outcome.refusal) return { refusal: outcome.refusal };
    recordRecognitionRead('provider');
    return { result: outcome.result, reused: false, source: 'provider', paidUnits: outcome.paidUnits, calls: outcome.calls };
  }

  function describeCall(call) {
    return { status: call.status, model: call.model, ms: call.ms, ...(call.usage || {}) };
  }

  function reportUsage({ requestId, calls, paidUnits, ms }) {
    const totals = { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 };
    let measured = 0;
    for (const call of calls) {
      if (!call.usage) continue;
      measured += 1;
      totals.inputTokens += call.usage.inputTokens;
      totals.outputTokens += call.usage.outputTokens;
      totals.reasoningTokens += call.usage.reasoningTokens;
    }
    if (!calls.length) return; // an injected reader that never used the network
    // Per call, by the model the provider reported it ran (metrics only).
    for (const call of calls) recordProviderUsage('handwriting', { calls: 1, model: call.model, ...(call.usage || {}) });
    // Numbers and the request id only: no picture, no transcript, no account.
    logEvent('info', 'provider_usage', {
      requestId, provider: 'handwriting', count: calls.length, paidUnits, latencyMs: ms,
      ...(measured ? totals : {})
    });
  }

  return {
    read,
    /** Numbers only. */
    stats: () => ({ inFlight: inFlight.size, ...counters }),
    /** Tests only: lifetime, size bound and clock. Never called by the server. */
    configure(patch = {}) {
      for (const name of ['ttlMs', 'maxTranscriptBytes', 'now']) if (patch[name] !== undefined) settings[name] = patch[name];
      return this;
    }
  };
}

// One instance per platform store, so /transcribe and /recognize — two routers
// built separately over the same store — share reads, and two stores in one
// process (the test suites) never do.
const instances = new WeakMap();

export function recognitionOpsFor(db) {
  const store = asStore(db);
  let ops = instances.get(store);
  if (!ops) { ops = createRecognitionOps(); instances.set(store, ops); }
  return ops;
}

/** Answer a refusal from read() in the shape each guard already uses. */
export function sendRecognitionRefusal(res, refusal) {
  return refusal.kind === 'allowance'
    ? refuseAiAllowance(res, refusal.verdict)
    : refusePaidCall(res, refusal.verdict);
}
