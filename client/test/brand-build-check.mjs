// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a build carries its own edition's brand and no other (plan E4)
//
// Reads a production build (client/dist by default) and proves that:
//   1. its index.html, manifest.webmanifest, favicon, mask icon, splash and
//      app icons are exactly its edition's (features.json names the edition);
//   2. no file in it carries the other edition's name, accent, wordmark path
//      data or icon bytes;
// and with --both, builds the other edition into a temporary folder and
// proves the two builds differ ONLY where branding should: the brand files of
// (1), features.json, the service worker's version line, and the one script
// chunk that holds the wordmark — every other file is byte-identical once
// content hashes are set aside.
//
// Usage: node client/test/brand-build-check.mjs [--dist <dir>] [--both]
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EDITIONS, EDITION_IDS } from '../edition.config.mjs';
import { WEB_FILES, brandFile, webManifest } from '../brand/edition-brand.mjs';
import { PRIYABHATA_WORDMARK, PRITHAGORAS_WORDMARK } from '../src/brand/paths.js';

const CLIENT = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const DIST = args.includes('--dist') ? args[args.indexOf('--dist') + 1] : join(CLIENT, 'dist');
const BOTH = args.includes('--both');

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const walk = (d, base = '') => readdirSync(d).flatMap(n => {
  const p = join(d, n), r = base ? `${base}/${n}` : n;
  return statSync(p).isDirectory() ? walk(p, r) : [r];
});
const WORDMARK_OF = { priyabhata: PRIYABHATA_WORDMARK, prithagoras: PRITHAGORAS_WORDMARK };
// The tail of a wordmark's path: present only where that wordmark is.
const wordmarkTail = id => WORDMARK_OF[id].d.slice(-48);

function checkBuild(dist) {
  const edition = JSON.parse(readFileSync(join(dist, 'features.json'), 'utf8')).edition;
  ok(EDITION_IDS.includes(edition), `${dist}: features.json names an edition (${edition})`);
  const e = EDITIONS[edition];
  const other = EDITION_IDS.find(id => id !== edition);
  const o = EDITIONS[other];

  for (const rel of WEB_FILES) {
    ok(readFileSync(join(dist, rel)).equals(readFileSync(brandFile(edition, rel))), `${edition}: dist/${rel} is the edition's own file`);
  }
  ok(JSON.stringify(JSON.parse(readFileSync(join(dist, 'manifest.webmanifest'), 'utf8'))) === JSON.stringify(webManifest(edition)), `${edition}: dist/manifest.webmanifest is the edition's manifest`);
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  ok(html.includes(`<title>${e.brand}</title>`) && html.includes(`data-edition="${edition}"`) && !/%PRI_[A-Z_]+%/.test(html), `${edition}: index.html is titled ${e.brand}, marked, and fully filled`);
  const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
  ok(['/manifest.webmanifest', '/favicon.svg', '/splash.svg', '/icons/icon-192.png'].every(f => sw.includes(`"${f}"`)), `${edition}: the service worker installs the brand files`);

  const otherIcons = WEB_FILES.filter(f => f.endsWith('.png')).map(f => readFileSync(brandFile(other, f)));
  const leaks = [];
  let ownWordmark = 0;
  for (const rel of walk(dist)) {
    const bytes = readFileSync(join(dist, rel));
    if (otherIcons.some(b => b.equals(bytes))) leaks.push(`${rel} (the other edition's icon)`);
    if (!/\.(js|css|html|json|webmanifest|svg|txt)$/.test(rel)) continue;
    const text = bytes.toString('utf8');
    if (text.includes(wordmarkTail(other))) leaks.push(`${rel} (${o.brand}'s wordmark)`);
    if (text.includes(wordmarkTail(edition))) ownWordmark++;
    // The edition table never reaches a bundle: the build replaces its one reader with this edition's record.
    if (text.includes('defaultCourse') && text.includes('capabilities')) leaks.push(`${rel} (the edition table)`);
    if (text.includes(o.brand) || text.toLowerCase().includes(o.identity.accent.light) || text.toLowerCase().includes(o.identity.accent.dark)) leaks.push(`${rel} (${o.brand}'s name or accent)`);
  }
  ok(leaks.length === 0, `${edition}: no file carries anything of ${o.brand}: ${leaks.join(', ')}`);
  ok(ownWordmark === 1, `${edition}: exactly one file carries its own wordmark (${ownWordmark})`);
  return edition;
}

const norm = s => s.replace(/-[A-Za-z0-9_-]{8}\.(js|css|woff2?|ttf|png|svg|json)\b/g, '-#.$1').replace(/pri-[0-9a-f]{12}/g, 'pri-#');
function contents(dist) {
  const byName = new Map();
  for (const rel of walk(dist)) {
    const bytes = readFileSync(join(dist, rel));
    const text = /\.(js|css|html|json|webmanifest|svg|txt)$/.test(rel);
    byName.set(rel, text ? norm(bytes.toString('utf8')) : bytes.toString('base64'));
  }
  return byName;
}

const first = checkBuild(DIST);
if (BOTH) {
  const other = EDITION_IDS.find(id => id !== first);
  const out = mkdtempSync(join(tmpdir(), `pri-${other}-`));
  try {
    execFileSync('npx', ['vite', 'build', '--outDir', out, '--emptyOutDir'], { cwd: CLIENT, env: { ...process.env, PRI_EDITION: other }, stdio: ['ignore', 'ignore', 'inherit'] });
    checkBuild(out);
    const A = contents(DIST), B = contents(out);
    ok(A.size === B.size, `the two builds have the same number of files (${A.size}, ${B.size})`);
    // Files that keep their name (no content hash) are compared by name; hashed
    // chunks are compared as a set of normalised contents.
    const plain = rel => !/-[A-Za-z0-9_-]{8}\.\w+$/.test(rel);
    const BRAND = new Set([...WEB_FILES, 'index.html', 'manifest.webmanifest', 'features.json', 'sw.js']);
    const plainDiffer = [...A.keys()].filter(plain).filter(rel => A.get(rel) !== B.get(rel));
    ok(plainDiffer.every(rel => BRAND.has(rel)), `unhashed files differ only where the brand is: ${plainDiffer.filter(r => !BRAND.has(r)).join(', ')}`);
    ok(WEB_FILES.every(rel => plainDiffer.includes(rel)) && ['index.html', 'manifest.webmanifest'].every(rel => plainDiffer.includes(rel)), 'and every brand file does differ');
    const swLines = (m, f) => m.get('sw.js').split('\n').filter(l => !/^const (VERSION|PRECACHE|WARM|OPTIONAL) = /.test(l)).join('\n');
    ok(swLines(A) === swLines(B), 'sw.js differs only in its generated version and file lists');
    const bag = m => [...m.entries()].filter(([rel]) => !plain(rel)).map(([, c]) => c);
    const inA = bag(A), inB = new Set(bag(B)), inBArr = bag(B), inASet = new Set(inA);
    const onlyA = inA.filter(c => !inB.has(c)), onlyB = inBArr.filter(c => !inASet.has(c));
    ok(onlyA.length === 1 && onlyB.length === 1, `exactly one hashed chunk differs between the builds (${onlyA.length}, ${onlyB.length})`);
    ok(onlyA.every(c => c.includes(wordmarkTail(first))) && onlyB.every(c => c.includes(wordmarkTail(other))), 'and it is the chunk that holds the wordmark');
    console.log(`  ${first} vs ${other}: ${plainDiffer.length} named files differ (${plainDiffer.sort().join(', ')}), ${onlyA.length} hashed chunk differs, ${A.size - plainDiffer.length - onlyA.length} files identical`);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

if (failures.length) {
  console.error(`\nbrand-build-check: ${failures.length} FAILED, ${pass} passed`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`BRAND BUILD: PASS — ${pass}/${pass} checks${BOTH ? ' — both editions built; they differ only in brand files and the wordmark chunk' : ''}`);
