// The candidate registry. Adding an architecture means adding a line here and
// nothing else — the runner, the metrics and the report are all adapter-blind.
import * as priLocal from './pri-local.mjs';
import * as mathpixImage from './mathpix-image.mjs';
import * as mathpixStrokes from './mathpix-strokes.mjs';
import * as visionTranscribe from './vision-transcribe.mjs';
import * as visionMark from './vision-mark.mjs';
import * as hybrid from './hybrid.mjs';
import * as priMark from './pri-mark.mjs';

export { priMark, hybrid, visionTranscribe, visionMark };

/**
 * The eight candidates the brief asks for, in its order. Anthropic is present
 * but off by default, matching the brief's "added afterwards if it provides
 * useful additional evidence" — it costs nothing to leave defined and it means
 * adding it later is a flag, not a code change.
 */
export function candidates({ includeAnthropic = false } = {}) {
  const list = [
    priLocal,                                              // 1. Pri current local recogniser
    mathpixImage,                                          // 2. Mathpix image recognition
    mathpixStrokes,                                        // 3. Mathpix digital ink
    visionTranscribe.make('openai'),                       // 4a. GPT transcription
    visionTranscribe.make('gemini'),                       // 5a. Gemini transcription
    visionMark.make('openai'),                             // 4b. GPT direct multimodal marking
    visionMark.make('gemini'),                             // 5b. Gemini direct multimodal marking
    hybrid.make('mathpix-image', 'vision-transcribe:openai:gpt-5.6-terra'),   // 7. Mathpix + GPT
    hybrid.make('mathpix-image', 'vision-transcribe:gemini:gemini-2.5-pro')   // 8. Mathpix + Gemini
  ];
  if (includeAnthropic) {
    list.push(visionTranscribe.make('anthropic'), visionMark.make('anthropic'),
      hybrid.make('mathpix-image', 'vision-transcribe:anthropic:claude-opus-5'));
  }
  return list;
}

/** Which env vars a chosen set of candidates needs, and which are absent. */
export function missingKeys(list) {
  const needed = new Set(list.flatMap(c => c.envKeys || []));
  return [...needed].filter(key => !String(process.env[key] || '').trim());
}

/**
 * Can this candidate actually run?
 *
 * A hybrid declares no keys of its own — it consumes readings its legs already
 * paid for. Judging it on its own (empty) key list would mark Architecture C
 * ready on a machine with no keys at all, which is the one place this harness
 * could quietly mislead about what it measured. Readiness is therefore
 * recursive: a hybrid is ready only when both legs are.
 */
export function isReady(candidate, list) {
  const keysPresent = (candidate.envKeys || []).every(k => String(process.env[k] || '').trim());
  if (!keysPresent) return false;
  if (!candidate.legs?.length) return true;
  return candidate.legs.every(legId => {
    const leg = list.find(c => c.id === legId);
    return leg ? isReady(leg, list) : false;
  });
}
