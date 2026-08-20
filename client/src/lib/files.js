// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · File exchange helpers
// Backups, task packs and progress files move between devices as plain JSON
// files — AirDrop, USB, email, LMS upload — no server needed, ever.
// ─────────────────────────────────────────────────────────────────────────────

/** Download a JS object as a pretty-printed .json file. */
export function downloadJSON(obj, filename) {
  // Inside the native iPad app, hand the file to Swift — it opens the iOS
  // share sheet (AirDrop, Files, Mail…), which is the native way to export.
  const native = window.webkit?.messageHandlers?.priShare;
  if (window.__PRI_NATIVE__ && native) {
    native.postMessage({ filename, content: JSON.stringify(obj, null, 2) });
    return;
  }
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
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
