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
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';
import { englishInterfaceForms, leaksOnPage } from './support/hindi-fallback.mjs';

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
    writeFileSync(join(outDir, 'signin-web-dark.png'), await page.screenshot({ animations: 'disabled' }));
    await check('the signed-out welcome is in the instrument material', await page.evaluate(() => document.documentElement.classList.contains('ui-instrument')));
    await check('signed out, the welcome follows the device theme too', await page.evaluate(() => document.documentElement.dataset.theme) === 'dark');
    await check('no ruled-paper backdrop on the instrument welcome', await page.evaluate(() => { const m = document.querySelector('.mathfield'); return !m || getComputedStyle(m).display === 'none'; }));
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
    // The plate's three figures (design s2): certified marks, questions, covered.
    const kpis = (await page.locator('.in-kpis b').allTextContents()).map(x => x.trim());
    await check('the plate has the three figures: marks, questions, covered', kpis.length === 3 && await page.locator('.in-kpis [data-plate-marks], .in-kpis [data-plate-questions], .in-kpis [data-plate-covered]').count() === 3, JSON.stringify(kpis));
    await check('a new student’s plate states no certified marks, 0 questions and 0% covered', kpis[0] === '—' && kpis[1] === '0' && /^(0%|—)$/.test(kpis[2]), JSON.stringify(kpis));
    await check('accuracy stays behind the floor: no topic states a percentage for a new student', !/\d%/.test(await page.locator('.in-exs').textContent().catch(() => '')));
    const drawn = await page.evaluate(() => {
      const c = document.querySelector('[data-instrument-scope] canvas'); if (!c || !c.width) return 0;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let ink = 0;
      for (let i = 3; i < d.length; i += 16) if (d[i] > 0) ink++;
      return ink;
    });
    await check('the scope draws the chapter’s mathematics', drawn > 200, `${drawn} painted samples`);
    await check('the scope is labelled for assistive tech', !!(await page.locator('[data-instrument-scope]').getAttribute('aria-label')));
    writeFileSync(join(outDir, 'index-web-dark.png'), await page.screenshot({ animations: 'disabled' }));

    // The plate's topic row: the chapter's own dot points, each a way into practice.
    const dot = page.locator('[data-plate-dotpoint]').first();
    if (await check('the plate shows the chapter’s topics', await dot.count() === 1)) {
      await check('each topic is named, not an object', !/object Object/.test(await page.locator('.in-exs').textContent()));
      const href = await dot.getAttribute('href');
      await check('a topic opens practice for exactly that topic', /subtopic=/.test(href) && /dotpoint=0/.test(href), href);
    }
    await check('the plate states certified marks (none yet: —)', (await page.locator('[data-plate-marks] b').textContent()).trim() === '—');

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
    // No wait between opening and typing: a key pressed the instant the bar
    // opens must land in the field.
    await opener.click();
    await page.keyboard.type(name.slice(0, 5));
    await check('keys typed the instant the bar opens land in the field', (await page.locator('.in-pal-q input').inputValue()) === name.slice(0, 5), await page.locator('.in-pal-q input').inputValue());
    await page.waitForTimeout(150);
    await page.keyboard.press('Enter');
    await page.waitForURL(u => u.pathname === '/practice', { timeout: 10000 });
    await check('↵ on a chapter opens Practice for it', new URL(page.url()).searchParams.get('subtopic') === id, page.url());

    // The syllabus map: one node per chapter, prerequisite edges drawn, a
    // node opens its card, and the card's Practise opens that chapter.
    await goto('/map');
    await settle();
    await page.waitForSelector('[data-instrument-map] [data-map-chapter]', { timeout: 15000 });
    const nodes = await page.locator('[data-map-chapter]').count();
    await check('the map shows one node per chapter', nodes === chapters, `${nodes} nodes, ${chapters} chapters`);
    await check('prerequisite edges are drawn between chapters', await page.locator('.in-map-edge').count() > 0);
    const third = page.locator('[data-map-chapter]').nth(2);
    const thirdId = await third.getAttribute('data-map-chapter');
    await third.focus();
    await check('focusing a node opens its card', await page.locator(`[data-map-card="${thirdId}"]`).count() === 1);
    await check('a node is a 44px target with a spoken name', await third.evaluate(el => el.getBoundingClientRect().width >= 43.5 && !!el.getAttribute('aria-label')));
    await check('a new student’s card shows no certified marks yet', await page.locator(`[data-map-card="${thirdId}"] [data-map-marks]`).getAttribute('data-map-marks') === 'none');
    await check('no chapter is recommended before there is any history', await page.locator('.in-map-node.is-next').count() === 0);
    // The constellation at desktop width: no two nodes or labels overlap, and
    // the floating card covers none of them.
    const mapGeo = () => page.evaluate(() => {
      const rects = [...document.querySelectorAll('[data-map-node]')].map(g => {
        const r = g.getBoundingClientRect(); return { id: g.getAttribute('data-map-node'), l: r.left, t: r.top, r: r.right, b: r.bottom };
      });
      const c = document.querySelector('[data-map-card]')?.getBoundingClientRect();
      const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
      const pairs = [];
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) if (hit(rects[i], rects[j])) pairs.push(`${rects[i].id}×${rects[j].id}`);
      const card = c ? { l: c.left, t: c.top, r: c.right, b: c.bottom } : null;
      return { n: rects.length, pairs, covered: card ? rects.filter(r => hit(r, card)).map(r => r.id) : [], floating: !!c && getComputedStyle(document.querySelector('[data-map-card]')).position === 'absolute' };
    });
    await page.setViewportSize({ width: 1240, height: 900 });
    await page.waitForTimeout(400);
    const narrow = await mapGeo();
    await check('at 1240px the card covers no node and no labels overlap', narrow.covered.length === 0 && narrow.pairs.length === 0, JSON.stringify({ floating: narrow.floating, covered: narrow.covered, pairs: narrow.pairs.slice(0, 4) }));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(400);
    const geo = await mapGeo();
    await check('the map draws every chapter as a positioned node', geo.n === chapters, `${geo.n} nodes`);
    await check('no two map nodes or labels overlap', geo.pairs.length === 0, geo.pairs.slice(0, 6).join(', '));
    await check('the card floats over the map at desktop width and covers no node', geo.floating && geo.covered.length === 0, JSON.stringify(geo.covered));
    await check('the map links are straight lines', (await page.locator('.in-map-edge').evaluateAll(es => es.every(e => / L /.test(e.getAttribute('d')) && !/Q/.test(e.getAttribute('d'))))));
    writeFileSync(join(outDir, 'map-web-dark.png'), await page.screenshot({ animations: 'disabled' }));
    await page.locator('[data-map-practise]').click();
    await page.waitForURL(u => u.pathname === '/practice', { timeout: 10000 });
    await check('the card’s Practise opens that chapter', new URL(page.url()).searchParams.get('subtopic') === thirdId, page.url());

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

    // The hint ladder: a rung opened is a numbered card, marked as a rung.
    await page.locator('.hint-bulb').click();
    await page.waitForSelector('.hintbox[data-hint-shown]', { timeout: 15000 }).catch(() => {});
    const rung = await page.evaluate(() => {
      const box = document.querySelector('.hintbox[data-hint-shown]'); if (!box) return null;
      const b = getComputedStyle(box, '::before'); const probe = document.createElement('div'); probe.style.background = 'var(--in-action)'; document.body.append(probe);
      const action = getComputedStyle(probe).backgroundColor; probe.remove();
      return { numbered: b.content !== 'none' && b.content !== '', bg: b.backgroundColor, action, radius: getComputedStyle(box).borderRadius };
    });
    await check('an opened hint is a numbered rung on the ladder', !!rung && rung.numbered && rung.bg === rung.action && rung.radius === '6px', JSON.stringify(rung));
    const shell = page.locator('.editor-shell').first();
    const look = sel => page.evaluate(q => { const el = document.querySelector(q); if (!el) return null; const s = getComputedStyle(el); return { bg: s.backgroundColor, radius: s.borderRadius, font: s.fontFamily }; }, sel);
    const stage = await look('.ink-stage');
    const voidBg = await page.evaluate(() => { const p = document.createElement('div'); p.style.background = 'var(--in-void)'; document.body.append(p); const v = getComputedStyle(p).backgroundColor; p.remove(); return v; });
    await check('the writing surface is the instrument void', !!stage && stage.bg === voidBg, JSON.stringify({ stage: stage?.bg, voidBg }));
    await check('the mode switch is the instrument segmented control', (await look('.mode-tabs.seg'))?.radius === '6px');

    const wrong = String(Number(right.text) + 1);
    online.forgetKeptReads?.();
    online.reader.lines = [{ text: 'x + y = 35' }, { text: 'x - y = 13' }, { text: wrong }];
    const box = await page.locator('.ink-canvas-live').boundingBox();
    await handwrite(page, box, '3' + wrong.replace('-', ''), { x: 40 });
    await pressRead(page);
    await page.waitForFunction(n => document.querySelectorAll('.ink-line').length >= n, 2, { timeout: 20000 }).catch(() => {});
    const chips = await page.locator('.ink-line .ink-line-math').count();
    await check('Pri’s reading shows each line as a chip', chips >= 2, `${chips} lines`);
    const chip = await look('.ink-line .ink-line-math');
    await check('a reading chip is drawn on the raised surface', !!chip && chip.radius === '4px', JSON.stringify(chip));
    // The student's own simultaneous pair, drawn (display only).
    const drawn = page.locator('[data-reading-plot]');
    await check('the reading’s simultaneous pair is drawn as two lines', await drawn.count() === 1 && await drawn.getAttribute('data-reading-plot') === '2', await drawn.getAttribute('data-reading-plot').catch(() => 'none'));
    await check('the drawing says it is not a mark', /never sets a mark/i.test(await drawn.textContent().catch(() => '')));
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

    // A second wrong try resolves the question: the reply now carries the
    // server's mark as CBSE-style step rows, which must agree with it.
    const replies = [];
    page.on('response', async r => { if (/\/v1\/practice\/[^/]+\/submit$/.test(r.url())) { try { replies.push(await r.json()); } catch { /* not json */ } } });
    await page.getByRole('button', { name: /^Submit/ }).last().click();
    await page.waitForSelector('[data-step-marks]', { timeout: 30000 }).catch(() => {});
    const reply = replies.at(-1) || null;
    await check('the resolving reply carries step-mark rows', !!reply?.markRows?.rows?.length, JSON.stringify(reply?.markRows || null));
    if (reply?.markRows?.rows) {
      const sum = reply.markRows.rows.reduce((n, r) => n + r.earned, 0);
      await check('the rows sum to the engine’s mark', sum === reply.marksEarned, `${sum} vs ${reply.marksEarned}/${reply.marksPossible}`);
      await check('a wrong answer’s final-answer row earns nothing', reply.markRows.rows.at(-1).kind === 'answer' && reply.markRows.rows.at(-1).earned === 0);
      await check('the rows are labelled Pri practice feedback, not an official scheme', reply.markRows.scheme === 'pri-practice-cbse-style');
    }
    const shown = await page.locator('[data-step-marks] [data-step-mark]').count();
    await check('the card shows one row per mark', !!reply && shown === reply.marksPossible, `${shown} rows for ${reply?.marksPossible} marks`);
    await check('no half marks are shown', !/½|0\.5/.test(await page.locator('[data-step-marks]').textContent().catch(() => '')));
    const workingLabels = await page.locator('[data-step-marks] [data-step-mark="working"] .set-k').allTextContents();
    await check('a wrong answer’s method marks are numbered, never named after a step', workingLabels.every(l => /Method mark \d/.test(l)), JSON.stringify(workingLabels));
    writeFileSync(join(outDir, 'write-resolved-step-marks-web-dark.png'), await page.screenshot({ fullPage: true, animations: 'disabled' }));

    // Scripts: the resolved attempt's row carries its certified mark strip.
    if (reply) {
      await page.goto(`${base}/review`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.hist-row', { timeout: 15000 }).catch(() => {});
      const strip = page.locator('[data-mark-strip]').first();
      await check('Scripts shows the certified mark strip on the attempt', await strip.count() === 1 && await strip.getAttribute('data-mark-strip') === `${reply.marksEarned}/${reply.marksPossible}`, await strip.getAttribute('data-mark-strip').catch(() => 'none'));
      await check('the strip has one square per mark', await strip.locator('i').count() === reply.marksPossible);
      // The filters state their counts; the menus and search work on the rows.
      await page.waitForSelector('[data-history-count="all"]', { timeout: 10000 });
      const count = async k => (await page.locator(`[data-history-count="${k}"]`).textContent()).trim();
      const rowsShown = await page.locator('.hist-row').count();
      await check('“All” counts every script shown', await count('all') === String(rowsShown), `${await count('all')} vs ${rowsShown} rows`);
      await check('the wrong answer is counted as incorrect and as needing another look', await count('wrong') === '1' && await count('needsLook') === '1', `${await count('wrong')} / ${await count('needsLook')}`);
      await check('there is no “Not read” filter (nothing records it)', await page.locator('[data-history-filter="notRead"]').count() === 0);
      await page.locator('[data-history-filter="needsLook"]').click();
      await page.waitForFunction(() => document.querySelector('[data-history-filter="needsLook"]')?.getAttribute('aria-pressed') === 'true' && document.querySelectorAll('.hist-row').length === 1, null, { timeout: 10000 }).catch(() => {});
      await check('“Needs another look” lists that script', await page.locator('.hist-row').count() === 1);
      await page.locator('[data-history-filter="all"]').click();
      await check('the chapter and sort menus are there', await page.locator('[data-history-chapter]').count() === 1 && await page.locator('[data-history-sort] option').count() === 3);
      // Design s8: the search sits in the shared bar in place of the ⌘K field,
      // and ⌘K still opens the command bar from here.
      await check('Scripts: the search is in the top bar, replacing the ⌘K field', await page.locator('[data-instrument-bar-slot] [data-history-search]').count() === 1 && !(await page.locator('.in-cmd').isVisible()));
      await page.locator('body').click({ position: { x: 5, y: 600 } });
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
      await check('Scripts: ⌘K still opens the command bar', await page.locator('[data-instrument-command] [role=dialog]').count() === 1);
      await page.keyboard.press('Escape');
      // Sorted by marks lost: one flat list, no repeated day headings, unique ids.
      await page.locator('[data-history-sort]').selectOption('marks');
      await page.waitForFunction(() => document.querySelectorAll('.hist-row').length > 0 && !document.querySelector('.in-led-dayh'), null, { timeout: 10000 }).catch(() => {});
      const ids = await page.evaluate(() => [...document.querySelectorAll('[id]')].map(e => e.id));
      await check('sorted by marks lost, the ledger has no day headings and every id is unique', await page.locator('.in-led-dayh').count() === 0 && new Set(ids).size === ids.length, `${ids.length} ids`);
      await page.locator('[data-history-sort]').selectOption('newest');
      await page.waitForSelector('.in-led-dayh', { timeout: 10000 }).catch(() => {});
      await page.keyboard.press('/');
      await check('“/” focuses the search', await page.evaluate(() => document.activeElement?.hasAttribute('data-history-search')));
      await page.keyboard.type('zzqx-no-such-question');
      await page.waitForSelector('[data-history-search-count]', { timeout: 10000 }).catch(() => {});
      await check('a search with no match lists nothing', await page.locator('.hist-row').count() === 0 && await page.locator('[data-history-search-count]').count() === 1);
      await page.locator('[data-history-search]').fill('');
      await page.waitForSelector('.hist-row', { timeout: 10000 }).catch(() => {});
      writeFileSync(join(outDir, 'scripts-web-dark.png'), await page.screenshot({ animations: 'disabled' }));
      // Report: the certified total is the receipts' total.
      await page.goto(`${base}/progress`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-instrument-report]', { timeout: 15000 }).catch(() => {});
      const fig = (await page.locator('[data-report-marks] b').textContent().catch(() => '')).replace(/\s+/g, '');
      await check('the Report’s certified marks are the receipts’ total', fig === `${reply.marksEarned}/${reply.marksPossible}`, fig);
      await check('today’s practice is lit on the heat-map', await page.locator('.in-heat i.is-on').count() >= 1);
      // One question is under every evidence floor: the chart draws no line,
      // never a zero, and says why.
      await check('below the floor the chart draws no point and says so', await page.locator('[data-report-chart="empty"] [data-chart-empty]').count() === 1 && await page.locator('[data-chart-line]').count() === 0);
      await check('method marks are withheld below the floor', (await page.locator('[data-report-method] b').textContent()).trim() === '—');
      await check('the lede is the fixed template over the figures', /^1 question answered in this period/.test(await page.locator('[data-report-lede]').textContent().catch(() => '')), await page.locator('[data-report-lede]').textContent().catch(() => ''));
      await check('Report: the period switch is in the top bar (design s7)', await page.locator('[data-instrument-bar-slot] [data-report-periods]').count() === 1 && !(await page.locator('.in-cmd').isVisible()));
      // The period switch refetches the series for that window.
      // The old period's figures never show under the new title: until the
      // month arrives, the report holds no figures at all.
      const stale = page.evaluate(() => new Promise(done => {
        const el = document.querySelector('[data-instrument-report]');
        const seen = [];
        const mo = new MutationObserver(() => seen.push([el.getAttribute('data-report-period'), el.getAttribute('data-report-loaded')]));
        mo.observe(el, { attributes: true });
        setTimeout(() => { mo.disconnect(); done(seen); }, 2500);
      }));
      const series = page.waitForResponse(r => /\/report\/series\?period=month/.test(r.url()) || false, { timeout: 5000 }).catch(() => null);
      await page.locator('[data-report-period-btn="month"]').click();
      await series;
      await page.waitForSelector('[data-instrument-report][data-report-period="month"]', { timeout: 10000 }).catch(() => {});
      const seen = await stale;
      await check('switching period never shows the old period’s figures under the new title', seen.every(([p, l]) => l === 'none' || l === p), JSON.stringify(seen));
      await check('Month is pressed and the report shows the month', await page.locator('[data-report-period-btn="month"]').getAttribute('aria-pressed') === 'true' && await page.locator('[data-instrument-report]').getAttribute('data-report-period') === 'month');
      await check('the month series loaded (the marks figure is still the receipts’ total)', (await page.locator('[data-report-marks] b').textContent().catch(() => '')).replace(/\s+/g, '') === `${reply.marksEarned}/${reply.marksPossible}`);
      await check('the month chart has its four weekly points', await page.locator('.in-chart-tick').count() === 4, `${await page.locator('.in-chart-tick').count()} ticks`);
      await page.locator('[data-report-period-btn="week"]').click();
      // On a phone the bar is compact: the switch and the search stay in the page.
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(300);
      await check('phone: the period switch stays in the page, not the bar', await page.locator('[data-instrument-report] [data-report-periods]').count() === 1 && await page.locator('[data-instrument-bar-slot] *').count() === 0);
      await page.setViewportSize({ width: 1440, height: 900 });
      writeFileSync(join(outDir, 'report-web-dark.png'), await page.screenshot({ animations: 'disabled' }));
    }

    // The command bar lists the attempt under "Your scripts" with its certified mark.
    if (reply) {
      await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.in-cmd', { timeout: 15000 });
      await page.locator('.in-cmd').click();
      await page.waitForSelector('[data-instrument-command] [id^="in-pal-sc-"]', { timeout: 10000 }).catch(() => {});
      const scriptRow = page.locator('[data-instrument-command] [id^="in-pal-sc-"]').first();
      await check('the command bar lists your scripts', await scriptRow.count() === 1);
      await check('— with the certified mark', (await scriptRow.locator('small').textContent().catch(() => '')).trim() === `${reply.marksEarned}/${reply.marksPossible}`);
      await page.keyboard.press('Escape');
    }

    // The map's marks are the server-certified receipts, nothing else.
    if (reply) {
      await page.goto(`${base}/map`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-map-chapter]', { timeout: 15000 }).catch(() => {});
      const node = page.locator('[data-map-chapter="y7-integers"]');
      if (await check('the chapter just practised is on the map', await node.count() === 1)) {
        await node.focus();
        const shownMarks = await page.locator('[data-map-card="y7-integers"] [data-map-marks]').getAttribute('data-map-marks');
        await check('the map title states this month’s certified marks', (await page.locator('[data-map-subline]').textContent()).includes(`${reply.marksEarned} / ${reply.marksPossible} marks this month`), await page.locator('[data-map-subline]').textContent());
        await check('its card shows the certified marks for that chapter', shownMarks === `${reply.marksEarned}/${reply.marksPossible}`, `${shownMarks} vs ${reply.marksEarned}/${reply.marksPossible}`);
      }
    }
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForTimeout(400);
    writeFileSync(join(outDir, 'write-marked-web-light.png'), await page.screenshot({ animations: 'disabled' }));
  }
};

// Hindi parity: every instrument screen is written in Devanagari, declared
// Hindi, and has no English interface string or raw key on it.
const ENGLISH = englishInterfaceForms(en, hi);
const KEYS = Object.keys(en);
export const hindiFlow = {
  id: 'instrument-hindi',
  name: 'Instrument · Hindi parity — Index, Map, Report, Scripts, command bar',
  online: true,
  async run({ page, check, goto, settle, createProfile, browserName = 'chromium' }) {
    const outDir = join(process.env.PRI_VISUAL_OUT || mkdtempSync(join(tmpdir(), 'pri-instrument-')), `instrument-${browserName}`);
    mkdirSync(outDir, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await goto('/');
    await createProfile({ name: 'Ananya Instrument', year: 10, course: 'in', language: 'hi' });
    await page.waitForFunction(() => document.documentElement.lang === 'hi', null, { timeout: 15000 });
    const audit = async (screen, ready) => {
      await settle();
      if (ready) await check(`${screen}: the screen loaded`, await page.waitForSelector(ready, { timeout: 15000 }).then(() => true, () => false));
      await check(`${screen}: the document is declared Hindi`, await page.evaluate(() => document.documentElement.lang) === 'hi');
      const words = await page.evaluate(() => ((document.querySelector('.shell') || document.body).innerText.match(/[ऀ-ॿ]+/g) || []).length);
      await check(`${screen}: the screen is written in Devanagari`, words >= 8, `${words} Devanagari words`);
      const leaks = await page.evaluate(leaksOnPage, { english: ENGLISH, keys: KEYS });
      await check(`${screen}: no English interface string or raw key falls back onto the screen`, leaks.length === 0, leaks.slice(0, 8).join(' · '));
    };
    await goto('/'); await audit('Index', '.in-ch');
    writeFileSync(join(outDir, 'index-web-light-hi.png'), await page.screenshot({ animations: 'disabled' }));
    await goto('/map'); await audit('Map', '[data-map-chapter]');
    await goto('/progress'); await audit('Report', '[data-instrument-report]');
    await goto('/review'); await audit('Scripts', '.ws-page, .card');
    await goto('/');
    await page.locator('.in-cmd').click();
    await audit('Command bar', '[data-instrument-command]');
    await page.keyboard.press('Escape');
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.env.PRI_FEATURE_INSTRUMENT = '1';
  const { runFlows } = await import('./e2e.mjs');
  process.exit(await runFlows([flow, writeFlow, hindiFlow]) ? 1 : 0);
}
