#!/usr/bin/env node
// Records the ad's VO lines (ElevenLabs studio voice by default, macOS TTS
// fallback), runs each through the VO channel strip, lays them over the beds
// from make-audio.mjs, and masters both soundtracks to −14 LUFS / −1 dBFS.
// DSP chain proven in marketing/reel/tools/make-vo-mix.mjs.
//
//   node ad/tools/make-vo.mjs [--engine elevenlabs|say] [--voice <name>] [--model <id>]

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const SR = 44100;

function segRms(buf, start, len) {
  let acc = 0,
    n = 0;
  for (let i = start; i < Math.min(buf.length, start + len); i++, n++) acc += buf[i] * buf[i];
  return n ? Math.sqrt(acc / n) : 0;
}
function biquad(samples, { b0, b1, b2, a1, a2 }) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    samples[i] = y;
  }
}
function highpass(f0, Q, sr) {
  const w = (2 * Math.PI * f0) / sr, cw = Math.cos(w), al = Math.sin(w) / (2 * Q), a0 = 1 + al;
  return { b0: (1 + cw) / 2 / a0, b1: -(1 + cw) / a0, b2: (1 + cw) / 2 / a0, a1: (-2 * cw) / a0, a2: (1 - al) / a0 };
}
function peaking(f0, Q, dB, sr) {
  const A = Math.pow(10, dB / 40), w = (2 * Math.PI * f0) / sr, cw = Math.cos(w), al = Math.sin(w) / (2 * Q), a0 = 1 + al / A;
  return { b0: (1 + al * A) / a0, b1: (-2 * cw) / a0, b2: (1 - al * A) / a0, a1: (-2 * cw) / a0, a2: (1 - al / A) / a0 };
}
function highshelf(f0, Q, dB, sr) {
  const A = Math.pow(10, dB / 40), w = (2 * Math.PI * f0) / sr, cw = Math.cos(w), al = Math.sin(w) / (2 * Q);
  const s = 2 * Math.sqrt(A) * al, a0 = A + 1 - (A - 1) * cw + s;
  return {
    b0: (A * (A + 1 + (A - 1) * cw + s)) / a0,
    b1: (-2 * A * (A - 1 + (A + 1) * cw)) / a0,
    b2: (A * (A + 1 + (A - 1) * cw - s)) / a0,
    a1: (2 * (A - 1 - (A + 1) * cw)) / a0,
    a2: (A + 1 - (A - 1) * cw - s) / a0,
  };
}
function compress(samples, thrDb, ratio, att, rel, sr) {
  const aA = Math.exp(-1 / (att * sr)), aR = Math.exp(-1 / (rel * sr));
  let env = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    env = a > env ? aA * env + (1 - aA) * a : aR * env + (1 - aR) * a;
    const envDb = 20 * Math.log10(Math.max(env, 1e-6));
    const overDb = envDb - thrDb;
    if (overDb > 0) samples[i] *= Math.pow(10, (-overDb * (1 - 1 / ratio)) / 20);
  }
}
function integratedLufs(Lc, Rc, sr) {
  const kL = Float32Array.from(Lc), kR = Float32Array.from(Rc);
  for (const ch of [kL, kR]) {
    biquad(ch, highshelf(1681, 0.707, 3.999, sr));
    biquad(ch, highpass(38.135, 0.5, sr));
  }
  const blk = Math.round(0.4 * sr), hop = Math.round(0.1 * sr), blocks = [];
  for (let s = 0; s + blk <= kL.length; s += hop) {
    let ms = 0;
    for (let i = s; i < s + blk; i++) ms += kL[i] * kL[i] + kR[i] * kR[i];
    ms /= blk;
    blocks.push(-0.691 + 10 * Math.log10(Math.max(ms, 1e-12)));
  }
  const abs = blocks.filter((b) => b > -70);
  if (!abs.length) return -70;
  const mean = (arr) => 10 * Math.log10(arr.reduce((a, b) => a + Math.pow(10, b / 10), 0) / arr.length);
  const rel = abs.filter((b) => b > mean(abs) - 10);
  return rel.length ? mean(rel) : mean(abs);
}
function limit(Lc, Rc, ceiling, sr) {
  const aR = Math.exp(-1 / (0.06 * sr));
  let gain = 1;
  for (let i = 0; i < Lc.length; i++) {
    const p = Math.max(Math.abs(Lc[i]), Math.abs(Rc[i]));
    const want = p * gain > ceiling ? ceiling / Math.max(p, 1e-9) : 1;
    gain = want < gain ? want : aR * gain + (1 - aR) * Math.min(1, want);
    Lc[i] = Math.max(-ceiling, Math.min(ceiling, Lc[i] * gain));
    Rc[i] = Math.max(-ceiling, Math.min(ceiling, Rc[i] * gain));
  }
}

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : '1'] : []))
    .filter((p) => p.length),
);
const KEY =
  process.env.ELEVENLABS_API_KEY ||
  (existsSync(join(homedir(), '.elevenlabs_key')) ? readFileSync(join(homedir(), '.elevenlabs_key'), 'utf8').trim() : '');
const ENGINE = args.engine || (KEY ? 'elevenlabs' : 'say');
const VOICE = args.voice || (ENGINE === 'say' ? 'Tara' : '');
const EL_MODEL = args.model || 'eleven_multilingual_v2';

// ── the lines (must mirror src/data/timeline.ts VO30/VO15) ─────────────────
const LINES30 = [
  { at: 0.15, until: 1.45, text: 'Stop memorising maths.' },
  { at: 2.6, until: 6.05, text: 'Four hundred formulas. The same drill, the same batch, every day.' },
  { at: 6.75, until: 7.95, text: 'Until the question is new.' },
  { at: 9.0, until: 11.7, text: 'Watch the secant become the tangent.' },
  { at: 13.2, until: 14.9, text: 'That is the derivative — not a rule, a reason.' },
  { at: 15.4, until: 19.6, text: 'Understand one idea, and you can solve what you have never seen. Marked like an examiner.' },
  { at: 20.3, until: 23.3, text: 'Over three lakh questions, generated on your iPad. Your misconceptions, traced.' },
  { at: 23.4, until: 26.3, text: 'Percentile predicted. Rivals raced. Mocks marked. All of it offline.' },
  { at: 27.3, until: 32.6, text: 'Class seven to Olympiad. The same mathematics, at different pressures.' },
  { at: 33.3, until: 35.2, text: 'Pri Learning. Join the change.' },
];
const LINES15 = [
  { at: 0.2, until: 1.15, text: 'Stop memorising maths.', reuse: 0 },
  { at: 2.55, until: 3.7, text: 'Until the question is new.', reuse: 2 },
  { at: 3.9, until: 6.5, text: 'Watch the secant become the tangent.' },
  { at: 8.7, until: 10.4, text: 'Your working, marked like an examiner.' },
  { at: 10.7, until: 12.3, text: 'Class seven to Olympiad.' },
  { at: 12.8, until: 14.5, text: 'Pri Learning. Join the change.', reuse: 9 },
];

function parseWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not RIFF/WAVE');
  let off = 12, fmt = null, data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { channels: buf.readUInt16LE(off + 10), sampleRate: buf.readUInt32LE(off + 12), bits: buf.readUInt16LE(off + 22) };
    if (id === 'data') data = buf.subarray(off + 8, off + 8 + size);
    off += 8 + size + (size % 2);
  }
  if (!fmt || !data || fmt.bits !== 16) throw new Error('expected 16-bit PCM WAV');
  return { ...fmt, data };
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const AUD = join(ROOT, 'public', 'audio');
const LINE_DIR = join(ROOT, 'out', 'vo-lines');
rmSync(LINE_DIR, { recursive: true, force: true });
mkdirSync(LINE_DIR, { recursive: true });

function wavToMonoTrimmed(path, idx, words) {
  const wv = parseWav(readFileSync(path));
  if (wv.sampleRate !== SR) throw new Error('expected 44100 Hz');
  const n = Math.floor(wv.data.length / 2 / wv.channels);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = wv.data.readInt16LE(i * 2 * wv.channels) / 32768;
  const thr = 0.003;
  let a0 = 0, a1 = n - 1;
  while (a0 < n && Math.abs(s[a0]) < thr) a0++;
  while (a1 > a0 && Math.abs(s[a1]) < thr) a1--;
  const trimmed = s.subarray(Math.max(0, a0 - Math.round(0.02 * SR)), Math.min(n, a1 + Math.round(0.06 * SR)));
  if (trimmed.length / SR < words * 0.12) throw new Error(`line ${idx} rendered suspiciously short — inspect ${path}`);
  return trimmed;
}

function renderLineSay(idx, text, rate) {
  const out = join(LINE_DIR, `line${String(idx).padStart(2, '0')}${rate ? '-r' + rate : ''}.wav`);
  const a = ['-v', VOICE, '--data-format=LEI16@44100', '-o', out];
  if (rate) a.push('-r', String(rate));
  a.push(text);
  execFileSync('say', a);
  return wavToMonoTrimmed(out, idx, text.split(/\s+/).length);
}

let EL_VOICE = null;
async function resolveElevenVoice() {
  const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': KEY } });
  if (!r.ok) throw new Error('ElevenLabs /voices failed: HTTP ' + r.status);
  const { voices = [] } = await r.json();
  if (VOICE) {
    const hit = voices.find((v) => v.voice_id === VOICE || v.name.toLowerCase() === VOICE.toLowerCase());
    return hit ? { id: hit.voice_id, name: hit.name } : { id: VOICE, name: VOICE };
  }
  const lbl = (v) => (v.name + ' ' + Object.values(v.labels || {}).join(' ')).toLowerCase();
  const pick =
    voices.find((v) => /india/.test(lbl(v))) ||
    voices.find((v) => /(narrat|news|informative)/.test(lbl(v)) && /female/.test(lbl(v))) ||
    voices.find((v) => /female/.test(lbl(v))) ||
    voices[0];
  if (!pick) throw new Error('no voices on this ElevenLabs account');
  return { id: pick.voice_id, name: pick.name };
}

async function renderLineEleven(idx, text, speed) {
  const base = join(LINE_DIR, `line${String(idx).padStart(2, '0')}${speed !== 1 ? '-s' + speed.toFixed(2) : ''}`);
  const vs = { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true };
  if (speed !== 1) vs.speed = speed;
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE.id}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: EL_MODEL, voice_settings: vs }),
  });
  if (!r.ok) throw new Error('ElevenLabs TTS failed line ' + idx + ': HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
  writeFileSync(base + '.mp3', Buffer.from(await r.arrayBuffer()));
  execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@44100', base + '.mp3', base + '.wav']);
  return wavToMonoTrimmed(base + '.wav', idx, text.split(/\s+/).length);
}

async function renderLine(idx, text, window) {
  let s, dur, note = '';
  if (ENGINE === 'elevenlabs') {
    s = await renderLineEleven(idx, text, 1);
    dur = s.length / SR;
    if (dur > window * 1.03) {
      const speed = Math.round(Math.min(1.2, Math.max(1.05, dur / (window * 0.95))) * 100) / 100;
      s = await renderLineEleven(idx, text, speed);
      dur = s.length / SR;
      note = ` (speed ${speed.toFixed(2)})`;
    }
  } else {
    let rate = 0;
    s = renderLineSay(idx, text, 0);
    dur = s.length / SR;
    while (dur > window * 1.03 && rate < 215) {
      const next = Math.min(215, Math.ceil((rate || 178) * (dur / (window * 0.95))));
      if (next === rate) break;
      rate = next;
      s = renderLineSay(idx, text, rate);
      dur = s.length / SR;
    }
    if (rate) note = ` (rate ${rate})`;
  }
  // VO channel strip
  s = Float32Array.from(s);
  biquad(s, highpass(90, 0.707, SR));
  biquad(s, peaking(4000, 0.9, 3.0, SR));
  biquad(s, highshelf(10000, 0.707, 1.5, SR));
  compress(s, -18, 3, 0.004, 0.09, SR);
  console.log(`  line ${idx}: ${dur.toFixed(2)}s / ${window.toFixed(2)}s window${note}  "${text.slice(0, 48)}"`);
  return s;
}

function mixInto(bedPath, outPath, lines, takes) {
  const music = parseWav(readFileSync(bedPath));
  if (music.channels !== 2) throw new Error('bed is not stereo');
  const N = music.data.length / 4;
  const L = new Float32Array(N), R = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    L[i] = music.data.readInt16LE(i * 4) / 32768;
    R[i] = music.data.readInt16LE(i * 4 + 2) / 32768;
  }
  const VO_GAIN = 0.95, FADE = Math.round(0.008 * SR);
  lines.forEach((ln, li) => {
    const s = takes[li];
    let rms0 = segRms(s, 0, s.length), pk = 0;
    for (let i = 0; i < s.length; i++) pk = Math.max(pk, Math.abs(s[i]));
    const g = Math.min(0.22 / Math.max(rms0, 1e-6), 0.97 / Math.max(pk, 1e-6));
    const start = Math.round(ln.at * SR);
    // deepen the bed under the line beyond the baked duck
    const dip = 0.62, aN = Math.round(0.1 * SR), rN = Math.round(0.45 * SR);
    const d0 = Math.max(0, start - Math.round(0.05 * SR)), d1 = Math.min(N, start + s.length + Math.round(0.1 * SR));
    for (let i = d0; i < Math.min(N, d1 + rN); i++) {
      let e = 1;
      if (i < d0 + aN) e = (i - d0) / aN;
      else if (i >= d1) e = 1 - (i - d1) / rN;
      e = Math.max(0, Math.min(1, e));
      const gd = 1 - (1 - dip) * e;
      L[i] *= gd;
      R[i] *= gd;
    }
    for (let i = 0; i < s.length && start + i < N; i++) {
      const env = Math.min(1, i / FADE, (s.length - i) / FADE);
      const v = s[i] * g * VO_GAIN * env;
      L[start + i] += v;
      R[start + i] += v;
    }
  });
  // master to −14 LUFS, −1 dBFS ceiling
  const TARGET = -14, CEIL = Math.pow(10, -1 / 20);
  const lin = integratedLufs(L, R, SR);
  const mg = Math.pow(10, Math.min(12, Math.max(-12, TARGET - lin)) / 20);
  for (let i = 0; i < N; i++) {
    L[i] *= mg;
    R[i] *= mg;
  }
  limit(L, R, CEIL, SR);
  const lout = integratedLufs(L, R, SR);
  const data = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    data.writeInt16LE(Math.round(L[i] * 32767), i * 4);
    data.writeInt16LE(Math.round(R[i] * 32767), i * 4 + 2);
  }
  const hdr = Buffer.alloc(44);
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8);
  hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20);
  hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28);
  hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34);
  hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
  writeFileSync(outPath, Buffer.concat([hdr, data]));
  console.log(`wrote ${outPath} — ${lin.toFixed(1)} → ${lout.toFixed(1)} LUFS (target ${TARGET})`);
}

if (ENGINE === 'elevenlabs') {
  if (!KEY) {
    console.error('no ElevenLabs key');
    process.exit(1);
  }
  EL_VOICE = await resolveElevenVoice();
  console.log(`engine: elevenlabs — voice ${EL_VOICE.name} (${EL_VOICE.id}), model ${EL_MODEL}`);
} else {
  console.log(`engine: say — voice ${VOICE}`);
}

console.log('30 s lines:');
const takes30 = [];
for (const [li, ln] of LINES30.entries()) takes30.push(await renderLine(li, ln.text, ln.until - ln.at - 0.1));
console.log('15 s lines:');
const takes15 = [];
for (const [li, ln] of LINES15.entries()) {
  if (ln.reuse !== undefined) {
    takes15.push(takes30[ln.reuse]);
    console.log(`  line ${li}: reused 30s take ${ln.reuse}`);
  } else {
    takes15.push(await renderLine(`15-${li}`, ln.text, ln.until - ln.at - 0.1));
  }
}

mixInto(join(AUD, 'music-30.wav'), join(AUD, 'soundtrack-30.wav'), LINES30, takes30);
mixInto(join(AUD, 'music-15.wav'), join(AUD, 'soundtrack-15.wav'), LINES15, takes15);
