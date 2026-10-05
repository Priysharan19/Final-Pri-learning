// Pri Learning · telemetry tolerates the guardian gate
//
// /v1/telemetry refuses a child's account whose guardian has not confirmed (or
// has withdrawn) with 403 GUARDIAN_CONSENT_PENDING / _WITHDRAWN. The client must
// take that silently: nothing throws into the learning surface, the refused
// batch is dropped rather than kept for later, and the device stops asking for
// the rest of the page's life instead of re-sending every 250 ms. Any other
// failure (an outage) keeps the existing best-effort behaviour.
import assert from 'node:assert/strict';

globalThis.__PRI_CLOUD_ORIGIN__ = 'https://cloud.pri.example';
globalThis.document = { cookie: 'pri_csrf=test-csrf' };
globalThis.location = { origin: 'https://app.pri.example' };

let reply = { status: 403, body: { error: { code: 'GUARDIAN_CONSENT_PENDING', message: 'A parent or guardian has been emailed.' } } };
const sent = [];
globalThis.fetch = async (url, options = {}) => {
  sent.push({ path: new URL(url).pathname, body: options.body ? JSON.parse(options.body) : null });
  return {
    ok: reply.status >= 200 && reply.status < 300,
    status: reply.status,
    headers: { get: () => null },
    text: async () => JSON.stringify(reply.body)
  };
};

const { isGuardianConsentRefusal } = await import('../src/platform/cloudTransport.js');
const { queueTelemetry } = await import('../src/platform/telemetry.js');
const settle = () => new Promise(resolve => setTimeout(resolve, 400));
let n = 0;
const check = (fn) => { fn(); n++; };

// The predicate recognises exactly the two consent refusals.
check(() => assert.equal(isGuardianConsentRefusal({ status: 403, code: 'GUARDIAN_CONSENT_PENDING' }), true));
check(() => assert.equal(isGuardianConsentRefusal({ status: 403, code: 'GUARDIAN_CONSENT_WITHDRAWN' }), true));
check(() => assert.equal(isGuardianConsentRefusal({ status: 403, code: 'GUARDIAN_CONSENT_UNAVAILABLE' }), false, 'an unreadable consent row is not a settled refusal'));
check(() => assert.equal(isGuardianConsentRefusal({ status: 403, code: 'CSRF_REJECTED' }), false));
check(() => assert.equal(isGuardianConsentRefusal({ status: 401, code: 'GUARDIAN_CONSENT_PENDING' }), false));
check(() => assert.equal(isGuardianConsentRefusal(null), false));

// An outage first: best effort, dropped, and later events are still sent.
reply = { status: 503, body: { error: { code: 'DATABASE_UNAVAILABLE', message: 'Retry shortly.' } } };
check(() => assert.equal(queueTelemetry('feature-used', { surface: 'practice', metadata: { feature: 'a' } }), true));
await settle();
check(() => assert.equal(sent.length, 1, 'the batch was attempted'));
check(() => assert.equal(queueTelemetry('feature-used', { surface: 'practice', metadata: { feature: 'b' } }), true, 'an outage does not stop telemetry'));
await settle();
check(() => assert.equal(sent.length, 2));

// Now the guardian gate refuses it. Nothing throws; the device stops asking.
reply = { status: 403, body: { error: { code: 'GUARDIAN_CONSENT_PENDING', message: 'A parent or guardian has been emailed.' } } };
const unhandled = [];
process.on('unhandledRejection', error => unhandled.push(error));
check(() => assert.equal(queueTelemetry('client-error', { surface: 'home', metadata: { code: 'X' } }), true));
await settle();
check(() => assert.equal(sent.length, 3, 'the refused batch was sent once'));
check(() => assert.deepEqual(unhandled, [], 'the refusal never escapes into the app'));
check(() => assert.equal(queueTelemetry('feature-used', { surface: 'practice' }), false, 'after a consent refusal nothing more is queued'));
await settle();
check(() => assert.equal(sent.length, 3, 'and nothing more is sent'));

// Even if the guardian confirms mid-session, nothing is sent until a reload —
// telemetry is best effort, and events gathered without consent never leave.
reply = { status: 202, body: { accepted: 1 } };
check(() => assert.equal(queueTelemetry('feature-used', { surface: 'practice' }), false));
await settle();
check(() => assert.equal(sent.length, 3, 'events from while consent was missing are never sent'));
check(() => assert.ok(sent.every(call => call.path === '/v1/telemetry')));

console.log(`TELEMETRY CONSENT: PASS — ${n}/${n} checks — a guardian refusal is silent, dropped and final for the page; an outage stays best effort.`);
