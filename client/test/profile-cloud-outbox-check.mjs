// Pri Learning · profile-scoped cloud outbox regression contract
// Proves that one shared iPad cannot flush profile A's mutations through profile B
// and that append-only learning attempts never coalesce before cloud commit.

import { installBrowserEnv, resetStorage, rawRows } from './backend-check.mjs';

installBrowserEnv();
resetStorage();

const { add } = await import('../src/local/idb.js');
const {
  acknowledgeProfileMutations, pendingProfileMutations, profileOutboxStats, recordProfileMutation
} = await import('../src/platform/profileOutbox.js');

let pass = 0;
let fail = 0;
const failures = [];
const ok = (name, condition, detail = '') => {
  if (condition) { pass++; return; }
  fail++;
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
};
const same = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

// Every local profile begins with its OWN required initial reconciliation.
same('p1 starts with full rescan', (await pendingProfileMutations('p1'))[0]?.kind, 'full-rescan');
same('p2 starts with full rescan', (await pendingProfileMutations('p2'))[0]?.kind, 'full-rescan');
await acknowledgeProfileMutations('p1', [0]);
same('acknowledging p1 initial rescan clears only p1', (await profileOutboxStats('p1')).requiresFullRescan, false);
same('p2 initial rescan remains required', (await profileOutboxStats('p2')).requiresFullRescan, true);

// Mutable state queues against exactly one profile.
await recordProfileMutation('p1', 'PATCH', '/me', { user: { id: 'p1' } });
same('p1 owns its profile mutation', (await pendingProfileMutations('p1')).map(x => x.entityId), ['p1']);
same('p2 still exposes only its own initial rescan', (await pendingProfileMutations('p2')).map(x => x.kind), ['full-rescan']);

// Two attempts at the same question are two learning facts, not one dirty entity.
const a1 = await add('attempts', { pid: 'p1', questionId: 'q-same', subtopic: 'algebra', difficulty: 2, correct: 0, ms: 1200, hintsUsed: 0, mode: 'practice', viaInk: true, ratingBefore: 1000, ratingAfter: 990, createdAt: 1000 });
await recordProfileMutation('p1', 'POST', '/practice/q-same/submit', { correct: false });
const a2 = await add('attempts', { pid: 'p1', questionId: 'q-same', subtopic: 'algebra', difficulty: 2, correct: 1, ms: 900, hintsUsed: 0, mode: 'practice', viaInk: true, ratingBefore: 990, ratingAfter: 1010, createdAt: 2000 });
await recordProfileMutation('p1', 'POST', '/practice/q-same/submit', { correct: true });

const p1 = await pendingProfileMutations('p1');
const attempts = p1.filter(x => x.kind === 'practice-progress' && x.entityId === 'q-same');
same('same-question attempts remain two append-only markers', attempts.length, 2);
ok('attempt markers have different sequences', attempts[0]?.seq !== attempts[1]?.seq, JSON.stringify(attempts));
same('first marker points to first opaque attempt id', attempts[0]?.sourceId, a1);
same('second marker points to second opaque attempt id', attempts[1]?.sourceId, a2);

// Shared teacher/classroom data must never enter a student's generic replica.
same('task mutation is excluded from generic cloud outbox', await recordProfileMutation('p1', 'POST', '/tasks', { task: { id: 'task-private', title: 'SECRET TITLE' } }), null);
same('class mutation is excluded from generic cloud outbox', await recordProfileMutation('p1', 'POST', '/classes', { class: { id: 'class-private', name: 'SECRET CLASS' } }), null);
same('local profile deletion is not cloud account deletion', await recordProfileMutation('p1', 'POST', '/profiles/delete', { ok: true }, { id: 'p1', password: 'SECRET' }), null);

const disk = JSON.stringify(rawRows().device || []);
ok('scoped cloud queue stores no task title', !disk.includes('SECRET TITLE'), disk);
ok('scoped cloud queue stores no class name', !disk.includes('SECRET CLASS'), disk);
ok('scoped cloud queue stores no deletion password', !disk.includes('SECRET'), disk);
ok('separate profile-scoped device rows exist', disk.includes('pri-cloud-outbox-v1:p1') && !disk.includes('pri-cloud-outbox-v1:p2'), disk);

console.log(`\nProfile cloud outbox — ${pass}/${pass + fail} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\n${fail ? '✖ PROFILE CLOUD OUTBOX FAILED' : '✔ PROFILE CLOUD OUTBOX PASSED'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
