// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · File exchange helpers
// Backups, task packs and progress files move between devices as plain JSON
// files — AirDrop, USB, email, LMS upload — no server needed, ever.
// ─────────────────────────────────────────────────────────────────────────────

import { priNative } from '../platform/native/index.js';

/**
 * Save or share a text file. Inside a native shell the file goes to the
 * platform share sheet (AirDrop, Files, Mail…; Android's chooser) through
 * priNative; in a browser it downloads. The blob URL outlives the click so the
 * browser (or WKDownload) can finish reading it before it is revoked.
 */
export function saveTextFile(text, filename, mimeType = 'application/json') {
  if (priNative.share.available()) {
    // Fall back only when sharing is unusable — never after a TIMEOUT, which
    // means a share sheet may still be open (a second one would appear).
    return priNative.share.file({ filename, mimeType, text }).catch(error => {
      if (['UNSUPPORTED', 'UNAVAILABLE', 'TOO_LARGE'].includes(error?.code)) return downloadText(text, filename, mimeType);
      throw error;
    });
  }
  return Promise.resolve(downloadText(text, filename, mimeType));
}

function downloadText(text, filename, mimeType) {
  if (typeof document === 'undefined') return { completed: false };
  const blob = new Blob([text], { type: mimeType });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
  return { completed: true };
}

/** Download/share a JS object as a pretty-printed .json file. */
export function downloadJSON(obj, filename) {
  return saveTextFile(JSON.stringify(obj, null, 2), filename, 'application/json');
}

/** Read a picked File as parsed JSON (rejects with a friendly message). */
export function readJSONFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      try { resolve(JSON.parse(String(r.result))); }
      catch { reject(new Error('That file isn’t valid JSON.')); }
    };
    r.onerror = () => reject(new Error('Couldn’t read that file.'));
    r.readAsText(file);
  });
}

/** yyyy-mm-dd for filenames. */
export function dateStamp(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** Read a picked File as text (rejects with a friendly message). */
export function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(new Error('Couldn’t read that file.'));
    r.readAsText(file);
  });
}
