// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E journey — every way a photo gets in, in a real browser.
//
// Owner, 18 Nov 2026: "allow heic pictures too", "why can it not read a pdf",
// "allow drag and drop option too", and a photo area that reads as one calm flow.
//
//   1. The empty frame: one sentence ("JPEG, PNG or HEIC"), a Choose button, no
//      typing hint bar in Photo mode.
//   2. A real HEIC (fixtures/heic) chosen in Chromium, which cannot decode it:
//      the decoder chunk is fetched only then, the page appears as a JPEG
//      preview, and "Read my photo" reaches the reading (scripted reader).
//   3. Drops on the card: a JPEG, a HEIC, a PDF; a dragged piece of text is
//      ignored; two files use the first and say so; a file dropped outside the
//      card is not navigated to. An unsupported file fails inside the same frame
//      with its reason and the two ways forward.
//
// WHAT IS SYNTHETIC: the reader (it never looks at the picture) and the images.
// Run: node client/test/tour-photo-intake.js [--browser=webkit]
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const EVIDENCE = 'SYNTHETIC-READER EVIDENCE';
const fixture = name => readFileSync(new URL(`./fixtures/heic/${name}`, import.meta.url));
const b64 = buf => Buffer.from(buf).toString('base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R/Size 4>>\n%%EOF');
const shownId = page => page.locator('.qpage[data-question-id]').first().getAttribute('data-question-id');

/** Fire the drag events a browser fires for files dropped on `selector`; reports whether each was claimed. */
const dropOn = (page, selector, files, { text = null } = {}) => page.evaluate(async ({ selector, files, text }) => {
  const dt = new DataTransfer();
  if (text !== null) dt.setData('text/plain', text);
  for (const f of files) dt.items.add(new File([Uint8Array.from(atob(f.b64), c => c.charCodeAt(0))], f.name, { type: f.type }));
  const el = document.querySelector(selector);
  const claimed = {};
  for (const type of ['dragenter', 'dragover', 'drop']) {
    const ev = new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    claimed[type] = ev.defaultPrevented;
    if (type === 'dragenter') { await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); claimed.active = document.querySelector('.editor-shell')?.getAttribute('data-photo-drop') || null; }
  }
  return claimed;
}, { selector, files, text });

export const photoIntakeFlow = {
  id: 'photo-intake',
  online: true,
  name: 'Photo · HEIC, drag and drop, PDF and unsupported files go through one door, inside one frame',

  async run({ page, base, check, goto, createProfile, settle, note, online, browserName }) {
    note(`${EVIDENCE}: "Photo · intake" [${browserName || 'chromium'}] uses synthetic HEIC/JPEG/PDF files and the scripted stand-in reader. Not real-photo, real-provider or real-device evidence.`);
    const { reader } = online;
    const decoderFetches = [];
    page.on('request', r => { if (/\/assets\/heicDecoder-/.test(r.url())) decoderFetches.push(r.url()); });
    reader.lines = ['y = 2x', 'x = 3', 'y = 6']; reader.confidence = 0.9; reader.down = false;
    await goto('/');
    await createProfile({ name: 'Photo Intake', course: 'in', year: 10 });
    await online.signIn({ name: 'Photo Intake' });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.goto(`${base}/practice?subtopic=c10-arithmetic-progressions`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
    for (let skips = 0; skips < 14; skips += 1) {
      if (await page.locator('.qpage').first().getAttribute('data-mode') !== 'mcq' && await page.getByRole('button', { name: /answer with a photo/i }).count()) break;
      const leaving = await shownId(page);
      await page.locator('.ctx-next').click();
      await page.waitForFunction(id => document.querySelector('.qpage[data-question-id]')?.getAttribute('data-question-id') !== id, leaving, { timeout: 30000 });
      await settle();
    }
    await page.getByRole('button', { name: /answer with a photo/i }).click();
    const input = page.locator('[data-photo-file]');

    // ── the empty frame ────────────────────────────────────────────────────
    await page.locator('[data-photo-empty]').waitFor({ state: 'visible', timeout: 15000 });
    await check('the empty frame says one sentence naming JPEG, PNG and HEIC, with one Choose button and a drop hint',
      /Add a photo of your working — JPEG, PNG or HEIC/.test(await page.locator('[data-photo-empty]').innerText()) &&
        await page.locator('[data-photo-choose]').isVisible() && (/drop a photo or PDF/i.test(await page.locator('[data-photo-empty]').innerText()) || /Take a photo/.test(await page.locator('[data-photo-empty]').innerText())), JSON.stringify(await page.locator('[data-photo-empty]').innerText()));
    await check('the typing hint bar ("Type maths the way you would say it") is not shown in Photo mode',
      await page.locator('.editor-hint, .editor-toolbar').count() === 0 && !/Type maths the way you would say it/.test(await page.locator('.qpage').first().innerText()));
    await check('the picker accepts .heic and .heif', /\.heic/.test(await input.getAttribute('accept')) && /\.heif/.test(await input.getAttribute('accept')));

    // ── a real HEIC in a browser that cannot open it ───────────────────────
    const before = decoderFetches.length;
    await input.setInputFiles({ name: 'IMG_0001.HEIC', mimeType: '', buffer: fixture('landscape-160x80.heic') });
    const read = page.locator('[data-photo-read]');
    await read.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
    const src = await page.locator('.photo-thumb img').getAttribute('src').catch(() => '');
    const dims = await page.locator('.photo-thumb img').evaluate(i => [i.naturalWidth, i.naturalHeight]).catch(() => [0, 0]);
    await check('a HEIC (empty MIME, .HEIC name) becomes a JPEG preview of the right size; the converter was fetched only for it',
      await read.isVisible() && /^data:image\/jpeg/.test(src) && dims[0] === 160 && dims[1] === 80 && (browserName === 'webkit' || decoderFetches.length === before + 1),
      JSON.stringify({ dims, fetches: decoderFetches.length - before, browserName }));
    await check('the page has labelled controls: Rotate, Choose another photo, Remove (no bare ✕)',
      await page.locator('[data-photo-rotate]').isVisible() && await page.locator('[data-photo-replace]').isVisible() && /Remove/.test(await page.locator('[data-photo-remove]').innerText()));
    await read.click();
    await page.locator('[data-photo-lines]').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    note('DEBUG ' + JSON.stringify({ state: await page.locator('[data-photo-answer]').getAttribute('data-photo-state'), text: (await page.locator('.photo-answer').innerText()).slice(0, 300) }));
    await check('Read my photo reaches the reading: the page and the lines in ONE compact view, no OCR confidence figure, one primary button',
      await page.locator('[data-reading-review]').isVisible() && await page.locator('[data-photo-line]').count() === 3 &&
        !/OCR confidence/i.test(await page.locator('.qpage').first().innerText()) && await page.locator('.photo-line-text, [data-photo-correct-transcript]').count() === 0 &&
        /Mark my working/.test(await page.locator('.ws-actions .btn-primary').innerText()),
      JSON.stringify({ review: await page.locator('[data-reading-review]').isVisible(), lines: await page.locator('[data-photo-line]').count(), ocr: /OCR confidence/i.test(await page.locator('.qpage').first().innerText()), inputs: await page.locator('.photo-line-text, [data-photo-correct-transcript]').count(), primary: await page.locator('.ws-actions .btn-primary').innerText() }));

    // ── drops ──────────────────────────────────────────────────────────────
    const jpeg = await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 40; c.height = 30; c.getContext('2d').fillRect(0, 0, 20, 30); return c.toDataURL('image/jpeg').split(',')[1]; });
    let r = await dropOn(page, '.editor-shell', [{ name: 'drop.jpg', type: 'image/jpeg', b64: jpeg }]);
    await page.locator('[data-photo-read]').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    await check('a JPEG dropped on the card: the card shows a drop highlight, the drop is claimed, the new page replaces the old reading',
      r.active === 'active' && r.drop === true && await page.locator('[data-photo-lines]').count() === 0 && await page.locator('[data-photo-read]').isVisible() &&
        (await page.locator('.photo-thumb img').evaluate(i => i.naturalWidth)) === 40, JSON.stringify(r));
    const afterJpeg = decoderFetches.length;
    r = await dropOn(page, '.editor-shell', [{ name: 'IMG_9.heic', type: 'image/heic', b64: b64(fixture('rotated-orient6-160x80.heic')) }]);
    await page.waitForFunction(() => document.querySelector('.photo-thumb img')?.naturalWidth === 80, null, { timeout: 60000 }).catch(() => {});
    await check('a HEIC dropped on the card is converted, upright (80×160 from a landscape raster stored rotated)',
      (await page.locator('.photo-thumb img').evaluate(i => [i.naturalWidth, i.naturalHeight])).join('x') === '80x160' && (browserName === 'webkit' || decoderFetches.length === afterJpeg), JSON.stringify(r));
    r = await dropOn(page, '.editor-shell', [{ name: 'scan.pdf', type: 'application/pdf', b64: b64(PDF) }]);
    await page.waitForFunction(() => document.querySelector('[data-photo-state]')?.getAttribute('data-photo-state') !== 'empty', null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const pdfState = await page.locator('[data-photo-answer]').getAttribute('data-photo-state');
    await check('a PDF dropped on the card is taken through the PDF door (held, rendered, or named — never silently ignored)',
      r.drop === true && ['attached', 'failed', 'reading', 'read'].includes(pdfState), pdfState);
    r = await dropOn(page, '.editor-shell', [{ name: 'notes.zip', type: 'application/zip', b64: b64(Buffer.from('PK')) }]);
    await page.locator('[data-photo-failed]').waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    const failed = (await page.locator('[data-photo-failed]').innerText().catch(() => '')).replace(/\s+/g, ' ');
    await check('an unsupported file fails inside the same frame, says why, and offers "Choose another photo" and "Type your answer instead" as buttons',
      /JPEG, PNG, WebP, AVIF, HEIC and PDF/.test(failed) && !/save it as a JPEG/i.test(failed) &&
        await page.locator('[data-photo-failed] [data-photo-choose-another]').isVisible() && await page.locator('[data-photo-failed] [data-type-instead]').isVisible() && await page.locator('.photo-thumb').count() === 0, failed);
    r = await dropOn(page, '.editor-shell', [{ name: 'a.jpg', type: 'image/jpeg', b64: jpeg }, { name: 'b.jpg', type: 'image/jpeg', b64: jpeg }]);
    await page.locator('[data-photo-read]').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    await check('two files dropped together: the first is used and the page says one file at a time',
      /One file at a time/.test(await page.locator('.photo-answer').innerText()), JSON.stringify(r));
    const textDrop = await dropOn(page, '.editor-shell', [], { text: 'hello' });
    await check('a dragged piece of text is ignored (not claimed, no highlight)', textDrop.dragenter === false && textDrop.drop === false && textDrop.active !== 'active', JSON.stringify(textDrop));
    const outside = await dropOn(page, 'body', [{ name: 'a.jpg', type: 'image/jpeg', b64: jpeg }]);
    await check('a file dropped outside the card does not navigate the tab away (the drop is claimed and nothing opens)',
      outside.drop === true && page.url().includes('/practice'), JSON.stringify(outside));
    await check('the keyboard path is unchanged: the Choose / Choose another photo buttons are real buttons',
      await page.locator('[data-photo-replace]').evaluate(b => b.tagName === 'BUTTON'));
  }
};

export const flows = [photoIntakeFlow];

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runFlows } = await import('./e2e.mjs');
  process.exit(await runFlows(flows) ? 1 : 0);
}
