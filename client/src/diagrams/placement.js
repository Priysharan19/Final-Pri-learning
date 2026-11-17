// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · label placement for the diagram kit
//
// Pure functions. A label is given an ordered list of candidate positions; the first one whose
// box touches no stroked path is used (the least-crossed one if none is clear). Obstacles are
// polylines in the figure's own pixel space, built from the same model the picture is drawn from,
// so the choice is the same on every device and can be tested without a browser. The browser
// check (client/test/diagram-kit-browser-check.mjs) then measures the real boxes the same way.
// ─────────────────────────────────────────────────────────────────────────────

/** The width and height a KaTeX label needs, estimated from its source. */
export function labelSize(tex, { small = false } = {}) {
  const s = String(tex);
  const plain = s.replace(/\\(?:text|mathbf|mathrm)\{([^}]*)\}/g, '$1').replace(/\\[a-zA-Z]+/g, 'x').replace(/[{}^_\\,;\s]/g, '');
  const tall = /\\(?:d?frac|tfrac|begin|sqrt)/.test(s);
  const per = small ? 6.6 : 7.6;
  return { w: Math.max(12, plain.length * per + 4), h: tall ? (/begin/.test(s) ? 44 : 34) : 17 };
}

/** The box a label occupies for a candidate [x, y, anchor] (the Tex component's own anchoring). */
export function boxOf(tex, [x, y, anchor = 'middle'], opts) {
  const { w, h } = labelSize(tex, opts);
  const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  return { l: left, r: left + w, t: y - h / 2, b: y + h / 2 };
}

/** How many sampled points of the polylines fall inside the box (grown by `pad`). */
export function crossings(box, polylines, pad = 2) {
  let n = 0;
  const L = box.l - pad; const R = box.r + pad; const T = box.t - pad; const B = box.b + pad;
  for (const line of polylines) {
    for (let i = 0; i + 1 < line.length; i++) {
      const [x0, y0] = line[i]; const [x1, y1] = line[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.max(1, Math.ceil(len / 2));
      for (let k = 0; k <= steps; k++) {
        const x = x0 + ((x1 - x0) * k) / steps; const y = y0 + ((y1 - y0) * k) / steps;
        if (x > L && x < R && y > T && y < B) n += 1;
      }
    }
  }
  return n;
}

/** The first candidate that touches no obstacle; else the least-crossed one. */
export function place(tex, candidates, obstacles, opts) {
  let best = candidates[0]; let bestN = Infinity;
  for (const c of candidates) {
    const n = crossings(boxOf(tex, c, opts), obstacles);
    if (n === 0) return c;
    if (n < bestN) { best = c; bestN = n; }
  }
  return best;
}

/** A circle as a closed polyline. */
export const circlePath = (cx, cy, r, n = 72) => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos((2 * Math.PI * i) / n) * r, cy + Math.sin((2 * Math.PI * i) / n) * r]);
