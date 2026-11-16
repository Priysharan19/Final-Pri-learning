#!/usr/bin/env node
// Pri Learning public site · generator.
//
//   node site/build.mjs           write site/public from docs/legal and site/src
//   node site/build.mjs --check   exit 1 if site/public differs from what would be written
//
// The output is committed. tools/site-check.mjs runs the same render and fails
// CI when site/public is stale, so a change to a notice in docs/legal cannot
// reach main without the published page changing with it. Vercel serves
// site/public as static files with no build step and no environment.
//
// The render is deterministic: no dates, no hashes, no environment. Running it
// twice on the same inputs writes the same bytes.

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROUTES, SITE_ORIGIN } from './src/config.mjs';
import { deleteAccountPage, hindiIndexPage, homePage, notFoundPage, noticePage, supportPage } from './src/pages.mjs';

const SITE_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(SITE_DIR, '..');
export const OUTPUT_DIR = join(SITE_DIR, 'public');

const NOTICES = ['privacy', 'terms', 'refund-policy', 'grievance'];

/** The notices, both languages, read from docs/legal. */
export function readNotices(repoRoot = REPO_ROOT) {
  const docs = {};
  for (const slug of NOTICES) {
    const file = { en: `${slug}.md`, hi: `${slug}.hi.md` };
    docs[slug] = {
      file,
      en: readFileSync(join(repoRoot, 'docs/legal', file.en), 'utf8'),
      hi: readFileSync(join(repoRoot, 'docs/legal', file.hi), 'utf8')
    };
  }
  return docs;
}

/** A route → the file it is served from (directories with index.html). */
export function fileForRoute(route) {
  const clean = route.replace(/#.*$/, '');
  if (clean === '/') return 'index.html';
  return `${clean.replace(/^\//, '')}/index.html`;
}

/**
 * Render every file of the site into a Map of relative path → contents.
 * Pure: reads docs/legal and site/src, writes nothing.
 */
export function renderSite({ repoRoot = REPO_ROOT } = {}) {
  const docs = readNotices(repoRoot);
  const files = new Map();
  const put = (path, body) => { files.set(path, body); };

  put(fileForRoute('/'), homePage({ docs }));
  put(fileForRoute('/404'), notFoundPage());
  put(fileForRoute('/hi'), hindiIndexPage({ docs }));
  for (const lang of ['en', 'hi']) {
    put(fileForRoute(ROUTES[lang].support), supportPage({ lang, docs }));
    put(fileForRoute(ROUTES[lang]['delete-account']), deleteAccountPage({ lang, docs }));
    for (const slug of ['privacy', 'terms', 'refund-policy']) {
      put(fileForRoute(ROUTES[lang][slug]), noticePage({ slug, lang, docs }));
    }
  }
  // Vercel looks for a top-level 404.html; keep the directory form too for
  // any other static host.
  put('404.html', files.get(fileForRoute('/404')));
  files.delete(fileForRoute('/404'));

  const src = join(SITE_DIR, 'src');
  put('styles.css', readFileSync(join(src, 'styles.css'), 'utf8'));
  put('theme.js', readFileSync(join(src, 'theme.js'), 'utf8'));
  put('favicon.svg', readFileSync(join(src, 'favicon.svg'), 'utf8'));
  put('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`);

  const routes = ['/', '/hi', ...['en', 'hi'].flatMap(lang => (
    ['support', 'privacy', 'terms', 'refund-policy', 'delete-account'].map(key => ROUTES[lang][key])
  ))];
  put('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map(route => `  <url><loc>${SITE_ORIGIN}${route}</loc></url>`).join('\n')}\n</urlset>\n`);

  return new Map([...files].sort(([a], [b]) => a.localeCompare(b)));
}

/** Every file under site/public as a Map, for comparison. */
export function readOutput(dir = OUTPUT_DIR) {
  const files = new Map();
  const walk = (d) => {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.set(relative(dir, full), readFileSync(full, 'utf8'));
    }
  };
  walk(dir);
  return files;
}

/** Paths whose bytes differ, are missing from, or are extra in the output. */
export function diffOutput(rendered, committed) {
  const stale = [];
  for (const [path, body] of rendered) {
    if (!committed.has(path)) stale.push(`${path}: missing from site/public`);
    else if (committed.get(path) !== body) stale.push(`${path}: differs from the render`);
  }
  for (const path of committed.keys()) {
    if (!rendered.has(path)) stale.push(`${path}: in site/public but not produced by the generator`);
  }
  return stale;
}

function writeOutput(files) {
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  for (const [path, body] of files) {
    const full = join(OUTPUT_DIR, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const rendered = renderSite();
  if (process.argv.includes('--check')) {
    const stale = diffOutput(rendered, readOutput());
    if (stale.length) {
      console.error('site/public is stale. Run `node site/build.mjs` and commit the result.');
      for (const line of stale) console.error(`  · ${line}`);
      process.exit(1);
    }
    console.log(`site/public is current: ${rendered.size} files match the render.`);
  } else {
    writeOutput(rendered);
    console.log(`Wrote ${rendered.size} files to ${relative(process.cwd(), OUTPUT_DIR) || '.'}`);
    for (const path of rendered.keys()) console.log(`  ${path}`);
  }
}
