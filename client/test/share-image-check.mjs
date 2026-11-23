// Pri Learning · the Prithagoras share card (og:/twitter: tags and share.png)
//
// Holds: the edition's page names an absolute 1200 x 630 image that exists, once
// per tag; the card is the dark page with no gradient in its SVG source; no
// personal detail is on it; and Priyabhata's page is exactly what it was (the
// plain summary card, no image).
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { editionOf } from '../edition.config.mjs';
import { builtIndexHtml, shareImageUrl } from '../brand/edition-brand.mjs';

const here = rel => fileURLToPath(new URL(rel, import.meta.url));
let n = 0;
const ok = (cond, label) => { assert.ok(cond, label); n++; };
const count = (html, needle) => html.split(needle).length - 1;

const share = editionOf('prithagoras').identity.share;
const au = builtIndexHtml('prithagoras');
const url = shareImageUrl(share);

ok(/^https:\/\/[a-z0-9.-]+\/share\.png$/.test(url), `the image URL is absolute and https (${url})`);
ok(url.startsWith(share.origin + '/'), 'the image is on the edition\'s own public origin');
for (const tag of [
  `<meta property="og:image" content="${url}">`,
  `<meta name="twitter:image" content="${url}">`,
  `<meta property="og:url" content="${share.origin}/">`,
  `<meta name="twitter:card" content="summary_large_image">`,
  `<meta property="og:title" content="${share.title}">`,
  `<meta property="og:image:width" content="1200">`,
  `<meta property="og:image:height" content="630">`
]) ok(count(au, tag) === 1, `exactly one ${tag}`);
ok(count(au, 'property="og:title"') === 1 && count(au, 'property="og:description"') === 1, 'og:title and og:description appear once');
ok(count(au, 'name="twitter:card"') === 1, 'twitter:card appears once');
ok(!/%PRI_/.test(au), 'no placeholder is left');

const png = readFileSync(here('../brand/prithagoras/share.png'));
ok(png.subarray(1, 4).toString() === 'PNG', 'share.png is a PNG');
ok(png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630, `share.png is 1200 x 630 (${png.readUInt32BE(16)} x ${png.readUInt32BE(20)})`);
ok(png[25] === 2, 'share.png is opaque RGB (colour type 2)');
ok(png.length < 120 * 1024, `share.png is small (${png.length} bytes)`);
// Row 0, pixel 0 is the dark page colour (#121210); the first pixel of a scanline is literal under every PNG filter.
const idat = []; let off = 8;
while (off < png.length) { const len = png.readUInt32BE(off); if (png.toString('ascii', off + 4, off + 8) === 'IDAT') idat.push(png.subarray(off + 8, off + 8 + len)); off += 12 + len; }
const raw = inflateSync(Buffer.concat(idat));
ok(raw[1] === 0x12 && raw[2] === 0x12 && raw[3] === 0x10, 'the card background is the dark page colour #121210');

const svg = readFileSync(here('../brand/prithagoras/source/share-image.svg'), 'utf8');
ok(existsSync(here('../../tools/brand/share-image.mjs')), 'the generator is in the repo');
ok(!/gradient|filter|<image/i.test(svg), 'the SVG source has no gradient, filter or embedded photograph');
ok(svg.includes('HSC Mathematics Advanced and Extension 1'), 'the card carries the one line');
ok(!/\S@\S|ABN|\+61|tripathi|priysharan/i.test(svg + au), 'no owner name, ABN, email or phone on the card or its tags');

const india = builtIndexHtml('priyabhata');
ok(!/og:image|twitter:image|og:url/.test(india), 'Priyabhata\'s page has no share image tags');
ok(india.includes('<meta name="twitter:card" content="summary">'), 'Priyabhata keeps the plain summary card');
ok(editionOf('priyabhata').identity.share === undefined, 'Priyabhata declares no share record');

console.log(`SHARE IMAGE: PASS — ${n}/${n} checks`);
