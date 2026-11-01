// Self-test for tools/site-check.mjs: the real site passes, and each rule
// catches a planted regression. Every mutation is made on an in-memory copy of
// the render, so this never touches site/public. Run with the check itself:
//
//   node tools/site-check.test.mjs && node tools/site-check.mjs
import assert from 'node:assert/strict';
import { renderSite } from '../site/build.mjs';
import { authoredText, checkSite, loadVercel } from './site-check.mjs';

const rendered = renderSite();
const vercel = loadVercel();
assert.ok(vercel, 'site/vercel.json loads');
let checks = 1;

const run = (files, cfg = vercel) => checkSite({ rendered, committed: files, vercel: cfg }).failures;
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
// words inside <article data-source="docs/legal/…"> are not reported here.
{
  const files = mutate('privacy/index.html', s => s.replace(/(<article[^>]*data-source="docs\/legal\/privacy\.md"[^>]*>)/, '$1<p>Marks offline with examiner accuracy, 100% of the time.</p>'));
  const banned = nonStale(run(files)).filter(f => /banned phrase/.test(f));
  assert.deepEqual(banned, [], 'words inside a legal article are left to legal-pages-check');
  checks++;
  assert.ok(!/examiner accuracy/.test(authoredText(files.get('privacy/index.html'))), 'authoredText() excludes the legal body');
  checks++;
}

// 4. Prices: only the approved two, verbatim.
expectFailure('unapproved price', run(mutate('index.html', s => s.replace('₹1,499', '₹1,299'))), /price "₹1,299" is not one of the approved/);
expectFailure('a third price', run(mutate('index.html', s => s.replace('App Store prices', 'App Store prices (was ₹999)'))), /price "₹999"/);

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

// 7. Nothing phones home, nothing collects.
expectFailure('analytics script', run(mutate('index.html', s => s.replace('</head>', '<script src="https://www.googletagmanager.com/gtag/js"></script></head>'))), /tracking reference|script other than|another origin/);
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

console.log(`SITE SELF-TEST: PASS — ${checks} checks; every planted regression was caught and the clean render passed.`);
