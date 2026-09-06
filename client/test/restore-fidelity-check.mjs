// Pri Learning · restoring a backup must ADD a profile, never move one.
//
// Every backup store except three is keyed by `${pid}:${something}`, so the
// importer re-keys it around the new profile and a restored row physically
// cannot land on an existing one. `questions`, `exams` and `inks` are keyed by
// an id that came out of the FILE — and the file was written by a profile that
// is very likely still on the same iPad. Restoring your own backup therefore
// used to `put()` straight over the live rows and rewrite their `pid`: the
// original profile's History, handwriting archive and papers moved to the copy,
// its History page went empty, and deleting the copy destroyed them for good.
// restoreGuard reported that restore as verified, because it counted rows under
// the new pid and a stolen row counts.
//
// The second half is the India fields. A restored paper is only the paper it was
// if it comes back with its marking grid, its sections and its chapters: without
// them a 100-mark JEE Main paper re-marks as 25 with no negative marking, and
// every answer's evidence lands on the NSW generator id rather than the NCERT
// chapter the student is actually working through.
//
// Proves:
//   · a restore on the source device leaves the source profile's questions,
//     handwriting and exams exactly where they were
//   · restored id-keyed rows take fresh ids, and every reference between them
//     (exam → questions, exam detail → question, ink → question, bookmark and
//     attempt → question) follows the same rewrite
//   · deleting the restored duplicate does not touch the original
//   · restoreGuard refuses to call a restore verified when a pre-existing row
//     changed owner, and its rollback leaves the original data intact
//   · a restored India paper keeps india{chapterId,track,dotpointIndex},
//     examMarking, indiaExamSection/Label/Item, examOrder and sourceKind, and
//     is still worth what the blueprint says
//
// Usage: node client/test/restore-fidelity-check.mjs

import { installBrowserEnv, resetStorage, rawRows } from './backend-check.mjs';

installBrowserEnv();
resetStorage();

const { dispatch } = await import('../src/local/backend.js');
const { dispatchIndiaExam } = await import('../src/local/indiaExamBackend.js');
const { restoreBackupSafely } = await import('../src/local/restoreGuard.js');
const idb = await import('../src/local/idb.js');
const { cloudLinkRowId } = await import('../src/platform/cloudAccount.js');
// This suite talks to dispatch() directly, so it loads the question banks the
// way src/api.js does before a request reaches the backend.
const { loadAllBanks } = await import('../src/engine/generators/index.js');
await loadAllBanks();

let pass = 0;
let fail = 0;
const failures = [];
const ok = (name, condition, detail = '') => {
  if (condition) { pass++; return true; }
  fail++;
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  return false;
};
const eq = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

const POST = (path, body = {}) => dispatch('POST', path, body);
const GET = path => dispatch('GET', path);
const DAY = 86_400_000;

/** Rows of one store owned by one profile, read straight off the fake disk. */
const owned = (store, pid) => (rawRows()[store] || []).filter(r => r?.pid === pid);

/**
 * Get a question into History with a page of handwriting on it, whatever its
 * answer type is. The submit stores the ink before it decides anything about the
 * answer, and the reveal is what always resolves the attempt — a wrong answer
 * buys another try, and an unparseable one buys unlimited tries, so neither is a
 * reliable way to finish a question this suite does not choose.
 */
async function answerWrongly(questionId, strokes = null) {
  const body = { answer: 'definitely-not-the-answer', ms: 1000 };
  if (strokes) body.ink = { strokes, recognized: 'definitely-not-the-answer' };
  try { await POST(`/practice/${questionId}/submit`, body); } catch { /* the reveal below settles it */ }
  try { await POST(`/practice/${questionId}/reveal`, { ms: 1000 }); } catch { /* already resolved */ }
}

/** A server-issued Premium snapshot, so the India exam module will compose. */
async function grantPremium(pid) {
  const now = Date.now();
  await idb.put('device', {
    id: cloudLinkRowId(pid), accountId: `acct-${pid}`, role: 'student', emailVerified: true,
    linkedAt: now, lastVerifiedAt: now, lastSyncAt: null,
    entitlement: {
      plan: 'premium', status: 'active', provider: 'web',
      currentPeriodEnd: now + 30 * DAY, offlineUntil: now + 7 * DAY, issuedAt: now, sourceVersion: 1
    }
  });
}

// ── The device the backup came from ──────────────────────────────────────────

const source = (await POST('/profiles', { name: 'Aarav', year: 10, course: 'in', indiaTrack: 'cbse' })).user;
const strokes = [{ points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] }];
for (let i = 0; i < 3; i++) {
  const { question } = await POST('/practice/next', { mode: 'smart' });
  await answerWrongly(question.id, strokes);
  if (i === 0) await POST(`/history/${question.id}/bookmark`, {});
}

const sourceHistory = await POST('/history/list', { pageSize: 200 });
ok('the source profile answered some questions', sourceHistory.total >= 3, `total ${sourceHistory.total}`);
const sourceQuestions = owned('questions', source.id).map(r => r.id).sort();
const sourceInks = owned('inks', source.id).map(r => r.id).sort();
ok('the source profile has handwriting to lose', sourceInks.length >= 3, `${sourceInks.length} ink rows`);

const backup = await GET('/data/export');
eq('the backup declares version 2', backup.version, 2);
ok('the backup carries the questions', backup.stores.questions.length === sourceQuestions.length, `${backup.stores.questions.length} vs ${sourceQuestions.length}`);

// ── Restoring it, on the device it came from ─────────────────────────────────

const restored = await restoreBackupSafely(dispatch, structuredClone(backup));
ok('the restore reports itself verified', restored.restoreVerified === true, JSON.stringify(restored.restoreVerified));
ok('the restore made a new profile', restored.user.id !== source.id, 'the import reused the source id');

const afterQuestions = owned('questions', source.id).map(r => r.id).sort();
const afterInks = owned('inks', source.id).map(r => r.id).sort();
eq('the source profile still owns every question it did', afterQuestions, sourceQuestions);
eq('the source profile still owns every page of handwriting it did', afterInks, sourceInks);
ok('the restored profile owns its own separate questions',
  owned('questions', restored.user.id).length === sourceQuestions.length, `${owned('questions', restored.user.id).length} rows`);
ok('no restored question reuses a source question id',
  owned('questions', restored.user.id).every(r => !sourceQuestions.includes(r.id)),
  JSON.stringify(owned('questions', restored.user.id).map(r => r.id)));
ok('no restored ink reuses a source ink id',
  owned('inks', restored.user.id).every(r => !sourceInks.includes(r.id)),
  JSON.stringify(owned('inks', restored.user.id).map(r => r.id)));

// Every reference between the restored rows has to follow the same rewrite, or
// the copy is a set of rows that no longer point at each other.
const restoredQIds = new Set(owned('questions', restored.user.id).map(r => r.id));
ok('every restored ink names a restored question',
  owned('inks', restored.user.id).every(r => restoredQIds.has(r.id)),
  'an ink pointed outside the restored profile');
ok('every restored bookmark names a restored question',
  owned('bookmarks', restored.user.id).every(r => restoredQIds.has(r.questionId)),
  'a bookmark pointed outside the restored profile');
ok('every restored attempt names a restored question',
  owned('attempts', restored.user.id).every(r => restoredQIds.has(r.questionId)),
  'an attempt pointed outside the restored profile');
ok('the source profile keeps a bookmark of its own', owned('bookmarks', source.id).length === 1, `${owned('bookmarks', source.id).length} rows`);

const restoredHistory = await POST('/history/list', { pageSize: 200 });
eq('the restored profile reads its own history', restoredHistory.total, sourceHistory.total);

// ── Deleting the duplicate ───────────────────────────────────────────────────

await POST('/profiles/delete', { id: restored.user.id, confirm: true });
await POST('/profiles/select', { id: source.id });
const survivor = await POST('/history/list', { pageSize: 200 });
eq('deleting the duplicate leaves the original History untouched', survivor.total, sourceHistory.total);
eq('deleting the duplicate leaves the original questions untouched', owned('questions', source.id).map(r => r.id).sort(), sourceQuestions);
eq('deleting the duplicate leaves the original handwriting untouched', owned('inks', source.id).map(r => r.id).sort(), sourceInks);

// ── restoreGuard must not certify a restore that moved somebody's rows ───────

// Feed the guard an importer that does what the broken one did: files the staged
// profile's rows at the ids the FILE carries, which on this device are the ids
// the source profile is still using, so the row moves rather than being copied.
// Every row the backup declared is then present under the staged pid and every
// count the guard takes is satisfied — the theft is invisible to row counting,
// and only the ownership census can see it.
const stolenBackup = structuredClone(backup);
async function thievingDispatch(method, path, body) {
  if (method !== 'POST' || path !== '/data/import') return dispatch(method, path, body);
  const result = await dispatch(method, path, body);
  for (const [store, key] of [['questions', 'id'], ['exams', 'id'], ['inks', 'id']]) {
    const declared = Array.isArray(body.stores?.[store]) ? body.stores[store] : [];
    const restoredRows = owned(store, result.user.id);
    for (let i = 0; i < declared.length; i++) {
      // Drop the honest fresh copy and re-point the original row instead, so the
      // staged profile ends up holding exactly the source profile's own rows.
      if (restoredRows[i]) await idb.del(store, restoredRows[i][key]);
      const original = await idb.get(store, declared[i][key]);
      if (original) await idb.put(store, { ...original, pid: result.user.id });
    }
  }
  return result;
}
let guardError = null;
try { await restoreBackupSafely(thievingDispatch, stolenBackup); }
catch (err) { guardError = err; }
// Row counting cannot see this: every row the file declared IS present under
// the staged pid. Only the ownership census can, and it is the difference
// between the guard certifying this restore and refusing it.
ok('a restore that took a pre-existing row is refused', guardError?.code === 'RESTORE_OWNERSHIP_CONFLICT', `${guardError?.code}: ${guardError?.message}`);
ok('the refusal does not claim the existing local data is unchanged',
  !/existing local data is unchanged/.test(String(guardError?.message)), String(guardError?.message));
eq('the rollback removed the staged profile', (await GET('/profiles')).profiles.map(p => p.id), [source.id]);

// ── An India paper has to come back as the paper it was ──────────────────────

resetStorage();
const vik = (await POST('/profiles', { name: 'Vik', year: 12, course: 'in', indiaTrack: 'jee-main' })).user;
await grantPremium(vik.id);
const composed = (await dispatchIndiaExam((await GET('/me')).user, 'POST', '/exams', {})).exam;
ok('a JEE Main paper composed', composed.questions.length > 0, `${composed.questions.length} questions`);
const composedMarks = composed.questions.reduce((n, q) => n + Number(q.marks || 0), 0);
ok('the composed paper is worth what the blueprint says', composedMarks === composed.total, `${composedMarks} vs ${composed.total}`);

const paperBackup = await GET('/data/export');
const paperRestored = await restoreBackupSafely(dispatch, structuredClone(paperBackup));
ok('the India paper restore reports itself verified', paperRestored.restoreVerified === true, JSON.stringify(paperRestored.restoreVerified));
await grantPremium(paperRestored.user.id);

const listed = await dispatchIndiaExam((await GET('/me')).user, 'GET', '/exams', {});
eq('the restored profile lists exactly its one paper', listed.exams.length, 1);
ok('the restored paper took a fresh id', listed.exams[0].id !== composed.id, 'the restored paper reused the source id');
const back = (await dispatchIndiaExam((await GET('/me')).user, 'GET', `/exams/${listed.exams[0].id}`, {})).exam;

eq('the restored paper has every question', back.questions.length, composed.questions.length);
const backMarks = back.questions.reduce((n, q) => n + Number(q.marks || 0), 0);
eq('the restored paper is still worth its blueprint total', backMarks, composedMarks);
ok('the restored paper keeps its negative marking', back.questions.some(q => q.negativeMarks > 0), JSON.stringify(back.questions.slice(0, 3).map(q => q.negativeMarks)));
ok('the restored paper keeps its NCERT chapters', back.questions.every(q => !!q.chapterId), JSON.stringify(back.questions.slice(0, 3).map(q => q.chapterId)));
ok('the restored paper keeps its sections', back.questions.every(q => !!q.section), JSON.stringify(back.questions.slice(0, 3).map(q => q.section)));
ok('the restored paper keeps its section labels', back.questions.every(q => !!q.sectionLabel && !/undefined/.test(q.sectionLabel)), JSON.stringify(back.questions.slice(0, 3).map(q => q.sectionLabel)));
ok('the restored paper keeps its item types', back.questions.every(q => !!q.item), JSON.stringify(back.questions.slice(0, 3).map(q => q.item)));
ok('the restored paper keeps its question provenance', back.questions.every(q => !!q.sourceKind), JSON.stringify(back.questions.slice(0, 3).map(q => q.sourceKind)));
eq('the restored questions keep their order', back.questions.map(q => q.order), composed.questions.map(q => q.order));
eq('the restored questions keep their chapters in order', back.questions.map(q => q.chapterId), composed.questions.map(q => q.chapterId));

const restoredRow = owned('questions', paperRestored.user.id).find(r => r.india);
ok('a restored India question row keeps its india block',
  restoredRow?.india && typeof restoredRow.india.chapterId === 'string' && restoredRow.india.track === 'jee-main',
  JSON.stringify(restoredRow?.india));
ok('a restored India question row keeps its marking grid',
  Number(restoredRow?.examMarking?.correct) > 0 && Number(restoredRow?.examMarking?.incorrect) < 0,
  JSON.stringify(restoredRow?.examMarking));

// A crafted marking grid must not be able to pay a student more than a real one.
const crafted = structuredClone(paperBackup);
crafted.stores.questions[0].examMarking = { correct: 9999, incorrect: 500, unanswered: 'nine', partialPerOption: -3 };
crafted.stores.questions[0].india = { chapterId: 'not-a-chapter-anybody-knows', track: 'no-such-track', dotpointIndex: 900 };
const craftedRestore = await restoreBackupSafely(dispatch, crafted);
const craftedRows = owned('questions', craftedRestore.user.id);
ok('no restored question is worth more marks than a real grid allows',
  craftedRows.every(r => !r.examMarking || Number(r.examMarking.correct) <= 20),
  JSON.stringify(craftedRows.map(r => r.examMarking?.correct)));
ok('a crafted grid cannot turn negative marking into a bonus',
  craftedRows.every(r => !r.examMarking || Number(r.examMarking.incorrect) <= 0),
  JSON.stringify(craftedRows.map(r => r.examMarking?.incorrect)));
ok('a crafted partial-marking rate cannot go negative',
  craftedRows.every(r => !r.examMarking || r.examMarking.partialPerOption === null || Number(r.examMarking.partialPerOption) >= 0),
  JSON.stringify(craftedRows.map(r => r.examMarking?.partialPerOption)));
ok('a non-numeric unanswered value becomes a number',
  craftedRows.every(r => !r.examMarking || Number.isFinite(Number(r.examMarking.unanswered))),
  JSON.stringify(craftedRows.map(r => r.examMarking?.unanswered)));
ok('a chapter this build does not know is dropped rather than stored',
  craftedRows.every(r => !r.india || r.india.chapterId !== 'not-a-chapter-anybody-knows'),
  'an unknown chapter id survived the import');
ok('a track this build does not know falls back to a real one',
  craftedRows.every(r => !r.india || ['cbse', 'jee-main', 'jee-advanced', 'olympiad'].includes(r.india.track)),
  JSON.stringify(craftedRows.map(r => r.india?.track)));

console.log(`\nRestore fidelity — ${pass}/${pass + fail} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\nRESTORE FIDELITY: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
