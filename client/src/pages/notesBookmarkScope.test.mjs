import assert from 'node:assert/strict';
import { notesBookmarkKey } from './notesBookmarkScope.js';

const a = notesBookmarkKey('student-a');
const b = notesBookmarkKey('student-b');
const guest = notesBookmarkKey(null);
assert.notEqual(a, b);
assert.notEqual(guest, a);
assert.notEqual(notesBookmarkKey('anonymous'), guest);
assert.equal(notesBookmarkKey('student-a'), a);
assert.notEqual(notesBookmarkKey('student/a'), notesBookmarkKey('student-a'));
assert.ok(!a.includes('pri.notes.bookmarks.v1'));
const deviceStore = new Map([['pri.notes.bookmarks.v1', JSON.stringify(['private-from-old-install'])]]);
deviceStore.set(a, JSON.stringify(['c11-complex-numbers']));
deviceStore.set(b, JSON.stringify(['c12-relations']));
assert.deepEqual(JSON.parse(deviceStore.get(a)), ['c11-complex-numbers']);
assert.deepEqual(JSON.parse(deviceStore.get(b)), ['c12-relations']);
assert.equal(deviceStore.has(guest), false);
console.log('NOTES PROFILE BOOKMARK ISOLATION: PASS 9/9');
