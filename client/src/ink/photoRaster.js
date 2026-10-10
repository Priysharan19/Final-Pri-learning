// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · preparing a photo of paper working
//
// Most maths is still done on paper. A student works a question in an exercise
// book and photographs it, and that photo is the thing they want marked — which
// is how the products they compare Pri against take work in.
//
// A phone camera hands back something like 4000×3000 at three megabytes. The
// transport refuses a body over a megabyte, and a reader gains nothing from
// resolution beyond the point where the pen strokes are crisp. So the photo is
// re-encoded here before it goes anywhere: scaled down to a sane longest edge
// and encoded as JPEG, which is what a photograph should be.
//
// What is NOT done here is any attempt to clean the page up — no thresholding,
// no contrast stretching, no deskewing. A vision model reads an ordinary
// photograph better than it reads a photograph somebody has aggressively
// binarised, and a bad threshold silently deletes faint pencil.
// ─────────────────────────────────────────────────────────────────────────────

/** Longest edge, in pixels. Above this a photo costs more and reads no better. */
const MAX_EDGE = 1800;
/** Small enough that the whole request fits the transport's 1 MB body cap. */
export const MAX_PHOTO_BYTES = 700_000;
const QUALITY_STEPS = [0.85, 0.72, 0.6, 0.48];

export function photoDimensions(width, height, { maxEdge = MAX_EDGE } = {}) {
  const w = Math.max(1, Math.round(Number(width) || 0));
  const h = Math.max(1, Math.round(Number(height) || 0));
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { width: w, height: h, scale: 1 };
  const scale = maxEdge / longest;
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)), scale };
}

export function dataUrlBytes(dataUrl) {
  const comma = String(dataUrl || '').indexOf(',');
  return comma < 0 ? 0 : Math.floor(((String(dataUrl).length - comma - 1) * 3) / 4);
}

/** Is this something we can send at all? */
export function isSupportedPhoto(dataUrl) {
  return /^data:image\/(png|jpeg|jpg|webp|heic|heif);base64,/i.test(String(dataUrl || ''));
}

function defaultLoadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') { reject(new Error('no image decoder')); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The photo could not be opened.'));
    img.src = dataUrl;
  });
}

function defaultCanvas(width, height) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Re-encode a photo so it fits the transport, or null when it cannot be read.
 *
 * Quality is stepped down before size is, because a slightly softer JPEG of the
 * whole page reads better than a crisp JPEG of a page too small to resolve a
 * minus sign. Only when the lowest quality still overflows is the image scaled
 * again.
 *
 * `loadImage` and `createCanvas` are injectable so this is testable with no DOM.
 */
export async function preparePhoto(dataUrl, {
  maxEdge = MAX_EDGE,
  maxBytes = MAX_PHOTO_BYTES,
  loadImage = defaultLoadImage,
  createCanvas = defaultCanvas
} = {}) {
  if (!isSupportedPhoto(dataUrl)) return null;

  let img;
  try { img = await loadImage(dataUrl); }
  catch { return null; }

  const natural = { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height };
  if (!natural.width || !natural.height) return null;

  // Seeded from the photo's own longest edge, not from the cap: a 900px photo
  // against an 1800px cap would otherwise spend its first two attempts
  // rendering the identical size, leaving only two real shrinks.
  let edge = Math.min(maxEdge, Math.max(natural.width, natural.height));
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const size = photoDimensions(natural.width, natural.height, { maxEdge: edge });
    const canvas = createCanvas(size.width, size.height);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // White underneath, so a PNG with transparency does not arrive as a black page.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.drawImage(img, 0, 0, size.width, size.height);

    for (const quality of QUALITY_STEPS) {
      const out = canvas.toDataURL('image/jpeg', quality);
      const bytes = dataUrlBytes(out);
      if (bytes <= maxBytes) {
        return { dataUrl: out, width: size.width, height: size.height, bytes, quality, scaledFrom: natural };
      }
    }
    edge = Math.round(edge * 0.7);
    if (edge < 500) break;
  }
  return null;
}

/**
 * Turn a photo by quarter turns clockwise (1 = 90°, 2 = 180°, 3 = 270°).
 *
 * A camera file that says which way up it is (EXIF orientation) is already
 * drawn upright by the browser. A page that was simply photographed sideways
 * says nothing, and no reader should be left to guess: the student turns it.
 * Always turn the ORIGINAL by the total number of turns — never a turned copy —
 * so the picture is re-encoded once however often the button is pressed.
 *
 * Returns { dataUrl, width, height } or null when the photo cannot be opened.
 */
export async function rotatePhoto(dataUrl, quarterTurns = 1, {
  quality = 0.92,
  loadImage = defaultLoadImage,
  createCanvas = defaultCanvas
} = {}) {
  if (!isSupportedPhoto(dataUrl)) return null;
  const turns = ((Math.round(Number(quarterTurns) || 0) % 4) + 4) % 4;
  let img;
  try { img = await loadImage(dataUrl); }
  catch { return null; }
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  if (!w || !h) return null;
  if (turns === 0) return { dataUrl, width: w, height: h };
  const canvas = createCanvas(turns % 2 ? h : w, turns % 2 ? w : h);
  const ctx = canvas?.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // A quarter turn is an exact matrix (0, ±1): about the centre, no resampling blur.
  const cos = [1, 0, -1, 0][turns], sin = [0, 1, 0, -1][turns];
  ctx.setTransform(cos, sin, -sin, cos, canvas.width / 2, canvas.height / 2);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  const out = canvas.toDataURL('image/jpeg', quality);
  return String(out).startsWith('data:image/') ? { dataUrl: out, width: canvas.width, height: canvas.height } : null;
}
