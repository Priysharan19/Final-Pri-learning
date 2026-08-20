// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Stroke rasterizer (v6)
// Turns a glyph's strokes into the grayscale image the neural ensemble eats.
// Pure math (no Canvas) so the EXACT same code runs during training in Node
// and at inference on the iPad — zero train/serve skew.
// v6 additions:
//   • parametric size (28 for model A, 32 for model B) with proportional
//     content box and brush radius
//   • moment-based DESKEW: the dominant italic slant is measured on
//     arc-length-resampled points and sheared away before fitting, so a
//     heavily slanted hand rasterises like an upright one
//   • optional brush radius (training varies it → thickness invariance)
// Convention: content is bbox-normalised AFTER deskew, aspect preserved,
// fitted into a (size·22/28)² box centred in the frame; ink is splatted along
// densely resampled polylines with a soft brush; output normalised to [0,1].
// ─────────────────────────────────────────────────────────────────────────────

export const IMG = 28;                      // default / back-compat size
const CONTENT_FRAC = 22 / 28;
const MAX_SLANT = 0.42;                     // tan clamp ≈ ±23°

/** Estimate the dominant slant tan(α) of a glyph from its strokes.
 *  Points are resampled at uniform arc length first so dense segments don't
 *  bias the moments. Returns cov(x,y)/var(y), clamped. */
export function slantOf(strokes) {
  // resample each stroke at ~64 steps of its own length
  const pts = [];
  for (const st of strokes) {
    if (!st.length) continue;
    if (st.length === 1) { pts.push(st[0]); continue; }
    let len = 0;
    for (let i = 1; i < st.length; i++) len += Math.hypot(st[i][0] - st[i - 1][0], st[i][1] - st[i - 1][1]);
    if (len < 1e-6) { pts.push(st[0]); continue; }
    const step = len / 40;
    let acc = 0, prev = st[0];
    pts.push(prev);
    for (let i = 1; i < st.length; i++) {
      const cur = st[i];
      let d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
      while (acc + d >= step && d > 1e-9) {
        const t = (step - acc) / d;
        prev = [prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t];
        pts.push(prev);
        d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
        acc = 0;
      }
      acc += d; prev = cur;
    }
  }
  if (pts.length < 6) return 0;
  let mx = 0, my = 0;
  for (const p of pts) { mx += p[0]; my += p[1]; }
  mx /= pts.length; my /= pts.length;
  let cov = 0, vy = 0;
  for (const p of pts) { const dx = p[0] - mx, dy = p[1] - my; cov += dx * dy; vy += dy * dy; }
  if (vy < 1e-6) return 0;
  const a = cov / vy;
  return Math.max(-MAX_SLANT, Math.min(MAX_SLANT, a));
}

/** strokes: [[ [x,y], … ], …] → Float32Array(size²) in [0,1].
 *  opts: { size=28, brush=1.15 (in 28-px units), deskew=true } */
export function rasterize(strokes, opts = {}) {
  const size = opts.size || IMG;
  const content = size * CONTENT_FRAC;
  const margin = (size - content) / 2;
  const img = new Float32Array(size * size);
  let all = strokes.filter(st => st.length);
  if (!all.length) return img;

  // ── deskew: shear the dominant slant away around the vertical centre ──
  // EXCEPT single near-straight strokes: for / \ 1 l the slant IS the identity
  // — shearing it away would collapse a slash onto a one.
  const isBareLine = all.length === 1 && (() => {
    const st = all[0];
    if (st.length < 2) return true;
    let len = 0;
    for (let i = 1; i < st.length; i++) len += Math.hypot(st[i][0] - st[i - 1][0], st[i][1] - st[i - 1][1]);
    const chord = Math.hypot(st[st.length - 1][0] - st[0][0], st[st.length - 1][1] - st[0][1]);
    return chord / Math.max(len, 1e-6) > 0.93;
  })();
  if (opts.deskew !== false && !isBareLine) {
    const a = slantOf(all);
    if (Math.abs(a) > 0.02) {
      let ys = 0, n = 0;
      for (const st of all) for (const p of st) { ys += p[1]; n++; }
      const my = ys / n;
      all = all.map(st => st.map(p => [p[0] - a * (p[1] - my), p[1]]));
    }
  }

  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const st of all) for (const p of st) {
    if (p[0] < x1) x1 = p[0]; if (p[0] > x2) x2 = p[0];
    if (p[1] < y1) y1 = p[1]; if (p[1] > y2) y2 = p[1];
  }
  const w = Math.max(x2 - x1, 1e-6), h = Math.max(y2 - y1, 1e-6);

  // opts.minAspect — relieve extremely thin glyphs of the resolution famine
  // that aspect-preserving normalisation inflicts on them.
  //
  // Preserving aspect is the right default, but it starves exactly the glyphs
  // that most need resolution: a stroke of aspect 0.06 is allotted content·0.06
  // ≈ 1.3px of width at size 28, against a brush that splats ink 2-3px wide.
  // Every tall-thin symbol therefore reaches the net as the same vertical
  // smear, and which way it bows — the ONLY thing separating 1 l ( ) / — has
  // been quantised out of existence before the first convolution.
  //
  // Stretching the thin axis to a FLOOR (rather than filling the frame) buys
  // that resolution back without collapsing the alphabet: filling outright
  // renders a "1" and a "/" as pixel-identical diagonals, since both are
  // straight lines and only their aspect ever distinguished them. A floor of
  // ~0.35 widens a "1" from ~1px to ~8px while leaving "/" — already well above
  // the floor — untouched.
  //
  // Aspect is still partly discarded, so a floored render belongs in an
  // ensemble beside the aspect-preserving models and the geometry re-ranker,
  // which carries true aspect explicitly. Never as the only voice.
  let sx, sy;
  const floor = opts.minAspect || 0;
  if (floor > 0 && w / h < floor) {           // tall and thin — widen it
    sy = content / h;
    sx = floor * content / w;
  } else if (floor > 0 && h / w < floor) {    // wide and flat — heighten it
    sx = content / w;
    sy = floor * content / h;
  } else {
    sx = sy = content / Math.max(w, h);
  }
  const ox = margin + (content - w * sx) / 2;
  const oy = margin + (content - h * sy) / 2;
  const tx = (p) => [ox + (p[0] - x1) * sx, oy + (p[1] - y1) * sy];

  // soft round brush; radius given in 28-px units, scaled with resolution
  const R = (opts.brush || 1.15) * (size / IMG);
  const splat = (x, y) => {
    const xi0 = Math.max(0, Math.floor(x - R - 1)), xi1 = Math.min(size - 1, Math.ceil(x + R + 1));
    const yi0 = Math.max(0, Math.floor(y - R - 1)), yi1 = Math.min(size - 1, Math.ceil(y + R + 1));
    for (let yi = yi0; yi <= yi1; yi++) {
      for (let xi = xi0; xi <= xi1; xi++) {
        const d = Math.hypot(xi + 0.5 - x, yi + 0.5 - y);
        const v = Math.max(0, 1 - Math.max(0, d - R * 0.45) / (R * 0.9));
        if (v > 0) {
          const idx = yi * size + xi;
          if (v > img[idx]) img[idx] = v;
        }
      }
    }
  };

  for (const stroke of all) {
    if (stroke.length === 1) { const [x, y] = tx(stroke[0]); splat(x, y); continue; }
    let [px, py] = tx(stroke[0]);
    splat(px, py);
    for (let i = 1; i < stroke.length; i++) {
      const [cx, cy] = tx(stroke[i]);
      const dist = Math.hypot(cx - px, cy - py);
      const steps = Math.max(1, Math.ceil(dist / 0.45));
      for (let s = 1; s <= steps; s++) {
        splat(px + (cx - px) * s / steps, py + (cy - py) * s / steps);
      }
      px = cx; py = cy;
    }
  }
  return img;
}

/** Re-normalise an already-raster srcSize² image (e.g. MNIST 28²) into the
 *  same deskew + bbox/box convention at outSize², so real data and stroke
 *  renders share a domain. */
export function renormalizeRaster(src, srcSize = IMG, outSize = srcSize) {
  const S = srcSize;
  // ── pixel-moment deskew into a padded temp (shear can widen content) ──
  let m = 0, mx = 0, my = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = src[y * S + x];
    if (v > 0.05) { m += v; mx += v * x; my += v * y; }
  }
  let work = src, workW = S;
  if (m > 0) {
    mx /= m; my /= m;
    let cov = 0, vy = 0;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const v = src[y * S + x];
      if (v > 0.05) { cov += v * (x - mx) * (y - my); vy += v * (y - my) * (y - my); }
    }
    let a = vy > 1e-6 ? cov / vy : 0;
    a = Math.max(-MAX_SLANT, Math.min(MAX_SLANT, a));
    if (Math.abs(a) > 0.02) {
      const pad = Math.ceil(Math.abs(a) * S / 2) + 1;
      workW = S + 2 * pad;
      const tmp = new Float32Array(workW * S);
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < workW; x++) {
          // inverse map: sample src at x' = (x - pad) + a·(y - my)
          const sx = (x - pad) + a * (y - my);
          const x0 = Math.floor(sx), fx = sx - x0;
          const at = (xx) => (xx < 0 || xx >= S) ? 0 : src[y * S + xx];
          tmp[y * workW + x] = at(x0) * (1 - fx) + at(x0 + 1) * fx;
        }
      }
      work = tmp;
    }
  }

  // ── content bbox on (possibly sheared) work image ──
  const W = workW, H = S;
  let x1 = W, y1 = H, x2 = -1, y2 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (work[y * W + x] > 0.12) {
      if (x < x1) x1 = x; if (x > x2) x2 = x;
      if (y < y1) y1 = y; if (y > y2) y2 = y;
    }
  }
  if (x2 < 0) return new Float32Array(outSize * outSize);
  const w = Math.max(1, x2 - x1 + 1), h = Math.max(1, y2 - y1 + 1);
  const content = outSize * CONTENT_FRAC;
  const margin = (outSize - content) / 2;
  const scale = content / Math.max(w, h);
  const ow = w * scale, oh = h * scale;
  const ox = margin + (content - ow) / 2, oy = margin + (content - oh) / 2;
  const out = new Float32Array(outSize * outSize);
  for (let y = 0; y < outSize; y++) {
    for (let x = 0; x < outSize; x++) {
      const sx = x1 + (x + 0.5 - ox) / scale - 0.5;
      const sy = y1 + (y + 0.5 - oy) / scale - 0.5;
      if (sx < -0.5 || sy < -0.5 || sx > W - 0.5 || sy > H - 0.5) continue;
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const fx = sx - x0, fy = sy - y0;
      const at = (xx, yy) => (xx < 0 || yy < 0 || xx >= W || yy >= H) ? 0 : work[yy * W + xx];
      out[y * outSize + x] =
        at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy) +
        at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy;
    }
  }
  return out;
}
