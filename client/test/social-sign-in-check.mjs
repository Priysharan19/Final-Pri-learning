// Pri Learning · Google and Apple sign-in, client half.
//
// socialSignIn.js builds each provider's authorize URL with the server-issued
// nonce and a random state, opens the popup before anything awaits (or the
// browser blocks it), and accepts an identity token only from the callback
// answering that state. cloudAccount.signInWithProvider() sends "Sign in"
// without an age declaration and with createAccount:false, sends a new
// account's guardian details, and keeps account PII off the device. The
// callback page reads the fragment once, clears it, and hands it back over the
// same-origin channel.

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { installBrowserEnv, resetStorage, rawRows } from './backend-check.mjs';

installBrowserEnv();
resetStorage();
const ORIGIN = 'https://pri.example.test';
globalThis.__PRI_CLOUD_ORIGIN__ = ORIGIN;

const { put } = await import('../src/local/idb.js');
const {
  authorizeUrl, requestIdentityToken, socialProviderConfig, socialSignInSupported,
  CALLBACK_CHANNEL, CALLBACK_PATH, APPLE_RELAY_PATH
} = await import('../src/platform/socialSignIn.js');
const { cloudAccountLink, signInWithProvider } = await import('../src/platform/cloudAccount.js');

let pass = 0;
const failures = [];
const ok = (name, condition, detail = '') => { if (condition) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const same = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
const rejectsWith = async (name, fn, code) => {
  try { await fn(); ok(name, false, 'did not reject'); } catch (error) { same(name, error?.code, code); }
};

const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const calls = [];
let socialResponse = () => json({ account: { id: 'acct-social', email: 'student@example.test', name: 'Social Student', role: 'student', emailVerified: true }, created: false });
let nonceCounter = 0;
globalThis.fetch = async (url, options = {}) => {
  const path = new URL(url).pathname;
  const body = options.body ? JSON.parse(options.body) : undefined;
  calls.push({ path, method: options.method || 'GET', body });
  if (path === '/v1/account/identity/providers') return json({ providers: { google: { clientId: 'pri-web.apps.googleusercontent.com' }, apple: { clientId: 'bad id with spaces' } } });
  if (path === '/v1/account/identity/nonce') return json({ nonce: `nonce-${++nonceCounter}`, expiresAt: Date.now() + 600000 }, 201);
  if (/^\/v1\/account\/identity\/(google|apple)\/sign-in$/.test(path)) return socialResponse(body);
  if (path === '/v1/entitlements') return json({ accountId: 'acct-social', entitlement: { plan: 'free', status: 'free', provider: 'none', sourceVersion: 0 } });
  return json({ error: { code: 'NOT_FOUND', message: path } }, 404);
};

// A browser that records what the code under test did, in order.
function fakeBrowser({ origin = ORIGIN, popupBlocked = false } = {}) {
  const events = [];
  const channels = [];
  class Channel {
    constructor(name) { this.name = name; this.onmessage = null; this.closed = false; channels.push(this); }
    postMessage() {}
    close() { this.closed = true; }
  }
  const popup = {
    closed: false,
    location: { set href(value) { events.push(['navigate', value]); popup.url = value; } },
    close() { popup.closed = true; events.push(['close']); }
  };
  const env = {
    location: { origin },
    crypto: globalThis.crypto,
    btoa: globalThis.btoa,
    BroadcastChannel: Channel,
    open(url, name, features) {
      events.push(['open', url, name, features, calls.length]);
      return popupBlocked ? null : popup;
    }
  };
  const deliver = data => channels.filter(ch => ch.name === CALLBACK_CHANNEL && !ch.closed).forEach(ch => ch.onmessage?.({ data }));
  return { env, events, popup, channels, deliver };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const stateOf = url => new URL(url).searchParams.get('state');

// ── authorize URLs ─────────────────────────────────────────────────────────
{
  const google = new URL(authorizeUrl('google', { clientId: 'pri-web.apps.googleusercontent.com', nonce: 'n1', state: 's1', origin: ORIGIN }));
  same('Google authorize endpoint', `${google.origin}${google.pathname}`, 'https://accounts.google.com/o/oauth2/v2/auth');
  same('Google asks for an identity token only', google.searchParams.get('response_type'), 'id_token');
  same('Google returns to the callback page on this origin', google.searchParams.get('redirect_uri'), `${ORIGIN}${CALLBACK_PATH}`);
  same('Google carries the server nonce verbatim', google.searchParams.get('nonce'), 'n1');
  same('Google carries the state', google.searchParams.get('state'), 's1');
  ok('Google scope asks for email', google.searchParams.get('scope').split(' ').includes('email'));

  const apple = new URL(authorizeUrl('apple', { clientId: 'com.prilearning.web', nonce: 'n2', state: 's2', origin: ORIGIN }));
  same('Apple authorize endpoint', `${apple.origin}${apple.pathname}`, 'https://appleid.apple.com/auth/authorize');
  same('Apple form-posts to the server relay', apple.searchParams.get('redirect_uri'), `${ORIGIN}${APPLE_RELAY_PATH}`);
  same('Apple response mode is form_post (needed for email and name)', apple.searchParams.get('response_mode'), 'form_post');
  same('Apple asks for name and email', apple.searchParams.get('scope'), 'name email');
  same('Apple carries the server nonce', apple.searchParams.get('nonce'), 'n2');

  let threw = null;
  try { authorizeUrl('google', { clientId: 'x" onclick', nonce: 'n', state: 's', origin: ORIGIN }); } catch (error) { threw = error; }
  same('a malformed client id never reaches a URL', threw?.code, 'SOCIAL_NOT_CONFIGURED');
}

// ── where it is offered ────────────────────────────────────────────────────
{
  same('offered when the page is on the cloud origin', socialSignInSupported(fakeBrowser().env), true);
  same('not offered on another origin (the callback could not hand the token back)', socialSignInSupported(fakeBrowser({ origin: 'https://other.example' }).env), false);
  same('not offered without BroadcastChannel', socialSignInSupported({ ...fakeBrowser().env, BroadcastChannel: undefined }), false);
  const config = await socialProviderConfig(fakeBrowser().env);
  same('a configured Google client id is offered', config.google, { clientId: 'pri-web.apps.googleusercontent.com' });
  same('a malformed client id from the server is not offered', config.apple, null);
  calls.length = 0;
  same('another origin asks the server nothing', await socialProviderConfig(fakeBrowser({ origin: 'https://other.example' }).env), { google: null, apple: null });
  same('and makes no request', calls.length, 0);
}

// ── the popup round trip ───────────────────────────────────────────────────
{
  calls.length = 0;
  const b = fakeBrowser();
  const pending = requestIdentityToken('google', { clientId: 'pri-web.apps.googleusercontent.com' }, { env: b.env });
  same('the popup opens before any request is made (or browsers block it)', b.events[0]?.slice(0, 2).concat(b.events[0]?.[4]), ['open', 'about:blank', 0]);
  await settle(); await settle();
  const navigated = b.events.find(e => e[0] === 'navigate')?.[1];
  ok('the popup is sent to Google once the nonce is issued', navigated?.startsWith('https://accounts.google.com/'), navigated);
  same('with the nonce the server issued', new URL(navigated).searchParams.get('nonce'), `nonce-${nonceCounter}`);
  const state = stateOf(navigated);
  ok('state is random and URL-safe', /^[A-Za-z0-9_-]{32}$/.test(state), state);
  b.deliver({ type: 'pri-oidc-callback', state: 'someone-elses-state', idToken: 'forged.token.x' });
  b.deliver({ type: 'pri-oidc-callback', state, idToken: 'header.payload.sig' });
  const result = await pending;
  same('only the answer for this attempt\'s state is taken', result, { idToken: 'header.payload.sig', nonce: `nonce-${nonceCounter}` });
  ok('the channel is closed afterwards', b.channels.every(ch => ch.closed));
  const second = fakeBrowser();
  const pending2 = requestIdentityToken('google', { clientId: 'pri-web.apps.googleusercontent.com' }, { env: second.env });
  await settle(); await settle();
  ok('each attempt has its own state', stateOf(second.events.find(e => e[0] === 'navigate')[1]) !== state);
  second.deliver({ type: 'pri-oidc-callback', state: stateOf(second.events.find(e => e[0] === 'navigate')[1]), error: 'access_denied' });
  await rejectsWith('a declined Google page reads as cancelled', () => pending2, 'SOCIAL_CANCELLED');
  ok('and the popup is closed', second.popup.closed);
}
{
  const b = fakeBrowser();
  const pending = requestIdentityToken('apple', { clientId: 'com.prilearning.web' }, { env: b.env });
  await settle(); await settle();
  b.deliver({ type: 'pri-oidc-callback', state: stateOf(b.events.find(e => e[0] === 'navigate')[1]), error: 'invalid_response' });
  await rejectsWith('a broken provider answer is a provider error', () => pending, 'SOCIAL_PROVIDER_ERROR');
}
{
  const controller = new AbortController();
  const b = fakeBrowser();
  const pending = requestIdentityToken('google', { clientId: 'pri-web.apps.googleusercontent.com' }, { env: b.env, signal: controller.signal });
  await settle();
  controller.abort();
  await rejectsWith('Cancel ends the wait', () => pending, 'SOCIAL_CANCELLED');
  ok('and closes the popup', b.popup.closed);
}
{
  const b = fakeBrowser();
  await rejectsWith('a popup that never answers times out', () => requestIdentityToken('google', { clientId: 'pri-web.apps.googleusercontent.com' }, { env: b.env, timeoutMs: 20 }), 'SOCIAL_TIMEOUT');
  calls.length = 0;
  await rejectsWith('a blocked popup is reported as blocked', () => requestIdentityToken('google', { clientId: 'pri-web.apps.googleusercontent.com' }, { env: fakeBrowser({ popupBlocked: true }).env }), 'SOCIAL_POPUP_BLOCKED');
  same('and no nonce is spent on it', calls.filter(call => call.path === '/v1/account/identity/nonce').length, 0);
}

// ── signing in links the profile, and only sends what each mode needs ─────
await put('profiles', { id: 'p1', name: 'Offline Student', year: 9, course: 'in' });
{
  calls.length = 0;
  const { link, created } = await signInWithProvider('p1', 'google', { idToken: 'h.p.s', nonce: 'nonce-x', createAccount: false, year: 9, isAdult: false, guardianName: 'Asha', guardianEmail: 'asha@example.test' });
  const sent = calls.find(call => call.path === '/v1/account/identity/google/sign-in').body;
  same('"Sign in" says it must not create an account', sent.createAccount, false);
  same('and sends no age or guardian details', ['year', 'isAdult', 'guardianName', 'guardianEmail', 'name'].filter(key => key in sent), []);
  same('it sends the token and the nonce it was issued for', [sent.idToken, sent.nonce], ['h.p.s', 'nonce-x']);
  ok('with this device\'s id', /^device-/.test(sent.deviceId), sent.deviceId);
  same('the profile is linked to the account', link.accountId, 'acct-social');
  same('reported as an existing account', created, false);
  const disk = JSON.stringify(rawRows().device || []);
  ok('the device keeps no account email', !disk.includes('student@example.test'), disk);
  ok('the device keeps no identity token', !disk.includes('h.p.s'), disk);
  same('the saved link reads back', (await cloudAccountLink('p1'))?.accountId, 'acct-social');
}
{
  await put('profiles', { id: 'p2', name: 'New Student', year: 10, course: 'in' });
  socialResponse = () => json({ account: { id: 'acct-new', email: 'new@example.test', name: 'New Student', role: 'student', emailVerified: true }, created: true }, 201);
  calls.length = 0;
  const { created } = await signInWithProvider('p2', 'apple', { idToken: 'h.p.s2', nonce: 'nonce-y', createAccount: true, name: 'New Student', year: 10, isAdult: false, guardianName: 'Ravi', guardianEmail: 'ravi@example.test' });
  const sent = calls.find(call => call.path === '/v1/account/identity/apple/sign-in').body;
  same('"Create account" sends the age declaration and the guardian', [sent.createAccount, sent.year, sent.isAdult, sent.guardianName, sent.guardianEmail, sent.name], [true, 10, false, 'Ravi', 'ravi@example.test', 'New Student']);
  same('reported as created', created, true);
  socialResponse = () => json({ error: { code: 'IDENTITY_NOT_REGISTERED', message: 'No Pri Learning account uses this sign-in yet. Choose Create account to make one.' } }, 404);
  await put('profiles', { id: 'p3', name: 'Stranger', year: 9, course: 'in' });
  await rejectsWith('a server refusal reaches the panel with its code', () => signInWithProvider('p3', 'google', { idToken: 'h.p.s3', nonce: 'n' }), 'IDENTITY_NOT_REGISTERED');
  same('and leaves the profile unlinked', await cloudAccountLink('p3'), null);
}

// ── the callback page ──────────────────────────────────────────────────────
{
  const source = readFileSync(new URL('../public/auth/callback.js', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../public/auth/callback.html', import.meta.url), 'utf8');
  ok('the callback page loads its script from this origin (CSP script-src self)', /<script src="\/auth\/callback\.js"><\/script>/.test(page) && !/<script>/.test(page));
  ok('the callback page sends no Referer', /<meta name="referrer" content="no-referrer">/.test(page));
  const run = (hash, relayedMeta = null) => {
    const posted = [];
    const replaced = [];
    let closed = false;
    const context = {
      location: { hash, pathname: relayedMeta == null ? '/auth/callback.html' : '/v1/account/identity/apple/callback' },
      document: { querySelector: selector => (relayedMeta != null && selector === 'meta[name="pri-oidc-callback"]' ? { getAttribute: () => relayedMeta } : null) },
      history: { replaceState: (a, b, url) => replaced.push(url) },
      URLSearchParams,
      BroadcastChannel: class { constructor(name) { this.name = name; } postMessage(message) { posted.push({ name: this.name, message }); } close() {} },
      setTimeout: fn => fn(),
      window: { close: () => { closed = true; } }
    };
    runInNewContext(source, context);
    return { posted, replaced, closed };
  };
  const google = run('#state=abc&id_token=h.p.s&scope=email');
  same('the token goes out on the sign-in channel', google.posted, [{ name: CALLBACK_CHANNEL, message: { type: 'pri-oidc-callback', provider: 'google', state: 'abc', idToken: 'h.p.s', error: '' } }]);
  same('the fragment is cleared from the address bar and history', google.replaced, ['/auth/callback.html']);
  ok('and the window closes itself', google.closed);
  const apple = run('', 'provider=apple&state=abc&error=user_cancelled_authorize');
  same('a provider error is passed on as an error', [apple.posted[0].message.provider, apple.posted[0].message.error, apple.posted[0].message.idToken], ['apple', 'user_cancelled_authorize', '']);
  same('an empty fragment is an invalid response', run('').posted[0].message.error, 'invalid_response');
  const relayed = run('', 'provider=apple&state=xyz&id_token=a.b.c');
  same('the Apple relay page\'s fields are read from its meta tag', [relayed.posted[0].message.provider, relayed.posted[0].message.state, relayed.posted[0].message.idToken], ['apple', 'xyz', 'a.b.c']);
}

// ── the service worker leaves the callback page alone ──────────────────────
{
  const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  ok('the service worker never answers the callback page with the app shell', /url\.pathname === '\/auth\/callback\.html'[^\n]*\) return;/.test(sw));
}

if (failures.length) {
  console.error(failures.map(line => `  ✗ ${line}`).join('\n'));
  console.error(`SOCIAL SIGN-IN: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  process.exit(1);
}
console.log(`SOCIAL SIGN-IN: PASS — ${pass}/${pass} checks — Google and Apple popups carry the server nonce and a per-attempt state, "Sign in" never creates an account, a new account carries its guardian, and the callback hands the token back once over the same-origin channel`);
