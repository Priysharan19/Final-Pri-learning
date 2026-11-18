// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · HEIC/HEIF → pixels, on the device
//
// iPhone's default photo format. Safari decodes it; Chromium and Firefox do
// not, so this is the fallback for them. It is imported ONLY through import()
// from photoIntake.js, after a HEIC file has been chosen on a browser that
// could not open it itself, and it lives in its own chunk (`heicDecoder-*`,
// ON_DEMAND in vite.config.js) so nothing on the first screen pays for it.
//
// libheif-js is libheif compiled to asm.js: plain JavaScript, no
// WebAssembly, no eval, no new Function. The app's CSP (`script-src 'self'`,
// no 'wasm-unsafe-eval') therefore needs no change. Licence: LGPL-3.0, used
// unmodified as a separate lazily-loaded chunk; see docs/legal/third-party/NOTICES.md.
// Only still images are decoded; the first image of a multi-image file wins.
// ─────────────────────────────────────────────────────────────────────────────
import libheifFactory from 'libheif-js/libheif/libheif.js';

/** The longest edge, in pixels, this decoder will allocate for (≈ 100 megapixels). */
export const MAX_HEIC_PIXELS = 100_000_000;

let instance = null;
function lib() {
  if (!instance) {
    const made = libheifFactory();
    // The Emscripten object is also thenable in some builds; never let a
    // Promise resolution unwrap it.
    instance = made;
  }
  return instance;
}

export class HeicDecodeError extends Error {
  constructor(code, message) { super(message || code); this.name = 'HeicDecodeError'; this.code = code; }
}

/**
 * Decode the first image of a HEIC/HEIF file.
 * Resolves `{ width, height, data: Uint8ClampedArray (RGBA), imageCount }`.
 * libheif applies the file's own rotation/mirror transforms (irot/imir), so
 * the pixels come out the way up the photo was taken.
 */
export async function decodeHeic(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let images;
  try {
    const decoder = new (lib().HeifDecoder)();
    images = decoder.decode(bytes);
  } catch (error) {
    throw new HeicDecodeError('corrupt', String(error?.message || error));
  }
  if (!images || !images.length) throw new HeicDecodeError('corrupt', 'no image in file');
  const first = images[0];
  const width = first.get_width();
  const height = first.get_height();
  if (!width || !height) throw new HeicDecodeError('corrupt', 'empty image');
  if (width * height > MAX_HEIC_PIXELS) throw new HeicDecodeError('too-large', 'image too large to convert');
  const data = new Uint8ClampedArray(width * height * 4);
  await new Promise((resolve, reject) => {
    first.display({ data, width, height }, out => (out ? resolve() : reject(new HeicDecodeError('corrupt', 'decode failed'))));
  });
  return { width, height, data, imageCount: images.length };
}
