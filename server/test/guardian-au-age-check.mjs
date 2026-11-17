// Prithagoras (Australia): a guardian's one-time email consent only for a
// student who states they are under 15; India (Priyabhata) unchanged; the AU
// notice is version au-1. Deterministic, no database.
//   node server/test/guardian-au-age-check.mjs
import assert from 'node:assert/strict';
import { serverEdition } from '../platform/edition.js';
import { ACCEPTED_CONSENT_NOTICE_VERSIONS, AU_CONSENT_NOTICE_VERSION, AU_GUARDIAN_AGE, CONSENT_NOTICE_VERSION, acceptsCurrentNotice, ageDecision, consentNoticeVersion, hasAgeDeclaration, learnerIsChild } from '../platform/guardianConsent.js';

let pass = 0;
const failures = [];
const check = (label, fn) => { try { fn(); pass++; } catch (e) { failures.push(`${label}: ${e.message}`); } };
const AU = 'prithagoras';
const IN = 'priyabhata';

check('the Australian line is 15', () => assert.equal(AU_GUARDIAN_AGE, 15));
check('AU: a student who states 14 or younger is a child and needs a guardian', () => {
  for (const age of [5, 11, 13, 14]) assert.equal(learnerIsChild({ isAdult: false, age }, AU), true, `age ${age}`);
  const r = ageDecision({ isAdult: false, age: 14, year: '9' }, { edition: AU });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'GUARDIAN_NAME_REQUIRED');
  const later = ageDecision({ isAdult: false, age: 14, year: '9' }, { edition: AU, guardianLater: true });
  assert.deepEqual([later.ok, later.basis, later.guardianLater], [true, 'child', true]);
});
check('AU: 15 to 17 (and 18+) need no guardian', () => {
  for (const age of [15, 16, 17, 18, 40]) {
    const r = ageDecision({ isAdult: age >= 18, age, year: '11' }, { edition: AU });
    assert.deepEqual([r.ok, r.basis, r.guardian], [true, 'adult', null], `age ${age}`);
  }
});
check('AU: the default stays protective — no age, a fractional, string, out-of-range or negative age is a child', () => {
  for (const age of [undefined, null, 14.9, '15', 200, -3, NaN]) assert.equal(learnerIsChild({ isAdult: false, age }, AU), true, `age ${String(age)}`);
  assert.equal(learnerIsChild({ year: '10' }, AU), true);
  assert.equal(learnerIsChild({}, AU), true);
});
check('AU: a request that says nothing about age is refused, not guessed', () => {
  assert.equal(hasAgeDeclaration({}), false);
  assert.equal(ageDecision({}, { edition: AU }).code, 'AGE_DECLARATION_REQUIRED');
});
check('a stated age is a declaration in Prithagoras only; India still refuses an age-only body', () => {
  assert.equal(hasAgeDeclaration({ age: 16 }, AU), true);
  assert.equal(hasAgeDeclaration({ age: 16 }, IN), false);
  assert.equal(ageDecision({ age: 16 }, { edition: IN }).code, 'AGE_DECLARATION_REQUIRED');
  assert.equal(ageDecision({ age: 16 }, { edition: AU }).basis, 'adult');
});
check('AU: an explicit 18+ is taken at its word', () => assert.equal(learnerIsChild({ isAdult: true }, AU), false));
check('India is unchanged: everyone not 18+ is a child, whatever age they state', () => {
  for (const age of [14, 15, 16, 17]) assert.equal(learnerIsChild({ isAdult: false, age }, IN), true);
  assert.equal(learnerIsChild({ isAdult: true }, IN), false);
  assert.equal(ageDecision({ isAdult: false, age: 16, year: '11' }, { edition: IN }).ok, false);
  assert.equal(ageDecision({ isAdult: true }, { edition: IN }).basis, 'adult');
  const decl = { isAdult: false, age: 16 };
  assert.equal(learnerIsChild(decl), learnerIsChild(decl, serverEdition()), 'with no edition given, the server\'s own edition decides');
});
check('the notice version is au-1 in Prithagoras and the existing one in Priyabhata', () => {
  assert.equal(AU_CONSENT_NOTICE_VERSION, 'au-1');
  assert.equal(consentNoticeVersion(AU), 'au-1');
  assert.equal(consentNoticeVersion(IN), CONSENT_NOTICE_VERSION);
  assert.ok(ACCEPTED_CONSENT_NOTICE_VERSIONS.includes('au-1') && ACCEPTED_CONSENT_NOTICE_VERSIONS.includes(CONSENT_NOTICE_VERSION));
});
check('a guardian approval must name this edition\'s notice, and nothing else', () => {
  assert.equal(acceptsCurrentNotice({ approve: true, noticeVersion: 'au-1' }, AU), true);
  assert.equal(acceptsCurrentNotice({ approve: true, noticeVersion: CONSENT_NOTICE_VERSION }, AU), false);
  assert.equal(acceptsCurrentNotice({ approve: true, noticeVersion: 'au-1' }, IN), false);
  assert.equal(acceptsCurrentNotice({ approve: true, noticeVersion: CONSENT_NOTICE_VERSION }, IN), true);
  assert.equal(acceptsCurrentNotice({ approve: false, noticeVersion: 'au-1' }, AU), false);
  assert.equal(acceptsCurrentNotice({ approve: true, noticeVersion: 'AU-1 ' }, AU), false);
});

if (failures.length) { console.error(failures.join('\n')); console.error(`GUARDIAN AU AGE: FAIL ${failures.length}`); process.exit(1); }
console.log(`GUARDIAN AU AGE: PASS — ${pass} checks (age rule per edition; notice au-1; India unchanged)`);
