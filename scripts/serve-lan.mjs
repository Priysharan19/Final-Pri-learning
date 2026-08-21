// ─────────────────────────────────────────────────────────────────────────────
// Serves the built client to the iPad over the local network.
//
// It serves HTTPS with a self-signed certificate, and that is the whole point.
// iOS exposes `crypto.subtle` and registers a service worker only in a SECURE
// context — HTTPS or localhost, and a LAN IP over http is neither. Over plain
// http the app runs but password-protected profiles cannot be opened, encryption
// at rest is never exercised, and Add to Home Screen gives a bookmark rather
// than an installed app with an offline copy. Over HTTPS all of that works.
//
// The certificate is generated once into scripts/.lan-cert/ (git-ignored) and
// covers this Mac's current LAN address. Trust it on the iPad once:
//   Safari → http://<mac>:<port+1>/cert  → Install profile
//   Settings → General → VPN & Device Management → install
//   Settings → General → About → Certificate Trust Settings → turn it on
//
//   npm run serve:lan            build output, HTTPS on 4188 (+ 4189 for the cert)
//   npm run serve:lan -- --http  plain http, no trust step, reduced capability
// ─────────────────────────────────────────────────────────────────────────────
import { createServer as createHttp } from 'node:http';
import { createServer as createHttps } from 'node:https';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = fileURLToPath(new URL('../client/dist', import.meta.url));
const CERT_DIR = join(HERE, '.lan-cert');
const PLAIN = process.argv.includes('--http');
const PORT = Number(process.argv.find(a => /^\d+$/.test(a)) || 4188);

const lan = Object.values(networkInterfaces()).flat()
  .find(n => n && n.family === 'IPv4' && !n.internal);

if (!existsSync(ROOT)) {
  console.error('client/dist does not exist — run `npm run build` first.');
  process.exit(2);
}

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.pem': 'application/x-x509-ca-cert'
};

/** A self-signed cert naming this Mac's LAN address, made once and reused. */
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
const handler = (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/cert' || p === '/cert.pem') {
    const body = readFileSync(join(CERT_DIR, 'cert.pem'));
    res.writeHead(200, {
      'content-type': 'application/x-x509-ca-cert',
      'content-disposition': 'attachment; filename="pri-learning-local.pem"'
    });
    return res.end(body);
  }
  let f = join(ROOT, p);
  if (!existsSync(f) || statSync(f).isDirectory()) f = extname(p) ? f : join(ROOT, 'index.html');
  if (!existsSync(f)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(f));
};

const where = (scheme, port) => lan ? `${scheme}://${lan.address}:${port}` : `${scheme}://localhost:${port}`;

if (PLAIN) {
  createHttp(handler).listen(PORT, '0.0.0.0', () => {
    console.log(`serving ${ROOT}\n`);
    console.log(`  on the iPad   ${where('http', PORT)}\n`);
    console.log('Plain http: no passwords, no offline, no real install — see RUN-ON-IPAD.md.');
  });
} else {
  const creds = certificate();
  createHttps(creds, handler).listen(PORT, '0.0.0.0', () => {
    console.log(`serving ${ROOT}\n`);
    console.log(`  on the iPad   ${where('https', PORT)}`);
    console.log(`  certificate   ${where('http', PORT + 1)}/cert   (first time only)\n`);
    console.log('Trust it once on the iPad, then Add to Home Screen gives a real');
    console.log('installed app: full screen, own icon, offline, passwords working.');
  });
  // The cert itself has to come over plain http — Safari will not fetch it from
  // a server whose certificate it does not yet trust.
  createHttp(handler).listen(PORT + 1, '0.0.0.0');
}
