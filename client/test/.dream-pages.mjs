import { chromium } from '@playwright/test';
const OUT = process.env.OUT, BASE = process.env.BASE || 'http://localhost:5173';
const vp = process.argv[2] === 'phone' ? { width: 390, height: 844 } : { width: 1180, height: 820 };
const tag = process.argv[2] || 'ipadL';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: vp });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text().slice(0, 200)); });
await page.goto(BASE + '/');
await page.getByRole('button', { name: 'Get Started' }).click();
await page.waitForSelector('[data-onboarding-step="1"]');
await page.screenshot({ path: `${OUT}/${tag}-p00-onboarding.png` });
await page.getByRole('button', { name: 'Student', exact: true }).click();
await page.locator('.auth-card .btn-primary').click();
await page.waitForSelector('[data-onboarding-step="2"]');
await page.locator('#signup-track').selectOption(process.env.TRACK || '10');
await page.locator('.auth-card .btn-primary').click();
await page.waitForSelector('[data-onboarding-step="3"]');
await page.locator('#signup-name').fill('Asha Verma');
await page.locator('.auth-card .btn-primary').click();
await page.waitForSelector('[data-onboarding-step="4"]');
await page.locator('.auth-card .btn-primary').click();
await page.waitForSelector('[data-onboarding-step="5"]');
await page.screenshot({ path: `${OUT}/${tag}-p01-onboarding5.png` });
await page.getByRole('button', { name: 'Start learning' }).click();
await page.waitForSelector('.home-greet');
// answer 3 questions quickly via reveal to create history
await page.goto(BASE + '/practice');
for (let i = 0; i < 3; i++) {
  await page.waitForSelector('.q-prompt');
  await page.getByRole('button', { name: 'Show solution' }).click();
  await page.waitForSelector('.eval-card');
  await page.locator('.ws-actions .btn-primary').click();
  await page.waitForTimeout(600);
}
for (const [route, name] of [['/progress', 'progress'], ['/review', 'review'], ['/exams', 'exams'], ['/tasks', 'tasks'], ['/settings', 'settings'], ['/', 'home-returning']]) {
  await page.goto(BASE + route);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/${tag}-p-${name}.png`, fullPage: true });
}
await page.goto(BASE + '/exams');
await page.waitForTimeout(1200);
const start = page.locator('button.btn-primary', { hasText: 'Start practice paper' });
if (await start.count()) {
  await start.first().click();
  await page.waitForSelector('.exam-nav', { timeout: 60000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${tag}-p-exam.png` });
  await page.locator('.exam-head').getByRole('button', { name: 'Review and submit' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${tag}-p-exam-confirm.png` });
  await page.locator('[role="dialog"]').getByRole('button', { name: 'Submit paper' }).click();
  await page.waitForSelector('.hero-num', { timeout: 60000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${tag}-p-exam-result.png` });
}
console.log(errors.join('\n') || 'no errors');
await browser.close();
