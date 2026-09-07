import assert from 'node:assert/strict';
import {
  MAX_PDF_CANVAS_PIXELS,
  MAX_PDF_CANVAS_SIDE,
  MAX_PDF_INPUT_BYTES,
  dataUrlToBytes,
  renderPdfPages
} from '../src/ink/pdfPage.js';

const PDF = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.7 fake').toString('base64');
const canvas = (width, height) => ({ width, height, getContext: () => ({ fillStyle: '', fillRect() {} }), toDataURL: () => 'data:image/jpeg;base64,AAAA' });

let loads = 0;
const oversized = 'data:application/pdf;base64,' + 'A'.repeat(Math.ceil((MAX_PDF_INPUT_BYTES + 4) * 4 / 3));
const oversizedResult = await renderPdfPages(oversized, { loadRenderer: async () => { loads += 1; throw new Error('must not load'); } });
assert.equal(loads, 0, 'oversized PDF must be rejected before pdf.js is loaded');
assert.equal(oversizedResult.reason, 'unreadable');
assert.equal(dataUrlToBytes(oversized), null, 'oversized PDF must be rejected before decoded allocation');

let canvases = 0;
const hugeRenderer = {
  GlobalWorkerOptions: {},
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: async () => ({
        getViewport: ({ scale = 1 }) => ({ width: MAX_PDF_CANVAS_SIDE * 4 * scale, height: MAX_PDF_CANVAS_SIDE * 4 * scale }),
        render: () => ({ promise: Promise.resolve() })
      }),
      destroy: async () => {}
    }),
    destroy: async () => {}
  })
};
const huge = await renderPdfPages(PDF, { loadRenderer: async () => hugeRenderer, createCanvas: (...args) => { canvases += 1; return canvas(...args); } });
assert.equal(canvases, 0, 'pathological page must be rejected before canvas allocation');
assert.equal(huge.pages.length, 0);
assert.ok(MAX_PDF_CANVAS_PIXELS < MAX_PDF_CANVAS_SIDE * MAX_PDF_CANVAS_SIDE);

let parseDestroyed = false;
const parseHang = await renderPdfPages(PDF, {
  operationTimeoutMs: 5,
  loadRenderer: async () => ({ GlobalWorkerOptions: {}, getDocument: () => ({ promise: new Promise(() => {}), destroy: async () => { parseDestroyed = true; } }) }),
  createCanvas: canvas
});
assert.equal(parseHang.reason, 'unreadable');
assert.equal(parseDestroyed, true, 'parse timeout must destroy loading task');

let renderCancelled = false;
let docDestroyed = false;
const renderHang = await renderPdfPages(PDF, {
  operationTimeoutMs: 5,
  loadRenderer: async () => ({
    GlobalWorkerOptions: {},
    getDocument: () => ({
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => ({
          getViewport: ({ scale = 1 }) => ({ width: 850 * scale, height: 1100 * scale }),
          render: () => ({ promise: new Promise(() => {}), cancel: () => { renderCancelled = true; } })
        }),
        destroy: async () => { docDestroyed = true; }
      }),
      destroy: async () => {}
    })
  }),
  createCanvas: canvas
});
assert.equal(renderHang.reason, 'unreadable');
assert.equal(renderCancelled, true, 'render timeout must cancel active render');
assert.equal(docDestroyed, true, 'render timeout must destroy parsed document');

console.log('INK PDF RESOURCE — PASS: pre-parser bytes, raster allocation, timeouts and cleanup bounded');
