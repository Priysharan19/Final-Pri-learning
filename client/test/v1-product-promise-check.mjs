// KALP-R1 · public V1 product-to-promise regression gate.
// This is deliberately narrower than feature coverage: it protects the public
// launch boundary and the Free/Premium/privacy wording from drifting away from
// the authorities that actually enforce it.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { featureStates } from '../vite.config.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = rel => readFileSync(join(ROOT, rel), 'utf8');
const login = read('client/src/pages/Login.jsx');
const settings = read('client/src/pages/SettingsLegacy.jsx');
const en = (await import('../src/i18n/strings.en.js')).default;
const hi = (await import('../src/i18n/strings.hi.js')).default;
const readme = read('README.md');
const privacy = read('docs/legal/privacy.md').replace(/\s+/g, ' ');
const privacyHi = read('docs/legal/privacy.hi.md').replace(/\s+/g, ' ');
const { FREE_TIER } = await import('../src/local/entitlementGate.js');
const { ENTITLEMENTS } = await import('../src/platform/entitlements.js');

let pass = 0;
const failures = [];
const ok = (condition, label) => condition ? pass++ : failures.push(label);
const same = (actual, expected, label) => ok(Object.is(actual, expected), `${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

// Authority values — UI copy must consume these rather than fork them.
same(FREE_TIER.practicePerDay, 20, 'Free practice authority remains 20/day');
same(FREE_TIER.examsPerWindow, 1, 'Free exam authority remains one simulation per window');
same(FREE_TIER.examWindowDays, 30, 'Free exam window remains 30 days');
same(FREE_TIER.explain, 'basic', 'Free Pri Explain remains basic');
ok(ENTITLEMENTS.JEE_ADVANCED === 'jee-advanced-content', 'JEE Advanced remains a Premium capability');
ok(ENTITLEMENTS.EXTRA_AI === 'additional-ai-usage', 'reserved extra-AI capability remains declared, not silently repurposed');

// Public onboarding: actual source that production Vite builds. main's
// onboarding is build-flag scoped (PRI_FEATURE_EXTENDED_TRACKS for Olympiad and
// the Teacher role, PRI_FEATURE_AUSTRALIA for the Australian syllabuses); a
// production build records both flags off, so the public V1 door is exactly
// Student × Classes 7–12 / JEE Main / JEE Advanced. The code paths stay in the
// repository for flagged builds and for profiles that already hold them.
const production = featureStates('build', {});
ok(production.extendedTracks === false && production.australia === false,
  'a production build records the extended-tracks and Australia flags off');
ok(/\{ key: 'olympiad'[^\n]*extended: true \}/.test(login), 'the Olympiad entry is marked extended, never a plain public track');
ok(/STUDY\.filter\(o => !o\.extended \|\| extended\)/.test(login), 'the public study list filters extended tracks by the build flag');
ok(/extended \? \['student', 'teacher'\] : \['student'\]/.test(login), 'the Teacher role is offered to new profiles only in an extended build');
ok(/\{roles\.includes\('teacher'\) && \(/.test(login), 'the Teacher onboarding control renders only when that role is offered');
ok(/if \(roleOptions\(\)\.length === 1\) draft\.role = roleOptions\(\)\[0\]/.test(login), 'with Student the only role the new public profile is already a Student');
ok(/\{featureEnabled\('australia'\) && \(/.test(login), 'the Australian curriculum catalogue is reachable only behind PRI_FEATURE_AUSTRALIA');
const kicker = login.match(/featureEnabled\('extendedTracks'\) \? '([^']*)' : '([^']*)'/);
ok(Boolean(kicker) && !/OLYMPIAD/.test(kicker[2]) && /CBSE · NCERT · JEE MAIN · JEE ADVANCED/.test(kicker[2]), 'the public hero kicker has no Olympiad claim');
ok(!/olympiad/i.test(en['login.heroSub'] + en['login.brandKicker'] + en['login.point1'] + hi['login.heroSub'] + hi['login.brandKicker'] + hi['login.point1']),
  'the static hero copy (shared by every build) makes no Olympiad claim');
ok(/\[7, 8, 9, 10, 11, 12\]/.test(login), 'Classes 7–12 remain offered');
ok(/key:\s*'jee-main'/.test(login), 'JEE Main remains offered');
ok(/key:\s*'jee-advanced'/.test(login), 'JEE Advanced remains offered');

// Reachable Settings may not be a back door around onboarding: the syllabus
// selector and the Olympiad track render only in a flagged build or for a
// profile that already holds one.
ok(/courseChoiceOffered = featureEnabled\('australia'\) \|\| user\.course !== 'in'/.test(settings) && /\{courseChoiceOffered && \(/.test(settings),
  'Settings offers the Australian catalogue only behind the flag or to a profile already on it');
ok(/olympiadOffered = featureEnabled\('extendedTracks'\) \|\| user\.indiaTrack === 'olympiad'/.test(settings) && /k !== 'olympiad' \|\| olympiadOffered/.test(settings),
  'Settings offers the Olympiad track only behind the flag or to a profile already on it');
ok(settings.includes('FREE_TIER.practicePerDay') && settings.includes('FREE_TIER.examsPerWindow') && settings.includes('FREE_TIER.examWindowDays'),
  'plan presentation reads all numeric Free limits from FREE_TIER');
const freeCopy = en['settings.localPlanSub'];
ok(/\{limit\}/.test(freeCopy) && /\{examLimit\}/.test(freeCopy) && /\{days\}/.test(freeCopy) && /basic Pri Explain/i.test(freeCopy),
  'English Free copy names the enforced limits and basic Explain');
ok(!/everything else unlimited|all courses|all pathways|all features/i.test([freeCopy, en['settings.allCourses'], en['settings.allFeatures']].join(' ')),
  'shipping plan copy contains none of the banned unlimited/all-course/all-feature claims');
ok(/JEE Advanced/.test(en['settings.allFeatures']) && /advanced Pri Explain/i.test(en['settings.allFeatures']) && /advanced progress/i.test(en['settings.allFeatures']),
  'Premium copy names the real advanced capability family');
ok(/Unlimited practice and exam simulations/.test(en['settings.allCourses']), 'Premium copy says the two Free caps are lifted');
ok(/completed local work, history and progress stay/i.test(en['settings.planWorkSafe']), 'plan copy says existing local work remains available');
ok(!/additional-ai-usage|Additional AI usage/i.test(Object.values(en).filter(v => typeof v === 'string').join('\n')), 'public English catalogue does not advertise reserved additional AI usage');
ok(!/price|trial|discount|offer/i.test([freeCopy, en['settings.allCourses'], en['settings.allFeatures'], en['settings.planWorkSafe']].join(' ')), 'KALP-R1 plan summary invents no pricing/trial/offer');
ok(!/बाकी सब असीमित|सभी कोर्स|सभी पाथवे/.test([hi['settings.localPlanSub'], hi['settings.allCourses'], hi['settings.allFeatures']].join(' ')), 'Hindi plan copy has no old all-inclusive claim');

// Canonical repository/product copy.
ok(!/Premium buys nothing yet/i.test(readme), 'README no longer says Premium buys nothing');
ok(/Premium is implemented but not release-certified/i.test(readme), 'README states the current Premium implementation/certification boundary');
ok(!/Australian syllabuses .*one link away/i.test(readme), 'README no longer advertises Australian public onboarding');
ok(!/Advanced or the olympiad/i.test(readme), 'README top-level launch description no longer advertises Olympiad');

// Public privacy/product wording. Legal identity is intentionally NOT guessed.
ok(!/whole app without an account and without a network/i.test(privacy), 'privacy notice no longer says the whole app is account/network-free');
ok(!/teacher can set work|your teacher/i.test(privacy), 'privacy notice makes no public teacher-work promise');
ok(/core maths-practice loop local/i.test(privacy) && /Some capabilities need an account or server connection/i.test(privacy), 'privacy notice distinguishes local core from server-dependent capability');
ok(/Paid access is granted only from subscription state verified by our server/i.test(privacy), 'privacy notice states server-authoritative paid access');
ok(/Last updated: 2 October 2026/i.test(privacy), 'English privacy revision date is concrete');
ok(!/पूरा ऐप बिना खाते|शिक्षक काम दे|आपके शिक्षक/.test(privacyHi), 'Hindi privacy notice removes the same whole-app/teacher claims');
ok(/अंतिम अद्यतन: 2 अक्टूबर 2026/.test(privacyHi), 'Hindi privacy revision date matches the revision');
const placeholders = text => [...new Set(text.match(/\{\{[A-Z_]+\}\}/g) || [])].sort();
const expectedExternal = ['{{GRIEVANCE_OFFICER_EMAIL}}','{{OWNER_ADDRESS}}','{{OWNER_LEGAL_NAME}}','{{SUPPORT_EMAIL}}'].sort();
ok(JSON.stringify(placeholders(privacy)) === JSON.stringify(expectedExternal), 'only externally authoritative privacy identity/contact fields remain unresolved');
ok(JSON.stringify(placeholders(privacyHi)) === JSON.stringify(expectedExternal), 'Hindi privacy has the same exact external legal fields');

const total = pass + failures.length;
console.log(failures.length
  ? `V1 PRODUCT PROMISE: FAIL — ${failures.length} of ${total} checks failed\n  · ${failures.join('\n  · ')}`
  : `V1 PRODUCT PROMISE: PASS — ${pass}/${pass} checks — public scope, plan copy and privacy product behaviour match the frozen V1 authorities.`);
process.exit(failures.length ? 1 : 0);
