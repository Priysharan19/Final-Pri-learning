// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — D17: the student says yes before anything is read,
// on a phone with a finger and on a tablet.
//
// Owner default D17 (docs/release/V1_DECISIONS_2026-11-01.md): a one-time
// prompt naming OpenAI appears before the first handwriting read or photo.
// Nothing leaves the device until the student accepts, and declining keeps
// them on typed answers. §22.2 asks for the answer path to hold on every
// device class: finger or stylus handwriting, or a camera photo, then an
// explicit transcript the student corrects or confirms, then a
// server-authoritative grade on that same revision, then History.
//
//   PHONE (390 × 844, finger through Chromium's touch input):
//     first "Read my answer" → the prompt, as a bottom sheet, naming OpenAI;
//     nothing sent → "No, I'll type" → nothing sent, told why, no Read button,
//     Settings says reading is off → the same question typed and marked by
//     the server.
//   TABLET (834 × 1194):
//     reading turned on again in Settings → asked again → Escape chooses
//     nothing and sends nothing → asked again → accept → ONE read → a doubtful
//     line the student corrects → submitted → the server marks it, and the
//     picture it marked is the picture that was read (same revision) → the
//     next question is read with no prompt (one-time) → History.
//   PHONE, second student (photo, offline ink):
//     the first photo of working → the prompt names a photo; nothing sent →
//     accept → the photo is read into an editable transcript. Then ink written
//     offline is kept and the student is told it will be read when they are
//     back online; nothing is sent until they are and they press Read.
//
// Synthetic evidence: Chromium, a stand-in reader at the provider hop
// (support/online-session.mjs) that returns the lines this flow scripts and
// never looks at the picture, touch events from the browser's own input
// pipeline. The server, its database, sign-in, every read request, every mark
// and History are real. Not real-device, real-finger, real-Pencil,
// real-provider or real-student evidence.
//
// Run on its own:  node client/test/tour-ink-reader-permission.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { readLines, turnOnServerReading } from './fakeServerReader.js';
import { TEMPLATES } from '../src/ink/templates.js';
import EN from '../src/i18n/strings.en.js';

const TOPIC = 'y7-equations';
const WHOLE = /^\d{1,3}$/;
const TAG = '[SYNTHETIC-READER EVIDENCE]';
const PHONE = { width: 390, height: 844 };
const TABLET = { width: 834, height: 1194 };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const flat = s => String(s || '').replace(/\s+/g, ' ').trim();
const SHEET = '[data-reader-permission-sheet]';
const READS = /^\/v1\/(?:handwriting\/transcribe|practice\/[^/]+\/recognize)$/;

/**
 * Write digits with a FINGER: Chromium's own touch input (CDP
 * Input.dispatchTouchEvent), which reaches the page as pointer events with
 * pointerType "touch" — the path a phone takes. Falls back to the mouse where
 * the engine has no CDP (said in a note by the caller).
 */
async function fingerWrite(page, box, text, { x = 40, y = 34 } = {}) {
  let cdp = null;
  try { cdp = await page.context().newCDPSession(page); } catch { cdp = null; }
  let ox = box.x + x;
  for (const ch of text) {
    for (const stroke of TEMPLATES[ch]?.[0] || []) {
      const pts = stroke.map(([px, py]) => ({ x: ox + (px / 100) * 46, y: box.y + y + (py / 100) * 66 }));
      if (cdp) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0].x, y: pts[0].y, radiusX: 4, radiusY: 4, force: 0.5 }] });
        for (const p of pts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y, radiusX: 4, radiusY: 4, force: 0.5 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.mouse.move(pts[0].x, pts[0].y); await page.mouse.down();
        for (const p of pts) await page.mouse.move(p.x, p.y);
        await page.mouse.up();
      }
    }
    ox += 54;
  }
  await page.waitForTimeout(500);
  return cdp ? 'touch' : 'mouse';
}

/** Write digits with the mouse (the tablet stand-in for a stylus). */
async function penWrite(page, box, text, { x = 40, y = 34 } = {}) {
  let ox = box.x + x;
  for (const ch of text) {
    for (const stroke of TEMPLATES[ch]?.[0] || []) {
      const pts = stroke.map(([px, py]) => [ox + (px / 100) * 58, box.y + y + (py / 100) * 84]);
      await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down();
      for (const [px, py] of pts) await page.mouse.move(px, py);
      await page.mouse.up();
    }
    ox += 66;
  }
  await page.waitForTimeout(500);
}

export const flow = {
  id: 'ink-reader-permission',
  name: 'D17 · asked once before anything is read — phone finger, tablet, decline, accept, same-revision grade',
  online: true,
  // This flow is about the prompt: it is answered by hand, never on sight.
  readerPermission: 'ask',

  async run({ page, base, check, note, goto, createProfile, settle, online, browserName }) {
    const reader = online.reader;
    Object.assign(reader, { text: '1', lines: null, confidence: 0.97, down: false, gate: null });
    note(`${TAG} "${flow.name}" [${browserName || 'chromium'}]: a scripted stand-in reader, a simulated phone and tablet viewport, touch events from the browser's input pipeline. The server, sign-in, every read request, every mark and History are real. Not device, finger, Pencil, provider or student evidence.`);
    const card = page.locator('.qpage').first();
    const quiet = () => page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    const readsSent = async () => (await online.practiceCalls(READS)).length;
    const gradesOf = async id => online.practiceCalls(new RegExp(`^/v1/practice/${id}/submit$`));
    const statusText = async () => flat(await page.locator('.ink-answer .ink-status-line').first().textContent({ timeout: 2000 }).catch(() => ''));
    const sheetOpen = () => page.locator(SHEET).isVisible().catch(() => false);
    const recordOf = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('pri-reader-permission-v1') || '{}'); } catch { return null; } });
    const openFresh = async ({ topic = TOPIC, tries = 8, mode = 'write' } = {}) => {
      await quiet();
      await page.goto(`${base}/practice?subtopic=${topic}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.q-prompt', { timeout: 30000 });
      await settle();
      for (let moved = 0; moved < tries; moved++) {
        const row = await online.shownRow();
        const tried = row?.serverQuestionId ? await gradesOf(row.serverQuestionId) : [];
        const right = tried.length ? null : await online.answerOf().catch(() => null);
        if (right && right.answerType === 'numeric' && WHOLE.test(String(right.text))) {
          if (mode === 'write') {
            const tab = page.getByRole('button', { name: 'Answer by handwriting' });
            if (await tab.count()) await tab.click();
            await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
            await page.locator('.ink-canvas-live').scrollIntoViewIfNeeded().catch(() => {});
            return { right, row, box: await page.locator('.ink-canvas-live').boundingBox() };
          }
          return { right, row };
        }
        const leaving = await card.getAttribute('data-question-id');
        await page.locator('.ctx-next').click();
        await page.waitForFunction(id => {
          const el = document.querySelector('.qpage[data-question-id]');
          return el && el.getAttribute('data-question-id') !== id && el.querySelector('.q-prompt');
        }, leaving, { timeout: 30000 });
        await settle();
      }
      return null;
    };
    const submitNow = async () => {
      const ask = page.getByRole('button', { name: 'Check this reading first' });
      if (await ask.count()) {
        await ask.click();
        await page.getByRole('button', { name: 'Confirm reading' }).click();
        return 'confirmed';
      }
      await page.getByRole('button', { name: 'Submit Answer' }).click();
      return 'submitted';
    };

    // ══ PHONE · a finger, the first read, and "No, I'll type" ═══════════════
    await page.setViewportSize(PHONE);
    await goto('/');
    await createProfile({ name: 'Anaya Finger', year: 9 });
    await online.signIn({ name: 'Anaya Finger' });
    await quiet();
    const first = await openFresh();
    if (!await check('phone: a numeric handwriting question is on the card', !!first)) return;
    const input = await fingerWrite(page, first.box, String(first.right.text));
    if (input !== 'touch') note('NOT VERIFIED: this engine has no touch input pipeline here; the phone strokes were drawn with the mouse.');
    const readsBefore = await readsSent();
    const providerBefore = reader.requests.length;
    await page.locator('[data-ink-read]').first().tap().catch(() => page.locator('[data-ink-read]').first().click());
    const asked = await page.locator(SHEET).waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false);
    await check('phone: the first "Read my answer" opens the prompt before anything else happens', asked);
    if (!asked) return;
    await page.waitForTimeout(800);
    const geometry = await page.evaluate(() => {
      const sheet = document.querySelector('.reader-permission').getBoundingClientRect();
      const buttons = [...document.querySelectorAll('.reader-permission [data-reader-permission]')].map(b => { const r = b.getBoundingClientRect(); return { which: b.dataset.readerPermission, w: Math.round(r.width), h: Math.round(r.height) }; });
      return { left: Math.round(sheet.left), right: Math.round(sheet.right), bottom: Math.round(sheet.bottom), vw: innerWidth, vh: innerHeight,
        scroll: document.documentElement.scrollWidth, focusInside: !!document.activeElement?.closest?.('.reader-permission'), buttons,
        dialog: document.querySelector('.reader-permission').getAttribute('role'), modal: document.querySelector('.reader-permission').getAttribute('aria-modal') };
    });
    const sheetText = flat(await page.locator('.reader-permission').textContent());
    await check(`phone: nothing was read or sent while the prompt is open — 0 read requests, 0 provider calls ${TAG}`,
      await readsSent() === readsBefore && reader.requests.length === providerBefore, `reads ${await readsSent() - readsBefore}, provider ${reader.requests.length - providerBefore}`);
    await check('phone: the page does not say "Reading…" behind the prompt', !(await statusText()).includes(flat(EN['ink.serverReading'])), await statusText());
    await check('phone: the prompt names OpenAI and says nothing is sent until the student chooses, and that typing is the alternative',
      sheetText.includes('OpenAI') && sheetText.includes(flat(EN['readerPermission.leadInk'])) && sheetText.includes(flat(EN['readerPermission.choice'])), sheetText.slice(0, 200));
    await check('phone: it is a modal dialog, and keyboard focus is inside it', geometry.dialog === 'dialog' && geometry.modal === 'true' && geometry.focusInside, JSON.stringify(geometry));
    await check('phone: it is a bottom sheet across the whole width, with no sideways scroll',
      geometry.left === 0 && geometry.right === geometry.vw && Math.abs(geometry.bottom - geometry.vh) <= 1 && geometry.scroll <= geometry.vw, JSON.stringify(geometry));
    const accept = geometry.buttons.find(b => b.which === 'accept');
    const decline = geometry.buttons.find(b => b.which === 'decline');
    await check('phone: "Send it to be read" and "No, I\'ll type" are each full-width finger targets at least 44 px tall',
      !!accept && !!decline && accept.h >= 44 && decline.h >= 44 && accept.w >= geometry.vw - 40 && decline.w >= geometry.vw - 40, JSON.stringify(geometry.buttons));

    await page.locator('[data-reader-permission="decline"]').tap().catch(() => page.locator('[data-reader-permission="decline"]').click());
    await page.locator(SHEET).waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const said = await statusText();
    await check(`phone, declined: still nothing read or sent ${TAG}`, await readsSent() === readsBefore && reader.requests.length === providerBefore,
      `reads ${await readsSent() - readsBefore}, provider ${reader.requests.length - providerBefore}`);
    await check('phone, declined: the student is told no one read it, why, and that typing (or Settings) is the way on',
      said === flat(EN['ink.waitingDeclined']) || said === flat(EN['ink.waitingTurnedOff']), said);
    await check('phone, declined: "Read my answer" is no longer offered', await page.locator('[data-ink-read]').count() === 0);
    const declined = await recordOf();
    await check('phone, declined: the decline is recorded on this device for this profile and this wording',
      Object.values(declined || {}).some(r => r.choice === 'declined' && r.version === 1), JSON.stringify(declined));

    // The same question, typed: declining keeps the student on typed answers.
    await page.getByRole('button', { name: EN['verdict.modeTypeLabel'] }).click();
    const box = page.locator('.editor-body input.answer-input');
    await box.waitFor({ timeout: 15000 });
    await box.fill(String(first.right.text));
    await submitNow();
    await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
    const typed = (await gradesOf(first.right.serverQuestionId)).at(-1);
    await check('phone, declined: the answer typed instead is marked by the server, correct, with no picture and no reading',
      typed?.json?.authoritative === true && typed.json.correct === true && typed.body?.answer === String(first.right.text) && !typed.body?.image && !typed.body?.transcriptionReceipt,
      JSON.stringify({ correct: typed?.json?.correct, authoritative: typed?.json?.authoritative, image: !!typed?.body?.image }));
    await check(`phone, declined: from the first stroke to the mark, the reader was never sent anything ${TAG}`, reader.requests.length === providerBefore);
    await quiet();
    await page.goto(`${base}/settings`, { waitUntil: 'domcontentloaded' });
    const tab = page.getByRole('button', { name: 'Handwriting' }).or(page.getByRole('tab', { name: 'Handwriting' })).first();
    await tab.click().catch(() => {});
    const toggle = page.locator('.set-row', { hasText: EN['settings.cloudHandwritingLabel'] }).locator('button');
    await toggle.waitFor({ timeout: 30000 }).catch(() => {});
    for (let i = 0; i < 40 && await toggle.isDisabled().catch(() => true); i++) await page.waitForTimeout(250);
    await check('phone, declined: Settings → Handwriting says server reading is off — the way back is there',
      await toggle.getAttribute('aria-pressed') === 'false', await toggle.getAttribute('aria-pressed'));

    // ══ TABLET · turned on again, asked again, closed, accepted, corrected ══
    await page.setViewportSize(TABLET);
    await check('tablet: the student turns server reading on again in Settings', await turnOnServerReading(page, base));
    const second = await openFresh();
    if (!await check('tablet: a numeric handwriting question is on the card', !!second)) return;
    online.forgetKeptReads();
    const wrong = `${second.right.text}7`;
    Object.assign(reader, { lines: [{ text: wrong }], confidence: 0.55 });
    await penWrite(page, second.box, String(second.right.text));
    const tabletBefore = await readsSent();
    await page.locator('[data-ink-read]').first().click();
    await check('tablet: a student who said no before is asked again before the next read (turning reading on is not consent)',
      await page.locator(SHEET).waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false));
    const dialogBox = await page.locator('.reader-permission').boundingBox();
    await check('tablet: on a tablet the prompt is a dialog in the middle of the screen, not a bottom sheet',
      !!dialogBox && dialogBox.width < TABLET.width - 100 && dialogBox.y > 40 && dialogBox.y + dialogBox.height < TABLET.height - 40, JSON.stringify(dialogBox));
    await page.keyboard.press('Escape');
    await page.locator(SHEET).waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await check(`tablet: Escape closes it without choosing — nothing sent, "Read my answer" still there, the record unchanged ${TAG}`,
      await readsSent() === tabletBefore && await page.locator('[data-ink-read]').count() === 1 && Object.values(await recordOf() || {}).some(r => r.choice === 'declined'),
      `reads ${await readsSent() - tabletBefore}; read button ${await page.locator('[data-ink-read]').count()}`);
    await page.locator('[data-ink-read]').first().click();
    await page.locator(SHEET).waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-reader-permission="accept"]').click();
    await page.waitForFunction(want => [...document.querySelectorAll('.ink-line')].some(n => n.getAttribute('data-text') === want), wrong, { timeout: 30000 }).catch(() => {});
    const readCalls = (await online.practiceCalls(READS)).slice(tabletBefore);
    await check(`tablet, accepted: exactly one read is sent, and it is the press that opened the prompt ${TAG}`, readCalls.length === 1, `${readCalls.length} read request(s)`);
    await check('tablet, accepted: the transcript is on the page, its doubtful line marked and editable — nothing is marked yet',
      JSON.stringify(await readLines(page)) === JSON.stringify([wrong]) && await page.locator('.ink-line.ink-line-low .ink-correct-btn').count() === 1 &&
        await page.locator('.eval-card').count() === 0, JSON.stringify(await readLines(page)));
    await page.locator('.ink-line .ink-correct-btn').first().click();
    await page.locator('.ink-line form.ink-correct input').fill(String(second.right.text));
    await page.locator('.ink-line form.ink-correct button[type=submit]').click();
    await page.waitForSelector('.ink-line[data-corrected="true"]', { timeout: 10000 }).catch(() => {});
    await check('tablet: the student corrects the line to what they wrote', JSON.stringify(await readLines(page)) === JSON.stringify([String(second.right.text)]), JSON.stringify(await readLines(page)));
    let how = await submitNow();
    if (await page.locator('.eval-card').count() === 0) how += `+${await submitNow().catch(() => 'none')}`;
    await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
    const inked = (await gradesOf(second.right.serverQuestionId)).at(-1);
    const read = readCalls[0];
    await check('tablet: the server marks the corrected, confirmed reading — correct, authoritative',
      inked?.json?.authoritative === true && inked.json.correct === true && inked.body?.answer === String(second.right.text),
      JSON.stringify({ how, answer: inked?.body?.answer, correct: inked?.json?.correct }));
    const sameRevision = inked?.body?.image ? inked.body.image === read?.body?.image : !!inked?.body?.transcriptionReceipt;
    await check('tablet: the grade is of the SAME revision that was read — the picture submitted is byte-for-byte the picture read (or its read receipt)',
      sameRevision, `submitted ${inked?.body?.image ? 'a picture' : inked?.body?.transcriptionReceipt ? 'a receipt' : 'neither'}`);

    const third = await openFresh();
    if (await check('tablet: a third handwriting question is on the card', !!third)) {
      online.forgetKeptReads();
      Object.assign(reader, { lines: null, text: String(third.right.text), confidence: 0.97 });
      await penWrite(page, third.box, String(third.right.text));
      const before = await readsSent();
      await page.locator('[data-ink-read]').first().click();
      await page.waitForFunction(() => document.querySelectorAll('.ink-line').length > 0, null, { timeout: 30000 }).catch(() => {});
      await check(`tablet: once accepted, the next read goes ahead with no prompt — it is one-time ${TAG}`,
        await page.locator(SHEET).count() === 0 && await readsSent() === before + 1, `reads ${await readsSent() - before}`);
    }
    await quiet();
    await page.goto(`${base}/history`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hist-row', { timeout: 30000 }).catch(() => {});
    const ids = await page.locator('.hist-row').evaluateAll(rows => rows.map(r => r.getAttribute('data-question-id')));
    await check('History holds the typed answer from the phone and the handwritten one from the tablet',
      ids.includes(String(first.row?.id)) && ids.includes(String(second.row?.id)), JSON.stringify({ want: [first.row?.id, second.row?.id], ids: ids.slice(0, 8) }));
    Object.assign(reader, { lines: null, text: '1', confidence: 0.97 });
  }
};

export const photoAndOffline = {
  id: 'ink-reader-permission-photo-offline',
  name: 'D17 · a photo is asked about first; ink written offline is kept and read on return',
  online: true,
  readerPermission: 'ask',

  async run({ page, ctx, base, check, note, goto, createProfile, settle, online, browserName }) {
    const reader = online.reader;
    note(`${TAG} "${photoAndOffline.name}" [${browserName || 'chromium'}]: a 1×1 test image, a scripted stand-in reader and the browser's offline switch on a phone viewport. Not device, camera, provider or student evidence.`);
    const quiet = () => page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    const readsSent = async () => (await online.practiceCalls(READS)).length;
    await page.setViewportSize(PHONE);
    await goto('/');
    await createProfile({ name: 'Kabir Photo', year: 10 });
    await online.signIn({ name: 'Kabir Photo' });
    await quiet();
    await page.goto(`${base}/practice?subtopic=${TOPIC}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await settle();
    online.forgetKeptReads();
    Object.assign(reader, { lines: null, text: 'x = 4', confidence: 0.9 });
    await page.getByRole('button', { name: /answer with a photo/i }).click();
    await page.locator('.editor-body input[type="file"]').setInputFiles({ name: 'page.png', mimeType: 'image/png', buffer: PNG });
    const readMine = page.locator('[data-photo-read]');
    await readMine.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    const before = await readsSent();
    const provider = reader.requests.length;
    await readMine.click();
    const asked = await page.locator('[data-reader-permission-sheet="photo"]').waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false);
    await check('photo: the first "Read my photo" opens the prompt, about a photo', asked);
    await page.waitForTimeout(800);
    await check(`photo: nothing is sent while it is open ${TAG}`, await readsSent() === before && reader.requests.length === provider);
    await check('photo: the prompt names OpenAI and tells the student to keep their name out of the frame',
      flat(await page.locator('.reader-permission').textContent()).includes(flat(EN['readerPermission.leadPhoto'])) &&
        flat(await page.locator('.reader-permission').textContent()).includes(flat(EN['readerPermission.what'])));
    await page.locator('[data-reader-permission="accept"]').tap().catch(() => page.locator('[data-reader-permission="accept"]').click());
    // The reading lands as editable lines (inputs): the student checks each one.
    const editable = () => page.locator('.qpage input').evaluateAll(nodes => nodes.filter(n => n.type === 'text' || n.type === '').map(n => n.value));
    await page.waitForFunction(() => [...document.querySelectorAll('.qpage input')].some(n => n.value === 'x = 4'), null, { timeout: 30000 }).catch(() => {});
    await check(`photo, accepted: the photo is sent once and read into the editable transcript ${TAG}`,
      await readsSent() === before + 1 && reader.requests.length === provider + 1 && (await editable()).includes('x = 4'),
      `reads ${await readsSent() - before}, provider ${reader.requests.length - provider}, lines ${JSON.stringify(await editable())}`);

    // Offline: ink is kept on the device and the student is told it will be read when they are back.
    await quiet();
    await page.goto(`${base}/practice?subtopic=${TOPIC}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await settle();
    const write = page.getByRole('button', { name: 'Answer by handwriting' });
    if (await write.count()) await write.click();
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    await page.locator('.ink-canvas-live').scrollIntoViewIfNeeded().catch(() => {});
    await ctx.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await fingerWrite(page, await page.locator('.ink-canvas-live').boundingBox(), '12');
    await page.waitForTimeout(1200);
    const offlineSaid = flat(await page.locator('.ink-answer .ink-status-line').first().textContent({ timeout: 4000 }).catch(() => ''));
    const offlineBefore = await readsSent();
    await check('offline: the ink is kept, and the student is told it is saved and will be read when they are back online and press Read',
      offlineSaid === flat(EN['ink.waitingOffline']) || offlineSaid === flat(EN['ink.waitingOfflinePlain']), offlineSaid);
    await check('offline: "Read my answer" is not offered while it could not work', await page.locator('[data-ink-read]').count() === 0);
    await ctx.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    const back = await page.locator('[data-ink-read]').first().waitFor({ state: 'visible', timeout: 15000 }).then(() => true, () => false);
    await check(`back online: nothing was sent by itself; "Read my answer" is offered for the kept ink ${TAG}`, back && await readsSent() === offlineBefore);
    if (back) {
      online.forgetKeptReads();
      Object.assign(reader, { lines: null, text: '12', confidence: 0.97 });
      await page.locator('[data-ink-read]').first().tap().catch(() => page.locator('[data-ink-read]').first().click());
      await page.waitForFunction(() => document.querySelectorAll('.ink-line').length > 0, null, { timeout: 30000 }).catch(() => {});
      await check(`back online: the press reads the ink written offline, with no second prompt (already accepted) ${TAG}`,
        await page.locator(SHEET).count() === 0 && await readsSent() === offlineBefore + 1 && JSON.stringify(await readLines(page)) === '["12"]',
        JSON.stringify(await readLines(page)));
    }
    Object.assign(reader, { lines: null, text: '1', confidence: 0.97 });
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runFlows } = await import('./e2e.mjs');
  process.exit(await runFlows([flow, photoAndOffline]) ? 1 : 0);
}
