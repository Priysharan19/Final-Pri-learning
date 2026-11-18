// Pri Learning · the guest trial (ADR-0003), over real HTTP.
//
// A signed-out visitor may try 5 typed or multiple-choice questions a day,
// marked by the server. This suite holds the feature to what the ADR says:
//   · a guest token is a sealed, expiring, anonymous cookie: forged, tampered,
//     expired and absent tokens are refused; no account, session or child-data
//     row is ever written;
//   · state-changing guest routes need the guest CSRF header, bound to the token;
//   · the limit is 5 per token, 15 per address across rotating tokens, and
//     6 tokens per address per day; a closed question cannot be answered twice;
//   · no answer key, solution, seed or trace leaves the server before a verdict;
//   · a guest can reach no account route and no paid reader, and a guest token
//     is no session.
import './support/hermetic.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'pri-guest-'));
delete process.env.NODE_ENV;
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '5d'.repeat(32);
process.env.PRI_AUTH_EMAIL_PROVIDER = 'test';
delete process.env.PRI_PUBLIC_ORIGIN;

const realNow = Date.now;
let offset = 0;
Date.now = () => realNow() + offset;

const { startApp, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { decryptDeliveryToken } = await import('../platform/deliveryCrypto.js');
const { generateQuestion, loadAllBanks } = await import('../../client/src/engine/generators/index.js');
const { answerTextFor } = await import('../platform/practice.js');
const { GUEST_LIMIT, GUEST_DEFAULTS, GUEST_CSRF_HEADER } = await import('../platform/guestTrial.js');
await loadAllBanks();

const h = await startApp({ engine: requestedEngine(), guest: { limits: { minAnswerMs: 0, mintDayLimit: 100, ipDayLimit: 1000 } } });
// A second server with the shipped address limits, for the rotation checks.
const hl = await startApp({ engine: requestedEngine(), guest: { limits: { minAnswerMs: 0 } } });
const c = checks();
const { asStore } = await import('../platform/store.js');
const store = asStore(h.db);
const DAY = 24 * 60 * 60 * 1000;
const GENERATORS = ['c8-linear-equations-both-sides', 'c9-polynomials', 'c10-quadratic-equations', 'c7-integers', 'c10-arithmetic-progressions'];
const ASK = (extra = {}) => ({ generator: GENERATORS[0], difficulty: 2, curriculum: 'in', form: 'typed', ...extra });
const post = (path, body, jar, headers = {}) => h.request(path, { method: 'POST', jar, body, headers });
const guestCount = async () => Number((await store.get("SELECT COUNT(*) AS n FROM rate_limits WHERE bucket LIKE 'guest-%'")).n);
const rowsIn = async table => Number((await store.get(`SELECT COUNT(*) AS n FROM ${table}`)).n);

async function start(jar = {}) {
  const r = await post('/v1/guest/session', {}, jar);
  return { jar, r, csrf: r.data?.csrf, headers: { [GUEST_CSRF_HEADER]: r.data?.csrf } };
}
const question = (g, extra = {}) => post('/v1/guest/question', ASK(extra), g.jar, g.headers);
const answerKeyOf = sealed => {
  const t = JSON.parse(decryptDeliveryToken(sealed, 'guest-question-v1'));
  const q = generateQuestion(t.g, t.d, t.s, undefined, null);
  return { t, text: answerTextFor(q), q };
};

try {
  c.eq(GUEST_LIMIT, 5, 'the trial is five questions');
  const accountsBefore = await rowsIn('accounts');
  const sessionsBefore = await rowsIn('account_sessions');

  // ── the token ───────────────────────────────────────────────────────────────
  const g = await start();
  c.eq(g.r.status, 200, 'a visitor with no account starts the trial');
  c.deq([g.r.data.limit, g.r.data.used, g.r.data.remaining], [5, 0, 5], 'five questions, none used');
  const setCookie = g.r.headers.getSetCookie?.().find(x => x.startsWith('pri_guest=')) || '';
  c.match(setCookie, /HttpOnly/i, 'the guest cookie is HttpOnly');
  c.match(setCookie, /SameSite=Strict/i, 'and SameSite=Strict');
  c.match(setCookie, /Path=\/v1\/guest/, 'and is sent only to the guest routes');
  c.ok(!/pri_cloud_session|pri_csrf/.test(JSON.stringify(g.r.headers.getSetCookie?.() || [])), 'no sign-in session or session CSRF cookie is set');
  const payload = JSON.parse(decryptDeliveryToken(decodeURIComponent(g.jar.pri_guest), 'guest-token-v1'));
  c.deq(Object.keys(payload).sort(), ['exp', 'iat', 'id'], 'the token holds a random id and two times, nothing else');
  c.eq(payload.exp - payload.iat, DAY, 'and lives one day');
  c.eq((await post('/v1/guest/session', {}, g.jar)).data.csrf, g.csrf, 'starting again with a live token resumes it (same CSRF value, no new mint)');
  c.eq((await post('/v1/guest/session', { name: 'x' }, {})).status, 400, 'the start route takes no fields (no personal data can be sent)');

  // forgery, tampering, replay under another key
  const forged = [
    ['no cookie', {}],
    ['random text', { pri_guest: 'not-a-token' }],
    ['tampered ciphertext', { pri_guest: g.jar.pri_guest.slice(0, -4) + (g.jar.pri_guest.endsWith('AAAA') ? 'BBBB' : 'AAAA') }],
    ['a delivery token of another purpose', { pri_guest: encodeURIComponent(JSON.stringify({ id: 'a'.repeat(32), iat: Date.now(), exp: Date.now() + DAY })) }]
  ];
  for (const [name, jar] of forged) {
    const r = await post('/v1/guest/question', ASK(), jar, { [GUEST_CSRF_HEADER]: g.csrf });
    c.ok([401, 403].includes(r.status) && !r.data?.question, `${name}: refused (${r.status})`);
  }
  c.eq((await post('/v1/guest/question', ASK(), g.jar, {})).status, 403, 'CSRF: no header is refused');
  c.eq((await post('/v1/guest/question', ASK(), g.jar, { [GUEST_CSRF_HEADER]: 'x'.repeat(43) })).status, 403, 'CSRF: a wrong header is refused');
  const other = await start();
  c.eq((await post('/v1/guest/question', ASK(), g.jar, other.headers)).status, 403, 'CSRF: another guest\'s header does not fit this token');
  c.eq((await post('/v1/guest/question', ASK(), g.jar, { 'x-pri-csrf': g.csrf })).status, 403, 'CSRF: the session header name is not the guest header');
  c.eq(await guestCount() > 0, true, 'counters exist');

  // ── a question: no key leaves before the verdict ────────────────────────────
  const q1 = await question(g);
  c.eq(q1.status, 201, 'a typed question is issued');
  const secrets = ['answer', 'steps', 'solution', 'seed', 'traps', 'correctIndex', 'canonical', '_generator', 'marking', 'explanation'];
  const asText = JSON.stringify(q1.data);
  for (const word of secrets) c.ok(!new RegExp(`"${word}"\\s*:`, 'i').test(asText), `the issued question carries no "${word}" field`);
  c.ok(typeof q1.data.question.prompt === 'string' && q1.data.sealed.startsWith('v1.'), 'it carries the prompt and an opaque sealed ticket');
  const key1 = answerKeyOf(q1.data.sealed);
  c.ok(!asText.includes(String(key1.t.s)) || key1.t.s < 10 ** 4, 'the seed is not in the reply');
  c.ok(key1.text && !JSON.stringify(q1.data.question).includes(`"${key1.text}"`), 'the correct answer text is not in the question');
  c.deq([q1.data.remaining, q1.data.limit], [4, 5], 'four left after the first');
  c.eq(q1.headers.get('cache-control'), 'no-store', 'never cached');
  c.eq((await post('/v1/guest/question', ASK({ extra: 1 }), g.jar, g.headers)).status, 400, 'unknown fields are refused');
  c.eq((await post('/v1/guest/question', ASK({ form: 'written' }), g.jar, g.headers)).status, 400, 'handwriting and photo are not forms a guest can ask for');
  c.eq((await post('/v1/guest/question', ASK({ curriculum: 'nsw' }), g.jar, g.headers)).status > 399, true, 'another edition\'s curriculum is refused');
  c.eq((await post('/v1/guest/question', ASK({ generator: 'pyq-jee-advanced-sets' }), g.jar, g.headers)).status > 399, true, 'premium and archive content is refused');

  // ── one verdict per question ────────────────────────────────────────────────
  const wrong = await post('/v1/guest/answer', { sealed: q1.data.sealed, answer: '987654321' }, g.jar, g.headers);
  c.deq([wrong.status, wrong.data.resolved, wrong.data.correct], [200, true, false], 'a wrong answer is marked wrong');
  c.eq(wrong.data.answer, key1.text, 'and only now is the answer shown');
  const again = await post('/v1/guest/answer', { sealed: q1.data.sealed, answer: key1.text }, g.jar, g.headers);
  c.eq(again.data?.error?.code, 'GUEST_ALREADY_ANSWERED', 'the same question cannot be answered again (no second guess, no replay)');
  c.eq((await post('/v1/guest/answer', { sealed: q1.data.sealed, answer: key1.text }, other.jar, other.headers)).status, 403, 'a ticket cannot be answered under another guest\'s token');
  c.eq((await post('/v1/guest/answer', { sealed: 'v1.a.b.c', answer: '1' }, g.jar, g.headers)).status, 400, 'a forged ticket is refused');
  c.eq((await post('/v1/guest/answer', { sealed: q1.data.sealed, answer: key1.text }, g.jar, {})).status, 403, 'answering needs the CSRF header');

  const q2 = await question(g);
  const key2 = answerKeyOf(q2.data.sealed);
  const right = await post('/v1/guest/answer', { sealed: q2.data.sealed, answer: key2.text }, g.jar, g.headers);
  c.deq([right.data.resolved, right.data.correct], [true, true], 'the server\'s deterministic engine marks the right answer right');
  c.ok(right.data.remaining <= 3, 'the remaining count follows');

  // an unreadable entry is not a verdict and reveals nothing; a few tries, then the question closes
  const q3 = await question(g);
  const unread = await post('/v1/guest/answer', { sealed: q3.data.sealed, answer: '((((' }, g.jar, g.headers);
  c.ok(unread.data.invalid === true && unread.data.resolved === false && !('answer' in unread.data) && !('correct' in unread.data), 'an unreadable entry is invalid and shows no verdict or answer');

  // multiple choice
  let choice = null;
  for (const generator of GENERATORS) {
    const probe = await start();
    const r = await question(probe, { generator, form: 'choice', difficulty: 1 });
    if (r.status === 201) { choice = { probe, r, generator }; break; }
  }
  if (choice) {
    c.eq(choice.r.data.question.answerType, 'mcq', 'a multiple-choice question is multiple choice');
    c.ok(Array.isArray(choice.r.data.question.mcqOptions) && choice.r.data.question.mcqOptions.length >= 2, 'with its options');
    const k = answerKeyOf(choice.r.data.sealed);
    const ok = await post('/v1/guest/answer', { sealed: choice.r.data.sealed, answer: String(k.q.answer.correctIndex) }, choice.probe.jar, choice.probe.headers);
    c.deq([ok.data.resolved, ok.data.correct], [true, true], 'the right option is marked right');
  } else c.ok(true, 'no choice question at these chapters (typed covered)');

  // ── the limit ───────────────────────────────────────────────────────────────
  const l = await start();
  for (let i = 0; i < 5; i++) c.eq((await question(l)).status, 201, `question ${i + 1} of 5`);
  const sixth = await question(l);
  c.deq([sixth.status, sixth.data.error.code], [429, 'GUEST_LIMIT_REACHED'], 'the sixth is refused with a sign-up-prompt code');
  c.ok(!sixth.data.question && !sixth.data.sealed, 'and issues nothing');
  c.eq((await post('/v1/guest/session', {}, l.jar)).data.remaining, 0, 'resuming shows none left');
  // clearing the cookie does not reset the count for the address
  // rotation across tokens from one address, on a server with the shipped limits
  const hpost = (path, body, jar, headers = {}) => hl.request(path, { method: 'POST', jar, body, headers });
  const jars = [];
  for (let i = 0; i < 3; i++) { const jar = {}; const r = await hpost('/v1/guest/session', {}, jar); jars.push({ jar, headers: { [GUEST_CSRF_HEADER]: r.data.csrf } }); }
  let issued = 0;
  for (const t of jars) for (let i = 0; i < 5; i++) { const r = await hpost('/v1/guest/question', ASK(), t.jar, t.headers); if (r.status === 201) issued++; }
  c.eq(issued, 15, 'three tokens from one address get their five each (15 = the address ceiling)');
  const j4 = {};
  const s4 = await hpost('/v1/guest/session', {}, j4);
  c.eq(s4.status, 200, 'a fourth token is still minted (a person clearing cookies is served)');
  const r4 = await hpost('/v1/guest/question', ASK(), j4, { [GUEST_CSRF_HEADER]: s4.data.csrf });
  c.deq([r4.status, r4.data.error.code], [429, 'GUEST_ADDRESS_LIMIT'], 'but it is worth nothing: the address has had its 15');
  let minted = 4, mintRefused = null;
  for (let i = 0; i < 12; i++) { const r = await hpost('/v1/guest/session', {}, {}); if (r.status === 200) minted++; else mintRefused = r.data.error.code; }
  c.deq([minted, mintRefused], [GUEST_DEFAULTS.mintDayLimit, 'GUEST_ADDRESS_LIMIT'], 'tokens minted per address are capped at six, then refused');

  // an unreadable entry may be retried a few times, then the question closes without a verdict
  for (let i = 0; i < 3; i++) await post('/v1/guest/answer', { sealed: q3.data.sealed, answer: '((((' }, g.jar, g.headers);
  c.eq((await post('/v1/guest/answer', { sealed: q3.data.sealed, answer: '((((' }, g.jar, g.headers)).data?.error?.code, 'GUEST_ALREADY_ANSWERED', 'after four unreadable entries the question is closed, still with no verdict');

  // think time, the process-wide ceiling and a question's own expiry, on a server with the shipped think time
  const hf = await startApp({ engine: requestedEngine(), guest: { limits: { globalDayLimit: 2, mintDayLimit: 100, ipDayLimit: 100 } } });
  try {
    const fpost = (path, body, jar, headers = {}) => hf.request(path, { method: 'POST', jar, body, headers });
    const jar = {}; const s = await fpost('/v1/guest/session', {}, jar); const hd = { [GUEST_CSRF_HEADER]: s.data.csrf };
    const a1 = await fpost('/v1/guest/question', ASK(), jar, hd);
    const fast = await fpost('/v1/guest/answer', { sealed: a1.data.sealed, answer: '1' }, jar, hd);
    c.deq([fast.status, fast.data.error.code], [429, 'GUEST_TOO_FAST'], 'an answer faster than a person can read the question is refused (and no verdict is given)');
    offset += GUEST_DEFAULTS.minAnswerMs + 500;
    c.eq((await fpost('/v1/guest/answer', { sealed: a1.data.sealed, answer: '1' }, jar, hd)).data.resolved, true, 'after the think time it is marked');
    const a2 = await fpost('/v1/guest/question', ASK(), jar, hd);
    c.eq(a2.status, 201, 'the second question of the process-wide two');
    const a3 = await fpost('/v1/guest/question', ASK(), jar, hd);
    c.deq([a3.status, a3.data.error.code], [429, 'GUEST_BUSY'], 'past the process-wide daily ceiling nothing more is marked, whoever asks');
    offset += GUEST_DEFAULTS.questionTtlMs + 1000;
    const stale = await fpost('/v1/guest/answer', { sealed: a2.data.sealed, answer: '1' }, jar, hd);
    c.deq([stale.status, stale.data.error.code], [410, 'GUEST_QUESTION_EXPIRED'], 'a question not answered within half an hour has expired');
  } finally { await hf.close(); }

  // ── review findings (19 Nov 2026): /48 rotation, refusals that cost nothing, keyed route counter, lost verdicts ──
  {
    const { guestAddressBuckets } = await import('../platform/guestTrial.js');
    const { createHash } = await import('node:crypto');
    const fake = ip => ({ ip, get: () => undefined, headers: {} });
    const a = guestAddressBuckets(fake('2001:db8:abcd:1::1')), b = guestAddressBuckets(fake('2001:db8:abcd:2:ffff::9')), cc = guestAddressBuckets(fake('2001:db8:abce:1::1'));
    c.deq([a.address !== b.address, a.prefix === b.prefix, a.prefix !== cc.prefix], [true, true, true], 'two /64s of one /48 share a /48 bucket and not a /64 bucket; another /48 shares neither');
    c.eq(guestAddressBuckets(fake('2001:db8:abcd::1')).address, guestAddressBuckets(fake('2001:0db8:ABCD:0000:0:0:0:1')).address, 'a compressed and an expanded spelling of one address are one bucket');
    c.eq(guestAddressBuckets(fake('203.0.113.7')).prefix, null, 'an IPv4 address has no /48 bucket');
    const env = process.env.PRI_CLIENT_IP_HEADER;
    process.env.PRI_CLIENT_IP_HEADER = 'x-real-ip';
    const open = async limits => {
      const app = await startApp({ engine: requestedEngine(), guest: { limits: { minAnswerMs: 0, mintDayLimit: 100, ipDayLimit: 100, ...limits } } });
      const at = (path, body, jar, ip, headers = {}) => app.request(path, { method: 'POST', jar, body, headers: { 'x-real-ip': ip, ...headers } });
      return { app, at };
    };
    try {
      // rotating /64s inside one /48 cannot mint tokens or questions past the /48 counters
      const m = await open({ prefixMintDayLimit: 3, prefixDayLimit: 3 });
      try {
        const minted = [];
        for (let i = 1; i <= 5; i++) minted.push((await m.at('/v1/guest/session', {}, {}, `2001:db8:5:${i}::1`)).status);
        c.deq(minted, [200, 200, 200, 429, 429], 'tokens minted from rotating /64s of one /48 stop at the /48 limit (3), though no /64 has minted more than one');
        const refusedMint = await m.at('/v1/guest/session', {}, {}, '2001:db8:5:9::1');
        c.eq(refusedMint.data.error.code, 'GUEST_ADDRESS_LIMIT', 'refused as the address limit');
        const other = await m.at('/v1/guest/session', {}, {}, '2001:db8:6:1::1');
        c.eq(other.status, 200, 'another /48 is unaffected');
        const asked = [];
        for (let i = 1; i <= 5; i++) {
          const jar = {}; const sess = await m.at('/v1/guest/session', {}, jar, `2001:db8:7:${i}::1`);
          if (sess.status !== 200) { asked.push('no-token'); continue; }
          asked.push((await m.at('/v1/guest/question', ASK(), jar, `2001:db8:7:${i}::1`, { [GUEST_CSRF_HEADER]: sess.data.csrf })).status);
        }
        c.ok(asked.filter(x => x === 201).length <= 3, `at most three questions from rotating /64s of one /48 (${asked.join(',')})`);
      } finally { await m.app.close(); }

      // a refusal by the address or the process costs the visitor nothing
      const o = await open({ ipDayLimit: 1, globalDayLimit: 2 });
      try {
        const jar = {}; const sess = await o.at('/v1/guest/session', {}, jar, '203.0.113.20');
        const hd = { [GUEST_CSRF_HEADER]: sess.data.csrf };
        const first = await o.at('/v1/guest/question', ASK(), jar, '203.0.113.20', hd);
        c.deq([first.status, first.data.remaining], [201, 4], 'the first question spends one of the five');
        const refusedAddr = await o.at('/v1/guest/question', ASK(), jar, '203.0.113.20', hd);
        c.deq([refusedAddr.status, refusedAddr.data.error.code], [429, 'GUEST_ADDRESS_LIMIT'], 'the address limit refuses the second');
        c.eq((await o.at('/v1/guest/session', {}, jar, '203.0.113.20')).data.remaining, 4, 'GUEST_ADDRESS_LIMIT leaves the token with four remaining (nothing spent by the refusal)');
        const second = await o.at('/v1/guest/question', ASK(), jar, '203.0.113.21', hd);
        c.deq([second.status, second.data.remaining], [201, 3], 'from another address the same token goes on, at three');
        const busy = await o.at('/v1/guest/question', ASK(), jar, '203.0.113.22', hd);
        c.deq([busy.status, busy.data.error.code], [429, 'GUEST_BUSY'], 'past the process ceiling: GUEST_BUSY');
        c.eq((await o.at('/v1/guest/session', {}, jar, '203.0.113.22')).data.remaining, 3, 'GUEST_BUSY leaves the token with three remaining');
        const ip22 = await o.app.db.get("SELECT COUNT(*) AS n FROM rate_limits WHERE bucket LIKE 'guest-ip:%'");
        c.eq(Number(ip22.n), 3, 'and the refused address left its counter at what it had spent (three addresses, each 1 or 0)');
        const sumRow = await o.app.db.get("SELECT SUM(count) AS n FROM rate_limits WHERE bucket LIKE 'guest-ip:%'");
        c.eq(Number(sumRow.n), 2, 'the address counters sum to the two questions actually served');
        // keyed route counter: no row is the plain sha256 of an address
        const routeRows = (await o.app.db.all("SELECT bucket FROM rate_limits WHERE bucket LIKE 'guest-route:%'")).map(r => r.bucket);
        const plainHashes = ['203.0.113.20', '203.0.113.21', '203.0.113.22', '127.0.0.1', '::ffff:127.0.0.1', '::1'].map(ip => `guest-route:${createHash('sha256').update(ip).digest('hex').slice(0, 24)}`);
        c.ok(routeRows.length >= 3 && routeRows.every(r => !plainHashes.includes(r)), 'the route limiter names its counters with the guest key: no guest-route row is an unkeyed hash of an address');
      } finally { await o.app.close(); }

      // a verdict lost in transit is re-fetched by the same token, once, without a second marking
      const v = await open({});
      try {
        const jar = {}; const sess = await v.at('/v1/guest/session', {}, jar, '203.0.113.30');
        const hd = { [GUEST_CSRF_HEADER]: sess.data.csrf };
        const qq = await v.at('/v1/guest/question', ASK(), jar, '203.0.113.30', hd);
        const key = answerKeyOf(qq.data.sealed);
        const wrong = key.text + '9';
        const one = await v.at('/v1/guest/answer', { sealed: qq.data.sealed, answer: wrong }, jar, '203.0.113.30', hd);
        const again = await v.at('/v1/guest/answer', { sealed: qq.data.sealed, answer: wrong }, jar, '203.0.113.30', hd);
        c.deq([one.data.resolved, one.data.correct, again.status, again.data.resolved, again.data.correct, again.data.remaining], [true, false, 200, true, false, one.data.remaining], 'the same answer sent again after a lost reply gets the same verdict');
        c.eq((await v.at('/v1/guest/session', {}, jar, '203.0.113.30')).data.remaining, one.data.remaining, 'and spends nothing');
        const other = await v.at('/v1/guest/answer', { sealed: qq.data.sealed, answer: key.text }, jar, '203.0.113.30', hd);
        c.deq([other.status, other.data.error.code], [409, 'GUEST_ALREADY_ANSWERED'], 'a different answer to a closed question is not marked');
        const jar2 = {}; const sess2 = await v.at('/v1/guest/session', {}, jar2, '203.0.113.30');
        const stranger = await v.at('/v1/guest/answer', { sealed: qq.data.sealed, answer: wrong }, jar2, '203.0.113.30', { [GUEST_CSRF_HEADER]: sess2.data.csrf });
        c.eq(stranger.status, 403, 'another token cannot re-fetch it');
        offset += GUEST_DEFAULTS.verdictRetryMs + 1000;
        const late = await v.at('/v1/guest/answer', { sealed: qq.data.sealed, answer: wrong }, jar, '203.0.113.30', hd);
        c.eq(late.status, 409, 'after the short window the question is closed for good');
      } finally { await v.app.close(); }
    } finally { if (env === undefined) delete process.env.PRI_CLIENT_IP_HEADER; else process.env.PRI_CLIENT_IP_HEADER = env; }
  }

  // ── expiry ──────────────────────────────────────────────────────────────────
  offset += DAY + 60_000;
  const late = await post('/v1/guest/question', ASK(), g.jar, g.headers);
  c.eq(late.status, 401, 'an expired token is refused');
  const late2 = await post('/v1/guest/answer', { sealed: q3.data.sealed, answer: '1' }, g.jar, g.headers);
  c.eq(late2.status, 401, 'and so is answering under it');

  // ── nothing else is reachable ───────────────────────────────────────────────
  c.deq([await rowsIn('accounts'), await rowsIn('account_sessions'), await rowsIn('learning_events'), await rowsIn('idempotency_keys'), await rowsIn('audit_log'), await rowsIn('sync_entities')], [accountsBefore, sessionsBefore, 0, 0, 0, 0], 'no account, session, learning, escrow, audit or sync row was created by any of it');
  const g2 = await start();
  for (const [method, path, body] of [
    ['GET', '/v1/account/me'], ['GET', '/v1/sync/pull'], ['GET', '/v1/practice/review-queue'], ['POST', '/v1/practice/issue', { generator: GENERATORS[0], difficulty: 2, curriculum: 'in' }],
    ['POST', '/v1/handwriting/transcribe', { image: 'x' }], ['POST', '/v1/questions/photo', {}], ['GET', '/v1/billing/status'], ['POST', '/v1/exams/start', {}], ['GET', '/v1/curriculum/']
  ]) {
    const r = await h.request(path, { method, jar: g2.jar, headers: g2.headers, body });
    c.ok([401, 403, 404].includes(r.status), `${method} ${path} with a guest token: ${r.status} (no session)`);
  }
  // no guest route shape outside the four reviewed
  const stray = await h.request('/v1/guest/history', { jar: g2.jar });
  c.eq(stray.status, 404, 'there is no guest history');

  // the whole feature can be switched off by the deployment
  process.env.PRI_GUEST_TRIAL = 'off';
  c.eq((await post('/v1/guest/session', {}, {})).status, 404, 'PRI_GUEST_TRIAL=off answers 404');
  delete process.env.PRI_GUEST_TRIAL;

  console.log(`engine: ${h.engine}`);
  console.log(`✓ guest-trial-check.mjs (${c.count()} checks)`);
} finally {
  await h.close();
  await hl.close();
}
