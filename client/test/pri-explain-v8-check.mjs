import assert from 'node:assert/strict';
import {
  TEACHING_MODES,
  adaptiveCheckpointPrompt,
  buildTeachingProfile,
  importantTeachingScene,
  teachingTimingScale,
  whyThisStep,
} from '../src/explain/adaptiveTeaching.js';

let checks = 0;
const check = (name, fn) => {
  try { fn(); checks++; }
  catch (err) { console.error(`FAIL V8 ${name}: ${err.message}`); process.exitCode = 1; }
};

const timeline = [
  { id: 'one', kind: 'solution', lines: ['First line'], visuals: [{ kind: 'focus' }] },
  { id: 'two', kind: 'solution', lines: ['Second line', 'Third line'], visuals: [{ kind: 'transform' }] },
  { id: 'three', kind: 'solution', lines: ['Fourth line'], visuals: [] },
];

check('strong clean session becomes a quick review', () => {
  const profile = buildTeachingProfile({
    payload: { correct: true },
    studentContext: { year: 11, difficulty: 2, session: { answered: 5, correct: 5 } },
    timeline,
  });
  assert.equal(profile.mode, TEACHING_MODES.RAPID);
  assert.ok(profile.timingScale < 1);
  assert.equal(profile.focus, null);
  assert.equal(profile.pauseAtKeyStep, false);
});

check('first wrong attempt always becomes targeted recovery', () => {
  const profile = buildTeachingProfile({
    payload: { correct: true, hadWrongAttempt: true },
    studentContext: { year: 12, difficulty: 1, session: { answered: 8, correct: 8 } },
    timeline,
  });
  assert.equal(profile.mode, TEACHING_MODES.RECOVERY);
  assert.equal(profile.focus.kind, 'attempt');
  assert.ok(profile.shouldOfferFollowUp);
  assert.ok(profile.pauseAtKeyStep);
});

check('marker diagnosis is reused verbatim as teaching focus', () => {
  const diagnosis = { title: 'Sign error', message: 'The sign changed on this line.', fix: 'Keep the sign with the term.', confidence: 'high' };
  const profile = buildTeachingProfile({ payload: { diagnosis }, timeline });
  assert.equal(profile.mode, TEACHING_MODES.RECOVERY);
  assert.equal(profile.focus.label, diagnosis.title);
  assert.equal(profile.focus.message, diagnosis.message);
  assert.equal(profile.focus.fix, diagnosis.fix);
});

check('confirmed misconception ledger drives recovery without inventing a label', () => {
  const misconception = { key: 'trap-x', label: 'Reads the vertex with the bracket sign', count: 3 };
  const profile = buildTeachingProfile({ payload: { misconception }, timeline });
  assert.equal(profile.mode, TEACHING_MODES.RECOVERY);
  assert.equal(profile.focus.kind, 'misconception');
  assert.equal(profile.focus.label, misconception.label);
  assert.match(profile.focus.message, /3/);
});

check('reveal-only recovery never fabricates a student attempt', () => {
  const profile = buildTeachingProfile({ payload: { correct: false, revealed: true }, timeline });
  assert.equal(profile.mode, TEACHING_MODES.RECOVERY);
  assert.equal(profile.focus, null);
  assert.match(profile.reason, /chose to reveal/i);
  assert.doesNotMatch(profile.reason, /your actual attempt/i);
});

check('hard junior work receives extra scaffolding without a fake misconception', () => {
  const profile = buildTeachingProfile({
    payload: { correct: true },
    studentContext: { year: 8, difficulty: 4, session: { answered: 2, correct: 2 } },
    timeline,
  });
  assert.equal(profile.mode, TEACHING_MODES.SCAFFOLDED);
  assert.equal(profile.focus, null);
  assert.ok(profile.timingScale > 1);
  assert.ok(profile.pauseAtKeyStep);
});

check('most structurally useful verified scene becomes the key teaching step', () => {
  assert.equal(importantTeachingScene(timeline, TEACHING_MODES.GUIDED), 1);
  const profile = buildTeachingProfile({ payload: { correct: true }, timeline });
  assert.equal(profile.importantSceneIndex, 1);
  assert.match(whyThisStep(timeline[1], profile, 1), /verified lines/);
  assert.equal(whyThisStep(timeline[0], profile, 0), '');
});

check('recovery prefers the actual diagnosis scene', () => {
  const recoveryTimeline = [
    { id: 'diagnosis', kind: 'diagnosis', concept: 'diagnosis', lines: ['Compare'], visuals: [{ kind: 'attempt' }] },
    ...timeline,
  ];
  const profile = buildTeachingProfile({ payload: { hadWrongAttempt: true }, timeline: recoveryTimeline });
  assert.equal(profile.importantSceneIndex, 0);
  assert.match(whyThisStep(recoveryTimeline[0], profile, 0), /your attempt/);
  assert.match(adaptiveCheckpointPrompt(recoveryTimeline[0], profile, 0), /original attempt/);
});

check('scaffolded transform checkpoint asks for retrieval without inventing maths', () => {
  const profile = buildTeachingProfile({
    payload: { correct: true },
    studentContext: { year: 8, difficulty: 4 },
    timeline,
  });
  const prompt = adaptiveCheckpointPrompt(timeline[1], profile, 1);
  assert.match(prompt, /describe what changed/);
  assert.ok(!/[=+*/^]/.test(prompt));
});

check('rapid and non-key scenes do not create adaptive checkpoints', () => {
  const rapid = buildTeachingProfile({
    payload: { correct: true },
    studentContext: { year: 11, difficulty: 1, session: { answered: 5, correct: 5 } },
    timeline,
  });
  assert.equal(adaptiveCheckpointPrompt(timeline[rapid.importantSceneIndex], rapid, rapid.importantSceneIndex), '');
  const scaffolded = buildTeachingProfile({ payload: { correct: true }, studentContext: { year: 8, difficulty: 4 }, timeline });
  assert.equal(adaptiveCheckpointPrompt(timeline[0], scaffolded, 0), '');
});

check('key step receives extra time but timing remains bounded', () => {
  const profile = buildTeachingProfile({
    payload: { correct: true },
    studentContext: { year: 8, difficulty: 4 },
    timeline,
  });
  const ordinary = teachingTimingScale(profile, 0);
  const key = teachingTimingScale(profile, profile.importantSceneIndex);
  assert.ok(key >= ordinary);
  assert.ok(key <= 1.7);
});

if (!process.exitCode) console.log(`PRI EXPLAIN V8 ADAPTIVE TEACHING PASSED — ${checks}/${checks} checks`);
