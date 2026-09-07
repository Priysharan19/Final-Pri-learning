// ─────────────────────────────────────────────────────────────────────────────
// Architecture B (front half) · Mathpix v3/text on the production raster
//
// Scored on the same PNG as every multimodal candidate, so this measures the
// recogniser rather than the picture.
//
// `include_line_data` is the reason this candidate is interesting beyond
// accuracy: it returns a bounding box (`cnt`) per line. Pri's ✓/✗ overlay is
// drawn on the student's own line geometry, and today the cloud path can only
// keep those boxes when the server happens to split the page into the same
// number of lines as the local reader (client/src/ink/cloudReader.js,
// `alignedToLocalLines`). A reader that returns real coordinates removes that
// coin-flip. Whether it is worth paying for is what the marking metrics decide.
// ─────────────────────────────────────────────────────────────────────────────
import { reading } from '../contract.mjs';
import { latexToLinear } from '../latex.mjs';
import { MATHPIX } from '../cost.mjs';
import { MATHPIX_MAX_BASE64_BYTES } from '../raster.mjs';

export const id = 'mathpix-image';
export const kind = 'recognition';
export const envKeys = ['PRI_BENCH_MATHPIX_APP_ID', 'PRI_BENCH_MATHPIX_APP_KEY'];
export const inputs = ['raster'];

const ENDPOINT = 'https://api.mathpix.com/v3/text';

/** Line types that are not a line of the student's working. */
const NON_TEXT_TYPES = new Set(['diagram', 'chart', 'table', 'equation_number', 'page_info']);

/** Centre of a Mathpix `cnt` contour, in the raster's pixel space. */
function boxOf(cnt) {
  if (!Array.isArray(cnt) || !cnt.length) return null;
  const xs = cnt.map(p => Number(p?.[0])).filter(Number.isFinite);
  const ys = cnt.map(p => Number(p?.[1])).filter(Number.isFinite);
  if (!xs.length || !ys.length) return null;
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export async function run(sample, { fetchImpl = fetch, timeoutMs = 20_000 } = {}) {
  const started = performance.now();
  if (!sample.raster?.dataUrl) {
    return reading({ engine: id, error: 'no-raster', costUsd: 0, latencyMs: 0 });
  }
  if (sample.raster.bytes > MATHPIX_MAX_BASE64_BYTES) {
    return reading({ engine: id, error: 'image-too-large-for-mathpix', costUsd: 0, latencyMs: 0 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        app_id: process.env.PRI_BENCH_MATHPIX_APP_ID || '',
        app_key: process.env.PRI_BENCH_MATHPIX_APP_KEY || ''
      },
      body: JSON.stringify({
        src: sample.raster.dataUrl,
        formats: ['text'],
        include_line_data: true,
        // Text inside a geometry sketch is part of the student's answer.
        include_diagram_text: true,
        rm_spaces: true,
        metadata: { improve_mathpix: false }
      })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.error) {
      return reading({
        engine: id, latencyMs: performance.now() - started, costUsd: MATHPIX.imagePerRequest,
        error: body?.error || `HTTP ${response.status}`, raw: body
      });
    }

    const residue = new Set();
    const lines = [];
    let diagrams = 0;
    for (const line of body?.line_data || []) {
      if (line?.included === false) continue;
      if (NON_TEXT_TYPES.has(line?.type)) { if (line?.type === 'diagram' || line?.type === 'chart') diagrams++; continue; }
      const converted = latexToLinear(line?.text || '');
      if (!converted.text) continue;
      converted.residue.forEach(r => residue.add(r));
      lines.push({
        text: converted.text,
        latex: line?.text || null,
        confidence: Number.isFinite(Number(line?.confidence)) ? Number(line.confidence) : Number(line?.confidence_rate) || 0,
        box: boxOf(line?.cnt)
      });
    }

    const confidence = Number.isFinite(Number(body?.confidence)) ? Number(body.confidence) : 0;
    return reading({
      engine: id,
      lines,
      confidence,
      needsConfirmation: confidence < 0.82,
      latencyMs: performance.now() - started,
      costUsd: MATHPIX.imagePerRequest,
      residue: [...residue],
      raw: {
        confidence: body?.confidence,
        confidence_rate: body?.confidence_rate,
        is_handwritten: body?.is_handwritten,
        lineCount: (body?.line_data || []).length,
        diagramRegions: diagrams,
        // Recorded because a reader that returns geometry is worth more to Pri
        // than one that does not, independent of its accuracy.
        boxesReturned: lines.filter(l => l.box).length
      }
    });
  } catch (error) {
    const aborted = error?.name === 'AbortError';
    return reading({
      engine: id, latencyMs: performance.now() - started, costUsd: aborted ? MATHPIX.imagePerRequest : 0,
      error: aborted ? 'timeout' : String(error?.message || error)
    });
  } finally {
    clearTimeout(timer);
  }
}
