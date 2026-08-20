import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Chunking
// react and katex come out as their own chunks so a redeploy of app code does
// not re-download them, and the ink weights are split from the recogniser that
// reads them. The year and stream question banks are deliberately absent here:
// they are reached only through import() in engine/generators/index.js, and
// naming them would pull the helpers they share with the shell in after them.
// chunkSizeWarningLimit is left at its default: the 798 kB of ink weights really
// are over it, and raising the bar past them would only hide that.
// ─────────────────────────────────────────────────────────────────────────────

function manualChunks(id) {
  const p = id.replace(/\\/g, '/');
  if (p.includes('/node_modules/')) {
    if (/\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(p)) return 'vendor-react';
    if (/\/node_modules\/katex\//.test(p)) return 'vendor-katex';
    return undefined;
  }
  if (p.endsWith('/src/ink/model-data.js')) return 'ink-model';
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
    rollupOptions: {
      output: { manualChunks }
    }
  }
});
