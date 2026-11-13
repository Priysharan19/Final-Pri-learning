#!/usr/bin/env node
// Pri Learning · edition brand assets (Direction A "Prime", approved 2026-11-13;
// docs/brand/editions-decision.md, plan mission E4) — every SVG, Android vector
// and the BrandMark path module, generated from one geometry source.
//
//   node tools/brand/build-assets.mjs           write the files
//   node tools/brand/build-assets.mjs --check   fail if a committed file differs
//
// Inputs: tools/brand/wordmarks.json (outlined wordmarks; regenerate it with
// outline-wordmarks.py only when the wordmark itself changes) and each
// edition's brand, cut and accent from client/edition.config.mjs. Outputs:
//   client/brand/<edition>/{favicon,mask-icon,splash}.svg   copied into that edition's build
//   client/brand/<edition>/source/…                         marks, wordmarks, icon sources, Android layers
//   client/src/brand/paths.js                               path data for BrandMark.jsx
// The PNG icons come from these sources by tools/brand/rasterise-icons.mjs.
// Writes plain, hand-readable SVG: no metadata, no filters, no gradients.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EDITIONS } from '../../client/edition.config.mjs';
import { compactPath } from './compact-path.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CHECK = process.argv.includes('--check');
const WM_RAW = JSON.parse(readFileSync(join(ROOT, 'tools/brand/wordmarks.json'), 'utf8'));
// Every path is written in its shortest exact spelling (compact-path.mjs): the
// same coordinates, fewer bytes in each edition's install. View boxes are
// measured on the absolute source.
const WM = { ...WM_RAW, wordmarks: Object.fromEntries(Object.entries(WM_RAW.wordmarks).map(([k, v]) => [k, {
  ...v, d: compactPath(v.d), ...(v.prime ? { prime: compactPath(v.prime), primeSmall: compactPath(v.primeSmall) } : {})
}])) };
const outDir = join(ROOT, 'client/brand');
const written = new Map();

// ── geometry (mark units; the P′ mark's own coordinate space) ─────────────────
const P = compactPath('M15.5 88V13H47Q58.81 13 67.15 21.35Q75.5 29.69 75.5 41.5Q75.5 53.31 67.15 61.65Q58.81 70 47 70H32.5V88ZM32.5 27V56H47Q53.01 56 57.25 51.75Q61.5 47.51 61.5 41.5Q61.5 35.49 57.25 31.25Q53.01 27 47 27Z');
const PRIME = compactPath('M82 5 92.5 7.2 83.5 30 77 28.4 82 5Z');           // BrandMark.jsx, iOS, Android, icon-512
const PRIME_HEAVY = compactPath('M79 1 95 4.5 84 34 74.5 31.5 79 1Z');     // favicon.svg (16–32 px optical size)
const CUT = {
  // Priyabhata: the bow cut off by its string (jyā) — the counter's arc, centre (47, 41.5), r 14.5, chord x = 49.5
  jya: compactPath('M49.5 27.22A14.5 14.5 0 0 1 49.5 55.78Z'),
  // Prithagoras: the right-angle box in the counter's square corner (stem inner edge x 32.5, bowl top y 27)
  square: compactPath('M32.5 27H45V39.5H32.5Z')
};
// Single-colour forms (mask-icon, Android themed icon): the cut is inset 3 units from the
// letter so it does not merge into the P when everything is one colour.
const CUT_MONO = {
  jya: compactPath('M50 30.4A11.5 11.5 0 0 1 50 52.6Z'),
  square: compactPath('M35.5 30H45V39.5H35.5Z')
};

// ── colours ───────────────────────────────────────────────────────────────────
// Icons keep the shipped icon palette (favicon.svg, iOS AppIcon, android/res/values*/colors.xml).
const ICON = {
  light: { bg: '#F3EFE6', ink: '#1A1D21', prime: '#B8402A' },
  dark: { bg: '#141619', ink: '#F3EFE6', prime: '#D9604A' },
  tinted: { bg: '#000000', ink: '#FFFFFF', prime: '#B3B3B3', cut: '#B3B3B3' }
};
// Wordmarks use the Instrument interface tokens (client/src/instrument/instrument.css, theme.css).
const TEXT = { light: { ink: '#1B1A17', prime: '#B8402A' }, dark: { ink: '#ECEBE6', prime: '#D9604A' } };
// Brand, cut and accent come from the edition table (upper-case hex, as the kit drew them).
const ED = Object.fromEntries(Object.entries(EDITIONS).map(([id, e]) => [id, {
  brand: e.brand, cut: e.identity.cut,
  accent: { light: e.identity.accent.light.toUpperCase(), dark: e.identity.accent.dark.toUpperCase() }
}]));

// Mark placements (100-unit tile), measured from the shipped files on origin/main:
const FIT = {
  favicon: 'translate(3.56 10.01) scale(0.86)',   // client/public/favicon.svg
  app: 'translate(16.54 21.03) scale(0.621)',      // icon-180/192/512, AppIcon-1024 (P stem at 26.2 %)
  maskable: 'translate(24.08 27.68) scale(0.48)'   // icon-maskable-192 (mark inside the 80 % safe circle)
};

// Bounding box of absolute-command path data (on-curve and control points: a safe outer box).
function viewBoxOf(ds, pad) {
  const xs = [], ys = [];
  for (const [, cmd, args] of ds.join(' ').matchAll(/([MLHVQCZ])([^MLHVQCZ]*)/g)) {
    const n = (args.match(/-?\d+(\.\d+)?/g) || []).map(Number);
    if (cmd === 'H') xs.push(...n);
    else if (cmd === 'V') ys.push(...n);
    else n.forEach((v, i) => (i % 2 ? ys : xs).push(v));
  }
  const x0 = Math.floor(Math.min(...xs)) - pad, y0 = Math.floor(Math.min(...ys)) - pad;
  return `${x0} ${y0} ${Math.ceil(Math.max(...xs)) + pad - x0} ${Math.ceil(Math.max(...ys)) + pad - y0}`;
}
const svg = (vb, body, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${extra}>\n${body}\n</svg>\n`;
// Web files sit at the edition folder's top (the build copies them); the rest under source/.
const WEB = new Set(['favicon.svg', 'mask-icon.svg', 'splash.svg']);
const out = (rel, text) => {
  const [id, ...rest] = rel.split('/');
  const name = rest.join('/');
  written.set(join(outDir, id, WEB.has(name) ? name : `source/${name}`), text);
};
const title = (t) => `<title>${t}</title>`;

function markBody(e, c, { heavy = false, accent, mono = false } = {}) {
  const cut = mono ? CUT_MONO[e.cut] : CUT[e.cut];
  return `<path fill="${c.ink}" d="${P}"/>\n<path fill="${accent}" d="${cut}"/>\n<path fill="${c.prime}" d="${heavy ? PRIME_HEAVY : PRIME}"/>`;
}

for (const [id, e] of Object.entries(ED)) {
  // 1. Icon mark, no tile (in-app BrandMark, About screen, email avatar). viewBox matches BrandMark.jsx.
  for (const t of ['light', 'dark']) {
    out(`${id}/mark-${t}.svg`, svg('10 0 88 93', `${title(e.brand)}\n${markBody(e, ICON[t], { accent: e.accent[t] })}`, ' role="img"'));
  }
  // 2. Favicon: shipped favicon geometry and heavy prime; follows the browser's colour scheme.
  out(`${id}/favicon.svg`, svg('0 0 100 100',
`<style>.b{fill:${ICON.light.bg}}.i{fill:${ICON.light.ink}}.c{fill:${e.accent.light}}.p{fill:${ICON.light.prime}}@media (prefers-color-scheme:dark){.b{fill:${ICON.dark.bg}}.i{fill:${ICON.dark.ink}}.c{fill:${e.accent.dark}}.p{fill:${ICON.dark.prime}}}</style>
<rect class="b" width="100" height="100"/>
<g transform="${FIT.favicon}"><path class="i" d="${P}"/><path class="c" d="${CUT[e.cut]}"/><path class="p" d="${PRIME_HEAVY}"/></g>`,
    ' width="32" height="32"'));
  // 3. Safari pinned-tab mask icon: one colour, no fills (Safari paints it with link rel=mask-icon color=…).
  out(`${id}/mask-icon.svg`, svg('0 0 100 100',
    `<g transform="${FIT.favicon}"><path d="${P}"/><path d="${CUT_MONO[e.cut]}"/><path d="${PRIME_HEAVY}"/></g>`));
  // 4. Raster sources (square, full bleed; stores and OSes apply their own corner masks).
  const tile = (c, accent, fit, mono = false) => svg('0 0 100 100',
    `<rect fill="${c.bg}" width="100" height="100"/>\n<g transform="${fit}">\n${markBody(e, c, { accent, mono })}\n</g>`);
  out(`${id}/icon-source/app-light.svg`, tile(ICON.light, e.accent.light, FIT.app));
  out(`${id}/icon-source/app-dark.svg`, tile(ICON.dark, e.accent.dark, FIT.app));
  out(`${id}/icon-source/app-tinted.svg`, tile(ICON.tinted, ICON.tinted.cut, FIT.app, true));
  out(`${id}/icon-source/maskable-light.svg`, tile(ICON.light, e.accent.light, FIT.maskable));
  // 5. Android adaptive-icon layers (same 108 dp frame and 0.52 group transform as origin/main).
  const vec = (fills, cut, note) => `<?xml version="1.0" encoding="utf-8"?>
<!-- ${note} -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp"
    android:viewportWidth="108" android:viewportHeight="108">
    <group android:translateX="25.92" android:translateY="29.82" android:scaleX="0.52" android:scaleY="0.52">
        <path android:fillColor="${fills[0]}" android:pathData="${P}" />
        <path android:fillColor="${fills[1]}" android:pathData="${cut}" />
        <path android:fillColor="${fills[2]}" android:pathData="${PRIME}" />
    </group>
</vector>
`;
  out(`${id}/android/drawable/ic_launcher_foreground.xml`, vec(['@color/pri_icon_ink', '@color/pri_icon_accent', '@color/pri_icon_prime'], CUT[e.cut],
    `Adaptive foreground: ${e.brand} P-prime mark with its counter cut; 0.52 scale inside the 66dp safe circle.`));
  out(`${id}/android/drawable/ic_launcher_monochrome.xml`, vec(['#FF000000', '#FF000000', '#FF000000'], CUT_MONO[e.cut],
    `Themed-icon (monochrome) layer: ${e.brand} P-prime mark; the cut is inset so it stays separate in one colour.`));
  const colors = (night) => `<?xml version="1.0" encoding="utf-8"?>
<!-- ${e.brand} icon colours (${night ? 'night' : 'day'}). Merge into android/app/src/main/res/values${night ? '-night' : ''}/colors.xml; pri_background stays as it is. -->
<resources>
    <color name="pri_icon_background">#FF${(night ? ICON.dark : ICON.light).bg.slice(1)}</color>
    <color name="pri_icon_ink">#FF${(night ? ICON.dark : ICON.light).ink.slice(1)}</color>
    <color name="pri_icon_prime">#FF${(night ? ICON.dark : ICON.light).prime.slice(1)}</color>
    <color name="pri_icon_accent">#FF${e.accent[night ? 'dark' : 'light'].slice(1)}</color>
</resources>
`;
  out(`${id}/android/values/colors.xml`, colors(false));
  out(`${id}/android/values-night/colors.xml`, colors(true));
  // 6. Splash (client/public/splash.svg) with the cut drawn after the prime lands.
  out(`${id}/splash.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><style>path{fill:none;stroke:#1a1d21;animation:d .3s cubic-bezier(.6,0,.3,1) .05s forwards}.s{stroke-width:17;stroke-dasharray:76;stroke-dashoffset:76}.b{stroke-width:14;stroke-dasharray:106;stroke-dashoffset:106;animation-duration:.42s;animation-delay:.33s}.p{fill:#b8402a;stroke:none;transform-box:fill-box;transform-origin:70% 0;transform:scaleY(0);animation:q .2s cubic-bezier(.2,.8,.3,1) .78s forwards}.c{fill:${e.accent.light.toLowerCase()};stroke:none;opacity:0;animation:f .18s linear 1s forwards}@keyframes d{to{stroke-dashoffset:0}}@keyframes q{to{transform:none}}@keyframes f{to{opacity:1}}@media (prefers-color-scheme:dark){path{stroke:#f3efe6}.p{fill:#d9604a}.c{fill:${e.accent.dark.toLowerCase()}}}@media (prefers-reduced-motion:reduce){path,.p,.c{animation:none!important;stroke-dashoffset:0;transform:none;opacity:1}}</style><path class="s" d="M24 13V88"/><path class="b" d="M24 20H47a21.5 21.5 0 0 1 0 43H24"/><path class="c" d="${CUT[e.cut]}"/><path class="p" d="M82 5L92.5 7.2L83.5 30L77 28.4Z"/></svg>\n`);

  // 7. Wordmarks (outlined; no font needed). Font units, baseline y = 0.
  const w = WM.wordmarks[id];
  const vb = viewBoxOf([WM_RAW.wordmarks[id].d, WM_RAW.wordmarks[id].primeSmall], 10);
  for (const t of ['light', 'dark']) {
    const c = TEXT[t];
    out(`${id}/wordmark-${t}.svg`, svg(vb, `${title(e.brand)}\n<path fill="${c.ink}" d="${w.d}"/>\n<path fill="${c.prime}" d="${w.prime}"/>`, ' role="img"'));
    out(`${id}/wordmark-small-${t}.svg`, svg(vb, `${title(e.brand)}\n<path fill="${c.ink}" d="${w.d}"/>\n<path fill="${c.prime}" d="${w.primeSmall}"/>`, ' role="img"'));
  }
}

// Hindi running-text lockup for Priyabhata (no prime: the prime belongs to the Latin P).
{
  const w = WM.wordmarks['priyabhata-hi'];
  const vb = viewBoxOf([WM_RAW.wordmarks['priyabhata-hi'].d], 10);
  for (const t of ['light', 'dark']) {
    out(`priyabhata/wordmark-hi-${t}.svg`, svg(vb, `<title>प्रियभट</title>\n<path fill="${TEXT[t].ink}" d="${w.d}"/>`, ' role="img" lang="hi"'));
  }
}

// Path data for client/src/brand/paths.js: named exports, so a build keeps only
// its own edition's wordmark (client/src/brand/edition.js picks one).
{
  const wm = (k) => { const v = WM.wordmarks[k], raw = WM_RAW.wordmarks[k]; return { d: v.d, prime: v.prime, primeSmall: v.primeSmall, viewBox: viewBoxOf([raw.d, raw.primeSmall], 10) }; };
  const js = `// GENERATED by tools/brand/build-assets.mjs from tools/brand/wordmarks.json — do not edit.
// The P-prime mark, each edition's counter cut and outlined wordmark (Direction A,
// docs/brand/editions-decision.md). Coordinates: the mark's own units; wordmarks
// in font units (1000/em), baseline y = 0.
export const P_PATH = ${JSON.stringify(P)};
export const PRIME_PATH = ${JSON.stringify(PRIME)};
// Plain literals, not Object.freeze() calls: a call counts as a side effect, and
// the bundler would then keep the other edition's wordmark in every build.
export const CUT_PATHS = ${JSON.stringify(CUT)};
export const PRIYABHATA_WORDMARK = ${JSON.stringify(wm('priyabhata'))};
export const PRITHAGORAS_WORDMARK = ${JSON.stringify(wm('prithagoras'))};
`;
  written.set(join(ROOT, 'client/src/brand/paths.js'), js);
}

let stale = 0;
for (const [file, text] of written) {
  if (CHECK) {
    const now = existsSync(file) ? readFileSync(file, 'utf8') : null;
    if (now !== text) { stale++; console.error(`stale: ${file.slice(ROOT.length)}`); }
  } else {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
}
if (CHECK) {
  if (stale) { console.error(`brand assets: ${stale} file(s) differ from tools/brand/build-assets.mjs — run it and commit the result`); process.exit(1); }
  console.log(`brand assets: ${written.size} files equal the generator's output`);
} else console.log(`brand assets: wrote ${written.size} files`);
