// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a handwritten exam page, frozen as a picture
//
// During a paper a handwritten answer is read only when the student presses
// "Read my answer". A page they have written and not had read is still their
// answer. So that it is never treated as blank, the exam room keeps — beside
// the strokes — the PICTURE of each such page and the SHA-256 of that picture.
// The digest travels to the server with every autosave and with the submit
// (server/platform/exams.js, "HANDWRITING NOT READ WHEN THE PAPER CLOSED");
// the picture stays on the device until the paper is closed, and after that
// only a picture with exactly that digest can be read.
//
// Nothing here reads handwriting, and nothing here knows an answer.
// ─────────────────────────────────────────────────────────────────────────────

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

/**
 * SHA-256 of bytes, as lowercase hex. Written out rather than taken from
 * crypto.subtle because that exists only in a secure context, and a page that
 * could not be given a digest would reach the server as a blank answer.
 */
export function sha256Hex(bytes) {
  const length = bytes.length;
  const padded = new Uint8Array(((length + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(length / 0x20000000), false);
  view.setUint32(padded.length - 4, (length << 3) >>> 0, false);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  return Array.from(h, word => word.toString(16).padStart(8, '0')).join('');
}

const DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;

/** The bytes a base64 data URL carries, or null when it is not one. */
export function dataUrlBytes(dataUrl) {
  const match = DATA_URL.exec(String(dataUrl || ''));
  if (!match) return null;
  try {
    const binary = atob(match[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch { return null; }
}

/** The digest the server computes for a picture: SHA-256 of its decoded bytes. */
export function pictureDigest(dataUrl) {
  const bytes = dataUrlBytes(dataUrl);
  return bytes ? sha256Hex(bytes) : null;
}

/**
 * Freeze one page: its picture (exactly what the reader would be sent) and the
 * digest of that picture. `rasterize(strokes)` is cloudRaster.js rasterizeInk,
 * passed in so this stays testable without a canvas. Null when there is no ink
 * or no picture could be made.
 */
export function freezePage(strokes, rasterize) {
  if (!Array.isArray(strokes) || !strokes.length || typeof rasterize !== 'function') return null;
  let picture = null;
  try { picture = rasterize(strokes); } catch { picture = null; }
  const image = picture?.dataUrl;
  const digest = image ? pictureDigest(image) : null;
  return digest ? { digest, image } : null;
}

/** Answer keys whose handwriting is on the page and has no answer read from it. */
export function unreadInkKeys(inks = {}, answers = {}) {
  return Object.keys(inks || {}).filter(key => (inks[key]?.strokes?.length || 0) > 0 && String(answers?.[key] ?? '').trim() === '');
}

/** Marks not yet decided, and whether any page can still be read, from a result's detail lines. */
export function pendingSummary(detail) {
  let marks = 0, awaiting = 0, review = 0;
  const count = line => {
    marks += Number(line.marks) || 0;
    if (line.pendingState === 'awaiting-reading') awaiting += 1; else review += 1;
  };
  for (const d of Array.isArray(detail) ? detail : []) {
    if (Array.isArray(d.parts)) { for (const part of d.parts) if (part.pending) count(part); }
    else if (d.pending) count(d);
  }
  return { marks, awaiting, review, any: awaiting + review > 0 };
}
