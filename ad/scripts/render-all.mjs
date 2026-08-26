#!/usr/bin/env node
// Renders every deliverable: 30 s master (9:16), 4:5, 1:1, the 15 s cut,
// cover.png and captions.srt. Remuxes each MP4 with +faststart via Remotion's
// bundled ffmpeg. Render logs are kept for the React-warning gate.

import { execFileSync, execSync } from 'node:child_process';
import { mkdirSync, renameSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'out');
mkdirSync(OUT, { recursive: true });
const LOG = join(OUT, 'render-log.txt');
writeFileSync(LOG, '');

const run = (cmd) => {
  console.log(`\n$ ${cmd}`);
  const out = execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1024 * 1024 * 64 });
  appendFileSync(LOG, `$ ${cmd}\n${out}\n`);
  return out;
};

// remux: copy video, conform audio to spec (AAC 128k 48 kHz), faststart moov
const faststart = (file) => {
  const tmp = file.replace(/\.mp4$/, '.fast.mp4');
  run(`npx remotion ffmpeg -y -i "${file}" -c:v copy -c:a aac -b:a 128k -ar 48000 -movflags +faststart "${tmp}" 2>&1 | tail -1`);
  renameSync(tmp, file);
};

const targets = [
  ['Reel916', 'pri-reel-36-916.mp4'],
  ['Feed45', 'pri-reel-36-45.mp4'],
  ['Square11', 'pri-reel-36-11.mp4'],
  ['Cut15', 'pri-reel-15-916.mp4'],
];

for (const [comp, file] of targets) {
  run(`npx remotion render ${comp} out/${file} --codec=h264 --video-bitrate=14M --audio-bitrate=128k --color-space=bt709 --concurrency=8 2>&1 | tail -3`);
  faststart(join(OUT, file));
}

// cover — frame 0 of the master
run(`npx remotion still Reel916 out/cover.png --frame=0 2>&1 | tail -1`);

// captions
run(`npx --yes tsx scripts/gen-captions.ts`);

console.log('\nAll deliverables rendered.');
