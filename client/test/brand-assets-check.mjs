// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · each edition's brand files, and what its build carries (plan E4)
//
// Proves, without a browser or a build:
//   1. every committed SVG, Android layer and client/src/brand/paths.js equals
//      the output of tools/brand/build-assets.mjs (geometry and accents from
//      client/edition.config.mjs — one source, nothing hand-edited);
//   2. every PNG icon has the size the manifest and index.html declare, is
//      opaque (native icons RGB: the App Store rejects alpha; web icons RGB or
//      lossless indexed), and differs between the editions;
//   3. index.html leaves no %PRI_…% placeholder unfilled for either edition,
//      and each edition's page and web manifest name only that edition;
//   4. the old static brand files are gone from client/public, so a build can
//      carry no file but its own edition's.
//
// Usage: node client/test/brand-assets-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EDITIONS, EDITION_IDS } from '../edition.config.mjs';
import { WEB_FILES, brandFile, builtIndexHtml, webManifest } from '../brand/edition-brand.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

// 1. Generated vectors equal the generator.
try {
  execFileSync(process.execPath, [join(ROOT, 'tools/brand/build-assets.mjs'), '--check'], { stdio: 'pipe' });
  pass++;
} catch (e) {
  failures.push(`the committed brand files differ from tools/brand/build-assets.mjs:\n${e.stderr}`);
}

// 2. PNG icons.
const png = file => {
  const b = readFileSync(file);
  let trns = false;
  for (let off = 8; off < b.length;) { const len = b.readUInt32BE(off); if (b.toString('ascii', off + 4, off + 8) === 'tRNS') trns = true; off += 12 + len; }
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), colourType: b[25], trns, bytes: b };
};
const SIZES = {
  'icons/icon-180.png': 180, 'icons/icon-192.png': 192, 'icons/icon-512.png': 512, 'icons/icon-maskable-192.png': 192,
  'source/native/ios/AppIcon-1024.png': 1024, 'source/native/ios/AppIcon-dark-1024.png': 1024,
  'source/native/ios/AppIcon-tinted-1024.png': 1024, 'source/native/play/icon-512.png': 512
};
for (const [rel, px] of Object.entries(SIZES)) {
  const seen = [];
  for (const id of EDITION_IDS) {
    const f = brandFile(id, rel);
    if (!existsSync(f)) { failures.push(`${id}: ${rel} is missing — run tools/brand/rasterise-icons.mjs ${id}`); continue; }
    const p = png(f);
    // Native icons must be RGB; a web icon may be indexed (lossless when it has ≤ 256 colours). Neither has alpha.
    const types = rel.startsWith('icons/') ? [2, 3] : [2];
    ok(p.width === px && p.height === px && types.includes(p.colourType) && !p.trns, `${id} ${rel} is ${px}×${px} and opaque, colour type ${types.join(' or ')} (got ${p.width}×${p.height}, colour type ${p.colourType}${p.trns ? ', tRNS' : ''})`);
    seen.push(p.bytes);
  }
  ok(seen.length === 2 && !seen[0].equals(seen[1]), `${rel} differs between the editions`);
}
for (const id of EDITION_IDS) for (const rel of WEB_FILES) ok(existsSync(brandFile(id, rel)), `${id} has ${rel}`);

// 3. Each edition's page and manifest.
for (const id of EDITION_IDS) {
  const e = EDITIONS[id];
  const other = EDITIONS[EDITION_IDS.find(x => x !== id)];
  const html = builtIndexHtml(id);
  ok(!/%PRI_[A-Z_]+%/.test(html), `${id}: index.html has no unfilled placeholder`);
  ok(html.includes(`<title>${e.brand}</title>`) && html.includes(`data-edition="${id}"`), `${id}: the page is titled ${e.brand} and marked data-edition="${id}"`);
  ok(html.includes(`--edition-accent:${e.identity.accent.light}`) && html.includes(`--edition-accent:${e.identity.accent.dark}`), `${id}: the page carries its own accent tokens`);
  ok(!html.includes(other.brand) && !html.includes(other.identity.accent.light), `${id}: the page names nothing of ${other.brand}`);
  ok(!/Pri Learning/.test(html.replace(/<!--[\s\S]*?-->/g, '')), `${id}: the page never calls the app "Pri Learning"`);
  ok(html.includes('<p lang="hi">') === e.languages.includes('hi'), `${id}: the boot fallback has a Hindi line exactly when the edition offers Hindi`);
  const m = webManifest(id);
  ok(m.name === e.brand && m.short_name === e.brand && m.short_name.length <= 12, `${id}: the manifest is named ${e.brand} (fits the 12-character home-screen label)`);
  ok(m.lang === e.locale && m.description === e.identity.description, `${id}: the manifest's language and description are the edition's`);
  ok(m.icons.map(i => i.src).every(src => WEB_FILES.includes(src.slice(1))), `${id}: every manifest icon is a file the build copies`);
}

// 4. No shared static brand files left behind.
for (const rel of ['client/public/manifest.webmanifest', 'client/public/favicon.svg', 'client/public/splash.svg', 'client/public/icons']) {
  ok(!existsSync(join(ROOT, rel)), `${rel} is gone: the build emits the edition's own`);
}

if (failures.length) {
  console.error(`\nbrand-assets-check: ${failures.length} FAILED, ${pass} passed`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`brand-assets-check: ${pass} passed`);
