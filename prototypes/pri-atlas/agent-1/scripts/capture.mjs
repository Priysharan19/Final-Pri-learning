import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4391';
const server = spawn('npm', ['run', 'dev'], { stdio: 'ignore', detached: false });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(baseURL);
      if (res.ok) return;
    } catch { /* Vite not ready */ }
    await sleep(300);
  }
  throw new Error('Prototype server did not start');
}
let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  await mkdir('screenshots', { recursive: true });
  const cases = [
    { name: 'command-desktop', width: 1440, height: 900, path: '/' },
    { name: 'command-tablet', width: 834, height: 1112, path: '/' },
    { name: 'command-mobile', width: 390, height: 844, path: '/' },
    { name: 'atlas-desktop', width: 1440, height: 900, path: '/atlas?subject=mathematics&concept=algebra' }
  ];
  for (const item of cases) {
    const page = await browser.newPage({ viewport: { width: item.width, height: item.height }, deviceScaleFactor: 1 });
    await page.goto(baseURL + item.path);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: 'screenshots/' + item.name + '.png', fullPage: true, animations: 'disabled' });
    console.log('Captured screenshots/' + item.name + '.png');
    await page.close();
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
