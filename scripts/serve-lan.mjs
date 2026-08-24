// ─────────────────────────────────────────────────────────────────────────────
// Serves Pri Learning, the real-Pencil corpus collector, or the V4 structural
// annotator to an iPad/desktop over LAN. HTTPS is the default so the collection
// path runs in a secure context.
//
//   npm run serve:lan                 built app, HTTPS on 4188
//   npm run serve:lan -- --http       built app, plain HTTP
//   npm run serve:lan:v4              built app + LOCAL research V4 inference
//   npm run ink:collect               corpus collector, HTTPS on 4192
//   npm run ink:annotate              V4 structural annotator, HTTPS on 4194
//
// --v4-dev is deliberately a development bridge, not a production deployment:
// the iPad sends strokes only to the developer Mac that is already serving the
// page, and the Mac runs the research-only same-writer V4 checkpoint locally.
// ─────────────────────────────────────────────────────────────────────────────
import { createServer as createHttp } from 'node:http';
import { createServer as createHttps } from 'node:https';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { execFileSync, spawn } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const COLLECTOR = process.argv.includes('--collector');
const ANNOTATOR = process.argv.includes('--annotator');
const V4_DEV = process.argv.includes('--v4-dev');
if ([COLLECTOR, ANNOTATOR, V4_DEV].filter(Boolean).length > 1) {
  console.error('choose only one of --collector, --annotator, or --v4-dev');
  process.exit(2);
}
const ROOT = ANNOTATOR
  ? fileURLToPath(new URL('../tools/ink-annotate-v4', import.meta.url))
  : COLLECTOR
    ? fileURLToPath(new URL('../tools/ink-collect-v2', import.meta.url))
    : fileURLToPath(new URL('../client/dist', import.meta.url));
const CERT_DIR = join(HERE, '.lan-cert');
const PLAIN = process.argv.includes('--http');
const numeric = process.argv.find(a => /^\d+$/.test(a));
const DEFAULT_PORT = ANNOTATOR ? 4194 : (COLLECTOR ? 4192 : 4188);
const PORT = Number(numeric || DEFAULT_PORT);
const V4_CHECKPOINT = resolve(
  process.env.PRI_INK_V4_DEV_CHECKPOINT ||
  join(REPO_ROOT, 'tools/ink-foundation/runs/pri-ink-structural-v4-dev.pt')
);

const lan = Object.values(networkInterfaces()).flat()
  .find(n => n && n.family === 'IPv4' && !n.internal);

if (!existsSync(ROOT)) {
  console.error(`${ROOT} does not exist${COLLECTOR || ANNOTATOR ? '' : ' — run `npm run build` first'}.`);
  process.exit(2);
}
if (V4_DEV && !existsSync(V4_CHECKPOINT)) {
  console.error(`V4 dev checkpoint not found: ${V4_CHECKPOINT}`);
  console.error('Run `npm run ink:structure:rebuild:dev` first, then retry `npm run serve:lan:v4`.');
  process.exit(2);
}

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.pem': 'application/x-x509-ca-cert'
};

function certificate() {
  const key = join(CERT_DIR, 'key.pem');
  const crt = join(CERT_DIR, 'cert.pem');
  const stamp = join(CERT_DIR, 'issued-for');
  const host = lan ? lan.address : '127.0.0.1';
  const current = existsSync(stamp) && readFileSync(stamp, 'utf8').trim() === host;
  if (!current || !existsSync(key) || !existsSync(crt)) {
    mkdirSync(CERT_DIR, { recursive: true });
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '825',
      '-keyout', key, '-out', crt,
      '-subj', '/CN=Pri Learning (local)',
      '-addext', `subjectAltName=IP:${host},DNS:localhost,IP:127.0.0.1`
    ], { stdio: 'ignore' });
    writeFileSync(stamp, host);
    console.log(`generated a certificate for ${host}`);
  }
  return { key: readFileSync(key), cert: readFileSync(crt) };
}

function safeFile(pathname) {
  const clean = decodeURIComponent(pathname).replace(/\\/g, '/');
  const relative = clean.replace(/^\/+/, '');
  const candidate = resolve(ROOT, relative || 'index.html');
  const root = resolve(ROOT);
  if (candidate !== root && !candidate.startsWith(root + '/')) return null;
  return candidate;
}

// ── Persistent local Structural V4 worker ────────────────────────────────────
let v4Worker = null;
let v4Stdout = '';
let v4NextId = 1;
const v4Pending = new Map();

function failV4Pending(message) {
  for (const { reject, timer } of v4Pending.values()) {
    clearTimeout(timer);
    reject(new Error(message));
  }
  v4Pending.clear();
}

function startV4Worker() {
  if (!V4_DEV) return;
  const python = process.env.PRI_INK_PYTHON || 'python3';
  const workerScript = join(REPO_ROOT, 'tools/ink-foundation/live_structural_infer.py');
  const args = [
    workerScript,
    '--checkpoint', V4_CHECKPOINT,
    '--decoder', process.env.PRI_INK_V4_DECODER || 'joint-auto',
    '--device', process.env.PRI_INK_V4_DEVICE || 'auto',
    '--grouping-temperature', process.env.PRI_INK_V4_GROUP_TEMP || '1.0',
    '--symbol-weight', process.env.PRI_INK_V4_SYMBOL_WEIGHT || '0.25',
    '--max-group-size', process.env.PRI_INK_V4_MAX_GROUP || '4',
    '--general-max-strokes', process.env.PRI_INK_V4_GENERAL_MAX_STROKES || '14'
  ];
  v4Worker = spawn(python, args, { cwd: REPO_ROOT, stdio: ['pipe', 'pipe', 'pipe'] });
  v4Worker.stderr.on('data', chunk => process.stderr.write(`[v4-dev] ${chunk}`));
  v4Worker.stdout.on('data', chunk => {
    v4Stdout += String(chunk);
    for (;;) {
      const nl = v4Stdout.indexOf('\n');
      if (nl < 0) break;
      const line = v4Stdout.slice(0, nl).trim();
      v4Stdout = v4Stdout.slice(nl + 1);
      if (!line) continue;
      let payload;
      try { payload = JSON.parse(line); }
      catch {
        process.stderr.write(`[v4-dev] invalid worker JSON: ${line.slice(0, 240)}\n`);
        continue;
      }
      const pending = v4Pending.get(payload.id);
      if (!pending) continue;
      v4Pending.delete(payload.id);
      clearTimeout(pending.timer);
      pending.resolve(payload);
    }
  });
  v4Worker.on('error', err => failV4Pending(`V4 worker failed: ${err.message}`));
  v4Worker.on('exit', (code, signal) => {
    const why = `V4 worker exited (${signal || code})`;
    v4Worker = null;
    failV4Pending(why);
    if (V4_DEV) process.stderr.write(`[v4-dev] ${why}\n`);
  });
}

function askV4(strokes) {
  return new Promise((resolvePromise, reject) => {
    if (!v4Worker || !v4Worker.stdin.writable) {
      reject(new Error('V4 worker is not available'));
      return;
    }
    const id = v4NextId++;
    const timer = setTimeout(() => {
      if (!v4Pending.has(id)) return;
      v4Pending.delete(id);
      reject(new Error('V4 inference timed out'));
    }, Number(process.env.PRI_INK_V4_TIMEOUT_MS || 15000));
    v4Pending.set(id, { resolve: resolvePromise, reject, timer });
    try {
      v4Worker.stdin.write(JSON.stringify({ id, strokes }) + '\n');
    } catch (err) {
      clearTimeout(timer);
      v4Pending.delete(id);
      reject(err);
    }
  });
}

function jsonResponse(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': body.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(body);
}

function handleV4Request(req, res) {
  if (!V4_DEV) return false;
  if (req.method !== 'POST') {
    jsonResponse(res, 405, { available: false, error: 'POST required' });
    return true;
  }
  let size = 0;
  const chunks = [];
  req.on('data', chunk => {
    size += chunk.length;
    if (size > 8 * 1024 * 1024) {
      req.destroy(new Error('request too large'));
      return;
    }
    chunks.push(chunk);
  });
  req.on('error', err => {
    if (!res.headersSent) jsonResponse(res, 400, { available: false, error: err.message });
  });
  req.on('end', async () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      if (!Array.isArray(body.strokes)) throw new Error('strokes must be an array');
      const result = await askV4(body.strokes);
      jsonResponse(res, result.available === false ? 503 : 200, result);
    } catch (err) {
      jsonResponse(res, 400, { available: false, engine: 'pri-structural-v4-dev-lan', error: err.message });
    }
  });
  return true;
}

if (V4_DEV) startV4Worker();

// The production client contains no network code at all (README, "No
// telemetry"), so V4 dev mode injects this classic script ahead of the module
// bundle. It installs the one hook client/dev/devStructural.js looks for; the
// hook and the fetch below exist only on this LAN origin, never in the built
// app.
const LAN_BRIDGE_JS = `// Pri Ink Structural V4 LAN bridge — injected by serve-lan.mjs, never shipped.
window.__PRI_INK_V4_LAN__ = async strokes => {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => controller && controller.abort(), 14500);
  try {
    const response = await fetch('/__pri/ink/v4', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ strokes }),
      cache: 'no-store',
      signal: controller ? controller.signal : undefined
    });
    if (response.status === 404 || response.status === 405) return { gone: true };
    if (!response.ok) return null;
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};
`;

const handler = (req, res) => {
  let p = new URL(req.url, 'http://x').pathname;
  if (p === '/__pri/ink/v4') {
    if (handleV4Request(req, res)) return;
    res.writeHead(404); return res.end('V4 dev bridge disabled');
  }
  if (p === '/__pri/lan-bridge.js') {
    if (!V4_DEV) { res.writeHead(404); return res.end('LAN bridge disabled'); }
    res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' });
    return res.end(LAN_BRIDGE_JS);
  }
  if (p === '/cert' || p === '/cert.pem') {
    const certPath = join(CERT_DIR, 'cert.pem');
    if (!existsSync(certPath)) { res.writeHead(404); return res.end('certificate not generated'); }
    const body = readFileSync(certPath);
    res.writeHead(200, {
      'content-type': 'application/x-x509-ca-cert',
      'content-disposition': 'attachment; filename="pri-learning-local.pem"'
    });
    return res.end(body);
  }

  let f = safeFile(p);
  if (!f) { res.writeHead(403); return res.end('forbidden'); }
  if (!existsSync(f) || statSync(f).isDirectory()) {
    if (COLLECTOR || ANNOTATOR || !extname(p)) f = join(ROOT, 'index.html');
  }
  if (!existsSync(f)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, {
    'content-type': TYPES[extname(f)] || 'application/octet-stream',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  let body = readFileSync(f);
  if (V4_DEV && f === join(ROOT, 'index.html')) {
    body = Buffer.from(body.toString('utf8')
      .replace('</head>', '  <script src="/__pri/lan-bridge.js"></script>\n  </head>'));
  }
  res.end(body);
};

const where = (scheme, port) => lan ? `${scheme}://${lan.address}:${port}` : `${scheme}://localhost:${port}`;
const label = ANNOTATOR
  ? 'Pri Ink V4 structural annotator'
  : COLLECTOR ? 'real-Pencil corpus collector'
    : V4_DEV ? 'Pri Learning build + Structural V4 research bridge'
      : 'Pri Learning build';

const reportMode = () => {
  if (V4_DEV) {
    console.log(`  V4 checkpoint ${V4_CHECKPOINT}`);
    console.log('  WARNING       research-only same-writer LAN inference; productionReady=false\n');
  }
};

if (PLAIN) {
  createHttp(handler).listen(PORT, '0.0.0.0', () => {
    console.log(`serving ${label} from ${ROOT}\n`);
    console.log(`  open          ${where('http', PORT)}\n`);
    reportMode();
    if (!COLLECTOR && !ANNOTATOR) console.log('Plain HTTP has reduced app capability; HTTPS is the production-like route.');
  });
} else {
  const creds = certificate();
  createHttps(creds, handler).listen(PORT, '0.0.0.0', () => {
    console.log(`serving ${label} from ${ROOT}\n`);
    console.log(`  open          ${where('https', PORT)}`);
    console.log(`  certificate   ${where('http', PORT + 1)}/cert   (first time only)\n`);
    reportMode();
    if (COLLECTOR) {
      console.log('Use anonymous writer codes. Keep each writer permanently in one split.');
      console.log('After each session, save the JSON into client/test/ink-corpus/.');
    } else if (ANNOTATOR) {
      console.log('Load a corpus JSON locally; no handwriting data is uploaded by this tool.');
      console.log('Save the structural-v4 JSON beside the source corpus when annotation is complete.');
    } else if (!V4_DEV) {
      console.log('Trust the certificate once on the iPad for the full secure-context app.');
    }
  });
  createHttp(handler).listen(PORT + 1, '0.0.0.0');
}

const shutdown = () => {
  if (v4Worker && !v4Worker.killed) v4Worker.kill('SIGTERM');
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
