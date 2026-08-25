#!/usr/bin/env node
// Contact sheets — a frame every 0.5 s, tiled 10 wide. Renders a low-res PNG
// sequence via Remotion (the bundled ffmpeg refuses image outputs), then
// decodes, tiles and encodes with scripts/png.mjs.
//   node scripts/contact-sheet.mjs [Reel916 out/contact-sheet-30.png]
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePngRGB, resizeRGB } from './png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const jobs =
  process.argv.length > 3
    ? [[process.argv[2], process.argv[3]]]
    : [
        ['Reel916', 'out/contact-sheet-30.png'],
        ['Cut15', 'out/contact-sheet-15.png'],
      ];

const TW = 216;
const TH = 384;
const COLS = 10;

for (const [comp, outFile] of jobs) {
  const tmp = join(ROOT, 'out', `cs-${comp}`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  execSync(
    `npx remotion render ${comp} "${tmp}" --sequence --image-format=png --every-nth-frame=30 --scale=0.25 --muted --concurrency=8 2>&1 | tail -1`,
    { cwd: ROOT, stdio: 'inherit', shell: '/bin/zsh' },
  );
  const files = readdirSync(tmp).filter((f) => f.endsWith('.png')).sort();
  const rows = Math.ceil(files.length / COLS);
  const sheet = new Uint8Array(COLS * TW * rows * TH * 3);
  files.forEach((f, i) => {
    const { w, h, rgb } = decodePng(readFileSync(join(tmp, f)));
    const small = resizeRGB(w, h, rgb, TW, TH);
    const gx = (i % COLS) * TW;
    const gy = Math.floor(i / COLS) * TH;
    for (let y = 0; y < TH; y++) {
      const src = y * TW * 3;
      const dst = ((gy + y) * COLS * TW + gx) * 3;
      sheet.set(small.subarray(src, src + TW * 3), dst);
    }
  });
  writeFileSync(join(ROOT, outFile), encodePngRGB(COLS * TW, rows * TH, sheet));
  rmSync(tmp, { recursive: true, force: true });
  console.log(`wrote ${outFile} (${files.length} frames, ${COLS}x${rows})`);
}
