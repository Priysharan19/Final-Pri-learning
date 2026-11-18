// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the student's original, ready to travel with the mark (#08)
//
// The owner's rule: marking checks the student's own handwriting. A
// handwritten answer is submitted WITH its original — the pen samples as the
// canvas captured them (engine/originalInk.js, pri-ink-v1) — and the server
// keeps it in the same transaction as the mark (server/platform/originalWork.js).
// A photographed answer's original is the photographed page itself.
//
// Nothing here reads or names a symbol, and nothing here is ever sent to the
// reader: the original goes only with the marking request, after the student
// confirmed the reading.
//
// The honest state the card shows (originalState):
//   'device'    kept on this device only (not yet sent, or the server did not
//               keep it — over its quota, or the page was too large to send);
//   'uploading' sent with the answer; the server has not answered yet;
//   'saved'     the server kept it with the mark, under the digest it names.
// ─────────────────────────────────────────────────────────────────────────────
import { INK_LIMITS, bytesToBase64, encodeInk, sha256Hex } from '../engine/originalInk.js';
import { segmentInkLines } from './inkLines.js';

/** gzip via the platform's CompressionStream; null where there is none. */
async function gzip(bytes) {
  if (typeof CompressionStream !== 'function' || typeof Response !== 'function') return null;
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch { return null; }
}

/**
 * The page's extent when the surface did not say (a draft restored from
 * disk): the furthest point, so every stroke is inside the page.
 */
function extentOf(strokes) {
  let w = 0, h = 0;
  for (const s of strokes) for (const p of [...(s?.points || []), ...(s?.raw || [])]) {
    if (Number.isFinite(p?.x)) w = Math.max(w, p.x);
    if (Number.isFinite(p?.y)) h = Math.max(h, p.y);
  }
  return { width: Math.ceil(w) + 1, height: Math.ceil(h) + 1 };
}

/**
 * Build the `original` a handwritten submission carries, from the reading the
 * ink surface published (InkAnswer: strokes, removed, page, inkSource), or
 * from bare strokes. Returns null when there is nothing to keep, or when the
 * page is larger than can be kept (it stays on this device; nothing is cut).
 * `edits` is the student's reading edits, oldest first ({ text, at }).
 */
export async function buildInkOriginal({ strokes, removed = [], page = null, inkSource = 'web-pointer', edits = [] } = {}) {
  const onPage = (Array.isArray(strokes) ? strokes : []).filter(s => (s?.points?.length || s?.raw?.length));
  if (!onPage.length) return null;
  const size = page && page.width > 0 && page.height > 0 ? page : extentOf(onPage);
  const source = inkSource === 'pencilkit' ? 'pencilkit' : 'web-pointer';
  const gone = Array.isArray(removed) ? removed : [];
  let bytes = null;
  try { bytes = encodeInk({ strokes: onPage, removed: gone, width: size.width, height: size.height, source }); } catch { bytes = null; }
  // A long page of raw pen samples can pass the limit. Rather than keep
  // nothing, keep the drawn points (fewer: near-duplicates are dropped) —
  // flagged CONDITIONED inside the format, never passed off as raw — and
  // then, if still too large, the page without its crossed-out strokes.
  const drawnOnly = list => list.map(({ raw: _raw, ...s }) => s);
  if (!bytes) try { bytes = encodeInk({ strokes: drawnOnly(onPage), removed: drawnOnly(gone), width: size.width, height: size.height, source }); } catch { bytes = null; }
  if (!bytes) try { bytes = encodeInk({ strokes: drawnOnly(onPage), width: size.width, height: size.height, source }); } catch { bytes = null; }
  if (!bytes) return null;
  const sha256 = await sha256Hex(bytes);
  const zipped = await gzip(bytes);
  const wire = zipped && zipped.byteLength < bytes.byteLength ? { encoding: 'gzip', data: bytesToBase64(zipped) } : { encoding: 'identity', data: bytesToBase64(bytes) };
  if (wire.data.length > Math.ceil((INK_LIMITS.maxBytes * 4) / 3)) return null;
  // Each written line, top to bottom, names the strokes it is made of —
  // geometry only, the same grouping the page's ✓/✗ marks use.
  const lines = segmentInkLines(onPage).slice(0, INK_LIMITS.maxLines).map(line => ({ strokes: line.strokeIdxs.slice() }));
  const keptEdits = (Array.isArray(edits) ? edits : []).filter(e => typeof e?.text === 'string' && Number.isSafeInteger(e?.at)).slice(-20)
    .map(e => ({ text: e.text.slice(0, 12000), at: e.at }));
  return { kind: 'strokes', ...wire, sha256, lines, ...(keptEdits.length ? { edits: keptEdits } : {}) };
}

/** The bytes of a data URL. */
function dataUrlBytes(dataUrl) {
  const comma = String(dataUrl || '').indexOf(',');
  if (comma < 0) return null;
  const s = atob(String(dataUrl).slice(comma + 1));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/**
 * The `original` of a photographed answer: the picture itself. When the
 * submission already carries that picture (`samePicture`), it is named, not
 * sent twice.
 */
export async function buildImageOriginal(dataUrl, { origin = 'photo', samePicture = false } = {}) {
  const bytes = dataUrlBytes(dataUrl);
  if (!bytes || !bytes.byteLength) return null;
  const sha256 = await sha256Hex(bytes);
  return samePicture ? { kind: 'image', origin, samePicture: true, sha256 } : { kind: 'image', origin, data: dataUrl, sha256 };
}

/** Characters an original adds to a request body (for the 1 MB body budget). */
export const originalWireChars = original => (original && typeof original.data === 'string' ? original.data.length : 0) + 512;

/** The honest state of a submission's original, for the card. */
export function originalState({ original = null, sent = false, reply = null } = {}) {
  if (reply?.original?.saved === true) return { state: 'saved', sha256: reply.original.sha256, id: reply.original.id };
  if (reply?.original && reply.original.saved === false) return { state: 'device', reason: reply.original.reason || null };
  if (original && sent) return { state: 'uploading' };
  return { state: 'device', reason: original ? null : 'not-kept' };
}
