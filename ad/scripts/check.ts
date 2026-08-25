// Quality gates — run, don't claim. `npx tsx scripts/check.ts [--skip-stills]`
//
//  1. Mathematics: every TeX string compiles (throwOnError) and every
//     numeric verification in src/math/expressions.ts holds.
//  2. Timeline: text beats >4 words hold ≥1.2 s; scene cuts land on the
//     0.5 s beat grid; VO lines don't overlap and fit the film.
//  3. Containers (ffprobe): codec/fps/duration/pix_fmt/audio per spec;
//     moov before mdat (faststart).
//  4. Safe zones (pixel lint): every text box (rendered as pure red in
//     debugSafe mode) stays out of the IG top-250/bottom-420/side-90 zones.
//  5. Contrast: for each text beat, glyph-vs-backdrop contrast within the
//     text's actual bounding box ≥ 4.5:1 (sampled from the real frame).
//  6. Determinism: the same frame rendered twice is byte-identical.
//  7. Zero React warnings in the render log.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import katex from 'katex';
import { ALL_TEX, VERIFICATIONS } from '../src/math/expressions';
import { FPS, SCENES30, SCENES15, TEXT30, TEXT15, VO30, VO15, DUR30, DUR15 } from '../src/data/timeline';

const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'out');
const PROBE = join(OUT, 'probe');
mkdirSync(PROBE, { recursive: true });

const skipStills = process.argv.includes('--skip-stills');

let failures = 0;
const pass = (name: string) => console.log(`  ✓ ${name}`);
const fail = (name: string, detail?: string) => {
  failures++;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
};

const sh = (cmd: string): string =>
  execSync(cmd, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 });

const shBuf = (cmd: string): Buffer =>
  execSync(cmd, { cwd: ROOT, encoding: 'buffer', maxBuffer: 1024 * 1024 * 128 }) as unknown as Buffer;

// ── 1. mathematics ─────────────────────────────────────────────────────────
console.log('\n[1] Mathematics');
{
  let texOk = 0;
  for (const tex of ALL_TEX) {
    try {
      katex.renderToString(tex, { throwOnError: true, strict: false });
      texOk++;
    } catch (e) {
      fail(`TeX failed to compile: ${tex}`, String(e));
    }
  }
  if (texOk === ALL_TEX.length) pass(`all ${ALL_TEX.length} TeX expressions compile`);
  for (const v of VERIFICATIONS) {
    if (v.check()) pass(v.name);
    else fail(`verification failed: ${v.name}`);
  }
}

// ── 2. timeline ────────────────────────────────────────────────────────────
console.log('\n[2] Timeline');
{
  for (const [label, beats] of [
    ['30s', TEXT30],
    ['15s', TEXT15],
  ] as const) {
    let ok = true;
    for (const b of beats) {
      const words = b.text.split(/\s+/).filter((x) => x.length > 1 || /\w/.test(x)).length;
      const hold = b.until - b.at;
      if (words > 4 && hold < 1.2) {
        ok = false;
        fail(`${label} beat "${b.text}" holds ${hold.toFixed(2)}s for ${words} words (<1.2s)`);
      }
    }
    if (ok) pass(`${label} text beats: every >4-word line holds ≥1.2s`);
  }
  const cuts30 = Object.values(SCENES30).map((s) => s.at);
  const cuts15 = Object.values(SCENES15).map((s) => s.at);
  const offGrid = [...cuts30, ...cuts15].filter((s) => {
    const r = s % 0.5;
    return r > 1 / FPS && 0.5 - r > 1 / FPS;
  });
  if (offGrid.length === 0) pass('every scene cut lands on the 0.5 s beat grid');
  else fail(`cuts off the beat grid: ${offGrid.join(', ')}`);

  for (const [label, vo, dur] of [
    ['30s', VO30, DUR30],
    ['15s', VO15, DUR15],
  ] as const) {
    let ok = true;
    for (let i = 0; i < vo.length; i++) {
      if (vo[i].until > dur) {
        ok = false;
        fail(`${label} VO line ${i} runs past the film`);
      }
      if (i > 0 && vo[i].at < vo[i - 1].until - 0.01) {
        ok = false;
        fail(`${label} VO lines ${i - 1}/${i} overlap`);
      }
    }
    if (ok) pass(`${label} VO lines: sequential, inside the film`);
  }
}

// ── 3. containers ──────────────────────────────────────────────────────────
console.log('\n[3] Containers (ffprobe)');
interface Target {
  file: string;
  w: number;
  h: number;
  dur: number;
}
const targets: Target[] = [
  { file: 'pri-reel-30-916.mp4', w: 1080, h: 1920, dur: 30 },
  { file: 'pri-reel-30-45.mp4', w: 1080, h: 1350, dur: 30 },
  { file: 'pri-reel-30-11.mp4', w: 1080, h: 1080, dur: 30 },
  { file: 'pri-reel-15-916.mp4', w: 1080, h: 1920, dur: 15 },
];
for (const t of targets) {
  const p = join(OUT, t.file);
  if (!existsSync(p)) {
    fail(`${t.file} missing`);
    continue;
  }
  const probe = JSON.parse(
    sh(`npx remotion ffprobe -v quiet -print_format json -show_format -show_streams "${p}"`),
  );
  const v = probe.streams.find((s: any) => s.codec_type === 'video');
  const a = probe.streams.find((s: any) => s.codec_type === 'audio');
  const dur = parseFloat(probe.format.duration);
  const fps = v ? eval(v.r_frame_rate) : 0;
  const brMbps = parseInt(probe.format.bit_rate, 10) / 1e6;
  const checks: [string, boolean, string][] = [
    ['codec h264', v?.codec_name === 'h264', String(v?.codec_name)],
    ['yuv420p', v?.pix_fmt === 'yuv420p', String(v?.pix_fmt)],
    [`size ${t.w}x${t.h}`, v?.width === t.w && v?.height === t.h, `${v?.width}x${v?.height}`],
    ['60 fps', Math.abs(fps - 60) < 0.01, String(fps)],
    [`duration ${t.dur}s`, Math.abs(dur - t.dur) < 0.15, dur.toFixed(2)],
    ['bitrate 8–20 Mbps', brMbps > 8 && brMbps < 20, brMbps.toFixed(1) + ' Mbps'],
    ['audio aac', a?.codec_name === 'aac', String(a?.codec_name)],
    ['audio 48 kHz', a?.sample_rate === '48000', String(a?.sample_rate)],
  ];
  const bad = checks.filter(([, ok]) => !ok);
  if (bad.length === 0) pass(`${t.file}: ${checks.map(([n]) => n).join(' · ')}`);
  else for (const [n, , got] of bad) fail(`${t.file}: ${n}`, `got ${got}`);

  // faststart: moov before mdat in the first megabyte
  const head = readFileSync(p).subarray(0, 1024 * 1024);
  const moov = head.indexOf('moov');
  const mdat = head.indexOf('mdat');
  if (moov !== -1 && (mdat === -1 || moov < mdat)) pass(`${t.file}: faststart (moov leads)`);
  else fail(`${t.file}: moov does not lead`, `moov@${moov} mdat@${mdat}`);
}

// ── 4+5. safe zones and contrast (pixel lint) ──────────────────────────────
const lum = (r: number, g: number, b: number): number => {
  const f = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const rgbOf = (png: string, w: number, h: number): Buffer => {
  const buf = shBuf(`npx remotion ffmpeg -v quiet -i "${png}" -f rawvideo -pix_fmt rgb24 - `);
  if (buf.length !== w * h * 3) throw new Error(`raw size mismatch for ${png}: ${buf.length}`);
  return buf;
};

if (!skipStills) {
  console.log('\n[4] IG safe zones (9:16) + [5] contrast — pixel lint per text beat');
  const zones916 = { top: 250, bottom: 420, side: 90 };

  interface Probe {
    comp: string;
    frame: number;
    label: string;
  }
  const probes: Probe[] = [];
  for (const b of TEXT30) probes.push({ comp: 'Reel916', frame: Math.round(((b.at + b.until) / 2) * FPS), label: `30s "${b.text.slice(0, 32)}"` });
  for (const b of TEXT15) probes.push({ comp: 'Cut15', frame: Math.round(((b.at + b.until) / 2) * FPS), label: `15s "${b.text.slice(0, 32)}"` });

  const W = 1080;
  const H = 1920;
  for (const pr of probes) {
    const dbg = join(PROBE, `${pr.comp}-${pr.frame}-dbg.png`);
    const norm = join(PROBE, `${pr.comp}-${pr.frame}-norm.png`);
    sh(`npx remotion still ${pr.comp} "${dbg}" --frame=${pr.frame} --props='{"debugSafe":true,"muted":true}' 2>/dev/null | tail -0 || true`);
    sh(`npx remotion still ${pr.comp} "${norm}" --frame=${pr.frame} --props='{"muted":true}' 2>/dev/null | tail -0 || true`);
    const dRGB = rgbOf(dbg, W, H);
    const nRGB = rgbOf(norm, W, H);

    // find the red text mask
    let minX = W, maxX = -1, minY = H, maxY = -1, redCount = 0;
    let unsafe = 0;
    const mask: number[] = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 3;
        const r = dRGB[i], g = dRGB[i + 1], b = dRGB[i + 2];
        if (r > 130 && r > 2.4 * Math.max(g, b)) {
          redCount++;
          mask.push(i);
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          if (y < zones916.top || y >= H - zones916.bottom || x < zones916.side || x >= W - zones916.side) unsafe++;
        }
      }
    }
    if (redCount === 0) {
      fail(`${pr.label}: no text box found at frame ${pr.frame}`);
      continue;
    }
    if (unsafe > 0) fail(`${pr.label}: ${unsafe}px of text inside IG UI zones (box ${minX},${minY}→${maxX},${maxY})`);
    else pass(`${pr.label}: text box ${minX},${minY}→${maxX},${maxY} inside safe area`);

    // contrast: within the mask, glyphs vs backdrop from the real frame
    const lums: number[] = [];
    for (const i of mask) lums.push(lum(nRGB[i], nRGB[i + 1], nRGB[i + 2]));
    lums.sort((a, b) => a - b);
    const q = (p: number) => lums[Math.min(lums.length - 1, Math.floor(p * lums.length))];
    const glyph = q(0.97); // brightest text pixels
    const back = q(0.2); // the backdrop the glyphs sit on
    const ratio = (Math.max(glyph, back) + 0.05) / (Math.min(glyph, back) + 0.05);
    if (ratio >= 4.5) pass(`${pr.label}: contrast ${ratio.toFixed(1)}:1`);
    else fail(`${pr.label}: contrast ${ratio.toFixed(1)}:1 (<4.5)`);
  }

  // ── 6. determinism ───────────────────────────────────────────────────────
  console.log('\n[6] Determinism');
  const d1 = join(PROBE, 'det-a.png');
  const d2 = join(PROBE, 'det-b.png');
  sh(`npx remotion still Reel916 "${d1}" --frame=756 2>/dev/null | tail -0 || true`);
  sh(`npx remotion still Reel916 "${d2}" --frame=756 2>/dev/null | tail -0 || true`);
  if (readFileSync(d1).equals(readFileSync(d2))) pass('frame 756 rendered twice is byte-identical');
  else fail('frame 756 differs between renders');
} else {
  console.log('\n[4–6] skipped (--skip-stills)');
}

// ── 7. React warnings ──────────────────────────────────────────────────────
console.log('\n[7] Render log');
{
  const logPath = join(OUT, 'render-log.txt');
  if (!existsSync(logPath)) fail('out/render-log.txt missing (run scripts/render-all.mjs)');
  else {
    const log = readFileSync(logPath, 'utf8');
    const warnings = log.split('\n').filter((l) => /Warning:|console\.error/.test(l));
    if (warnings.length === 0) pass('zero React warnings in render log');
    else fail(`${warnings.length} warning lines in render log`, warnings[0]);
  }
}

console.log(failures === 0 ? '\nALL GATES PASS' : `\n${failures} GATE FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
