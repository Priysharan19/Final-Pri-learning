// Pri Learning · the sign-in card's rules, without a browser.
//
// Two pure tables decide what a student types into and reads from the card:
// how a digit, a paste or an autofilled code lands in the six boxes
// (otpCode.js otpAfterInput), and which words a refusal becomes
// (signInErrors.js signInErrorCopy). Both are imported here exactly as shipped
// and exercised directly, plus the source contracts that make the card safe:
// one request per code, no account without an age and an agreement, nothing
// created for a profile that is only signing in again, and no claim the page
// cannot support.
//
// Usage:  node client/test/sign-in-card-check.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const read = rel => readFileSync(join(SRC, rel), 'utf8');
let pass = 0;
const failures = [];
const ok = (condition, label, detail = '') => { if (condition) pass++; else failures.push(`${label}${detail ? ` — ${detail}` : ''}`); };
const eq = (actual, expected, label) => ok(JSON.stringify(actual) === JSON.stringify(expected), label, `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);

// The two tables are plain modules; the components import them and nothing else decides.
const { signInErrorCopy, isNetworkFailure } = await import(pathToFileURL(join(SRC, 'components/signInErrors.js')).href);
const { otpAfterInput, otpDigits, OTP_LENGTH } = await import(pathToFileURL(join(SRC, 'components/otpCode.js')).href);
const GUARDIAN_NOTICE_VERSION = /export const GUARDIAN_NOTICE_VERSION = '([^']+)'/.exec(read('components/SignUpFlow.jsx'))?.[1];
ok(/import \{ isNetworkFailure, signInErrorCopy \} from '\.\/signInErrors\.js';/.test(read('components/SignUpFlow.jsx')) && /import \{ OTP_LENGTH, otpAfterInput, otpDigits \} from '\.\/otpCode\.js';/.test(read('components/OtpInput.jsx')),
  'the card and the code boxes use these same two modules');

// ── 1 · how a code lands in the boxes ────────────────────────────────────────
eq(OTP_LENGTH, 6, 'the code is six digits');
eq(otpDigits(' 12a-3 4 '), '1234', 'anything that is not a digit is dropped (spaces, dashes, words around a pasted code)');
eq(otpAfterInput('', 0, '4'), '4', 'a digit typed into the first box');
eq(otpAfterInput('4', 1, '8'), '48', 'the next digit lands in the next box');
eq(otpAfterInput('48392', 5, '0'), '483920', 'the sixth digit completes the code');
eq(otpAfterInput('', 0, '483920'), '483920', 'a whole code pasted into the first box fills all six');
eq(otpAfterInput('', 3, '483920'), '483920', 'a whole code pasted into the FOURTH box fills all six, in order');
eq(otpAfterInput('11', 5, ' 483 920 '), '483920', 'a pasted code with spaces replaces whatever was there');
eq(otpAfterInput('', 0, 'Your Pri Learning code is 483920. It is valid for 10 minutes'), '483920', 'only the first six digits of a pasted sentence are taken');
eq(otpAfterInput('12', 4, '9'), '129', 'a digit typed into a box beyond the end joins the end: no gap is ever left in the code');
eq(otpAfterInput('123456', 2, '9'), '129456', 'a digit typed over a filled box replaces that digit only');
eq(otpAfterInput('123', 1, ''), '123', 'an empty input changes nothing');
eq(otpAfterInput('123', 0, 'abc'), '123', 'letters change nothing');
eq(otpAfterInput('', 0, '4839201234'), '483920', 'more than six digits are cut to six');
const otp = read('components/OtpInput.jsx');
ok(/autoComplete=\{index === 0 \? 'one-time-code' : 'off'\}/.test(otp) && /inputMode="numeric"/.test(otp), 'the first box is autocomplete="one-time-code"; every box is a numeric keypad');
ok(/maxLength=\{OTP_LENGTH\}/.test(otp), 'every box accepts a whole code, so an autofill into any box is not cut to one digit');
ok(/onPaste=\{e => \{ e\.preventDefault\(\); fillFrom\(index, e\.clipboardData\.getData\('text'\)\); \}\}/.test(otp), 'a paste is handled in whichever box it lands');
ok(/aria-label=\{t\('signup\.codeDigit', \{ n: index \+ 1, total: OTP_LENGTH \}\)\}/.test(otp) && /role="group" aria-labelledby=\{labelledBy\}/.test(otp), 'each box is named and the six are one labelled group');
ok(/role="status" aria-live="polite"/.test(otp), 'progress is announced politely');
ok(/if \(clean\.length === OTP_LENGTH && clean !== value\) onComplete\?\.\(clean\);/.test(otp), 'the sixth digit completes once: re-rendering a full code does not submit again');
for (const key of ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End']) ok(otp.includes(`event.key === '${key}'`), `${key} is handled from the keyboard`);

// ── 2 · the words for every refusal ──────────────────────────────────────────
const key = (error, options) => signInErrorCopy(error, options).key;
eq(signInErrorCopy({ code: 'OTP_INVALID', status: 400, attemptsRemaining: 4 }), { key: 'signup.codeWrongLeft', vars: { count: 4, n: 4 }, kind: 'wrong' }, 'a wrong code says how many tries are left');
eq(key({ code: 'OTP_INVALID', status: 400, attemptsRemaining: 0 }), 'signup.codeLocked', 'the fifth wrong code says the code is spent and to ask for a new one');
eq(key({ code: 'OTP_INVALID', status: 400 }), 'signup.codeWrongOrExpired', 'a refusal with no count (expired, spent, superseded — the server does not say which) says "isn’t right, or it has expired"');
eq(key({ code: 'OTP_INVALID', status: 400 }, { expired: true }), 'signup.codeExpired', 'when the card\'s own clock says the ten minutes are up, it says expired');
eq(signInErrorCopy({ code: 'OTP_RATE_LIMITED', status: 429, retryAfterMs: 27000 }), { key: 'signup.rateLimited', vars: { n: 27 }, kind: 'rate' }, 'a cooldown says how many seconds to wait');
eq(key({ code: 'OTP_RATE_LIMITED', status: 429, retryAfterMs: 50 * 60 * 1000 }), 'signup.rateLimitedPlain', 'a long limit (the hourly cap) does not pretend to a countdown');
eq(key({ code: 'RATE_LIMITED', status: 429 }), 'signup.rateLimitedPlain', 'any other 429 is the same plain sentence');
eq(key({ code: 'ACCOUNT_LOCKED', status: 429 }), 'signup.passwordLocked', 'a locked password sign-in points at the email code');
eq(key({ code: 'BAD_CREDENTIALS', status: 401 }), 'signup.passwordWrong', 'a wrong password — or no such account; the words are the same for both');
eq(key({ code: 'OTP_DELIVERY_FAILED', status: 503 }), 'signup.deliveryFailed', 'a code that could not be sent is said as that');
eq(key({ code: 'OTP_EMAIL_NOT_CONFIGURED', status: 503 }), 'signup.codesOff', 'a deployment with no email sender is said as that');
eq(key({ code: 'OTP_DESTINATION_INVALID', status: 400 }), 'signup.emailInvalid', 'a malformed address');
eq(key({ code: 'AGE_DECLARATION_REQUIRED', status: 400 }), 'signup.ageRequired', 'a missing age declaration');
eq(key({ code: 'GUARDIAN_SAME_AS_STUDENT', status: 400 }), 'signup.parentNotYou', 'the student\'s own address offered as the guardian\'s');
eq(key({ code: 'GUARDIAN_CONSENT_WITHDRAWN', status: 409 }), 'cloud.guardianDeclined', 'a guardian\'s withdrawal is not something the student can undo');
eq(key({ code: 'IDENTITY_LINK_REQUIRED', status: 409 }), 'signup.socialUseEmail', 'a provider identity whose email already has an account');
eq(key({ code: 'CLOUD_LINK_CONFLICT' }), 'signup.otherAccount', 'a profile linked to a different account');
eq(key({ code: 'INK_ACCOUNT_MISMATCH' }), 'signup.otherAccount', 'the same, from the in-question sign-in');
eq(key({ code: 'INK_DRAFT_NOT_SAVED' }), 'signup.saveFirst', 'work that is not yet proven saved');
eq(key(new TypeError('Failed to fetch')), 'signup.offlineError', 'a request that never reached the server is "No connection" — nothing was spent');
eq(key(Object.assign(new Error('Timed out'), { name: 'TimeoutError', code: 23 })), 'signup.offlineError', 'a timeout (a DOMException, whose numeric code is not ours) is the same');
eq(key({ code: 'CLOUD_REQUEST_FAILED', status: 500 }), 'signup.serverDown', 'a 5xx is the server, not the connection');
eq(key({ code: 'CLOUD_DISABLED' }), 'signup.serverDown', 'no server reachable from this build');
eq(key({ code: 'SOMETHING_NEW', status: 400 }), 'signup.genericError', 'an unknown refusal gets the generic sentence, never the server\'s English prose');
ok(isNetworkFailure(new TypeError('x')) && !isNetworkFailure({ status: 400 }) && !isNetworkFailure({ code: 'OTP_INVALID' }) && !isNetworkFailure(null), 'only an error with no status and no string code counts as "never arrived"');
const en = (await import(pathToFileURL(join(SRC, 'i18n/strings.en.js')).href)).default;
const hi = (await import(pathToFileURL(join(SRC, 'i18n/strings.hi.js')).href)).default;
const everyKey = [
  { code: 'OTP_INVALID', status: 400, attemptsRemaining: 2 }, { code: 'OTP_INVALID', status: 400, attemptsRemaining: 0 }, { code: 'OTP_INVALID', status: 400 },
  { code: 'OTP_RATE_LIMITED', status: 429, retryAfterMs: 5000 }, { code: 'OTP_RATE_LIMITED', status: 429 }, { code: 'ACCOUNT_LOCKED', status: 429 },
  { code: 'BAD_CREDENTIALS', status: 401 }, { code: 'OTP_DELIVERY_FAILED', status: 503 }, { code: 'OTP_SMS_NOT_CONFIGURED', status: 503 },
  { code: 'OTP_DESTINATION_INVALID', status: 400 }, { code: 'PROFILE_NAME_REQUIRED', status: 400 }, { code: 'AGE_DECLARATION_REQUIRED', status: 400 },
  { code: 'GUARDIAN_SAME_AS_STUDENT', status: 400 }, { code: 'GUARDIAN_CONSENT_WITHDRAWN', status: 409 }, { code: 'IDENTITY_LINK_REQUIRED', status: 409 },
  { code: 'OIDC_NONCE_INVALID', status: 401 }, { code: 'OIDC_PROVIDER_NOT_CONFIGURED', status: 503 }, { code: 'SOCIAL_POPUP_BLOCKED' }, { code: 'SOCIAL_TIMEOUT' },
  { code: 'CLOUD_LINK_CONFLICT' }, { code: 'INK_PROFILE_CHANGED' }, { code: 'INK_DRAFT_NOT_SAVED' }, new TypeError('x'), { code: 'X', status: 500 }, { code: 'X', status: 400 }
].map(e => signInErrorCopy(e).key);
eq(everyKey.filter(k => !(k in en)), [], 'every sentence the card can say exists in English');
eq(everyKey.filter(k => !(k in hi)), [], 'and in Hindi');
ok(!/account (does not|doesn't) exist|no account (with|for) that/i.test(Object.entries(en).filter(([k]) => /^signup\.(password|code|rate|delivery|offline|server)/.test(k)).map(([, v]) => JSON.stringify(v)).join(' ')),
  'no code or password message says whether an account exists');

// ── 3 · what the card may and may not do ─────────────────────────────────────
const card = read('components/SignUpFlow.jsx');
ok(/const verifying = useRef\(false\);/.test(card) && /if \(verifying\.current\) return;/.test(card) && /finally \{ verifying\.current = false; \}/.test(card),
  'DUPLICATE SUBMIT: a synchronous guard lets one verify request through — the sixth digit and the button cannot both send');
ok(/const sending = useRef\(false\);/.test(card) && /if \(sending\.current \|\| busy\) return;/.test(card), 'and one "send a code" at a time');
ok(/if \(finishing\.current\) return finishing\.current;/.test(card), 'and the hand-off to the page happens once');
ok(/if \(Date\.now\(\) >= challenge\.expiresAt\) \{[\s\S]{0,200}signup\.codeExpired/.test(card), 'an expired code is answered from the card\'s clock without a request');
ok(/if \(!isNetworkFailure\(err\)\) \{ setInvalid\(err\?\.code === 'OTP_INVALID'\); setCode\(''\); \}/.test(card), 'a request that never arrived keeps the typed digits');
ok(/cloud\.otpRequest\(\{ channel, destination: to \}\)/.test(card) && !/otpRequest\([^)]*(password|name|profile)/.test(card), 'asking for a code sends the address and nothing else');
ok(/if \(age === null\) \{ setError\(tLater\('signup\.ageRequired'\)\); return; \}\s*if \(!agreed\) \{ setError\(tLater\('signup\.agreeRequired'\)\); return; \}/.test(card),
  'no account-creating request without an age AND the agreement');
ok(/isAdult: age === null \? undefined : age >= 18/.test(card), 'an unanswered age is sent as undefined (the server refuses it), never as an adult');
ok(/result\.status === 'profile-required' && !allowCreate/.test(card) && /if \(!allowCreate\) \{ setBusy\(''\); setError\(tLater\('signup\.noAccountForRelink'\)\); return; \}/.test(card),
  'a profile already linked to an account can sign in again but can never become a second account (code or provider)');
ok(/createAccount: false \}\)/.test(card), 'a provider sign-in asks the server NOT to create an account; creation needs the age step first');
ok(/\{\(providers\.google \|\| providers\.apple\) && \(/.test(card) && /\{providers\.google && <button/.test(card) && /\{providers\.apple && <button/.test(card),
  'Google and Apple render only when the server reports them configured');
ok(/\{channels\.sms && \(\s*<button type="button" className="linklike" data-testid=\{isSms \? 'signup-channel-email' : 'signup-channel-sms'\}/.test(card),
  'a phone code is offered only when the server reports an SMS provider');
ok(/cloud\.otpChannels\(\)/.test(card) && /useState\(\{ email: true, sms: false \}\)/.test(card), 'until the server answers, the card assumes email only — never a phone it cannot text');
ok(!/navigate\(|useNavigate|window\.location\.(assign|replace|href\s*=)|location\.reload/.test(card), 'the card never navigates or reloads: every step renders in place');
ok(!/transcribe|recogni[sz]e|readOnePage|submitAnswer|grade\(/i.test(card), 'and never reads handwriting or submits an answer: signing in costs no paid read');
ok(!/localStorage|sessionStorage|document\.cookie/.test(card), 'it stores nothing itself: no code, token or address in web storage');
ok(!/console\.(log|info|debug|warn|error)/.test(card) && !/console\./.test(otp), 'and logs nothing — a code can never reach the console');
ok(!/encrypt|secure(ly)?\b|safe(ly)? stored|backed up/i.test(Object.entries(en).filter(([k]) => /^signup\.(inline|code|about|password|continue|with|use|agree|verify|signing)/.test(k)).map(([, v]) => JSON.stringify(v)).join(' ')),
  'the card makes no claim about encryption, security or backup');
const serverNotice = /CONSENT_NOTICE_VERSION = '([^']+)'/.exec(readFileSync(fileURLToPath(new URL('../../server/platform/guardianConsent.js', import.meta.url)), 'utf8'))?.[1];
eq(GUARDIAN_NOTICE_VERSION, serverNotice, 'the notice version the parent page sends is the server\'s current one');

// ── 4 · where it is mounted ──────────────────────────────────────────────────
const login = read('pages/Login.jsx');
const refusal = read('components/CheckRefusal.jsx');
const panel = read('components/CloudAccountPanel.jsx');
const question = read('components/QuestionCard.jsx');
ok(/<h1 className="hero-title">\{t\('login\.welcomeTitle'\)\}<\/h1>\s*<p className="hero-sub">\{t\('login\.welcomeSub'\)\}<\/p>/.test(login) && en['login.welcomeTitle'] === 'Welcome to Pri Learning' && en['login.welcomeSub'] === 'Your mathematics journey starts here.',
  'the landing screen is the card: "Welcome to Pri Learning" / "Your mathematics journey starts here."');
ok(/<SignUpFlow variant="page" onFinish=\{finishAccount\} onStep=\{setCardStep\} \/>/.test(login) && !/stage === 'account'/.test(login), 'mounted on the landing screen itself — there is no separate account screen to navigate to');
ok(/<SignInCard variant="inline"[\s\S]{0,200}allowCreate=\{user\?\.cloudLinked !== true\}/.test(refusal), 'every in-question sign-in is the same card, inline');
ok(/<SignInCard variant="inline"[\s\S]{0,160}allowCreate=\{!link\?\.accountId\} onFinish=\{cardSignedIn\} \/>/.test(panel), 'and so is Settings → Account');
ok(!/id="cloud-password"|registerCloudAccount|loginCloudAccount/.test(panel), 'the account panel no longer has a password registration form of its own');
ok(/<SignInChoices user=\{user\} refreshUser=\{refreshUser\} saved=\{saveState === 'saved'\}/.test(question) && !/React\.lazy\(\(\) => import\('\.\/(CloudAccountPanel|SignUpFlow)\.jsx'\)\)/.test(question),
  'the question card only mounts the shared sign-in; it carries no sign-in UI of its own');
ok(/data-cloud-synced=\{synced \? 'yes' : 'no'\}/.test(panel) && /const synced = canSync && !!status\?\.lastSyncAt && pending === 0 && !status\?\.lastError;/.test(panel),
  '"Progress synced" is derived from a live session, a completed sync, an empty outbox and no error — all four');
ok(/<details className="card cloud-advanced"/.test(panel) && panel.indexOf("t('cloud.outboxClear')") > panel.indexOf('<details className="card cloud-advanced"'),
  'outbox and sync internals sit inside the Advanced section');
ok(!('settings.accountTypeValue' in en) && !/no sign-in service/i.test(JSON.stringify(en)), 'the "no sign-in service" line is gone from the catalogue');
const session = read('platform/cloudSession.js');
ok(/new globalThis\.BroadcastChannel\(CLOUD_SESSION_CHANNEL\)/.test(session) && /postMessage\(publicDetail\(detail\)\)/.test(session), 'sign-in and sign-out are relayed to other tabs');
ok(!/token|cookie|email|password/i.test(/function publicDetail[\s\S]*?\n\}/.exec(session)?.[0] || 'missing'), 'and the relayed message carries no token, cookie, email or password');

if (failures.length) {
  console.log(`SIGN-IN CARD: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log(`SIGN-IN CARD: PASS — ${pass}/${pass} checks — code entry (typing, paste into any box, autofill), every refusal in words in English and Hindi, one request per code, no account without age and agreement, no second account on re-sign-in, no navigation, no paid read`);
