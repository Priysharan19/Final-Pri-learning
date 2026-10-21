// Regression: local generated email and real-provider acceptance assertions agree.
// No real inbox, network request, provider key, or account data is used here.
import assert from 'node:assert/strict';
import { otpEmailMessage } from '../../server/platform/otpEmail.js';

let assertions = 0;
const code = '123456';
for (const purpose of ['sign-in', 'guardian-consent']) {
  const message = otpEmailMessage(code, purpose, 'http://127.0.0.1:60123');
  const subjectTail = purpose === 'guardian-consent'
    ? ' is the code to approve your child’s Pri Learning account'
    : ' is your Pri Learning code';
  assert.equal(message.subject, code + subjectTail); assertions++;
  assert.ok(message.text.startsWith(code + String.fromCharCode(10, 10))); assertions++;
  assert.ok(message.html.includes('aria-label="Code 1 2 3 4 5 6"')); assertions++;
  assert.ok(message.html.includes('>123&nbsp;456</div>')); assertions++;
  assert.match(message.text, /valid for 10 minutes/i); assertions++;
  assert.match(message.html, /This code works for 10 minutes and only once/i); assertions++;
  if (purpose === 'guardian-consent') {
    assert.ok(message.text.includes('http://127.0.0.1:60123/guardian/consent')); assertions++;
    assert.ok(message.html.includes('href="http://127.0.0.1:60123/guardian/consent"')); assertions++;
  } else {
    assert.equal(message.html.includes('href='), false, 'sign-in code must not contain a clickable link'); assertions++;
  }
}
console.log('AUTH EMAIL TEMPLATE CONTRACT: PASS', assertions, 'checks; no provider or real inbox');
