// Issue #622: the guardian notice a parent agrees to is the notice the server
// checks. The client and server name the same version, every confirmation
// path sends it, the page that does not show the notice cannot confirm, and
// the notice no longer claims nothing is sent before a guardian confirms.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const version = (source, name) => source.match(new RegExp(`${name} = '([0-9-]+)'`))?.[1];

const server = read('server/platform/guardianConsent.js');
const signUp = read('client/src/components/SignUpFlow.jsx');
const transport = read('client/src/platform/cloudTransport.js');
const guardianPage = read('client/src/pages/GuardianConsent.jsx');
const accountAction = read('client/src/pages/AccountAction.jsx');
const { default: en } = await import('../src/i18n/strings.en.js');
const { default: hi } = await import('../src/i18n/strings.hi.js');

let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };

const current = version(server, 'CONSENT_NOTICE_VERSION');
ok(current && current === version(signUp, 'GUARDIAN_NOTICE_VERSION'), 'client and server show and check the same notice version');
ok(/guardianConfirm: \(token, noticeVersion\) => [^\n]*approve: true, noticeVersion/.test(transport), 'the link confirmation sends approve and the notice version');
ok(guardianPage.includes('guardianConfirm(linkToken, GUARDIAN_NOTICE_VERSION)'), 'the parent page confirms the notice it renders');
ok(/<Notice t=\{t\} \/>[\s\S]*guardian-link-approve/.test(guardianPage), 'and renders it above the approve button');
ok(guardianPage.includes('noticeVersion: GUARDIAN_NOTICE_VERSION'), 'the code route sends the same version');
ok(!accountAction.includes('guardianConfirm('), 'the account-action page, which shows no notice, never confirms');
ok(guardianPage.includes('<GuardianLanguagePicker />'), 'both guardian channels offer an explicit language choice before the notice');
ok(guardianPage.includes('setLanguage(signInLanguage())'), 'the unprofiled guardian restores a remembered language');
ok(guardianPage.includes('rememberSignInLanguage(id)') && guardianPage.includes('lang={l.htmlLang}'),
  'the guardian language control remembers the choice and names the script for assistive technology');
ok(accountAction.includes('/guardian/consent#'), 'it sends a confirming guardian to the page that does');

for (const [lang, strings] of [['en', en], ['hi', hi]]) {
  for (const key of ['signup.noticeWhat', 'signup.noticeWhy', 'signup.noticeNot', 'signup.noticeWithdraw', 'signup.noticeVersion']) {
    ok(typeof strings[key] === 'string' && strings[key].trim(), `${lang} ${key} is present`);
  }
  ok(strings['signup.noticeVersion'].includes('{v}'), `${lang} notice version keeps its placeholder`);
}
ok(!/nothing of theirs is sent/i.test(en['signup.noticeNot']), 'English no longer says nothing is sent before confirmation');
ok(!hi['signup.noticeNot'].includes('कुछ भी नहीं भेजा जाता'), 'nor does Hindi');
ok(/name, class and contact/.test(en['signup.noticeNot']) && /नाम, कक्षा और संपर्क/.test(hi['signup.noticeNot']), 'both name what account setup sends');

console.log(`TASK 03 GUARDIAN NOTICE: PASS — ${checks}/${checks} checks — one notice version on both sides, bound to every confirmation, and the notice says what reaches the server before a guardian confirms.`);
