// This device-only preference belongs to one authenticated local profile.
// Never migrate an unscoped chapter key; a shared tablet may change users.
// It is a reading shortcut, not assessment or evidence of chapter mastery.
const PREFIX = 'pri.notes.recent.v1.profile.';
const CHAPTER = /^c(?:7|8|9|10|11|12)-[a-z0-9-]{1,100}$/;

export function recentNotesChapterKey(profileId) {
  return profileId == null || profileId === ''
    ? null
    : PREFIX + encodeURIComponent(String(profileId));
}

export function readRecentNotesChapter(profileId, storage) {
  const key = recentNotesChapterKey(profileId);
  if (!key) return null;
  try {
    const value = (storage || localStorage).getItem(key);
    return typeof value === 'string' && CHAPTER.test(value) ? value : null;
  } catch {
    // Storage can be unavailable in private windows or locked down browsers.
    return null;
  }
}

export function rememberRecentNotesChapter(profileId, chapterId, storage) {
  const key = recentNotesChapterKey(profileId);
  if (!key || typeof chapterId !== 'string' || !CHAPTER.test(chapterId)) return false;
  try {
    (storage || localStorage).setItem(key, chapterId);
    return true;
  } catch {
    return false;
  }
}
