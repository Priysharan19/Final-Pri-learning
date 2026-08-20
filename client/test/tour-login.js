// ─────────────────────────────────────────────────────────────────────────────
// E2E: the v6 sign-in system — Apple/Google/email on-device flows, password
// protection, profile switching, account menu, daily-goal card.
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:4000';
mkdirSync('shots', { recursive: true });
const shot = (p, name) => p.screenshot({ path: `shots/login-${name}.png` });

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let failures = 0;
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failures++; };

await page.goto(BASE);
await page.waitForTimeout(1000);

// 1 · hero → sign-in methods
await page.getByRole('button', { name: 'Get Started' }).click();
await page.waitForTimeout(500);
check('method stage shows Apple/Google/email',
  await page.getByRole('button', { name: /Continue with Apple/ }).isVisible() &&
  await page.getByRole('button', { name: /Continue with Google/ }).isVisible() &&
  await page.getByRole('button', { name: /Continue with email/ }).isVisible());
check('on-device disclosure shown', (await page.locator('.auth-note').textContent()).includes('on-device'));
await shot(page, '01-methods');

// 2 · Apple flow with password protection
await page.getByRole('button', { name: /Continue with Apple/ }).click();
await page.waitForTimeout(400);
check('apple create headed', (await page.locator('h2').first().textContent()).includes('Apple'));
await page.getByPlaceholder('e.g. Priysharan').fill('Pri Tripathi');
await page.locator('input[type=email]').fill('pri@icloud.com');
await page.locator('.check-row input').check();
await page.waitForTimeout(200);
await page.getByPlaceholder('Password', { exact: true }).fill('mypin');
await page.getByPlaceholder('Repeat password').fill('mypin');
await shot(page, '02-apple-create');
await page.getByRole('button', { name: 'Start learning' }).click();
await page.waitForTimeout(1100);
check('landed on Home', await page.locator('.home-greet').isVisible());
check('goal ring on Home', await page.locator('.goal-ring').isVisible());
await shot(page, '03-home-goal');

// 3 · account menu
await page.locator('.user-chip').click();
await page.waitForTimeout(300);
check('account menu shows email', (await page.locator('.acct-menu').textContent()).includes('pri@icloud.com'));
await shot(page, '04-account-menu');
await page.getByRole('button', { name: /Switch profile/ }).click();
await page.waitForTimeout(700);

// 4 · picker shows the protected apple profile
check('picker lists profile', await page.locator('.acct-row', { hasText: 'Pri Tripathi' }).isVisible());
check('provider badge shown', await page.locator('.prov-badge.prov-apple').first().isVisible());
check('lock shown', await page.locator('.acct-lock').first().isVisible());
await shot(page, '05-picker');

// 5 · wrong password rejected, right one unlocks
await page.locator('.acct-row', { hasText: 'Pri Tripathi' }).click();
await page.waitForTimeout(300);
await page.locator('.acct-unlock input').fill('nope');
await page.getByRole('button', { name: 'Unlock' }).click();
await page.waitForTimeout(400);
check('wrong password rejected', await page.locator('.error-box').isVisible());
await shot(page, '06-wrong-pass');
await page.locator('.acct-unlock input').fill('mypin');
await page.getByRole('button', { name: 'Unlock' }).click();
await page.waitForTimeout(900);
check('unlocked to Home', await page.locator('.home-greet').isVisible());

// 6 · switch → add a Google profile (no password)
await page.locator('.user-chip').click();
await page.waitForTimeout(250);
await page.getByRole('button', { name: /Switch profile/ }).click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: /Add another profile/ }).click();
await page.waitForTimeout(350);
await page.getByRole('button', { name: /Continue with Google/ }).click();
await page.waitForTimeout(350);
await page.getByPlaceholder('e.g. Priysharan').fill('Guest Gauss');
await page.locator('input[type=email]').fill('gauss@gmail.com');
await page.getByRole('button', { name: 'Start learning' }).click();
await page.waitForTimeout(1000);
check('second profile active', (await page.locator('.user-chip').textContent()).includes('Guest'));

// 7 · duplicate email rejected
await page.locator('.user-chip').click();
await page.waitForTimeout(250);
await page.getByRole('button', { name: /Switch profile/ }).click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: /Add another profile/ }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: /Continue with email/ }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder('e.g. Priysharan').fill('Copycat');
await page.locator('input[type=email]').fill('pri@icloud.com');
await page.getByRole('button', { name: 'Start learning' }).click();
await page.waitForTimeout(500);
check('duplicate email rejected', (await page.locator('.error-box').textContent()).includes('already belongs'));
await shot(page, '07-dup-email');

// 8 · back to picker → both profiles listed, then Settings security section
await page.getByRole('button', { name: 'Back' }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: /Back to profiles/ }).click();
await page.waitForTimeout(400);
check('both profiles listed', await page.locator('.acct-row').count() >= 2);
await page.locator('.acct-row', { hasText: 'Guest Gauss' }).click();
await page.waitForTimeout(900);
await page.goto(`${BASE}/settings`);
await page.waitForTimeout(800);
check('security section present', await page.locator('h2', { hasText: 'Account & Security' }).isVisible());
const secCard = page.locator('.card', { has: page.locator('h2', { hasText: 'Account & Security' }) });
check('shows google sign-in method', (await secCard.textContent()).includes('Google (on-device)'));
await secCard.getByRole('button', { name: 'Set password' }).click();
await page.waitForTimeout(300);
await secCard.locator('input[type=password]').nth(0).fill('gauss1');
await secCard.locator('input[type=password]').nth(1).fill('gauss1');
await secCard.getByRole('button', { name: 'Turn protection on' }).click();
await page.waitForTimeout(600);
check('password turned on', (await secCard.textContent()).includes('On — asked at sign-in'));
await shot(page, '08-security');

await b.close();
console.log(failures === 0 ? '\n✔ LOGIN TOUR PASSED' : `\n✖ LOGIN TOUR FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
