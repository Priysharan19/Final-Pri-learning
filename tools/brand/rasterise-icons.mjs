#!/usr/bin/env node
// Pri Learning · rasterise one edition's app icons from its brand SVG sources
// (plan mission E4; the sources come from tools/brand/build-assets.mjs).
//
//   node tools/brand/rasterise-icons.mjs <priyabhata|prithagoras>
//
// Renders with the Playwright Chromium the client already installs (the same way
// tools/play-graphics.mjs does; no network). Every PNG is written opaque RGB
// (colour type 2): the App Store rejects an alpha channel on the 1024 icon, and
// the PWA icons are opaque too. Written under client/brand/<edition>/:
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
function toRgb(buf) {
  const p = readPng(buf);
  if (p.colorType === 2 && !p.hasAlpha) return buf;
  if (p.colorType !== 6 || p.bitDepth !== 8) throw new Error(`unexpected PNG colour type ${p.colorType}/${p.bitDepth}`);
  const { width: w, height: h } = p, stride = w * 4, raw = inflateSync(p.idat), px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? px[y * stride + x - 4] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = x >= 4 && y ? px[(y - 1) * stride + x - 4] : 0;
      let v = row[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * stride + x] = v & 255;
    }
  }
  const out = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * stride + x * 4;
    if (px[i + 3] !== 255) throw new Error('icon has non-opaque pixels');
    px.copy(out, y * (w * 3 + 1) + 1 + x * 3, i, i + 3);
  }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([buf.subarray(0, 8), chunk('IHDR', ih), chunk('IDAT', deflateSync(out, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
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
    const png = toRgb(await page.screenshot({ type: 'png', omitBackground: false }));
    await page.close();
    const f = join(outDir, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, png);
    const i = readPng(png), ok = i.width === px && i.height === px && i.colorType === 2 && !i.hasAlpha;
    if (!ok) fail = true;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${rel} ${i.width}x${i.height} colourType=${i.colorType}`);
  }
} finally { await browser.close(); }
if (fail) { console.error('RASTERISE: FAIL'); process.exit(1); }
console.log(`RASTERISE ${edition}: PASS`);
