// Ethical commerce (standard #42): no Premium paywall, upsell or price on the screens where a child's
// account is waiting on, or has lost, a guardian's permission, is restricted, or is stopped by the age gate.
// Two layers, per edition's catalogue (en is shared by Prithagoras; hi is Priyabhata's second language):
//   1. the screens' import closure reaches no paywall, entitlement-UI or pricing module;
//   2. every catalogue string those screens can show is free of premium, upgrade, price and currency words.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
// Each screen, and what makes it the screen it is.
const SCREENS = {
  'guardian consent (child waiting, guardian page)': ['components/AccountActivationGate.jsx', 'pages/GuardianConsent.jsx'],
  'consent withdrawn': ['components/AccountActivationGate.jsx'],
  'account restriction': ['components/AccountActivationGate.jsx', 'pages/AccountAction.jsx'],
  'age gate (sign-up and undeclared age)': ['components/SignUpFlow.jsx', 'components/AccountActivationGate.jsx']
};
// App.jsx is the route table and the shell; it is a leaf here: a screen that imports its Logo is not the shell's paywall route.
const LEAVES = new Set(['App.jsx']);
const BANNED_MODULE = /(^|\/)(paywall|Paywall|PremiumBadge|Upsell|upsell|pricing|Pricing|plans)[^/]*(\/|\.jsx?$)/;
const BANNED_WORDS = /premium|upgrade|upsell|subscri|pricing|\bprice|₹|\$\s?\d|\bUSD\b|\bAUD\b|\bINR\b|free trial|\/month|per month|per year|buy now|unlock|pro plan|प्रीमियम|अपग्रेड|कीमत|सब्सक्रिप्शन|मूल्य/i;

const importsOf = file => [...readFileSync(file, 'utf8').matchAll(/(?:^|\n)\s*import\s[^'"]*?from\s*['"](\.[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.[^'"]+)['"]/g)].map(m => m[1] || m[2]);
function resolveImport(from, spec) {
  const base = resolve(dirname(from), spec);
  for (const c of [base, base + '.js', base + '.jsx', base + '.mjs', join(base, 'index.js')]) if (existsSync(c) && /\.(jsx?|mjs)$/.test(c)) return c;
  return null;
}
function closure(entries) {
  const seen = new Set(), stack = entries.map(e => join(SRC, e));
  while (stack.length) {
    const f = stack.pop(); if (seen.has(f)) continue; seen.add(f);
    if (LEAVES.has(relative(SRC, f))) continue;
    for (const spec of importsOf(f)) { const r = resolveImport(f, spec); if (r && !seen.has(r)) stack.push(r); }
  }
  return [...seen].map(f => relative(SRC, f));
}
const keysUsed = files => new Set(files.flatMap(f => [...readFileSync(join(SRC, f), 'utf8').matchAll(/\bt(?:Later)?\(\s*['"`]([\w.-]+)['"`]/g)].map(m => m[1])));

let n = 0; const ok = (name, fn) => { fn(); n++; console.log('ok', name); };

for (const [screen, entries] of Object.entries(SCREENS)) {
  ok(`${screen}: its modules reach no paywall, pricing or entitlement UI`, () => {
    const files = closure(entries);
    assert.ok(files.length >= entries.length);
    for (const f of files) assert.equal(BANNED_MODULE.test('/' + f), false, `${f} is a commerce module reachable from ${screen}`);
  });
  ok(`${screen}: every string it can show is free of premium, upgrade and price words, in en (Prithagoras, shared) and hi (Priyabhata)`, () => {
    const own = entries.map(e => e); // the screen files themselves; their direct children are covered by the closure test
    for (const k of keysUsed(own)) for (const [lang, cat] of [['en', en], ['hi', hi]]) {
      const v = cat[k]; if (v === undefined) continue;
      const text = typeof v === 'object' ? Object.values(v).join(' ') : String(v);
      assert.equal(BANNED_WORDS.test(text), false, `${lang} "${k}" on ${screen}: ${text.slice(0, 80)}`);
    }
  });
}

ok('the guardian, withdrawn, restriction and age-gate string families as a whole are free of commerce words (both languages)', () => {
  const FAMILIES = /^(guardianPage|guardian|activation|consent|ageGate|age|signup\.age|signup\.guardian|accountAction)\./;
  let checked = 0;
  for (const [lang, cat] of [['en', en], ['hi', hi]]) for (const [k, v] of Object.entries(cat)) {
    if (!FAMILIES.test(k)) continue; checked++;
    assert.equal(BANNED_WORDS.test(typeof v === 'object' ? Object.values(v).join(' ') : String(v)), false, `${lang} ${k}`);
  }
  assert.ok(checked > 40, 'family scan reached only ' + checked);
});

ok('while an account is not activated the shell renders the gate in place of every route, so /premium is unreachable from these screens', () => {
  const app = readFileSync(join(SRC, 'App.jsx'), 'utf8');
  const gate = app.indexOf('<AccountActivationGate'), premium = app.indexOf('path="/premium"');
  assert.ok(gate > 0 && premium > 0 && gate < premium, 'the gate must be returned before the signed-in route table');
  const before = app.slice(Math.max(0, gate - 400), gate);
  assert.match(before, /activated|Routes/, 'the gate is rendered under its own route table, not beside the paywall');
});

ok('the check itself catches a paywall: a screen importing the paywall module is flagged', () => {
  assert.equal(BANNED_MODULE.test('/paywall/Paywall.jsx'), true);
  assert.equal(BANNED_WORDS.test('Go Premium for ₹499 a month'), true);
  assert.equal(BANNED_WORDS.test('A parent or guardian has to approve this account first.'), false);
});
console.log(`ETHICAL COMMERCE: PASS — ${n}/${n} checks`);
