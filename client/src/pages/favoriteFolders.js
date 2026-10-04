// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · favourite folders (Section 7.5)
//
// The bookmark itself is a learning record and lives in the profile store
// (POST /history/:id/bookmark). A folder is an arrangement of bookmarks and is
// kept on the device, per profile, in localStorage — so two siblings on one
// iPad each have their own folders and a folder is never synced as if it were
// a mark. The page says so. Every read tolerates missing or blocked storage.
//
// Shape: { folders: [{ id, name, ids: [questionId] }] }. A question may sit in
// one folder at a time; "Unsorted" is every saved question in no folder.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = pid => `pri-fav-folders:${pid}`;
export const MAX_FOLDERS = 24;
export const MAX_NAME = 40;

function storage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function readFolders(pid) {
  if (!pid) return [];
  try {
    const raw = storage()?.getItem(KEY(pid));
    const parsed = raw ? JSON.parse(raw) : null;
    const list = Array.isArray(parsed?.folders) ? parsed.folders : [];
    return list
      .filter(f => f && typeof f.id === 'string' && typeof f.name === 'string')
      .map(f => ({ id: f.id, name: String(f.name).slice(0, MAX_NAME), ids: Array.isArray(f.ids) ? f.ids.filter(x => typeof x === 'string') : [] }));
  } catch { return []; }
}

export function writeFolders(pid, folders) {
  if (!pid) return false;
  try { storage()?.setItem(KEY(pid), JSON.stringify({ folders })); return true; } catch { return false; }
}

const newId = () => `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** A clean name, or null when there is nothing usable in it. */
export function cleanFolderName(raw) {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  return name || null;
}

export function createFolder(folders, rawName) {
  const name = cleanFolderName(rawName);
  if (!name || folders.length >= MAX_FOLDERS) return folders;
  if (folders.some(f => f.name.toLowerCase() === name.toLowerCase())) return folders;
  return [...folders, { id: newId(), name, ids: [] }];
}

export function renameFolder(folders, id, rawName) {
  const name = cleanFolderName(rawName);
  if (!name) return folders;
  return folders.map(f => (f.id === id ? { ...f, name } : f));
}

export function deleteFolder(folders, id) {
  return folders.filter(f => f.id !== id);
}

/** Put a question in one folder (or none when folderId is null). */
export function moveToFolder(folders, questionId, folderId) {
  return folders.map(f => {
    const without = f.ids.filter(x => x !== questionId);
    return f.id === folderId ? { ...f, ids: [...without, questionId] } : { ...f, ids: without };
  });
}

export function folderOf(folders, questionId) {
  return folders.find(f => f.ids.includes(questionId))?.id || null;
}

/** Drop ids that are no longer saved, so a folder never counts a ghost. */
export function pruneFolders(folders, savedIds) {
  const keep = new Set(savedIds);
  return folders.map(f => ({ ...f, ids: f.ids.filter(id => keep.has(id)) }));
}

// ── Practise this folder ─────────────────────────────────────────────────────
// The queue of question ids still to practise, kept for the tab (sessionStorage)
// so a reload mid-folder continues and a new tab does not inherit it.
const QUEUE_KEY = 'pri-fav-queue';

export function readQueue() {
  try {
    const raw = globalThis.sessionStorage?.getItem(QUEUE_KEY);
    const q = raw ? JSON.parse(raw) : null;
    return q && Array.isArray(q.ids) ? { ids: q.ids.filter(x => typeof x === 'string'), name: String(q.name || ''), total: Number(q.total) || q.ids.length } : null;
  } catch { return null; }
}

export function writeQueue(queue) {
  try {
    if (!queue || !queue.ids.length) globalThis.sessionStorage?.removeItem(QUEUE_KEY);
    else globalThis.sessionStorage?.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch { /* a convenience; safe to lose */ }
}

/** Take the next id off the queue, writing the remainder back. Null when done. */
export function shiftQueue() {
  const q = readQueue();
  if (!q || !q.ids.length) { writeQueue(null); return null; }
  const [next, ...rest] = q.ids;
  writeQueue({ ...q, ids: rest });
  return { id: next, remaining: rest.length, name: q.name, total: q.total };
}
