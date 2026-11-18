// Pri Learning · opening questions without answering never uses up a free-practice limit
// (owner walk-through, 19 Nov 2026: 20 questions opened and not answered ended in a "free practice" limit).
//
// The active packaging (client/src/engine/packaging.js) caps nothing on the free plan, in either edition. So:
//   · the packaging, the engine allowance and the server's per-day figure are all null;
//   · a free account with 25, or 5,000, questions already issued today is still allowed, with no limit;
//   · the refusal that used to say "free practice questions used" is therefore unreachable.
import assert from 'node:assert/strict';
import { PACKAGING } from '../../client/src/engine/packaging.js';
import { FREE_PRACTICE_ALLOWANCE } from '../../client/src/engine/practiceAllowance.js';
import { freePracticePerDay, practiceAllowanceVerdict } from '../platform/practiceAllowance.js';

let pass = 0;
const check = async (name, fn) => { await fn(); pass++; console.log(`  ok  ${name}`); };

await check('the active packaging leaves free practice uncapped', () => {
  assert.equal(PACKAGING.free.practicePerDay, null);
  assert.equal(FREE_PRACTICE_ALLOWANCE.perDay, null);
  assert.equal(freePracticePerDay({}), null);
});

for (const edition of ['priyabhata', 'prithagoras']) {
  await check(`${edition}: a free account with many questions already opened today is never refused`, async () => {
    for (const issued of [20, 25, 5000]) {
      // A store whose entitlement is the free plan and whose day counter already holds `issued` questions.
      const db = {
        dialect: 'sqlite',
        transaction: async fn => fn(),
        get: async sql => (/entitlement_snapshots/.test(sql) ? null : { response_json: JSON.stringify({ issued }) })
      };
      const verdict = await practiceAllowanceVerdict(db, { accountId: 'free-account', now: Date.UTC(2026, 10, 19, 3, 0, 0), env: {}, edition });
      assert.equal(verdict.allowed, true, `${issued} opened`);
      assert.equal(verdict.limit, null);
      assert.equal(verdict.unlimited, true);
      assert.equal(verdict.plan, 'free');
    }
  });
}

console.log(`free-practice-uncapped-check: ${pass} checks passed`);
