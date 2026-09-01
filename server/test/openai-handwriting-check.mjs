import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  extractResponseText,
  normalizePriText,
  transcribeMathHandwriting,
  validateImageDataUrl
} from '../cloud/openaiHandwriting.mjs';

const image = `data:image/png;base64,${Buffer.alloc(96, 7).toString('base64')}`;

function openAIResponse(payload, id = 'resp_test') {
  return {
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify({
        id,
        output: [{
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: JSON.stringify(payload) }]
        }],
        usage: { input_tokens: 600, output_tokens: 40, total_tokens: 640 }
      });
    }
  };
}

function makeFetch(payloads, calls) {
  let index = 0;
  return async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), headers: init.headers, signal: init.signal });
    const payload = payloads[index++];
    if (!payload) throw new Error('unexpected extra OpenAI call');
    return openAIResponse(payload, `resp_${index}`);
  };
}

function transcription(text, confidence, needsConfirmation = false) {
  return {
    lines: [{ text, latex: text, confidence, kind: 'math' }],
    overall_confidence: confidence,
    needs_confirmation: needsConfirmation
  };
}

// Input validation is strict enough that an arbitrary URL or HTML blob cannot
// be turned into an OpenAI image request.
assert.equal(validateImageDataUrl(image), 96);
assert.throws(() => validateImageDataUrl('https://example.com/ink.png'), /data URL/);

// Common visual math glyphs are normalized into Pri's existing parser syntax.
assert.equal(normalizePriText('θ = 3π / 4'), 'theta = 3pi / 4');
assert.equal(normalizePriText('\\sin θ \\le 1'), 'sin theta <= 1');

assert.equal(extractResponseText({
  output: [{ type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }]
}), '{"ok":true}');

// A confident Terra read is one request, answer-blind, store:false, image-only
// apart from the stable transcription instruction. It must not "fix" wrong math.
// OCR uses no reasoning and high-detail image input: the latency-oriented GPT-5.6
// configuration deliberately avoids paying reasoning time for visual extraction.
{
  const calls = [];
  const result = await transcribeMathHandwriting(image, {
    apiKey: 'test-key',
    fetchImpl: makeFetch([transcription('2+2=5', 0.98)], calls)
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.model, 'gpt-5.6-terra');
  assert.equal(calls[0].body.store, false);
  assert.equal(calls[0].body.reasoning.effort, 'none');
  assert.equal(calls[0].body.max_output_tokens, 900);
  assert.equal(calls[0].body.input[0].content[1].type, 'input_image');
  assert.equal(calls[0].body.input[0].content[1].detail, 'high');
  assert.equal(calls[0].body.text.format.type, 'json_schema');
  assert.equal(result.text, '2+2=5');
  assert.equal(result.needsConfirmation, false);
  assert.equal(result.engine, 'openai-gpt-5.6-terra');
  assert.equal(result.usage.length, 1);
  assert.equal(typeof result.usage[0].latencyMs, 'number');
}

// A doubtful Terra read escalates to Sol. Agreement plus a strong fallback is
// allowed through without asking the student for an unnecessary extra tap.
{
  const calls = [];
  const result = await transcribeMathHandwriting(image, {
    apiKey: 'test-key',
    fetchImpl: makeFetch([
      transcription('theta=(3pi)/(4)', 0.70, true),
      transcription('theta=(3pi)/(4)', 0.97, false)
    ], calls)
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].body.model, 'gpt-5.6-sol');
  assert.equal(calls[1].body.reasoning.effort, 'none');
  assert.equal(result.text, 'theta=(3pi)/(4)');
  assert.equal(result.needsConfirmation, false);
  assert.equal(result.engine, 'openai-gpt-5.6-sol');
}

// When Terra and Sol disagree, the service may expose the better candidate for
// evidence but it must destroy auto-mark certainty. InkAnswer therefore leaves
// the existing local correction path in charge instead of silently submitting.
{
  const calls = [];
  const result = await transcribeMathHandwriting(image, {
    apiKey: 'test-key',
    fetchImpl: makeFetch([
      transcription('x=7', 0.65, true),
      transcription('x=1', 0.98, false)
    ], calls)
  });
  assert.equal(calls.length, 2);
  assert.equal(result.disagreement, true);
  assert.equal(result.needsConfirmation, true);
  assert.equal(result.minConf, 0);
  assert.equal(result.candidateReadings.length, 2);
}

// A cancelled browser/gateway request must actually abort the OpenAI request,
// not merely ignore the eventual result after paying its full latency/cost.
{
  const controller = new AbortController();
  let upstreamSignal = null;
  const pending = transcribeMathHandwriting(image, {
    apiKey: 'test-key',
    signal: controller.signal,
    fetchImpl: async (_url, init) => {
      upstreamSignal = init.signal;
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      });
    }
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  controller.abort();
  await assert.rejects(pending, /aborted/i);
  assert.equal(upstreamSignal?.aborted, true);
}

// Lock the client-side smoothness contract without needing a browser DOM in CI:
// no second human-scale debounce, stale requests are explicitly cancellable,
// and uncertain cloud readings cannot overwrite the local answer.
{
  const cloudClientUrl = new URL('../../client/src/ink/cloud.js', import.meta.url);
  const cloudClient = await readFile(fileURLToPath(cloudClientUrl), 'utf8');
  const settle = /const CLOUD_SETTLE_MS = (\d+);/.exec(cloudClient);
  assert.ok(settle, 'cloud settle constant must remain explicit');
  assert.ok(Number(settle[1]) <= 200, 'cloud client must not reintroduce a long second debounce');
  assert.match(cloudClient, /export function cancelCloudRecognition\(\)/);
  assert.match(cloudClient, /needsConfirmation:\s*requiresConfirmation/);
  assert.match(cloudClient, /requestGeneration\s*\+=\s*1/);
  assert.match(cloudClient, /target\.closest\('\.ink-wrap'\)/);
}

// No secret means no accidental direct API use from a checkout or CI worker,
// even if the developer happens to have OPENAI_API_KEY exported in their shell.
{
  const saved = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await assert.rejects(
      () => transcribeMathHandwriting(image, { fetchImpl: async () => { throw new Error('must not run'); } }),
      /OPENAI_API_KEY/
    );
  } finally {
    if (saved === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = saved;
  }
}

console.log('OpenAI handwriting contract: PASS');
