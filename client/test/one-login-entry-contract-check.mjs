import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const login = readFileSync(new URL('../src/pages/Login.jsx', import.meta.url), 'utf8');
const en = readFileSync(new URL('../src/i18n/strings.en.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const signup = readFileSync(new URL('../src/components/SignUpFlow.jsx', import.meta.url), 'utf8');
const activation = readFileSync(new URL('../src/platform/accountActivation.js', import.meta.url), 'utf8');
const gate = readFileSync(new URL('../src/components/AccountActivationGate.jsx', import.meta.url), 'utf8');

// A normal visitor must never mistake a device-only profile for a signed-in Pri account.
assert.doesNotMatch(
  login,
  /className="btn btn-ghost btn-lg"[^>]*onClick=\{enter\}[^>]*>\{t\('login\.getStarted'\)\}/,
  'the hero must not expose the local-only profile flow as the ambiguous "Get Started" action'
);
assert.doesNotMatch(login, /data-testid="hero-offline"/,
  'first-run must never offer an offline profile as a way to bypass account activation');
assert.match(login, /data-testid="hero-existing-device"/,
  'existing local profiles remain recoverable without wiping prior saved work');
assert.match(app, /activated\?\.profileId !== user\.id[\s\S]*AccountActivationGate/,
  'the app shell is withheld until its local identity is explicitly activated');
assert.match(app, /onCloudSessionChange\(event => \{[\s\S]*if \(!sameIdentity\) setActivated\(null\)/,
  'logging out or changing cloud identity must relock, not same-account recovery');
assert.match(activation, /await verifyCloudSession\(pid\)/,
  'a local profile or link row cannot be accepted as an authenticated cloud session');
assert.match(activation, /session\.account\.emailVerified !== true/,
  'an absent or unknown email verification flag must fail closed');
assert.match(activation, /await cloud\.guardianState\(\)/,
  'the age and guardian verdict is checked against the server');
assert.match(activation, /await syncNow\(pid\)/,
  'the first sync must finish before main app access');
assert.doesNotMatch(activation, /result\.pending\s*>\s*0/,
  'legacy permanently blocked outbox entries must not prevent first activation');
assert.match(activation, /result\.requiresFullRescan/,
  'first activation must wait for the initial reconciliation');
assert.match(app, /accessDenied\.has\(error\?\.code\)/,
  'transient network errors must not eject the student from an active lesson');
assert.match(gate, /busy\.current = false; \};/,
  'StrictMode cleanup must allow activation to retry after effect remount');
assert.match(gate, /onFinish=\{finishExisting\}/,
  'existing profiles use the same verified onboarding without being recreated');

const hero = login.slice(login.indexOf("if (stage === 'hero')"), login.indexOf("/* ── account:", login.indexOf("if (stage === 'hero')")));
assert.doesNotMatch(
  hero,
  /onClick=\{cloudSignIn\}/,
  'the public welcome screen must not expose the legacy local-profile-then-cloud sign-in route'
);
assert.doesNotMatch(
  login,
  /onClick=\{\(\) => setCloudIntent\((?:true|false)\)\}/,
  'the device-profile wizard must not ask a student to switch identity modes mid-flow'
);
assert.match(
  en,
  /'login\.localOnlySub':\s*'(?![^']*(?:practice works|offline))[^']*checking answers needs a Pri account\.'/i,
  'explicit device-only mode must say that checking answers needs an account, and promise no offline practice (online-only grading)'
);

// Finishing real account onboarding is atomic: never enter Practice with a cloud session
// that failed to link to the active local profile, and never publish the stale pre-link user.
assert.doesNotMatch(
  login,
  /linkSignedInAccount\([^\n]+\)\.catch\(\(\) => \{\}\)/,
  'a failed cloud/local link must not be swallowed'
);
assert.match(
  login,
  /accountProfileRef\.current\?\.accountId === account\.id[\s\S]{0,520}if \(!pid\) \{[\s\S]{0,520}api\.post\('\/profiles'/,
  'a retry for the same signed-in account must reuse the first local profile instead of creating a duplicate'
);
assert.match(
  login,
   /await linkSignedInAccount\(pid, account\);[\s\S]{0,750}ensureAccountActivated\(pid, \{ expectedAccountId: account\.id \}\);/,
  'onboarding must verify account ID, consent and sync after linking and before opening Home'
);
assert.match(
  login,
  /const linkedUser\s*=\s*\(await api\.get\('\/me'\)\)\.user;[\s\S]{0,450}setUser\(linkedUser\)/,
  'Practice must receive the refreshed cloud-linked user, not the stale pre-link profile'
);

assert.doesNotMatch(signup, /data-testid="signup-parent-(later|continue)"/,
  'a child cannot postpone approval and enter the app');
assert.match(signup, /return \['method', 'code', 'age', 'class'/,
  'new accounts prove email first, then ask age and profile');
assert.match(signup, /const \[channel, setChannel\] = useState\('email'\)/,
  'email is the first and default identity method');
assert.match(activation, /guardian\.required && guardian\.state !== 'given'/,
  'a pending or withdrawn guardian consent blocks activation');
assert.match(en, /'signup\.ageAdult'/, 'the 18+ option remains selectable');

console.log('PASS — email-first account activation, age/guardian server authority, first-sync gate and existing profile preservation are enforced before Home or Practice.');
