// ─────────────────────────────────────────────────────────────────────────────
// SIMULATED handwriting pictures, without a browser.
//
// The flagship acceptance (flagship-handwriting.mjs) draws its pictures with
// the app's own rasterisers in Playwright's Chromium. The staging acceptance
// runner must work on a machine with Node alone, so this file rasterises the
// pen strokes from simulated-ink.mjs itself (a disc stamped along every
// segment) and encodes the result as an 8-bit greyscale PNG with node:zlib.
//
// Nothing here reads a question or an answer key: it is given text to write
// and writes it. Every picture it produces is SYNTHETIC — not a student's
// writing, not Apple Pencil, not a camera — and must be labelled so wherever
// it is saved or reported.
// ─────────────────────────────────────────────────────────────────────────────
import { deflateSync } from 'node:zlib';
import { mulberry32, writeLines } from './simulated-ink.mjs';

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

export function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

/** 8-bit greyscale pixels (row-major, one byte per pixel) → a PNG file. */
export function encodeGreyPng({ width, height, pixels }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error('png: bad dimensions');
  if (pixels.length !== width * height) throw new Error('png: pixel buffer does not match the dimensions');
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 0;   // colour type: greyscale
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter method
  ihdr[12] = 0;  // no interlace
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width + 1)] = 0; // filter type None for this scanline
    pixels.copy(raw, y * (width + 1) + 1, y * width, (y + 1) * width);
  }
  return Buffer.concat([PNG_SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** Read width/height back out of a PNG this module (or anything else) wrote. */
export function pngDimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (buffer.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), bitDepth: buffer[24], colourType: buffer[25] };
}

function stampDisc(canvas, width, height, cx, cy, radius, shade) {
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(cx - radius)), x1 = Math.min(width - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius)), y1 = Math.min(height - 1, Math.ceil(cy + radius));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) {
        const i = y * width + x;
        if (canvas[i] > shade) canvas[i] = shade;
      }
    }
  }
}

/**
 * Pen strokes ([[{x,y},…],…]) → a greyscale bitmap. `paper` paints the
 * background (plain white for an ink picture, ruled off-white "paper" for a
 * photo-like one); the strokes are stamped on top in `ink` grey.
 */
export function rasterizeStrokes(strokes, { lineWidth = 7, pad = 48, ink = 24, paper = 'white', seed = 1, minWidth = 320, minHeight = 240 } = {}) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const stroke of strokes) for (const p of stroke) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  if (!Number.isFinite(minX)) throw new Error('rasterizeStrokes: no strokes');
  const width = Math.max(minWidth, Math.ceil(maxX - minX) + 2 * pad);
  const height = Math.max(minHeight, Math.ceil(maxY - minY) + 2 * pad);
  const offsetX = Math.floor((width - (maxX - minX)) / 2) - minX;
  const offsetY = Math.floor((height - (maxY - minY)) / 2) - minY;
  const pixels = Buffer.alloc(width * height, 255);
  if (paper === 'ruled') {
    const rand = mulberry32(seed);
    for (let y = 0; y < height; y += 1) {
      // Uneven lighting: a little darker towards the bottom-right, plus grain.
      for (let x = 0; x < width; x += 1) {
        const shade = 236 - Math.round(14 * (x / width) * (y / height)) - Math.round(rand() * 6);
        pixels[y * width + x] = Math.max(0, Math.min(255, shade));
      }
      if (y % 74 === 60) for (let x = 0; x < width; x += 1) pixels[y * width + x] = 196; // ruled line
    }
  }
  const radius = Math.max(1, lineWidth / 2);
  for (const stroke of strokes) {
    if (!stroke.length) continue;
    let prev = stroke[0];
    stampDisc(pixels, width, height, prev.x + offsetX, prev.y + offsetY, radius, ink);
    for (let i = 1; i < stroke.length; i += 1) {
      const next = stroke[i];
      const steps = Math.max(1, Math.ceil(Math.hypot(next.x - prev.x, next.y - prev.y)));
      for (let s = 1; s <= steps; s += 1) {
        const t = s / steps;
        stampDisc(pixels, width, height, prev.x + (next.x - prev.x) * t + offsetX, prev.y + (next.y - prev.y) * t + offsetY, radius, ink);
      }
      prev = next;
    }
  }
  return { width, height, pixels };
}

export const toDataUrl = png => `data:image/png;base64,${png.toString('base64')}`;

/**
 * SIMULATED handwriting of `lines` as the picture the app would send for Write
 * mode: pen strokes on white.
 */
export function simulatedInkPng(lines, { seed = 20261018, size = 150 } = {}) {
  const { strokes } = writeLines(lines, { seed, size, lineGap: Math.round(size * 1.9) });
  const bitmap = rasterizeStrokes(strokes, { lineWidth: Math.max(5, Math.round(size / 18)), paper: 'white' });
  return { png: encodeGreyPng(bitmap), width: bitmap.width, height: bitmap.height, label: 'SIMULATED-ink', strokes: strokes.length };
}

/**
 * SIMULATED "photo" of a page of working: the same strokes as blue-black
 * ballpoint on ruled, unevenly lit paper. Not a camera, not a student's page.
 */
export function simulatedPhotoPng(lines, { seed = 20261019, size = 150 } = {}) {
  const { strokes } = writeLines(lines, { seed, size, lineGap: Math.round(size * 1.9) });
  const bitmap = rasterizeStrokes(strokes, { lineWidth: Math.max(4, Math.round(size / 24)), paper: 'ruled', ink: 48, seed, pad: 96, minWidth: 640, minHeight: 480 });
  return { png: encodeGreyPng(bitmap), width: bitmap.width, height: bitmap.height, label: 'SIMULATED-photo', strokes: strokes.length };
}
