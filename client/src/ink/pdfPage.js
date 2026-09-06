// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a PDF of working, turned into pages we can read
//
// Scanner apps hand back a PDF, not a photo. The renderer stays lazy, and PDFs
// are treated as hostile input: reject large payloads before decoding/parsing,
// cap raster allocation, and bound parse/render work so a pathological document
// cannot monopolise memory or CPU.
// ─────────────────────────────────────────────────────────────────────────────
import { MAX_PHOTO_BYTES } from './photoRaster.js';

export const MAX_PDF_PAGES = 3;
export const MAX_PDF_INPUT_BYTES = 8 * 1024 * 1024;
export const MAX_PDF_CANVAS_SIDE = 4096;
export const MAX_PDF_CANVAS_PIXELS = 12_000_000;
export const PDF_OPERATION_TIMEOUT_MS = 10_000;
const RENDER_WIDTH = 1700;

export function isPdf(dataUrl) {
  return /^data:application\/pdf;base64,/i.test(String(dataUrl || ''));
}

function base64DecodedUpperBound(b64) {
  const clean = String(b64 || '').replace(/\s/g, '');
  if (!clean) return 0;
  return Math.ceil(clean.length / 4) * 3;
}

export function dataUrlToBytes(dataUrl, maxBytes = MAX_PDF_INPUT_BYTES) {
  const comma = String(dataUrl || '').indexOf(',');
  if (comma < 0) return null;
  const b64 = String(dataUrl).slice(comma + 1);
  if (!b64 || base64DecodedUpperBound(b64) > maxBytes) return null;
  try {
    let out;
    if (typeof atob === 'function') {
      const binary = atob(b64);
      if (binary.length > maxBytes) return null;
      out = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    } else {
      const buffer = Buffer.from(b64, 'base64');
      if (buffer.length > maxBytes) return null;
      out = Uint8Array.from(buffer);
    }
    return out;
  } catch { return null; }
}

async function withTimeout(promise, timeoutMs, onTimeout) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          try { onTimeout?.(); } catch { /* best-effort cancellation */ }
          reject(new Error('pdf-operation-timeout'));
        }, timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function defaultLoader() {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
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

function safeCanvasDimensions(viewport, maxSide, maxPixels) {
  const width = Math.ceil(Number(viewport?.width) || 0);
  const height = Math.ceil(Number(viewport?.height) || 0);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return null;
  if (width > maxSide || height > maxSide || width * height > maxPixels) return null;
  return { width, height };
}

export async function renderPdfPages(dataUrl, {
  maxPages = MAX_PDF_PAGES,
  maxBytes = MAX_PHOTO_BYTES,
  maxPdfBytes = MAX_PDF_INPUT_BYTES,
  maxCanvasSide = MAX_PDF_CANVAS_SIDE,
  maxCanvasPixels = MAX_PDF_CANVAS_PIXELS,
  operationTimeoutMs = PDF_OPERATION_TIMEOUT_MS,
  renderWidth = RENDER_WIDTH,
  loadRenderer = defaultLoader,
  createCanvas = defaultCanvas
} = {}) {
  if (!isPdf(dataUrl)) return { pages: [], reason: 'unreadable' };
  const bytes = dataUrlToBytes(dataUrl, maxPdfBytes);
  if (!bytes?.length) return { pages: [], reason: 'unreadable' };

  let pdfjs;
  try { pdfjs = await withTimeout(Promise.resolve().then(loadRenderer), operationTimeoutMs); }
  catch { return { pages: [], reason: 'renderer-unavailable' }; }

  let loadingTask;
  let doc;
  const pages = [];
  try {
    loadingTask = pdfjs.getDocument({ data: bytes, isEvalSupported: false, disableAutoFetch: true, disableRange: true });
    doc = await withTimeout(loadingTask.promise, operationTimeoutMs, () => loadingTask.destroy?.());
    const count = Math.min(Number(doc?.numPages) || 0, maxPages);
    for (let n = 1; n <= count; n += 1) {
      let renderTask;
      try {
        const page = await withTimeout(doc.getPage(n), operationTimeoutMs);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(3, Math.max(0.5, renderWidth / Math.max(1, base.width)));
        const viewport = page.getViewport({ scale });
        const dims = safeCanvasDimensions(viewport, maxCanvasSide, maxCanvasPixels);
        if (!dims) break;
        const canvas = createCanvas(dims.width, dims.height);
        if (!canvas) break;
        const ctx = canvas.getContext('2d');
        if (!ctx) break;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        renderTask = page.render({ canvasContext: ctx, viewport });
        await withTimeout(renderTask.promise, operationTimeoutMs, () => renderTask.cancel?.());
        let out = null;
        for (const quality of [0.85, 0.72, 0.6, 0.48]) {
          const candidate = canvas.toDataURL('image/jpeg', quality);
          const comma = candidate.indexOf(',');
          const size = comma < 0 ? Infinity : Math.floor(((candidate.length - comma - 1) * 3) / 4);
          if (size <= maxBytes) { out = { dataUrl: candidate, page: n, bytes: size, quality }; break; }
        }
        if (out) pages.push(out);
      } catch {
        try { renderTask?.cancel?.(); } catch { /* best effort */ }
        break;
      }
    }
  } catch {
    // parse timeout, encrypted/corrupt document, or renderer failure
  } finally {
    try { await doc?.destroy?.(); } catch { /* best effort */ }
    try { await loadingTask?.destroy?.(); } catch { /* best effort */ }
  }
  return { pages, reason: pages.length ? null : 'unreadable' };
}
