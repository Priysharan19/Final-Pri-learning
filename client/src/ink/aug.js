// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Handwriting style engine
// Deterministic (seeded) transforms that turn one clean glyph into the many
// ways real people write it: slant, rotation, aspect, low-frequency elastic
// warp, wobble, entry/exit tails, speed-varied resampling. Used to train the
// neural classifier AND to stress-test the recogniser — same code both sides.
// ─────────────────────────────────────────────────────────────────────────────

export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const bboxOf = (strokes) => {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const st of strokes) for (const p of st) {
    if (p[0] < x1) x1 = p[0]; if (p[0] > x2) x2 = p[0];
    if (p[1] < y1) y1 = p[1]; if (p[1] > y2) y2 = p[1];
  }
  return { x1, y1, x2, y2, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, w: Math.max(1e-6, x2 - x1), h: Math.max(1e-6, y2 - y1) };
};

/**
 * Apply a random handwriting style to a glyph.
 * strokes: [[ [x,y], … ], …] (any coordinate box). Returns new strokes.
 * strength 1 = typical natural variation; 1.6 = messy handwriting.
 */
export function stylize(strokes, rng, strength = 1, opts = {}) {
  const b = bboxOf(strokes);
  const S = Math.max(b.w, b.h);
  const k = strength;
  const bowK = opts.bowScale ?? 1;   // curvature-sensitive classes train with less bow

  // global affine: rotation, slant (shear), anisotropic scale
  const rot = (rng() * 2 - 1) * 0.16 * k;                 // ±9° · k
  const shear = (rng() * 2 - 1) * 0.38 * k;               // italic slant
  const sx = 1 + (rng() * 2 - 1) * 0.28 * k;
  const sy = 1 + (rng() * 2 - 1) * 0.22 * k;
  const cos = Math.cos(rot), sin = Math.sin(rot);

  // elastic warp: two low-frequency sinusoidal displacement fields
  const ax1 = rng() * Math.PI * 2, ay1 = rng() * Math.PI * 2;
  const ax2 = rng() * Math.PI * 2, ay2 = rng() * Math.PI * 2;
  const fx1 = 0.8 + rng() * 1.4, fy1 = 0.8 + rng() * 1.4;
  const fx2 = 1.6 + rng() * 2.2, fy2 = 1.6 + rng() * 2.2;
  const amp1 = 0.05 * S * k, amp2 = 0.024 * S * k;

  // curvature bow: the whole glyph bends along a gentle arc (fast writing)
  const bowX = (rng() * 2 - 1) * 0.05 * S * k * bowK;
  const bowY = (rng() * 2 - 1) * 0.04 * S * k * bowK;

  const jitterAmp = 0.011 * S * k;

  const warp = ([x, y]) => {
    // centre
    let px = x - b.cx, py = y - b.cy;
    // anisotropic scale + shear + rotation
    px *= sx; py *= sy;
    px += shear * py * 0.5;
    const rx2 = px * cos - py * sin;
    const ry2 = px * sin + py * cos;
    px = rx2; py = ry2;
    // elastic
    const u = px / S, v = py / S;
    px += amp1 * Math.sin(fx1 * v * Math.PI * 2 + ax1) + amp2 * Math.sin(fx2 * v * Math.PI * 2 + ax2);
    py += amp1 * Math.sin(fy1 * u * Math.PI * 2 + ay1) + amp2 * Math.sin(fy2 * u * Math.PI * 2 + ay2);
    // curvature bow (quadratic, zero-mean)
    px += bowX * (v * v * 4 - 1 / 3);
    py += bowY * (u * u * 4 - 1 / 3);
    // wobble
    px += (rng() * 2 - 1) * jitterAmp;
    py += (rng() * 2 - 1) * jitterAmp;
    return [px + b.cx, py + b.cy];
  };

  let out = strokes.map(st => st.map(warp));

  // per-stroke baseline drift: strokes of one glyph rarely align perfectly
  out = out.map(st => {
    if (rng() > 0.65) return st;
    const dx = (rng() * 2 - 1) * 0.028 * S * k;
    const dy = (rng() * 2 - 1) * 0.028 * S * k;
    return st.map(p => [p[0] + dx, p[1] + dy]);
  });

  // start/end truncation: pen lands late or lifts early
  out = out.map(st => {
    if (st.length < 7 || rng() > 0.3 * k) return st;
    const cutStart = rng() < 0.5 ? 1 + (rng() < 0.3 ? 1 : 0) : 0;
    const cutEnd = rng() < 0.5 ? 1 + (rng() < 0.3 ? 1 : 0) : 0;
    const st2 = st.slice(cutStart, st.length - cutEnd);
    return st2.length >= 4 ? st2 : st;
  });

  // entry/exit tails: quick hooks people leave when writing fast
  out = out.map(st => {
    if (st.length < 4 || rng() > 0.5 * k) return st;
    const tailLen = 0.05 * S * (0.5 + rng());
    const addTail = (arr, atStart) => {
      const a = atStart ? arr[0] : arr[arr.length - 1];
      const b2 = atStart ? arr[1] : arr[arr.length - 2];
      const dx = a[0] - b2[0], dy = a[1] - b2[1];
      const len = Math.hypot(dx, dy) || 1;
      const ang = (rng() * 2 - 1) * 0.9;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const ux = (dx / len) * ca - (dy / len) * sa;
      const uy = (dx / len) * sa + (dy / len) * ca;
      const tail = [[a[0] + ux * tailLen * 0.5, a[1] + uy * tailLen * 0.5], [a[0] + ux * tailLen, a[1] + uy * tailLen]];
      return atStart ? [...tail.reverse(), ...arr] : [...arr, ...tail];
    };
    let st2 = st;
    if (rng() < 0.5) st2 = addTail(st2, true);
    if (rng() < 0.5) st2 = addTail(st2, false);
    return st2;
  });

  // speed variation: drop or keep points unevenly (fast writing = sparse arcs)
  out = out.map(st => {
    if (st.length < 8 || rng() > 0.6) return st;
    const keep = 0.55 + rng() * 0.4;
    const st2 = st.filter((_, i) => i === 0 || i === st.length - 1 || rng() < keep);
    return st2.length >= 3 ? st2 : st;
  });

  return out;
}
