// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · auth email acceptance
//
// EVIDENCE CLASS: real Resend account and verified sender, real localhost HTTP
// server, Resend test sink inboxes; not the deployed service, not a human inbox.
//
// Started by launch-auth-email.mjs (see README-auth-email.md). It talks to two
// local servers over real HTTP exactly as a browser would, and reads the
// messages those servers sent back out of Resend with Resend's own API — the
// test sink inboxes (delivered@resend.dev, bounced@resend.dev) cannot be opened
// like a mailbox.
//
// Handling rules this file keeps:
//   • A verification code lives in a local variable and in the request that
//     spends it. It is never printed, logged or written. Every line this file
//     prints is passed through a scrubber that knows every code it has read.
//   • No session cookie, token or key is printed or written.
//   • A recipient is printed with its local part masked.
//   • A Resend error body is never printed (it can quote an address): only the
//     HTTP status and the error name.
//   • The list endpoint returns other recent messages of the account. They are
//     discarded inside the filter that looks for this run's own unique
//     recipients; nothing about them is kept, counted or printed.
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.PRI_ACCEPT_BASE || '';
const INVALID_BASE = process.env.PRI_ACCEPT_INVALID_BASE || '';
const INVALID_LOG = process.env.PRI_ACCEPT_INVALID_LOG || '';
const MAIN_LOG = process.env.PRI_ACCEPT_MAIN_LOG || '';
const OUT = process.env.PRI_ACCEPT_OUT || '';
const KEY = process.env.PRI_RESEND_API_KEY || '';
const CONFIGURED_FROM = String(process.env.PRI_AUTH_EMAIL_FROM || '').trim();
const EXPECTED_SENDER = (process.env.PRI_ACCEPT_EXPECT_SENDER || 'verify@mail.prilearning.com').toLowerCase();
const MAX_SENDS = 14;

// ── Output: scrubbed, always ─────────────────────────────────────────────────
const knownCodes = new Set();
function scrub(text) {
  let out = String(text);
  if (KEY.length >= 8) out = out.split(KEY).join('[REDACTED-CREDENTIAL]');
  for (const code of knownCodes) out = out.replace(new RegExp(`(?<![0-9])${code}(?![0-9])`, 'g'), '[CODE]');
  return out;
}
const say = (line = '') => process.stdout.write(scrub(line) + '\n');
const mask = address => {
  const [local, domain] = String(address).split('@');
  return `${local.slice(0, 2)}***@${domain}`;
};

if (!BASE || !INVALID_BASE || !KEY || !CONFIGURED_FROM) {
  say('DEPENDENCY MISSING: this script is started by tools/acceptance/launch-auth-email.mjs under `railway run`. Nothing was run. Nothing was sent.');
  process.exit(2);
}

// ── Results ──────────────────────────────────────────────────────────────────
const results = [];
const messages = [];
const notVerified = [];
function check(id, name, ok, detail = '') {
  results.push({ id, name, status: ok ? 'PASS' : 'FAIL', detail: String(detail ?? '') });
  return !!ok;
}
const info = (id, name, detail) => results.push({ id, name, status: 'INFO', detail: String(detail ?? '') });
function unverified(id, name, detail) {
  results.push({ id, name, status: 'NOT VERIFIED', detail: String(detail ?? '') });
  notVerified.push(`${id} ${name}: ${detail}`);
}
class Limitation extends Error {}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ── HTTP to the local server, as a browser would send it ─────────────────────
function makeHttp(origin) {
  return async function request(path, { method = 'GET', body, jar = null } = {}) {
    const send = { Accept: 'application/json' };
    if (method !== 'GET') send.Origin = origin;
    if (jar) {
      const cookies = Object.entries(jar).filter(([, v]) => v !== '').map(([k, v]) => `${k}=${v}`).join('; ');
      if (cookies) send.Cookie = cookies;
      if (method !== 'GET' && jar.pri_csrf) send['x-pri-csrf'] = jar.pri_csrf;
    }
    if (body !== undefined) send['Content-Type'] = 'application/json';
    const response = await fetch(origin + path, { method, headers: send, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    if (jar) {
      for (const raw of response.headers.getSetCookie?.() || []) {
        const first = String(raw).split(';', 1)[0];
        const at = first.indexOf('=');
        if (at > 0) jar[first.slice(0, at)] = first.slice(at + 1);
      }
    }
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { status: response.status, data, code: data?.error?.code || null, message: data?.error?.message || null };
  };
}
const http = makeHttp(BASE);
const brokenHttp = makeHttp(INVALID_BASE);
const liveCookies = jar => Object.values(jar).filter(value => value !== '').length;

// ── Resend's own API, read-only, paced under its rate limit ──────────────────
let lastResendCall = 0;
async function resend(path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = lastResendCall + 650 - Date.now();
    if (wait > 0) await sleep(wait);
    lastResendCall = Date.now();
    let response;
    try {
      response = await fetch(`https://api.resend.com${path}`, { headers: { Authorization: `Bearer ${KEY}`, 'User-Agent': 'Pri-Learning-Acceptance/1.0' }, signal: AbortSignal.timeout(15_000) });
    } catch {
      if (attempt === 3) return { status: 0, name: 'network', data: null };
      continue;
    }
    if (response.status === 429) { await sleep(1_200); continue; }
    let data = null;
    try { data = await response.json(); } catch { data = null; }
    return { status: response.status, name: response.ok ? null : String(data?.name || 'unknown').replace(/[^a-z_]/gi, '').slice(0, 40), data: response.ok ? data : null };
  }
  return { status: 429, name: 'rate_limit_exceeded', data: null };
}

/** The ids of the messages Resend holds for one of THIS run's recipients, oldest first. */
async function messageIdsFor(recipient, { expect = 1, timeoutMs = 30_000 } = {}) {
  const wanted = recipient.toLowerCase();
  const deadline = Date.now() + timeoutMs;
  let found = [];
  for (;;) {
    const list = await resend('/emails?limit=40');
    if (list.status === 401 || list.status === 403) {
      throw new Limitation(list.name === 'restricted_api_key'
        ? 'the Resend key is SENDING-ONLY (restricted_api_key): it can send, but it may not list or read sent messages, so the email body cannot be read back and the code loop cannot be closed with this key'
        : `Resend refused to list sent messages (HTTP ${list.status} ${list.name})`);
    }
    if (list.status !== 200 || !Array.isArray(list.data?.data)) {
      if (Date.now() > deadline) throw new Limitation(`Resend's list-sent-emails endpoint did not answer usably (HTTP ${list.status} ${list.name || ''})`);
      continue;
    }
    // Everything that is not addressed to this run's own recipient is dropped here.
    found = list.data.data
      .filter(item => (Array.isArray(item?.to) ? item.to : [item?.to]).some(to => String(to || '').toLowerCase() === wanted))
      .map(item => ({ id: String(item.id), createdAt: String(item.created_at || '') }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (found.length >= expect || Date.now() > deadline) return found.map(item => item.id);
    await sleep(1_500);
  }
}

async function readMessage(id) {
  const got = await resend(`/emails/${encodeURIComponent(id)}`);
  if (got.status === 401 || got.status === 403) throw new Limitation(`Resend refused to return the message body (HTTP ${got.status} ${got.name}); the key cannot read sent messages`);
  if (got.status !== 200 || !got.data) throw new Error(`Resend GET /emails/{id} answered HTTP ${got.status} ${got.name || ''}`);
  return got.data;
}

/** Poll Resend's last_event for a message until it is one of `settled` or time runs out. */
async function lastEvent(id, settled, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  let event = null;
  for (;;) {
    const got = await resend(`/emails/${encodeURIComponent(id)}`);
    event = got.data?.last_event || event;
    if (settled.includes(event) || Date.now() > deadline) return event;
    await sleep(2_000);
  }
}

const senderOk = message => {
  const from = String(message?.from || '').trim();
  return from === CONFIGURED_FROM && from.toLowerCase().includes(EXPECTED_SENDER);
};

let sends = 0;
function countSend(n = 1) {
  sends += n;
  if (sends > MAX_SENDS) throw new Error(`send budget exceeded (${sends} > ${MAX_SENDS}); stopping`);
}

/**
 * Ask the local server for a one-time code, find the message at Resend, check
 * its shape and return the code — in memory only.
 */
async function requestCode(id, label, recipient, { path = '/v1/account/otp/request', body = null, jar = null, purpose = 'sign-in' } = {}) {
  countSend();
  const asked = await http(path, { method: 'POST', jar, body: body || { channel: 'email', destination: recipient } });
  if (!check(`${id}a`, `${label}: the server accepts the code request (202)`, asked.status === 202 && asked.data?.ok === true && typeof asked.data?.challengeId === 'string',
    `HTTP ${asked.status} ${asked.code || ''}`)) return null;
  const expectCount = purpose === 'guardian-consent' ? 2 : 1;
  const ids = await messageIdsFor(recipient, { expect: (messagesTo.get(recipient) || 0) + expectCount });
  const fresh = ids.filter(messageId => !seenIds.has(messageId));
  let codeMessage = null;
  let code = null;
  const others = [];
  for (const messageId of fresh) {
    seenIds.add(messageId);
    const message = await readMessage(messageId);
    const leading = String(message.text || '').match(/^(\d{6})\r?\n/);
    if (leading && !codeMessage) { code = leading[1]; knownCodes.add(code); codeMessage = { id: messageId, message }; } else others.push({ id: messageId, message });
  }
  messagesTo.set(recipient, (messagesTo.get(recipient) || 0) + fresh.length);
  if (!check(`${id}b`, `${label}: Resend accepted the send and holds the message`, !!codeMessage, `${fresh.length} new message(s) for ${mask(recipient)}, none carrying a code`)) return null;
  check(`${id}c`, `${label}: sent from the configured sender ${EXPECTED_SENDER}`, senderOk(codeMessage.message), 'the From of the stored message is not the expected sender');
  const subjectTail = purpose === 'guardian-consent' ? ' is the code to approve your child’s Pri Learning account' : ' is your Pri Learning code';
  const bodyMarker = purpose === 'guardian-consent'
    ? /Your child is setting up Pri Learning and has asked you to approve their account\. Open http:\/\/127\.0\.0\.1:\d+\/guardian\/consent yourself/
    : /Enter this code in Pri Learning to continue\. It is valid for 10 minutes\. Do not share it with anyone\./;
  const text = String(codeMessage.message.text || '');
  const html = String(codeMessage.message.html || '');
  check(`${id}d`, `${label}: subject and body are the expected ${purpose} message`,
    codeMessage.message.subject === `${code}${subjectTail}` && bodyMarker.test(text) && html.includes(`>${code}</p>`) && /valid for 10 minutes/i.test(text),
    'subject/body shape differs from server/platform/otpEmail.js');
  check(`${id}e`, `${label}: addressed to exactly the one recipient`, Array.isArray(codeMessage.message.to) && codeMessage.message.to.length === 1 && String(codeMessage.message.to[0]).toLowerCase() === recipient,
    'recipient list differs');
  const event = await lastEvent(codeMessage.id, ['delivered', 'bounced', 'complained', 'failed']);
  messages.push({ step: id, role: label, recipient: mask(recipient), kind: `${purpose} code`, id: codeMessage.id, lastEvent: event });
  return { code, challengeId: asked.data.challengeId, noticeVersion: asked.data.noticeVersion || null, messageId: codeMessage.id, event, others };
}
const seenIds = new Set();
const messagesTo = new Map();

const wrongOf = code => String((Number(code) + 1) % 1_000_000).padStart(6, '0');

// ── The journey ──────────────────────────────────────────────────────────────
const run = randomBytes(5).toString('hex');
const adult = `delivered+pri-a-${run}@resend.dev`;
const child = `delivered+pri-c-${run}@resend.dev`;
const guardian = `delivered+pri-g-${run}@resend.dev`;
const bounced = `bounced+pri-b-${run}@resend.dev`;
let limitation = null;
let crashed = null;

say('── Pri Learning auth email acceptance');
say('evidence class: real Resend account and verified sender, real localhost HTTP server, Resend test sink inboxes; not the deployed service, not a human inbox');
say(`recipients (Resend test sinks only): ${[adult, child, guardian, bounced].map(mask).join(', ')}`);

try {
  // 0 · what the local server's readiness says about the REAL credential.
  let ready = await http('/v1/ready');
  for (let i = 0; i < 6 && ready.data?.checks?.authEmail?.state === 'probing'; i++) { await sleep(1_500); ready = await http('/v1/ready'); }
  const auth = ready.data?.checks?.authEmail || {};
  check('0a', '/v1/ready with the real key: authEmail ok, credential valid', ready.status === 200 && auth.state === 'ok' && auth.credential === 'valid', `HTTP ${ready.status} state=${auth.state} code=${auth.code} credential=${auth.credential}`);
  if (auth.sender === 'verified') check('0b', '/v1/ready with the real key: sender domain verified in the account', true);
  else if (auth.state === 'ok' && auth.sender === 'unknown') unverified('0b', '/v1/ready: sender domain verification', 'the key is sending-only, so the server could not list domains (reported as unknown, not failing)');
  else check('0b', '/v1/ready with the real key: sender domain verified in the account', false, `sender=${auth.sender} code=${auth.code}`);

  // 1–2 · a new address asks for a code.
  const anon = {};
  const before = await http('/v1/handwriting/status', { jar: anon });
  check('1.0', 'before any code: a protected route refuses (401)', before.status === 401, `HTTP ${before.status} ${before.code || ''}`);
  const firstAskedAt = Date.now();
  const first = await requestCode('1', 'new address', adult);
  if (!first) throw new Error('the first code could not be obtained; the rest of the journey cannot run');
  check('1f', 'new address: Resend reports the message delivered', first.event === 'delivered', `last_event=${first.event}`);

  // 3 · wrong code, right code, session, protected route.
  const jar = {};
  const profile = { name: 'Acceptance Adult', isAdult: true };
  const wrong = await http('/v1/account/otp/verify', { method: 'POST', jar, body: { channel: 'email', destination: adult, challengeId: first.challengeId, code: wrongOf(first.code), deviceId: 'acceptance', profile } });
  check('3a', 'a wrong code is rejected (400 OTP_INVALID)', wrong.status === 400 && wrong.code === 'OTP_INVALID', `HTTP ${wrong.status} ${wrong.code || ''}`);
  const meBefore = await http('/v1/account/me', { jar });
  check('3b', 'no session exists after a wrong code', liveCookies(jar) === 0 && meBefore.status === 401, `cookies=${liveCookies(jar)} /account/me HTTP ${meBefore.status}`);
  const right = await http('/v1/account/otp/verify', { method: 'POST', jar, body: { channel: 'email', destination: adult, challengeId: first.challengeId, code: first.code, deviceId: 'acceptance', profile } });
  check('3c', 'the right code verifies and creates the account (201 signed-in)', right.status === 201 && right.data?.status === 'signed-in' && right.data?.created === true && right.data?.account?.emailVerified === true,
    `HTTP ${right.status} ${right.code || right.data?.status || ''}`);
  const me = await http('/v1/account/me', { jar });
  check('3d', 'a session exists only now', liveCookies(jar) > 0 && me.status === 200, `cookies=${liveCookies(jar)} /account/me HTTP ${me.status}`);
  const status = await http('/v1/handwriting/status', { jar });
  const notConfigured = status.status === 200 && JSON.stringify(status.data || {}).includes('HANDWRITING_NOT_CONFIGURED');
  check('3e', 'the protected route now answers as authenticated (handwriting "not configured", not 401/403)', notConfigured, `HTTP ${status.status} ${status.code || ''}`);

  // 4 · the same code a second time.
  const replayJar = {};
  const replay = await http('/v1/account/otp/verify', { method: 'POST', jar: replayJar, body: { channel: 'email', destination: adult, challengeId: first.challengeId, code: first.code, deviceId: 'acceptance-2' } });
  check('4a', 'the same code used a second time is rejected (400 OTP_INVALID)', replay.status === 400 && replay.code === 'OTP_INVALID' && liveCookies(replayJar) === 0, `HTTP ${replay.status} ${replay.code || ''} cookies=${liveCookies(replayJar)}`);

  // 5 · expiry: no time seam exists in the server that this run could use.
  results.push({ id: '5', name: 'an expired code is rejected', status: 'UNIT SUITE', detail: 'covered by unit suite, not re-proved here: server/test/otp-lifecycle-check.mjs ("an expired code fails"). The server has no test seam for time, and waiting 10 minutes was not done.' });

  // 7 · a child account and a guardian's approval (run before 6 so that the
  //     30-second resend cooldown on the first address has passed by then).
  const kid = await requestCode('7.1', 'child address', child);
  if (kid) {
    const kidJar = {};
    const made = await http('/v1/account/otp/verify', { method: 'POST', jar: kidJar, body: { channel: 'email', destination: child, challengeId: kid.challengeId, code: kid.code, deviceId: 'acceptance-kid', profile: { name: 'Acceptance Child', year: '10', isAdult: false } } });
    check('7.2', 'a Class 10 child account is created with guardian consent pending', made.status === 201 && made.data?.guardianConsent?.required === true && made.data?.guardianConsent?.state === 'pending',
      `HTTP ${made.status} ${made.code || ''} consent=${made.data?.guardianConsent?.state}`);
    const gateSync = await http('/v1/sync/pull/0', { jar: kidJar });
    const gateInk = await http('/v1/handwriting/status', { jar: kidJar });
    check('7.3', 'the child is gated: GUARDIAN_CONSENT_PENDING on sync and on handwriting', gateSync.status === 403 && gateSync.code === 'GUARDIAN_CONSENT_PENDING' && gateInk.status === 403 && gateInk.code === 'GUARDIAN_CONSENT_PENDING',
      `sync HTTP ${gateSync.status} ${gateSync.code || ''}; handwriting HTTP ${gateInk.status} ${gateInk.code || ''}`);

    countSend(); // the guardian link email, sent by the outbox worker alongside the code
    const parent = await requestCode('7.4', 'guardian address', guardian, {
      path: '/v1/account/otp/guardian/request', jar: kidJar, purpose: 'guardian-consent',
      body: { guardianName: 'Acceptance Parent', channel: 'email', destination: guardian }
    });
    if (parent) {
      check('7.4f', 'guardian code email: Resend reports it delivered', parent.event === 'delivered', `last_event=${parent.event}`);
      const link = parent.others.find(item => item.message.subject === 'Confirm your child’s Pri Learning account');
      if (check('7.5a', 'the guardian link email ("Confirm your child’s Pri Learning account") was accepted by Resend', !!link, `${parent.others.length} other message(s) for the guardian, none with that subject`)) {
        const linkText = String(link.message.text || '');
        check('7.5b', 'guardian link email: expected sender, body, and a fragment-only action link',
          senderOk(link.message) && /Your child has created a Pri Learning account and asked you to confirm it\./.test(linkText)
            && /http:\/\/127\.0\.0\.1:\d+\/guardian\/consent#action=guardian-consent&token=[A-Za-z0-9_-]{20,}/.test(linkText) && !/[?&]token=/.test(linkText.replace(/#\S+/g, '')),
          'link email shape differs from server/platform/authDelivery.js');
        const linkEvent = await lastEvent(link.id, ['delivered', 'bounced', 'complained', 'failed']);
        messages.push({ step: '7.5', role: 'guardian address', recipient: mask(guardian), kind: 'guardian-consent link', id: link.id, lastEvent: linkEvent });
        check('7.5c', 'guardian link email: Resend reports it delivered', linkEvent === 'delivered', `last_event=${linkEvent}`);
      }
      const refused = await http('/v1/account/otp/guardian/approve', { method: 'POST', body: { approve: true, noticeVersion: parent.noticeVersion, channel: 'email', destination: guardian, code: wrongOf(parent.code) } });
      const stillGated = await http('/v1/sync/pull/0', { jar: kidJar });
      check('7.6', 'a wrong guardian code approves nothing', refused.status === 400 && refused.code === 'OTP_INVALID' && stillGated.code === 'GUARDIAN_CONSENT_PENDING', `approve HTTP ${refused.status} ${refused.code || ''}; sync ${stillGated.code || stillGated.status}`);
      // The parent's own page, no child session: the server's guardian route.
      const approved = await http('/v1/account/otp/guardian/approve', { method: 'POST', body: { approve: true, noticeVersion: parent.noticeVersion, channel: 'email', destination: guardian, code: parent.code } });
      check('7.7', 'the guardian approves through /v1/account/otp/guardian/approve with the emailed code', approved.status === 200 && approved.data?.ok === true && approved.data?.confirmed === true, `HTTP ${approved.status} ${approved.code || ''}`);
      const openSync = await http('/v1/sync/pull/0', { jar: kidJar });
      const openInk = await http('/v1/handwriting/status', { jar: kidJar });
      check('7.8', 'the child’s gate moves from GUARDIAN_CONSENT_PENDING to allowed', openSync.status === 200 && openInk.status === 200,
        `sync HTTP ${openSync.status} ${openSync.code || ''}; handwriting HTTP ${openInk.status} ${openInk.code || ''}`);
    }
  }

  // 6 · sign out, then sign in again with a new code.
  const out = await http('/v1/account/logout', { method: 'POST', jar });
  const meOut = await http('/v1/account/me', { jar });
  check('6.0', 'sign out ends the session', out.status === 200 && meOut.status === 401, `logout HTTP ${out.status}; /account/me HTTP ${meOut.status}`);
  const cooldown = firstAskedAt + 32_000 - Date.now();
  if (cooldown > 0) await sleep(cooldown);
  const second = await requestCode('6', 'same address, second code', adult);
  if (second) {
    check('6f', 'second code: Resend reports the message delivered', second.event === 'delivered', `last_event=${second.event}`);
    check('6g', 'the second code is a different message from the first', second.messageId !== first.messageId, 'same message id');
    const jar2 = {};
    const again = await http('/v1/account/otp/verify', { method: 'POST', jar: jar2, body: { channel: 'email', destination: adult, challengeId: second.challengeId, code: second.code, deviceId: 'acceptance' } });
    const me2 = await http('/v1/account/me', { jar: jar2 });
    check('6h', 'signing in again with the new code works (existing account, new session)', again.status === 200 && again.data?.status === 'signed-in' && again.data?.created === false && me2.status === 200,
      `HTTP ${again.status} ${again.code || again.data?.status || ''}; /account/me HTTP ${me2.status}`);
  }

  // 8 · an address that bounces.
  countSend();
  const bounceAsk = await http('/v1/account/otp/request', { method: 'POST', body: { channel: 'email', destination: bounced } });
  info('8a', 'bounce: what the server tells the client', `HTTP ${bounceAsk.status}${bounceAsk.code ? ' ' + bounceAsk.code : bounceAsk.data?.ok ? ' ok:true (the code is reported as sent)' : ''}`);
  const bounceIds = await messageIdsFor(bounced, { expect: 1 });
  if (check('8b', 'bounce: Resend accepted the send (a bounce is reported afterwards, not at send time)', bounceAsk.status === 202 && bounceIds.length === 1, `HTTP ${bounceAsk.status}; ${bounceIds.length} message(s) at Resend`)) {
    seenIds.add(bounceIds[0]);
    const stored = await readMessage(bounceIds[0]);
    const leading = String(stored.text || '').match(/^(\d{6})\r?\n/);
    if (leading) knownCodes.add(leading[1]);
    const event = await lastEvent(bounceIds[0], ['bounced', 'delivered', 'complained', 'failed'], 60_000);
    messages.push({ step: '8', role: 'bouncing address', recipient: mask(bounced), kind: 'sign-in code', id: bounceIds[0], lastEvent: event });
    check('8c', 'bounce: Resend reports last_event = bounced', event === 'bounced', `last_event=${event}`);
    notVerified.push('8 the server learns nothing about a bounce: the client was answered 202 and no webhook from Resend is consumed by the server, so a learner who mistypes an address is told a code was sent');
  }

  // 9 · a deliberately invalid key, on the second server.
  let broken = await brokenHttp('/v1/ready');
  for (let i = 0; i < 6 && broken.data?.checks?.authEmail?.state === 'probing'; i++) { await sleep(1_500); broken = await brokenHttp('/v1/ready'); }
  const brokenAuth = broken.data?.checks?.authEmail || {};
  check('9a', 'invalid key: /v1/ready reports authEmail failing with AUTH_EMAIL_KEY_INVALID', brokenAuth.state === 'failing' && brokenAuth.code === 'AUTH_EMAIL_KEY_INVALID' && brokenAuth.credential === 'invalid',
    `state=${brokenAuth.state} code=${brokenAuth.code} credential=${brokenAuth.credential}`);
  check('9b', 'invalid key: /v1/ready still answers 200 (degraded), so the deploy healthcheck does not fail', broken.status === 200 && broken.data?.state === 'degraded' && (broken.data?.degraded || []).includes('AUTH_EMAIL_KEY_INVALID'),
    `HTTP ${broken.status} state=${broken.data?.state}`);
  const refusedSend = await brokenHttp('/v1/account/otp/request', { method: 'POST', body: { channel: 'email', destination: `delivered+pri-x-${run}@resend.dev` } });
  check('9c', 'invalid key: a code request fails explicitly (503 OTP_DELIVERY_FAILED, "could not be sent")', refusedSend.status === 503 && refusedSend.code === 'OTP_DELIVERY_FAILED' && /could not be sent/i.test(refusedSend.message || ''),
    `HTTP ${refusedSend.status} ${refusedSend.code || ''}`);
  await sleep(700);
  const brokenLog = INVALID_LOG && existsSync(INVALID_LOG) ? readFileSync(INVALID_LOG, 'utf8') : '';
  const brokenLines = brokenLog.split('\n').map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
  check('9d', 'invalid key: the server log carries auth_email_failed with code AUTH_EMAIL_KEY_INVALID',
    brokenLines.some(line => line.event === 'auth_email_failed' && line.code === 'AUTH_EMAIL_KEY_INVALID'), `${brokenLines.length} JSON log line(s), none matching`);
  // The launcher masks addresses before writing a log; a masked address in the
  // file therefore means the server tried to log one.
  const mainLog = MAIN_LOG && existsSync(MAIN_LOG) ? readFileSync(MAIN_LOG, 'utf8') : '';
  const codeInLog = [...knownCodes].some(code => new RegExp(`(?<![0-9])${code}(?![0-9])`).test(mainLog + brokenLog));
  check('9e', 'neither server log holds a recipient address or a verification code', !/\*\*\*@|@resend\.dev/.test(mainLog + brokenLog) && !codeInLog && mainLog.length > 0,
    mainLog.length ? 'an address or a code reached a server log' : 'main server log is empty or missing');
} catch (error) {
  if (error instanceof Limitation) limitation = error.message;
  else crashed = String(error?.message || error);
}

// ── Report ───────────────────────────────────────────────────────────────────
say('');
say('RESULT       ID     CHECK');
for (const row of results) say(`${row.status.padEnd(12)} ${row.id.padEnd(6)} ${row.name}${row.detail && row.status !== 'PASS' ? `  — ${row.detail}` : ''}`);
say('');
say('RESEND MESSAGES (ids are not secrets; codes are never shown)');
say('STEP   LAST_EVENT   MESSAGE ID                             KIND                    RECIPIENT');
for (const m of messages) say(`${m.step.padEnd(6)} ${String(m.lastEvent).padEnd(12)} ${m.id.padEnd(38)} ${m.kind.padEnd(23)} ${m.recipient}`);
say('');
say(`sends requested from the real Resend account in this run: ${sends} (budget ${MAX_SENDS})`);
if (limitation) say(`STOPPED — LIMITATION: ${limitation}. Nothing after that point was run and nothing was faked.`);
if (crashed) say(`STOPPED — ERROR: ${crashed}`);
say('NOT VERIFIED:');
const always = [
  'the deployed service: this ran against a localhost server with a temp SQLite database, not Railway and not Postgres',
  'a human inbox: Resend’s test sinks accept and report; nobody opened a mail client, so inbox placement, spam filtering and rendering are unproved',
  'an expired code (step 5): cited from the unit suite, not re-proved'
];
for (const line of [...always, ...notVerified]) say(`  · ${line}`);

const failed = results.filter(row => row.status === 'FAIL');
const counts = { pass: results.filter(row => row.status === 'PASS').length, fail: failed.length, notVerified: results.filter(row => row.status === 'NOT VERIFIED').length };
say('');
say(`${failed.length || limitation || crashed ? 'AUTH EMAIL ACCEPTANCE: NOT PASSED' : 'AUTH EMAIL ACCEPTANCE: PASS'} — ${counts.pass} passed, ${counts.fail} failed, ${counts.notVerified} not verified`);
if (OUT) {
  // No code, cookie, key or full address is in any of these values.
  writeFileSync(join(OUT, 'auth-email-report.json'), scrub(JSON.stringify({
    evidenceClass: 'real Resend account and verified sender, real localhost HTTP server, Resend test sink inboxes; not the deployed service, not a human inbox',
    expectedSender: EXPECTED_SENDER, sends, results, messages, limitation, crashed, notVerified: [...always, ...notVerified]
  }, null, 2)));
}
process.exit(crashed || failed.length ? 1 : limitation || counts.notVerified ? 3 : 0);
