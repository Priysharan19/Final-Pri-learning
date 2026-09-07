// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · reading a photo of working done on paper
//
// Most maths is done on paper, so a photo of an exercise book is the input a
// student most often has. Two things must hold:
//
//   · the photo is re-encoded to fit the transport before it is sent, because a
//     phone hands back three megabytes and the body cap is one;
//   · it does NOT go to the same reader on the same opt-in. That opt-in covers
//     a raster of the student's strokes and nothing else, and a photographed
//     page can carry far more than that, so the cloud photo route fails closed
//     until a consent exists that actually describes it.
// ─────────────────────────────────────────────────────────────────────────────
import { MAX_PHOTO_BYTES, dataUrlBytes, isSupportedPhoto, photoDimensions, preparePhoto } from '../src/ink/photoRaster.js';
import { readPhotoWithCloud } from '../src/ink/cloudReader.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const there = () => true;
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

// ── 4 · The photo route is closed, and closed for a stated reason ───────────
//
// `cloudHandwriting` discloses one thing: an image rasterized from the
// student's own strokes — "never the question, never the answer, never your
// name". A photograph of a page is not that. It can carry a name, a school
// stamp, a date, the facing page, or somebody else's work, and none of that
// was disclosed to the guardian who agreed.
//
// So this route fails closed until there is a consent that describes it. These
// checks exist to make that boundary expensive to cross by accident: the point
// is not that the function returns a particular string, it is that NO transport
// call happens no matter how the caller is configured.

let called = 0;
let sent = null;
const spy = {
  transcribeHandwriting: async (image, opts) => { called += 1; sent = { image, opts }; return { transcription: { lines: [], text: '' } }; }
};
const prepare = async () => ({ dataUrl: 'data:image/jpeg;base64,AAAA', width: 100, height: 80, bytes: 3, quality: 0.85 });

// Consent off, consent on, no user at all, and a caller that forgot to pass a
// transport: every one of them must reach the network zero times.
for (const [label, user] of [
  ['with server reading off', { cloudHandwriting: false }],
  ['with server reading on', { cloudHandwriting: true }],
  ['with no profile at all', null]
]) {
  const outcome = await readPhotoWithCloud(PHOTO, { user, transport: spy, prepare, available: there });
  eq(outcome.reason, 'photo-consent-required', `a paper photo is refused ${label}`);
}
eq(called, 0, 'and the transport was never reached — not once, under any of them');
eq(sent, null, 'so no image left the device');

// The reason has to be its own value. 'disabled' means "you turned this off and
// may turn it on"; this is "the app has not asked for this yet", and a caller
// that cannot tell them apart will offer the student a setting that would not
// help.
const disabledReason = 'disabled';
ok((await readPhotoWithCloud(PHOTO, { user: { cloudHandwriting: false } })).reason !== disabledReason,
  'the refusal is not reported as the student having switched something off');

// QuestionCard treats any non-success as "use the local/native reader", so this
// must resolve rather than throw — a rejected promise there is a broken submit
// button, not a fallback.
let threw = false;
try { await readPhotoWithCloud(); } catch { threw = true; }
ok(!threw, 'calling it with nothing at all resolves rather than throwing');
ok(typeof (await readPhotoWithCloud()).reason === 'string', 'and always answers with a reason the caller can branch on');

console.log(failures.length
  ? `CLOUD PHOTO CLIENT: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `CLOUD PHOTO CLIENT: PASS — ${pass}/${pass} checks — paper working is scaled to fit, and the cloud photo route sends nothing until a consent describes it.`);
process.exit(failures.length ? 1 : 0);
