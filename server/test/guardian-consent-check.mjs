// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a guardian's confirmation before a child's data leaves
//
// Under the DPDP Act a child is anyone under 18, so every Class 7-12 student is
// one, and the app asks which class you are in — it cannot claim not to know.
//
// What this suite holds:
//
//   · the safe default is the protective one: silence means child;
//   · a child's cloud account cannot sync, be billed, or use the paid readers
//     until a guardian confirms, and CAN once they have;
//   · withdrawal is as easy as consent was, and stops sync at once;
//   · the app is not walled off meanwhile — only the routes that move data;
//   · nothing anywhere calls this "verifiable parental consent", because it is
//     not: it establishes that somebody with the guardian's mailbox followed a
//     link, and Rule 10 will want more than that from 14 May 2027;
//   · and the schema migration that carries it does not destroy unsent email,
//     which it did on my first attempt.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createPlatformDb } from '../platform/db.js';
import {
  CONSENT_METHOD, CONSENT_NOTICE_VERSION, confirmConsent, consentState,
  learnerIsChild, recordConsentRequest, requireGuardianConsent, validateGuardian, withdrawConsent
} from '../platform/guardianConsent.js';
import { authEmailMessage, buildAuthActionUrl } from '../platform/authDelivery.js';
import { SESSION_COOKIE, sha256 } from '../platform/security.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ── 1 · Silence means child ──────────────────────────────────────────────────
eq(learnerIsChild({ year: 7 }), true, 'a Class 7 student is a child');
eq(learnerIsChild({ year: 12 }), true, 'and so is a Class 12 student — the line is 18, not 13');
eq(learnerIsChild({}), false, 'someone who names no class and claims nothing is not assumed to be a child');
eq(learnerIsChild({ isAdult: false }), true, 'saying you are not an adult is taken at its word');
eq(learnerIsChild({ isAdult: true, year: 8 }), false, 'and so is saying you are one, which is the only declaration a service can take');
eq(learnerIsChild({ isAdult: undefined, year: 10 }), true, 'no declaration plus a school class is a child — the safe default is the protective one');

// ── 2 · A guardian needs a name and a reachable address ──────────────────────
eq(validateGuardian({ guardianName: '', guardianEmail: 'a@b.test' }).code, 'GUARDIAN_NAME_REQUIRED', 'a guardian must be named');
eq(validateGuardian({ guardianName: 'Meera', guardianEmail: 'not-an-email' }).code, 'GUARDIAN_EMAIL_REQUIRED', 'and reachable');
const good = validateGuardian({ guardianName: '  Meera Rao ', guardianEmail: ' Meera@Example.TEST ' });
eq([good.ok, good.name, good.email], [true, 'Meera Rao', 'meera@example.test'], 'a real one is trimmed and lower-cased');

// ── 3 · The state machine ────────────────────────────────────────────────────
const db = createPlatformDb(':memory:');
const now = Date.now();
const mk = (id, email) => db.prepare('INSERT INTO accounts(id,email,name,role,created_at,updated_at,email_verified_at) VALUES (?,?,?,?,?,?,?)')
  .run(id, email, 'S', 'student', now, now, now);
mk('acct-child', 'child@example.test');
mk('acct-adult', 'adult@example.test');
for (const id of ['acct-child', 'acct-adult']) {
  db.prepare(`INSERT INTO account_sessions(id,account_id,token_hash,device_id,user_agent_hash,created_at,last_seen_at,expires_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(`ses-${id}`, id, sha256(`raw-${id}`), 'ipad', null, now, now, now + 86400000);
}

eq(consentState(db, 'acct-adult').state, 'not-required', 'an account with no consent row needs none — that is what "no row" means');
recordConsentRequest(db, { accountId: 'acct-child', name: 'Meera Rao', email: 'meera@example.test', tokenHash: 'tok', now });
eq(consentState(db, 'acct-child').state, 'pending', 'a child starts pending');
eq(consentState(db, 'acct-child').row.notice_version, CONSENT_NOTICE_VERSION, 'and records which notice was agreed to');
eq(consentState(db, 'acct-child').row.method, CONSENT_METHOD, 'and how, so no later reader mistakes it for more');
ok(confirmConsent(db, 'acct-child', now), 'a guardian confirms');
eq(consentState(db, 'acct-child').state, 'given', 'and the account is permitted');
ok(!confirmConsent(db, 'acct-child', now), 'confirming twice changes nothing');
ok(withdrawConsent(db, 'acct-child', now + 1), 'a guardian withdraws');
eq(consentState(db, 'acct-child').state, 'withdrawn', 'and the account is not permitted again');
ok(consentState(db, 'acct-child').row.requested_at > 0 && consentState(db, 'acct-child').row.confirmed_at > 0,
  'the record keeps that it was asked and given, rather than being deleted — a guardian may need that shown back');

// ── 4 · The gate, over HTTP ──────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/guarded', requireGuardianConsent(db), (req, res) => res.json({ ok: true }));
const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const call = (who) => fetch(`${base}/guarded`, { headers: { cookie: `${SESSION_COOKIE}=raw-${who}` } })
  .then(async r => ({ status: r.status, json: await r.json().catch(() => null) }));

try {
  const adult = await call('acct-adult');
  eq(adult.status, 200, 'an account that needs no consent passes');

  const withdrawn = await call('acct-child');
  eq([withdrawn.status, withdrawn.json?.error?.code], [403, 'GUARDIAN_CONSENT_WITHDRAWN'], 'a withdrawn account is refused');

  db.prepare('UPDATE guardian_consents SET withdrawn_at = NULL, confirmed_at = NULL WHERE account_id = ?').run('acct-child');
  const pending = await call('acct-child');
  eq([pending.status, pending.json?.error?.code], [403, 'GUARDIAN_CONSENT_PENDING'], 'and so is a pending one');
  ok(/stays on this device/i.test(pending.json?.error?.message || ''),
    'and the student is told their work is safe, because it is — nothing has been lost, it simply has not synced');

  confirmConsent(db, 'acct-child', now);
  eq((await call('acct-child')).status, 200, 'once confirmed, it passes');
} finally {
  server.close();
}

// ── 5 · Only the routes that move data are gated ─────────────────────────────
const routerSource = readFileSync(new URL('../platform/router.js', import.meta.url), 'utf8');
for (const mounted of ['/sync', '/billing', '/handwriting', '/working']) {
  const line = routerSource.split('\n').find(l => l.includes(`router.use('${mounted}'`));
  ok(line && line.includes('requireGuardianConsent'), `${mounted} is gated — it moves a child's work or takes money`);
}
for (const open of ['/curriculum', '/content']) {
  const line = routerSource.split('\n').find(l => l.includes(`router.use('${open}'`));
  ok(!line || !line.includes('requireGuardianConsent'),
    `${open} is not gated — the app has to keep working while a guardian is asked`);
}

// ── 6 · The guardian's email says what it is asking for ──────────────────────
const url = buildAuthActionUrl('https://learn.pri.example', 'guardian-consent', 'tok');
const mail = authEmailMessage('guardian-consent', url);
ok(/child/i.test(mail.subject), 'the subject tells a parent it is about their child');
ok(/works on their device without an account/i.test(mail.text),
  'the body says the app works without the account, so a parent is not pressured by a false urgency');
ok(/if you do nothing/i.test(mail.text), 'and says plainly what happens if they ignore it');
ok(/withdraw/i.test(mail.text), 'and that they can withdraw');

// ── 7 · It never claims to be more than it is ────────────────────────────────
const sources = ['../platform/guardianConsent.js', '../platform/accounts.js', '../platform/authDelivery.js']
  .map(rel => readFileSync(new URL(rel, import.meta.url), 'utf8')).join('\n');
ok(!/\bverifiable (parental|guardian) consent\b(?![^\n]*(will|Rule 10|does not|not\b))/i.test(
  sources.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')),
  'no code path calls this verifiable parental consent — it is guardian email confirmation, and Rule 10 wants more');
const privacy = readFileSync(new URL('../../docs/legal/privacy.md', import.meta.url), 'utf8');
ok(!/verifiable consent from a parent[\s\S]{0,200}we (verify|confirm) (their identity|that they are)/i.test(privacy),
  'and the notice does not claim an identity check that is not performed');

// ── 8 · The migration carries unsent email across ────────────────────────────
// It did not, on the first attempt: auth_delivery_outbox.token_id references
// account_tokens ON DELETE CASCADE, and the rebuild dropped that table with
// foreign keys still on. SQLite also ignores PRAGMA foreign_keys inside a
// transaction, so it has to be set outside one.
// fileURLToPath, not .pathname: this repository's path contains spaces and a
// percent-encoded path is not a filename.
const dbFile = fileURLToPath(new URL('../../.migration-probe.db', import.meta.url));
try { unlinkSync(dbFile); } catch { /* fresh */ }
const { default: Database } = await import('better-sqlite3');
const legacy = new Database(dbFile);
legacy.exec(`
  DROP TABLE IF EXISTS auth_delivery_outbox; DROP TABLE IF EXISTS account_tokens; DROP TABLE IF EXISTS accounts;
  CREATE TABLE accounts (id TEXT PRIMARY KEY, email TEXT, name TEXT, role TEXT, created_at INTEGER, updated_at INTEGER);
  CREATE TABLE account_tokens (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL CHECK(purpose IN ('verify-email','reset-password')), token_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, consumed_at INTEGER);
  CREATE TABLE auth_delivery_outbox (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK(kind IN ('verify-email','reset-password')), destination TEXT NOT NULL,
    token_id TEXT NOT NULL REFERENCES account_tokens(id) ON DELETE CASCADE, token_ciphertext TEXT NOT NULL,
    created_at INTEGER NOT NULL, delivered_at INTEGER, attempt_count INTEGER NOT NULL DEFAULT 0,
    last_attempt_at INTEGER, next_attempt_at INTEGER, last_error_code TEXT, provider_message_id TEXT);
`);
legacy.prepare('INSERT INTO accounts VALUES (?,?,?,?,?,?)').run('acct-1', 'a@x.test', 'A', 'student', 1, 1);
legacy.prepare('INSERT INTO account_tokens VALUES (?,?,?,?,?,?,?)').run('tok-1', 'acct-1', 'verify-email', 'hash-1', 1, 9e12, null);
legacy.prepare('INSERT INTO auth_delivery_outbox(id,account_id,kind,destination,token_id,token_ciphertext,created_at) VALUES (?,?,?,?,?,?,?)')
  .run('mail-1', 'acct-1', 'verify-email', 'a@x.test', 'tok-1', 'CIPHER', 1);
legacy.close();

const migrated = createPlatformDb(dbFile);
eq(migrated.prepare('SELECT COUNT(*) n FROM account_tokens').get().n, 1, 'the migration keeps every account token');
eq(migrated.prepare('SELECT COUNT(*) n FROM auth_delivery_outbox').get().n, 1, 'and every unsent email — dropping one loses somebody their account');
const carried = migrated.prepare('SELECT * FROM auth_delivery_outbox').get();
eq([carried.token_ciphertext, carried.destination], ['CIPHER', 'a@x.test'], 'with its envelope and destination intact');
ok(migrated.prepare("SELECT sql FROM sqlite_master WHERE name='auth_delivery_outbox'").get().sql.includes('guardian-consent'),
  'and the widened constraint now admits a guardian email');
eq(migrated.pragma('foreign_keys', { simple: true }), 1, 'and foreign keys are switched back on afterwards');
migrated.close();
try { unlinkSync(dbFile); } catch { /* already gone */ }

console.log(failures.length
  ? `GUARDIAN CONSENT: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `GUARDIAN CONSENT: PASS — ${pass}/${pass} checks — silence means child, sync waits for a guardian, withdrawal is as easy as consent, the app keeps working meanwhile, and nothing calls it more than it is.`);
process.exit(failures.length ? 1 : 0);
