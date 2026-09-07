// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Cloud marking client — the working, marked line by line.
//
// This is the other half of the pair. cloud.js sends ink to be TRANSCRIBED and
// deliberately withholds the question, because a transcriber that knows the
// answer will hallucinate its way towards it. This file sends ink to be MARKED,
// and deliberately supplies the question, the official answer and the mark
// scheme — because a marker that does not know them is guessing at a rubric
// the engine already wrote down.
//
// The trade that makes the difference: transcription has to recover notation
// exactly, and one wrong glyph loses the mark. Marking only has to decide
// whether each criterion's work is present and right, which survives a misread
// digit inside an otherwise correct line. Measured on real ink, transcription
// reads 60.0% of lines exactly; marking never has to.
//
// What is NOT decided here: whether the final answer is correct. checkAnswer()
// owns that, on device, offline, and keeps owning it. If this whole file fails
// — no network, no key, quota spent, gateway down — the student still gets a
// marked question, from the local engine, exactly as before. That is the rule
// every branch below is written to keep.
// ─────────────────────────────────────────────────────────────────────────────

import { cloudGatewayBase, cloudClientToken, rasterizeInkForCloud, MARKING_RASTER_CAPS } from './cloud.js';

const REQUEST_TIMEOUT_MS = 45000;

/** Marking is available exactly when the gateway is. One switch, both routes. */
export function markingConfigured() {
  return Boolean(cloudGatewayBase());
}

/**
 * Failure is a first-class result here, not an exception. Every caller is on
 * the submit path, where the local mark is already computed and the only
 * question is whether to enrich it — so a marking failure must be a value the
 * caller can ignore, never a throw that takes the submission down with it.
 */
function unavailable(reason, detail = '') {
  return { ok: false, reason, detail, marked: null };
}

/**
 * Mark one page of handwritten working against the question it answers.
 *
 * Two inputs, one path. `strokes` is the Apple Pencil case and gets rasterised
 * here; `image` is a photo the student took of paper, already a data URL.
 *
 * The photo case is not a lesser fallback — for most of the students this is
 * built for it is the only case. An Apple Pencil is rare and a phone camera is
 * universal, and a page of working photographed off an exercise book carries
 * exactly what the marker needs. The stroke path buys lower latency and a
 * cleaner raster, nothing more.
 *
 * @param {object}   opts
 * @param {Array}    [opts.strokes]  Canvas strokes, [{ points: [{x,y,w}] }, …]
 * @param {string}   [opts.image]    A photo of the working, as a data URL.
 * @param {object}   opts.question   { prompt, criteria, officialAnswer, workedSteps }
 * @param {AbortSignal} [opts.signal]
 */
export async function markWorking({ strokes, image, question, signal }) {
  const base = cloudGatewayBase();
  if (!base) return unavailable('not-configured');

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return unavailable('offline');
  }
  if (!String(question?.prompt || '').trim()) return unavailable('no-question');

  let payloadImage = '';
  let rasterSize = null;
  if (typeof image === 'string' && image.startsWith('data:image/')) {
    payloadImage = image;
  } else if (Array.isArray(strokes) && strokes.length) {
    // Smaller raster than transcription uses: marking pays per image tile and
    // reads school handwriting no better at the larger size. See cloud.js.
    const raster = rasterizeInkForCloud(strokes, MARKING_RASTER_CAPS);
    if (!raster?.image) return unavailable('raster-failed');
    payloadImage = raster.image;
    rasterSize = { width: raster.width, height: raster.height };
  } else {
    return unavailable('no-ink');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    const token = cloudClientToken();
    const response = await fetch(`${base}/v1/working/mark`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        image: payloadImage,
        question: {
          prompt: question.prompt,
          criteria: question.criteria,
          officialAnswer: question.officialAnswer,
          workedSteps: question.workedSteps
        }
      })
    });

    const body = await response.json().catch(() => null);

    if (response.status === 429) {
      return unavailable('rate-limited', body?.error || '');
    }
    if (!response.ok) {
      return unavailable('gateway-error', body?.error || `HTTP ${response.status}`);
    }
    if (!body || !Array.isArray(body.awards)) {
      return unavailable('malformed');
    }

    return { ok: true, reason: null, detail: '', marked: body, raster: rasterSize };
  } catch (error) {
    return unavailable(error?.name === 'AbortError' ? 'timeout' : 'network', String(error?.message || ''));
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

// ── Presentation ─────────────────────────────────────────────────────────────

/**
 * Reshape a marking into the report QuestionCard's StepReport already renders.
 *
 * Reusing that component rather than adding a second one is not only less code:
 * it means cloud-marked working and locally step-checked working look and read
 * the same to the student, so the feature degrades to the local path without
 * the page visibly changing shape underneath them.
 *
 * `unclear` deliberately maps to the neutral status, not the failing one. A
 * line the marker could not read is not a line the student got wrong, and
 * showing a cross against legible-but-unread work is the single most damaging
 * thing this feature could do.
 */
export function markingToStepReport(marked) {
  if (!marked?.lines?.length && !marked?.awards?.length) return null;

  const STATUS = { correct: 'ok', incorrect: 'break', incomplete: 'warn', unclear: 'warn' };

  const lines = (marked.lines || []).map(l => ({
    text: l.readsAs || '(unreadable)',
    status: STATUS[l.verdict] || 'warn',
    note: l.verdict === 'unclear'
      ? (l.comment || 'Pri could not read this line — it is not marked wrong.')
      : (l.comment || '')
  }));

  return {
    lines,
    source: 'cloud-marking',
    marksAwarded: marked.marksAwarded,
    marksAvailable: marked.marksAvailable,
    awards: marked.awards,
    overallComment: marked.overallComment,
    needsConfirmation: marked.needsConfirmation === true,
    confidence: marked.confidence
  };
}

/**
 * What to tell the student when marking did not run. Silence is wrong — they
 * wrote by hand expecting line-by-line marks — but so is an error dialog for
 * something that changes nothing about the mark they just received. One quiet
 * line, and never blame.
 */
export function markingUnavailableNote(reason) {
  switch (reason) {
    case 'offline':      return 'Marked on this device — line-by-line marking needs a connection.';
    case 'rate-limited': return 'Line-by-line marking is rested for now. Your answer was still marked.';
    case 'timeout':
    case 'network':
    case 'gateway-error':
    case 'malformed':    return 'Marked on this device — line-by-line marking could not be reached.';
    case 'no-ink':
    case 'raster-failed':
    case 'no-question':
    case 'not-configured':
    default:             return '';
  }
}
