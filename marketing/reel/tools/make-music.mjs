#!/usr/bin/env node
// Renders marketing/reel/assets/music.wav — the reel's 36.4s soundtrack.
// Deterministic (seeded), zero dependencies. Cue map mirrors OM_SCENES in
// index.html; VO ducking is baked in at each voice-over line's start, so the
// exported video needs no runtime mixing.
//
//   node marketing/reel/tools/make-music.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const DUR = 36.4;
const N = Math.round(SR * DUR);

// Cue map — running starts of the OM_SCENES sections.
const CUE = { Hook: 0, Write: 2.4, Marked: 7.6, Bank: 11.4, Map: 14.0, Band: 16.4,
  Match: 18.6, Exam: 21.4, Kit: 24.0, Price: 29.4, Close: 33.2, End: DUR };

// Note frequencies (Hz).
const F = { D2: 73.42, G2: 98.0, A2: 110.0, Bb2: 116.54, C3: 130.81, D3: 146.83,
  E3: 164.81, F3: 174.61, Fs3: 185.0, G3: 196.0, A3: 220.0, Bb3: 233.08,
  C4: 261.63, D4: 293.66, F4: 349.23, A4: 440.0 };

// One pad chord per section, D-minor palette resolving to D major at the close.
const SECTIONS = [
  { at: CUE.Hook,   chord: [F.D2, F.D3, F.F3, F.A3],          pad: 0.30, pulse: 0.00 },
  { at: CUE.Write,  chord: [F.D2, F.D3, F.F3, F.A3, F.E3],    pad: 0.34, pulse: 0.42 },
  { at: CUE.Marked, chord: [F.Bb2, F.D3, F.F3, F.Bb3],        pad: 0.36, pulse: 0.46 },
  { at: CUE.Bank,   chord: [F.F3 / 2, F.C3, F.F3, F.A3],      pad: 0.38, pulse: 0.52 },
  { at: CUE.Map,    chord: [F.G2, F.D3, F.G3, F.Bb3, F.A4],   pad: 0.34, pulse: 0.36 },
  { at: CUE.Band,   chord: [F.C3, F.E3, F.G3, F.C4],          pad: 0.38, pulse: 0.44 },
  { at: CUE.Match,  chord: [F.D2, F.D3, F.F3, F.A3, F.D4],    pad: 0.36, pulse: 0.72 },
  { at: CUE.Exam,   chord: [F.Bb2, F.D3, F.F3, F.Bb3],        pad: 0.36, pulse: 0.50 },
  { at: CUE.Kit,    chord: [F.F3 / 2, F.C3, F.F3, F.A3, F.C4],pad: 0.36, pulse: 0.66 },
  { at: CUE.Price,  chord: [F.G2, F.D3, F.G3, F.Bb3],         pad: 0.38, pulse: 0.55 },
  { at: CUE.Close,  chord: [F.D2, F.A2, F.D3, F.Fs3, F.A3],   pad: 0.42, pulse: 0.00 },
];
const XFADE = 1.0; // seconds of chord crossfade at each boundary

// VO line starts (cue + offset used in reel.jsx AudioRig) → duck windows.
const DUCKS = [
  { at: 0.05, hold: 2.0 }, { at: CUE.Write + 0.15, hold: 3.4 },
  { at: CUE.Marked + 0.1, hold: 2.8 }, { at: CUE.Bank + 0.1, hold: 2.0 },
  { at: CUE.Map + 0.1, hold: 1.9 }, { at: CUE.Band + 0.1, hold: 1.8 },
  { at: CUE.Match + 0.1, hold: 1.8 }, { at: CUE.Exam + 0.1, hold: 1.6 },
  { at: CUE.Kit + 0.1, hold: 4.4 }, { at: CUE.Price + 0.1, hold: 3.2 },
  { at: CUE.Close + 0.15, hold: 2.0 },
];
const DUCK_DEPTH = 0.55, DUCK_ATT = 0.12, DUCK_REL = 0.7;

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rand = mulberry32(19);

const L = new Float64Array(N), R = new Float64Array(N);
const TAU = Math.PI * 2;

// ── Pad + drone (per-sample, crossfaded chords) ─────────────────────────────
function sectionAt(t) {
  let i = SECTIONS.length - 1;
  for (let k = 0; k < SECTIONS.length; k++) if (t >= SECTIONS[k].at) i = k;
  return i;
}
{
  // Per-tone phase accumulators, keyed per section tone so phases stay smooth.
  const phases = SECTIONS.map(s => s.chord.map(() => [rand() * TAU, rand() * TAU]));
  for (let n = 0; n < N; n++) {
    const t = n / SR;
    const si = sectionAt(t);
    const cur = SECTIONS[si];
    const into = t - cur.at;
    const xin = Math.min(1, into / XFADE);          // fade this chord in
    const lfo = 0.9 + 0.1 * Math.sin(TAU * 0.09 * t);
    let l = 0, r = 0;
    for (let pass = 0; pass < 2; pass++) {
      const s = pass === 0 ? cur : (si > 0 ? SECTIONS[si - 1] : null);
      if (!s) continue;
      const g = (pass === 0 ? xin : 1 - xin) * s.pad;
      if (g <= 0.0005) continue;
      for (let c = 0; c < s.chord.length; c++) {
        const f = s.chord[c];
        const ph = phases[pass === 0 ? si : si - 1][c];
        ph[0] += TAU * (f * 0.9995) / SR;
        ph[1] += TAU * (f * 1.0005) / SR;
        const w = (Math.sin(ph[0]) + 0.35 * Math.sin(2 * ph[0])) * 0.5;
        const w2 = (Math.sin(ph[1]) + 0.35 * Math.sin(2 * ph[1])) * 0.5;
        const tone = g * lfo / s.chord.length;
        l += w * tone; r += w2 * tone;
      }
    }
    // Root drone an octave under everything, centered.
    const drone = 0.16 * Math.sin(TAU * F.D2 * 0.5 * t) * (0.85 + 0.15 * Math.sin(TAU * 0.06 * t));
    L[n] += l + drone; R[n] += r + drone;
  }
}

// ── Event renderers ─────────────────────────────────────────────────────────
function pluck(at, freq, gain, pan, decay = 0.42) {
  const start = Math.max(0, Math.round(at * SR));
  const len = Math.min(N - start, Math.round(decay * 3 * SR));
  const gl = gain * (1 - pan) / 2 + gain / 2, gr = gain * (1 + pan) / 2 + gain / 2;
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const env = Math.exp(-t / decay) * Math.min(1, t / 0.004);
    const w = Math.sin(TAU * freq * t) + 0.4 * Math.sin(TAU * freq * 2 * t) * Math.exp(-t / (decay * 0.4));
    L[start + k] += w * env * gl * 0.5; R[start + k] += w * env * gr * 0.5;
  }
}
function bell(at, freq, gain) {
  const start = Math.max(0, Math.round(at * SR));
  const len = Math.min(N - start, Math.round(1.4 * SR));
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const env = Math.exp(-t / 0.5) * Math.min(1, t / 0.002);
    const w = Math.sin(TAU * freq * t) + 0.5 * Math.sin(TAU * freq * 2.76 * t) * Math.exp(-t / 0.18);
    L[start + k] += w * env * gain * 0.5; R[start + k] += w * env * gain * 0.5;
  }
}
function boom(at, gain) {
  const start = Math.max(0, Math.round(at * SR));
  const len = Math.min(N - start, Math.round(1.1 * SR));
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const f = 68 * Math.exp(-t * 2.2) + 34;
    const env = Math.exp(-t / 0.4) * Math.min(1, t / 0.003);
    const w = Math.sin(TAU * f * t);
    L[start + k] += w * env * gain; R[start + k] += w * env * gain;
  }
}
function riser(endAt, dur, gain) {
  const start = Math.max(0, Math.round((endAt - dur) * SR));
  const len = Math.min(N - start, Math.round(dur * SR));
  let lp = 0;
  for (let k = 0; k < len; k++) {
    const p = k / len;
    const noise = rand() * 2 - 1;
    lp += (noise - lp) * (0.02 + 0.3 * p * p); // opening lowpass
    const env = p * p * gain;
    L[start + k] += lp * env; R[start + k] += lp * env;
  }
}

// Pulse: eighth-note pluck grid from Write to Close, root/fifth/octave figure.
{
  const EI = 0.325;
  const FIGURE = [0, 1.5, 1, 1.5, 2, 1.5, 1, 1.5]; // multiples of the section root
  let step = 0;
  for (let t = CUE.Write; t < CUE.Close - 0.2; t += EI, step++) {
    const s = SECTIONS[sectionAt(t + 0.001)];
    if (s.pulse <= 0) continue;
    const root = s.chord[0] * 2; // an octave above the chord bass
    const mult = FIGURE[step % FIGURE.length];
    const freq = mult === 0 ? root : root * mult;
    const accent = step % 4 === 0 ? 1 : 0.72;
    pluck(t, freq, 0.16 * s.pulse * accent, (step % 2 === 0 ? -0.25 : 0.25));
  }
}

// Section accents: a soft high ping at every cue, booms under the flash frames.
for (const s of SECTIONS.slice(1)) bell(s.at, s.chord[s.chord.length - 1] * 4, 0.05);
boom(CUE.Bank, 0.5); boom(CUE.Price, 0.5); boom(CUE.Close, 0.38);
riser(CUE.Bank, 1.3, 0.10); riser(CUE.Price, 1.5, 0.12); riser(CUE.Match, 1.1, 0.07);

// ── Master: duck under VO, fade edges, soft-clip, normalize ─────────────────
function duckGain(t) {
  let g = 1;
  for (const d of DUCKS) {
    const a = d.at, h = d.hold;
    let e = 0;
    if (t >= a && t < a + DUCK_ATT) e = (t - a) / DUCK_ATT;
    else if (t >= a + DUCK_ATT && t < a + h) e = 1;
    else if (t >= a + h && t < a + h + DUCK_REL) e = 1 - (t - a - h) / DUCK_REL;
    g = Math.min(g, 1 - (1 - DUCK_DEPTH) * e);
  }
  return g;
}
let peak = 0;
for (let n = 0; n < N; n++) {
  const t = n / SR;
  const fadeIn = Math.min(1, t / 0.35);
  const fadeOut = Math.min(1, Math.max(0, (DUR - t) / 1.0));
  const g = duckGain(t) * fadeIn * fadeOut;
  L[n] = Math.tanh(L[n] * g * 1.4);
  R[n] = Math.tanh(R[n] * g * 1.4);
  peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
}
const norm = peak > 0 ? 0.86 / peak : 1;

// ── WAV out (16-bit PCM stereo) ─────────────────────────────────────────────
const data = Buffer.alloc(N * 4);
for (let n = 0; n < N; n++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[n] * norm)) * 32767), n * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[n] * norm)) * 32767), n * 4 + 2);
}
const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8);
hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20);
hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28);
hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34);
hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'music.wav');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.concat([hdr, data]));
console.log(`wrote ${out} — ${DUR}s, ${((44 + data.length) / 1e6).toFixed(1)} MB, peak-normalized to ${(0.86).toFixed(2)}`);
