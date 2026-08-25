#!/usr/bin/env node
// Generates 8 deterministic film-grain frames (540×960 grayscale PNG) into
// public/grain/. The Film component cycles them per frame at 2× scale —
// far cheaper than per-frame SVG turbulence, same look at 4–5% opacity.

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const W = 540;
const H = 960;

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

const mulberry32 = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let z = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
  return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
};

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'grain');
mkdirSync(OUT, { recursive: true });

for (let f = 0; f < 8; f++) {
  const rng = mulberry32(1000 + f * 7919);
  const raw = Buffer.alloc(H * (W + 1));
  for (let y = 0; y < H; y++) {
    raw[y * (W + 1)] = 0; // filter: none
    for (let x = 0; x < W; x++) {
      // gaussian-ish grain centred at mid-gray (overlay blend leaves midtones alone)
      const g = (rng() + rng() + rng() + rng() - 2) / 2; // ~N(0, 0.29), [-1, 1]
      raw[y * (W + 1) + 1 + x] = Math.max(0, Math.min(255, Math.round(128 + g * 84)));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // grayscale
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(join(OUT, `grain-${f}.png`), png);
}
console.log(`wrote 8 grain frames to ${OUT}`);
