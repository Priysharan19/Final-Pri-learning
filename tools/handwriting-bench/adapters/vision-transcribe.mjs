// ─────────────────────────────────────────────────────────────────────────────
// Multimodal transcription · OpenAI / Gemini / Anthropic, one code path
//
// Every provider is sent the SAME picture, the SAME system instructions and the
// SAME JSON schema — imported from production (server/platform/handwritingProvider.js)
// rather than rewritten here. Two reasons:
//
//   1. Fairness. A provider that got a hand-tuned prompt would be measuring the
//      prompt. Whatever this study concludes has to survive the observation
//      that one candidate was written more carefully than the others.
//   2. Relevance. Pri does not want to know which model transcribes best in the
//      abstract; it wants to know which model transcribes best through the
//      contract Pri already ships. That is this schema and these instructions.
//
// All three are called over raw HTTP rather than through vendor SDKs, on
// purpose: a shared transport is the only way latency and failure handling stay
// comparable, and the benchmark adds no dependencies to a production repo.
// ─────────────────────────────────────────────────────────────────────────────
import { SYSTEM_INSTRUCTIONS, TRANSCRIPTION_SCHEMA } from '../../../server/platform/handwritingProvider.js';
import { reading } from '../contract.mjs';
import { tokenCost } from '../cost.mjs';

export const kind = 'recognition';
export const inputs = ['raster'];

const USER_TEXT = 'Transcribe every line of handwriting in this image. Do not solve it.';

export const PROVIDERS = Object.freeze({
  openai: {
    envKeys: ['PRI_BENCH_OPENAI_API_KEY'],
    defaultModel: 'gpt-5.6-terra',
    endpoint: () => 'https://api.openai.com/v1/responses',
    headers: () => ({ 'content-type': 'application/json', authorization: `Bearer ${process.env.PRI_BENCH_OPENAI_API_KEY || ''}` }),
    body: (model, dataUrl, schema) => ({
      model,
      store: false,
      reasoning: { effort: 'low' },
      input: [
        { role: 'system', content: [{ type: 'input_text', text: SYSTEM_INSTRUCTIONS }] },
        { role: 'user', content: [{ type: 'input_text', text: USER_TEXT }, { type: 'input_image', image_url: dataUrl, detail: 'high' }] }
      ],
      text: { format: { type: 'json_schema', name: 'pri_handwriting_transcription', strict: true, schema } }
    }),
    usage: body => ({ inputTokens: body?.usage?.input_tokens, outputTokens: body?.usage?.output_tokens })
  },

  gemini: {
    envKeys: ['PRI_BENCH_GEMINI_API_KEY'],
    defaultModel: 'gemini-2.5-pro',
    endpoint: model => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    headers: () => ({ 'content-type': 'application/json', 'x-goog-api-key': process.env.PRI_BENCH_GEMINI_API_KEY || '' }),
    body: (model, dataUrl, schema) => ({
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTIONS }] },
      contents: [{
        role: 'user',
        parts: [
          { text: USER_TEXT },
          { inlineData: { mimeType: mimeOf(dataUrl), data: base64Of(dataUrl) } }
        ]
      }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: geminiSchema(schema) }
    }),
    usage: body => ({ inputTokens: body?.usageMetadata?.promptTokenCount, outputTokens: body?.usageMetadata?.candidatesTokenCount })
  },

  anthropic: {
    envKeys: ['PRI_BENCH_ANTHROPIC_API_KEY'],
    defaultModel: 'claude-opus-5',
    endpoint: () => 'https://api.anthropic.com/v1/messages',
    headers: () => ({
      'content-type': 'application/json',
      'x-api-key': process.env.PRI_BENCH_ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01'
    }),
    body: (model, dataUrl, schema) => ({
      model,
      max_tokens: 4096,
      system: SYSTEM_INSTRUCTIONS,
      output_config: { format: { type: 'json_schema', schema }, effort: 'low' },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeOf(dataUrl), data: base64Of(dataUrl) } },
          { type: 'text', text: USER_TEXT }
        ]
      }]
    }),
    usage: body => ({ inputTokens: body?.usage?.input_tokens, outputTokens: body?.usage?.output_tokens })
  }
});

const base64Of = dataUrl => String(dataUrl).slice(String(dataUrl).indexOf(',') + 1);
const mimeOf = dataUrl => (String(dataUrl).match(/^data:([^;]+);/) || [, 'image/png'])[1];

/** Gemini's schema dialect rejects `additionalProperties`; strip it, keep the rest. */
function geminiSchema(schema) {
  const walk = node => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return node;
    const out = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === 'additionalProperties') continue;
      out[key] = walk(value);
    }
    return out;
  };
  return walk(schema);
}

/**
 * Pull the transcription JSON out of whichever envelope came back.
 *
 * Deliberately tolerant. Structured-output field names differ between
 * providers and move between API versions, and a benchmark that scored a
 * correct transcription as a parse failure would be measuring this file.
 */
export function extractJson(body) {
  const candidates = [
    body?.output_parsed,
    body?.output?.[0]?.content?.[0]?.parsed,
    body?.candidates?.[0]?.content?.parts?.[0]?.text,
    body?.content?.find?.(b => b?.type === 'text')?.text,
    body?.output_text,
    body?.output?.flatMap?.(o => o?.content || [])?.find?.(c => c?.type === 'output_text')?.text
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object') return candidate;
    if (typeof candidate === 'string') {
      const parsed = parseLoose(candidate);
      if (parsed) return parsed;
    }
  }
  return null;
}

function parseLoose(text) {
  try { return JSON.parse(text); } catch { /* fall through to a fenced or embedded object */ }
  const match = String(text).match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

export function make(providerName, { model = null } = {}) {
  const provider = PROVIDERS[providerName];
  if (!provider) throw new Error(`unknown vision provider: ${providerName}`);
  const chosen = model || provider.defaultModel;
  return {
    id: `vision-transcribe:${providerName}:${chosen}`,
    kind,
    inputs,
    envKeys: provider.envKeys,
    async run(sample, { fetchImpl = fetch, timeoutMs = 30_000 } = {}) {
      const id = `vision-transcribe:${providerName}:${chosen}`;
      const started = performance.now();
      if (!sample.raster?.dataUrl) return reading({ engine: id, error: 'no-raster', costUsd: 0, latencyMs: 0 });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(provider.endpoint(chosen), {
          method: 'POST',
          signal: controller.signal,
          headers: provider.headers(),
          body: JSON.stringify(provider.body(chosen, sample.raster.dataUrl, TRANSCRIPTION_SCHEMA))
        });
        const body = await response.json().catch(() => null);
        const usage = provider.usage(body);
        const costUsd = tokenCost(chosen, usage);
        if (!response.ok) {
          return reading({ engine: id, latencyMs: performance.now() - started, costUsd, error: body?.error?.message || `HTTP ${response.status}`, raw: body });
        }
        const parsed = extractJson(body);
        if (!parsed?.lines) {
          return reading({ engine: id, latencyMs: performance.now() - started, costUsd, error: 'unparseable-response', raw: body });
        }
        const lines = (parsed.lines || []).map(line => ({
          text: String(line?.text || ''),
          latex: line?.latex || null,
          confidence: Number(line?.confidence) || 0
        }));
        const stated = Number(parsed.confidence) || 0;
        const worst = lines.length ? Math.min(...lines.map(l => l.confidence)) : 0;
        return reading({
          engine: id,
          lines,
          // Production's rule: a page is only as readable as its worst line.
          confidence: lines.length ? Math.min(stated, worst) : 0,
          needsConfirmation: parsed.needs_confirmation === true || !lines.length || Math.min(stated, worst) < 0.82,
          latencyMs: performance.now() - started,
          costUsd,
          raw: { usage, model: chosen }
        });
      } catch (error) {
        const aborted = error?.name === 'AbortError';
        return reading({ engine: id, latencyMs: performance.now() - started, costUsd: null, error: aborted ? 'timeout' : String(error?.message || error) });
      } finally {
        clearTimeout(timer);
      }
    }
  };
}
