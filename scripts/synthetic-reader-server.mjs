#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the real server with a SYNTHETIC handwriting reader
//
// TEST HARNESS ONLY — never part of the server image or the app. Starts the
// real server (server/index.js: accounts, sessions, practice prepare / issue /
// recognise / confirm / grade / reveal, its own SQLite file) in this process
// and answers exactly one network hop itself: the request the server's
// handwriting provider module sends to the model. The stand-in never looks at
// the picture; it returns the text and confidence scripted in
// PRI_SYNTHETIC_READER_SCRIPT (default "7" at 0.6, i.e. a doubtful line the
// student must correct). Every other outbound request is refused, so a run
// can never reach a real provider, even by accident.
//
// Each provider request is appended to PRI_SYNTHETIC_READER_LOG as one JSON
// line WITHOUT the image bytes, so a journey can prove the reader was sent one
// picture and no question text (answer-blind).
//
// Nothing produced with this process is evidence about real handwriting
// recognition, a real provider, a real iPad or a real Pencil.
// Used by scripts/cloud-fixture-server.mjs --synthetic-reader.
// ─────────────────────────────────────────────────────────────────────────────
import { appendFileSync, readFileSync } from 'node:fs';

if (process.env.NODE_ENV === 'production') {
  console.error('synthetic-reader-server: refused under NODE_ENV=production');
  process.exit(2);
}

const scriptFile = process.env.PRI_SYNTHETIC_READER_SCRIPT || '';
const logFile = process.env.PRI_SYNTHETIC_READER_LOG || '';
const scripted = () => {
  try {
    const v = JSON.parse(readFileSync(scriptFile, 'utf8'));
    if (typeof v.text === 'string' && Number.isFinite(v.confidence)) return v;
  } catch { /* default below */ }
  return { text: '7', confidence: 0.6 };
};
const record = entry => { if (logFile) { try { appendFileSync(logFile, `${JSON.stringify(entry)}\n`); } catch { /* evidence only */ } } };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return realFetch(input, init);
  if (url.host === 'api.openai.com' && url.pathname.startsWith('/v1/models/')) return json(200, { id: 'synthetic-reader' });
  if (url.host === 'api.openai.com' && url.pathname === '/v1/responses') {
    let body = {};
    try { body = JSON.parse(String(init.body || '{}')); } catch { body = {}; }
    const parts = (Array.isArray(body.input) ? body.input : []).flatMap(m => (Array.isArray(m?.content) ? m.content : []));
    const images = parts.filter(p => p?.type === 'input_image');
    const { text, confidence } = scripted();
    record({
      kind: 'reader', at: Date.now(), model: body.model || null, images: images.length,
      imageIsDataUrl: images.every(p => /^data:image\//.test(String(p.image_url || ''))),
      // Everything the reader was told besides the picture.
      nonImageText: JSON.stringify({ instructions: body.instructions ?? null, parts: parts.filter(p => p?.type !== 'input_image') }),
      answered: { text, confidence }
    });
    const lines = String(text).split('\n').filter(Boolean).map(line => ({ text: line, latex: line, confidence }));
    return json(200, { output_text: JSON.stringify({ lines, confidence, needs_confirmation: confidence < 0.82 }) });
  }
  record({ kind: 'refused', at: Date.now(), target: url.origin + url.pathname });
  throw new Error(`synthetic-reader-server: outbound request refused (${url.origin}) — this harness never reaches a real provider`);
};

console.log('SYNTHETIC READER — the handwriting reader in this process is a scripted stand-in; server, database and grading are real.');
await import('../server/index.js');
