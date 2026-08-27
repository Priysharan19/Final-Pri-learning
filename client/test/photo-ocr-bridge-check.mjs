import assert from 'node:assert/strict';

let posted = null;
globalThis.window = {
  __PRI_NATIVE_PHOTO__: true,
  webkit: { messageHandlers: { priPhoto: { postMessage(msg) { posted = msg; } } } }
};
const mod = await import(`../src/native/photo.js?test=${Date.now()}`);
assert.equal(mod.nativePhotoAvailable(), true);
const promise = mod.recognizePhoto('data:image/jpeg;base64,AA==', 1000);
assert.ok(posted?.reqId > 0);
assert.equal(posted.dataURL, 'data:image/jpeg;base64,AA==');
window.__priPhotoReceive({ reqId: posted.reqId, ok: true, text: 'x = 15', answer: '15', confidence: 0.91, engine: 'apple-vision-photo-v1' });
const result = await promise;
assert.equal(result.answer, '15');
assert.equal(result.engine, 'apple-vision-photo-v1');
console.log('PHOTO OCR BRIDGE — PASS');
