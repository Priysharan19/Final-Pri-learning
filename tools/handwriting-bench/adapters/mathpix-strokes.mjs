// ─────────────────────────────────────────────────────────────────────────────
// Architecture D · Mathpix v3/strokes
//
// Pri already stores raw Apple Pencil strokes in the corpus format, so this
// candidate needs no new capture: the same recorded ink that feeds pri-local
// feeds Mathpix, which is the only way the two can be compared honestly.
//
// One thing this adapter exists to MEASURE rather than assume: the documented
// v3/strokes response carries a single `latex_styled`/`confidence` pair, with
// no per-line breakdown. Whether it returns anything usable for a multi-line
// worked solution is an open question in the public docs, and it decides
// whether Mathpix can serve the live surface for working or only for one
// expression at a time. `multilineProbe` below is the cheapest possible answer:
// one call, one real multi-line sample.
// ─────────────────────────────────────────────────────────────────────────────
import { reading } from '../contract.mjs';
import { latexToLinear, latexBlockToLines } from '../latex.mjs';
import { MATHPIX } from '../cost.mjs';

export const id = 'mathpix-strokes';
export const kind = 'recognition';
export const envKeys = ['PRI_BENCH_MATHPIX_APP_ID', 'PRI_BENCH_MATHPIX_APP_KEY'];
export const inputs = ['strokes'];

const ENDPOINT = 'https://api.mathpix.com/v3/strokes';

/**
 * Pri's `{points:[{x,y,...}]}` → Mathpix's doubly-nested parallel arrays.
 *
 * Mathpix's own guidance is to send raw sample points with no preprocessing,
 * so nothing is smoothed, resampled or re-scaled here. Pressure, tilt and
 * timing are dropped because the endpoint takes x/y only.
 */
export function toMathpixStrokes(strokes) {
  const x = [], y = [];
  for (const stroke of strokes || []) {
    const points = stroke?.points || [];
    if (points.length < 1) continue;
    x.push(points.map(p => Number(p.x)));
    y.push(points.map(p => Number(p.y)));
  }
  return { strokes: { strokes: { x, y } } };
}

function headers() {
  return {
    'content-type': 'application/json',
    app_id: process.env.PRI_BENCH_MATHPIX_APP_ID || '',
    app_key: process.env.PRI_BENCH_MATHPIX_APP_KEY || ''
  };
}

export async function run(sample, { fetchImpl = fetch, timeoutMs = 20_000 } = {}) {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: headers(),
      body: JSON.stringify({
        ...toMathpixStrokes(sample.strokes),
        formats: ['latex_styled', 'text'],
        // Never let a benchmark image be kept for vendor QA. This is the same
        // flag production would set, and it is on by default here on purpose.
        metadata: { improve_mathpix: false }
      })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.error) {
      return reading({
        engine: id, latencyMs: performance.now() - started, costUsd: MATHPIX.strokesPerRequest,
        error: body?.error || `HTTP ${response.status}`, raw: body
      });
    }

    const source = body?.latex_styled || body?.text || '';
    const block = latexBlockToLines(source);
    const confidence = Number.isFinite(Number(body?.confidence)) ? Number(body.confidence) : 0;
    return reading({
      engine: id,
      lines: block.lines.map(text => ({ text, confidence })),
      confidence,
      needsConfirmation: confidence < 0.82,
      latencyMs: performance.now() - started,
      costUsd: MATHPIX.strokesPerRequest,
      residue: block.residue,
      raw: { latex_styled: body?.latex_styled, confidence: body?.confidence, confidence_rate: body?.confidence_rate, is_handwritten: body?.is_handwritten }
    });
  } catch (error) {
    const aborted = error?.name === 'AbortError';
    return reading({
      engine: id, latencyMs: performance.now() - started, costUsd: aborted ? MATHPIX.strokesPerRequest : 0,
      error: aborted ? 'timeout' : String(error?.message || error)
    });
  } finally {
    clearTimeout(timer);
  }
}

/** One call that answers "does v3/strokes return more than one line at all?" */
export async function multilineProbe(sample, options) {
  const result = await run(sample, options);
  return {
    sampleLines: String(sample.target || '').split('\n').length,
    returnedLines: result.lines.length,
    multilineSupported: result.lines.length > 1,
    text: result.text,
    error: result.error
  };
}
