import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Chunking
// react and katex come out as their own chunks so a redeploy of app code does
// not re-download them, and the ink weights get a stable file name of their own.
// Naming is all that last rule does — what keeps the weights off the initial
// load is the `await import()` in ink/nn.js, since a chunk on the far side of a
// static import is fetched every bit as eagerly as one that was never split.
//
// The other two ink rules exist to stop the shell reaching ink-engine by
// accident, which costs 65 kB of recogniser on a cold open. Both are modules the
// shell and the recogniser share, and left unnamed Rollup is free to settle them
// inside ink-engine, where one small import from the shell pulls the whole chunk
// in behind them: ink/personal.js, the profile's handwriting memory, which
// App.jsx sets at boot and Settings reads counts from; and Vite's __vitePreload
// helper, which every chunk holding an import() needs — the shell for the
// question banks, ink-engine for the weights. A chunk each costs two small
// requests and keeps those edges from existing.
//
// The year and stream question banks are deliberately absent here: they are
// reached only through import() in engine/generators/index.js, and naming them
// would pull the helpers they share with the shell in after them.
// chunkSizeWarningLimit is left at its default: the 798 kB of ink weights really
// are over it, and raising the bar past them would only hide that.
// ─────────────────────────────────────────────────────────────────────────────

function manualChunks(id) {
  const p = id.replace(/\\/g, '/');
  if (p.includes('vite/preload-helper')) return 'vite-preload';
  if (p.includes('/node_modules/')) {
    if (/\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(p)) return 'vendor-react';
    if (/\/node_modules\/katex\//.test(p)) return 'vendor-katex';
    return undefined;
  }
  if (p.endsWith('/src/ink/model-data.js')) return 'ink-model';
  if (p.endsWith('/src/ink/personal.js')) return 'ink-personal';
  if (/\/src\/ink\/(recognizer|nn|rerank|rerank-data|classes|raster|features|templates|aug)\.js$/.test(p)) return 'ink-engine';
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Precache
// public/sw.js ships with an empty manifest; this fills it in from what the
// build actually emitted, so every chunk — including the handwriting model — is
// in the cache after install rather than only once something asks for it. The
// version is a digest of those files' contents, so it moves on every build that
// changes anything and a redeploy lands in a cache of its own.
// Legacy .woff/.ttf duplicates of the .woff2 faces are left to the runtime cache.
// ─────────────────────────────────────────────────────────────────────────────

const PRECACHE_SKIP = /(^|\/)sw\.js$|(^|\/)\.DS_Store$|\.map$|\.woff$|\.ttf$/;

function filesIn(dir, base = '') {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...filesIn(join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

function precache() {
  let outDir = '';
  let swSource = '';
  return {
    name: 'pri-precache',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      swSource = resolve(config.publicDir, 'sw.js');
    },
    closeBundle() {
      const files = filesIn(outDir).filter(f => !PRECACHE_SKIP.test(f)).sort();
      const digest = createHash('sha256');
      for (const f of files) {
        digest.update(f).update(createHash('sha256').update(readFileSync(join(outDir, f))).digest());
      }
      const version = `pri-${digest.digest('hex').slice(0, 12)}`;
      const urls = ['/', ...files.map(f => `/${f}`)];
      const original = readFileSync(swSource, 'utf8');
      const filled = original
        .replace(/^const VERSION = .*$/m, `const VERSION = '${version}';`)
        .replace(/^const PRECACHE = .*$/m, `const PRECACHE = ${JSON.stringify(urls)};`);
      if (filled === original) this.error('sw.js has no VERSION/PRECACHE lines to fill — the precache would be empty');
      writeFileSync(join(outDir, 'sw.js'), filled);
    }
  };
}

export default defineConfig({
  plugins: [react(), precache()],
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist',
    // Vite's default 'modules' target bottoms out at Safari 14, which predates
    // top-level await — and ink/nn.js awaits the weights at module scope so that
    // nothing in the entry's static graph reaches them. This is the same set one
    // notch up, at the first release of each engine that ships it. The native
    // iPad shell is a WKWebView on iOS 16 and clears it comfortably.
    target: ['es2022', 'safari15', 'chrome91', 'firefox89', 'edge91'],
    rollupOptions: {
      output: { manualChunks }
    }
  }
});
