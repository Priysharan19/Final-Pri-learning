// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · turning ink into the only thing that leaves the device
//
// When a student turns server-side reading on, exactly one thing is sent: a
// picture drawn from their own stroke coordinates. Not a screenshot. The page
// around the ink — the question, the marks, the expected answer, their name —
// is never in the frame, because the frame is drawn here from the strokes and
// nothing else is ever added to it.
//
// It is drawn black on white at a fixed stroke width, which is what a reader
// trained on written maths expects, and cropped tight to the writing so the
// model spends its resolution on the marks rather than on empty paper.
// ─────────────────────────────────────────────────────────────────────────────

/** Room around the writing, in the ink's own coordinates. */
const PAD = 24;
/** Above this the raster is scaled down; a bigger picture costs more and reads no better. */
const MAX_PIXELS = 2_200_000;
const MIN_SCALE = 0.4;
const MAX_SCALE = 3;

function pointsOf(stroke) {
  if (Array.isArray(stroke)) return stroke;
  if (Array.isArray(stroke?.points)) return stroke.points;
  return [];
}

function coord(point) {
  if (Array.isArray(point)) return { x: Number(point[0]), y: Number(point[1]) };
  return { x: Number(point?.x), y: Number(point?.y) };
}

/** The tight box around every mark, or null when there is nothing written. */
export function inkBounds(strokes) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let seen = 0;
  for (const stroke of strokes || []) {
    for (const raw of pointsOf(stroke)) {
      const { x, y } = coord(raw);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      seen += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (!seen) return null;
  return { minX, minY, maxX, maxY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY), points: seen };
}

/** Scale that keeps the picture under the pixel budget without shrinking small writing. */
export function rasterScale(bounds, { maxPixels = MAX_PIXELS } = {}) {
  const w = bounds.width + PAD * 2;
  const h = bounds.height + PAD * 2;
  const fit = Math.sqrt(maxPixels / Math.max(1, w * h));
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, fit));
}

/**
 * Draw the strokes onto a 2D context. Exported so a test can drive it with a
 * recording context and assert what is drawn, without a browser.
 */
export function paintInk(ctx, strokes, bounds, scale) {
  const width = Math.ceil((bounds.width + PAD * 2) * scale);
  const height = Math.ceil((bounds.height + PAD * 2) * scale);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.max(1.6, 2.4 * scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const px = x => (x - bounds.minX + PAD) * scale;
  const py = y => (y - bounds.minY + PAD) * scale;

  let drawn = 0;
  for (const stroke of strokes || []) {
    const points = pointsOf(stroke).map(coord).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (!points.length) continue;
    ctx.beginPath();
    if (points.length === 1) {
      // A single tap is a dot — a decimal point, or the dot of an i.
      ctx.arc(px(points[0].x), py(points[0].y), ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
    } else {
      ctx.moveTo(px(points[0].x), py(points[0].y));
      for (let i = 1; i < points.length; i += 1) ctx.lineTo(px(points[i].x), py(points[i].y));
      ctx.stroke();
    }
    drawn += 1;
  }
  return { width, height, strokes: drawn };
}

/** The transport refuses a body over 1 MB, so the picture has to fit inside it. */
export const MAX_IMAGE_BYTES = 700_000;

function dataUrlBytes(dataUrl) {
  const comma = String(dataUrl).indexOf(',');
  return comma < 0 ? 0 : Math.floor(((dataUrl.length - comma - 1) * 3) / 4);
}

/**
 * A PNG data URL of the ink, or null when there is nothing to send.
 *
 * Drawn at the largest scale that fits the byte budget: a page of dense working
 * is scaled down rather than refused, because a smaller picture of the whole
 * page reads better than a sharp picture of half of it.
 *
 * `createCanvas` is injectable so this is testable without a DOM.
 */
export function rasterizeInk(strokes, {
  maxPixels = MAX_PIXELS,
  maxBytes = MAX_IMAGE_BYTES,
  createCanvas = defaultCanvas
} = {}) {
  const bounds = inkBounds(strokes);
  if (!bounds) return null;

  let scale = rasterScale(bounds, { maxPixels });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const width = Math.ceil((bounds.width + PAD * 2) * scale);
    const height = Math.ceil((bounds.height + PAD * 2) * scale);
    const canvas = createCanvas(width, height);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const painted = paintInk(ctx, strokes, bounds, scale);
    if (!painted.strokes) return null;

    const dataUrl = canvas.toDataURL('image/png');
    const bytes = dataUrlBytes(dataUrl);
    if (bytes <= maxBytes) {
      return { dataUrl, width, height, bytes, scale, strokes: painted.strokes, points: bounds.points };
    }
    // At the floor and still over budget, this page cannot be sent. Returning it
    // anyway used to hand cloudTransport an image five times its 1 MB body cap,
    // which threw and surfaced to the student as "couldn't reach the reader" for
    // a page that was never sent. Refusing here is the honest outcome.
    if (scale <= MIN_SCALE) return null;
    // Area scales with the square of the linear scale, so aim straight at the
    // budget rather than stepping down blindly.
    scale = Math.max(MIN_SCALE, scale * Math.sqrt(maxBytes / bytes) * 0.95);
  }
  return null;
}

function defaultCanvas(width, height) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}
