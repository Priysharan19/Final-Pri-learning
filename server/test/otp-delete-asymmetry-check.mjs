// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · OTP delete vs in-app password delete — the asymmetry is
// documented and stays as documented (security review train 9, P2 #4).
//
// The public deletion page deletes on a mailbox code; the in-app delete asks
// for the password. That is accepted risk R-22 because the same mailbox can
// reset the password. This check pins the row to the code it describes, so a
// change to either side (a new public route, a password-less in-app delete, a
// lost rate limit, a code that is not purpose-bound) fails here until the
// risk register is updated with it.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
let pass = 0;
const failures = [];
const ok = (name, cond) => (cond ? pass++ : failures.push(name));

const risks = read('docs/security/accepted-risks.md');
const row = risks.split('\n').find(line => line.startsWith('| R-22 |')) || '';
ok('accepted-risks.md has an R-22 row', !!row);
for (const needle of ['/v1/otp/delete-confirm', 'DELETE /v1/account', 'authorizeFreshProof', '/password/reset-request', 'otp-delete-asymmetry-check'])
  ok(`R-22 names ${needle}`, row.includes(needle));

const otp = read('server/platform/otp.js');
const confirm = otp.slice(otp.indexOf("router.post('/delete-confirm'"), otp.indexOf("router.post('/delete-confirm'") + 1600);
ok('otp.js points the delete-confirm route at R-22', /R-22[\s\S]{0,400}router\.post\('\/delete-confirm'/.test(otp));
ok('delete-confirm is rate-limited', /router\.post\('\/delete-confirm', rateLimit\(/.test(otp));
ok('delete-request is rate-limited', /router\.post\('\/delete-request', rateLimit\(/.test(otp));
ok('the code is purpose-bound (reauth) and bound to the account at the address', /purpose: 'reauth'/.test(confirm) && /accountId: account\?\.id \|\| null/.test(confirm));
ok('the delete email says it deletes an account', /intent: 'account-delete'/.test(otp));
ok('phone-only synthetic addresses are refused', /PHONE_ACCOUNT_EMAIL_DOMAIN/.test(otp.slice(otp.indexOf("router.post('/delete-request'"), otp.indexOf("router.post('/delete-confirm'"))));

const accounts = read('server/platform/accounts.js');
const del = accounts.slice(accounts.indexOf("router.delete('/', requireSession(db)"), accounts.indexOf("router.delete('/', requireSession(db)") + 3000);
ok("the in-app delete still demands fresh proof", /authorizeAccountDeletion\(/.test(del) && /function authorizeAccountDeletion[\s\S]{0,400}authorizeFreshProof\(/.test(accounts));
const proof = accounts.slice(accounts.indexOf('export async function authorizeFreshProof'), accounts.indexOf('export async function authorizeFreshProof') + 1200);
ok('a password account must give its password (a mailbox code is not enough in-app)', /if \(row\.password_hash\) \{[\s\S]{0,300}REAUTH_REQUIRED[\s\S]{0,60}return \{ method: 'password' \}/.test(proof));
ok('a mailbox can reset the password (the reason R-22 is not an escalation)', /router\.post\('\/password\/reset-request'/.test(accounts) && /router\.post\('\/password\/reset'/.test(accounts));

console.log(failures.length
  ? `OTP DELETE ASYMMETRY: FAIL — ${failures.length} of ${pass + failures.length}\n  · ${failures.join('\n  · ')}`
  : `OTP DELETE ASYMMETRY: PASS — ${pass}/${pass} checks`);
process.exit(failures.length ? 1 : 0);
