// ─────────────────────────────────────────────────────────────────────────────
// Serves the built client on the local network, so the iPad can open it in
// Safari over Wi-Fi. For looking at screens while you change them.
//
// NOTE the limitation: iOS exposes crypto.subtle only in a secure context, and
// a LAN IP over http is not one. Password-protected profiles, encryption at
// rest and the service worker are all unavailable on this route. Use the native
// shell (RUN-ON-IPAD.md, Option A) to test the app as a student would have it.
//
//   node scripts/serve-lan.mjs [port]
// ─────────────────────────────────────────────────────────────────────────────
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
const ROOT = process.argv[2] && !/^\d+$/.test(process.argv[2])
  ? process.argv[2]
  : fileURLToPath(new URL('../client/dist', import.meta.url));
const PORT = Number(process.argv.find(a => /^\d+$/.test(a)) || 4188);
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.webmanifest':'application/manifest+json', '.svg':'image/svg+xml', '.png':'image/png',
  '.woff2':'font/woff2', '.woff':'font/woff', '.ttf':'font/ttf' };
createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = join(ROOT, p);
  if (!existsSync(f) || statSync(f).isDirectory()) {
    f = extname(p) ? f : join(ROOT, 'index.html');       // SPA fallback, extensionless only
  }
  if (!existsSync(f)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(f));
}).listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(networkInterfaces()).flat()
    .find(n => n && n.family === 'IPv4' && !n.internal);
  console.log(`serving ${ROOT}`);
  console.log(`  on this Mac      http://localhost:${PORT}`);
  if (lan) console.log(`  on the iPad      http://${lan.address}:${PORT}`);
  console.log('\nSame Wi-Fi. Passwords and offline mode do not work over plain http — see RUN-ON-IPAD.md.');
});
