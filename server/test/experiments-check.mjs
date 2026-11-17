// Pri Learning · pre-registered experiments and their readout.
//
//   registry       every definition is well-formed, status "off", frozen in
//                  registry.lock.json; an edited definition is caught
//   activation     nothing is active without PRI_EXPERIMENTS, and the tutor
//                  experiment also needs PRI_FEATURE_TUTOR_POLICY=1
//   randomisation  stable per account (golden arms pinned), balanced, and
//                  independent between experiments
//   stamp          empty with nothing active, so events are unchanged
//   readout        refuses on small n; stops on arm-integrity failure and on
//                  sample-ratio mismatch; Wilson/Newcombe against published
//                  values; policy-helped outcome attempts are not independent
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  activeExperiments, assignArm, assignmentPoint, definitionDigest, experimentById, experimentDefinitions, experimentStamp,
  lockedDigests, validateDefinition, validateRegistry
} from '../platform/experiments.js';
import { chiSquareP, newcombeDifference, primaryOutcomeOf, readout, sampleRatio, wilson } from '../platform/experimentReadout.js';

let count = 0;
const eq = (a, b, name) => { assert.deepEqual(a, b, name); count++; };
const ok = (cond, name) => { assert.ok(cond, name); count++; };
const near = (a, b, tol, name) => { assert.ok(Math.abs(a - b) <= tol, `${name}: ${a} vs ${b}`); count++; };

// ── Registry ────────────────────────────────────────────────────────────────
const defs = experimentDefinitions();
eq(defs.map(d => d.id), ['aa-assignment-v1', 'tutor-first-help-v1'], 'the registered experiments');
eq(validateRegistry(), [], 'every definition is valid and frozen');
ok(defs.every(d => d.status === 'off'), 'every definition is off in the file');
const tutor = experimentById('tutor-first-help-v1');
eq(tutor.arms.map(a => [a.id, a.weight]), [['control', 0.5], ['policy', 0.5]], 'policy-chosen first help vs the fixed ladder start, 50/50');
eq([tutor.primaryOutcome.id, tutor.primaryOutcome.delayHours >= 24], ['delayed-independent-transfer', true], 'primary outcome: delayed independent transfer, at least a day later');
eq(tutor.guardrails.map(g => g.id), ['time-on-task', 'give-up-rate', 'complaint-reports'], 'guardrails: time on task, give-up rate, complaint reports');
ok(tutor.minimumSample.perArm >= 100, 'a minimum sample is pre-registered');
eq(tutor.requires, ['PRI_FEATURE_TUTOR_POLICY'], 'the tutor experiment needs the tutor-policy server flag');
const edited = { ...tutor, minimumSample: { ...tutor.minimumSample, perArm: 20 } };
ok(validateRegistry({ definitions: [edited], locked: lockedDigests() }).some(p => p.includes('changed after it was frozen')), 'editing a frozen definition is caught');
ok(validateDefinition(edited).some(p => p.includes('below 30')), 'a minimum sample below 30 is refused');
ok(validateDefinition({ ...tutor, status: 'on' }).some(p => p.includes('status must be "off"')), 'a definition cannot switch itself on');
ok(validateDefinition({ ...tutor, arms: [{ id: 'a', weight: 0.6 }, { id: 'b', weight: 0.6 }] }).some(p => p.includes('sum to 1')), 'arm weights must sum to 1');
ok(validateDefinition({ ...tutor, primaryOutcome: { ...tutor.primaryOutcome, delayHours: 2 } }).some(p => p.includes('under 24 hours')), 'an immediate outcome is not the primary outcome');
ok(validateDefinition({ ...tutor, guardrails: [] }).some(p => p.includes('time-on-task')), 'guardrails are required');
eq(definitionDigest({ b: 1, a: [2, { d: 3, c: 4 }] }), definitionDigest({ a: [2, { c: 4, d: 3 }], b: 1 }), 'the digest ignores key order');

// ── Activation ──────────────────────────────────────────────────────────────
eq(activeExperiments({}), [], 'nothing is active by default');
eq(activeExperiments({}, [{ get id() { throw new Error('read'); } }]), [], 'with nothing listed no definition is even read');
eq(activeExperiments({ PRI_FEATURE_TUTOR_POLICY: '1' }).map(d => d.id), [], 'the flag alone activates no experiment');
eq(activeExperiments({ PRI_EXPERIMENTS: 'tutor-first-help-v1' }).map(d => d.id), [], 'the tutor experiment does not run with the policy dark');
eq(activeExperiments({ PRI_EXPERIMENTS: 'tutor-first-help-v1', PRI_FEATURE_TUTOR_POLICY: '1' }).map(d => d.id), ['tutor-first-help-v1'], 'listed and flagged: active');
eq(activeExperiments({ PRI_EXPERIMENTS: ' aa-assignment-v1 , unknown-x ' }).map(d => d.id), ['aa-assignment-v1'], 'the A/A runs on its own; unknown ids are ignored');
eq(activeExperiments({ PRI_EXPERIMENTS: 'tutor-first-help-v1', PRI_FEATURE_TUTOR_POLICY: 'true' }).map(d => d.id), [], 'only an explicit 1 turns the flag on');

// ── Randomisation ───────────────────────────────────────────────────────────
const ids = Array.from({ length: 20000 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
const arms = ids.map(id => assignArm(tutor, id));
ok(ids.slice(0, 500).every((id, i) => assignArm(tutor, id) === arms[i]), 'the same account always gets the same arm');
const share = arms.filter(a => a === 'policy').length / arms.length;
near(share, 0.5, 0.015, 'assignment is balanced to the weights over 20,000 accounts');
ok(!sampleRatio(tutor, { control: arms.length - arms.filter(a => a === 'policy').length, policy: arms.filter(a => a === 'policy').length }).mismatch, 'and passes the sample-ratio check');
const aa = experimentById('aa-assignment-v1');
const both = ids.map(id => [assignArm(tutor, id) === 'policy', assignArm(aa, id) === 'a2']);
const agree = both.filter(([x, y]) => x === y).length / both.length;
near(agree, 0.5, 0.015, 'arms of two experiments are independent (own salt each)');
// Golden arms: a change to the hash, the salt or the weights moves these and fails here.
const golden = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'];
const expectedArm = id => (createHash('sha256').update(`${tutor.salt}\u0000${id}`).digest().readUInt32BE(0) / 2 ** 32 < 0.5 ? 'control' : 'policy');
eq(golden.map(id => assignArm(tutor, id)), golden.map(expectedArm), 'the arm is the documented SHA-256 rule, recomputable by anyone');
eq(golden.map(id => assignArm(tutor, id)), ['policy', 'policy', 'control', 'control'], 'golden arms pinned');
ok(assignmentPoint(tutor.salt, 'x') >= 0 && assignmentPoint(tutor.salt, 'x') < 1, 'the assignment point is in [0, 1)');
eq(assignArm(tutor, ''), null, 'no account, no arm');

// ── Stamp ───────────────────────────────────────────────────────────────────
eq(experimentStamp([], 'acct', { family: 'g', ms: 5 }), {}, 'nothing active: the event gets nothing');
eq(experimentStamp(activeExperiments({}), 'acct'), {}, 'and by default nothing is active');
eq(experimentStamp([tutor], golden[0], { family: 'gen-a', ms: 1200 }), { experiment: { assignments: [{ id: 'tutor-first-help-v1', version: 1, arm: 'policy' }], family: 'gen-a', ms: 1200 } }, 'active: the arm, family and time');
eq(experimentStamp([tutor], golden[0], { ms: -1 }).experiment.ms, null, 'a bad time is not recorded');

// ── Statistics against published values ────────────────────────────────────
const w = wilson(81, 263);
near(w.lo, 0.2553, 0.0005, 'Wilson 81/263 lower (Newcombe 1998 table I)'); near(w.hi, 0.3662, 0.0005, 'Wilson 81/263 upper');
const nd = newcombeDifference(48, 80, 56, 70);
near(nd.difference, 0.2, 1e-12, 'Newcombe example: 56/70 − 48/80');
near(nd.lo, 0.0524, 0.0005, 'Newcombe method 10 lower'); near(nd.hi, 0.3339, 0.0005, 'Newcombe method 10 upper');
near(chiSquareP(3.841459, 1), 0.05, 1e-4, 'chi-square df 1 at 3.84 is 0.05');
near(chiSquareP(10.827566, 1), 0.001, 1e-5, 'chi-square df 1 at 10.83 is 0.001');
near(chiSquareP(5.991465, 2), 0.05, 1e-4, 'chi-square df 2 at 5.99 is 0.05');
ok(sampleRatio(tutor, { control: 560, policy: 440 }).mismatch, 'a 56/44 split of 1000 is a sample-ratio mismatch');

// ── Readout ─────────────────────────────────────────────────────────────────
const H = 3600 * 1000;
const T0 = Date.UTC(2026, 11, 1);
let seq = 0;
const row = (accountId, at, over = {}, def = tutor, arm = assignArm(def, accountId)) => ({
  account_id: accountId, occurred_at: at,
  payload_json: JSON.stringify({ correct: true, hintLevel: 0, mode: 'practice', subtopic: 'gen-a', dotpoint: 'dp-1', ...over,
    experiment: { assignments: [{ id: def.id, version: def.version, arm }], family: over.family || 'gen-a', ms: 30000 + (seq++ % 7) * 1000 } })
});
// An account with an index on gen-a and an outcome on gen-b ≥ 24 h later.
const pair = (id, success, def = tutor) => [row(id, T0, {}, def), row(id, T0 + 25 * H, { family: 'gen-b', subtopic: 'gen-b', correct: success }, def)];

// Twelve accounts — today's reality. The readout must refuse.
const twelve = ids.slice(0, 12).flatMap((id, i) => pair(id, i % 2 === 0));
const small = readout(tutor, twelve, { now: T0 + 30 * H });
eq([small.verdict, small.primary], ['insufficient-sample', null], 'twelve accounts: refused, no estimate');
ok(/Refused/.test(small.message) && !/better|worse|winner/i.test(small.message), 'the refusal names no direction or winner');
ok(!('difference' in small) && !JSON.stringify(small).includes('interval95'), 'no interval or difference is reported below the minimum');
eq(small.counts.control.assigned + small.counts.policy.assigned, 12, 'counts are still shown');
ok('helpRequestRate' in small.counts.control && 'helpRequestRate' in small.counts.policy, 'the help-request rate is reported per arm');

// At the minimum: an interval, and the decision rule.
const big = ids.slice(0, 1200).flatMap((id, i) => pair(id, assignArm(tutor, id) === 'policy' ? i % 10 < 7 : i % 10 < 5));
const full = readout(tutor, big, { now: T0 + 30 * H });
ok(full.counts.control.observedOutcomes >= 200 && full.counts.policy.observedOutcomes >= 200, 'the large set clears the minimum');
eq(full.verdict, 'decision-rule-met', 'a clear simulated difference meets the pre-registered rule');
ok(full.primary.interval95[0] > 0 && full.primary.interval95[0] < full.primary.difference, 'with an interval around the difference');
ok(/owner decision/.test(full.message), 'and still requires an owner decision');
const nullSet = ids.slice(0, 1200).flatMap((id, i) => pair(id, i % 2 === 0));
eq(readout(tutor, nullSet).verdict, 'decision-rule-not-met', 'no difference: the fixed ladder stays');

// Integrity: an arm that is not the account's assignment.
const forged = [...nullSet, row(ids[5], T0 + 50 * H, {}, tutor, assignArm(tutor, ids[5]) === 'policy' ? 'control' : 'policy')];
eq(readout(tutor, forged).verdict, 'stop-integrity', 'a forged arm stops the readout');

// SRM: drop most of one arm's accounts.
const lopsided = ids.slice(0, 1200).filter(id => assignArm(tutor, id) === 'policy' || Number(id.slice(-4)) % 3 === 0).flatMap(id => pair(id, true));
const srm = readout(tutor, lopsided);
eq([srm.verdict, srm.primary], ['stop-srm', null], 'a sample-ratio mismatch stops interpretation');

// Outcome rules.
const id0 = ids[0];
eq(primaryOutcomeOf([row(id0, T0), row(id0, T0 + 2 * H, { family: 'gen-b', subtopic: 'gen-b' })].map(r => ({ ...JSON.parse(r.payload_json), at: r.occurred_at })), 24), { observed: false }, 'an outcome sooner than 24 h is not an outcome');
eq(primaryOutcomeOf([row(id0, T0), row(id0, T0 + 30 * H, { family: 'gen-a' })].map(r => ({ ...JSON.parse(r.payload_json), at: r.occurred_at })), 24), { observed: false }, 'the same family is not transfer');
eq(primaryOutcomeOf([row(id0, T0), row(id0, T0 + 30 * H, { family: 'gen-b', dotpoint: 'dp-9' })].map(r => ({ ...JSON.parse(r.payload_json), at: r.occurred_at })), 24), { observed: false }, 'another skill is not this skill');
eq(primaryOutcomeOf([row(id0, T0), row(id0, T0 + 30 * H, { family: 'gen-b', hintLevel: 1 })].map(r => ({ ...JSON.parse(r.payload_json), at: r.occurred_at })), 24), { observed: false }, 'a hinted outcome is not independent');
eq(primaryOutcomeOf([row(id0, T0), row(id0, T0 + 30 * H, { family: 'gen-b', policyAssistance: [{ action: 'self-check', level: 'A2' }] })].map(r => ({ ...JSON.parse(r.payload_json), at: r.occurred_at })), 24), { observed: false }, 'an outcome the policy helped is not independent');
eq(primaryOutcomeOf([row(id0, T0), row(id0, T0 + 30 * H, { family: 'gen-b', revealed: true, correct: false })].map(r => ({ ...JSON.parse(r.payload_json), at: r.occurred_at })), 24), { observed: false }, 'a reveal is not an outcome');
eq(primaryOutcomeOf([row(id0, T0), row(id0, T0 + 30 * H, { family: 'gen-b', policyAssistance: [{ action: 'confirm-reading', level: 'A0' }] })].map(r => ({ ...JSON.parse(r.payload_json), at: r.occurred_at })), 24), { observed: false }, 'ANY help request excludes the item, even an A0 offer — the same rule in both arms');
eq(primaryOutcomeOf([row(id0, T0), row(id0, T0 + 30 * H, { family: 'gen-b', policyAssistance: [{ action: null, level: null }] })].map(r => ({ ...JSON.parse(r.payload_json), at: r.occurred_at })), 24), { observed: false }, 'a control-arm request (no plan) excludes the item too');
eq(primaryOutcomeOf([row(id0, T0), row(id0, T0 + 30 * H, { family: 'gen-b', correct: false })].map(r => ({ ...JSON.parse(r.payload_json), at: r.occurred_at })), 24).success, false, 'an unhelped wrong outcome is a failure');
const exam = readout(tutor, ids.slice(0, 12).flatMap(id => pair(id, true)).map(r => ({ ...r, payload_json: r.payload_json.replace('"mode":"practice"', '"mode":"exam"') })));
eq(exam.counts.control.assigned + exam.counts.policy.assigned, 0, 'exam-mode attempts never count');
eq(readout(tutor, [{ account_id: id0, occurred_at: T0, payload_json: JSON.stringify({ correct: true, mode: 'practice' }) }]).counts.control.assigned + readout(tutor, [{ account_id: id0, occurred_at: T0, payload_json: JSON.stringify({ correct: true, mode: 'practice' }) }]).counts.policy.assigned, 0, 'unstamped events (experiment off) are not in the experiment');

// Guardrails: give-up rate.
const givesUp = ids.slice(0, 400).flatMap(id => [...pair(id, true), row(id, T0 + 40 * H, { revealed: assignArm(tutor, id) === 'policy', correct: false })]);
ok(readout(tutor, givesUp).guardrails.find(g => g.id === 'give-up-rate').breached, 'a reveal-rate rise in the policy arm breaches the guardrail');
eq(readout(tutor, givesUp).manualGuardrails.map(g => g.id), ['complaint-reports'], 'complaints are a manual guardrail, said to be uninstrumented');

// A/A on the same machinery.
const aaRows = ids.slice(0, 1200).flatMap((id, i) => pair(id, i % 2 === 0, aa));
eq(readout(aa, aaRows).verdict, 'aa-pass', 'an A/A with no difference passes');

console.log(`EXPERIMENTS: PASS — ${count}/${count} checks`);
