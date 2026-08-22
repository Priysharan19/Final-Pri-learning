// Pri Learning · durable sync outbox checks
// Uses the same in-memory IndexedDB environment as the backend/security suites,
// then drives the real local/idb.js-backed outbox rather than a mock queue.

import { installBrowserEnv, resetStorage, rawRows } from './backend-check.mjs';

installBrowserEnv();
resetStorage();

const {
  acknowledgeMutations, classifyMutation, coalesce,
  outboxStats, pendingMutations, recordMutation
} = await import('../src/local/outbox.js');

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, condition, detail = '') {
  if (condition) { pass++; return; }
  fail++;
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

function same(name, actual, expected) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// ── classification ───────────────────────────────────────────────────────────

same('profile create is syncable', classifyMutation('POST', '/profiles', { user: { id: 'p1' } }),
  { kind: 'profile', entityId: 'p1', operation: 'upsert' });
same('profile patch is syncable', classifyMutation('PATCH', '/me', { user: { id: 'p1' } }),
  { kind: 'profile', entityId: 'p1', operation: 'upsert' });
same('profile delete keeps only its opaque id', classifyMutation('POST', '/profiles/delete', { ok: true }, { id: 'p1', password: 'DO NOT COPY' }),
  { kind: 'profile', entityId: 'p1', operation: 'delete' });
same('profile delete without a valid id is not queued', classifyMutation('POST', '/profiles/delete', { ok: true }, { id: '../bad' }), null);
same('password changes never enter sync outbox', classifyMutation('POST', '/profiles/password', { ok: true }), null);
same('profile selection never enters sync outbox', classifyMutation('POST', '/profiles/select', { ok: true }), null);
same('logout never enters sync outbox', classifyMutation('POST', '/auth/logout', { ok: true }), null);
same('practice result maps by question id', classifyMutation('POST', '/practice/q-1/submit', {}),
  { kind: 'practice-progress', entityId: 'q-1', operation: 'upsert' });
same('reveals also dirty progress', classifyMutation('POST', '/practice/q-2/reveal', {}),
  { kind: 'practice-progress', entityId: 'q-2', operation: 'upsert' });
same('new exam maps by returned id', classifyMutation('POST', '/exams', { exam: { id: 'e1' } }),
  { kind: 'exam', entityId: 'e1', operation: 'upsert' });
same('exam submit maps by path id', classifyMutation('POST', '/exams/e1/submit', {}),
  { kind: 'exam', entityId: 'e1', operation: 'upsert' });
same('class roll dirties class', classifyMutation('POST', '/classes/c1/students', {}),
  { kind: 'class', entityId: 'c1', operation: 'upsert' });
same('task delete emits tombstone marker', classifyMutation('POST', '/tasks/t1/delete', {}),
  { kind: 'task', entityId: 't1', operation: 'delete' });
same('bookmark removal emits delete', classifyMutation('POST', '/history/q1/bookmark', { bookmarked: false }),
  { kind: 'bookmark', entityId: 'q1', operation: 'delete' });
same('custom delete emits delete', classifyMutation('POST', '/custom-questions/x1/delete', {}),
  { kind: 'custom-question', entityId: 'x1', operation: 'delete' });
same('reads are not queued', classifyMutation('GET', '/stats', {}), null);

// ── pure coalescing ──────────────────────────────────────────────────────────

const first = { seq: 1, kind: 'task', entityId: 't1', operation: 'upsert', firstAt: 10, at: 10 };
const second = { seq: 2, kind: 'task', entityId: 't1', operation: 'delete', firstAt: 20, at: 20 };
const merged = coalesce([first], second);
same('same entity coalesces to one dirty marker', merged.length, 1);
same('latest operation wins coalescing', merged[0].operation, 'delete');
same('coalescing preserves first dirty time', merged[0].firstAt, 10);
same('different entities remain independent', coalesce([first], { ...second, entityId: 't2' }).length, 2);

// ── real persistence through local/idb.js ────────────────────────────────────

same('outbox starts empty', (await outboxStats()).pending, 0);
const task1 = await recordMutation('POST', '/tasks', { task: { id: 'task-1', title: 'PRIVATE TITLE' } });
ok('recordMutation returns a sequence', Number.isFinite(task1?.seq) && task1.seq > 0, JSON.stringify(task1));
same('one mutation is durable', (await pendingMutations()).length, 1);
same('stored mutation kind is task', (await pendingMutations())[0].kind, 'task');
same('stored mutation id is task id', (await pendingMutations())[0].entityId, 'task-1');

const task2 = await recordMutation('POST', '/tasks/task-1/delete', { ok: true, secret: 'SHOULD NOT BE COPIED' });
const afterDelete = await pendingMutations();
same('second mutation of same entity coalesces', afterDelete.length, 1);
same('delete wins after earlier upsert', afterDelete[0].operation, 'delete');
ok('sequence advances on coalesced mutation', task2.seq > task1.seq, `${task1.seq} -> ${task2.seq}`);
same('first dirty timestamp survives coalescing', afterDelete[0].firstAt, task1.firstAt);

await recordMutation('POST', '/classes', { class: { id: 'class-1', name: 'SECRET CLASS NAME' } });
await recordMutation('POST', '/custom-questions', { question: { id: 'custom-1', prompt: 'SECRET PROMPT' } });
await recordMutation('POST', '/profiles/delete', { ok: true }, { id: 'profile-1', password: 'SECRET PASSWORD', confirmName: 'SECRET NAME' });
const four = await pendingMutations();
same('independent dirty entities persist', four.length, 4);
same('queue order follows sequence', four.map(x => x.seq), [...four.map(x => x.seq)].sort((a, b) => a - b));
same('profile deletion persists as tombstone', four.find(x => x.kind === 'profile' && x.entityId === 'profile-1')?.operation, 'delete');

const disk = JSON.stringify(rawRows().device || []);
ok('outbox disk row never copies task title', !disk.includes('PRIVATE TITLE'), disk);
ok('outbox disk row never copies result secret', !disk.includes('SHOULD NOT BE COPIED'), disk);
ok('outbox disk row never copies class name', !disk.includes('SECRET CLASS NAME'), disk);
ok('outbox disk row never copies custom prompt', !disk.includes('SECRET PROMPT'), disk);
ok('outbox disk row never copies deletion password', !disk.includes('SECRET PASSWORD'), disk);
ok('outbox disk row never copies deletion confirmation name', !disk.includes('SECRET NAME'), disk);
ok('outbox disk row contains only opaque ids/metadata', disk.includes('task-1') && disk.includes('class-1') && disk.includes('custom-1') && disk.includes('profile-1'), disk);

const beforeAck = await pendingMutations();
const ackSeq = beforeAck[1].seq;
same('ack removes exactly one committed sequence', await acknowledgeMutations([ackSeq]), 1);
const afterAck = await pendingMutations();
same('ack leaves other mutations', afterAck.length, 3);
ok('ack removed requested sequence', !afterAck.some(x => x.seq === ackSeq), JSON.stringify(afterAck));
same('unknown ack is harmless', await acknowledgeMutations([999999]), 0);
same('empty ack is harmless', await acknowledgeMutations([]), 0);

const stats = await outboxStats();
same('stats reports version one', stats.version, 1);
same('stats reports pending count', stats.pending, 3);
ok('stats exposes oldest timestamp', Number.isFinite(stats.oldestAt) && stats.oldestAt > 0, JSON.stringify(stats));
ok('stats exposes newest timestamp', Number.isFinite(stats.newestAt) && stats.newestAt >= stats.oldestAt, JSON.stringify(stats));
ok('stats next sequence is ahead of every item', stats.nextSeq > Math.max(...afterAck.map(x => x.seq)), JSON.stringify(stats));

// Security-only operations must not write an outbox row or mutate its count.
const countBeforePassword = (await pendingMutations()).length;
same('password record returns null', await recordMutation('POST', '/profiles/password', { password: 'never' }), null);
same('password operation did not touch outbox', (await pendingMutations()).length, countBeforePassword);

console.log(`\nDurable sync outbox — ${pass}/${pass + fail} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\n${fail ? '✖ OUTBOX SUITE FAILED' : '✔ OUTBOX SUITE PASSED'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
