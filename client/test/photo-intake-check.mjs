// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · every photo input: HEIC and friends, PDFs, drops (owner, 18 Nov 2026)
//
// "Allow HEIC pictures too" and "why can it not read a PDF". The photo door
// (ink/photoIntake.js) accepts what a phone produces; HEIC is converted on the
// device by libheif-js (asm.js, no WebAssembly, so no CSP change) fetched only
// when a HEIC is chosen. The PDF reader's ceiling was 8 MB, which refused a
// 15 MB phone-scan PDF and told the student it was "password-protected"; its
// refusals now name the real reason.
//
// Real HEIC fixtures (fixtures/heic/README.md), a fake canvas, no browser.
// The browser path (a HEIC and a PDF through a real input, a drop on the card)
// is client/test/tour-photo-intake.js.
// Usage: node client/test/photo-intake-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { intakeImageFile, PhotoIntakeError, sniffHeic, claimsHeic, isPdfFile, intakeMessageKey, INTAKE_CODES, PHOTO_ACCEPT, PHOTO_OR_PDF_ACCEPT, MAX_PHOTO_FILE_BYTES } from '../src/ink/photoIntake.js';
import { decodeHeic } from '../src/ink/heicDecoder.js';
import { renderPdfPages, classifyPdfFailure, MAX_PDF_INPUT_BYTES } from '../src/ink/pdfPage.js';
import { splitWordsAndMaths } from '../src/photo/typeset.js';
import { dragHasFiles, filesOfDrop } from '../src/lib/useFileDrop.js';
import EN from '../src/i18n/strings.en.js';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n += 1; };
const fx = name => new Uint8Array(readFileSync(new URL(`./fixtures/heic/${name}`, import.meta.url)));
const fileOf = (bytes, name, type = '') => new File([bytes], name, { type });

// A canvas with no pixels: records what was drawn and the size asked for.
const sizes = [];
const createCanvas = (width, height) => {
  sizes.push([width, height]);
  const log = { put: null, drawn: false };
  return { width, height, log,
    getContext: () => ({ fillStyle: '', fillRect() {}, putImageData(img) { log.put = [img.width, img.height]; }, drawImage() { log.drawn = true; } }),
    toDataURL: () => 'data:image/jpeg;base64,/9j/AAAA' };
};
const makeImageData = (data, width, height) => ({ data, width, height });
const noNative = async () => { throw new Error('this browser cannot decode HEIC'); };
const base = { decodeNative: noNative, loadHeic: async () => ({ decodeHeic }), createCanvas, makeImageData };

// ── what counts as HEIC ──────────────────────────────────────────────────────
ok(sniffHeic(fx('landscape-160x80.heic')) && sniffHeic(fx('burst-two-images.heic')), 'real HEIC files are recognised by their ftyp brand');
ok(!sniffHeic(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), 'a JPEG is not HEIC');
ok(claimsHeic({ type: 'image/heic', name: 'a' }) && claimsHeic({ type: 'image/heif', name: 'a' }) && claimsHeic({ type: 'image/heic-sequence', name: 'a' }), 'HEIC by MIME, including sequences');
ok(claimsHeic({ type: '', name: 'IMG_0496.HEIC' }) && claimsHeic({ type: '', name: 'x.heif' }), 'HEIC by extension when the MIME is empty (Chromium, Windows)');
ok(!claimsHeic({ type: 'image/png', name: 'a.png' }), 'PNG is not HEIC');
ok(PHOTO_ACCEPT.includes('.heic') && PHOTO_ACCEPT.includes('image/heif') && PHOTO_OR_PDF_ACCEPT.includes('application/pdf'), 'every picker accepts .heic/.heif and image/heic, image/heif');
ok(isPdfFile({ type: 'application/pdf', name: 'a' }) && isPdfFile({ type: '', name: 'Scan.PDF' }) && !isPdfFile({ type: 'image/png', name: 'a.png' }), 'PDF by type or extension');

// ── the decoder itself (real libheif) ────────────────────────────────────────
const land = await decodeHeic(fx('landscape-160x80.heic'));
ok(land.width === 160 && land.height === 80 && land.data.length === 160 * 80 * 4 && land.imageCount === 1, 'a HEIC decodes to its pixels');
ok(land.data[3] === 255 && land.data[0] > 200 && land.data[1] < 120, 'the coloured left quarter is where it was drawn (red, opaque)');
const turned = await decodeHeic(fx('rotated-orient6-160x80.heic'));
ok(turned.width === 80 && turned.height === 160, 'orientation: the file\'s own rotation is applied (landscape raster, upright photo)');
const burst = await decodeHeic(fx('burst-two-images.heic'));
ok(burst.imageCount === 2 && burst.width === 160 && burst.height === 80, 'a multi-image HEIC gives the FIRST image');
await assert.rejects(decodeHeic(fx('landscape-160x80.heic').subarray(0, 200)), e => e.code === 'corrupt'); n += 1;

// ── the intake door, browser cannot decode HEIC ─────────────────────────────
let out = await intakeImageFile(fileOf(fx('landscape-160x80.heic'), 'IMG_1.HEIC', ''), base);
ok(out.via === 'heic' && out.width === 160 && out.height === 80 && /^data:image\/jpeg;base64,/.test(out.dataUrl), 'a HEIC with an empty MIME and a .HEIC name becomes a JPEG data URL');
out = await intakeImageFile(fileOf(fx('rotated-orient6-160x80.heic'), 'IMG_2.heic', 'image/heic'), base);
ok(out.width === 80 && out.height === 160, 'an upright iPhone photo comes out upright');
out = await intakeImageFile(fileOf(fx('burst-two-images.heic'), 'burst.heif', 'image/heif'), base);
ok(out.via === 'heic' && out.imageCount === 2 && out.width === 160, 'a burst yields its first image');
out = await intakeImageFile(fileOf(fx('landscape-160x80.heic'), 'IMG_3.heic', 'image/heic'), { ...base, maxEdge: 100 });
ok(out.width === 100 && out.height === 50, 'scaled down to the upload edge, aspect kept');
out = await intakeImageFile(fileOf(fx('landscape-160x80.heic'), 'photo.jpg', 'image/jpeg'), base);
ok(out.via === 'heic', 'HEIC bytes under a .jpg name are still converted (sniffed, not trusted by name)');

// ── the browser can decode it (Safari) ───────────────────────────────────────
let loaded = false;
const native = async () => ({ source: {}, width: 4000, height: 3000, close() {} });
out = await intakeImageFile(fileOf(fx('landscape-160x80.heic'), 'IMG_4.heic', 'image/heic'), { ...base, decodeNative: native, loadHeic: async () => { loaded = true; return { decodeHeic }; } });
ok(out.via === 'browser' && out.width === 1600 && out.height === 1200 && !loaded, 'where the browser opens HEIC itself the decoder is never fetched, and a 4000×3000 photo is scaled to 1600');
out = await intakeImageFile(fileOf(new Uint8Array([1, 2, 3, 4]), 'a.png', 'image/png'), { ...base, decodeNative: native });
ok(out.via === 'browser', 'PNG, JPEG, WebP, AVIF go through the browser decoder');

// ── refusals name the real reason ────────────────────────────────────────────
const code = async (file, deps) => { try { await intakeImageFile(file, deps); return null; } catch (e) { return e instanceof PhotoIntakeError ? e.code : `other:${e.message}`; } };
ok(await code(fileOf(fx('landscape-160x80.heic').subarray(0, 200), 'cut.heic', 'image/heic'), base) === 'corrupt', 'a truncated HEIC is "corrupt"');
ok(await code(fileOf(new Uint8Array([1, 2, 3]), 'notes.zip', 'application/zip'), base) === 'unsupported', 'a zip is "unsupported"');
ok(await code(fileOf(new Uint8Array(0), 'a.heic', 'image/heic'), base) === 'empty', 'an empty file is "empty"');
const huge = { size: MAX_PHOTO_FILE_BYTES + 1, type: 'image/heic', name: 'huge.heic', slice: () => ({ arrayBuffer: async () => new ArrayBuffer(0) }), arrayBuffer: async () => { throw new Error('must not be read'); } };
ok(await code(huge, base) === 'too-large', 'an oversize file is refused before it is read');
ok(await code(fileOf(fx('landscape-160x80.heic'), 'a.heic', 'image/heic'), { ...base, loadHeic: async () => { throw new PhotoIntakeError('decoder-unavailable'); } }) === 'decoder-unavailable', 'a decoder that cannot be fetched says so (the file stays chosen; the student can try again online)');
ok(await code(fileOf(new Uint8Array([1, 2, 3, 4]), 'bad.png', 'image/png'), base) === 'corrupt', 'a PNG the browser cannot open is "corrupt", never "save it as a JPEG"');
for (const c of INTAKE_CODES) {
  const key = intakeMessageKey({ code: c });
  ok(typeof EN[key] === 'string' && !/save it as a JPEG/i.test(EN[key]), `a message exists for ${c}`);
}
ok(!/JPEG first/.test(EN['verdict.imageUnopenable']), 'no message tells the student to save a convertible format as a JPEG first');

// ── PDF: the real reasons ────────────────────────────────────────────────────
const pdfUrl = bytes => `data:application/pdf;base64,${Buffer.alloc(bytes, 65).toString('base64')}`;
const fakePdf = ({ numPages = 1, fail = null } = {}) => async () => ({
  getDocument: () => ({ promise: fail ? Promise.reject(fail) : Promise.resolve({
    numPages, getPage: async () => ({ getViewport: ({ scale }) => ({ width: 595 * scale, height: 842 * scale }), render: () => ({ promise: Promise.resolve(), cancel() {} }) }), destroy() {}
  }), destroy() {} })
});
const jpegCanvas = (w, h) => ({ width: w, height: h, getContext: () => ({ fillRect() {} }), toDataURL: () => 'data:image/jpeg;base64,AAAA' });
let r = await renderPdfPages(pdfUrl(15_484_475), { loadRenderer: fakePdf(), createCanvas: jpegCanvas });
ok(r.pages.length === 1 && r.reason === null, 'a 15 MB phone-scan PDF (the owner\'s IMG_0496.pdf is 15,484,475 bytes) is no longer refused by size');
ok(MAX_PDF_INPUT_BYTES >= 32 * 1024 * 1024, 'the ceiling is a memory bound, not a statement about scans');
r = await renderPdfPages(pdfUrl(MAX_PDF_INPUT_BYTES + 3000), { loadRenderer: fakePdf(), createCanvas: jpegCanvas });
ok(r.reason === 'too-large' && r.pages.length === 0, 'a PDF over the ceiling says "too-large"');
r = await renderPdfPages(pdfUrl(2000), { loadRenderer: fakePdf({ fail: Object.assign(new Error('No password given'), { name: 'PasswordException' }) }), createCanvas: jpegCanvas });
ok(r.reason === 'locked', 'a password-protected PDF says "locked"');
r = await renderPdfPages(pdfUrl(2000), { loadRenderer: fakePdf({ fail: Object.assign(new Error('Invalid PDF structure.'), { name: 'InvalidPDFException' }) }), createCanvas: jpegCanvas });
ok(r.reason === 'corrupt', 'a damaged PDF says "corrupt"');
r = await renderPdfPages(pdfUrl(2000), { loadRenderer: async () => ({ getDocument: () => ({ promise: new Promise(() => {}), destroy() {} }) }), createCanvas: jpegCanvas, operationTimeoutMs: 20 });
ok(r.reason === 'timeout', 'a PDF that never opens says "timeout"');
r = await renderPdfPages(pdfUrl(2000), { loadRenderer: async () => { throw new Error('chunk failed'); }, createCanvas: jpegCanvas });
ok(r.reason === 'renderer-unavailable', 'the PDF reader that cannot be loaded says so');
r = await renderPdfPages(pdfUrl(2000), { loadRenderer: fakePdf({ numPages: 5 }), createCanvas: jpegCanvas });
ok(r.pages.length === 3 && r.totalPages === 5, 'a long PDF reads the first pages and reports how many there are, so the page can say so');
ok(classifyPdfFailure({ name: 'PasswordException' }) === 'locked' && classifyPdfFailure(new Error('x')) === 'unreadable', 'failures are classified by name');
ok(!/password/i.test(EN['verdict.pdfUnopenable']), 'the generic PDF failure no longer guesses "password-protected"');
for (const k of ['verdict.pdfTooLarge', 'verdict.pdfLocked', 'verdict.pdfCorrupt', 'verdict.pdfTimeout']) ok(typeof EN[k] === 'string', `${k} exists`);

// ── words and maths ──────────────────────────────────────────────────────────
const kinds = text => splitWordsAndMaths(text).map(r => `${r.kind}:${r.text}`);
ok(kinds("for stat points y'=0").join('|') === "words:for stat points|maths:y'=0", 'words are upright and the maths stands alone (no "forstatpointsy′")');
ok(kinds('x=0 or x=-3').join('|') === 'maths:x=0|words:or|maths:x=-3', '"or" is a word between two pieces of maths');
ok(kinds('smallest: (0,0)').join('|') === 'words:smallest:|maths:(0,0)', 'a label and a point');
ok(kinds('y(0)=0').join('|') === 'maths:y(0)=0', 'a function evaluation is all maths');
ok(kinds('sin x = 1').join('|') === 'maths:sin x = 1', 'function names stay maths');

// ── a file drag ──────────────────────────────────────────────────────────────
const drag = (types, files = []) => ({ dataTransfer: { types, files, items: files.map(f => ({ kind: 'file', getAsFile: () => f })) } });
ok(dragHasFiles(drag(['Files'])) && !dragHasFiles(drag(['text/plain'])) && !dragHasFiles(drag(['text/uri-list'])), 'only drags that carry files are taken; text and links are ignored');
const two = filesOfDrop(drag(['Files'], [fileOf([1], 'a.png'), fileOf([2], 'b.png')]));
ok(two.file.name === 'a.png' && two.extra === 1, 'one file is used; the rest are counted so the page can say so');

console.log(`PHOTO INTAKE: ${n} checks passed`);
