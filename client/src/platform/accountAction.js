const ACTIONS = new Set(['verify-email', 'reset-password']);

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
