// Practice question clock (the intermittent "question clock runs" check in
// tour-instrument). Replays the clock's schedule on a simulated wall clock with
// timer jitter and late ticks, without a browser.
//
// Before: a free-running 1 s setInterval, started in the same commit that fixed
// the start time, captured Date.now() at each tick. Its ticks sat within a
// millisecond or two of each whole-second boundary of elapsed time, so jitter
// alone decided whether a tick showed k or k−1 — seconds repeated and skipped,
// and a repeat followed by one late tick held the text for over 2.1 s.
// After: the text is derived from the wall clock at render, and each tick is
// aimed a margin past the next boundary, so every tick that fires moves it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clockText, msToNextSecond, CLOCK_TICK_MARGIN_MS } from '../src/instrument/questionClock.js';

let pass = 0;
const ok = (name, fn) => { fn(); pass++; console.log(`  ✓ ${name}`); };

// Deterministic pseudo-random lateness in [0, max) ms.
const lcg = seed => () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);

// The fixed scheduler: returns the text shown after each tick (render reads the
// wall clock, possibly renderDelay ms after the timer fired).
const runFixed = ({ start, ticks, late, renderDelay = () => 0 }) => {
  const shown = [];
  let now = start;
  for (let i = 0; i < ticks; i++) {
    now += msToNextSecond(now - start) + late(i);   // timer fires, maybe late
    const renderAt = now + renderDelay(i);           // render may be later still
    shown.push({ at: renderAt, text: clockText(renderAt - start) });
    now = renderAt;
  }
  return shown;
};

// The old scheduler, for contrast: interval phase δ ms before the start time.
const runInterval = ({ start, delta, ticks, late }) => {
  const shown = [];
  for (let k = 1; k <= ticks; k++) { const at = start - delta + 1000 * k + late(k); shown.push({ at, text: clockText(at - start) }); }
  return shown;
};

ok('clockText is mm:ss of whole elapsed seconds, never negative', () => {
  assert.equal(clockText(0), '00:00'); assert.equal(clockText(999), '00:00'); assert.equal(clockText(1000), '00:01');
  assert.equal(clockText(61_500), '01:01'); assert.equal(clockText(-40), '00:00'); assert.equal(clockText(NaN), '00:00');
});

ok('the next tick is aimed a margin past the next whole second', () => {
  for (const e of [0, 1, 500, 999, 1000, 1049, 1050, 4321]) {
    const d = msToNextSecond(e); const landed = e + d;
    assert.equal(landed % 1000, CLOCK_TICK_MARGIN_MS, `elapsed ${e}`);
    assert.ok(d > CLOCK_TICK_MARGIN_MS && d <= 1000 + CLOCK_TICK_MARGIN_MS);
  }
});

ok('the old interval repeats and skips seconds under ordinary jitter (the race)', () => {
  const r = lcg(7); const shown = runInterval({ start: 10_000, delta: 1, ticks: 40, late: () => Math.floor(r() * 3) });
  const texts = shown.map(s => s.text);
  assert.ok(texts.some((t, i) => i && t === texts[i - 1]), 'expected a repeated second');
});

ok('fixed: every tick moves the clock, and it always shows the true elapsed time', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const r = lcg(seed); const start = 1_700_000_000_000 + seed * 37;
    const shown = runFixed({ start, ticks: 30, late: () => Math.floor(r() * 900), renderDelay: () => Math.floor(r() * 80) });
    shown.forEach((s, i) => {
      assert.equal(s.text, clockText(s.at - start));
      if (i) assert.notEqual(s.text, shown[i - 1].text, `seed ${seed}: tick ${i} repeated ${s.text}`);
    });
  }
});

ok('fixed: a late tick shows the time it renders at, not the time it was due', () => {
  const start = 50_000; const shown = runFixed({ start, ticks: 3, late: i => (i === 1 ? 2_700 : 0) });
  assert.equal(shown[1].text, clockText(shown[1].at - start));
  assert.equal(shown[1].text, '00:04');
});

ok('fixed: the tour window (read, wait 2.1 s, read) always sees the clock move', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const r = lcg(seed * 13); const start = 0;
    const shown = runFixed({ start, ticks: 20, late: () => Math.floor(r() * 900) });
    const textAt = t => { let v = clockText(0); for (const s of shown) if (s.at <= t) v = s.text; return v; };
    for (let t0 = 0; t0 < 10_000; t0 += 37) assert.notEqual(textAt(t0 + 2100), textAt(t0), `seed ${seed} t0 ${t0}`);
  }
});

ok('QuestionHead derives the time at render and has no free-running interval', () => {
  const src = readFileSync(new URL('../src/instrument/QuestionHead.jsx', import.meta.url), 'utf8');
  assert.ok(!/setInterval\s*\(/.test(src), 'QuestionHead must not tick on setInterval');
  assert.ok(/msToNextSecond\(/.test(src) && /clockText\(now - startedAt\)/.test(src));
  assert.ok(/\[stopped, startedAt\]/.test(src), 'a new start time must re-aim the tick');
});

console.log(`\n${pass} question clock checks passed`);
