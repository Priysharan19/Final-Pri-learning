// 'guardian-withdraw' is the long-lived link a guardian receives after confirming
// (server/platform/accounts.js): it can only ever withdraw consent.
// 'guardian-erase' is the second link in that same email, carrying the same
// bearer: it opens the page that asks for the account to be erased (D18).
const ACTIONS = new Set(['verify-email', 'reset-password', 'guardian-consent', 'guardian-withdraw', 'guardian-erase']);

export function parseAccountActionFragment(fragment = '') {
  const raw = String(fragment || '').replace(/^#/, '');
  const params = new URLSearchParams(raw);
  const action = String(params.get('action') || '');
  const token = String(params.get('token') || '');
  if (!ACTIONS.has(action) || !token || token.length > 512) return null;
  return Object.freeze({ action, token });
}

export function accountActionCleanUrl(locationLike = globalThis.location) {
  const pathname = String(locationLike?.pathname || '/account-action');
  const search = String(locationLike?.search || '');
  return `${pathname}${search}`;
}
