// Interface sounds (owner decision, 18 November 2026): the rules in
// src/lib/sound.js. Synthesised; this suite renders the envelopes as samples
// (the same maths the oscillators run) and drives the player with a fake
// Web Audio, because Node has none. It cannot judge how a sound sounds.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { walkSources } from './sound-walk.mjs';
import { SOUNDS, SOUND_NAMES, soundLength, renderSound, noteGain, soundsEnabled, setSoundsEnabled, createSoundPlayer } from '../src/lib/sound.js';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };

// Off by default; on only by an explicit switch; blocked storage stays off.
const s = mem();
ok(soundsEnabled(s) === false, 'sounds are off by default');
ok(setSoundsEnabled(true, s) === true && soundsEnabled(s) === true, 'a student can switch them on');
ok(setSoundsEnabled(false, s) === false, 'and off again');
const blocked = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
ok(soundsEnabled(blocked) === false && setSoundsEnabled(true, blocked) === false, 'blocked storage stays off and never throws');

// The five sounds, each exactly one named sound.
ok(SOUND_NAMES.join() === 'correct,lookAgain,setDone,tick,read', 'exactly the five sounds');
for (const name of SOUND_NAMES) {
  const len = soundLength(name);
  ok(len > 0 && len <= 0.25, `${name} is under 250 ms (${(len * 1000).toFixed(0)} ms)`);
  const x = renderSound(name, 8000);
  let peak = 0; for (const v of x) peak = Math.max(peak, Math.abs(v));
  ok(peak > 0.01 && peak <= 0.08, `${name} peaks between 0.01 and 0.08 (${peak.toFixed(3)})`);
  ok(Math.abs(x[x.length - 1]) < 0.0001, `${name} ends silent (no click)`);
  ok(Math.abs(x[0]) < 0.0001, `${name} starts silent (no click)`);
  for (const note of SOUNDS[name]) {
    ok(note.f >= 200 && note.f <= 800, `${name} stays in a soft register (${note.f} Hz)`);
    ok(noteGain(note, note.dur - 0.0001) <= note.peak * 0.01, `${name} note decays to near zero`);
  }
}
ok(SOUNDS.correct.length === 2 && SOUNDS.correct[1].f > SOUNDS.correct[0].f, 'checked correct is a two-note rise');
ok(SOUNDS.lookAgain.length === 1 && SOUNDS.lookAgain[0].f <= 260, 'another look is a single low tick');

// A fake Web Audio and document.
function fake({ visible = 'visible', Ctor = true } = {}) {
  const log = { ctx: 0, osc: 0 };
  class AC {
    constructor() { log.ctx += 1; this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    createOscillator() { log.osc += 1; return { frequency: {}, connect() {}, start() {}, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  }
  const listeners = {};
  const doc = { visibilityState: visible, addEventListener: (t, f) => { listeners[t] = f; } };
  const storage = mem();
  return { log, doc, storage, press: () => listeners.pointerdown?.(), env: { AudioContext: Ctor ? AC : undefined, webkitAudioContext: undefined, storage, doc } };
}
{
  const f = fake(); const p = createSoundPlayer(f.env);
  ok(p.play('tick') === false && !p.hasContext() && f.log.ctx === 0, 'off: nothing plays and no AudioContext is created');
  setSoundsEnabled(true, f.storage);
  ok(p.play('tick') === false && f.log.ctx === 0, 'on but no gesture yet: still no AudioContext');
  f.press();
  ok(p.play('correct') === true && f.log.ctx === 1 && f.log.osc === 2, 'on and after a gesture: the two notes of "correct" play');
  p.play('lookAgain');
  ok(f.log.ctx === 1 && f.log.osc === 3, 'one context is reused; "another look" is one oscillator');
  ok(p.play('nonsense') === false, 'an unknown sound is ignored');
}
{
  const f = fake({ visible: 'hidden' }); const p = createSoundPlayer(f.env);
  setSoundsEnabled(true, f.storage); f.press();
  ok(p.play('tick') === false && f.log.ctx === 0, 'nothing plays while the page is hidden');
}
{
  const f = fake({ Ctor: false }); const p = createSoundPlayer(f.env);
  setSoundsEnabled(true, f.storage); f.press();
  ok(p.play('tick') === false, 'without Web Audio it fails silent');
  const bare = createSoundPlayer({ AudioContext: undefined, storage: f.storage, doc: undefined });
  ok(bare.play('tick') === false, 'with neither document nor Web Audio it fails silent');
  class Boom { constructor() { throw new Error('no audio'); } }
  const g = fake(); g.env.AudioContext = Boom; setSoundsEnabled(true, g.storage);
  const q = createSoundPlayer(g.env); g.press();
  ok(q.play('tick') === false, 'a throwing AudioContext fails silent');
}

// Wiring: each event maps to its one sound, at the places the UI already shows it.
const card = read('../src/components/QuestionCard.jsx');
const practice = read('../src/pages/PracticeBase.jsx');
const settings = read('../src/pages/Settings.jsx');
ok(/playSound\(r\.correct === true \? 'correct' : 'lookAgain'\)/.test(card), 'a checked answer plays "correct" or "lookAgain"');
ok(/playSound\('read'\)/.test(card) && /READ_SUCCESS/.test(card), 'a finished handwriting read plays "read"');
ok(/if \(m !== mode\) \{ haptic\('selection'\); playSound\('tick'\); \}/.test(card), 'switching the answer mode ticks');
ok(/playSound\('setDone'\)/.test(practice), 'a finished daily set plays "setDone"');
ok(/setSoundsEnabled\(!on\)/.test(settings) && /data-sounds-switch/.test(settings), 'Settings has the one switch');
for (const f of ['../src/pages/ExamRoom.jsx']) ok(!/sound/i.test(read(f)), `${f} makes no sound`);
for (const f of walkSources('../src/examShell').concat(walkSources('../src/desk'))) ok(!/lib\/sound/.test(read(f)), `${f} does not import sounds`);
ok(!/fetch\(|XMLHttpRequest|import\(/.test(read('../src/lib/sound.js')), 'the module makes no network call');

// Strings.
const en = (await import('../src/i18n/strings.en.js')).default || (await import('../src/i18n/strings.en.js')).strings;
const hi = (await import('../src/i18n/strings.hi.js')).default || (await import('../src/i18n/strings.hi.js')).strings;
for (const k of ['sounds.title', 'sounds.label', 'sounds.note', 'sounds.on', 'sounds.off']) ok(en?.[k] && hi?.[k], `${k} exists in English and Hindi`);

console.log(`SOUNDS: PASS — ${n}/${n} checks`);
