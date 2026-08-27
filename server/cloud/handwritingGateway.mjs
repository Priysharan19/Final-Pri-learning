// Pri Learning · optional cloud handwriting HTTP gateway
//
// This is intentionally separate from server/index.js, which is legacy. Run it
// beside any static host when cloud handwriting is desired:
//
//   OPENAI_API_KEY=... npm run cloud:ink
//
// The browser/iPad receives only this endpoint URL. The OpenAI key stays in the
// server environment. This development gateway is not a substitute for auth,
// quotas and abuse controls on a public internet deployment.

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { transcribeMathHandwriting } from './openaiHandwriting.mjs';

const PORT = Number(process.env.PRI_CLOUD_PORT || 4190);
const HOST = process.env.PRI_CLOUD_HOST || '0.0.0.0';
const MAX_BODY = 6 * 1024 * 1024;
const CLIENT_TOKEN = process.env.PRI_CLOUD_CLIENT_TOKEN || '';
const PRODUCTION = process.env.NODE_ENV === 'production';
const configuredOrigins = String(process.env.PRI_CLOUD_ALLOWED_ORIGINS || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

function corsOrigin(req) {
  const origin = String(req.headers.origin || '');
  if (!PRODUCTION && configuredOrigins.length === 0) return '*';
  if (configuredOrigins.includes('*')) return '*';
  return configuredOrigins.includes(origin) ? origin : '';
}

function headers(req, extra = {}) {
  const allow = corsOrigin(req);
  return {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    ...(allow ? { 'access-control-allow-origin': allow, vary: 'Origin' } : {}),
    ...extra
  };
}

function send(req, res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, headers(req, { 'content-length': String(body.length) }));
  res.end(body);
}

function authorized(req) {
  if (!CLIENT_TOKEN) return true;
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return supplied === CLIENT_TOKEN;
}

async function readJson(req) {
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

const server = createServer(async (req, res) => {
  const requestId = randomUUID();
  const url = new URL(req.url || '/', 'http://localhost');

  if (req.method === 'OPTIONS') {
    const allow = corsOrigin(req);
    if (!allow) return send(req, res, 403, { error: 'origin not allowed', requestId });
    res.writeHead(204, {
      'access-control-allow-origin': allow,
      'access-control-allow-methods': 'POST, GET, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-max-age': '600',
      vary: 'Origin'
    });
    return res.end();
  }

  if (url.pathname === '/health' && req.method === 'GET') {
    return send(req, res, 200, {
      ok: true,
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      requestId
    });
  }

  if (url.pathname !== '/v1/handwriting/recognize') {
    return send(req, res, 404, { error: 'not found', requestId });
  }
  if (req.method !== 'POST') return send(req, res, 405, { error: 'POST required', requestId });
  if (!corsOrigin(req) && req.headers.origin) return send(req, res, 403, { error: 'origin not allowed', requestId });
  if (!authorized(req)) return send(req, res, 401, { error: 'unauthorized', requestId });
  if (!process.env.OPENAI_API_KEY) {
    return send(req, res, 503, { error: 'OPENAI_API_KEY is not configured', code: 'OPENAI_NOT_CONFIGURED', requestId });
  }

  try {
    const body = await readJson(req);
    const image = body?.image || body?.imageDataUrl;
    const result = await transcribeMathHandwriting(image);
    return send(req, res, 200, { ...result, requestId });
  } catch (error) {
    const status = Number(error?.status) >= 400 && Number(error?.status) < 600 ? Number(error.status) : 500;
    const safeMessage = status >= 500 && !['OPENAI_NOT_CONFIGURED'].includes(error?.code)
      ? 'Cloud handwriting recognition failed'
      : String(error?.message || 'Cloud handwriting recognition failed');
    if (status >= 500) console.error(`[cloud-ink ${requestId}]`, error);
    return send(req, res, status, { error: safeMessage, code: error?.code || 'CLOUD_INK_FAILED', requestId });
  }
});

const lan = Object.values(networkInterfaces()).flat()
  .find(entry => entry && entry.family === 'IPv4' && !entry.internal);

server.listen(PORT, HOST, () => {
  const host = lan?.address || '127.0.0.1';
  console.log('Pri Learning cloud handwriting gateway');
  console.log(`  endpoint  http://${host}:${PORT}/v1/handwriting/recognize`);
  console.log(`  model     ${process.env.OPENAI_HANDWRITING_PRIMARY_MODEL || 'gpt-5.6-terra'} -> ${process.env.OPENAI_HANDWRITING_FALLBACK_MODEL || 'gpt-5.6-sol'}`);
  console.log(`  OpenAI    ${process.env.OPENAI_API_KEY ? 'configured' : 'NOT CONFIGURED'}`);
  if (!PRODUCTION && configuredOrigins.length === 0) {
    console.log('  CORS      development wildcard (set PRI_CLOUD_ALLOWED_ORIGINS before public deployment)');
  }
  if (!CLIENT_TOKEN) console.log('  auth      none (local development only)');
});
