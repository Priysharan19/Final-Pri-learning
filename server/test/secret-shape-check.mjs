// The secret-shape sweep (security-acceptance-check.mjs, F) must read a real
// provider key wherever it appears and must never read the server's own random
// tokens as one (issue #526: a session/CSRF value — 32 bytes of base64url —
// contained `re_` or `sk-` followed by twenty letters and digits in about one
// run in 150, and the suite failed on nothing).
//
// Deterministic: every random-looking token below is drawn from a seeded
// generator, and every leaked key is crafted here. Secret-shaped values are
// assembled at runtime so the repository secret scan never sees one committed.
import assert from 'node:assert/strict';
import { secretShaped, stripMintedTokens } from './support/secret-shapes.mjs';

let n = 0;
const ok = (condition, message) => { assert.ok(condition, message); n++; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); n++; };

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const rand = mulberry32(526);
/** A 43-character base64url token, the shape of opaqueToken() (32 bytes). */
const minted = () => Array.from({ length: 43 }, () => B64URL[Math.floor(rand() * 64)]).join('');
const shaped = (prefix, body) => `${prefix}${body}`;
const cookieLine = value => `200 {"set-cookie":"pri_csrf=${value}; Max-Age=2592000; Path=/; SameSite=Lax","content-type":"application/json"} {"ok":true}`;
const sessionLine = value => `201 {"set-cookie":"pri_cloud_session=${value}; HttpOnly; Path=/"} {"account":{"id":"acc_1"}}`;

// ── 1. The server's own mints are never a match ─────────────────────────────
{
  // The two spurious matches that opened #526, inside a longer token: a random
  // value containing `re_`/`sk-` + twenty alphanumerics mid-token.
  const embedded = ['9re_6SfzYKJUtpLL3Lp8NYTveA8V1hqKS6AwVF6vVU8', 'LYsk-8UMsbALJ2uLXoYtz912PshzvJaOJ4BVcoGgKSo'];
  for (const token of embedded) {
    eq(secretShaped(cookieLine(token)), [], `a cookie value containing a secret shape mid-token is not a leak: ${token}`);
    eq(secretShaped(`{"requestId":"${token}"}`), [], `a request id containing a secret shape mid-token is not a leak: ${token}`);
  }
  // A mint that STARTS with the shape — a whole-token match on the value alone.
  const leading = [shaped('re_', 'STZlGLgxrzvlssP61FscWDjgzVgh9HvIqodDmmQE'), shaped('sk-', 'WYf7JaK1PjzWI4Ib2mFUjlR9iBlMgbrNVtTUxHrc')];
  for (const token of leading) {
    eq(secretShaped(cookieLine(token)), [], `a CSRF value that begins with a secret shape is the server's mint, not a leak: ${token}`);
    eq(secretShaped(sessionLine(token)), [], `a session value that begins with a secret shape is the server's mint, not a leak: ${token}`);
  }
  eq(stripMintedTokens(cookieLine(leading[0])).includes(leading[0]), false, 'the cookie value is blanked before the shapes are searched');
  ok(stripMintedTokens(cookieLine(leading[0])).includes('pri_csrf=<minted>'), 'and the cookie name is kept');
  // Many runs' worth of minted values, all at once: 20,000 seeded tokens in
  // cookie position (what the sweep actually saw ~1,600 of per run).
  const lines = [];
  for (let i = 0; i < 20000; i++) lines.push(i % 2 ? cookieLine(minted()) : sessionLine(minted()));
  eq(secretShaped(lines.join('\n')), [], '20,000 seeded session/CSRF values produce no secret-shaped match');
  // The same values are still searched for an exact configured secret: the
  // strip is for the shapes only. (The acceptance suite runs that search on
  // the unstripped text; this pins that the helper leaves it possible.)
  const configured = shaped('re_', 'ACCEPTANCE_resendSECRET0123456789abcd');
  ok(cookieLine(configured).includes(configured), 'a configured secret planted in a cookie is still visible to the exact search on the raw text');
}

// ── 2. A real key is read wherever it appears ───────────────────────────────
{
  const keys = {
    'OpenAI legacy': shaped('sk-', 'T3BlbkFJ0123456789abcdefghijklmnopqrstuvwxyzABCD'),
    'OpenAI project': shaped('sk-proj-', 'ab12CD34ef56GH78ij90KL12mn34OP56qr78ST90uv12WX34yz56_AB78-cd90EF12gh34IJ56kl78MN90'),
    'OpenAI service account': shaped('sk-svcacct-', 'ab12CD34ef56GH78ij90KL12mn34OP56qr78ST90uv12WX34'),
    Resend: shaped('re_', 'AbCdEfGh_12345678901234567890abcd'),
    'Razorpay live key id': shaped('rzp_', 'live_ABCDEFGHIJKLMN'),
    'Razorpay test key id': shaped('rzp_', 'test_abcdefghij1234')
  };
  const placements = {
    'JSON string': key => `500 {"content-type":"application/json"} {"error":{"message":"upstream failure; you sent {\\"authorization\\":\\"Bearer ${key}\\"}"}}`,
    'bare JSON field': key => `{"apiKey":"${key}"}`,
    'header value': key => `200 {"x-provider-key":"${key}"} {}`,
    'log line': key => `[provider] calling https://api.example/v1 with key ${key} (retry 1)`,
    'end of line': key => `resend: ${key}`,
    'start of text': key => `${key} was echoed`,
    'beside a cookie': key => `${cookieLine(minted())} ${key}`
  };
  for (const [kind, key] of Object.entries(keys)) {
    for (const [where, place] of Object.entries(placements)) {
      eq(secretShaped(place(key)), [key], `${kind} is read as a leak in a ${where}`);
    }
  }
  // PEM headers are assembled too, so the repository secret scan never sees one.
  const pemHeader = label => ['-----BEGIN', label, 'PRIVATE', 'KEY-----'].filter(Boolean).join(' ');
  const pem = pemHeader('RSA');
  eq(secretShaped(`{"key":"${pem}\\nMIIEowIBAAKCAQEA\\n-----END RSA PRIVATE KEY-----"}`), [pem], 'a PEM private-key header is read as a leak');
  eq(secretShaped(`${pemHeader(null)}\nMIIE`), [pemHeader(null)], 'an unlabelled PEM private-key header is read as a leak');
  // Several leaks in one haystack are all reported, once each.
  const two = `${placements['log line'](keys.Resend)}\n${placements['JSON string'](keys['OpenAI project'])}`;
  eq(secretShaped(two), [keys.Resend, keys['OpenAI project']], 'every leak in a haystack is reported');
}

// ── 3. The boundary is a token boundary, not a word boundary ────────────────
{
  const key = shaped('sk-', 'T3BlbkFJ0123456789abcdefghijklmnopqrstuvwxyzABCD');
  eq(secretShaped(`x${key}`), [], 'a key glued to a preceding token character is not a whole token');
  eq(secretShaped(`${key}x`), [`${key}x`], 'a longer token that begins with a key shape is reported whole, never cut short');
  eq(secretShaped(`x${key}x`), [], 'a key shape buried inside a longer token is not reported at all');
  eq(secretShaped(`"${key}"`), [key], 'quotes delimit a token');
  eq(secretShaped(`=${key};`), [key], 'punctuation delimits a token');
  eq(secretShaped('sk-tooshort'), [], 'a prefix on a short tail is not a key');
  eq(secretShaped('rzp_live_short'), [], 'a Razorpay prefix on a short tail is not a key');
  eq(secretShaped('PRACTICE_ISSUE_INVALID re_entry_point SK-NOT-A-KEY-0123456789'), [], 'error codes, words and upper-case look-alikes are not keys');
}

// ── 4. The other random values the sweep sees cannot form a shape ───────────
// A dump of one acceptance run, after the cookie strip, held about 500 long
// whole tokens that were not UUIDs or hex: weak ETags (a hex length, a dash,
// standard base64), prefixed UUID ids (`acct_…`), a base32 TOTP secret and
// base62 nonces. None of those alphabets contains both a shape's prefix and
// its separator (`-` after `sk`, `_` after `re`/`rzp`), so none can ever start
// a match: pinned here with seeded values of each kind, in bulk.
{
  const alphabet = chars => (len, r) => Array.from({ length: len }, () => chars[Math.floor(r() * chars.length)]).join('');
  const base64 = alphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/');
  const base62 = alphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789');
  const base32 = alphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567');
  const hex = alphabet('0123456789abcdef');
  const r = mulberry32(5261);
  const uuid = () => `${hex(8, r)}-${hex(4, r)}-${hex(4, r)}-${hex(4, r)}-${hex(12, r)}`;
  const lines = [];
  for (let i = 0; i < 5000; i++) {
    lines.push(`200 {"etag":"W/\\"${hex(2 + (i % 3), r)}-${base64(27, r)}\\"","content-type":"application/json"} {"id":"acct_${uuid()}","requestId":"${uuid()}"}`);
    lines.push(`{"secret":"${base32(32, r)}","nonce":"${base62(32, r)}","sub":"sub_${uuid()}","key":"${base64(43, r)}"}`);
  }
  eq(secretShaped(lines.join('\n')), [], '10,000 lines of ETags, prefixed and bare UUIDs, base32 secrets, base62 nonces and base64 values produce no secret-shaped match');
  eq(secretShaped('W/"11c-sk-AbCdEfGhIjKlMnOpQrStUvWxYz0123"'), [], 'a shape glued inside an ETag value is part of that token, not a key');
}

console.log(`SECRET SHAPES — PASS — ${n} checks`);
