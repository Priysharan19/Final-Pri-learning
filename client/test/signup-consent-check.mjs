// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what a student is told and asked before an account exists
//
// The notice has to be reachable at the point consent is sought, not only from
// a screen the student passed through earlier — and until now the single
// privacy link in the whole app was on the signed-out hero. A student could
// create a synced cloud account without ever being shown it.
//
// And every Class 7-12 student is a child under the DPDP Act, which draws its
// line at 18. The server will not sync a child's account until a guardian
// confirms, so the form has to ask — otherwise the account is created into a
// state it can never leave, and the student is never told why.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import en from '../src/i18n/strings.en.js';

// The interface copy lives in the i18n catalogue. Resolve every key a source
// file RENDERS — passes to t(), tx() or tLater() — to its English, so these
// assertions read what an English reader of that screen sees. A key merely
// mentioned in a comment or an unused table does not count.
const catalogue = en;
const englishOf = src => [...src.matchAll(/\b(?:tx?|tLater)\(\s*'([a-z][A-Za-z]*\.[A-Za-z0-9]+)'/g)]
  .map(m => catalogue[m[1]]).filter(Boolean)
  .flatMap(v => (typeof v === 'string' ? [v] : Object.values(v))).join('\n');

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const read = rel => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const panel = read('../src/components/CloudAccountPanel.jsx');
const account = read('../src/platform/cloudAccount.js');
const panelCopy = englishOf(panel);

// ── 1 · The notice is at the point of consent ────────────────────────────────
ok(/href="\/privacy"/.test(panel), 'the registration form links the privacy notice');
ok(/href="\/terms"/.test(panel), 'and the terms');
ok(/checked=\{agreed\}/.test(panel), 'and requires an affirmative action rather than assuming agreement');
// Two places make an account: the sign-in card (an emailed code or a web
// provider) and the native Apple sheet's consent step in the panel. Neither
// may proceed until the box is ticked.
const card = read('../src/components/SignUpFlow.jsx');
ok(/disabled=\{!!busy \|\| \(appleStep === 'consent' && !agreed\)\}/.test(panel),
  'the account cannot be created until that action is taken');
ok(/<input type="checkbox" checked=\{agreed\} data-testid="signup-agree"/.test(card) && /tx\('cloud\.consent'/.test(card)
  && /href="\/privacy"/.test(card) && /href="\/terms"/.test(card),
  'the sign-in card asks for the same affirmative agreement, with the notice and terms linked beside it');
ok(/if \(!agreed\) \{ setError\(tLater\('signup\.agreeRequired'\)\); return; \}/.test(card)
  && /if \(detailsReady\(\) && agreed && !account\) body\.profile = profile\(\);/.test(card),
  'and the card sends no account-creating request without it');

// ── 2 · The age declaration is asked, not inferred ───────────────────────────
ok(/I am 18 or older/.test(panelCopy), 'the form asks whether the account holder is an adult');
// And it is asked AT the point of consent: the adult question is the label of
// the checkbox inside the register form, and the guardian explanation renders
// exactly when that box is unticked, before the account exists.
ok(/\{needsSignIn && appleStep === 'consent' && \([\s\S]{0,1500}<input type="checkbox" checked=\{form\.isAdult\}[\s\S]{0,200}?\/>\s*<span>\{t\('cloud\.isAdult'\)\}<\/span>/.test(panel),
  'the adult question is the checkbox label inside the register form');
// The sign-in card asks the age outright (11–17, or 18 or older) and refuses to
// go on without an answer: silence is never read as "adult".
ok(/AGES\.map\(a => choice\(age === a/.test(card) && /'signup-age-18'/.test(card)
  && /if \(age === null\) \{ setError\(tLater\('signup\.ageRequired'\)\); return; \}/.test(card)
  && /isAdult: age === null \? undefined : age >= 18/.test(card),
  'the sign-in card asks the age explicitly and never infers an adult');
ok(/\{!form\.isAdult && \([\s\S]{0,300}tx\('cloud\.under18'/.test(panel),
  'and the under-18 explanation renders exactly when the box is unticked');
ok(/isAdult/.test(panel) && /guardianName/.test(panel) && /guardianEmail/.test(panel),
  'and collects a guardian when they are not');
// Read the whole <input> element rather than a fixed window after its id: the
// attribute sits on the next line and a short window missed it.
const guardianInputs = [...panel.matchAll(/<input[^>]*id="cloud-guardian-(name|email)"[\s\S]*?\/>/g)].map(m => m[0]);
ok(guardianInputs.length === 2, `both guardian fields are present (${guardianInputs.length})`);
ok(guardianInputs.every(tag => /\brequired\b/.test(tag)),
  'and both are required once the student says they are under 18');

// ── 3 · The declaration actually reaches the server ──────────────────────────
// A form that asks and then drops the answer is worse than one that never
// asked: the student believes a guardian will be emailed, and none is.
ok(/const appleDeclaration = \(\) => \(\{ year: user\?\.year, isAdult: form\.isAdult/.test(panel)
  && /startAppleSignIn\(\{ declaration: appleStep === 'consent' \? appleDeclaration\(\) : null \}\)/.test(panel),
  'the age declaration is passed to the account-creating request');
ok(/cloud\.otpVerify\(\{[^}]*signupTicket: ticket[^}]*profile: profile\(\) \}\)/.test(card)
  && /createAccount: true, name: p\.name, year: p\.year, isAdult: p\.isAdult, guardianLater: true/.test(card),
  'and the sign-in card sends its declaration with the request that creates the account (code or provider)');
ok(/guardianName: form\.guardianName/.test(panel) && /guardianEmail: form\.guardianEmail/.test(panel),
  'and so are the guardian details the student typed');
ok(/year: user\?\.year/.test(panel),
  'and the class, which is what makes a student a child even if they tick nothing');
ok(/cloud\.register\(\{[^)]*guardianEmail/.test(account),
  'and cloudAccount.js forwards every one of them to the server rather than dropping them');

// ── 4 · The student is told what waiting costs them, truthfully ───────────────
// Online-only grading: until a guardian confirms, answers cannot be checked.
// The student can keep writing, and is told so without a promise of marking.
ok(/keep writing/i.test(panelCopy) && /answers can be checked once they confirm/i.test(panelCopy)
  && !/marking and handwriting all run on this device/i.test(panelCopy),
  'the student is told they can keep writing while a guardian is asked, and that checking waits for the confirmation');
ok(/email them a link/i.test(panelCopy), 'and what will actually happen');

// ── 5 · It never overstates what the confirmation establishes ────────────────
ok(!/verifiable parental consent/i.test(panel) && !/verifiable parental consent/i.test(panelCopy),
  'the form does not call this verifiable parental consent — it is a confirmation from a mailbox');

// ── 6 · The guardian's link has somewhere to land ────────────────────────────
// The email points at /account-action. Until this was wired the page knew only
// about email verification, so a parent who followed the link got a screen that
// did nothing — a consent flow that cannot be answered is worse than none,
// because the student is told a guardian was asked.
const parser = read('../src/platform/accountAction.js');
ok(/'guardian-consent'/.test(parser), 'the account-action parser admits the guardian link');
const page = read('../src/pages/AccountAction.jsx');
const pageCopy = englishOf(page);
ok(/action === 'guardian-consent'/.test(page), 'and the page has a branch for it');
ok(/guardianConfirm/.test(page) && /guardianWithdraw/.test(page),
  'offering both answers on the one screen, so saying no is as easy as saying yes');
ok(/works on their device without an account|already works on their device/i.test(pageCopy),
  'and telling the parent the app works without the account, so consent is not extracted by false urgency');
ok(/href="\/privacy"/.test(page), 'with the notice reachable from the decision');

// ── 7 · The student can see where their account stands ───────────────────────
ok(/guardianState\(\)/.test(panel), 'the account panel asks the server for the consent state');
ok(/Waiting for a parent or guardian/i.test(panelCopy),
  'and a pending account reads as waiting for a parent rather than as a fault');
ok(/work is safe on this device/i.test(panelCopy), 'and says the work is safe, because it is');

console.log(failures.length
  ? `SIGNUP CONSENT: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `SIGNUP CONSENT: PASS — ${pass}/${pass} checks — the notice is at the point of consent, the age is asked rather than assumed, and every answer reaches the server.`);
process.exit(failures.length ? 1 : 0);
