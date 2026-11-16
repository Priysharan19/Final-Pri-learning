#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · third-party notices, generated from the dependency licences
//
// The app ships other people's software and owes them the attribution their
// licences ask for. This tool writes docs/legal/third-party/NOTICES.md from
// what actually ships, so the page can never list a package the app no longer
// carries or miss one it has gained:
//
//   · the web app's production dependencies, read from client/package-lock.json
//     (everything the browser bundle and the iPhone, iPad and Android shells
//     load), each with the licence text found in its package;
//   · the libraries the Android app declares, read from the Gradle version
//     catalogue and the app module's implementation() lines, each with the
//     licence its publisher names. Their own dependencies ship too and are not
//     enumerated (that needs a committed Gradle lockfile); the page says so;
//   · the iPhone and iPad app, which uses Apple's own frameworks only.
//
// Server dependencies are deliberately absent: they run on Pri's server and are
// not distributed to anyone's device.
//
//   node tools/third-party-notices.mjs           write the document
//   node tools/third-party-notices.mjs --check   fail if the committed one is stale
//
// The check runs inside `npm run test:legal`, so a dependency change that is
// not accompanied by a regenerated notices page fails CI. Client dependencies
// must be installed (npm ci --prefix client), because the licence texts are
// read from node_modules, not invented here.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = 'docs/legal/third-party/NOTICES.md';
const LOCK = 'client/package-lock.json';
const MODULES = 'client/node_modules';
const CATALOGUE = 'android/gradle/libs.versions.toml';
const APP_GRADLE = 'android/app/build.gradle.kts';

const read = rel => readFileSync(join(ROOT, rel), 'utf8');
const check = process.argv.includes('--check');

// ── The web app ──────────────────────────────────────────────────────────────

/** Production packages from the lockfile: not dev-only, not an optional native binary. */
function webPackages() {
  const lock = JSON.parse(read(LOCK));
  if (lock.lockfileVersion < 2) throw new Error(`${LOCK} is lockfileVersion ${lock.lockfileVersion}; this tool reads the v2/v3 "packages" map`);
  const out = [];
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!path || entry.dev) continue;
    if (entry.optional) continue;                   // platform binaries npm installs for Node, never for the browser
    const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
    out.push({ name, path, version: entry.version, license: entry.license || null });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

const LICENCE_FILE = /^(LICEN[CS]E|COPYING)(\.|-|$)/i;

/** The licence text a package ships, cleaned of line-ending and trailing-space noise. */
function licenceTextOf(pkg) {
  const dir = join(ROOT, 'client', pkg.path);
  if (!existsSync(dir)) {
    throw new Error(`${pkg.name}@${pkg.version} is not installed at client/${pkg.path} — run: npm ci --prefix client`);
  }
  const file = readdirSync(dir).filter(f => LICENCE_FILE.test(f)).sort()[0];
  if (!file) return null;
  return readFileSync(join(dir, file), 'utf8')
    .replace(/\r\n?/g, '\n')
    .split('\n').map(line => line.replace(/\s+$/, '')).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function metadataOf(pkg) {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'client', pkg.path, 'package.json'), 'utf8'));
  const repository = typeof manifest.repository === 'string'
    ? manifest.repository
    : manifest.repository?.url || null;
  const home = manifest.homepage || (repository ? repository.replace(/^git\+/, '').replace(/\.git$/, '').replace(/^git:\/\//, 'https://') : null);
  const author = typeof manifest.author === 'string' ? manifest.author : manifest.author?.name || null;
  return {
    license: pkg.license || (typeof manifest.license === 'string' ? manifest.license : manifest.license?.type) || 'see licence text',
    home,
    author
  };
}

// Markdown control characters at the start of a line would be read as
// structure by the Legal page's reader (a heading, a bullet, a table row).
// Licence texts have none today; if one ever does, it is escaped rather than
// rendered as something its author did not write.
const neutralise = text => text.split('\n').map(line => (/^\s*(#{1,6}\s|\|)/.test(line) ? `\\${line.trimStart()}` : line)).join('\n');

// ── The Android app ──────────────────────────────────────────────────────────

/**
 * Who publishes a library decides which licence text applies. A library whose
 * group is not listed here fails the build on purpose: adding a dependency to
 * the Android app is also a decision about whose licence the app now carries,
 * and that decision is recorded here, not guessed.
 */
const ANDROID_LICENCES = [
  [/^androidx\./, { name: 'Apache License 2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0', publisher: 'The Android Open Source Project' }],
  [/^com\.android\.billingclient:/, { name: 'Android Software Development Kit License Agreement', url: 'https://developer.android.com/studio/terms', publisher: 'Google LLC' }],
  [/^com\.google\.android\.gms:/, { name: 'Android Software Development Kit License Agreement', url: 'https://developer.android.com/studio/terms', publisher: 'Google LLC' }],
  [/^org\.jetbrains\.kotlin:/, { name: 'Apache License 2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0', publisher: 'JetBrains s.r.o. and Kotlin contributors' }]
];

function androidLibraries() {
  const toml = read(CATALOGUE);
  const section = name => (toml.split(/^\[(\w+)\]\s*$/m).reduce((acc, part, i, all) => (part === name ? all[i + 1] : acc), '') || '');
  const versions = Object.fromEntries([...section('versions').matchAll(/^(\w[\w-]*)\s*=\s*"([^"]+)"/gm)].map(m => [m[1], m[2]]));
  const libraries = Object.fromEntries([...section('libraries').matchAll(/^([\w-]+)\s*=\s*\{\s*module\s*=\s*"([^"]+)"\s*,\s*version\.ref\s*=\s*"([^"]+)"\s*\}/gm)]
    .map(m => [m[1], { module: m[2], version: versions[m[3]] }]));

  // Only what the app module compiles into the APK: implementation(libs.x).
  // Test-only libraries never reach a student's device.
  const aliases = [...read(APP_GRADLE).matchAll(/^\s*implementation\(libs\.([\w.]+)\)/gm)].map(m => m[1].replace(/\./g, '-'));
  const out = aliases.map(alias => {
    const lib = libraries[alias];
    if (!lib) throw new Error(`${APP_GRADLE} uses libs.${alias} but ${CATALOGUE} does not define it`);
    return lib;
  });
  // The Kotlin standard library ships in every Kotlin app whether or not the
  // module names it; its version is the plugin's.
  if (versions.kotlin) out.push({ module: 'org.jetbrains.kotlin:kotlin-stdlib', version: versions.kotlin });

  return out
    .map(lib => {
      const licence = ANDROID_LICENCES.find(([re]) => re.test(lib.module))?.[1];
      if (!licence) throw new Error(`no licence is recorded for Android library ${lib.module}; add its publisher's licence to ANDROID_LICENCES in tools/third-party-notices.mjs`);
      return { ...lib, licence };
    })
    .sort((a, b) => a.module.localeCompare(b.module));
}

// ── The document ─────────────────────────────────────────────────────────────

function render() {
  const web = webPackages();
  const android = androidLibraries();
  const lines = [];
  const push = (...xs) => lines.push(...xs);

  push('# Third-party notices', '');
  push('Pri Learning is built with open-source software. This page lists every package',
    'in the web app, with its licence as its authors published it, in English, and',
    'the libraries the Android app declares, with the licence each publisher names.',
    'It is generated by `tools/third-party-notices.mjs` from',
    '`client/package-lock.json` and `android/gradle/libs.versions.toml`; do not edit',
    'it by hand, because the next generation would overwrite the edit.', '');
  push('The software that runs on our server is not distributed to your device and is',
    'not listed here.', '');

  push('## The web app', '');
  push('These packages make up the web app, which is also what runs inside the iPhone,',
    `iPad and Android apps. ${web.length} packages.`, '');
  for (const pkg of web) {
    const meta = metadataOf(pkg);
    const text = licenceTextOf(pkg);
    push(`### ${pkg.name} ${pkg.version}`, '');
    const facts = [`Licence: ${meta.license}`];
    if (meta.author) facts.push(`Author: ${meta.author}`);
    if (meta.home) facts.push(`Source: ${meta.home}`);
    push(facts.join('. ') + '.', '');
    if (text) push(neutralise(text), '');
    else push(`The package declares the ${meta.license} licence and ships no licence file; the licence text is published at its source address above.`, '');
  }

  push('## The Android app', '');
  push('The Android app is a shell around the web app above. These are the libraries',
    'it declares, and the Kotlin standard library, under the licences their publishers',
    'name. Those libraries bring in libraries of their own, which also ship in the app',
    'under the licences set by their own publishers; they are not listed here one by',
    'one.', '');
  for (const lib of android) {
    push(`- **${lib.module}** ${lib.version} — ${lib.licence.name} (${lib.licence.publisher}), ${lib.licence.url}`);
  }
  push('');
  push('The text of the Apache License 2.0 is reproduced above under pdfjs-dist; the',
    'Android Software Development Kit License Agreement is published by Google at',
    'the address given.', '');

  push('## The iPhone and iPad app', '');
  push('The iPhone and iPad app is a shell around the web app above, built with',
    "Apple's own frameworks (SwiftUI, WebKit, PencilKit and StoreKit) and no",
    'third-party library.', '');

  return lines.join('\n');
}

const document = render();
const target = join(ROOT, OUT);

if (check) {
  const committed = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (committed === document) {
    console.log(`THIRD-PARTY NOTICES: PASS — ${OUT} matches the dependency licences`);
  } else {
    const a = committed.split('\n');
    const b = document.split('\n');
    const first = a.findIndex((line, i) => line !== b[i]);
    console.error(`THIRD-PARTY NOTICES: FAIL — ${OUT} is stale (first difference at line ${first + 1}: committed ${JSON.stringify(a[first] ?? '<end>')}, generated ${JSON.stringify(b[first] ?? '<end>')}). Run: node tools/third-party-notices.mjs`);
    process.exit(1);
  }
} else {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, document);
  console.log(`wrote ${OUT} (${document.length} characters)`);
}
