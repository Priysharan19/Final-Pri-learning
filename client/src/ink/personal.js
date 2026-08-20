// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Personal handwriting memory (per profile)
// Every correction the student makes — and every calibration sample they give —
// is stored on-device and becomes a first-class template with priority over the
// stock shapes. The recogniser literally learns YOUR handwriting — and each
// profile on the iPad keeps its OWN hand: templates are namespaced by profile,
// so a sibling's loopy 2s never bleed into your model.
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME = 'pri-ink-personal';
const STORE = 'templates';
const MAX_PER_SYMBOL = 24;

let bank = [];          // [{sym, strokes(0-100 box), src}] for the ACTIVE profile
let loaded = false;
let loading = null;
let activePid = null;

const currentPid = () => {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem('pri-current-profile') : null; }
  catch { return null; }
};

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { resolve(null); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const st = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        st.createIndex('sym', 'sym');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const tx = (db, mode) => db.transaction(STORE, mode).objectStore(STORE);

/** Normalise raw strokes ([{points:[{x,y}]}] or [[[x,y]…]]) into a 0–100 box. */
export function normalizeStrokes(strokesRaw) {
  const strokes = strokesRaw.map(s => Array.isArray(s) ? s.map(p => [p[0], p[1]]) : s.points.map(p => [p.x, p.y]));
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const st of strokes) for (const p of st) {
    if (p[0] < x1) x1 = p[0]; if (p[0] > x2) x2 = p[0];
    if (p[1] < y1) y1 = p[1]; if (p[1] > y2) y2 = p[1];
  }
  const s = 100 / Math.max(x2 - x1, y2 - y1, 1e-6);
  return strokes.map(st => st.map(p => [
    Math.round((p[0] - x1) * s * 10) / 10,
    Math.round((p[1] - y1) * s * 10) / 10
  ]));
}

/** Point the bank at a profile (or null = shared). Reloads if it changed. */
export function setPersonalProfile(pid) {
  const next = pid || null;
  if (next === activePid && (loaded || loading)) return loading || Promise.resolve();
  activePid = next;
  loaded = false; loading = null; bank = [];
  return ensurePersonalLoaded();
}

export function ensurePersonalLoaded() {
  if (!loaded && !loading) activePid = activePid ?? currentPid();
  if (loaded || loading) return loading || Promise.resolve();
  loading = (async () => {
    try {
      const db = await openDB();
      if (!db) { loaded = true; return; }
      const rows = await new Promise((resolve, reject) => {
        const req = tx(db, 'readonly').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      // migration: templates saved before profiles existed belong to whoever
      // is signed in the first time they're seen (the original writer)
      const orphans = rows.filter(r => r.pid === undefined);
      if (orphans.length && activePid) {
        await new Promise((resolve) => {
          const st = tx(db, 'readwrite');
          for (const r of orphans) st.put({ ...r, pid: activePid });
          st.transaction.oncomplete = resolve;
          st.transaction.onerror = resolve;
        });
        for (const r of orphans) r.pid = activePid;
      }
      const mine = activePid ? rows.filter(r => r.pid === activePid || r.pid == null) : rows;
      bank = mine.map(r => ({ sym: r.sym, strokes: r.strokes, src: r.src }));
      loaded = true;
      db.close();
    } catch { loaded = true; }
  })();
  return loading;
}

/** Synchronous view for the recogniser hot path. */
export function getPersonalBank() { return bank; }

export async function addPersonal(sym, strokesRaw, src = 'correction') {
  const strokes = normalizeStrokes(strokesRaw);
  if (!strokes.length || strokes.every(st => st.length < 2)) return;
  bank.push({ sym, strokes, src });
  const pid = activePid ?? currentPid();
  try {
    const db = await openDB();
    if (!db) return;
    await new Promise((resolve, reject) => {
      const st = tx(db, 'readwrite');
      st.add({ sym, strokes, src, pid: pid || null, createdAt: Date.now() });
      st.transaction.oncomplete = resolve;
      st.transaction.onerror = () => reject(st.transaction.error);
    });
    // cap per symbol within this profile: drop oldest beyond the cap
    const db2 = await openDB();
    const rows = await new Promise((resolve) => {
      const req = tx(db2, 'readonly').index('sym').getAll(sym);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
    const ours = rows.filter(r => !pid || r.pid === pid || r.pid == null);
    if (ours.length > MAX_PER_SYMBOL) {
      const excess = ours.sort((a, b) => a.createdAt - b.createdAt).slice(0, ours.length - MAX_PER_SYMBOL);
      await new Promise((resolve) => {
        const st = tx(db2, 'readwrite');
        for (const r of excess) st.delete(r.id);
        st.transaction.oncomplete = resolve;
        st.transaction.onerror = resolve;
      });
      const drop = new Set(excess.map(r => JSON.stringify(r.strokes)));
      bank = bank.filter(b => !(b.sym === sym && drop.has(JSON.stringify(b.strokes))));
    }
    db2.close(); db.close();
  } catch { }
}

export async function clearPersonal() {
  bank = [];
  const pid = activePid ?? currentPid();
  try {
    const db = await openDB();
    if (!db) return;
    if (!pid) {
      await new Promise((resolve) => {
        const st = tx(db, 'readwrite');
        st.clear();
        st.transaction.oncomplete = resolve;
        st.transaction.onerror = resolve;
      });
    } else {
      const rows = await new Promise((resolve) => {
        const req = tx(db, 'readonly').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
      const mine = rows.filter(r => r.pid === pid || r.pid == null);
      await new Promise((resolve) => {
        const st = tx(db, 'readwrite');
        for (const r of mine) st.delete(r.id);
        st.transaction.oncomplete = resolve;
        st.transaction.onerror = resolve;
      });
    }
    db.close();
  } catch { }
}

export function personalStats() {
  const by = {};
  for (const b of bank) by[b.sym] = (by[b.sym] || 0) + 1;
  return { total: bank.length, bySymbol: by };
}
