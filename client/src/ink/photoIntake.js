// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · turning a chosen, dropped or pasted file into a photo
//
// One door for every photo input (question card, working photo, "practise from
// a photo"). It accepts what a phone actually produces:
//
//   JPEG, PNG, WebP, AVIF, GIF   decoded by the browser, EXIF orientation applied
//   HEIC / HEIF                  the iPhone default. Safari opens it natively;
//                                Chromium and Firefox cannot, so it is converted
//                                on the device by a decoder fetched only then
//                                (ink/heicDecoder.js). Nothing is uploaded to be
//                                converted. A HEIC with several images gives the first.
//   PDF                          handled by the caller (ink/pdfPage.js)
//
// It resolves a downscaled JPEG data URL — exactly what the pipeline already
// sent — or rejects with a PhotoIntakeError whose `code` names the real reason,
// so the page never says "save it as a JPEG first" about a format we convert.
// ─────────────────────────────────────────────────────────────────────────────

/** A camera original can be large; beyond this a file is refused before decoding. */
export const MAX_PHOTO_FILE_BYTES = 60 * 1024 * 1024;
/** Longest edge of the image kept on the device and handed to the reader. */
export const INTAKE_MAX_EDGE = 1600;
export const INTAKE_QUALITY = 0.88;

export const INTAKE_CODES = Object.freeze([
  'too-large', 'empty', 'unsupported', 'corrupt', 'decoder-unavailable'
]);

export class PhotoIntakeError extends Error {
  constructor(code, message) { super(message || code); this.name = 'PhotoIntakeError'; this.code = code; }
}

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1', 'heif']);
const NATIVE_IMAGE_EXT = /\.(jpe?g|png|webp|avif|gif|bmp|jfif)$/i;

export function isPdfFile(file) {
  return file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name || '');
}

/** HEIC by the box header: `ftyp` at byte 4 followed by a HEIF brand. */
export function sniffHeic(bytes) {
  if (!bytes || bytes.length < 12) return false;
  const tag = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  if (tag !== 'ftyp') return false;
  return HEIC_BRANDS.has(String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]));
}

/** Does the name or declared type say HEIC/HEIF (an empty MIME is common for them)? */
export function claimsHeic(file) {
  return /^image\/hei[cf](-sequence)?$/i.test(file?.type || '') || /\.(heic|heif|hif)$/i.test(file?.name || '');
}

async function headBytes(file) {
  try { return new Uint8Array(await file.slice(0, 32).arrayBuffer()); } catch { return new Uint8Array(0); }
}

/** What the picker's `accept` says, kept in one place for every photo input. */
export const PHOTO_ACCEPT = 'image/*,.heic,.heif,image/heic,image/heif,.webp,.avif';
export const PHOTO_OR_PDF_ACCEPT = `${PHOTO_ACCEPT},application/pdf,.pdf`;

function defaultNativeDecode(file) {
  return async () => {
    if (typeof createImageBitmap === 'function') {
      try {
        const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
        return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close?.() };
      } catch { /* fall through to <img> */ }
    }
    if (typeof Image === 'undefined' || typeof URL === 'undefined') throw new Error('no decoder');
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('cannot decode'));
        el.src = url;
      });
      return { source: img, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height, close: () => URL.revokeObjectURL(url) };
    } catch (error) { URL.revokeObjectURL(url); throw error; }
  };
}

function defaultCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return canvas;
}

async function defaultLoadHeic() {
  try { return await import('./heicDecoder.js'); }
  catch { throw new PhotoIntakeError('decoder-unavailable'); }
}

function fit(width, height, maxEdge) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function encode(drawInto, width, height, createCanvas, quality) {
  const canvas = createCanvas(width, height);
  const ctx = canvas?.getContext?.('2d');
  if (!ctx) throw new PhotoIntakeError('corrupt');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  drawInto(ctx, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  if (!/^data:image\/jpeg/.test(dataUrl)) throw new PhotoIntakeError('corrupt');
  return dataUrl;
}

/**
 * Turn an image file (any supported format) into a downscaled JPEG data URL.
 * Dependencies are injectable so the contract is testable with no browser.
 * Resolves `{ dataUrl, width, height, via: 'browser' | 'heic' }`.
 */
export async function intakeImageFile(file, {
  maxEdge = INTAKE_MAX_EDGE,
  quality = INTAKE_QUALITY,
  maxBytes = MAX_PHOTO_FILE_BYTES,
  decodeNative = (f) => defaultNativeDecode(f)(),
  loadHeic = defaultLoadHeic,
  createCanvas = defaultCanvas,
  makeImageData = (data, w, h) => new ImageData(data, w, h)
} = {}) {
  if (!file) throw new PhotoIntakeError('empty');
  if (!(file.size > 0)) throw new PhotoIntakeError('empty');
  if (file.size > maxBytes) throw new PhotoIntakeError('too-large');

  const head = await headBytes(file);
  const heic = claimsHeic(file) || sniffHeic(head);
  const declaredImage = /^image\//i.test(file.type || '') || NATIVE_IMAGE_EXT.test(file.name || '');

  if (!heic && !declaredImage) throw new PhotoIntakeError('unsupported');

  // The browser first: Safari opens HEIC itself, and every browser opens the rest.
  let native = null;
  try { native = await decodeNative(file); } catch { native = null; }
  if (native && native.width > 0 && native.height > 0) {
    try {
      const size = fit(native.width, native.height, maxEdge);
      const dataUrl = encode((ctx, w, h) => ctx.drawImage(native.source, 0, 0, w, h), size.width, size.height, createCanvas, quality);
      return { dataUrl, ...size, via: 'browser' };
    } finally { try { native.close?.(); } catch { /* best effort */ } }
  }

  if (!heic) throw new PhotoIntakeError('corrupt');

  // HEIC the browser could not open: convert here, with a decoder fetched now.
  const decoder = await loadHeic();
  let raster;
  try { raster = await decoder.decodeHeic(await file.arrayBuffer()); }
  catch (error) {
    if (error instanceof PhotoIntakeError) throw error;
    throw new PhotoIntakeError(error?.code === 'too-large' ? 'too-large' : 'corrupt');
  }
  const size = fit(raster.width, raster.height, maxEdge);
  const dataUrl = encode((ctx, w, h) => {
    if (w === raster.width && h === raster.height) { ctx.putImageData(makeImageData(raster.data, raster.width, raster.height), 0, 0); return; }
    // Scale through a full-size scratch canvas: putImageData ignores transforms.
    const scratch = createCanvas(raster.width, raster.height);
    scratch.getContext('2d').putImageData(makeImageData(raster.data, raster.width, raster.height), 0, 0);
    ctx.drawImage(scratch, 0, 0, w, h);
  }, size.width, size.height, createCanvas, quality);
  return { dataUrl, ...size, via: 'heic', imageCount: raster.imageCount || 1 };
}

/** The strings key naming why a photo could not be taken in, by intake code. */
export const INTAKE_MESSAGE_KEY = Object.freeze({
  'too-large': 'photo.intake.tooLarge',
  empty: 'photo.intake.empty',
  unsupported: 'photo.intake.unsupported',
  corrupt: 'photo.intake.corrupt',
  'decoder-unavailable': 'photo.intake.decoderUnavailable'
});

export function intakeMessageKey(error) {
  return INTAKE_MESSAGE_KEY[error?.code] || INTAKE_MESSAGE_KEY.corrupt;
}
