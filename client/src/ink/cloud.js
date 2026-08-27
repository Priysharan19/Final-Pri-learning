// Pri Learning · optional OpenAI cloud handwriting client
//
// The client never receives an OpenAI API key. It rasterises ONLY the captured
// ink strokes onto a clean white background, tightly crops that raster, and
// sends it to a configured Pri Learning gateway. Question text, expected
// answers, profile data and the surrounding UI are deliberately excluded.

const MAX_SIDE = 2048;
const MAX_PIXELS = 3_200_000;
const PADDING = 28;
const REQUEST_TIMEOUT_MS = 17000;
const RETRY_BACKOFF_MS = 30000;

let hardUnavailable = false;
let retryAfter = 0;
let activeRequest = null;

function endpoint() {
  if (typeof window === 'undefined') return '';
  const runtime = String(window.__PRI_CLOUD_INK_ENDPOINT__ || '').trim();
  if (runtime) return runtime;
  return String(import.meta.env.VITE_PRI_CLOUD_INK_ENDPOINT || '').trim();
}

function clientToken() {
  if (typeof window === 'undefined') return '';
  return String(window.__PRI_CLOUD_INK_TOKEN__ || import.meta.env.VITE_PRI_CLOUD_INK_TOKEN || '').trim();
}

export function cloudInkConfigured() {
  return Boolean(endpoint()) && !hardUnavailable;
}

function allPoints(strokes) {
  const out = [];
  for (const stroke of Array.isArray(strokes) ? strokes : []) {
    for (const point of Array.isArray(stroke?.points) ? stroke.points : []) {
      const x = Number(point?.x);
      const y = Number(point?.y);
      if (Number.isFinite(x) && Number.isFinite(y)) out.push(point);
    }
  }
  return out;
}

function boundsOf(points) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const point of points) {
    const x = Number(point.x), y = Number(point.y);
    x1 = Math.min(x1, x); y1 = Math.min(y1, y);
    x2 = Math.max(x2, x); y2 = Math.max(y2, y);
  }
  return { x1, y1, x2, y2, w: Math.max(1, x2 - x1), h: Math.max(1, y2 - y1) };
}

function renderScale(width, height) {
  const paddedW = width + PADDING * 2;
  const paddedH = height + PADDING * 2;
  let scale = 2;
  scale = Math.min(scale, MAX_SIDE / Math.max(paddedW, paddedH));
  scale = Math.min(scale, Math.sqrt(MAX_PIXELS / Math.max(1, paddedW * paddedH)));
  return Math.max(0.5, scale);
}

/**
 * Render stroke vectors, not a screenshot. This is both cheaper and safer: the
 * cloud sees the student's marks and their 2-D layout, but not the question,
 * marks, identity, navigation, feedback, or anything else on screen.
 */
export function rasterizeInkForCloud(strokes) {
  if (typeof document === 'undefined') return null;
  const points = allPoints(strokes);
  if (!points.length) return null;

  const bounds = boundsOf(points);
  const scale = renderScale(bounds.w, bounds.h);
  const width = Math.max(64, Math.ceil((bounds.w + PADDING * 2) * scale));
  const height = Math.max(64, Math.ceil((bounds.h + PADDING * 2) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return null;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#111111';
  ctx.fillStyle = '#111111';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const tx = value => (value - bounds.x1 + PADDING) * scale;
  const ty = value => (value - bounds.y1 + PADDING) * scale;

  for (const stroke of Array.isArray(strokes) ? strokes : []) {
    const pts = (Array.isArray(stroke?.points) ? stroke.points : [])
      .filter(point => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y)));
    if (!pts.length) continue;
    if (pts.length === 1) {
      const radius = Math.max(1.6 * scale, (Number(pts[0].w) || 3) * scale / 2);
      ctx.beginPath();
      ctx.arc(tx(Number(pts[0].x)), ty(Number(pts[0].y)), radius, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    // Segment-by-segment width keeps pressure information visible without
    // sending the pressure/timing telemetry itself.
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const widthA = Number(a.w) || 3;
      const widthB = Number(b.w) || widthA;
      ctx.lineWidth = Math.max(2.2 * scale, (widthA + widthB) * 0.5 * scale);
      ctx.beginPath();
      ctx.moveTo(tx(Number(a.x)), ty(Number(a.y)));
      ctx.lineTo(tx(Number(b.x)), ty(Number(b.y)));
      ctx.stroke();
    }
  }

  return {
    image: canvas.toDataURL('image/png'),
    width,
    height,
    bounds
  };
}

function normalizeReading(payload) {
  const lines = (Array.isArray(payload?.lines) ? payload.lines : [])
    .map((line, index) => ({
      text: String(line?.text || '').trim(),
      latex: String(line?.latex || '').trim(),
      confidence: Number.isFinite(Number(line?.confidence)) ? Number(line.confidence) : null,
      symbols: [],
      box: null,
      id: line?.id || `cloud-line-${index}`
    }))
    .filter(line => line.text);
  if (!lines.length) return null;
  return {
    ...payload,
    lines,
    text: lines.map(line => line.text).join('\n'),
    symbols: [],
    engine: String(payload?.engine || 'openai-cloud-handwriting'),
    minConf: Number.isFinite(Number(payload?.minConf)) ? Number(payload.minConf) : 0,
    margin: Number.isFinite(Number(payload?.margin)) ? Number(payload.margin) : 0,
    weakest: null,
    cloud: true,
    productionReady: true
  };
}

export async function recognizeWithCloud(strokes) {
  const url = endpoint();
  if (!url || hardUnavailable || Date.now() < retryAfter) return null;
  const raster = rasterizeInkForCloud(strokes);
  if (!raster?.image) return null;

  if (activeRequest) activeRequest.abort();
  const controller = new AbortController();
  activeRequest = controller;
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const token = clientToken();

  try {
    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ image: raster.image })
    });

    const contentType = String(response.headers.get('content-type') || '');
    if (!contentType.includes('application/json')) {
      if ([200, 404, 405].includes(response.status)) hardUnavailable = true;
      return null;
    }

    const payload = await response.json();
    if (!response.ok) {
      if (response.status === 404 || response.status === 405 || payload?.code === 'OPENAI_NOT_CONFIGURED') {
        hardUnavailable = true;
        return null;
      }
      retryAfter = Date.now() + RETRY_BACKOFF_MS;
      return null;
    }
    retryAfter = 0;
    return normalizeReading(payload);
  } catch (error) {
    if (error?.name !== 'AbortError') retryAfter = Date.now() + RETRY_BACKOFF_MS;
    return null;
  } finally {
    clearTimeout(timer);
    if (activeRequest === controller) activeRequest = null;
  }
}
