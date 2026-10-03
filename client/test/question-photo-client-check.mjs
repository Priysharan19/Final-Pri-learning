// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · "Practise this" client contract
//
//   · each failure (offline, signed out, unverified, consent, not set up,
//     provider down, allowance, not maths, unreadable, bad photo) is a named
//     state, never a crash and never a fake success;
//   · only the photo is sent, re-encoded to fit the transport;
//   · a proposal is kept only when this device's curriculum can serve it, and
//     its dot point comes from the device's covers, not from the reply;
//   · the practice link targets fresh generated questions of that skill.
// ─────────────────────────────────────────────────────────────────────────────
import { chapterChoices, identifyQuestionPhoto, localCandidates, practiseHrefFor, stateForError, PHOTO_STATES } from '../src/lib/questionPhoto.js';
import { practiceRequestFromQuery } from '../src/lib/practiceLinks.js';
import { IN_CHAPTER_BY_ID } from '../src/engine/curriculum-in.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const PHOTO = 'data:image/jpeg;base64,' + 'A'.repeat(4000);
const prepare = async url => (url ? { dataUrl: 'data:image/jpeg;base64,PREPARED' } : null);
const on = () => true;
const there = () => true;
const reply = identification => ({ identifyQuestionPhoto: async () => ({ identification }) });
const fail = (status, code) => ({ identifyQuestionPhoto: async () => { const e = new Error('x'); e.status = status; e.code = code; throw e; } });

// ── 1 · A good read ──────────────────────────────────────────────────────────
let sentImage = null;
const good = await identifyQuestionPhoto(PHOTO, {
  online: on, available: there, prepare,
  transport: { identifyQuestionPhoto: async (image) => { sentImage = image; return { identification: {
    isMathsQuestion: true, readable: true, questionText: 'Find the nature of the roots of 2x^2 - 4x + 3 = 0.',
    candidates: [
      { chapterId: 'c10-quadratic-equations', skillId: 'c10-quadratic-discriminant', dotpoint: 0, confidence: 0.9 },
      { chapterId: 'c10-quadratic-equations', skillId: 'not-a-generator', confidence: 0.5 },
      { chapterId: 'made-up', skillId: 'c10-quadratic-roots', confidence: 0.5 }
    ], needsConfirmation: true
  } }; } }
});
eq(good.state, 'ok', 'a readable maths question is ok');
eq(sentImage, 'data:image/jpeg;base64,PREPARED', 'only the re-encoded photo is sent');
eq(good.candidates.length, 1, 'candidates this device cannot serve are dropped');
eq(good.candidates[0].dotpoint, 2, 'the dot point comes from the device covers, not the reply');
ok(/discriminant/i.test(good.candidates[0].dotpointText || ''), 'and the skill is described by its own dot point');
eq(good.questionText, 'Find the nature of the roots of 2x^2 - 4x + 3 = 0.', 'the recognised question is shown');

// ── 2 · The practice link is fresh practice of that skill ───────────────────
const href = practiseHrefFor({ chapterId: 'c10-quadratic-equations', dotpoint: 2 });
eq(href, '/practice?subtopic=c10-quadratic-equations&dotpoint=2', 'the link targets the chapter and the skill’s dot point');
const request = practiceRequestFromQuery(new URLSearchParams(href.split('?')[1]));
eq([request.mode, request.subtopic, request.dotpoint], ['topic', 'c10-quadratic-equations', 2], 'Practice reads it as topic practice on that dot point');
eq(practiseHrefFor({ chapterId: 'c10-probability' }), '/practice?subtopic=c10-probability', 'a changed chapter practises the whole chapter');
eq(practiseHrefFor({ chapterId: 'nope' }), null, 'an unknown chapter has no link');
const choices = chapterChoices();
ok(choices.length >= 50 && choices.every(c => IN_CHAPTER_BY_ID[c.id]), `every chapter is offered for correction (${choices.length})`);
eq(localCandidates(null), [], 'a missing candidate list is empty, not a crash');

// ── 3 · Honest failure states ────────────────────────────────────────────────
const cases = [
  ['offline', { online: () => false, available: there, prepare, transport: reply({}) }],
  ['not-configured', { online: on, available: () => false, prepare, transport: reply({}) }],
  ['bad-photo', { online: on, available: there, prepare: async () => null, transport: reply({}) }],
  ['signed-out', { online: on, available: there, prepare, transport: fail(401, 'AUTH_REQUIRED') }],
  ['unverified', { online: on, available: there, prepare, transport: fail(403, 'EMAIL_UNVERIFIED') }],
  ['consent', { online: on, available: there, prepare, transport: fail(403, 'GUARDIAN_CONSENT_REQUIRED') }],
  ['allowance', { online: on, available: there, prepare, transport: fail(429, 'AI_ALLOWANCE_EXHAUSTED') }],
  ['not-configured', { online: on, available: there, prepare, transport: fail(503, 'QUESTION_PHOTO_NOT_CONFIGURED') }],
  ['provider-down', { online: on, available: there, prepare, transport: fail(503, 'QUESTION_PHOTO_PROVIDER_5XX') }],
  ['provider-down', { online: on, available: there, prepare, transport: fail(503, 'PAID_CAPACITY_REACHED') }],
  ['offline', { online: on, available: there, prepare, transport: { identifyQuestionPhoto: async () => { throw new TypeError('Failed to fetch'); } } }],
  ['not-maths', { online: on, available: there, prepare, transport: reply({ isMathsQuestion: false, readable: true, candidates: [] }) }],
  ['unreadable', { online: on, available: there, prepare, transport: reply({ isMathsQuestion: true, readable: false, candidates: [] }) }],
  ['no-match', { online: on, available: there, prepare, transport: reply({ isMathsQuestion: true, readable: true, questionText: 'q', candidates: [] }) }]
];
for (const [want, options] of cases) {
  const r = await identifyQuestionPhoto(PHOTO, options);
  eq(r.state, want, `→ ${want}`);
  ok(PHOTO_STATES.includes(r.state) && Array.isArray(r.candidates) && r.candidates.length === 0, `${want} carries no candidates`);
}
let reachedTransport = false;
await identifyQuestionPhoto(PHOTO, { online: () => false, available: there, prepare, transport: { identifyQuestionPhoto: async () => { reachedTransport = true; } } });
ok(!reachedTransport, 'offline, nothing is attempted');
eq(stateForError({ code: 'CLOUD_DISABLED' }), 'not-configured', 'a device with no cloud origin is not set up, not broken');

console.log(failures.length
  ? `QUESTION PHOTO CLIENT: FAIL — ${failures.length} of ${pass + failures.length}\n  · ${failures.join('\n  · ')}`
  : `QUESTION PHOTO CLIENT: PASS — ${pass}/${pass} checks — named failure states, photo-only request, device-validated proposals, fresh practice of the confirmed skill.`);
process.exit(failures.length ? 1 : 0);
