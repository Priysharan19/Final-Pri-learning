// Self-test for tools/site-check.mjs: the real site passes, and each rule
// catches a planted regression. Every mutation is made on an in-memory copy of
// the render, so this never touches site/public. Run with the check itself:
//
//   node tools/site-check.test.mjs && node tools/site-check.mjs
import assert from 'node:assert/strict';
import { readNotices, renderSite } from '../site/build.mjs';
import { NOTICE_PREMISES, authoredText, checkSite, loadVercel, readStoreDocs, storeLinkProblems } from './site-check.mjs';

const rendered = renderSite();
const vercel = loadVercel();
const docs = readNotices();
assert.ok(vercel, 'site/vercel.json loads');
let checks = 1;

const run = (files, cfg = vercel, notices = docs) => checkSite({ rendered, committed: files, vercel: cfg, docs: notices }).failures;
/** The notices with one English file edited, so a rule about a notice can be tested without touching docs/legal. */
const withNotice = (slug, edit) => {
  const copy = structuredClone(docs);
  const after = edit(copy[slug].en);
  assert.notEqual(after, copy[slug].en, `the edit of ${slug}.md changed something`);
  copy[slug].en = after;
  return copy;
};
const clone = () => new Map(rendered);
const mutate = (path, edit) => {
  const files = clone();
  const before = files.get(path);
  assert.ok(before !== undefined, `${path} is rendered`);
  const after = edit(before);
  assert.notEqual(after, before, `the mutation of ${path} changed something`);
  files.set(path, after);
  return files;
};
// A mutation of a committed file is also a staleness failure; strip those so each
// assertion is about the rule under test.
const nonStale = (failures) => failures.filter(f => !f.startsWith('stale:'));
const expectFailure = (label, failures, pattern) => {
  const hit = nonStale(failures).filter(f => pattern.test(f));
  assert.ok(hit.length > 0, `${label}: expected a failure matching ${pattern}, got:\n  ${nonStale(failures).join('\n  ') || '(none)'}`);
  checks++;
};

// Baseline: the render passes against itself.
const baseline = run(clone());
assert.deepEqual(baseline, [], `the rendered site passes its own contract:\n  ${baseline.join('\n  ')}`);
checks++;

// 1. Staleness: a committed byte that differs from the render fails.
{
  const files = clone();
  files.set('index.html', files.get('index.html').replace('</body>', ' </body>'));
  const failures = run(files);
  assert.ok(failures.some(f => /^stale: index\.html/.test(f)), 'a stale index.html is reported');
  checks++;
  const missing = clone(); missing.delete('terms/index.html');
  assert.ok(run(missing).some(f => /stale: terms\/index\.html: missing/.test(f)), 'a missing page is reported');
  checks++;
  const extra = clone(); extra.set('old.html', '<html lang="en"><h1>x</h1></html>');
  assert.ok(run(extra).some(f => /stale: old\.html: in site\/public but not produced/.test(f)), 'an extra file is reported');
  checks++;
}

// 2. Placeholders never publish.
expectFailure('placeholder', run(mutate('support/index.html', s => s.replace('<h2 id="contact">', '<h2 id="contact">{{SUPPORT_EMAIL}} '))), /unfilled \{\{PLACEHOLDER\}\}/);

// 3. Banned phrases in the site's own copy.
const PLANTS = [
  ['complete syllabus', 'covers the complete syllabus', /claims completeness|claims the whole syllabus/],
  ['every chapter', 'every chapter, mapped', /every chapter/],
  ['accuracy', '99 accuracy figures', /claims accuracy/],
  ['percentage', '98.4% of characters read correctly', /percentage/],
  ['question count', '344,798 distinct questions', /question count/],
  ['question count plain', '12000 questions', /question count/],
  ['offline', 'marks offline', /without a connection/],
  ['examiner', 'marked like a real examiner', /examiner/],
  ['percentile', 'a predicted percentile', /percentile/],
  ['unlimited', 'unlimited questions', /unlimited/],
  ['official', 'the official app', /official/],
  ['badge words', 'Download on the App Store', /on sale/],
  ['store link text', 'see apps.apple.com/in/app/pri', /store page/],
  ['superiority', 'better than any other app', /superiority/],
  ['emoji', 'maths ✨', /sparkles or emoji/],
  ['method marks', 'with method marks', /method marks/],
  ['final-answer-only marking before the D12 switch', 'Marks are for the final answer', /final-answer-only marking \(D12\)/],
  ['final-answer marks', 'final-answer marks only', /final-answer-only marking \(D12\)/],
  ['three-digit question count', '500 questions', /question count/],
  ['two-digit question count', '50 distinct questions', /question count/],
  ['hundreds of questions', 'hundreds of questions', /question count/],
  ['out of V1', 'Olympiad too', /outside V1/],
  ['hindi offline', 'ऑफ़लाइन जाँच', /Hindi/],
  ['hindi whole syllabus', 'पूरा पाठ्यक्रम', /Hindi/]
];
for (const [label, plant, pattern] of PLANTS) {
  const failures = run(mutate('index.html', s => s.replace('Both plans use the same marking engine.', `Both plans use the same marking engine. ${plant}.`)));
  expectFailure(`banned: ${label}`, failures, pattern);
}
// Hindi plants must also be caught on a Hindi page.
expectFailure('banned on a Hindi page', run(mutate('hi/support/index.html', s => s.replace('<h2 id="contact">संपर्क</h2>', '<h2 id="contact">संपर्क (सटीक जाँच)</h2>'))), /Hindi/);
// Attributes count as copy too.
expectFailure('banned in a meta description', run(mutate('index.html', s => s.replace('<meta name="description" content="', '<meta name="description" content="Complete syllabus. '))), /completeness|whole syllabus/);

// 3b. The legal bodies are governed by docs/legal, not by this list: the same
// words inside <article data-source="docs/legal/…"> are not reported as banned
// phrases — but the article must then be its source word for word, so the
// planted sentence fails the fidelity rule instead. Nothing can hide in an article.
{
  const files = mutate('privacy/index.html', s => s.replace(/(<article[^>]*data-source="docs\/legal\/privacy\.md"[^>]*>)/, '$1<p>Marks offline with examiner accuracy, 100% of the time.</p>'));
  const failures = run(files);
  const banned = nonStale(failures).filter(f => /banned phrase/.test(f));
  assert.deepEqual(banned, [], 'words inside a legal article are left to legal-pages-check');
  checks++;
  assert.ok(!/examiner accuracy/.test(authoredText(files.get('privacy/index.html'))), 'authoredText() excludes the legal body');
  checks++;
  expectFailure('a sentence added inside a legal article', failures, /privacy\/index\.html: <article data-source="docs\/legal\/privacy\.md"> parts from the source at word 0: source "[^"]+", page "Marks offline with examiner accuracy,/);
}

// 3c. Fidelity: a legal article is its source, word for word and in order.
expectFailure('a word changed in a legal article', run(mutate('terms/index.html', s => s.replace('Marking is automatic and can be wrong.', 'Marking is automatic and can be right.'))), /terms\/index\.html: <article data-source="docs\/legal\/terms\.md"> parts from the source at word \d+: source "wrong\./);
expectFailure('a word dropped from a legal article', run(mutate('privacy/index.html', s => s.replace('only as bcrypt hashes', 'only as hashes'))), /privacy\/index\.html: <article data-source="docs\/legal\/privacy\.md"> parts from the source at word \d+: source "bcrypt hashes/);
expectFailure('a word dropped from a Hindi legal article', run(mutate('hi/terms/index.html', s => s.replace(/(<article[^>]*>\n<p>(?:<strong>)?)([^\s<]+)\s/, '$1'))), /hi\/terms\/index\.html: <article data-source="docs\/legal\/terms\.hi\.md"> parts from the source at word 0/);
expectFailure('a legal article cut short', run(mutate('refunds/index.html', s => s.replace(/<article([^>]*)>\n([\s\S]*?)\n<\/article>/, (m, attrs, inner) => `<article${attrs}>\n${inner.split('\n').slice(0, -1).join('\n')}\n</article>`))), /refunds\/index\.html: <article data-source="docs\/legal\/refund-policy\.md"> parts from the source at word \d+: source "[^"]+", page "\(end\)"/);
// The number-dot class: a numbered list that lost its numbers, or was renumbered, parts at the ordinal.
expectFailure('a numbered list rendered as bullets', run(mutate('support/index.html', s => s.replace('<ol><li>We acknowledge', '<ul><li>We acknowledge').replace('when we will answer.</li></ol>', 'when we will answer.</li></ul>'))), /support\/index\.html: <article data-source="docs\/legal\/grievance\.md"> parts from the source at word \d+: source "1\. We acknowledge/);
expectFailure('a numbered list renumbered', run(mutate('support/index.html', s => s.replace('<ol><li>We acknowledge', '<ol start="2"><li>We acknowledge'))), /source "1\. We acknowledge[^"]*", page "2\. We acknowledge/);
// A partial article must name its sections honestly, and every article a real notice.
expectFailure('data-sections understating the body', run(mutate('delete-account/index.html', s => s.replace('data-sections="6,7"', 'data-sections="6"'))), /delete-account\/index\.html: <article data-source="docs\/legal\/privacy\.md"> parts from the source at word \d+: source "\(end\)"/);
expectFailure('an article from an unknown file', run(mutate('terms/index.html', s => s.replace('data-source="docs/legal/terms.md"', 'data-source="docs/legal/other.md"'))), /names a file that is not a notice/);
// The notice changed and the page did not: caught by fidelity even when the render is not stale.
expectFailure('notice edited, page unchanged', run(clone(), vercel, withNotice('privacy', s => s.replace('Passwords are stored only as bcrypt hashes.', 'Passwords are stored as bcrypt hashes.'))), /privacy\/index\.html: <article data-source="docs\/legal\/privacy\.md"> parts from the source at word \d+: source "as bcrypt/);

// 3d. Notice premises: a home-page paraphrase stands only while the notice says it.
for (const p of NOTICE_PREMISES) {
  const text = authoredText(rendered.get(p.page));
  if (p.requires) assert.ok(p.says.test(text), `premise is live — ${p.page} says ${p.says}`);
  else assert.ok(!p.says.test(text), `forbidden paraphrase is absent — ${p.page} ${p.says}`);
  checks++;
}
// D17 (#737): the home page may say nothing is sent until you agree only while
// privacy.md says so; drop it from the notice and the home page fails…
expectFailure('consent-first wording without the notice (marking cell and plain section)', run(clone(), vercel, withNotice('privacy', s => s.replace('**Nothing is sent until you agree.**', '**Reading.**'))), /index\.html: says reading waits for your agreement, but privacy\.md does not say "Nothing is sent until you agree"/);
expectFailure('the prompt described without the notice', run(clone(), vercel, withNotice('privacy', s => s.replace(/asks your permission once, naming OpenAI/g, 'asks once'))), /index\.html: describes a permission prompt naming OpenAI, which privacy\.md no longer describes/);
// …and once privacy.md drops "on by default", today's wording fails until it is rewritten.
expectFailure('on-by-default wording after the notice drops it', run(clone(), vercel, withNotice('privacy', s => s.replace(/on by default for a signed-in account/g, 'asked for once, before the first read,'))), /index\.html: says reading is on for a signed-in account, but privacy\.md no longer says it is on by default/);
// The stroke-image guarantee may not be stretched over photographs.
expectFailure('guarantee stretched over photographs', run(mutate('index.html', s => s.replace("A photograph is your camera's picture, so whatever is in the frame is sent.", 'The picture never carries the question, the expected answer or your name.'))), /index\.html: claims no picture carries the question, but privacy\.md says a photograph sends whatever is in the frame/);
// Other paraphrases: keeps no copy, the reply period, the escalation, the standing of a mark.
{
  const failures = run(clone(), vercel, withNotice('privacy', s => s.replaceAll('keeps no copy', 'keeps a copy')));
  expectFailure('keeps-no-copy outlives the notice', failures, /index\.html: says Pri keeps no copy, which privacy\.md no longer says/);
}
{
  const failures = run(clone(), vercel, withNotice('grievance', s => s.replaceAll('30 days', '45 days').replaceAll('48 hours', '72 hours')));
  expectFailure('reply period on the home page', failures, /index\.html: quotes a reply period grievance\.md no longer gives/);
  expectFailure('reply period on support', failures, /support\/index\.html: quotes a reply period grievance\.md no longer gives/);
  expectFailure('acknowledgement period on the home page', failures, /index\.html: quotes an acknowledgement period grievance\.md no longer gives/);
  expectFailure('acknowledgement period on support', failures, /support\/index\.html: quotes an acknowledgement period grievance\.md no longer gives/);
}
{
  // The old "3 working days" may not come back while grievance.md gives none.
  const failures = run(mutate('support/index.html', s => s.replace('We acknowledge within 48 hours', 'We reply within 3 working days')));
  expectFailure('working days back on support', failures, /support\/index\.html: quotes a working-day period grievance\.md does not give/);
}
{
  // D3: no phone route on the deletion page while privacy.md says no SMS sign-in.
  expectFailure('mobile number back on the deletion page', run(mutate('delete-account/index.html', s => s.replace('a code sent to the email address on the account', 'a code sent to the email address or mobile number on the account'))), /delete-account\/index\.html: offers a phone route/);
  expectFailure('mobile number back on the Hindi deletion page', run(mutate('hi/delete-account/index.html', s => s.replace('खाते के ईमेल पते पर भेजे गए कोड', 'खाते के ईमेल पते अथवा मोबाइल नंबर पर भेजे गए कोड'))), /hi\/delete-account\/index\.html: offers a phone route/);
}
expectFailure('escalation outlives the notice', run(clone(), vercel, withNotice('grievance', s => s.replaceAll('Data Protection Board of India', 'Data Protection Board'))), /index\.html: names an escalation grievance\.md no longer names/);
expectFailure('standing sentence outlives the terms', run(clone(), vercel, withNotice('terms', s => s.replaceAll('no standing outside it', 'no effect outside it'))), /support\/index\.html: repeats a sentence terms\.md no longer has/);
expectFailure('OpenAI disclosure removed from home', run(mutate('index.html', s => s.replaceAll('OpenAI', 'a reading service'))), /index\.html: required text missing — OpenAI/);

// 3c. The free plan's "20 practice questions a day" is a limit, not a count,
// and the maths row ending in an 8 before the "Questions, hints…" paragraph is
// two blocks: neither trips the count rule on the clean render (baseline above).
assert.ok(/20 practice questions a day/.test(authoredText(rendered.get('index.html'))), 'the free-plan limit is still stated');
checks++;

// 4. Prices: only the approved two, verbatim, in any spelling of the currency.
expectFailure('unapproved price', run(mutate('index.html', s => s.replace('₹1,499', '₹1,299'))), /price "₹1,299" is not one of the approved/);
expectFailure('a third price', run(mutate('index.html', s => s.replace('App Store prices', 'App Store prices (was ₹999)'))), /price "₹999"/);
for (const [label, plant, pattern] of [
  ['Rs price', 'or Rs 999 a year', /price "Rs 999" is not one of the approved/],
  ['Rs. price', 'or Rs. 999 a year', /price "Rs\. 999"/],
  ['INR price', 'INR 999 a year', /price "INR 999"/],
  ['rupees price', '999 rupees a year', /price "999 rupees"/],
  ['approved amount in an unapproved spelling', 'Rs 199 a month', /price "Rs 199"/]
]) {
  expectFailure(`price: ${label}`, run(mutate('index.html', s => s.replace('Both plans use the same marking engine.', `Both plans use the same marking engine, ${plant}.`))), pattern);
}

// 5. Required sentences.
expectFailure('can-be-wrong removed from home', run(mutate('index.html', s => s.replaceAll('Marking is automatic and can be wrong', 'Marking is automatic'))), /required text missing — Marking is automatic and can be wrong/);
expectFailure('not-endorsed removed', run(mutate('index.html', s => s.replace('Not endorsed by NCERT, CBSE or NTA', 'Built for CBSE'))), /required text missing — Not endorsed/);
expectFailure('coming soon removed', run(mutate('index.html', s => s.replace(/coming soon/gi, 'here'))), /required text missing — \/coming soon\/i/);
expectFailure('grievance anchor removed', run(mutate('support/index.html', s => s.replace('id="grievance"', 'id="complaints"'))), /required text missing — id="grievance"|points at an id that does not exist/);

// 6. Links.
expectFailure('broken internal link', run(mutate('index.html', s => s.replace('href="/refunds"', 'href="/refund"'))), /broken internal link \/refund/);
expectFailure('broken fragment', run(mutate('support/index.html', s => s.replace('href="/privacy#children"', 'href="/privacy#childrenn"'))), /points at an id that does not exist/);
expectFailure('trailing slash', run(mutate('index.html', s => s.replace('href="/terms"', 'href="/terms/"'))), /trailing slash/);
expectFailure('relative link', run(mutate('index.html', s => s.replace('href="/terms"', 'href="terms"'))), /must be root-relative/);
expectFailure('http link', run(mutate('index.html', s => s.replace('href="/terms"', 'href="http://example.com/terms"'))), /non-HTTPS|not on the allowlist/);
expectFailure('unlisted external host', run(mutate('index.html', s => s.replace('href="/terms"', 'href="https://example.com/terms"'))), /not on the allowlist/);
expectFailure('sitemap entry that does not resolve', run(mutate('sitemap.xml', s => s.replace('/refunds</loc>', '/refund-policy</loc>'))), /sitemap\.xml: .*does not resolve/);

// 6b. hreflang pairs are reciprocal and resolve.
expectFailure('one-way hreflang', run(mutate('privacy/index.html', s => s.replace('\n  <link rel="alternate" hreflang="hi" href="https://prilearning.com/hi/privacy">', ''))), /hi\/privacy\/index\.html: hreflang en → https:\/\/prilearning\.com\/privacy is not returned by privacy\/index\.html/);
expectFailure('hreflang to a page that declares none', run(mutate('index.html', s => s.replace('<link rel="canonical" href="https://prilearning.com/">', '<link rel="canonical" href="https://prilearning.com/">\n  <link rel="alternate" hreflang="hi" href="https://prilearning.com/hi">'))), /index\.html: hreflang hi → https:\/\/prilearning\.com\/hi is not returned by hi\/index\.html/);
expectFailure('hreflang that does not resolve', run(mutate('privacy/index.html', s => s.replace('href="https://prilearning.com/hi/privacy">', 'href="https://prilearning.com/hi/privacy-notice">'))), /hreflang hi points at .* which does not resolve/);
assert.ok(!/<link rel="alternate"/.test(rendered.get('hi/index.html')) && !/<link rel="alternate"/.test(rendered.get('index.html')), '/ and /hi are not a translation pair and declare no hreflang');
checks++;

// 7. Nothing phones home, nothing collects.
expectFailure('analytics script', run(mutate('index.html', s => s.replace('</head>', '<script src="https://www.googletagmanager.com/gtag/js"></script></head>'))), /tracking reference|script other than|another origin/);
// 7b. No inline style: the CSP (style-src 'self') would drop it silently.
expectFailure('inline style attribute', run(mutate('index.html', s => s.replace('<div class="coverage-notes">', '<div class="coverage-notes" style="margin-top:28px">'))), /index\.html: carries an inline style/);
expectFailure('style element', run(mutate('hi/index.html', s => s.replace('</head>', '<style>.fine{margin-top:24px}</style></head>'))), /hi\/index\.html: carries an inline style/);
assert.ok(/style-src 'self'/.test(vercel.headers[0].headers.find(h => h.key === 'Content-Security-Policy').value), 'the CSP still forbids inline styles, which is why the rule exists');
checks++;
expectFailure('remote stylesheet', run(mutate('index.html', s => s.replace('</head>', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter"></head>'))), /another origin|not on the allowlist/);
expectFailure('store badge image', run(mutate('index.html', s => s.replace('</main>', '<p><img src="/badges/app-store.svg" alt="Download on the App Store"></p></main>'))), /contains an <img>|implies the app is on sale/);
expectFailure('form', run(mutate('support/index.html', s => s.replace('</main>', '<form action="https://forms.example.com"><input name="email"></form></main>'))), /frame or a form/);
expectFailure('remote css url', run(mutate('styles.css', s => `${s}\n.x{background:url(https://cdn.example.com/a.png)}`)), /styles\.css loads a remote asset/);
expectFailure('second glow', run(mutate('styles.css', s => `${s}\n.y{background:radial-gradient(red,blue)}`)), /exactly one glow/);
expectFailure('theme.js reaching out', run(mutate('theme.js', s => `${s}\nfetch('https://example.com/ping');`)), /theme\.js reaches a URL/);

// 8. Vercel config stays static.
expectFailure('cleanUrls off', run(clone(), { ...vercel, cleanUrls: false }), /cleanUrls/);
expectFailure('build command added', run(clone(), { ...vercel, buildCommand: 'npm run build' }), /no build or install command/);
expectFailure('functions added', run(clone(), { ...vercel, functions: {} }), /"functions" is not allowed/);
expectFailure('CSP weakened', run(clone(), { ...vercel, headers: [{ source: '/(.*)', headers: [{ key: 'Content-Security-Policy', value: "default-src 'self'" }] }] }), /CSP locks the page down/);
expectFailure('redirect to nowhere', run(clone(), { ...vercel, redirects: [...vercel.redirects, { source: '/old', destination: '/nowhere', permanent: true }] }), /redirect \/old → \/nowhere does not resolve/);
expectFailure('redirect shadowing a page', run(clone(), { ...vercel, redirects: [...vercel.redirects, { source: '/privacy', destination: '/', permanent: true }] }), /shadows a real page/);
expectFailure('vercel.json missing', run(clone(), null), /vercel\.json parses/);

// 9. The store drafts' prilearning.com URLs are pages this site publishes (D5).
{
  const storeDocs = readStoreDocs();
  assert.deepEqual(storeLinkProblems(storeDocs, clone()), [], 'every prilearning.com URL in the store drafts is a page of the clean render');
  checks++;
  const withoutDelete = clone();
  withoutDelete.delete('delete-account/index.html');
  assert.ok(storeLinkProblems(storeDocs, withoutDelete).some(p => /https:\/\/prilearning\.com\/delete-account is not a page this site publishes/.test(p)), 'a store URL whose page is gone is caught');
  checks++;
  const renamed = { ...storeDocs, 'docs/release/store/app-store-listing.md': storeDocs['docs/release/store/app-store-listing.md'].replace('https://prilearning.com/support', 'https://prilearning.com/help') };
  assert.ok(storeLinkProblems(renamed, clone()).some(p => /prilearning\.com\/help is not a page/.test(p)), 'a store URL naming a route the site does not have is caught');
  checks++;
  const none = Object.fromEntries(Object.keys(storeDocs).map(doc => [doc, '']));
  assert.ok(storeLinkProblems(none, clone()).length > 0, 'drafts that name no site URL are caught');
  checks++;
}

console.log(`SITE SELF-TEST: PASS — ${checks} checks; every planted regression was caught and the clean render passed.`);
