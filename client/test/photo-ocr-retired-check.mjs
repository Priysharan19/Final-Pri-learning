// The on-device photo reader is retired, on both sides of the bridge.
//
// Photos are read on the server (client/src/ink/cloudReader.js
// readPhotoWithCloud), answer-blind, when the student asks. The Apple Vision
// OCR bridge (PhotoOCR.swift, the priPhoto handler, client/src/native/photo.js
// and the legacy adapter) left the shipping target with the on-device ink
// readers (owner decision 2026-10-02, default D16 2026-11-01). This check
// replaces photo-ocr-bridge-check.mjs, which exercised that path, and pins its
// absence so it cannot come back unreviewed.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const at = rel => new URL(`../../${rel}`, import.meta.url);
const read = rel => readFileSync(at(rel), 'utf8');

for (const pkg of ['ios/PriLearning.swiftpm', 'ios/PriLearning 2.swiftpm']) {
  assert.ok(!existsSync(at(`${pkg}/PhotoOCR.swift`)), `${pkg} ships no PhotoOCR.swift`);
  const shell = read(`${pkg}/WebShell.swift`);
  assert.ok(!/priPhoto|PhotoOCR|__PRI_NATIVE_PHOTO__/.test(shell), `${pkg}/WebShell.swift registers no photo handler and injects no photo flag`);
  const host = read(`${pkg}/NativeHostBridge.swift`);
  assert.match(host, /"photo": \["versions": \[1\], "capture": true, "library": true, "ocr": false\]/, `${pkg} declares photo capture without on-device OCR`);
  for (const name of readdirSync(at(pkg))) {
    if (!name.endsWith('.swift')) continue;
    assert.ok(!/^import Vision$/m.test(read(`${pkg}/${name}`)), `${pkg}/${name} does not import Vision`);
  }
}

assert.ok(!existsSync(at('client/src/native/photo.js')), 'the web photo OCR module is gone');
const legacy = read('client/src/platform/native/legacyApple.js');
assert.ok(!/handler\('priPhoto'\)|__priPhotoReceive|photoPending/.test(legacy), 'the legacy adapter has no photo transport');
assert.match(legacy, /return \{ ink, billing, cloud, share \};/, 'the legacy adapter exports ink, billing, cloud and share only');
const index = read('client/src/platform/native/index.js');
assert.ok(!/recognize\(dataURL/.test(index), 'priNative.photo has no recognize op');
assert.match(index, /ocr: \(\) => capOf\('photo'\)\?\.ocr === true/, 'priNative.photo.ocr stays a capability fact (false on every host)');
const host = read('client/src/platform/native/host.js');
assert.ok(!/__PRI_NATIVE_PHOTO__|priPhoto/.test(host), 'the legacy host descriptor synthesises no photo OCR capability');

// Nothing under client/src asks a shell to read a photo.
const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(jsx?|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
};
const callers = walk(at('client/src/')).filter(f => /priNative\.photo\.recognize|recognizePhoto\(|nativePhotoAvailable/.test(readFileSync(f, 'utf8')));
assert.deepEqual(callers.map(f => f.pathname.split('/client/src/')[1]), [], 'no product module calls an on-device photo reader');

console.log('PHOTO OCR RETIRED — PASS: no Vision import, no priPhoto handler, no web photo OCR path; photos are read on the server only');
