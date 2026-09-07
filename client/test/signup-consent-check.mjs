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

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const read = rel => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const panel = read('../src/components/CloudAccountPanel.jsx');
const account = read('../src/platform/cloudAccount.js');

// ── 1 · The notice is at the point of consent ────────────────────────────────
ok(/href="\/privacy"/.test(panel), 'the registration form links the privacy notice');
ok(/href="\/terms"/.test(panel), 'and the terms');
ok(/checked=\{agreed\}/.test(panel), 'and requires an affirmative action rather than assuming agreement');
ok(/disabled=\{!!busy \|\| \(mode === 'register' && !agreed\)\}/.test(panel),
  'the account cannot be created until that action is taken');

// ── 2 · The age declaration is asked, not inferred ───────────────────────────
ok(/I am 18 or older/.test(panel), 'the form asks whether the account holder is an adult');
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
ok(/registerCloudAccount\(user\.id, \{[\s\S]{0,240}isAdult/.test(panel),
  'the age declaration is passed to registerCloudAccount');
ok(/guardianName: form\.guardianName/.test(panel) && /guardianEmail: form\.guardianEmail/.test(panel),
  'and so are the guardian details the student typed');
ok(/year: user\?\.year/.test(panel),
  'and the class, which is what makes a student a child even if they tick nothing');
ok(/cloud\.register\(\{[^)]*guardianEmail/.test(account),
  'and cloudAccount.js forwards every one of them to the server rather than dropping them');

// ── 4 · The student is told what waiting costs them, which is nothing ─────────
ok(/keeps working/i.test(panel) && /nothing is lost/i.test(panel),
  'the student is told the app keeps working while a guardian is asked — because it does');
ok(/email them a link/i.test(panel), 'and what will actually happen');

// ── 5 · It never overstates what the confirmation establishes ────────────────
ok(!/verifiable parental consent/i.test(panel),
  'the form does not call this verifiable parental consent — it is a confirmation from a mailbox');

console.log(failures.length
  ? `SIGNUP CONSENT: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `SIGNUP CONSENT: PASS — ${pass}/${pass} checks — the notice is at the point of consent, the age is asked rather than assumed, and every answer reaches the server.`);
process.exit(failures.length ? 1 : 0);
