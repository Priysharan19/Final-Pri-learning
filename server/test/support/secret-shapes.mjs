// What a leaked provider secret looks like in a response, a header or a log
// line — for the sweep in security-acceptance-check.mjs (F) and its own test.
//
// Two rules, in this order:
//
// 1. The server's own random mints are not candidates. A session or CSRF
//    cookie value is 32 bytes of base64url — letters, digits, '-' and '_' —
//    so a minted value can hold `re_` or `sk-` followed by twenty letters and
//    digits somewhere inside it, and the sweep read that random token as a
//    key. It searched ~1,600 such values per run; issue #526's simulation over
//    a captured run put the spurious failures at ~0.7 % of runs. The VALUE of
//    every cookie the server sets is therefore blanked before the shapes are
//    searched; the cookie's name stays, so a shape in the wrong place still
//    reads. A provider key could only ever reach a cookie through a bug the
//    exact configured-secret search (which runs on the unstripped text)
//    catches anyway: nothing is excluded from that search.
//
// 2. A secret is a whole token. Keys are delimited by quotes, spaces, `=` or
//    punctuation wherever they appear — JSON strings, `Bearer …`, a log line —
//    never embedded in a longer run of token characters. Each KEY shape is
//    anchored to token boundaries on both sides so `9re_6Sfz…` inside some
//    other identifier is not a match, while `"re_…"` or ` re_…` is. The tails
//    allow '_' and '-' because real keys carry them (OpenAI project keys,
//    Resend's `re_xxxxxxxx_xxxxxxxx…`, which the old `re_[A-Za-z0-9]{20,}`
//    could not read at all), so the anchors — not the alphabet — are what
//    keep a random token out. A PEM private-key header is NOT anchored: it
//    contains spaces, so no random token can produce one, and anchoring it
//    would only lose a header glued to its body when a newline is collapsed
//    (`-----BEGIN PRIVATE KEY-----MIIE…`).
//
// Everything is deterministic given the text, so secret-shape-check.mjs can
// pin both halves with crafted tokens.

/** Server-set cookies, by prefix; their values are random mints, never content. */
const MINTED_COOKIE = /\b(pri_[a-z_]+)=([A-Za-z0-9_-]+)/g;

export function stripMintedTokens(text) {
  return String(text).replace(MINTED_COOKIE, (_, name) => `${name}=<minted>`);
}

const BOUNDARY_BEFORE = '(?<![A-Za-z0-9_-])';
const BOUNDARY_AFTER = '(?![A-Za-z0-9_-])';
const KEY_SHAPES = [
  'sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}',   // OpenAI: legacy, project and service-account keys
  'rzp_(?:live|test)_[A-Za-z0-9]{10,}',          // Razorpay key id
  're_[A-Za-z0-9_]{20,}'                         // Resend
];
const PEM_PRIVATE_KEY = '-----BEGIN [A-Z ]*PRIVATE KEY-----';  // any PEM private key; unanchored (see 2.)
export const SECRET_SHAPE = new RegExp(`${BOUNDARY_BEFORE}(?:${KEY_SHAPES.join('|')})${BOUNDARY_AFTER}|${PEM_PRIVATE_KEY}`, 'g');

/**
 * Every secret-shaped whole token in `text`, after the server's own random
 * mints are set aside. Empty when nothing secret-shaped appears.
 */
export function secretShaped(text) {
  return [...stripMintedTokens(text).matchAll(SECRET_SHAPE)].map(m => m[0]);
}
