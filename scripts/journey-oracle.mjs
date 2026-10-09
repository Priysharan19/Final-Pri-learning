#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the "teacher's desk" for the native marking journeys
//
// TEST HARNESS ONLY — never part of the server or the app. Grading is
// online-only and server-authoritative (owner decision 2026-10-10, ADR-0001):
// a device never holds the answer of a question it is shown, so a journey
// that must type the RIGHT answer cannot learn it from the page. This reads
// it where only the server keeps it: the sealed copy of the issued question
// in the throwaway fixture database started by scripts/cloud-fixture-server.mjs
// (table idempotency_keys, scope practice-question, key = server question id),
// opened READ-ONLY. It also reads back what the server itself recorded as
// marked, so a journey's verdict never rests on what a screen said.
//
// Two ways to use it:
//   · import { openServerDesk } — a journey driver on the same machine as the
//     device's filesystem (scripts/iphone-journey.mjs, the iOS simulator);
//   · node scripts/journey-oracle.mjs --serve --db <fixture.db> --email <fixture account>
//       [--port 4311] [--token <secret>] [--out oracle.env]
//     a loopback-only HTTP relay for a device that cannot share files with
//     this process (the Android emulator reaches it at 10.0.2.2). It answers
//     the instrumentation TEST PROCESS, never the page:
//       GET /answer  the sealed answer of the question the account was issued last
//       GET /marked  every question the server completed, with its grades
//     Both need the X-Pri-Oracle token printed to --out.
//
// It refuses NODE_ENV=production and any database that is not a fixture
// (the account must be an @example.test fixture address).
// ─────────────────────────────────────────────────────────────────────────────
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Open the fixture server's database read-only for one fixture account.
 * `avoid` are strings the journey itself types or scripts (its deliberate
 * wrong answer, the stand-in reader's text): a sealed answer equal to one of
 * them cannot tell a hit from a miss, so it is reported as unsupported.
 */
export function openServerDesk({ dbPath, email, avoid = [] }) {
  if (process.env.NODE_ENV === 'production') throw new Error('journey-oracle: refused under NODE_ENV=production');
  if (!/@example\.test$/.test(String(email || ''))) throw new Error('journey-oracle: only a fixture account (@example.test) can be read');
  const Database = createRequire(join(ROOT, 'server/package.json'))('better-sqlite3');
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  const account = db.prepare('SELECT id FROM accounts WHERE email=?').get(email);
  if (!account) { db.close(); throw new Error('the fixture account is missing from the local server'); }
  const rows = (scope, extra = '', ...args) => db.prepare(`SELECT key,response_json,created_at FROM idempotency_keys WHERE account_id=? AND scope=? ${extra} ORDER BY created_at, rowid`).all(account.id, scope, ...args);

  /** The sealed answer of the question this account was issued last. */
  const sealedAnswer = () => {
    const issued = rows('practice-question').at(-1);
    if (!issued) return { supported: false, reason: 'nothing issued' };
    const question = JSON.parse(issued.response_json);
    const a = question.answer || {};
    let text = null;
    if (question.answerType === 'numeric') {
      if (a.canonicalInput) text = String(a.canonicalInput);
      else if (a.simplestFraction) text = `${a.simplestFraction.n}/${a.simplestFraction.d}`;
      else if (a.value !== undefined) text = String(a.value);
    }
    const fromPrepared = rows('practice-prepared').some(r => JSON.parse(r.response_json)?.question?.id === issued.key);
    // A statable answer the journey's own scripted inputs cannot be mistaken for.
    const supported = typeof text === 'string' && text.length > 0 && text.length <= 40 && !avoid.includes(text);
    return { supported, text: supported ? text : null, answerType: question.answerType, serverQuestionId: issued.key, fromPrepared };
  };

  /** Every question the server completed for this account, with the grades it gave. */
  const completed = () => rows('practice-completion').map(c => {
    const question = JSON.parse(rows('practice-question', 'AND key=?', c.key)[0].response_json);
    const grades = rows('practice-grade', "AND key LIKE ? || ':%'", c.key).map(g => JSON.parse(g.response_json));
    const event = db.prepare("SELECT payload_json FROM learning_events WHERE account_id=? AND kind='graded-attempt' AND entity_id=?").get(account.id, c.key);
    return { id: c.key, prompt: String(question.prompt || ''), grades, inputMode: event ? JSON.parse(event.payload_json).inputMode : null };
  });

  return { db, account, rows, sealedAnswer, completed, close: () => db.close() };
}

// ── The loopback relay (Android emulator) ────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = name => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : null; };
  if (!process.argv.includes('--serve') || !arg('db') || !arg('email')) {
    console.error('usage: node scripts/journey-oracle.mjs --serve --db <fixture.db> --email <fixture account> [--port 4311] [--token <secret>] [--avoid a,b] [--out oracle.env]');
    process.exit(2);
  }
  const port = Number(arg('port') || 4311);
  const token = arg('token') || randomBytes(18).toString('base64url');
  const avoid = (arg('avoid') || '').split(',').filter(Boolean);
  let desk;
  try { desk = openServerDesk({ dbPath: arg('db'), email: arg('email'), avoid }); }
  catch (error) { console.error(String(error?.message || error)); process.exit(1); }
  const authorised = given => {
    const a = Buffer.from(String(given || '')), b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
  };
  // Only what a marking journey needs of a grade; never the question's answer.
  const gradeFacts = g => ({
    authoritative: g.authoritative === true, correct: g.correct === true, invalid: g.invalid === true, resolved: g.resolved === true,
    marksEarned: g.marksEarned ?? null, marksPossible: g.marksPossible ?? null, triesLeft: g.triesLeft ?? null
  });
  const server = createServer((req, res) => {
    const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
    if (req.method !== 'GET') return send(405, { error: 'GET only' });
    if (!authorised(req.headers['x-pri-oracle'])) return send(401, { error: 'oracle token required' });
    const path = new URL(req.url, 'http://oracle').pathname;
    try {
      if (path === '/answer') return send(200, desk.sealedAnswer());
      if (path === '/marked') {
        return send(200, { completed: desk.completed().map(q => ({ serverQuestionId: q.id, inputMode: q.inputMode, grades: q.grades.map(gradeFacts) })), prepared: desk.rows('practice-prepared').length, issued: desk.rows('practice-question').length });
      }
      return send(404, { error: 'unknown question' });
    } catch (error) { return send(500, { error: String(error?.message || error).slice(0, 160) }); }
  });
  server.on('error', error => { console.error(`journey-oracle: ${error.message}`); process.exit(1); });
  // Loopback only: the emulator's 10.0.2.2 is this machine's 127.0.0.1.
  server.listen(port, '127.0.0.1', () => {
    const out = arg('out');
    if (out) writeFileSync(out, `PRI_ORACLE_PORT=${port}\nPRI_ORACLE_TOKEN=${token}\nPRI_ORACLE_PID=${process.pid}\n`);
    console.log(`Journey oracle on http://127.0.0.1:${port} (pid ${process.pid}) reading the fixture database read-only. SYNTHETIC TEST FIXTURE.`);
  });
}
