// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Local-first API — every call is served on-device from IndexedDB.
// Same interface as a network client, zero network. Your data never leaves the iPad.
//
// The Years 7–12 question bank ships as one lazy chunk per year and stream, and
// this layer is the only place that sees a request before the backend runs it,
// so it is where those banks get pulled in. Three sources cover every route that
// can generate: the signed-in profile's scope (learned from the /me and profile
// responses), the subtopic or year named in the request, and — for the rare task
// or retry that points outside both — the bank the engine reports missing.
// ─────────────────────────────────────────────────────────────────────────────
import { dispatch } from './local/backend.js';
import { scopeForYear } from './engine/curriculum.js';
import { loadBanks, loadBanksFor, loadAllBanks } from './engine/generators/index.js';

// ── Bank preloading ──────────────────────────────────────────────────────────

const GENERATING = new Set(['/practice/next', '/exams', '/rush/start', '/match/start']);
const RETRY_PATH = /^\/history\/[^/]+\/retry$/;
const MAX_BANK_FAULTS = 4;

let scopeReady = Promise.resolve();
let pathway = 'advanced';

/** Pull in what a profile practises from: their year and stream, plus the year below. */
function warmScope(year, pw) {
  const y = Number(year);
  if (!y) return;
  const { own, revision } = scopeForYear(y, y >= 11 ? (pw || 'advanced') : 'advanced');
  const job = loadBanksFor([...own, ...revision].map(s => s.id));
  scopeReady = Promise.all([scopeReady, job]).then(() => { }, () => { });
}

/** Profile responses carry the year and pathway, so the scope is known from sign-in on. */
function noteUser(result) {
  const u = result?.user;
  if (!u?.year) return;
  pathway = u.pathway || 'advanced';
  warmScope(u.year, pathway);
}

function generates(method, path) {
  return method === 'POST' && (GENERATING.has(path) || path === '/profiles/demo' || RETRY_PATH.test(path));
}

async function preload(method, path, body) {
  if (!generates(method, path)) return;
  // The demo seeds a whole fictional history at a fixed year of its own choosing.
  if (path === '/profiles/demo') return loadAllBanks();
  if (body?.subtopic) await loadBanksFor([body.subtopic]);
  if (path === '/exams' && body?.year) warmScope(body.year, pathway);
  await scopeReady;
}

// ── Calls ────────────────────────────────────────────────────────────────────

async function call(method, path, body) {
  try {
    await preload(method, path, body);
    for (let faults = 0; ; faults++) {
      try {
        const result = await dispatch(method, path, body);
        if (path === '/me' || path.startsWith('/profiles')) noteUser(result);
        return result;
      } catch (err) {
        if (!err?.bankMissing || faults >= MAX_BANK_FAULTS) throw err;
        await loadBanks([err.bank]);
      }
    }
  } catch (e) {
    if (!e.status) e.status = 500;
    throw e;
  }
}

export const api = {
  get: p => call('GET', p),
  post: (p, b = {}) => call('POST', p, b),
  patch: (p, b = {}) => call('PATCH', p, b)
};
