const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const FIRST_KEY = 'pri:marketing:first-touch';
const LAST_KEY = 'pri:marketing:last-touch';
const EVENTS_KEY = 'pri:marketing:events';
const MAX_EVENTS = 100;

function safeParse(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

function safeStore(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage is best effort */ }
}

function safeRead(key, fallback = null) {
  try { return safeParse(localStorage.getItem(key), fallback); } catch { return fallback; }
}

/**
 * Capture first- and last-touch UTM context locally.
 *
 * Deliberately no network request, cookie, fingerprint or fbclid persistence:
 * Pri Learning's learning runtime promises that student data is not uploaded.
 * Marketing attribution stays a first-party, on-device diagnostic until a
 * separately consented marketing endpoint exists.
 */
export function captureCampaign(loc = window.location) {
  const params = new URLSearchParams(loc.search || '');
  const touch = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) touch[key] = value.slice(0, 180);
  }
  if (!Object.keys(touch).length) return safeRead(LAST_KEY, null);

  const record = {
    ...touch,
    path: String(loc.pathname || '/').slice(0, 180),
    capturedAt: new Date().toISOString(),
  };
  if (!safeRead(FIRST_KEY)) safeStore(FIRST_KEY, record);
  safeStore(LAST_KEY, record);
  return record;
}

export function getCampaignAttribution() {
  return {
    firstTouch: safeRead(FIRST_KEY, null),
    lastTouch: safeRead(LAST_KEY, null),
  };
}

/**
 * Record a bounded local event and emit a DOM event for an optional future,
 * consented analytics adapter. Nothing leaves the device here.
 */
export function trackMarketing(name, properties = {}) {
  if (!name) return;
  const current = safeRead(EVENTS_KEY, []);
  const events = Array.isArray(current) ? current : [];
  const record = {
    name: String(name).slice(0, 80),
    at: new Date().toISOString(),
    campaign: safeRead(LAST_KEY, null),
    properties,
  };
  events.push(record);
  safeStore(EVENTS_KEY, events.slice(-MAX_EVENTS));
  try { window.dispatchEvent(new CustomEvent('pri:marketing', { detail: record })); } catch { /* no-op */ }
}

export function getMarketingEvents() {
  const events = safeRead(EVENTS_KEY, []);
  return Array.isArray(events) ? events : [];
}
