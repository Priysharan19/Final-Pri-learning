// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · one way in: the sign-in card, then the activation gate
//
// Owner decision (issue #477, 2026-10-18): the landing screen is one sign-in
// card — email, then the six-digit code in the same card — and nothing of the
// app opens until the server has confirmed the account, its age/guardian
// decision and the first sync. There is no demo entry and no "use without an
// account" on the welcome screen any more; a profile saved on this device is
// still listed, and still passes the same gate.
//
// These are source contracts, read from the shipped files: the browser
// journeys (tour-activation-gate.js, tour-login.js) prove the behaviour.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = rel => readFileSync(new URL(rel, import.meta.url), 'utf8');
const login = read('../src/pages/Login.jsx');
const app = read('../src/App.jsx');
const card = read('../src/components/SignUpFlow.jsx');
const gate = read('../src/components/AccountActivationGate.jsx');
const activation = read('../src/platform/accountActivation.js');
const en = read('../src/i18n/strings.en.js');
const hi = read('../src/i18n/strings.hi.js');

// ── the landing screen ───────────────────────────────────────────────────────
assert.match(login, /<SignUpFlow variant="page" onFinish=\{finishAccount\} onStep=\{setCardStep\} \/>/,
  'the landing screen IS the sign-in card: email, code, name/age, class, in one card');
assert.doesNotMatch(login, /data-testid="hero-offline"|data-testid="hero-try-demo"|onClick=\{tryDemo\}|'\/profiles\/demo'/,
  'the welcome screen offers no device-only entry and no demo: nothing opens without an account');
assert.doesNotMatch(login, /data-testid="hero-sign-in-code"|openAccount\(/,
  'there is no separate "sign in with a code" screen to navigate to — the card is already on the landing screen');
assert.match(login, /data-testid="hero-existing-device"[^>]*onClick=\{enter\}/,
  'profiles already saved on this device remain reachable (the picker), without wiping prior work');
assert.match(login, /data-testid="picker-create-account"/, 'the picker offers another Pri account through the same card');
assert.doesNotMatch(login, /onClick=\{cloudSignIn\}/, 'the legacy local-profile-then-Settings cloud route is not offered on the welcome screen');
assert.doesNotMatch(login, /onClick=\{\(\) => setCloudIntent\((?:true|false)\)\}/,
  'the device-profile wizard must not ask a student to switch identity modes mid-flow');

// ── finishing the card is atomic: profile, link, server statement, first sync ─
assert.doesNotMatch(login, /linkSignedInAccount\([^\n]+\)\.catch\(\(\) => \{\}\)/, 'a failed cloud/local link must not be swallowed');
assert.match(login,
  /accountProfileRef\.current\?\.accountId === account\.id[\s\S]{0,520}if \(!pid\) \{[\s\S]{0,520}api\.post\('\/profiles'/,
  'a retry for the same signed-in account must reuse the first local profile instead of creating a duplicate');
assert.match(login,
  /await linkSignedInAccount\(pid, account\);[\s\S]{0,600}await ensureAccountActivated\(pid, \{ expectedAccountId: account\.id \}\);/,
  'after linking, onboarding asks the server about THIS account (session, age/guardian, first sync) before opening anything');
assert.match(login, /const linkedUser\s*=\s*\(await api\.get\('\/me'\)\)\.user;[\s\S]{0,320}if \(linkedUser\?\.id !== pid \|\| !linkedUser\.cloudLinked\) throw/,
  'the profile view is re-read after linking and refused unless it is this profile, linked');
assert.match(login, /setUser\(linkedUser\); activate\?\.\(ready\);/,
  'the profile and its server-confirmed activation are handed to the app together');

// ── the central gate: every route, until the server says so ──────────────────
assert.match(app, /if \(activated\?\.profileId !== user\.id\) \{[\s\S]{0,1600}<Route path="\*" element=\{<AccountActivationGate/,
  'App.jsx renders the activation gate for every route until the chosen profile has been let in this session');
assert.match(app, /<Route path="\/privacy" element=\{<Legal \/>\} \/>[\s\S]{0,400}<Route path="\*" element=\{<AccountActivationGate/,
  'the legal pages stay public behind the gate');
assert.match(app, /useEffect\(\(\) => \{ setActivated\(a => \(a && user\?\.id && a\.profileId === user\.id \? a : null\)\); \}, \[user\?\.id\]\);/,
  'a different profile is a different question: its activation starts over');
assert.match(app, /if \(!sameIdentity\) setActivated\(null\);/,
  'a sign-out, or another account or profile signing in (this tab or another), relocks the gate');
assert.match(app, /if \(!live\) return;\s*if \(activation\.isActivationDenied\(error\)\) setActivated\(null\);\s*else if \(offlineEntry && activation\.offlineGraceExpired\(offlineVerifiedAt\)\) setActivated\(null\);/,
  'the periodic recheck ejects only on the server\'s own refusal, or when an offline grace has run out');
assert.match(app, /window\.addEventListener\('online', online\)/, 'and asks the server again the moment the connection returns');
assert.match(gate, /ensureAccountActivated\(user\.id, \{ offlineGrace: true \}\)/,
  'only the gate\'s own check may use the 72-hour offline grace');
assert.match(app, /ensureAccountActivated\(user\.id, \{ sync: false \}\)/, 'the recheck of a profile already inside does not repeat the first sync');
assert.match(app, /if \(!user\?\.id \|\| activated\?\.profileId !== user\.id\) return undefined;\s*const pid = user\.id;\s*let uninstall = null;/,
  'the sync scheduler is installed only once the gate has let the profile in');
assert.match(app, /nav\('\/', \{ replace: true \}\);\s*setActivated\(null\);\s*setUser\(null\);/,
  'switching profile clears the activation with the profile');

// ── what the gate requires of the server ─────────────────────────────────────
assert.match(activation, /if \(!link\?\.accountId\) throw new ActivationBlocked\('ACCOUNT_NOT_LINKED'\);/, 'no link row, no entry');
assert.match(activation, /session = await verifyCloudSession\(pid\);/, 'a local link row is never accepted as a live session: /v1/account/me is asked');
assert.match(activation, /if \(String\(session\.account\.id\) !== String\(link\.accountId\)\) throw new ActivationBlocked\('ACCOUNT_MISMATCH'\);/,
  'the live session must be for the linked account');
assert.match(activation, /if \(session\.account\.emailVerified !== true\) throw new ActivationBlocked\('EMAIL_UNVERIFIED'\);/, 'an unproven contact fails closed');
assert.match(activation, /statement = await cloud\.guardianState\(\);[\s\S]{0,600}decideOnboardingAuthority\(link\.accountId, statement\)/,
  'the age/guardian verdict is the server\'s ONE bound statement, judged against the linked account');
assert.match(activation, /if \(authority\.outcome === 'changed'\) throw new ActivationBlocked\('ACCOUNT_MISMATCH'\);/,
  'a statement about another account (a second tab) is a mismatch, never a permission');
assert.match(activation, /if \(sync && !link\.lastSyncAt\) \{[\s\S]{0,400}await syncNow\(pid\);/, 'the first sync runs before the shell opens');
// The first sync binds the profile to the account (a completed sync whose
// status names this account); an older history the server only partly takes
// stays queued for the scheduler rather than locking a returning student out
// (account-activation-check.mjs proves both halves).
assert.match(activation, /!report\?\.lastSyncAt \|\| !status\?\.lastSyncAt \|\| String\(status\.accountId\) !== String\(link\.accountId\)\) \{\s*throw/, 'a first sync that did not complete for this account is not a first sync');
assert.doesNotMatch(activation, /status\.requiresFullRescan\) \{\s*throw/, 'and a partly accepted older history does not keep the student out');
assert.match(activation, /'FIRST_SYNC_PENDING', \{ cause: error, retryable: true \}/, 'a failed first sync is said as retryable, never as a sign-out');
assert.match(activation, /ACTIVATION_DENIED_CODES = Object\.freeze\(\[[^\]]*'GUARDIAN_CONSENT_PENDING', 'GUARDIAN_CONSENT_WITHDRAWN', 'AGE_DECLARATION_REQUIRED'/,
  'a pending or withdrawn guardian decision and a missing age are authoritative refusals');
assert.doesNotMatch(activation, /localStorage|sessionStorage|guardianApproved|consentGiven/, 'nothing cached — no client flag — decides activation');

// ── the gate's screens ───────────────────────────────────────────────────────
assert.match(gate, /data-testid="account-activation-gate" data-activation-status=\{status\}/, 'the gate names its state for the journeys');
for (const status of ['checking', 'signin', 'guardian', 'blocked', 'retry']) {
  assert.match(gate, new RegExp(`status === '${status}' && \\(`), `the gate has a "${status}" screen`);
}
assert.match(gate, /<SignUpFlow variant="inline"[^>]*allowCreate=\{link !== undefined && !link\?\.accountId\} onFinish=\{finishSignIn\} \/>/,
  'the gate\'s sign-in is the same card, inline, and never makes a second account for a profile already linked (nor before its link row has been read)');
assert.match(gate, /const ready = await ensureAccountActivated\(user\.id, \{ expectedAccountId: account\.id \}\);\s*onReady\(ready\);/,
  'the gate opens only on the server\'s confirmation, never on the link alone');
assert.match(gate, /if \(state\?\.state === 'given' \|\| state\?\.required === false\) void check\(\);/,
  'the waiting screen moves on when the SERVER says the guardian approved — never on a local flag');
assert.doesNotMatch(gate, /data-testid="(?:signup|activation)-parent-(?:later|continue)"/, 'there is no "ask them later" past a guardian');

// ── the card itself ──────────────────────────────────────────────────────────
assert.doesNotMatch(card, /data-testid="signup-parent-(later|continue)"/, 'a child cannot postpone approval and enter the app');
assert.match(card, /const \[channel, setChannel\] = useState\('email'\)/, 'email is the first and default identity method');
assert.match(card, /if \(result\.status === 'profile-required'\) \{[\s\S]{0,300}go\('age'\)/, 'a new address proves the mailbox first, then is asked who it is');
assert.match(card, /const authority = await readOnboardingAuthority\(signedInAccount\.id, \(\) => cloud\.guardianState\(\)\);/,
  'finishing re-reads the server\'s bound statement for the account that signed in');
assert.match(card, /if \(authority\.outcome === 'waiting'\) \{[\s\S]{0,200}return;/, 'a pending guardian decision never reaches onFinish');
assert.doesNotMatch(card, /navigate\(|useNavigate|location\.reload/, 'the card never navigates or reloads: the caller decides what opens');

// ── words, in both languages ─────────────────────────────────────────────────
for (const key of ['activation.waiting', 'activation.waitDetails', 'activation.signInTitle', 'activation.notComplete', 'activation.needsAttention',
  'activation.switchProfile', 'signup.parentBeforeEntry', 'signup.waitLimited', 'login.existingDeviceProfile', 'login.createAnotherAccount', 'signup.ageAdult']) {
  assert.match(en, new RegExp(`'${key.replace('.', '\\.')}':`), `${key} exists in English`);
  assert.match(hi, new RegExp(`'${key.replace('.', '\\.')}':`), `${key} exists in Hindi`);
}
assert.doesNotMatch(en, /'login\.tryDemo|'signup\.offline':/, 'the demo and "use without an account" copy are gone with the entries they named');

console.log('PASS — the landing screen is one sign-in card; every route is the activation gate until the server confirms the account, its age/guardian decision and the first sync; saved profiles are kept and pass the same gate; a child waits for a guardian with no way past.');
