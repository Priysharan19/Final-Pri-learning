// Cross-class Notes search loads only the published, validated grade chunks.
// A rejected request may be retried by the student; this is not a substitute
// for loading from a different class or silently showing incomplete results.
export async function loadAllSearchNotes(grades, load) {
  if (!Array.isArray(grades) || !grades.length || typeof load !== 'function') {
    throw new Error('Notes search cannot be loaded.');
  }
  const rows = await Promise.all(grades.map(async grade => {
    const notes = await load(grade);
    if (!notes || typeof notes !== 'object' || Array.isArray(notes)) {
      throw new Error('Notes search data is unavailable.');
    }
    return [grade, notes];
  }));
  return Object.fromEntries(rows);
}

// A failed dynamic-import URL may remain poisoned in a browser's ESM module
// map for this entire document. Repeating import() in the same page does not
// guarantee any second network request. An explicit Retry reloads the document
// and preserves only this profile's query for one immediate reload, not in a
// URL, shared install storage, cloud record, or another profile.
export function notesSearchRetryKey(profileId) {
  return 'pri.notes.search-retry.v1.' + encodeURIComponent(String(profileId ?? 'guest'));
}
export function keepNotesQueryForReload(profileId, query, storage) {
  const text = String(query || '').slice(0, 160);
  if (!text || !storage) return false;
  try { storage.setItem(notesSearchRetryKey(profileId), text); return true; }
  catch { return false; }
}
// A StrictMode render may call lazy initializers twice: read must not erase
// the query until a committed mount effect consumes this one-time value.
export function readNotesQueryAfterReload(profileId, storage) {
  if (!storage) return '';
  try {
    const value = storage.getItem(notesSearchRetryKey(profileId)) || '';
    return typeof value === 'string' ? value.slice(0, 160) : '';
  } catch { return ''; }
}
export function clearNotesQueryAfterReload(profileId, storage) {
  if (!storage) return;
  try { storage.removeItem(notesSearchRetryKey(profileId)); } catch { /* best effort */ }
}
