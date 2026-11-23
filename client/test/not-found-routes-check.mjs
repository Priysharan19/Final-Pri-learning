// Pri Learning · the Prithagoras "page not found" route table
//
// App.jsx keeps APP_PATHS, the real app addresses, so that a signed-out visitor
// (or an account waiting at the activation gate) who opens an address that IS an
// app route still reaches sign-in or the gate, and any other address meets the
// not-found page. This holds that list equal to the routes the signed-in router
// declares, holds the Priyabhata path to what it was, and holds the page to one
// heading, one sentence and one button.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = rel => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const app = read('../src/App.jsx');
const main = read('../src/main.jsx');
const page = read('../src/landing/NotFound.jsx');
let n = 0;
const ok = (cond, label) => { assert.ok(cond, label); n++; };

const list = app.match(/const APP_PATHS = NOT_FOUND_PAGE \? \[([\s\S]*?)\] : \[\];/);
ok(list, 'App.jsx declares APP_PATHS behind NOT_FOUND_PAGE');
const known = new Set([...list[1].matchAll(/'([^']+)'/g)].map(m => m[1]));
const declared = [...app.matchAll(/<Route path="([^"]+)"/g)].map(m => m[1]).filter(p => p !== '*');
ok(declared.length > 30, `the router declares routes (${declared.length})`);
for (const p of declared) ok(known.has(p), `${p} is declared by a route and listed in APP_PATHS`);
for (const p of known) ok(declared.includes(p) || main.includes(`'${p}'`), `${p} is listed in APP_PATHS and is a route or a main.jsx page`);

ok(/const NOT_FOUND_PAGE = typeof __PRI_AU_BUILD__ === 'boolean' && __PRI_AU_BUILD__;/.test(app), 'the page is a Prithagoras build literal, so Priyabhata\'s build never includes it');
ok(/NOT_FOUND_PAGE \? React\.lazy\(\(\) => import\('\.\/landing\/NotFound\.jsx'\)\) : null/.test(app), 'the page is a lazy chunk only a Prithagoras build has');
ok(/path="\*" element=\{NOT_FOUND_PAGE \? <UnknownAddress otherwise=\{<Login \/>\} to="\/welcome" \/> : <Login \/>\}/.test(app), 'signed out: Login at real addresses, not-found elsewhere, button to /welcome; Priyabhata: Login');
ok(/<Route path="\*" element=\{NOT_FOUND_PAGE \? <NotFound to=\{roleLanding\} signedIn \/> : <Navigate to=\{roleLanding\} replace \/>\}/.test(app), 'signed in: not-found with the button to the role\'s home; Priyabhata: the redirect it had');
ok(!/<UnknownAddress to="\/"/.test(app) && /<Route path="\*" element=\{<AccountActivationGate/.test(app), 'the activation gate runs at every address (an unknown one is judged after activation, by the signed-in router)');

// The matcher itself, lifted from App.jsx and run: it must agree with react-router on these patterns.
const matcher = app.match(/const isRoute = (\(pattern, pathname\) => \{[\s\S]*?\n\};)/);
ok(matcher, 'App.jsx declares isRoute');
const isRoute = new Function(`return ${matcher[1].replace(/;$/, '')}`)();
for (const [pattern, path, want] of [
  ['/practice', '/practice', true], ['/practice', '/practice/', true], ['/Practice', '/practice', true], ['/practice', '/practise', false],
  ['/exams/:id', '/exams/abc', true], ['/exams/:id', '/exams', false], ['/exams/:id', '/exams/a/b', false],
  ['/', '/', true], ['/', '/x', false], ['/welcome/marking', '/welcome/marking', true], ['/welcome', '/this-does-not-exist', false]
]) ok(isRoute(pattern, path) === want, `isRoute(${pattern}, ${path}) is ${want}`);

ok((page.match(/<h1\b/g) || []).length === 1, 'the page has exactly one h1');
ok((page.match(/<p\b/g) || []).length === 1, 'the page has exactly one sentence');
ok((page.match(/<PageLink\b/g) || []).length === 1 && !/<button\b/.test(page), 'the page has exactly one button');
ok(!/—|–|!/.test(page.replace(/^\/\/.*$/gm, '')), 'no dash or exclamation mark in the copy');

console.log(`NOT FOUND ROUTES: PASS — ${n}/${n} checks`);
