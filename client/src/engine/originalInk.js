// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the student's ORIGINAL work, as a byte format (standard #08)
//
// Owner rule: "the final marking must check the human's handwriting, not the
// computer's". The work being marked and shown is what the student wrote. This
// module is the one definition, shared by the device and the server, of how
// that writing is kept: the pen samples as the device reported them, never
// smoothed, beautified or replaced by a typeset version. The reading ("what Pri
// read") is a separate, secondary layer and is never stored in here.
//
// pri-ink-v1 — little-endian, canonical (one capture ⇒ one byte string ⇒ one
// SHA-256, on the device and on the server alike):
//
//   header   'PRIK' · u8 version (1) · u8 source · u16 reserved (0)
//            f32 page width · f32 page height (CSS px the points are in)
//            u32 stroke count
//   stroke   u32 point count · u8 flags · f64 start (s, relative to the first
//            stroke's first sample) · [f64 removedAt (s, same clock) if REMOVED]
//   point    f32 x · f32 y · f32 dt (ms since the stroke's start)
//            · [u16 pressure × 65535 if PRESSURE] · [f32 azimuth · f32 altitude if TILT]
//
// Stroke flags:
//   PRESSURE     the sample carries the pen's reported pressure;
//   TILT         the sample carries azimuth and altitude (Apple Pencil);
//   REMOVED      the student erased or undid this stroke: it is kept as a
//                correction (#08: corrections are kept, never overwritten) and
//                is not part of the page as finally written;
//   CONDITIONED  the points are the canvas's speed-adaptive (1€) display points
//                rather than raw samples. Only drafts captured before raw
//                capture existed have this; it is stated, never hidden.
//
// Precision: coordinates and times are kept as float32 — about 0.0002 px on a
// page a few thousand pixels tall, far below any pen's resolution. That is the
// only conversion: the round-trip test holds every point to it, and holds a
// second encode of the decoded page to the very same bytes and digest.
//
// Images (a photographed page, a rendered PDF page) are kept as the bytes the
// device sent; their digest is the SHA-256 of those bytes.
// ─────────────────────────────────────────────────────────────────────────────

export const INK_FORMAT = 'pri-ink-v1';
export const INK_VERSION = 1;
export const INK_SOURCES = Object.freeze({ 'web-pointer': 1, pencilkit: 2, 'web-conditioned': 3 });
const SOURCE_NAMES = Object.freeze(Object.fromEntries(Object.entries(INK_SOURCES).map(([k, v]) => [v, k])));
export const STROKE_FLAGS = Object.freeze({ PRESSURE: 1, TILT: 2, REMOVED: 4, CONDITIONED: 8 });

/** Hard ceilings, the same on both sides. A page beyond them is refused, never cut. */
export const INK_LIMITS = Object.freeze({
  maxBytes: 512 * 1024,           // canonical bytes of one page of strokes
  maxStrokes: 4000,
  maxPointsPerStroke: 20000,
  maxPoints: 36000,
  maxLines: 200,                  // reading lines linked to ink regions
  maxSide: 20000                  // page width/height in CSS px
});
const MAGIC = [0x50, 0x52, 0x49, 0x4b]; // 'PRIK'

const finite = v => typeof v === 'number' && Number.isFinite(v);
const clamp01 = v => Math.max(0, Math.min(1, v));

export class InkFormatError extends Error {
  constructor(message, code = 'INK_FORMAT_INVALID') { super(message); this.code = code; }
}

/** Seconds on the sample clock (InkCanvas stores `t` in seconds). */
const timeOf = point => (finite(point?.t) ? point.t : null);

/**
 * Write a prepared page: strokes as { flags, start, removedAt, points: [{ x, y,
 * dt, p?, azimuth?, altitude? }] }, every number written verbatim. Both
 * encodeInk and encodeDecoded end here, so the canonical bytes have one writer.
 */
function writePage({ width, height, sourceCode, strokes }) {
  if (strokes.length > INK_LIMITS.maxStrokes) throw new InkFormatError('Too many strokes on one page.', 'INK_TOO_LARGE');
  let points = 0;
  let size = 4 + 1 + 1 + 2 + 4 + 4 + 4;
  for (const st of strokes) {
    if (st.points.length > INK_LIMITS.maxPointsPerStroke) throw new InkFormatError('A stroke has too many points.', 'INK_TOO_LARGE');
    points += st.points.length;
    const removed = (st.flags & STROKE_FLAGS.REMOVED) !== 0;
    size += 4 + 1 + 8 + (removed ? 8 : 0)
      + st.points.length * (12 + (st.flags & STROKE_FLAGS.PRESSURE ? 2 : 0) + (st.flags & STROKE_FLAGS.TILT ? 8 : 0));
  }
  if (points > INK_LIMITS.maxPoints || size > INK_LIMITS.maxBytes) throw new InkFormatError('This page of writing is larger than can be kept.', 'INK_TOO_LARGE');
  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);
  let o = 0;
  for (const b of MAGIC) view.setUint8(o++, b);
  view.setUint8(o++, INK_VERSION); view.setUint8(o++, sourceCode); view.setUint16(o, 0, true); o += 2;
  view.setFloat32(o, width, true); o += 4; view.setFloat32(o, height, true); o += 4;
  view.setUint32(o, strokes.length, true); o += 4;
  for (const st of strokes) {
    view.setUint32(o, st.points.length, true); o += 4;
    view.setUint8(o++, st.flags);
    view.setFloat64(o, st.start, true); o += 8;
    if (st.flags & STROKE_FLAGS.REMOVED) { view.setFloat64(o, st.removedAt, true); o += 8; }
    for (const p of st.points) {
      view.setFloat32(o, p.x, true); o += 4;
      view.setFloat32(o, p.y, true); o += 4;
      view.setFloat32(o, p.dt, true); o += 4;
      if (st.flags & STROKE_FLAGS.PRESSURE) { view.setUint16(o, Math.round(clamp01(p.p) * 65535), true); o += 2; }
      if (st.flags & STROKE_FLAGS.TILT) { view.setFloat32(o, p.azimuth, true); o += 4; view.setFloat32(o, p.altitude, true); o += 4; }
    }
  }
  return new Uint8Array(buffer);
}

function checkPage(width, height, source) {
  const sourceCode = INK_SOURCES[source];
  if (!sourceCode) throw new InkFormatError(`Unknown ink source: ${source}.`);
  if (!finite(width) || !finite(height) || width < 0 || height < 0 || width > INK_LIMITS.maxSide || height > INK_LIMITS.maxSide) {
    throw new InkFormatError('The page size is not a size.');
  }
  return sourceCode;
}

/**
 * Encode one page from the canvas. `strokes` are the strokes on the page as
 * finally written, `removed` the strokes the student erased or undid (each may
 * carry `removedAt`, seconds on the sample clock). Returns a Uint8Array.
 *
 * A stroke with a non-empty `raw` array (InkCanvas's unfiltered pen samples)
 * is kept from it. A stroke with only `points` is kept from those and flagged
 * CONDITIONED — unless the caller says its points are the pen's own samples
 * (`rawPoints: true`: PencilKit's points from the native shell).
 */
export function encodeInk({ strokes = [], removed = [], width = 0, height = 0, source = 'web-pointer', rawPoints = false } = {}) {
  const sourceCode = checkPage(width, height, source);
  const all = [
    ...(Array.isArray(strokes) ? strokes : []).map(s => ({ s, removedAt: null })),
    ...(Array.isArray(removed) ? removed : []).map(s => ({ s, removedAt: finite(s?.removedAt) ? s.removedAt : null, removed: true }))
  ];
  if (all.length > INK_LIMITS.maxStrokes) throw new InkFormatError('Too many strokes on one page.', 'INK_TOO_LARGE');
  // The clock origin is the earliest sample on the page, so times are small
  // relative numbers whatever the device's timeline was.
  let origin = Infinity;
  const prepared = all.map(({ s, removedAt, removed: gone }) => {
    const hasRaw = Array.isArray(s?.raw) && s.raw.length > 0;
    const samples = hasRaw ? s.raw : (Array.isArray(s?.points) ? s.points : []);
    if (samples.length > INK_LIMITS.maxPointsPerStroke) throw new InkFormatError('A stroke has too many points.', 'INK_TOO_LARGE');
    const clean = samples.filter(p => finite(p?.x) && finite(p?.y));
    for (const p of clean) { const t = timeOf(p); if (t !== null && t < origin) origin = t; }
    return { clean, conditioned: !hasRaw && !rawPoints, removedAt, gone: gone === true };
  });
  if (!Number.isFinite(origin)) origin = 0;
  return writePage({ width, height, sourceCode, strokes: prepared.map(st => {
    const n = st.clean.length;
    const pressure = n > 0 && st.clean.every(p => finite(p.p));
    const tilt = n > 0 && st.clean.every(p => finite(p.azimuth) && finite(p.altitude));
    const first = n ? timeOf(st.clean[0]) : null;
    return {
      flags: (pressure ? STROKE_FLAGS.PRESSURE : 0) | (tilt ? STROKE_FLAGS.TILT : 0)
        | (st.gone ? STROKE_FLAGS.REMOVED : 0) | (st.conditioned ? STROKE_FLAGS.CONDITIONED : 0),
      start: first === null ? 0 : first - origin,
      removedAt: st.removedAt === null ? 0 : st.removedAt - origin,
      points: st.clean.map(p => {
        const t = timeOf(p);
        return { x: p.x, y: p.y, dt: t === null || first === null ? 0 : (t - first) * 1000, p: p.p, azimuth: p.azimuth, altitude: p.altitude };
      })
    };
  }) });
}

/**
 * Decode canonical bytes. Strict: wrong magic, version, a truncated or
 * over-long buffer, a non-finite number or a limit exceeded is refused.
 * Returns { format, version, source, width, height, strokes, removed }; a
 * stroke is { points, conditioned, start, removedAt? } and a point
 * { x, y, t (s since the page's first sample), dt (ms since its stroke's
 * start), p?, azimuth?, altitude? }.
 */
export function decodeInk(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || 0);
  if (bytes.byteLength > INK_LIMITS.maxBytes) throw new InkFormatError('This page of writing is larger than can be kept.', 'INK_TOO_LARGE');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let o = 0;
  const need = n => { if (o + n > bytes.byteLength) throw new InkFormatError('The ink record is truncated.'); };
  need(20);
  for (const b of MAGIC) if (view.getUint8(o++) !== b) throw new InkFormatError('Not a Pri ink record.');
  const version = view.getUint8(o++);
  if (version !== INK_VERSION) throw new InkFormatError(`Unsupported ink version ${version}.`);
  const source = SOURCE_NAMES[view.getUint8(o++)];
  if (!source) throw new InkFormatError('Unknown ink source.');
  if (view.getUint16(o, true) !== 0) throw new InkFormatError('Reserved bytes are not zero.');
  o += 2;
  const width = view.getFloat32(o, true); o += 4;
  const height = view.getFloat32(o, true); o += 4;
  checkPage(width, height, source);
  const count = view.getUint32(o, true); o += 4;
  if (count > INK_LIMITS.maxStrokes) throw new InkFormatError('Too many strokes on one page.', 'INK_TOO_LARGE');
  const strokes = [], removed = [];
  let total = 0;
  const KNOWN = STROKE_FLAGS.PRESSURE | STROKE_FLAGS.TILT | STROKE_FLAGS.REMOVED | STROKE_FLAGS.CONDITIONED;
  for (let i = 0; i < count; i++) {
    need(13);
    const n = view.getUint32(o, true); o += 4;
    const flags = view.getUint8(o++);
    if (flags & ~KNOWN) throw new InkFormatError('Unknown stroke flags.');
    const start = view.getFloat64(o, true); o += 8;
    if (!finite(start)) throw new InkFormatError('A stroke time is not a number.');
    if (n > INK_LIMITS.maxPointsPerStroke) throw new InkFormatError('A stroke has too many points.', 'INK_TOO_LARGE');
    total += n;
    if (total > INK_LIMITS.maxPoints) throw new InkFormatError('This page of writing is larger than can be kept.', 'INK_TOO_LARGE');
    let removedAt = null;
    if (flags & STROKE_FLAGS.REMOVED) { need(8); removedAt = view.getFloat64(o, true); o += 8; if (!finite(removedAt)) throw new InkFormatError('A removal time is not a number.'); }
    const pressure = (flags & STROKE_FLAGS.PRESSURE) !== 0, tilt = (flags & STROKE_FLAGS.TILT) !== 0;
    need(n * (12 + (pressure ? 2 : 0) + (tilt ? 8 : 0)));
    const points = new Array(n);
    for (let j = 0; j < n; j++) {
      const x = view.getFloat32(o, true); o += 4;
      const y = view.getFloat32(o, true); o += 4;
      const dt = view.getFloat32(o, true); o += 4;
      if (!finite(x) || !finite(y) || !finite(dt)) throw new InkFormatError('A point is not a number.');
      const point = { x, y, t: start + dt / 1000, dt };
      if (pressure) { point.p = view.getUint16(o, true) / 65535; o += 2; }
      if (tilt) {
        point.azimuth = view.getFloat32(o, true); o += 4; point.altitude = view.getFloat32(o, true); o += 4;
        if (!finite(point.azimuth) || !finite(point.altitude)) throw new InkFormatError('A tilt is not a number.');
      }
      points[j] = point;
    }
    const stroke = { points, conditioned: (flags & STROKE_FLAGS.CONDITIONED) !== 0, start, flags };
    if (removedAt !== null) removed.push({ ...stroke, removedAt });
    else strokes.push(stroke);
  }
  if (o !== bytes.byteLength) throw new InkFormatError('The ink record has trailing bytes.');
  return { format: INK_FORMAT, version, source, width, height, strokes, removed };
}

/**
 * Re-encode a decoded page, writing every stored number back verbatim. The
 * canonical round trip: encodeDecoded(decodeInk(b)) is byte-identical to b.
 */
export function encodeDecoded(page) {
  const sourceCode = checkPage(page.width, page.height, page.source);
  return writePage({ width: page.width, height: page.height, sourceCode,
    strokes: [...page.strokes, ...page.removed].map(s => ({ flags: s.flags, start: s.start, removedAt: s.removedAt ?? 0, points: s.points })) });
}

/** SHA-256 hex of bytes, on any platform with WebCrypto (browsers, Node 18+). */
export async function sha256Hex(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

/** Base64 of bytes, without Buffer in the browser or btoa's string limits. */
export function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function base64ToBytes(text) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(String(text), 'base64'));
  const s = atob(String(text));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/**
 * Validate the line → ink-region links the device computed (inkLines.js):
 * `lines[i]` names the strokes (indices into the page's `strokes`, removed
 * strokes excluded) that reading line `i` came from. Returns a clean copy or
 * throws. Geometry only: nothing here names a symbol.
 */
export function cleanLineRegions(lines, strokeCount) {
  if (lines === undefined || lines === null) return [];
  if (!Array.isArray(lines) || lines.length > INK_LIMITS.maxLines) throw new InkFormatError('The line regions are not a list of lines.');
  return lines.map(line => {
    const idx = Array.isArray(line?.strokes) ? line.strokes : null;
    if (!idx || idx.length > INK_LIMITS.maxStrokes || !idx.every(i => Number.isInteger(i) && i >= 0 && i < strokeCount)) {
      throw new InkFormatError('A line region names a stroke that is not on the page.');
    }
    return { strokes: [...new Set(idx)].sort((a, b) => a - b) };
  });
}

/** Bounding box { x, y, w, h } of the given strokes' points, or null. */
export function regionBox(strokes, indices) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const i of indices || []) for (const p of strokes[i]?.points || []) {
    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
  }
  return Number.isFinite(minX) ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null;
}
