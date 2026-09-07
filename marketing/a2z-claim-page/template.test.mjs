// Contract tests for the generated render function. Run: node template.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderClaimPage } from './claim-template.mjs';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };

const REAL = 'A2Z A2Z-MFZ4-3MGW';

test('renders the verification message into #verification-message', () => {
  const html = renderClaimPage({ verificationMessage: REAL });
  const m = html.match(/id="verification-message"[^>]*>([^<]*)</);
  assert.ok(m, 'code element present');
  assert.equal(m[1], REAL);
});

test('output matches claim.html apart from the injected code', () => {
  const shipped = readFileSync('claim.html', 'utf8');
  const rendered = renderClaimPage({ verificationMessage: REAL });
  // The one intentional difference: URLs injected into JS string literals go
  // through JSON.stringify, which emits double quotes where the source file has
  // single quotes. Pinned here so any OTHER drift still fails this test.
  const expected = shipped
    .replace('A2Z A2Z-XXXX-XXXX', REAL)
    .replace(
      "window.location.href = 'https://www.instagram.com/pri.learning/'",
      'window.location.href = "https://www.instagram.com/pri.learning/"');
  assert.equal(rendered.length, expected.length, 'same byte length');
  assert.equal(rendered, expected);
});

test('keeps the ids and links the old page relied on', () => {
  const html = renderClaimPage({ verificationMessage: REAL });
  for (const id of ['verification-message', 'copy-open', 'copy-status']) {
    assert.ok(html.includes('id="' + id + '"'), 'has #' + id);
  }
  for (const href of ['/privacy', '/data-deletion', '/terms']) {
    assert.ok(html.includes('href="' + href + '"'), 'links ' + href);
  }
  assert.ok(html.includes('var DM = "https://ig.me/m/pri.learning?ref=pri-a2z-qr-2026"'));
});

test('expiresAt accepts a Date and an ISO string, and defaults to empty', () => {
  const iso = '2026-08-29T10:00:00.000Z';
  assert.ok(renderClaimPage({ verificationMessage: REAL, expiresAt: new Date(iso) })
    .includes('data-expires-at="' + iso + '"'));
  assert.ok(renderClaimPage({ verificationMessage: REAL, expiresAt: iso })
    .includes('data-expires-at="' + iso + '"'));
  assert.ok(renderClaimPage({ verificationMessage: REAL })
    .includes('data-expires-at=""'));
  // an unparseable value must not leak "Invalid Date" into the attribute
  assert.ok(renderClaimPage({ verificationMessage: REAL, expiresAt: 'not a date' })
    .includes('data-expires-at=""'));
});

test('escapes a hostile verification message', () => {
  const nasty = '</script><img src=x onerror=alert(1)>"\'&';
  const html = renderClaimPage({ verificationMessage: nasty });
  assert.ok(!html.includes('<img src=x'), 'no raw tag');
  assert.ok(!html.includes('</script><img'), 'cannot close the script element');
  assert.ok(html.includes('&lt;/script&gt;&lt;img'), 'escaped instead');
});

test('escapes a hostile url in both the attribute and the script', () => {
  const html = renderClaimPage({
    verificationMessage: REAL,
    profileUrl: 'https://x.test/"><script>alert(1)</script>',
  });
  assert.ok(!html.includes('"><script>alert(1)'), 'attribute cannot break out');
  assert.ok(!/var DM[^\n]*<\/script>/.test(html), 'script string cannot break out');
  assert.ok(html.includes('\\u003c'), 'angle brackets escaped in the JS string');
});

test('refuses to render without a verification message', () => {
  assert.throws(() => renderClaimPage(), TypeError);
  assert.throws(() => renderClaimPage({}), TypeError);
  assert.throws(() => renderClaimPage({ verificationMessage: '   ' }), TypeError);
});

test('renders exactly one document', () => {
  const html = renderClaimPage({ verificationMessage: REAL });
  assert.equal((html.match(/<!doctype html>/gi) || []).length, 1);
  assert.equal((html.match(/<\/html>/gi) || []).length, 1);
});

console.log('\n' + passed + ' passing');
