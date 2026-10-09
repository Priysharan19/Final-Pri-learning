import assert from 'node:assert/strict';
import { canRetryPhotoReading, definitiveSubmissionRefusal, draftPersistenceWarning, pdfReceiptWarning, photoEligibleForGrading, photoReadFailure } from './photoSubmissionGuard.js';

const base = { mode: 'photo', photo: 'data:image/png;base64,AA==', ocrPhase: 'done', pdfPageCount: 0 };
const cases = [
  ['single validated photo', base, true],
  ['typed is not silently made Photo', { ...base, mode: 'type', photo: null }, true],
  ['normal handwriting does not require Photo', { ...base, mode: 'write', photo: null }, true],
  ['old image invalidated before replacement FileReader', { ...base, photo: null, ocrPhase: 'reading' }, false],
  ['async image reading', { ...base, ocrPhase: 'reading' }, false],
  ['unavailable cloud provider', { ...base, ocrPhase: 'unavailable' }, false],
  ['failed reader', { ...base, ocrPhase: 'failed' }, false],
  ['one-page rendered PDF', { ...base, pdfPageCount: 1 }, true],
  ['two-page PDF all pages recognised but server proof first only', { ...base, pdfPageCount: 2 }, false],
  ['six-page PDF all pages recognised', { ...base, pdfPageCount: 6 }, false],
  ['partial two-page PDF', { ...base, pdfPageCount: 2, unreadPages: { unread: 1, total: 2 } }, false],
  ['unread single-page PDF', { ...base, unreadPages: { unread: 1, total: 1 } }, false],
  ['reattach without new bytes', { ...base, reattachRequired: true, photo: null }, false],
  ['reattach with new server recognition', { ...base, reattachRequired: true }, true],
  ['stale done OCR after photo removal', { ...base, photo: null }, false]
];
cases.forEach(([name, inputs, expected]) => assert.equal(photoEligibleForGrading(inputs), expected, name));
console.log('PHOTO SERVER RECEIPT BOUNDARY: PASS ' + cases.length + '/' + cases.length);

const rejects = [
  [null, false], [undefined, false], [{ status: 0 }, false],
  [{ status: 401 }, false], [{ status: 403 }, false],
  [{ status: 408 }, false], [{ status: 425 }, false],
  [{ status: 429 }, false], [{ status: 503 }, false],
  [{ status: 400 }, true], [{ status: 404 }, true],
  [{ status: 409 }, true], [{ status: 422 }, true],
  [{ status: 451 }, true]
];
for (const [error, expected] of rejects) {
  assert.equal(definitiveSubmissionRefusal(error), expected, 'replay decision ' + String(error?.status));
}
console.log('GRADE RECEIPT RETRY BOUNDARY: PASS ' + rejects.length + '/' + rejects.length);

assert.match(pdfReceiptWarning('en-IN', 2), /only one image/);
assert.match(pdfReceiptWarning('hi-IN', 2), /केवल एक तस्वीर/);
assert.match(draftPersistenceWarning('en-IN'), /Nothing has been submitted/);
assert.match(draftPersistenceWarning('hi-IN'), /अभी जमा नहीं हुआ/);
console.log('BILINGUAL PHOTO/RECOVERY DIAGNOSTICS: PASS 4/4');

const privateFailure = await Promise.reject(new Error('private file bytes must not leak'))
  .catch(photoReadFailure);
assert.deepEqual(privateFailure, { blocked: 'verdict.photoReadingServiceDown' });
assert.ok(!JSON.stringify(privateFailure).includes('private file bytes'));
assert.deepEqual(await Promise.resolve({ text: 'x + 1' }).catch(photoReadFailure), { text: 'x + 1' });
assert.equal((await Promise.resolve({ allowance: true }).catch(photoReadFailure)).allowance, true);
console.log('PHOTO PROVIDER NETWORK-REJECTION SAFETY: PASS 4/4');

assert.equal(canRetryPhotoReading('verdict.photoReadingServiceDown', true, false), true);
assert.equal(canRetryPhotoReading('verdict.photoReadingOffline', false, true), true);
assert.equal(canRetryPhotoReading('verdict.photoReadingServiceDown', false, false), false);
assert.equal(canRetryPhotoReading('verdict.photoReadingSignIn', true, false), false);
assert.equal(canRetryPhotoReading('verdict.photoReadingGuardian', true, true), false);
console.log('PHOTO RETRY WITHOUT AUTH BYPASS: PASS 5/5');
