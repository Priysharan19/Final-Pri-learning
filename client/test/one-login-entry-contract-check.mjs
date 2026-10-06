import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const login = readFileSync(new URL('../src/pages/Login.jsx', import.meta.url), 'utf8');
const en = readFileSync(new URL('../src/i18n/strings.en.js', import.meta.url), 'utf8');

// A normal visitor must never mistake a device-only profile for a signed-in Pri account.
assert.doesNotMatch(
  login,
  /className="btn btn-ghost btn-lg"[^>]*onClick=\{enter\}[^>]*>\{t\('login\.getStarted'\)\}/,
  'the hero must not expose the local-only profile flow as the ambiguous "Get Started" action'
);
assert.match(
  login,
  /data-testid="hero-offline"[^>]*onClick=\{enter\}[^>]*>\{t\('signup\.offline'\)\}/,
  'device-only mode must remain available, but only behind an explicit "Use without an account" action'
);
const hero = login.slice(login.indexOf("if (stage === 'hero')"), login.indexOf("/* ── account:", login.indexOf("if (stage === 'hero')")));
assert.doesNotMatch(
  hero,
  /onClick=\{cloudSignIn\}/,
  'the public welcome screen must not expose the legacy local-profile-then-cloud sign-in route'
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
  /await linkSignedInAccount\(r\.user\.id, account\);[\s\S]{0,320}api\.get\('\/me'\)/,
  'after linking, onboarding must re-read the authoritative profile view'
);
assert.match(
  login,
  /const linkedUser\s*=\s*\(await api\.get\('\/me'\)\)\.user;[\s\S]{0,220}setUser\(linkedUser\)/,
  'Practice must receive the refreshed cloud-linked user, not the stale pre-link profile'
);

assert.match(en, /'signup\.offline':\s*"Use without an account"/, 'offline entry copy must stay explicit');

console.log('PASS — normal entry is account-first; offline mode is explicit; cloud onboarding cannot silently land in Practice with an unlinked/stale profile.');
