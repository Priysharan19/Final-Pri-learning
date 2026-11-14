// Pri Learning · a server-issued practice request names the profile's own course.
//
// The device asked POST /v1/practice/issue for every question with
// curriculum 'in', whatever the student's course. A Prithagoras server issues
// only the NSW course (server/platform/editionBanks.js) and refused every such
// request, so a signed-in NSW student only ever got drafts that cannot be
// marked. This suite pins the request the device sends:
//   · practiceCurriculumOf: an India profile names 'in', an NSW profile 'nsw',
//     a profile with no course is NSW (the backend's default everywhere);
//   · through the product's dispatcher, against the real server: an India
//     profile's issue names 'in' and is issued (Priyabhata, unchanged), an NSW
//     profile's names 'nsw' (here on a test server that may issue NSW banks,
//     allowBanksOutsideIndiaForTests) and is issued, never a draft.
// The Prithagoras round trip in a browser (issued, Submit, marked by the
// server) is client/test/tour-nsw-practice-marked.js.
//
// Usage: node client/test/practice-course-request-check.mjs

import { installBrowserEnv, resetStorage } from './backend-check.mjs';

installBrowserEnv();
resetStorage();
const { startOnlineAuthority } = await import('./support/online-authority.mjs');
const authority = await startOnlineAuthority({ label: 'practice-course', nswBanks: true });

const { dispatch, practiceCurriculumOf } = await import('../src/local/backend.js');
const { loadAllBanks } = await import('../src/engine/generators/index.js');
await loadAllBanks();

let pass = 0;
const failures = [];
const ok = (name, condition, detail = '') => { if (condition) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const same = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
const POST = (path, body = {}) => dispatch('POST', path, body);

try {
  // ── the course a request names ─────────────────────────────────────────────
  same('an India profile names the India course', practiceCurriculumOf({ course: 'in' }), 'in');
  same('an NSW profile names the NSW course', practiceCurriculumOf({ course: 'nsw' }), 'nsw');
  same('a profile with no course is NSW, as everywhere in the backend', practiceCurriculumOf({}), 'nsw');
  same('no profile at all is NSW too', practiceCurriculumOf(null), 'nsw');
  same('an unknown course is never sent', practiceCurriculumOf({ course: 'xx' }), 'nsw');

  // ── India: unchanged ───────────────────────────────────────────────────────
  const asha = (await POST('/profiles', { name: 'Asha', year: 10, course: 'in' })).user;
  await authority.link(asha.id);
  let from = authority.traffic.curricula.length;
  const india = [];
  for (let i = 0; i < 3; i++) india.push(await POST('/practice/next', { mode: 'smart' }));
  same('an India profile\'s questions are issued by the server', india.map(r => r.question.checkState), ['issued', 'issued', 'issued']);
  same('every issue it sent named the India course', authority.traffic.curricula.slice(from), ['in', 'in', 'in']);

  // ── NSW: names its own course ──────────────────────────────────────────────
  const noah = (await POST('/profiles', { name: 'Noah', year: 10, course: 'nsw' })).user;
  await POST('/profiles/select', { id: noah.id });
  await authority.link(noah.id);
  from = authority.traffic.curricula.length;
  const nsw = [];
  for (let i = 0; i < 3; i++) nsw.push(await POST('/practice/next', { mode: 'smart' }));
  same('every issue an NSW profile sent named the NSW course', authority.traffic.curricula.slice(from), ['nsw', 'nsw', 'nsw']);
  same('and the server issued them: no unmarkable draft', nsw.map(r => r.question.checkState), ['issued', 'issued', 'issued']);
} catch (err) {
  failures.push(`the suite stopped: ${err.stack || err.message}`);
} finally {
  await authority.close();
}

const total = pass + failures.length;
if (failures.length) {
  console.log(`PRACTICE COURSE REQUEST: FAIL — ${failures.length} of ${total} checks failed\n  · ${failures.join('\n  · ')}`);
  process.exit(1);
}
console.log(`PRACTICE COURSE REQUEST: PASS — ${pass}/${total} checks — issue requests name the profile's own course (India 'in', NSW 'nsw'), and both are issued by the server`);
