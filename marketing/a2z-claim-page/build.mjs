// ─────────────────────────────────────────────────────────────────────────────
// Builds two files from page.html.part:
//
//   claim.html          full document — the drop-in replacement for GET /c/a2z
//   claim-preview.html  body-only — same page, for publishing as an Artifact so
//                       it can be opened and judged on a real phone
//
// The app's real Computer Modern (KaTeX woff2 from client/node_modules/katex) is
// inlined as data URIs: this page is served standalone and the Artifact iframe
// admits no font host but Google Fonts, which has no Computer Modern.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs';

const KATEX = '../../client/node_modules/katex/dist/fonts';

const face = (f, family, weight) =>
  `@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${readFileSync(`${KATEX}/${f}.woff2`).toString('base64')}) format('woff2');font-weight:${weight};font-style:normal;font-display:swap}`;

const fonts = [
  face('KaTeX_Main-Regular', 'KaTeX_Main', 400),
  face('KaTeX_Main-Bold', 'KaTeX_Main', 700),
  face('KaTeX_AMS-Regular', 'KaTeX_AMS', 400),
].join('\n');

const src = readFileSync('page.html.part', 'utf8');
const full = src.replace('__FONTS__', fonts);
writeFileSync('claim.html', full);

const slice = (open, close) => {
  const a = full.indexOf(open), b = full.indexOf(close, a);
  if (a < 0 || b < 0) throw new Error('could not slice ' + open);
  return full.slice(a, b + close.length);
};
const preview = [
  '<title>A2Z Claim Page</title>',
  slice('<style>', '</style>'),
  slice('<main>', '</main>'),
  slice('<script>', '</script>'),
].join('\n');
writeFileSync('claim-preview.html', preview);

const kb = (s) => (s.length / 1024).toFixed(1) + ' KiB';
console.log('claim.html        ', kb(full));
console.log('claim-preview.html', kb(preview));
