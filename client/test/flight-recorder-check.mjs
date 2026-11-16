#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the flight recorder keeps what a failed flow's pages showed.
//
// A flow closes its second context in a `finally`, before the error reaches the
// runner, so by the time anyone asks, that page cannot answer. These are the
// recorder's promises in support/boot-diagnostics.mjs, with stand-in objects: no
// browser, no timing, nothing to flake.
// ─────────────────────────────────────────────────────────────────────────────
import { strict as assert } from 'node:assert';
import { EventEmitter } from 'node:events';
import { recordFlight } from './support/boot-diagnostics.mjs';

class FakePage extends EventEmitter {
  constructor(state) { super(); this.state = state; this.closed = false; this.shots = 0; }
  isClosed() { return this.closed; }
  evaluate() {
    if (this.closed) return Promise.reject(new Error('page closed'));
    return this.state === 'hung' ? new Promise(() => {}) : Promise.resolve({ ...this.state });
  }
  screenshot() { this.shots++; return Promise.resolve(Buffer.from('screen')); }
}
class FakeContext extends EventEmitter {
  constructor(list = []) { super(); this.list = list; }
  pages() { return this.list.filter(page => !page.closed); }
  async close() { for (const page of this.list) page.closed = true; }
}
class FakeBrowser {
  constructor() { this.contexts = []; }
  async newContext() { const context = new FakeContext(); this.contexts.push(context); return context; }
}

const nativeClose = FakeContext.prototype.close;
const nativeNewContext = FakeBrowser.prototype.newContext;

// ── a second context, closed before the runner asks ─────────────────────────
{
  const browser = new FakeBrowser();
  const first = new FakePage({ gate: null, url: '/practice' });
  const ctx = new FakeContext([first]);
  const flight = recordFlight(browser, ctx);

  const second = await browser.newContext();
  const child = new FakePage({ gate: 'retry', gateCode: 'CLOUD_UNAVAILABLE', url: '/' });
  second.list.push(child);
  second.emit('page', child);
  await second.close();
  assert.equal(child.closed, true, 'closing still closes');

  const lines = await flight.report();
  assert.equal(lines.length, 2, 'every page the flow opened is reported');
  assert.match(lines[0], /^page 1: .*"url":"\/practice"/, 'a page still open is read live');
  assert.match(lines[1], /^page 2 \(read as its context closed\): .*"gate":"retry".*"gateCode":"CLOUD_UNAVAILABLE"/,
    'a page in a closed context reports what it last showed');

  const screens = flight.closedScreens();
  assert.deepEqual(screens.map(s => s.name), ['page-2'], 'the closed page left its screen, and only it did');
  flight.stop();
}

// ── stop() leaves the browser objects as they were ──────────────────────────
{
  const browser = new FakeBrowser();
  const ctx = new FakeContext([new FakePage({ url: '/' })]);
  const flight = recordFlight(browser, ctx);
  const second = await browser.newContext();
  assert.notEqual(second.close, nativeClose, 'a followed context is wrapped');
  flight.stop();
  assert.equal(ctx.close, nativeClose, 'the flow context is unwrapped');
  assert.equal(second.close, nativeClose, 'a second context is unwrapped');
  assert.equal(browser.newContext, nativeNewContext, 'the browser is unwrapped');
  const third = await browser.newContext();
  assert.equal(third.close, nativeClose, 'nothing is followed after stop');
}

// ── a page that stopped answering is a finding, not a hang in the report ────
{
  const browser = new FakeBrowser();
  const hung = new FakePage('hung');
  const ctx = new FakeContext([hung]);
  const flight = recordFlight(browser, ctx);
  const lines = await flight.report();
  assert.match(lines[0], /the page did not answer within \d+ ms/, 'the report comes back, and says so');
  flight.stop();
}

console.log('FLIGHT RECORDER: PASS');
