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

// The Hindi catalogue gets a name of its own for the same reason the ink
// weights do: so the service worker can recognise it by that name and leave it
// out of the install, and so the i18n contract suite can assert that it did.
// Only the strings are split. i18n/index.js and i18n/languages.js stay in the
// entry — the runtime has to be there to decide a language, and languages.js is
// what local/backend.js validates the profile field with.
export function manualChunks(id) {
  const p = id.replace(/\\/g, '/');
  if (p.includes('vite/preload-helper')) return 'vite-preload';
  if (p.endsWith('/src/i18n/strings.hi.js')) return 'i18n-hi';
  if (p.endsWith('/src/i18n/ncertTerms.js')) return 'i18n-terms';
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

export const PRECACHE_SKIP = /(^|\/)sw\.js$|(^|\/)\.DS_Store$|\.map$|\.woff$|\.ttf$/;

// The PDF renderer and its worker are ~2.7 MB together and are needed only by
// the student who attaches a scanned PDF. Precaching them would make every
// install carry the cost of a feature most people never touch, on connections
// where that is a real cost. They stay out of the install and are cached at
// runtime by the ordinary /assets/ rule the first time one is opened — so a
// student who has used it once has it offline, and a student who never does
// never pays for it. The one place this shows is opening a PDF offline having
// never opened one before; pdfPage.js reports that case specifically.
//
// A translation catalogue is the same argument in miniature. Every install
// would otherwise carry every language, and this app is aimed squarely at
// budget Android phones on metered data — an English reader paying to download
// Hindi, and a Hindi reader paying to download every other language we ever
// add, is a cost nobody agreed to. The catalogue is fetched the moment the
// language is switched and then cached by the ordinary /assets/ rule, so a
// student who reads Hindi has it offline from their first switch onwards.
//
// The one place this shows is switching language while offline, having never
// done it before: the strings do not arrive, the app stays in English, and the
// setting is remembered so the next connected boot lands in Hindi. That is
// spelled out in i18n/index.js where setLanguage swallows the failure.
//
// The NCERT term glossary is the same again: reached only when the term bridge
// is turned on, and worth nothing to the install of somebody who never does.
//
// A NOTE ON WHAT YOU WILL SEE IN dist/. Each of these leaves TWO files behind:
// the named chunk that holds the data (i18n-hi-*.js, i18n-terms-*.js) and a
// ~60-byte re-export stub named after the module the import() actually points
// at (strings.hi-*.js, ncertTerms-*.js). Only the stubs are precached, which is
// exactly right — sixty bytes in the install, and the sixty kilobytes behind
// them fetched only if a student asks. CI asserts both halves: the named chunks
// are absent from the install list, and nothing precached under those module
// names is big enough to be the data.
export const RUNTIME_ONLY = /(^|\/)(?:pdf(?:\.worker)?|i18n-[a-z-]+)-[^/]*\.(js|mjs)$/;

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
    // `writeBundle` is the correct lifecycle point: output has definitely been
    // written, while `closeBundle` can also run during a failed build before
    // `dist/` exists and mask the real error with an ENOENT from this plugin.
    writeBundle() {
      const files = filesIn(outDir).filter(f => !PRECACHE_SKIP.test(f)).sort();
      const precached = files.filter(f => !RUNTIME_ONLY.test(f));
      const digest = createHash('sha256');
      for (const f of files) {
        digest.update(f).update(createHash('sha256').update(readFileSync(join(outDir, f))).digest());
      }
      const version = `pri-${digest.digest('hex').slice(0, 12)}`;
      const urls = ['/', ...precached.map(f => `/${f}`)];
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
