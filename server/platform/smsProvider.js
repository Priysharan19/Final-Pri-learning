// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · SMS one-time-code providers
//
// One interface, three adapters, chosen by PRI_SMS_PROVIDER:
//
//   msg91   India DLT route. Pri generates the code, hashes it, and MSG91 only
//           delivers it through a DLT-registered template (PRI_MSG91_AUTH_KEY,
//           PRI_MSG91_OTP_TEMPLATE_ID). Pri's own attempt limits and
//           constant-time compare decide.
//   twilio  Twilio Verify. Twilio generates and checks the code
//           (PRI_TWILIO_ACCOUNT_SID, PRI_TWILIO_AUTH_TOKEN,
//           PRI_TWILIO_VERIFY_SERVICE_SID). Pri still owns the challenge row,
//           the attempt ceiling, the expiry and the rate limits around it.
//   test    Never sends anything. Messages are kept in process memory for the
//           staging/e2e harness to read. It refuses to exist when
//           NODE_ENV=production unless PRI_SMS_TEST_MODE_ALLOW_STAGING=1 is
//           also set — a staging deployment runs production code, a real
//           production deployment must never accept a code nobody was sent.
//
// Credentials are read from server environment variables only. Nothing here is
// ever returned to a client, logged, or put in an error message.
// ─────────────────────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 10_000;
const MSG91_FLOW_ENDPOINT = 'https://control.msg91.com/api/v5/flow/';
const TWILIO_VERIFY_BASE = 'https://verify.twilio.com/v2/Services';

const trim = (value) => String(value ?? '').trim();

function providerError(code, message, status = 503) {
  return Object.assign(new Error(message), { code, status });
}

/**
 * The WebOTP origin-bound line (https://wicg.github.io/web-otp/). It must be
 * the last line of the SMS for Android Chrome to offer the code to the page.
 * A DLT template for MSG91 has to end with the same line; see
 * docs/release/otp-sign-in.md.
 */
export function webOtpLine(publicOrigin, code) {
  let host = '';
  try { host = new URL(String(publicOrigin || '')).host; } catch { host = ''; }
  return host ? `@${host} #${code}` : '';
}

/** The parent's own consent page (never the child's device session). */
export function consentPage(publicOrigin) {
  try { return new URL('/guardian/consent', String(publicOrigin || '')).toString(); } catch { return 'the Pri Learning parent page'; }
}

export function smsOtpBody(code, purpose, publicOrigin) {
  const lead = purpose === 'guardian-consent'
    ? `${code} is the code to approve your child's Pri Learning account. On your own phone open ${consentPage(publicOrigin)}, read what you are agreeing to, then enter it. Valid 10 minutes.`
    : purpose === 'guardian-withdraw'
      ? `${code} is the code to withdraw consent for your child's Pri Learning account. Valid 10 minutes.`
      : `${code} is your Pri Learning code. Valid 10 minutes. Do not share it.`;
  const line = webOtpLine(publicOrigin, code);
  return line ? `${lead}\n\n${line}` : lead;
}

async function timedFetch(fetchImpl, url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('SMS provider timed out')), REQUEST_TIMEOUT_MS);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** India mobile numbers in E.164 without the plus, as MSG91 wants them. */
function msg91Mobile(e164) {
  return String(e164).replace(/^\+/, '');
}

export function createMsg91Provider({
  authKey = process.env.PRI_MSG91_AUTH_KEY,
  templateId = process.env.PRI_MSG91_OTP_TEMPLATE_ID,
  guardianTemplateId = process.env.PRI_MSG91_GUARDIAN_TEMPLATE_ID,
  fetchImpl = globalThis.fetch
} = {}) {
  const key = trim(authKey);
  const template = trim(templateId);
  if (!key || !template || typeof fetchImpl !== 'function') return null;
  const guardianTemplate = trim(guardianTemplateId) || template;
  return Object.freeze({
    name: 'msg91',
    generatesCode: false,
    async send({ to, code, purpose }) {
      const response = await timedFetch(fetchImpl, MSG91_FLOW_ENDPOINT, {
        method: 'POST',
        headers: { authkey: key, 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          template_id: purpose === 'sign-in' || purpose === 'reauth' ? template : guardianTemplate,
          short_url: '0',
          recipients: [{ mobiles: msg91Mobile(to), otp: code }]
        })
      });
      const text = await response.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { /* provider body is not trusted */ }
      if (!response.ok || (data && String(data.type || '').toLowerCase() === 'error')) {
        throw providerError(`MSG91_${response.status}`, 'SMS provider rejected the request');
      }
      return { providerMessageId: String(data?.message || data?.request_id || '').slice(0, 160) || null };
    }
  });
}

export function createTwilioVerifyProvider({
  accountSid = process.env.PRI_TWILIO_ACCOUNT_SID,
  authToken = process.env.PRI_TWILIO_AUTH_TOKEN,
  serviceSid = process.env.PRI_TWILIO_VERIFY_SERVICE_SID,
  fetchImpl = globalThis.fetch
} = {}) {
  const sid = trim(accountSid);
  const token = trim(authToken);
  const service = trim(serviceSid);
  if (!sid || !token || !/^VA[0-9a-f]{32}$/i.test(service) || typeof fetchImpl !== 'function') return null;
  const auth = `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`;
  const post = (path, form) => timedFetch(fetchImpl, `${TWILIO_VERIFY_BASE}/${service}/${path}`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString()
  });
  return Object.freeze({
    name: 'twilio',
    // Twilio Verify owns the code: Pri never sees it, so there is nothing to
    // hash. The challenge row still bounds attempts, expiry and replay.
    generatesCode: true,
    async start({ to }) {
      const response = await post('Verifications', { To: to, Channel: 'sms' });
      if (!response.ok) throw providerError(`TWILIO_${response.status}`, 'SMS provider rejected the request');
      const data = await response.json().catch(() => null);
      return { providerMessageId: String(data?.sid || '').slice(0, 160) || null };
    },
    async check({ to, code }) {
      const response = await post('VerificationCheck', { To: to, Code: code });
      // 404 is Twilio's answer for an expired/used/max-attempted verification.
      if (response.status === 404) return false;
      if (!response.ok) throw providerError(`TWILIO_${response.status}`, 'SMS provider rejected the request');
      const data = await response.json().catch(() => null);
      return data?.status === 'approved' && data?.valid === true;
    }
  });
}

// ── test adapter ────────────────────────────────────────────────────────────
const TEST_OUTBOX_LIMIT = 200;
const testOutbox = [];

/** Read (and optionally filter) what the test adapters "sent". Test harness only. */
export function readTestOutbox({ to = null, channel = null } = {}) {
  return testOutbox.filter(entry => (!to || entry.to === to) && (!channel || entry.channel === channel)).map(entry => ({ ...entry }));
}

export function clearTestOutbox() {
  testOutbox.length = 0;
}

export function recordTestMessage(entry) {
  testOutbox.push({ ...entry, at: Date.now() });
  if (testOutbox.length > TEST_OUTBOX_LIMIT) testOutbox.splice(0, testOutbox.length - TEST_OUTBOX_LIMIT);
}

/**
 * Whether a test adapter may run in this environment. Production refuses it
 * unless the operator has explicitly declared the deployment a staging one.
 */
export function testModeAllowed(env = process.env) {
  if (trim(env.NODE_ENV) !== 'production') return true;
  return trim(env.PRI_SMS_TEST_MODE_ALLOW_STAGING) === '1';
}

export function createTestSmsProvider({ env = process.env, publicOrigin = env.PRI_PUBLIC_ORIGIN } = {}) {
  if (!testModeAllowed(env)) {
    throw providerError('SMS_TEST_MODE_FORBIDDEN',
      'PRI_SMS_PROVIDER=test cannot run with NODE_ENV=production unless PRI_SMS_TEST_MODE_ALLOW_STAGING=1 is set for a staging deployment.', 500);
  }
  return Object.freeze({
    name: 'test',
    generatesCode: false,
    async send({ to, code, purpose }) {
      recordTestMessage({ channel: 'sms', to, code, purpose, body: smsOtpBody(code, purpose, publicOrigin) });
      return { providerMessageId: null };
    }
  });
}

/**
 * The configured SMS provider, null when SMS sign-in is not configured, or a
 * thrown configuration error when it is configured wrongly. Throwing (rather
 * than silently returning null) is what stops a production deployment booting
 * with the test adapter.
 */
export function createSmsProviderFromEnv(env = process.env, options = {}) {
  const provider = trim(env.PRI_SMS_PROVIDER).toLowerCase();
  if (!provider) return null;
  if (provider === 'test') return createTestSmsProvider({ env, ...options });
  if (provider === 'msg91') return createMsg91Provider({
    authKey: env.PRI_MSG91_AUTH_KEY,
    templateId: env.PRI_MSG91_OTP_TEMPLATE_ID,
    guardianTemplateId: env.PRI_MSG91_GUARDIAN_TEMPLATE_ID,
    ...options
  });
  if (provider === 'twilio') return createTwilioVerifyProvider({
    accountSid: env.PRI_TWILIO_ACCOUNT_SID,
    authToken: env.PRI_TWILIO_AUTH_TOKEN,
    serviceSid: env.PRI_TWILIO_VERIFY_SERVICE_SID,
    ...options
  });
  throw providerError('SMS_PROVIDER_UNSUPPORTED', 'Unsupported PRI_SMS_PROVIDER (use msg91, twilio or test).', 500);
}
