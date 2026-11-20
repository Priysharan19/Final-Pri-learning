// Renders CASES to PNGs with handwriting-style system fonts in headless
// Chromium. SYNTHETIC: typeset in a handwriting-like font with jitter. It is
// not student ink and says nothing about real handwriting.
// usage: node gen-images.mjs <outDir> [scale=1]
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASES } from './cases.mjs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(join(ROOT, 'client/package.json'))('playwright');
const FONTS = ['Bradley Hand', 'Noteworthy', 'Marker Felt', 'Chalkboard SE'];
const rng = seed => () => (seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function markup(raw) {
  let s = esc(raw);
  s = s.replace(/\{([^{}]*)\/([^{}]*)\}/g, '<span class="fr"><span>$1</span><span class="bar">$2</span></span>');
  s = s.replace(/int\[(\d+),(\d+)\]/g, '<span class="int">∫<sup>$2</sup><sub>$1</sub></span>');
  s = s.replace(/sqrt\[([^\]]*)\]/g, '<span class="rad">√<span class="ov">$1</span></span>');
  s = s.replace(/\^\(([^)]*)\)/g, '<sup>$1</sup>').replace(/\^(-?[A-Za-z0-9.]+)/g, '<sup>$1</sup>');
  s = s.replace(/''/g, '<span class="pr pr2">′′</span>').replace(/'/g, '<span class="pr">′</span>');
  return s;
}
export async function render(outDir, scale = 1) {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 600 }, deviceScaleFactor: scale });
  const meta = [];
  for (const [i, c] of CASES.entries()) {
    const r = rng(1000 + i * 7919);
    const font = FONTS[i % FONTS.length];
    const size = 54 + Math.floor(r() * 18);
    const rows = c.lines.map(l => {
      const rot = (r() - 0.5) * 3, dy = (r() - 0.5) * 8, dx = r() * 30, ls = (r() - 0.5) * 1.5;
      return `<div class="ln" style="transform:translate(${dx}px,${dy}px) rotate(${rot}deg);letter-spacing:${ls}px">${markup(l)}</div>`;
    }).join('');
    await page.setContent(`<style>body{margin:0;background:#fff}#p{display:inline-block;padding:40px 50px;font:${size}px '${font}';color:#111;-webkit-text-stroke:.6px #111}
.ln{margin:18px 0;white-space:nowrap}.fr{display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle;font-size:.8em;margin:0 6px}.fr .bar{border-top:3px solid #111;padding-top:2px}
.rad .ov{border-top:3px solid #111}.int{font-size:1.3em}sup,sub{font-size:.6em}.pr{font-family:Helvetica;display:inline-block;margin-left:-.05em;margin-right:.15em;-webkit-text-stroke:0}.pr2{letter-spacing:-.12em}</style><div id="p">${rows}</div>`);
    const el = await page.$('#p');
    const file = `${c.id}.png`;
    await el.screenshot({ path: join(outDir, file) });
    meta.push({ id: c.id, file, font, size });
  }
  await browser.close();
  writeFileSync(join(outDir, 'meta.json'), JSON.stringify(meta, null, 1));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await render(resolve(process.argv[2] || 'out'), Number(process.argv[3] || 1));
