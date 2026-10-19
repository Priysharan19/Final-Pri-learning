#!/usr/bin/env node
// Renders the Google Play listing graphics from the existing P′ mark
// (client/public/favicon.svg) and the app's theme tokens (client/src/theme.css).
//
//   node tools/play-graphics.mjs
//
// Writes docs/release/store/play/icon-512.png (512x512, RGBA allowed) and
// docs/release/store/play/feature-graphic-1024x500.png (1024x500, 24-bit RGB,
// no alpha), then verifies dimensions and colour type. Uses the Playwright
// Chromium already installed for the client; no network access is needed.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync, deflateSync, crc32 } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'docs/release/store/play');
const require = createRequire(join(root, 'client/package.json'));
const { chromium } = require('playwright');

// --- sources of truth -------------------------------------------------------
const markSvg = readFileSync(join(root, 'client/public/favicon.svg'), 'utf8');
const theme = readFileSync(join(root, 'client/src/theme.css'), 'utf8');
const token = (name) => {
  const m = theme.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!m) throw new Error(`theme token --${name} not found`);
  return m[1];
};
const T = { paper: token('paper'), ink: token('ink'), ink3: token('ink-3'), prime: token('brand-prime') };
const listing = readFileSync(join(root, 'docs/release/store/play-listing.md'), 'utf8');
const short = listing.match(/\|\s*Short description\s*\|\s*80\s*\|\s*`([^`]+)`/)?.[1];
if (!short) throw new Error('short description not found in play-listing.md §1');
// One calm line: the first sentence of the approved short description.
const line = short.split(/(?<=\.)\s/)[0];

// Fonts are inlined as data URLs: a page set from a string cannot load file:// fonts.
const fontUrl = (p) => `data:font/woff2;base64,${readFileSync(join(root, 'client/node_modules', p)).toString('base64')}`;
const fonts = `
@font-face{font-family:'KaTeX_Main';src:url(${fontUrl('katex/dist/fonts/KaTeX_Main-Regular.woff2')}) format('woff2');}
@font-face{font-family:'Inter Variable';font-weight:100 900;src:url(${fontUrl('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')}) format('woff2-variations');}`;

// The mark exactly as shipped, scaled; only width/height change.
const mark = (px) => markSvg.replace(/width="\d+" height="\d+"/, `width="${px}" height="${px}"`);

const iconHtml = `<!doctype html><html><head><style>html,body{margin:0}</style></head><body>${mark(512)}</body></html>`;

const featureHtml = `<!doctype html><html><head><style>${fonts}
html,body{margin:0;width:1024px;height:500px;overflow:hidden}
body{background:${T.paper};
  background-image:repeating-linear-gradient(to bottom, transparent 0 39px, rgba(30,74,110,0.085) 39px 40px);
  position:relative;color:${T.ink}}
.margin{position:absolute;top:0;bottom:0;left:132px;width:1px;background:rgba(160,79,36,0.16)}
.wrap{position:absolute;left:184px;top:0;bottom:0;display:flex;align-items:center;gap:44px}
.wrap svg{border-radius:28px;box-shadow:0 0 0 1px rgba(28,27,24,0.10)}
h1{font-family:'KaTeX_Main',serif;font-weight:400;font-size:76px;letter-spacing:-0.5px;margin:0 0 14px;line-height:1}
p{font-family:'Inter Variable',sans-serif;font-size:24px;color:${T.ink3};margin:0;font-weight:420}
</style></head><body><div class="margin"></div>
<div class="wrap">${mark(168)}<div><h1>Pri Learning</h1><p>${line}</p></div></div></body></html>`;

// --- minimal PNG tools (inspect + strip alpha) --------------------------------
function readPng(buf) {
  const ihdr = buf.subarray(16, 29);
  const info = { width: ihdr.readUInt32BE(0), height: ihdr.readUInt32BE(4), bitDepth: ihdr[8], colorType: ihdr[9] };
  let idat = [], off = 8, hasTrns = false;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8);
    if (type === 'IDAT') idat.push(buf.subarray(off + 8, off + 8 + len));
    if (type === 'tRNS') hasTrns = true;
    off += 12 + len;
  }
  info.hasAlpha = info.colorType === 4 || info.colorType === 6 || hasTrns;
  info.idat = Buffer.concat(idat);
  return info;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}
function rgbaToRgb(buf) {
  const p = readPng(buf);
  if (p.colorType === 2 && !p.hasAlpha) return buf;
  if (p.colorType !== 6 || p.bitDepth !== 8) throw new Error(`unexpected PNG colour type ${p.colorType}/${p.bitDepth}`);
  const { width: w, height: h } = p, bpp = 4, stride = w * bpp;
  const raw = inflateSync(p.idat), px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * stride + x] = v & 255;
    }
  }
  const out = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * stride + x * 4;
    if (px[i + 3] !== 255) throw new Error('feature graphic has non-opaque pixels');
    px.copy(out, y * (w * 3 + 1) + 1 + x * 3, i, i + 3);
  }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([buf.subarray(0, 8), chunk('IHDR', ih), chunk('IDAT', deflateSync(out, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
export { readPng };

// --- render -----------------------------------------------------------------
async function render(html, width, height) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    const loaded = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === 'loaded').length; });
    if (html.includes('@font-face') && loaded < 2) throw new Error(`theme fonts did not load (${loaded})`);
    return await page.screenshot({ type: 'png', omitBackground: false });
  } finally { await browser.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(outDir, { recursive: true });
  const icon = await render(iconHtml, 512, 512);
  const feature = rgbaToRgb(await render(featureHtml, 1024, 500));
  const iconPath = join(outDir, 'icon-512.png'), featPath = join(outDir, 'feature-graphic-1024x500.png');
  writeFileSync(iconPath, icon);
  writeFileSync(featPath, feature);
  const i = readPng(icon), f = readPng(feature);
  const ok = i.width === 512 && i.height === 512 && f.width === 1024 && f.height === 500 && !f.hasAlpha && f.colorType === 2;
  console.log(`icon-512.png ${i.width}x${i.height} colourType=${i.colorType}`);
  console.log(`feature-graphic-1024x500.png ${f.width}x${f.height} colourType=${f.colorType} alpha=${f.hasAlpha}`);
  console.log(`line: "${line}"`);
  if (!ok) { console.error('PLAY GRAPHICS: FAIL'); process.exit(1); }
  console.log('PLAY GRAPHICS: PASS');
}
