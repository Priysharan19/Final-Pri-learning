// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Sign in with Apple through the native shell (identity v1)
//
// The one flow product screens call. Its steps, in order, and what each may
// see:
//
//   1. POST /v1/account/identity/nonce — the server issues a single-use nonce
//      (stored hashed, ten-minute expiry).
//   2. SHA-256 the nonce here. Only the digest crosses to the shell: Apple's
//      documented pattern puts the digest on ASAuthorizationAppleIDRequest and
//      returns it in the identity token's `nonce` claim.
//   3. identity.appleSignIn — the shell runs the system sheet and returns the
//      identity token (priNative checks the echoed digest matches).
//   4. POST /v1/account/identity/apple/sign-in with the token and the RAW nonce
//      (or …/link for an account that is already signed in). The server
//      verifies issuer, audience, signature and nonce; the shell and this page
//      never decide who the person is.
//
// A new account must carry the same age/guardian declaration as password
// sign-up. When the server answers CONSENT_DECLARATION_REQUIRED (or the
// register route's AGE_DECLARATION_REQUIRED, the same rule checked by the
// shared ageDecision in server/platform/guardianConsent.js) the caller shows
// the consent step and calls again with `declaration`; the nonce was consumed
// by the first attempt, so the retry issues a new one and opens the sheet again
// (Apple only re-confirms with Face ID / Touch ID for an app it already knows).
//
// Nothing here talks to the network directly: every request goes through the
// audited cloud transport, and nothing here can grant a session on its own.
// ─────────────────────────────────────────────────────────────────────────────
import { priNative } from './index.js';
import { cloud } from '../cloudTransport.js';

export const CONSENT_DECLARATION_REQUIRED = 'CONSENT_DECLARATION_REQUIRED';
/** Every code the server uses to ask for the age/guardian declaration. */
export const DECLARATION_REQUIRED_CODES = Object.freeze([CONSENT_DECLARATION_REQUIRED, 'AGE_DECLARATION_REQUIRED']);
/** The declaration fields the password sign-up route already takes. */
export const DECLARATION_KEYS = Object.freeze(['year', 'isAdult', 'guardianName', 'guardianEmail']);
export const APPLE_SIGN_IN_STATUSES = Object.freeze(['signed-in', 'linked', 'cancelled', 'consent-required']);

/** True only when a native shell advertises the identity capability with Apple. */
export function appleSignInAvailable(native = priNative) {
  try { return native.identity.available() && native.identity.providers().apple === true; }
  catch { return false; }
}

// The landing screen offers Sign in with Apple before any local profile is open,
// but the identity Apple returns has to be linked to a profile that exists. So
// the landing screen only remembers the intent, for this tab, and the account
// panel opens the sheet once the profile is. Nothing about the person is stored.
const INTENT_KEY = 'pri-apple-sign-in-intent';
export function rememberAppleSignInIntent() {
  try {
    const store = globalThis.sessionStorage;
    if (!store || typeof store.setItem !== 'function') return false;
    store.setItem(INTENT_KEY, '1');
    return true;
  } catch { return false; }
}
/** Read and clear the remembered intent. */
export function takeAppleSignInIntent() {
  try {
    const store = globalThis.sessionStorage;
    if (!store || store.getItem(INTENT_KEY) !== '1') return false;
    store.removeItem(INTENT_KEY);
    return true;
  } catch { return false; }
}

/** Lowercase hex SHA-256 of a string, as Apple expects on the request nonce. */
export async function sha256Hex(text) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw Object.assign(new Error('This device cannot prepare a Sign in with Apple request.'), { code: 'CRYPTO_UNAVAILABLE' });
  const bytes = new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(String(text))));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/** Only the declared fields, in the shape the register route already accepts. */
export function declarationBody(declaration) {
  if (!declaration || typeof declaration !== 'object') return {};
  const out = {};
  if (declaration.year != null && Number.isFinite(Number(declaration.year))) out.year = Number(declaration.year);
  out.isAdult = declaration.isAdult === true;
  if (!out.isAdult) {
    out.guardianName = String(declaration.guardianName || '').trim().slice(0, 80);
    out.guardianEmail = String(declaration.guardianEmail || '').trim().slice(0, 160);
  }
  return out;
}

const failure = (code, message) => Object.assign(new Error(message), { code });

/**
 * Run Sign in with Apple end to end.
 *
 * mode 'sign-in' resolves one of
 *   { status: 'signed-in', account, created }   the server created a session
 *   { status: 'consent-required', error }       a new account needs the declaration
 *   { status: 'cancelled' }                      the person dismissed the sheet
 * mode 'link' (an account already signed in) resolves
 *   { status: 'linked', provider: 'apple' } | { status: 'cancelled' }
 * Every other failure rejects with the transport's error (`code`, `status`).
 */
export async function signInWithApple({
  mode = 'sign-in', deviceId = 'web', declaration = null, signal = null,
  transport = cloud, native = priNative, digest = sha256Hex
} = {}) {
  if (mode !== 'sign-in' && mode !== 'link') throw failure('BAD_REQUEST', `unknown Sign in with Apple mode ${mode}`);
  if (!appleSignInAvailable(native)) throw failure('IDENTITY_UNSUPPORTED', 'Sign in with Apple is not available on this device.');

  const issued = await transport.identityNonce();
  const nonce = String(issued?.nonce || '');
  if (!nonce || nonce.length > 128) throw failure('OIDC_NONCE_REQUIRED', 'The server did not issue a sign-in nonce.');
  const nonceHash = await digest(nonce);

  let credential;
  try {
    credential = await native.identity.appleSignIn({ nonceHash }, { signal });
  } catch (error) {
    if (error?.code === 'USER_CANCELLED') return { status: 'cancelled' };
    throw error;
  }

  // The raw nonce goes to the server and nowhere else; the shell only ever saw
  // its digest. Apple's authorization code and the one-time user object are
  // not forwarded: the server reads identity from the verified token alone.
  const body = { idToken: String(credential.identityToken), nonce };
  if (mode === 'link') {
    const result = await transport.linkIdentity('apple', body);
    return { status: 'linked', provider: 'apple', result };
  }
  body.deviceId = String(deviceId || 'web').slice(0, 160);
  if (typeof credential.user?.fullName === 'string' && credential.user.fullName.trim()) body.name = credential.user.fullName.trim().slice(0, 80);
  Object.assign(body, declarationBody(declaration));
  try {
    const result = await transport.socialSignIn('apple', body);
    return { status: 'signed-in', account: result?.account || null, created: result?.created === true, guardianConsentRequired: result?.guardianConsentRequired === true };
  } catch (error) {
    if (DECLARATION_REQUIRED_CODES.includes(error?.code)) return { status: 'consent-required', error };
    throw error;
  }
}
