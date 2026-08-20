// Quick smoke test of the handwriting calibration flow.
import { chromium } from '@playwright/test';

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1.5 });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERROR:', e.message));
await p.goto('http://localhost:4000');
await p.waitForTimeout(900);
await p.getByRole('button', { name: 'Get Started' }).click();
await p.waitForTimeout(400);
await p.getByRole('button', { name: /Continue with email/ }).click();
await p.waitForTimeout(350);
await p.getByPlaceholder('e.g. Priysharan').fill('Cal Tester');
await p.getByRole('button', { name: 'Start learning' }).click();
await p.waitForTimeout(900);
await p.goto('http://localhost:4000/settings');
await p.waitForTimeout(800);
await p.getByRole('button', { name: /Teach it your handwriting/ }).click();
await p.waitForTimeout(600);

const c = await p.$('.ink-canvas');
const box = await c.boundingBox();
const cx = box.x + 160, cy = box.y + 95, r = 55;
await p.mouse.move(cx + r, cy);
await p.mouse.down();
for (let a = 0; a <= 360; a += 18) {
  await p.mouse.move(cx + r * Math.cos(a * Math.PI / 180), cy + 0.8 * r * Math.sin(a * Math.PI / 180));
}
await p.mouse.up();
await p.waitForTimeout(400);
await p.screenshot({ path: 'shots/calibrate.png' });
await p.getByRole('button', { name: /Save & next/ }).click();
await p.waitForTimeout(500);
const counter = await p.$eval('.card-head .muted', el => el.textContent);
console.log('advanced to:', counter);
await p.screenshot({ path: 'shots/calibrate-2.png' });
await b.close();
console.log('CAL UI OK');
