// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the staff second factor on the client
//
// server/platform/mfa.js and security.js are proved on the server side. This is
// the client half:
//
//   · the data steps call the four MFA routes through the audited transport
//     with exactly the body each expects, and read what each answers;
//   · a code challenge mid-action (MFA_REQUIRED / MFA_STEP_UP_REQUIRED) prompts
//     for a code and retries the action once — never twice; enrolment-required
//     routes back to enrolment and the error is not swallowed; every other
//     error passes through untouched;
//   · each step of the panel renders: the secret and otpauth URI with copy
//     buttons (no QR dependency), a six-digit confirm form, the eight recovery
//     codes shown once behind an acknowledgement, and the verify form;
//   · nothing in the panel logs, persists or re-shows a secret or a recovery code.
//
//   node client/test/mfa-ui-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

if (!globalThis.document) globalThis.document = { documentElement: { lang: 'en' }, cookie: '' };

const en = (await import('../src/i18n/strings.en.js')).default;
const hi = (await import('../src/i18n/strings.hi.js')).default;

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const root = fileURLToPath(new URL('..', import.meta.url));
const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const refusal = (code, status = 403, extra = {}) => Object.assign(new Error(code), { code, status, ...extra });

const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const URI = `otpauth://totp/Pri%20Learning:admin%40example.test?secret=${SECRET}&issuer=Pri+Learning&algorithm=SHA1&digits=6&period=30`;
const RECOVERY = ['11111-22222', '33333-44444', '55555-66666', '77777-88888', '12121-34343', '56565-78787', '90909-10101', '24242-35353'];

const { createServer } = await import('vite');
const react = (await import('@vitejs/plugin-react')).default;
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const server = await createServer({
  root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true },
  plugins: [react()], define: { __PRI_FEATURE_TUTOR__: 'false', __PRI_PRODUCTION_BUILD__: 'false' }
});
try {
  const i18n = await server.ssrLoadModule('/src/i18n/index.js');
  await i18n.setLanguage('en');
  const panel = await server.ssrLoadModule('/src/components/MfaPanel.jsx');
  const gate = await server.ssrLoadModule('/src/components/StaffMfaGate.jsx');
  const { classifyMfaInput, stepForStatus, startEnrolment, confirmEnrolment, verifySecondFactor, mfaErrorKey } = panel;
  const { runWithMfaRetry, isMfaChallenge, MFA_CHALLENGE_CODES } = gate;
  const MfaPanel = panel.default;

  // ── 1 · Input and status classification ───────────────────────────────────
  eq(classifyMfaInput(' 123 456 '), { code: '123456' }, 'six digits (spaces forgiven) are a TOTP code');
  eq(classifyMfaInput('11111-22222'), { recoveryCode: '11111-22222' }, 'ten digits with the dash are a recovery code');
  eq(classifyMfaInput('1111122222'), { recoveryCode: '1111122222' }, 'and without the dash');
  eq(classifyMfaInput('12345'), null, 'five digits are neither');
  eq(classifyMfaInput('abcdef'), null, 'letters are neither');
  eq(stepForStatus({ required: false }), 'done', 'a student or teacher is never gated');
  eq(stepForStatus({ required: true, enrolled: false, verified: false }), 'intro', 'an unenrolled staff account starts at enrolment');
  eq(stepForStatus({ required: true, enrolled: true, verified: false }), 'verify', 'an enrolled, unverified session must present a code');
  eq(stepForStatus({ required: true, enrolled: true, verified: true }), 'done', 'a verified session needs nothing');
  eq(stepForStatus({ required: true, enrolled: true, verified: true }, 'step-up'), 'verify', 'a step-up asks again even when verified');

  // ── 2 · The data steps against a fake transport ───────────────────────────
  {
    const calls = [];
    const transport = {
      mfaEnrol: async () => { calls.push(['enrol']); return { secret: SECRET, otpauthUri: URI, issuer: 'Pri Learning', algorithm: 'SHA1', digits: 6, period: 30 }; },
      mfaConfirm: async code => { calls.push(['confirm', code]); return code === '246810' ? { enrolled: true, verifiedAt: 1, recoveryCodes: RECOVERY } : Promise.reject(refusal('MFA_CODE_INVALID', 401)); },
      mfaVerify: async body => { calls.push(['verify', body]); return body.recoveryCode ? { verified: true, method: 'recovery-code', recoveryCodesRemaining: 7 } : { verified: true, method: 'totp' }; }
    };
    eq(await startEnrolment(transport), { secret: SECRET, otpauthUri: URI }, 'enrolment hands back the secret and URI, nothing else');
    const bad = await startEnrolment({ mfaEnrol: async () => ({ secret: '', otpauthUri: 'https://evil.example/' }) }).catch(e => e.code);
    eq(bad, 'MFA_ENROL_FAILED', 'a response without a real otpauth URI is refused rather than shown');
    eq(await confirmEnrolment('246810', transport), { enrolled: true, recoveryCodes: RECOVERY }, 'confirming with the right code yields the eight recovery codes');
    eq(await confirmEnrolment('000000', transport).catch(e => e.code), 'MFA_CODE_INVALID', 'a wrong code is the server’s refusal, verbatim');
    eq(await confirmEnrolment('12', transport).catch(e => e.code), 'MFA_CODE_FORMAT', 'a malformed code never reaches the server');
    eq(await verifySecondFactor('135791', transport), { verified: true, method: 'totp' }, 'a TOTP verify');
    eq((await verifySecondFactor('11111-22222', transport)).recoveryCodesRemaining, 7, 'a recovery-code verify reports how many remain');
    eq(calls, [['enrol'], ['confirm', '246810'], ['confirm', '000000'], ['verify', { code: '135791' }], ['verify', { recoveryCode: '11111-22222' }]],
      'each step posted exactly the body its route expects');
    eq([mfaErrorKey(refusal('MFA_CODE_INVALID')), mfaErrorKey(refusal('MFA_ALREADY_ENROLLED')), mfaErrorKey(refusal('MFA_NOT_CONFIGURED', 503)), mfaErrorKey(refusal('RATE_LIMITED', 429)), mfaErrorKey(new Error('x'))],
      ['mfa.codeRejected', 'mfa.alreadyEnrolled', 'mfa.notConfigured', 'mfa.rateLimited', 'mfa.failed'], 'every refusal has its own words');
  }

  // ── 3 · Code challenges mid-action: prompt, retry once ────────────────────
  {
    eq([...MFA_CHALLENGE_CODES], ['MFA_ENROLMENT_REQUIRED', 'MFA_REQUIRED', 'MFA_STEP_UP_REQUIRED'], 'the three server codes are the challenges');
    ok(isMfaChallenge(refusal('MFA_STEP_UP_REQUIRED', 403, { stepUpWindowMs: 900000 })) && !isMfaChallenge(refusal('FORBIDDEN')), 'and FORBIDDEN is not one');

    let attempts = 0; const prompts = [];
    const stepUpOnce = async () => { attempts++; if (attempts === 1) throw refusal('MFA_STEP_UP_REQUIRED', 403, { stepUpWindowMs: 900000 }); return { ok: true, attempts }; };
    const result = await runWithMfaRetry(stepUpOnce, { requestStepUp: async code => { prompts.push(code); } });
    eq([result, prompts], [{ ok: true, attempts: 2 }, ['MFA_STEP_UP_REQUIRED']], 'a step-up challenge prompts for a code and retries the action once');

    attempts = 0; prompts.length = 0;
    const required = async () => { attempts++; if (attempts === 1) throw refusal('MFA_REQUIRED'); return 'done'; };
    eq(await runWithMfaRetry(required, { requestStepUp: async code => { prompts.push(code); } }), 'done', 'MFA_REQUIRED is handled the same way');

    attempts = 0;
    const always = async () => { attempts++; throw refusal('MFA_STEP_UP_REQUIRED'); };
    const second = await runWithMfaRetry(always, { requestStepUp: async () => {} }).catch(e => e.code);
    eq([second, attempts], ['MFA_STEP_UP_REQUIRED', 2], 'a challenge on the retry is not retried again — exactly two attempts, then the error');

    attempts = 0;
    const dismissed = await runWithMfaRetry(always, { requestStepUp: async () => { throw refusal('MFA_CANCELLED'); } }).catch(e => e.code);
    eq([dismissed, attempts], ['MFA_CANCELLED', 1], 'backing out of the prompt cancels without a retry');

    let routed = null; attempts = 0;
    const unenrolled = async () => { attempts++; throw refusal('MFA_ENROLMENT_REQUIRED'); };
    const enrol = await runWithMfaRetry(unenrolled, { requestStepUp: async () => { prompts.push('no'); }, onEnrolmentRequired: e => { routed = e.code; } }).catch(e => e.code);
    eq([enrol, routed, attempts, prompts.includes('no')], ['MFA_ENROLMENT_REQUIRED', 'MFA_ENROLMENT_REQUIRED', 1, false], 'enrolment-required routes to enrolment, is not retried, and still surfaces');

    const other = await runWithMfaRetry(async () => { throw refusal('FORBIDDEN'); }, { requestStepUp: async () => { prompts.push('no'); } }).catch(e => e.code);
    eq([other, prompts.includes('no')], ['FORBIDDEN', false], 'any other error passes through without a prompt');
    eq(await runWithMfaRetry(async () => 42), 42, 'and a plain success is simply returned');
  }

  // ── 4 · Each step, rendered ───────────────────────────────────────────────
  {
    const render = props => renderToStaticMarkup(React.createElement(MfaPanel, { transport: {}, ...props }));
    const intro = render({ reason: 'enrol', initial: { step: 'intro' } });
    ok(/data-mfa-step="intro"/.test(intro) && intro.includes(en['mfa.startEnrolment']), 'enrolment starts with one button and the reason staff carry a second factor');
    ok(intro.includes(en['mfa.enrolRequired'].replace(/'/g, '&#x27;')) || intro.includes(en['mfa.enrolRequired']), 'and says nothing else works until it is confirmed');

    const enrol = render({ initial: { step: 'enrol', enrolment: { secret: SECRET, otpauthUri: URI } } });
    ok(enrol.includes(SECRET) && /data-mfa-secret/.test(enrol), 'the secret is shown as text');
    ok(enrol.includes(URI.replace(/&/g, '&amp;')) && /data-mfa-uri/.test(enrol), 'with the otpauth URI beside it');
    eq((enrol.match(new RegExp(`aria-label="${en['mfa.copySecret']}"`, 'g')) || []).length, 1, 'a copy button for the secret');
    eq((enrol.match(new RegExp(`aria-label="${en['mfa.copyUri']}"`, 'g')) || []).length, 1, 'and one for the URI');
    ok(/autocomplete="one-time-code"[^>]*pattern="\[0-9\]\{6\}"[^>]*maxlength="6"/i.test(enrol) || /maxlength="6"/i.test(enrol) && /one-time-code/.test(enrol), 'the confirm field takes exactly six digits as a one-time code');
    ok(enrol.includes(en['mfa.pasteIntoApp'].replace(/“/g, '“')), 'the instruction says to paste the key into an authenticator app');
    ok(!/<svg|<canvas|qrcode/i.test(enrol), 'no QR renderer: no new dependency, no drawn secret');

    const recovery = render({ initial: { step: 'recovery', recoveryCodes: RECOVERY } });
    ok(RECOVERY.every(code => recovery.includes(code)) && /data-mfa-recovery-codes/.test(recovery), 'all eight recovery codes are shown');
    ok(/data-mfa-acknowledge/.test(recovery) && recovery.includes(en['mfa.savedRecovery']), 'behind an "I have saved these" acknowledgement');
    ok(recovery.includes(en['mfa.recoveryIntro']), 'which says they are shown only now');

    const verify = render({ status: { required: true, enrolled: true, verified: false } });
    ok(/data-mfa-step="verify"/.test(verify) && verify.includes(en['mfa.verify']) && /maxlength="11"/i.test(verify), 'an enrolled, unverified session gets the verify form, sized for a code or a recovery code');
    ok(!verify.includes(en['mfa.cancel']), 'at sign-in there is nothing to cancel into');
    const stepUp = render({ reason: 'step-up', status: { required: true, enrolled: true, verified: true }, onCancel: () => {} });
    ok(stepUp.includes(en['mfa.stepUpIntro']) && stepUp.includes(en['mfa.cancel']), 'a step-up prompt explains itself and can be dismissed');

    const done = render({ status: { required: true, enrolled: true, verified: true } });
    eq(done, '', 'a verified session draws nothing');
    eq(render({ status: { required: false } }), '', 'and neither does a student or teacher');

    ok(!recovery.includes(SECRET) && !verify.includes(SECRET) && !done.includes(SECRET), 'the secret is on no step but enrolment');
    ok(!verify.includes(RECOVERY[0]) && !done.includes(RECOVERY[0]), 'the recovery codes are on no step but the one they are shown on');

    await i18n.setLanguage('hi');
    const hindi = render({ reason: 'enrol', initial: { step: 'intro' } });
    ok(hindi.includes(hi['mfa.title']) && hindi.includes(hi['mfa.startEnrolment']), 'the panel renders in Hindi for a Hindi reader');
    await i18n.setLanguage('en');
  }
} finally {
  await server.close();
}

// ── 5 · Source contracts ─────────────────────────────────────────────────────
{
  const panel = read('src/components/MfaPanel.jsx');
  const gateSrc = read('src/components/StaffMfaGate.jsx');
  const staff = read('src/components/StaffOperationsPanel.jsx');
  const transport = read('src/platform/cloudTransport.js');
  ok(!/console\./.test(panel) && !/console\./.test(gateSrc), 'neither the panel nor the gate ever logs — a secret or recovery code can never reach a console');
  ok(!/localStorage|sessionStorage|indexedDB/.test(panel) && !/localStorage|sessionStorage|indexedDB/.test(gateSrc), 'nothing is persisted in the browser');
  ok(/setEnrolment\(null\);/.test(panel) && /setRecoveryCodes\(null\);\s*setStep\('done'\);/.test(panel), 'the secret is dropped on confirmation and the recovery codes on acknowledgement');
  ok(!/^import .*qr/im.test(panel), 'no QR library is imported');
  ok(/React\.lazy\(\(\) => import\('\.\/MfaPanel\.jsx'\)\)/.test(gateSrc), 'the gate lazy-loads the panel so only staff fetch it');
  ok(/import StaffMfaGate, \{ useMfaStepUp \} from '\.\/StaffMfaGate\.jsx'/.test(staff) && /<StaffMfaGate><StaffOperationsConsole \/><\/StaffMfaGate>/.test(staff),
    'the staff console mounts behind the gate');
  for (const call of ['cloud.updateUserRole(user.id, roleValue)', 'cloud.publishContent(revision.id)', 'cloud.approveContent(revision.id)', 'cloud.submitContentReview(revision.id)']) {
    ok(staff.includes(`withMfa(() => ${call})`), `${call.split('(')[0]} runs through withMfa, so a code challenge re-prompts and retries once`);
  }
  ok(/withMfa\(\(\) => cloud\.createContentDraft\(/.test(staff), 'and so does creating a draft');
  ok(/!String\(err\?\.code \|\| ''\)\.startsWith\('MFA_'\)/.test(staff), 'an MFA refusal on load is not mistaken for "not staff"');
  for (const [name, route] of [['mfaStatus', "cloudRequest('/v1/account/mfa/status')"], ['mfaEnrol', "cloudRequest('/v1/account/mfa/totp/enrol', { method: 'POST', body: {} })"], ['mfaConfirm', "cloudRequest('/v1/account/mfa/totp/confirm', { method: 'POST', body: { code } })"], ['mfaVerify', "cloudRequest('/v1/account/mfa/verify', { method: 'POST', body })"]]) {
    ok(transport.includes(`${name}: `) && transport.includes(route), `${name} goes through the audited transport to its route`);
  }
  const keys = Object.keys(en).filter(k => k.startsWith('mfa.'));
  ok(keys.length >= 30 && keys.every(k => k in hi && JSON.stringify(en[k]) !== JSON.stringify(hi[k])), `every mfa.* key (${keys.length}) is translated`);
}

console.log(failures.length
  ? `MFA UI: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `MFA UI: PASS — ${pass}/${pass} checks — enrol, confirm, recovery codes once, verify and step-up retry once, all through the audited transport, nothing logged or persisted.`);
process.exit(failures.length ? 1 : 0);
