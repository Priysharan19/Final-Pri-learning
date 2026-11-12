#!/usr/bin/env node
// Pri Learning · rasterise one edition's app icons from its brand SVG sources
// (plan mission E4; the sources come from tools/brand/build-assets.mjs).
//
//   node tools/brand/rasterise-icons.mjs <priyabhata|prithagoras>
//
// Renders with the Playwright Chromium the client already installs (the same way
// tools/play-graphics.mjs does; no network). Every PNG is opaque: the native
// icons are RGB (colour type 2; the App Store rejects an alpha channel on the
// 1024 icon), and a web icon is indexed (colour type 3, no tRNS) when it has at
// most 256 colours — the same pixels in fewer bytes of every install. Written under client/brand/<edition>/:
//
//   icons/icon-180.png            apple-touch-icon     (index.html)
//   icons/icon-192.png            manifest "any"       (the build's manifest.webmanifest; sw.js notification icon)
//   icons/icon-512.png            manifest "any"
//   icons/icon-maskable-192.png   manifest "maskable"
//   source/native/ios/AppIcon-{,dark-,tinted-}1024.png   for the iOS AppIcon set (an owner step, not shipped by E4)
//   source/native/play/icon-512.png                       for the Play listing (an owner step)
//
// Android needs no PNGs: minSdk 26 uses the adaptive vector layers in source/android/.
// Chromium's anti-aliasing is not byte-stable across machines, so the check suite
// holds these PNGs to their size, colour type and opacity, not to their bytes.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync, deflateSync, crc32 } from 'node:zlib';
import { EDITION_IDS } from '../../client/edition.config.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const [, , edition] = process.argv;
if (!EDITION_IDS.includes(edition)) {
  console.error(`usage: node tools/brand/rasterise-icons.mjs <${EDITION_IDS.join('|')}>`);
  process.exit(2);
}
const { chromium } = createRequire(join(ROOT, 'client/package.json'))('playwright');
const kit = join(ROOT, 'client/brand', edition);
const outDir = kit;
const src = (f) => readFileSync(join(kit, f), 'utf8');

const JOBS = [
  ['icons/icon-180.png', 'source/icon-source/app-light.svg', 180],
  ['icons/icon-192.png', 'source/icon-source/app-light.svg', 192],
  ['icons/icon-512.png', 'source/icon-source/app-light.svg', 512],
  ['icons/icon-maskable-192.png', 'source/icon-source/maskable-light.svg', 192],
  ['source/native/ios/AppIcon-1024.png', 'source/icon-source/app-light.svg', 1024],
  ['source/native/ios/AppIcon-dark-1024.png', 'source/icon-source/app-dark.svg', 1024],
  ['source/native/ios/AppIcon-tinted-1024.png', 'source/icon-source/app-tinted.svg', 1024],
  ['source/native/play/icon-512.png', 'favicon.svg', 512]
];

// ── minimal PNG tools (as tools/play-graphics.mjs) ───────────────────────────
function readPng(buf) {
  const ihdr = buf.subarray(16, 29);
  const info = { width: ihdr.readUInt32BE(0), height: ihdr.readUInt32BE(4), bitDepth: ihdr[8], colorType: ihdr[9] };
  const idat = []; let off = 8, trns = false;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8);
    if (type === 'IDAT') idat.push(buf.subarray(off + 8, off + 8 + len));
    if (type === 'tRNS') trns = true;
    off += 12 + len;
  }
  info.hasAlpha = info.colorType === 4 || info.colorType === 6 || trns;
  info.idat = Buffer.concat(idat);
  return info;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}
function toRgb(buf, palette = false) {
  const p = readPng(buf);
  // Always decoded and re-encoded (even when Chromium already wrote RGB), so
  // every icon gets the filtered encoding below.
  if (!(p.colorType === 6 || (p.colorType === 2 && !p.hasAlpha)) || p.bitDepth !== 8) throw new Error(`unexpected PNG colour type ${p.colorType}/${p.bitDepth}`);
  const bpp = p.colorType === 6 ? 4 : 3;
  const { width: w, height: h } = p, stride = w * bpp, raw = inflateSync(p.idat), px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let v = row[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * stride + x] = v & 255;
    }
  }
  const rgbStride = w * 3, rgb = Buffer.alloc(h * rgbStride);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * stride + x * bpp;
    if (bpp === 4 && px[i + 3] !== 255) throw new Error('icon has non-opaque pixels');
    px.copy(rgb, y * rgbStride + x * 3, i, i + 3);
  }
  // Each row takes the PNG filter (None, Sub, Up, Average, Paeth) whose output
  // has the smallest sum of absolute values — the usual heuristic, and on these
  // flat-colour tiles about half the bytes of unfiltered rows. These icons are
  // in every edition's install budget.
  const out = Buffer.alloc(h * (rgbStride + 1));
  const row = Buffer.alloc(rgbStride);
  for (let y = 0; y < h; y++) {
    let best = null, bestScore = Infinity, bestType = 0;
    for (let type = 0; type < 5; type++) {
      let score = 0;
      for (let x = 0; x < rgbStride; x++) {
        const v = rgb[y * rgbStride + x];
        const a = x >= 3 ? rgb[y * rgbStride + x - 3] : 0, b = y ? rgb[(y - 1) * rgbStride + x] : 0, c = x >= 3 && y ? rgb[(y - 1) * rgbStride + x - 3] : 0;
        let pred = 0;
        if (type === 1) pred = a; else if (type === 2) pred = b; else if (type === 3) pred = (a + b) >> 1;
        else if (type === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
        const f = (v - pred) & 255;
        row[x] = f;
        score += f < 128 ? f : 256 - f;
      }
      if (score < bestScore) { bestScore = score; bestType = type; best = Buffer.from(row); }
    }
    out[y * (rgbStride + 1)] = bestType;
    best.copy(out, y * (rgbStride + 1) + 1);
  }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  const asRgb = Buffer.concat([buf.subarray(0, 8), chunk('IHDR', ih), chunk('IDAT', deflateSync(out, { level: 9, memLevel: 9 })), chunk('IEND', Buffer.alloc(0))]);
  if (!palette) return asRgb;
  // A web icon with at most 256 distinct colours is written as an indexed PNG
  // (colour type 3, no tRNS, so still fully opaque): exactly the same pixels in
  // fewer bytes. Larger palettes, and the native icons, stay RGB.
  const index = new Map();
  for (let i = 0; i < rgb.length; i += 3) { const k = rgb.readUIntBE(i, 3); if (!index.has(k)) { if (index.size === 256) return asRgb; index.set(k, index.size); } }
  const plte = Buffer.alloc(index.size * 3);
  for (const [k, i] of index) plte.writeUIntBE(k, i * 3, 3);
  const idx = Buffer.alloc(h * (w + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) idx[y * (w + 1) + 1 + x] = index.get(rgb.readUIntBE((y * w + x) * 3, 3));
  const ihp = Buffer.from(ih); ihp[9] = 3;
  const asPalette = Buffer.concat([buf.subarray(0, 8), chunk('IHDR', ihp), chunk('PLTE', plte), chunk('IDAT', deflateSync(idx, { level: 9, memLevel: 9 })), chunk('IEND', Buffer.alloc(0))]);
  return asPalette.length < asRgb.length ? asPalette : asRgb;
}

const browser = await chromium.launch();
let fail = false;
try {
  // Light colour scheme explicitly: favicon.svg carries a prefers-color-scheme dark variant.
  const ctx = await browser.newContext({ colorScheme: 'light', deviceScaleFactor: 1 });
  for (const [rel, file, px] of JOBS) {
    const page = await ctx.newPage({ viewport: { width: px, height: px } });
    await page.setViewportSize({ width: px, height: px });
    const svg = src(file).replace(/<svg /, `<svg width="${px}" height="${px}" `).replace(/ width="32" height="32"/, '');
    await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;width:${px}px;height:${px}px;overflow:hidden}svg{display:block}</style></head><body>${svg}</body></html>`);
    const png = toRgb(await page.screenshot({ type: 'png', omitBackground: false }), rel.startsWith('icons/'));
    await page.close();
    const f = join(outDir, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, png);
    const i = readPng(png), ok = i.width === px && i.height === px && (i.colorType === 2 || (i.colorType === 3 && rel.startsWith('icons/'))) && !i.hasAlpha;
    if (!ok) fail = true;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${rel} ${i.width}x${i.height} colourType=${i.colorType}`);
  }
} finally { await browser.close(); }
if (fail) { console.error('RASTERISE: FAIL'); process.exit(1); }
console.log(`RASTERISE ${edition}: PASS`);
