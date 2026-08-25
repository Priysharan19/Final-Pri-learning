#!/usr/bin/env node
// Prints the RMS profile of a soundtrack in 0.5 s windows — proof that the
// dynamic-range moment exists (near-silence before the lock, peak at it).
//   node scripts/audio-profile.mjs [public/audio/soundtrack-30.wav]
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = process.argv[2] || join(ROOT, 'public', 'audio', 'soundtrack-30.wav');
const buf = readFileSync(path);
let off = 12, fmt = null, data = null;
while (off + 8 <= buf.length) {
  const id = buf.toString('ascii', off, off + 4);
  const size = buf.readUInt32LE(off + 4);
  if (id === 'fmt ') fmt = { ch: buf.readUInt16LE(off + 10), sr: buf.readUInt32LE(off + 12) };
  if (id === 'data') data = buf.subarray(off + 8, off + 8 + size);
  off += 8 + size + (size % 2);
}
const N = data.length / 2 / fmt.ch;
const win = Math.round(0.5 * fmt.sr);
let peakDb = -99, peakAt = 0;
console.log(`${path} — ${(N / fmt.sr).toFixed(1)}s @ ${fmt.sr}Hz`);
for (let s = 0; s + win <= N; s += win) {
  let acc = 0;
  for (let i = s; i < s + win; i++) {
    for (let c = 0; c < fmt.ch; c++) {
      const v = data.readInt16LE((i * fmt.ch + c) * 2) / 32768;
      acc += v * v;
    }
  }
  const rms = Math.sqrt(acc / (win * fmt.ch));
  const db = 20 * Math.log10(Math.max(rms, 1e-6));
  if (db > peakDb) {
    peakDb = db;
    peakAt = s / fmt.sr;
  }
  const bars = '#'.repeat(Math.max(0, Math.round((db + 60) / 1.5)));
  console.log(`${(s / fmt.sr).toFixed(1).padStart(5)}s ${db.toFixed(1).padStart(7)} dB ${bars}`);
}
console.log(`loudest 0.5s window starts at ${peakAt.toFixed(1)}s (${peakDb.toFixed(1)} dB RMS)`);
