// ─────────────────────────────────────────────────────────────────────────────
// SIMULATED handwriting. Not a person's writing, not Apple Pencil, not a scan.
//
// Each character is a few pen strokes described as control points, then drawn
// the way a hand would: curves smoothed, every glyph given its own size, slant,
// rotation and baseline, the line drifting, and a slow wobble along each
// stroke. The output is stroke coordinates — the same shape the app's ink layer
// produces — so the app's own rasteriser (client/src/ink/cloudRaster.js) turns
// them into the picture that is sent. Nothing here reads a question or an
// answer key: it is given the text to write and writes it.
//
// Evidence produced from these strokes must always be labelled "simulated
// handwriting". It says nothing about real students' handwriting.
// ─────────────────────────────────────────────────────────────────────────────

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Unit box: x to the right, y downward, the baseline at y = 1, digit height 1.
// `s: 1` is a smooth (curved) stroke, `s: 0` is drawn point to point.
const GLYPHS = {
  '0': { w: 0.6, k: [{ s: 1, p: [[0.32, 0.03], [0.12, 0.2], [0.07, 0.55], [0.18, 0.9], [0.33, 0.98], [0.5, 0.8], [0.54, 0.45], [0.45, 0.12], [0.3, 0.02]] }] },
  '1': { w: 0.42, k: [{ s: 0, p: [[0.08, 0.26], [0.26, 0.03], [0.27, 1.0]] }] },
  '2': { w: 0.62, k: [{ s: 1, p: [[0.08, 0.24], [0.2, 0.06], [0.4, 0.04], [0.5, 0.24], [0.36, 0.55], [0.06, 0.98]] }, { s: 0, p: [[0.06, 0.98], [0.56, 0.96]] }] },
  '3': { w: 0.6, k: [{ s: 1, p: [[0.08, 0.14], [0.28, 0.02], [0.48, 0.14], [0.42, 0.38], [0.24, 0.47]] }, { s: 1, p: [[0.24, 0.47], [0.46, 0.56], [0.5, 0.8], [0.3, 0.98], [0.06, 0.86]] }] },
  '4': { w: 0.64, k: [{ s: 0, p: [[0.4, 0.03], [0.06, 0.66], [0.58, 0.66]] }, { s: 0, p: [[0.42, 0.34], [0.42, 1.0]] }] },
  '5': { w: 0.6, k: [{ s: 0, p: [[0.16, 0.04], [0.12, 0.45]] }, { s: 1, p: [[0.12, 0.45], [0.3, 0.37], [0.5, 0.52], [0.5, 0.82], [0.3, 0.98], [0.06, 0.86]] }, { s: 0, p: [[0.16, 0.04], [0.52, 0.03]] }] },
  '6': { w: 0.6, k: [{ s: 1, p: [[0.46, 0.04], [0.24, 0.24], [0.1, 0.6], [0.16, 0.9], [0.32, 0.98], [0.5, 0.82], [0.44, 0.6], [0.28, 0.54], [0.12, 0.68]] }] },
  '7': { w: 0.6, k: [{ s: 0, p: [[0.06, 0.05], [0.54, 0.04], [0.24, 1.0]] }] },
  '8': { w: 0.6, k: [{ s: 1, p: [[0.44, 0.14], [0.28, 0.02], [0.13, 0.2], [0.3, 0.46], [0.5, 0.72], [0.32, 0.98], [0.1, 0.78], [0.28, 0.48], [0.46, 0.24], [0.42, 0.1]] }] },
  '9': { w: 0.6, k: [{ s: 1, p: [[0.5, 0.22], [0.32, 0.03], [0.11, 0.22], [0.26, 0.48], [0.5, 0.26]] }, { s: 0, p: [[0.5, 0.18], [0.47, 1.0]] }] },
  '-': { w: 0.6, k: [{ s: 0, p: [[0.08, 0.56], [0.52, 0.55]] }] },
  '+': { w: 0.64, k: [{ s: 0, p: [[0.06, 0.56], [0.58, 0.55]] }, { s: 0, p: [[0.32, 0.3], [0.32, 0.82]] }] },
  '=': { w: 0.66, k: [{ s: 0, p: [[0.06, 0.46], [0.58, 0.45]] }, { s: 0, p: [[0.06, 0.68], [0.58, 0.67]] }] },
  '(': { w: 0.4, k: [{ s: 1, p: [[0.32, -0.04], [0.13, 0.28], [0.12, 0.72], [0.32, 1.06]] }] },
  ')': { w: 0.4, k: [{ s: 1, p: [[0.08, -0.04], [0.27, 0.28], [0.28, 0.72], [0.08, 1.06]] }] },
  'n': { w: 0.58, k: [{ s: 0, p: [[0.08, 0.46], [0.09, 1.0]] }, { s: 1, p: [[0.09, 0.66], [0.22, 0.48], [0.38, 0.5], [0.45, 0.7], [0.46, 1.0]] }] },
  ' ': { w: 0.42, k: [] }
};

export const SUPPORTED_CHARACTERS = Object.freeze(Object.keys(GLYPHS));

function catmullRom(points, perSegment = 10) {
  if (points.length < 3) return points.slice();
  const out = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    for (let j = 0; j < perSegment; j += 1) {
      const t = j / perSegment, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
      ]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

function polyline(points, step = 0.07) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const [x0, y0] = points[i - 1], [x1, y1] = points[i];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let j = 1; j <= n; j += 1) out.push([x0 + (x1 - x0) * j / n, y0 + (y1 - y0) * j / n]);
  }
  return out;
}

/**
 * Write lines of text as pen strokes.
 * Returns { strokes: [[{x,y},…],…], lines: n } in ink (CSS-pixel-like) units.
 */
export function writeLines(lines, { seed = 1, size = 64, lineGap = 124, x0 = 40, y0 = 40 } = {}) {
  const rand = mulberry32(seed);
  const between = (lo, hi) => lo + (hi - lo) * rand();
  const strokes = [];
  lines.forEach((line, row) => {
    let penX = x0 + between(-10, 14);
    const top = y0 + row * lineGap + between(-5, 5);
    const drift = between(-0.018, 0.012);          // the line climbs or sags a little
    for (const ch of String(line)) {
      const glyph = GLYPHS[ch];
      if (!glyph) throw new Error(`simulated ink has no glyph for ${JSON.stringify(ch)}`);
      const scale = size * between(0.93, 1.07);
      const slant = between(-0.12, 0.02);           // a slight forward lean
      const turn = between(-0.05, 0.05);
      const lift = between(-0.045, 0.045) * size + (penX - x0) * drift;
      const cos = Math.cos(turn), sin = Math.sin(turn);
      for (const stroke of glyph.k) {
        const path = stroke.s ? catmullRom(stroke.p) : polyline(stroke.p);
        const f1 = between(5, 9), f2 = between(5, 9), ph1 = between(0, 6.28), ph2 = between(0, 6.28);
        const amp = between(0.008, 0.02);
        strokes.push(path.map(([ux, uy], i) => {
          const t = i / Math.max(1, path.length - 1);
          let x = ux + (1 - uy) * -slant + amp * Math.sin(t * f1 + ph1) + between(-0.004, 0.004);
          let y = uy + amp * Math.sin(t * f2 + ph2) + between(-0.004, 0.004);
          const cx = x - glyph.w / 2, cy = y - 0.5;
          x = glyph.w / 2 + cx * cos - cy * sin;
          y = 0.5 + cx * sin + cy * cos;
          return { x: Math.round((penX + x * scale) * 100) / 100, y: Math.round((top + lift + y * scale) * 100) / 100 };
        }));
      }
      penX += glyph.w * size + between(0.1, 0.24) * size;
    }
  });
  return { strokes, lines: lines.length };
}

/** A scribble: looping, overlapping pen movement that is not writing. */
export function writeScribble({ seed = 7, width = 360, height = 160, x0 = 40, y0 = 40 } = {}) {
  const rand = mulberry32(seed);
  const strokes = [];
  for (let s = 0; s < 4; s += 1) {
    const points = [];
    let x = x0 + rand() * width, y = y0 + rand() * height;
    let heading = rand() * 6.28;
    for (let i = 0; i < 160; i += 1) {
      heading += (rand() - 0.5) * 1.7 + 0.28;
      x = Math.min(x0 + width, Math.max(x0, x + Math.cos(heading) * 11));
      y = Math.min(y0 + height, Math.max(y0, y + Math.sin(heading) * 11));
      points.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
    }
    strokes.push(points);
  }
  return { strokes };
}

/**
 * Insert an EXIF APP1 segment carrying only Orientation into a JPEG.
 * `orientation` 6 means "rotate 90° clockwise to display".
 */
export function withExifOrientation(jpeg, orientation) {
  if (!(jpeg[0] === 0xFF && jpeg[1] === 0xD8)) throw new Error('not a JPEG');
  const tiff = Buffer.from([
    0x4D, 0x4D, 0x00, 0x2A, 0x00, 0x00, 0x00, 0x08,   // big-endian TIFF header, IFD0 at 8
    0x00, 0x01,                                       // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01,   // tag 0x0112 Orientation, SHORT, count 1
    0x00, orientation & 0xFF, 0x00, 0x00,             // value
    0x00, 0x00, 0x00, 0x00                            // no next IFD
  ]);
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const app1 = Buffer.concat([Buffer.from([0xFF, 0xE1, ((body.length + 2) >> 8) & 0xFF, (body.length + 2) & 0xFF]), body]);
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}
