// KALP-03 deterministic source/authority gate.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const read = rel => readFile(join(ROOT, rel), 'utf8');

const [login, backend, app, cloud, en, hi, e2e] = await Promise.all([
  read('src/pages/Login.jsx'),
  read('src/local/backend.js'),
  read('src/App.jsx'),
  read('src/components/CloudAccountPanel.jsx'),
  read('src/i18n/strings.en.js'),
  read('src/i18n/strings.hi.js'),
  read('test/e2e.mjs')
]);

// The cloud panel's copy lives in the i18n catalogue. Resolve the keys the
// panel names to their English so the checks below read what an English
// reader of the panel sees.
const cloudCatalogue = (await import(join(ROOT, 'src/i18n/strings.en.js'))).default;
const cloudCopy = [...cloud.matchAll(/\b(?:tx?|tLater)\(\s*'([a-z][A-Za-z]*\.[A-Za-z0-9]+)'/g)]
  .map(m => cloudCatalogue[m[1]]).filter(v => typeof v === 'string').join('\n');

let passed = 0;
const failures = [];
function check(name, ok) {
  if (ok) {
    passed += 1;
    console.log('  ✔ ' + name);
  } else {
    failures.push(name);
    console.log('  ✘ ' + name);
  }
}

check('onboarding has five steps', login.includes('ONBOARDING_STEPS = 5'));
check('draft begins as the frozen public Student role', login.includes("role: 'student'"));
check('draft begins without study', login.includes("study: ''"));
check('draft uses one in-memory authority', login.includes('useState(freshProfileDraft)'));
check('old method screen is removed', !login.includes("stage === 'method'"));
check('role step exists', login.includes('login.stepRoleTitle'));
check('course step exists', login.includes('login.stepCourseTitle'));
check('public study list excludes Olympiad', !/key:\s*['\"]olympiad['\"]/.test(login));
check('Australian course catalogue renders only behind the PRI_FEATURE_AUSTRALIA build flag', /\{featureEnabled\('australia'\) && \(/.test(login) && !login.includes('login.teachingInAustralia'));
check('personal step exists', login.includes('login.stepPersonalTitle'));
check('protect step exists', login.includes('login.stepProtectTitle'));
check('ready step exists', login.includes('login.stepReadyTitle'));
check('step heading receives focus', login.includes('stepHeadingRef.current?.focus'));
check('fixed Student role exposes pressed state and no Teacher creation branch', login.includes('className="pill-opt on" aria-pressed="true"') && !login.includes("role: 'teacher'"));
check('avatar controls expose pressed state', login.includes('aria-pressed={form.avatar === a}'));
check('errors use alert semantics', login.includes('id="onboarding-error" role="alert"'));
check('email remains explicitly local', login.includes('login.localCloudHonesty'));
check('cloud route remains canonical', login.includes("'/settings#cloud-account-title'"));
check('final create uses real profiles API', login.includes("go('/profiles', {"));
check('double submit is guarded', login.includes('createPendingRef.current'));
check('new public profiles land on Student Home', login.includes("if (created && !cloudIntent) nav('/', { replace: true })"));
check('public create payload forces Student', login.includes("role: 'student'"));
check('public create payload forces India curriculum', login.includes("course: 'in'"));
check('selected India track is persisted', login.includes("indiaTrack: form.course === 'in' ? form.indiaTrack : undefined"));
check('year is persisted as a number', login.includes('year: Number(form.year)'));
check('language uses existing authority', login.includes('language: signInLanguage()'));
check('avatar is persisted', login.includes('avatar: form.avatar'));
check('password only travels when protected', login.includes('password: form.protect ? form.password : undefined'));
check('backend rejects invalid year', backend.includes('Choose a supported class or year from 7 to 12.'));
check('backend rejects invalid curriculum', backend.includes('Choose a supported curriculum.'));
check('backend rejects invalid role', backend.includes('Choose Student or Teacher.'));
check('backend rejects invalid India track', backend.includes('Choose a supported India maths track.'));
check('backend rejects JEE below Class 11', backend.includes('JEE Main and JEE Advanced profiles must use Class 11 or 12.'));
check('backend rejects India track on Australia', backend.includes('An India maths track can only be used with the India curriculum.'));
check('backend rejects Year 11 Extension 2', backend.includes('Mathematics Extension 2 is only supported for Year 12.'));
check('backend still hashes passwords', backend.includes('p.auth = await hashPassword(pw)'));
check('backend still creates encrypted vault', backend.includes('createVault(pw)'));
check('teacher role still lands on /teach', app.includes("roleLanding = user.role === 'teacher' ? '/teach' : '/'"));
check('cloud panel names local profile boundary', cloudCopy.toLowerCase().includes('local profile'));
check('cloud panel names authenticated Pri Learning account', cloudCopy.includes('Pri Learning account') && cloudCopy.includes('authenticated cross-device sync'));
check('no passkey UI was invented', !login.toLowerCase().includes('passkey') && !login.toLowerCase().includes('webauthn'));
check('ready state keeps the no-diagnostic copy when placement is off', login.includes("featureEnabled('placement') ? 'login.placementOffer' : 'login.noFakeDiagnostic'"));
check('ready state names the optional placement check truthfully when it is on', login.includes('login.placementOffer'));
check('English has staged onboarding copy', en.includes("'login.stepRoleTitle'"));
check('Hindi has staged onboarding copy', hi.includes("'login.stepRoleTitle'"));
check('English has local cloud honesty copy', en.includes("'login.localCloudHonesty'"));
check('Hindi has local cloud honesty copy', hi.includes("'login.localCloudHonesty'"));
check('browser helper uses staged first step', e2e.includes('data-onboarding-step="1"'));
check('browser helper uses staged ready step', e2e.includes('data-onboarding-step="5"'));
check('browser helper refuses public Teacher creation', e2e.includes("role !== 'student'") && e2e.includes('Public V1 onboarding creates Student profiles only.'));
check('browser helper supports profile language', e2e.includes("language !== 'en'"));
check('browser helper supports cloud handoff', e2e.includes('cloud-account-title'));

const total = passed + failures.length;
console.log('');
console.log('KALP-03 ONBOARDING SOURCE CHECK — ' + passed + '/' + total + ' checks');
if (failures.length) throw new Error('KALP-03 source gate failed: ' + failures.join(', '));
console.log('KALP-03 SOURCE GATE: PASS');
