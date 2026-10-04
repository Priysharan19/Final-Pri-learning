// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Content provenance ledger (ledger §5.6)
//
// What a chapter's "verified 2026-10" badge actually stands on, and nothing
// more. Three digests, each built from the one below it, all deterministic:
//
//   generator digest  — content-certify.mjs: the content hashes of fixed seeds
//                       at every difficulty of one generator. It moves when the
//                       same (generator, difficulty, seed) makes a different
//                       question — a changed prompt, option, answer or figure.
//   chapter digest    — this file: the generator digests of every generator a
//                       chapter's `covers` names, in a fixed order. A question
//                       tampered with anywhere behind the chapter changes it.
//   release digest    — this file: every chapter digest plus CONTENT_VERSION.
//                       One value for the whole release; what the Coverage page
//                       prints beside "verified".
//
// WHAT "VERIFIED" MEANS HERE. It means the runtime certification
// (`npm run content:certify`) ran on exactly this content and the committed
// ledger matches what the generators produce now. It is automated review: the
// engine's own marker round-tripped every keyed answer, KaTeX rendered every
// formula, every figure survived the sanitiser. No Indian teacher has read a
// question, and nothing in this file can say otherwise — the tier label a
// surface shows beside the date must say "automated review".
//
// NOT A SIGNATURE. There is no private key in this repository, so the release
// digest is a pinned checksum, not a cryptographic signature: CI fails when the
// generators no longer match the committed ledger, and a reader can recompute
// it from the public source. Calling it "signed" would overstate it.
// ─────────────────────────────────────────────────────────────────────────────
import { contentDigest, CONTENT_VERSION } from './contentIdentity.js';

/** The generator ids a chapter's covers name, deduplicated and sorted. */
export function chapterGeneratorIds(chapter) {
  return [...new Set((chapter?.covers || []).map(c => String(c.gen)))].sort();
}

/**
 * The digest of one chapter: its generator digests, in generator-id order.
 * A generator with no digest (not yet certified) is recorded as such, so a
 * chapter gaining an uncertified generator still changes digest.
 */
export function chapterDigestOf(chapter, generatorDigests = {}) {
  const parts = chapterGeneratorIds(chapter).map(id => `${id}=${generatorDigests[id] || 'uncertified'}`);
  return contentDigest(`${chapter?.id || ''}|${parts.join('|')}`);
}

/** One digest for a whole release: every chapter digest under one content version. */
export function releaseDigestOf(chapterDigests = {}, version = CONTENT_VERSION) {
  const parts = Object.keys(chapterDigests).sort().map(id => `${id}=${chapterDigests[id]}`);
  return contentDigest(`${version}|${parts.join('|')}`);
}

/** Short form shown beside "verified" — the first eight hex digits. */
export const shortDigest = d => String(d || '').slice(0, 8);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The "verified <month>" label is only ever derived from the ledger's own
 * date; a surface never prints today's date as a verification date.
 */
export function verifiedMonthOf(verifiedAt) {
  return DATE_RE.test(String(verifiedAt || '')) ? String(verifiedAt).slice(0, 7) : null;
}

/** The review tier a chapter honestly belongs to. No tier here claims human review. */
export function reviewTierOf(chapter) {
  return chapter?.native ? 'source-mapped-automated' : 'reused-generator-automated';
}
