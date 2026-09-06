// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · asking a server to read the ink
//
// The on-device reader has 58 classes and no comma, so a line like
// "−1, 0, 1, 2, 4" cannot come back right however well it is written. This is
// the other route, and it runs only when the student has turned it on.
//
// Four rules hold it in place:
//
//   1. Off by default. Nothing leaves the device until the student says so.
//   2. It never replaces a reading the student has corrected by hand. A tap to
//      fix a glyph is the most reliable signal on the page.
//   3. It only supersedes when the server says it is confident. An unconfident
//      server read is offered for confirmation, never marked.
//   4. The local reading is published first and always. The student writes and
//      sees their working immediately; the server read arrives after, or not
//      at all, and the app is usable either way.
//
// The picture is drawn from the student's own strokes by cloudRaster.js. This
// module adds nothing to it, and sends nothing beside it.
// ─────────────────────────────────────────────────────────────────────────────
import { cloud, cloudAvailable } from '../platform/cloudTransport.js';
import { rasterizeInk } from './cloudRaster.js';
import { preparePhoto } from './photoRaster.js';

/** How the returned reading is labelled, so History and evidence can tell. */
export const CLOUD_ENGINE_PREFIX = 'cloud';

/**
 * Two separate conditions, kept separate on purpose: the student opted in, and
 * this deployment actually has somewhere to send it. `available` is injectable
 * so the contract can be tested without a configured origin.
 */
export function cloudReadingEnabled(user, { available = cloudAvailable } = {}) {
  if (user?.cloudHandwriting !== true) return false;
  try { return available() === true; } catch { return false; }
}

/**
 * Turn a server transcription into the reading shape the ink surface publishes.
 *
 * Line geometry comes from the local reading, because the server returns text
 * without coordinates and the ✓/✗ annotations are drawn on the student's own
 * lines. Where the two disagree about how many lines there are, the boxes are
 * dropped rather than guessed: an annotation on the wrong line is worse than
 * none.
 */
export function toReading(transcription, localReading) {
  const lines = (transcription?.lines || []).map(line => ({ text: String(line.text || '') }));
  if (!lines.length) return null;

  const localLines = localReading?.lines || [];
  const alignable = localLines.length === lines.length;
  return {
    lines: lines.map((line, i) => ({
      text: line.text,
      box: alignable ? localLines[i]?.box : undefined,
      conf: transcription.lines[i]?.confidence ?? transcription.confidence ?? 0
    })),
    text: lines.map(l => l.text).join('\n'),
    engine: transcription.engine || `${CLOUD_ENGINE_PREFIX}-unknown`,
    cloud: true,
    confidence: transcription.confidence ?? 0,
    needsConfirmation: transcription.needsConfirmation !== false,
    alignedToLocalLines: alignable
  };
}

/**
 * Read the strokes on the server. Resolves to null whenever the answer is
 * "carry on with the local reading" — not enabled, nothing written, offline,
 * refused, superseded by newer writing. It never throws into the ink surface.
 */
export async function readWithCloud(strokes, {
  user,
  signal = null,
  transport = cloud,
  rasterize = rasterizeInk,
  available = cloudAvailable
} = {}) {
  if (!cloudReadingEnabled(user, { available })) return null;

  let raster = null;
  try { raster = rasterize(strokes); } catch { return null; }
  if (!raster?.dataUrl) return null;

  try {
    const response = await transport.transcribeHandwriting(raster.dataUrl, { signal });
    const transcription = response?.transcription;
    if (!transcription?.lines?.length) return null;
    return { transcription, raster: { width: raster.width, height: raster.height, bytes: raster.bytes } };
  } catch (error) {
    // A refusal is information for the setting screen, not an error the student
    // should meet mid-question: the local reading is already on screen.
    return { error: { code: error?.code || 'HANDWRITING_FAILED', message: error?.message || '' } };
  }
}

/**
 * Should this server reading replace what is on screen?
 *
 * Deliberately conservative. It says no to a reading the student has corrected,
 * no to an unconfident one, and no to one that agrees with the local reading
 * anyway, because replacing a reading with an identical one only makes the
 * screen flicker.
 */
export function shouldSupersede(cloudReading, localReading, { hasManualCorrections = false } = {}) {
  if (!cloudReading || hasManualCorrections) return false;
  if (cloudReading.needsConfirmation) return false;
  if (!cloudReading.text.trim()) return false;
  const normalise = t => String(t || '').replace(/\s+/g, ' ').trim();
  return normalise(cloudReading.text) !== normalise(localReading?.text);
}

/**
 * Read a photograph of working done on paper.
 *
 * The same route and the same reader as the ink, because to the reader they are
 * both just an image of handwriting. This is the input most students actually
 * have — a page of an exercise book — and until now the browser build could
 * attach a photo and never read it, while the iPad build read it with an OCR
 * engine built for printed text.
 *
 * Returns null for every "carry on without it" case; never throws.
 */
export async function readPhotoWithCloud(dataUrl, {
  user,
  signal = null,
  transport = cloud,
  prepare = preparePhoto,
  available = cloudAvailable
} = {}) {
  if (!cloudReadingEnabled(user, { available })) return null;

  let prepared = null;
  try { prepared = await prepare(dataUrl); } catch { return null; }
  if (!prepared?.dataUrl) return null;

  try {
    const response = await transport.transcribeHandwriting(prepared.dataUrl, { signal });
    const transcription = response?.transcription;
    if (!transcription?.lines?.length) return null;
    return {
      transcription,
      photo: { width: prepared.width, height: prepared.height, bytes: prepared.bytes, quality: prepared.quality }
    };
  } catch (error) {
    return { error: { code: error?.code || 'HANDWRITING_FAILED', message: error?.message || '' } };
  }
}
