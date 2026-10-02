// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Sign in with Apple through the native shell (identity v1)
//
// Drives the real flow module against the fake envelope host (what the Swift
// shell must behave like) and a scripted transport standing in for the Pri
// server. Proves the order and the boundaries:
//
//   nonce (server) → SHA-256 digest only to the shell → identity token → raw
//   nonce + token to /sign-in → CONSENT_DECLARATION_REQUIRED → the declaration
//   step → a fresh nonce and sheet → signed in.
//
// And the refusals: cancellation, a token answered for another nonce, a
// malformed reply, a host that does not advertise the capability. The button
// never rendering without the capability is proven by rendering the landing
// screen (onboarding-scope-check.mjs bundles it) with and without a host.
//
// Run on its own:  node client/test/apple-sign-in-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createFakeHost } from '../src/platform/native/fakeHost.js';
import { priNative, PriNativeError } from '../src/platform/native/index.js';
import {
  APPLE_SIGN_IN_STATUSES, CONSENT_DECLARATION_REQUIRED, DECLARATION_KEYS, appleSignInAvailable, declarationBody,
  rememberAppleSignInIntent, sha256Hex, signInWithApple, takeAppleSignInIntent
} from '../src/platform/native/appleSignIn.js';
import { bundleLogin } from './onboarding-scope-check.mjs';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const sha = text => createHash('sha256').update(text).digest('hex');
const JWT = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImsxIn0.eyJpc3MiOiJodHRwczovL2FwcGxlaWQuYXBwbGUuY29tIn0.c2ln';
const read = rel => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

async function rejects(promise, code, label) {
  try { await promise; ok(false, `${label} (resolved)`); return null; }
  catch (e) { ok(e?.code === code, `${label} — got ${e?.code || e}`); return e; }
}

/** A scripted server. `signIn` decides each /sign-in answer from the body. */
function fakeTransport({ signIn, link } = {}) {
  const calls = [];
  let issued = 0;
  return {
    calls,
    oidcNonce: async () => { calls.push(['nonce']); issued += 1; return { nonce: `raw-nonce-${issued}`, expiresAt: Date.now() + 600_000 }; },
    socialSignIn: async (provider, body) => { calls.push(['sign-in', provider, body]); return signIn(body, calls); },
    linkIdentity: async (provider, body) => { calls.push(['link', provider, body]); return link ? link(body) : { linked: true, provider }; },
  };
}

function installHost({ apple = true, cloud = true, identity = true, transport = 'bridge' } = {}, handlers = {}) {
  priNative.dispose();
  const capabilities = {};
  if (identity) capabilities.identity = { versions: [1], transport, apple };
  if (cloud) capabilities.cloud = { versions: [1], configured: true };
  return createFakeHost({ capabilities, handlers });
}
function appleHandler(overrides = {}) {
  return payload => ({
    identityToken: JWT, authorizationCode: 'c_abc', nonce: payload.nonce,
    user: { email: 'student@example.test', fullName: 'Asha Rao' }, ...overrides
  });
}
const cleanup = host => { priNative.dispose(); host.uninstall(); };

// ── 1 · The contract shape ───────────────────────────────────────────────────
ok(JSON.stringify(APPLE_SIGN_IN_STATUSES) === JSON.stringify(['signed-in', 'linked', 'cancelled', 'consent-required']), 'the flow has a closed set of outcomes');
ok(JSON.stringify(DECLARATION_KEYS) === JSON.stringify(['year', 'isAdult', 'guardianName', 'guardianEmail']), 'the declaration is exactly what password sign-up sends');
ok(await sha256Hex('raw-nonce-1') === sha('raw-nonce-1'), 'the nonce digest is SHA-256, lowercase hex, as Apple expects on the request');
{
  const adult = declarationBody({ year: 11, isAdult: true, guardianName: 'x', guardianEmail: 'y' });
  ok(adult.isAdult === true && adult.year === 11 && !('guardianName' in adult), 'an adult declaration carries no guardian');
  const child = declarationBody({ year: '9', isAdult: false, guardianName: '  Meena Rao ', guardianEmail: 'meena@example.test' });
  ok(child.isAdult === false && child.year === 9 && child.guardianName === 'Meena Rao' && child.guardianEmail === 'meena@example.test', 'a child declaration carries the guardian, trimmed');
  ok(!('year' in declarationBody({ year: 'ten', isAdult: false })), 'a year that is not a number is not sent');
  ok(Object.keys(declarationBody(null)).length === 0, 'no declaration sends no declaration fields');
}

// ── 2 · No capability, no flow ───────────────────────────────────────────────
{
  delete globalThis.__PRI_HOST__;
  priNative.dispose();
  ok(appleSignInAvailable() === false, 'a browser host never offers Sign in with Apple');
  const transport = fakeTransport({ signIn: () => ({}) });
  await rejects(signInWithApple({ transport }), 'IDENTITY_UNSUPPORTED', 'the flow refuses on a browser host');
  ok(transport.calls.length === 0, 'and asks the server for nothing');

  const h1 = installHost({ identity: false });
  ok(appleSignInAvailable() === false, 'a native shell without the identity capability does not offer it');
  cleanup(h1);
  const h2 = installHost({ apple: false });
  ok(appleSignInAvailable() === false, 'nor one that advertises identity without Apple');
  cleanup(h2);
  const h3 = installHost({ transport: 'legacy' });
  ok(appleSignInAvailable() === false, 'nor over the legacy transport, which never defined identity');
  await rejects(priNative.identity.appleSignIn({ nonceHash: sha('x') }), 'UNSUPPORTED', 'the op is UNSUPPORTED on such a host');
  cleanup(h3);
  await rejects(signInWithApple({ mode: 'elsewhere', transport }), 'BAD_REQUEST', 'an unknown mode is refused before anything happens');
}

// ── 3 · The end-to-end flow: nonce → token → sign-in → consent → retry ───────
{
  const host = installHost({}, { 'identity.appleSignIn': appleHandler() });
  ok(appleSignInAvailable() === true && priNative.identity.providers().apple === true, 'the fake shell advertises Apple identity');
  const transport = fakeTransport({
    signIn: body => {
      if (body.isAdult === undefined) {
        throw Object.assign(new Error('Tell us about the account holder first.'), { code: CONSENT_DECLARATION_REQUIRED, status: 428 });
      }
      return { account: { id: 'acct_1', email: 'student@example.test', name: 'Asha Rao', role: 'student', emailVerified: true }, created: true };
    }
  });

  const first = await signInWithApple({ mode: 'sign-in', deviceId: 'device-ipad-1', transport });
  ok(first.status === 'consent-required' && first.error?.code === CONSENT_DECLARATION_REQUIRED, 'a new account without a declaration is sent back for consent');
  ok(transport.calls.map(c => c[0]).join('>') === 'nonce>sign-in', 'the server issued the nonce before the sheet and saw the sign-in after it');
  const sheet1 = host.lastRequest('identity', 'appleSignIn');
  ok(!!sheet1 && Object.keys(sheet1.payload).join() === 'nonce' && sheet1.payload.nonce === sha('raw-nonce-1'), 'the shell received only the SHA-256 digest of the nonce');
  ok(!JSON.stringify(host.sent).includes('raw-nonce-1'), 'the raw nonce never crossed to the shell');
  const signIn1 = transport.calls[1][2];
  ok(transport.calls[1][1] === 'apple' && signIn1.idToken === JWT && signIn1.nonce === 'raw-nonce-1', 'the server received the token with the RAW nonce it issued');
  ok(signIn1.deviceId === 'device-ipad-1' && signIn1.name === 'Asha Rao', 'with the device id and the name Apple shared on first sign-in');
  ok(!('authorizationCode' in signIn1) && !('email' in signIn1) && !('user' in signIn1), 'and nothing else from the credential: the server reads identity from the verified token');

  const second = await signInWithApple({
    mode: 'sign-in', deviceId: 'device-ipad-1', transport,
    declaration: { year: 10, isAdult: false, guardianName: 'Meena Rao', guardianEmail: 'meena@example.test' }
  });
  ok(second.status === 'signed-in' && second.created === true && second.account?.id === 'acct_1', 'the retry with the declaration creates the account and signs in');
  ok(second.guardianConsentRequired === false, 'the field the server sets for a child account is surfaced (false for an adult)');
  ok(transport.calls.map(c => c[0]).join('>') === 'nonce>sign-in>nonce>sign-in', 'the retry asked for a fresh nonce (the first was spent) before the sheet');
  const sheets = host.sent.filter(e => e.cap === 'identity' && e.op === 'appleSignIn');
  ok(sheets.length === 2 && sheets[1].payload.nonce === sha('raw-nonce-2'), 'and opened the sheet again with the new digest');
  const signIn2 = transport.calls[3][2];
  ok(signIn2.nonce === 'raw-nonce-2' && signIn2.year === 10 && signIn2.isAdult === false && signIn2.guardianName === 'Meena Rao' && signIn2.guardianEmail === 'meena@example.test',
    'the second sign-in carries the same declaration password sign-up sends');
  cleanup(host);
}

// ── 4 · Cancellation and provider failures ───────────────────────────────────
{
  const host = installHost({}, { 'identity.appleSignIn': () => { throw { code: 'USER_CANCELLED', message: 'cancelled' }; } });
  const transport = fakeTransport({ signIn: () => ({ account: { id: 'x' } }) });
  const outcome = await signInWithApple({ transport });
  ok(outcome.status === 'cancelled', 'the person dismissing the sheet is a cancelled outcome, not an error');
  ok(transport.calls.map(c => c[0]).join() === 'nonce', 'and no sign-in request follows a cancelled sheet');
  cleanup(host);

  const h2 = installHost({}, { 'identity.appleSignIn': () => { throw { code: 'PROVIDER_ERROR', message: 'ASAuthorizationError 1000' }; } });
  const t2 = fakeTransport({ signIn: () => ({ account: { id: 'x' } }) });
  const e = await rejects(signInWithApple({ transport: t2 }), 'PROVIDER_ERROR', 'a provider failure surfaces in the closed error set');
  ok(e instanceof PriNativeError, 'as a PriNativeError');
  ok(t2.calls.map(c => c[0]).join() === 'nonce', 'and no sign-in request follows it either');
  cleanup(h2);
}

// ── 5 · A token for another nonce, or a malformed reply, never reaches the server
{
  const host = installHost({}, { 'identity.appleSignIn': appleHandler({ nonce: sha('something-else') }) });
  const transport = fakeTransport({ signIn: () => ({ account: { id: 'x' } }) });
  await rejects(signInWithApple({ transport }), 'INTERNAL', 'a shell answering for a different nonce is refused');
  ok(!transport.calls.some(c => c[0] === 'sign-in'), 'and its token is not sent to the server');
  cleanup(host);

  const h2 = installHost({}, { 'identity.appleSignIn': appleHandler({ identityToken: 'not a jwt' }) });
  const t2 = fakeTransport({ signIn: () => ({ account: { id: 'x' } }) });
  await rejects(signInWithApple({ transport: t2 }), 'INTERNAL', 'a reply whose token is not a JWT fails the reply schema');
  ok(!t2.calls.some(c => c[0] === 'sign-in'), 'and nothing is sent to the server');
  cleanup(h2);

  const h3 = installHost({}, { 'identity.appleSignIn': appleHandler({ nonce: 'RAW' }) });
  await rejects(priNative.identity.appleSignIn({ nonceHash: sha('n') }), 'INTERNAL', 'a reply nonce that is not a digest fails the schema');
  await rejects(priNative.identity.appleSignIn({ nonceHash: 'raw-nonce' }), 'BAD_REQUEST', 'the op refuses anything but a 64-hex digest');
  ok(h3.sent.filter(e => e.cap === 'identity').length === 1, 'the refused request was never posted');
  cleanup(h3);

  const h4 = installHost({}, { 'identity.appleSignIn': appleHandler() });
  const t4 = fakeTransport({ signIn: () => ({ account: { id: 'x' } }) });
  t4.oidcNonce = async () => ({ expiresAt: 1 });
  await rejects(signInWithApple({ transport: t4 }), 'OIDC_NONCE_REQUIRED', 'no server nonce, no sheet');
  ok(h4.sent.filter(e => e.cap === 'identity').length === 0, 'the sheet is not opened without a nonce');
  cleanup(h4);
}

// ── 6 · Server refusals pass through for the panel to explain ────────────────
{
  const host = installHost({}, { 'identity.appleSignIn': appleHandler() });
  const transport = fakeTransport({ signIn: () => { throw Object.assign(new Error('link first'), { code: 'IDENTITY_LINK_REQUIRED', status: 409 }); } });
  const e = await rejects(signInWithApple({ transport }), 'IDENTITY_LINK_REQUIRED', 'an existing-email refusal reaches the caller with its code');
  ok(e?.status === 409, 'and its HTTP status');
  cleanup(host);
}

// ── 7 · Linking an account that is already signed in ─────────────────────────
{
  const host = installHost({}, { 'identity.appleSignIn': appleHandler() });
  const transport = fakeTransport({ signIn: () => { throw new Error('must not be called'); } });
  const outcome = await signInWithApple({ mode: 'link', transport, deviceId: 'ignored' });
  ok(outcome.status === 'linked' && outcome.provider === 'apple', 'link mode links');
  ok(transport.calls.map(c => c[0]).join('>') === 'nonce>link', 'through the nonce and the link route, never the sign-in route');
  const body = transport.calls[1][2];
  ok(body.idToken === JWT && body.nonce === 'raw-nonce-1' && Object.keys(body).sort().join() === 'idToken,nonce', 'the link body is the token and the raw nonce, nothing more');
  cleanup(host);
}

// ── 8 · The landing-screen intent is remembered for this tab only ────────────
{
  const store = new Map();
  // Node 22 exposes its own experimental sessionStorage accessor; replace it
  // for this block with a plain in-memory store and then with nothing at all.
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, writable: true, value: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) } });
  ok(takeAppleSignInIntent() === false, 'no intent until the button is tapped');
  ok(rememberAppleSignInIntent() === true && takeAppleSignInIntent() === true, 'a tapped intent is read once');
  ok(takeAppleSignInIntent() === false, 'and cleared by reading it');
  ok([...store.keys()].length === 0 && !JSON.stringify([...store]).includes('@'), 'nothing about the person is stored with it');
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, writable: true, value: undefined });
  ok(rememberAppleSignInIntent() === false && takeAppleSignInIntent() === false, 'without session storage the intent is simply not remembered');
  if (prior) Object.defineProperty(globalThis, 'sessionStorage', prior); else delete globalThis.sessionStorage;
}

// ── 9 · The button never renders without the capability ─────────────────────
{
  const login = read('../src/pages/Login.jsx');
  const panel = read('../src/components/CloudAccountPanel.jsx');
  ok(/const appleEntry = appleOffered && /.test(login) && /export const appleSignInOffered = \(\) => appleSignInAvailable\(\) && cloudAvailable\(\);/.test(login),
    'the landing screen offers the button only when the shell advertises identity AND the cloud is configured');
  ok(/const appleIdentity = appleSignInAvailable\(\);/.test(panel) && /\{appleIdentity && \(/.test(panel) && /\{appleIdentity && canSync && appleLinked === false && \(/.test(panel),
    'the account panel renders its sign-in and link buttons behind the same capability check');
  ok(!/localStorage|__PRI_HOST__|webkit/.test(read('../src/platform/native/appleSignIn.js')), 'the flow module reads no host internals of its own');

  // Behaviour: render the landing screen (production flags) as a browser and as a shell.
  const render = await bundleLogin({ extended: false, tag: 'apple' });
  delete globalThis.__PRI_HOST__;
  priNative.dispose();
  const browserHero = render({ initialStage: 'hero' });
  ok(!browserHero.includes('data-testid="apple-sign-in"'), 'a browser never sees Sign in with Apple on the landing screen');
  ok(browserHero.includes('Sign in to your Pri cloud account'), 'the password route is still offered there');
  const host = createFakeHost({ capabilities: { identity: { versions: [1], apple: true }, cloud: { versions: [1], configured: true } } });
  const shellHero = render({ initialStage: 'hero' });
  ok(shellHero.includes('data-testid="apple-sign-in"') && shellHero.includes('Sign in with Apple'), 'a shell with identity + cloud sees it');
  ok(/data-testid="apple-sign-in"[^>]*style="[^"]*background:#fff;color:#000/.test(shellHero), 'drawn white on the dark page, as Apple asks');
  host.uninstall();
  const noCloud = createFakeHost({ capabilities: { identity: { versions: [1], apple: true } } });
  ok(!render({ initialStage: 'hero' }).includes('data-testid="apple-sign-in"'), 'a shell whose cloud is not configured does not offer it');
  noCloud.uninstall();
  const noApple = createFakeHost({ capabilities: { identity: { versions: [1], apple: false }, cloud: { versions: [1], configured: true } } });
  ok(!render({ initialStage: 'hero' }).includes('data-testid="apple-sign-in"'), 'nor one that advertises identity without Apple');
  noApple.uninstall();
  const hi = read('../src/i18n/strings.hi.js');
  const en = read('../src/i18n/strings.en.js');
  for (const key of ['login.signInWithApple', 'cloud.continueWithApple', 'cloud.linkApple', 'cloud.appleConsentTitle', 'cloud.appleSignInCancelled']) {
    ok(en.includes(`'${key}':`) && hi.includes(`'${key}':`), `${key} is in both catalogues`);
  }
}

console.log(failures.length
  ? `APPLE SIGN IN: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `APPLE SIGN IN: PASS — ${pass}/${pass} checks — server nonce, digest-only to the shell, token + raw nonce to the server, consent-required retry with a fresh nonce, cancellation, mismatched/malformed replies refused, link mode, and no button without the capability.`);
process.exit(failures.length ? 1 : 0);
