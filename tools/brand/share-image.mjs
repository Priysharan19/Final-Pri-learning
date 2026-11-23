#!/usr/bin/env node
// Pri Learning · the share image of an edition that has one (identity.share in
// client/edition.config.mjs): the 1200 x 630 card a link to the site shows.
//
//   node tools/brand/share-image.mjs prithagoras
//
// Draws client/brand/<edition>/source/share-image.svg from the edition's own
// outlined wordmark (source/wordmark-dark.svg) on the dark page colour, with
// one line of text under it, then rasterises it with the Playwright Chromium
// the client already installs, as rasterise-icons.mjs does, to
// client/brand/<edition>/<identity.share.image>. The line is set in Inter (the
// interface face, from the client's own dependency), so the PNG does not depend
// on a font of the machine that made it. No gradient, no photograph, no name or
// address of a person. Chromium's anti-aliasing is not byte-stable across
// machines, so client/test/share-image-check.mjs holds the PNG to its size, its
// opacity and the dark page colour, not to its bytes.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { EDITION_IDS, editionOf } from '../../client/edition.config.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const [, , edition] = process.argv;
if (!EDITION_IDS.includes(edition) || !editionOf(edition).identity.share) {
  console.error(`usage: node tools/brand/share-image.mjs <an edition with identity.share: ${EDITION_IDS.filter(id => editionOf(id).identity.share).join('|')}>`);
  process.exit(2);
}
const share = editionOf(edition).identity.share;
const kit = join(ROOT, 'client/brand', edition);

const PAGE = '#121210';          // theme.css [data-theme="dark"] --page
const LINE = '#b9b6ab';          // a quiet ink on that page
const LINE_TEXT = 'HSC Mathematics Advanced and Extension 1';

const wordmark = readFileSync(join(kit, 'source/wordmark-dark.svg'), 'utf8');
const viewBox = wordmark.match(/viewBox="([^"]+)"/)[1];
const [, , vw, vh] = viewBox.split(/\s+/).map(Number);
const paths = [...wordmark.matchAll(/<path [^>]*>/g)].map(m => m[0]).join('\n    ');
const W = 640, H = Math.round(W * vh / vw);   // the wordmark's width on the card, and its height at that width
const X = 96, Y = 204;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${share.width}" height="${share.height}" viewBox="0 0 ${share.width} ${share.height}" role="img">
  <title>${share.alt}</title>
  <rect width="${share.width}" height="${share.height}" fill="${PAGE}"/>
  <svg x="${X}" y="${Y}" width="${W}" height="${H}" viewBox="${viewBox}">
    ${paths}
  </svg>
  <text x="${X + 4}" y="${Y + H + 74}" font-family="'Inter Variable', Inter, sans-serif" font-size="38" font-weight="450" fill="${LINE}">${LINE_TEXT}</text>
</svg>
`;
writeFileSync(join(kit, 'source/share-image.svg'), svg);

const fontFile = join(ROOT, 'client/node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2');
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:'Inter Variable';font-weight:100 900;src:url(${pathToFileURL(fontFile).href}) format('woff2-variations')}
html,body{margin:0;background:${PAGE}}svg{display:block}</style>${svg}`;
const { chromium } = createRequire(join(ROOT, 'client/package.json'))('playwright');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: share.width, height: share.height }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(kit, share.image), clip: { x: 0, y: 0, width: share.width, height: share.height } });
} finally { await browser.close(); }
console.log(`wrote client/brand/${edition}/source/share-image.svg and client/brand/${edition}/${share.image}`);
