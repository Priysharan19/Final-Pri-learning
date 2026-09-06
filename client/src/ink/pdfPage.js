// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a PDF of working, turned into pages we can read
//
// Scanner apps hand back a PDF, not a photo. A student who scans their exercise
// book with the Notes app or Adobe Scan has a PDF, and until now attaching one
// did nothing at all.
//
// The renderer is loaded on demand and never at boot. It is a large library and
// most students will never attach a PDF; making everyone download it so that a
// few can is the wrong trade. `import()` means the chunk is fetched the first
// time somebody actually attaches one, and never otherwise.
//
// Pages come out as ordinary images and then go down exactly the same path a
// photograph does — same preparation, same budget, same reader — because by
// that point they are the same thing.
// ─────────────────────────────────────────────────────────────────────────────
import { MAX_PHOTO_BYTES } from './photoRaster.js';

/** More than this and it is not one question's working. */
export const MAX_PDF_PAGES = 3;
/** Rendered at this width; enough for a scanned A4 page of handwriting. */
const RENDER_WIDTH = 1700;

export function isPdf(dataUrl) {
  return /^data:application\/pdf;base64,/i.test(String(dataUrl || ''));
}

/** base64 payload of a data URL as bytes the renderer can take. */
export function dataUrlToBytes(dataUrl) {
  const comma = String(dataUrl || '').indexOf(',');
  if (comma < 0) return null;
  const b64 = String(dataUrl).slice(comma + 1);
  try {
    if (typeof atob === 'function') {
      const binary = atob(b64);
      const out = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
      return out;
    }
    return Uint8Array.from(Buffer.from(b64, 'base64'));
  } catch { return null; }
}

/**
 * Load pdf.js. Split out and injectable so the contract can be tested without
 * pulling a megabyte of renderer into a unit test.
 */
async function defaultLoader() {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  // The worker ships beside the library. Vite rewrites this to a bundled URL,
  // so it is served from our own origin like everything else and no CDN is
  // involved — this app has to work with no network at all.
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}

function defaultCanvas(width, height) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Render the first pages of a PDF to JPEG data URLs.
 *
 * Never throws. Returns { pages, reason } where reason distinguishes the one
 * failure a student can actually do something about: the renderer is not on the
 * device yet and there is no network to fetch it. Everything else — an
 * encrypted file, a corrupt scan, a PDF with no pages — is 'unreadable', and
 * the answer to all of those is the same: photograph the page instead.
 */
export async function renderPdfPages(dataUrl, {
  maxPages = MAX_PDF_PAGES,
  maxBytes = MAX_PHOTO_BYTES,
  renderWidth = RENDER_WIDTH,
  loadRenderer = defaultLoader,
  createCanvas = defaultCanvas
} = {}) {
  if (!isPdf(dataUrl)) return { pages: [], reason: 'unreadable' };
  const bytes = dataUrlToBytes(dataUrl);
  if (!bytes?.length) return { pages: [], reason: 'unreadable' };

  let pdfjs;
  try { pdfjs = await loadRenderer(); }
  catch {
    // The renderer is kept out of the install precache because it is large and
    // most students never open a PDF. Failing to load it almost always means
    // this is the first PDF on this device and there is no network right now.
    return { pages: [], reason: 'renderer-unavailable' };
  }

  let doc;
  try {
    doc = await pdfjs.getDocument({
      data: bytes,
      // A scanned page is untrusted input. None of these are needed to read
      // handwriting, and each is a way for a document to reach outward.
      isEvalSupported: false,
      disableAutoFetch: true,
      disableRange: true
    }).promise;
  } catch { return { pages: [], reason: 'unreadable' }; }

  const count = Math.min(Number(doc?.numPages) || 0, maxPages);
  const pages = [];
  for (let n = 1; n <= count; n += 1) {
    try {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(3, Math.max(0.5, renderWidth / Math.max(1, base.width)));
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      if (!canvas) break;
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      // Scanned pages are often transparent-backed; white underneath keeps a
      // page of pencil from arriving as white-on-black.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      let out = null;
      for (const quality of [0.85, 0.72, 0.6, 0.48]) {
        const candidate = canvas.toDataURL('image/jpeg', quality);
        const size = Math.floor(((candidate.length - candidate.indexOf(',') - 1) * 3) / 4);
        if (size <= maxBytes) { out = { dataUrl: candidate, page: n, bytes: size, quality }; break; }
      }
      if (out) pages.push(out);
    } catch { break; }
  }

  try { await doc.destroy?.(); } catch { /* the document is finished with either way */ }
  return { pages, reason: pages.length ? null : 'unreadable' };
}
