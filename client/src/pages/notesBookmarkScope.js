// Notes bookmarks are local learning preferences. On a shared tablet, they
// must never be addressed by an install-wide key that survives profile changes.
// Do not assign an earlier unscoped key to any student: its owner is unknown.
const PREFIX = 'pri.notes.bookmarks.v2';
export function notesBookmarkKey(profileId) {
  return profileId == null || profileId === ''
    ? PREFIX + '.anonymous'
    : PREFIX + '.profile.' + encodeURIComponent(String(profileId));
}
