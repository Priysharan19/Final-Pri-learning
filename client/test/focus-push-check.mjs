// UI6 focus push: the pure rules of client/src/instrument/viewTransition.js.
import assert from 'node:assert/strict';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n += 1; };
const calls = [];
const doc = { documentElement: { dataset: {} }, startViewTransition: cb => { calls.push('vt'); cb(); return { finished: Promise.resolve() }; } };
globalThis.document = doc;
globalThis.location = { pathname: '/' };
globalThis.matchMedia = q => ({ matches: globalThis.__reduce === true && /reduce/.test(q) });

const { canPush, navigateInto } = await import('../src/instrument/viewTransition.js');

ok(canPush('/practice'), 'pushes into practice where the API exists');
ok(!canPush('/exam/123'), 'never into the exam room');
ok(!canPush('/desk'), 'never into the desk');
globalThis.location = { pathname: '/exam/9' };
ok(!canPush('/'), 'never out of the exam room either');
globalThis.location = { pathname: '/' };
globalThis.__reduce = true;
ok(!canPush('/practice'), 'Reduce Motion is an instant cut');
globalThis.__reduce = false;
const nodeNoApi = { documentElement: { dataset: {} } };
ok(!canPush('/practice', nodeNoApi), 'no API is an instant cut');

let navigated = 0;
globalThis.__reduce = true;
navigateInto(() => { navigated += 1; }, '/practice');
ok(navigated === 1 && !calls.length, 'reduced motion navigates once with no transition');
globalThis.__reduce = false;
globalThis.document = nodeNoApi;
navigateInto(() => { navigated += 1; }, '/practice');
ok(navigated === 2, 'no API navigates once');
console.log(`FOCUS PUSH: PASS — ${n}/${n} checks — pushes only into listed routes where the API exists; Reduce Motion, no API, the exam room and the desk all cut instantly`);
