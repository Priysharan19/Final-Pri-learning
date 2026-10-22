// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the student's own ink for the mistake notebook
//
// The server stores no pictures of handwriting. So that the notebook can show
// a mistake in the student's own hand, this device keeps a SMALL copy of the
// strokes of a wrong, server-marked answer — keyed by profile and the server's
// attemptId, which is the id the notebook entry carries.
//
//   · Display only. The copy is taken after the server's reply resolved the
//     question as wrong; it is never read, recognised or sent anywhere, and it
//     plays no part in marking (handwriting stays answer-blind).
//   · Small. Strokes are fitted into a SNAPSHOT_BOX-wide box, rounded to whole
//     points, thinned, and capped in points and characters.
//   · Bounded. At most MAX_MISTAKE_INKS per profile; the oldest go first.
//   · Owned by the profile. `mistakeInks` is a sealed, profile-indexed store
//     (local/idb.js SEALED_STORES and PROFILE_STORES), so it is encrypted with
//     a protected profile's key and deleted by wipeProfile with the profile.
// ─────────────────────────────────────────────────────────────────────────────
import { byIndex, del, get, put } from '../local/idb.js';

export const MISTAKE_INK_STORE = 'mistakeInks';
export const MAX_MISTAKE_INKS = 200;
export const SNAPSHOT_BOX = 320;
export const MAX_SNAPSHOT_POINTS = 1500;
export const MAX_SNAPSHOT_CHARS = 24_000;
const ID = /^[A-Za-z0-9._:-]{1,80}$/;

export const mistakeInkId = (pid, attemptId) => `${pid}:${attemptId}`;

function pointOf(p) {
  if (Array.isArray(p)) return [Number(p[0]), Number(p[1])];
  return [Number(p?.x), Number(p?.y)];
}

/**
 * A small, display-only copy of a page of strokes: [[x,y],...] per stroke in a
 * box SNAPSHOT_BOX wide, or null when there is nothing to keep. Pure.
 */
export function snapshotStrokes(strokes) {
  const lines = (Array.isArray(strokes) ? strokes : [])
    .map(st => (Array.isArray(st?.points) ? st.points : Array.isArray(st) ? st : []).map(pointOf)
      .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)))
    .filter(pts => pts.length > 0);
  if (!lines.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pts of lines) for (const [x, y] of pts) {
    if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
  const scale = Math.min(1, SNAPSHOT_BOX / w);
  const total = lines.reduce((n, pts) => n + pts.length, 0);
  // Thin by a stride first so the cap keeps the whole page, not its top half.
  let stride = Math.max(1, Math.ceil(total / MAX_SNAPSHOT_POINTS));
  for (;;) {
    const out = [];
    for (const pts of lines) {
      const kept = [];
      for (let i = 0; i < pts.length; i++) {
        if (i % stride !== 0 && i !== pts.length - 1) continue;
        const q = [Math.round((pts[i][0] - minX) * scale), Math.round((pts[i][1] - minY) * scale)];
        const last = kept[kept.length - 1];
        if (!last || last[0] !== q[0] || last[1] !== q[1]) kept.push(q);
      }
      if (kept.length) out.push(kept);
    }
    const snap = { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)), strokes: out };
    if (JSON.stringify(snap).length <= MAX_SNAPSHOT_CHARS || stride > total) return snap;
    stride *= 2;
  }
}

/** Ids to delete so that at most `cap` rows remain, newest kept. Pure. */
export function idsBeyondCap(rows, cap = MAX_MISTAKE_INKS) {
  return [...(rows || [])]
    .sort((a, b) => (Number(b?.createdAt) || 0) - (Number(a?.createdAt) || 0) || String(a?.id).localeCompare(String(b?.id)))
    .slice(Math.max(0, cap))
    .map(r => r.id);
}

/**
 * Keep the ink of a wrong, server-resolved answer. Best effort: a failure here
 * never touches the attempt. Returns true when a row was written.
 */
export async function saveMistakeInk(pid, attemptId, strokes, { now = Date.now() } = {}) {
  if (!pid || !ID.test(String(attemptId || ''))) return false;
  const snap = snapshotStrokes(strokes);
  if (!snap) return false;
  try {
    await put(MISTAKE_INK_STORE, { id: mistakeInkId(pid, attemptId), pid, attemptId: String(attemptId), ...snap, createdAt: now });
    const rows = await byIndex(MISTAKE_INK_STORE, 'pid', pid);
    for (const id of idsBeyondCap(rows)) await del(MISTAKE_INK_STORE, id);
    return true;
  } catch { return false; }
}

/** The saved ink of one notebook entry, or null. */
export async function readMistakeInk(pid, attemptId) {
  if (!pid || !ID.test(String(attemptId || ''))) return null;
  try {
    const row = await get(MISTAKE_INK_STORE, mistakeInkId(pid, attemptId));
    return row && Array.isArray(row.strokes) ? row : null;
  } catch { return null; }
}
