// Pri Learning · E2E flow — the v1.1 instrument interface (PRI_FEATURE_INSTRUMENT).
//
// Builds the client WITH the flag (the other suites build without it, so they
// keep testing the interface production ships) and walks the new shell as a
// signed-in Class 10 student, in paper and night, at phone, tablet and web:
//   · the flag is really on: html.ui-instrument, the tab bar, no rail;
//   · the Index lists the syllabus from the server, a chapter opens its plate,
//     the plate's figures are the server's (answers / correct), accuracy is
//     withheld below the floor, and the scope actually draws;
//   · Practise this chapter opens Practice for that chapter;
//   · ⌘K opens the command bar, typing filters, ↵ opens, esc closes and focus
//     returns to where it was;
//   · the theme follows the device for a profile with no saved choice;
//   · every control has an accessible name; phone controls are ≥ 44×44;
//   · nothing moves after paint (Chromium layout-shift entries).
// Screens are written to PRI_VISUAL_OUT (or a temp dir) for review.
//
// Usage: node client/test/tour-instrument.js [--browser=webkit]
// Leaves an instrument build in client/dist: CI runs it last in its group.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { handwrite, pressRead, turnOnServerReading } from './fakeServerReader.js';
import { SYNTHETIC_EVIDENCE } from './support/online-session.mjs';

const SIZES = [
  { id: 'phone', width: 390, height: 844, phone: true },
  { id: 'tablet', width: 820, height: 1180, phone: false },
  { id: 'web', width: 1440, height: 900, phone: false }
];

const AUDIT = () => {
  const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const nameOf = el => (el.getAttribute('aria-label') || (el.labels && [...el.labels].map(l => l.textContent).join(' ')) || el.getAttribute('title') || el.textContent || '').trim();
  const controls = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button]')]
    .filter(el => visible(el) && !el.closest('[aria-hidden="true"], [inert]'));
  const unnamed = controls.filter(el => !nameOf(el)).map(el => `${el.tagName}.${String(el.className).slice(0, 40)}`);
  const small = controls.filter(el => {
    const r = el.getBoundingClientRect();
    if (r.width >= 43.5 && r.height >= 43.5) return false;
    const cx = r.left + r.width / 2; const cy = r.top + r.height / 2;
    const owns = (x, y) => { const h = document.elementFromPoint(x, y); return !!h && (h === el || el.contains(h)); };
    return ![[cx - 21, cy], [cx + 21, cy], [cx, cy - 21], [cx, cy + 21]].every(([x, y]) => owns(x, y));
  }).map(el => `${nameOf(el).slice(0, 24) || el.tagName} ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`);
  return { count: controls.length, unnamed, small };
};

export const flow = {
  id: 'instrument',
  name: 'Instrument · v1.1 shell, Index, scope, command bar, theme, names, 44px, shift',
  online: true,

  async run({ page, check, goto, settle, createProfile, note, online, browserName = 'chromium' }) {
    const chromium = browserName === 'chromium';
    const outDir = join(process.env.PRI_VISUAL_OUT || mkdtempSync(join(tmpdir(), 'pri-instrument-')), `instrument-${browserName}`);
    mkdirSync(outDir, { recursive: true });
    note(`engine: ${browserName} · screens in ${outDir}`);

    // A new profile has no saved theme: the instrument follows the device.
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await goto('/');
    await settle();
    await createProfile({ name: 'Aarav Instrument', year: 10, course: 'in' });
    await online.signIn({ name: 'Aarav Instrument' });
    await settle();
    await goto('/');
    await settle();

    await check('the flagged build is on: html.ui-instrument', await page.evaluate(() => document.documentElement.classList.contains('ui-instrument')));
    await check('the instrument bar replaces the rail', await page.locator('[data-instrument-bar]').count() === 1 && await page.locator('.sidebar').count() === 0);
    await check('a profile with no saved theme follows the device (dark here)', await page.evaluate(() => document.documentElement.dataset.theme) === 'dark');
    await check('interface type is Instrument Sans', /Instrument Sans/.test(await page.evaluate(() => getComputedStyle(document.body).fontFamily)));

    // The Index.
    await page.waitForSelector('[data-instrument-index] .in-ch', { timeout: 15000 });
    const chapters = await page.locator('.in-ch').count();
    await check('the Index lists the syllabus chapters from the server', chapters >= 5, `${chapters} chapters`);
    const second = page.locator('.in-ch').nth(1);
    const id = await second.getAttribute('data-chapter');
    const name = (await second.locator('.in-ch-t').evaluate(el => el.firstChild?.textContent || '')).trim();
    await second.click();
    await check('choosing a chapter opens its plate', await page.locator(`[data-instrument-plate="${id}"]`).count() === 1);
    await check('the plate is titled with that chapter', (await page.locator('#in-plate-title').textContent()).trim() === name, name);
    await check('the chosen chapter is announced as pressed', await second.getAttribute('aria-pressed') === 'true');
    const kpis = await page.locator('.in-kpis b').allTextContents();
    await check('a new student’s plate states 0 answers and withholds accuracy', kpis[0] === '0' && kpis[2] === '—', JSON.stringify(kpis));
    const drawn = await page.evaluate(() => {
      const c = document.querySelector('[data-instrument-scope] canvas'); if (!c || !c.width) return 0;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let ink = 0;
      for (let i = 3; i < d.length; i += 16) if (d[i] > 0) ink++;
      return ink;
    });
    await check('the scope draws the chapter’s mathematics', drawn > 200, `${drawn} painted samples`);
    await check('the scope is labelled for assistive tech', !!(await page.locator('[data-instrument-scope]').getAttribute('aria-label')));
    writeFileSync(join(outDir, 'index-web-dark.png'), await page.screenshot({ animations: 'disabled' }));

    // Practise this chapter → Practice for that chapter.
    await page.locator('[data-instrument-practise]').click();
    await page.waitForURL(u => u.pathname === '/practice', { timeout: 10000 });
    await check('Practise this chapter opens Practice for that chapter', new URL(page.url()).searchParams.get('subtopic') === id, page.url());
    await goto('/');
    await settle();

    // The command bar.
    const opener = page.locator('.in-cmd');
    await opener.focus();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
    await check('⌘K opens the command bar as a modal dialog', await page.locator('[data-instrument-command] [role=dialog][aria-modal=true]').count() === 1);
    await check('the query field has focus', await page.evaluate(() => document.activeElement?.getAttribute('role') === 'combobox'));
    await page.keyboard.type(name.slice(0, 5));
    await page.waitForTimeout(150);
    const first = (await page.locator('.in-pal-item[aria-selected=true] b').first().textContent() || '').trim();
    await check('typing filters to the matching chapter', first.toLowerCase().includes(name.slice(0, 5).toLowerCase()), first);
    await page.keyboard.press('Escape');
    await check('esc closes the command bar', await page.locator('[data-instrument-command]').count() === 0);
    await check('focus returns to what opened it', await page.evaluate(() => document.activeElement?.classList.contains('in-cmd')));
    await opener.click();
    await page.keyboard.type(name.slice(0, 5));
    await page.waitForTimeout(150);
    await page.keyboard.press('Enter');
    await page.waitForURL(u => u.pathname === '/practice', { timeout: 10000 });
    await check('↵ on a chapter opens Practice for it', new URL(page.url()).searchParams.get('subtopic') === id, page.url());

    // Every size, both themes: names, 44px on phone, no shift after paint.
    if (chromium) {
      await page.addInitScript(() => {
        window.__priShift = 0;
        try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__priShift += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch { /* engine without it */ }
      });
    }
    const cdp = chromium ? await page.context().newCDPSession(page) : null;
    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      if (cdp) await cdp.send('Emulation.setTouchEmulationEnabled', size.phone ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
      for (const scheme of ['light', 'dark']) {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await goto('/');
        await settle();
        await page.waitForSelector('.in-ch', { timeout: 15000 });
        const tag = `index@${size.id}/${scheme}`;
        await check(`${tag}: the theme follows the device`, await page.evaluate(() => document.documentElement.dataset.theme) === scheme);
        if (chromium) {
          await page.evaluate(() => { window.__priShift = 0; });
          await page.waitForTimeout(500);
          const shift = await page.evaluate(() => window.__priShift || 0);
          await check(`${tag}: no layout shift after paint`, shift < 0.001, `CLS ${shift.toFixed(4)}`);
        }
        const a = await page.evaluate(AUDIT);
        await check(`${tag}: every control has an accessible name`, a.unnamed.length === 0, JSON.stringify(a.unnamed.slice(0, 6)));
        if (size.phone && chromium) await check(`${tag}: every control is ≥ 44×44`, a.small.length === 0, JSON.stringify(a.small.slice(0, 8)));
        writeFileSync(join(outDir, `index-${size.id}-${scheme}.png`), await page.screenshot({ animations: 'disabled' }));
      }
    }
    if (cdp) await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  }
};


// Write & Check in the instrument material: the same practice surface (its
// hooks, roles and marks are the existing ones), with the reading as chips,
// the verdict as a panel and the scan on Check. The reader's provider hop is
// the scripted stand-in; the canvas, routes and every mark are real.
export const writeFlow = {
  id: 'instrument-write',
  name: 'Instrument · Write & Check — reading chips, verdict panel, scan, marks unchanged',
  online: true,

  async run({ page, base, check, goto, settle, createProfile, note, online, browserName = 'chromium' }) {
    const outDir = join(process.env.PRI_VISUAL_OUT || mkdtempSync(join(tmpdir(), 'pri-instrument-')), `instrument-${browserName}`);
    mkdirSync(outDir, { recursive: true });
    note(`${SYNTHETIC_EVIDENCE}: the handwriting reader in "${writeFlow.name}" is the scripted stand-in. Not real-handwriting or real-device evidence.`);
    Object.assign(online.reader, { text: '1', lines: null, confidence: 0.97, down: false, gate: null });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
    await goto('/');
    await createProfile({ name: 'Instrument Writer', year: 7 });
    await online.signIn({ name: 'Instrument Writer' });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await check('server reading is on for this profile', await turnOnServerReading(page, base));

    await page.goto(`${base}/practice?subtopic=y7-integers`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await settle();
    let right = null;
    for (let i = 0; i < 8; i++) {
      right = await online.answerOf().catch(() => null);
      if (right && right.answerType === 'numeric' && /^-?\d+$/.test(String(right.text))) break;
      const leaving = await page.locator('.qpage').getAttribute('data-question-id');
      await page.locator('.ctx-next').click();
      await page.waitForFunction(id => { const e = document.querySelector('.qpage[data-question-id]'); return e && e.getAttribute('data-question-id') !== id; }, leaving, { timeout: 30000 });
      await settle();
    }
    if (!await check('a numeric question is on the card', !!right && right.answerType === 'numeric')) return;
    const tab = page.getByRole('button', { name: 'Answer by handwriting' });
    if (await tab.count()) await tab.click();
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });

    const shell = page.locator('.editor-shell').first();
    const look = sel => page.evaluate(q => { const el = document.querySelector(q); if (!el) return null; const s = getComputedStyle(el); return { bg: s.backgroundColor, radius: s.borderRadius, font: s.fontFamily }; }, sel);
    const stage = await look('.ink-stage');
    const voidBg = await page.evaluate(() => { const p = document.createElement('div'); p.style.background = 'var(--in-void)'; document.body.append(p); const v = getComputedStyle(p).backgroundColor; p.remove(); return v; });
    await check('the writing surface is the instrument void', !!stage && stage.bg === voidBg, JSON.stringify({ stage: stage?.bg, voidBg }));
    await check('the mode switch is the instrument segmented control', (await look('.mode-tabs.seg'))?.radius === '6px');

    const wrong = String(Number(right.text) + 1);
    online.forgetKeptReads?.();
    online.reader.lines = [{ text: '3 + 4 = 7' }, { text: wrong }];
    const box = await page.locator('.ink-canvas-live').boundingBox();
    await handwrite(page, box, '3' + wrong.replace('-', ''), { x: 40 });
    await pressRead(page);
    await page.waitForFunction(n => document.querySelectorAll('.ink-line').length >= n, 2, { timeout: 20000 }).catch(() => {});
    const chips = await page.locator('.ink-line .ink-line-math').count();
    await check('Pri’s reading shows each line as a chip', chips >= 2, `${chips} lines`);
    const chip = await look('.ink-line .ink-line-math');
    await check('a reading chip is drawn on the raised surface', !!chip && chip.radius === '4px', JSON.stringify(chip));
    writeFileSync(join(outDir, 'write-read-web-dark.png'), await page.screenshot({ animations: 'disabled' }));

    await page.getByRole('button', { name: /^Submit/ }).last().click();
    await page.waitForSelector('.eval-card, .verdict[data-verdict-of]', { timeout: 30000 }).catch(() => {});
    await check('Check marks the shell for the scan', await shell.getAttribute('data-marked') === 'yes');
    const scan = await page.evaluate(() => {
      const el = document.querySelector('.editor-shell[data-marked="yes"] .ink-stage');
      if (!el) return null;
      const s = getComputedStyle(el, '::after');
      return { name: s.animationName, border: s.borderBottomColor, pointer: s.pointerEvents };
    });
    const signal = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--in-signal').trim());
    await check('the scan runs once, in the signal colour', scan?.name === 'in-scan', JSON.stringify({ scan, signal }));
    await check('the scan never takes the pen: it ignores pointer input', scan?.pointer === 'none');
    const verdict = page.locator('.verdict').first();
    await check('a wrong answer gets the slip verdict panel, not the failure one', await verdict.evaluate(el => el.classList.contains('verdict-bad') && !el.classList.contains('verdict-technical')));
    await page.waitForTimeout(1300);
    writeFileSync(join(outDir, 'write-marked-web-dark.png'), await page.screenshot({ animations: 'disabled' }));
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForTimeout(400);
    writeFileSync(join(outDir, 'write-marked-web-light.png'), await page.screenshot({ animations: 'disabled' }));
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.env.PRI_FEATURE_INSTRUMENT = '1';
  const { runFlows } = await import('./e2e.mjs');
  process.exit(await runFlows([flow, writeFlow]) ? 1 : 0);
}
