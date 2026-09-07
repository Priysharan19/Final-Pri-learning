// Pri's own on-device recogniser — the incumbent, and the reference every other
// candidate has to beat to justify a bill. Runs offline, costs nothing, and is
// scored through exactly the same contract as the paid candidates.
import { recognize } from '../../../client/src/ink/recognizer.js';
import { reading } from '../contract.mjs';

export const id = 'pri-local';
export const kind = 'recognition';
export const envKeys = [];
export const inputs = ['strokes'];

export async function run(sample) {
  const started = performance.now();
  try {
    const result = recognize(sample.strokes);
    const lines = (result?.lines?.length ? result.lines : [{ text: result?.text || '' }])
      .map(line => ({ text: String(line?.text || ''), confidence: line?.conf ?? result?.minConf ?? 0 }));
    return reading({
      engine: id,
      lines,
      confidence: Number.isFinite(result?.minConf) ? result.minConf : 0,
      // The production confirmation boundary, not a benchmark invention.
      needsConfirmation: !(Number(result?.minConf) >= 0.55 && Number(result?.margin) >= 0.15),
      latencyMs: performance.now() - started,
      costUsd: 0,
      raw: { engine: result?.engine, minConf: result?.minConf, margin: result?.margin }
    });
  } catch (error) {
    return reading({ engine: id, latencyMs: performance.now() - started, costUsd: 0, error: String(error?.message || error) });
  }
}
