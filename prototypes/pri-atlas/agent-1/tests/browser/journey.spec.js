import { expect, test } from '@playwright/test';

test('Command to Atlas preserves algebra context', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /See the whole/ })).toBeVisible();
  await expect(page.getByText('ALL LEARNER DATA IS SYNTHETIC')).toBeVisible();
  await page.getByRole('button', { name: 'Explore algebra', exact: true }).click();
  await expect(page).toHaveURL(/\/atlas\?subject=mathematics&concept=algebra/);
  await expect(page.getByRole('heading', { name: /Knowledge is/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Algebra' })).toHaveAttribute('aria-pressed', 'true');
});

test('command palette is keyboard accessible and route-aware', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  const input = page.getByRole('textbox', { name: 'Search concepts and destinations' });
  await expect(input).toBeFocused();
  await input.fill('quadratic');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/atlas\?subject=mathematics&concept=quadratics/);
  await expect(page.getByRole('heading', { name: 'Quadratic equations' })).toBeVisible();
});

test('subject switching clears old concepts and retains subject across destinations', async ({ page }) => {
  await page.goto('/atlas?subject=mathematics&concept=quadratics');
  await page.locator('.subject-toggle').click();
  await page.getByRole('button', { name: 'Physics', exact: true }).click();
  await expect(page).toHaveURL(/\/atlas\?subject=physics$/);
  await page.locator('.side-nav').getByRole('button', { name: /Laboratory/ }).click();
  await expect(page).toHaveURL(/\/laboratory\?subject=physics/);
});

test('paper keeps local draft only and clear button works', async ({ page }) => {
  await page.goto('/paper?subject=mathematics&concept=quadratics');
  const draft = page.getByLabel(/Your working/);
  await draft.fill('x=2 or x=3');
  await expect(draft).toHaveValue('x=2 or x=3');
  await page.getByRole('button', { name: 'Clear draft' }).click();
  await expect(draft).toHaveValue('');
  await expect(page.getByText('No answer checking is implemented in this prototype.')).toBeVisible();
});

for (const [name, width, height] of [['phone', 390, 844], ['tablet', 834, 1112], ['desktop', 1440, 900]]) {
  test(name + ' layout has visible controls without document horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Explore algebra', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
    if (name === 'phone') {
      await expect(page.getByRole('navigation', { name: 'Mobile destinations' }).last()).toBeVisible();
      await page.getByRole('navigation', { name: 'Mobile destinations' }).last().getByRole('button', { name: /Atlas/ }).click();
      await expect(page).toHaveURL(/\/atlas/);
    }
  });
}

test('reduced motion still supports routing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore algebra', exact: true }).click();
  await expect(page).toHaveURL(/\/atlas\?/);
});
