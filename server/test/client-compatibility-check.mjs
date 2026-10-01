// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · client compatibility floor (CP-11)
//
// Native shells below the configured minimum build get a structured 426 upgrade
// answer on every cloud route except health and the routes a student needs to
// leave or take their data; shells at or above it, unknown or absent client ids
// (the web app) and an unset floor are unaffected; bad configuration is a
// production boot problem.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import express from 'express';
import { clientCompatibility, compatibilityConfigProblems } from '../platform/clientCompatibility.js';

let n = 0;
const ok = (c, l) => { assert.ok(c, l); n += 1; };

const env = { PRI_MIN_IOS_BUILD: '20', PRI_MIN_ANDROID_BUILD: '7' };
const app = express();
app.use(clientCompatibility(env));
app.all(/.*/, (req, res) => res.json({ reached: true }));
const server = await new Promise(r => { const l = app.listen(0, '127.0.0.1', () => r(l)); });
const base = `http://127.0.0.1:${server.address().port}`;
const call = async (method, path, headers = {}) => {
  const res = await fetch(base + path, { method, headers });
  return { status: res.status, body: await res.json() };
};

try {
  const old = await call('GET', '/sync/pull/0', { 'x-pri-client': 'ios-native-v1', 'x-pri-shell-build': '19' });
  ok(old.status === 426 && old.body.error.code === 'CLIENT_UPGRADE_REQUIRED' && old.body.error.platform === 'ios' && old.body.error.minBuild === 20 && old.body.error.build === 19,
    'an iOS shell below the floor gets a structured upgrade answer');
  ok((await call('GET', '/sync/pull/0', { 'x-pri-client': 'ios-native-v1', 'x-pri-shell-build': '20' })).status === 200, 'at the floor it is served');
  ok((await call('GET', '/sync/pull/0', { 'x-pri-client': 'ios-native-v1', 'x-pri-shell-build': '120' })).status === 200, 'above the floor it is served');
  const missing = await call('POST', '/account/login', { 'x-pri-client': 'android-native-v1' });
  ok(missing.status === 426 && missing.body.error.platform === 'android' && missing.body.error.build === null, 'a shell that sends no build is treated as below the floor');
  ok((await call('POST', '/account/login', { 'x-pri-client': 'android-native-v1', 'x-pri-shell-build': 'abc' })).status === 426, 'a malformed build is below the floor');
  ok((await call('POST', '/account/login', { 'x-pri-client': 'android-native-v1', 'x-pri-shell-build': '7' })).status === 200, 'Android at its own floor is served');
  for (const [method, path] of [['GET', '/health'], ['POST', '/account/logout'], ['GET', '/account/export'], ['DELETE', '/account']]) {
    ok((await call(method, path, { 'x-pri-client': 'ios-native-v1', 'x-pri-shell-build': '1' })).status === 200, `${method} ${path} stays reachable from an old shell (leave or take your data)`);
  }
  ok((await call('GET', '/account/export-everything', { 'x-pri-client': 'ios-native-v1', 'x-pri-shell-build': '1' })).status === 426, 'the exemptions are exact paths, not prefixes');
  ok((await call('GET', '/sync/pull/0')).status === 200 && (await call('GET', '/sync/pull/0', { 'x-pri-client': 'web-v1' })).status === 200, 'the web app has no floor');
  ok((await call('GET', '/sync/pull/0', { 'x-pri-client': 'ios-native-v2', 'x-pri-shell-build': '1' })).status === 200, 'an unknown client id is not a native shell here (the origin rules treat it as a browser)');
} finally {
  await new Promise(r => server.close(r));
}

// No floor configured: nothing is refused.
const open = express(); open.use(clientCompatibility({})); open.all(/.*/, (req, res) => res.json({ reached: true }));
const s2 = await new Promise(r => { const l = open.listen(0, '127.0.0.1', () => r(l)); });
const r2 = await fetch(`http://127.0.0.1:${s2.address().port}/sync/pull/0`, { headers: { 'x-pri-client': 'ios-native-v1' } });
ok(r2.status === 200, 'with no floor configured every shell is served');
await new Promise(r => s2.close(r));

ok(compatibilityConfigProblems({}).length === 0 && compatibilityConfigProblems(env).length === 0, 'unset or valid floors are valid configuration');
ok(compatibilityConfigProblems({ PRI_MIN_IOS_BUILD: 'v2' }).length === 1 && compatibilityConfigProblems({ PRI_MIN_ANDROID_BUILD: '0' }).length === 1, 'a malformed floor is a production boot problem');

console.log(`CLIENT COMPATIBILITY: PASS — ${n}/${n} checks — native shells below the configured build get a structured 426, data exit routes stay open, the web app has no floor.`);
