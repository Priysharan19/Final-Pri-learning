// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · reading a scanned PDF of working
//
// A scanner app hands back a PDF, not a photo. What must hold:
//
//   · the renderer is never loaded until a PDF is actually attached, because it
//     is large and most students will never open one;
//   · pages come out inside the same byte budget a photo has to meet;
//   · a PDF with fifty pages is not fifty requests;
//   · failure says which failure it was, because "you are offline and this
//     needs one download" and "this file is encrypted" have different answers.
//
// pdf.js itself is stubbed. This runs in bare Node with no renderer.
// ─────────────────────────────────────────────────────────────────────────────
import { MAX_PDF_PAGES, dataUrlToBytes, isPdf, renderPdfPages } from '../src/ink/pdfPage.js';
import { MAX_PHOTO_BYTES } from '../src/ink/photoRaster.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const PDF = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.7 fake').toString('base64');

// ── 1 · What counts as a PDF ─────────────────────────────────────────────────
ok(isPdf(PDF), 'a PDF data URL is a PDF');
ok(!isPdf('data:image/jpeg;base64,AAAA'), 'a photo is not');
ok(!isPdf('https://example.test/work.pdf'), 'and neither is a link to one');
ok(dataUrlToBytes(PDF)?.length > 0, 'the payload decodes to bytes the renderer can take');
ok(dataUrlToBytes('nonsense') === null, 'and something that is not a data URL decodes to nothing');

// ── 2 · A stub renderer, so no megabyte is pulled into a unit test ───────────
function stubRenderer({ numPages = 1, bytesFor = () => 100_000, throwOnPage = null } = {}) {
  let destroyed = false;
  const renderer = {
    GlobalWorkerOptions: {},
    getDocument: (opts) => {
      renderer.lastOptions = opts;
      return {
        promise: Promise.resolve({
          numPages,
          getPage: async (n) => {
            if (throwOnPage === n) throw new Error('bad page');
            return {
              getViewport: ({ scale = 1 }) => ({ width: 850 * scale, height: 1100 * scale }),
              render: () => ({ promise: Promise.resolve() })
            };
          },
          destroy: async () => { destroyed = true; }
        })
      };
    },
    wasDestroyed: () => destroyed
  };
  return renderer;
}
const canvasFor = (bytesFor) => (width, height) => ({
  width, height,
  getContext: () => ({ fillStyle: '', fillRect: () => {}, drawImage: () => {} }),
  toDataURL: (type, quality) => 'data:image/jpeg;base64,' + 'A'.repeat(Math.ceil((bytesFor(quality) * 4) / 3))
});

// ── 3 · The renderer is only ever loaded for an actual PDF ───────────────────
let loads = 0;
const counting = async () => { loads += 1; return stubRenderer(); };
await renderPdfPages('data:image/jpeg;base64,AAAA', { loadRenderer: counting, createCanvas: canvasFor(() => 1000) });
eq(loads, 0, 'attaching a photo never loads the PDF renderer');
await renderPdfPages(PDF, { loadRenderer: counting, createCanvas: canvasFor(() => 1000) });
eq(loads, 1, 'and attaching a PDF loads it exactly once');

// ── 4 · Pages come out inside the photo budget ───────────────────────────────
const one = await renderPdfPages(PDF, { loadRenderer: async () => stubRenderer(), createCanvas: canvasFor(() => 120_000) });
eq(one.pages.length, 1, 'a one-page scan yields one page');
eq(one.reason, null, 'and reports no failure');
ok(one.pages[0].bytes <= MAX_PHOTO_BYTES, 'inside the same budget a photo has to meet');
ok(one.pages[0].dataUrl.startsWith('data:image/jpeg'), 'as an ordinary image, which is what the reader takes');
eq(one.pages[0].page, 1, 'numbered from 1, as the student sees it');

const dense = await renderPdfPages(PDF, { loadRenderer: async () => stubRenderer(), createCanvas: canvasFor(q => Math.round(1_300_000 * q)) });
ok(dense.pages.length === 1 && dense.pages[0].bytes <= MAX_PHOTO_BYTES, 'a dense scan is re-encoded until it fits');
ok(dense.pages[0].quality < 0.85, 'by lowering quality rather than refusing');

// ── 5 · A long document is not a long bill ───────────────────────────────────
const long = await renderPdfPages(PDF, { loadRenderer: async () => stubRenderer({ numPages: 50 }), createCanvas: canvasFor(() => 100_000) });
eq(long.pages.length, MAX_PDF_PAGES, `a fifty-page document reads at most ${MAX_PDF_PAGES} pages — one question's working is not fifty pages, and each page is a paid request`);

// ── 6 · The document is untrusted input ──────────────────────────────────────
const renderer = stubRenderer();
await renderPdfPages(PDF, { loadRenderer: async () => renderer, createCanvas: canvasFor(() => 1000) });
eq(renderer.lastOptions.isEvalSupported, false, 'the renderer is told not to evaluate script from the document');
eq(renderer.lastOptions.disableAutoFetch, true, 'and not to fetch anything the document points at');
eq(renderer.lastOptions.disableRange, true, 'and not to range-request it');
ok(renderer.wasDestroyed(), 'the document is closed when it has been read');

// ── 7 · Failure says which failure ───────────────────────────────────────────
const offline = await renderPdfPages(PDF, { loadRenderer: async () => { throw new Error('chunk load failed'); }, createCanvas: canvasFor(() => 1000) });
eq(offline.pages, [], 'a renderer that will not load yields no pages');
eq(offline.reason, 'renderer-unavailable',
  'and says so specifically — the student is offline and this needs one download, which is a different answer from "your file is broken"');

const broken = await renderPdfPages(PDF, {
  loadRenderer: async () => ({ GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.reject(new Error('encrypted')) }) }),
  createCanvas: canvasFor(() => 1000)
});
eq(broken.reason, 'unreadable', 'an encrypted or corrupt file is reported as unreadable, not as a network problem');

const emptyDoc = await renderPdfPages(PDF, { loadRenderer: async () => stubRenderer({ numPages: 0 }), createCanvas: canvasFor(() => 1000) });
eq(emptyDoc.reason, 'unreadable', 'and a PDF with no pages is unreadable rather than silently fine');

const halfway = await renderPdfPages(PDF, { loadRenderer: async () => stubRenderer({ numPages: 3, throwOnPage: 2 }), createCanvas: canvasFor(() => 100_000) });
eq(halfway.pages.length, 1, 'a page that fails mid-document keeps what was already read');
eq(halfway.reason, null, 'and is not reported as a total failure');

console.log(failures.length
  ? `PDF WORKING: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `PDF WORKING: PASS — ${pass}/${pass} checks — loaded only when needed, bounded pages, untrusted document, and failures that name themselves.`);
process.exit(failures.length ? 1 : 0);
