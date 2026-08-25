// Generates out/captions.srt (30 s master) and out/captions-15.srt from the
// timeline's VO lines — the same data the burned captions render from.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VO_MAIN, VO15 } from '../src/data/timeline';

const stamp = (s: number): string => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const rem = ms % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(sec)},${p(rem, 3)}`;
};

const srt = (lines: { at: number; until: number; text: string }[]): string =>
  lines.map((l, i) => `${i + 1}\n${stamp(l.at)} --> ${stamp(l.until)}\n${l.text}\n`).join('\n');

writeFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'out', 'captions.srt'), srt(VO_MAIN));
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'out', 'captions-15.srt'), srt(VO15));
console.log('wrote out/captions.srt and out/captions-15.srt');
