// The luxury layer's motion vocabulary, ported from the C "Examiner's
// Chronograph" reference (rot, detent, flip, glyph set, row reveal, emboss
// stamp) and A "Spatial" (the plane spring). Everything runs on the Web
// Animations API or one rAF loop, animates transform and opacity only, and
// is interruptible: each call returns a handle whose finish() jumps to the
// final frame. Under Reduce Motion every call lands on its final frame at once.

export const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const EASE = {
  sweep: 'cubic-bezier(.45,0,.2,1)',
  overshoot: 'cubic-bezier(.3,0,.3,1)',
  detent: 'cubic-bezier(.6,0,.2,1.5)',
  flipOut: 'cubic-bezier(.6,0,1,1)',
  flipIn: 'cubic-bezier(0,0,.3,1)',
  set: 'cubic-bezier(.2,.7,.2,1)',
  row: 'cubic-bezier(.2,.8,.2,1)',
  stampIn: 'cubic-bezier(.7,0,.9,.6)',
  stampSettle: 'cubic-bezier(.2,0,.2,1)',
  ring: 'cubic-bezier(.3,0,.2,1)'
};

const done = { finished: Promise.resolve(), finish() {} };
function handle(anims, onEnd) {
  const list = anims.filter(Boolean);
  const finished = Promise.all(list.map(a => a.finished)).then(onEnd, onEnd);
  return { finished, finish() { list.forEach(a => { try { a.finish(); } catch { /* already gone */ } }); } };
}

// Keyframes for a hand sweeping from → to with an overshoot of ov degrees.
export function rotFrames(from, to, ov = 0) {
  return ov
    ? [{ transform: `rotate(${from}deg)`, easing: EASE.sweep }, { transform: `rotate(${to + ov}deg)`, offset: 0.8, easing: EASE.overshoot }, { transform: `rotate(${to - ov * 0.3}deg)`, offset: 0.92 }, { transform: `rotate(${to}deg)` }]
    : [{ transform: `rotate(${from}deg)` }, { transform: `rotate(${to}deg)` }];
}

export function rot(el, from, to, { overshoot = 0, dur = 900, delay = 0, easing } = {}) {
  const end = () => { el.style.transform = `rotate(${to}deg)`; };
  if (reduced()) { end(); return done; }
  const a = el.animate(rotFrames(from, to, overshoot), { duration: dur, delay, easing: overshoot ? 'linear' : (easing || EASE.sweep), fill: 'both' });
  return handle([a], () => { end(); a.cancel(); });
}

export function detent(el, from, to, steps, { dur = steps * 150, delay = 0 } = {}) {
  const end = () => { el.style.transform = `rotate(${to}deg)`; };
  if (reduced() || steps < 1) { end(); return done; }
  const kf = Array.from({ length: steps + 1 }, (_, i) => ({ transform: `rotate(${from + (to - from) * i / steps}deg)`, offset: i / steps, easing: EASE.detent }));
  const a = el.animate(kf, { duration: dur, delay, fill: 'both' });
  return handle([a], () => { end(); a.cancel(); });
}

// A calendar-window flip: the old face turns away, the new one turns in.
// `win` holds the faces; its text is the value a screen reader reads.
export function flip(win, text) {
  const cur = win.lastElementChild;
  const nx = document.createElement('span');
  nx.textContent = text;
  if (reduced() || !cur) { win.replaceChildren(nx); return done; }
  nx.style.transform = 'rotateX(-90deg)';
  win.appendChild(nx);
  const out = cur.animate([{ transform: 'rotateX(0)' }, { transform: 'rotateX(90deg)' }], { duration: 110, easing: EASE.flipOut, fill: 'forwards' });
  let inn = null;
  const finished = out.finished.catch(() => {}).then(() => {
    cur.remove(); nx.style.transform = '';
    inn = nx.animate([{ transform: 'rotateX(-90deg)' }, { transform: 'rotateX(8deg)', offset: 0.75 }, { transform: 'rotateX(0)' }], { duration: 170, easing: EASE.flipIn });
    return inn.finished.catch(() => {});
  });
  return { finished, finish() { try { out.finish(); inn?.finish(); } catch { /* gone */ } } };
}

// Set an equation glyph by glyph: each glyph drops into place as its
// tracking closes. `glyphs` are the spans to set.
export function glyphSet(glyphs, { delay = 0, stagger = 70 } = {}) {
  if (reduced()) return done;
  return handle(glyphs.map((g, i) => g.animate(
    [{ opacity: 0, transform: 'translateY(-.18em)', letterSpacing: '.2em' }, { opacity: 1, transform: 'translateY(.02em)', offset: 0.7 }, { opacity: 1, transform: 'none', letterSpacing: '0' }],
    { duration: 420, delay: delay + i * stagger, easing: EASE.set, fill: 'backwards' })));
}

export function rowReveal(rows, { delay = 0, stagger = 130 } = {}) {
  if (reduced()) return done;
  return handle(rows.map((r, i) => r.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
    { duration: 260, delay: delay + i * stagger, easing: EASE.row, fill: 'backwards' })));
}

// The examiner's emboss stamp: the mark presses down past its size and
// settles, as a press ring spreads and fades. Only ever stamps a mark the
// deterministic engine set.
export function embossStamp(mark, ring, { delay = 0 } = {}) {
  if (reduced()) return done;
  return handle([
    ring?.animate([{ opacity: 0, transform: 'scale(1.9)' }, { opacity: 0.55, transform: 'scale(1.05)', offset: 0.6 }, { opacity: 0, transform: 'scale(1)' }], { duration: 420, delay, easing: EASE.ring, fill: 'backwards' }),
    mark.animate([{ opacity: 0, transform: 'scale(1.7)' }, { opacity: 1, transform: 'scale(.9)', offset: 0.55, easing: EASE.stampSettle }, { opacity: 1, transform: 'scale(1)' }], { duration: 340, delay, easing: EASE.stampIn, fill: 'backwards' })
  ]);
}

// A's plane spring (mass 1, k 170, c 22: damping ratio ≈ 0.84), integrated
// in four sub-steps a frame. Interruptible: retarget() keeps the velocity.
export function planeSpring({ from, to, k = 170, c = 22, delay = 0, onUpdate, onDone }) {
  let x = from, v = 0, target = to, last = null, start = null, raf = 0, stopped = false;
  const span = () => Math.abs(from - target) || 1;
  const settle = () => { stopped = true; cancelAnimationFrame(raf); onUpdate(target); onDone?.(); };
  if (reduced()) { settle(); return { stop() {}, finish() {}, retarget(t) { target = t; onUpdate(t); } }; }
  const step = now => {
    if (stopped) return;
    if (start === null) start = now;
    if (now - start < delay) { raf = requestAnimationFrame(step); return; }
    const dt = last === null ? 1 / 60 : Math.min(0.032, (now - last) / 1000); last = now;
    for (let i = 0, h = dt / 4; i < 4; i++) { v += (-k * (x - target) - c * v) * h; x += v * h; }
    onUpdate(x);
    if (Math.abs(x - target) < 0.0015 * span() && Math.abs(v) < 0.01 * span()) { settle(); return; }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return { stop() { stopped = true; cancelAnimationFrame(raf); }, finish: settle, retarget(t) { target = t; } };
}

// The same spring, stepped without a clock, for tests and for precomputing.
export function simulateSpring({ from, to, k = 170, c = 22 }, seconds, fps = 60) {
  let x = from, v = 0;
  for (let f = 0; f < seconds * fps; f++) for (let i = 0, h = 1 / fps / 4; i < 4; i++) { v += (-k * (x - to) - c * v) * h; x += v * h; }
  return { x, v };
}
