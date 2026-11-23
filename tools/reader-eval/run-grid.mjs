// Latency/accuracy grid for the server handwriting reader. SYNTHETIC images
// only (gen-images.mjs). One process, sequential calls, key read from
// PRI_HANDWRITING_API_KEY and never printed or written.
//   railway run --service Final-Pri-learning --environment production -- \
//     node tools/reader-eval/run-grid.mjs <configs.json> <out.jsonl> <imageRoot> [ids|all] [reps]
// configs.json: [{name, model, effort, detail, scale:'s2'|'s1', stream, prompt:'new'|'old', maxOut, tier}]
// `hint`: 'truth' | 'wrong' lists symbols beside the picture via the shipped userTextFor();
// 'truth' = the symbols of the written working (an OPTIMISTIC stand-in for a real stem's list),
// 'wrong' = three letters NOT in the working (does a misleading hint pull the reading?).
// `prompt:'old'` loads the instructions+schema from OLD_READER (a copy of the
// pre-change module), so before/after are measured by the same harness.
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CASES } from './cases.mjs';
import { scoreCase } from './score.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const KEY = String(process.env.PRI_HANDWRITING_API_KEY || '').trim();
if (!KEY) { console.error('NOT MEASURED: no provider key'); process.exit(2); }
const [configsPath, outPath, imageRoot, idsArg = 'all', repsArg = '1'] = process.argv.slice(2);
const configs = JSON.parse(readFileSync(configsPath, 'utf8'));
const ids = idsArg === 'all' ? CASES.map(c => c.id) : idsArg.split(',');
const reps = Number(repsArg) || 1;
const BUDGET_USD = Number(process.env.GRID_BUDGET_USD || 2.5);
// Upper-bound price assumption (UNCONFIRMED): US$2 / 1M input, US$10 / 1M output.
const usd = u => ((u.input || 0) * 2 + (u.output || 0) * 10) / 1e6;

const newer = await import(pathToFileURL(resolve(HERE, '../../server/platform/handwritingProvider.js')));
const older = process.env.OLD_READER ? await import(pathToFileURL(resolve(process.env.OLD_READER))) : null;

let spent = 0, calls = 0;
if (existsSync(outPath)) for (const l of readFileSync(outPath, 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(l); spent += usd(r.usage || {}); calls += 1; }

function hintFor(c, mode) {
  let text = c.lines.join(' ').replace(/sqrt\[|int\[/g, ' ');
  for (const w of c.words || []) text = text.replace(new RegExp(`\\b${w}\\b`, 'gi'), ' ');
  const own = new Set();
  for (const m of text.matchAll(/(sin|cos|tan|ln|log)|([A-Za-z])|([πθ])/g)) own.add(m[1] || m[2] || m[3]);
  // a stem would list the working's variables and constants: 'truth' is that, as an upper bound
  if (mode === 'truth') return [...own].slice(0, 12);
  return ['n', 'z', 'u', 'k'].filter(t => !own.has(t)).slice(0, 3);
}
async function one(cfg, c, rep) {
  const mod = cfg.prompt === 'old' ? older : newer;
  const dataUrl = 'data:image/png;base64,' + readFileSync(join(imageRoot, cfg.scale || 's2', `${c.id}.png`)).toString('base64');
  const body = {
    model: cfg.model, store: false,
    input: [
      { role: 'system', content: [{ type: 'input_text', text: mod.SYSTEM_INSTRUCTIONS }] },
      { role: 'user', content: [
        { type: 'input_text', text: cfg.hint && mod.userTextFor ? mod.userTextFor(hintFor(c, cfg.hint)) : 'Transcribe every line of working in this image, whether handwritten, typed or printed. Do not solve it.' },
        { type: 'input_image', image_url: dataUrl, detail: cfg.detail || 'high' }] }
    ],
    text: { format: { type: 'json_schema', name: 'pri_handwriting_transcription', strict: true, schema: mod.TRANSCRIPTION_SCHEMA } }
  };
  if (cfg.effort) body.reasoning = { effort: cfg.effort };
  if (cfg.maxOut) body.max_output_tokens = cfg.maxOut;
  if (cfg.tier) body.service_tier = cfg.tier;
  if (cfg.verbosity) body.text.verbosity = cfg.verbosity;
  if (cfg.stream) body.stream = true;
  const t0 = performance.now();
  let status = 0, ttft = null, text = null, usage = {}, err = null, tier = null;
  try {
    const res = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
    status = res.status;
    if (!res.ok) err = (await res.text()).slice(0, 300).replace(KEY, '[key]');
    else if (cfg.stream) {
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''; let out = '';
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i; while ((i = buf.indexOf('\n\n')) >= 0) {
          const ev = buf.slice(0, i); buf = buf.slice(i + 2);
          const data = ev.split('\n').find(l => l.startsWith('data: ')); if (!data) continue;
          let j; try { j = JSON.parse(data.slice(6)); } catch { continue; }
          if (j.type === 'response.output_text.delta') { if (ttft === null) ttft = performance.now() - t0; out += j.delta; }
          if (j.type === 'response.completed') { usage = j.response?.usage || {}; tier = j.response?.service_tier || null; }
        }
      }
      text = out;
    } else {
      const j = await res.json(); tier = j.service_tier || null; usage = j.usage || {};
      text = j.output_text ?? j.output?.flatMap(i => i?.content || []).find(p => typeof p?.text === 'string')?.text ?? null;
    }
  } catch (e) { err = String(e?.name || e).slice(0, 80); }
  const ms = Math.round(performance.now() - t0);
  let parsed = null; try { parsed = JSON.parse(text); } catch { /* scored as failure */ }
  const u = { input: usage.input_tokens, output: usage.output_tokens, reasoning: usage.output_tokens_details?.reasoning_tokens };
  return { config: cfg.name, id: c.id, rep, status, ms, ttft: ttft === null ? null : Math.round(ttft), usage: u, tier, err, parsed, score: parsed ? scoreCase(c, parsed) : null };
}

for (const cfg of configs) {
  for (let rep = 0; rep < reps; rep += 1) for (const id of ids) {
    if (spent >= BUDGET_USD || calls >= 400) { console.log('BUDGET STOP', { spent: spent.toFixed(3), calls }); process.exit(0); }
    const r = await one(cfg, CASES.find(c => c.id === id), rep);
    spent += usd(r.usage); calls += 1;
    appendFileSync(outPath, JSON.stringify(r) + '\n');
    if (r.status === 400 && calls % 1 === 0 && r.err) { console.log(cfg.name, 'HTTP 400', r.err.slice(0, 160)); break; }
  }
  console.log('done', cfg.name, 'calls', calls, 'est$', spent.toFixed(3));
}
