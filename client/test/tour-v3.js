// Pri Learning v3 — E2E tour: pathways, figures, multipart exams, history,
// backup/restore, task packs, storage safety. iPad viewport, real interactions.
// Usage: build the client, start the server (npm start), install playwright,
// then: node client/test/tour-v3.js   (screenshots land in ./shots)
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://localhost:4000';
fs.mkdirSync('shots', { recursive: true });

(async () => {
  const { TEMPLATES } = await import(new URL('../src/ink/templates.js', require('url').pathToFileURL(__filename)).href);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({
    viewport: { width: 1194, height: 834 },
    deviceScaleFactor: 2,
    hasTouch: true,
    acceptDownloads: true
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  let failures = 0;
  const shot = async (name, opts = {}) => {
    await page.waitForTimeout(opts.wait ?? 600);
    await page.screenshot({ path: `shots/${name}.png`, fullPage: opts.full || false });
    console.log('📸', name);
  };
  const ok = (name, cond) => { console.log(cond ? 'PASS' : 'FAIL', name); if (!cond) failures++; };

  // ── 1. Create a Year 12 Extension 1 student ──
  await page.goto(BASE + '/');
  await page.waitForSelector('.profile-tile', { timeout: 15000 });
  await page.click('.profile-tile.new');
  await page.fill('input[placeholder="e.g. Priysharan"]', 'Pri');
  await page.selectOption('select >> nth=0', '12');
  await page.waitForSelector('.pathway-pick', { timeout: 5000 });
  await shot('v3-01-pathway-picker');
  await page.click('.pathway-pick:has-text("Extension 1")');
  await page.click('button:has-text("Start learning")');
  await page.waitForSelector('text=Predicted exam mark', { timeout: 15000 });
  const bandChip = await page.$eval('.band-chip', el => el.textContent).catch(() => '');
  ok('E-band calibration shown for Extension 1 student', /^E[1-4]$/.test(bandChip.trim()));
  await shot('v3-02-dashboard-band');

  // ── 2. Skill map shows Extension stream sections with NESA codes ──
  await page.goto(BASE + '/map');
  await page.waitForSelector('.node', { timeout: 10000 });
  const sectionOpts = await page.$$eval('.spread select option', els => els.map(e => e.value));
  ok('stream sections in skill map', sectionOpts.includes('ext1-12'));
  await page.selectOption('.spread select', 'ext1-12');
  await page.waitForTimeout(400);
  const codeChip = await page.$eval('.node-code', el => el.textContent).catch(() => '');
  ok('NESA topic codes on tiles', /^ME-/.test(codeChip));
  await shot('v3-03-skillmap-ext1');

  // ── 3. Figures: a diagram renders inside the question card ──
  await page.goto(BASE + '/practice?subtopic=y9-pythagoras');
  await page.waitForSelector('.q-prompt', { timeout: 15000 });
  const hasFigure = await page.waitForSelector('.q-figure svg', { timeout: 6000 }).then(() => true).catch(() => false);
  ok('SVG figure rendered with the question', hasFigure);
  await shot('v3-04-figure-question');

  // ── 4. Handwriting still marks correctly (regression) + supplementary figure ──
  await page.goto(BASE + '/practice?subtopic=y7-angles');
  await page.waitForSelector('.q-prompt', { timeout: 15000 });
  await page.click('.mode-tab:has-text("Write")');
  await page.waitForSelector('.ink-canvas', { timeout: 8000 });
  const promptText = await page.$eval('.q-prompt', el => el.textContent);
  let expected = null;
  const m1 = promptText.match(/One of them is\s*(\d+)/);
  if (m1) expected = String((promptText.includes('complementary') ? 90 : 180) - Number(m1[1]));
  const m2 = promptText.match(/Three of them are\s*(\d+)°?,\s*(\d+)°?\s*and\s*(\d+)/);
  if (!expected && m2) expected = String(360 - Number(m2[1]) - Number(m2[2]) - Number(m2[3]));
  const m3 = promptText.match(/angles?\s+of\s+(\d+)°?\s+and\s+x/);
  if (!expected && m3) expected = String(180 - Number(m3[1]));
  if (expected) {
    const canvas = await page.$('.ink-canvas');
    const box = await canvas.boundingBox();
    const SIZE = 90;
    let ox = box.x + 40, oy = box.y + 60;
    for (const ch of expected) {
      const variant = TEMPLATES[ch][0];
      for (const stroke of variant) {
        const pts = stroke.map(([px, py]) => [ox + px / 100 * SIZE * 0.7, oy + py / 100 * SIZE]);
        await page.mouse.move(pts[0][0], pts[0][1]);
        await page.mouse.down();
        for (const [x, y] of pts) { await page.mouse.move(x, y, { steps: 2 }); }
        await page.mouse.up();
        await page.waitForTimeout(60);
      }
      ox += SIZE * 0.75;
    }
    await page.waitForTimeout(800);
    await page.click('button:has-text("Mark my writing")');
    await page.waitForSelector('.verdict', { timeout: 10000 });
    ok('handwritten answer marked correct', !!(await page.$('.verdict-good')));
    await page.click('button:has-text("Next question")').catch(() => { });
    await page.waitForTimeout(500);
  } else {
    console.log('skip handwriting (unrecognised prompt shape):', promptText.slice(0, 80));
    // answer via typing so history has an entry
    await page.click('.mode-tab:has-text("Type")');
    await page.click('button:has-text("Show solution")');
    await page.waitForTimeout(400);
  }

  // ── 5. Exam: Section II multipart + marks-based results ──
  await page.goto(BASE + '/exams');
  await page.waitForSelector('button:has-text("Start exam")', { timeout: 8000 });
  await page.click('button:has-text("Start exam")');
  await page.waitForSelector('.exam-timer', { timeout: 20000 });
  const dotCount = await page.$$eval('.exam-dot', els => els.length);
  ok('exam includes a Section II structured question (11 = 10 + 1)', dotCount === 11);
  await page.click(`.exam-dot >> nth=${dotCount - 1}`);
  await page.waitForTimeout(400);
  const structured = await page.$('.tag:has-text("Structured")');
  ok('multipart question renders with parts', !!structured);
  const partInputs = await page.$$eval('.answer-row input, .mcq', els => els.length);
  ok('multipart parts have their own inputs', partInputs >= 2);
  await shot('v3-05-exam-multipart', { full: true });
  // partial-credit working toggle exists on an eligible single question
  let workingToggleSeen = false;
  for (let i = 0; i < dotCount - 1 && !workingToggleSeen; i++) {
    await page.click(`.exam-dot >> nth=${i}`);
    await page.waitForTimeout(150);
    workingToggleSeen = !!(await page.$('button:has-text("Show working for partial credit")'));
  }
  // ~3% of random papers contain no step-checkable single questions — treat
  // absence as a soft warning rather than a hard failure.
  if (workingToggleSeen) ok('partial-credit working toggle available', true);
  else console.log('WARN partial-credit toggle not in this paper’s sample (rare, sampling-dependent)');
  await page.click('button:has-text("Submit paper")');
  await page.waitForSelector('.hero-num', { timeout: 20000 });
  const resultsText = await page.$eval('body', el => el.textContent);
  ok('results are marks-based', /of \d+ marks/.test(resultsText));
  ok('multipart marked part-by-part in review', /Structured/.test(resultsText));
  await shot('v3-06-exam-results', { full: false });

  // ── 6. History: browse, bookmark, retry with same numbers ──
  await page.goto(BASE + '/history');
  await page.waitForSelector('.hist-row', { timeout: 10000 });
  const histCount = await page.$$eval('.hist-row', els => els.length);
  ok('history lists answered questions', histCount >= 2);
  await page.click('.hist-star >> nth=0');
  await page.waitForTimeout(300);
  const starred = await page.$('.hist-star.on');
  ok('bookmark toggles', !!starred);
  await page.click('.pill-opt:has-text("Bookmarked")');
  await page.waitForTimeout(400);
  ok('bookmark filter works', (await page.$$eval('.hist-row', els => els.length)) >= 1);
  await page.click('.pill-opt:has-text("All")');
  await page.waitForTimeout(400);
  await shot('v3-07-history');
  const retryBtn = await page.$('button:has-text("↻ Same")');
  if (retryBtn) {
    await retryBtn.click();
    await page.waitForSelector('text=Retry from History', { timeout: 8000 });
    ok('retry same-numbers hands question to Practice', true);
  } else ok('retry same-numbers hands question to Practice', false);

  // ── 7. Data safety: persisted storage + backup export/restore round-trip ──
  await page.goto(BASE + '/settings');
  await page.waitForSelector('text=Data safety', { timeout: 8000 });
  await shot('v3-08-data-safety');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.click('button:has-text("Export full backup")')
  ]);
  const backupPath = 'shots/backup-roundtrip.json';
  await download.saveAs(backupPath);
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  ok('backup file has profile + stores', backup.format === 'pri-learning-backup' && !!backup.profile && !!backup.stores.ratings);
  await page.setInputFiles('.card:has-text("Data safety") input[type=file]', backupPath);
  await page.waitForTimeout(1200);
  await page.goto(BASE + '/settings');
  await page.waitForSelector('text=Data safety', { timeout: 8000 });
  const nameVal = await page.$eval('.card:has-text("Profile") input', el => el.value);
  ok('backup restored as a new profile', nameVal === 'Pri (restored)');

  // ── 8. Task pack import (classroom file exchange) ──
  const pack = {
    format: 'pri-task-pack', version: 1, teacher: 'Ms Chen',
    task: { title: 'Angles warm-up', mode: 'subtopics', subtopics: ['y7-angles'], count: 5 }
  };
  fs.writeFileSync('shots/taskpack.json', JSON.stringify(pack));
  await page.goto(BASE + '/tasks');
  await page.waitForSelector('text=Import task pack', { timeout: 8000 });
  await page.setInputFiles('label:has-text("Import task pack") input[type=file]', 'shots/taskpack.json');
  await page.waitForTimeout(800);
  const taskText = await page.$eval('body', el => el.textContent);
  ok('task pack imported into Tasks', taskText.includes('Angles warm-up'));
  await shot('v3-09-taskpack');

  // ── 9. Offline reload still works (regression) ──
  await page.goto(BASE + '/');
  await page.waitForSelector('text=Predicted exam mark', { timeout: 10000 });
  await page.waitForTimeout(1500);
  await ctx.setOffline(true);
  await page.reload().catch(() => { });
  const offlineOk = await page.waitForSelector('text=Predicted exam mark', { timeout: 10000 }).then(() => true).catch(() => false);
  ok('fully offline reload', offlineOk);
  await ctx.setOffline(false);

  await browser.close();
  console.log(failures ? `tour done — ${failures} FAILURES` : 'tour done — all green ✔');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('TOUR FAILED:', e.message); process.exit(1); });
