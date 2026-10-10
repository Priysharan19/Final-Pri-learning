// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · which way up a photographed page is (issue #430)
//
//   node client/test/photo-orientation-check.mjs [--browser=chromium|webkit]
//
// The owner's page was photographed sideways. Two different things make a
// photo sideways, and they need different answers:
//
//   A · The camera was turned and SAYS so (EXIF orientation). The browser
//       applies that when it decodes the file, so what Photo mode draws,
//       re-encodes and sends (client/src/ink/photoRaster.js preparePhoto) is
//       already upright. Checked here for every quarter turn, in a real
//       browser engine, with the tag written into a real JPEG.
//   B · The page itself was sideways and the file says nothing. No code can
//       know; the pixels are sent as they are, and the student turns the page
//       with the app's own control (rotatePhoto), always from the original.
//
// The page is SIMULATED (tools/acceptance/real-photo-support.mjs simulatedPage:
// text in a hand-like face on ruled paper). This suite compares pixels. It
// reads nothing: whether a reader copes with a sideways page is a property of
// the reader, measured only with a real photo against the real provider.
// ─────────────────────────────────────────────────────────────────────────────
import { openStudio, withExifOrientation } from '../../tools/acceptance/real-photo-support.mjs';

const engine = (process.argv.find(a => a.startsWith('--browser=')) || '--browser=chromium').split('=')[1];
let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const PAGE = ['a = 9, d = 3', 'T_n = a + (n - 1)d', 'T_9 = 9 + 8 × 3', '', '    = 9 + 24', '    = 35'];
// Measured on this page in Chromium and WebKit: the same picture re-encoded is
// about 0.1 grey levels unlike itself; turned a quarter or half turn it is 2.5–4.
const NOISE = 1;          // JPEG re-encoding and resampling of the same picture
const TURNED = 2;         // the same page turned round is at least this unlike

/** The EXIF orientation a JPEG states (1–8), or null when it states none. */
function statedOrientation(dataUrl) {
  const b = Buffer.from(dataUrl.split(',')[1], 'base64');
  const at = b.indexOf(Buffer.from('Exif\0\0', 'latin1'));
  if (at < 0 || at > 4096) return null;
  const tiff = at + 6, little = b.toString('latin1', tiff, tiff + 2) === 'II';
  const u16 = o => (little ? b.readUInt16LE(o) : b.readUInt16BE(o));
  const u32 = o => (little ? b.readUInt32LE(o) : b.readUInt32BE(o));
  const ifd = tiff + u32(tiff + 4);
  for (let i = 0, n = u16(ifd); i < n; i += 1) if (u16(ifd + 2 + i * 12) === 0x0112) return u16(ifd + 2 + i * 12 + 8);
  return null;
}

const studio = await openStudio({ engine });
try {
  const upright = await studio.simulatedPage({ lines: PAGE, seed: 430, degrees: 0 });
  const size = await studio.sizeOf(upright);
  ok(size.width === 1200 && size.height === 1500, `the simulated page is portrait (${size.width}×${size.height})`);
  const sent = await studio.preparePhoto(upright);
  ok(sent && sent.height > sent.width, 'and Photo mode sends it portrait');
  ok(await studio.unlikeness(upright, sent.dataUrl) < NOISE, 'unchanged but for re-encoding');

  // A · the file says which way up it is. Stored a quarter turn clockwise, a
  // camera tags it 8 (turn it back); half a turn, 3; three quarters, 6.
  for (const [turns, tag] of [[1, 8], [2, 3], [3, 6]]) {
    const stored = await studio.simulatedPage({ lines: PAGE, seed: 430, degrees: 0, quarterTurns: turns });
    const raw = await studio.sizeOf(stored);
    ok(turns % 2 ? raw.width > raw.height : raw.height > raw.width, `stored ${turns} quarter turn(s) round, the pixels are ${turns % 2 ? 'landscape' : 'portrait'}`);
    ok(await studio.unlikeness(upright, stored) > TURNED, `and unlike the upright page (${turns} turn(s))`);
    const tagged = withExifOrientation(stored, tag);
    const decoded = await studio.sizeOf(tagged);
    ok(decoded.height > decoded.width, `EXIF orientation ${tag}: the browser decodes it portrait`);
    const prepared = await studio.preparePhoto(tagged);
    ok(prepared && prepared.height > prepared.width, `EXIF orientation ${tag}: Photo mode sends it portrait`);
    const off = await studio.unlikeness(upright, prepared.dataUrl);
    ok(off < NOISE, `EXIF orientation ${tag}: what is sent is the upright page (unlikeness ${off.toFixed(1)})`);
    ok(statedOrientation(tagged) === tag, `EXIF orientation ${tag}: the camera file states it`);
    ok([null, 1].includes(statedOrientation(prepared.dataUrl)), `EXIF orientation ${tag}: and what is sent states none, so it cannot be turned a second time`);

    // B · the file says nothing: sent as it is, and turned by the student.
    const untagged = await studio.preparePhoto(stored);
    ok(await studio.unlikeness(upright, untagged.dataUrl) > TURNED, `untagged and ${turns} turn(s) round: it is sent as photographed, not guessed at`);
    const turnedBack = await studio.rotatePhoto(stored, 4 - turns);
    ok(turnedBack && turnedBack.height > turnedBack.width, `the student's ${4 - turns} quarter turn(s) make it portrait`);
    const back = await studio.unlikeness(upright, turnedBack.dataUrl);
    ok(back < NOISE, `and it is the upright page again (unlikeness ${back.toFixed(1)})`);
    ok((await studio.preparePhoto(turnedBack.dataUrl)).height > (await studio.preparePhoto(turnedBack.dataUrl)).width, 'which Photo mode then sends portrait');
  }

  // Turning is always from the original: four presses are the original itself,
  // and any number of presses re-encode the picture once.
  const four = await studio.rotatePhoto(upright, 4);
  ok(four.dataUrl === upright, 'four quarter turns return the original bytes, untouched');
  const once = await studio.rotatePhoto(upright, 1);
  const five = await studio.rotatePhoto(upright, 5);
  ok(once.dataUrl === five.dataUrl, 'five turns from the original are one turn from the original — never a copy of a copy');
  ok(once.width === 1500 && once.height === 1200, 'a quarter turn swaps the sides and loses no pixel');
  const round = await studio.rotatePhoto(once.dataUrl, 3);
  ok(await studio.unlikeness(upright, round.dataUrl) < NOISE, 'and a turn then three more is the page as it was');
  ok((await studio.rotatePhoto('data:text/plain;base64,AAAA', 1)) === null, 'something that is not a photo is refused, not turned');
  ok((await studio.rotatePhoto(upright, -1)).dataUrl === (await studio.rotatePhoto(upright, 3)).dataUrl, 'a turn back is three turns on');
} finally {
  await studio.close();
}

console.log(failures.length
  ? `PHOTO ORIENTATION (${engine}): FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `PHOTO ORIENTATION (${engine}): PASS — ${pass}/${pass} checks — a camera file that states its orientation is sent upright; a page photographed sideways is sent as it is and turned by the student from the original. Simulated page, pixels only: no reading is measured.`);
process.exit(failures.length ? 1 : 0);
