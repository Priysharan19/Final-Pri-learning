// ─────────────────────────────────────────────────────────────────────────────
// A2Z x Pri Learning · free-chocolate QR campaign — artboard builder
//
// Emits the .dc.html artboards for the design canvas, plus preview.html for
// eyeballing fit in a plain browser. Every colour is lifted verbatim from
// client/src/theme.css ("Design system v4 — Dark LaTeX"): dark artboards use
// :root, the printed artboard uses [data-theme="light"] ("the same paper,
// printed"). Type is the real Computer Modern the app ships — the KaTeX faces
// from client/node_modules/katex, embedded as woff2 data URIs because the
// canvas iframe admits no font host but Google Fonts.
//
// Re-run this, then re-seed the canvas. Do not hand-edit the .dc.html files.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs';

// The app's own Computer Modern, read straight from the katex package so nothing
// binary is duplicated into this directory.
const KATEX = '../../client/node_modules/katex/dist/fonts';

const QR_PATH = readFileSync('qr-path.txt', 'utf8').trim();
const QR_N = 41;                       // modules per side (ECC level Q, version 6)
const CLAIM_URL = 'https://adequate-motivation-production-9a2f.up.railway.app/c/a2z';

const face = (file, family, weight) =>
  `@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${
    readFileSync(`${KATEX}/${file}.woff2`).toString('base64')
  }) format('woff2');font-weight:${weight};font-style:normal;font-display:block}`;

const FONTS =
  face('KaTeX_Main-Regular', 'KaTeX_Main', 400) +
  face('KaTeX_Main-Bold', 'KaTeX_Main', 700) +
  face('KaTeX_AMS-Regular', 'KaTeX_AMS', 400);

// theme.css --font
const SERIF = "'KaTeX_Main','Latin Modern Roman','Computer Modern',Georgia,'Times New Roman',serif";

// theme.css :root  (dark) and [data-theme="light"] (printed)
const DARK = {
  page: '#0a0a09', surface: '#101010',
  hairline: 'rgba(240,236,224,0.13)', hairlineFaint: 'rgba(240,236,224,0.07)',
  ink: '#efece1', ink2: '#b3afa2', ink3: '#7c796d',
  cream: '#f4f1e0', creamInk: '#131310',
  gold: '#c9ad63', goldBright: '#e3c87e',
  good: '#5aa86c',
  qrPaper: '#f4f1e0', qrInk: '#131310', qrBorder: 'none',
};
const LIGHT = {
  page: '#f7f4ea', surface: '#fdfbf3',
  hairline: 'rgba(26,24,16,0.16)', hairlineFaint: 'rgba(26,24,16,0.08)',
  ink: '#171610', ink2: '#565348', ink3: '#8a8678',
  cream: '#171610', creamInk: '#f7f4ea',
  gold: '#8e6f27', goldBright: '#6e5417',
  good: '#3f7d4d',
  qrPaper: '#fdfbf3', qrInk: '#171610', qrBorder: '1px solid rgba(26,24,16,0.16)',
};

// ── shared pieces ────────────────────────────────────────────────────────────

// theme.css .logo / .logo-bb (KaTeX_AMS) / .logo-name
const wordmark = (t, bb, name) => `<div style="display: flex; align-items: baseline; gap: 1px; color: ${t.ink}">
        <span style="font-family: 'KaTeX_AMS', ${SERIF}; font-size: ${bb}px; line-height: 1; font-weight: 400">P</span>
        <span style="font-size: ${name}px; letter-spacing: 0.01em; font-weight: 500">ri Learning.</span>
      </div>`;

// theme.css .card-title / .sc-label — the signature small-caps label
const scLabel = (t, text, colour, size = 11.5) =>
  `<div style="font-size: ${size}px; font-weight: 500; color: ${colour}; text-transform: uppercase; letter-spacing: 0.18em">${text}</div>`;

const qr = (t, px, pad) => `<div style="background: ${t.qrPaper}; border: ${t.qrBorder}; border-radius: 6px; padding: ${pad}px; flex: 0 0 auto; line-height: 0">
          <svg width="${px}" height="${px}" viewBox="0 0 ${QR_N} ${QR_N}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" role="img" aria-label="QR code — opens the Pri Learning claim page">
            <path d="${QR_PATH}" fill="${t.qrInk}"></path>
          </svg>
        </div>`;

const tick = (t, px) => `<svg width="${px}" height="${px}" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: -0.1em"><path d="M4 10.6 8 14.4 16 5.6" stroke="${t.good}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;

const igMark = (t, px) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex: 0 0 auto" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="5" stroke="${t.ink2}" stroke-width="1.6"></rect>
            <circle cx="12" cy="12" r="4.1" stroke="${t.ink2}" stroke-width="1.6"></circle>
            <circle cx="17.2" cy="6.8" r="1.15" fill="${t.ink2}"></circle>
          </svg>`;

const STEPS = [
  'Scan the code',
  'Send the verification message',
  'Follow @pri.learning',
  'Show the green tick',
];

// Full-width 4-across row: a ruled column per step, the way the app rules its
// tables. Keeps the QR from crowding the text column.
const stepRow = (t, { size, numSize, gap, pad }) => `<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: ${gap}px">
        ${STEPS.map((str, i) => `<div style="border-top: 1px solid ${t.hairline}; padding-top: ${pad}px; display: flex; flex-direction: column; gap: ${Math.round(pad * 0.55)}px">
            <span style="font-size: ${numSize}px; color: ${t.gold}; line-height: 1">${i + 1}</span>
            <span style="font-size: ${size}px; line-height: 1.34; color: ${t.ink}; display: block; text-wrap: pretty">${str}${i === 3 ? ' ' + tick(t, Math.round(size * 1.0)) : ''}</span>
          </div>`).join('\n        ')}
  </div>`;

const FINE = 'One chocolate per Instagram account, while stocks last. The counter tick is live for 60 seconds. Full terms at the scanned link.';

// The follow target sits beside the QR: the scan is the action, the handle is
// what the scan is actually buying.
const followBlock = (t, { label, handle, note, mark }) => `<div style="flex: 1; align-self: stretch; display: flex; flex-direction: column; justify-content: center; gap: 14px">
          ${scLabel(t, 'Follow', t.gold, label)}
          <div style="display: flex; align-items: center; gap: 12px">
            ${igMark(t, mark)}
            <span style="font-size: ${handle}px; color: ${t.ink}; letter-spacing: 0.005em">@pri.learning</span>
          </div>
          <p style="margin: 0; font-size: ${note}px; line-height: 1.5; color: ${t.ink2}; text-wrap: pretty">The green tick only appears while this account is following.</p>
        </div>`;

// ── A4 counter poster · 794 x 1123 (96 px/in) ────────────────────────────────
function posterA4(t) {
  return `<div style="width: 794px; height: 1123px; background: ${t.page}; color: ${t.ink}; font-family: ${SERIF}; padding: 68px; display: flex; flex-direction: column; overflow: hidden">

  <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 24px">
      ${wordmark(t, 30, 25)}
      ${scLabel(t, 'A2Z × Pri Learning', t.ink3)}
  </div>
  <div style="height: 1px; background: ${t.hairline}; margin-top: 20px"></div>

  <div style="margin-top: 40px">
    <div style="font-size: 12.5px; letter-spacing: 0.32em; text-transform: uppercase; color: ${t.gold}; margin-bottom: 24px">No purchase necessary</div>
    <div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 28px">
      <div style="font-size: 108px; font-weight: 700; letter-spacing: -1.5px; line-height: 1; color: ${t.ink}">Free</div>
      <div style="font-size: 27px; line-height: 1.3; color: ${t.goldBright}; text-align: right; padding-bottom: 14px">for one scan<br>and one follow.</div>
    </div>
    <div style="font-size: 108px; font-weight: 700; letter-spacing: -1.5px; line-height: 1; color: ${t.ink}">chocolate.</div>
  </div>

  <p style="margin: 26px 0 0; font-size: 18px; line-height: 1.6; color: ${t.ink2}; max-width: 560px; text-wrap: pretty">Pri Learning marks handwritten maths line by line, on your own iPad. Follow us on Instagram and the chocolate is yours.</p>

  <div data-spacer style="flex: 1; min-height: 24px"></div>

  ${stepRow(t, { size: 16.5, numSize: 15, gap: 18, pad: 13 })}

  <div style="margin-top: 34px; display: flex; gap: 36px; align-items: stretch">
        ${qr(t, 270, 28)}
        ${followBlock(t, { label: 11.5, handle: 27, note: 15, mark: 21 })}
  </div>

  <div style="margin-top: 28px; border-top: 1px solid ${t.hairline}; padding-top: 16px; display: flex; justify-content: space-between; align-items: flex-start; gap: 28px">
      <p style="margin: 0; font-size: 13px; line-height: 1.5; color: ${t.ink2}; max-width: 420px; text-wrap: pretty">${FINE}</p>
      <div style="flex: 0 0 auto; padding-top: 2px">${scLabel(t, 'Class 7–12 · JEE · Olympiad', t.ink3)}</div>
  </div>

</div>`;
}

// ── square social crop · 1080 x 1080 ────────────────────────────────────────
// No deck paragraph here: on a feed the caption and the profile carry that, and
// the post is stronger for staying at four elements.
function square(t) {
  return `<div style="width: 1080px; height: 1080px; background: ${t.page}; color: ${t.ink}; font-family: ${SERIF}; padding: 78px; display: flex; flex-direction: column; overflow: hidden">

  <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 24px">
      ${wordmark(t, 34, 28)}
      ${scLabel(t, 'A2Z × Pri Learning', t.ink3, 13)}
  </div>
  <div style="height: 1px; background: ${t.hairline}; margin-top: 22px"></div>

  <div style="margin-top: 44px">
    <div style="font-size: 14px; letter-spacing: 0.32em; text-transform: uppercase; color: ${t.gold}; margin-bottom: 26px">No purchase necessary</div>
    <div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 32px">
      <div style="font-size: 132px; font-weight: 700; letter-spacing: -2px; line-height: 1; color: ${t.ink}">Free</div>
      <div style="font-size: 32px; line-height: 1.3; color: ${t.goldBright}; text-align: right; padding-bottom: 18px">for one scan<br>and one follow.</div>
    </div>
    <div style="font-size: 132px; font-weight: 700; letter-spacing: -2px; line-height: 1; color: ${t.ink}">chocolate.</div>
  </div>

  <div data-spacer style="flex: 1; min-height: 28px"></div>

  ${stepRow(t, { size: 19, numSize: 17, gap: 26, pad: 14 })}

  <div style="margin-top: 36px; display: flex; gap: 44px; align-items: stretch">
        ${qr(t, 220, 24)}
        ${followBlock(t, { label: 13, handle: 34, note: 18, mark: 26 })}
  </div>

  <div style="margin-top: 24px; border-top: 1px solid ${t.hairline}; padding-top: 16px; display: flex; justify-content: space-between; align-items: flex-start; gap: 32px">
      <p style="margin: 0; font-size: 15px; line-height: 1.5; color: ${t.ink2}; max-width: 560px; text-wrap: pretty">${FINE}</p>
      <div style="flex: 0 0 auto; padding-top: 2px">${scLabel(t, 'Class 7–12 · JEE · Olympiad', t.ink3, 13)}</div>
  </div>

</div>`;
}

// ── .dc.html shell ───────────────────────────────────────────────────────────
function dc(body, w, h, t) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
    ${FONTS}
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; background: ${t.page}; font-family: ${SERIF}; }
    a { color: ${t.gold}; text-decoration: none; }
    a:hover { color: ${t.goldBright}; }
  </style>
</helmet>
${body}
</x-dc>
<script data-dc-script data-props='{"$preview":{"width":${w},"height":${h}}}'>
class Component extends DCLogic {}
</script>
</body>
</html>`;
}

writeFileSync('Main.dc.html', dc(posterA4(DARK), 794, 1123, DARK));
writeFileSync('Printed.dc.html', dc(posterA4(LIGHT), 794, 1123, LIGHT));
writeFileSync('Square.dc.html', dc(square(DARK), 1080, 1080, DARK));

// plain-browser preview for checking fit (not part of the canvas)
writeFileSync('preview.html', `<!doctype html><meta charset="utf-8"><title>A2Z poster preview</title>
<style>${FONTS}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:#3a3a38;padding:40px;display:flex;gap:40px;align-items:flex-start;font-family:${SERIF}}
.frame{outline:1px solid #888}</style>
<div class="frame">${posterA4(DARK)}</div>
<div class="frame">${posterA4(LIGHT)}</div>
<div class="frame">${square(DARK)}</div>`);

console.log('built Main.dc.html Printed.dc.html Square.dc.html preview.html');
console.log('claim url encoded in QR:', CLAIM_URL);
