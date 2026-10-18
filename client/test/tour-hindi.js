// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — a Hindi-medium student's day, in Hindi.
//
// The catalogue suites prove that every string HAS a Hindi translation and the
// coverage scan proves that no screen hard-codes English. Neither proves what a
// student actually sees, because a screen can still fall back: a key looked up
// before the Hindi chunk arrived, a label computed once at module load, a
// string that comes back from a helper in English. This flow is that proof. It
// makes an Indian profile in Hindi through the real onboarding, then walks the
// screens the student uses — Home, Practice (typed and handwritten), Exams, an
// exam room, Progress and the Pri Explain player — and on every one asserts:
//
//   - <html lang="hi">, so a screen reader reads it with a Hindi voice;
//   - the screen is actually written in Devanagari, not merely tagged hi;
//   - not one visible text node, aria-label, title or placeholder is an
//     English interface string from the catalogue (the fallback this flow
//     exists to catch), and no raw catalogue key has leaked onto the page.
//
// What it does not flag, on purpose: question text, answer options, worked
// solutions, chapter names and anything else the engine and curriculum supply.
// Those stay English by design (see client/test/i18n-check.mjs) and the app
// declares them lang="en"; this flow compares the rest of the screen against
// the interface catalogue only, so it cannot mistake mathematics for a bug.
// Before it opens the app, the flow proves its own matcher on fixed fixtures:
// declared English content holding a catalogue word ("$2$ points") passes, and
// a genuinely untranslated interface string still fails.
//
// Run on its own:  node client/test/tour-hindi.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';
import { englishInterfaceForms, leaksOnPage, renderFixture } from './support/hindi-fallback.mjs';

// JEE Main is the India track whose exam is released (a source-checked
// Mathematics-section paper), so the exam room can be entered and audited.
const STUDENT = { name: 'Ananya Gupta', year: 12, course: 'in', track: 'jee-main', language: 'hi' };
const DEVANAGARI = /[ऀ-ॿ]/;

// Every English interface string whose Hindi is different — the strings whose
// appearance on a Hindi screen is a fallback (support/hindi-fallback.mjs).
const ENGLISH = englishInterfaceForms(en, hi);
const KEYS = Object.keys(en);

/** How much of the screen is in Devanagari — enough to show it is not just tagged hi. */
function devanagariOnPage() {
  const root = document.querySelector('.shell') || document.body;
  const text = root.innerText || '';
  return (text.match(/[ऀ-ॿ]+/g) || []).length;
}

export const flow = {
  id: 'hindi',
  name: 'Hindi · Practice, handwriting, Exams, exam room, Progress, Explain',
  online: true,

  async run({ page, base, check, goto, createProfile, settle, online }) {
    const audit = async (screen) => {
      await settle();
      await check(`${screen}: the document is declared Hindi`,
        await page.evaluate(() => document.documentElement.lang) === 'hi',
        `html lang is ${await page.evaluate(() => document.documentElement.lang)}`);
      const words = await page.evaluate(devanagariOnPage);
      await check(`${screen}: the screen is written in Devanagari`, words >= 8, `${words} Devanagari words`);
      const leaks = await page.evaluate(leaksOnPage, { english: ENGLISH, keys: KEYS });
      await check(`${screen}: no English interface string or raw key falls back onto the screen`,
        leaks.length === 0, leaks.slice(0, 8).join(' · '));
    };

    // ── The matcher, proved on fixed fixtures before it judges the app ──────────
    // The exam room once failed here on a JEE Main option "$2$ points": the
    // text node " points" equals explain.seq.points, and the option was not yet
    // declared English. Question content must pass; interface chrome must not.
    const leaksIn = async (html, english = ENGLISH) => {
      await renderFixture(page, html);
      return page.evaluate(leaksOnPage, { english, keys: KEYS });
    };
    const OPTION = '<span class="mcq-key">B</span><span><span class="katex">2</span> points</span>';
    {
      const leaks = await leaksIn(`<section class="exam-paper"><div lang="en"><div class="q-prompt">The circle meets the co-ordinate axes at</div></div>
        <button class="mcq-opt"><span class="mcq-key">B</span><span lang="en"><span><span class="katex">2</span> points</span></span></button>
        <div class="answer-row"><input class="answer-input"><span class="answer-suffix" lang="en">degrees</span></div>
        <button>${hi['examRoom.next']}</button></section>`);
      await check('Matcher: English question content holding interface words ("points", "degrees") is not a fallback',
        leaks.length === 0, leaks.join(' · '));
    }
    {
      const leaks = await leaksIn(`<section class="exam-paper"><button class="mcq-opt">${OPTION}</button></section>`);
      await check('Matcher: the same option NOT declared English is still seen (the matcher does not skip content by guesswork)',
        leaks.some(l => l.includes('explain.seq.points')), leaks.join(' · ') || 'nothing seen');
    }
    {
      // A Hindi key that is missing makes t() fall back to the English. Remove
      // one from a copy of the catalogue (the real file is untouched), render
      // what the app would then show beside declared English content, and the
      // matcher built from that catalogue must name the key.
      const missing = { ...hi };
      delete missing['examRoom.previous'];
      delete missing['examRoom.questionOf'];
      const english = englishInterfaceForms(en, missing);
      const shown = key => missing[key] ?? en[key];
      const leaks = await leaksIn(`<section class="exam-paper">
        <span class="tag">${shown('examRoom.questionOf').replace('{n}', '1').replace('{total}', '25')}</span>
        <div lang="en"><div class="q-prompt">How many points lie above the line?</div></div>
        <button class="mcq-opt"><span class="mcq-key">A</span><span lang="en">${OPTION}</span></button>
        <button class="btn btn-ghost">${shown('examRoom.previous')}</button></section>`, english);
      await check('Matcher: an interface string whose Hindi is missing still fails, beside English content',
        leaks.some(l => l.includes('= examRoom.previous (button)')) && leaks.some(l => l.includes('= examRoom.questionOf (span)')) && leaks.length === 2,
        leaks.join(' · ') || 'nothing seen');
      const raw = await leaksIn('<button class="btn">examRoom.next</button>');
      await check('Matcher: a raw catalogue key on the interface still fails',
        raw.length === 1 && raw[0].startsWith('raw key examRoom.next'), raw.join(' · ') || 'nothing seen');
    }

    await goto('/');
    await createProfile(STUDENT);
    await page.waitForFunction(() => document.documentElement.lang === 'hi', null, { timeout: 15000 });
    await audit('Home');

    // ── Practice: a real served question, answered wrong twice, then explained ──
    await page.goto(`${base}/practice`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await audit('Practice');

    // ── Handwriting: the ink toolbar, the reading panel and a symbol correction ──
    const writeTab = page.getByRole('button', { name: hi['verdict.modeWriteLabel'] });
    for (let skips = 0; skips < 20 && !await writeTab.count(); skips++) {
      await page.locator('.ctx-next').click();
      await page.waitForSelector('.q-prompt', { timeout: 30000 });
      await settle();
    }
    if (await check('Handwriting: a question that can be answered by hand was served', await writeTab.count() > 0)) {
      await writeTab.first().click();
      await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
      await settle();
      const toolbar = page.locator('.ink-toolbar');
      const toolbarText = await toolbar.innerText();
      // The instrument toolbar: Pen, Eraser, Page (sheets replace "more space"),
      // Finger, and the one-step-per-line hint.
      for (const key of ['ink.pen', 'ink.eraser', 'ink.addPage', 'ink.finger', 'ink.hint']) {
        await check(`Handwriting: the toolbar shows ${key} in Hindi`, toolbarText.includes(hi[key]), JSON.stringify(toolbarText));
      }
      const titles = await toolbar.locator('button').evaluateAll(els => els.map(el => [el.getAttribute('title'), el.getAttribute('aria-label')]));
      for (const [titleKey, ariaKey] of [['ink.undo', 'ink.undoLabel'], ['ink.redo', 'ink.redoLabel'], ['ink.clear', 'ink.clearLabel'],
        ['ink.fingerTitle', 'ink.fingerLabel']]) {
        await check(`Handwriting: the ${titleKey} control is titled and labelled in Hindi`,
          titles.some(([title, aria]) => title === hi[titleKey] && aria === hi[ariaKey]), JSON.stringify(titles));
      }
      // "More space" became Page: the control that adds a sheet is titled and
      // labelled in Hindi (its label names the page number it will add).
      await check('Handwriting: the ink.addPage control is titled and labelled in Hindi',
        titles.some(([title, aria]) => title === hi['ink.addPage'] && !!aria && aria.startsWith(hi['ink.addPageLabel'].split('{n}')[0])),
        JSON.stringify(titles));
      await check('Handwriting: the writing surface is labelled in Hindi',
        await page.locator('.ink-stage [role="img"]').first().getAttribute('aria-label') === hi['ink.surfaceLabel']);
      await check('Handwriting: no developer engine diagnostics are shown to the student',
        await page.locator('.ink-answer [role="note"]').count() === 0);

      // One stroke. Handwriting is read only by the server reader (owner
      // decision), and the student entered signed in (the activation gate,
      // issue #477): the page is sent to the server's reader — a scripted
      // stand-in in this suite — and what came back is said in Hindi: either an
      // ink.* reader status or InkAnswer's cloud provenance note
      // (verdict.readOnServer, drawn in .ink-status when rec.cloud is true).
      const box = await page.locator('.ink-canvas-live').boundingBox();
      await page.mouse.move(box.x + 60, box.y + 30);
      await page.mouse.down();
      for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 60 + i * 0.4, box.y + 30 + i * 6);
      await page.mouse.up();
      await page.waitForSelector('.ink-status, .ink-line', { timeout: 20000 }).catch(() => {});
      await settle();
      const inkStatus = (await page.locator('.ink-status').first().innerText().catch(() => '')) || '';
      await online.settled();
      await check('Handwriting: the page was read by the server, not on the device',
        online.calls.some(c => /^\/v1\/handwriting\//.test(c.path) || /\/recogni[sz]e$/.test(c.path)) && await page.locator('.ink-answer [role="note"]').count() === 0,
        JSON.stringify(online.calls.slice(-4).map(c => `${c.status} ${c.path}`)));
      await check('Handwriting: what the reader did is said in Hindi',
        DEVANAGARI.test(inkStatus) && Object.keys(hi).some(k => (k.startsWith('ink.') || k === 'verdict.readOnServer') && hi[k] === inkStatus), JSON.stringify(inkStatus));
      await audit('Practice handwriting');
      await page.locator(`.ink-tool[title="${hi['ink.clear']}"]`).click();
      await settle();
    }

    // ── Sign in: only the server marks, so the rest of Practice is signed in ──
    // Everything above ran signed out. The same profile now signs in to the
    // real platform server through Settings (in Hindi), and Practice is opened
    // again: what follows is marked by the server.
    await online.signIn({ name: STUDENT.name });
    await audit('Settings, signed in');
    await page.goto(`${base}/practice`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });

    const answerBox = page.locator('.editor-body input.answer-input');
    const typeTab = page.getByRole('button', { name: hi['verdict.modeTypeLabel'] });
    for (let skips = 0; skips < 20; skips++) {
      if (await typeTab.count()) await typeTab.first().click();
      await settle();
      if (await answerBox.count() === 1) break;
      await page.locator('.ctx-next').click();
      await page.waitForSelector('.q-prompt', { timeout: 30000 });
    }
    if (await check('Practice: a typed question was served', await answerBox.count() === 1)) {
      const send = async (value) => {
        await answerBox.fill(value);
        await answerBox.press('Enter');
        await settle();
      };
      await send('-987654');
      await page.waitForSelector('.verdict-bad, .eval-card', { timeout: 20000 });
      await audit('Practice feedback');
      if (!await page.locator('.eval-card').count()) {
        await send('-987655');
        await page.waitForSelector('.eval-card', { timeout: 20000 }).catch(() => {});
      }
      await audit('Practice verdict');
      const marked = await online.practiceCalls(new RegExp(`^/v1/practice/${(await online.shownRow())?.serverQuestionId}/submit$`));
      await check('Practice: the verdict shown in Hindi is the server\u2019s mark, not a device mark',
        marked.length >= 1 && marked.every(c => c.status === 200 && c.json?.authoritative === true) && marked.at(-1).json.resolved === true &&
          await page.locator('.eval-card').count() === 1,
        JSON.stringify(marked.map(c => ({ status: c.status, resolved: c.json?.resolved }))));

      const launch = page.locator('.pri-explain-launch');
      if (await check('Explain: a resolved question offers the explanation in Hindi',
        await launch.count() === 1 && (await launch.innerText()).includes(hi['explain.launch']),
        await launch.count() ? JSON.stringify(await launch.innerText()) : 'no launch button')) {
        await launch.click();
        await page.waitForSelector('.pri-explain-dialog', { timeout: 10000 });
        await check('Explain: the player opens in Hindi',
          (await page.locator('.pri-explain-kicker').innerText()).includes('बोर्ड मोड'),
          JSON.stringify(await page.locator('.pri-explain-kicker').innerText()));
        await audit('Explain');
        const rail = page.locator('.pri-explain-rail button');
        if (await rail.count() > 1) {
          await rail.nth(await rail.count() - 1).click();
          await audit('Explain final step');
        }
        await page.getByRole('button', { name: hi['explain.close'] }).click();
      }
    }

    // ── Exams and an exam room ──────────────────────────────────────────────────
    await page.goto(`${base}/exams`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.shell main .btn-primary', { timeout: 30000 });
    await audit('Exams');
    await page.locator('.shell main .btn-primary.btn-lg').first().click();
    await page.waitForURL(/\/exams\/[^/]+$/, { timeout: 30000 });
    await page.waitForSelector('.q-prompt, .exam-q, .shell main h1, .shell main h2', { timeout: 30000 });
    await audit('Exam room');
    // The answers on the paper are its English content, declared as such like
    // the prompt above them — for a screen reader and for the audit above.
    const options = await page.locator('.exam-paper .mcq-opt').evaluateAll(els => els.map(el =>
      [...el.childNodes].filter(n => !(n.nodeType === 1 && n.classList.contains('mcq-key')) && (n.textContent || '').trim())
        .every(n => (n.nodeType === 1 ? n : n.parentElement).closest('[lang]')?.getAttribute('lang') === 'en')));
    await check('Exam room: every answer option is declared English content (lang="en")',
      options.every(Boolean), `${options.filter(x => !x).length} of ${options.length} options undeclared`);

    // ── Progress ───────────────────────────────────────────────────────────────
    await page.goto(`${base}/progress`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.shell main h1, .shell main h2', { timeout: 30000 });
    await audit('Progress');

    // ── Settings: the switch back works and the screens return to English ──────
    await page.goto(`${base}/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.shell main', { timeout: 30000 });
    await audit('Settings');
    await page.locator('button[aria-pressed]', { hasText: 'English' }).first().click();
    await page.waitForFunction(() => document.documentElement.lang === 'en', null, { timeout: 10000 }).catch(() => {});
    await check('switching back to English returns the document to English',
      await page.evaluate(() => document.documentElement.lang) === 'en');
    await page.goto(`${base}/exams`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.shell main .btn-primary', { timeout: 30000 });
    await settle();
    await check('and Exams reads in English again',
      !DEVANAGARI.test(await page.locator('.shell main h1, .shell main h2').first().innerText()));
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
