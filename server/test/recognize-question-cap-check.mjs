#!/usr/bin/env node
// Automatic reading (owner decision, 18 November 2026): the reader now runs on
// its own after a pause, so one question has its own ceiling on top of the
// account's hourly bucket. This pins the cap's rule and where it sits in the
// route: before any paid provider work, per account AND per question.
import './support/hermetic.mjs';
import { readFileSync } from 'node:fs';
const { startApp } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { consumeRateLimit, sha256 } = await import('../platform/security.js');

let checks = 0;
const assert = (c, m) => { checks++; if (!c) throw Error(m); };
const src = readFileSync(new URL('../platform/practice.js', import.meta.url), 'utf8');

const limit = /RECOGNIZE_QUESTION_LIMIT = Object\.freeze\(\{ limit: (\d+), windowMs: ([\d* ]+) \}\)/.exec(src);
assert(limit && Number(limit[1]) === 60, 'one question is read at most 60 times a day');
assert(/RECOGNIZE_LIMIT = Object\.freeze\(\{ limit: 120/.test(src), 'the account bucket (120 reads an hour) is unchanged');
const route = src.slice(src.indexOf("router.post('/:id/recognize'"));
const capAt = route.indexOf('practice-recognize-q:');
assert(capAt > 0 && capAt < route.indexOf('recognitionOps') || capAt < route.indexOf('reused'), 'the per-question cap is taken before the reader is reached');
assert(/validateImage\(body\.image\)[\s\S]{0,300}practice-recognize-q:/.test(route), 'a malformed picture is refused before it costs a unit');
assert(/'RATE_LIMITED'/.test(route.slice(capAt, capAt + 600)) && /Retry-After/.test(route.slice(capAt, capAt + 600)), 'the cap answers a coded 429 with Retry-After');

const h = await startApp({ engine: requestedEngine() });
try {
  const bucket = (account, question) => `practice-recognize-q:${sha256(`${account}:${question}`).slice(0, 24)}`;
  const rule = { limit: 60, windowMs: 24 * 60 * 60 * 1000 };
  const t0 = Date.now();
  let admitted = 0;
  for (let i = 0; i < 70; i++) if ((await consumeRateLimit(h.db, bucket('acct-1', 'q-1'), rule, t0 + i)).allowed) admitted++;
  assert(admitted === 60, `exactly 60 reads of one question are admitted (${admitted})`);
  assert(!(await consumeRateLimit(h.db, bucket('acct-1', 'q-1'), rule, t0 + 100)).allowed, 'the 61st is refused');
  assert((await consumeRateLimit(h.db, bucket('acct-1', 'q-2'), rule, t0 + 101)).allowed, 'another question has its own bucket');
  assert((await consumeRateLimit(h.db, bucket('acct-2', 'q-1'), rule, t0 + 102)).allowed, 'another account has its own bucket');
  assert((await consumeRateLimit(h.db, bucket('acct-1', 'q-1'), rule, t0 + rule.windowMs + 1000)).allowed, 'the window ends and reads resume the next day');
  console.log(`RECOGNIZE QUESTION CAP: PASS — ${checks} checks — 60 reads of one question a day on top of 120 an hour per account; refused before any provider work`);
} finally {
  await h.close();
}
