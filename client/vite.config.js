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
// accident, which costs 102 kB of recogniser on a cold open. Both are modules
// the shell and the recogniser share, and left unnamed the bundler is free to
// settle them inside ink-engine, where one small import from the shell pulls the
// whole chunk in behind them: ink/personal.js, the profile's handwriting memory;
// and the __vitePreload helper, which every chunk holding an import() needs —
// the shell for the question banks, ink-engine for the weights. A chunk each
// costs two small requests and keeps those edges from existing.
//
// These are `codeSplitting` groups rather than a `manualChunks` function
// because that function is no longer the whole story under Vite 8's Rolldown
// bundler. The two rules it could not express were exactly the two above:
// ink/personal.js came back merged into ink-engine regardless, and the preload
// helper is an internal module the function is never called for at all. Both
// silently stopped working, and both put the recogniser back in the shell's own
// preload list — 102 kB paid on every cold open by every student, most of a
// second on the connection this app has to work on.
//
// `includeDependenciesRecursively: false` is what keeps the helper out. Left on,
// a group swallows the whole dependency graph of everything it claims, so the
// ink-engine group took the helper — which nn.js needs for its import() of the
// weights and the shell needs for its import() of the banks — down with it, and
// the shell's need for it became a static edge into 102 kB of recogniser. With
// it off, a module two groups both depend on stays in a chunk of its own.
//
// The build now fails rather than shipping that mistake again: the precache
// plugin below rejects any on-demand file the built index.html turns out to
// reference.
//
// The year and stream question banks are deliberately absent here: they are
// reached only through import() in engine/generators/index.js, and naming them
// would pull the helpers they share with the shell in after them.
// chunkSizeWarningLimit is left at its default: the 798 kB of ink weights really
// are over it, and raising the bar past them would only hide that.
// ─────────────────────────────────────────────────────────────────────────────

const CHUNK_GROUPS = [
  // Higher priority than the vendor rules so a src/ path is never claimed by
  // one of them first.
  { name: 'ink-model', test: /\/src\/ink\/model-data\.js$/, priority: 40 },
  { name: 'ink-personal', test: /\/src\/ink\/personal\.js$/, priority: 40 },
  { name: 'ink-engine', test: /\/src\/ink\/(recognizer|nn|rerank|rerank-data|classes|raster|features|templates|aug)\.js$/, priority: 40 },
  { name: 'vendor-react', test: /\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//, priority: 30 },
  { name: 'vendor-katex', test: /\/node_modules\/katex\//, priority: 30 }
];

// ─────────────────────────────────────────────────────────────────────────────
// Precache
// public/sw.js ships with an empty manifest; this fills it in from what the
// build actually emitted. The version is a digest of those files' contents, so
// it moves on every build that changes anything and a redeploy lands in a cache
// of its own. Legacy .woff/.ttf duplicates of the .woff2 faces are left to the
// runtime cache.
//
// Every emitted file lands in exactly one of three places, and the build fails
// if one lands in none — a new chunk cannot quietly fall out of offline cover.
//
//   BOOT     the install writes these before it reports done. It is the set the
//            built index.html actually references plus the icons, the manifest
//            and the faces the first screen paints in — nothing else. Install
//            used to mean the whole build, and on a 700 kbps line that install
//            competed with the very page load it was meant to protect: the
//            phone downloaded 3.7 MB before the profile screen was usable.
//   WARM     everything else a student needs with the network off. The app asks
//            for it by message once it is on screen and idle, so it costs the
//            first paint nothing and is in the cache seconds later.
//   ON_DEMAND  fetched only when something genuinely asks, then kept by the
//            ordinary /assets/ runtime rule. A student who never uses the
//            feature never pays for it; one who uses it once has it offline.
//
// Every ON_DEMAND rule below carries the reason it is safe, because "not
// installed" is a promise to a student on a train with no signal and each one
// has to be argued rather than assumed.
// ─────────────────────────────────────────────────────────────────────────────

// Exported so client/test/install-budget-check.mjs can hold the build to these
// exact rules rather than to a second copy of them that would drift.
export const PRECACHE_SKIP = /(^|\/)sw\.js$|(^|\/)\.DS_Store$|\.map$|\.woff$|\.ttf$/;

export const ON_DEMAND = [
  // ~2.7 MB of renderer and worker, for the student who attaches a scanned PDF.
  // Opening a PDF offline having never opened one before is the one case this
  // shows, and pdfPage.js reports that case by name.
  [/(^|\/)pdf(\.worker)?-[^/]*\.(js|mjs)$/, 'PDF renderer'],

  // The handwriting recogniser and its 799 kB of weights — a third of the old
  // install, for the one input mode a phone without a stylus is least likely to
  // use. It is already behind an import(), so nothing on the first screen wants
  // it; a student who opens the write tab once online has it from then on, and
  // QuestionCard names the first-use-offline case rather than blaming the
  // device. offlineWarm.js pulls it in the background on an unmetered link, so
  // in practice a stylus user has it before they ask.
  [/(^|\/)(ink-model|ink-engine|ink-personal|model-data|recognizer|InkAnswer|NativeInkCanvas|feedbackGeometry|InkPhysicalEvidenceSession)-[^/]*\.js$/, 'handwriting recogniser'],

  // Inter ships one file per script. Latin is the only one an Indian student
  // reading English maths paints from; the browser fetches a subset only when a
  // glyph inside its unicode-range appears, so precaching Cyrillic, Greek and
  // Vietnamese bought 85 kB of nothing. Inter has no Devanagari face at all, so
  // Hindi already falls back to the system font and is unaffected. The one
  // visible case — a name typed in an accented Latin script, offline, before
  // that subset was ever fetched — renders in the fallback face.
  [/(^|\/)inter-(?!latin-wght-normal)[a-z-]+-wght-normal-[^/]*\.woff2$/, 'Inter script subset'],

  // KaTeX ships sixteen faces. The app's maths reaches for Main, Math, AMS
  // (\mathbb) and the Size faces; Fraktur, Script, Caligraphic, Typewriter and
  // SansSerif are for notation no generator in this repo emits. As with Inter,
  // a face is fetched only if something asks to paint in it.
  [/(^|\/)KaTeX_(Fraktur|Script|Caligraphic|Typewriter|SansSerif)-[^/]*\.woff2$/, 'unused KaTeX face'],

  // Six years of question banks, of which a student practises from one year and
  // the revision year below it. api.js already loads exactly that set through
  // warmScope() the moment a profile signs in — the same code that serves the
  // questions decides what to fetch, so there is no second table here to drift
  // out of step with the generator registry. The runtime rule keeps what it
  // pulled, so the student is offline-ready for their own year and carries none
  // of the other five.
  [/(^|\/)(year(7|8|9|10|11|12)|streams-(standard|ext)|india-(algebra|calculus|class10|coordinate|foundation|junior-overlay|olympiad|senior))-[^/]*\.js$/, 'question bank for another year']
];

// The faces the first screens genuinely paint in: the Latin Inter subset for
// every word of UI, and the KaTeX faces a rendered question uses. The rest of
// KaTeX's faces are ON_DEMAND above; these are the ones a student meets in
// their first minute, so they belong in the install with the shell.
const BOOT_FONTS = /(^|\/)(inter-latin-wght-normal|KaTeX_(Main|Math|AMS|Size\d)-[A-Za-z]+)-[^/]*\.woff2$/;

// On-demand, but worth having in advance where the bytes are cheap — a browser
// that reports an unmetered 4G link, or a shell reading them off an app bundle.
// offlineWarm.js decides and the worker only obeys, because the decision needs
// facts (Data Saver, effective connection type, whether this is the native
// shell) that live on the page and not in a worker.
const OPTIONAL_WARM = /(^|\/)(ink-model|ink-engine|ink-personal|model-data|recognizer|InkAnswer|NativeInkCanvas|feedbackGeometry)-[^/]*\.js$/;

const onDemandReason = (file) => ON_DEMAND.find(([re]) => re.test(file))?.[1] || null;

function filesIn(dir, base = '') {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...filesIn(join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

/**
 * What the built shell asks for before it can render anything: its entry
 * script, every modulepreload beside it, and the stylesheets, icon and manifest
 * in its head. Read out of the emitted HTML rather than listed here, so a
 * chunking change moves the boot set with it instead of silently leaving a file
 * the first paint blocks on out of the install.
 */
function referencedByShell(html) {
  const out = new Set();
  for (const m of html.matchAll(/(?:src|href)="(\/[^"]+)"/g)) out.add(m[1].slice(1));
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
      const shellRefs = referencedByShell(readFileSync(join(outDir, 'index.html'), 'utf8'));

      const boot = [];
      const warm = [];
      const optional = [];
      for (const f of files) {
        if (onDemandReason(f)) { if (OPTIONAL_WARM.test(f)) optional.push(f); continue; }
        if (f === 'index.html' || shellRefs.has(f) || BOOT_FONTS.test(f)) boot.push(f);
        else warm.push(f);
      }

      // A file the shell blocks on must never be left to the warm pass: the
      // install would report success on a cache that cannot render the app.
      for (const f of shellRefs) {
        if (files.includes(f) && onDemandReason(f)) {
          this.error(`${f} is referenced by index.html but matched the "${onDemandReason(f)}" on-demand rule — the first paint would block on a file the install does not carry`);
        }
      }

      const digest = createHash('sha256');
      for (const f of files) {
        digest.update(f).update(createHash('sha256').update(readFileSync(join(outDir, f))).digest());
      }
      const version = `pri-${digest.digest('hex').slice(0, 12)}`;
      const original = readFileSync(swSource, 'utf8');
      const filled = original
        .replace(/^const VERSION = .*$/m, `const VERSION = '${version}';`)
        .replace(/^const PRECACHE = .*$/m, `const PRECACHE = ${JSON.stringify(['/', ...boot.map(f => `/${f}`)])};`)
        .replace(/^const WARM = .*$/m, `const WARM = ${JSON.stringify(warm.map(f => `/${f}`))};`)
        .replace(/^const OPTIONAL = .*$/m, `const OPTIONAL = ${JSON.stringify(optional.map(f => `/${f}`))};`);
      if (filled === original) this.error('sw.js has no VERSION/PRECACHE/WARM/OPTIONAL lines to fill — the precache would be empty');
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
      output: {
        codeSplitting: { includeDependenciesRecursively: false, groups: CHUNK_GROUPS }
      }
    }
  }
});
