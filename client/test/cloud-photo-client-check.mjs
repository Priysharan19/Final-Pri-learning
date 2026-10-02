// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · reading a photo of working done on paper
//
// Most maths is done on paper, so a photo of an exercise book is the input a
// student most often has. Two things must hold:
//
//   · the photo is re-encoded to fit the transport before it is sent, because a
//     phone hands back three megabytes and the body cap is one;
//   · it goes to the same reader as the ink, on the same opt-in, and a failure
//     falls back rather than costing the student the reader on their device.
// ─────────────────────────────────────────────────────────────────────────────
import { MAX_PHOTO_BYTES, dataUrlBytes, isSupportedPhoto, photoDimensions, preparePhoto } from '../src/ink/photoRaster.js';
import { cloudReadingWanted, photoReadingBlockedKey, readPhotoWithCloud, takeCloudReadingNotice } from '../src/ink/cloudReader.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const there = () => true;
const ready = async () => ({ usable: true, available: true, state: 'ready', releaseSha: '3333333333333333333333333333333333333333' });
const PHOTO = 'data:image/jpeg;base64,' + 'A'.repeat(4000);

// ── 1 · What counts as a photo ───────────────────────────────────────────────
ok(isSupportedPhoto(PHOTO), 'a JPEG is a photo');
ok(isSupportedPhoto('data:image/heic;base64,AAAA'), 'and so is an iPhone HEIC');
ok(!isSupportedPhoto('https://example.test/page.jpg'), 'a URL is not');
ok(!isSupportedPhoto('data:application/pdf;base64,AAAA'), 'and a PDF is not something this path claims to read');

// ── 2 · A camera photo is scaled to something sane ───────────────────────────
eq(photoDimensions(4032, 3024), { width: 1800, height: 1350, scale: 1800 / 4032 }, 'a 12 MP landscape shot is scaled to an 1800px long edge');
eq(photoDimensions(3024, 4032).height, 1800, 'and a portrait one is scaled by its height');
eq(photoDimensions(900, 700), { width: 900, height: 700, scale: 1 }, 'a photo already small enough is left alone, never upscaled');

// ── 3 · It is re-encoded until it fits the transport ─────────────────────────
function fakeCanvas(bytesFor) {
  return (width, height) => ({
    width, height,
    getContext: () => ({
      fillStyle: '', fillRect: () => {}, drawImage: () => {}
    }),
    toDataURL: (type, quality) => 'data:image/jpeg;base64,' + 'A'.repeat(Math.ceil((bytesFor(width, quality) * 4) / 3))
  });
}
const loadImage = async () => ({ naturalWidth: 4032, naturalHeight: 3024 });

// A photo already smaller than the cap must not waste an attempt re-rendering
// its own size before it can shrink.
const sizes = [];
await preparePhoto(PHOTO, { loadImage: async () => ({ naturalWidth: 900, naturalHeight: 700 }), createCanvas: (w, h) => { sizes.push(w); return fakeCanvas(() => 2_000_000)(w, h); } });
ok(new Set(sizes).size === sizes.length, `a small photo shrinks on every attempt rather than rendering the same size twice (${sizes.join(', ')})`);

const easy = await preparePhoto(PHOTO, { loadImage, createCanvas: fakeCanvas(() => 200_000) });
ok(easy && easy.bytes <= MAX_PHOTO_BYTES, `an ordinary page fits at full quality (${easy?.bytes} bytes)`);
eq(easy.quality, 0.85, 'and is not degraded for no reason');
eq([easy.width, easy.height], [1800, 1350], 'at the scaled size');

// A dense, contrasty page: quality drops before size does, because a softer
// picture of the whole page beats a sharp picture of half of it.
const dense = await preparePhoto(PHOTO, { loadImage, createCanvas: fakeCanvas((w, q) => Math.round(1_400_000 * q)) });
ok(dense && dense.bytes <= MAX_PHOTO_BYTES, 'a dense page is re-encoded until it fits');
ok(dense.quality < 0.85, 'by lowering quality');
eq(dense.width, 1800, 'before giving up any of the page');

const huge = await preparePhoto(PHOTO, { loadImage, createCanvas: fakeCanvas((w) => w * 900) });
ok(huge && huge.bytes <= MAX_PHOTO_BYTES, 'and a photo that still will not fit is scaled down as well');
ok(huge.width < 1800, 'to a smaller page rather than being refused');

ok(await preparePhoto('not a photo', { loadImage, createCanvas: fakeCanvas(() => 1000) }) === null, 'something that is not an image is refused');
ok(await preparePhoto(PHOTO, { loadImage: async () => { throw new Error('corrupt'); }, createCanvas: fakeCanvas(() => 1000) }) === null,
  'and a photo that will not decode is refused rather than thrown');
eq(dataUrlBytes('data:image/jpeg;base64,' + 'A'.repeat(400)), 300, 'byte counting undoes base64 inflation');

// ── 4 · Same opt-in, same reader ─────────────────────────────────────────────
let sent = null;
const spy = {
  transcribeHandwriting: async (image, opts) => {
    sent = { image, opts };
    return { transcription: { lines: [{ text: '2x + 3 = 11', confidence: 0.9 }, { text: 'x = 4', confidence: 0.9 }], text: '2x + 3 = 11\nx = 4', confidence: 0.9, needsConfirmation: false, engine: 'cloud-test' } };
  }
};
const prepare = async () => ({ dataUrl: 'data:image/jpeg;base64,AAAA', width: 100, height: 80, bytes: 3, quality: 0.85 });

let called = 0;
const off = await readPhotoWithCloud(PHOTO, { user: { cloudHandwriting: false }, transport: { transcribeHandwriting: async () => { called += 1; } }, prepare, available: there });
eq(called, 0, 'a photo is not sent unless the student turned server reading on');
eq(off.reason, 'disabled', 'and the caller is told that is why, so it can fall back rather than report a failure');

const outcome = await readPhotoWithCloud(PHOTO, { user: { cloudHandwriting: true }, transport: spy, prepare, available: there, readiness: ready });
ok(sent?.image?.startsWith('data:image/'), 'with it on, the prepared photo is sent');
ok(sent.image !== PHOTO, 'and it is the re-encoded one, not the raw camera file');
eq(Object.keys(sent.opts || {}), ['signal'], 'nothing travels beside it but the cancel signal');
eq(outcome.transcription.text.split('\n').length, 2, 'every line of the page comes back, not just an answer');
ok(outcome.photo.bytes > 0, 'and the result reports what was actually sent');

const failing = { transcribeHandwriting: async () => { const e = new Error('down'); e.code = 'HANDWRITING_UNAVAILABLE'; throw e; } };
const failed = await readPhotoWithCloud(PHOTO, { user: { cloudHandwriting: true }, transport: failing, prepare, available: there, readiness: ready });
ok(failed?.error?.code === 'HANDWRITING_UNAVAILABLE', 'a refusal is reported so the caller can fall back to the on-device reader');
const undecodable = await readPhotoWithCloud(PHOTO, { user: { cloudHandwriting: true }, transport: spy, prepare: async () => null, available: there, readiness: ready });
eq(undecodable.reason, 'unreadable', 'a photo that could not be prepared is never sent, and says why — a HEIC on Android lands here');

// ── 5 · On by default for a signed-in account (ADR-0001 online-first) ───────
// A profile that never chose gets server reading once it is linked to a cloud
// account and the server says reading is usable. An explicit off always wins,
// an unlinked profile never sends, and a minor without a confirmed guardian is
// refused /v1/handwriting/status by requireGuardianConsent, so it stays off.
{
  const SECRET_ANSWER = 'x = 4';
  const linked = { cloudHandwriting: null, cloudLinked: true, expectedAnswer: SECRET_ANSWER, solution: 'subtract 3, divide by 2' };
  let calls = [];
  const recorder = {
    transcribeHandwriting: async (...args) => {
      calls.push(args);
      return { transcription: { lines: [{ text: '2x = 8', confidence: 0.9 }], text: '2x = 8', confidence: 0.9, needsConfirmation: false, engine: 'cloud-test' } };
    }
  };
  ok(cloudReadingWanted(linked), 'a signed-in profile that never chose wants server reading');
  ok(!cloudReadingWanted({ cloudHandwriting: null }), 'a profile with no cloud account does not');
  ok(!cloudReadingWanted({ cloudHandwriting: false, cloudLinked: true }), 'an explicit off is respected even when signed in');
  ok(!cloudReadingWanted({ cloudLinked: true, isDemo: true }), 'and the demo profile is never defaulted on');

  const read = await readPhotoWithCloud(PHOTO, { user: linked, transport: recorder, prepare, available: there, readiness: ready });
  eq(calls.length, 1, 'default-on: the photo is read without the student visiting Settings');
  eq(read.transcription.text, '2x = 8', 'and the reading comes back');
  eq(calls[0].length, 2, 'the request carries the image and the options, nothing else');
  eq(Object.keys(calls[0][1] || {}), ['signal'], 'the options are only the cancel signal');
  ok(!JSON.stringify(calls[0]).includes(SECRET_ANSWER) && !JSON.stringify(calls[0]).includes('subtract 3'),
    'answer-blind on the default path: no expected answer or solution travels with the photo');

  calls = [];
  const refused = async () => ({ usable: false, state: 'unavailable', lastFailureCode: 'GUARDIAN_CONSENT_PENDING', releaseSha: null });
  const minor = await readPhotoWithCloud(PHOTO, { user: { cloudLinked: true }, transport: recorder, prepare, available: there, readiness: refused });
  eq(calls.length, 0, 'a minor whose guardian has not confirmed is never sent by default');
  eq(photoReadingBlockedKey({ cloudLinked: true }, { outcome: minor, online: () => true, available: there }), 'verdict.photoReadingGuardian',
    'and is told a guardian has to confirm, not sent to Settings');

  await readPhotoWithCloud(PHOTO, { user: { cloudHandwriting: false, cloudLinked: true }, transport: recorder, prepare, available: there, readiness: ready });
  await readPhotoWithCloud(PHOTO, { user: { cloudHandwriting: null }, transport: recorder, prepare, available: there, readiness: ready });
  eq(calls.length, 0, 'an explicit off, or no account, sends nothing');
}

// ── 6 · When it cannot read, it says the real reason ─────────────────────────
{
  const on = () => true, off = () => false;
  eq(photoReadingBlockedKey({ cloudHandwriting: null }, { online: on, available: there }), 'verdict.photoReadingSignIn', 'not signed in → sign in');
  eq(photoReadingBlockedKey({ cloudLinked: true }, { online: off, available: there }), 'verdict.photoReadingOffline', 'offline → offline');
  eq(photoReadingBlockedKey({ cloudLinked: true }, { online: on, available: off }), 'verdict.photoReadingNotOnThisInstall', 'no server on this build → says so');
  eq(photoReadingBlockedKey({ cloudHandwriting: false, cloudLinked: true }, { online: on, available: there }), 'verdict.photoReadingTurnedOff',
    'only an explicit off points at Settings, because only there does Settings help');
  eq(photoReadingBlockedKey({ cloudLinked: true }, { online: on, available: there, outcome: { error: { code: 'EMAIL_UNVERIFIED' } } }), 'verdict.photoReadingVerifyEmail', 'unverified email → verify');
  eq(photoReadingBlockedKey({ cloudLinked: true }, { online: on, available: there, outcome: { error: { code: 'AUTH_REQUIRED' } } }), 'verdict.photoReadingSignIn', 'expired session → sign in');
  eq(photoReadingBlockedKey({ cloudLinked: true }, { online: on, available: there, outcome: { error: { code: 'HANDWRITING_UNAVAILABLE' } } }), 'verdict.photoReadingServiceDown', 'provider down → try later');
  const en = (await import('../src/i18n/strings.en.js')).default;
  const hi = (await import('../src/i18n/strings.hi.js')).default;
  for (const key of ['verdict.photoReadingTurnedOff', 'verdict.photoReadingNotOnThisInstall', 'verdict.photoReadingOffline', 'verdict.photoReadingSignIn',
    'verdict.photoReadingGuardian', 'verdict.photoReadingVerifyEmail', 'verdict.photoReadingServiceDown', 'verdict.photoReadOnServerNotice']) {
    ok(typeof en[key] === 'string' && typeof hi[key] === 'string', `${key} exists in every catalogue`);
    if (key !== 'verdict.photoReadingTurnedOff') ok(!/Settings/.test(en[key]) || key === 'verdict.photoReadOnServerNotice', `${key} does not send the student to Settings`);
  }
}

// ── 7 · The default is never silent: a one-time notice ──────────────────────
{
  const store = new Map();
  const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  ok(takeCloudReadingNotice({ cloudLinked: true }, storage), 'the first server-read photo under the default shows the notice');
  ok(!takeCloudReadingNotice({ cloudLinked: true }, storage), 'and only once');
  ok(!takeCloudReadingNotice({ cloudHandwriting: true }, { getItem: () => null, setItem: () => {} }), 'a student who chose it themselves is not told again');
}

console.log(failures.length
  ? `CLOUD PHOTO CLIENT: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `CLOUD PHOTO CLIENT: PASS — ${pass}/${pass} checks — paper working is scaled to fit, sent only on the same opt-in, and a failure falls back.`);
process.exit(failures.length ? 1 : 0);
