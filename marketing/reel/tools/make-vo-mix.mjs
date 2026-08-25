#!/usr/bin/env node
// Records the reel's 11 voice-over lines, lays them at their cue times over
// assets/music.wav (which already ducks under each line), and writes the full
// commercial soundtrack to assets/vo-mix.wav.
//
//   node marketing/reel/tools/make-vo-mix.mjs [--engine elevenlabs|say] [--voice <name>]
//
// Engines:
//   elevenlabs — studio-grade neural TTS (default when a key is present).
//     Key: ELEVENLABS_API_KEY env var or ~/.elevenlabs_key. Picks an
//     Indian-English voice from the account's voice list unless --voice
//     names one (by name or voice id). --model overrides the model id
//     (default eleven_multilingual_v2). Lines that overrun their scene
//     window are re-rendered slightly faster via the API's speed setting.
//   say — macOS TTS fallback (--voice defaults to Tara). Overruns are
//     re-rendered at a higher wpm rate.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

function segRms(buf, start, len) {
  let acc = 0, n = 0;
  for (let i = start; i < Math.min(buf.length, start + len); i++, n++) acc += buf[i] * buf[i];
  return n ? Math.sqrt(acc / n) : 0;
}

// ── Studio chain DSP ────────────────────────────────────────────────────────
// RBJ-cookbook biquads, applied in place.
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
  const w = 2 * Math.PI * f0 / sr, cw = Math.cos(w), al = Math.sin(w) / (2 * Q), a0 = 1 + al;
  return { b0: (1 + cw) / 2 / a0, b1: -(1 + cw) / a0, b2: (1 + cw) / 2 / a0, a1: -2 * cw / a0, a2: (1 - al) / a0 };
}
function peaking(f0, Q, dB, sr) {
  const A = Math.pow(10, dB / 40), w = 2 * Math.PI * f0 / sr, cw = Math.cos(w), al = Math.sin(w) / (2 * Q), a0 = 1 + al / A;
  return { b0: (1 + al * A) / a0, b1: -2 * cw / a0, b2: (1 - al * A) / a0, a1: -2 * cw / a0, a2: (1 - al / A) / a0 };
}
function highshelf(f0, Q, dB, sr) {
  const A = Math.pow(10, dB / 40), w = 2 * Math.PI * f0 / sr, cw = Math.cos(w), al = Math.sin(w) / (2 * Q);
  const s = 2 * Math.sqrt(A) * al, a0 = (A + 1) - (A - 1) * cw + s;
  return { b0: A * ((A + 1) + (A - 1) * cw + s) / a0, b1: -2 * A * ((A - 1) + (A + 1) * cw) / a0,
    b2: A * ((A + 1) + (A - 1) * cw - s) / a0, a1: 2 * ((A - 1) - (A + 1) * cw) / a0, a2: ((A + 1) - (A - 1) * cw - s) / a0 };
}
// Feed-forward compressor on a peak envelope (attack/release in seconds).
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
// Approximate BS.1770 integrated loudness: K-weighting (pre-shelf + RLB
// high-pass) then 400ms blocks with -70 LUFS absolute and -10 LU relative gates.
function integratedLufs(Lc, Rc, sr) {
  const kL = Float32Array.from(Lc), kR = Float32Array.from(Rc);
  for (const ch of [kL, kR]) { biquad(ch, highshelf(1681, 0.707, 3.999, sr)); biquad(ch, highpass(38.135, 0.5, sr)); }
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
// Peak limiter with fast attack / smooth release, hard ceiling.
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

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) =>
  a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : '1'] : []).filter(p => p.length));
const KEY = process.env.ELEVENLABS_API_KEY
  || (existsSync(join(homedir(), '.elevenlabs_key')) ? readFileSync(join(homedir(), '.elevenlabs_key'), 'utf8').trim() : '');
const ENGINE = args.engine || (KEY ? 'elevenlabs' : 'say');
if (ENGINE === 'elevenlabs' && !KEY) {
  console.error('no ElevenLabs key — set ELEVENLABS_API_KEY or write it to ~/.elevenlabs_key');
  process.exit(1);
}
const VOICE = args.voice || (ENGINE === 'say' ? 'Tara' : '');
const EL_MODEL = args.model || 'eleven_multilingual_v2';
const SR = 44100;

// Cue map (OM_SCENES running starts) + the AudioRig offsets from reel.jsx.
const CUE = { Hook: 0, Write: 2.4, Marked: 7.6, Bank: 11.4, Map: 14.0, Band: 16.4,
  Match: 18.6, Exam: 21.4, Kit: 24.0, Price: 29.4, Close: 33.2, End: 36.4 };
const LINES = [
  { at: CUE.Hook + 0.05,  until: CUE.Write + 0.15,  text: 'What if your handwriting, marked itself?' },
  { at: CUE.Write + 0.15, until: CUE.Marked + 0.1,  text: 'A real J E E Advanced integral. Watch it read every symbol, live.' },
  { at: CUE.Marked + 0.1, until: CUE.Bank + 0.1,    text: 'Marked step by step, like a real examiner. Full marks.' },
  { at: CUE.Bank + 0.1,   until: CUE.Map + 0.1,     text: 'Over three lakh J E E style questions.' },
  { at: CUE.Map + 0.1,    until: CUE.Band + 0.1,    text: 'Every topic on the syllabus, mapped.' },
  { at: CUE.Band + 0.1,   until: CUE.Match + 0.1,   text: 'Your J E E percentile? Predicted.' },
  { at: CUE.Match + 0.1,  until: CUE.Exam + 0.1,    text: 'Race your rivals in Match Mode.' },
  { at: CUE.Exam + 0.1,   until: CUE.Kit + 0.1,     text: 'Full mocks. Real marking.' },
  { at: CUE.Kit + 0.1,    until: CUE.Price + 0.1,   text: 'Smart practice, hints, photo answers, rush rounds, streaks, task packs, backups.' },
  { at: CUE.Price + 0.1,  until: CUE.Close + 0.15,  text: 'Two lakhs a year for coaching. This? Nine ninety nine a month.' },
  { at: CUE.Close + 0.15, until: CUE.End - 0.4,     text: 'Pri Learning. Coming soon.' },
];

function parseWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE')
    throw new Error('not a RIFF/WAVE file');
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

const LINE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'export', 'vo-lines');
rmSync(LINE_DIR, { recursive: true, force: true });
mkdirSync(LINE_DIR, { recursive: true });
const RATE_CAP = 215; // above this, TTS pacing stops sounding like an ad read

function wavToMonoTrimmed(path, idx, words) {
  const w = parseWav(readFileSync(path));
  if (w.sampleRate !== SR) throw new Error('expected 44100 Hz, got ' + w.sampleRate);
  // mono float
  const n = Math.floor(w.data.length / 2 / w.channels);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = w.data.readInt16LE(i * 2 * w.channels) / 32768;
  // trim leading/trailing silence below -50 dB
  const thr = 0.003;
  let a0 = 0, a1 = n - 1;
  while (a0 < n && Math.abs(s[a0]) < thr) a0++;
  while (a1 > a0 && Math.abs(s[a1]) < thr) a1--;
  const trimmed = s.subarray(Math.max(0, a0 - Math.round(0.02 * SR)), Math.min(n, a1 + Math.round(0.06 * SR)));
  // sanity floor: a render shorter than ~0.12s per word means the engine truncated
  if (trimmed.length / SR < words * 0.12)
    throw new Error(`line ${idx} rendered suspiciously short (${(trimmed.length / SR).toFixed(2)}s for ${words} words) — inspect ${path}`);
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

let EL_VOICE = null; // {id, name}, resolved once per run
async function resolveElevenVoice() {
  const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': KEY } });
  if (!r.ok) throw new Error('ElevenLabs /voices failed: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const { voices = [] } = await r.json();
  if (VOICE) {
    const hit = voices.find((v) => v.voice_id === VOICE || v.name.toLowerCase() === VOICE.toLowerCase());
    return hit ? { id: hit.voice_id, name: hit.name } : { id: VOICE, name: VOICE }; // raw voice id passthrough
  }
  const lbl = (v) => (v.name + ' ' + Object.values(v.labels || {}).join(' ')).toLowerCase();
  const pick = voices.find((v) => /india/.test(lbl(v)))
    || voices.find((v) => /(narrat|news|informative)/.test(lbl(v)) && /female/.test(lbl(v)))
    || voices.find((v) => /female/.test(lbl(v)))
    || voices[0];
  if (!pick) throw new Error('no voices available on this ElevenLabs account');
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
  if (!r.ok) throw new Error('ElevenLabs TTS failed on line ' + idx + ': HTTP ' + r.status + ' ' + (await r.text()).slice(0, 300));
  writeFileSync(base + '.mp3', Buffer.from(await r.arrayBuffer()));
  execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@44100', base + '.mp3', base + '.wav']);
  return wavToMonoTrimmed(base + '.wav', idx, text.split(/\s+/).length);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const music = parseWav(readFileSync(join(ROOT, 'assets', 'music.wav')));
if (music.channels !== 2) throw new Error('music.wav is not stereo');
const N = music.data.length / 4;
const L = new Float32Array(N), R = new Float32Array(N);
for (let i = 0; i < N; i++) { L[i] = music.data.readInt16LE(i * 4) / 32768; R[i] = music.data.readInt16LE(i * 4 + 2) / 32768; }

const VO_GAIN = 0.95, FADE = Math.round(0.008 * SR);
if (ENGINE === 'elevenlabs') {
  EL_VOICE = await resolveElevenVoice();
  console.log(`engine: elevenlabs — voice ${EL_VOICE.name} (${EL_VOICE.id}), model ${EL_MODEL}`);
} else {
  console.log(`engine: say — voice ${VOICE}`);
}
for (const [li, ln] of LINES.entries()) {
  const window = ln.until - ln.at - 0.12;
  let s, dur, fitNote = '';
  if (ENGINE === 'elevenlabs') {
    s = await renderLineEleven(li, ln.text, 1); dur = s.length / SR;
    if (dur > window * 1.03) {
      const speed = Math.round(Math.min(1.2, Math.max(1.05, dur / (window * 0.95))) * 100) / 100;
      s = await renderLineEleven(li, ln.text, speed); dur = s.length / SR;
      fitNote = `  (speed ${speed.toFixed(2)})`;
    }
  } else {
    let rate = 0;
    s = renderLineSay(li, ln.text, 0); dur = s.length / SR;
    while (dur > window * 1.03 && rate < RATE_CAP) {
      // aim for 95% of the window; if -r has no effect on this voice, stop escalating
      const next = Math.min(RATE_CAP, Math.ceil((rate || 178) * dur / (window * 0.95)));
      if (next === rate) break;
      rate = next;
      const s2 = renderLineSay(li, ln.text, rate);
      const d2 = s2.length / SR;
      if (d2 > dur * 0.95 && d2 < dur * 1.05 && rate > 190) { console.warn(`  ⚠ voice ignores -r on line ${li}`); s = s2; dur = d2; break; }
      s = s2; dur = d2;
    }
    if (rate) fitNote = `  (rate ${rate})`;
  }
  if (dur > window + 0.3) console.warn(`  ⚠ line ${li} spills ${(dur - window).toFixed(2)}s past its window`);
  // VO channel strip: rumble high-pass, presence lift, a little air, then
  // 3:1 compression so the read sits steady like a produced spot.
  s = Float32Array.from(s);
  biquad(s, highpass(90, 0.707, SR));
  biquad(s, peaking(4000, 0.9, 3.0, SR));
  biquad(s, highshelf(10000, 0.707, 1.5, SR));
  compress(s, -18, 3, 0.004, 0.09, SR);
  // Normalize the line to a consistent broadcast-style level (~-13 dBFS RMS,
  // peak-capped), so every line sits identically in the mix.
  let rms0 = segRms(s, 0, s.length), pk = 0;
  for (let i = 0; i < s.length; i++) pk = Math.max(pk, Math.abs(s[i]));
  const g = Math.min(0.22 / Math.max(rms0, 1e-6), 0.97 / Math.max(pk, 1e-6));
  const start = Math.round(ln.at * SR);
  // Deepen the bed under the line beyond the baked duck: ×0.5 with a 0.1s
  // attack and 0.45s release, so the voice reads clearly on top.
  const dip = 0.5, aN = Math.round(0.1 * SR), rN = Math.round(0.45 * SR);
  const d0 = Math.max(0, start - Math.round(0.05 * SR)), d1 = Math.min(N, start + s.length + Math.round(0.1 * SR));
  for (let i = d0 - 0; i < Math.min(N, d1 + rN); i++) {
    let e = 1;
    if (i < d0 + aN) e = (i - d0) / aN;
    else if (i >= d1) e = 1 - (i - d1) / rN;
    e = Math.max(0, Math.min(1, e));
    const gd = 1 - (1 - dip) * e;
    L[i] *= gd; R[i] *= gd;
  }
  const musicRms = segRms(L, start, s.length); // the bed as it actually plays under the line
  for (let i = 0; i < s.length && start + i < N; i++) {
    const env = Math.min(1, i / FADE, (s.length - i) / FADE);
    const v = s[i] * g * VO_GAIN * env;
    L[start + i] += v; R[start + i] += v;
  }
  const mixRms = segRms(L, start, s.length);
  const lift = 20 * Math.log10(mixRms / Math.max(musicRms, 1e-6));
  if (lift < 5) console.warn(`  ⚠ line ${li} barely audible over the bed (+${lift.toFixed(1)} dB)`);
  console.log(`  ${ln.at.toFixed(2).padStart(5)}s  ${dur.toFixed(2)}s / ${window.toFixed(2)}s window${fitNote}  +${lift.toFixed(1)} dB over bed  "${ln.text.slice(0, 44)}${ln.text.length > 44 ? '…' : ''}"`);
}

// Master bus: measure integrated loudness (approx BS.1770), master to the
// -14 LUFS streaming standard, and limit with a -1 dBFS ceiling.
const TARGET_LUFS = -14, CEILING = Math.pow(10, -1 / 20);
const lufsIn = integratedLufs(L, R, SR);
const mg = Math.pow(10, Math.min(12, Math.max(-12, TARGET_LUFS - lufsIn)) / 20);
for (let i = 0; i < N; i++) { L[i] *= mg; R[i] *= mg; }
limit(L, R, CEILING, SR);
const lufsOut = integratedLufs(L, R, SR);
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
console.log(`master: ${lufsIn.toFixed(1)} → ${lufsOut.toFixed(1)} LUFS (target ${TARGET_LUFS}), limiter ceiling −1 dBFS`);

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
const out = join(ROOT, 'assets', 'vo-mix.wav');
writeFileSync(out, Buffer.concat([hdr, data]));
console.log(`wrote ${out} — ${(N / SR).toFixed(1)}s, peak ${peak.toFixed(3)} (${(20 * Math.log10(peak)).toFixed(1)} dBFS)`);
