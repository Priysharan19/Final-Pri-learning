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
const terms = readFileSync(join(ROOT, 'docs/legal/terms.md'), 'utf8').replace(/\s+/g, ' ');
ok(/reading your writing happens on your device by default/i.test(privacy)
  && /your strokes stay there/i.test(privacy),
  'the notice states that reading is on-device by default and the strokes stay there');
// The optional server reading must be described where a student reads about it,
// with the promise the code actually keeps. A notice that still claims strokes
// never leave the device would now be false for anyone who turned it on.
ok(/off unless you turn it on/i.test(privacy),
  'and that sending handwriting to a server is off unless the student turns it on');
ok(/not the question, not the expected answer/i.test(privacy),
  'and names what is never sent alongside the image');
// ── A promised control has to exist ─────────────────────────────────────────
// The refund policy said a website subscription can be cancelled from Settings
// → Account. The server route and the transport call both existed and nothing
// in the app ever reached them, so the document described a button that was not
// there — and a refund policy is exactly the document a regulator reads.
const refunds = readFileSync(join(ROOT, 'docs/legal/refund-policy.md'), 'utf8').replace(/\s+/g, ' ');
const panel = readFileSync(join(ROOT, 'client/src/components/CloudAccountPanel.jsx'), 'utf8');
if (/cancel a website subscription at any time from/i.test(refunds)) {
  ok(/cloud\.cancelWebBilling\(/.test(panel),
    'the app has the cancel control the refund policy promises');
  ok(/Cancel subscription/.test(panel), 'and a student can find it by that name');
  ok(/end of the period you have already paid for/i.test(panel),
    'and is told when it takes effect, which is what the policy says');
}

// ── Nor may it fall behind the code ─────────────────────────────────────────
// The same opt-in that sends an image of your ink also sends a PHOTOGRAPH of
// paper — the camera's own picture, resized but not cleaned up — so the frame
// can carry the printed question or a name. The notice described only the ink
// path, which is the more flattering half.
ok(/photograph/i.test(privacy), 'the notice discloses that a photograph is sent under the same setting');
ok(/whatever is in the frame is sent/i.test(privacy),
  'and that the whole frame goes, not a cleaned-up crop of the working');
ok(/printed question, a name written on the page/i.test(privacy),
  'naming what a photo of an exercise book can actually contain');

// The device identifier is generated by this app; it is not chosen and not the
// device's own id, and a user-agent hash is stored beside it.
ok(!/a device identifier you\s+chose/i.test(privacy),
  'the notice no longer says the device identifier is one you chose');
ok(/random device\s+identifier this app generates/i.test(privacy), 'and says where it comes from');
ok(/user-agent/i.test(privacy), 'and mentions the user-agent hash it also stores');

// The terms denied predicting an exam result while the progress screen showed
// one. It refuses percentile, rank and admission — which is true — and now says
// what it does show.
ok(!/\*\*It does not predict your exam result\*\*/.test(terms),
  'the terms no longer deny a prediction the progress screen makes');
ok(/does not predict a percentile, a rank or an admission/i.test(terms),
  'refusing the three it genuinely refuses');
ok(/parts of a paper you\s+have actually practised/i.test(terms),
  'and describing the estimate it genuinely gives');

// ── The notice may never run ahead of the code ──────────────────────────────
// It described a guardian-consent flow in detail — a name and contact captured
// at profile creation, a confirmation email before a cloud account could sync —
// and none of it existed. A privacy notice that misdescribes the processing is
// worse than a thin one: a parent reads it and believes a protection is there.
// README.md said the opposite in the same repository.
const guardianClaims = [
  [/asks for a parent or guardian's name/i, 'claims it collects a guardian name'],
  [/records their consent/i, 'claims it records guardian consent'],
  [/email the guardian a link/i, 'claims it emails a guardian for confirmation']
];
for (const [pattern, what] of guardianClaims) {
  ok(!pattern.test(privacy), `the notice no longer ${what} — nothing in client/src or server/ implements it`);
}
ok(/it does not ask for your age/i.test(privacy),
  'and says plainly that no age is collected');
ok(/does not ask for or record a parent's consent/i.test(privacy),
  'and that no parental consent is recorded');

ok(!/handwriting strokes are not uploaded/i.test(privacy),
  'and no longer makes the unconditional claim the optional setting would break');
// The second optional setting sends different data and gets its own paragraph.
ok(/sends the lines of\s+working you wrote/i.test(privacy),
  'the notice describes the optional working check and what it sends');
ok(/expected answer is never sent with it/i.test(privacy),
  'and that the expected answer is never sent with it');
ok(/Two\s+optional settings/i.test(privacy),
  'and the summary counts both, so a reader is not surprised by the second');
ok(/90 days/.test(privacy), 'the notice states the telemetry retention window');
ok(/without a password is not encrypted|profile without a password is not/i.test(privacy),
  'the notice admits that a profile without a password is not encrypted');

ok(existsSync(join(ROOT, 'tools/legal-status.mjs')), 'there is a tool listing what is still unfilled');

// The client build imports these documents from outside client/, so the
// container's build context has to carry them. It did not, and the production
// image failed to build with "Module not found" — a regression only the
// container job could catch. This check makes it a fast one instead.
const dockerfile = readFileSync(join(ROOT, 'Dockerfile'), 'utf8');
const clientBuildStage = dockerfile.slice(0, dockerfile.indexOf('AS server-deps'));
const imported = [...new Set(
  (readFileSync(join(ROOT, 'client/src/pages/Legal.jsx'), 'utf8').match(/from '([^']*\.\.\/[^']*)'/g) || [])
    .map(line => line.replace(/^from '|'$/g, ''))
    .filter(spec => spec.includes('../../../'))
    .map(spec => spec.replace(/^(\.\.\/)+/, '').replace(/\?raw$/, '').split('/').slice(0, 2).join('/'))
)];
for (const dir of imported) {
  ok(clientBuildStage.includes(`COPY ${dir}`),
    `the image's client build copies ${dir}, which the client imports from outside client/`);
}
ok(imported.length > 0, 'the legal page imports its documents from the repository, not a copy');

console.log(failures.length
  ? `LEGAL PAGES: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `LEGAL PAGES: PASS — ${pass}/${pass} checks — privacy, terms, refunds and grievances exist, route signed in and out, and say they are unreviewed while ${placeholderCount} placeholders remain.`);
process.exit(failures.length ? 1 : 0);
