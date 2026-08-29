// Pri Learning · single-process OpenAI handwriting LAN server
//
// This is the deterministic physical-iPad test path for cloud handwriting.
// It deliberately removes the two failure-prone hops used during early testing:
//   Safari -> :4190 cross-origin request
//   :4196 proxy -> separate gateway process
//
// Instead, one HTTPS origin serves the built app AND handles /__pri/cloud/ink
// in the same Node process. The OpenAI API key stays in this Mac process and is
// never injected into the browser bundle.
//
// Usage:
//   OPENAI_API_KEY=... node scripts/serve-openai-ink-lan.mjs
//
// Default URL: https://<mac-lan-ip>:4200

import { createServer as createHttpsServer } from 'node:https';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { extname, resolve } from 'node:path';
import { transcribeMathHandwriting } from '../server/cloud/openaiHandwriting.mjs';

const ROOT = resolve('client/dist');
const CERT = resolve('scripts/.lan-cert/cert.pem');
const KEY = resolve('scripts/.lan-cert/key.pem');
const PORT = Number(process.env.PRI_OPENAI_LAN_PORT || 4200);
const HOST = '0.0.0.0';
const MAX_BODY = 6 * 1024 * 1024;
const MODEL = process.env.OPENAI_HANDWRITING_PRIMARY_MODEL || 'gpt-5.6-terra';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

if (!existsSync(ROOT)) {
  console.error('client/dist does not exist — run `npm run build` first.');
  process.exit(2);
}
if (!existsSync(CERT) || !existsSync(KEY)) {
  console.error('LAN certificate missing — run `npm run serve:lan` once, stop it, then retry.');
  process.exit(2);
}
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not configured.');
  process.exit(2);
}

const lan = Object.values(networkInterfaces()).flat()
  .find(entry => entry && entry.family === 'IPv4' && !entry.internal);

function json(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(body.length),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(body);
}

function safeFile(pathname) {
  const clean = decodeURIComponent(pathname).replace(/\\/g, '/');
  const relative = clean.replace(/^\/+/, '');
  const candidate = resolve(ROOT, relative || 'index.html');
  const root = resolve(ROOT);
  if (candidate !== root && !candidate.startsWith(root + '/')) return null;
  return candidate;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) {
      const error = new Error('request too large');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return raw ? JSON.parse(raw) : {}; }
  catch {
    const error = new Error('invalid JSON');
    error.status = 400;
    throw error;
  }
}

async function preflightOpenAI() {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      store: false,
      reasoning: { effort: 'low' },
      max_output_tokens: 64,
      input: 'Reply with exactly OK.'
    })
  });
  const text = await response.text();
  if (!response.ok) {
    let message = `OpenAI HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(text);
      message = parsed?.error?.message || message;
    } catch { /* keep safe status message */ }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return true;
}

async function handleCloud(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required' });
  const started = Date.now();
  const id = Math.random().toString(36).slice(2, 10);
  console.log(`[openai-ink ${id}] recognition start`);
  try {
    const body = await readBody(req);
    const image = body?.image || body?.imageDataUrl;
    const result = await transcribeMathHandwriting(image);
    console.log(`[openai-ink ${id}] recognition ok · ${result.engine} · ${Date.now() - started}ms`);
    return json(res, 200, { ...result, requestId: id });
  } catch (error) {
    const status = Number(error?.status) >= 400 && Number(error?.status) < 600
      ? Number(error.status)
      : 500;
    console.error(`[openai-ink ${id}] recognition failed · HTTP ${status} · ${error?.code || 'OPENAI_INK_FAILED'} · ${String(error?.message || 'unknown error')} · ${Date.now() - started}ms`);
    return json(res, status, {
      error: status >= 500 ? 'OpenAI handwriting recognition failed' : String(error?.message || 'OpenAI handwriting recognition failed'),
      code: error?.code || 'OPENAI_INK_FAILED',
      requestId: id
    });
  }
}

function serveApp(req, res, pathname) {
  let file = safeFile(pathname);
  if (!file) {
    res.writeHead(403);
    return res.end('forbidden');
  }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    if (!extname(pathname)) file = resolve(ROOT, 'index.html');
  }
  if (!existsSync(file)) {
    res.writeHead(404);
    return res.end('not found');
  }

  let body = readFileSync(file);
  if (file === resolve(ROOT, 'index.html')) {
    const injection = `<script>window.__PRI_LAN_DEV__=true;window.__PRI_CLOUD_INK_ENDPOINT__='/__pri/cloud/ink';</script>`;
    body = Buffer.from(body.toString('utf8').replace('</head>', `${injection}\n</head>`));
  }

  res.writeHead(200, {
    'content-type': TYPES[extname(file)] || 'application/octet-stream',
    'content-length': String(body.length),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(body);
}

const handler = async (req, res) => {
  const url = new URL(req.url || '/', 'https://pri.local');
  if (url.pathname === '/__pri/cloud/health') {
    return json(res, 200, {
      ok: true,
      openaiConfigured: true,
      model: MODEL,
      singleProcess: true
    });
  }
  if (url.pathname === '/__pri/cloud/ink') return handleCloud(req, res);
  return serveApp(req, res, url.pathname);
};

console.log('Checking OpenAI API access before starting the iPad app...');
try {
  await preflightOpenAI();
  console.log(`✅ OpenAI preflight passed for ${MODEL}`);
} catch (error) {
  console.error(`❌ OpenAI preflight failed: ${error.message}`);
  console.error('Fix API billing / key permissions / model access before testing handwriting.');
  process.exit(3);
}

const server = createHttpsServer({
  key: readFileSync(KEY),
  cert: readFileSync(CERT)
}, handler);

server.listen(PORT, HOST, () => {
  const host = lan?.address || '127.0.0.1';
  console.log('\nPri Learning · single-process OpenAI handwriting test');
  console.log(`  open       https://${host}:${PORT}`);
  console.log(`  health     https://${host}:${PORT}/__pri/cloud/health`);
  console.log(`  model      ${MODEL} -> ${process.env.OPENAI_HANDWRITING_FALLBACK_MODEL || 'gpt-5.6-sol'}`);
  console.log('  browser    same-origin only');
  console.log('  local OCR  should remain out of the cloud-primary path');
  console.log('\nLeave this Terminal open while writing on the iPad.');
});
