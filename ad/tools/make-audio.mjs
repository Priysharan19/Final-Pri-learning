#!/usr/bin/env node
// Deterministic score + sound design for the Pri Learning ad ("The Tangent").
// Zero dependencies. Writes:
//   public/audio/music-30.wav      — 30 s bed (score + SFX, VO ducking baked in)
//   public/audio/music-15.wav      — 15 s bed for the short cut
//   public/audio/soundtrack-30.wav — copy of the bed (make-vo.mjs overwrites with VO mix)
//   public/audio/soundtrack-15.wav
//
// Structure (30 s): a machine that stops, a silence that earns the reveal, a
// bloom that locks at 12.6 s, a ladder that climbs, a resolve that breathes.
// D minor throughout; the close resolves to D major. The dynamic-range moment:
// near-silence 6.5–8.0 before the reveal, full warm hit on the tangent lock.

import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const TAU = Math.PI * 2;

const mulberry32 = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let z = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
  return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
};

// note name → frequency
const NOTE = (n, oct) => 440 * Math.pow(2, (({ C: -9, Db: -8, D: -7, Eb: -6, E: -5, F: -4, Gb: -3, G: -2, Ab: -1, A: 0, Bb: 1, B: 2 })[n] + (oct - 4) * 12) / 12);

class Mix {
  constructor(dur) {
    this.N = Math.round(dur * SR);
    this.L = new Float32Array(this.N);
    this.R = new Float32Array(this.N);
  }
  add(at, samples, gain = 1, pan = 0) {
    const s0 = Math.round(at * SR);
    const gl = gain * Math.min(1, 1 - pan);
    const gr = gain * Math.min(1, 1 + pan);
    for (let i = 0; i < samples.length; i++) {
      const j = s0 + i;
      if (j < 0 || j >= this.N) continue;
      this.L[j] += samples[i] * gl;
      this.R[j] += samples[i] * gr;
    }
  }
}

// ── voices ─────────────────────────────────────────────────────────────────

/** Warm pad note: detuned saw-ish partials through a soft LP, slow attack. */
const pad = (freq, dur, { attack = 0.8, release = 1.2, bright = 0.5 } = {}) => {
  const n = Math.round((dur + release) * SR);
  const out = new Float32Array(n);
  const detunes = [0.9965, 1, 1.0042];
  for (const d of detunes) {
    let phase = Math.random ? 0 : 0; // deterministic: fixed phase
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      phase += (freq * d) / SR;
      // 3 partials, rolled off
      const v =
        Math.sin(TAU * phase) +
        0.5 * bright * Math.sin(TAU * 2 * phase) +
        0.22 * bright * Math.sin(TAU * 3 * phase);
      out[i] += v / detunes.length / 1.7;
    }
  }
  // envelope
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const a = Math.min(1, t / attack);
    const r = t > dur ? Math.max(0, 1 - (t - dur) / release) : 1;
    out[i] *= a * a * r * r;
  }
  // one-pole low-pass for warmth
  let y = 0;
  const k = 1 - Math.exp((-TAU * (700 + 900 * bright)) / SR);
  for (let i = 0; i < n; i++) {
    y += k * (out[i] - y);
    out[i] = y;
  }
  return out;
};

/** Felt-piano-ish note: sine + soft 2nd partial, fast attack, exp decay. */
const felt = (freq, dur = 2.2) => {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.008) * Math.exp(-t * 2.1);
    out[i] = env * (Math.sin(TAU * freq * t) * 0.8 + Math.sin(TAU * freq * 2.001 * t) * 0.14 * Math.exp(-t * 5));
  }
  return out;
};

/** Deep sub hit. */
const sub = (freq = 42, dur = 1.2) => {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = freq * (1 + 0.9 * Math.exp(-t * 18));
    out[i] = Math.sin(TAU * f * t) * Math.exp(-t * 3.2) * Math.min(1, t / 0.004);
  }
  return out;
};

/** Mechanical tick — filtered noise click, dead and dry. */
const tick = (rng, bright = 1, dur = 0.045) => {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  let y = 0;
  const k = 1 - Math.exp((-TAU * (2600 * bright)) / SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const noise = rng() * 2 - 1;
    y += k * (noise - y);
    out[i] = y * Math.exp(-t * 160) * 1.6;
  }
  return out;
};

/** Stamp thunk — low knock with body. */
const thunk = (rng, dur = 0.22) => {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 92 * (1 + 1.6 * Math.exp(-t * 42));
    out[i] = Math.sin(TAU * f * t) * Math.exp(-t * 22) + (rng() * 2 - 1) * 0.18 * Math.exp(-t * 90);
  }
  return out;
};

/** Pencil tick foley — two quick scratchy clicks. */
const pencil = (rng) => {
  const n = Math.round(0.14 * SR);
  const out = new Float32Array(n);
  for (const off of [0, 0.055]) {
    const s0 = Math.round(off * SR);
    for (let i = 0; i < 0.045 * SR; i++) {
      const t = i / SR;
      out[s0 + i] += (rng() * 2 - 1) * Math.exp(-t * 220) * (0.7 + 0.5 * Math.sin(TAU * 3400 * t));
    }
  }
  return out;
};

/** Riser — filtered noise swelling with rising resonance. */
const riser = (dur, rng) => {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  let y = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const k = 1 - Math.exp((-TAU * (200 + 3400 * t * t)) / SR);
    y += k * ((rng() * 2 - 1) - y);
    out[i] = y * t * t * 0.9;
  }
  // quick fade-out tail so the riser releases into the hit
  for (let i = 0; i < 0.03 * SR && i < n; i++) out[n - 1 - i] *= i / (0.03 * SR);
  return out;
};

/** Shimmer — high sine cluster with slow tremble, for the lock. */
const shimmer = (dur = 2.4) => {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  const fs = [NOTE('D', 6), NOTE('A', 6), NOTE('F', 6)];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.02) * Math.exp(-t * 1.4);
    let v = 0;
    for (const f of fs) v += Math.sin(TAU * f * t + 0.4 * Math.sin(TAU * 5.2 * t));
    out[i] = (v / fs.length) * env * 0.5;
  }
  return out;
};

/** Detune tail for the seize — a note losing power. */
const detuneTail = (freq = NOTE('D', 3), dur = 1.3) => {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = freq * (1 - 0.24 * (t / dur) * (t / dur));
    phase += f / SR;
    out[i] = Math.sin(TAU * phase) * Math.exp(-t * 2.6) * (1 - t / dur);
  }
  return out;
};

// ── score assembly ─────────────────────────────────────────────────────────

const D = (n, o) => NOTE(n, o);

function buildScore({ dur, cues }) {
  const mix = new Mix(dur);
  const rng = mulberry32(19);

  const {
    hook, factoryStart, seize, bloom, lock, ticks, ladderStart, ladderMoves, close, end,
  } = cues;

  // — Hook: sub hit + dark drone
  mix.add(hook + 0.08, sub(40, 1.4), 0.8);
  mix.add(hook, pad(D('D', 2), seize - hook, { attack: 0.4, bright: 0.25 }), 0.24);

  // — Factory: metronomic 16ths + staccato minor pulse + stamps
  for (let t = factoryStart; t < seize - 0.02; t += 0.125) {
    const strong = Math.round((t - factoryStart) / 0.125) % 4 === 0;
    mix.add(t, tick(rng, strong ? 1.25 : 0.8), strong ? 0.34 : 0.13, strong ? 0.12 : -0.12);
  }
  for (let t = factoryStart; t < seize - 0.02; t += 0.5) {
    mix.add(t, thunk(rng), 0.56);
    mix.add(t, felt(D('D', 3), 0.28), 0.2); // dead staccato — no melody, machine
  }
  // dread layer under the sameness
  mix.add(factoryStart + 1.5, pad(D('Bb', 2), seize - factoryStart - 1.5, { attack: 1.4, bright: 0.2 }), 0.16);

  // — Seize: hard stop, detune tail, near-silence (the earned quiet)
  mix.add(seize, detuneTail(), 0.4);
  mix.add(seize, thunk(rng, 0.4), 0.7);

  // — Bloom: pads swell from silence toward the lock
  mix.add(bloom, pad(D('Bb', 2), lock - bloom + 1.5, { attack: 1.6, bright: 0.45 }), 0.3);
  mix.add(bloom + 0.6, pad(D('F', 3), lock - bloom + 1.2, { attack: 1.8, bright: 0.5 }), 0.22);
  // felt motif rising: D F A
  mix.add(bloom + 0.7, felt(D('D', 4)), 0.34);
  mix.add(bloom + 1.7, felt(D('F', 4)), 0.34);
  mix.add(bloom + 2.7, felt(D('A', 4)), 0.36);
  // riser into the lock
  mix.add(lock - 1.1, riser(1.1, rng), 0.32);

  // — LOCK: the loudest, warmest moment
  mix.add(lock, sub(48, 1.6), 1.15);
  for (const [n, o, g] of [['F', 2, 0.54], ['F', 3, 0.46], ['A', 3, 0.4], ['C', 4, 0.35], ['G', 4, 0.19]]) {
    mix.add(lock, pad(D(n, o), 4.6, { attack: 0.012, release: 2.4, bright: 0.6 }), g);
  }
  mix.add(lock, shimmer(), 0.42);
  mix.add(lock + 0.5, felt(D('F', 5)), 0.2);

  // — After the lock: gentle organic pulse under the product
  const pulseStart = lock + 2.4;
  for (let t = pulseStart; t < ladderStart - 0.05; t += 0.5) {
    mix.add(t, felt(D('D', 3), 0.5), 0.16);
    if ((Math.round((t - pulseStart) / 0.5) % 2) === 1) mix.add(t + 0.25, felt(D('A', 3), 0.4), 0.1);
  }
  mix.add(pulseStart - 1.2, pad(D('Bb', 2), ladderStart - pulseStart + 1.4, { attack: 1.2, bright: 0.35 }), 0.2);
  // pencil ticks for the examiner marks + a small "nailed it" chime
  for (const tt of ticks) mix.add(tt, pencil(rng), 0.5);
  if (ticks.length) mix.add(ticks[ticks.length - 1] + 0.3, felt(D('D', 5), 1.2), 0.2);

  // — Ladder: one chord step per station, building
  const ladderChords = [
    ['G', 2, 'G', 3, 'Bb', 3],
    ['Bb', 2, 'Bb', 3, 'D', 4],
    ['C', 3, 'C', 4, 'E', 4],
    ['D', 3, 'D', 4, 'F', 4],
    ['D', 3, 'A', 3, 'D', 4],
  ];
  const stations = [ladderStart, ...ladderMoves];
  stations.forEach((st, i) => {
    const nd = (i < stations.length - 1 ? stations[i + 1] : close) - st + 0.9;
    const ch = ladderChords[Math.min(i, ladderChords.length - 1)];
    for (let k = 0; k < ch.length; k += 2) {
      mix.add(st, pad(D(ch[k], ch[k + 1]), nd, { attack: 0.25, bright: 0.42 + i * 0.05 }), 0.2);
    }
    mix.add(st, felt(D(ch[0], ch[1] + 1), 1.4), 0.24 + i * 0.02);
    // rising eighth figure gains energy up the ladder
    for (let t = st + 0.25; t < (i < stations.length - 1 ? stations[i + 1] : close) - 0.05; t += 0.25) {
      mix.add(t, felt(D(ch[(Math.round(t * 4) % 2) * 2], ch[1] + 1), 0.3), 0.07 + i * 0.02);
    }
  });
  mix.add(close - 1.0, riser(1.0, rng), 0.26);

  // — Close: D major resolve, long decay, silence by end − 0.2
  mix.add(close, sub(36, 1.8), 0.55);
  for (const [n, o, g] of [['D', 2, 0.24], ['D', 3, 0.22], ['A', 3, 0.19], ['Gb', 4, 0.14], ['D', 4, 0.13]]) {
    mix.add(close, pad(D(n, o), end - close - 1.3, { attack: 0.02, release: 1.1, bright: 0.5 }), g);
  }
  mix.add(close + 0.15, felt(D('D', 5), 2.4), 0.2);

  return mix;
}

// ── ducking, master, write ─────────────────────────────────────────────────

function duck(mix, windows, depth = 0.5, att = 0.12, rel = 0.6) {
  const env = new Float32Array(mix.N).fill(1);
  for (const [a, b] of windows) {
    const s0 = Math.max(0, Math.round((a - att) * SR));
    const s1 = Math.min(mix.N, Math.round(b * SR));
    for (let i = s0; i < Math.min(mix.N, s1 + rel * SR); i++) {
      let e = 1;
      const t = i / SR;
      if (t < a) e = (t - (a - att)) / att;
      else if (t > b) e = 1 - (t - b) / rel;
      e = Math.max(0, Math.min(1, e));
      env[i] = Math.min(env[i], 1 - (1 - depth) * e);
    }
  }
  for (let i = 0; i < mix.N; i++) {
    mix.L[i] *= env[i];
    mix.R[i] *= env[i];
  }
}

function master(mix, { fadeIn = 0.05, fadeOut = 0.9, peakTarget = 0.85 } = {}) {
  const { L, R, N } = mix;
  // gentle soft clip for glue
  for (let i = 0; i < N; i++) {
    L[i] = Math.tanh(L[i] * 1.25);
    R[i] = Math.tanh(R[i] * 1.25);
  }
  // fades
  const fi = Math.round(fadeIn * SR);
  const fo = Math.round(fadeOut * SR);
  for (let i = 0; i < fi; i++) {
    L[i] *= i / fi;
    R[i] *= i / fi;
  }
  for (let i = 0; i < fo; i++) {
    L[N - 1 - i] *= i / fo;
    R[N - 1 - i] *= i / fo;
  }
  // peak normalize
  let pk = 0;
  for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
  const g = peakTarget / Math.max(pk, 1e-9);
  for (let i = 0; i < N; i++) {
    L[i] *= g;
    R[i] *= g;
  }
}

function writeWav(path, mix) {
  const { L, R, N } = mix;
  const data = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[i] * 32767))), i * 4);
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[i] * 32767))), i * 4 + 2);
  }
  const hdr = Buffer.alloc(44);
  hdr.write('RIFF', 0);
  hdr.writeUInt32LE(36 + data.length, 4);
  hdr.write('WAVE', 8);
  hdr.write('fmt ', 12);
  hdr.writeUInt32LE(16, 16);
  hdr.writeUInt16LE(1, 20);
  hdr.writeUInt16LE(2, 22);
  hdr.writeUInt32LE(SR, 24);
  hdr.writeUInt32LE(SR * 4, 28);
  hdr.writeUInt16LE(4, 32);
  hdr.writeUInt16LE(16, 34);
  hdr.write('data', 36);
  hdr.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([hdr, data]));
  console.log(`wrote ${path} (${(N / SR).toFixed(1)}s)`);
}

// ── cue maps (must mirror src/data/timeline.ts) ────────────────────────────

const VO30 = [
  [0.15, 1.45], [2.6, 6.3], [6.55, 7.75], [9.0, 11.7], [13.2, 14.9], [15.4, 19.6], [20.8, 26.4], [27.3, 29.3],
];
const VO15 = [
  [0.2, 1.15], [2.55, 3.7], [3.9, 6.5], [8.7, 10.4], [10.7, 12.3], [12.8, 14.5],
];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const AUD = join(ROOT, 'public', 'audio');
mkdirSync(AUD, { recursive: true });

const m30 = buildScore({
  dur: 30,
  cues: {
    hook: 0,
    factoryStart: 1.5,
    seize: 6.5,
    bloom: 8.0,
    lock: 12.6,
    ticks: [18.0, 18.5, 19.0],
    ladderStart: 20.0,
    ladderMoves: [21.0, 22.5, 24.0, 25.5],
    close: 27.0,
    end: 30.0,
  },
});
duck(m30, VO30);
master(m30);
writeWav(join(AUD, 'music-30.wav'), m30);

const m15 = buildScore({
  dur: 15,
  cues: {
    hook: 0,
    factoryStart: 1.0,
    seize: 2.5,
    bloom: 3.5,
    lock: 7.0,
    ticks: [9.5, 9.9, 10.3],
    ladderStart: 10.5,
    ladderMoves: [11.0, 11.5, 12.0],
    close: 12.5,
    end: 15.0,
  },
});
duck(m15, VO15);
master(m15);
writeWav(join(AUD, 'music-15.wav'), m15);

// until make-vo.mjs bakes the VO, the soundtrack IS the bed
copyFileSync(join(AUD, 'music-30.wav'), join(AUD, 'soundtrack-30.wav'));
copyFileSync(join(AUD, 'music-15.wav'), join(AUD, 'soundtrack-15.wav'));
console.log('soundtracks initialised from beds (run make-vo.mjs to bake VO)');
