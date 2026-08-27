// Pri Learning · native photo handwriting OCR bridge.
// The image never leaves the iPad. The native wrapper runs Apple Vision and
// returns editable text; the page never auto-submits an OCR guess.
const handler = () =>
  (typeof window !== 'undefined' && window.__PRI_NATIVE_PHOTO__ &&
    window.webkit?.messageHandlers?.priPhoto) || null;

export const nativePhotoAvailable = () => !!handler();

let nextRequestId = 1;
const pending = new Map();

if (typeof window !== 'undefined') {
  window.__priPhotoReceive = payload => {
    if (!payload || typeof payload !== 'object') return;
    const entry = pending.get(payload.reqId);
    if (!entry) return;
    pending.delete(payload.reqId);
    if (payload.ok === false) entry.reject(new Error(payload.error || 'Photo handwriting could not be read.'));
    else entry.resolve(payload);
  };
}

export function recognizePhoto(dataURL, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const target = handler();
    if (!target) {
      reject(new Error('Native photo handwriting OCR is unavailable in this build.'));
      return;
    }
    if (typeof dataURL !== 'string' || !/^data:image\//.test(dataURL)) {
      reject(new Error('The selected photo could not be prepared for handwriting recognition.'));
      return;
    }
    const reqId = nextRequestId++;
    pending.set(reqId, { resolve, reject });
    try {
      target.postMessage({ reqId, dataURL });
    } catch (err) {
      pending.delete(reqId);
      reject(err instanceof Error ? err : new Error('Could not start photo handwriting recognition.'));
      return;
    }
    setTimeout(() => {
      const entry = pending.get(reqId);
      if (!entry) return;
      pending.delete(reqId);
      entry.reject(new Error('Photo handwriting recognition timed out.'));
    }, timeoutMs);
  });
}
