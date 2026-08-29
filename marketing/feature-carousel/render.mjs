// Shoots each slide to a 1080×1350 PNG with the Chromium already installed for
// the client's Playwright. Run `node build.mjs` first.
//
//   node render.mjs
//
import { readdirSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(HERE, '../../client/package.json'));
const { chromium } = require('playwright');

const OUT = resolve(HERE, 'out');
mkdirSync(OUT, { recursive: true });

const files = readdirSync(resolve(HERE, 'slides')).filter(f => f.endsWith('.html')).sort();
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1080, height: 1350 },
  deviceScaleFactor: 2,          // 2160×2700 master; Instagram serves 1080×1350
});

for (const f of files) {
  await page.goto(pathToFileURL(resolve(HERE, 'slides', f)).href);
  await page.evaluate(() => document.fonts.ready);
  const png = resolve(OUT, f.replace(/\.html$/, '.png'));
  await page.screenshot({ path: png });
  console.log(`→ out/${f.replace(/\.html$/, '.png')}`);
}

await browser.close();
console.log(`${files.length} slides rendered at 2160×2700 (2×)`);
