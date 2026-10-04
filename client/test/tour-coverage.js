// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — the public Coverage page says what the manifest
// says, before and after sign-in (§5.1, §5.6).
//
// Opens /coverage with no profile, checks it renders every chapter of the
// committed manifest for the class in view, that the class picker switches the
// table, that the ledger date and digest on screen are the manifest's, and
// that no sentence on the page claims teacher or human review. Then signs a
// student in and checks the page is still reachable and linked from Settings.
//
// Run on its own:  node client/test/tour-coverage.js
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const manifest = JSON.parse(readFileSync(new URL('../../docs/content/coverage-manifest.json', import.meta.url), 'utf8'));

export const flow = {
  id: 'coverage',
  name: 'Coverage · public manifest page, signed out and in',

  async run({ page, check, goto, createProfile, settle }) {
    // ── 1 · Signed out ──────────────────────────────────────────────────────
    await goto('/coverage');
    await page.waitForSelector('[data-coverage-page]', { timeout: 30000 });
    await settle();
    await check('the page renders before the profile gate', await page.locator('[data-coverage-page] h1').count() === 1);

    const first = manifest.classes[0];
    const rows = await page.locator('[data-coverage-chapter]').count();
    await check(`Class ${first.grade} lists every chapter of the manifest (${first.chapters.length})`, rows === first.chapters.length, `got ${rows}`);
    for (const ch of first.chapters.slice(0, 3)) {
      await check(`${ch.id} row is present`, await page.locator(`[data-coverage-chapter="${ch.id}"]`).count() === 1);
    }

    const verified = await page.locator('[data-coverage-verified]').innerText();
    await check('the ledger date on screen is the manifest date', verified.includes(manifest.verifiedAt), verified);
    const digest = await page.locator('[data-coverage-release-digest]').innerText();
    await check('the release digest on screen is the manifest digest', digest.trim() === manifest.releaseDigest, digest);

    const text = await page.locator('[data-coverage-page]').innerText();
    await check('no sentence claims teacher or human review', !/teacher[- ]reviewed|human[- ]reviewed|reviewed by (a )?teacher/i.test(text));
    await check('the page says the review is automated', /automated review/i.test(text));
    await check('the sample is called a sample', /sample/i.test(text));

    // Class picker switches the table.
    const ten = manifest.classes.find(c => c.grade === 10);
    await page.locator('[data-coverage-class="10"]').click();
    await settle();
    const rows10 = await page.locator('[data-coverage-chapter]').count();
    await check(`Class 10 lists every chapter of the manifest (${ten.chapters.length})`, rows10 === ten.chapters.length, `got ${rows10}`);
    await check('a Class 10 chapter shows its board marks', /board marks/i.test(await page.locator('[data-coverage-chapter="c10-triangles"]').innerText()));
    await check('the class tab is marked pressed for assistive tech', await page.locator('[data-coverage-class="10"][aria-pressed="true"]').count() === 1);

    // Linked from the public landing.
    await goto('/');
    await check('the public landing links to Coverage', await page.locator('a[href="/coverage"]').count() >= 1);

    // ── 2 · Signed in ───────────────────────────────────────────────────────
    await createProfile({ name: 'Coverage Reader', year: 9, course: 'in' });
    await goto('/settings');
    await page.waitForSelector('[data-settings-coverage-link]', { timeout: 30000 });
    await check('Settings → Help links to Coverage', await page.locator('[data-settings-coverage-link]').count() === 1);
    await page.locator('[data-settings-coverage-link]').click();
    await page.waitForSelector('[data-coverage-page]', { timeout: 30000 });
    await settle();
    await check('the page renders inside the shell for a signed-in student', await page.locator('.shell [data-coverage-page], [data-coverage-page]').count() >= 1);
    await check('the signed-in page shows the same release digest', (await page.locator('[data-coverage-release-digest]').innerText()).trim() === manifest.releaseDigest);
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
