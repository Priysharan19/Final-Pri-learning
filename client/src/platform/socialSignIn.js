// Pri Learning · Google and Apple sign-in in the browser
//
// No provider script is loaded: the page's Content-Security-Policy allows
// scripts from this origin only, and a children's app has no business running
// a third party's code. Instead a popup opens the provider's own authorize page
// with a server-issued, single-use nonce and a random state. The provider sends
// the student back to /auth/callback.html on this origin (Apple by way of the
// server's form_post relay), and that page hands the identity token back over a
// same-origin BroadcastChannel. The server verifies the token and decides which
// account it is; nothing here does.
//
// The native shells are left out on purpose: their sign-in belongs to the OS
// sheets (Sign in with Apple through AuthenticationServices, Google through
// Credential Manager), which a popup inside a web view is not.

import { cloud, nativeCloudAvailable, normalizeCloudOrigin } from './cloudTransport.js';
import { priNative } from './native/index.js';

export const SOCIAL_PROVIDERS = Object.freeze(['google', 'apple']);
export const CALLBACK_PATH = '/auth/callback.html';
export const APPLE_RELAY_PATH = '/v1/account/identity/apple/callback';
export const CALLBACK_CHANNEL = 'pri-oidc-callback';
const CLIENT_ID = /^[A-Za-z0-9._-]{1,200}$/;
const WAIT_MS = 5 * 60 * 1000;
// What a provider says when the student closed or declined its page.
const CANCELLED = new Set(['access_denied', 'user_cancelled_authorize', 'popup_closed_by_user']);

function failure(code, message) {
  return Object.assign(new Error(message), { code });
}

/**
 * Whether this page can run a provider sign-in at all. The callback page and
 * the redirect URIs registered with Google and Apple live on the cloud origin,
 * and the token can only be handed to a page on that same origin.
 */
export function socialSignInSupported(env = globalThis) {
  if (priNative.isNativeShell() || nativeCloudAvailable()) return false;
  if (typeof env.BroadcastChannel !== 'function' || typeof env.open !== 'function') return false;
  const here = String(env.location?.origin || '');
  if (!/^https?:\/\//.test(here)) return false;
  let cloudOrigin = null;
  try { cloudOrigin = normalizeCloudOrigin(); } catch { return false; }
  return cloudOrigin === here;
}

/** The providers this deployment offers in a browser, with their public client ids. */
export async function socialProviderConfig(env = globalThis) {
  const none = { google: null, apple: null };
  if (!socialSignInSupported(env)) return none;
  const result = await cloud.identityProviders();
  const pick = provider => {
    const clientId = String(result?.providers?.[provider]?.clientId || '');
    return CLIENT_ID.test(clientId) ? { clientId } : null;
  };
  return { google: pick('google'), apple: pick('apple') };
}

/** The provider's authorize URL for one sign-in attempt. */
export function authorizeUrl(provider, { clientId, nonce, state, origin }) {
  if (!CLIENT_ID.test(String(clientId || ''))) throw failure('SOCIAL_NOT_CONFIGURED', 'This sign-in is not configured.');
  if (provider === 'google') {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${origin}${CALLBACK_PATH}`,
      response_type: 'id_token',
      scope: 'openid email profile',
      nonce,
      state,
      prompt: 'select_account'
    }).toString();
    return url.toString();
  }
  if (provider === 'apple') {
    // Apple returns email and name only with response_mode=form_post, which is
    // why its redirect URI is the server relay rather than the callback page.
    const url = new URL('https://appleid.apple.com/auth/authorize');
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${origin}${APPLE_RELAY_PATH}`,
      response_type: 'code id_token',
      response_mode: 'form_post',
      scope: 'name email',
      nonce,
      state
    }).toString();
    return url.toString();
  }
  throw failure('SOCIAL_NOT_CONFIGURED', 'This sign-in is not supported.');
}

function randomState(env) {
  const bytes = new Uint8Array(24);
  env.crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return env.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Run one provider sign-in and resolve to `{ idToken, nonce }` for the server.
 *
 * Call it straight from the click handler: the popup is opened before the first
 * await, because browsers block a window opened after one. Waiting ends when
 * the callback answers for this attempt's state, when `signal` aborts (the
 * Cancel button), or after five minutes. The popup's own `closed` flag is not
 * used: a provider page with a Cross-Origin-Opener-Policy severs it, and it
 * then reads as closed while the student is still signing in.
 */
export async function requestIdentityToken(provider, { clientId } = {}, { env = globalThis, signal = null, timeoutMs = WAIT_MS } = {}) {
  if (!SOCIAL_PROVIDERS.includes(provider)) throw failure('SOCIAL_NOT_CONFIGURED', 'This sign-in is not supported.');
  const popup = env.open('about:blank', 'pri-oidc', 'popup,width=520,height=680');
  if (!popup) throw failure('SOCIAL_POPUP_BLOCKED', 'The sign-in window was blocked.');
  const state = randomState(env);
  const channel = new env.BroadcastChannel(CALLBACK_CHANNEL);
  let timer = null;
  let onAbort = null;
  const answer = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(failure('SOCIAL_TIMEOUT', 'Sign-in took too long.')), timeoutMs);
    onAbort = () => reject(failure('SOCIAL_CANCELLED', 'Sign-in was cancelled.'));
    if (signal?.aborted) onAbort();
    signal?.addEventListener?.('abort', onAbort, { once: true });
    channel.onmessage = event => {
      const data = event?.data;
      if (!data || data.type !== 'pri-oidc-callback' || data.state !== state) return;
      if (data.error || !data.idToken) {
        reject(CANCELLED.has(data.error)
          ? failure('SOCIAL_CANCELLED', 'Sign-in was cancelled.')
          : failure('SOCIAL_PROVIDER_ERROR', 'The provider did not complete the sign-in.'));
        return;
      }
      resolve(String(data.idToken));
    };
  });
  // Settled below either way; this keeps an early failure from going unhandled.
  answer.catch(() => {});
  try {
    const { nonce } = await cloud.identityNonce();
    if (!nonce) throw failure('SOCIAL_PROVIDER_ERROR', 'The server did not issue a sign-in nonce.');
    popup.location.href = authorizeUrl(provider, { clientId, nonce, state, origin: env.location.origin });
    const idToken = await answer;
    return { idToken, nonce };
  } catch (error) {
    try { popup.close(); } catch { /* already gone */ }
    throw error;
  } finally {
    clearTimeout(timer);
    if (onAbort) signal?.removeEventListener?.('abort', onAbort);
    channel.onmessage = null;
    channel.close();
  }
}
