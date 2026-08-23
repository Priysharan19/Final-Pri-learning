// ─────────────────────────────────────────────────────────────────────────────
// Serves Pri Learning or the real-Pencil corpus collector to an iPad over LAN.
// HTTPS is the default so the page runs in a secure context. `--collector`
// serves tools/ink-collect-v2 directly, which makes writer collection a one-
// command operation without rebuilding the application.
//
//   npm run serve:lan                 built app, HTTPS on 4188
//   npm run serve:lan -- --http       built app, plain HTTP
//   npm run ink:collect               corpus collector, HTTPS on 4192
//   npm run ink:collect -- --http     corpus collector, plain HTTP
// ─────────────────────────────────────────────────────────────────────────────
import { createServer as createHttp } from 'node:http';
import { createServer as createHttps } from 'node:https';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const COLLECTOR = process.argv.includes('--collector');
const ROOT = COLLECTOR
  ? fileURLToPath(new URL('../tools/ink-collect-v2', import.meta.url))
  : fileURLToPath(new URL('../client/dist', import.meta.url));
const CERT_DIR = join(HERE, '.lan-cert');
const PLAIN = process.argv.includes('--http');
const numeric = process.argv.find(a => /^\d+$/.test(a));
const PORT = Number(numeric || (COLLECTOR ? 4192 : 4188));

const lan = Object.values(networkInterfaces()).flat()
  .find(n => n && n.family === 'IPv4' && !n.internal);

if (!existsSync(ROOT)) {
  console.error(`${ROOT} does not exist${COLLECTOR ? '' : ' — run `npm run build` first'}.`);
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

const handler = (req, res) => {
  let p = new URL(req.url, 'http://x').pathname;
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
    if (COLLECTOR || !extname(p)) f = join(ROOT, 'index.html');
  }
  if (!existsSync(f)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, {
    'content-type': TYPES[extname(f)] || 'application/octet-stream',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(readFileSync(f));
};

const where = (scheme, port) => lan ? `${scheme}://${lan.address}:${port}` : `${scheme}://localhost:${port}`;
const label = COLLECTOR ? 'real-Pencil corpus collector' : 'Pri Learning build';

if (PLAIN) {
  createHttp(handler).listen(PORT, '0.0.0.0', () => {
    console.log(`serving ${label} from ${ROOT}\n`);
    console.log(`  on the iPad   ${where('http', PORT)}\n`);
    if (!COLLECTOR) console.log('Plain HTTP has reduced app capability; HTTPS is the production-like route.');
  });
} else {
  const creds = certificate();
  createHttps(creds, handler).listen(PORT, '0.0.0.0', () => {
    console.log(`serving ${label} from ${ROOT}\n`);
    console.log(`  on the iPad   ${where('https', PORT)}`);
    console.log(`  certificate   ${where('http', PORT + 1)}/cert   (first time only)\n`);
    if (COLLECTOR) {
      console.log('Use anonymous writer codes. Keep each writer permanently in one split.');
      console.log('After each session, save the JSON into client/test/ink-corpus/.');
    } else {
      console.log('Trust the certificate once on the iPad for the full secure-context app.');
    }
  });
  createHttp(handler).listen(PORT + 1, '0.0.0.0');
}
