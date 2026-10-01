// SQL parameterisation contract (V1 blocker #14).
//
// Every value a request supplies reaches SQL as a bound `?` parameter. The only
// `${…}` interpolations allowed inside a SQL template literal in
// server/platform are the reviewed ones below: dialect helpers that emit fixed
// SQL fragments (store.js), a WHERE fragment chosen between two constants, and
// boot-time schema helpers whose arguments are literals in the same file. A new
// interpolation — above all one that names `req` — fails here until it is
// reviewed and listed. The HTTP half (SQL-ish strings stored verbatim, never
// executed) lives in security-acceptance-check.mjs.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'platform');
const REVIEWED = {
  "db.emailEquals('email')": 'store.js dialect helper: fixed case-insensitive comparison on a literal column',
  'db.likeEscape()': "store.js dialect helper: fixed ESCAPE '' clause",
  "db.binaryText('key')": 'store.js dialect helper: fixed collation on a literal column',
  "db.binaryText('a.id')": 'same',
  "db.binaryText('id')": 'same',
  "db.binaryText('ac.id')": 'same',
  "db.binaryText('c.content_key')": 'same',
  "db.nocaseOrder('a.name')": 'store.js dialect helper: fixed ORDER BY on a literal column',
  "db.nocaseOrder('ac.name')": 'same',
  "db.greatest('billing_subscriptions.trial_claimed', 'excluded.trial_claimed')": 'store.js dialect helper on literal columns',
  "db.greatest('billing_payments.amount', 'excluded.amount')": 'same',
  'latest.filter': 'content.js: one of two constant WHERE fragments; its value is bound separately',
  sql: 'authDelivery.js boot-time ALTER TABLE from a literal column list',
  list: 'db.js boot-time migration from a literal column list',
  table: 'billingSchema.js/db.js boot-time ALTER TABLE on literal table names',
  ddl: 'billingSchema.js/db.js boot-time ALTER TABLE with literal column DDL'
};

const SQL = /\b(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|PRAGMA|WITH)\b/;
const found = [];
for (const file of readdirSync(dir).filter(name => name.endsWith('.js') && !name.endsWith('.generated.js'))) {
  const source = readFileSync(join(dir, file), 'utf8');
  for (const match of source.matchAll(/`((?:[^`\\]|\\.)*)`/g)) {
    const text = match[1];
    if (!SQL.test(text)) continue;
    for (const interpolation of text.matchAll(/\$\{([^}]*)\}/g)) {
      found.push({ file, expression: interpolation[1].trim(), line: source.slice(0, match.index).split('\n').length });
    }
  }
}

const unreviewed = found.filter(entry => !REVIEWED[entry.expression]);
assert.deepEqual(unreviewed.map(entry => `${entry.file}:${entry.line} \${${entry.expression}}`), [], 'every interpolation inside a SQL template is a reviewed constant fragment');
assert.ok(found.every(entry => !/\breq\b|\bbody\b|\bparams\b|\bquery\b/.test(entry.expression)), 'no request value is ever interpolated into SQL');
assert.ok(found.length >= 10, `the scan sees the platform's SQL (${found.length} reviewed interpolations)`);
const stale = Object.keys(REVIEWED).filter(expression => !found.some(entry => entry.expression === expression));
assert.deepEqual(stale, [], 'no stale allow-list entries');

console.log(`SQL PARAMETERISATION — PASS — ${found.length} interpolations, all reviewed constant fragments; request values are bound parameters only`);
