// The parent weekly report's calls (server/platform/parentReport.js). The
// server decides everything — premium, who may receive, what the report says;
// this only carries requests and coded errors.
import { cloudRequest } from '../platform/cloudTransport.js';

export const parentReportApi = Object.freeze({
  read: () => cloudRequest('/v1/parent-report'),
  link: (email) => cloudRequest('/v1/parent-report/link', { method: 'POST', body: { email } }),
  stop: () => cloudRequest('/v1/parent-report/link/stop', { method: 'POST', body: {} }),
  confirm: (token) => cloudRequest('/v1/parent-report/confirm', { method: 'POST', body: { token } }),
  unsubscribe: (token) => cloudRequest('/v1/parent-report/unsubscribe', { method: 'POST', body: { token } })
});

const EMAIL_ACTIONS = new Set(['confirm', 'unsubscribe']);

/** { action, token } from the emailed link's fragment, or null. */
export function parseParentEmailFragment(fragment = '') {
  const params = new URLSearchParams(String(fragment || '').replace(/^#/, ''));
  const action = String(params.get('action') || '');
  const token = String(params.get('token') || '');
  if (!EMAIL_ACTIONS.has(action) || !token || token.length > 512) return null;
  return Object.freeze({ action, token });
}

/** Whole percent of a 0–1 rate, or null when the server sent none. */
export function percent(rate) {
  return typeof rate === 'number' && Number.isFinite(rate) ? Math.round(rate * 100) : null;
}
