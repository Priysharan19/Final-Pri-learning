// Interface sounds (owner decision, 18 November 2026). Optional, quiet, off by
// default, kept on this device only. Synthesised with the Web Audio API from
// sine oscillators and gain envelopes: there is no audio file, no network call
// and no dependency. A sound only ever accompanies a state that is already
// shown and announced; it is never the only signal for anything.
//
// Rules this module keeps (pinned by test/sound-check.mjs):
//   - off unless the student switched it on in Settings (reduced motion is a
//     further reason to stay off: it never turns sound on by itself);
//   - no AudioContext exists until sounds are on AND the student has already
//     pressed, tapped or typed (autoplay rules);
//   - nothing plays while the page is hidden;
//   - without Web Audio (native shells, old browsers) it fails silent.
const KEY = 'pri.sounds';

// One note = a sine at `f` Hz starting `at` s, lasting `dur` s, reaching `peak`
// after `attack` s and decaying exponentially to peak/1000 at the end.
// Every sound is under 250 ms and every peak at or under 0.05 (-26 dBFS).
export const SOUNDS = Object.freeze({
  // A line or answer checked correct: a soft two-note rise (C5, then E5).
  correct: Object.freeze([
    Object.freeze({ f: 523.25, at: 0, dur: 0.12, peak: 0.04, attack: 0.008 }),
    Object.freeze({ f: 659.25, at: 0.08, dur: 0.16, peak: 0.04, attack: 0.008 })
  ]),
  // Needs another look: one low, soft tick. Never a buzzer.
  lookAgain: Object.freeze([Object.freeze({ f: 220, at: 0, dur: 0.14, peak: 0.035, attack: 0.01 })]),
  // A set finished: a settled fifth (G4 over D5), a touch longer.
  setDone: Object.freeze([
    Object.freeze({ f: 392, at: 0, dur: 0.22, peak: 0.03, attack: 0.012 }),
    Object.freeze({ f: 587.33, at: 0.05, dur: 0.19, peak: 0.03, attack: 0.012 })
  ]),
  // A button or toggle tick.
  tick: Object.freeze([Object.freeze({ f: 660, at: 0, dur: 0.045, peak: 0.02, attack: 0.004 })]),
  // Handwriting read complete: one gentle note (F#5).
  read: Object.freeze([Object.freeze({ f: 739.99, at: 0, dur: 0.12, peak: 0.03, attack: 0.008 })])
});
export const SOUND_NAMES = Object.freeze(Object.keys(SOUNDS));
export const soundLength = name => Math.max(...SOUNDS[name].map(n => n.at + n.dur));

/** The gain of one note at time t seconds from its own start. */
export function noteGain(note, t) {
  if (t < 0 || t >= note.dur) return 0;
  if (t < note.attack) return note.peak * (t / note.attack);
  return note.peak * Math.pow(0.001, (t - note.attack) / (note.dur - note.attack));
}

/** The samples a sound produces (pure; the same maths the oscillators run). */
export function renderSound(name, rate = 8000) {
  const notes = SOUNDS[name];
  const out = new Float32Array(Math.ceil(soundLength(name) * rate) + 1);
  for (let i = 0; i < out.length; i += 1) {
    const t = i / rate;
    let s = 0;
    for (const n of notes) s += noteGain(n, t - n.at) * Math.sin(2 * Math.PI * n.f * (t - n.at));
    out[i] = s;
  }
  return out;
}

export function soundsEnabled(storage = globalThis.localStorage) {
  try { return storage?.getItem(KEY) === 'on'; } catch { return false; }
}
export function setSoundsEnabled(on, storage = globalThis.localStorage) {
  try { if (on) storage?.setItem(KEY, 'on'); else storage?.removeItem(KEY); } catch { /* a private window keeps the default: off */ }
  return soundsEnabled(storage);
}

/**
 * A player over an environment, so tests can inject one. `env.AudioContext` is
 * the constructor (or undefined), `env.storage` the device store, `env.doc` the
 * document (for visibility and the first gesture).
 */
export function createSoundPlayer(env = {}) {
  const get = k => (k in env ? env[k] : globalThis[k === 'doc' ? 'document' : k]);
  let ctx = null;
  let gesture = false;
  let listening = false;
  const onGesture = () => { gesture = true; };
  const listen = () => {
    const doc = get('doc');
    if (listening || !doc?.addEventListener) return;
    listening = true;
    for (const type of ['pointerdown', 'keydown', 'touchend']) doc.addEventListener(type, onGesture, { capture: true, passive: true });
  };
  // Listening starts at once so a press before the switch is not lost, but it
  // is a flag only: nothing audio-related is created.
  listen();

  function play(name) {
    try {
      const notes = SOUNDS[name];
      if (!notes || !soundsEnabled(get('storage'))) return false;
      listen();
      if (!gesture) return false;
      const doc = get('doc');
      if (doc && doc.visibilityState === 'hidden') return false;
      const Ctor = get('AudioContext') || get('webkitAudioContext');
      if (typeof Ctor !== 'function') return false;
      if (!ctx) ctx = new Ctor();
      if (ctx.state === 'suspended') void ctx.resume?.()?.catch?.(() => {});
      const t0 = ctx.currentTime;
      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = n.f;
        gain.gain.setValueAtTime(0.00001, t0 + n.at);
        gain.gain.linearRampToValueAtTime(n.peak, t0 + n.at + n.attack);
        gain.gain.exponentialRampToValueAtTime(n.peak * 0.001, t0 + n.at + n.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0 + n.at);
        osc.stop(t0 + n.at + n.dur + 0.02);
      }
      return true;
    } catch { return false; }
  }
  return { play, hasContext: () => ctx !== null, gestureSeen: () => gesture };
}

const shared = createSoundPlayer();
/** Play a named sound if the student has switched sounds on. Never throws. */
export const playSound = name => shared.play(name);
