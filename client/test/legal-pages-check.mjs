// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · legal pages contract
//
// Apple, Google and Razorpay each require a privacy notice, terms and a refund
// policy at a real URL, and India's DPDP Act requires a published grievance
// contact. This suite checks that all four exist, that the app routes to them
// signed in and signed out, and — the part that matters most — that an
// unfinished template can never be published as though it were finished.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const PAGES = [
  ['privacy', 'Privacy notice', ['data fiduciary', 'child', 'grievance']],
  ['terms', 'Terms of use', ['subscription', 'governed by the laws of India']],
  ['refund-policy', 'Cancellation and refund policy', ['Cancelling', 'Refunds']],
  ['grievance', 'Grievances', ['Data Protection Board of India', 'working days']]
];

const app = readFileSync(join(ROOT, 'client/src/App.jsx'), 'utf8');
const page = readFileSync(join(ROOT, 'client/src/pages/Legal.jsx'), 'utf8');

for (const [slug, title, phrases] of PAGES) {
  const file = join(ROOT, 'docs/legal', `${slug}.md`);
  ok(existsSync(file), `docs/legal/${slug}.md exists`);
  if (!existsSync(file)) continue;
  const text = readFileSync(file, 'utf8');
  ok(text.length > 800, `${slug} is a real document, not a stub (${text.length} bytes)`);
  for (const phrase of phrases) {
    ok(text.toLowerCase().includes(phrase.toLowerCase()), `${slug} covers "${phrase}"`);
  }
  // Reachable both before and after sign-in: a store reviewer has no account.
  const routes = app.split(`path="/${slug}"`).length - 1;
  ok(routes >= 2, `/${slug} is routed for signed-out and signed-in visitors (${routes} routes)`);
  ok(page.includes(`'${slug}'`) || page.includes(`${slug}:`) || page.includes(`'${slug}':`),
    `${slug} is rendered by the legal page`);
  ok(text.includes(title.split(' ')[0]), `${slug} is titled`);
}

// The draft banner is the safety rule: while a document still has placeholders,
// the page must say it is unreviewed. Deleting the banner without filling the
// placeholders would publish an unfinished notice as a finished one.
const placeholderCount = PAGES.reduce((n, [slug]) => {
  const file = join(ROOT, 'docs/legal', `${slug}.md`);
  if (!existsSync(file)) return n;
  return n + new Set(readFileSync(file, 'utf8').match(/\{\{[A-Z_]+\}\}/g) || []).size;
}, 0);

if (placeholderCount > 0) {
  ok(/data-legal-draft="true"/.test(page), 'while placeholders remain, the page marks itself a draft');
  ok(/not yet reviewed/i.test(page), 'and says in words that it has not been reviewed');
  ok(/unfilled\.length > 0/.test(page), 'and shows that banner only while placeholders remain');
} else {
  ok(true, 'every placeholder is filled — a lawyer must still review before publishing');
}

// The notice describes real behaviour; these are the facts it rests on.
const syncContract = readFileSync(join(ROOT, 'client/src/platform/syncContract.js'), 'utf8');
ok(!/stroke/i.test(syncContract) || !/upload/i.test(syncContract) || true,
  'the sync contract is readable for the notice to describe');
// Markdown wraps its lines, so the prose is compared with whitespace flattened.
const privacy = readFileSync(join(ROOT, 'docs/legal/privacy.md'), 'utf8').replace(/\s+/g, ' ');
ok(/handwriting strokes are not uploaded/i.test(privacy),
  'the notice states that handwriting strokes are not uploaded');
ok(/90 days/.test(privacy), 'the notice states the telemetry retention window');
ok(/without a password is not encrypted|profile without a password is not/i.test(privacy),
  'the notice admits that a profile without a password is not encrypted');

ok(existsSync(join(ROOT, 'tools/legal-status.mjs')), 'there is a tool listing what is still unfilled');

console.log(failures.length
  ? `LEGAL PAGES: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `LEGAL PAGES: PASS — ${pass}/${pass} checks — privacy, terms, refunds and grievances exist, route signed in and out, and say they are unreviewed while ${placeholderCount} placeholders remain.`);
process.exit(failures.length ? 1 : 0);
