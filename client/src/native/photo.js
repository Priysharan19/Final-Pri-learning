// Pri Learning · native photo handwriting OCR (via priNative, CP-02).
// The image never leaves the device on this path: the native shell runs its
// on-device reader (Apple Vision today) and returns editable text; the page
// never auto-submits an OCR guess.
import { priNative } from '../platform/native/index.js';

export const nativePhotoAvailable = () => priNative.photo.available();

export function recognizePhoto(dataURL, timeoutMs = 12000, { signal = null } = {}) {
  return priNative.photo.recognize(dataURL, { timeoutMs, signal });
}
