#!/usr/bin/env node
// Static server for marketing/reel with one extra verb: PUT /export/<name>
// writes the request body to marketing/reel/export/<name>, so the in-browser
// export harness (tools/export.html) can land the finished MP4 on disk.
//
//   node marketing/reel/tools/serve.mjs   # http://localhost:4174

import http from 'node:http';
import { createWriteStream, mkdirSync, statSync, createReadStream, existsSync } from 'node:fs';
import { resolve, join, extname, basename, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 4174;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript',
  '.mjs': 'application/javascript', '.jsx': 'text/jsx', '.css': 'text/css',
  '.json': 'application/json', '.wav': 'audio/wav', '.mp4': 'video/mp4',
  '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
};

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const pathname = decodeURIComponent(url.pathname);

  if (req.method === 'PUT' && pathname.startsWith('/export/')) {
    const name = basename(pathname); // strips any path tricks
    if (!/^[\w.-]+\.mp4$/.test(name)) { res.writeHead(400); return res.end('bad name'); }
    const dir = join(ROOT, 'export');
    mkdirSync(dir, { recursive: true });
    const out = createWriteStream(join(dir, name));
    let bytes = 0;
    req.on('data', (c) => { bytes += c.length; });
    req.pipe(out);
    out.on('finish', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, name, bytes }));
      console.log(`export written: export/${name} (${(bytes / 1e6).toFixed(1)} MB)`);
    });
    out.on('error', (e) => { res.writeHead(500); res.end(String(e)); });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  let fp = resolve(join(ROOT, pathname === '/' ? 'index.html' : pathname));
  if (!(fp === ROOT || fp.startsWith(ROOT + sep))) { res.writeHead(403); return res.end(); }
  try {
    if (statSync(fp).isDirectory()) fp = join(fp, 'index.html');
    const st = statSync(fp);
    res.writeHead(200, {
      'content-type': MIME[extname(fp)] || 'application/octet-stream',
      'content-length': st.size,
      'cache-control': 'no-store',
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(fp).pipe(res);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}).listen(PORT, () => console.log(`reel server on http://localhost:${PORT} (root: ${ROOT})`));
