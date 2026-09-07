// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · handwriting benchmark · one picture, every image candidate
//
// Mathpix's image endpoint and every multimodal model are scored on the SAME
// PNG, produced by production's own rasteriser (client/src/ink/cloudRaster.js)
// with a Node canvas injected through the `createCanvas` hook it already
// exposes. Nothing here reimplements the drawing.
//
// This matters more than it looks. Ink rendered at a different scale, stroke
// width or padding is a different recognition problem, and a benchmark that
// gave each vendor its own rasteriser would be comparing rasterisers. It also
// means the picture measured here is the picture production would send — a
// 700 kB budget, the same padding, the same downscale ladder.
// ─────────────────────────────────────────────────────────────────────────────
import { createRequire } from 'node:module';
import { rasterizeInk } from '../../client/src/ink/cloudRaster.js';

const require = createRequire(new URL('../../client/', import.meta.url));

let canvasFactory = null;
function factory() {
  if (canvasFactory) return canvasFactory;
  try {
    const { createCanvas } = require('@napi-rs/canvas');
    canvasFactory = (width, height) => createCanvas(width, height);
  } catch (error) {
    throw new Error(
      '@napi-rs/canvas is required to rasterize ink outside a browser. ' +
      'It ships with the client dev dependencies: npm install --prefix client'
    );
  }
  return canvasFactory;
}

/** The production raster of a sample's strokes, or null if it cannot be drawn. */
export function rasterOf(strokes) {
  return rasterizeInk(strokes, { createCanvas: factory() });
}

/** Mathpix's own byte ceiling on a base64 image is 2 MB; Pri's raster is 700 kB. */
export const MATHPIX_MAX_BASE64_BYTES = 2_000_000;
