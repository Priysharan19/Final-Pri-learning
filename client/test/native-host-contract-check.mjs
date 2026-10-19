// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · priNative contract (CP-02)
//
// Executes the platform-neutral native contract against the envelope core, a
// fake envelope host (what the Swift/Kotlin shells must behave like) and the
// legacy Apple adapters. These are behaviours, not source patterns: every case
// drives real requests, replies, events and timers through the code product
// screens use.
//
// Run on its own:  node client/test/native-host-contract-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { createBridge } from '../src/platform/native/bridge.js';
import { createFakeHost } from '../src/platform/native/fakeHost.js';
import { discoverHost } from '../src/platform/native/host.js';
import { normalizeCode, PriNativeError, CODES } from '../src/platform/native/errors.js';
import { MAX_IN_FLIGHT_PER_CAPABILITY, MAX_BUFFERED_EVENTS } from '../src/platform/native/envelope.js';
import { priNative, OTP_WAIT_MS, OTP_NATIVE_SMS_WAIT_MS } from '../src/platform/native/index.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));
async function rejects(promise, code, label) {
  try { await promise; ok(false, `${label} (resolved)`); }
  catch (e) { ok(e instanceof PriNativeError && e.code === code, `${label} — got ${e?.code || e}`); }
}

// A loopback host for the core: post() records; reply()/raw() answer.
function loopback() {
  const sent = [];
  let bridge;
  const api = {
    sent,
    make: (opts = {}) => (bridge = createBridge({ post: env => { sent.push(env); return true; }, ...opts })),
    reply: (id, result) => bridge.receive({ v: 1, id, ok: true, result }),
    fail: (id, error) => bridge.receive({ v: 1, id, ok: false, error }),
    raw: msg => bridge.receive(msg),
    last: () => sent[sent.length - 1],
  };
  return api;
}

// ── 1 · Closed error model ───────────────────────────────────────────────────
ok(CODES.length === 11, 'the error set is closed (11 codes)');
ok(normalizeCode('STOREKIT_TRANSACTION_UNVERIFIED') === 'UNVERIFIED', 'provider codes map into the closed set');
ok(normalizeCode('SOMETHING_NEW_FROM_A_SHELL') === 'INTERNAL', 'unknown codes become INTERNAL');
{
  const e = new PriNativeError('CLOUD_NETWORK_ERROR', 'offline');
  ok(e.code === 'UNAVAILABLE' && e.retryable === true && e.detail?.providerCode === 'CLOUD_NETWORK_ERROR',
    'the provider code is preserved in detail.providerCode');
}

// ── 2 · Request/response over the envelope core ─────────────────────────────
{
  const h = loopback(); const b = h.make();
  const p = b.request('share', 'file', { filename: 'a.json', text: '{}' });
  const env = h.last();
  ok(env.v === 1 && typeof env.id === 'string' && env.cap === 'share' && env.op === 'file', 'requests are well-formed v1 envelopes');
  h.reply(env.id, { completed: true });
  const r = await p;
  ok(r.completed === true, 'success resolves with the validated result');

  const p2 = b.request('cloud', 'request', { path: '/v1/x' });
  h.fail(h.last().id, { code: 'STOREKIT_ERROR', message: 'nope' });
  await rejects(p2, 'PROVIDER_ERROR', 'a native error is normalised into the closed set');

  const p3 = b.request('share', 'file', {});
  h.reply(h.last().id, { completed: 'yes' });
  await rejects(p3, 'INTERNAL', 'a malformed reply (schema mismatch) never reaches product code');
  b.dispose();
}

// ── 3 · Timeout, cancellation, late and duplicate replies ───────────────────
{
  const h = loopback(); const b = h.make();
  const p = b.request('cloud', 'request', { path: '/v1/x' }, { timeoutMs: 20 });
  const id = h.last().id;
  await rejects(p, 'TIMEOUT', 'JavaScript owns the timeout');
  const cancel = h.sent.find(e => e.op === 'cancel');
  ok(cancel?.payload?.target === id, 'a timed-out request sends cancel for its target');
  h.reply(id, { status: 200, body: '{}' });
  ok(b.stats().unknown + b.stats().duplicate >= 1, 'a late non-recoverable reply is dropped');

  const ctrl = new AbortController();
  const p2 = b.request('cloud', 'request', { path: '/v1/y' }, { signal: ctrl.signal });
  const id2 = h.last().id;
  ctrl.abort();
  await rejects(p2, 'CANCELLED', 'AbortSignal cancels the request');
  ok(h.sent.some(e => e.op === 'cancel' && e.payload.target === id2), 'and tells the shell to cancel');

  const pre = new AbortController(); pre.abort();
  await rejects(b.request('cloud', 'request', {}, { signal: pre.signal }), 'CANCELLED', 'an already-aborted signal never posts');

  const dupBefore = b.stats().duplicate;
  const p3 = b.request('storage', 'status', {});
  const id3 = h.last().id;
  h.reply(id3, { durable: true });
  h.reply(id3, { durable: false });
  ok((await p3).durable === true, 'the first reply wins');
  ok(b.stats().duplicate === dupBefore + 1, 'a duplicate reply is detected and ignored');

  h.reply('never-sent-id', { durable: true });
  ok(b.stats().unknown >= 1, 'a reply to an unknown request is ignored');
  b.dispose();
}

// ── 4 · Malformed inbound traffic ────────────────────────────────────────────
{
  const h = loopback(); const b = h.make();
  for (const junk of [null, 42, 'not json', '{"v":2,"id":"a","ok":true}', { v: 1 }, { v: 1, id: 'x' },
    { v: 1, id: 'n:1', ok: true, result: {} }, { v: 1, event: 'Bad Name', seq: 0 }, { v: 1, event: 'a.b', seq: -1 }]) {
    h.raw(junk);
  }
  ok(b.stats().malformed === 9, `every malformed message is rejected (${b.stats().malformed}/9)`);
  b.dispose();
}

// ── 5 · Limits ───────────────────────────────────────────────────────────────
{
  const h = loopback(); const b = h.make();
  const live = [];
  for (let i = 0; i < MAX_IN_FLIGHT_PER_CAPABILITY; i++) live.push(b.request('cloud', 'request', { i }, { timeoutMs: 60_000 }).catch(() => {}));
  await rejects(b.request('cloud', 'request', {}), 'UNAVAILABLE', `the ${MAX_IN_FLIGHT_PER_CAPABILITY + 1}th in-flight request is refused`);
  const other = b.request('storage', 'status', {});
  h.reply(h.last().id, { durable: true });
  ok((await other).durable === true, 'the limit is per capability');
  await rejects(b.request('cloud', 'request', { blob: 'x'.repeat(1024 * 1024 + 10) }), 'TOO_LARGE', 'an oversized envelope fails before posting');
  ok(h.sent.every(e => JSON.stringify(e).length < 2 * 1024 * 1024), 'nothing oversized was posted');
  b.dispose();
  await Promise.all(live);
}

// ── 6 · Events: ordering, buffering, isolation ───────────────────────────────
{
  const h = loopback(); const b = h.make();
  for (let i = 0; i < 3; i++) h.raw({ v: 1, event: 'billing.transactionUpdated', seq: i, payload: { n: i } });
  const seen = [];
  b.on('billing.transactionUpdated', p => seen.push(p.n));
  ok(seen.join() === '0,1,2', 'billing events before any listener are buffered and replayed in order');

  h.raw({ v: 1, event: 'billing.transactionUpdated', seq: 2, payload: { n: 99 } });
  h.raw({ v: 1, event: 'billing.transactionUpdated', seq: 1, payload: { n: 98 } });
  ok(seen.join() === '0,1,2', 'stale or duplicate sequence numbers are dropped');

  const lifecycleSeen = [];
  h.raw({ v: 1, event: 'lifecycle.state', seq: 10, payload: { state: 'background' } });
  b.on('lifecycle.state', p => lifecycleSeen.push(p.state));
  ok(lifecycleSeen.length === 0 && b.latest('lifecycle.state')?.state === 'background',
    'ephemeral events are not buffered, but their latest value is queryable');

  const order = [];
  b.on('lifecycle.state', () => { throw new Error('bad subscriber'); });
  b.on('lifecycle.state', p => order.push(p.state));
  h.raw({ v: 1, event: 'lifecycle.state', seq: 11, payload: { state: 'active' } });
  ok(order.join() === 'active' && b.stats().listenerErrors === 1, 'a throwing subscriber does not stop delivery to others');

  const h2 = loopback(); const b2 = h2.make();
  for (let i = 0; i < MAX_BUFFERED_EVENTS + 10; i++) h2.raw({ v: 1, event: 'billing.transactionUpdated', seq: i, payload: { n: i } });
  const kept = [];
  b2.on('billing.transactionUpdated', p => kept.push(p.n));
  ok(kept.length === MAX_BUFFERED_EVENTS && kept[0] === 10, 'the event buffer is bounded and keeps the newest');
  b.dispose(); b2.dispose();
}

// ── 7 · Disposal / reload ────────────────────────────────────────────────────
{
  const h = loopback(); const b = h.make();
  const p = b.request('cloud', 'request', {}, { timeoutMs: 60_000 });
  b.dispose('reload');
  await rejects(p, 'CANCELLED', 'dispose cancels everything in flight');
  await rejects(b.request('cloud', 'request', {}), 'CANCELLED', 'a disposed bridge refuses new work');
  const before = b.stats().malformed;
  h.raw({ v: 1, id: h.sent[0].id, ok: true, result: {} });
  ok(b.stats().malformed === before, 'and ignores traffic for the old document');
}

// ── 8 · Native → JS requests (Android Back) ─────────────────────────────────
{
  const h = loopback(); const b = h.make();
  b.onRequest('lifecycle.backRequested', async () => ({ handled: true }));
  h.raw({ v: 1, id: 'n:7', req: 'lifecycle.backRequested', payload: {} });
  await tick(5);
  const reply = h.sent.find(e => e.id === 'n:7');
  ok(reply?.ok === true && reply.result.handled === true, 'JS answers a native request on the same id');
  h.raw({ v: 1, id: 'n:8', req: 'lifecycle.unknownThing', payload: {} });
  await tick(5);
  ok(h.sent.find(e => e.id === 'n:8')?.error?.code === 'UNSUPPORTED', 'an unhandled native request is answered UNSUPPORTED');
  h.raw({ v: 1, id: 'not-prefixed', req: 'lifecycle.backRequested', payload: {} });
  ok(b.stats().malformed === 1, 'native request ids must carry the n: prefix');
  b.dispose();
}

// ── 9 · Late billing recovery (envelope transport) ───────────────────────────
{
  const h = loopback(); const b = h.make();
  const recovered = [];
  b.on('billing.transactionUpdated', t => recovered.push(t));
  const p = b.request('billing', 'purchase', { productId: 'm' }, { timeoutMs: 20, cancellable: false });
  const id = h.last().id;
  await rejects(p, 'TIMEOUT', 'a slow purchase times out for the UI');
  ok(!h.sent.some(e => e.op === 'cancel'), 'a committed purchase is not cancelled');
  h.reply(id, { status: 'verified', signedTransaction: 'jws.payload.sig', transactionId: 't1', productId: 'm' });
  ok(recovered.length === 1 && recovered[0].transactionId === 't1', 'the late paid transaction is re-emitted, never lost');
  const g = b.request('billing', 'purchase', { productId: 'pri_premium' }, { timeoutMs: 20, cancellable: false });
  const gid = h.last().id;
  await rejects(g, 'TIMEOUT', 'a slow Google Play payment (UPI, 3-D Secure) times out for the UI');
  h.reply(gid, { status: 'purchased', purchaseToken: 'tok-late', productId: 'pri_premium', state: 'purchased' });
  ok(recovered.length === 2 && recovered[1].purchaseToken === 'tok-late' && recovered[1].status === 'purchased',
    'a late Google Play purchase is re-emitted with its token, never lost');
  const c = b.request('billing', 'purchase', { productId: 'pri_premium' }, { timeoutMs: 20, cancellable: false });
  const cid = h.last().id;
  await rejects(c, 'TIMEOUT', 'a slow sheet times out');
  h.reply(cid, { status: 'cancelled' });
  ok(recovered.length === 2, 'a late cancellation is not mistaken for a purchase');
  b.dispose();
}

// ── 10 · Host discovery and negotiation ─────────────────────────────────────
{
  const scope = {};
  ok(discoverHost(scope).kind === 'browser', 'no host ⇒ browser');
  scope.__PRI_HOST__ = { protocol: 9, capabilities: { share: { versions: [1] } } };
  const newer = discoverHost(scope);
  ok(newer.kind === 'browser' && newer.diagnostics.protocolUnsupported === true, 'a newer protocol fails closed to a browser host');
  scope.__PRI_HOST__ = { protocol: 1, platform: 'ios', capabilities: { share: { versions: [2, 3] }, storage: { versions: [1, 2], durable: true } } };
  const h = discoverHost(scope);
  ok(!('share' in h.capabilities), 'a capability with no common version is unsupported');
  ok(h.capabilities.storage.version === 1 && h.capabilities.storage.durable === true, 'the highest common version is chosen and facts kept');
  ok(!('platform' in h) && !JSON.stringify(h).includes('ios'), 'OS identity never reaches the descriptor');
  ok(Object.isFrozen(h) && Object.isFrozen(h.capabilities) && Object.isFrozen(h.capabilities.storage), 'the descriptor is deep-frozen');
  const legacy = discoverHost({ __PRI_NATIVE__: true, __PRI_NATIVE_CLOUD__: true, __PRI_NATIVE_CLOUD_CONFIGURED__: false,
    webkit: { messageHandlers: { priCloud: { postMessage() {} } } } });
  ok(legacy.capabilities.cloud?.transport === 'legacy' && legacy.capabilities.cloud.configured === false,
    'a pre-CP-02 Apple shell is described with legacy transports and fails closed when cloud is unconfigured');
}

// ── 11 · priNative over a fake envelope host ────────────────────────────────
{
  const host = createFakeHost({
    capabilities: {
      share: { versions: [1], binary: true, print: true },
      storage: { versions: [1], durable: true },
      lifecycle: { versions: [1], backButton: true },
      billing: { versions: [1], store: 'play' },
      cloud: { versions: [1], configured: true },
      photo: { versions: [1], ocr: false },
    },
    handlers: {
      'host.ready': () => ({}),
      'share.file': payload => ({ completed: payload.filename === 'export.json' }),
      'cloud.request': payload => ({ status: 200, body: JSON.stringify({ path: payload.path }) }),
      'billing.products': () => ({ products: [{ id: 'm' }] }),
    },
  });
  ok(priNative.isNativeShell() && priNative.has('share') && !priNative.has('ink'), 'capabilities, not OS, describe the host');
  ok(priNative.ink.facts() === null, 'with no ink capability there are no ink facts');
  ok(priNative.billing.store() === 'play', 'the store is a capability fact');
  await tick(5);
  ok(host.lastRequest('host', 'ready'), 'JS announces host.ready once it is listening');
  ok((await priNative.share.file({ filename: 'export.json', text: '{}' })).completed === true, 'share.file works end to end');
  const bin = await priNative.share.file({ filename: 'export.json', mimeType: 'application/pdf', bytes: new Uint8Array([1, 2, 3]) });
  ok(bin.completed === true && host.lastRequest('share', 'file').payload.base64 === 'AQID', 'binary files travel as base64');
  const cloudReply = await priNative.cloud.request({ path: '/v1/me', method: 'GET' });
  ok(cloudReply.status === 200 && JSON.parse(cloudReply.body).path === '/v1/me', 'cloud.request works end to end');
  await rejects(priNative.ink.post({ op: 'mount' }) ? Promise.resolve() : Promise.reject(new PriNativeError('UNSUPPORTED')), 'UNSUPPORTED',
    'an unadvertised capability (ink) is unavailable');
  await rejects(priNative.photo.recognize('not-a-data-url'), 'BAD_REQUEST', 'photo input is validated before it is sent');
  await rejects(priNative.share.print(), 'UNSUPPORTED', 'an op the fake host does not implement is reported UNSUPPORTED');

  const states = [];
  const off = priNative.lifecycle.on(s => states.push(s));
  host.event('lifecycle.state', { state: 'background' });
  host.event('lifecycle.state', { state: 'bogus' });
  ok(states.join() === 'background' && priNative.lifecycle.state() === 'background', 'lifecycle state reaches subscribers; junk states are ignored');
  off();

  priNative.lifecycle.onBackRequested(() => true);
  const back = await host.ask('lifecycle.backRequested');
  ok(back.ok === true && back.result.handled === true, 'Android-style Back is a native→JS request with a reply');

  const updates = [];
  host.event('billing.transactionUpdated', { transactionId: 'early' });
  priNative.billing.onTransactionUpdate(t => updates.push(t.transactionId));
  ok(updates.join() === 'early', 'a billing event that arrives before the paywall mounts is delivered when it subscribes');

  priNative.dispose();
  host.uninstall();
}

// ── 12 · Legacy Apple transport: one transport, answer-blind, late recovery ──
{
  const posts = { priBridge: [], priBilling: [], priInk: [] };
  const listeners = new Map();
  globalThis.window = globalThis;
  globalThis.__PRI_NATIVE__ = true;
  globalThis.__PRI_NATIVE_INK__ = true;
  globalThis.__PRI_NATIVE_BILLING__ = true;
  globalThis.addEventListener = (name, fn) => listeners.set(name, [...(listeners.get(name) || []), fn]);
  globalThis.removeEventListener = () => {};
  globalThis.dispatchEvent = event => { for (const fn of listeners.get(event.type) || []) fn(event); return true; };
  globalThis.webkit = { messageHandlers: {
    priBridge: { postMessage: m => posts.priBridge.push(m) },
    priBilling: { postMessage: m => posts.priBilling.push(m) },
    priInk: { postMessage: m => posts.priInk.push(m) },
  } };
  const respond = detail => globalThis.dispatchEvent({ type: 'pri:native-billing-response', detail });

  const recovered = [];
  priNative.billing.onTransactionUpdate(t => recovered.push(t));
  const purchase = priNative.billing.request('purchase', { productId: 'm', appAccountToken: 'u' }, { timeoutMs: 1000 });
  ok(posts.priBilling.length === 1 && posts.priBridge.length === 0, 'a legacy-transport capability is sent once, over one transport only');
  const sentId = posts.priBilling[0].id;
  await rejects(purchase, 'TIMEOUT', 'the legacy purchase times out for the UI');
  respond({ id: sentId, ok: true, result: { status: 'verified', transactionId: 'late-1', signedTransaction: 'jws' } });
  ok(recovered.some(t => t.transactionId === 'late-1'), 'a late StoreKit result is recovered as a transaction update');

  ok(priNative.ink.post({ op: 'recognize', reqId: 1, overrides: {} }) === true, 'a normal ink request is posted');
  ok(priNative.ink.facts()?.fingerDefault === false, 'a legacy (pre-CP-04) shell never claims finger-default ink');
  ok(priNative.ink.post({ op: 'recognize', reqId: 2, overrides: {}, expectedAnswer: '42' }) === false,
    'an ink message carrying any non-allowlisted field (an expected answer) is refused');
  const longHybrid = `h3_${Array.from({ length: 12 }, (_, i) => 101 + i).join('_')}`; // a real 12-stroke group id
  ok(longHybrid.length > 40 && priNative.ink.post({ op: 'recognize', reqId: 3, overrides: { [longHybrid]: 'theta', bad: 'x'.repeat(200), 'no spaces': 'y' } }) === true,
    'a long real stroke-group override is kept and the request still goes (native recognition never silently switches off)');
  const posted3 = posts.priInk[posts.priInk.length - 1];
  ok(posted3.overrides[longHybrid] === 'theta' && !('bad' in posted3.overrides) && !('no spaces' in posted3.overrides),
    'malformed override entries are dropped individually');
  ok(!JSON.stringify(posts.priInk).includes('42'), 'no expected answer ever reached the native recogniser');

  priNative.dispose();
  for (const k of ['__PRI_NATIVE__', '__PRI_NATIVE_INK__', '__PRI_NATIVE_BILLING__', 'webkit', 'addEventListener', 'removeEventListener', 'dispatchEvent']) delete globalThis[k];
}

// ── 12b · cloudTransport keeps its error contract over priNative ────────────
{
  const listeners = new Map();
  const cloudPosts = [];
  globalThis.window = {
    __PRI_NATIVE__: true, __PRI_NATIVE_CLOUD__: true, __PRI_NATIVE_CLOUD_CONFIGURED__: true,
    webkit: { messageHandlers: { priCloud: { postMessage: m => cloudPosts.push(m) }, priShare: { postMessage: m => cloudPosts.push({ share: m }) } } },
    addEventListener: (n, fn) => listeners.set(n, [...(listeners.get(n) || []), fn]),
    removeEventListener: () => {},
  };
  const answer = detail => (listeners.get('pri:native-cloud-response') || []).forEach(fn => fn({ detail }));
  priNative.dispose();
  const { cloudRequest } = await import(`../src/platform/cloudTransport.js?map=${Date.now()}`);

  const slow = cloudRequest('/v1/me', { timeoutMs: 1000 });
  try { await slow; ok(false, 'timeout resolved'); } catch (e) { ok(e instanceof DOMException && e.name === 'TimeoutError', `a native timeout is still a TimeoutError (${e?.name})`); }
  ok(cloudPosts.some(m => m.action === 'cancel'), 'and cancels the URLSession task');

  const ctrl = new AbortController();
  const aborted = cloudRequest('/v1/me', { signal: ctrl.signal });
  ctrl.abort();
  try { await aborted; ok(false, 'abort resolved'); } catch (e) { ok(e?.name === 'AbortError', `an abort is still an AbortError (${e?.name})`); }

  const failed = cloudRequest('/v1/me');
  answer({ id: cloudPosts.filter(m => m.action === 'request').at(-1).id, error: { code: 'CLOUD_NETWORK_ERROR', message: 'offline' } });
  try { await failed; ok(false, 'failure resolved'); } catch (e) { ok(e.code === 'CLOUD_NETWORK_ERROR', `the provider code survives (${e.code})`); }

  const http = cloudRequest('/v1/me');
  answer({ id: cloudPosts.filter(m => m.action === 'request').at(-1).id, status: 403, body: JSON.stringify({ error: { code: 'ORIGIN_REJECTED', message: 'no' } }) });
  try { await http; ok(false, 'http error resolved'); } catch (e) { ok(e.status === 403 && e.code === 'ORIGIN_REJECTED', 'HTTP errors keep status and server code'); }

  ok(await priNative.cloud.forgetSession() === true && cloudPosts.some(m => m.action === 'forget'),
    'the legacy Apple cloud bridge is told to forget the session on Disconnect');

  globalThis.window.__PRI_NATIVE_CLOUD_CONFIGURED__ = false;
  priNative.dispose();
  try { await cloudRequest('/v1/me'); ok(false, 'unconfigured resolved'); } catch (e) { ok(e.code === 'CLOUD_DISABLED', `an unconfigured native cloud fails closed as CLOUD_DISABLED (${e.code})`); }

  // legacy share: text goes to the share sheet, binary is refused
  priNative.dispose();
  const shared = await priNative.share.file({ filename: '../../evil.json', text: '{}' });
  const sharePost = cloudPosts.find(m => m.share)?.share;
  ok(shared.presented === true && sharePost?.content === '{}' && /evil\.json$/.test(sharePost?.filename || '') && !String(sharePost?.filename).startsWith('.'),
    'legacy share sends the text file under a sanitised name');
  ok(!String(sharePost?.filename).includes('/'), 'a shared filename can never carry a path separator');
  await rejects(priNative.share.file({ filename: 'a.bin', bytes: new Uint8Array([1]) }), 'UNSUPPORTED', 'the legacy share handler refuses binary files');
  priNative.dispose();
  delete globalThis.window;
}

// ── 12c · saveTextFile falls back only when native sharing is unusable ───────
{
  const host = createFakeHost({ capabilities: { share: { versions: [1], binary: true } }, handlers: {
    'host.ready': () => ({}), 'share.file': (_p, _e, tools) => tools.SILENT,
  } });
  const anchors = [];
  globalThis.document = { createElement: () => { const a = { click() { anchors.push(a); }, remove() {} }; return a; }, body: { appendChild() {} } };
  globalThis.URL.createObjectURL = () => 'blob:x';
  const { saveTextFile } = await import(`../src/lib/files.js?save=${Date.now()}`);
  priNative.dispose();
  const pending = saveTextFile('{}', 'a.json');
  await tick(5);
  ok(host.lastRequest('share', 'file') && anchors.length === 0, 'with a share sheet open, no second download is started');
  priNative.dispose();
  await pending.catch(() => {});
  host.uninstall();
  const unsupportedHost = createFakeHost({ capabilities: { share: { versions: [1] } }, handlers: { 'host.ready': () => ({}) } });
  priNative.dispose();
  await saveTextFile('{}', 'b.json');
  ok(anchors.length === 1, 'an UNSUPPORTED share falls back to a download');
  priNative.dispose();
  unsupportedHost.uninstall();
  delete globalThis.document;
}

// ── 12c′ · Print goes to the native print dialog inside a shell ─────────────
{
  let printed = 0;
  globalThis.window = globalThis;
  globalThis.print = () => { printed += 1; };
  const { printPage } = await import(`../src/lib/files.js?print=${Date.now()}`);
  const host = createFakeHost({ capabilities: { share: { versions: [1], print: true } }, handlers: {
    'host.ready': () => ({}), 'share.print': () => ({ completed: true }),
  } });
  priNative.dispose();
  const result = await printPage();
  ok(host.lastRequest('share', 'print') && result?.completed === true && printed === 0,
    'inside a shell that can print, Print opens the native print dialog (window.print() is a no-op in Android WebView)');
  priNative.dispose();
  host.uninstall();
  const noPrint = createFakeHost({ capabilities: { share: { versions: [1] } }, handlers: { 'host.ready': () => ({}) } });
  priNative.dispose();
  await printPage();
  ok(printed === 1 && !noPrint.lastRequest('share', 'print'), 'a host without print (and every browser) uses window.print()');
  priNative.dispose();
  noPrint.uninstall();
  delete globalThis.print;
  delete globalThis.window;
}

// ── 12c″ · Disconnect forgets the native session even offline ───────────────
{
  const host = createFakeHost({ capabilities: { cloud: { versions: [1], configured: true } }, handlers: {
    'host.ready': () => ({}), 'cloud.forgetSession': () => ({}),
  } });
  priNative.dispose();
  ok(await priNative.cloud.forgetSession() === true && !!host.lastRequest('cloud', 'forgetSession'),
    'an envelope host is asked to forget the cloud session');
  priNative.dispose();
  host.uninstall();
  const failing = createFakeHost({ capabilities: { cloud: { versions: [1], configured: true } }, handlers: { 'host.ready': () => ({}) } });
  priNative.dispose();
  ok(await priNative.cloud.forgetSession() === false, 'a host that cannot forget answers false, never throws');
  priNative.dispose();
  failing.uninstall();
  ok(await priNative.cloud.forgetSession() === false, 'with no cloud capability (a browser) there is nothing to forget');
}

// ── 12d · Android delivery: JSON strings out, `message` events back ──────────
{
  const listeners = [];
  const sent = [];
  globalThis.priBridge = {
    postMessage: json => sent.push(JSON.parse(json)),
    addEventListener: (type, fn) => { if (type === 'message') listeners.push(fn); },
  };
  Object.defineProperty(globalThis, '__PRI_HOST__', { configurable: true, writable: false,
    value: Object.freeze({ protocol: 1, capabilities: Object.freeze({ storage: Object.freeze({ versions: [1], durable: true }), lifecycle: Object.freeze({ versions: [1], backButton: true }) }) }) });
  priNative.dispose();
  priNative.start();
  await tick(5);
  ok(listeners.length === 1, 'priNative listens for Android WebMessage replies exactly once');
  ok(typeof sent[0] === 'object' && sent[0].cap === 'host' && sent[0].op === 'ready', 'and posts envelopes to priBridge as JSON strings');
  // A native → JS Back question answered through the same channel.
  const { wantsBack, performBack, historyDepth } = await import('../src/platform/backNavigation.js');
  globalThis.KeyboardEvent ??= class { constructor(type, init) { this.type = type; Object.assign(this, init); } };
  const atLanding = { state: { idx: 0 }, back() { throw new Error('must not navigate from the landing entry'); } };
  let closed = false;
  const sheet = { hidden: false, getClientRects: () => (closed ? [] : [1]), dispatchEvent: e => { if (e.key === 'Escape') closed = true; return true; } };
  const docWithSheet = { querySelector: s => (s === '.mnav-sheet' ? sheet : null), querySelectorAll: () => [], contains: () => true };
  ok(wantsBack({ doc: docWithSheet, hist: atLanding }) === true, 'an open sheet means the page wants Back, even on the landing entry');
  ok(performBack({ doc: docWithSheet, hist: { state: { idx: 3 }, back() { throw new Error('must not navigate'); } } }) === 'dialog-escape-sent' && closed,
    'Back closes the open sheet and does not also navigate');
  const stubborn = { hidden: false, getClientRects: () => [1], dispatchEvent: () => true }; // ignores Escape (e.g. a confirmation)
  const docStubborn = { querySelector: () => null, querySelectorAll: () => [stubborn], contains: () => true };
  ok(performBack({ doc: docStubborn, hist: { state: { idx: 2 }, back() { throw new Error('must not navigate'); } } }) === 'dialog-escape-sent',
    'a dialog that stays visible after Escape never lets the same press navigate');
  const hiddenDialog = { hidden: false, getClientRects: () => [] };
  const route = { querySelector: () => null, querySelectorAll: () => [hiddenDialog], contains: () => true };
  let wentBack = false;
  ok(wantsBack({ doc: route, hist: { state: { idx: 1 } } }) === true && wantsBack({ doc: route, hist: atLanding }) === false,
    'with in-app history the page wants Back; on the landing entry with nothing visibly open it does not (an invisible dialog is ignored)');
  ok(wantsBack({ doc: route, hist: { state: { idx: 0 } } }) === false && wantsBack({ doc: route, hist: { state: null } }) === false,
    'a teacher landing on /teach (replace keeps idx 0) or a restored deep entry can leave the app with Back');
  ok(historyDepth({ state: { idx: -1 } }) === 0 && historyDepth({ state: { idx: '2' } }) === 0 && historyDepth({ state: { idx: 4 } }) === 4,
    'only a non-negative integer router index counts as history depth');
  ok(performBack({ doc: route, hist: { state: { idx: 1 }, back() { wentBack = true; } } }) === 'history-back' && wentBack,
    'with no sheet open, Back goes back in the page history');
  ok(performBack({ doc: route, hist: atLanding }) === 'nothing', 'on the landing entry the page does nothing (the shell had already let the system handle it)');
  const sentBefore = sent.length;
  priNative.lifecycle.declareBack(true).catch(() => {}); // the fake shell does not answer
  await tick(5);
  const declared = sent.slice(sentBefore).find(m => m.cap === 'lifecycle' && m.op === 'setBackHandled');
  ok(declared?.payload?.handled === true, 'the page declares its Back state to the shell (no timed round trip)');
  let gotBack = 0;
  priNative.lifecycle.onBack(() => { gotBack += 1; });
  listeners[0]({ data: JSON.stringify({ v: 1, event: 'lifecycle.back', seq: 50, payload: {} }) });
  ok(gotBack === 1, 'the shell hands Back to the page as a one-way event');
  priNative.lifecycle.onBackRequested(() => true);
  listeners[0]({ data: JSON.stringify({ v: 1, id: 'n:9', req: 'lifecycle.backRequested', payload: {} }) });
  await tick(10);
  const answer = sent.find(m => m.id === 'n:9');
  ok(answer?.ok === true && answer.result.handled === true, 'a native Back request arriving as a message event gets its reply');
  priNative.dispose();
  delete globalThis.priBridge;
  delete globalThis.__PRI_HOST__;
}

// ── 13 · Answer-blind ink through the real ink module ────────────────────────
{
  const posted = [];
  globalThis.window = { __PRI_NATIVE_INK__: true, webkit: { messageHandlers: { priInk: { postMessage: m => posted.push(m) } } } };
  const { nativeInk } = await import(`../src/ink/native.js?answer-blind=${Date.now()}`);
  const secret = 'SECRET-ANSWER-7731';
  const reading = nativeInk.recognize({}, { expectedAnswer: secret, solution: secret, alphabet: ['x'] });
  ok(posted.length === 1 && !JSON.stringify(posted).includes(secret), 'recognition context stays on the web side; the answer never crosses');
  window.__priInkReceive({ type: 'reading', reqId: posted[0].reqId, text: 'x', lines: [], engine: 'native-rescue' });
  ok((await reading).text === 'x', 'and the reading still comes back');
  delete globalThis.window;
}

// ── 12d · SMS sign-in code through the shell (Android SMS User Consent) ─────
{
  const host = createFakeHost({ capabilities: { otp: { versions: [1], transport: 'bridge', sms: true } }, handlers: {
    'host.ready': () => ({}), 'otp.smsCode': () => ({ code: '482913' }),
  } });
  priNative.dispose();
  ok(priNative.otp.smsAvailable() === true, 'a shell that offers otp.sms is detected');
  ok(await priNative.otp.smsCode() === '482913' && !!host.lastRequest('otp', 'smsCode'), 'the code comes back as six digits');
  priNative.dispose();
  host.uninstall();
  const bad = createFakeHost({ capabilities: { otp: { versions: [1], transport: 'bridge', sms: true } }, handlers: {
    'host.ready': () => ({}), 'otp.smsCode': () => ({ code: '12ab<script>' }),
  } });
  priNative.dispose();
  await rejects(priNative.otp.smsCode(), 'BAD_REQUEST', 'anything but six digits from the shell is refused');
  priNative.dispose();
  bad.uninstall();
  const none = createFakeHost({ capabilities: {}, handlers: { 'host.ready': () => ({}) } });
  priNative.dispose();
  ok(priNative.otp.smsAvailable() === false, 'without the capability (iOS, browsers) the page never asks');
  await rejects(priNative.otp.smsCode(), 'UNSUPPORTED', 'and a direct call is UNSUPPORTED');
  // Play services stops listening after five minutes; a consent sheet tapped
  // just after that must still find the page waiting, or the code is lost.
  ok(OTP_NATIVE_SMS_WAIT_MS === 5 * 60 * 1000, 'the native SMS User Consent window is recorded as five minutes');
  ok(OTP_WAIT_MS > OTP_NATIVE_SMS_WAIT_MS, 'the page waits longer than the native SMS window, so a late consent tap is not cancelled');
  ok(OTP_WAIT_MS - OTP_NATIVE_SMS_WAIT_MS >= 60 * 1000, 'with at least a minute to spare for the consent sheet');
  priNative.dispose();
  none.uninstall();
}

// ── 14 · identity v1: Sign in with Apple through the envelope ────────────────
// The shell only runs the sheet and returns Apple's token; the server verifies
// it. The page sends the shell nothing but the SHA-256 digest of a server nonce,
// and refuses a reply that is not a token for that digest.
{
  const digest = 'a'.repeat(64);
  const token = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln';
  const noIdentity = createFakeHost({ capabilities: { cloud: { versions: [1], configured: true } } });
  ok(priNative.identity.available() === false && priNative.identity.providers().apple === false, 'a host without the identity capability offers no provider');
  await rejects(priNative.identity.appleSignIn({ nonceHash: digest }), 'UNSUPPORTED', 'and identity.appleSignIn is UNSUPPORTED there');
  priNative.dispose(); noIdentity.uninstall();

  const legacy = createFakeHost({ capabilities: { identity: { versions: [1], transport: 'legacy', apple: true } } });
  ok(priNative.identity.providers().apple === false, 'identity is defined over the envelope only; a legacy transport offers nothing');
  priNative.dispose(); legacy.uninstall();

  const newer = createFakeHost({ capabilities: { identity: { versions: [2], apple: true } } });
  ok(priNative.identity.available() === false, 'an identity version this build does not speak is unsupported, never a crash');
  priNative.dispose(); newer.uninstall();

  const h = createFakeHost({ capabilities: { identity: { versions: [1], apple: true } } });
  ok(discoverHost(globalThis).capabilities.identity.version === 1 && discoverHost(globalThis).capabilities.identity.transport === 'bridge', 'identity v1 negotiates over the bridge transport');
  ok(priNative.identity.available() === true && priNative.identity.providers().apple === true, 'and advertises Apple as a plain fact');
  await rejects(priNative.identity.appleSignIn({ nonceHash: 'not-a-digest' }), 'BAD_REQUEST', 'anything but a 64-hex digest is refused before posting');
  await rejects(priNative.identity.appleSignIn({}), 'BAD_REQUEST', 'as is a missing digest');
  ok(h.sent.filter(e => e.cap === 'identity').length === 0, 'nothing reached the shell for a refused request');

  h.on('identity.appleSignIn', payload => ({ identityToken: token, nonce: payload.nonce, authorizationCode: 'c', user: { email: 'a@b.test', fullName: 'A B' } }));
  const result = await priNative.identity.appleSignIn({ nonceHash: digest });
  const env = h.lastRequest('identity', 'appleSignIn');
  ok(env.v === 1 && Object.keys(env.payload).join() === 'nonce' && env.payload.nonce === digest, 'the request carries the digest and nothing else');
  ok(!h.sent.some(e => e.op === 'cancel'), 'a sign-in sheet is never sent a cancel');
  ok(result.identityToken === token && result.nonce === digest && result.user.email === 'a@b.test', 'a conforming reply resolves with the token');

  h.on('identity.appleSignIn', payload => ({ identityToken: token, nonce: 'b'.repeat(64) }));
  await rejects(priNative.identity.appleSignIn({ nonceHash: digest }), 'INTERNAL', 'a token answered for another digest is refused');
  h.on('identity.appleSignIn', payload => ({ identityToken: 'three.parts.missing-check-fails?', nonce: payload.nonce }));
  await rejects(priNative.identity.appleSignIn({ nonceHash: digest }), 'INTERNAL', 'a token that is not a compact JWT fails the reply schema');
  h.on('identity.appleSignIn', payload => ({ identityToken: token, nonce: payload.nonce, user: 'Asha' }));
  await rejects(priNative.identity.appleSignIn({ nonceHash: digest }), 'INTERNAL', 'a user field that is not an object fails the reply schema');
  h.on('identity.appleSignIn', () => { throw { code: 'USER_CANCELLED', message: 'cancelled' }; });
  await rejects(priNative.identity.appleSignIn({ nonceHash: digest }), 'USER_CANCELLED', 'the person dismissing the sheet is USER_CANCELLED');
  h.on('identity.appleSignIn', () => { throw { code: 'ASAuthorizationError.1000', message: 'unknown' }; });
  const e = await (async () => { try { await priNative.identity.appleSignIn({ nonceHash: digest }); } catch (err) { return err; } })();
  ok(e?.code === 'INTERNAL' && e?.detail?.providerCode === 'ASAuthorizationError.1000', 'a shell code outside the closed set becomes INTERNAL with the provider code kept');
  priNative.dispose(); h.uninstall();
}

// ── 15 · notifications v1: local reminders through the envelope ─────────────
{
  const h = createFakeHost({ capabilities: { notifications: { versions: [1] } } });
  h.on('notifications.requestPermission', () => ({ granted: true }));
  h.on('notifications.schedule', p => ({ scheduled: p.items.length }));
  h.on('notifications.cancelAll', () => ({}));
  ok(priNative.notifications.available() === true, 'notifications v1 negotiates over the bridge');
  ok((await priNative.notifications.requestPermission()).granted === true, 'permission is asked over the envelope');
  ok((await priNative.notifications.schedule({ items: [{ id: 'a', at: Date.now() + 60000, title: 'T', body: 'B', url: '/plan' }] })).scheduled === 1, 'schedule reports what it kept');
  h.on('notifications.schedule', () => ({ scheduled: 99 }));
  await rejects(priNative.notifications.schedule({ items: [] }), 'INTERNAL', 'a count outside the schema never reaches product code');
  priNative.dispose(); h.uninstall();
}

console.log(failures.length
  ? `NATIVE HOST CONTRACT: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `NATIVE HOST CONTRACT: PASS — ${pass}/${pass} checks — envelope, negotiation, timeouts, cancellation, late/duplicate/malformed replies, limits, ordered buffered events, dispose, native requests, one transport per capability, answer-blind ink, recovered late purchases and identity (Sign in with Apple) over the envelope.`);
process.exit(failures.length ? 1 : 0);
